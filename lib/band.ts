import { supabase } from './supabase';

export interface Band {
  id: string;
  name: string;
  code: string;
  admin_id: string;
  created_at?: string;
}

export const BAND_JOINED_KEY = 'chord-grid-band-joined';
export const BAND_NAME_KEY = 'chord-grid-band-name';
export const BAND_ID_KEY = 'chord-grid-band-id';

/** Cache key for storing band information scoped to a specific email */
export const getEmailBandCacheKey = (email: string) =>
  `chord-grid-band-email-${email.trim().toLowerCase()}`;

/** Get locally stored band membership info for current device/session */
export function getStoredBand(): { id: string | null; name: string | null; code: string | null } {
  if (typeof window === 'undefined') {
    return { id: null, name: null, code: null };
  }
  return {
    id: localStorage.getItem(BAND_ID_KEY),
    name: localStorage.getItem(BAND_NAME_KEY),
    code: localStorage.getItem(BAND_JOINED_KEY),
  };
}

/** Get band info saved specifically for a given email */
export function getBandForEmail(email: string | null | undefined): Band | null {
  if (typeof window === 'undefined' || !email) return null;
  try {
    const raw = localStorage.getItem(getEmailBandCacheKey(email));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.code) return parsed as Band;
    }
  } catch (e) {
    console.warn('[Band] Error reading email band cache:', e);
  }
  return null;
}

/** Save band membership locally in active storage and per-email cache */
export function saveBandLocally(band: Band, email?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BAND_ID_KEY, band.id);
    localStorage.setItem(BAND_NAME_KEY, band.name);
    localStorage.setItem(BAND_JOINED_KEY, band.code);

    if (email) {
      localStorage.setItem(getEmailBandCacheKey(email), JSON.stringify(band));
    }
    window.dispatchEvent(new CustomEvent('band-joined', { detail: band }));
  } catch (e) {
    console.warn('[Band] Failed to save band locally:', e);
  }
}

/** Restore band membership from an email cache into active session */
export function restoreBandForEmail(email: string): Band | null {
  const band = getBandForEmail(email);
  if (band) {
    saveBandLocally(band, email);
    return band;
  }
  return null;
}

/** Clear active device session band keys without erasing saved email caches */
export function clearActiveBandSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BAND_ID_KEY);
  localStorage.removeItem(BAND_NAME_KEY);
  localStorage.removeItem(BAND_JOINED_KEY);
  window.dispatchEvent(new CustomEvent('band-left'));
}

/** Check if current device or user has already joined a band */
export function hasJoinedBand(user?: { email?: string | null; user_metadata?: any } | null): boolean {
  if (typeof window === 'undefined') return false;

  // If a specific user is provided with an email, verify their email-specific membership or metadata
  if (user?.email) {
    const cached = getBandForEmail(user.email);
    if (cached?.code) {
      // Auto-restore active session keys if missing
      if (!localStorage.getItem(BAND_JOINED_KEY)) {
        saveBandLocally(cached, user.email);
      }
      return true;
    }
    if (user?.user_metadata?.band_code) {
      return true;
    }
    // When a specific email is checked and has no record, return false
    return false;
  }

  // Device-level check when no specific user email is provided
  if (localStorage.getItem(BAND_JOINED_KEY)) return true;
  if (user?.user_metadata?.band_code) return true;

  return false;
}

/** Sync and restore band membership for a user from local cache or Supabase */
export async function syncBandForUser(user: { id: string; email?: string | null; user_metadata?: any }): Promise<Band | null> {
  if (!user) return null;

  // 1. Check email cache first for immediate synchronous restoration
  if (user.email) {
    const cached = getBandForEmail(user.email);
    if (cached) {
      saveBandLocally(cached, user.email);
    }
  }

  try {
    // 2. Query Supabase profiles table for band_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('band_id, band_name, role, instrument, username')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.band_id) {
      const { data: bandData } = await supabase
        .from('bands')
        .select('*')
        .eq('id', profile.band_id)
        .maybeSingle();

      if (bandData) {
        const band: Band = {
          id: bandData.id,
          name: bandData.name || profile.band_name || 'Band Workspace',
          code: bandData.code,
          admin_id: bandData.admin_id,
          created_at: bandData.created_at,
        };
        saveBandLocally(band, user.email);

        // Update auth user metadata in background for offline resilience
        await supabase.auth.updateUser({
          data: { band_id: band.id, band_name: band.name, band_code: band.code },
        }).catch(() => {});

        return band;
      }
    }

    // 3. If profile didn't have band_id, check if user is the admin of a band
    const { data: adminBand } = await supabase
      .from('bands')
      .select('*')
      .eq('admin_id', user.id)
      .maybeSingle();

    if (adminBand) {
      const band: Band = adminBand;
      saveBandLocally(band, user.email);

      // Backfill profiles table
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          band_id: band.id,
          band_name: band.name,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      await supabase.auth.updateUser({
        data: { band_id: band.id, band_name: band.name, band_code: band.code },
      }).catch(() => {});

      return band;
    }

    // 4. Check user metadata for band_code as fallback
    if (user.user_metadata?.band_code) {
      const code = user.user_metadata.band_code;
      const { data: metaBand } = await supabase
        .from('bands')
        .select('*')
        .ilike('code', code)
        .maybeSingle();

      if (metaBand) {
        saveBandLocally(metaBand, user.email);
        return metaBand;
      }
    }
  } catch (err) {
    console.warn('[Band] Error syncing band from Supabase:', err);
  }

  // Fallback to local email cache if offline
  if (user.email) {
    return getBandForEmail(user.email);
  }
  return null;
}

/** Create a new band workspace with a custom name and PIN/code */
export async function createBand(name: string, code: string): Promise<{ success: boolean; band?: Band; error?: string }> {
  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();

  if (!trimmedName) {
    return { success: false, error: 'Please enter a band name.' };
  }
  if (!trimmedCode || trimmedCode.length < 2) {
    return { success: false, error: 'Band Code must be at least 2 characters.' };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || crypto.randomUUID();

    // Check if code is already in use
    const { data: existing } = await supabase
      .from('bands')
      .select('id')
      .ilike('code', trimmedCode)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `The code "${trimmedCode}" is already taken. Please choose another code.` };
    }

    const newBand: Band = {
      id: crypto.randomUUID(),
      name: trimmedName,
      code: trimmedCode,
      admin_id: userId,
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from('bands').insert(newBand);
    if (insertError) {
      console.warn('[Band] Error inserting band:', insertError);
    }

    // Persist locally for active session and user email
    saveBandLocally(newBand, user?.email);

    // Update profile in background if user is authenticated
    if (user) {
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'Leader',
          display_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Leader',
          role: 'admin',
          band_id: newBand.id,
          band_name: newBand.name,
          updated_at: new Date().toISOString(),
        });
        await supabase.auth.updateUser({
          data: { profession: 'admin', band_id: newBand.id, band_name: newBand.name, band_code: newBand.code },
        });
      } catch (err) {
        console.warn('[Band] Profile update warning:', err);
      }
    }

    return { success: true, band: newBand };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create band.' };
  }
}

/** Join an existing band by entering its code/PIN */
export async function joinBand(code: string): Promise<{ success: boolean; band?: Band; error?: string }> {
  const trimmedCode = code.trim().toUpperCase();
  if (!trimmedCode) {
    return { success: false, error: 'Please enter a Band Code / PIN.' };
  }

  try {
    const { data, error } = await supabase
      .from('bands')
      .select('*')
      .ilike('code', trimmedCode)
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: `No band found with code "${trimmedCode}". Please verify the code with your band leader.`,
      };
    }

    const band: Band = data;
    const { data: { user } } = await supabase.auth.getUser();

    // Persist locally for active session and user email
    saveBandLocally(band, user?.email);

    // Update profile in background if user is authenticated
    if (user) {
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: user.email,
          band_id: band.id,
          band_name: band.name,
          updated_at: new Date().toISOString(),
        });
        await supabase.auth.updateUser({
          data: { band_id: band.id, band_name: band.name, band_code: band.code },
        });
      } catch (err) {
        console.warn('[Band] Profile update warning on join:', err);
      }
    }

    return { success: true, band };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to join band.' };
  }
}

/** Disconnect / leave the current band workspace */
export async function leaveBand(email?: string | null): Promise<void> {
  clearActiveBandSession();
  if (email && typeof window !== 'undefined') {
    localStorage.removeItem(getEmailBandCacheKey(email));
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        band_id: null,
        band_name: null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      await supabase.auth.updateUser({
        data: { band_id: null, band_name: null, band_code: null },
      });
    }
  } catch (err) {
    console.warn('[Band] Leave band remote update error:', err);
  }
}

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
export async function syncBandForUser(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }): Promise<Band | null> {
  if (!user) return null;

  // 1. Check email cache first for immediate synchronous restoration
  if (user.email) {
    const cached = getBandForEmail(user.email);
    if (cached) {
      saveBandLocally(cached, user.email);
      // If offline or non-browser test environment, return cached immediately
      if (typeof window !== 'undefined' && !navigator.onLine) {
        return cached;
      }
    }
  }

  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const remoteSync = async (): Promise<Band | null> => {
      // 2. Query Supabase profiles table for band_id (by id or email)
      let profileBandId: string | null = null;
      let profileBandName: string | null = null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('band_id, band_name, role, instrument, username')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.band_id) {
      profileBandId = profile.band_id;
      profileBandName = profile.band_name;
    } else if (user.email) {
      const { data: emailProfile } = await supabase
        .from('profiles')
        .select('band_id, band_name, role, instrument, username')
        .ilike('email', user.email.trim())
        .not('band_id', 'is', null)
        .maybeSingle();
      if (emailProfile?.band_id) {
        profileBandId = emailProfile.band_id;
        profileBandName = emailProfile.band_name;
      }
    }

    if (profileBandId) {
      const { data: bandData } = await supabase
        .from('bands')
        .select('*')
        .eq('id', profileBandId)
        .maybeSingle();

      if (bandData) {
        const band: Band = {
          id: bandData.id,
          name: bandData.name || profileBandName || 'Band Workspace',
          code: bandData.code,
          admin_id: bandData.admin_id,
          created_at: bandData.created_at,
        };
        saveBandLocally(band, user.email);

        // Ensure user's profile has this band populated if missing
        try {
          if (profile?.band_id !== band.id) {
            await supabase.from('profiles').update({
              band_id: band.id,
              band_name: band.name,
              updated_at: new Date().toISOString(),
            }).eq('id', user.id);
          }
        } catch {}

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

      try {
        if (profile?.band_id !== band.id) {
          await supabase.from('profiles').update({
            band_id: band.id,
            band_name: band.name,
            updated_at: new Date().toISOString(),
          }).eq('id', user.id);
        }
      } catch {}

      return band;
    }

    // 4. Check user metadata for band_code or band_id as fallback
    const metaCode = (user.user_metadata?.band_code as string) || null;
    const metaBandId = (user.user_metadata?.band_id as string) || null;
    if (metaCode || metaBandId) {
      let query = supabase.from('bands').select('*');
      if (metaCode) query = query.ilike('code', metaCode);
      else if (metaBandId) query = query.eq('id', metaBandId);

      const { data: metaBand } = await query.maybeSingle();
      if (metaBand) {
        saveBandLocally(metaBand, user.email);
        try {
          if (profile?.band_id !== metaBand.id) {
            await supabase.from('profiles').update({
              band_id: metaBand.id,
              band_name: metaBand.name,
              updated_at: new Date().toISOString(),
            }).eq('id', user.id);
          }
        } catch {}
        return metaBand;
      }
    }

    // 5. Check if local active session has a band (e.g. from Vercel desktop session)
    const localStored = getStoredBand();
    if (localStored.id && localStored.name && localStored.code) {
      const band: Band = {
        id: localStored.id,
        name: localStored.name,
        code: localStored.code,
        admin_id: user.id,
      };
      saveBandLocally(band, user.email);
      try {
        if (profile?.band_id !== band.id) {
          await supabase.from('profiles').update({
            band_id: band.id,
            band_name: band.name,
            updated_at: new Date().toISOString(),
          }).eq('id', user.id);
        }
      } catch {}
      return band;
    }

    // 6. Church / Choir Workspace auto-association for verified choir accounts
    const normalizedEmail = (user.email || '').toLowerCase().trim();
    if (normalizedEmail.includes('ddosatt') || normalizedEmail.includes('donythomas')) {
      const { data: churchBand } = await supabase
        .from('bands')
        .select('*')
        .ilike('code', 'INFANTJESUS')
        .maybeSingle();
      if (churchBand) {
        saveBandLocally(churchBand, user.email);
        try {
          if (profile?.band_id !== churchBand.id) {
            await supabase.from('profiles').update({
              band_id: churchBand.id,
              band_name: churchBand.name,
              role: 'instrument',
              instrument: 'Piano / Keyboard',
              updated_at: new Date().toISOString(),
            }).eq('id', user.id);
          }
        } catch {}
        return churchBand;
      }
    }
    return null;
  };

    const result = await Promise.race([remoteSync(), timeoutPromise]);
    if (result) return result;
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create band.';
    return { success: false, error: errorMsg };
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
        await supabase.from('profiles').update({
          band_id: band.id,
          band_name: band.name,
          updated_at: new Date().toISOString(),
        }).eq('id', user.id);

        await supabase.auth.updateUser({
          data: { band_id: band.id, band_name: band.name, band_code: band.code },
        });
      } catch (err) {
        console.warn('[Band] Profile update warning on join:', err);
      }
    }

    return { success: true, band };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to join band.';
    return { success: false, error: errorMsg };
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

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

/** Get local stored band membership info */
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

/** Check if current device / user has joined a band */
export function hasJoinedBand(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(BAND_JOINED_KEY));
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
      // Fallback local save if offline
    }

    // Persist locally
    if (typeof window !== 'undefined') {
      localStorage.setItem(BAND_ID_KEY, newBand.id);
      localStorage.setItem(BAND_NAME_KEY, newBand.name);
      localStorage.setItem(BAND_JOINED_KEY, newBand.code);
      window.dispatchEvent(new CustomEvent('band-joined', { detail: newBand }));
    }

    // Update profile in background if user is authenticated
    if (user) {
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          username: user.email?.split('@')[0] || 'Leader',
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

    // Persist locally
    if (typeof window !== 'undefined') {
      localStorage.setItem(BAND_ID_KEY, band.id);
      localStorage.setItem(BAND_NAME_KEY, band.name);
      localStorage.setItem(BAND_JOINED_KEY, band.code);
      window.dispatchEvent(new CustomEvent('band-joined', { detail: band }));
    }

    // Update profile in background if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
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
export async function leaveBand(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(BAND_ID_KEY);
    localStorage.removeItem(BAND_NAME_KEY);
    localStorage.removeItem(BAND_JOINED_KEY);
    window.dispatchEvent(new CustomEvent('band-left'));
  }
}

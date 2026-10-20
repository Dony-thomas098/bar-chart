'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { flushPendingSaves } from '@/lib/storage';
import { getStoredBand, restoreBandForEmail, syncBandForUser, clearActiveBandSession } from '@/lib/band';

export type UserProfession = 'singing' | 'instrument' | 'admin' | null;

export interface UserProfile {
  username?: string;
  profession?: UserProfession;
  instrument?: string | null;
  band_id?: string | null;
  band_name?: string | null;
  band_code?: string | null;
  email?: string | null;
}

export function canModifySection(
  profession: UserProfession | undefined,
  sectionKind: 'chart' | 'lyrics'
): boolean {
  // All band members, singers, instrumentalists, and admins can collaboratively create and modify charts and lyrics
  return true;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  profile: UserProfile;
  enableGuestMode: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true, 
  isGuest: false, 
  profile: { profession: null, instrument: null, username: '', band_id: null, band_name: null, band_code: null, email: null },
  enableGuestMode: () => {},
  updateProfile: async () => {},
  signOut: async () => {} 
});

const GUEST_KEY = 'chord-grid-guest-mode';
const OFFLINE_USER_KEY = 'chord-grid-offline-user-id';
const PROFESSION_KEY = 'chord-grid-profession';
const INSTRUMENT_KEY = 'chord-grid-instrument';
const USERNAME_KEY = 'chord-grid-username';

export const getEmailProfileCacheKey = (email: string) =>
  `chord-grid-profile-email-${email.trim().toLowerCase()}`;

function getOrCreateOfflineUser(): User {
  let offlineId = typeof window !== 'undefined' ? localStorage.getItem(OFFLINE_USER_KEY) : null;
  if (!offlineId) {
    offlineId = 'offline-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
    if (typeof window !== 'undefined') {
      localStorage.setItem(OFFLINE_USER_KEY, offlineId);
    }
  }
  return {
    id: offlineId,
    email: 'guest@offline.local',
    app_metadata: {},
    user_metadata: { name: 'Offline Guest' },
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<UserProfile>({ 
    profession: null, 
    instrument: null, 
    username: '',
    band_id: null,
    band_name: null,
    band_code: null,
    email: null,
  });

  const lastSyncedUserIdRef = useRef<string | null>(null);

  // Sync profile when user changes: immediate local restore + background Supabase sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!user) {
      lastSyncedUserIdRef.current = null;
      setProfile({ profession: null, instrument: null, username: '', band_id: null, band_name: null, band_code: null, email: null });
      return;
    }

    const email = user.email || '';
    const userPrefix = `${user.id}_`;
    let cachedEmailProfile: Partial<UserProfile> = {};

    if (email) {
      try {
        const cachedRaw = localStorage.getItem(getEmailProfileCacheKey(email));
        if (cachedRaw) {
          cachedEmailProfile = JSON.parse(cachedRaw);
        }
      } catch (err) {
        console.warn('[Auth] Error reading cached email profile:', err);
      }
      // Immediately restore band keys from email cache if available
      restoreBandForEmail(email);
    }

    const storedBand = getStoredBand();
    const meta = user.user_metadata || {};

    const storedProfession = localStorage.getItem(`${userPrefix}profession`) || localStorage.getItem(PROFESSION_KEY);
    const storedInstrument = localStorage.getItem(`${userPrefix}instrument`) || localStorage.getItem(INSTRUMENT_KEY);
    const storedUsername = localStorage.getItem(`${userPrefix}username`) || localStorage.getItem(USERNAME_KEY);

    const initialProfession = (cachedEmailProfile.profession as UserProfession) || (meta.profession as UserProfession) || (storedProfession as UserProfession) || null;
    const initialInstrument = cachedEmailProfile.instrument || (meta.instrument as string) || storedInstrument || null;
    const initialUsername = cachedEmailProfile.username || (meta.username as string) || (meta.name as string) || storedUsername || (email ? email.split('@')[0] : '');
    const initialBandId = cachedEmailProfile.band_id || storedBand.id || meta.band_id || null;
    const initialBandName = cachedEmailProfile.band_name || storedBand.name || meta.band_name || null;
    const initialBandCode = cachedEmailProfile.band_code || storedBand.code || meta.band_code || null;

    setProfile({
      profession: initialProfession,
      instrument: initialInstrument,
      username: initialUsername,
      band_id: initialBandId,
      band_name: initialBandName,
      band_code: initialBandCode,
      email: email || null,
    });

    // Guard: only execute background Supabase sync once per authenticated user ID session
    if (lastSyncedUserIdRef.current === user.id) {
      return;
    }
    lastSyncedUserIdRef.current = user.id;

    // Background sync from Supabase according to user id / email
    let isCancelled = false;
    const syncRemoteProfile = async () => {
      try {
        // Sync band first
        const syncedBand = await syncBandForUser(user);

        // Fetch user profile from public.profiles table
        const { data: remoteProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (isCancelled) return;

        if (remoteProfile) {
          const finalProfession = (remoteProfile.role as UserProfession) || initialProfession;
          const finalInstrument = remoteProfile.instrument || initialInstrument;
          const finalUsername = remoteProfile.username || remoteProfile.display_name || initialUsername;
          const finalBandId = syncedBand?.id || remoteProfile.band_id || initialBandId;
          const finalBandName = syncedBand?.name || remoteProfile.band_name || initialBandName;
          const finalBandCode = syncedBand?.code || initialBandCode;

          const updated: UserProfile = {
            profession: finalProfession,
            instrument: finalInstrument,
            username: finalUsername,
            band_id: finalBandId,
            band_name: finalBandName,
            band_code: finalBandCode,
            email: email || null,
          };

          setProfile(updated);

          // Persist to local storage & mark onboarding as completed if profile is configured
          if (typeof window !== 'undefined') {
            if (email) {
              localStorage.setItem(getEmailProfileCacheKey(email), JSON.stringify(updated));
            }
            if (finalProfession) {
              localStorage.setItem(`${userPrefix}profession`, finalProfession);
              localStorage.setItem(PROFESSION_KEY, finalProfession);
              localStorage.setItem(`${userPrefix}onboarding_completed`, 'true');
              localStorage.setItem('chord-grid-onboarding-completed', 'true');
            }
            if (finalInstrument) {
              localStorage.setItem(`${userPrefix}instrument`, finalInstrument);
              localStorage.setItem(INSTRUMENT_KEY, finalInstrument);
            }
          }

          // Backfill Supabase profiles table if local or synced band was found but missing from DB
          if (finalBandId && remoteProfile.band_id !== finalBandId) {
            try {
              await supabase.from('profiles').update({
                band_id: finalBandId,
                band_name: finalBandName,
                updated_at: new Date().toISOString(),
              }).eq('id', user.id);
            } catch {}
          }
        } else if (syncedBand) {
          setProfile(prev => ({
            ...prev,
            band_id: syncedBand.id,
            band_name: syncedBand.name,
            band_code: syncedBand.code,
          }));
        }
      } catch (err) {
        console.warn('[Auth] Background remote profile sync warning:', err);
      }
    };

    syncRemoteProfile();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  const updateProfile = async (newProfile: Partial<UserProfile>) => {
    const stored = getStoredBand();
    const preservedBandId = newProfile.band_id !== undefined ? newProfile.band_id : (profile.band_id || stored.id);
    const preservedBandName = newProfile.band_name !== undefined ? newProfile.band_name : (profile.band_name || stored.name);
    const preservedBandCode = newProfile.band_code !== undefined ? newProfile.band_code : (profile.band_code || stored.code);

    const updated: UserProfile = {
      ...profile,
      ...newProfile,
      band_id: preservedBandId,
      band_name: preservedBandName,
      band_code: preservedBandCode,
    };
    setProfile(updated);

    if (typeof window !== 'undefined') {
      const userPrefix = user ? `${user.id}_` : '';
      if (updated.profession !== undefined) {
        if (updated.profession) {
          localStorage.setItem(`${userPrefix}profession`, updated.profession);
          localStorage.setItem(PROFESSION_KEY, updated.profession);
          localStorage.setItem(`${userPrefix}onboarding_completed`, 'true');
          localStorage.setItem('chord-grid-onboarding-completed', 'true');
        } else {
          localStorage.removeItem(`${userPrefix}profession`);
          localStorage.removeItem(PROFESSION_KEY);
        }
      }
      if (updated.instrument !== undefined) {
        if (updated.instrument) {
          localStorage.setItem(`${userPrefix}instrument`, updated.instrument);
          localStorage.setItem(INSTRUMENT_KEY, updated.instrument);
        } else {
          localStorage.removeItem(`${userPrefix}instrument`);
          localStorage.removeItem(INSTRUMENT_KEY);
        }
      }
      if (updated.username !== undefined) {
        if (updated.username) {
          localStorage.setItem(`${userPrefix}username`, updated.username);
          localStorage.setItem(USERNAME_KEY, updated.username);
        } else {
          localStorage.removeItem(`${userPrefix}username`);
          localStorage.removeItem(USERNAME_KEY);
        }
      }
      if (user?.email) {
        localStorage.setItem(getEmailProfileCacheKey(user.email), JSON.stringify(updated));
      }
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updated }));
    }

    if (user && !isGuest) {
      try {
        await supabase.auth.updateUser({
          data: {
            profession: updated.profession,
            instrument: updated.instrument,
            username: updated.username,
            band_id: updated.band_id,
            band_name: updated.band_name,
            band_code: updated.band_code,
          }
        });

        // Non-destructive update to public.profiles table
        const profileUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (updated.username) {
          profileUpdates.username = updated.username;
          profileUpdates.display_name = updated.username;
        }
        if (updated.profession) {
          profileUpdates.role = updated.profession;
        }
        if (updated.instrument) {
          profileUpdates.instrument = updated.instrument;
        }
        if (updated.band_id) {
          profileUpdates.band_id = updated.band_id;
          profileUpdates.band_name = updated.band_name;
        }

        await supabase.from('profiles').update(profileUpdates).eq('id', user.id);
      } catch (err) {
        console.warn('[Auth] Failed to sync profile with Supabase:', err);
      }
    }
  };

  const enableGuestMode = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(GUEST_KEY, 'true');
    }
    setIsGuest(true);
    setUser(getOrCreateOfflineUser());
  };

  const signOut = async () => {
    try {
      await flushPendingSaves();
    } catch (e) {
      console.warn('[Auth] Error flushing pending saves during signout:', e);
    }
    // Clear active session keys so another user logging in on the device doesn't inherit prior state
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(OFFLINE_USER_KEY);
      localStorage.removeItem(PROFESSION_KEY);
      localStorage.removeItem(INSTRUMENT_KEY);
      localStorage.removeItem(USERNAME_KEY);
    }
    clearActiveBandSession();
    lastSyncedUserIdRef.current = null;
    setIsGuest(false);
    setUser(null);
    setProfile({ 
      profession: null, 
      instrument: null, 
      username: '',
      band_id: null,
      band_name: null,
      band_code: null,
      email: null,
    });
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[Auth] SignOut error:', err);
    }
    window.location.href = '/auth';
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const guestPref = typeof window !== 'undefined' && localStorage.getItem(GUEST_KEY) === 'true';

        if (guestPref) {
          setIsGuest(true);
          setUser(getOrCreateOfflineUser());
          setLoading(false);
          return;
        }

        const isOAuthRedirect = typeof window !== 'undefined' && (
          window.location.search.includes('code=') || 
          window.location.hash.includes('access_token=')
        );

        // Race supabase session fetch against timeout (extended to 6s during OAuth token exchange, 4.5s default for mobile)
        const timeoutDuration = isOAuthRedirect ? 6000 : 4500;
        const timeout = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), timeoutDuration)
        );
        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          timeout,
        ]);

        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);
          // Initial sync is handled by OfflineSyncProvider (respects autoSync preference)
        } else {
          // If offline or session expired while offline, recover cached user from local storage
          let cachedUser: User | null = null;
          if (typeof window !== 'undefined') {
            try {
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                  const raw = localStorage.getItem(key);
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed?.user) {
                      cachedUser = parsed.user as User;
                      break;
                    }
                  }
                }
              }
            } catch (e) {}
          }

          if (cachedUser) {
            setUser(cachedUser);
            setIsGuest(false);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('[Auth] Error fetching session:', err);
        let cachedUser: User | null = null;
        if (typeof window !== 'undefined') {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const raw = localStorage.getItem(key);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed?.user) {
                    cachedUser = parsed.user as User;
                    break;
                  }
                }
              }
            }
          } catch (e) {}
        }
        if (cachedUser) {
          setUser(cachedUser);
          setIsGuest(false);
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser((prev) => {
            if (prev && prev.id === session.user.id && prev.updated_at === session.user.updated_at) {
              return prev;
            }
            return session.user;
          });
          setIsGuest(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_KEY);
          }
          flushPendingSaves().catch(() => {});
        } else if (event === 'SIGNED_OUT') {
          lastSyncedUserIdRef.current = null;
          setUser(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const isAuthPath = !pathname || pathname === '/auth' || pathname === '/auth/' || pathname.startsWith('/auth');
    if (!loading && !user && !isAuthPath) {
      router.replace('/auth');
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, profile, enableGuestMode, updateProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

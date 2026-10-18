'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { flushPendingSaves } from '@/lib/storage';

export type UserProfession = 'singing' | 'instrument' | 'admin' | null;

export interface UserProfile {
  username?: string;
  profession?: UserProfession;
  instrument?: string | null;
}

export function canModifySection(
  profession: UserProfession | undefined,
  sectionKind: 'chart' | 'lyrics'
): boolean {
  if (!profession || profession === 'admin') return true;
  if (profession === 'singing') return sectionKind === 'lyrics';
  if (profession === 'instrument') return sectionKind === 'chart';
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
  profile: { profession: null, instrument: null, username: '' },
  enableGuestMode: () => {},
  updateProfile: async () => {},
  signOut: async () => {} 
});

const GUEST_KEY = 'chord-grid-guest-mode';
const OFFLINE_USER_KEY = 'chord-grid-offline-user-id';
const PROFESSION_KEY = 'chord-grid-profession';
const INSTRUMENT_KEY = 'chord-grid-instrument';
const USERNAME_KEY = 'chord-grid-username';

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

  const [profile, setProfile] = useState<UserProfile>({ profession: null, instrument: null, username: '' });

  // Sync profile when user changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const meta = user?.user_metadata || {};
    const userPrefix = user ? `${user.id}_` : '';

    const storedProfession = localStorage.getItem(`${userPrefix}profession`) || localStorage.getItem(PROFESSION_KEY);
    const storedInstrument = localStorage.getItem(`${userPrefix}instrument`) || localStorage.getItem(INSTRUMENT_KEY);
    const storedUsername = localStorage.getItem(`${userPrefix}username`) || localStorage.getItem(USERNAME_KEY);

    const profession = (meta.profession as UserProfession) || (storedProfession as UserProfession) || null;
    const instrument = (meta.instrument as string) || storedInstrument || null;
    const username = (meta.username as string) || (meta.name as string) || storedUsername || (user?.email ? user.email.split('@')[0] : '');

    setProfile({ profession, instrument, username });
  }, [user]);

  const updateProfile = async (newProfile: Partial<UserProfile>) => {
    const updated = { ...profile, ...newProfile };
    setProfile(updated);

    if (typeof window !== 'undefined') {
      const userPrefix = user ? `${user.id}_` : '';
      if (updated.profession !== undefined) {
        if (updated.profession) {
          localStorage.setItem(`${userPrefix}profession`, updated.profession);
          localStorage.setItem(PROFESSION_KEY, updated.profession);
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
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updated }));
    }

    if (user && !isGuest) {
      try {
        const { data } = await supabase.auth.updateUser({
          data: {
            profession: updated.profession,
            instrument: updated.instrument,
            username: updated.username,
          }
        });
        if (data?.user) {
          setUser(data.user);
        }
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(OFFLINE_USER_KEY);
    }
    setIsGuest(false);
    setUser(null);
    setProfile({ profession: null, instrument: null, username: '' });
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

        // Race supabase session fetch against a 1.2s timeout so we don't hang when offline
        const timeout = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 1200)
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
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] Error fetching session:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(GUEST_KEY);
          }
          flushPendingSaves().catch(() => {});
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !user && pathname !== '/auth') {
      window.location.href = '/auth';
    }
  }, [user, loading, pathname]);

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, profile, enableGuestMode, updateProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


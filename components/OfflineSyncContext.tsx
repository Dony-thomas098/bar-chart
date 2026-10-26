'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { supabase } from '@/lib/supabase';
import {
  syncAllOffline,
  cacheChart,
  cacheLyric,
  cacheFolder,
  deleteFromCache,
  Chart,
  Folder,
} from '@/lib/storage';

// ─── Constants ─────────────────────────────────────────────────────────────

const AUTO_SYNC_KEY = 'chord-grid-auto-sync';
const LAST_SYNCED_KEY = 'chord-grid-last-synced-at';

// ─── Context Shape ──────────────────────────────────────────────────────────

interface OfflineSyncContextValue {
  /** Whether background auto-sync is enabled */
  autoSync: boolean;
  /** Toggle auto-sync on/off */
  setAutoSync: (value: boolean) => void;
  /** Whether a sync (manual or automatic) is in progress */
  isSyncing: boolean;
  /** Last sync result message, null if none */
  syncResult: string | null;
  /** ISO string of last successful sync, null if never synced */
  lastSyncedAt: string | null;
  /** Imperatively trigger a full sync. Pass isManual=true for button clicks */
  triggerSync: (isManual?: boolean) => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  autoSync: true,
  setAutoSync: () => {},
  isSyncing: false,
  syncResult: null,
  lastSyncedAt: null,
  triggerSync: async () => {},
});

// ─── Provider ───────────────────────────────────────────────────────────────

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [autoSync, setAutoSyncState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(AUTO_SYNC_KEY);
    // null means first-time user → default ON
    return stored === null ? true : stored === 'true';
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_SYNCED_KEY);
  });

  // Keep a ref to the autoSync value so async/closure callbacks see the latest
  const autoSyncRef = useRef(autoSync);
  autoSyncRef.current = autoSync;

  // Track whether initial sync has already been triggered this session
  const initialSyncDone = useRef(false);

  // Holds the active Supabase realtime channel so we can clean it up
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Core sync function ─────────────────────────────────────────────────

  const triggerSync = useCallback(async (isManual = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncAllOffline();
      const ts = new Date().toISOString();
      const msg = `All songs synced — ${res.chartsCount} charts, ${res.lyricsCount} lyrics, ${res.foldersCount} folders`;
      setSyncResult(msg);
      setLastSyncedAt(ts);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_SYNCED_KEY, ts);
      }
    } catch {
      setSyncResult('Sync failed — check your connection and try again.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // ── autoSync persistence ───────────────────────────────────────────────

  const setAutoSync = useCallback((value: boolean) => {
    setAutoSyncState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTO_SYNC_KEY, String(value));
    }
  }, []);

  // Track current band subscription ID
  const currentBandIdRef = useRef<string | null>(null);

  // ── Live realtime subscription ─────────────────────────────────────────

  const subscribeToRealtime = useCallback(() => {
    // Clean up any existing subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current).catch((err: unknown) => console.warn('[OfflineSync] removeChannel error:', err));
      realtimeChannelRef.current = null;
    }

    const isGuest = typeof window !== 'undefined' && localStorage.getItem('chord-grid-guest-mode') === 'true';
    if (isGuest) {
      return;
    }

    const currentBandId = typeof window !== 'undefined' ? localStorage.getItem('chord-grid-band-id') : null;
    currentBandIdRef.current = currentBandId;

    // If user has no band, do not subscribe to band realtime events
    if (!currentBandId) {
      return;
    }

    // Do not attempt to open websocket when device is offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const bandFilter = `band_id=eq.${currentBandId}`;

    const channel = supabase
      .channel(`offline-sync-realtime-${currentBandId}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'charts', filter: bandFilter },
        async (payload: any) => {
          if (autoSyncRef.current) {
            const targetId = payload.new?.id || payload.old?.id;
            let hasPending = false;
            try {
              const { getDBPromise } = await import('@/lib/storage');
              const db = await getDBPromise();
              if (db && targetId) {
                const pending = await db.get('pending_saves', targetId);
                if (pending) hasPending = true;
              }
            } catch {}

            if (!hasPending) {
              if (payload.eventType === 'DELETE') {
                await deleteFromCache(payload.old.id, 'charts');
              } else if (payload.new) {
                try {
                  const { getDBPromise } = await import('@/lib/storage');
                  const db = await getDBPromise();
                  const cached = await db?.get('charts', targetId);
                  const cloudTime = new Date(payload.new.updated_at || 0).getTime();
                  const cachedTime = new Date(cached?.updated_at || 0).getTime();
                  if (!cached || cloudTime >= cachedTime) {
                    await cacheChart(payload.new as Chart);
                  }
                } catch {
                  await cacheChart(payload.new as Chart);
                }
              }
            }
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refresh-folder', { detail: payload }));
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'lyrics', filter: bandFilter },
        async (payload: any) => {
          if (autoSyncRef.current) {
            const targetId = payload.new?.id || payload.old?.id;
            let hasPending = false;
            try {
              const { getDBPromise } = await import('@/lib/storage');
              const db = await getDBPromise();
              if (db && targetId) {
                const pending = await db.get('pending_saves', targetId);
                if (pending) hasPending = true;
              }
            } catch {}

            if (!hasPending) {
              if (payload.eventType === 'DELETE') {
                await deleteFromCache(payload.old.id, 'lyrics');
              } else if (payload.new) {
                await cacheLyric(payload.new);
              }
            }
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refresh-folder', { detail: payload }));
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'folders', filter: bandFilter },
        async (payload: any) => {
          if (autoSyncRef.current) {
            const targetId = payload.new?.id || payload.old?.id;
            let hasPending = false;
            try {
              const { getDBPromise } = await import('@/lib/storage');
              const db = await getDBPromise();
              if (db && targetId) {
                const pending = await db.get('pending_saves', targetId);
                if (pending) hasPending = true;
              }
            } catch {}

            if (!hasPending) {
              if (payload.eventType === 'DELETE') {
                await deleteFromCache(payload.old.id, 'folders');
              } else if (payload.new) {
                await cacheFolder(payload.new as Folder);
              }
            }
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refresh-folder', { detail: payload }));
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'setlists', filter: bandFilter },
        () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refresh-setlists'));
          }
        }
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'setlist_items', filter: bandFilter },
        () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refresh-setlists'));
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;
  }, []);

  const unsubscribeFromRealtime = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current).catch((err: unknown) => console.warn('[OfflineSync] removeChannel error:', err));
      realtimeChannelRef.current = null;
    }
    currentBandIdRef.current = null;
  }, []);

  // ── React to autoSync toggle ───────────────────────────────────────────

  useEffect(() => {
    if (autoSync) {
      subscribeToRealtime();
    } else {
      unsubscribeFromRealtime();
    }

    return () => {
      unsubscribeFromRealtime();
    };
  }, [autoSync, subscribeToRealtime, unsubscribeFromRealtime]);

  // ── Resubscribe on Band Changes (join, switch, leave) ───────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBandJoined = () => {
      if (autoSyncRef.current) {
        subscribeToRealtime();
      }
    };

    const handleBandLeft = () => {
      unsubscribeFromRealtime();
    };

    const handleProfileUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newBandId = customEvent.detail?.band_id || localStorage.getItem('chord-grid-band-id');
      if (newBandId !== currentBandIdRef.current) {
        if (newBandId && autoSyncRef.current) {
          subscribeToRealtime();
        } else {
          unsubscribeFromRealtime();
        }
      }
    };

    window.addEventListener('band-joined', handleBandJoined);
    window.addEventListener('band-left', handleBandLeft);
    window.addEventListener('profile-updated', handleProfileUpdated);

    return () => {
      window.removeEventListener('band-joined', handleBandJoined);
      window.removeEventListener('band-left', handleBandLeft);
      window.removeEventListener('profile-updated', handleProfileUpdated);
    };
  }, [subscribeToRealtime, unsubscribeFromRealtime]);

  // ── Initial full sync on mount (when user is logged in) ───────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Wait for auth to be available, then run initial sync once
    const runInitialSync = async () => {
      if (initialSyncDone.current) return;
      if (!autoSyncRef.current) return;

      // Check there's an actual session (not guest)
      const isGuest = localStorage.getItem('chord-grid-guest-mode') === 'true';
      if (isGuest) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
      } catch {
        return;
      }

      initialSyncDone.current = true;
      // Fire and forget — don't block UI
      triggerSync(false).catch(() => {});
    };

    // Small delay to let AuthProvider resolve first
    const timer = setTimeout(runInitialSync, 800);

    // Also trigger immediately on auth state change when session is ready
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && !initialSyncDone.current && autoSyncRef.current) {
        const isGuest = localStorage.getItem('chord-grid-guest-mode') === 'true';
        if (!isGuest) {
          initialSyncDone.current = true;
          triggerSync(false).catch(() => {});
        }
      }
    });

    return () => {
      clearTimeout(timer);
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Catch-up sync on reconnect ────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      if (!autoSyncRef.current) return;
      subscribeToRealtime();
      // Slight delay so the pending_saves flush in storage.ts can run first
      setTimeout(() => {
        triggerSync(false).catch(() => {});
      }, 1500);
    };

    const handleOffline = () => {
      unsubscribeFromRealtime();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  // ── Clear sync result after a display timeout ─────────────────────────

  useEffect(() => {
    if (!syncResult) return;
    const timer = setTimeout(() => setSyncResult(null), 8000);
    return () => clearTimeout(timer);
  }, [syncResult]);

  return (
    <OfflineSyncContext.Provider
      value={{ autoSync, setAutoSync, isSyncing, syncResult, lastSyncedAt, triggerSync }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export const useOfflineSync = () => useContext(OfflineSyncContext);

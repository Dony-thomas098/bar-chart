import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Lyric, readLyrics, saveLyrics } from '@/lib/lyrics';

export function useLyricsSync(lyricId: string) {
  const [lyric, setLyric] = useState<Lyric | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [leaderInfo, setLeaderInfo] = useState<{ name: string; email: string; currentSection: number } | null>(null);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasPendingChanges = useRef(false);
  const myEmail = useRef<string | null>(null);
  const latestLyricRef = useRef<Lyric | null>(null);
  
  useEffect(() => {
    latestLyricRef.current = lyric;
  }, [lyric]);

  useEffect(() => {
    if (!lyricId || lyricId === 'edit') {
      setLoading(true);
      return;
    }

    let isMounted = true;
    setLoading(true);
    
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 8000);

    readLyrics(lyricId)
      .then(async (data) => {
        if (!isMounted) return;
        if (data) {
          clearTimeout(safetyTimer);
          setLyric(data as Lyric | null);
          setLoading(false);
        } else {
          // If null on cold mount, retry if auth session was still restoring in background
          try {
            const { data: authData } = await supabase.auth.getSession();
            if (authData?.session?.user && isMounted) {
              try {
                const { syncBandForUser } = await import('@/lib/band');
                await syncBandForUser(authData.session.user);
              } catch {}
              const retried = await readLyrics(lyricId);
              if (isMounted && retried) {
                clearTimeout(safetyTimer);
                setLyric(retried as Lyric);
                setLoading(false);
                return;
              }
            }
          } catch {}
          if (isMounted) {
            clearTimeout(safetyTimer);
            setLyric(null);
            setLoading(false);
          }
        }
      })
      .catch(err => {
        console.warn('[useLyricsSync] readLyrics error:', err);
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      });

    // Re-attempt fetch when Supabase auth session initializes or changes (fixes cold-load RLS race condition)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user && isMounted && !latestLyricRef.current) {
        try {
          const { syncBandForUser } = await import('@/lib/band');
          await syncBandForUser(session.user);
        } catch {}
        readLyrics(lyricId).then(data => {
          if (isMounted && data) {
            clearTimeout(safetyTimer);
            setLyric(data as Lyric);
            setLoading(false);
          }
        }).catch(() => {});
      }
    });

    const channel = supabase.channel(`lyrics-${lyricId}`);
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'lyrics', filter: `id=eq.${lyricId}` },
        (payload: any) => {
          if (isMounted && payload.new) {
            setLyric(prev => prev ? { ...prev, ...payload.new } : payload.new);
          }
        }
      )
      .on('broadcast', { event: 'update' }, (payload) => {
        if (isMounted && payload.payload) {
          setLyric(prev => prev ? { ...prev, ...payload.payload } : payload.payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<any>();
        const users = Object.values(state).flatMap(p => p.map((u: any) => u.email || 'Anonymous'));
        if (isMounted) {
          const others = Array.from(new Set(users)).filter(e => e !== myEmail.current);
          setCollaborators(others);

          // Derive leader from presence
          let found: { name: string; email: string; currentSection: number } | null = null;
          for (const presences of Object.values(state)) {
            for (const p of presences as any[]) {
              if (p.role === 'leader') {
                found = { name: p.name || p.email || 'Someone', email: p.email || '', currentSection: p.currentSection ?? 0 };
                break;
              }
            }
            if (found) break;
          }
          setLeaderInfo(found);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.email) {
            myEmail.current = user.email;
            await channel.track({ email: user.email });
          }
        }
      });

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.removeChannel(channel);
      authSub.unsubscribe();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      if (hasPendingChanges.current && latestLyricRef.current) {
        saveLyrics({
          ...latestLyricRef.current,
          updated_at: new Date().toISOString()
        }).catch(() => {});
      }
    };
  }, [lyricId]);

  const persistLyric = async (lyricToSave: Lyric) => {
    setSaveStatus('saving');
    try {
      await saveLyrics({
        ...lyricToSave,
        updated_at: new Date().toISOString()
      });
      setSaveStatus('saved');
      hasPendingChanges.current = false;
    } catch (err) {
      setSaveStatus('offline');
    }
  };

  const forceSave = async () => {
    if (hasPendingChanges.current && latestLyricRef.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await persistLyric(latestLyricRef.current);
    }
  };

  const updateLyric = useCallback((partial: Partial<Lyric>) => {
    setLyric(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'update',
        payload: partial
      });

      hasPendingChanges.current = true;
      setSaveStatus('saving');
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        persistLyric(updated);
      }, 1000);

      return updated;
    });
  }, []);

  return { lyric, loading, saveStatus, collaborators, leaderInfo, channelRef, updateLyric, forceSave };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ChartData } from '@/lib/chart-types';
import { readChart, saveChart, isOnline } from '@/lib/storage';


export function useChartSync(chartId: string) {
  const [chart, setChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [leaderInfo, setLeaderInfo] = useState<{ name: string; email: string; currentSection: number } | null>(null);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const hasPendingChanges = useRef(false);
  const myEmail = useRef<string | null>(null);
  const latestChartRef = useRef<ChartData | null>(null);
  
  useEffect(() => {
    latestChartRef.current = chart;
  }, [chart]);

  useEffect(() => {
    let isMounted = true;
    
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2500);

    readChart(chartId)
      .then(data => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setChart(data as ChartData | null);
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn('[useChartSync] readChart error:', err);
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      });

    const channel = supabase.channel(`chart-${chartId}`);
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'charts', filter: `id=eq.${chartId}` },
        (payload: any) => {
          if (isMounted && payload.new) {
            // Never overwrite active edits if the local user has pending changes
            if (hasPendingChanges.current) {
              return;
            }
            const incomingTime = new Date(payload.new.updated_at || 0).getTime();
            const localTime = new Date(latestChartRef.current?.updated_at || 0).getTime();
            if (incomingTime >= localTime) {
              setChart(prev => prev ? { ...prev, ...payload.new } : payload.new);
            }
          }
        }
      )
      .on('broadcast', { event: 'update' }, (payload) => {
        if (isMounted && payload.payload) {
          if (hasPendingChanges.current) {
            return;
          }
          setChart(prev => prev ? { ...prev, ...payload.payload } : payload.payload);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<any>();
        const users = Object.values(state).flatMap(p => p.map((u: any) => u.email || 'Anonymous'));
        if (isMounted) {
          // Filter out our own email if known
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
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      
      if (hasPendingChanges.current && latestChartRef.current) {
        saveChart({
          ...latestChartRef.current,
          updated_at: new Date().toISOString()
        }).catch(() => {});
      }
    };
  }, [chartId]);

  const persistChart = async (chartToSave: ChartData) => {
    setSaveStatus('saving');
    try {
      const savePayload = {
        ...chartToSave,
        updated_at: new Date().toISOString()
      };
      await saveChart(savePayload);

      // Only mark saved if no newer edits occurred while this save was in flight
      if (
        !latestChartRef.current ||
        latestChartRef.current.updated_at === chartToSave.updated_at ||
        latestChartRef.current === chartToSave
      ) {
        hasPendingChanges.current = false;
        setSaveStatus(isOnline() ? 'saved' : 'offline');
      }
    } catch (err) {
      setSaveStatus('offline');
    }
  };

  const forceSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (latestChartRef.current) {
      await persistChart(latestChartRef.current);
    }
  };

  const updateChart = useCallback((partial: Partial<ChartData> | ((prev: ChartData) => Partial<ChartData>)) => {
    setChart(prev => {
      if (!prev) return prev;
      const partialObj = typeof partial === 'function' ? partial(prev) : partial;
      const updated = { ...prev, ...partialObj };
      latestChartRef.current = updated;

      channelRef.current?.send({
        type: 'broadcast',
        event: 'update',
        payload: partialObj
      });

      hasPendingChanges.current = true;
      setSaveStatus('saving');
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        persistChart(updated);
      }, 1000);

      return updated;
    });
  }, []);

  return { chart, loading, saveStatus, collaborators, leaderInfo, channelRef, updateChart, forceSave };
}

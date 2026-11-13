'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { listSetlistItems, updateSetlist, updateSetlistItem, type SetlistItem } from '@/lib/setlists';
import { readChart, readLyrics } from '@/lib/storage';
import { transposeChart } from '@/lib/transpose';
import { ChartRenderer } from '@/components/ChartRenderer';
import { ChartData, Line, createDefaultLine } from '@/lib/chart-types';
import { supabase } from '@/lib/supabase';
import { useSetlistPrefetch } from '@/hooks/useSetlistPrefetch';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { calculateScoreFit } from '@/lib/score-fit';
import {
  X, ChevronLeft, ChevronRight, Users, Radio, RefreshCw, FileText, Music, ArrowLeft,
  Pencil, Plus, Minus, Trash2, RotateCcw, Check, Zap, Save, AlertCircle
} from 'lucide-react';

// ─── Setlist Session Hook ─────────────────────────────────────────────────────

type PerfMode = 'leader' | 'follower' | 'loading';

interface SetlistPresence {
  role: 'leader' | 'follower';
  name: string;
  songPosition: number;
}

function useSetlistSession(setlistId: string, isLeaderDevice: boolean) {
  const [mode, setMode] = useState<PerfMode>(isLeaderDevice ? 'leader' : 'loading');
  const [songPosition, setSongPosition] = useState(0);
  const [leaderName, setLeaderName] = useState<string | null>(isLeaderDevice ? 'Leader (You)' : null);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const myNameRef = useRef('Anonymous');
  const isMountedRef = useRef(true);
  const positionRef = useRef(0);
  const isFollowingRef = useRef(true);
  const isLeaderRef = useRef(isLeaderDevice);

  useEffect(() => { positionRef.current = songPosition; }, [songPosition]);
  useEffect(() => { isFollowingRef.current = isFollowing; }, [isFollowing]);
  useEffect(() => {
    isLeaderRef.current = isLeaderDevice;
    if (isLeaderDevice) {
      setMode('leader');
      setLeaderName('Leader (You)');
    }
  }, [isLeaderDevice]);

  useEffect(() => {
    if (!setlistId) return;
    let cancelled = false;
    isMountedRef.current = true;
    const isLdr = isLeaderRef.current || isLeaderDevice;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !isMountedRef.current) return;
      if (user) myNameRef.current = user.email?.split('@')[0] ?? 'Anonymous';

      // Clean up any existing channel with this topic before creating a new one
      const existing = supabase.getChannels().find(
        ch => ch.topic === `realtime:setlist-${setlistId}` || ch.topic === `setlist-${setlistId}`
      );
      if (existing) {
        await supabase.removeChannel(existing).catch(() => {});
        try {
          const channels = (supabase as any).realtime?.channels;
          if (Array.isArray(channels)) {
            (supabase as any).realtime.channels = channels.filter(
              (c: any) => c.topic !== `realtime:setlist-${setlistId}` && c.topic !== `setlist-${setlistId}`
            );
          }
        } catch {}
      }
      if (cancelled || !isMountedRef.current) return;

      const instanceId = Math.random().toString(36).slice(2, 8);
      const channel = supabase.channel(`setlist-${setlistId}`, {
        config: {
          presence: { key: instanceId },
          broadcast: { ack: false, self: false },
        },
      });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'song-change' }, ({ payload }) => {
          if (!isMountedRef.current) return;
          const pos = payload?.position ?? 0;
          setSongPosition(pos);
          positionRef.current = pos;
        })
        .on('broadcast', { event: 'chord-update' }, ({ payload }) => {
          if (!isMountedRef.current) return;
          window.dispatchEvent(new CustomEvent('setlist-chord-update', { detail: payload }));
        })
        .on('broadcast', { event: 'session-end' }, () => {
          if (!isMountedRef.current) return;
          window.dispatchEvent(new CustomEvent('setlist-session-end'));
        })
        .on('presence', { event: 'sync' }, () => {
          if (!isMountedRef.current) return;
          const state = channel.presenceState<SetlistPresence>();
          const presences = Object.values(state).flat() as SetlistPresence[];
          const leader = presences.find(p => p.role === 'leader');
          setLeaderName(leader?.name ?? null);
          if (!isLdr && leader) {
            setSongPosition(leader.songPosition ?? 0);
            positionRef.current = leader.songPosition ?? 0;
            setMode('follower');
          }
          setFollowerCount(presences.filter(p => p.role === 'follower').length);
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || !isMountedRef.current || cancelled) return;
          if (isLeaderRef.current || isLeaderDevice) {
            await channel.track({ role: 'leader', name: myNameRef.current, songPosition: positionRef.current });
            setMode('leader');
            setLeaderName('Leader (You)');
          } else {
            await channel.track({ role: 'follower', name: myNameRef.current, songPosition: 0 });
          }
        });
    };
    init();
    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (channelRef.current) {
        const ch = channelRef.current;
        channelRef.current = null;
        supabase.removeChannel(ch).catch(() => {});
        try {
          const channels = (supabase as any).realtime?.channels;
          if (Array.isArray(channels)) {
            (supabase as any).realtime.channels = channels.filter((c: any) => c !== ch);
          }
        } catch {}
      }
    };
  }, [setlistId]);

  const goTo = useCallback((pos: number) => {
    setSongPosition(pos);
    positionRef.current = pos;
    if (!isLeaderRef.current) {
      setIsFollowing(false);
      isFollowingRef.current = false;
    }
    const ch = channelRef.current;
    if (!ch) return;
    if (isLeaderRef.current) {
      ch.track({ role: 'leader', name: myNameRef.current, songPosition: pos });
      ch.send({ type: 'broadcast', event: 'song-change', payload: { position: pos } });
    }
  }, []);

  const endSession = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'session-end', payload: {} });
    supabase.removeChannel(ch);
    channelRef.current = null;
  }, []);

  const stopFollowing = useCallback(() => { setIsFollowing(false); isFollowingRef.current = false; }, []);
  const resumeFollowing = useCallback(() => {
    setIsFollowing(true);
    isFollowingRef.current = true;
    setSongPosition(positionRef.current);
  }, []);

  const broadcastChordUpdate = useCallback((updatePayload: {
    itemId: string;
    lines?: Line[] | null;
    transpose_override?: number | null;
  }) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'chord-update', payload: updatePayload });
  }, []);

  const takeLead = useCallback(() => {
    isLeaderRef.current = true;
    setMode('leader');
    setLeaderName('Leader (You)');
    const ch = channelRef.current;
    if (ch) {
      ch.track({ role: 'leader', name: myNameRef.current, songPosition: positionRef.current }).catch(() => {});
    }
  }, []);

  return { mode, songPosition, leaderName, followerCount, isFollowing, goTo, endSession, stopFollowing, resumeFollowing, takeLead, broadcastChordUpdate };
}

// ─── Chart zoom wrapper ───────────────────────────────────────────────────────

function ChartWrapper({ 
  chart, 
  songKey,
  barsVisible = true,
  onBaseScaleChange,
  assignedTransformsRef,
}: { 
  chart: ChartData; 
  songKey: string;
  barsVisible?: boolean;
  onBaseScaleChange?: (scale: number) => void;
  assignedTransformsRef: React.MutableRefObject<Record<string, { scale: number; posX: number; posY: number; userMoved: boolean }>>;
}) {
  const { setTransform, instance } = useControls();
  const isInitialFitRef = useRef(true);
  const prevBarsVisibleRef = useRef(barsVisible);

  const fitToScreen = useCallback(() => {
    const cardEl = document.getElementById('perf-chart-card');
    const wrapper = instance.wrapperComponent;
    if (!cardEl || !wrapper) return;

    const viewportWidth = window.innerWidth || wrapper.clientWidth;
    const viewportHeight = window.innerHeight || wrapper.clientHeight;
    const cardWidth = Math.max(cardEl.scrollWidth, cardEl.offsetWidth);
    const cardHeight = Math.max(cardEl.scrollHeight, cardEl.offsetHeight);

    if (cardWidth <= 0 || cardHeight <= 0) return;

    const { scale, posX, posY, effectiveMinScale } = calculateScoreFit({
      viewportWidth,
      viewportHeight,
      cardWidth,
      cardHeight,
      showUI: barsVisible,
      topPadding: barsVisible ? 64 : 16,
      bottomPadding: barsVisible ? 88 : 24,
    });

    if (instance.setup) {
      instance.setup.minScale = effectiveMinScale;
    }
    if (onBaseScaleChange) {
      onBaseScaleChange(effectiveMinScale);
    }

    const assigned = assignedTransformsRef.current[songKey];
    if (assigned && assigned.userMoved) {
      // User previously assigned this position: preserve exact scale and position relative to bars
      const targetY = barsVisible ? assigned.posY + 88 : assigned.posY;
      setTransform(assigned.posX, targetY, assigned.scale, isInitialFitRef.current ? 0 : 250);
    } else {
      // Record initial fit as assigned baseline
      assignedTransformsRef.current[songKey] = { scale, posX, posY, userMoved: false };
      setTransform(posX, posY, scale, isInitialFitRef.current ? 0 : 250);
    }
    isInitialFitRef.current = false;
  }, [instance, setTransform, onBaseScaleChange, songKey, barsVisible, assignedTransformsRef]);

  // Initial fit on song mount / card reflow
  useEffect(() => {
    isInitialFitRef.current = true;
    let t1: any;
    let t2: any;
    let t3: any;
    const runFit = () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      t1 = setTimeout(fitToScreen, 50);
      t2 = setTimeout(fitToScreen, 250);
      t3 = setTimeout(fitToScreen, 600);
    };
    runFit();
    window.addEventListener('resize', runFit);
    window.addEventListener('orientationchange', runFit);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', runFit);
      window.removeEventListener('orientationchange', runFit);
    };
  }, [songKey, chart.id, fitToScreen]);

  // Handle barsVisible toggle smoothly: when hidden, return to assigned position; do not change until user moves
  useEffect(() => {
    if (isInitialFitRef.current) return;
    if (prevBarsVisibleRef.current === barsVisible) return;
    prevBarsVisibleRef.current = barsVisible;

    const assigned = assignedTransformsRef.current[songKey];
    if (assigned && assigned.userMoved) {
      setTransform(assigned.posX, assigned.posY, assigned.scale, 250);
    } else {
      fitToScreen();
    }
  }, [barsVisible, songKey, setTransform, fitToScreen, assignedTransformsRef]);

  return <ChartRenderer chart={chart} id="perf-chart-card" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SetlistPerformPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const getInitialSetlistId = () => {
    if (params?.id && params.id !== 'view' && params.id !== 'perform' && params.id !== 'demo') {
      return params.id as string;
    }
    const spId = searchParams?.get('id');
    if (spId) return spId;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const wId = urlParams.get('id');
      if (wId) return wId;
    }
    return '';
  };

  const [resolvedSetlistId, setResolvedSetlistId] = useState<string>(getInitialSetlistId);
  const setlistId = resolvedSetlistId;

  useEffect(() => {
    const currentId =
      (params?.id && params.id !== 'view' && params.id !== 'perform' && params.id !== 'demo' ? (params.id as string) : null) ||
      searchParams?.get('id') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null) ||
      '';
    if (currentId && currentId !== resolvedSetlistId) {
      setResolvedSetlistId(currentId);
    }
  }, [params, searchParams, resolvedSetlistId]);

  const [items, setItems] = useState<SetlistItem[]>([]);
  const [setlistName, setSetlistName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);

  const [currentChart, setCurrentChart] = useState<ChartData | null>(null);
  const [currentLyrics, setCurrentLyrics] = useState<any | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  // Performance Chord Editing State
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [editingLines, setEditingLines] = useState<Line[]>([]);
  const [isSavingPerf, setIsSavingPerf] = useState(false);

  // Rename setlist modal state
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameInputValue, setRenameInputValue] = useState('');

  const handleRenameSetlist = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !setlistId) return;
    setSetlistName(trimmed);
    try {
      await updateSetlist(setlistId, { name: trimmed });
    } catch (err) {
      console.warn('[SetlistPerform] Failed to update setlist name:', err);
    }
  };

  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [barsVisible, setBarsVisible] = useState(false);
  const [perfMinScale, setPerfMinScale] = useState(1);

  const assignedTransformsRef = useRef<Record<string, { scale: number; posX: number; posY: number; userMoved: boolean }>>({});

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - dragStartPosRef.current.x);
    const dy = Math.abs(e.clientY - dragStartPosRef.current.y);
    if (dx > 8 || dy > 8) {
      isDraggingRef.current = true;
    }
  };

  const handleToggleBars = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    setBarsVisible(v => !v);
  };

  const [selectedFont, setSelectedFont] = useState('system');
  useEffect(() => { const f = localStorage.getItem('chord-grid-font'); if (f) setSelectedFont(f); }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isLeaderDevice, setIsLeaderDevice] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLdr =
        sessionStorage.getItem(`setlist-leader-${setlistId}`) === '1' ||
        localStorage.getItem(`setlist-leader-${setlistId}`) === '1';
      if (isLdr) setIsLeaderDevice(true);
    }
  }, [setlistId]);

  const { mode, songPosition, leaderName, followerCount, isFollowing, goTo, endSession, stopFollowing, resumeFollowing, takeLead, broadcastChordUpdate } =
    useSetlistSession(setlistId, isLeaderDevice);

  const isLeader = mode === 'leader';

  const handleUserTransform = useCallback((state: { scale: number; positionX: number; positionY: number }) => {
    const currentKey = `${songPosition}`;
    const basePosY = barsVisible ? state.positionY - 88 : state.positionY;
    assignedTransformsRef.current[currentKey] = {
      scale: state.scale,
      posX: state.positionX,
      posY: basePosY,
      userMoved: true,
    };
  }, [songPosition, barsVisible]);

  // Load items
  useEffect(() => {
    if (authLoading || !user || !setlistId) return;
    (async () => {
      setLoading(true);
      const { supabase: sb } = await import('@/lib/supabase');
      const { data: sl } = await sb.from('setlists').select('name').eq('id', setlistId).maybeSingle();
      if (sl) setSetlistName(sl.name);
      const loaded = await listSetlistItems(setlistId);
      setItems(loaded);
      setLoading(false);
    })();
  }, [authLoading, user, setlistId]);

  // ── Pre-fetch surrounding items ─────────────────────────────────────────
  const { getFromCache, addToCache } = useSetlistPrefetch(items, songPosition);

  // Load song content when position changes
  const loadSongAt = useCallback(async (pos: number, force = false) => {
    const item = items[pos];
    if (!item) return;

    if (!force) {
      const cached = getFromCache(item);
      if (cached) {
        if (cached.chart) { setCurrentChart(cached.chart); setCurrentLyrics(null); }
        else if (cached.lyrics) { setCurrentLyrics(cached.lyrics); setCurrentChart(null); }
        setContentLoading(false);
        return;
      }
    }

    setContentLoading(true);
    setCurrentChart(null);
    setCurrentLyrics(null);
    if (item.item_type === 'chart') {
      const chart = await readChart(item.item_id, force);
      if (chart) {
        let display = { ...chart } as ChartData;

        // Check for local or setlist performance copy override
        const localOverride = typeof window !== 'undefined' ? localStorage.getItem(`perf_lines_${item.id}`) : null;
        if (localOverride) {
          try {
            display.lines = JSON.parse(localOverride);
            display.is_performance_copy = true;
          } catch (e) {}
        } else if (item.lines_override) {
          display.lines = item.lines_override;
          display.is_performance_copy = true;
        }

        if (item.transpose_override) display = transposeChart(display, item.transpose_override, display.prefer_flats);
        setCurrentChart(display);
        addToCache(item, { chart: display });
      }
    } else {
      const lyr = await readLyrics(item.item_id);
      setCurrentLyrics(lyr);
      if (lyr) addToCache(item, { lyrics: lyr });
    }
    setContentLoading(false);
  }, [items, getFromCache, addToCache]);

  useEffect(() => { if (items.length > 0) loadSongAt(songPosition); }, [songPosition, items, loadSongAt]);

  // Performance Chord Editing Handlers
  const handleOpenPerfEdit = () => {
    if (!currentChart) return;
    setEditingLines(JSON.parse(JSON.stringify(currentChart.lines || [])));
    setPerfModalOpen(true);
  };

  const handleSavePerfCopy = async () => {
    const currentItem = items[songPosition];
    if (!currentItem || !currentChart) return;
    setIsSavingPerf(true);
    try {
      // If the item has a transpose override, untranspose editingLines so base lines are stored cleanly
      const baseLines = currentItem.transpose_override
        ? transposeChart({ ...currentChart, lines: editingLines }, -currentItem.transpose_override, currentChart.prefer_flats).lines
        : editingLines;

      if (typeof window !== 'undefined') {
        localStorage.setItem(`perf_lines_${currentItem.id}`, JSON.stringify(baseLines));
      }
      try {
        await updateSetlistItem(currentItem.id, { lines_override: baseLines });
      } catch (err) {
        console.warn('DB update failed, kept local performance copy:', err);
      }

      // Display the edited lines directly (they are already in display key) without compounding transpose
      const updated: ChartData = { ...currentChart, lines: editingLines, is_performance_copy: true };
      setCurrentChart(updated);
      addToCache(currentItem, { chart: updated });

      // Broadcast immediately to follower devices
      broadcastChordUpdate({
        itemId: currentItem.id,
        lines: editingLines,
        transpose_override: currentItem.transpose_override,
      });

      setPerfModalOpen(false);
    } catch (e) {
      alert('Failed to save performance copy');
    } finally {
      setIsSavingPerf(false);
    }
  };

  const handleRevertToMaster = async () => {
    const currentItem = items[songPosition];
    if (!currentItem) return;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`perf_lines_${currentItem.id}`);
    }
    try {
      await updateSetlistItem(currentItem.id, { lines_override: null });
    } catch (err) {}

    // Broadcast revert to follower devices
    broadcastChordUpdate({
      itemId: currentItem.id,
      lines: null,
      transpose_override: currentItem.transpose_override,
    });

    setPerfModalOpen(false);
    loadSongAt(songPosition, true);
  };

  const handleTranspose = async (delta: number) => {
    const currentItem = items[songPosition];
    if (!currentItem || !currentChart || !isLeader) return;
    const newTranspose = (currentItem.transpose_override ?? 0) + delta;
    const transposed = transposeChart(currentChart, delta, currentChart.prefer_flats);
    setCurrentChart(transposed);
    addToCache(currentItem, { chart: transposed });

    setItems(prev => prev.map((item, idx) => idx === songPosition ? { ...item, transpose_override: newTranspose } : item));

    try {
      await updateSetlistItem(currentItem.id, { transpose_override: newTranspose });
    } catch (err) {
      console.warn('Failed to update setlist item transpose in DB:', err);
    }

    broadcastChordUpdate({
      itemId: currentItem.id,
      transpose_override: newTranspose,
    });
  };

  // Listen for broadcast chord / transpose updates from leader
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.itemId) return;

      setItems(prev => prev.map(item => {
        if (item.id !== detail.itemId) return item;
        const updated = { ...item };
        if (detail.lines !== undefined) updated.lines_override = detail.lines;
        if (detail.transpose_override !== undefined) updated.transpose_override = detail.transpose_override;
        return updated;
      }));

      const activeItem = items[songPosition];
      if (activeItem && activeItem.id === detail.itemId && currentChart) {
        if (detail.lines !== undefined) {
          if (detail.lines === null) {
            loadSongAt(songPosition, true);
            return;
          } else {
            const updated = { ...currentChart, lines: detail.lines, is_performance_copy: true };
            setCurrentChart(updated);
            addToCache(activeItem, { chart: updated });
          }
        }
        if (typeof detail.transpose_override === 'number') {
          const currentOffset = activeItem.transpose_override ?? 0;
          const delta = detail.transpose_override - currentOffset;
          if (delta !== 0) {
            const transposed = transposeChart(currentChart, delta, currentChart.prefer_flats);
            setCurrentChart(transposed);
            addToCache(activeItem, { chart: transposed });
          }
        }
      }
    };

    window.addEventListener('setlist-chord-update', handler);
    return () => window.removeEventListener('setlist-chord-update', handler);
  }, [items, songPosition, currentChart, addToCache, loadSongAt]);

  // Scroll active tab into view when bars are visible
  useEffect(() => {
    if (barsVisible && activeTabRef.current && tabsRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [songPosition, barsVisible]);

  // Floating dock is strictly hidden during setlist perform mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__chordly_viewing_setlist = true;
      (window as any).__chordly_viewing_chords = true;
      window.dispatchEvent(new CustomEvent('reader-ui-change', { detail: { showUI: false } }));
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__chordly_viewing_setlist = false;
        (window as any).__chordly_viewing_chords = false;
      }
    };
  }, []);

  // If session was previously ended, block back-navigation re-entry and redirect to setlist page
  useEffect(() => {
    if (typeof window !== 'undefined' && setlistId) {
      if (sessionStorage.getItem(`setlist-session-ended-${setlistId}`) === '1') {
        router.replace(`/setlists/view/?id=${setlistId}`);
      }
    }
  }, [setlistId, router]);

  // Session end broadcast received from admin/leader
  useEffect(() => {
    const handler = () => {
      setSessionEnded(true);
      if (typeof window !== 'undefined' && setlistId) {
        sessionStorage.setItem(`setlist-session-ended-${setlistId}`, '1');
      }
      router.replace(`/setlists/view/?id=${setlistId}`);
    };
    window.addEventListener('setlist-session-end', handler);
    return () => window.removeEventListener('setlist-session-end', handler);
  }, [setlistId, router]);

  // Hardware Back Button: exit cleanly to setlist page and block trapping in ended session
  useHardwareBackButton({
    enabled: true,
    onBack: () => {
      if (isLeader) {
        setShowEndConfirmModal(true);
      } else {
        if (typeof window !== 'undefined' && setlistId) {
          sessionStorage.setItem(`setlist-session-ended-${setlistId}`, '1');
        }
        router.replace(`/setlists/view/?id=${setlistId}`);
      }
    },
    stateKey: `setlist_perf_${setlistId}`,
  });

  // Prevent accidental page leave / tab close during setlist performance session
  useEffect(() => {
    if (!isLeader) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLeader]);

  // Keyboard nav (all users can use pedals/keys freely)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(Math.min(songPosition + 1, items.length - 1));
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   goTo(Math.max(songPosition - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [songPosition, items.length, goTo]);

  const handleEndSession = () => {
    endSession();
    if (typeof window !== 'undefined' && setlistId) {
      sessionStorage.removeItem(`setlist-leader-${setlistId}`);
      sessionStorage.setItem(`setlist-session-ended-${setlistId}`, '1');
    }
    router.replace(`/setlists/view/?id=${setlistId}`);
  };

  const currentItem = items[songPosition];

  // ── Special screens ───────────────────────────────────────────────────────

  if (sessionEnded) {
    if (typeof window !== 'undefined' && setlistId) {
      sessionStorage.setItem(`setlist-session-ended-${setlistId}`, '1');
      router.replace(`/setlists/view/?id=${setlistId}`);
    }
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text-primary gap-4">
        <Radio size={40} className="text-accent-start opacity-50" />
        <h2 className="text-2xl font-bold">Session ended</h2>
        <button onClick={() => router.replace(`/setlists/view/?id=${setlistId}`)} className="px-6 py-3 bg-accent-gradient text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all">
          Back to Setlist
        </button>
      </div>
    );
  }

  if (loading || (mode === 'loading' && !isLeaderDevice)) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text-primary gap-4 p-6 text-center" suppressHydrationWarning>
        <div className="w-10 h-10 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
        <p className="text-sm text-text-secondary" suppressHydrationWarning>
          {mounted && !loading && mode === 'loading' && !isLeaderDevice ? 'Waiting for leader to join…' : 'Loading…'}
        </p>
        <div className="flex items-center gap-3 mt-3">
          {items.length > 0 && (
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem(`setlist-leader-${setlistId}`, '1');
                }
                setIsLeaderDevice(true);
                takeLead();
              }}
              className="px-5 py-2.5 bg-accent-gradient text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg"
            >
              Perform Solo / Take Lead
            </button>
          )}
          <button onClick={() => router.push(`/setlists/view/?id=${setlistId}`)} className="text-xs text-text-secondary underline">Cancel</button>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div
      data-viewing-chords="true"
      data-viewing-setlist="true"
      className="min-h-screen bg-bg flex flex-col text-text-primary relative"
    >

      {/* ── Fixed top bar — slides in from top ──────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex flex-col bg-surface/90 backdrop-blur-xl border-b border-border"
        style={{
          transform: barsVisible ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Row 1: setlist name + controls */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Desktop Back button */}
          <button
            type="button"
            onClick={() => {
              if (isLeader) {
                setShowEndConfirmModal(true);
              } else {
                if (typeof window !== 'undefined' && setlistId) {
                  sessionStorage.setItem(`setlist-session-ended-${setlistId}`, '1');
                }
                router.replace(`/setlists/view/?id=${setlistId}`);
              }
            }}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all active:scale-95 cursor-pointer select-none shrink-0"
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isLeader) {
                setShowEndConfirmModal(true);
              } else {
                if (typeof window !== 'undefined' && setlistId) {
                  sessionStorage.setItem(`setlist-session-ended-${setlistId}`, '1');
                }
                router.replace(`/setlists/view/?id=${setlistId}`);
              }
            }}
            className="p-2 text-text-secondary hover:text-white bg-surface-raised border border-border rounded-lg transition-all shrink-0 cursor-pointer"
            title="Close setlist performance"
          >
            <X size={16} />
          </button>

          <div className="flex-1 min-w-0">
            {isLeader ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameInputValue(setlistName);
                  setIsRenameModalOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-text-primary hover:text-accent-start transition-colors group cursor-pointer max-w-full truncate text-left"
                title="Click to rename setlist performance"
              >
                <span className="truncate">{setlistName || 'Performance Setlist'}</span>
                <Pencil size={11} className="text-text-secondary group-hover:text-accent-start shrink-0" />
              </button>
            ) : (
              <p className="text-xs font-bold text-text-primary truncate">{setlistName}</p>
            )}
            <p className="text-[10px] text-text-secondary">
              {isLeader
                ? `${followerCount} follower${followerCount !== 1 ? 's' : ''}`
                : `Following ${leaderName}`
              }
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Edit Chords (Performance Copy) button */}
            {currentItem?.item_type === 'chart' && currentChart && (
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenPerfEdit(); }}
                className="px-2.5 py-1 text-xs font-bold text-yellow-300 bg-yellow-500/15 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-all flex items-center gap-1 shrink-0"
                title="Edit Chords for this Performance (Master chart in library stays unchanged)"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit Performance Chords</span>
              </button>
            )}

            {/* Transpose Controls */}
            {currentItem?.item_type === 'chart' && currentChart && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center bg-surface-raised border border-border rounded-lg p-0.5"
              >
                {isLeader && (
                  <button
                    onClick={() => handleTranspose(-1)}
                    className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-white rounded active:scale-95 transition-all cursor-pointer"
                    title="Transpose down 1 semitone (-1)"
                  >
                    <Minus size={12} />
                  </button>
                )}
                <span className="text-[10px] font-mono font-bold px-1.5 text-accent-start select-none whitespace-nowrap">
                  {currentItem.transpose_override ? `${currentItem.transpose_override > 0 ? '+' : ''}${currentItem.transpose_override}` : 'Orig'}
                </span>
                {isLeader && (
                  <button
                    onClick={() => handleTranspose(1)}
                    className="w-6 h-6 flex items-center justify-center text-text-secondary hover:text-white rounded active:scale-95 transition-all cursor-pointer"
                    title="Transpose up 1 semitone (+1)"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
            )}
            {/* Follower refresh */}
            {!isLeader && (
              <button
                onClick={() => loadSongAt(songPosition, true)}
                className="p-1.5 text-text-secondary hover:text-white bg-surface-raised border border-border rounded-lg transition-all"
              >
                <RefreshCw size={14} className={contentLoading ? 'animate-spin' : ''} />
              </button>
            )}
            {/* Follower: stop following */}
            {!isLeader && isFollowing && (
              <button onClick={stopFollowing} className="px-2 py-1 text-[9px] font-bold text-text-secondary border border-border rounded-lg hover:text-white transition-all">
                Browse
              </button>
            )}
            {/* End session (leader) */}
            {isLeader && (
              <button onClick={() => setShowEndConfirmModal(true)} className="px-2 py-1 text-[9px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                End
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Song tabs */}
        <div
          ref={tabsRef}
          className="flex items-end overflow-x-auto gap-1 px-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, idx) => {
            const active = idx === songPosition;
            const Icon = item.item_type === 'chart' ? FileText : Music;

            return (
              <button
                key={item.id}
                ref={active ? activeTabRef : undefined}
                type="button"
                onClick={() => {
                  goTo(idx);
                  setBarsVisible(false);
                }}
                className={`
                  relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold
                  rounded-t-xl border border-b-0 transition-all duration-150
                  whitespace-nowrap shrink-0 max-w-[150px] cursor-pointer
                  ${active
                    ? 'bg-bg border-border text-text-primary shadow-[0_-2px_10px_rgba(0,0,0,0.4)] z-10 -mb-px pb-[calc(0.5rem+1px)]'
                    : 'bg-surface/40 border-transparent text-text-secondary hover:text-text-primary hover:bg-surface/80'
                  }
                `}
              >
                {active && <span className="absolute top-0 left-2 right-2 h-[2px] rounded-full bg-accent-gradient" />}
                <span className="text-[9px] font-black opacity-40 shrink-0">{idx + 1}</span>
                <Icon size={11} className={active ? 'text-accent-start shrink-0' : 'shrink-0'} />
                <span className="truncate">{item.title || 'Untitled'}</span>
                {item.transpose_override !== null && item.transpose_override !== undefined && item.item_type === 'chart' && (
                  <span className="text-[8px] font-black px-0.5 rounded bg-accent-gradient/20 text-accent-start shrink-0">
                    {item.transpose_override > 0 ? '+' : ''}{item.transpose_override}
                  </span>
                )}
              </button>
            );
          })}
          <div className="w-2 shrink-0" />
        </div>
      </div>

      {/* ── Performance Copy Badge Indicator ────────────────────────────── */}
      {currentChart?.is_performance_copy && (
        <div className="fixed top-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-full text-xs font-bold shadow-lg backdrop-blur-md animate-in fade-in">
          <Zap size={14} className="fill-yellow-300 shrink-0" />
          <span>⚡ Performance Copy (Master Unchanged)</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleRevertToMaster(); }}
            className="ml-2 px-2 py-0.5 bg-yellow-500/30 hover:bg-yellow-500/50 rounded-md text-[10px] text-white transition-all"
            title="Revert to original master chart"
          >
            Revert
          </button>
        </div>
      )}

      {/* ── Content area — full screen, tap to toggle bars ───────────────── */}
      <div
        className={`flex-1 w-full h-screen overflow-hidden select-none transition-[padding] duration-300 ${
          barsVisible
            ? 'pt-[calc(6.25rem+env(safe-area-inset-top,0px))] pb-24'
            : 'pt-[max(1rem,env(safe-area-inset-top,0px))] pb-6'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleToggleBars}
      >
        {contentLoading && (
          <div className="flex items-center justify-center h-[50vh]">
            <div className="w-8 h-8 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
          </div>
        )}

        {!contentLoading && currentItem?.item_type === 'chart' && currentChart && (
          <TransformWrapper
            key={`chart-${songPosition}`}
            initialScale={perfMinScale}
            minScale={perfMinScale}
            maxScale={4}
            centerOnInit={false}
            centerZoomedOut={false}
            limitToBounds={true}
            wheel={{
              step: 0.1,
              wheelDisabled: true, // Enables vertical mouse wheel scrolling down & up
            }}
            trackPadPanning={{
              disabled: false,
              velocityDisabled: false,
              lockAxisX: false,
            }}
            panning={{
              disabled: false,
              velocityDisabled: false,
              lockAxisX: false,
            }}
            pinch={{
              step: 5,
              disabled: false,
              allowPanning: true,
            }}
            doubleClick={{ disabled: true }}
            onPanningStop={(ref) => handleUserTransform(ref.state)}
            onPinchStop={(ref) => handleUserTransform(ref.state)}
            onZoomStop={(ref) => handleUserTransform(ref.state)}
            onWheelStop={(ref) => handleUserTransform(ref.state)}
          >
            <TransformComponent
              wrapperStyle={{ width: '100vw', height: '100dvh', overflow: 'visible' }}
              contentStyle={{ padding: '0 0 120px', overflow: 'visible', width: 'max-content' }}
            >
              <ChartWrapper
                chart={currentChart}
                songKey={`${songPosition}`}
                barsVisible={barsVisible}
                onBaseScaleChange={setPerfMinScale}
                assignedTransformsRef={assignedTransformsRef}
              />
            </TransformComponent>
          </TransformWrapper>
        )}

        {!contentLoading && currentItem?.item_type === 'lyrics' && currentLyrics && (
          <div className="w-full flex justify-center px-4 pb-36 overflow-y-auto">
            <div className="w-full max-w-3xl bg-white text-slate-900 rounded-none p-6 sm:p-12 shadow-2xl border border-slate-200/80">
              <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 text-slate-900 tracking-tight">{currentLyrics.title}</h1>
              {currentItem.notes && <p className="text-sm italic text-slate-500 mb-6 pb-4 border-b border-slate-200">{currentItem.notes}</p>}
              <pre className="font-sans text-lg leading-relaxed whitespace-pre-wrap text-slate-900 font-medium"
                style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}
              >{currentLyrics.body}</pre>
            </div>
          </div>
        )}

        {/* Fallback card if the referenced song was deleted or could not be loaded */}
        {!contentLoading && currentItem && !currentChart && !currentLyrics && (
          <div className="w-full h-[60vh] flex flex-col items-center justify-center text-center p-6 text-slate-400 select-none">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 border border-amber-500/20 text-amber-500">
              <AlertCircle size={32} strokeWidth={2} />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Item Unavailable</h2>
            <p className="text-sm max-w-sm mb-6 text-slate-400">
              This song ({currentItem.item_type}) could not be loaded or may have been removed from the catalog.
            </p>
            {songPosition < items.length - 1 && (
              <button
                type="button"
                onClick={() => goTo(songPosition + 1)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95"
              >
                Skip to Next Song →
              </button>
            )}
          </div>
        )}
      </div>



      {/* ── Follower: back to leader ──────────────────────────────────────── */}
      {!isLeader && !isFollowing && (
        <button
          onClick={resumeFollowing}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase text-white bg-accent-gradient rounded-full shadow-popover hover:brightness-110 animate-bounce transition-all"
        >
          <Radio size={14} /> Back to {leaderName}'s song
        </button>
      )}

      {/* ── Edit Performance Chords Modal ─────────────────────────────────── */}
      {perfModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white/70 dark:bg-[#18181d]/70 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-2xl p-6 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] flex flex-col gap-5 max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Pencil size={18} className="text-yellow-400" />
                  <span>Edit Performance Chords</span>
                </h3>
                <p className="text-xs text-yellow-400/90 mt-1 font-medium">
                  ⚡ Edits apply ONLY to this performance setlist item. Master chart in library stays 100% unchanged.
                </p>
              </div>
              <button onClick={() => setPerfModalOpen(false)} className="p-1.5 text-text-secondary hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
              {editingLines.map((line, lineIdx) => (
                <div key={line.id || lineIdx} className="p-4 bg-surface-raised border border-border rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Section Label (e.g. Verse 1, Chorus)"
                      value={line.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingLines(prev => prev.map((l, i) => i === lineIdx ? { ...l, label: val } : l));
                      }}
                      className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-bold text-accent-start focus:outline-none focus:border-accent-solid w-48"
                    />
                    <button
                      onClick={() => {
                        setEditingLines(prev => prev.filter((_, i) => i !== lineIdx));
                      }}
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Remove section line"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Blocks / Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {line.blocks.map((block, blockIdx) => (
                      <div key={block.id || blockIdx} className="p-2.5 bg-surface border border-border/60 rounded-lg flex flex-col gap-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Bar Group {blockIdx + 1}</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {block.bars.map((bar, barIdx) => (
                            <input
                              key={barIdx}
                              type="text"
                              placeholder="e.g. C, G, Am"
                              value={bar}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingLines(prev => prev.map((l, i) => {
                                  if (i !== lineIdx) return l;
                                  const newBlocks = l.blocks.map((b, bi) => {
                                    if (bi !== blockIdx) return b;
                                    const newBars = [...b.bars];
                                    newBars[barIdx] = val;
                                    return { ...b, bars: newBars };
                                  });
                                  return { ...l, blocks: newBlocks };
                                }));
                              }}
                              className="px-2.5 py-1 bg-surface-raised border border-border/80 rounded text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-accent-solid"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setEditingLines(prev => [...prev, createDefaultLine()])}
                className="py-2.5 px-4 bg-surface-raised border border-dashed border-border rounded-xl text-xs font-bold text-text-secondary hover:text-white hover:border-accent-solid transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Section Line
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4 gap-3">
              {currentChart?.is_performance_copy && (
                <button
                  onClick={handleRevertToMaster}
                  className="px-3 py-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Revert to Original Master
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setPerfModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePerfCopy}
                  disabled={isSavingPerf}
                  className="px-5 py-2.5 bg-accent-gradient text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{isSavingPerf ? 'Saving...' : 'Save Performance Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── End Session Confirmation Modal ── */}
      {showEndConfirmModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white/70 dark:bg-[#18181d]/70 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] rounded-3xl p-6 sm:p-8 w-full max-w-sm flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500">
              <Radio size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary">End Setlist Sync Session?</h3>
              <p className="text-xs text-text-secondary mt-2 leading-relaxed font-medium">
                Are you sure you want to end this performance session for all connected followers?
              </p>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="flex-1 py-3 px-4 bg-surface-raised border border-border rounded-xl text-xs font-bold text-text-secondary hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirmModal(false);
                  handleEndSession();
                }}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white shadow-md hover:shadow-red-600/30 transition-all"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename Setlist Performance Modal ── */}
      {isRenameModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => { e.stopPropagation(); setIsRenameModalOpen(false); }}
        >
          <div
            className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Pencil size={18} className="text-accent-start" />
                Edit Performance Name
              </h3>
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="p-1.5 text-text-secondary hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Performance / Setlist Name</label>
              <input
                type="text"
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                placeholder="e.g. Sunday Morning Service, Band Rehearsal"
                className="w-full px-3.5 py-2.5 bg-surface-raised border border-border rounded-xl text-sm font-bold text-text-primary focus:outline-none focus:border-accent-start"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (renameInputValue.trim()) {
                      handleRenameSetlist(renameInputValue.trim());
                      setIsRenameModalOpen(false);
                    }
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (renameInputValue.trim()) {
                    handleRenameSetlist(renameInputValue.trim());
                    setIsRenameModalOpen(false);
                  }
                }}
                disabled={!renameInputValue.trim()}
                className="px-5 py-2.5 bg-accent-gradient text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

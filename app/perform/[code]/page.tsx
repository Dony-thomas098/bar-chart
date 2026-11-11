'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { usePerformanceSession } from '@/hooks/usePerformanceSession';
import { readChart, readLyrics } from '@/lib/storage';
import { useChartPrefetch } from '@/hooks/useChartPrefetch';
import { ChartData, Line, createDefaultLine } from '@/lib/chart-types';
import { ChartRenderer } from '@/components/ChartRenderer';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { calculateScoreFit } from '@/lib/score-fit';
import { transposeChart } from '@/lib/transpose';
import { supabase } from '@/lib/supabase';
import {
  ChevronLeft, ChevronRight, X, Edit2, Copy, Check, ArrowLeft,
  Users, Radio, StopCircle, WifiOff, RefreshCw, ScrollText, Play, Pause, Crop,
  Minus, Plus, Pencil, Trash2, Save
} from 'lucide-react';

// ─── Inner chart wrapper (needs access to zoom controls) ──────────────────────

function PerformChartWrapper({ 
  chart,
  showHeader = true,
  onBaseScaleChange,
}: { 
  chart: ChartData;
  showHeader?: boolean;
  onBaseScaleChange?: (scale: number) => void;
}) {
  const { zoomToElement, setTransform, instance } = useControls();
  const isInitialFitRef = useRef(true);

  const fitToScreen = useCallback(() => {
    const cardEl = document.getElementById('perform-chart-card');
    const wrapper = instance.wrapperComponent;
    if (!cardEl || !wrapper) return;

    const viewportWidth = wrapper.clientWidth;
    const viewportHeight = wrapper.clientHeight;
    const cardWidth = Math.max(cardEl.scrollWidth, cardEl.offsetWidth);
    const cardHeight = Math.max(cardEl.scrollHeight, cardEl.offsetHeight);

    const { scale, posX, posY, effectiveMinScale } = calculateScoreFit({
      viewportWidth,
      viewportHeight,
      cardWidth,
      cardHeight,
      showUI: showHeader,
      topPadding: 8,
    });

    if (instance.setup) {
      instance.setup.minScale = effectiveMinScale;
    }
    if (onBaseScaleChange) {
      onBaseScaleChange(effectiveMinScale);
    }

    const animDuration = isInitialFitRef.current ? 0 : 250;
    isInitialFitRef.current = false;

    setTransform(posX, posY, scale, animDuration);
  }, [instance, setTransform, onBaseScaleChange, showHeader]);

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
      t2 = setTimeout(fitToScreen, 200);
      t3 = setTimeout(fitToScreen, 400);
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
  }, [fitToScreen, chart.id, showHeader]);

  // Navigate to section on perform-navigate event (zoom to chart card)
  useEffect(() => {
    const handler = () => zoomToElement('perform-chart-card', undefined, 300);
    window.addEventListener('perform-navigate', handler);
    return () => window.removeEventListener('perform-navigate', handler);
  }, [zoomToElement]);

  return <ChartRenderer chart={chart} id="perform-chart-card" />;
}

// ─── Code badge (copy-on-tap) ─────────────────────────────────────────────────

function CodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-raised border border-border rounded-xl text-xs font-mono font-bold text-text-primary hover:border-accent-solid transition-all shrink-0 cursor-pointer"
      title="Click to copy room code"
      aria-label="Copy session code"
    >
      <Radio size={12} className="text-accent-start animate-pulse" />
      <span>{code}</span>
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-text-secondary" />}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const getInitialCode = () => {
    const rawParam = Array.isArray(params?.code) ? params.code[0] : params?.code;
    if (rawParam && rawParam.toLowerCase() !== 'stage' && rawParam.toLowerCase() !== 'demo') {
      return rawParam.toUpperCase();
    }
    const spCode = searchParams?.get('code');
    if (spCode) return spCode.toUpperCase();
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const wCode = urlParams.get('code');
      if (wCode) return wCode.toUpperCase();
    }
    return '';
  };

  const [resolvedCode, setResolvedCode] = useState<string>(getInitialCode);
  const code = resolvedCode;

  useEffect(() => {
    const rawParam = Array.isArray(params?.code) ? params.code[0] : params?.code;
    const currentCode =
      (rawParam && rawParam.toLowerCase() !== 'stage' && rawParam.toLowerCase() !== 'demo' ? rawParam : null) ||
      searchParams?.get('code') ||
      (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') : null) ||
      '';
    if (currentCode && currentCode.toUpperCase() !== resolvedCode) {
      setResolvedCode(currentCode.toUpperCase());
    }
  }, [params, searchParams, resolvedCode]);

  // Read leader payload from sessionStorage or localStorage (set by builder page or reader on this device)
  const initialPayload = React.useMemo(() => {
    if (!code || typeof window === 'undefined') return undefined;
    if (sessionStorage.getItem(`perform-ended-${code}`) === 'true') {
      return undefined;
    }
    const raw =
      sessionStorage.getItem(`perform-leader-${code}`) ||
      localStorage.getItem(`perform-leader-${code}`) ||
      localStorage.getItem(`perform-active-session-${code}`);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.chartIds) && parsed.chartIds.length > 0) {
        return { chartIds: parsed.chartIds, sessionName: parsed.sessionName || 'Live Performance' };
      }
    } catch {
      return undefined;
    }
    return undefined;
  }, [code]);

  // Back button guard: if session was ended on this device, never re-enter on popstate / back
  useEffect(() => {
    if (!code || typeof window === 'undefined') return;
    if (sessionStorage.getItem(`perform-ended-${code}`) === 'true') {
      router.replace('/perform');
    }
  }, [code, router]);

  const {
    mode, currentIndex, chartIds, sessionName, leaderName,
    followerCount, isFollowing, goTo, endSession, stopFollowing, resumeFollowing,
    broadcastChordUpdate,
  } = usePerformanceSession(code, initialPayload);

  // localIndex represents what is currently shown on the screen.
  // When following, it tracks hook's currentIndex. When browsing manually, it diverges.
  const [localIndex, setLocalIndex] = useState(0);

  useEffect(() => {
    if (isFollowing) {
      setLocalIndex(currentIndex);
    }
  }, [currentIndex, isFollowing]);

  const [currentChart, setCurrentChart] = useState<ChartData | null>(null);
  const [currentLyrics, setCurrentLyrics] = useState<any | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [selectedFont, setSelectedFont] = useState('system');

  // Performance Chord Editing State
  const [perfModalOpen, setPerfModalOpen] = useState(false);
  const [editingLines, setEditingLines] = useState<Line[]>([]);
  const [isSavingPerf, setIsSavingPerf] = useState(false);

  useEffect(() => {
    const savedFont = localStorage.getItem('chord-grid-font');
    if (savedFont) setSelectedFont(savedFont);
  }, []);

  // ── Pre-fetch surrounding charts ──────────────────────────────────────────
  const { getFromCache, addToCache } = useChartPrefetch(chartIds, localIndex);

  // Load chart or lyrics when localIndex changes
  const loadCurrentSong = useCallback(async (forceFromDb = false) => {
    if (!chartIds.length || chartIds[localIndex] === undefined) return;
    const id = chartIds[localIndex];

    // Try the pre-fetch cache first (skip on forced refresh)
    if (!forceFromDb) {
      const cached = getFromCache(id);
      if (cached) {
        setCurrentChart(cached);
        setCurrentLyrics(null);
        setChartLoading(false);
        return;
      }
    }

    setChartLoading(true);
    try {
      const chartData = await readChart(id, forceFromDb);
      if (chartData) {
        setCurrentChart(chartData as ChartData);
        setCurrentLyrics(null);
        addToCache(id, chartData as ChartData);
        setChartLoading(false);
        return;
      }
    } catch (e) {}

    try {
      const lyricsData = await readLyrics(id);
      if (lyricsData) {
        setCurrentLyrics(lyricsData);
        setCurrentChart(null);
        setChartLoading(false);
        return;
      }
    } catch (e) {}

    setCurrentChart(null);
    setCurrentLyrics(null);
    setChartLoading(false);
  }, [localIndex, chartIds, getFromCache, addToCache]);

  useEffect(() => {
    loadCurrentSong();
  }, [loadCurrentSong]);

  // Listen for session-end broadcast
  useEffect(() => {
    const handler = () => setSessionEnded(true);
    window.addEventListener('perform-session-end', handler);
    return () => window.removeEventListener('perform-session-end', handler);
  }, []);

  const [performMinScale, setPerformMinScale] = useState(1);
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

  // ─── Simple tap-to-toggle header (like setlist perform) ────────────────
  const toggleHeader = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    setShowHeader(prev => !prev);
  }, []);

  // Transpose helper with live broadcast
  const handleTranspose = useCallback((delta: number) => {
    if (!currentChart) return;
    const newOffset = (currentChart.semitone_offset || 0) + delta;
    const transposed = transposeChart(currentChart, delta, currentChart.prefer_flats);
    const updated: ChartData = {
      ...transposed,
      semitone_offset: newOffset,
    };
    setCurrentChart(updated);
    addToCache(updated.id, updated);
    if (mode === 'leader') {
      broadcastChordUpdate({
        chartId: updated.id,
        lines: updated.lines,
        semitone_offset: newOffset,
        prefer_flats: updated.prefer_flats,
      });
    }
  }, [currentChart, mode, addToCache, broadcastChordUpdate]);

  // Listen for broadcast chord updates from leader (transpositions / line edits)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.chartId) return;

      setCurrentChart(prev => {
        if (!prev || prev.id !== detail.chartId) return prev;
        let updated: ChartData = { ...prev };
        if (detail.lines) {
          updated.lines = detail.lines;
        }
        if (typeof detail.semitone_offset === 'number') {
          const currentOffset = prev.semitone_offset || 0;
          const delta = detail.semitone_offset - currentOffset;
          if (delta !== 0 && !detail.lines) {
            updated = transposeChart(updated, delta, detail.prefer_flats ?? prev.prefer_flats);
          }
          updated.semitone_offset = detail.semitone_offset;
        }
        if (detail.prefer_flats !== undefined) {
          updated.prefer_flats = detail.prefer_flats;
        }
        addToCache(detail.chartId, updated);
        return updated;
      });
    };

    window.addEventListener('perform-chord-update', handler);
    return () => window.removeEventListener('perform-chord-update', handler);
  }, [addToCache]);

  // Live DB sync for active chart (in case leader edits in full editor and saves)
  useEffect(() => {
    if (!currentChart?.id) return;
    const ch = supabase
      .channel(`live-stage-chart-${currentChart.id}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'charts', filter: `id=eq.${currentChart.id}` },
        (payload: any) => {
          if (payload.new) {
            setCurrentChart(prev => {
              if (!prev || prev.id !== payload.new.id) return prev;
              const updated = { ...prev, ...payload.new };
              addToCache(updated.id, updated);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch).catch(() => {});
    };
  }, [currentChart?.id, addToCache]);

  // Performance Chord Editing Handlers
  const handleOpenPerfEdit = () => {
    if (!currentChart) return;
    setEditingLines(JSON.parse(JSON.stringify(currentChart.lines || [])));
    setPerfModalOpen(true);
  };

  const handleSavePerfCopy = async () => {
    if (!currentChart) return;
    setIsSavingPerf(true);
    try {
      const updated: ChartData = { ...currentChart, lines: editingLines };
      setCurrentChart(updated);
      addToCache(updated.id, updated);

      // Save to local IndexedDB and sync queue
      const { saveChart } = await import('@/lib/storage');
      await saveChart(updated);

      // Broadcast immediately to all connected follower devices
      broadcastChordUpdate({
        chartId: updated.id,
        lines: editingLines,
        semitone_offset: updated.semitone_offset,
        prefer_flats: updated.prefer_flats,
      });
      setPerfModalOpen(false);
    } catch (err) {
      console.warn('[Performance] Failed to save performance chords:', err);
    } finally {
      setIsSavingPerf(false);
    }
  };

  // Keyboard navigation for leader
  useEffect(() => {
    if (mode !== 'leader') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') goTo(Math.min(currentIndex + 1, chartIds.length - 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') goTo(Math.max(currentIndex - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, currentIndex, chartIds.length, goTo]);

  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);



  // Prevent accidental page leave / tab close during live performance session
  useEffect(() => {
    if (mode !== 'leader') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [mode]);

  const handleEndSession = () => {
    endSession();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`perform-leader-${code}`);
      localStorage.removeItem(`perform-leader-${code}`);
      localStorage.removeItem(`perform-active-session-${code}`);
      sessionStorage.setItem(`perform-ended-${code}`, 'true');
    }
    router.replace('/perform');
  };

  const handleFollowerLeave = () => {
    stopFollowing();
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`perform-leader-${code}`);
      localStorage.removeItem(`perform-leader-${code}`);
      localStorage.removeItem(`perform-active-session-${code}`);
      sessionStorage.setItem(`perform-ended-${code}`, 'true');
    }
    router.replace('/perform');
  };

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-bg text-white">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg text-white gap-4">
        <WifiOff size={32} className="text-text-secondary" />
        <p>You must be signed in to join a performance session.</p>
        <button onClick={() => router.push('/auth')} className="px-6 py-2.5 bg-accent-gradient text-white font-bold rounded-xl">Sign In</button>
      </div>
    );
  }

  // ── Missing code guard ───────────────────────────────────────────────────
  if (!code) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg text-white gap-4 p-6 text-center">
        <Radio size={36} className="text-text-secondary" />
        <h2 className="text-xl font-bold">No Active Session Code</h2>
        <p className="text-text-secondary text-sm max-w-xs">
          Please join or start a performance session with a valid 6-character room code.
        </p>
        <button
          onClick={() => router.replace('/perform')}
          className="px-6 py-2.5 bg-accent-gradient text-white font-bold rounded-xl hover:brightness-110 transition-all cursor-pointer"
        >
          Back to Performance
        </button>
      </div>
    );
  }

  // ── Session ended overlay ─────────────────────────────────────────────────
  if (sessionEnded) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg text-white gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center mb-2">
          <StopCircle size={36} className="text-text-secondary" />
        </div>
        <h2 className="text-2xl font-bold">Session Ended</h2>
        <p className="text-text-secondary max-w-xs">{leaderName ?? 'The leader'} has ended the performance session.</p>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`perform-ended-${code}`, 'true');
            }
            router.replace('/perform');
          }}
          className="px-6 py-3 bg-accent-gradient text-white font-bold rounded-xl hover:brightness-110 transition-all cursor-pointer"
        >
          Back to Performance
        </button>
      </div>
    );
  }

  // ── Loading — follower waiting for leader ─────────────────────────────────
  if (mode === 'loading') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg text-white gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
        <p className="text-text-secondary font-medium">Connecting to session <span className="font-mono font-bold text-text-primary">{code}</span>…</p>
        <p className="text-xs text-text-secondary">Waiting for the leader to join.</p>
        <button onClick={() => router.push('/perform')} className="mt-4 text-xs text-text-secondary underline">Cancel</button>
      </div>
    );
  }

  const isLeader = mode === 'leader';
  const totalCharts = chartIds.length;

  return (
    <div
      className="min-h-screen bg-bg flex flex-col text-text-primary relative overflow-hidden"
      onClick={toggleHeader}
    >
      {/* ── Header (auto-hide) ── */}
      <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-bg/90 backdrop-blur-md border-b border-border/50 transition-all duration-300 gap-2 ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Desktop Back button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isLeader) {
                setShowEndConfirmModal(true);
              } else {
                handleFollowerLeave();
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
            onClick={(e) => { 
              e.stopPropagation(); 
              if (isLeader) {
                setShowEndConfirmModal(true);
              } else {
                handleFollowerLeave(); 
              }
            }}
            className="p-1.5 sm:p-2 text-text-secondary hover:text-white bg-surface border border-border rounded-lg transition-all shrink-0 cursor-pointer"
            title={isLeader ? "End performance session" : "Leave performance session"}
          >
            <X size={16} />
          </button>
          
          <div className="min-w-0 truncate">
            <p className="text-xs sm:text-sm font-bold text-text-primary truncate">{sessionName}</p>
            {!isLeader && leaderName && (
              <p className="text-[10px] text-text-secondary truncate">Leader: {leaderName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Follower Count Pill: Always fully visible on phone and desktop */}
          <div
            className="flex items-center gap-1 px-2 py-1.5 bg-surface-raised border border-border rounded-xl text-xs font-semibold text-text-primary whitespace-nowrap shrink-0"
            title={`${followerCount} connected participant${followerCount !== 1 ? 's' : ''}`}
          >
            <Users size={12} className="text-accent-start" />
            <span className="font-mono font-bold">{followerCount}</span>
            <span className="hidden sm:inline text-text-secondary font-normal">follower{followerCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Session Code Badge: Tap to copy code */}
          <CodeBadge code={code} />

          {/* Leader-only controls: Transpose, Live Edit, Full Edit */}
          {isLeader && currentChart && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center bg-surface border border-border rounded-xl p-0.5 shadow-sm shrink-0"
            >
              <button
                onClick={() => handleTranspose(-1)}
                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-text-secondary hover:text-white hover:bg-surface-raised rounded-lg active:scale-95 transition-all cursor-pointer"
                title="Transpose down 1 semitone (-1)"
              >
                <Minus size={12} />
              </button>
              <span className="text-[11px] font-mono font-bold px-1.5 sm:px-2 text-accent-start select-none whitespace-nowrap">
                {currentChart.semitone_offset === 0
                  ? 'Orig'
                  : `${currentChart.semitone_offset > 0 ? '+' : ''}${currentChart.semitone_offset}`}
              </span>
              <button
                onClick={() => handleTranspose(1)}
                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-text-secondary hover:text-white hover:bg-surface-raised rounded-lg active:scale-95 transition-all cursor-pointer"
                title="Transpose up 1 semitone (+1)"
              >
                <Plus size={12} />
              </button>
            </div>
          )}

          {isLeader && currentChart && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenPerfEdit();
              }}
              className="px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-all flex items-center gap-1 text-xs font-bold shrink-0 cursor-pointer"
              title="Edit Chords live in performance"
            >
              <Pencil size={13} />
              <span className="hidden md:inline">Edit Chords</span>
            </button>
          )}

          {isLeader && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!currentChart) return;
                router.push(`/chart/edit/?id=${encodeURIComponent(currentChart.id)}&returnTo=/perform/stage?code=${code}`);
              }}
              disabled={!currentChart}
              className="p-1.5 sm:p-2 bg-accent-gradient text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-40 shrink-0 cursor-pointer"
              title="Full Chart Editor"
            >
              <Edit2 size={14} />
            </button>
          )}

          {/* End / Leave Button: Red button for both Leader and Follower */}
          {isLeader ? (
            <button
              onClick={(e) => { e.stopPropagation(); setShowEndConfirmModal(true); }}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500 hover:text-white transition-all shrink-0 cursor-pointer"
              title="End session for all connected followers"
            >
              End
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleFollowerLeave(); }}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Leave live performance session"
            >
              Leave
            </button>
          )}
        </div>
      </div>

      {/* ── Content Canvas ── */}
      <main
        className={`flex-1 w-full h-screen overflow-hidden select-none transition-[padding] duration-300 ${
          showHeader
            ? 'pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-24'
            : 'pt-[max(1rem,env(safe-area-inset-top,0px))] pb-6'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={toggleHeader}
      >
        {chartLoading ? (
          <div className="flex items-center justify-center w-full h-[60vh] text-text-secondary">
            <div className="w-8 h-8 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
          </div>
        ) : currentChart ? (
          <TransformWrapper
            initialScale={performMinScale}
            minScale={performMinScale}
            maxScale={4}
            centerOnInit={false}
            centerZoomedOut={false}
            limitToBounds={true}
            wheel={{
              step: 0.1,
              wheelDisabled: true,
            }}
            trackPadPanning={{
              disabled: false,
              velocityDisabled: false,
              lockAxisX: true,
            }}
            panning={{
              disabled: false,
              velocityDisabled: false,
              lockAxisX: true,
            }}
            pinch={{
              step: 5,
              disabled: false,
              allowPanning: true,
            }}
            doubleClick={{ disabled: true }}
          >
            <TransformComponent
              wrapperClass="!w-full !h-full cursor-pointer"
              contentClass="w-max flex flex-col items-start justify-start pb-36"
            >
              <div onClick={(e) => { e.stopPropagation(); toggleHeader(); }} className="w-fit max-w-none flex flex-col items-start justify-start">
                <PerformChartWrapper chart={currentChart} showHeader={showHeader} onBaseScaleChange={setPerformMinScale} />
              </div>
            </TransformComponent>
          </TransformWrapper>
        ) : currentLyrics ? (
          <div className="w-full flex justify-center px-4 pb-36 overflow-y-auto">
            <div className="w-full max-w-3xl bg-white text-slate-900 rounded-none p-6 sm:p-12 shadow-2xl border border-slate-200/80">
              <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 text-slate-900 tracking-tight">
                {currentLyrics.title || 'Untitled Lyrics'}
              </h1>
              <pre
                className="font-sans text-lg sm:text-xl leading-relaxed whitespace-pre-wrap text-slate-900 font-medium"
                style={selectedFont !== 'system' ? { fontFamily: selectedFont } : {}}
              >
                {currentLyrics.body || ''}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-[60vh] text-center p-6 text-text-secondary select-none">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 border border-orange-500/20 text-orange-500">
              <Radio size={32} />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Item Unavailable</h2>
            <p className="text-sm max-w-sm mb-6 text-text-secondary">
              This song could not be loaded or may have been removed.
            </p>
            {localIndex < totalCharts - 1 && (
              <button
                type="button"
                onClick={() => {
                  if (isLeader) goTo(localIndex + 1);
                  else { setLocalIndex(idx => Math.min(totalCharts - 1, idx + 1)); stopFollowing(); }
                }}
                className="px-5 py-2.5 bg-accent-gradient text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg active:scale-95"
              >
                Skip to Next Song →
              </button>
            )}
          </div>
        )}
      </main>

      {/* ── Bottom Interactive Navigation Pill ── */}
      {showHeader && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 transition-all duration-300">
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-surface/90 backdrop-blur-md border border-border rounded-full text-xs font-bold shadow-2xl text-text-primary select-none">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isLeader) goTo(Math.max(0, currentIndex - 1));
                else { setLocalIndex(idx => Math.max(0, idx - 1)); stopFollowing(); }
              }}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-full hover:bg-surface-raised disabled:opacity-30 transition-all text-text-secondary hover:text-white"
              title="Previous Page / Song (←)"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const activeIdx = isFollowing ? currentIndex : localIndex;
                if (activeIdx < totalCharts - 1) {
                  if (isLeader) goTo(activeIdx + 1);
                  else { setLocalIndex(idx => Math.min(totalCharts - 1, idx + 1)); stopFollowing(); }
                }
              }}
              className="px-3 py-1 rounded-full bg-surface-raised hover:bg-border transition-all text-text-primary flex items-center gap-1.5 cursor-pointer"
              title="Click to go to Next Page / Song"
            >
              <span className="text-accent-start font-black">{(isFollowing ? currentIndex : localIndex) + 1} / {totalCharts}</span>
              {(currentChart?.title || currentLyrics?.title) && (
                <span className="text-text-primary truncate max-w-[160px]">· {currentChart?.title || currentLyrics?.title}</span>
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isLeader) goTo(Math.min(totalCharts - 1, currentIndex + 1));
                else { setLocalIndex(idx => Math.min(totalCharts - 1, idx + 1)); stopFollowing(); }
              }}
              disabled={currentIndex >= totalCharts - 1}
              className="p-1.5 rounded-full bg-accent-gradient text-white hover:brightness-110 disabled:opacity-30 transition-all shadow-md"
              title="Next Page / Song (→)"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}



      {/* ── Follower: status badge + back-to-leader pill ── */}
      {!isLeader && (
        <>
          {/* Following badge — top-left when header hidden */}
          {!showHeader && (
            <div className="fixed top-4 left-4 z-40 flex items-center gap-2 px-3 py-1.5 bg-surface/80 border border-border rounded-xl text-xs font-bold text-text-secondary backdrop-blur-sm">
              <Radio size={10} className="text-accent-start animate-pulse" />
              {leaderName}
            </div>
          )}

          {/* Back-to-leader pill (shown when manually browsed away) */}
          {!isFollowing && (
            <button
              onClick={(e) => { e.stopPropagation(); resumeFollowing(); }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 text-xs font-bold tracking-widest uppercase text-white bg-accent-gradient rounded-full shadow-popover hover:brightness-110 transition-all animate-bounce"
            >
              <Radio size={14} /> Back to {leaderName}'s chart
            </button>
          )}
        </>
      )}

      {/* ── End Session Confirmation Modal ── */}
      {showEndConfirmModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white/70 dark:bg-[#18181d]/70 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] rounded-3xl p-6 sm:p-8 w-full max-w-sm flex flex-col gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-500">
              <StopCircle size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-text-primary">End Live Session?</h3>
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

      {/* ── Edit Performance Chords Modal ── */}
      {perfModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-2xl bg-white/70 dark:bg-[#18181d]/70 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-2xl p-6 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] flex flex-col gap-5 max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Pencil size={18} className="text-yellow-400" />
                  <span>Edit Performance Chords</span>
                </h3>
                <p className="text-xs text-yellow-400/90 mt-1 font-medium">
                  ⚡ Edits instantly broadcast live to all connected follower devices.
                </p>
              </div>
              <button onClick={() => setPerfModalOpen(false)} className="p-1.5 text-text-secondary hover:text-white rounded-lg cursor-pointer">
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
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
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
                className="py-2.5 px-4 bg-surface-raised border border-dashed border-border rounded-xl text-xs font-bold text-text-secondary hover:text-white hover:border-accent-solid transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Add Section Line
              </button>
            </div>

            <div className="flex items-center justify-end border-t border-border pt-4 gap-3">
              <button
                onClick={() => setPerfModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-white transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePerfCopy}
                disabled={isSavingPerf}
                className="px-5 py-2.5 bg-accent-gradient text-white text-xs font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save size={15} />
                <span>{isSavingPerf ? 'Broadcasting...' : 'Save & Broadcast'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

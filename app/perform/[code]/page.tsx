'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { usePerformanceSession } from '@/hooks/usePerformanceSession';
import { readChart } from '@/lib/storage';
import { useChartPrefetch } from '@/hooks/useChartPrefetch';
import { ChartData } from '@/lib/chart-types';
import { ChartRenderer } from '@/components/ChartRenderer';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import {
  ChevronLeft, ChevronRight, X, Edit2, Copy, Check,
  Users, Radio, StopCircle, WifiOff, RefreshCw, ScrollText, Play, Pause, Crop
} from 'lucide-react';

// ─── Inner chart wrapper (needs access to zoom controls) ──────────────────────

function PerformChartWrapper({ 
  chart,
  onBaseScaleChange,
}: { 
  chart: ChartData;
  onBaseScaleChange?: (scale: number) => void;
}) {
  const { zoomToElement, setTransform, instance } = useControls();

  const fitToScreen = useCallback(() => {
    const cardEl = document.getElementById('perform-chart-card');
    const wrapper = instance.wrapperComponent;
    if (!cardEl || !wrapper) return;

    const viewportWidth = wrapper.clientWidth;
    const availableWidth = Math.max(260, viewportWidth - 24);
    const cardWidth = Math.max(cardEl.scrollWidth, cardEl.offsetWidth);

    let scale = 1;
    if (cardWidth > 0 && availableWidth > 0) {
      if (availableWidth < cardWidth) {
        scale = Math.max(0.15, (availableWidth / cardWidth) * 0.98);
      } else {
        scale = 1;
      }
    }

    if (instance.setup) {
      instance.setup.minScale = scale;
    }
    if (onBaseScaleChange) {
      onBaseScaleChange(scale);
    }

    const posX = Math.max(0, (viewportWidth - cardWidth * scale) / 2);
    setTransform(posX, 0, scale, 0);
  }, [instance, setTransform, onBaseScaleChange]);

  useEffect(() => {
    let t1: any;
    let t2: any;
    const runFit = () => {
      clearTimeout(t1);
      clearTimeout(t2);
      t1 = setTimeout(fitToScreen, 50);
      t2 = setTimeout(fitToScreen, 200);
    };
    runFit();
    window.addEventListener('resize', runFit);
    window.addEventListener('orientationchange', runFit);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', runFit);
      window.removeEventListener('orientationchange', runFit);
    };
  }, [fitToScreen, chart.id]);

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
  const copy = () => {
    const url = `${window.location.origin}/perform/stage?code=${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-2 px-3 py-1.5 bg-surface-raised border border-border rounded-xl text-xs font-mono font-bold text-text-primary hover:border-accent-solid transition-all">
      <Radio size={12} className="text-accent-start animate-pulse" />
      {code}
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
  const code = ((params?.code as string) || searchParams?.get('code') || '').toUpperCase();

  // Read leader payload from sessionStorage (set by builder page on this device)
  const [initialPayload] = useState<{ chartIds: string[]; sessionName: string } | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const raw = sessionStorage.getItem(`perform-leader-${code}`);
    if (!raw) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  });

  const {
    mode, currentIndex, chartIds, sessionName, leaderName,
    followerCount, isFollowing, goTo, endSession, stopFollowing, resumeFollowing,
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
  const [chartLoading, setChartLoading] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [selectedFont, setSelectedFont] = useState('system');

  useEffect(() => {
    const savedFont = localStorage.getItem('chord-grid-font');
    if (savedFont) setSelectedFont(savedFont);
  }, []);

  // ── Pre-fetch surrounding charts ──────────────────────────────────────────
  const { getFromCache, addToCache } = useChartPrefetch(chartIds, localIndex);

  // Load chart when localIndex changes
  const loadCurrentChart = useCallback((forceFromDb = false) => {
    if (!chartIds.length || chartIds[localIndex] === undefined) return;
    const id = chartIds[localIndex];

    // Try the pre-fetch cache first (skip on forced refresh)
    if (!forceFromDb) {
      const cached = getFromCache(id);
      if (cached) {
        setCurrentChart(cached);
        setChartLoading(false);
        return;
      }
    }

    setChartLoading(true);
    // Bypass local cache if we want to fetch fresh edits from DB
    readChart(id, forceFromDb).then(data => {
      if (data) {
        setCurrentChart(data as ChartData);
        addToCache(id, data as ChartData);
      }
      setChartLoading(false);
    });
  }, [localIndex, chartIds, getFromCache, addToCache]);

  useEffect(() => {
    loadCurrentChart();
  }, [loadCurrentChart]);

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
    sessionStorage.removeItem(`perform-leader-${code}`);
    router.push('/perform');
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

  // ── Session ended overlay ─────────────────────────────────────────────────
  if (sessionEnded) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-bg text-white gap-6 p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center mb-2">
          <StopCircle size={36} className="text-text-secondary" />
        </div>
        <h2 className="text-2xl font-bold">Session Ended</h2>
        <p className="text-text-secondary max-w-xs">{leaderName ?? 'The leader'} has ended the performance session.</p>
        <button onClick={() => router.push('/')} className="px-6 py-3 bg-accent-gradient text-white font-bold rounded-xl hover:brightness-110 transition-all">
          Back to Charts
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
      <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-bg/80 backdrop-blur-md border-b border-border/50 transition-all duration-300 ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (isLeader) {
                setShowEndConfirmModal(true);
              } else {
                router.push('/perform'); 
              }
            }}
            className="p-2 text-text-secondary hover:text-white bg-surface border border-border rounded-lg transition-all shrink-0"
            title="Close performance session"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text-primary truncate">{sessionName}</p>
            <p className="text-[10px] text-text-secondary">
              {isLeader ? (
                <span className="flex items-center gap-1">
                  <Users size={10} /> {followerCount} follower{followerCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span>Following {leaderName}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <CodeBadge code={code} />
          {!isLeader && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                loadCurrentChart(true);
              }}
              className="p-2 text-text-secondary hover:text-white bg-surface border border-border rounded-lg transition-all"
              title="Refresh current chart"
            >
              <RefreshCw size={16} className={chartLoading ? 'animate-spin' : ''} />
            </button>
          )}
          {isLeader && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!currentChart) return;
                router.push(`/chart/edit?id=${currentChart.id}&returnTo=/perform/stage?code=${code}`);
              }}
              disabled={!currentChart}
              className="p-2 bg-accent-gradient text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-40"
              title="Edit current chart"
            >
              <Edit2 size={16} />
            </button>
          )}
          {isLeader && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowEndConfirmModal(true); }}
              className="px-3 py-2 text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg hover:bg-red-500 hover:text-white transition-all"
            >
              End
            </button>
          )}
        </div>
      </div>

      {/* ── Chart Canvas ── */}
      <main
        className="flex-1 w-full h-screen overflow-hidden select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={toggleHeader}
      >
        <TransformWrapper
          initialScale={performMinScale}
          minScale={performMinScale}
          maxScale={4}
          centerOnInit={true}
          centerZoomedOut={true}
          limitToBounds={true}
          wheel={{
            step: 0.1,
            wheelDisabled: true, // Enables natural vertical mouse wheel scrolling down & up
          }}
          trackPadPanning={{
            disabled: false,
            velocityDisabled: false,
            lockAxisX: true, // Locks vertical scroll along Y-axis so chart remains centered
          }}
          panning={{
            disabled: false,
            velocityDisabled: false,
          }}
          pinch={{
            step: 5,
            disabled: false,
            allowPanning: true,
          }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent
            wrapperClass="!w-full !h-screen cursor-pointer"
            contentClass="w-max min-w-full min-h-screen flex items-start justify-center p-4 sm:p-16 pt-24 pb-36"
          >
            <div onClick={(e) => { e.stopPropagation(); toggleHeader(); }} className="w-full h-full flex items-center justify-center">
              {chartLoading || !currentChart ? (
                <div className="flex items-center justify-center w-64 h-64 text-text-secondary">
                  <div className="w-8 h-8 rounded-full border-2 border-accent-start border-t-transparent animate-spin" />
                </div>
              ) : (
                <PerformChartWrapper chart={currentChart} onBaseScaleChange={setPerformMinScale} />
              )}
            </div>
          </TransformComponent>
        </TransformWrapper>
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
                if (currentIndex < totalCharts - 1) {
                  if (isLeader) goTo(currentIndex + 1);
                  else { setLocalIndex(idx => Math.min(totalCharts - 1, idx + 1)); stopFollowing(); }
                }
              }}
              className="px-3 py-1 rounded-full bg-surface-raised hover:bg-border transition-all text-text-primary flex items-center gap-1.5 cursor-pointer"
              title="Click to go to Next Page / Song"
            >
              <span className="text-accent-start font-black">{currentIndex + 1} / {totalCharts}</span>
              {currentChart && <span className="text-text-primary truncate max-w-[160px]">· {currentChart.title}</span>}
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
    </div>
  );
}

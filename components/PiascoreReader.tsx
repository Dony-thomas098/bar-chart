'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChartData } from '@/lib/chart-types';
import { ChartRenderer } from '@/components/ChartRenderer';
import { SongPickerModal, PickedItem } from '@/components/SongPickerModal';
import { transposeChart } from '@/lib/transpose';
import { readChart, toggleBookmark, getBookmarks } from '@/lib/storage';
import { calculateScoreFit } from '@/lib/score-fit';
import { supabase } from '@/lib/supabase';
import { useAuth, canModifySection } from '@/components/AuthProvider';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import {
  FolderOpen, Smile, X, Plus, Play, Pause, Bookmark as BookmarkIcon,
  Crop, LayoutGrid, Info, Edit3, ArrowUpDown, BookOpen, Volume2,
  ChevronRight, ArrowLeft, RotateCcw, Sliders, ScrollText, Printer,
  Lock, Unlock
} from 'lucide-react';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface TabItem {
  id: string;
  title: string;
  artist?: string;
  chart?: ChartData;
}

interface Props {
  initialChart: ChartData;
  folderId?: string | null;
  onLeaderStart?: (code: string) => void;
  onFollowStart?: (code: string) => void;
}

// ── Inner chart zoom reset wrapper ──────────────────────────────────────────────
function ChartContentWrapper({ 
  chart, 
  selectedFont, 
  chordColor,
  showUI = true,
  onBaseScaleChange,
}: { 
  chart: ChartData; 
  selectedFont: string; 
  chordColor: string;
  showUI?: boolean;
  onBaseScaleChange?: (scale: number) => void;
}) {
  const { setTransform, instance } = useControls();
  const isInitialFitRef = useRef(true);

  const fitToScreen = useCallback(() => {
    const cardEl = document.getElementById('piascore-chart-card');
    const wrapper = instance.wrapperComponent;
    if (!cardEl || !wrapper) return;

    const viewportWidth = wrapper.clientWidth;
    const viewportHeight = wrapper.clientHeight;
    // Real full scroll dimensions of the chord chart card
    const cardWidth = Math.max(cardEl.scrollWidth, cardEl.offsetWidth);
    const cardHeight = Math.max(cardEl.scrollHeight, cardEl.offsetHeight);

    const { scale, posX, posY, effectiveMinScale } = calculateScoreFit({
      viewportWidth,
      viewportHeight,
      cardWidth,
      cardHeight,
      showUI,
    });

    if (instance.setup) {
      instance.setup.minScale = effectiveMinScale;
    }
    if (onBaseScaleChange) {
      onBaseScaleChange(effectiveMinScale);
    }

    const animDuration = isInitialFitRef.current ? 0 : 200;
    isInitialFitRef.current = false;

    setTransform(posX, posY, scale, animDuration);
  }, [instance, setTransform, onBaseScaleChange, showUI]);

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
    window.addEventListener('piascore-fit-screen', runFit);
    window.addEventListener('chord-grid-font-change', runFit);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', runFit);
      window.removeEventListener('orientationchange', runFit);
      window.removeEventListener('piascore-fit-screen', runFit);
      window.removeEventListener('chord-grid-font-change', runFit);
    };
  }, [fitToScreen, chart.id, showUI]);

  return <ChartRenderer chart={chart} selectedFont={selectedFont} chordColor={chordColor} id="piascore-chart-card" />;
}

export function PiascoreReader({ initialChart, folderId, onLeaderStart, onFollowStart }: Props) {
  const router = useRouter();
  const { profile } = useAuth();
  const canEditChart = canModifySection(profile?.profession, 'chart');

  // Minimum zoom scale constrained to default fitted size so zooming out beyond default size is impossible
  const [minZoomScale, setMinZoomScale] = useState<number>(1);

  // ── Open Tabs State ─────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: initialChart.id,
      title: initialChart.title || 'Untitled',
      artist: initialChart.custom_text || 'Composer',
      chart: initialChart,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(initialChart.id);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);

  // Active chart calculation
  const activeTab = tabs.find((t) => t.id === activeTabId) || (tabs.length > 0 ? tabs[0] : null);
  const [currentChart, setCurrentChart] = useState<ChartData | null>(
    activeTab?.chart || initialChart
  );

  // Load chart when active tab changes
  useEffect(() => {
    if (!activeTab) {
      setCurrentChart(null);
      return;
    }
    if (activeTab.chart) {
      setCurrentChart(activeTab.chart);
    } else {
      readChart(activeTab.id).then((data) => {
        if (data) {
          const c = data as ChartData;
          setCurrentChart(c);
          setTabs((prev) =>
            prev.map((t) => (t.id === c.id ? { ...t, chart: c, title: c.title } : t))
          );
        }
      });
    }
  }, [activeTabId, activeTab]);

  // Real-time live update: reflect chart edits made by admin or others across devices immediately
  useEffect(() => {
    if (!activeTabId) return;
    const channel = supabase
      .channel(`piascore-chart-live-${activeTabId}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'charts', filter: `id=eq.${activeTabId}` },
        (payload: any) => {
          if (payload.new) {
            const updated = payload.new as ChartData;
            setCurrentChart(updated);
            setTabs((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, chart: updated, title: updated.title } : t))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTabId]);

  // ── UI Auto-hide / Header Toggle ────────────────────────────────────────────
  const [showUI, setShowUI] = useState(true);
  const [isStageLocked, setIsStageLocked] = useState(false);
  const [lockToast, setLockToast] = useState<string | null>(null);
  const lockToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showLockNotification = (msg: string) => {
    setLockToast(msg);
    if (lockToastTimerRef.current) clearTimeout(lockToastTimerRef.current);
    lockToastTimerRef.current = setTimeout(() => setLockToast(null), 2200);
  };

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
  
  const closeAllPopups = () => {
    setIsBookmarkOpen(false);
    setIsAdjustOpen(false);
    setIsPageOverviewOpen(false);
    setIsInfoOpen(false);
    setIsMetronomeOpen(false);
  };

  const handleCanvasClick = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      return;
    }
    if (isStageLocked) {
      // In stage lock mode, ignore canvas taps to prevent accidental popups on stage
      showLockNotification('Screen is locked (Tap 🔒 in top-right to unlock)');
      return;
    }
    if (tabs.length === 0) {
      return;
    }
    const hasOpenPopup = isBookmarkOpen || isAdjustOpen || isPageOverviewOpen || isInfoOpen || isMetronomeOpen;
    if (hasOpenPopup) {
      closeAllPopups();
      return;
    }
    setShowUI((prev) => {
      if (prev) closeAllPopups();
      return !prev;
    });
  };
  const toggleUI = handleCanvasClick;

  // ── Page Position / Line Slider ─────────────────────────────────────────────
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const totalLines = currentChart?.lines?.length || 0;

  // ── Metronome State & Engine ────────────────────────────────────────────────
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false);
  const [bpm, setBpm] = useState<number>(currentChart?.tempo || 120);
  const [timeSig, setTimeSig] = useState<string>(currentChart?.time_sig || '4/4');
  const [isPlayingMetronome, setIsPlayingMetronome] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync tempo when chart changes
  useEffect(() => {
    if (currentChart?.tempo) setBpm(currentChart.tempo);
    if (currentChart?.time_sig) setTimeSig(currentChart.time_sig);
  }, [currentChart]);

  const beatsPerMeasure = parseInt(timeSig.split('/')[0]) || 4;

  const playClick = useCallback((isFirstBeat: boolean) => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isFirstBeat ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(isFirstBeat ? 1000 : 700, ctx.currentTime);

      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.log('Metronome audio error:', e);
    }
  }, []);

  useEffect(() => {
    if (isPlayingMetronome) {
      const intervalMs = (60 / bpm) * 1000;
      let beatCounter = 0;
      playClick(true);
      setCurrentBeat(0);

      timerRef.current = setInterval(() => {
        beatCounter = (beatCounter + 1) % beatsPerMeasure;
        setCurrentBeat(beatCounter);
        playClick(beatCounter === 0);
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCurrentBeat(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlayingMetronome, bpm, beatsPerMeasure, playClick]);

  // ── Modals State ─────────────────────────────────────────────────────────────
  const [isBookmarkOpen, setIsBookmarkOpen] = useState(false);
  const [bookmarksList, setBookmarksList] = useState<any[]>([]);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncJoinCodeInput, setSyncJoinCodeInput] = useState('');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isPageOverviewOpen, setIsPageOverviewOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Settings
  const [selectedFont, setSelectedFont] = useState('system');
  const [chordColor, setChordColor] = useState('#0f172a');

  useEffect(() => {
    const handleFontChange = () => {
      const saved = localStorage.getItem('chord-grid-font');
      if (saved) setSelectedFont(saved);
    };
    handleFontChange();
    const savedColor = localStorage.getItem('chord-grid-chord-color');
    if (savedColor) setChordColor(savedColor);

    window.addEventListener('chord-grid-font-change', handleFontChange);
    return () => window.removeEventListener('chord-grid-font-change', handleFontChange);
  }, []);

  // Load bookmarks list
  const refreshBookmarks = async () => {
    const list = await getBookmarks();
    setBookmarksList(list.filter((b) => b.type === 'chart'));
  };

  useEffect(() => {
    refreshBookmarks();
  }, []);

  // Transpose helper
  const handleTranspose = (delta: number) => {
    if (!currentChart) return;
    const updated = transposeChart(currentChart, delta, currentChart.prefer_flats);
    setCurrentChart(updated);
    setTabs((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, chart: updated } : t))
    );
  };

  // Add / Switch open tabs
  const handleAddPickedSongs = async (pickedItems: PickedItem[]) => {
    let lastAddedId: string | null = null;
    const newTabsToAdd: TabItem[] = [];

    for (const item of pickedItems) {
      if (item.item_type === 'chart') {
        const existing = tabs.find((t) => t.id === item.item_id);
        if (existing) {
          lastAddedId = existing.id;
        } else {
          const chartData = await readChart(item.item_id);
          const newTab: TabItem = {
            id: item.item_id,
            title: item.title,
            chart: chartData as ChartData,
          };
          newTabsToAdd.push(newTab);
          lastAddedId = newTab.id;
        }
      }
    }

    if (newTabsToAdd.length > 0) {
      setTabs((prev) => [...prev, ...newTabsToAdd]);
    }
    if (lastAddedId) {
      setActiveTabId(lastAddedId);
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (isStageLocked) return;

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);

    if (activeTabId === tabId) {
      if (nextTabs.length > 0) {
        // Nearest remaining tab becomes active:
        // prefer right neighbor (same index now pointing to right neighbor), or last tab
        const nextActive = nextTabs[tabIndex] || nextTabs[nextTabs.length - 1];
        setActiveTabId(nextActive.id);
      } else {
        setActiveTabId('');
      }
    }
  };

  // Bookmark toggle & opening in tab
  const handleAddCurrentBookmark = async () => {
    if (!currentChart) return;
    const isBookmarked = bookmarksList.some((b) => b.id === currentChart.id);
    await toggleBookmark(currentChart.id, 'chart', !isBookmarked);
    await refreshBookmarks();
  };

  const handleOpenBookmarkInTab = async (bm: any) => {
    const existingTab = tabs.find((t) => t.id === bm.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const c = await readChart(bm.id);
      if (c) {
        const chartData = c as ChartData;
        const newTab: TabItem = {
          id: chartData.id,
          title: chartData.title || 'Untitled',
          artist: chartData.custom_text || 'Composer',
          chart: chartData,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    }
    setIsBookmarkOpen(false);
  };

  // Leader / Follow session trigger
  const handleStartLeader = () => {
    const code = Math.random().toString(36).substr(2, 6).toUpperCase();
    sessionStorage.setItem(
      `perform-leader-${code}`,
      JSON.stringify({
        chartIds: tabs.map((t) => t.id),
        sessionName: currentChart?.title || 'Live Performance',
      })
    );
    try {
      localStorage.setItem(
        `perform-active-session-${code}`,
        JSON.stringify({
          chartIds: tabs.map((t) => t.id),
          sessionName: currentChart?.title || 'Live Performance',
          createdAt: Date.now()
        })
      );
    } catch {}
    setIsSyncModalOpen(false);
    if (onLeaderStart) {
      onLeaderStart(code);
    } else {
      router.push(`/perform/stage?code=${code}`);
    }
  };

  const handleStartFollow = () => {
    const c = syncJoinCodeInput.trim().toUpperCase();
    if (c.length === 6) {
      setIsSyncModalOpen(false);
      if (onFollowStart) {
        onFollowStart(c);
      } else {
        router.push(`/perform/stage?code=${c}`);
      }
    }
  };

  // ── Screen Wake Lock (Ensures screen never dims on stage) ──────────────────
  useScreenWakeLock(true);

  // ── Android Hardware Back Button & Popstate Navigation ────────────────────
  const hasAnyModalOpen =
    isSongPickerOpen ||
    isBookmarkOpen ||
    isSyncModalOpen ||
    isAdjustOpen ||
    isPageOverviewOpen ||
    isInfoOpen ||
    isMetronomeOpen;

  const handleDismissTopModal = useCallback(() => {
    if (isSongPickerOpen) {
      setIsSongPickerOpen(false);
    } else if (isSyncModalOpen) {
      setIsSyncModalOpen(false);
    } else {
      closeAllPopups();
    }
  }, [isSongPickerOpen, isSyncModalOpen]);

  useHardwareBackButton({
    enabled: hasAnyModalOpen,
    onBack: handleDismissTopModal,
    stateKey: 'chordly_reader_modal',
  });

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#0F1015] text-[#F4F2F0] flex flex-col overflow-hidden select-none font-sans relative">
      {/* ── Soft warm radial glow in top-left corner ──────────────────────── */}
      <div 
        className="absolute top-0 left-0 w-[500px] h-[500px] sm:w-[700px] sm:h-[700px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at 0% 0%, #26150F 0%, rgba(38, 21, 15, 0.45) 45%, transparent 75%)',
        }}
      />

      {/* ── FLOATING TOP-RIGHT STAGE CONTROLS (Always accessible even when UI is hidden) ── */}
      <div className="fixed top-[calc(0.65rem+env(safe-area-inset-top,0px))] right-3 sm:right-5 z-[60] flex items-center gap-2 select-none no-print">
        {/* Quick Transpose Pill: enables changing chords / key without popping up editing menus */}
        {currentChart && (
          <div className="flex items-center bg-[#14141A]/90 backdrop-blur-md border border-[#2A2A31] rounded-full p-0.5 shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTranspose(-1);
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs text-[#8C8A93] hover:text-[#F4F2F0] hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              title="Transpose down 1 semitone"
              aria-label="Transpose down"
            >
              ♭
            </button>
            <span className="px-1.5 text-[11px] sm:text-xs font-mono font-bold text-[#FF6A1F] min-w-[32px] text-center">
              {currentChart.semitone_offset === 0
                ? 'Orig'
                : `${currentChart.semitone_offset > 0 ? '+' : ''}${currentChart.semitone_offset}`}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTranspose(1);
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs text-[#8C8A93] hover:text-[#F4F2F0] hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              title="Transpose up 1 semitone"
              aria-label="Transpose up"
            >
              ♯
            </button>
          </div>
        )}

        {/* Lock Screen Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsStageLocked((prev) => {
              const next = !prev;
              if (next) {
                setShowUI(false);
                closeAllPopups();
                showLockNotification('Stage Lock ON · Accidental taps disabled');
              } else {
                showLockNotification('Stage Lock OFF · Tap screen to show options');
              }
              return next;
            });
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs shadow-[0_4px_16px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all active:scale-95 cursor-pointer border ${
            isStageLocked
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/40'
              : 'bg-[#14141A]/90 text-[#8C8A93] border-[#2A2A31] hover:text-[#F4F2F0] hover:border-[#3E3E48]'
          }`}
          title={
            isStageLocked
              ? 'Screen Locked: accidental taps will not open editing options. Scrolling & transpose enabled. Tap to unlock.'
              : 'Lock Screen: prevent editing options from popping up accidentally while scrolling'
          }
          aria-label={isStageLocked ? 'Unlock screen' : 'Lock screen'}
        >
          {isStageLocked ? (
            <>
              <Lock size={15} className="text-amber-400 stroke-[2.5]" />
              <span className="font-semibold text-amber-400">Locked</span>
            </>
          ) : (
            <>
              <Unlock size={15} className="stroke-[2.2]" />
              <span className="font-semibold text-[#8C8A93]">Lock</span>
            </>
          )}
        </button>
      </div>

      {/* ── STAGE LOCK TOAST NOTIFICATION ───────────────────────────────── */}
      {lockToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] bg-[#1A1A20]/95 backdrop-blur-md border border-amber-500/40 text-amber-300 px-4 py-2 rounded-full text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.8)] flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <Lock size={14} className="text-amber-400 shrink-0" />
          <span>{lockToast}</span>
        </div>
      )}

      {/* ── 1. TOP HEADER (Centered Title, Synchronized Sliding) ─────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-[#0F1015]/85 backdrop-blur-2xl border-b border-[#2A2A31] flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)] h-[calc(3.5rem+env(safe-area-inset-top,0px))] transition-transform duration-300 ${
          showUI ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        {/* Left spacer to ensure center alignment */}
        <div className="w-10 shrink-0" />

        {/* Center: Song Title & Composer / Subtitle */}
        <div className="flex flex-col items-center justify-center text-center max-w-[55vw] sm:max-w-[65vw]">
          <h1 className="text-sm sm:text-base font-bold text-[#F4F2F0] truncate tracking-tight">
            {currentChart ? (currentChart.title || 'Untitled') : 'No Song Open'}
            {currentChart && totalLines > 0 ? ` (${currentLineIndex + 1}/${totalLines})` : ''}
          </h1>
          <p className="text-[11px] text-[#8C8A93] truncate">
            {currentChart
              ? currentChart.custom_text || (currentChart.tempo ? `Chord score · ${currentChart.tempo} BPM` : 'Chord score')
              : 'Chordly Reader'}
          </p>
        </div>

        {/* Right spacer for top-right floating stage controls */}
        <div className="w-28 sm:w-36 shrink-0" />
      </header>

      {/* ── 2. DOCUMENT TAB NAVIGATION BAR (Below Header) ──────────────────── */}
      <nav
        className={`fixed top-[calc(3.5rem+env(safe-area-inset-top,0px))] left-0 right-0 z-40 bg-[#0F1015]/75 backdrop-blur-2xl border-b border-[#2A2A31] flex items-center px-3 h-12 gap-2 overflow-x-auto scrollbar-none transition-transform duration-300 ${
          showUI ? 'translate-y-0' : '-translate-y-[calc(6.5rem+env(safe-area-inset-top,0px))]'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group relative flex items-center gap-1.5 pl-3.5 pr-1 py-1 text-xs font-semibold rounded-[24px] cursor-pointer transition-all shrink-0 max-w-[200px] border ${
                isActive
                  ? 'bg-[#1A1A20] text-[#F4F2F0] border-[#FF6A1F] shadow-[0_0_12px_rgba(255,106,31,0.2)]'
                  : 'bg-[#1A1A20] text-[#8C8A93] border-[#2A2A31] hover:text-[#F4F2F0] hover:border-[#3E3E48]'
              }`}
            >
              <span className="truncate flex-1 select-none">{tab.title}</span>

              {/* Close Button inside EVERY tab with touch target >= 32px */}
              <button
                type="button"
                disabled={isStageLocked}
                onClick={(e) => handleCloseTab(e, tab.id)}
                className={`w-8 h-8 min-w-[32px] min-h-[32px] rounded-full flex items-center justify-center transition-all ${
                  isStageLocked
                    ? 'opacity-30 cursor-not-allowed text-[#8C8A93]'
                    : 'text-[#8C8A93] hover:text-[#F4F2F0] hover:bg-white/10 active:scale-90 cursor-pointer'
                }`}
                title={isStageLocked ? 'Closing disabled while screen is locked' : `Close ${tab.title}`}
                aria-label={`Close ${tab.title}`}
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </div>
          );
        })}

        {/* Plus Tab Button at the end of tab strip */}
        <button
          type="button"
          onClick={() => setIsSongPickerOpen(true)}
          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center text-[#FF6A1F] hover:bg-[#FF6A1F]/15 rounded-full transition-all shrink-0 cursor-pointer active:scale-90"
          title="Open song in new tab"
          aria-label="Open song in new tab"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </nav>

      {/* ── 3. FLOATING LEFT METRONOME TAB BUTTON ────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsMetronomeOpen((prev) => !prev)}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-[#1A1A20] border border-l-0 border-[#2A2A31] shadow-[0_4px_20px_rgba(0,0,0,0.5)] rounded-r-[24px] px-2 py-3.5 flex flex-col items-center gap-2 hover:px-2.5 transition-all cursor-pointer ${
          showUI ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
        }`}
        title="Toggle Metronome"
        aria-label="Toggle Metronome"
      >
        <Volume2 size={16} className={`text-[#FF6A1F] ${isPlayingMetronome ? 'animate-bounce' : ''}`} />
        <span
          className="text-[9px] font-bold tracking-widest uppercase text-[#8C8A93]"
          style={{ writingMode: 'vertical-rl' }}
        >
          Metronome
        </span>
      </button>

      {/* ── METRONOME CONTROL DRAWER ──────────────────────────────────────── */}
      {isMetronomeOpen && (
        <div className="fixed left-12 top-1/2 -translate-y-1/2 z-50 w-72 bg-[#1A1A20] border border-[#2A2A31] shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-[24px] p-4 flex flex-col gap-3.5 text-[#F4F2F0]">
          <div className="flex items-center justify-between border-b border-[#2A2A31] pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#F4F2F0]">
              <Volume2 size={16} className="text-[#FF6A1F]" /> Metronome
            </h3>
            <button
              onClick={() => setIsMetronomeOpen(false)}
              className="p-1 text-[#8C8A93] hover:text-[#F4F2F0] rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Visual Beat Indicator Dots */}
          <div className="flex justify-center items-center gap-2 py-1">
            {Array.from({ length: beatsPerMeasure }).map((_, idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all ${
                  isPlayingMetronome && currentBeat === idx
                    ? idx === 0
                      ? 'bg-rose-500 scale-125 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                      : 'bg-[#FF6A1F] scale-110 shadow-[0_0_8px_rgba(255,106,31,0.8)]'
                    : 'bg-[#2E2E38]'
                }`}
              />
            ))}
          </div>

          {/* BPM Display & Buttons */}
          <div className="flex items-center justify-between bg-[#14141A] border border-[#2A2A31] p-3 rounded-[20px]">
            <button
              onClick={() => setBpm((b) => Math.max(30, b - 5))}
              className="w-9 h-9 rounded-full bg-[#24242C] hover:bg-[#2E2E38] font-bold text-[#F4F2F0] active:scale-95 transition-all"
            >
              -5
            </button>
            <div className="text-center">
              <span className="text-2xl font-extrabold text-[#F4F2F0] font-mono">
                {bpm}
              </span>
              <span className="block text-[9px] font-bold text-[#8C8A93] uppercase">BPM</span>
            </div>
            <button
              onClick={() => setBpm((b) => Math.min(260, b + 5))}
              className="w-9 h-9 rounded-full bg-[#24242C] hover:bg-[#2E2E38] font-bold text-[#F4F2F0] active:scale-95 transition-all"
            >
              +5
            </button>
          </div>

          {/* Time Signature Options */}
          <div className="flex items-center justify-between gap-1.5 text-xs">
            {['4/4', '3/4', '6/8', '2/4'].map((ts) => (
              <button
                key={ts}
                onClick={() => setTimeSig(ts)}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all ${
                  timeSig === ts
                    ? 'bg-[#FF6A1F] text-white shadow-[0_2px_8px_rgba(255,106,31,0.4)]'
                    : 'bg-[#14141A] border border-[#2A2A31] text-[#8C8A93] hover:text-[#F4F2F0]'
                }`}
              >
                {ts}
              </button>
            ))}
          </div>

          {/* Play / Stop Button */}
          <button
            onClick={() => setIsPlayingMetronome((p) => !p)}
            className="w-full py-2.5 rounded-full font-bold flex items-center justify-center gap-2 text-white bg-gradient-to-r from-[#FF6A1F] to-[#EE1D52] shadow-[0_4px_16px_rgba(255,106,31,0.35)] hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            {isPlayingMetronome ? (
              <>
                <Pause size={18} /> Stop Metronome
              </>
            ) : (
              <>
                <Play size={18} /> Start Metronome
              </>
            )}
          </button>
        </div>
      )}

      {/* ── 4. MAIN SCORE READER CANVAS OR EMPTY STATE ─────────────────────── */}
      <main
        className={`flex-1 w-full h-full relative overflow-hidden flex items-stretch justify-center cursor-pointer select-none transition-[padding] duration-300 ${
          showUI
            ? 'pt-[calc(6.5rem+env(safe-area-inset-top,0px))]'
            : 'pt-[max(0.5rem,env(safe-area-inset-top,0px))]'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={toggleUI}
        onWheel={(e) => {
          if (isStageLocked) return;
          // Auto-hide UI on scroll down
          if (e.deltaY > 15 && showUI) {
            setShowUI(false);
          }
        }}
      >
        {tabs.length === 0 ? (
          /* Empty state when last tab is closed */
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 w-full flex flex-col items-center justify-center p-6 text-center z-10"
          >
            <div className="w-16 h-16 rounded-[24px] bg-[#1A1A20] border border-[#2A2A31] flex items-center justify-center mb-4 shadow-xl">
              <BookOpen size={28} className="text-[#FF6A1F]" />
            </div>
            <h2 className="text-xl font-bold text-[#F4F2F0] mb-2 tracking-tight">No song open</h2>
            <p className="text-xs text-[#8C8A93] max-w-xs mb-6 leading-relaxed">
              All tabs have been closed. Open a song from your catalog to view chord progressions and bar charts.
            </p>
            <button
              type="button"
              onClick={() => setIsSongPickerOpen(true)}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#EE1D52] text-white font-bold text-sm shadow-[0_4px_16px_rgba(255,106,31,0.35)] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>Open a song</span>
            </button>
          </div>
        ) : currentChart ? (
          <TransformWrapper
            initialScale={minZoomScale}
            minScale={minZoomScale}
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
            onPanning={(ref) => {
              if (isStageLocked) return;
              // Auto-hide UI when user pans down past top
              if (ref.state.positionY < -20 && showUI) {
                setShowUI(false);
              }
            }}
            pinch={{
              step: 5,
              disabled: false,
              allowPanning: true,
            }}
            doubleClick={{ disabled: true }}
          >
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="w-max flex flex-col items-start justify-start"
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleUI();
                }}
                className="w-fit max-w-none flex flex-col items-start justify-start"
              >
                <ChartContentWrapper
                  chart={currentChart}
                  selectedFont={selectedFont}
                  chordColor={chordColor}
                  showUI={showUI}
                  onBaseScaleChange={setMinZoomScale}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        ) : null}
      </main>

      {/* ── 5. FLOATING BOTTOM ACTION TOOLBAR ──────────────────────────────── */}
      <footer
        className={`fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] left-[14px] right-[14px] max-w-[500px] mx-auto z-50 bg-[#14141A] border border-[#2E2E36] rounded-[30px] shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center justify-around h-16 px-3 transition-transform duration-300 ${
          showUI ? 'translate-y-0' : 'translate-y-[calc(100%+32px)]'
        }`}
      >
        {/* Button 1: Bookmark */}
        <button
          onClick={() => {
            setIsBookmarkOpen((p) => !p);
            setIsAdjustOpen(false);
            setIsPageOverviewOpen(false);
            setIsInfoOpen(false);
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all active:scale-95 cursor-pointer ${
            isBookmarkOpen ? 'text-[#FF6A1F]' : 'text-[#8C8A93] hover:text-[#F4F2F0]'
          }`}
        >
          <BookmarkIcon size={20} className={isBookmarkOpen ? 'fill-[#FF6A1F]' : ''} />
          <span>Bookmark</span>
        </button>

        {/* Button 2: Adjust Page */}
        <button
          onClick={() => {
            setIsAdjustOpen((p) => !p);
            setIsBookmarkOpen(false);
            setIsPageOverviewOpen(false);
            setIsInfoOpen(false);
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all active:scale-95 cursor-pointer ${
            isAdjustOpen ? 'text-[#FF6A1F]' : 'text-[#8C8A93] hover:text-[#F4F2F0]'
          }`}
        >
          <Crop size={20} />
          <span>Adjust Page</span>
        </button>

        {/* Button 3: Page */}
        <button
          onClick={() => {
            setIsPageOverviewOpen((p) => !p);
            setIsBookmarkOpen(false);
            setIsAdjustOpen(false);
            setIsInfoOpen(false);
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all active:scale-95 cursor-pointer ${
            isPageOverviewOpen ? 'text-[#FF6A1F]' : 'text-[#8C8A93] hover:text-[#F4F2F0]'
          }`}
        >
          <LayoutGrid size={20} />
          <span>Page</span>
        </button>

        {/* Button 4: Info */}
        <button
          onClick={() => {
            setIsInfoOpen((p) => !p);
            setIsBookmarkOpen(false);
            setIsAdjustOpen(false);
            setIsPageOverviewOpen(false);
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all active:scale-95 cursor-pointer ${
            isInfoOpen ? 'text-[#FF6A1F]' : 'text-[#8C8A93] hover:text-[#F4F2F0]'
          }`}
        >
          <Info size={20} />
          <span>Info</span>
        </button>

        {/* Button 5: Writing */}
        {canEditChart && currentChart && (
          <button
            onClick={() => router.push(`/chart/edit?id=${currentChart.id}`)}
            className="flex flex-col items-center gap-1 text-[10px] font-semibold text-[#8C8A93] hover:text-[#FF6A1F] transition-all active:scale-95 cursor-pointer"
          >
            <Edit3 size={20} />
            <span>Writing</span>
          </button>
        )}
      </footer>

      {/* ── 6. BOOKMARK POPOVER MODAL ─────────────────────────────────────── */}
      {isBookmarkOpen && (
        <div className="fixed bottom-24 left-4 z-50 w-80 max-w-[90vw] bg-[#1A1A20] border border-[#2A2A31] shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-[24px] overflow-hidden flex flex-col max-h-96 animate-in slide-in-from-bottom-2 duration-200 text-[#F4F2F0]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A31] bg-[#14141A]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBookmarkOpen(false)}
                className="p-1 text-[#FF6A1F] hover:bg-white/5 rounded-lg"
              >
                <BookOpen size={18} />
              </button>
              <button className="p-1 text-[#FF6A1F] hover:bg-white/5 rounded-lg">
                <ArrowUpDown size={18} />
              </button>
            </div>
            <h2 className="text-sm font-bold text-[#F4F2F0]">Bookmark</h2>
            <button
              onClick={handleAddCurrentBookmark}
              className={`p-1 rounded-lg active:scale-95 transition-all ${
                currentChart && bookmarksList.some((b) => b.id === currentChart.id)
                  ? 'text-[#FF6A1F] bg-[#FF6A1F]/15 font-bold'
                  : 'text-[#FF6A1F] hover:bg-white/5'
              }`}
              title={
                currentChart && bookmarksList.some((b) => b.id === currentChart.id)
                  ? 'Remove from bookmarks'
                  : 'Add to bookmarks'
              }
            >
              <Plus
                size={20}
                className={
                  currentChart && bookmarksList.some((b) => b.id === currentChart.id)
                    ? 'rotate-45 transition-transform'
                    : ''
                }
              />
            </button>
          </div>

          {/* List of bookmarks */}
          <div className="overflow-y-auto p-2 divide-y divide-[#2A2A31]">
            {bookmarksList.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8C8A93]">
                No bookmarks added yet. Tap <Plus size={12} className="inline text-[#FF6A1F]" /> to bookmark this chart.
              </div>
            ) : (
              bookmarksList.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => handleOpenBookmarkInTab(bm)}
                  className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <BookmarkIcon size={16} className="text-[#FF6A1F] shrink-0 fill-[#FF6A1F]" />
                    <span className="text-xs font-bold text-[#F4F2F0] truncate">
                      {bm.title}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-[#8C8A93]" />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 7. SYNC PAGE TURNING MODAL ────────────────────────────────────── */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#1A1A20] border border-[#2A2A31] rounded-[24px] shadow-[0_16px_48px_rgba(0,0,0,0.85)] max-w-sm w-full p-6 text-center flex flex-col items-center gap-4 text-[#F4F2F0]">
            <h2 className="text-lg font-bold text-[#F4F2F0]">
              Sync page turning
            </h2>
            <p className="text-xs text-[#8C8A93] leading-relaxed">
              You can sync page turning between several devices.
              <br />
              (&quot;Follow&quot; follows &quot;Lead&quot;&apos;s page-turning)
            </p>

            {/* Input code for follow */}
            <input
              type="text"
              placeholder="Session code (e.g. ABC123)"
              maxLength={6}
              value={syncJoinCodeInput}
              onChange={(e) => setSyncJoinCodeInput(e.target.value.toUpperCase())}
              className="w-full text-center px-4 py-2.5 bg-[#14141A] border border-[#2A2A31] rounded-xl text-sm font-mono uppercase font-bold text-[#F4F2F0] focus:outline-none focus:border-[#FF6A1F]"
            />

            {/* Action Buttons Stack */}
            <div className="w-full flex flex-col gap-2.5 mt-2">
              <button
                onClick={handleStartLeader}
                className="w-full py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[#FF6A1F] to-[#EE1D52] shadow-[0_4px_16px_rgba(255,106,31,0.35)] hover:brightness-110 active:scale-95 transition-all"
              >
                Lead
              </button>
              <button
                onClick={handleStartFollow}
                disabled={syncJoinCodeInput.trim().length !== 6}
                className="w-full py-3 rounded-full text-sm font-bold text-[#F4F2F0] bg-[#24242C] border border-[#2E2E36] hover:bg-[#2E2E38] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Follow
              </button>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="w-full py-2 text-xs font-semibold text-[#8C8A93] hover:text-[#F4F2F0] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. ADJUST PAGE PANEL ─────────────────────────────────────────── */}
      {isAdjustOpen && currentChart && (
        <div className="fixed bottom-24 right-4 z-50 w-80 bg-[#1A1A20] border border-[#2A2A31] shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-[24px] p-4 flex flex-col gap-4 text-[#F4F2F0]">
          <div className="flex items-center justify-between border-b border-[#2A2A31] pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#F4F2F0]">
              <Crop size={16} className="text-[#FF6A1F]" /> Display & Scroll Mode
            </h3>
            <button
              onClick={() => setIsAdjustOpen(false)}
              className="p-1 text-[#8C8A93] hover:text-[#F4F2F0]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Fit to Screen */}
          <button
            onClick={() => {
              window.dispatchEvent(new Event('piascore-fit-screen'));
              setIsAdjustOpen(false);
            }}
            className="w-full py-2.5 px-3 bg-[#FF6A1F]/15 hover:bg-[#FF6A1F]/25 text-[#FF6A1F] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <RotateCcw size={14} /> Fit Chart to Screen
          </button>

          {/* 1-Page Print Action */}
          <button
            onClick={() => {
              setIsAdjustOpen(false);
              setTimeout(() => window.print(), 100);
            }}
            className="w-full py-2.5 px-3 bg-[#24242C] border border-[#2E2E36] hover:bg-[#2E2E38] text-[#F4F2F0] rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <Printer size={14} className="text-[#FF6A1F]" /> Print Chart (1 Page)
          </button>

          {/* Transpose Key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#8C8A93] uppercase">Transpose Key</label>
            <div className="flex items-center justify-between bg-[#14141A] border border-[#2A2A31] p-2 rounded-[18px]">
              <button
                onClick={() => handleTranspose(-1)}
                className="w-9 h-9 rounded-full bg-[#24242C] hover:bg-[#2E2E38] font-bold text-[#F4F2F0] active:scale-95 text-lg"
              >
                -
              </button>
              <span className="text-xs font-mono font-bold text-[#FF6A1F]">
                {currentChart.semitone_offset === 0
                  ? 'Original'
                  : `${currentChart.semitone_offset > 0 ? '+' : ''}${currentChart.semitone_offset} semitones`}
              </span>
              <button
                onClick={() => handleTranspose(1)}
                className="w-9 h-9 rounded-full bg-[#24242C] hover:bg-[#2E2E38] font-bold text-[#F4F2F0] active:scale-95 text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Font Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#8C8A93] uppercase">Font Style</label>
            <select
              value={selectedFont}
              onChange={(e) => {
                const f = e.target.value;
                setSelectedFont(f);
                localStorage.setItem('chord-grid-font', f);
                window.dispatchEvent(new Event('chord-grid-font-change'));
              }}
              className="w-full p-2.5 bg-[#14141A] border border-[#2A2A31] rounded-xl text-xs font-semibold text-[#F4F2F0] outline-none"
            >
              <option value="system">Plus Jakarta Sans (Default)</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
              <option value="Consolas, monospace">Consolas</option>
              <option value="'Cascadia Code', monospace">Cascadia Code</option>
              <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Apple SF Mono</option>
            </select>
          </div>

          {/* Part Name & Chord Color */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#8C8A93] uppercase">Part Name & Chord Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Ink', color: '#0f172a' },
                { label: 'Orange', color: '#FF6A1F' },
                { label: 'Rose', color: '#D1366B' },
                { label: 'Purple', color: '#7A4FD6' },
                { label: 'Teal', color: '#0F9D8A' },
                { label: 'Amber', color: '#C98A0C' },
                { label: 'Slate', color: '#475569' },
              ].map(({ label, color }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() => {
                    setChordColor(color);
                    localStorage.setItem('chord-grid-chord-color', color);
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all active:scale-90 ${
                    chordColor === color
                      ? 'border-white scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 9. PAGE GRID OVERVIEW PANEL ──────────────────────────────────── */}
      {isPageOverviewOpen && currentChart && (
        <div className="fixed bottom-24 right-4 z-50 w-80 bg-[#1A1A20] border border-[#2A2A31] shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-[24px] p-4 flex flex-col gap-3 text-[#F4F2F0]">
          <div className="flex items-center justify-between border-b border-[#2A2A31] pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#F4F2F0]">
              <LayoutGrid size={16} className="text-[#FF6A1F]" /> Section Overview
            </h3>
            <button
              onClick={() => setIsPageOverviewOpen(false)}
              className="p-1 text-[#8C8A93] hover:text-[#F4F2F0]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
            {currentChart.lines?.map((line: any, idx: number) => (
              <button
                key={line.id || idx}
                onClick={() => {
                  setCurrentLineIndex(idx);
                  setIsPageOverviewOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  currentLineIndex === idx
                    ? 'border-[#FF6A1F] bg-[#FF6A1F]/15 text-[#FF6A1F] font-bold'
                    : 'border-[#2A2A31] bg-[#14141A] text-[#8C8A93] hover:text-[#F4F2F0]'
                }`}
              >
                <span className="text-[10px] uppercase font-bold opacity-75">
                  Section {idx + 1}
                </span>
                <span className="text-xs truncate font-semibold">
                  {line.label || `Line ${idx + 1}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 10. INFO PANEL ──────────────────────────────────────────────── */}
      {isInfoOpen && currentChart && (
        <div className="fixed bottom-24 right-4 z-50 w-72 bg-[#1A1A20] border border-[#2A2A31] shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-[24px] p-4 flex flex-col gap-3 text-[#F4F2F0]">
          <div className="flex items-center justify-between border-b border-[#2A2A31] pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#F4F2F0]">
              <Info size={16} className="text-[#FF6A1F]" /> Score Details
            </h3>
            <button
              onClick={() => setIsInfoOpen(false)}
              className="p-1 text-[#8C8A93] hover:text-[#F4F2F0]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#2A2A31]">
              <span className="text-[#8C8A93]">Title:</span>
              <span className="font-bold text-[#F4F2F0]">{currentChart.title || 'Untitled'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#2A2A31]">
              <span className="text-[#8C8A93]">Tempo:</span>
              <span className="font-mono font-bold text-[#F4F2F0]">{currentChart.tempo || 120} BPM</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#2A2A31]">
              <span className="text-[#8C8A93]">Time Signature:</span>
              <span className="font-mono font-bold text-[#F4F2F0]">{currentChart.time_sig || '4/4'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#2A2A31]">
              <span className="text-[#8C8A93]">Sections / Lines:</span>
              <span className="font-bold text-[#F4F2F0]">{totalLines}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#8C8A93]">Key Offset:</span>
              <span className="font-mono font-bold text-[#FF6A1F]">
                {currentChart.semitone_offset === 0 ? 'Original' : `${currentChart.semitone_offset} semitones`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 11. SONG PICKER MODAL (Add Tab) ─────────────────────────────── */}
      <SongPickerModal
        isOpen={isSongPickerOpen}
        onClose={() => setIsSongPickerOpen(false)}
        onAdd={handleAddPickedSongs}
        existingIds={tabs.map((t) => t.id)}
      />
    </div>
  );
}

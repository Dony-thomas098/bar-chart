'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Lyric, readLyrics } from '@/lib/lyrics';
import { supabase } from '@/lib/supabase';
import { SongPickerModal, PickedItem } from '@/components/SongPickerModal';
import { toggleBookmark, getBookmarks } from '@/lib/storage';
import { calculateScoreFit } from '@/lib/score-fit';
import { useAuth, canModifySection } from '@/components/AuthProvider';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import {
  FolderOpen, Smile, X, Plus, Play, Pause, Bookmark as BookmarkIcon,
  Crop, LayoutGrid, Info, Edit3, ArrowUpDown, BookOpen, Volume2,
  ChevronRight, Type, AlignLeft, AlignCenter, AlignRight, ScrollText,
  Lock, Unlock
} from 'lucide-react';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface TabItem {
  id: string;
  title: string;
  artist?: string;
  lyric?: Lyric;
}

interface Props {
  initialLyric: Lyric;
  folderId?: string | null;
}

// ── Inner lyrics card component (no zoom controls hook dependency) ─────────────────
function PlainLyricsCard({
  lyric,
  selectedFont,
  textColor,
  textAlign = 'center',
}: {
  lyric: Lyric;
  selectedFont: string;
  textColor: string;
  textAlign?: 'center' | 'left' | 'right';
}) {
  const paragraphs = lyric.body ? lyric.body.split('\n\n') : [];

  return (
    <div
      id="piascore-lyrics-card"
      className={`flex flex-col w-[min(94vw,760px)] min-w-[320px] p-6 sm:p-12 md:p-16 bg-white text-slate-900 shadow-2xl rounded-[24px] border border-slate-200/80 relative select-none min-h-[70vh] mx-auto my-0 ${
        textAlign === 'left' ? 'text-left items-start' : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'
      }`}
      style={{
        fontFamily:
          selectedFont && selectedFont !== 'system'
            ? selectedFont
            : 'var(--font-sans), sans-serif',
        color: textColor,
      }}
    >
      {/* Title Header */}
      <div className="flex flex-col items-center justify-center mb-8 pb-6 border-b border-slate-200 w-full">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center text-slate-900">
          {lyric.title || 'Untitled Lyrics'}
        </h1>
      </div>

      {/* Lyrics Body */}
      <div className={`flex flex-col gap-6 w-full font-medium text-lg sm:text-xl leading-relaxed whitespace-pre-wrap ${
        textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
      }`}>
        {paragraphs.map((stanza, idx) => (
          <div key={idx} className={`p-2 rounded-xl hover:bg-slate-50 transition-colors w-full ${
            textAlign === 'left' ? 'text-left' : textAlign === 'right' ? 'text-right' : 'text-center'
          }`}>
            {stanza}
          </div>
        ))}
      </div>
    </div>
  );
}

function LyricsContentWrapper({
  lyric,
  selectedFont,
  textColor,
  textAlign = 'center',
  showUI = true,
  onBaseScaleChange,
}: {
  lyric: Lyric;
  selectedFont: string;
  textColor: string;
  textAlign?: 'center' | 'left' | 'right';
  showUI?: boolean;
  onBaseScaleChange?: (scale: number) => void;
}) {
  const { setTransform, instance } = useControls();
  const isInitialFitRef = useRef(true);

  const fitLyrics = useCallback(() => {
    const cardEl = document.getElementById('piascore-lyrics-card');
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
      t1 = setTimeout(fitLyrics, 50);
      t2 = setTimeout(fitLyrics, 200);
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
  }, [fitLyrics, lyric.id, showUI]);

  return (
    <PlainLyricsCard
      lyric={lyric}
      selectedFont={selectedFont}
      textColor={textColor}
      textAlign={textAlign}
    />
  );
}

export function PiascoreLyricsReader({ initialLyric, folderId }: Props) {
  const router = useRouter();
  const { profile } = useAuth();
  const canEditLyrics = canModifySection(profile?.profession, 'lyrics');

  // ── Open Tabs State ─────────────────────────────────────────────────────────
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: initialLyric.id,
      title: initialLyric.title || 'Untitled',
      lyric: initialLyric,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(initialLyric.id);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);
  const [minZoomScale, setMinZoomScale] = useState<number>(1);

  // Active lyric calculation
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const [currentLyric, setCurrentLyric] = useState<Lyric>(
    activeTab?.lyric || initialLyric
  );

  // Load lyric when active tab changes
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab.lyric) {
      setCurrentLyric(activeTab.lyric);
    } else {
      readLyrics(activeTab.id).then((data) => {
        if (data) {
          const l = data as Lyric;
          setCurrentLyric(l);
          setTabs((prev) =>
            prev.map((t) => (t.id === l.id ? { ...t, lyric: l, title: l.title } : t))
          );
        }
      });
    }
  }, [activeTabId, activeTab]);

  // Real-time live update: reflect lyrics edits made by admin or others across devices immediately
  useEffect(() => {
    if (!activeTabId) return;
    const channel = supabase
      .channel(`piascore-lyrics-live-${activeTabId}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'lyrics', filter: `id=eq.${activeTabId}` },
        (payload: any) => {
          if (payload.new) {
            const updated = payload.new as Lyric;
            setCurrentLyric(updated);
            setTabs((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, lyric: updated, title: updated.title } : t))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTabId]);

  // ── UI Auto-hide / Popups Handler ──────────────────────────────────────────
  const [showUI, setShowUI] = useState(true);
  const [isStageLocked, setIsStageLocked] = useState(false);
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

  const [lockToast, setLockToast] = useState<string | null>(null);
  const lockToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showLockNotification = (msg: string) => {
    setLockToast(msg);
    if (lockToastTimerRef.current) clearTimeout(lockToastTimerRef.current);
    lockToastTimerRef.current = setTimeout(() => setLockToast(null), 2200);
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
    const hasOpenPopup =
      isBookmarkOpen ||
      isAdjustOpen ||
      isPageOverviewOpen ||
      isInfoOpen ||
      isMetronomeOpen;
    if (hasOpenPopup) {
      closeAllPopups();
      return;
    }
    setShowUI((prev) => {
      if (prev) closeAllPopups();
      return !prev;
    });
  };

  // ── Metronome State & Engine ────────────────────────────────────────────────
  const [isMetronomeOpen, setIsMetronomeOpen] = useState(false);
  const [bpm, setBpm] = useState<number>(120);
  const [timeSig, setTimeSig] = useState<string>('4/4');
  const [isPlayingMetronome, setIsPlayingMetronome] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
  const [textColor, setTextColor] = useState('#0f172a');
  const [textAlign, setTextAlign] = useState<'center' | 'left' | 'right'>('center');

  useEffect(() => {
    const handleFontChange = () => {
      const saved = localStorage.getItem('chord-grid-font');
      if (saved) setSelectedFont(saved);
    };
    handleFontChange();
    const savedColor = localStorage.getItem('chord-grid-lyrics-color');
    if (savedColor) setTextColor(savedColor);
    const savedAlign = localStorage.getItem('chord-grid-lyrics-align') as 'center' | 'left' | 'right';
    if (savedAlign) setTextAlign(savedAlign);

    window.addEventListener('chord-grid-font-change', handleFontChange);
    return () => window.removeEventListener('chord-grid-font-change', handleFontChange);
  }, []);

  // Load bookmarks list
  const refreshBookmarks = async () => {
    const list = await getBookmarks();
    setBookmarksList(list.filter((b) => b.type === 'lyrics'));
  };

  useEffect(() => {
    refreshBookmarks();
  }, []);

  // Add / Switch open tabs
  const handleAddPickedSongs = async (pickedItems: PickedItem[]) => {
    for (const item of pickedItems) {
      const existing = tabs.find((t) => t.id === item.item_id);
      if (existing) {
        setActiveTabId(existing.id);
      } else {
        const lyricData = await readLyrics(item.item_id);
        if (lyricData) {
          const newTab: TabItem = {
            id: item.item_id,
            title: item.title,
            lyric: lyricData,
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
        }
      }
    }
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  const handleAddCurrentBookmark = async () => {
    if (!currentLyric) return;
    const isBookmarked = bookmarksList.some((b) => b.id === currentLyric.id);
    await toggleBookmark(currentLyric.id, 'lyrics', !isBookmarked);
    await refreshBookmarks();
  };

  const handleOpenBookmarkInTab = async (bm: any) => {
    const existingTab = tabs.find((t) => t.id === bm.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const l = await readLyrics(bm.id);
      if (l) {
        const lyricData = l as Lyric;
        const newTab: TabItem = {
          id: lyricData.id,
          title: lyricData.title || 'Untitled',
          lyric: lyricData,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      }
    }
    setIsBookmarkOpen(false);
  };

  const paragraphs = currentLyric.body ? currentLyric.body.split('\n\n') : [];

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
    stateKey: 'chordly_lyrics_modal',
  });

  // ── Block going back to menu screen when screen lock is enabled ───────────
  useEffect(() => {
    if (!isStageLocked || typeof window === 'undefined') return;

    window.history.pushState({ chordly_lyrics_lock_prevent_exit: true }, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState({ chordly_lyrics_lock_prevent_exit: true }, '', window.location.href);
      showLockNotification('Screen is locked · Tap lock icon to unlock');
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.chordly_lyrics_lock_prevent_exit) {
        window.history.back();
      }
    };
  }, [isStageLocked, showLockNotification]);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#e8e8ec] dark:bg-[#121214] text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      {/* ── FLOATING TOP-RIGHT STAGE CONTROLS (Always accessible even when UI is hidden) ── */}
      <div className="fixed top-[calc(0.65rem+env(safe-area-inset-top,0px))] right-3 sm:right-5 z-[60] flex items-center gap-2 select-none no-print">
        {/* Lock Screen Toggle Button: compact small circular button on mobile/rotate mode */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsStageLocked((prev) => {
              const next = !prev;
              if (next) {
                setShowUI(false);
                closeAllPopups();
                showLockNotification('Stage Lock ON · Back & accidental taps blocked');
              } else {
                showLockNotification('Stage Lock OFF · Screen unlocked');
              }
              return next;
            });
          }}
          className={`phone-rotate-compact-lock flex items-center justify-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-full font-bold text-xs shadow-[0_4px_16px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all active:scale-95 cursor-pointer border ${
            isStageLocked
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/40'
              : 'bg-[#14141A]/90 text-[#8C8A93] border-[#2A2A31] hover:text-[#F4F2F0] hover:border-[#3E3E48]'
          }`}
          title={
            isStageLocked
              ? 'Screen Locked: accidental taps and exiting disabled. Tap to unlock.'
              : 'Lock Screen: prevent accidental taps and back navigation'
          }
          aria-label={isStageLocked ? 'Unlock screen' : 'Lock screen'}
        >
          {isStageLocked ? (
            <>
              <Lock size={14} className="text-amber-400 stroke-[2.5]" />
              <span className="hidden sm:inline font-semibold text-amber-400">Locked</span>
            </>
          ) : (
            <>
              <Unlock size={14} className="stroke-[2.2]" />
              <span className="hidden sm:inline font-semibold text-[#8C8A93]">Lock</span>
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

      {/* ── 1. TOP HEADER (Piascore Style) ────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 bg-white/60 dark:bg-[#1a1a1e]/60 backdrop-blur-2xl saturate-[180%] border-b border-white/60 dark:border-white/15 flex items-center justify-between px-3 pt-[env(safe-area-inset-top,0px)] h-[calc(3rem+env(safe-area-inset-top,0px))] transition-transform duration-300 ${
          showUI ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        {/* Left: Catalog Button (Blocked when Stage Locked) */}
        <button
          disabled={isStageLocked}
          onClick={() => {
            if (isStageLocked) {
              showLockNotification('Screen is locked · Tap lock icon to unlock');
              return;
            }
            router.push(folderId ? `/lyrics/folder?id=${folderId}` : '/lyrics');
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
            isStageLocked
              ? 'opacity-30 cursor-not-allowed text-[#8C8A93]'
              : 'text-accent-start hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer'
          }`}
          title={isStageLocked ? 'Catalog navigation disabled while screen is locked' : 'Back to Catalog'}
          aria-label="Back to Catalog"
        >
          <FolderOpen size={16} className="text-accent-start" />
          <span>Catalog</span>
        </button>

        {/* Center: Song Title & Subtitle */}
        <div className="flex flex-col items-center justify-center text-center max-w-[45vw] sm:max-w-[55vw]">
          <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight flex items-center gap-1.5">
            <Type size={14} className="text-accent-start" />
            {currentLyric.title || 'Untitled Lyrics'}
          </h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
            Chordly Lyrics Score
          </p>
        </div>

        {/* Right: Gesture / Sync Button and spacer for floating lock button */}
        <div className="flex items-center gap-1.5 pr-20 sm:pr-24">
          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-all active:scale-95"
          >
            <Smile size={16} className="text-accent-start" />
            <span>Gesture</span>
          </button>
        </div>
      </header>

      {/* ── 2. DOCUMENT TAB NAVIGATION BAR (Below Header) ──────────────────── */}
      <nav
        className={`fixed top-[calc(3rem+env(safe-area-inset-top,0px))] left-0 right-0 z-40 bg-white/50 dark:bg-[#202024]/50 backdrop-blur-2xl saturate-[180%] border-b border-white/60 dark:border-white/15 flex items-center px-2 h-9 gap-1 overflow-x-auto scrollbar-none transition-transform duration-300 ${
          showUI ? 'translate-y-0' : '-translate-y-[calc(5.25rem+env(safe-area-inset-top,0px))]'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-md cursor-pointer border border-b-0 transition-all max-w-[180px] shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-[#121214] text-slate-900 dark:text-white border-slate-300 dark:border-slate-800 font-bold shadow-sm'
                  : 'bg-[#cfcfd3] dark:bg-[#2a2a2e] text-slate-600 dark:text-slate-400 border-transparent hover:bg-white/50'
              }`}
            >
              {/* Active Gradient Line Indicator */}
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-[2.5px] bg-accent-gradient shadow-[0_0_8px_rgba(117,52,255,0.6)]" />
              )}
              <span className="truncate flex-1">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-black/10 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}

        {/* Plus Tab Button */}
        <button
          onClick={() => setIsSongPickerOpen(true)}
          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-all shrink-0 ml-1"
          title="Open lyrics in new tab"
        >
          <Plus size={15} />
        </button>
      </nav>

      {/* ── 3. FLOATING LEFT METRONOME TAB BUTTON ────────────────────────── */}
      <button
        onClick={() => setIsMetronomeOpen((prev) => !prev)}
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-white/90 dark:bg-[#1a1a1e]/90 backdrop-blur-md border border-l-0 border-slate-300 dark:border-slate-700 shadow-md rounded-r-xl px-2 py-3 flex flex-col items-center gap-1.5 text-accent-start hover:px-3 transition-all ${
          showUI ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
        }`}
      >
        <Volume2 size={16} className={isPlayingMetronome ? 'animate-bounce' : ''} />
        <span
          className="text-[10px] font-bold tracking-widest uppercase text-slate-700 dark:text-slate-300"
          style={{ writingMode: 'vertical-rl' }}
        >
          Metronome
        </span>
      </button>

      {/* ── METRONOME CONTROL DRAWER ──────────────────────────────────────── */}
      {isMetronomeOpen && (
        <div className="fixed left-12 top-1/2 -translate-y-1/2 z-50 w-72 bg-white/70 dark:bg-[#1e1e24]/70 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Volume2 size={16} className="text-accent-start" /> Metronome
            </h3>
            <button
              onClick={() => setIsMetronomeOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex justify-center items-center gap-2 py-1">
            {Array.from({ length: beatsPerMeasure }).map((_, idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all ${
                  isPlayingMetronome && currentBeat === idx
                    ? idx === 0
                      ? 'bg-red-500 scale-125 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
                      : 'bg-accent-start scale-110 shadow-[0_0_8px_rgba(117,52,255,0.8)]'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
            <button
              onClick={() => setBpm((b) => Math.max(30, b - 5))}
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 shadow-sm active:scale-95"
            >
              -5
            </button>
            <div className="text-center">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {bpm}
              </span>
              <span className="block text-[9px] font-bold text-slate-400 uppercase">BPM</span>
            </div>
            <button
              onClick={() => setBpm((b) => Math.min(260, b + 5))}
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 shadow-sm active:scale-95"
            >
              +5
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 text-xs">
            {['4/4', '3/4', '6/8', '2/4'].map((ts) => (
              <button
                key={ts}
                onClick={() => setTimeSig(ts)}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  timeSig === ts
                    ? 'bg-accent-gradient text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {ts}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPlayingMetronome((p) => !p)}
            className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-white shadow-md transition-all active:scale-98 ${
              isPlayingMetronome
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-accent-gradient hover:brightness-110'
            }`}
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

      {/* ── 4. MAIN LYRICS READER CANVAS ───────────────────────────────────── */}
      <main
        className={`flex-1 w-full h-full relative overflow-hidden flex items-stretch justify-center cursor-pointer transition-[padding] duration-300 ${
          showUI
            ? 'pt-[calc(5.25rem+env(safe-area-inset-top,0px))] pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'
            : 'pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[env(safe-area-inset-bottom,0px)]'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleCanvasClick}
      >
        <TransformWrapper
          initialScale={minZoomScale}
          minScale={minZoomScale}
          maxScale={4}
          centerOnInit={false}
          centerZoomedOut={false}
          limitToBounds={true}
          wheel={{
            step: 0.1,
            wheelDisabled: true, // Enables natural vertical mouse wheel scrolling down & up
          }}
          trackPadPanning={{
            disabled: false,
            velocityDisabled: false,
            lockAxisX: true, // Locks vertical scroll along Y-axis so lyrics stay centered
          }}
          panning={{
            disabled: false,
            velocityDisabled: false,
            lockAxisX: true, // Locks vertical scroll along Y-axis so lyrics stay centered
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
                handleCanvasClick();
              }}
              className="w-fit max-w-none flex flex-col items-start justify-start"
            >
              <LyricsContentWrapper
                lyric={currentLyric}
                selectedFont={selectedFont}
                textColor={textColor}
                textAlign={textAlign}
                showUI={showUI}
                onBaseScaleChange={setMinZoomScale}
              />
            </div>
          </TransformComponent>
        </TransformWrapper>
      </main>

      {/* ── 5. BOTTOM ACTION TOOLBAR (5 Icons matching Piascore) ────────── */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white/60 dark:bg-[#1a1a1e]/60 backdrop-blur-2xl saturate-[180%] border-t border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center justify-around pb-[env(safe-area-inset-bottom,0px)] h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] px-2 transition-transform duration-300 ${
          showUI ? 'translate-y-0' : 'translate-y-full'
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
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isBookmarkOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookmarkIcon size={20} />
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
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isAdjustOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isPageOverviewOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold transition-all active:scale-95 ${
            isInfoOpen
              ? 'text-accent-start'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Info size={20} />
          <span>Info</span>
        </button>

        {/* Button 5: Writing */}
        {canEditLyrics && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (currentLyric?.id) {
                const targetUrl = `/lyrics/edit/?id=${encodeURIComponent(currentLyric.id)}`;
                try {
                  router.push(targetUrl);
                } catch {
                  if (typeof window !== 'undefined') {
                    window.location.href = targetUrl;
                  }
                }
              }
            }}
            className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:text-accent-start transition-all active:scale-95"
          >
            <Edit3 size={20} />
            <span>Writing</span>
          </button>
        )}
      </footer>

      {/* ── 6. BOOKMARK POPOVER MODAL ─────────────────────────────────────── */}
      {isBookmarkOpen && (
        <div className="fixed bottom-16 left-4 z-50 w-80 max-w-[90vw] bg-white/65 dark:bg-[#1e1e24]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl overflow-hidden flex flex-col max-h-96 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/[0.05]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBookmarkOpen(false)}
                className="p-1 text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
              >
                <BookOpen size={18} />
              </button>
              <button className="p-1 text-accent-start hover:bg-black/5 dark:hover:bg-white/5 rounded-lg">
                <ArrowUpDown size={18} />
              </button>
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Bookmark</h2>
            <button
              onClick={handleAddCurrentBookmark}
              className={`p-1 rounded-lg active:scale-95 transition-all ${
                bookmarksList.some((b) => b.id === currentLyric.id)
                  ? 'text-accent-start bg-accent-start/10 font-bold'
                  : 'text-accent-start hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={
                bookmarksList.some((b) => b.id === currentLyric.id)
                  ? 'Remove from bookmarks'
                  : 'Add to bookmarks'
              }
            >
              <Plus size={20} className={bookmarksList.some((b) => b.id === currentLyric.id) ? 'rotate-45 transition-transform' : ''} />
            </button>
          </div>

          <div className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
            {bookmarksList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No bookmarks added yet. Tap <Plus size={12} className="inline text-accent-start" /> to bookmark this lyric.
              </div>
            ) : (
              bookmarksList.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => handleOpenBookmarkInTab(bm)}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <BookmarkIcon size={16} className="text-accent-start shrink-0 fill-accent-start" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {bm.title}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 7. SYNC PAGE TURNING MODAL ────────────────────────────────────── */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/65 dark:bg-[#1c1c22]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] max-w-sm w-full p-6 text-center flex flex-col items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Sync page turning
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              You can sync page turning between several devices.
              <br />
              (&quot;Follow&quot; follows &quot;Lead&quot;&apos;s a page-turning)
            </p>

            <input
              type="text"
              placeholder="Session code (e.g. ABC123)"
              maxLength={6}
              value={syncJoinCodeInput}
              onChange={(e) => setSyncJoinCodeInput(e.target.value.toUpperCase())}
              className="w-full text-center px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono uppercase font-bold text-slate-900 dark:text-white focus:outline-none focus:border-accent-start"
            />

            <div className="w-full flex flex-col divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-2">
              <button
                onClick={() => {
                  const code = Math.random().toString(36).substr(2, 6).toUpperCase();
                  router.push(`/perform/stage?code=${code}`);
                }}
                className="w-full py-3 text-sm font-bold text-accent-start hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors"
              >
                Lead
              </button>
              <button
                onClick={() => {
                  if (syncJoinCodeInput.trim().length === 6) {
                    router.push(`/perform/stage?code=${syncJoinCodeInput.trim().toUpperCase()}`);
                  }
                }}
                disabled={syncJoinCodeInput.trim().length !== 6}
                className="w-full py-3 text-sm font-bold text-accent-start hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Follow
              </button>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="w-full py-3 text-sm font-bold text-accent-start hover:bg-slate-50 dark:hover:bg-white/5 active:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. ADJUST PAGE PANEL ─────────────────────────────────────────── */}
      {isAdjustOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-72 bg-white/65 dark:bg-[#1e1e24]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Crop size={16} className="text-accent-start" /> Adjust Font & Color
            </h3>
            <button
              onClick={() => setIsAdjustOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>

          {/* Font Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Font Style</label>
            <select
              value={selectedFont}
              onChange={(e) => {
                const f = e.target.value;
                setSelectedFont(f);
                localStorage.setItem('chord-grid-font', f);
                window.dispatchEvent(new Event('chord-grid-font-change'));
              }}
              className="w-full p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="system">Plus Jakarta Sans (Default)</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              <option value="'Courier New', Courier, monospace">Courier New</option>
              <option value="Consolas, monospace">Consolas</option>
              <option value="'Cascadia Code', monospace">Cascadia Code</option>
              <option value="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace">Apple SF Mono</option>
            </select>
          </div>

          {/* Text Alignment Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Text Alignment</label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[
                { align: 'left', icon: AlignLeft, label: 'Left' },
                { align: 'center', icon: AlignCenter, label: 'Center' },
                { align: 'right', icon: AlignRight, label: 'Right' },
              ].map(({ align, icon: Icon, label }) => (
                <button
                  key={align}
                  onClick={() => {
                    const a = align as 'left' | 'center' | 'right';
                    setTextAlign(a);
                    localStorage.setItem('chord-grid-lyrics-align', a);
                  }}
                  className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-all ${
                    textAlign === align
                      ? 'bg-accent-gradient text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Color Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Text Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Ink', color: '#0f172a' },
                { label: 'Indigo', color: '#4f46e5' },
                { label: 'Blue', color: '#2563eb' },
                { label: 'Purple', color: '#7c3aed' },
                { label: 'Rose', color: '#e11d48' },
                { label: 'Teal', color: '#0d9488' },
                { label: 'Amber', color: '#d97706' },
                { label: 'Slate', color: '#475569' },
              ].map(({ label, color }) => (
                <button
                  key={color}
                  title={label}
                  onClick={() => {
                    setTextColor(color);
                    localStorage.setItem('chord-grid-lyrics-color', color);
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all active:scale-90 ${
                    textColor === color
                      ? 'border-slate-900 dark:border-white scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 9. STANZAS / PARAGRAPHS OVERVIEW PANEL ──────────────────────── */}
      {isPageOverviewOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-80 bg-white/65 dark:bg-[#1e1e24]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <LayoutGrid size={16} className="text-accent-start" /> Stanzas Overview
            </h3>
            <button
              onClick={() => setIsPageOverviewOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto p-1">
            {paragraphs.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No stanzas found.</p>
            ) : (
              paragraphs.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs truncate"
                >
                  <span className="font-bold text-accent-start mr-2">#{idx + 1}</span>
                  {p.slice(0, 40)}...
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── 10. INFO PANEL ──────────────────────────────────────────────── */}
      {isInfoOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-72 bg-white/65 dark:bg-[#1e1e24]/65 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Info size={16} className="text-accent-start" /> Lyrics Details
            </h3>
            <button
              onClick={() => setIsInfoOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Title:</span>
              <span className="font-bold">{currentLyric.title || 'Untitled'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Stanzas:</span>
              <span className="font-bold">{paragraphs.length}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Last Modified:</span>
              <span className="font-mono text-[10px]">
                {currentLyric.updated_at
                  ? new Date(currentLyric.updated_at).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 11. SONG PICKER MODAL (Add Tab) ────────────────────────────── */}
      <SongPickerModal
        isOpen={isSongPickerOpen}
        onClose={() => setIsSongPickerOpen(false)}
        onAdd={handleAddPickedSongs}
        existingIds={tabs.map((t) => t.id)}
      />
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, canModifySection } from './AuthProvider';
import { saveChart, type Chart } from '@/lib/storage';
import { saveLyrics, type Lyric } from '@/lib/lyrics';
import { createDefaultLine } from '@/lib/chart-types';
import { Music, Type, X } from 'lucide-react';
import styles from './WaterJumpNavbar.module.css';

// Exact SVG Icon paths from chordly water-jump navbar.html
const ICONS: Record<string, React.ReactNode> = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  list: (
    <>
      <path d="M3 6h11M3 11h11M3 16h6" />
      <path d="M19 7v9" />
      <circle cx="17" cy="16" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  type: (
    <>
      <path d="M5 6V4h14v2M12 4v16" />
      <path d="M9 20h6" />
    </>
  ),
  star: <path d="M12 3l2.8 5.9 6.2.8-4.5 4.4 1.2 6.4-5.7-3.1-5.7 3.1 1.2-6.4L3 9.7l6.2-.8z" />,
};

// Physics Constants from chordly water-jump navbar.html
const TOP = 30;
const BH = 64;
const H = 94;
const R = 26;
const DEP = 34;
const HW = 52;
const REST = TOP + 4; // 34

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sm = (v: number) => {
  v = clamp(v, 0, 1);
  return v * v * (3 - 2 * v);
};
const ease = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const dip = (x: number, c: number, d: number) => {
  const u = clamp((x - c) / HW, -1, 1);
  return d * 0.5 * (1 + Math.cos(Math.PI * u));
};

interface DropParticle {
  e: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  s: number;
}

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useAuth();
  const canCreateChart = canModifySection(profile?.profession, 'chart');
  const canCreateLyrics = canModifySection(profile?.profession, 'lyrics');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectionActive, setSelectionActive] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const barSvgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLElement>(null);
  const dropsRef = useRef<DropParticle[]>([]);

  // If profession is singing: swap Chords and Lyrics (Lyrics 1st priority and home screen)
  const isSinger = profile?.profession === 'singing';

  const chordsItem = {
    id: 'chords',
    label: 'Chords',
    iconKey: 'folder',
    href: isSinger ? '/chords' : '/',
  };

  const setlistsItem = {
    id: 'setlists',
    label: 'Setlists',
    iconKey: 'list',
    href: '/setlists',
  };

  const createItem = {
    id: 'create',
    label: 'Create',
    iconKey: 'plus',
    href: '',
  };

  const lyricsItem = {
    id: 'lyrics',
    label: 'Lyrics',
    iconKey: 'type',
    href: isSinger ? '/' : '/lyrics',
  };

  const starredItem = {
    id: 'starred',
    label: 'Starred',
    iconKey: 'star',
    href: '/bookmarks',
  };

  const items = isSinger
    ? [lyricsItem, setlistsItem, createItem, chordsItem, starredItem]
    : [chordsItem, setlistsItem, createItem, lyricsItem, starredItem];

  const getTargetIndex = useCallback(() => {
    if (createModalOpen) return 2;
    if (pathname.startsWith('/setlists')) return 1;
    if (pathname.startsWith('/bookmarks')) return 4;
    if (isSinger) {
      if (pathname === '/' || pathname.startsWith('/lyrics')) return 0;
      return 3;
    } else {
      if (pathname.startsWith('/lyrics')) return 3;
      return 0;
    }
  }, [pathname, isSinger, createModalOpen]);

  const [activeTab, setActiveTab] = useState<number>(0);

  // Physics animation state
  const animStateRef = useRef({
    W: 0,
    cur: 0,
    cxs: [] as number[],
    bx0: 0,
    nx0: 0,
    nx1: 0,
    dStart: DEP,
    lastD1: DEP,
    tStart: -1e9,
    DUR: 720,
    raf: 0,
    landed: true,
    last: 0,
  });

  const splash = useCallback((x: number) => {
    if (!wrapRef.current) return;
    const n = 10;
    for (let k = 0; k < n; k++) {
      const e = document.createElement('i');
      e.className = styles.drop;
      const s = 3 + Math.random() * 4;
      e.style.width = `${s}px`;
      e.style.height = `${s}px`;
      wrapRef.current.appendChild(e);
      dropsRef.current.push({
        e,
        x: x + (Math.random() - 0.5) * 26,
        y: TOP + 2,
        vx: (k / (n - 1) - 0.5) * 240 + (Math.random() - 0.5) * 40,
        vy: -(200 + Math.random() * 180),
        life: 0,
        s,
      });
    }
  }, []);

  const draw = useCallback((now: number) => {
    const sState = animStateRef.current;
    const { bx0, nx1, tStart, DUR, W } = sState;
    if (W === 0) return;

    const t = (now - tStart) / DUR;
    const tc = clamp(t, 0, 1);
    const s = Math.max(0, (now - tStart - DUR) / 1000);
    const e = ease(tc);
    const bx = bx0 + (nx1 - bx0) * e;
    const by = REST;
    const dist = nx1 - bx0;
    const dir = dist < 0 ? -1 : 1;
    const e2 = ease(clamp(tc + 0.02, 0, 1));
    const k = tc < 1 ? clamp(Math.abs(((e2 - e) / 0.02) * dist / DUR * 1000) / 650, 0, 1) : 0;
    const d1 = DEP * (s > 0 ? 1 + 0.07 * Math.exp(-6 * s) * Math.sin(14 * s) : 1);
    sState.lastD1 = d1;
    const rip = s > 0 ? 4 * Math.exp(-3.2 * s) : 0;
    const pts: string[] = [];

    for (let x = R; x <= W - R; x += 2) {
      let y = TOP + dip(x, bx, d1);
      const bh = (bx - x) * dir;
      if (k > 0.02 && bh > 0) y += k * 5 * Math.sin(bh * 0.15) * Math.exp(-bh / 120) * sm(bh / 22);
      if (rip > 0.05) {
        const dx = Math.abs(x - bx);
        y += rip * Math.sin(dx * 0.12 - 18 * s) * Math.exp(-dx / 95) * sm(dx / 14);
      }
      pts.push(`${x.toFixed(1)} ${y.toFixed(2)}`);
    }

    if (pathRef.current) {
      pathRef.current.setAttribute(
        'd',
        'M' + R + ' ' + TOP +
          ' L' + pts.join(' L') +
          ' L' + (W - R) + ' ' + TOP +
          ' A' + R + ' ' + R + ' 0 0 1 ' + W + ' ' + (TOP + R) +
          ' L' + W + ' ' + (TOP + BH - R) +
          ' A' + R + ' ' + R + ' 0 0 1 ' + (W - R) + ' ' + (TOP + BH) +
          ' L' + R + ' ' + (TOP + BH) +
          ' A' + R + ' ' + R + ' 0 0 1 0 ' + (TOP + BH - R) +
          ' L0 ' + (TOP + R) +
          ' A' + R + ' ' + R + ' 0 0 1 ' + R + ' ' + TOP + 'Z'
      );
    }

    const sx = 1 + 0.05 * k;
    const sy = 1 - 0.05 * k;
    if (bubbleRef.current) {
      bubbleRef.current.style.transform = `translate3d(${(bx - 27).toFixed(1)}px, ${(by - 27).toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    }
    if (spinRef.current) {
      spinRef.current.style.transform = `rotate(${(bx / 27 * 57.2958).toFixed(1)}deg)`;
    }

    if (tc >= 1 && !sState.landed) {
      sState.landed = true;
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      const sState = animStateRef.current;
      const dt = Math.min(0.04, (now - (sState.last || now)) / 1000);
      sState.last = now;
      draw(now);

      const drops = dropsRef.current;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.life += dt;
        d.vy += 1000 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        const a = 1 - d.life / 0.75;
        if (a <= 0) {
          d.e.remove();
          drops.splice(i, 1);
          continue;
        }
        d.e.style.opacity = a.toFixed(2);
        d.e.style.transform = `translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0) scale(${a.toFixed(2)})`;
      }

      if (now - sState.tStart < sState.DUR + 1500 || drops.length > 0) {
        sState.raf = requestAnimationFrame(tick);
      } else {
        sState.raf = 0;
        sState.last = 0;
        draw(now);
      }
    },
    [draw]
  );

  const go = useCallback(
    (i: number, force?: boolean) => {
      const sState = animStateRef.current;
      if (i === sState.cur && !force) return;

      const now = performance.now();
      const t = clamp((now - sState.tStart) / sState.DUR, 0, 1);
      const bxNow = sState.bx0 + (sState.nx1 - sState.bx0) * ease(t);
      sState.bx0 = t < 1 ? bxNow : sState.nx1;
      sState.nx0 = sState.nx1;
      sState.dStart = sState.lastD1;

      if (force) {
        sState.bx0 = sState.cxs[i] || 0;
        sState.nx0 = sState.cxs[i] || 0;
        sState.dStart = DEP;
      }

      sState.DUR = 420 + 110 * Math.abs(i - sState.cur);
      sState.cur = i;
      sState.nx1 = sState.cxs[i] || 0;
      sState.tStart = now;
      sState.landed = false;

      setActiveTab(i);

      if (!sState.raf) {
        sState.raf = requestAnimationFrame(tick);
      }
    },
    [tick]
  );

  const layout = useCallback(() => {
    if (!wrapRef.current || !barSvgRef.current) return;
    const W = wrapRef.current.clientWidth;
    if (W === 0) return;
    const sState = animStateRef.current;
    sState.W = W;

    barSvgRef.current.setAttribute('viewBox', `0 0 ${W} ${H}`);
    barSvgRef.current.setAttribute('width', `${W}`);
    barSvgRef.current.setAttribute('height', `${H}`);

    sState.cxs = items.map((_, i) => (i + 0.5) * W / items.length);

    if (sState.tStart < 0 && !sState.raf) {
      sState.nx0 = sState.nx1 = sState.bx0 = sState.cxs[sState.cur] || 0;
    }
    draw(performance.now());
  }, [draw, items]);

  useEffect(() => {
    const handleSelectionChange = (e: any) => {
      setSelectionActive((e.detail || 0) > 0);
    };
    const handleOpenCreateModal = () => setCreateModalOpen(true);

    window.addEventListener('selection-change', handleSelectionChange);
    window.addEventListener('open-create-modal', handleOpenCreateModal);

    return () => {
      window.removeEventListener('selection-change', handleSelectionChange);
      window.removeEventListener('open-create-modal', handleOpenCreateModal);
    };
  }, []);

  // Sync layout and resize
  useEffect(() => {
    layout();
    window.addEventListener('resize', layout);
    return () => window.removeEventListener('resize', layout);
  }, [layout]);

  // Sync active route with water-jump tab position
  useEffect(() => {
    const targetIdx = getTargetIndex();
    const sState = animStateRef.current;
    if (sState.cxs.length > 0) {
      go(targetIdx);
    } else {
      sState.cur = targetIdx;
      setActiveTab(targetIdx);
    }
  }, [pathname, getTargetIndex, go]);

  const handleTabClick = (i: number, item: typeof items[0]) => {
    if (item.id === 'create') {
      splash(animStateRef.current.cxs[2] || 0);
      go(2);
      setCreateModalOpen(true);
      return;
    }

    go(i);
    if (pathname !== item.href) {
      router.push(item.href);
    }
  };

  const handleCreateNewChart = async () => {
    setCreateModalOpen(false);
    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    const chart: Chart = {
      id: crypto.randomUUID(),
      title: 'Untitled Chart',
      tempo: 120,
      time_sig: '4/4',
      lines: [createDefaultLine(), createDefaultLine()],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: currentUserId,
      updated_at: new Date().toISOString(),
    };
    await saveChart(chart);
    router.push(`/chart/edit/?id=${chart.id}`);
  };

  const handleCreateNewLyrics = async () => {
    setCreateModalOpen(false);
    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    const lyrics: Lyric = {
      id: crypto.randomUUID(),
      title: 'Untitled Lyrics',
      body: '',
      folder_id: null,
      created_by: currentUserId,
      updated_at: new Date().toISOString(),
    };
    await saveLyrics(lyrics);
    router.push(`/lyrics/edit/?id=${lyrics.id}`);
  };

  // Hide on auth / login page, or if user is unauthenticated
  if (pathname === '/auth' || pathname.startsWith('/auth') || !user) {
    return null;
  }

  const cleanPath = (pathname || '').replace(/\/+$/, '') || '/';

  // NEVER show main navigation bar on:
  // - Chord charts reader or editor (/chart, /chart/*)
  // - Lyrics reader or editor (/lyrics/view, /lyrics/* except /lyrics and /lyrics/folder)
  // - Live performance screens (/perform, /perform/*)
  // - Printer screen (/printer, /printer/*)
  const isAuthScreen = cleanPath === '/auth';
  const isChartScreen = cleanPath === '/chart' || cleanPath.startsWith('/chart/');
  const isLyricsReaderOrEditor =
    cleanPath.startsWith('/lyrics/view') ||
    cleanPath.includes('/edit') ||
    (cleanPath.startsWith('/lyrics/') && !cleanPath.startsWith('/lyrics/folder'));
  const isPerformScreen = cleanPath.startsWith('/perform');
  const isPrinterScreen = cleanPath.startsWith('/printer');

  if (isAuthScreen || isChartScreen || isLyricsReaderOrEditor || isPerformScreen || isPrinterScreen) {
    return null;
  }

  return (
    <>
      {/* Floating Water-Jump Bottom Dock */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 px-3 pointer-events-none no-print transition-all duration-300 ease-in-out pb-[calc(0.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))] ${
          selectionActive ? 'translate-y-28 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        <nav className={`pointer-events-auto ${styles.navRoot}`} aria-label="Main Navigation">
          <div className={styles.wrap} ref={wrapRef} id="wrap">
            {/* Liquid SVG Wave Path with Dynamic Water Dip */}
            <svg ref={barSvgRef} className={styles.barSvg} id="bar" aria-hidden="true">
              <path ref={pathRef} id="p" />
            </svg>

            {/* Row of Tabs */}
            <div className={styles.row} id="row">
              {items.map((item, idx) => {
                const isActive = activeTab === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.tab} ${isActive ? styles.tabOn : ''}`}
                    onClick={() => handleTabClick(idx, item)}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <svg viewBox="0 0 24 24" className={styles.tabIcon}>
                      {ICONS[item.iconKey]}
                    </svg>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Rolling Liquid Water Bubble */}
            <div ref={bubbleRef} className={styles.bubble} id="bub" aria-hidden="true">
              <i ref={spinRef} className={styles.spin} id="spin" />
              <span className={styles.ico} id="ico">
                <svg viewBox="0 0 24 24" className={styles.bubbleIcon}>
                  {ICONS[items[activeTab]?.iconKey || 'folder']}
                </svg>
              </span>
            </div>
          </div>
        </nav>
      </div>

      {/* Quick Create Bottom Sheet Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="bg-[#1A1A20] border border-[#2A2A31] rounded-t-[32px] sm:rounded-[32px] w-full max-w-[430px] p-6 pb-[calc(1.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))] shadow-[0_16px_48px_rgba(0,0,0,0.85)] space-y-4 animate-in slide-in-from-bottom duration-200 text-[#F4F2F0]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-[#2A2A31]">
              <h3 className="text-base font-extrabold text-[#F4F2F0] tracking-tight">Create New</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8C8A93] hover:text-[#F4F2F0] hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`grid ${canCreateChart && canCreateLyrics ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-1`}>
              {canCreateChart && (
                <button
                  onClick={handleCreateNewChart}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[#14141A] border border-[#2A2A31] hover:border-[#FF6A1F] hover:bg-[#1A1A20] shadow-md transition-all text-center group cursor-pointer active:scale-95"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6A1F]/20 to-amber-500/20 text-[#FF6A1F] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#FF6A1F]/30">
                    <Music size={22} className="stroke-[2.2]" />
                  </div>
                  <span className="text-sm font-bold text-[#F4F2F0] group-hover:text-[#FF6A1F] transition-colors">
                    Chord Chart
                  </span>
                  <span className="text-[11px] text-[#8C8A93] mt-0.5">Bar notation score</span>
                </button>
              )}

              {canCreateLyrics && (
                <button
                  onClick={handleCreateNewLyrics}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[#14141A] border border-[#2A2A31] hover:border-[#EE1D52] hover:bg-[#1A1A20] shadow-md transition-all text-center group cursor-pointer active:scale-95"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EE1D52]/20 to-rose-500/20 text-[#EE1D52] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-[#EE1D52]/30">
                    <Type size={22} className="stroke-[2.2]" />
                  </div>
                  <span className="text-sm font-bold text-[#F4F2F0] group-hover:text-[#EE1D52] transition-colors">
                    Lyrics Sheet
                  </span>
                  <span className="text-[11px] text-[#8C8A93] mt-0.5">Text &amp; ChordPro</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

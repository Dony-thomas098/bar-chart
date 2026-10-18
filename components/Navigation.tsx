'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Folder, ListMusic, Plus, Type, Star, Music, X } from 'lucide-react';
import { useAuth, canModifySection } from './AuthProvider';
import { saveChart } from '@/lib/storage';
import { saveLyrics } from '@/lib/lyrics';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useAuth();
  const canCreateChart = canModifySection(profile?.profession, 'chart');
  const canCreateLyrics = canModifySection(profile?.profession, 'lyrics');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectionActive, setSelectionActive] = useState(false);

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

  // Hide on reading mode (lyrics score or chord score viewer), full-screen live performance screens, and print
  const isReadingScreen =
    (pathname.startsWith('/lyrics/') && !pathname.startsWith('/lyrics/folder') && !pathname.endsWith('/edit')) ||
    (pathname.startsWith('/chart/') && !pathname.endsWith('/edit'));

  const isPerformScreen =
    isReadingScreen ||
    (pathname.startsWith('/perform/') && pathname.split('/').length === 3) ||
    (pathname.includes('/perform') && pathname.split('/').length >= 4);

  if (isPerformScreen) return null;

  // If profession is singing: swap Chords and Lyrics (Lyrics 1st priority and home screen)
  const isSinger = profile?.profession === 'singing';

  const chordsItem = {
    id: 'chords',
    label: 'Chords',
    icon: Folder,
    href: isSinger ? '/chords' : '/',
    active: isSinger
      ? (pathname === '/chords' || pathname.startsWith('/folder') || (pathname.startsWith('/chart/') && !pathname.includes('/setlists')))
      : (pathname === '/' || pathname === '/chords' || pathname.startsWith('/folder') || (pathname.startsWith('/chart/') && !pathname.includes('/setlists'))),
  };

  const setlistsItem = {
    id: 'setlists',
    label: 'Setlists',
    icon: ListMusic,
    href: '/setlists',
    active: pathname.startsWith('/setlists'),
  };

  const lyricsItem = {
    id: 'lyrics',
    label: 'Lyrics',
    icon: Type,
    href: isSinger ? '/' : '/lyrics',
    active: isSinger
      ? (pathname === '/' || pathname.startsWith('/lyrics'))
      : pathname.startsWith('/lyrics'),
  };

  const starredItem = {
    id: 'starred',
    label: 'Starred',
    icon: Star,
    href: '/bookmarks',
    active: pathname.startsWith('/bookmarks'),
  };

  const leftItems = isSinger ? [lyricsItem, setlistsItem] : [chordsItem, setlistsItem];
  const rightItems = isSinger ? [chordsItem, starredItem] : [lyricsItem, starredItem];

  const handleCreateNewChart = async () => {
    setCreateModalOpen(false);
    if (!canCreateChart || !user) return;
    const chart = {
      id: crypto.randomUUID(),
      title: 'Untitled Chart',
      tempo: 120,
      time_sig: '4/4',
      lines: [],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
    await saveChart(chart);
    router.push(`/chart/${chart.id}/edit`);
  };

  const handleCreateNewLyrics = async () => {
    setCreateModalOpen(false);
    if (!canCreateLyrics || !user) return;
    const lyrics = {
      id: crypto.randomUUID(),
      title: 'Untitled Lyrics',
      body: '',
      folder_id: null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };
    await saveLyrics(lyrics);
    router.push(`/lyrics/${lyrics.id}/edit`);
  };

  return (
    <>
      {/* Floating Bottom Dock (visible on all screen sizes) */}
      <div className={`fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-40 px-4 pointer-events-none no-print transition-all duration-300 ease-in-out ${
        selectionActive ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}>
        <div className="w-full max-w-[430px] mx-auto pointer-events-none flex justify-center">
          <nav 
            className="pointer-events-auto w-full max-w-sm bg-white/45 dark:bg-black/40 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-full px-3 py-1.5 shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] flex items-center justify-around relative"
            aria-label="Navigation Dock"
          >
          {/* Left Navigation Items */}
          {leftItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
                className={`flex flex-col items-center justify-center py-1 px-3 transition-all relative ${
                  item.active ? 'text-[#1c1c1e] dark:text-[#f4f4f6] font-bold' : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#1c1c1e] dark:hover:text-[#f4f4f6]'
                }`}
              >
                <Icon size={20} className={item.active ? 'stroke-[2.5] text-[#1c1c1e] dark:text-[#f4f4f6]' : 'stroke-[1.8]'} />
                <span className="text-[10px] mt-0.5 font-semibold tracking-tight">{item.label}</span>
              </Link>
            );
          })}

          {/* Center Elevated Action Button (+ New) */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="w-12 h-12 -mt-5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 flex items-center justify-center border-2 border-white dark:border-[#18181c] shadow-lg shadow-orange-500/25 active:scale-95 transition-transform cursor-pointer"
            aria-label="Create New Chart or Lyrics"
          >
            <Plus size={22} className="stroke-[2.5] text-white" />
          </button>

          {/* Right Navigation Items */}
          {rightItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
                className={`flex flex-col items-center justify-center py-1 px-3 transition-all relative ${
                  item.active ? 'text-[#1c1c1e] dark:text-[#f4f4f6] font-bold' : 'text-[#6b7280] dark:text-[#9ca3af] hover:text-[#1c1c1e] dark:hover:text-[#f4f4f6]'
                }`}
              >
                <Icon size={20} className={item.active ? 'stroke-[2.5] text-[#1c1c1e] dark:text-[#f4f4f6]' : 'stroke-[1.8]'} />
                <span className="text-[10px] mt-0.5 font-semibold tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>

      {/* Quick Create Bottom Sheet Modal */}
      {createModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setCreateModalOpen(false)}
        >
          <div 
            className="bg-white/60 dark:bg-[#18181d]/60 backdrop-blur-2xl saturate-[180%] border border-white/60 dark:border-white/15 rounded-t-[32px] sm:rounded-[32px] w-full max-w-[430px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div className="w-12 h-1 bg-black/15 dark:bg-white/20 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="text-base font-extrabold text-[#1c1c1e] dark:text-[#f4f4f6] tracking-tight">Create New</h3>
              <button 
                onClick={() => setCreateModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#6b7280] dark:text-[#9ca3af] hover:text-[#1c1c1e] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`grid ${canCreateChart && canCreateLyrics ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-1`}>
              {canCreateChart && (
                <button
                  onClick={handleCreateNewChart}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/40 dark:bg-white/[0.05] border border-white/60 dark:border-white/10 hover:border-orange-500/50 hover:bg-white/65 hover:shadow-lg dark:hover:bg-white/15 backdrop-blur-md transition-all text-center group cursor-pointer active:scale-95 shadow-sm"
                >
                  <div className="w-13 h-13 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-orange-500 dark:text-orange-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm border border-orange-500/25">
                    <Music size={22} className="stroke-[2.2]" />
                  </div>
                  <span className="text-sm font-bold text-[#1c1c1e] dark:text-[#f4f4f6] group-hover:text-orange-500 transition-colors">Chord Chart</span>
                  <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5">Bar notation score</span>
                </button>
              )}

              {canCreateLyrics && (
                <button
                  onClick={handleCreateNewLyrics}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/40 dark:bg-white/[0.05] border border-white/60 dark:border-white/10 hover:border-rose-500/50 hover:bg-white/65 hover:shadow-lg dark:hover:bg-white/15 backdrop-blur-md transition-all text-center group cursor-pointer active:scale-95 shadow-sm"
                >
                  <div className="w-13 h-13 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm border border-rose-500/25">
                    <Type size={22} className="stroke-[2.2]" />
                  </div>
                  <span className="text-sm font-bold text-[#1c1c1e] dark:text-[#f4f4f6] group-hover:text-rose-500 transition-colors">Lyrics Sheet</span>
                  <span className="text-[11px] text-[#6b7280] dark:text-[#9ca3af] mt-0.5">Text & ChordPro</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


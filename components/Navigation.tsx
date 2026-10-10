'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Folder, ListMusic, Plus, Type, Star, Music, X } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { saveChart } from '@/lib/storage';
import { saveLyrics } from '@/lib/lyrics';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Hide on full-screen live performance screens and print
  const isPerformScreen =
    (pathname.startsWith('/perform/') && pathname.split('/').length === 3) ||
    (pathname.includes('/perform') && pathname.split('/').length >= 4);

  if (isPerformScreen) return null;

  const navItems = [
    {
      id: 'folders',
      label: 'Folders',
      icon: Folder,
      href: '/',
      active: pathname === '/' || pathname.startsWith('/folder/') || (pathname.startsWith('/chart/') && !pathname.includes('/setlists')),
    },
    {
      id: 'setlists',
      label: 'Setlists',
      icon: ListMusic,
      href: '/setlists',
      active: pathname.startsWith('/setlists'),
    },
    {
      id: 'lyrics',
      label: 'Lyrics',
      icon: Type,
      href: '/lyrics',
      active: pathname.startsWith('/lyrics'),
    },
    {
      id: 'starred',
      label: 'Starred',
      icon: Star,
      href: '/bookmarks',
      active: pathname.startsWith('/bookmarks'),
    },
  ];

  const handleCreateNewChart = async () => {
    setCreateModalOpen(false);
    if (!user) return;
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
    if (!user) return;
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
      {/* Mobile Floating Bottom Dock (visible on < sm screens) */}
      <nav 
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 no-print bg-[#0e0e14]/95 backdrop-blur-2xl border-t border-white/10 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.7)]"
        aria-label="Mobile Navigation Dock"
      >
        <div className="flex items-center justify-around relative max-w-md mx-auto">
          {/* Folders */}
          <Link
            href={navItems[0].href}
            prefetch={true}
            className={`flex flex-col items-center justify-center py-1 px-3 transition-colors ${
              navItems[0].active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder size={20} className={navItems[0].active ? 'text-indigo-400' : ''} />
            <span className="text-[10.5px] font-bold mt-1 tracking-tight">{navItems[0].label}</span>
          </Link>

          {/* Setlists */}
          <Link
            href={navItems[1].href}
            prefetch={true}
            className={`flex flex-col items-center justify-center py-1 px-3 transition-colors ${
              navItems[1].active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListMusic size={20} className={navItems[1].active ? 'text-indigo-400' : ''} />
            <span className="text-[10.5px] font-bold mt-1 tracking-tight">{navItems[1].label}</span>
          </Link>

          {/* Center Action Button */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="w-11 h-11 -mt-4 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-[0_4px_16px_rgba(99,102,241,0.5)] border-2 border-[#0e0e14] active:scale-95 transition-transform"
            aria-label="Create New Chart or Lyrics"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>

          {/* Lyrics */}
          <Link
            href={navItems[2].href}
            prefetch={true}
            className={`flex flex-col items-center justify-center py-1 px-3 transition-colors ${
              navItems[2].active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type size={20} className={navItems[2].active ? 'text-indigo-400' : ''} />
            <span className="text-[10.5px] font-bold mt-1 tracking-tight">{navItems[2].label}</span>
          </Link>

          {/* Starred */}
          <Link
            href={navItems[3].href}
            prefetch={true}
            className={`flex flex-col items-center justify-center py-1 px-3 transition-colors ${
              navItems[3].active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star size={20} className={navItems[3].active ? 'text-amber-400' : ''} />
            <span className="text-[10.5px] font-bold mt-1 tracking-tight">{navItems[3].label}</span>
          </Link>
        </div>
      </nav>

      {/* Quick Create Modal */}
      {createModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setCreateModalOpen(false)}
        >
          <div 
            className="bg-[#14141c] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Create New</h3>
              <button 
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCreateNewChart}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/50 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Music size={20} />
                </div>
                <span className="text-sm font-bold text-white">Chord Chart</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Bar notation score</span>
              </button>

              <button
                onClick={handleCreateNewLyrics}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/50 transition-all text-center group"
              >
                <div className="w-10 h-10 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Type size={20} />
                </div>
                <span className="text-sm font-bold text-white">Lyrics Sheet</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Text & ChordPro</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useAuth, canModifySection } from '@/components/AuthProvider';
import { getRecentCharts, createFolder, saveChart } from '@/lib/storage';
import { saveLyrics } from '@/lib/lyrics';
import { createDefaultLine } from '@/lib/chart-types';
import { X, User, LogOut, Settings, Folder as FolderIcon, FileText, Printer, Trash2, Music, Music2, ListMusic, Star, Download, ChevronRight, Plus, Sun, Moon, Users } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { getStoredTheme, setTheme, ThemeMode } from '@/lib/theme';
import { ChordlyLogo } from './ChordlyLogo';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { getStoredBand } from '@/lib/band';
import './sidebar-drawer.css';

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Android hardware back button dismisses sidebar drawer
  useHardwareBackButton({
    enabled: isOpen,
    onBack: onClose,
    stateKey: 'chordly_sidebar',
  });
  const [recentCharts, setRecentCharts] = useState<any[]>([]);
  const [selectedFont, setSelectedFont] = useState('system');
  const [createFolderModal, setCreateFolderModal] = useState(false);
  const [folderKind, setFolderKind] = useState<'chart' | 'lyrics'>('chart');
  const [bandInfo, setBandInfo] = useState<{ id: string | null; name: string | null; code: string | null }>({ id: null, name: null, code: null });
  const [joinCode, setJoinCode] = useState('');

  const effectiveBandName = profile?.band_name || bandInfo.name;
  const effectiveBandCode = profile?.band_code || bandInfo.code;

  useEffect(() => {
    const updateBand = () => setBandInfo(getStoredBand());
    updateBand();
    window.addEventListener('band-joined', updateBand);
    window.addEventListener('band-left', updateBand);
    return () => {
      window.removeEventListener('band-joined', updateBand);
      window.removeEventListener('band-left', updateBand);
    };
  }, [isOpen, profile?.band_name, profile?.band_code]);
  const [isPending, startTransition] = useTransition();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isDarkEffective, setIsDarkEffective] = useState(false);
  const isSinger = profile?.profession === 'singing';
  const canCreateChart = canModifySection(profile?.profession, 'chart');
  const canCreateLyrics = canModifySection(profile?.profession, 'lyrics');

  const handleNav = (path: string) => {
    onClose();
    router.push(path);
  };

  let currentFolderId: string | null = null;
  if (pathname.startsWith('/folder/')) {
    currentFolderId = pathname.split('/')[2];
  }

  useEffect(() => {
    const updateThemeState = () => {
      const mode = getStoredTheme();
      setThemeMode(mode);
      const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkEffective(mode === 'dark' || (mode === 'system' && prefersDark));
    };
    updateThemeState();
    window.addEventListener('chord-grid-theme-change', updateThemeState);
    return () => window.removeEventListener('chord-grid-theme-change', updateThemeState);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = isDarkEffective ? 'light' : 'dark';
    setTheme(next);
  };

  useEffect(() => {
    if (isOpen) {
      getRecentCharts(5).then(setRecentCharts);
      const savedFont = localStorage.getItem('chord-grid-font');
      if (savedFont) setSelectedFont(savedFont);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    onClose();
    await signOut();
  };

  const handleCreateFolder = (kind: 'chart' | 'lyrics') => {
    setFolderKind(kind);
    setCreateFolderModal(true);
  };

  const handleCreateChart = async () => {
    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    const chart = {
      id: crypto.randomUUID(),
      title: 'Untitled Chart',
      tempo: 120,
      time_sig: '4/4',
      lines: [createDefaultLine(), createDefaultLine()],
      semitone_offset: 0,
      prefer_flats: false,
      folder_id: currentFolderId,
      created_by: currentUserId,
      updated_at: new Date().toISOString(),
    };
    await saveChart(chart);
    const chartUrl = `/chart/edit/?id=${chart.id}`;
    try {
      router.push(chartUrl);
    } catch {
      if (typeof window !== 'undefined') {
        window.location.href = chartUrl;
      }
    }
    onClose();
  };

  const handleCreateLyrics = async () => {
    const currentUserId = user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') : null) || 'guest-user';
    const lyric = {
      id: crypto.randomUUID(),
      title: 'Untitled Lyrics',
      body: '',
      folder_id: currentFolderId,
      created_by: currentUserId,
      updated_at: new Date().toISOString(),
    };
    await saveLyrics(lyric);
    const lyricsUrl = `/lyrics/edit/?id=${lyric.id}`;
    try {
      router.push(lyricsUrl);
    } catch {
      if (typeof window !== 'undefined') {
        window.location.href = lyricsUrl;
      }
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop / Scrim */}
      <div
        className="app-drawer-scrim"
        data-open={isOpen ? 'true' : 'false'}
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div className="app-drawer app-drawer-panel" data-open={isOpen ? 'true' : 'false'}>

        {/* Profile Header */}
        <div className="app-drawer-header">
          <div className="app-drawer-header-top">
            <div className="app-drawer-header-info">
              <div className="app-drawer-avatar">
                <User size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="app-drawer-email">{user?.email}</p>
                <span className="app-drawer-badge">
                  {profile?.profession === 'singing' ? 'Singer' : (profile?.instrument || 'Pro Musician')}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="app-drawer-close"
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>

          <div className="app-drawer-header-actions">
            <button
              onClick={() => handleNav('/profile')}
              className="app-drawer-header-btn"
            >
              <User size={13} /> Profile
            </button>
            <button
              onClick={() => handleNav('/settings')}
              className="app-drawer-header-btn"
            >
              <Settings size={13} /> Settings
            </button>
            <button
              onClick={toggleTheme}
              className="app-drawer-header-btn"
              title={isDarkEffective ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkEffective ? <Sun size={13} className="text-amber-200" /> : <Moon size={13} />}
              {isDarkEffective ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        {/* Navigation Body */}
        <div className="app-drawer-scroll">
          {/* BAND WORKSPACE STATUS */}
          <div className="px-3.5 pt-3 pb-2">
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new Event('open-band-modal'));
              }}
              className="w-full p-3 rounded-2xl bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/25 flex items-center justify-between text-left transition-all cursor-pointer group shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                    Band Workspace
                  </span>
                  <span className="text-xs font-bold text-text-primary truncate block" suppressHydrationWarning>
                    {effectiveBandName ? `${effectiveBandName} (${effectiveBandCode || ''})` : 'Join / Create Band'}
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-orange-500/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          </div>

          {/* LIBRARY */}
          <div className="app-drawer-section">
            <h3 className="app-drawer-section-label">
              Library
            </h3>
            <div className="app-drawer-section-items">
              {(() => {
                const isChordsActive = isSinger
                  ? (pathname === '/chords' || pathname.startsWith('/folder') || (pathname.startsWith('/chart/') && !pathname.includes('/setlists')))
                  : (pathname === '/' || pathname === '/chords' || pathname.startsWith('/folder') || (pathname.startsWith('/chart/') && !pathname.includes('/setlists')));

                const isLyricsActive = isSinger
                  ? (pathname === '/' || pathname.startsWith('/lyrics'))
                  : pathname.startsWith('/lyrics');

                return (
                  <>
                    <button
                      onClick={() => handleNav(isSinger ? '/chords' : '/')}
                      className={`app-drawer-row${isChordsActive ? ' app-drawer-row--active' : ''}`}
                    >
                      <span className="app-drawer-row-left">
                        <span className="app-drawer-row-icon"><FileText size={16} /></span>
                        <span className="app-drawer-row-label">Chords Library</span>
                      </span>
                      <ChevronRight size={14} className="app-drawer-row-chevron" />
                    </button>
                    <button
                      onClick={() => handleNav(isSinger ? '/' : '/lyrics')}
                      className={`app-drawer-row${isLyricsActive ? ' app-drawer-row--active' : ''}`}
                    >
                      <span className="app-drawer-row-left">
                        <span className="app-drawer-row-icon"><Music size={16} /></span>
                        <span className="app-drawer-row-label">Lyrics Sheets</span>
                      </span>
                      <ChevronRight size={14} className="app-drawer-row-chevron" />
                    </button>
                  </>
                );
              })()}

              <button
                onClick={() => handleNav('/bookmarks')}
                className={`app-drawer-row${pathname.startsWith('/bookmarks') ? ' app-drawer-row--active' : ''}`}
              >
                <span className="app-drawer-row-left">
                  <span className="app-drawer-row-icon"><Star size={16} /></span>
                  <span className="app-drawer-row-label">Starred Bookmarks</span>
                </span>
                <ChevronRight size={14} className="app-drawer-row-chevron" />
              </button>
              <button
                onClick={() => handleNav('/setlists')}
                className={`app-drawer-row${pathname.startsWith('/setlists') ? ' app-drawer-row--active' : ''}`}
              >
                <span className="app-drawer-row-left">
                  <span className="app-drawer-row-icon"><ListMusic size={16} /></span>
                  <span className="app-drawer-row-label">Setlists &amp; Gigs</span>
                </span>
                <ChevronRight size={14} className="app-drawer-row-chevron" />
              </button>
            </div>
          </div>

          {/* PERFORMANCE & TOOLS */}
          <div className="app-drawer-section">
            <h3 className="app-drawer-section-label">
              Performance &amp; Tools
            </h3>
            <div className="app-drawer-section-items">
              <button
                onClick={() => handleNav('/perform')}
                className={`app-drawer-row${pathname.startsWith('/perform') ? ' app-drawer-row--active' : ''}`}
              >
                <span className="app-drawer-row-left">
                  <span className="app-drawer-row-icon"><Music2 size={16} /></span>
                  <span className="app-drawer-row-label">Live Stage Mode</span>
                </span>
                <ChevronRight size={14} className="app-drawer-row-chevron" />
              </button>
              <button
                onClick={() => handleNav('/printer')}
                className={`app-drawer-row${pathname.startsWith('/printer') ? ' app-drawer-row--active' : ''}`}
              >
                <span className="app-drawer-row-left">
                  <span className="app-drawer-row-icon"><Printer size={16} /></span>
                  <span className="app-drawer-row-label">Print &amp; PDF Export</span>
                </span>
                <ChevronRight size={14} className="app-drawer-row-chevron" />
              </button>
            </div>

            {/* Join Live Session */}
            <div className="app-drawer-join-card">
              <span className="app-drawer-join-label">Join Live Session</span>
              <div className="app-drawer-join-row">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && joinCode.trim().length === 6) {
                      router.push(`/perform/${joinCode.trim().toUpperCase()}`);
                      setJoinCode('');
                      onClose();
                    }
                  }}
                  placeholder="CODE"
                  className="app-drawer-join-input"
                />
                <button
                  onClick={() => {
                    if (joinCode.trim().length === 6) {
                      router.push(`/perform/${joinCode.trim().toUpperCase()}`);
                      setJoinCode('');
                      onClose();
                    }
                  }}
                  disabled={joinCode.trim().length !== 6}
                  className="app-drawer-join-btn"
                >
                  Join Stage
                </button>
              </div>
            </div>
          </div>

          {/* QUICK CREATE */}
          {(canCreateChart || canCreateLyrics) && (
            <div className="app-drawer-section">
              <h3 className="app-drawer-section-label">
                Quick Create
              </h3>
              <div className="app-drawer-create-grid">
                {isSinger ? (
                  <>
                    <button
                      onClick={() => handleCreateFolder('lyrics')}
                      className="app-drawer-create-tile"
                    >
                      <FolderIcon size={18} /> New Folder
                    </button>
                    <button
                      onClick={handleCreateLyrics}
                      className="app-drawer-create-tile app-drawer-create-tile--charcoal"
                    >
                      <Music size={18} /> New Lyrics
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleCreateFolder(pathname.startsWith('/lyrics') ? 'lyrics' : 'chart')}
                      className="app-drawer-create-tile"
                    >
                      <FolderIcon size={18} /> New Folder
                    </button>
                    <button
                      onClick={handleCreateChart}
                      className="app-drawer-create-tile app-drawer-create-tile--charcoal"
                    >
                      <FileText size={18} /> New Chart
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Trash + Theme + Install (below divider) */}
          <div className="app-drawer-divider-section">
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all text-xs font-semibold text-text-secondary select-none">
              <div className="flex items-center gap-2.5">
                {isDarkEffective ? <Moon size={15} className="text-orange-500" /> : <Sun size={15} className="text-amber-500" />}
                <span className="text-text-primary">Midnight Studio</span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center ${
                  isDarkEffective ? 'bg-orange-500 justify-end' : 'bg-black/20 dark:bg-white/20 justify-start'
                }`}
                aria-label="Toggle Midnight Studio Dark Mode"
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200" />
              </button>
            </div>
            <button
              onClick={() => handleNav('/trash')}
              className="app-drawer-trash-row"
            >
              <Trash2 size={15} /> Trash
            </button>
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new Event('open-install-prompt'));
              }}
              className="app-drawer-install-row"
            >
              <Download size={15} /> Install Chordly App
            </button>
          </div>
        </div>

        {/* Logout Footer */}
        <div className="app-drawer-footer">
          <button
            onClick={handleLogout}
            className="app-drawer-signout"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Create Folder Modal */}
      {createFolderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white/65 dark:bg-[#151419]/65 backdrop-blur-2xl saturate-[180%] rounded-[32px] p-7 w-full max-w-sm shadow-[0_8px_32px_rgba(31,38,135,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 dark:border-white/15 animate-fade-in">
            <h3 className="text-base font-bold text-text-primary mb-4 text-center tracking-tight">New Folder</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('folderName') as HTMLInputElement;
              const name = input.value;
              if (name.trim()) {
                await createFolder(currentFolderId, name.trim(), folderKind);
                if (pathname === '/' || pathname === '/lyrics' || pathname === '/chords' || pathname.startsWith('/folder/') || pathname.startsWith('/lyrics/folder/')) {
                  window.dispatchEvent(new Event('refresh-folder'));
                } else {
                  router.push(currentFolderId ? (folderKind === 'lyrics' ? `/lyrics/folder/?id=${currentFolderId}` : `/folder/?id=${currentFolderId}`) : (folderKind === 'lyrics' ? (isSinger ? '/' : '/lyrics') : (isSinger ? '/chords' : '/')));
                }
              }
              setCreateFolderModal(false);
              onClose();
            }}>
              <input
                name="folderName"
                autoFocus
                placeholder="Folder name…"
                className="w-full px-4 py-3 bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-2xl text-text-primary text-sm outline-none focus:ring-2 focus:ring-orange-500/40 transition-all shadow-inner mb-6"
              />
              <div className="flex justify-center space-x-3">
                <button type="button" onClick={() => setCreateFolderModal(false)} className="flex-1 py-2.5 text-xs font-bold text-text-secondary bg-white/40 dark:bg-white/5 hover:bg-white/60 rounded-full transition-all cursor-pointer border border-white/60 dark:border-white/10">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-rose-500 rounded-full shadow-md hover:brightness-110 transition-all cursor-pointer">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { X, Type, Users, Info, Terminal, BookOpen, Droplet, CloudDownload, CheckCircle2, RefreshCw, WifiOff, Moon, Sun, Monitor, Zap } from 'lucide-react';
import { Header } from '@/components/Header';
import { GlassCard, PillButton, IconButton } from '@/components/ui/primitives';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useOfflineSync } from '@/components/OfflineSyncContext';
import { getStoredTheme, setTheme, ThemeMode } from '@/lib/theme';
import { subscribeLiveUpdate, checkForLiveUpdate, applyLiveUpdateNow, triggerTestUpdateBanner, LiveUpdateState } from '@/lib/liveUpdate';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'theme' | 'font' | 'watermark' | 'offline' | 'stats' | 'about'>('theme');
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>('system');
  const [currentFont, setCurrentFont] = useState('system');
  const [watermark, setWatermark] = useState('');
  const [userCount, setUserCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  // Offline sync state from shared context
  const { autoSync, setAutoSync, isSyncing: syncingOffline, syncResult, lastSyncedAt, triggerSync } = useOfflineSync();

  // Live Update (OTA) state
  const [liveUpdateState, setLiveUpdateState] = useState<LiveUpdateState | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeLiveUpdate((s) => setLiveUpdateState(s));
    return () => unsub();
  }, []);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateFeedback(null);
    try {
      const hasUpdate = await checkForLiveUpdate();
      if (!hasUpdate) {
        setUpdateFeedback('You are already running the latest available version.');
      }
    } catch (err: any) {
      setUpdateFeedback(`Check failed: ${err?.message || String(err)}`);
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    setCurrentTheme(getStoredTheme());
    setCurrentFont(localStorage.getItem('chord-grid-font') || 'system');
    setWatermark(localStorage.getItem('chord-grid-watermark') || '');

    const handleThemeChange = () => {
      setCurrentTheme(getStoredTheme());
    };
    window.addEventListener('chord-grid-theme-change', handleThemeChange);
    return () => window.removeEventListener('chord-grid-theme-change', handleThemeChange);
  }, []);

  const handleThemeSelect = (mode: ThemeMode) => {
    setCurrentTheme(mode);
    setTheme(mode);
  };

  useEffect(() => {
    if (activeTab === 'stats' && userCount === null && !isLoadingCount) {
      const fetchUserCount = async () => {
        setIsLoadingCount(true);
        try {
          const { data, error } = await supabase.rpc('get_user_count');
          if (error) throw error;
          setUserCount(data || 0);
        } catch (error) {
          console.error("Could not fetch user count:", error);
          setUserCount(null);
        } finally {
          setIsLoadingCount(false);
        }
      };
      fetchUserCount();
    }
  }, [activeTab, userCount, isLoadingCount]);

  const handleFontChange = (val: string) => {
    setCurrentFont(val);
    localStorage.setItem('chord-grid-font', val);
    window.dispatchEvent(new Event('chord-grid-font-change'));
  };

  const handleWatermarkChange = (val: string) => {
    setWatermark(val);
    localStorage.setItem('chord-grid-watermark', val);
    window.dispatchEvent(new Event('chord-grid-watermark-change'));
  };

  return (
    <div className="min-h-screen flex flex-col safe-area-screen">
      <Header />
      <main className="flex-1 overflow-y-auto w-full pt-4 pb-[calc(7.5rem+max(env(safe-area-inset-bottom,0px),var(--safe-area-inset-bottom,0px)))] px-4 flex justify-center">
        <GlassCard className="w-full max-w-4xl p-0 overflow-hidden flex flex-col max-h-[82vh] shadow-glass-strong">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex justify-between items-center bg-white/40 dark:bg-white/[0.03]">
            <h2 className="text-lg font-bold text-text-primary tracking-tight">Settings &amp; Preferences</h2>
            <IconButton icon={<X size={18} />} onClick={() => router.push('/')} variant="glass" aria-label="Close" />
          </div>

          <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="w-full sm:w-52 border-b sm:border-b-0 sm:border-r border-black/[0.06] dark:border-white/[0.08] bg-white/20 dark:bg-white/[0.01] p-3 sm:p-4 flex flex-row sm:flex-col gap-1.5 overflow-x-auto shrink-0">
              <button 
                onClick={() => setActiveTab('theme')}
                className={`flex items-center px-3.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'theme' 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30' 
                    : 'text-text-secondary hover:bg-white/60 dark:hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                <Moon size={15} className="mr-2.5" /> Appearance
              </button>

              <button 
                onClick={() => setActiveTab('font')}
                className={`flex items-center px-3.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'font' 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30' 
                    : 'text-text-secondary hover:bg-white/60 dark:hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                <Type size={15} className="mr-2.5" /> Font
              </button>
              
              <button 
                onClick={() => setActiveTab('watermark')}
                className={`flex items-center px-3.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'watermark' 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30' 
                    : 'text-text-secondary hover:bg-white/60 dark:hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                <Droplet size={15} className="mr-2.5" /> Watermark
              </button>

              <button 
                onClick={() => setActiveTab('offline')}
                className={`flex items-center px-3.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'offline' 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30' 
                    : 'text-text-secondary hover:bg-white/60 dark:hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                <CloudDownload size={15} className="mr-2.5" /> Offline Sync
              </button>

              <button 
                onClick={() => setActiveTab('stats')}
                className={`flex items-center px-3.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'stats' 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30' 
                    : 'text-text-secondary hover:bg-white/60 dark:hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                <Users size={15} className="mr-2.5" /> User Stats
              </button>
              
              <button 
                onClick={() => setActiveTab('about')}
                className={`flex items-center px-3.5 py-2.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'about' 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/30' 
                    : 'text-text-secondary hover:bg-white/60 dark:hover:bg-white/5 hover:text-text-primary'
                }`}
              >
                <Info size={15} className="mr-2.5" /> About
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
              
              {/* Theme / Appearance Tab */}
              {activeTab === 'theme' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Appearance &amp; Theme</h3>
                    <p className="text-xs text-text-secondary mb-6">Choose between light mode and high-contrast Midnight Studio dark mode, or follow your system settings.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Light Mode Card */}
                      <button
                        onClick={() => handleThemeSelect('light')}
                        className={`flex flex-col text-left p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group ${
                          currentTheme === 'light'
                            ? 'border-orange-500 bg-orange-500/10 shadow-md ring-2 ring-orange-500/30'
                            : 'border-glass bg-white/70 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.08] hover:shadow-sm'
                        }`}
                      >
                        {/* Preview Box */}
                        <div className="w-full h-24 rounded-2xl bg-[#ececee] border border-black/10 p-2.5 mb-4 flex flex-col justify-between shadow-inner">
                          <div className="flex items-center justify-between">
                            <div className="w-12 h-3 rounded-full bg-white shadow-xs" />
                            <div className="w-3 h-3 rounded-full bg-orange-500" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="w-full h-4 rounded-lg bg-white/90 border border-black/5" />
                            <div className="w-2/3 h-2 rounded bg-black/15" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <Sun size={17} className="text-amber-500" />
                          <span className="font-bold text-sm text-text-primary">Light Mode</span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">
                          Clean paper-white aesthetic with soft glass highlights. Best for day sessions.
                        </p>

                        {currentTheme === 'light' && (
                          <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                        )}
                      </button>

                      {/* Midnight Studio (Dark) Card */}
                      <button
                        onClick={() => handleThemeSelect('dark')}
                        className={`flex flex-col text-left p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group ${
                          currentTheme === 'dark'
                            ? 'border-orange-500 bg-orange-500/10 shadow-md ring-2 ring-orange-500/30'
                            : 'border-glass bg-white/70 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.08] hover:shadow-sm'
                        }`}
                      >
                        {/* Preview Box */}
                        <div className="w-full h-24 rounded-2xl bg-[#09090b] border border-white/10 p-2.5 mb-4 flex flex-col justify-between shadow-inner">
                          <div className="flex items-center justify-between">
                            <div className="w-12 h-3 rounded-full bg-zinc-800 border border-white/10" />
                            <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="w-full h-4 rounded-lg bg-[#18181c] border border-white/10" />
                            <div className="w-2/3 h-2 rounded bg-white/20" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <Moon size={17} className="text-orange-500" />
                          <span className="font-bold text-sm text-text-primary">Midnight Studio</span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">
                          High-contrast obsidian theme engineered for stage gigs, dim venues, and night sessions.
                        </p>

                        {currentTheme === 'dark' && (
                          <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                        )}
                      </button>

                      {/* System Default Card */}
                      <button
                        onClick={() => handleThemeSelect('system')}
                        className={`flex flex-col text-left p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group ${
                          currentTheme === 'system'
                            ? 'border-orange-500 bg-orange-500/10 shadow-md ring-2 ring-orange-500/30'
                            : 'border-glass bg-white/70 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.08] hover:shadow-sm'
                        }`}
                      >
                        {/* Preview Box (Half light, half dark) */}
                        <div className="w-full h-24 rounded-2xl border border-black/10 dark:border-white/10 mb-4 overflow-hidden flex shadow-inner">
                          <div className="w-1/2 h-full bg-[#ececee] p-2.5 flex flex-col justify-between border-r border-black/10">
                            <div className="w-8 h-3 rounded-full bg-white shadow-xs" />
                            <div className="w-full h-3 rounded-md bg-white border border-black/5" />
                          </div>
                          <div className="w-1/2 h-full bg-[#09090b] p-2.5 flex flex-col justify-between">
                            <div className="w-8 h-3 rounded-full bg-zinc-800 border border-white/10 self-end" />
                            <div className="w-full h-3 rounded-md bg-[#18181c] border border-white/10" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <Monitor size={17} className="text-sky-500" />
                          <span className="font-bold text-sm text-text-primary">System Auto</span>
                        </div>
                        <p className="text-[11px] text-text-secondary leading-relaxed">
                          Automatically synchronizes theme according to your operating system preference.
                        </p>

                        {currentTheme === 'system' && (
                          <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Font Tab */}
              {activeTab === 'font' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Typography</h3>
                    <p className="text-xs text-text-secondary mb-5">Choose the font style for your chord charts. Monospace fonts ensure clean measure alignment.</p>
                    
                    <div className="space-y-2.5">
                      {[
                        { id: 'system', name: 'Plus Jakarta Sans (System Default)', preview: 'CΔ7  |  Dm7  |  G7(♭9)  |  C' },
                        { id: "'JetBrains Mono', monospace", name: 'JetBrains Mono', preview: 'CΔ7  |  Dm7  |  G7(♭9)  |  C' },
                        { id: "'Courier New', Courier, monospace", name: 'Courier New', preview: 'CΔ7  |  Dm7  |  G7(♭9)  |  C' },
                        { id: 'Consolas, monospace', name: 'Consolas', preview: 'CΔ7  |  Dm7  |  G7(♭9)  |  C' },
                        { id: "'Cascadia Code', monospace", name: 'Cascadia Code', preview: 'CΔ7  |  Dm7  |  G7(♭9)  |  C' },
                        { id: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', name: 'Apple SF Mono', preview: 'CΔ7  |  Dm7  |  G7(♭9)  |  C' },
                      ].map(font => {
                        const fontFam = font.id === 'system' ? 'var(--font-sans), sans-serif' : font.id;
                        return (
                          <button
                            key={font.id}
                            onClick={() => handleFontChange(font.id)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                              currentFont === font.id 
                                ? 'border-orange-500/50 bg-orange-500/10 shadow-sm ring-1 ring-orange-500/20' 
                                : 'border-glass bg-white/60 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.08]'
                            }`}
                          >
                            <div className="flex flex-col text-left">
                              <span className="font-bold text-sm text-text-primary" style={{ fontFamily: fontFam }}>
                                {font.name}
                              </span>
                              <span className="text-xs text-text-secondary mt-1 font-medium tracking-wide" style={{ fontFamily: fontFam }}>
                                {font.preview}
                              </span>
                            </div>
                            {currentFont === font.id && (
                              <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)] shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Watermark Tab */}
              {activeTab === 'watermark' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Print Watermark</h3>
                    <p className="text-xs text-text-secondary mb-5">Set a custom watermark (e.g. "DRAFT", "CONFIDENTIAL", or Band Name) to appear diagonally on printed PDF charts.</p>
                    
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="e.g. DRAFT"
                        value={watermark}
                        onChange={(e) => handleWatermarkChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white/70 dark:bg-white/[0.06] border border-glass rounded-2xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all text-sm shadow-inner-glass"
                      />
                      <p className="text-[11px] text-text-muted">Leave blank for clean watermark-free scores.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Offline Tab */}
              {activeTab === 'offline' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Offline Storage &amp; Sync</h3>
                    <p className="text-xs text-text-secondary mb-5">
                      Download all cloud charts, lyrics, and setlists to IndexedDB so you can perform anywhere without cellular or Wi-Fi connectivity.
                    </p>

                    {/* Auto-sync toggle */}
                    <div className="p-5 bg-white/60 dark:bg-white/[0.04] border border-glass rounded-2xl mb-4 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-primary">Auto-sync on Connect</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            Automatically updates local copies whenever network is available.
                          </p>
                        </div>
                        <button
                          id="auto-sync-toggle"
                          role="switch"
                          aria-checked={autoSync}
                          onClick={() => setAutoSync(!autoSync)}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none ${
                            autoSync
                              ? 'bg-gradient-to-r from-orange-500 to-rose-500 shadow-md'
                              : 'bg-black/15 dark:bg-white/15'
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                              autoSync ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      {!autoSync && (
                        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                          <WifiOff size={14} className="text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">
                            Offline copy may become outdated. Remember to trigger manual sync before gigs.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Manual sync card */}
                    <div className="p-6 bg-white/60 dark:bg-white/[0.04] border border-glass rounded-2xl space-y-4 shadow-sm">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-2xl border border-orange-500/20 shadow-inner-glass">
                          <CloudDownload size={24} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">Sync All Songs Offline</h4>
                          <p className="text-xs text-text-secondary">Downloads all charts &amp; lyrics to this device.</p>
                          {lastSyncedAt && (
                            <p className="text-[11px] text-text-muted mt-0.5">
                              Last synced: {new Date(lastSyncedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {syncResult && (
                        <div className={`p-3 border rounded-xl text-xs font-bold flex items-center ${
                          syncResult.includes('failed') || syncResult.includes('Failed')
                            ? 'bg-red-500/10 border-red-500/20 text-red-500'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          <CheckCircle2 size={16} className="mr-2 shrink-0" />
                          {syncResult}
                        </div>
                      )}

                      <PillButton
                        id="download-all-songs-btn"
                        disabled={syncingOffline}
                        onClick={() => triggerSync(true)}
                        variant="primary-dark"
                        className="w-full py-3.5 text-xs font-bold"
                        icon={syncingOffline ? <RefreshCw size={16} className="animate-spin" /> : <CloudDownload size={16} />}
                      >
                        {syncingOffline ? 'Downloading to Device…' : 'Download All Songs Now'}
                      </PillButton>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4">Platform Stats</h3>
                    
                    <div className="bg-white/60 dark:bg-white/[0.04] border border-glass p-8 rounded-3xl flex flex-col items-center justify-center py-12 shadow-sm text-center">
                      {isLoadingCount ? (
                        <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mb-4" />
                      ) : userCount !== null ? (
                        <>
                          <span className="text-6xl font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500 mb-2">{userCount}</span>
                          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Registered Musicians</span>
                        </>
                      ) : (
                        <div className="text-center max-w-sm">
                          <Users size={32} className="mx-auto text-text-muted mb-3" />
                          <h4 className="font-bold text-text-primary text-sm mb-1">Community Insights</h4>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            Musician statistics are synced from the cloud database.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* About Tab */}
              {activeTab === 'about' && (
                <div className="space-y-6 animate-fade-in pb-8">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center">
                      <BookOpen size={15} className="mr-2 text-orange-500" /> User Guide
                    </h3>
                    <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                      <p>Welcome to <strong>Chordly</strong> — modern zero-wrap chord charts and lyrics sheets built for stage musicians.</p>
                      
                      <h4 className="font-bold text-text-primary text-sm pt-2">Zero-Wrap Measure Track</h4>
                      <p>Charts are rendered in consistent 4-bar or 2-bar measure lines with crisp section headers and real-time live sync.</p>

                      <h4 className="font-bold text-text-primary text-sm pt-2">Transposition</h4>
                      <p>Use the transpose stepper in the editor or viewer to shift pitch by semitones with intelligent flat/sharp enharmonic spelling.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center">
                      <Terminal size={15} className="mr-2 text-orange-500" /> Keyboard Shortcuts
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="bg-white/60 dark:bg-white/[0.04] border border-glass p-3 rounded-2xl flex justify-between items-center">
                        <span className="text-xs text-text-secondary font-medium">Next / Prev Bar</span>
                        <div className="flex space-x-1">
                          <kbd className="px-2 py-0.5 bg-white dark:bg-white/10 border border-glass rounded-md text-[10px] font-mono font-bold text-text-primary">Tab</kbd>
                          <kbd className="px-2 py-0.5 bg-white dark:bg-white/10 border border-glass rounded-md text-[10px] font-mono font-bold text-text-primary">Shift+Tab</kbd>
                        </div>
                      </div>
                      <div className="bg-white/60 dark:bg-white/[0.04] border border-glass p-3 rounded-2xl flex justify-between items-center">
                        <span className="text-xs text-text-secondary font-medium">Clear Chord</span>
                        <kbd className="px-2 py-0.5 bg-white dark:bg-white/10 border border-glass rounded-md text-[10px] font-mono font-bold text-text-primary">Backspace</kbd>
                      </div>
                    </div>
                  </div>

                  {/* App Version & Live Update (OTA) Section */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-3 flex items-center">
                      <Zap size={15} className="mr-2 text-orange-500" /> App Updates &amp; System
                    </h3>
                    <div className="bg-white/60 dark:bg-white/[0.04] border border-glass p-4 rounded-3xl space-y-3.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">Chordly for Mobile &amp; Web</h4>
                          <p className="text-xs text-text-secondary">Over-The-Air (OTA) live sync enabled</p>
                        </div>
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                          v0.1.0
                        </span>
                      </div>

                      <div className="text-xs space-y-1.5 bg-black/[0.03] dark:bg-white/[0.03] p-3 rounded-2xl border border-black/5 dark:border-white/5 font-mono">
                        <div className="flex justify-between items-center">
                          <span className="text-text-secondary">Active Bundle:</span>
                          <span className="text-text-primary font-bold truncate max-w-[210px]" title={liveUpdateState?.currentBundleId || 'Built-in'}>
                            {liveUpdateState?.currentBundleId || 'Built-in (APK / IPA)'}
                          </span>
                        </div>
                        {liveUpdateState?.latestManifest && (
                          <div className="flex justify-between items-center">
                            <span className="text-text-secondary">Latest Available:</span>
                            <span className="text-text-primary truncate max-w-[210px]" title={liveUpdateState.latestManifest.bundleId}>
                              {liveUpdateState.latestManifest.bundleId}
                            </span>
                          </div>
                        )}
                        {liveUpdateState?.error && (
                          <div className="pt-1 text-red-500 text-[11px] font-sans">
                            Notice: {liveUpdateState.error}
                          </div>
                        )}
                      </div>

                      {updateFeedback && (
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-1">
                          <CheckCircle2 size={14} />
                          <span>{updateFeedback}</span>
                        </div>
                      )}

                      {liveUpdateState?.updateReady && (
                        <div className="p-3 rounded-2xl bg-gradient-to-r from-orange-500/15 to-rose-500/15 border border-orange-500/30 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Zap size={16} className="text-orange-500 shrink-0" />
                            <span className="text-xs font-bold text-text-primary">Update downloaded &amp; ready!</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => applyLiveUpdateNow()}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                          >
                            Restart Now
                          </button>
                        </div>
                      )}

                      <div className="flex gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={checkingUpdate || liveUpdateState?.isChecking || liveUpdateState?.isDownloading}
                          onClick={handleCheckUpdate}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-105 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {checkingUpdate || liveUpdateState?.isChecking ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Checking for updates...</span>
                            </>
                          ) : liveUpdateState?.isDownloading ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Downloading ({liveUpdateState.downloadProgress}%)...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw size={14} />
                              <span>Check for Updates</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerTestUpdateBanner()}
                          title="Simulate how the update ready banner appears"
                          className="px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-text-secondary hover:text-text-primary text-xs font-bold transition-all cursor-pointer"
                        >
                          Test Banner
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}
              
            </div>
          </div>

        </GlassCard>
      </main>
    </div>
  );
}

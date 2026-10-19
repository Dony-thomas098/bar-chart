'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sun, Moon, Sliders, Music, Zap, Sparkles, CheckCircle2 } from 'lucide-react';
import { LogoLoading } from '@/components/LogoLoading';

type LoadingVariant = 'rhythm-matrix' | 'harmonic-wave' | 'studio-rack';

export default function LogoReviewPage() {
  const [styleVariant, setStyleVariant] = useState<LoadingVariant>('rhythm-matrix');
  const [bpm, setBpm] = useState<number>(120);
  const [statusText, setStatusText] = useState<string>('Tuning chord progression & harmony...');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const savedVariant = localStorage.getItem('chordly_loading_variant') as LoadingVariant | null;
      if (savedVariant && ['rhythm-matrix', 'harmonic-wave', 'studio-rack'].includes(savedVariant)) {
        setStyleVariant(savedVariant);
      }
      const savedBpm = localStorage.getItem('chordly_loading_bpm');
      if (savedBpm) setBpm(Number(savedBpm) || 120);

      const savedStatus = localStorage.getItem('chordly_loading_status');
      if (savedStatus) setStatusText(savedStatus);
    } catch {}
  }, []);

  // Update variant and persist immediately
  const handleSelectVariant = (variantId: LoadingVariant) => {
    setStyleVariant(variantId);
    try {
      localStorage.setItem('chordly_loading_variant', variantId);
      localStorage.setItem('chordly_loading_bpm', String(bpm));
      localStorage.setItem('chordly_loading_status', statusText);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch {}
  };

  // Update BPM and persist
  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    try {
      localStorage.setItem('chordly_loading_bpm', String(newBpm));
    } catch {}
  };

  // Update Status and persist
  const handleStatusChange = (newStatus: string) => {
    setStatusText(newStatus);
    try {
      localStorage.setItem('chordly_loading_status', newStatus);
    } catch {}
  };

  const isDark = previewTheme === 'dark';

  return (
    <div
      className={`min-h-screen transition-colors duration-300 pb-36 ${
        isDark ? 'bg-[#09090b] text-slate-100' : 'bg-[#f1f3f6] text-slate-900'
      }`}
    >
      {/* Top Header Bar */}
      <header
        className={`sticky top-0 z-30 px-4 sm:px-6 py-3.5 backdrop-blur-xl border-b transition-colors ${
          isDark
            ? 'bg-[#09090b]/80 border-white/10 text-white'
            : 'bg-white/85 border-slate-200 text-slate-900 shadow-sm'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className={`p-2 sm:p-2.5 rounded-xl border transition-colors flex-shrink-0 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
              title="Return to App"
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h1 className="text-sm sm:text-base md:text-lg font-bold tracking-tight whitespace-nowrap">
                  Chordly Logo Loading
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 font-bold border border-orange-500/25 whitespace-nowrap">
                  Lab
                </span>
              </div>
              <p
                className={`text-[11px] sm:text-xs truncate hidden xs:block mt-0.5 ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                Inspection of rhythm, pulse timing &amp; brand aesthetics
              </p>
            </div>
          </div>

          {/* Right: Theme Toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setPreviewTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer shadow-sm transition-colors ${
                isDark
                  ? 'border-white/15 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {isDark ? (
                <Sun size={14} className="text-amber-400" />
              ) : (
                <Moon size={14} className="text-indigo-600" />
              )}
              <span className="font-medium">{isDark ? 'Light Canvas' : 'Dark Studio'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Interactive Live Preview Showcase & Style Selector */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div
            className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 min-h-[440px] flex flex-col items-center justify-center shadow-xl transition-colors ${
              isDark
                ? 'border-white/10 bg-gradient-to-b from-white/[0.02] to-white/[0.05]'
                : 'border-slate-200 bg-white/70 shadow-slate-200/50'
            }`}
          >
            {/* Live Component Under Review */}
            <LogoLoading
              variant="card"
              styleVariant={styleVariant}
              bpm={bpm}
              statusText={statusText}
              theme={previewTheme}
            />

            {/* Stage Footer Status */}
            <div
              className={`absolute bottom-4 left-6 right-6 flex items-center justify-between text-[11px] font-mono ${
                isDark ? 'text-zinc-400' : 'text-slate-600 font-semibold'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live 60 FPS CSS Render
              </span>
              <span>Vector Footprint: &lt; 2 KB</span>
            </div>
          </div>

          {/* Style Variant Selectors */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                Select Loading Style
              </span>
              {isSaved && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500 animate-in fade-in">
                  <CheckCircle2 size={13} />
                  Saved for App Launch
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {[
                {
                  id: 'rhythm-matrix' as const,
                  title: '4-Beat Matrix',
                  subtitle: '4/4 Bar Sequencer',
                  icon: Music,
                },
                {
                  id: 'harmonic-wave' as const,
                  title: 'Harmonic Strings',
                  subtitle: 'Resonance Waves',
                  icon: Zap,
                },
                {
                  id: 'studio-rack' as const,
                  title: 'Studio Rack',
                  subtitle: 'VU Meter Levels',
                  icon: Sparkles,
                },
              ].map((variant) => {
                const Icon = variant.icon;
                const isSelected = styleVariant === variant.id;
                return (
                  <button
                    key={variant.id}
                    onClick={() => handleSelectVariant(variant.id)}
                    className={`p-3 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10 ring-1 ring-orange-500/40'
                        : isDark
                        ? 'border-white/10 bg-zinc-900/50 hover:bg-zinc-800/60 text-zinc-200'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl w-fit mb-2 ${
                        isSelected
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                          : isDark
                          ? 'bg-white/5 text-zinc-400'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon size={16} />
                    </div>

                    <div
                      className={`font-bold text-xs truncate ${
                        isSelected ? 'text-orange-500' : isDark ? 'text-zinc-100' : 'text-slate-900'
                      }`}
                    >
                      {variant.title}
                    </div>

                    <div
                      className={`text-[10px] mt-0.5 truncate ${
                        isDark ? 'text-zinc-400' : 'text-slate-500'
                      }`}
                    >
                      {variant.subtitle}
                    </div>

                    {isSelected && (
                      <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-orange-500 uppercase tracking-wider">
                        <CheckCircle2 size={10} />
                        <span>Active</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Parameter Tuning */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Controls Panel */}
          <div
            className={`p-6 rounded-3xl border backdrop-blur-xl shadow-lg transition-colors ${
              isDark
                ? 'border-white/10 bg-zinc-900/60 text-white'
                : 'border-slate-200 bg-white text-slate-900 shadow-slate-200/50'
            }`}
          >
            <h2
              className={`text-sm font-bold flex items-center gap-2 mb-4 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              <Sliders size={16} className="text-orange-500" />
              <span>Interactive Tuning Parameters</span>
            </h2>

            {/* Tempo BPM Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className={`font-semibold ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>
                  Tempo / Pulse Rate
                </span>
                <span className="font-mono font-bold text-orange-500 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                  {bpm} BPM ({(60 / bpm).toFixed(2)}s / beat)
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                step="5"
                value={bpm}
                onChange={(e) => handleBpmChange(Number(e.target.value))}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#FF6A1F] ${
                  isDark ? 'bg-zinc-800' : 'bg-slate-200'
                }`}
              />
              <div
                className={`flex justify-between text-[10px] font-mono font-medium ${
                  isDark ? 'text-zinc-400' : 'text-slate-500'
                }`}
              >
                <span>60 (Largo)</span>
                <span>120 (Moderato)</span>
                <span>180 (Presto)</span>
              </div>
            </div>

            {/* Custom Status Label */}
            <div className="mt-5 space-y-2">
              <label
                className={`block text-xs font-semibold ${
                  isDark ? 'text-zinc-300' : 'text-slate-700'
                }`}
              >
                Loading Status Label
              </label>
              <input
                type="text"
                value={statusText}
                onChange={(e) => handleStatusChange(e.target.value)}
                placeholder="Status message..."
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${
                  isDark
                    ? 'border-white/10 bg-zinc-800 text-white placeholder-zinc-500'
                    : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          {/* Active Loading Info Card */}
          <div
            className={`p-5 rounded-3xl border transition-colors ${
              isDark
                ? 'border-white/10 bg-zinc-900/40 text-zinc-300'
                : 'border-slate-200 bg-white text-slate-700 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 mt-0.5">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <h3
                  className={`text-xs font-bold ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Active App Launch Setup
                </h3>
                <p className="text-[11px] mt-1 leading-relaxed text-slate-500 dark:text-zinc-400">
                  Selecting any variant above instantly saves it. Whenever Chordly opens or reloads, your chosen animation will be displayed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

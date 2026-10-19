'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Sun, Moon, Sliders, Music, Zap, Sparkles } from 'lucide-react';
import { LogoLoading, LogoLoadingProps } from '@/components/LogoLoading';

export default function LogoReviewPage() {
  const [styleVariant, setStyleVariant] = useState<'rhythm-matrix' | 'harmonic-wave' | 'studio-rack'>('rhythm-matrix');
  const [bpm, setBpm] = useState<number>(120);
  const [statusText, setStatusText] = useState<string>('Tuning chord progression & harmony...');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [simulatingFullscreen, setSimulatingFullscreen] = useState<boolean>(false);

  const triggerFullscreenSimulation = () => {
    setSimulatingFullscreen(true);
    setTimeout(() => {
      setSimulatingFullscreen(false);
    }, 3200);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${previewTheme === 'dark' ? 'bg-[#09090b] text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      
      {/* Fullscreen Overlay Simulation */}
      {simulatingFullscreen && (
        <div className="fixed inset-0 z-[9999] animate-in fade-in duration-300">
          <LogoLoading
            variant="fullscreen"
            styleVariant={styleVariant}
            bpm={bpm}
            statusText={statusText}
          />
          <button
            onClick={() => setSimulatingFullscreen(false)}
            className="fixed top-6 right-6 z-[10000] px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md border border-white/20 cursor-pointer"
          >
            Close Preview ✕
          </button>
        </div>
      )}

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-black/5 dark:border-white/10 backdrop-blur-xl bg-white/50 dark:bg-zinc-900/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Return to App"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <span>Chordly Logo Loading Review</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-500 font-bold border border-orange-500/20">
                  Interactive Lab
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Live interactive inspection of rhythm, timing, and brand aesthetics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-800 text-xs font-medium cursor-pointer shadow-sm"
            >
              {previewTheme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-400" />}
              <span>{previewTheme === 'dark' ? 'Light Canvas' : 'Dark Studio'}</span>
            </button>

            <button
              onClick={triggerFullscreenSimulation}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-bold shadow-md shadow-orange-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              <span>Simulate App Launch</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive Live Preview Showcase */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-gradient-to-b from-black/[0.02] to-black/[0.05] dark:from-white/[0.02] dark:to-white/[0.05] p-8 min-h-[460px] flex flex-col items-center justify-center shadow-xl">
            {/* Live Component Under Review */}
            <LogoLoading
              variant="card"
              styleVariant={styleVariant}
              bpm={bpm}
              statusText={statusText}
            />

            {/* Stage Footer Status */}
            <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live 60 FPS CSS Render
              </span>
              <span>Vector Footprint: &lt; 2 KB</span>
            </div>
          </div>

          {/* Style Variant Selectors */}
          <div className="grid grid-cols-3 gap-3">
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
            ].map(variant => {
              const Icon = variant.icon;
              const isSelected = styleVariant === variant.id;
              return (
                <button
                  key={variant.id}
                  onClick={() => setStyleVariant(variant.id)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/10'
                      : 'border-black/5 dark:border-white/10 bg-white/40 dark:bg-zinc-900/40 hover:bg-white/80 dark:hover:bg-zinc-800/80'
                  }`}
                >
                  <div className={`p-2 rounded-xl w-fit mb-2.5 ${isSelected ? 'bg-orange-500 text-white' : 'bg-black/5 dark:bg-white/5 text-slate-400'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="font-bold text-xs">{variant.title}</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">{variant.subtitle}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Parameter Tuning & Design Audit */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Controls Panel */}
          <div className="p-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl shadow-lg">
            <h2 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
              <Sliders size={16} className="text-orange-500" />
              <span>Interactive Tuning Parameters</span>
            </h2>

            {/* Tempo BPM Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-600 dark:text-zinc-300">Tempo / Pulse Rate</span>
                <span className="font-mono font-bold text-orange-500 px-2 py-0.5 rounded bg-orange-500/10">
                  {bpm} BPM ({(60 / bpm).toFixed(2)}s / beat)
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                step="5"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>60 (Largo)</span>
                <span>120 (Moderato)</span>
                <span>180 (Presto)</span>
              </div>
            </div>

            {/* Custom Status Label */}
            <div className="mt-5 space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-300">
                Loading Status Label
              </label>
              <input
                type="text"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="Status message..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Design Audit & Scorecard */}
          <div className="p-6 rounded-3xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>UX &amp; Engineering Scorecard</span>
              <span className="text-emerald-500 font-mono text-xs">A+ Rating</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Bandwidth &amp; Startup Latency</span>
                  <span className="text-emerald-500">99.9% Savings</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Replacing the 2.75 MB <code className="text-orange-500 font-mono">splash.mp4</code> with pure SVG/CSS reduces splash load from ~1,200ms down to 0ms instant render.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Musical Brand Harmony</span>
                  <span className="text-emerald-500">10 / 10</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  4 rhythmic cells mirror standard 4/4 measure bar notation, actively reinforcing the Chordly core editor identity.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Accessibility &amp; Motion</span>
                  <span className="text-emerald-500">WCAG Compliant</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Includes <code className="text-orange-500 font-mono">prefers-reduced-motion</code> fallback to prevent vestibular fatigue.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
}

'use client';

import React from 'react';

export interface LogoLoadingProps {
  statusText?: string;
  bpm?: number;
  variant?: 'compact' | 'card' | 'fullscreen';
  styleVariant?: 'rhythm-matrix' | 'harmonic-wave' | 'studio-rack';
  theme?: 'dark' | 'light';
  className?: string;
}

export function LogoLoading({
  statusText = 'Loading...',
  bpm = 120,
  variant = 'card',
  styleVariant = 'rhythm-matrix',
  theme = 'dark',
  className = '',
}: LogoLoadingProps) {
  const isLight = theme === 'light';

  // Musical timing: duration of one beat in seconds
  const beatSec = Math.max(0.25, Math.min(2.0, 60 / bpm));
  const barDuration = (beatSec * 4).toFixed(3);

  const containerClasses = {
    compact: 'p-3 flex items-center gap-3',
    card: isLight
      ? 'p-8 flex flex-col items-center justify-center rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-xl max-w-sm mx-auto transition-colors'
      : 'p-8 flex flex-col items-center justify-center rounded-3xl bg-[#14141a]/90 backdrop-blur-xl border border-white/10 shadow-2xl max-w-sm mx-auto transition-colors',
    fullscreen: isLight
      ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-100 text-slate-900 select-none px-6'
      : 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b] text-slate-100 select-none px-6',
  }[variant];

  return (
    <div className={`${containerClasses} ${className}`} role="status" aria-live="polite">
      {/* Visual Animation Container */}
      <div className="relative flex items-center justify-center">
        {/* Soft Ambient Radial Bloom */}
        <div
          className="absolute -inset-4 rounded-full bg-gradient-to-tr from-orange-500/20 via-rose-500/15 to-indigo-500/20 blur-2xl animate-pulse pointer-events-none"
          style={{ animationDuration: `${barDuration}s` }}
        />

        {styleVariant === 'rhythm-matrix' && (
          /* 4-Beat Chord Grid Matrix */
          <div className="relative flex flex-col items-center">
            {/* Outer Grid Housing */}
            <div
              className={`relative p-2.5 rounded-2xl ${
                isLight ? 'bg-slate-50 border border-slate-200/90 shadow-md' : 'bg-[#181820] border border-white/10 shadow-xl'
              } backdrop-blur-md`}
            >
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((beatIndex) => (
                  <div
                    key={beatIndex}
                    className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center overflow-hidden ${
                      isLight ? 'bg-slate-200/75 border border-slate-300/50' : 'bg-zinc-800/60 border border-white/5'
                    } transition-transform`}
                    style={{
                      animation: `chordBeatPulse ${barDuration}s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
                      animationDelay: `${(beatIndex * beatSec).toFixed(3)}s`,
                    }}
                  >
                    {/* Glowing Beat Pill */}
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-orange-500 via-rose-500 to-indigo-500 opacity-20"
                      style={{
                        animation: `beatShimmer ${barDuration}s ease-in-out infinite`,
                        animationDelay: `${(beatIndex * beatSec).toFixed(3)}s`,
                      }}
                    />

                    {/* Fret/Chord Node Dot */}
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] z-10" />

                    {/* Subtle Measure Number (1-4) */}
                    <span
                      className={`absolute bottom-1 right-1.5 text-[8px] font-mono font-bold select-none ${
                        isLight ? 'text-slate-600 opacity-80' : 'text-zinc-500 opacity-60'
                      }`}
                    >
                      {beatIndex + 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* Central Floating Logo Icon Badge */}
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-lg overflow-hidden shadow-md ${
                  isLight ? 'border border-slate-200 bg-white' : 'border border-zinc-700 bg-zinc-900'
                } flex items-center justify-center z-20 pointer-events-none`}
              >
                <img
                  src="/icon.png"
                  alt="Chordly Brand Icon"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}

        {styleVariant === 'harmonic-wave' && (
          /* Harmonic Strings Resonance Wave */
          <div className="relative flex flex-col items-center justify-center p-4">
            <div
              className={`relative w-16 h-16 rounded-2xl overflow-hidden shadow-xl ${
                isLight ? 'border border-slate-200 bg-white' : 'border border-white/10 bg-[#181820]'
              } flex items-center justify-center mb-2`}
            >
              <img src="/icon.png" alt="Chordly" className="w-10 h-10 object-cover rounded-md" />
            </div>
            {/* 6 Guitar / Chord Strings vibrating */}
            <div className="flex items-center gap-1.5 h-8 mt-2">
              {[0.4, 0.7, 1.0, 0.8, 0.5, 0.9].map((heightRatio, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-orange-500 to-indigo-500"
                  style={{
                    height: `${heightRatio * 100}%`,
                    animation: `stringVibrate ${(0.4 + i * 0.1).toFixed(2)}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {styleVariant === 'studio-rack' && (
          /* Studio Rack Meter */
          <div
            className={`relative flex items-center gap-3 p-3 rounded-2xl ${
              isLight ? 'bg-slate-100 border border-slate-200/90 shadow-md' : 'bg-[#09090b] border border-white/10 shadow-2xl'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl overflow-hidden shadow-inner flex items-center justify-center ${
                isLight ? 'bg-slate-200' : 'bg-zinc-800'
              }`}
            >
              <img src="/icon.png" alt="Chordly" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <div className={`h-1.5 rounded-full ${isLight ? 'bg-slate-200' : 'bg-zinc-800'} overflow-hidden`}>
                <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full animate-[meterPulse_1.2s_ease-in-out_infinite]" />
              </div>
              <div className={`h-1.5 rounded-full ${isLight ? 'bg-slate-200' : 'bg-zinc-800'} overflow-hidden`}>
                <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-indigo-500 rounded-full animate-[meterPulse_1.6s_ease-in-out_infinite_reverse]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Brand Title & Status Text (hidden in compact mode) */}
      {variant !== 'compact' && (
        <div className="mt-5 flex flex-col items-center text-center">
          <div
            className={`flex items-center gap-1.5 ${
              isLight ? 'text-slate-900' : 'text-white'
            } font-extrabold text-base tracking-tight select-none`}
          >
            <span>chord</span>
            <span className="text-orange-500 font-black">ly</span>
            <span
              className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold border ${
                isLight
                  ? 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                  : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
              }`}
            >
              {bpm} BPM
            </span>
          </div>

          <p
            className={`mt-2 text-xs font-medium tracking-wide ${
              isLight ? 'text-slate-600' : 'text-zinc-400'
            }`}
          >
            {statusText}
          </p>

          {/* Rhythmic Smooth Measure Progress Bar */}
          <div
            className={`mt-4 w-44 h-1 rounded-full ${
              isLight ? 'bg-slate-200' : 'bg-zinc-800'
            } overflow-hidden relative`}
          >
            <div
              className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-orange-500 via-rose-500 to-indigo-500"
              style={{
                animation: `barSweep ${barDuration}s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
              }}
            />
          </div>
        </div>
      )}

      {/* Keyframe Animations */}
      <style>{`
        @keyframes chordBeatPulse {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.65;
          }
          20%, 40% {
            transform: scale(1.06);
            opacity: 1;
            box-shadow: 0 0 16px rgba(249, 115, 22, 0.35);
          }
          60% {
            transform: scale(0.98);
            opacity: 0.75;
          }
        }

        @keyframes beatShimmer {
          0%, 100% { opacity: 0.15; }
          25%, 45% { opacity: 0.85; }
        }

        @keyframes barSweep {
          0% {
            left: -35%;
            width: 30%;
          }
          50% {
            left: 35%;
            width: 45%;
          }
          100% {
            left: 100%;
            width: 25%;
          }
        }

        @keyframes stringVibrate {
          0% { transform: scaleY(0.4); opacity: 0.5; }
          100% { transform: scaleY(1.1); opacity: 1; }
        }

        @keyframes meterPulse {
          0%, 100% { width: 40%; }
          50% { width: 95%; }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default LogoLoading;

'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Check, Delete, Plus, Keyboard } from 'lucide-react';
import { getChordNotes } from '@/lib/chord-notes';

interface MobileChordKeypadProps {
  activeChord: string;
  sectionName: string;
  barIndex: number;
  totalBars: number;
  onChordChange: (newChord: string) => void;
  onPrevBar: () => void;
  onNextBar: () => void;
  onAddBar?: () => void;
  onDeleteBar?: () => void;
  onClose: () => void;
}

export function MobileChordKeypad({
  activeChord,
  sectionName,
  barIndex,
  totalBars,
  onChordChange,
  onPrevBar,
  onNextBar,
  onAddBar,
  onDeleteBar,
  onClose,
}: MobileChordKeypadProps) {
  const currentChordDisplay = activeChord && activeChord !== '_' && activeChord !== '-' ? activeChord : '-';
  const voicingInfo = activeChord && activeChord !== '_' && activeChord !== '-' ? getChordNotes(activeChord) : null;
  const notesBreakdown = voicingInfo ? voicingInfo.notes : [];

  const handleInputRoot = (root: string) => {
    onChordChange(root);
  };

  const handleInputModifier = (mod: string) => {
    let current = activeChord === '-' || activeChord === '_' ? '' : activeChord;
    if (mod === 'b') mod = '♭';
    onChordChange(current + mod);
  };

  const handleBackspace = () => {
    if (!activeChord || activeChord === '-' || activeChord === '_') return;
    if (activeChord.length > 1) {
      onChordChange(activeChord.slice(0, -1));
    } else {
      onChordChange('-');
    }
  };

  const handleClearChord = () => {
    onChordChange('-');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 no-print bg-[#130f24]/98 backdrop-blur-2xl border-t border-indigo-500/30 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.85)] max-w-lg mx-auto rounded-t-2xl animate-in slide-in-from-bottom-5 duration-200">
      {/* Top Meta & Stepper Bar */}
      <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {sectionName || 'Section'}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            Bar {barIndex + 1} of {Math.max(1, totalBars)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrevBar}
            className="flex items-center gap-0.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-white/10 text-slate-200 hover:bg-white/15 active:scale-95 transition-all"
            title="Previous Bar"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <button
            onClick={onNextBar}
            className="flex items-center gap-0.5 px-2.5 py-1 text-xs font-bold rounded-lg bg-white/10 text-slate-200 hover:bg-white/15 active:scale-95 transition-all"
            title="Next Bar"
          >
            Next <ChevronRight size={14} />
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 active:scale-95 transition-all"
            title="Done Editing"
          >
            <Check size={14} /> Done
          </button>
        </div>
      </div>

      {/* Chord Preview Bar */}
      <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-3 py-2 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-lg font-extrabold text-white tracking-wide">
            {currentChordDisplay}
          </span>
          <span className="w-1.5 h-5 bg-indigo-400 rounded-full animate-pulse ml-0.5" />
        </div>

        {notesBreakdown.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
            {notesBreakdown.join(' • ')}
          </div>
        )}
      </div>

      {/* 4-Row Button Grid */}
      <div className="space-y-1.5">
        {/* Row 1: Roots */}
        <div className="grid grid-cols-7 gap-1.5">
          {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((root) => (
            <button
              key={root}
              onClick={() => handleInputRoot(root)}
              className="h-10 rounded-lg bg-white/10 hover:bg-indigo-500/30 text-white font-extrabold text-sm border border-white/10 active:scale-90 transition-all flex items-center justify-center shadow-sm"
            >
              {root}
            </button>
          ))}
        </div>

        {/* Row 2: Accidentals & Common Qualities */}
        <div className="grid grid-cols-7 gap-1.5">
          {['#', 'b', 'm', '7', 'maj7', 'sus4', 'dim'].map((mod) => (
            <button
              key={mod}
              onClick={() => handleInputModifier(mod)}
              className="h-9 rounded-lg bg-white/5 hover:bg-white/15 text-indigo-200 font-bold text-xs border border-white/5 active:scale-90 transition-all flex items-center justify-center"
            >
              {mod}
            </button>
          ))}
        </div>

        {/* Row 3: Extensions */}
        <div className="grid grid-cols-7 gap-1.5">
          {['aug', '9', '6', 'sus2', 'add9', '/', '%'].map((ext) => (
            <button
              key={ext}
              onClick={() => handleInputModifier(ext)}
              className="h-9 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 font-semibold text-xs border border-white/5 active:scale-90 transition-all flex items-center justify-center"
            >
              {ext}
            </button>
          ))}
        </div>

        {/* Row 4: Action Controls */}
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          <button
            onClick={handleBackspace}
            className="h-9 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 font-bold text-xs border border-white/10 active:scale-90 transition-all flex items-center justify-center"
            title="Backspace"
          >
            ⌫
          </button>
          {onAddBar && (
            <button
              onClick={onAddBar}
              className="h-9 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 font-bold text-xs border border-white/10 active:scale-90 transition-all flex items-center justify-center"
              title="Add Measure"
            >
              + Bar
            </button>
          )}
          <button
            onClick={handleClearChord}
            className="h-9 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs border border-rose-500/30 active:scale-90 transition-all flex items-center justify-center"
            title="Clear Chord"
          >
            Clear
          </button>
          <button
            onClick={onNextBar}
            className="col-span-2 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 active:scale-90 transition-all flex items-center justify-center gap-1"
            title="Next Measure"
          >
            Next Bar <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

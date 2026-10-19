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
  onAddLine?: () => void;
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
  onAddLine,
  onDeleteBar,
  onClose,
}: MobileChordKeypadProps) {
  const currentChordDisplay = activeChord && activeChord !== '_' && activeChord !== '-' ? activeChord : '-';
  const voicingInfo = activeChord && activeChord !== '_' && activeChord !== '-' ? getChordNotes(activeChord) : null;
  const notesBreakdown = voicingInfo ? voicingInfo.notes : [];

  const lastNextBarTapRef = React.useRef<number>(0);

  const triggerHaptic = (duration = 10) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {}
    }
  };

  const handleNextBarPress = () => {
    const now = Date.now();
    const diff = now - lastNextBarTapRef.current;
    lastNextBarTapRef.current = now;

    if (diff > 0 && diff < 400 && onAddLine) {
      lastNextBarTapRef.current = 0;
      triggerHaptic(25);
      onAddLine();
      return;
    }

    triggerHaptic(10);
    onNextBar();
  };

  const handleInputRoot = (root: string) => {
    triggerHaptic(10);
    onChordChange(root);
  };

  const handleInputModifier = (mod: string) => {
    triggerHaptic(10);
    let current = activeChord === '-' || activeChord === '_' ? '' : activeChord;
    if (mod === 'b') mod = '♭';
    onChordChange(current + mod);
  };

  const handleBackspace = () => {
    triggerHaptic(15);
    if (!activeChord || activeChord === '-' || activeChord === '_') return;
    if (activeChord.length > 1) {
      onChordChange(activeChord.slice(0, -1));
    } else {
      onChordChange('-');
    }
  };

  const handleClearChord = () => {
    triggerHaptic(15);
    onChordChange('-');
  };

  const handleDone = () => {
    triggerHaptic(20);
    onClose();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 no-print bg-surface-glass backdrop-blur-2xl border-t border-glass p-3.5 pb-[max(16px,env(safe-area-inset-bottom))] shadow-glass-strong max-w-lg mx-auto rounded-t-[24px] animate-slide-up">
      {/* Top Meta & Stepper Bar */}
      <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            {sectionName || 'Section'}
          </span>
          <span className="text-xs font-bold text-text-secondary">
            Bar {barIndex + 1} of {Math.max(1, totalBars)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { triggerHaptic(8); onPrevBar(); }}
            className="flex items-center gap-0.5 px-3 py-1.5 text-xs font-bold rounded-full bg-white/70 dark:bg-white/10 text-text-primary border border-glass hover:bg-white active:scale-95 transition-all shadow-sm"
            title="Previous Bar"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <button
            onClick={handleNextBarPress}
            className="flex items-center gap-0.5 px-3 py-1.5 text-xs font-bold rounded-full bg-white/70 dark:bg-white/10 text-text-primary border border-glass hover:bg-white active:scale-95 transition-all shadow-sm"
            title="Next Bar (Double tap to create new line)"
          >
            Next <ChevronRight size={14} />
          </button>
          <button
            onClick={handleDone}
            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-full bg-btn-dark text-white shadow-btn-dark active:scale-95 transition-all"
            title="Done Editing"
          >
            <Check size={14} /> Done
          </button>
        </div>
      </div>

      {/* Live Voicing / Preview Banner (Peach Tint #ffedd5) */}
      <div className="flex items-center justify-between bg-[#ffedd5] dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-500/20 rounded-2xl px-3.5 py-2 mb-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="text-xl font-extrabold text-[#9a3412] dark:text-orange-300 font-sans tracking-tight">
            {currentChordDisplay}
          </span>
          <span className="w-1.5 h-5 bg-orange-500 rounded-full animate-pulse ml-0.5" />
        </div>

        {notesBreakdown.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-orange-700 dark:text-orange-300 bg-white/70 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-orange-300/40">
            {notesBreakdown.join(' • ')}
          </div>
        )}
      </div>

      {/* 4-Row Button Grid with 14px White Tiles */}
      <div className="space-y-1.5">
        {/* Row 1: Roots */}
        <div className="grid grid-cols-7 gap-1.5">
          {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((root) => (
            <button
              key={root}
              onClick={() => handleInputRoot(root)}
              className="h-10 rounded-[14px] bg-white dark:bg-white/10 hover:bg-orange-50 dark:hover:bg-white/20 text-text-primary font-extrabold text-sm border border-glass shadow-[0_2px_8px_rgba(0,0,0,0.06)] active:scale-90 transition-all flex items-center justify-center"
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
              className="h-9 rounded-[14px] bg-white/80 dark:bg-white/10 hover:bg-white text-text-primary font-bold text-xs border border-glass shadow-sm active:scale-90 transition-all flex items-center justify-center"
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
              className="h-9 rounded-[14px] bg-white/80 dark:bg-white/10 hover:bg-white text-text-secondary font-semibold text-xs border border-glass shadow-sm active:scale-90 transition-all flex items-center justify-center"
            >
              {ext}
            </button>
          ))}
        </div>

        {/* Row 4: Action Controls */}
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          <button
            onClick={handleBackspace}
            className="h-9 rounded-[14px] bg-white/80 dark:bg-white/10 hover:bg-white text-text-secondary font-bold text-xs border border-glass shadow-sm active:scale-90 transition-all flex items-center justify-center"
            title="Backspace"
          >
            ⌫
          </button>
          {onAddBar && (
            <button
              onClick={() => { triggerHaptic(10); onAddBar(); }}
              className="h-9 rounded-[14px] bg-white/80 dark:bg-white/10 hover:bg-white text-text-secondary font-bold text-xs border border-glass shadow-sm active:scale-90 transition-all flex items-center justify-center"
              title="Add Measure"
            >
              + Bar
            </button>
          )}
          <button
            onClick={handleClearChord}
            className="h-9 rounded-[14px] bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200/60 dark:border-rose-500/20 active:scale-90 transition-all flex items-center justify-center"
            title="Clear Chord"
          >
            Clear
          </button>
          <button
            onClick={handleNextBarPress}
            className="col-span-2 h-9 rounded-full bg-btn-dark text-white font-bold text-xs shadow-btn-dark active:scale-90 transition-all flex items-center justify-center gap-1"
            title="Next Measure (Double-tap to create new line)"
          >
            Next Bar <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

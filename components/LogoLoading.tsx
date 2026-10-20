'use client';

import React from 'react';
import { ChordlyLoader } from './ChordlyLoader';

export interface LogoLoadingProps {
  statusText?: string;
  bpm?: number;
  variant?: 'compact' | 'card' | 'fullscreen';
  styleVariant?: string;
  theme?: 'dark' | 'light';
  className?: string;
  isDone?: boolean;
  onFadeComplete?: () => void;
}

/**
 * Standard Chordly Loading Component.
 * Visuals: Pure animated logo loader (four concentric arcs, center dot pulse, shockwave,
 * lens-flare sweep, canvas sparks burst, wordmark, and fading ellipsis status text).
 * Sits directly on the background without cards, BPM badges, or progress bars.
 */
export function LogoLoading({
  statusText = 'Synchronizing your catalog',
  className = '',
  isDone,
  onFadeComplete,
}: LogoLoadingProps) {
  return (
    <div className={`w-full h-full min-h-screen flex items-center justify-center ${className}`}>
      <ChordlyLoader
        statusText={statusText}
        isDone={isDone}
        onFadeComplete={onFadeComplete}
      />
    </div>
  );
}

export default LogoLoading;

'use client';

import React from 'react';
import { ChordlyLogo } from '@/components/ChordlyLogo';

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-canvas)] select-none">
      <ChordlyLogo variant="stacked" animate className="w-[min(70vw,380px)] h-auto" />
    </div>
  );
}


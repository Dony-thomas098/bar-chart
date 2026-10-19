'use client';

import React, { useEffect, useState } from 'react';
import { LogoLoading } from '@/components/LogoLoading';

type LoadingVariant = 'rhythm-matrix' | 'harmonic-wave' | 'studio-rack';

export default function Loading() {
  const [variant, setVariant] = useState<LoadingVariant>('rhythm-matrix');
  const [bpm, setBpm] = useState<number>(120);
  const [status, setStatus] = useState<string>('Tuning chord progression & harmony...');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chordly_loading_variant') as LoadingVariant | null;
      if (saved && ['rhythm-matrix', 'harmonic-wave', 'studio-rack'].includes(saved)) {
        setVariant(saved);
      }
      const savedBpm = localStorage.getItem('chordly_loading_bpm');
      if (savedBpm) setBpm(Number(savedBpm) || 120);

      const savedStatus = localStorage.getItem('chordly_loading_status');
      if (savedStatus) setStatus(savedStatus);
    } catch {}
  }, []);

  return (
    <LogoLoading 
      variant="fullscreen" 
      statusText={status} 
      bpm={bpm}
      styleVariant={variant}
    />
  );
}

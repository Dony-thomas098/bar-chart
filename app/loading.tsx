import React from 'react';
import LogoLoading from '@/components/LogoLoading';

export default function Loading() {
  return (
    <LogoLoading 
      variant="fullscreen" 
      statusText="Tuning chord progressions..." 
      bpm={120}
      styleVariant="rhythm-matrix"
    />
  );
}

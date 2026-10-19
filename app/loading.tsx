'use client';

import React from 'react';
import { LogoLoading } from '@/components/LogoLoading';

export default function Loading() {
  return (
    <LogoLoading
      variant="fullscreen"
      statusText="Tuning chord progression & harmony..."
    />
  );
}

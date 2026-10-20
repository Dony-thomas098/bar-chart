'use client';

import React from 'react';
import { LogoLoading } from '@/components/LogoLoading';

export default function Loading() {
  return (
    <LogoLoading
      statusText="Synchronizing your catalog"
    />
  );
}

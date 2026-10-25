'use client';

import { useEffect } from 'react';
import { initTheme } from '@/lib/theme';

export function ThemeSync(): null {
  useEffect(() => {
    initTheme();
  }, []);

  return null;
}

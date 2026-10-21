import { Capacitor } from '@capacitor/core';

/**
 * Accurately determines if the code is executing inside a native Capacitor shell.
 */
export function isRunningNatively(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}
  if (window.location.protocol === 'capacitor:') return true;
  return false;
}

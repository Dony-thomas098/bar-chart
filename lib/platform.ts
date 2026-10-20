import { Capacitor } from '@capacitor/core';

/**
 * Accurately determines if the code is executing inside a native Capacitor shell (Android APK or iOS).
 * Prevents native WebViews from executing external deep-links (e.g. intent:// or com.chordly.app://).
 */
export function isRunningNatively(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {}
  const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  if (Boolean(win.Capacitor?.isNativePlatform?.())) return true;
  if (window.location.protocol === 'capacitor:') return true;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true;
  return false;
}

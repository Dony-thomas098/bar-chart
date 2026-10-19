'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Screen Wake Lock Hook for mobile devices / stage performance.
 * Keeps the screen awake during live playing, automatically re-acquiring
 * the lock if the app loses and regains focus/visibility.
 */
export function useScreenWakeLock(enabled: boolean = true) {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<any>(null);

  const requestLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        return true;
      }
      const sentinel = await (navigator as any).wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener('release', () => {
        setIsActive(false);
      });
      return true;
    } catch (err: any) {
      // Browsers reject wakeLock if tab is hidden, battery saver is active, etc.
      console.warn('[WakeLock] Request failed:', err?.message || err);
      setIsActive(false);
      return false;
    }
  }, []);

  const releaseLock = useCallback(async () => {
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
        sentinelRef.current = null;
      }
    } catch (err) {
      console.warn('[WakeLock] Release error:', err);
    } finally {
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'wakeLock' in navigator);
  }, []);

  useEffect(() => {
    if (!enabled) {
      releaseLock();
      return;
    }

    requestLock();

    // Re-acquire when user switches back to the app / tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [enabled, requestLock, releaseLock]);

  return { isSupported, isActive, requestLock, releaseLock };
}

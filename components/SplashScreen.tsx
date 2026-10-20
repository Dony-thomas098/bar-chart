'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { ChordlyLoader } from './ChordlyLoader';
import styles from './SplashScreen.module.css';

/**
 * Animated Brand Launch / Splash Screen.
 * - Shows on app cold launch or hard reload.
 * - Loops the new animated logo loader until initial authentication and catalog sync finish.
 * - Enforces minimum 800ms display time to avoid UI flashes.
 * - Fades out smoothly over 300ms upon completion.
 * - Respects prefers-reduced-motion and tab backgrounding.
 */
export function SplashScreen() {
  let authLoading = false;
  try {
    const auth = useAuth();
    authLoading = auth.loading;
  } catch {
    // If rendered outside AuthProvider
  }

  const [gone, setGone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const isReload =
        (navEntries.length > 0 && navEntries[0].type === 'reload') ||
        (typeof performance !== 'undefined' && (performance as any).navigation?.type === 1);
      const splashShown = sessionStorage.getItem('chordly_splash_shown');

      if (splashShown && !isReload) {
        setGone(true);
        document.documentElement.classList.add('no-splash');
        return;
      }

      sessionStorage.setItem('chordly_splash_shown', 'true');
      document.documentElement.classList.remove('no-splash');
    } catch {
      // In case sessionStorage is restricted
    }

    // Intercept hard refresh key combos so next load displays splash
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) ||
        (e.ctrlKey && e.key === 'F5')
      ) {
        try {
          sessionStorage.removeItem('chordly_splash_shown');
        } catch {}
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!mounted || gone) return null;

  return (
    <div
      data-splash
      role="status"
      aria-label="Loading Chordly"
      className={styles.root}
    >
      <ChordlyLoader
        statusText="Synchronizing your catalog"
        isDone={!authLoading}
        minDisplayMs={800}
        fadeDurationMs={300}
        onFadeComplete={() => {
          setGone(true);
          try {
            document.documentElement.classList.add('no-splash');
          } catch {}
        }}
      />
    </div>
  );
}

export default SplashScreen;

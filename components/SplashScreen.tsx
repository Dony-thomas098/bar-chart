'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { ChordlyLoader } from './ChordlyLoader';
import styles from './SplashScreen.module.css';

/**
 * Animated Brand Launch / Splash Screen.
 * - Displays on app cold launch and after hard refresh or reload.
 * - Displays for at least minDisplayMs (800ms) to ensure smooth presentation without flashes.
 * - Seamlessly fades out over 350ms once initial auth & catalog sync finish.
 * - Enforces a strict hard safety fallback (2500ms) so the splash screen NEVER
 *   permanently blocks the UI on localhost or slow network conditions.
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
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFading(true);
    setTimeout(() => {
      setGone(true);
      try {
        document.documentElement.classList.add('no-splash');
      } catch {}
    }, 350);
  }, []);

  useEffect(() => {
    setMounted(true);

    // Hard safety timeout: under no circumstance should the splash screen remain past 2500ms
    const safetyTimer = setTimeout(() => {
      dismiss();
    }, 2500);

    // Ensure subsequent reloads or hard refreshes clean any suppression flags
    const handleBeforeUnload = () => {
      try {
        sessionStorage.removeItem('chordly_splash_shown');
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(safetyTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dismiss]);

  if (!mounted || gone) return null;

  return (
    <div
      data-splash
      role="status"
      aria-label="Loading Chordly"
      className={`${styles.root} ${fading ? styles.fading : ''}`}
    >
      <ChordlyLoader
        statusText="Synchronizing your catalog"
        isDone={!authLoading}
        minDisplayMs={800}
        fadeDurationMs={350}
        onFadeComplete={dismiss}
      />
    </div>
  );
}

export default SplashScreen;

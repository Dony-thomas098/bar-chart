'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { ChordlyLoader } from './ChordlyLoader';
import styles from './SplashScreen.module.css';

/**
 * Animated Brand Launch / Splash Screen.
 * - Displays on app cold launch and after every hard refresh or reload.
 * - Features the animated Chordly logo banner with soundwave shockwaves,
 *   specular sheen sweep, and harmonic embers.
 * - Displays for at least minDisplayMs (1000ms) to ensure smooth presentation without flashes.
 * - Seamlessly fades out over 350ms once initial auth & catalog sync finish.
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
    // Ensure no stale no-splash class prevents the animation on load/reload
    try {
      document.documentElement.classList.remove('no-splash');
    } catch {}

    setMounted(true);

    // Ensure subsequent reloads or hard refreshes clean any suppression flags
    const handleBeforeUnload = () => {
      try {
        sessionStorage.removeItem('chordly_splash_shown');
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
        minDisplayMs={1000}
        fadeDurationMs={350}
        onFadeComplete={() => {
          setGone(true);
        }}
      />
    </div>
  );
}

export default SplashScreen;

'use client';

import { useEffect, useRef } from 'react';

interface HardwareBackButtonOptions {
  enabled: boolean;
  onBack: () => void;
  stateKey?: string;
}

/**
 * Android Hardware Back Button & Gesture Navigation Hook.
 * When enabled (e.g. modal open, sheet open, or stage view), pushes
 * a synthetic history state and intercepts popstate & Escape so pressing
 * the Android physical back button or gesture dismisses the modal instead
 * of exiting the app.
 */
export function useHardwareBackButton({
  enabled,
  onBack,
  stateKey = 'chordly_modal',
}: HardwareBackButtonOptions) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // Push state so Android back pops this state rather than leaving page
    window.history.pushState({ [stateKey]: true }, '');
    pushedRef.current = true;

    const handlePopState = () => {
      pushedRef.current = false;
      onBackRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pushedRef.current) {
          pushedRef.current = false;
          window.history.back();
        } else {
          onBackRef.current();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up pushed state if unmounted without user pressing back
      if (pushedRef.current) {
        pushedRef.current = false;
        try {
          window.history.back();
        } catch {}
      }
    };
  }, [enabled, stateKey]);
}

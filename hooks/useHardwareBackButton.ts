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

    (window as any).__chordly_modal_open = true;

    // Push state so Android back pops this state rather than leaving page
    try {
      const currentState = window.history.state || {};
      window.history.pushState({ ...currentState, [stateKey]: true }, '');
      pushedRef.current = true;
    } catch (e) {
      console.warn('Failed to push hardware back button state:', e);
    }

    const handlePopState = () => {
      pushedRef.current = false;
      (window as any).__chordly_modal_open = false;
      onBackRef.current();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        (window as any).__chordly_modal_open = false;
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
      (window as any).__chordly_modal_open = false;
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      pushedRef.current = false;
    };
  }, [enabled, stateKey]);
}

'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

export function CapacitorInit(): null {
  const pathname = usePathname();
  const router = useRouter();
  const lastExitPressRef = useRef<number>(0);

  // Normalize pathname to determine if this is the root homescreen
  const normalizedPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const isHomeScreen = normalizedPath === '/';

  // 1. Web / PWA History Guard for all non-home modules
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only set up history trap on NON-home pages.
    // On the home screen ('/'), FolderBrowser handles the trap and double-back exit.
    if (!isHomeScreen) {
      try {
        const currentState = window.history.state || {};
        window.history.pushState({ ...currentState, chordly_module_trap: true }, '', window.location.href);
      } catch {}

      const handleWebPopState = (e: PopStateEvent) => {
        // If Stage Lock is active, do not navigate away
        if (
          (window as any).__chordly_stage_locked ||
          e.state?.chordly_stage_lock_prevent_exit ||
          e.state?.chordly_lyrics_lock_prevent_exit
        ) {
          return;
        }

        // If a modal was open and popped its own state, do not navigate
        if (
          (window as any).__chordly_modal_open ||
          e.state?.chordly_modal ||
          e.state?.chordly_sidebar_modal ||
          e.state?.chordly_reader_modal
        ) {
          return;
        }

        // On any non-home module, pressing back always returns to the home page ('/')
        router.push('/');
      };

      window.addEventListener('popstate', handleWebPopState);
      return () => {
        window.removeEventListener('popstate', handleWebPopState);
      };
    }
  }, [isHomeScreen, router, pathname]);

  // 2. Native Capacitor & Android Hardware Back Button Controller
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleHardwareBack = () => {
      // Priority 1: Stage Lock - Never exit or navigate if Stage Lock is enabled
      if ((window as any).__chordly_stage_locked) {
        window.dispatchEvent(new CustomEvent('chordly-stage-lock-alert'));
        return;
      }

      // Priority 2: Selection Mode - Clear active item selection first
      if ((window as any).__chordly_selection_active) {
        window.dispatchEvent(new CustomEvent('selection-change', { detail: 0 }));
        return;
      }

      // Priority 3: Open Modal - Dismiss active modal first
      if ((window as any).__chordly_modal_open) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }

      // Priority 4: Check current module route
      const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
      const atHome = currentPath === '/';

      if (!atHome) {
        // Return to previous route where the user left off, falling back to home
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push('/');
        return;
      }

      // Priority 5: On Home Screen ('/'): Double-back within 2 seconds to exit app
      const now = Date.now();
      if (now - lastExitPressRef.current < 2000) {
        // Confirmed double-back: exit the native app
        try {
          const cap = (window as any).Capacitor;
          if (cap?.Plugins?.App?.exitApp) {
            cap.Plugins.App.exitApp();
            return;
          }
        } catch {}
        window.history.back();
      } else {
        lastExitPressRef.current = now;
        window.dispatchEvent(new CustomEvent('chordly-show-exit-toast'));
      }
    };

    // Listen for Capacitor App backButton plugin event
    let capListenerHandle: any = null;
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.App?.addListener) {
        cap.Plugins.App.addListener('backButton', handleHardwareBack).then((handle: any) => {
          capListenerHandle = handle;
        }).catch(() => {});
      }
    } catch {}

    // Listen for standard Android WebView backbutton event
    document.addEventListener('backbutton', handleHardwareBack);

    return () => {
      document.removeEventListener('backbutton', handleHardwareBack);
      if (capListenerHandle && typeof capListenerHandle.remove === 'function') {
        try {
          capListenerHandle.remove();
        } catch {}
      }
    };
  }, [router]);

  return null;
}

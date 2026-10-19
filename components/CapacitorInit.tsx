'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function CapacitorInit() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cleanupBackButton: (() => void) | undefined;

    async function initCapacitor() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        // 1. Configure Status Bar
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          if (Capacitor.getPlatform() === 'android') {
            await StatusBar.setBackgroundColor({ color: '#121214' });
            await StatusBar.setOverlaysWebView({ overlay: false });
          }
        } catch (e) {
          console.debug('[Capacitor] StatusBar plugin not available', e);
        }

        // 2. Hide Splash Screen after React mounts
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          await SplashScreen.hide();
        } catch (e) {
          console.debug('[Capacitor] SplashScreen plugin not available', e);
        }

        // 3. Handle Android Hardware Back Button
        try {
          const { App } = await import('@capacitor/app');
          const listener = await App.addListener('backButton', ({ canGoBack }) => {
            if (pathname === '/' || pathname === '/chords' || pathname === '') {
              App.exitApp();
            } else if (canGoBack || window.history.length > 1) {
              router.back();
            } else {
              router.push('/');
            }
          });

          cleanupBackButton = () => {
            listener.remove();
          };
        } catch (e) {
          console.debug('[Capacitor] App plugin not available', e);
        }
      } catch (err) {
        console.debug('[Capacitor] Native initialization skipped', err);
      }
    }

    initCapacitor();

    return () => {
      if (cleanupBackButton) cleanupBackButton();
    };
  }, [router, pathname]);

  return null;
}

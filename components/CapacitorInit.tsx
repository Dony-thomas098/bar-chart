'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function CapacitorInit() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cleanupBackButton: (() => void) | undefined;
    let cleanupUrlListener: (() => void) | undefined;

    async function initCapacitor() {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        // 1. Configure Status Bar
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          if (Capacitor.getPlatform() === 'android') {
            await StatusBar.setBackgroundColor({ color: '#0B0B0E' });
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

        // 4. Handle OAuth Deep Links (appUrlOpen for Android & iOS)
        try {
          const { App } = await import('@capacitor/app');
          const { supabase } = await import('@/lib/supabase');
          const urlListener = await App.addListener('appUrlOpen', async ({ url }) => {
            if (url && (url.includes('com.chordly.app') || url.includes('auth'))) {
              try {
                // Dismiss in-app browser overlay if open
                try {
                  const { Browser } = await import('@capacitor/browser');
                  await Browser.close();
                } catch {}

                // PKCE code flow
                if (url.includes('code=')) {
                  const urlObj = new URL(url);
                  const code = urlObj.searchParams.get('code');
                  if (code) {
                    await supabase.auth.exchangeCodeForSession(code);
                    router.push('/');
                    return;
                  }
                }

                // Implicit hash token flow
                if (url.includes('#') && url.includes('access_token=')) {
                  const hashIndex = url.indexOf('#');
                  const hash = url.substring(hashIndex + 1);
                  const hashParams = new URLSearchParams(hash);
                  const accessToken = hashParams.get('access_token');
                  const refreshToken = hashParams.get('refresh_token');

                  if (accessToken && refreshToken) {
                    await supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken,
                    });
                    router.push('/');
                    return;
                  }
                }
              } catch (urlErr) {
                console.error('[Capacitor] Failed to handle OAuth URL:', urlErr);
              }
            }
          });

          cleanupUrlListener = () => {
            urlListener.remove();
          };
        } catch (e) {
          console.debug('[Capacitor] App plugin not available for URL listener', e);
        }

        // 5. Initialize Over-The-Air (OTA) Live Updates
        try {
          const { initLiveUpdate } = await import('@/lib/liveUpdate');
          await initLiveUpdate();
        } catch (e) {
          console.debug('[Capacitor] LiveUpdate initialization skipped', e);
        }
      } catch (err) {
        console.debug('[Capacitor] Native initialization skipped', err);
      }
    }

    initCapacitor();

    return () => {
      if (cleanupBackButton) cleanupBackButton();
      if (cleanupUrlListener) cleanupUrlListener();
    };
  }, [router, pathname]);

  return null;
}

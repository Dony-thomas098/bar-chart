'use client';

import { useEffect } from 'react';

export function SWRegister(): null {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        return;
      }


      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[SW] Registered successfully with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[SW] Registration failed:', err);
          });
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        register();
      } else {
        window.addEventListener('load', register);
      }
    }
  }, []);

  return null;
}

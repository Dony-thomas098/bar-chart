const CACHE_NAME = 'chordly-v7';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/logo-banner.png',
  '/folder',
  '/folder/',
  '/folder/index.html',
  '/folder/index.txt',
  '/chords',
  '/chords/',
  '/chords/index.html',
  '/chords/index.txt',
  '/chart',
  '/chart/',
  '/chart/index.html',
  '/chart/index.txt',
  '/chart/edit',
  '/chart/edit/',
  '/chart/edit/index.html',
  '/chart/edit/index.txt',
  '/perform',
  '/perform/',
  '/perform/index.html',
  '/perform/index.txt',
  '/setlists',
  '/setlists/',
  '/setlists/index.html',
  '/setlists/index.txt',
  '/lyrics',
  '/lyrics/',
  '/lyrics/index.html',
  '/lyrics/index.txt',
  '/lyrics/view',
  '/lyrics/view/',
  '/lyrics/view/index.html',
  '/lyrics/view/index.txt',
  '/lyrics/edit',
  '/lyrics/edit/',
  '/lyrics/edit/index.html',
  '/lyrics/edit/index.txt',
  '/printer',
  '/profile',
  '/settings',
  '/auth',
  '/auth/index.html',
  '/auth/index.txt',
  '/__next._tree.txt',
  '/__next._head.txt',
  '/__next._index.txt',
  '/__next.__PAGE__.txt',
  '/__next._full.txt',
];

// Install: precache key routes and assets safely with Promise.allSettled
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: 'no-cache' });
            if (response && response.ok) {
              await cache.put(asset, response);
            }
          } catch (e) {
            // Silently ignore individual asset precache failures
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-While-Revalidate for static assets, Network-First with offline fallback for HTML & Next.js RSC
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass dev mode HMR, chrome extensions, Supabase API calls, and OTA update manifest
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.hostname.includes('supabase.co') ||
    url.protocol.startsWith('chrome-extension') ||
    url.pathname.endsWith('/update.json') ||
    url.pathname === '/update.json'
  ) {
    return;
  }

  // Handle HTML page navigation with multi-level offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          // 1. Try matching with and without query parameters
          const cachedResponse = await caches.match(request, { ignoreSearch: true });
          if (cachedResponse) return cachedResponse;

          // 2. Try pathname matches
          const pathOnly = await caches.match(url.pathname, { ignoreSearch: true });
          if (pathOnly) return pathOnly;

          const trimmedPath = url.pathname.replace(/\/$/, '');
          const withSlash = await caches.match(trimmedPath + '/', { ignoreSearch: true });
          if (withSlash) return withSlash;

          const withoutSlash = await caches.match(trimmedPath, { ignoreSearch: true });
          if (withoutSlash) return withoutSlash;

          // 3. Fallback to index.html within route directory (e.g. /chart/index.html)
          const indexHtmlPath = trimmedPath + '/index.html';
          const indexHtmlMatch = await caches.match(indexHtmlPath, { ignoreSearch: true });
          if (indexHtmlMatch) return indexHtmlMatch;

          // 4. Fallback to folder or root app shell
          const folderCached = await caches.match('/folder', { ignoreSearch: true }) ||
                               await caches.match('/folder/', { ignoreSearch: true }) ||
                               await caches.match('/folder/index.html', { ignoreSearch: true });
          if (folderCached) return folderCached;

          const rootCached = await caches.match('/', { ignoreSearch: true });
          if (rootCached) return rootCached;

          return new Response('Offline - Chordly is ready when reconnected', {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // Handle static assets (_next, images, css, js, fonts) and Next.js RSC payloads (.txt)
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async (cachedResponse) => {
      if (cachedResponse) {
        // Return cached immediately; optionally revalidate in background if online
        if (navigator.onLine) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
              }
            })
            .catch(() => {});
        }
        return cachedResponse;
      }

      // Try matching by URL pathname ignoring query params
      const pathMatch = await caches.match(url.pathname, { ignoreSearch: true });
      if (pathMatch) return pathMatch;

      // Fetch from network with cache update
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline and requesting an RSC payload (.txt), try fallback paths
          if (url.pathname.endsWith('.txt')) {
            const fallbackTxt = await caches.match(url.pathname, { ignoreSearch: true });
            if (fallbackTxt) return fallbackTxt;

            // e.g. for /chart/index.txt?id=..., try /chart/index.txt
            const trimmedTxt = url.pathname.replace(/\/index\.txt$/, '') + '/index.txt';
            const trimmedMatch = await caches.match(trimmedTxt, { ignoreSearch: true });
            if (trimmedMatch) return trimmedMatch;
          }
          return new Response('', { status: 404, statusText: 'Offline Resource Not Found' });
        });
    })
  );
});

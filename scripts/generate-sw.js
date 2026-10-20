const fs = require('fs');
const path = require('path');

function generateSW() {
  const rootDir = path.resolve(__dirname, '..');
  const outDir = path.join(rootDir, 'out');
  const publicDir = path.join(rootDir, 'public');

  if (!fs.existsSync(outDir)) {
    console.warn('[SW Gen] out directory not found. Skipping static asset generation.');
    return;
  }

  // Recursive walk function to collect relative asset paths
  function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results = results.concat(walk(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  const staticFiles = walk(path.join(outDir, '_next', 'static'))
    .map(p => '/' + path.relative(outDir, p).replace(/\\/g, '/'))
    .filter(p => !p.endsWith('.map'));

  // Collect HTML pages and RSC txt payloads
  const pageFiles = walk(outDir)
    .map(p => '/' + path.relative(outDir, p).replace(/\\/g, '/'))
    .filter(p => 
      (p.endsWith('.html') || p.endsWith('.txt') || p.endsWith('.json') || p.endsWith('.png') || p.endsWith('.ico')) &&
      !p.startsWith('/_next') &&
      !p.endsWith('sw.js') &&
      !p.endsWith('.map')
    );

  const baseRoutes = [
    '/',
    '/folder',
    '/folder/',
    '/chart',
    '/chart/',
    '/chart/edit',
    '/chart/edit/',
    '/chords',
    '/chords/',
    '/lyrics',
    '/lyrics/',
    '/lyrics/view',
    '/lyrics/view/',
    '/lyrics/edit',
    '/lyrics/edit/',
    '/setlists',
    '/setlists/',
    '/perform',
    '/perform/',
    '/printer',
    '/profile',
    '/settings',
    '/auth',
    '/auth/'
  ];

  const allAssets = Array.from(new Set([...baseRoutes, ...pageFiles, ...staticFiles]));
  console.log(`[SW Gen] Collected ${allAssets.length} total precache assets (including ${staticFiles.length} static JS/CSS chunks).`);

  const swTemplate = `// Chordly Service Worker - Full Offline PWA Cache
const CACHE_NAME = 'chordly-v8';

const PRECACHE_ASSETS = ${JSON.stringify(allAssets, null, 2)};

// Install: precache ALL routes, HTML files, and static JS/CSS chunks safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Chunk precache into batches of 25 for optimal mobile memory & concurrency
      const batchSize = 25;
      for (let i = 0; i < PRECACHE_ASSETS.length; i += batchSize) {
        const batch = PRECACHE_ASSETS.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (asset) => {
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
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete outdated caches and claim clients immediately
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

// Fetch: Stale-While-Revalidate for static assets, Network-First with multi-level offline fallback for HTML/RSC
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

          const trimmedPath = url.pathname.replace(/\\/$/, '');
          const withSlash = await caches.match(trimmedPath + '/', { ignoreSearch: true });
          if (withSlash) return withSlash;

          const withoutSlash = await caches.match(trimmedPath, { ignoreSearch: true });
          if (withoutSlash) return withoutSlash;

          // 3. Fallback to index.html within route directory (e.g. /chart/index.html)
          const indexHtmlPath = trimmedPath + '/index.html';
          const indexHtmlMatch = await caches.match(indexHtmlPath, { ignoreSearch: true });
          if (indexHtmlMatch) return indexHtmlMatch;

          // 4. Dynamic route fallbacks for stage room codes, charts, and lyrics
          if (url.pathname.startsWith('/perform/')) {
            const stageCached = await caches.match('/perform/stage/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/perform/stage/', { ignoreSearch: true });
            if (stageCached) return stageCached;
          }

          if (url.pathname.startsWith('/chart/')) {
            const chartCached = await caches.match('/chart/index.html', { ignoreSearch: true }) ||
                                await caches.match('/chart/', { ignoreSearch: true });
            if (chartCached) return chartCached;
          }

          if (url.pathname.startsWith('/lyrics/')) {
            const lyricsCached = await caches.match('/lyrics/view/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/lyrics/view/', { ignoreSearch: true });
            if (lyricsCached) return lyricsCached;
          }

          // 5. Fallback to folder or root app shell
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

            const trimmedTxt = url.pathname.replace(/\\/index\\.txt$/, '') + '/index.txt';
            const trimmedMatch = await caches.match(trimmedTxt, { ignoreSearch: true });
            if (trimmedMatch) return trimmedMatch;
          }
          return new Response('', { status: 404, statusText: 'Offline Resource Not Found' });
        });
    })
  );
});
`;

  fs.writeFileSync(path.join(publicDir, 'sw.js'), swTemplate, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'sw.js'), swTemplate, 'utf-8');
  console.log('[SW Gen] Successfully generated public/sw.js and out/sw.js with full static chunk precaching.');
}

generateSW();

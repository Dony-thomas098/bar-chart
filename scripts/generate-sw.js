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

  // Collect HTML pages, RSC txt payloads, and all static assets
  const pageFiles = walk(outDir)
    .map(p => '/' + path.relative(outDir, p).replace(/\\/g, '/'))
    .filter(p => 
      (
        p.endsWith('.html') ||
        p.endsWith('.txt') ||
        p.endsWith('.json') ||
        p.endsWith('.png') ||
        p.endsWith('.jpg') ||
        p.endsWith('.jpeg') ||
        p.endsWith('.ico') ||
        p.endsWith('.svg') ||
        p.endsWith('.webp') ||
        p.endsWith('.woff2')
      ) &&
      !p.startsWith('/_next') &&
      !p.endsWith('sw.js') &&
      !p.endsWith('.map')
    );

  const baseRoutes = [
    '/',
    '/index.html',
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
    '/lyrics/folder',
    '/lyrics/folder/',
    '/setlists',
    '/setlists/',
    '/setlists/perform',
    '/setlists/perform/',
    '/setlists/view',
    '/setlists/view/',
    '/perform',
    '/perform/',
    '/perform/stage',
    '/perform/stage/',
    '/printer',
    '/printer/',
    '/profile',
    '/profile/',
    '/settings',
    '/settings/',
    '/trash',
    '/trash/',
    '/bookmarks',
    '/bookmarks/',
    '/auth',
    '/auth/'
  ];

  const allAssets = Array.from(new Set([...baseRoutes, ...pageFiles, ...staticFiles]));
  console.log(`[SW Gen] Collected ${allAssets.length} total precache assets (including ${staticFiles.length} static JS/CSS chunks).`);

  const swTemplate = `// Chordly Service Worker - Full Offline PWA Cache
const CACHE_NAME = 'chordly-v9';

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
                await cache.put(asset, response.clone());

                // Dynamically harvest and precache referenced script chunks & CSS
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('text/html') || asset.endsWith('.html') || !asset.includes('.')) {
                  try {
                    const text = await response.text();
                    const scriptRegex = /src="(\\/_next\\/static\\/chunks\\/[^"]+\\.js)"/g;
                    let m;
                    while ((m = scriptRegex.exec(text)) !== null) {
                      const chunkUrl = m[1];
                      try {
                        const chunkRes = await fetch(chunkUrl);
                        if (chunkRes && chunkRes.ok) {
                          await cache.put(chunkUrl, chunkRes);
                        }
                      } catch (err) {}
                    }

                    const cssRegex = /href="(\\/_next\\/static\\/css\\/[^"]+\\.css)"/g;
                    while ((m = cssRegex.exec(text)) !== null) {
                      const cssUrl = m[1];
                      try {
                        const cssRes = await fetch(cssUrl);
                        if (cssRes && cssRes.ok) {
                          await cache.put(cssUrl, cssRes);
                        }
                      } catch (err) {}
                    }
                  } catch (parseErr) {}
                }
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

// Fetch: Multi-strategy caching with robust offline fallbacks
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass dev mode HMR, chrome extensions, Supabase API calls, OTA update manifest, and localhost
  if (
    request.method !== 'GET' ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]' ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.hostname.includes('supabase.co') ||
    url.protocol.startsWith('chrome-extension') ||
    url.pathname.endsWith('/update.json') ||
    url.pathname === '/update.json'
  ) {
    return;
  }

  // 1. Handle HTML page navigation with multi-level offline fallback
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

          // 4. Dynamic route fallbacks for stage room codes, charts, lyrics, trash, settings, profile
          if (url.pathname.startsWith('/perform')) {
            const stageCached = await caches.match('/perform/stage/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/perform/stage/', { ignoreSearch: true }) ||
                                 await caches.match('/perform/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/perform/', { ignoreSearch: true });
            if (stageCached) return stageCached;
          }

          if (url.pathname.startsWith('/chart')) {
            const chartCached = await caches.match('/chart/index.html', { ignoreSearch: true }) ||
                                await caches.match('/chart/', { ignoreSearch: true });
            if (chartCached) return chartCached;
          }

          if (url.pathname.startsWith('/lyrics')) {
            const lyricsCached = await caches.match('/lyrics/view/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/lyrics/view/', { ignoreSearch: true }) ||
                                 await caches.match('/lyrics/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/lyrics/', { ignoreSearch: true });
            if (lyricsCached) return lyricsCached;
          }

          if (url.pathname.startsWith('/trash')) {
            const trashCached = await caches.match('/trash/index.html', { ignoreSearch: true }) ||
                                await caches.match('/trash/', { ignoreSearch: true });
            if (trashCached) return trashCached;
          }

          if (url.pathname.startsWith('/settings')) {
            const settingsCached = await caches.match('/settings/index.html', { ignoreSearch: true }) ||
                                   await caches.match('/settings/', { ignoreSearch: true });
            if (settingsCached) return settingsCached;
          }

          if (url.pathname.startsWith('/profile')) {
            const profileCached = await caches.match('/profile/index.html', { ignoreSearch: true }) ||
                                  await caches.match('/profile/', { ignoreSearch: true });
            if (profileCached) return profileCached;
          }

          if (url.pathname.startsWith('/bookmarks')) {
            const bookmarksCached = await caches.match('/bookmarks/index.html', { ignoreSearch: true }) ||
                                    await caches.match('/bookmarks/', { ignoreSearch: true });
            if (bookmarksCached) return bookmarksCached;
          }

          if (url.pathname.startsWith('/setlists')) {
            const setlistsCached = await caches.match('/setlists/index.html', { ignoreSearch: true }) ||
                                   await caches.match('/setlists/', { ignoreSearch: true });
            if (setlistsCached) return setlistsCached;
          }

          // 5. Fallback to folder or root app shell
          const folderCached = await caches.match('/folder', { ignoreSearch: true }) ||
                               await caches.match('/folder/', { ignoreSearch: true }) ||
                               await caches.match('/folder/index.html', { ignoreSearch: true });
          if (folderCached) return folderCached;

          const rootCached = await caches.match('/', { ignoreSearch: true }) ||
                             await caches.match('/index.html', { ignoreSearch: true });
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

  // 2. Handle Next.js RSC Flight Payloads (Soft Client-Side Navigations)
  const isRsc = request.headers.get('RSC') === '1' ||
                url.searchParams.has('_rsc') ||
                url.pathname.endsWith('.txt');

  if (isRsc) {
    event.respondWith(
      (async () => {
        // Try exact cache match first
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;

        const trimmed = url.pathname.replace(/\\/$/, '');

        // Try candidate RSC paths
        const candidates = [
          trimmed + '/index.txt',
          trimmed + '.txt',
          trimmed + '/__next._full.txt',
          url.pathname,
          url.pathname + '/index.txt'
        ];

        for (const candidate of candidates) {
          const match = await caches.match(candidate, { ignoreSearch: true });
          if (match) return match;
        }

        // Prefix fallbacks for dynamic and parameterized routes
        if (url.pathname.startsWith('/perform')) {
          const fallback = await caches.match('/perform/stage/index.txt', { ignoreSearch: true }) ||
                           await caches.match('/perform/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/chart')) {
          const fallback = await caches.match('/chart/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/lyrics')) {
          const fallback = await caches.match('/lyrics/view/index.txt', { ignoreSearch: true }) ||
                           await caches.match('/lyrics/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/trash')) {
          const fallback = await caches.match('/trash/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/settings')) {
          const fallback = await caches.match('/settings/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/profile')) {
          const fallback = await caches.match('/profile/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/bookmarks')) {
          const fallback = await caches.match('/bookmarks/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/setlists')) {
          const fallback = await caches.match('/setlists/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }

        // If online, fetch from network and update cache
        try {
          const networkRes = await fetch(request);
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
              cache.put(trimmed + '/index.txt', networkRes.clone());
            });
          }
          return networkRes;
        } catch (e) {
          // Fallback to root index.txt
          const rootTxt = await caches.match('/index.txt', { ignoreSearch: true }) ||
                          await caches.match('/__next._full.txt', { ignoreSearch: true });
          if (rootTxt) return rootTxt;

          return new Response('', { status: 404, statusText: 'Offline Resource Not Found' });
        }
      })()
    );
    return;
  }

  // 3. Handle static assets (_next, images, css, js, fonts)
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async (cachedResponse) => {
      if (cachedResponse) {
        if (navigator.onLine) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                  cache.put(url.pathname, networkResponse.clone());
                });
              }
            })
            .catch(() => {});
        }
        return cachedResponse;
      }

      // Try matching by URL pathname ignoring query params
      const pathMatch = await caches.match(url.pathname, { ignoreSearch: true });
      if (pathMatch) return pathMatch;

      // If online, fetch from network with cache update
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              cache.put(url.pathname, networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // OFFLINE FALLBACK FOR JS CHUNKS:
          // If a requested chunk has a hash mismatch (e.g. page-hash1.js vs page-hash2.js),
          // search the cache for any chunk matching the same component path prefix
          if (url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js')) {
            try {
              const cache = await caches.open(CACHE_NAME);
              const keys = await cache.keys();
              // Strip trailing hash from chunk filename: e.g. "page-e4806be85e52a4ad.js" -> "page-"
              const prefix = url.pathname.replace(/-[a-f0-9]+\\.js$/, '-');
              if (prefix !== url.pathname) {
                const matchingKey = keys.find((k) => {
                  try {
                    const kUrl = new URL(k.url);
                    return kUrl.pathname.startsWith(prefix) && kUrl.pathname.endsWith('.js');
                  } catch (e) {
                    return false;
                  }
                });
                if (matchingKey) {
                  const fallbackChunk = await cache.match(matchingKey);
                  if (fallbackChunk) return fallbackChunk;
                }
              }
            } catch (e) {}

            // Return a safe empty JS script instead of 404 text so webpack doesn't crash fatally
            return new Response('/* offline chunk placeholder */', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' },
            });
          }

          if (url.pathname.endsWith('.css')) {
            return new Response('', {
              status: 200,
              headers: { 'Content-Type': 'text/css' },
            });
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

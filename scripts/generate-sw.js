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

  const excludedNames = [
    'loading.mp4',
    'blank.html',
    'Chordly Loading Animation.html',
    'chordly water-jump navbar.html',
    'chordly-loader.html',
    'mobile-chord-editor-demo.html',
    'studio-ui-demo.html',
  ];

  // Collect HTML pages, clean route RSC txt payloads, and static web assets (no junk or internal files)
  const pageFiles = walk(outDir)
    .map(p => '/' + path.relative(outDir, p).replace(/\\/g, '/'))
    .filter(p => {
      const basename = path.basename(p);
      if (excludedNames.includes(basename)) return false;
      if (p.includes('__next.')) return false; // Exclude internal Next.js files that 404 on clean routes
      if (p.startsWith('/_next') || p.endsWith('sw.js') || p.endsWith('.map')) return false;

      return (
        p.endsWith('.html') ||
        p.endsWith('/index.txt') ||
        p === '/index.txt' ||
        p.endsWith('.json') ||
        p.endsWith('.png') ||
        p.endsWith('.jpg') ||
        p.endsWith('.jpeg') ||
        p.endsWith('.ico') ||
        p.endsWith('.svg') ||
        p.endsWith('.webp') ||
        p.endsWith('.woff2')
      );
    });

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

  const publicFiles = walk(publicDir)
    .map(p => '/' + path.relative(publicDir, p).replace(/\\/g, '/'))
    .filter(p => {
      const basename = path.basename(p);
      if (excludedNames.includes(basename)) return false;
      if (p.endsWith('sw.js') || p.endsWith('.map')) return false;
      return (
        p.endsWith('.html') ||
        p.endsWith('.json') ||
        p.endsWith('.png') ||
        p.endsWith('.jpg') ||
        p.endsWith('.jpeg') ||
        p.endsWith('.ico') ||
        p.endsWith('.svg') ||
        p.endsWith('.webp') ||
        p.endsWith('.woff2')
      );
    });

  const priorityAssets = [
    '/',
    '/index.html',
    '/manifest.json',
    '/logo-banner.png',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/apple-touch-icon.png'
  ];

  const allAssets = Array.from(new Set([
    ...priorityAssets,
    ...baseRoutes,
    ...pageFiles,
    ...publicFiles,
    ...staticFiles
  ]));
  console.log(`[SW Gen] Collected ${allAssets.length} total precache assets (including ${staticFiles.length} static JS/CSS chunks).`);

  const swTemplate = `// Chordly Service Worker - Full Offline PWA Cache
const CACHE_NAME = 'chordly-v11';

const PRECACHE_ASSETS = ${JSON.stringify(allAssets, null, 2)};

// Install: precache critical assets safely without blocking activation
self.addEventListener('install', (event) => {
  // Activate worker immediately so it never hangs in 'trying to install'
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. High-priority batch: precache critical app shell, manifest, and branding icons FIRST
      const priorityAssets = [
        '/',
        '/index.html',
        '/manifest.json',
        '/logo-banner.png',
        '/favicon.ico',
        '/favicon-32x32.png',
        '/icon-192x192.png',
        '/icon-512x512.png',
        '/apple-touch-icon.png'
      ];

      await Promise.allSettled(
        priorityAssets.map(async (asset) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(asset, { 
              cache: 'no-cache',
              signal: controller.signal 
            });
            clearTimeout(timeoutId);

            if (response && response.ok) {
              await cache.put(asset, response.clone());
              try {
                await cache.put(new URL(asset, self.location.origin).href, response);
              } catch (e) {}
            }
          } catch (e) {}
        })
      );

      // 2. Precache remaining assets in batches of 30
      const remaining = PRECACHE_ASSETS.filter((a) => !priorityAssets.includes(a));
      const batchSize = 30;
      for (let i = 0; i < remaining.length; i += batchSize) {
        const batch = remaining.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (asset) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 2000);
              const response = await fetch(asset, { 
                cache: 'no-cache',
                signal: controller.signal 
              });
              clearTimeout(timeoutId);

              if (response && response.ok) {
                await cache.put(asset, response.clone());
                try {
                  await cache.put(new URL(asset, self.location.origin).href, response.clone());
                } catch (e) {}

                // Non-blocking chunk harvesting for HTML pages
                const contentType = response.headers.get('content-type') || '';
                if (asset === '/' || asset === '/index.html' || contentType.includes('text/html')) {
                  response.text().then((text) => {
                    const chunksToFetch = new Set();
                    const scriptRegex = /(?:src|href)="(\\/_next\\/static\\/chunks\\/[^"]+\\.js)"/g;
                    let m;
                    while ((m = scriptRegex.exec(text)) !== null) {
                      chunksToFetch.add(m[1]);
                    }
                    const cssRegex = /href="(\\/_next\\/static\\/css\\/[^"]+\\.css)"/g;
                    while ((m = cssRegex.exec(text)) !== null) {
                      chunksToFetch.add(m[1]);
                    }
                    chunksToFetch.forEach((chunkUrl) => {
                      fetch(chunkUrl)
                        .then((cRes) => {
                          if (cRes && cRes.ok) cache.put(chunkUrl, cRes);
                        })
                        .catch(() => {});
                    });
                  }).catch(() => {});
                }
              }
            } catch (e) {
              // Silently ignore individual asset precache failures
            }
          })
        );
      }
    })
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

  // Bypass dev mode HMR, chrome extensions, Supabase API calls, OTA update manifest, authorization headers
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.hostname.includes('supabase.co') ||
    url.protocol.startsWith('chrome-extension') ||
    url.pathname.endsWith('/update.json') ||
    url.pathname === '/update.json' ||
    request.headers.has('Authorization')
  ) {
    return;
  }

  // 1. Handle HTML page navigation with multi-level offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cc = response.headers.get('Cache-Control') || '';
            if (!cc.includes('no-store') && !cc.includes('private')) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
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
            if (url.pathname.startsWith('/chart/edit')) {
              const editCached = await caches.match('/chart/edit/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/chart/edit/', { ignoreSearch: true });
              if (editCached) return editCached;
            }
            const chartCached = await caches.match('/chart/index.html', { ignoreSearch: true }) ||
                                await caches.match('/chart/', { ignoreSearch: true });
            if (chartCached) return chartCached;
          }

          if (url.pathname.startsWith('/lyrics')) {
            if (url.pathname.startsWith('/lyrics/edit')) {
              const editCached = await caches.match('/lyrics/edit/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/lyrics/edit/', { ignoreSearch: true });
              if (editCached) return editCached;
            }
            if (url.pathname.startsWith('/lyrics/folder')) {
              const folderCached = await caches.match('/lyrics/folder/index.html', { ignoreSearch: true }) ||
                                   await caches.match('/lyrics/folder/', { ignoreSearch: true });
              if (folderCached) return folderCached;
            }
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
            if (url.pathname.startsWith('/setlists/perform')) {
              const performCached = await caches.match('/setlists/perform/index.html', { ignoreSearch: true }) ||
                                    await caches.match('/setlists/perform/', { ignoreSearch: true });
              if (performCached) return performCached;
            }
            if (url.pathname.startsWith('/setlists/view')) {
              const viewCached = await caches.match('/setlists/view/index.html', { ignoreSearch: true }) ||
                                 await caches.match('/setlists/view/', { ignoreSearch: true });
              if (viewCached) return viewCached;
            }
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
          if (url.pathname.startsWith('/chart/edit')) {
            const fallback = await caches.match('/chart/edit/index.txt', { ignoreSearch: true });
            if (fallback) return fallback;
          }
          const fallback = await caches.match('/chart/index.txt', { ignoreSearch: true });
          if (fallback) return fallback;
        }
        if (url.pathname.startsWith('/lyrics')) {
          if (url.pathname.startsWith('/lyrics/edit')) {
            const fallback = await caches.match('/lyrics/edit/index.txt', { ignoreSearch: true });
            if (fallback) return fallback;
          }
          if (url.pathname.startsWith('/lyrics/folder')) {
            const fallback = await caches.match('/lyrics/folder/index.txt', { ignoreSearch: true });
            if (fallback) return fallback;
          }
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
          if (url.pathname.startsWith('/setlists/perform')) {
            const fallback = await caches.match('/setlists/perform/index.txt', { ignoreSearch: true });
            if (fallback) return fallback;
          }
          if (url.pathname.startsWith('/setlists/view')) {
            const fallback = await caches.match('/setlists/view/index.txt', { ignoreSearch: true });
            if (fallback) return fallback;
          }
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
    (async () => {
      // Try exact request match first
      const cachedResponse = await caches.match(request, { ignoreSearch: true });
      if (cachedResponse) {
        if (navigator.onLine) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const cc = networkResponse.headers.get('Cache-Control') || '';
                if (!cc.includes('no-store') && !cc.includes('private')) {
                  const responseClone = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseClone);
                    cache.put(url.pathname, networkResponse.clone());
                  });
                }
              }
            })
            .catch(() => {});
        }
        return cachedResponse;
      }

      // Try matching by URL pathname ignoring query params
      const pathMatch = await caches.match(url.pathname, { ignoreSearch: true });
      if (pathMatch) return pathMatch;

      // Try matching by full URL string
      const fullUrlMatch = await caches.match(url.href, { ignoreSearch: true });
      if (fullUrlMatch) return fullUrlMatch;

      // If online, fetch from network with cache update
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const cc = networkResponse.headers.get('Cache-Control') || '';
          if (!cc.includes('no-store') && !cc.includes('private')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              cache.put(url.pathname, networkResponse.clone());
            });
          }
        }
        return networkResponse;
      } catch (err) {
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

        if (url.pathname === '/manifest.json') {
          const fallbackManifest = {
            id: '/',
            name: 'Chordly',
            short_name: 'Chordly',
            start_url: '/',
            display: 'standalone',
            background_color: '#0B0B0E',
            theme_color: '#0B0B0E'
          };
          return new Response(JSON.stringify(fallbackManifest), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.pathname === '/logo-banner.png') {
          const transparentPng = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), function(c) { return c.charCodeAt(0); });
          return new Response(transparentPng, {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          });
        }

        return new Response('', { status: 404, statusText: 'Offline Resource Not Found' });
      }
    })()
  );
});
`;

  fs.writeFileSync(path.join(publicDir, 'sw.js'), swTemplate, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'sw.js'), swTemplate, 'utf-8');
  console.log('[SW Gen] Successfully generated public/sw.js and out/sw.js with full static chunk precaching.');
}

generateSW();

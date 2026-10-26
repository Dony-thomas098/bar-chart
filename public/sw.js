// Chordly Service Worker - Full Offline PWA Cache
const CACHE_NAME = 'chordly-v11';

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo-banner.png",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/apple-touch-icon.png",
  "/folder",
  "/folder/",
  "/chart",
  "/chart/",
  "/chart/edit",
  "/chart/edit/",
  "/chords",
  "/chords/",
  "/lyrics",
  "/lyrics/",
  "/lyrics/view",
  "/lyrics/view/",
  "/lyrics/edit",
  "/lyrics/edit/",
  "/lyrics/folder",
  "/lyrics/folder/",
  "/setlists",
  "/setlists/",
  "/setlists/perform",
  "/setlists/perform/",
  "/setlists/view",
  "/setlists/view/",
  "/perform",
  "/perform/",
  "/perform/stage",
  "/perform/stage/",
  "/printer",
  "/printer/",
  "/profile",
  "/profile/",
  "/settings",
  "/settings/",
  "/trash",
  "/trash/",
  "/bookmarks",
  "/bookmarks/",
  "/auth",
  "/auth/",
  "/404/index.html",
  "/404.html",
  "/apple-icon.jpg",
  "/apple-icon.png",
  "/auth/index.html",
  "/auth/index.txt",
  "/bg.png",
  "/bookmarks/index.html",
  "/bookmarks/index.txt",
  "/chart/demo/edit/index.html",
  "/chart/demo/edit/index.txt",
  "/chart/demo/index.html",
  "/chart/demo/index.txt",
  "/chart/edit/index.html",
  "/chart/edit/index.txt",
  "/chart/index.html",
  "/chart/index.txt",
  "/chords/index.html",
  "/chords/index.txt",
  "/file.svg",
  "/folder/demo/index.html",
  "/folder/demo/index.txt",
  "/folder/index.html",
  "/folder/index.txt",
  "/globe.svg",
  "/icon-maskable-512x512.png",
  "/icon.jpg",
  "/icon.png",
  "/index.txt",
  "/logo-review/index.html",
  "/logo-review/index.txt",
  "/lyrics/demo/edit/index.html",
  "/lyrics/demo/edit/index.txt",
  "/lyrics/demo/index.html",
  "/lyrics/demo/index.txt",
  "/lyrics/edit/index.html",
  "/lyrics/edit/index.txt",
  "/lyrics/folder/demo/index.html",
  "/lyrics/folder/demo/index.txt",
  "/lyrics/folder/index.html",
  "/lyrics/folder/index.txt",
  "/lyrics/index.html",
  "/lyrics/index.txt",
  "/lyrics/view/index.html",
  "/lyrics/view/index.txt",
  "/next.svg",
  "/perform/demo/index.html",
  "/perform/demo/index.txt",
  "/perform/index.html",
  "/perform/index.txt",
  "/perform/stage/index.html",
  "/perform/stage/index.txt",
  "/printer/index.html",
  "/printer/index.txt",
  "/profile/index.html",
  "/profile/index.txt",
  "/serve.json",
  "/setlists/demo/index.html",
  "/setlists/demo/index.txt",
  "/setlists/demo/perform/index.html",
  "/setlists/demo/perform/index.txt",
  "/setlists/index.html",
  "/setlists/index.txt",
  "/setlists/perform/index.html",
  "/setlists/perform/index.txt",
  "/setlists/view/index.html",
  "/setlists/view/index.txt",
  "/settings/index.html",
  "/settings/index.txt",
  "/trash/index.html",
  "/trash/index.txt",
  "/update.json",
  "/vercel.svg",
  "/window.svg",
  "/_not-found/index.html",
  "/_not-found/index.txt",
  "/_next/static/chunks/1135-9c5fa3bec1cc50f0.js",
  "/_next/static/chunks/1390-fe641041ce4d4c98.js",
  "/_next/static/chunks/1966.b8f83f7ba376c962.js",
  "/_next/static/chunks/2081-0c5e1bb6d819657b.js",
  "/_next/static/chunks/2104-872c200eb7c4c7a7.js",
  "/_next/static/chunks/2746-c8f67515236a7971.js",
  "/_next/static/chunks/2801-f6a3d9c0f1bdf274.js",
  "/_next/static/chunks/2869-747ab54461d1e6e6.js",
  "/_next/static/chunks/2963-380856e2146d1ad2.js",
  "/_next/static/chunks/3093-5acb6089a975cd75.js",
  "/_next/static/chunks/3133-2d5a201bed12bf63.js",
  "/_next/static/chunks/360-0a545e18941c7daa.js",
  "/_next/static/chunks/3794-e6b880ea1810fa3e.js",
  "/_next/static/chunks/3899.d4d0ae202f418161.js",
  "/_next/static/chunks/4179-a0dc698c7cce97bc.js",
  "/_next/static/chunks/44530001-0393003bbddf7a02.js",
  "/_next/static/chunks/4548-b2cf56cc47dc25ff.js",
  "/_next/static/chunks/463-493b55cddcec22f6.js",
  "/_next/static/chunks/4bd1b696-8cd12253b448cc13.js",
  "/_next/static/chunks/4e0084c3-dd890f23c03dafcc.js",
  "/_next/static/chunks/5276-2ddb3c1a00703749.js",
  "/_next/static/chunks/5334-f4e9fbe94aff5ac9.js",
  "/_next/static/chunks/561-b03467247bfc296b.js",
  "/_next/static/chunks/6308-afe796621e4c02cc.js",
  "/_next/static/chunks/6347-281bd97bc965d342.js",
  "/_next/static/chunks/6510-610ff429fb1106a2.js",
  "/_next/static/chunks/6624-cb0f83bab5defada.js",
  "/_next/static/chunks/6653-dabe473bf2ea3259.js",
  "/_next/static/chunks/6748-43175b2acd6d4958.js",
  "/_next/static/chunks/812-8e8f214a433a0a34.js",
  "/_next/static/chunks/8527-5572d571f76e7d9c.js",
  "/_next/static/chunks/8801-375ac75ead0e1e98.js",
  "/_next/static/chunks/9021-5088ca070f361cb3.js",
  "/_next/static/chunks/9535-76c8bbd1c16e6ad3.js",
  "/_next/static/chunks/app/auth/page-cc0e27bfb25c7b2c.js",
  "/_next/static/chunks/app/bookmarks/page-0fa6becbfbb522de.js",
  "/_next/static/chunks/app/chart/edit/page-788cc6a70883c341.js",
  "/_next/static/chunks/app/chart/layout-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/chart/page-bc88257b0351501b.js",
  "/_next/static/chunks/app/chart/[id]/edit/page-d57bebc69c4864dd.js",
  "/_next/static/chunks/app/chart/[id]/layout-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/chart/[id]/page-6ca0a2937fdcca75.js",
  "/_next/static/chunks/app/chords/page-d0823d7fa05ad352.js",
  "/_next/static/chunks/app/folder/page-2668c46e5f21bcee.js",
  "/_next/static/chunks/app/folder/[id]/layout-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/folder/[id]/page-bf61cd4fb3f5a1e7.js",
  "/_next/static/chunks/app/layout-8ee60e15ed2c15db.js",
  "/_next/static/chunks/app/loading-51838c9ccfe54024.js",
  "/_next/static/chunks/app/logo-review/page-6fa7211f611ddffa.js",
  "/_next/static/chunks/app/lyrics/edit/page-abe123ce1333426a.js",
  "/_next/static/chunks/app/lyrics/folder/page-a3460e192bcc0c26.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/layout-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/page-ef3f4c4de8e18bed.js",
  "/_next/static/chunks/app/lyrics/page-36a6ba0cb5b0a3eb.js",
  "/_next/static/chunks/app/lyrics/view/page-2004caffcebb17dc.js",
  "/_next/static/chunks/app/lyrics/[id]/edit/page-9cdd11511eb6a644.js",
  "/_next/static/chunks/app/lyrics/[id]/layout-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/lyrics/[id]/page-7217bcbaf10d1e9d.js",
  "/_next/static/chunks/app/not-found-02ec10bc11ce3b07.js",
  "/_next/static/chunks/app/page-b19292ee914beb9c.js",
  "/_next/static/chunks/app/perform/page-811a926cab663181.js",
  "/_next/static/chunks/app/perform/stage/page-3776d88b157fe7fc.js",
  "/_next/static/chunks/app/perform/[code]/layout-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/perform/[code]/page-70f5f270bc4ec47e.js",
  "/_next/static/chunks/app/printer/page-31f75bcc11cd33c6.js",
  "/_next/static/chunks/app/profile/page-360f811b2c5df2a5.js",
  "/_next/static/chunks/app/setlists/page-ba4879b652c42352.js",
  "/_next/static/chunks/app/setlists/perform/page-e285975e30944351.js",
  "/_next/static/chunks/app/setlists/view/page-dad53513d783078b.js",
  "/_next/static/chunks/app/setlists/[id]/layout-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/setlists/[id]/page-c3a486f15bc5c9fa.js",
  "/_next/static/chunks/app/setlists/[id]/perform/page-9fb402cdae065728.js",
  "/_next/static/chunks/app/settings/page-bdd81788c2dc34ca.js",
  "/_next/static/chunks/app/trash/page-3fa6ef1a9ca44d32.js",
  "/_next/static/chunks/app/_global-error/page-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/app/_not-found/page-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/framework-0203c421f2bfabf7.js",
  "/_next/static/chunks/main-app-1a90e13776cf3f97.js",
  "/_next/static/chunks/main-e969e5d570b3f8cf.js",
  "/_next/static/chunks/next/dist/client/components/builtin/app-error-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/next/dist/client/components/builtin/forbidden-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/next/dist/client/components/builtin/global-error-c9d4c13f2c41ca7e.js",
  "/_next/static/chunks/next/dist/client/components/builtin/unauthorized-3dc8c8c7b19ce49c.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-e2c4b2c258a8ed93.js",
  "/_next/static/css/1de9b0b9de0c038b.css",
  "/_next/static/css/604775b3a74dc580.css",
  "/_next/static/css/676caacb685ce77a.css",
  "/_next/static/css/9cdd061e9fa6d1a6.css",
  "/_next/static/css/ddad215bfed91e8e.css",
  "/_next/static/media/558ca1a6aa3cb55e-s.p.woff2",
  "/_next/static/media/636a5ac981f94f8b-s.p.woff2",
  "/_next/static/media/64d784ea54a4acde-s.woff2",
  "/_next/static/media/6d831b18ae5b01dc-s.woff2",
  "/_next/static/media/6fe53d21e6e7ebd8-s.woff2",
  "/_next/static/media/8ebc6e9dde468c4a-s.woff2",
  "/_next/static/media/9e7b0a821b9dfcb4-s.woff2",
  "/_next/static/media/ac0e76ddaeeb7981-s.woff2",
  "/_next/static/media/edc640959b0c7826-s.woff2",
  "/_next/static/media/ff71da380fbe67dd-s.woff2",
  "/_next/static/WUATBTHjUccGz8LPMlm7f/_buildManifest.js",
  "/_next/static/WUATBTHjUccGz8LPMlm7f/_ssgManifest.js"
];

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
                    const scriptRegex = /(?:src|href)="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
                    let m;
                    while ((m = scriptRegex.exec(text)) !== null) {
                      chunksToFetch.add(m[1]);
                    }
                    const cssRegex = /href="(\/_next\/static\/css\/[^"]+\.css)"/g;
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

          const trimmedPath = url.pathname.replace(/\/$/, '');
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

        const trimmed = url.pathname.replace(/\/$/, '');

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
            const prefix = url.pathname.replace(/-[a-f0-9]+\.js$/, '-');
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

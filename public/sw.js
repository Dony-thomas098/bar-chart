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
  "/_next/static/chunks/1643-c5ec9103c3f03f45.js",
  "/_next/static/chunks/1867-60d4fc8e4c3608ca.js",
  "/_next/static/chunks/1966.d10b448f42cccd98.js",
  "/_next/static/chunks/2180-33277038fbce0dbf.js",
  "/_next/static/chunks/2502-2b636d2e017d8079.js",
  "/_next/static/chunks/2657-955d743cb5637139.js",
  "/_next/static/chunks/2721-f5bcc39d2f07899b.js",
  "/_next/static/chunks/2864-edf5516b5cb3264b.js",
  "/_next/static/chunks/3133-745e36a5cc5f4854.js",
  "/_next/static/chunks/3384-15a21093db595005.js",
  "/_next/static/chunks/3794-d3ad547af5369260.js",
  "/_next/static/chunks/3899.cf10152d8085e352.js",
  "/_next/static/chunks/44530001-78d9977d0e16ef0a.js",
  "/_next/static/chunks/4548-ae62379dbb5985b5.js",
  "/_next/static/chunks/4bd1b696-c2f6e0877b6c10aa.js",
  "/_next/static/chunks/5334-4c687c69621663e1.js",
  "/_next/static/chunks/5339-48217cd7f1f0a02a.js",
  "/_next/static/chunks/5549-e5cae4215a51c818.js",
  "/_next/static/chunks/561-309cb23a3e82978a.js",
  "/_next/static/chunks/6250-aedcb7b22a3ceb4b.js",
  "/_next/static/chunks/6308-1556cfa3a12d0bac.js",
  "/_next/static/chunks/6736-a56012626fe75d00.js",
  "/_next/static/chunks/7365-332c90a412a672b6.js",
  "/_next/static/chunks/8351-2ed0aee60593d1c2.js",
  "/_next/static/chunks/8527-055bc2d3221fef94.js",
  "/_next/static/chunks/868-5b2521bfbef94869.js",
  "/_next/static/chunks/9021-70c4c14a756e7f52.js",
  "/_next/static/chunks/9123-b845fb2c6d13b993.js",
  "/_next/static/chunks/app/auth/page-b93d8d1458ad4f75.js",
  "/_next/static/chunks/app/bookmarks/page-dd721dc93219a784.js",
  "/_next/static/chunks/app/chart/edit/page-82fc2f5405c619c0.js",
  "/_next/static/chunks/app/chart/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/chart/page-f200c592b32bcbbe.js",
  "/_next/static/chunks/app/chart/[id]/edit/page-ab511b3b6a6479d6.js",
  "/_next/static/chunks/app/chart/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/chart/[id]/page-60611876cc71710e.js",
  "/_next/static/chunks/app/chords/page-0fe46623c343dd57.js",
  "/_next/static/chunks/app/folder/page-b542c4e323cbf91a.js",
  "/_next/static/chunks/app/folder/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/folder/[id]/page-2480d789feba0eff.js",
  "/_next/static/chunks/app/layout-eb6ea03bff329f43.js",
  "/_next/static/chunks/app/loading-6cb8f82618a9084e.js",
  "/_next/static/chunks/app/logo-review/page-f7abbcfaa9ef2f76.js",
  "/_next/static/chunks/app/lyrics/edit/page-8140ac081cb771ad.js",
  "/_next/static/chunks/app/lyrics/folder/page-62ce1e8e0821a8fa.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/page-2c953ec73394469d.js",
  "/_next/static/chunks/app/lyrics/page-bc529ea678d05839.js",
  "/_next/static/chunks/app/lyrics/view/page-ffab1d7fd79f10a1.js",
  "/_next/static/chunks/app/lyrics/[id]/edit/page-172ce12802568c94.js",
  "/_next/static/chunks/app/lyrics/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/lyrics/[id]/page-b665f2b2517ff572.js",
  "/_next/static/chunks/app/not-found-f73a068cc30cd1f0.js",
  "/_next/static/chunks/app/page-bec5b05de78f453f.js",
  "/_next/static/chunks/app/perform/page-28a4cbbc1e8a126d.js",
  "/_next/static/chunks/app/perform/stage/page-f94a95dc5a15fd3b.js",
  "/_next/static/chunks/app/perform/[code]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/perform/[code]/page-5eee78dfff3aa8f5.js",
  "/_next/static/chunks/app/printer/page-bcd8df5d327dd131.js",
  "/_next/static/chunks/app/profile/page-99861f694820e5d8.js",
  "/_next/static/chunks/app/setlists/page-1f137c8919fbfba5.js",
  "/_next/static/chunks/app/setlists/perform/page-b27e8ae040f8a9b3.js",
  "/_next/static/chunks/app/setlists/view/page-78e23a54b1669436.js",
  "/_next/static/chunks/app/setlists/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/setlists/[id]/page-97c65de37af8d129.js",
  "/_next/static/chunks/app/setlists/[id]/perform/page-7f72fb1c254cd5a5.js",
  "/_next/static/chunks/app/settings/page-caac99139f556741.js",
  "/_next/static/chunks/app/trash/page-36bfaa88635b8689.js",
  "/_next/static/chunks/app/_global-error/page-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/_not-found/page-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/framework-04bc8c1a646a0097.js",
  "/_next/static/chunks/main-4597063fc13d016e.js",
  "/_next/static/chunks/main-app-b8790d8f9a1c8fad.js",
  "/_next/static/chunks/next/dist/client/components/builtin/app-error-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/next/dist/client/components/builtin/forbidden-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/next/dist/client/components/builtin/global-error-6e67d4acd566df69.js",
  "/_next/static/chunks/next/dist/client/components/builtin/unauthorized-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-49686ef50733dc2a.js",
  "/_next/static/css/1de9b0b9de0c038b.css",
  "/_next/static/css/604775b3a74dc580.css",
  "/_next/static/css/676caacb685ce77a.css",
  "/_next/static/css/9cdd061e9fa6d1a6.css",
  "/_next/static/css/f9c23d92a88dae17.css",
  "/_next/static/jq0OwV-GVJS5Gk2B50ITH/_buildManifest.js",
  "/_next/static/jq0OwV-GVJS5Gk2B50ITH/_ssgManifest.js",
  "/_next/static/media/558ca1a6aa3cb55e-s.p.woff2",
  "/_next/static/media/636a5ac981f94f8b-s.p.woff2",
  "/_next/static/media/64d784ea54a4acde-s.woff2",
  "/_next/static/media/6d831b18ae5b01dc-s.woff2",
  "/_next/static/media/6fe53d21e6e7ebd8-s.woff2",
  "/_next/static/media/8ebc6e9dde468c4a-s.woff2",
  "/_next/static/media/9e7b0a821b9dfcb4-s.woff2",
  "/_next/static/media/ac0e76ddaeeb7981-s.woff2",
  "/_next/static/media/edc640959b0c7826-s.woff2",
  "/_next/static/media/ff71da380fbe67dd-s.woff2"
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

  // Bypass dev mode HMR, chrome extensions, Supabase API calls, OTA update manifest
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

      // Try matching by full URL string
      const fullUrlMatch = await caches.match(url.href, { ignoreSearch: true });
      if (fullUrlMatch) return fullUrlMatch;

      // If online, fetch from network with cache update
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
            cache.put(url.pathname, networkResponse.clone());
          });
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

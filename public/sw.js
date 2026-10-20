// Chordly Service Worker - Full Offline PWA Cache
const CACHE_NAME = 'chordly-v8';

const PRECACHE_ASSETS = [
  "/",
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
  "/setlists",
  "/setlists/",
  "/perform",
  "/perform/",
  "/printer",
  "/profile",
  "/settings",
  "/auth",
  "/auth/",
  "/404/index.html",
  "/404.html",
  "/apple-icon.png",
  "/apple-touch-icon.png",
  "/auth/index.html",
  "/auth/index.txt",
  "/auth/__next.auth/__PAGE__.txt",
  "/auth/__next.auth.txt",
  "/auth/__next._full.txt",
  "/auth/__next._head.txt",
  "/auth/__next._index.txt",
  "/auth/__next._tree.txt",
  "/bg.png",
  "/blank.html",
  "/bookmarks/index.html",
  "/bookmarks/index.txt",
  "/bookmarks/__next.bookmarks/__PAGE__.txt",
  "/bookmarks/__next.bookmarks.txt",
  "/bookmarks/__next._full.txt",
  "/bookmarks/__next._head.txt",
  "/bookmarks/__next._index.txt",
  "/bookmarks/__next._tree.txt",
  "/chart/demo/edit/index.html",
  "/chart/demo/edit/index.txt",
  "/chart/demo/edit/__next.chart/$d$id/edit/__PAGE__.txt",
  "/chart/demo/edit/__next.chart/$d$id/edit.txt",
  "/chart/demo/edit/__next.chart/$d$id.txt",
  "/chart/demo/edit/__next.chart.txt",
  "/chart/demo/edit/__next._full.txt",
  "/chart/demo/edit/__next._head.txt",
  "/chart/demo/edit/__next._index.txt",
  "/chart/demo/edit/__next._tree.txt",
  "/chart/demo/index.html",
  "/chart/demo/index.txt",
  "/chart/demo/__next.chart/$d$id/__PAGE__.txt",
  "/chart/demo/__next.chart/$d$id.txt",
  "/chart/demo/__next.chart.txt",
  "/chart/demo/__next._full.txt",
  "/chart/demo/__next._head.txt",
  "/chart/demo/__next._index.txt",
  "/chart/demo/__next._tree.txt",
  "/chart/edit/index.html",
  "/chart/edit/index.txt",
  "/chart/edit/__next.chart/edit/__PAGE__.txt",
  "/chart/edit/__next.chart/edit.txt",
  "/chart/edit/__next.chart.txt",
  "/chart/edit/__next._full.txt",
  "/chart/edit/__next._head.txt",
  "/chart/edit/__next._index.txt",
  "/chart/edit/__next._tree.txt",
  "/chart/index.html",
  "/chart/index.txt",
  "/chart/__next.chart/__PAGE__.txt",
  "/chart/__next.chart.txt",
  "/chart/__next._full.txt",
  "/chart/__next._head.txt",
  "/chart/__next._index.txt",
  "/chart/__next._tree.txt",
  "/Chordly Loading Animation.html",
  "/chordly water-jump navbar.html",
  "/chordly-loader.html",
  "/chords/index.html",
  "/chords/index.txt",
  "/chords/__next.chords/__PAGE__.txt",
  "/chords/__next.chords.txt",
  "/chords/__next._full.txt",
  "/chords/__next._head.txt",
  "/chords/__next._index.txt",
  "/chords/__next._tree.txt",
  "/favicon-32x32.png",
  "/favicon.ico",
  "/folder/demo/index.html",
  "/folder/demo/index.txt",
  "/folder/demo/__next.folder/$d$id/__PAGE__.txt",
  "/folder/demo/__next.folder/$d$id.txt",
  "/folder/demo/__next.folder.txt",
  "/folder/demo/__next._full.txt",
  "/folder/demo/__next._head.txt",
  "/folder/demo/__next._index.txt",
  "/folder/demo/__next._tree.txt",
  "/folder/index.html",
  "/folder/index.txt",
  "/folder/__next.folder/__PAGE__.txt",
  "/folder/__next.folder.txt",
  "/folder/__next._full.txt",
  "/folder/__next._head.txt",
  "/folder/__next._index.txt",
  "/folder/__next._tree.txt",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-512x512.png",
  "/icon.png",
  "/index.html",
  "/index.txt",
  "/logo-banner.png",
  "/logo-review/index.html",
  "/logo-review/index.txt",
  "/logo-review/__next.logo-review/__PAGE__.txt",
  "/logo-review/__next.logo-review.txt",
  "/logo-review/__next._full.txt",
  "/logo-review/__next._head.txt",
  "/logo-review/__next._index.txt",
  "/logo-review/__next._tree.txt",
  "/lyrics/demo/edit/index.html",
  "/lyrics/demo/edit/index.txt",
  "/lyrics/demo/edit/__next.lyrics/$d$id/edit/__PAGE__.txt",
  "/lyrics/demo/edit/__next.lyrics/$d$id/edit.txt",
  "/lyrics/demo/edit/__next.lyrics/$d$id.txt",
  "/lyrics/demo/edit/__next.lyrics.txt",
  "/lyrics/demo/edit/__next._full.txt",
  "/lyrics/demo/edit/__next._head.txt",
  "/lyrics/demo/edit/__next._index.txt",
  "/lyrics/demo/edit/__next._tree.txt",
  "/lyrics/demo/index.html",
  "/lyrics/demo/index.txt",
  "/lyrics/demo/__next.lyrics/$d$id/__PAGE__.txt",
  "/lyrics/demo/__next.lyrics/$d$id.txt",
  "/lyrics/demo/__next.lyrics.txt",
  "/lyrics/demo/__next._full.txt",
  "/lyrics/demo/__next._head.txt",
  "/lyrics/demo/__next._index.txt",
  "/lyrics/demo/__next._tree.txt",
  "/lyrics/edit/index.html",
  "/lyrics/edit/index.txt",
  "/lyrics/edit/__next.lyrics/edit/__PAGE__.txt",
  "/lyrics/edit/__next.lyrics/edit.txt",
  "/lyrics/edit/__next.lyrics.txt",
  "/lyrics/edit/__next._full.txt",
  "/lyrics/edit/__next._head.txt",
  "/lyrics/edit/__next._index.txt",
  "/lyrics/edit/__next._tree.txt",
  "/lyrics/folder/demo/index.html",
  "/lyrics/folder/demo/index.txt",
  "/lyrics/folder/demo/__next.lyrics/folder/$d$id/__PAGE__.txt",
  "/lyrics/folder/demo/__next.lyrics/folder/$d$id.txt",
  "/lyrics/folder/demo/__next.lyrics/folder.txt",
  "/lyrics/folder/demo/__next.lyrics.txt",
  "/lyrics/folder/demo/__next._full.txt",
  "/lyrics/folder/demo/__next._head.txt",
  "/lyrics/folder/demo/__next._index.txt",
  "/lyrics/folder/demo/__next._tree.txt",
  "/lyrics/folder/index.html",
  "/lyrics/folder/index.txt",
  "/lyrics/folder/__next.lyrics/folder/__PAGE__.txt",
  "/lyrics/folder/__next.lyrics/folder.txt",
  "/lyrics/folder/__next.lyrics.txt",
  "/lyrics/folder/__next._full.txt",
  "/lyrics/folder/__next._head.txt",
  "/lyrics/folder/__next._index.txt",
  "/lyrics/folder/__next._tree.txt",
  "/lyrics/index.html",
  "/lyrics/index.txt",
  "/lyrics/view/index.html",
  "/lyrics/view/index.txt",
  "/lyrics/view/__next.lyrics/view/__PAGE__.txt",
  "/lyrics/view/__next.lyrics/view.txt",
  "/lyrics/view/__next.lyrics.txt",
  "/lyrics/view/__next._full.txt",
  "/lyrics/view/__next._head.txt",
  "/lyrics/view/__next._index.txt",
  "/lyrics/view/__next._tree.txt",
  "/lyrics/__next.lyrics/__PAGE__.txt",
  "/lyrics/__next.lyrics.txt",
  "/lyrics/__next._full.txt",
  "/lyrics/__next._head.txt",
  "/lyrics/__next._index.txt",
  "/lyrics/__next._tree.txt",
  "/manifest.json",
  "/perform/demo/index.html",
  "/perform/demo/index.txt",
  "/perform/demo/__next.perform/$d$code/__PAGE__.txt",
  "/perform/demo/__next.perform/$d$code.txt",
  "/perform/demo/__next.perform.txt",
  "/perform/demo/__next._full.txt",
  "/perform/demo/__next._head.txt",
  "/perform/demo/__next._index.txt",
  "/perform/demo/__next._tree.txt",
  "/perform/index.html",
  "/perform/index.txt",
  "/perform/stage/index.html",
  "/perform/stage/index.txt",
  "/perform/stage/__next.perform/stage/__PAGE__.txt",
  "/perform/stage/__next.perform/stage.txt",
  "/perform/stage/__next.perform.txt",
  "/perform/stage/__next._full.txt",
  "/perform/stage/__next._head.txt",
  "/perform/stage/__next._index.txt",
  "/perform/stage/__next._tree.txt",
  "/perform/__next.perform/__PAGE__.txt",
  "/perform/__next.perform.txt",
  "/perform/__next._full.txt",
  "/perform/__next._head.txt",
  "/perform/__next._index.txt",
  "/perform/__next._tree.txt",
  "/printer/index.html",
  "/printer/index.txt",
  "/printer/__next.printer/__PAGE__.txt",
  "/printer/__next.printer.txt",
  "/printer/__next._full.txt",
  "/printer/__next._head.txt",
  "/printer/__next._index.txt",
  "/printer/__next._tree.txt",
  "/profile/index.html",
  "/profile/index.txt",
  "/profile/__next.profile/__PAGE__.txt",
  "/profile/__next.profile.txt",
  "/profile/__next._full.txt",
  "/profile/__next._head.txt",
  "/profile/__next._index.txt",
  "/profile/__next._tree.txt",
  "/serve.json",
  "/setlists/demo/index.html",
  "/setlists/demo/index.txt",
  "/setlists/demo/perform/index.html",
  "/setlists/demo/perform/index.txt",
  "/setlists/demo/perform/__next.setlists/$d$id/perform/__PAGE__.txt",
  "/setlists/demo/perform/__next.setlists/$d$id/perform.txt",
  "/setlists/demo/perform/__next.setlists/$d$id.txt",
  "/setlists/demo/perform/__next.setlists.txt",
  "/setlists/demo/perform/__next._full.txt",
  "/setlists/demo/perform/__next._head.txt",
  "/setlists/demo/perform/__next._index.txt",
  "/setlists/demo/perform/__next._tree.txt",
  "/setlists/demo/__next.setlists/$d$id/__PAGE__.txt",
  "/setlists/demo/__next.setlists/$d$id.txt",
  "/setlists/demo/__next.setlists.txt",
  "/setlists/demo/__next._full.txt",
  "/setlists/demo/__next._head.txt",
  "/setlists/demo/__next._index.txt",
  "/setlists/demo/__next._tree.txt",
  "/setlists/index.html",
  "/setlists/index.txt",
  "/setlists/perform/index.html",
  "/setlists/perform/index.txt",
  "/setlists/perform/__next.setlists/perform/__PAGE__.txt",
  "/setlists/perform/__next.setlists/perform.txt",
  "/setlists/perform/__next.setlists.txt",
  "/setlists/perform/__next._full.txt",
  "/setlists/perform/__next._head.txt",
  "/setlists/perform/__next._index.txt",
  "/setlists/perform/__next._tree.txt",
  "/setlists/view/index.html",
  "/setlists/view/index.txt",
  "/setlists/view/__next.setlists/view/__PAGE__.txt",
  "/setlists/view/__next.setlists/view.txt",
  "/setlists/view/__next.setlists.txt",
  "/setlists/view/__next._full.txt",
  "/setlists/view/__next._head.txt",
  "/setlists/view/__next._index.txt",
  "/setlists/view/__next._tree.txt",
  "/setlists/__next.setlists/__PAGE__.txt",
  "/setlists/__next.setlists.txt",
  "/setlists/__next._full.txt",
  "/setlists/__next._head.txt",
  "/setlists/__next._index.txt",
  "/setlists/__next._tree.txt",
  "/settings/index.html",
  "/settings/index.txt",
  "/settings/__next.settings/__PAGE__.txt",
  "/settings/__next.settings.txt",
  "/settings/__next._full.txt",
  "/settings/__next._head.txt",
  "/settings/__next._index.txt",
  "/settings/__next._tree.txt",
  "/trash/index.html",
  "/trash/index.txt",
  "/trash/__next.trash/__PAGE__.txt",
  "/trash/__next.trash.txt",
  "/trash/__next._full.txt",
  "/trash/__next._head.txt",
  "/trash/__next._index.txt",
  "/trash/__next._tree.txt",
  "/update.json",
  "/_not-found/index.html",
  "/_not-found/index.txt",
  "/_not-found/__next._full.txt",
  "/_not-found/__next._head.txt",
  "/_not-found/__next._index.txt",
  "/_not-found/__next._not-found/__PAGE__.txt",
  "/_not-found/__next._not-found.txt",
  "/_not-found/__next._tree.txt",
  "/__next._full.txt",
  "/__next._head.txt",
  "/__next._index.txt",
  "/__next._tree.txt",
  "/__next.__PAGE__.txt",
  "/_next/static/chunks/1234.d5028adba19ca2ea.js",
  "/_next/static/chunks/1260.6e4e71a55fefba71.js",
  "/_next/static/chunks/1643-c5ec9103c3f03f45.js",
  "/_next/static/chunks/1867-4275f757fd82a928.js",
  "/_next/static/chunks/1966.d10b448f42cccd98.js",
  "/_next/static/chunks/2180-33277038fbce0dbf.js",
  "/_next/static/chunks/2502-2b636d2e017d8079.js",
  "/_next/static/chunks/2657-27f8eaa0749e390c.js",
  "/_next/static/chunks/2711.6739390339e215cb.js",
  "/_next/static/chunks/2721-f5bcc39d2f07899b.js",
  "/_next/static/chunks/2864-edf5516b5cb3264b.js",
  "/_next/static/chunks/3199.67d44875d592df0d.js",
  "/_next/static/chunks/3384-15a21093db595005.js",
  "/_next/static/chunks/370.c140251a7a1c9ab9.js",
  "/_next/static/chunks/3794-d3ad547af5369260.js",
  "/_next/static/chunks/3899.cf10152d8085e352.js",
  "/_next/static/chunks/44530001-78d9977d0e16ef0a.js",
  "/_next/static/chunks/4548-429a3374697e6cfa.js",
  "/_next/static/chunks/4bd1b696-c2f6e0877b6c10aa.js",
  "/_next/static/chunks/5333.8ff1e2716901b219.js",
  "/_next/static/chunks/5334-4c687c69621663e1.js",
  "/_next/static/chunks/5339-48217cd7f1f0a02a.js",
  "/_next/static/chunks/5549-e5cae4215a51c818.js",
  "/_next/static/chunks/5580.67d44875d592df0d.js",
  "/_next/static/chunks/561-40528dbff8253bd7.js",
  "/_next/static/chunks/6250-aedcb7b22a3ceb4b.js",
  "/_next/static/chunks/6308-e1f697ce8f798d4f.js",
  "/_next/static/chunks/6736-a56012626fe75d00.js",
  "/_next/static/chunks/7365-332c90a412a672b6.js",
  "/_next/static/chunks/7643-1b75559f04a446b4.js",
  "/_next/static/chunks/7805-bc98d799c5f8bcb8.js",
  "/_next/static/chunks/7888.90a69def20884ca2.js",
  "/_next/static/chunks/8094.5e4231f93e29b231.js",
  "/_next/static/chunks/8351-2ed0aee60593d1c2.js",
  "/_next/static/chunks/8527-055bc2d3221fef94.js",
  "/_next/static/chunks/868-5b2521bfbef94869.js",
  "/_next/static/chunks/9021-068125288b83ecc4.js",
  "/_next/static/chunks/9123-b845fb2c6d13b993.js",
  "/_next/static/chunks/9176.a66b9f748e603687.js",
  "/_next/static/chunks/app/auth/page-34f9fd4bd75f1c3d.js",
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
  "/_next/static/chunks/app/layout-ec2249c07313a3fd.js",
  "/_next/static/chunks/app/loading-27c02134ea35ef39.js",
  "/_next/static/chunks/app/logo-review/page-7ab1515d68056cb3.js",
  "/_next/static/chunks/app/lyrics/edit/page-8140ac081cb771ad.js",
  "/_next/static/chunks/app/lyrics/folder/page-62ce1e8e0821a8fa.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/page-2c953ec73394469d.js",
  "/_next/static/chunks/app/lyrics/page-bc529ea678d05839.js",
  "/_next/static/chunks/app/lyrics/view/page-ffab1d7fd79f10a1.js",
  "/_next/static/chunks/app/lyrics/[id]/edit/page-172ce12802568c94.js",
  "/_next/static/chunks/app/lyrics/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/lyrics/[id]/page-b665f2b2517ff572.js",
  "/_next/static/chunks/app/not-found-7a8585145bce0d17.js",
  "/_next/static/chunks/app/page-bec5b05de78f453f.js",
  "/_next/static/chunks/app/perform/page-26863256b7257318.js",
  "/_next/static/chunks/app/perform/stage/page-f94a95dc5a15fd3b.js",
  "/_next/static/chunks/app/perform/[code]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/perform/[code]/page-5eee78dfff3aa8f5.js",
  "/_next/static/chunks/app/printer/page-e61ee75cc7b46ffb.js",
  "/_next/static/chunks/app/profile/page-5faec7fcc4bc6ecc.js",
  "/_next/static/chunks/app/setlists/page-cd8d68a7267a2de6.js",
  "/_next/static/chunks/app/setlists/perform/page-b27e8ae040f8a9b3.js",
  "/_next/static/chunks/app/setlists/view/page-78e23a54b1669436.js",
  "/_next/static/chunks/app/setlists/[id]/layout-31e8e7f3cec06d1e.js",
  "/_next/static/chunks/app/setlists/[id]/page-97c65de37af8d129.js",
  "/_next/static/chunks/app/setlists/[id]/perform/page-7f72fb1c254cd5a5.js",
  "/_next/static/chunks/app/settings/page-be12b257fa521c9c.js",
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
  "/_next/static/chunks/webpack-6b5d06e1bd65776b.js",
  "/_next/static/css/604775b3a74dc580.css",
  "/_next/static/css/61750d063d09238f.css",
  "/_next/static/css/676caacb685ce77a.css",
  "/_next/static/css/68b5b925d1cfe237.css",
  "/_next/static/css/9cdd061e9fa6d1a6.css",
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
  "/_next/static/tzB68BKPgZ8hDtzcj02CI/_buildManifest.js",
  "/_next/static/tzB68BKPgZ8hDtzcj02CI/_ssgManifest.js"
];

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

          const trimmedPath = url.pathname.replace(/\/$/, '');
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

            const trimmedTxt = url.pathname.replace(/\/index\.txt$/, '') + '/index.txt';
            const trimmedMatch = await caches.match(trimmedTxt, { ignoreSearch: true });
            if (trimmedMatch) return trimmedMatch;
          }
          return new Response('', { status: 404, statusText: 'Offline Resource Not Found' });
        });
    })
  );
});

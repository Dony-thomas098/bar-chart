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
  "/_next/static/chunks/1164-0c90f007f10f78b1.js",
  "/_next/static/chunks/1234.3044b176e12cd63a.js",
  "/_next/static/chunks/1260.071c641986ba997d.js",
  "/_next/static/chunks/1618-092cc9baddbd615e.js",
  "/_next/static/chunks/1643-668844349b2cd71f.js",
  "/_next/static/chunks/1867-b3dfd8e91421e5bc.js",
  "/_next/static/chunks/1966.b8f83f7ba376c962.js",
  "/_next/static/chunks/2019-abde2d4857cb6814.js",
  "/_next/static/chunks/2180-9e81b0b6569eb38c.js",
  "/_next/static/chunks/2657-20921f4c801cd429.js",
  "/_next/static/chunks/2711.98e59e86083268ca.js",
  "/_next/static/chunks/2721-ea72bbe200442b8a.js",
  "/_next/static/chunks/2864-803f38d899ba2843.js",
  "/_next/static/chunks/3199.9e03b1743e123a74.js",
  "/_next/static/chunks/3384-e4a80441afc3b090.js",
  "/_next/static/chunks/370.e349c3eb9268e2a9.js",
  "/_next/static/chunks/3794-ee53deeac00cc115.js",
  "/_next/static/chunks/3899.3f761f7e3a944e8c.js",
  "/_next/static/chunks/44530001-fa4e007628c008b5.js",
  "/_next/static/chunks/4548-2f13f2fa35be0754.js",
  "/_next/static/chunks/4bd1b696-e356ca5ba0218e27.js",
  "/_next/static/chunks/5333.94cc9f612ddd9bfc.js",
  "/_next/static/chunks/5334-f4e9fbe94aff5ac9.js",
  "/_next/static/chunks/5580.9e03b1743e123a74.js",
  "/_next/static/chunks/561-474bab7f2774c031.js",
  "/_next/static/chunks/6308-a554169277c6b098.js",
  "/_next/static/chunks/6697-51647eda118e727f.js",
  "/_next/static/chunks/6736-12285c9ea9a6e184.js",
  "/_next/static/chunks/7102-34efc36eb39ce6b3.js",
  "/_next/static/chunks/7643-9d72a9b03e281c2b.js",
  "/_next/static/chunks/7805-ddb9965ac00c21f5.js",
  "/_next/static/chunks/7888.4c87352deee6771e.js",
  "/_next/static/chunks/8094.5a1c1b54b3d52bce.js",
  "/_next/static/chunks/8527-035601dcda96a9c2.js",
  "/_next/static/chunks/868-4e184ed84017c095.js",
  "/_next/static/chunks/8842-70b05f2cfadf6c39.js",
  "/_next/static/chunks/9021-9aa6f9f3c8bfb9bf.js",
  "/_next/static/chunks/9123-04dcf4e0447e5846.js",
  "/_next/static/chunks/9176.0bbb850c19889cd9.js",
  "/_next/static/chunks/app/auth/page-b5627c6a7dcaaa31.js",
  "/_next/static/chunks/app/bookmarks/page-e8ab1b716ff950b8.js",
  "/_next/static/chunks/app/chart/edit/page-390dabc31174e95d.js",
  "/_next/static/chunks/app/chart/layout-e5a818fa32f61803.js",
  "/_next/static/chunks/app/chart/page-8ae1e2c382ab87cd.js",
  "/_next/static/chunks/app/chart/[id]/edit/page-2c8ae2c4b4087d40.js",
  "/_next/static/chunks/app/chart/[id]/layout-e5a818fa32f61803.js",
  "/_next/static/chunks/app/chart/[id]/page-4f863e54151a31b5.js",
  "/_next/static/chunks/app/chords/page-ab8dcdaa1d8c30ed.js",
  "/_next/static/chunks/app/folder/page-d44463eabd95eb3e.js",
  "/_next/static/chunks/app/folder/[id]/layout-e5a818fa32f61803.js",
  "/_next/static/chunks/app/folder/[id]/page-a3926c2bca042c5b.js",
  "/_next/static/chunks/app/layout-9b009b1f3dc73924.js",
  "/_next/static/chunks/app/loading-fc9b62c58edc0b9d.js",
  "/_next/static/chunks/app/logo-review/page-f60b7b3ef275db78.js",
  "/_next/static/chunks/app/lyrics/edit/page-14b238a97e053a42.js",
  "/_next/static/chunks/app/lyrics/folder/page-023cda559bd73230.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/layout-e5a818fa32f61803.js",
  "/_next/static/chunks/app/lyrics/folder/[id]/page-a91ff53463516546.js",
  "/_next/static/chunks/app/lyrics/page-827076277432cdc3.js",
  "/_next/static/chunks/app/lyrics/view/page-bea772aca1fc2a7e.js",
  "/_next/static/chunks/app/lyrics/[id]/edit/page-d2cd0bc738142c0e.js",
  "/_next/static/chunks/app/lyrics/[id]/layout-e5a818fa32f61803.js",
  "/_next/static/chunks/app/lyrics/[id]/page-a30ee75240f6fc39.js",
  "/_next/static/chunks/app/page-f1f70fcda65fb3a3.js",
  "/_next/static/chunks/app/perform/page-7daa33af1739b114.js",
  "/_next/static/chunks/app/perform/stage/page-4212f40880f5c8dc.js",
  "/_next/static/chunks/app/perform/[code]/layout-e5a818fa32f61803.js",
  "/_next/static/chunks/app/perform/[code]/page-60ce0b9e237a114f.js",
  "/_next/static/chunks/app/printer/page-a97a33243111a7da.js",
  "/_next/static/chunks/app/profile/page-b21f35c2300dc1ab.js",
  "/_next/static/chunks/app/setlists/page-bec7701460a1c0d6.js",
  "/_next/static/chunks/app/setlists/perform/page-3bea4baba9ebaf35.js",
  "/_next/static/chunks/app/setlists/view/page-6ff6b255e159c2c7.js",
  "/_next/static/chunks/app/setlists/[id]/layout-e5a818fa32f61803.js",
  "/_next/static/chunks/app/setlists/[id]/page-a43ad20d48f79aab.js",
  "/_next/static/chunks/app/setlists/[id]/perform/page-032a5de7e2238a7e.js",
  "/_next/static/chunks/app/settings/page-9dca2eba5bf9ce9d.js",
  "/_next/static/chunks/app/trash/page-7dfd201ad25d1e72.js",
  "/_next/static/chunks/app/_global-error/page-e5a818fa32f61803.js",
  "/_next/static/chunks/app/_not-found/page-c98b230847e07efc.js",
  "/_next/static/chunks/framework-32a7466d5cae4a81.js",
  "/_next/static/chunks/main-app-040f5bc405bd20c6.js",
  "/_next/static/chunks/main-e1ef38dc0d0a56c9.js",
  "/_next/static/chunks/next/dist/client/components/builtin/app-error-e5a818fa32f61803.js",
  "/_next/static/chunks/next/dist/client/components/builtin/forbidden-e5a818fa32f61803.js",
  "/_next/static/chunks/next/dist/client/components/builtin/global-error-c9d4c13f2c41ca7e.js",
  "/_next/static/chunks/next/dist/client/components/builtin/not-found-e5a818fa32f61803.js",
  "/_next/static/chunks/next/dist/client/components/builtin/unauthorized-e5a818fa32f61803.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "/_next/static/chunks/webpack-919cb186ed146b97.js",
  "/_next/static/css/604775b3a74dc580.css",
  "/_next/static/css/676caacb685ce77a.css",
  "/_next/static/css/68b5b925d1cfe237.css",
  "/_next/static/css/8cae3b885bd6a527.css",
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
  "/_next/static/o_bPuA3AftM9VmP5CcFTV/_buildManifest.js",
  "/_next/static/o_bPuA3AftM9VmP5CcFTV/_ssgManifest.js"
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

            const trimmedTxt = url.pathname.replace(/\/index\.txt$/, '') + '/index.txt';
            const trimmedMatch = await caches.match(trimmedTxt, { ignoreSearch: true });
            if (trimmedMatch) return trimmedMatch;
          }
          return new Response('', { status: 404, statusText: 'Offline Resource Not Found' });
        });
    })
  );
});

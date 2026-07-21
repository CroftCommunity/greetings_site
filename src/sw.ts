/// <reference lib="webworker" />
// App-shell service worker (Phase 1b). Precaches the shell (HTML/JS/CSS/manifest/
// icon) for installability and fast repeat loads. It caches the SHELL ONLY —
// card data (cross-origin PDS reads) and any other request pass straight to the
// network, so the SW never stores card content. URL fragments (including the
// #k= card key) are never sent in a fetch request, so the key can never reach
// this handler; the SW is structurally incapable of seeing it.
//
// __BUILD_VERSION__ and __PRECACHE__ are injected by scripts/build.mjs at build
// time (esbuild define), so the cache name changes every deploy and the precache
// list always names the current hashed assets.
export {}; // module scope: use the global `self`, don't redeclare it

declare const __BUILD_VERSION__: string;
declare const __PRECACHE__: readonly string[];

// The project tsconfig loads both DOM and WebWorker libs, so the global `self`
// is Window-typed; cast once to the SW scope so the event maps resolve.
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `greetings-shell-${__BUILD_VERSION__}`;

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([...__PRECACHE__]);
      await sw.skipWaiting();
    })(),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Shell only: same-origin GETs. Everything else (PDS reads, cross-origin) goes
  // straight to the network — the SW never caches card data.
  if (req.method !== 'GET' || url.origin !== sw.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      return fetch(req);
    })(),
  );
});

---
course: javascript
slug: service-workers-and-offline-caching
experienceLevel: mid
difficulty: hard
tags:
  - service-workers
  - pwa
  - caching
question: What is a service worker and how does it enable offline caching?
answer: |
  A service worker is a script the browser runs in the background, separate from your pages, that acts as a **programmable network proxy**: it can intercept every request from pages in its scope through the `fetch` event and answer from the Cache Storage API, which is how sites work offline and load instantly on repeat visits.

  Lifecycle:

  1. **Register** from the page: `navigator.serviceWorker.register('/sw.js')`. Requires HTTPS (or `localhost`). The scope defaults to the folder the script lives in.
  2. **Install**: the `install` event is where you usually pre-cache the app shell (HTML, CSS, JS, icons) with `event.waitUntil(...)`.
  3. **Activate**: the `activate` event is where you delete old caches from previous versions.
  4. **Fetch**: once active and controlling the page, the worker receives `fetch` events and calls `event.respondWith(...)`.

  A new version waits in the "waiting" state until all tabs using the old one are closed. `self.skipWaiting()` and `clients.claim()` let it take over immediately, at the risk of mixing old pages with new assets.

  Common caching strategies:

  - **Cache first**: serve from cache, fall back to network. Best for versioned static assets (`app.3f9a1c.js`).
  - **Network first**: try the network, fall back to cache when offline. Good for HTML and API data that should be fresh.
  - **Stale-while-revalidate**: serve the cached copy immediately and update the cache in the background. Good for avatars, non-critical data.

  Pitfalls:

  - A buggy service worker can keep serving stale or broken files. Version your cache names, never cache the `sw.js` file itself with long HTTP cache headers, and keep a way to unregister.
  - Service workers have no DOM access and can be stopped at any time; do not keep state in global variables, use IndexedDB.
  - Only cache successful responses (`response.ok`) and only `GET` requests.
  - Do not blindly cache authenticated or personalised API responses.

  In real projects, tools like Workbox generate this code and the precache manifest for you.
codeExample: |
  // In the browser:
  // main.js: register the service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then((reg) => console.log('SW scope:', reg.scope));
  }

  // sw.js
  const CACHE = 'app-shell-v2';
  const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/offline.html'];

  self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
    );
  });

  self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.mode === 'navigate') {
      // Network first for pages, offline page as fallback
      event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
      return;
    }
    // Cache first for static assets
    event.respondWith(
      caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
    );
  });
popularity: 7.3
isPublished: true
---

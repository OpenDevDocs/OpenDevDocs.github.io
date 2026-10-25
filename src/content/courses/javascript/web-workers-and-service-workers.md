---
publishDate: 2026-03-27T09:45
title: Web Workers and Service Workers
slug: web-workers-and-service-workers
metadescription: Move heavy work off the main thread with Web Workers, and make your site work offline with Service Workers.
updateDate: 2026-09-05T09:45
author: ['bishal-biswas']
level: 3
tags: ['performance', 'workers', 'browser']
course: javascript
---

## Two different tools

Both run scripts away from your main page, but they solve different problems:

- A **Web Worker** gives you a second thread so heavy computation does not freeze the page.
- A **Service Worker** sits between your page and the network, so you can cache responses and work offline.

## Web Workers

Remember from the event loop topic: JavaScript has one thread, so a long calculation freezes everything.

```javascript
function heavyCalculation() {
  let total = 0;
  for (let i = 0; i < 1e9; i++) {
    total += i;
  }
  return total;
}
```

Run that on the main thread and the page is unresponsive for seconds.

### Creating a worker

The worker code lives in its own file.

```javascript
// worker.js
self.addEventListener('message', (event) => {
  const { limit } = event.data;
  let total = 0;
  for (let i = 0; i < limit; i++) {
    total += i;
  }
  self.postMessage({ total });
});
```

```javascript
// main.js
const worker = new Worker('worker.js');
worker.postMessage({ limit: 1e9 });
worker.addEventListener('message', (event) => {
  console.log('Result:', event.data.total);
});
worker.addEventListener('error', (event) => {
  console.log('Worker failed:', event.message);
});
```

The page stays completely responsive while that runs.

Use `type: 'module'` if your worker uses `import`:

```javascript
const worker = new Worker('worker.js', { type: 'module' });
```

### Wrapping it in a promise

The message API is awkward for one off jobs.

```javascript
function runInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('worker.js');
    worker.onmessage = (event) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
    worker.postMessage(data);
  });
}
runInWorker({ limit: 1e8 }).then(result => console.log(result));
```

Always `terminate()` a worker you are finished with. Each one costs real memory.

### What a worker cannot do

- **No DOM.** There is no `document` and no `window`. A worker computes, the main thread renders.
- **No shared variables.** Data is **copied** between threads, not shared.

```javascript
const data = { count: 1 };
worker.postMessage(data);
data.count = 2;
```

The worker sees `1`. It got a copy.

Copying large data costs time. For big buffers, transfer ownership instead:

```javascript
const buffer = new ArrayBuffer(1024 * 1024);
worker.postMessage({ buffer }, [buffer]);
console.log(buffer.byteLength);
```

After transfer, the main thread's buffer is empty, with length `0`. Nothing was copied, so it is instant.

### When to use one

Worth it for image processing, large data parsing, cryptography, complex maths, or sorting tens of thousands of rows. Not worth it for a small loop, because starting a worker and copying data has its own cost.

## Service Workers

A service worker is a script the browser keeps running in the background, separate from any tab. It can intercept every network request your site makes.

### Registering

```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Registered, scope:', registration.scope);
    } catch (error) {
      console.log('Registration failed:', error);
    }
  });
}
```

The file location decides the **scope**. A worker at `/sw.js` controls the whole site. One at `/app/sw.js` controls only `/app/`.

> Service workers require HTTPS, with `localhost` allowed for development.

### The lifecycle

```javascript
// sw.js
const CACHE_NAME = 'my-site-v1';
const PRECACHE = ['/', '/index.html', '/styles.css', '/app.js'];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.filter(name => name !== CACHE_NAME)
             .map(name => caches.delete(name))
      )
    )
  );
});
```

- **install** runs once, and is where you pre cache files.
- **activate** runs when the new worker takes over, and is where you delete old caches.

Bumping `CACHE_NAME` is how you ship an update.

### Intercepting requests

```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
```

This is **cache first**: serve from cache if possible, otherwise go to the network. Fast, but content can go stale.

### Common strategies

```javascript
// Network first, falling back to cache. Good for API data.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

```javascript
// Stale while revalidate. Instant response, updated in the background.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        return response;
      });
      return cached || network;
    })
  );
});
```

Note `response.clone()`. A response body can only be read once, so you need a copy to cache and one to return.

Match the strategy to the content: cache first for images and fonts, network first for API data, stale while revalidate for pages.

### Talking to the page

```javascript
// In the page
navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' });
// In sw.js
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

By default a new service worker waits until every tab is closed. `skipWaiting` lets it take over immediately.

### Debugging

DevTools has an **Application** panel with a Service Workers section. You can unregister, force an update, and simulate offline. Tick "Update on reload" while developing, or you will keep testing the old worker.

## Quick recap

- A Web Worker adds a thread for heavy computation, with no DOM access.
- Data is copied between threads, or transferred for large buffers.
- Terminate workers you are done with.
- A Service Worker intercepts network requests and enables offline use.
- It needs HTTPS, and its file location sets its scope.
- `install` pre caches, `activate` cleans old caches, `fetch` serves requests.
- Pick cache first, network first or stale while revalidate to suit the content.

<code id="code-content" class="language-javascript">
// ---------- worker.js: runs on its own thread, no DOM here ----------
self.addEventListener('message', function (event) {
  const limit = event.data.limit;
  let total = 0;
  for (let i = 0; i &lt; limit; i++) total += i;   // heavy, but off the main thread
  self.postMessage({ total: total });
});
// ---------- main.js: the page stays responsive throughout ----------
function runInWorker(data) {
  return new Promise(function (resolve, reject) {
    const worker = new Worker('worker.js');
    worker.onmessage = function (event) {
      resolve(event.data);
      worker.terminate();               // always clean up
    };
    worker.onerror = function (error) {
      reject(error);
      worker.terminate();
    };
    worker.postMessage(data);           // data is COPIED, not shared
  });
}
runInWorker({ limit: 1e8 }).then(result =&gt; console.log('Total:', result.total));
// Large buffers can be transferred instead of copied, which is instant
const buffer = new ArrayBuffer(1024 * 1024);
// worker.postMessage({ buffer }, [buffer]);
// after transfer, buffer.byteLength on this side becomes 0
// ---------- sw.js: a service worker caching for offline use ----------
const CACHE_NAME = 'my-site-v1';
const PRECACHE = ['/', '/index.html', '/styles.css', '/app.js'];
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =&gt; cache.addAll(PRECACHE))
  );
});
self.addEventListener('activate', function (event) {
  event.waitUntil(                       // delete caches from older versions
    caches.keys().then(names =&gt; Promise.all(
      names.filter(n =&gt; n !== CACHE_NAME).map(n =&gt; caches.delete(n))
    ))
  );
});
// Stale while revalidate: answer instantly, refresh in the background
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const network = fetch(event.request).then(function (response) {
        const copy = response.clone();   // a body can only be read once
        caches.open(CACHE_NAME).then(cache =&gt; cache.put(event.request, copy));
        return response;
      });
      return cached || network;
    })
  );
});
// ---------- registering it from the page ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async function () {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker scope:', reg.scope);
    } catch (error) {
      console.log('Registration failed:', error.message);
    }
  });
}
</code></pre>

---
course: javascript
slug: web-workers
experienceLevel: mid
difficulty: medium
tags:
  - browser
  - concurrency
  - performance
question: What are Web Workers and when should you use them?
answer: |
  Web Workers run JavaScript on a **separate background thread**, so CPU-heavy work does not block the main thread that handles rendering and user input; the worker and the page communicate only by passing messages.

  How they work:

  - Create one with `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`. The worker has its own global scope (`self`), its own event loop and no access to the DOM, `window` or `document`.
  - Communicate with `postMessage(data)` and `onmessage`/`addEventListener('message')` on both sides.
  - Data is **copied** with the structured clone algorithm, so functions, DOM nodes and class prototypes do not survive the trip.
  - Large binary data such as `ArrayBuffer`s can be **transferred** instead of copied (`postMessage(buf, [buf])`). Transfer is near-instant, but the sender loses access to the buffer.
  - Workers can use `fetch`, `IndexedDB`, `WebSocket`, timers and `importScripts` (classic workers) or `import` (module workers).

  Good use cases:

  - Parsing or transforming large JSON/CSV files, image and video processing, compression, encryption, syntax highlighting, search indexing, complex calculations or WebAssembly workloads.
  - Rule of thumb: anything that blocks the main thread for more than about 50 ms is a candidate.

  Types of workers:

  - **Dedicated workers**: one page, one worker. The common case.
  - **Shared workers**: shared by several tabs of the same origin.
  - **Service workers**: a different tool, acting as a network proxy for offline support, not for computation.

  Pitfalls:

  - Starting a worker and copying data has overhead. For small tasks the messaging cost can exceed the work itself.
  - Message-based code becomes awkward quickly. Libraries like Comlink wrap workers in a promise-based RPC interface.
  - Handle `error` and `messageerror` events and call `worker.terminate()` when done, or idle workers keep using memory.
  - `SharedArrayBuffer` and `Atomics` allow real shared memory, but they require cross-origin isolation headers (COOP/COEP).

  In Node.js, the equivalent is the `worker_threads` module.
codeExample: |
  // In the browser:
  // main.js
  const worker = new Worker(new URL('./primes-worker.js', import.meta.url), { type: 'module' });

  worker.addEventListener('message', (event) => {
    const { count, ms } = event.data;
    console.log(`Found ${count} primes in ${ms} ms`); // UI stayed responsive meanwhile
    worker.terminate();
  });
  worker.addEventListener('error', (event) => console.error('Worker failed:', event.message));

  worker.postMessage({ limit: 5_000_000 });           // copied via structured clone
  document.querySelector('#status').textContent = 'Calculating...';

  // primes-worker.js
  self.addEventListener('message', (event) => {
    const start = performance.now();
    const { limit } = event.data;
    const sieve = new Uint8Array(limit + 1);           // heavy CPU work, off the main thread
    let count = 0;
    for (let i = 2; i <= limit; i++) {
      if (sieve[i]) continue;
      count++;
      for (let j = i * i; j <= limit; j += i) sieve[j] = 1;
    }
    self.postMessage({ count, ms: Math.round(performance.now() - start) });
  });

  // Output in the console (time varies): Found 348513 primes in 25 ms
popularity: 7.4
isPublished: true
---

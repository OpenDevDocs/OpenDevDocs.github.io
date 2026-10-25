---
course: javascript
slug: sharedarraybuffer-and-atomics
experienceLevel: senior
difficulty: hard
tags:
  - concurrency
  - workers
  - memory
question: "What are `SharedArrayBuffer` and `Atomics`, and when should you use them?"
answer: |
  Workers normally communicate by **message passing**: `postMessage` copies data with the structured clone algorithm, or transfers ownership of an `ArrayBuffer`. A `SharedArrayBuffer` is different. The **same memory** is visible to every thread that holds it, so there is no copying, but you now have real shared-memory concurrency with data races.

  `Atomics` provides the primitives that make shared memory safe:

  - `Atomics.add`, `sub`, `and`, `or`, `exchange` and `compareExchange` perform read-modify-write operations indivisibly. A plain `view[0]++` from two threads loses updates.
  - Atomic `load` and `store` also give ordering guarantees, so writes made before a store are visible to a thread that observes it.
  - `Atomics.wait` blocks a thread until another thread calls `Atomics.notify` on the same index. Browsers do not allow it on the main thread. `Atomics.waitAsync` (ES2024) is the non-blocking variant.

  With `compareExchange` plus `wait` and `notify` you can build mutexes, semaphores and lock-free ring buffers. Libraries and WebAssembly threads (Emscripten pthreads) are built on exactly this.

  Constraints:

  - In browsers, `SharedArrayBuffer` is only available on **cross-origin isolated** pages, which must send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`). This was the mitigation after Spectre. Check `self.crossOriginIsolated`.
  - Node's `worker_threads` have no such restriction.

  When to use it: high-frequency coordination or large numeric data where copying dominates, such as audio, video, simulations or WASM. For ordinary job dispatch, message passing is simpler and far less bug-prone. Reach for shared memory only when profiling shows the copies matter.
codeExample: |
  const { Worker, isMainThread, workerData } = require('node:worker_threads');

  if (isMainThread) {
    const shared = new SharedArrayBuffer(8);
    const view = new Int32Array(shared);      // [0] = counter, [1] = done count
    for (let i = 0; i < 4; i++) {
      new Worker(__filename, { workerData: shared });
    }
    while (Atomics.load(view, 1) < 4) {
      Atomics.wait(view, 1, Atomics.load(view, 1), 100); // allowed in Node main thread
    }
    console.log('counter:', Atomics.load(view, 0));
    // Output: counter: 400000
  } else {
    const view = new Int32Array(workerData);
    for (let i = 0; i < 100_000; i++) {
      Atomics.add(view, 0, 1);                // view[0]++ here would lose updates
    }
    Atomics.add(view, 1, 1);
    Atomics.notify(view, 1);                  // wake the waiting main thread
  }
popularity: 7.2
isPublished: true
---

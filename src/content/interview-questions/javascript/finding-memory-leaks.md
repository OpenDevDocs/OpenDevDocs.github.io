---
course: javascript
slug: finding-memory-leaks
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - debugging
  - performance
question: How do you find and fix a memory leak in a JavaScript application?
answer: |
  A leak in a garbage-collected language is memory that is still **reachable** but no longer useful. The GC is working correctly; your code holds a reference it forgot about. The job is to find **who retains** the objects.

  The usual retainers:

  - Event listeners, `setInterval` callbacks and subscriptions that are never removed, each closing over large state.
  - Unbounded caches, such as a module-level `Map` keyed by request ID or user ID.
  - Closures that capture more than intended, such as a whole request object kept alive by a logger.
  - Detached DOM nodes still referenced from JavaScript.
  - Promises that never settle, with their continuations piling up.

  Diagnosis workflow:

  1. Confirm it is a leak. Watch `heapUsed` or the browser's memory panel over time **after GC**. A sawtooth that returns to a baseline is fine; a rising floor is a leak.
  2. Take **three heap snapshots** under a repeatable workload: baseline, after N operations, after 2N. In Node use `--inspect` with Chrome DevTools, or `v8.writeHeapSnapshot()`. Compare them and look for object counts that grow linearly with N.
  3. Open the **retainers** path of a leaked object. It usually ends in a listener array, a cache, or a closure context.
  4. Use the allocation timeline or the allocation sampling profiler to see which code path allocates the survivors.

  Fixes are about ownership: pair every `on` with an `off` (or pass an `AbortSignal` to `addEventListener`), bound caches with an LRU and a TTL, use `WeakMap` for metadata keyed by objects you don't own, and clear timers on dispose. In Node, a `MaxListenersExceededWarning` is often the first visible symptom.
codeExample: |
  const { EventEmitter } = require('node:events');
  const bus = new EventEmitter();

  class Widget {
    constructor(id) {
      this.buffer = new Array(100_000).fill(id); // large state
      this.onTick = () => this.buffer.length;     // closure retains `this`
      bus.on('tick', this.onTick);
    }
    dispose() { bus.off('tick', this.onTick); }
  }

  // Leak: the caller drops the widgets, but the bus still retains them
  for (let i = 0; i < 5; i++) new Widget(i);
  console.log('listeners after leak:', bus.listenerCount('tick'));
  // Output: listeners after leak: 5

  bus.removeAllListeners('tick');

  // Fix: every subscription has an owner that disposes it
  for (let i = 0; i < 5; i++) new Widget(i).dispose();
  console.log('listeners after dispose:', bus.listenerCount('tick'));
  // Output: listeners after dispose: 0

  // In production: call require('node:v8').writeHeapSnapshot() at intervals,
  // then compare the snapshots in Chrome DevTools > Memory.
popularity: 8.6
isPublished: true
---

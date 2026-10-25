---
course: javascript
slug: node-event-loop-phases
experienceLevel: senior
difficulty: hard
tags:
  - node
  - event-loop
  - async
question: "What are the phases of the Node.js event loop, and how do `process.nextTick`, promises, `setImmediate` and `setTimeout` interleave?"
answer: |
  Node's event loop is implemented by **libuv** and runs in fixed phases. Each iteration walks through them in order:

  1. **timers**: callbacks from `setTimeout` and `setInterval` whose threshold has passed.
  2. **pending callbacks**: some deferred system callbacks, such as certain TCP errors.
  3. **idle/prepare**: internal use only.
  4. **poll**: retrieves new I/O events and runs their callbacks. If nothing else is scheduled, the loop blocks here waiting for I/O.
  5. **check**: `setImmediate` callbacks.
  6. **close callbacks**: for example `socket.on('close')`.

  Two queues sit outside these phases. After **every** individual callback (since Node 11), Node drains the `process.nextTick` queue and then the promise microtask queue. In a CommonJS module, ticks run before promise reactions. In an ES module the order can differ, because module evaluation itself runs inside a promise job.

  Consequences that matter in production:

  - `setTimeout(fn, 0)` versus `setImmediate(fn)` from the main module has **no guaranteed order**. It depends on whether the 1 ms timer has expired when the loop starts. Inside an I/O callback, `setImmediate` **always** wins because check follows poll.
  - Recursive `process.nextTick` or an endless promise chain **starves** the loop. I/O and timers never run, yet the CPU is busy and nothing in the code looks blocking.
  - CPU-heavy synchronous work delays every phase. Measure it with `perf_hooks.monitorEventLoopDelay()` and alert on p99 loop delay, not just on CPU usage.

  Prefer `queueMicrotask` or `setImmediate` over `nextTick` in application code. Reserve `nextTick` for library code that must emit an event after the caller has attached its listeners but before any I/O.
codeExample: |
  const fs = require('node:fs');

  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  process.nextTick(() => console.log('nextTick'));
  Promise.resolve().then(() => console.log('promise'));
  console.log('sync');

  fs.readFile(__filename, () => {
    setTimeout(() => console.log('io: timeout'), 0);
    setImmediate(() => console.log('io: immediate'));
    process.nextTick(() => console.log('io: nextTick'));
  });

  // Output (CommonJS):
  // sync
  // nextTick
  // promise
  // timeout        <- these two may swap when scheduled from the main module
  // immediate
  // io: nextTick
  // io: immediate  <- always before the timer inside an I/O callback
  // io: timeout
popularity: 8.8
isPublished: true
---

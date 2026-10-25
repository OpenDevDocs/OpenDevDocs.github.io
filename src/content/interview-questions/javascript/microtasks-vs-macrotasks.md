---
course: javascript
slug: microtasks-vs-macrotasks
experienceLevel: mid
difficulty: hard
tags:
  - event-loop
  - promises
  - async
question: What is the difference between microtasks and macrotasks?
answer: |
  Microtasks and macrotasks (the spec simply calls them tasks) are two queues the event loop processes with different priority: after each task finishes, the **entire** microtask queue is drained before the next task runs or the browser renders.

  Where they come from:

  - **Macrotasks**: `setTimeout`, `setInterval`, `setImmediate` (Node.js), I/O callbacks, `MessageChannel` messages, user input and network events.
  - **Microtasks**: promise reactions (`then`, `catch`, `finally`), the continuation after `await`, `queueMicrotask()` and `MutationObserver` callbacks.

  Rules that explain most ordering questions:

  1. A microtask queued from inside a microtask runs in the same drain, before any timer. That is why a chain of ten `.then` calls all runs before a `setTimeout(fn, 0)` that was scheduled earlier.
  2. Only one macrotask runs per loop turn; then microtasks are drained again.
  3. In Node.js, `process.nextTick` callbacks have their own queue, which is drained **before** promise microtasks when running a CommonJS script.

  Pitfalls:

  - Recursively scheduling microtasks never yields to the task queue, so timers, I/O and rendering freeze. Recursively scheduling `setTimeout` does not have this problem, because each call is a separate task.
  - In Node.js, the order of `setTimeout(fn, 0)` vs `setImmediate` in the main module is not guaranteed; inside an I/O callback, `setImmediate` always runs first.
  - In an ES module, the module body itself runs inside a promise job, so promise callbacks can run before `process.nextTick`. Do not write code that depends on that order.

  Practical guidance: use `queueMicrotask` to defer work until the current synchronous code has finished but before anything else happens, for example to batch several state changes into one update. Use a macrotask (`setTimeout`, `MessageChannel`) when you actually want to yield so the browser can render or handle input.
codeExample: |
  // Run as a CommonJS script: node microtasks.js
  setTimeout(() => console.log('timeout 1'), 0);

  queueMicrotask(() => {
    console.log('microtask 1');
    queueMicrotask(() => console.log('microtask 3 (queued by microtask 1)'));
  });

  Promise.resolve().then(() => console.log('microtask 2'));

  process.nextTick(() => console.log('nextTick'));

  setTimeout(() => console.log('timeout 2'), 0);

  console.log('sync');

  // Output:
  // sync
  // nextTick
  // microtask 1
  // microtask 2
  // microtask 3 (queued by microtask 1)
  // timeout 1
  // timeout 2
popularity: 8.9
isPublished: true
---

---
course: javascript
slug: how-the-event-loop-works
experienceLevel: mid
difficulty: medium
tags:
  - event-loop
  - async
question: How does the JavaScript event loop work?
answer: |
  The event loop is what lets single-threaded JavaScript handle asynchronous work: it takes one task from a queue, runs it until the call stack is empty, drains **all** pending microtasks, and then moves on to the next task.

  The pieces involved:

  - **Call stack**: where synchronous code runs. Nothing else can run until it is empty.
  - **Host APIs**: timers, network, file I/O and DOM events are handled by the browser or by Node.js (libuv), outside the JavaScript thread. When they finish, they queue a callback.
  - **Task (macrotask) queue**: callbacks from `setTimeout`, `setInterval`, I/O, `MessageChannel` and UI events.
  - **Microtask queue**: promise reactions (`then`, `catch`, `finally`, the code after `await`) and `queueMicrotask`.

  One turn of the loop:

  1. Run the oldest task until the stack is empty.
  2. Run every microtask, including microtasks queued by other microtasks.
  3. In browsers, render if needed (`requestAnimationFrame` callbacks, style, layout, paint).
  4. Pick the next task.

  Practical consequences:

  - `setTimeout(fn, 0)` means "no sooner than 0 ms, once the stack and microtasks are clear", never immediately. Browsers clamp deeply nested timers to about 4 ms.
  - A long synchronous loop blocks everything: clicks, rendering and timers. Split heavy work into chunks that yield with `setTimeout` (or `scheduler.yield()` where supported), or move it to a Web Worker.
  - An endless chain of microtasks starves the loop just like a busy loop, because rendering and timers wait until the microtask queue is empty.
  - Node.js splits the loop into phases (timers, poll, check, close) and adds `process.nextTick`, which runs before promise microtasks.

  For ordering puzzles, the rule is: synchronous code first, then microtasks, then the next task such as a timer.
codeExample: |
  console.log('sync: script start');

  setTimeout(() => console.log('task: setTimeout 0'), 0);

  Promise.resolve()
    .then(() => console.log('microtask: then #1'))
    .then(() => console.log('microtask: then #2'));

  async function run() {
    console.log('sync: async function body before await');
    await null;
    console.log('microtask: code after await');
  }
  run();

  console.log('sync: script end');

  // Output:
  // sync: script start
  // sync: async function body before await
  // sync: script end
  // microtask: then #1
  // microtask: code after await
  // microtask: then #2
  // task: setTimeout 0
popularity: 9.4
isPublished: true
---

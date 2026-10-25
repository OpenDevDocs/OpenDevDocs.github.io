---
publishDate: 2026-03-20T09:33
title: Event Loop and Concurrency
slug: event-loop-and-concurrency
metadescription: Understand how single threaded JavaScript handles many things at once, and why promises always run before timers.
updateDate: 2026-09-05T09:33
author: ['bishal-biswas']
level: 2
tags: ['async', 'event-loop', 'internals']
course: javascript
---

## One thread, many tasks

JavaScript has **one** thread. It can only do one thing at a time.

So how does a page handle a network request, an animation and your clicks all at once? The answer is the **event loop**.

## The pieces

**The call stack** is where functions run. Calling a function pushes it on, returning pops it off.

```javascript
function third() { console.log('third'); }
function second() { third(); }
function first() { second(); }
first();
```

The stack goes `first`, then `second`, then `third`, then unwinds back down.

**Web APIs** are provided by the browser, not by JavaScript. Timers, network requests and DOM events live here, and they run outside your single thread.

**The task queue** holds callbacks that are ready to run, from timers and events.

**The microtask queue** holds promise callbacks. It has priority.

**The event loop** does one simple job, forever: if the stack is empty, take the next thing from a queue and run it.

## How they work together

```javascript
console.log('1');
setTimeout(() => console.log('2'), 0);
console.log('3');
```

Step by step:

1. `console.log('1')` runs. Prints `1`.
2. `setTimeout` hands the callback to the browser and returns immediately.
3. `console.log('3')` runs. Prints `3`.
4. The stack empties. The event loop takes the timer callback. Prints `2`.

Output: `1`, `3`, `2`.

## Microtasks jump the queue

This is the part worth memorising.

```javascript
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
```

Output: `1`, `4`, `3`, `2`.

The promise callback is a **microtask**, and the whole microtask queue is emptied before a single task is taken. So promises always beat timers, even with a zero delay.

## A fuller trace

```javascript
console.log('Start');
setTimeout(() => console.log('Timeout 1'), 0);
Promise.resolve()
  .then(() => console.log('Promise 1'))
  .then(() => console.log('Promise 2'));
setTimeout(() => console.log('Timeout 2'), 0);
queueMicrotask(() => console.log('Microtask'));
console.log('End');
```

The order is:

```javascript
// Start
// End
// Promise 1
// Microtask
// Promise 2
// Timeout 1
// Timeout 2
```

All the synchronous code first, then every microtask including ones created by other microtasks, then the tasks in order.

## Blocking the loop

Because there is only one thread, slow synchronous code freezes everything.

```javascript
function block() {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
  }
  console.log('Finished blocking');
}
block();
```

For three seconds the page does not respond to clicks, scrolling or anything else. Nothing can run, because the stack never empties.

This is why heavy work belongs in a Web Worker, which gets its own thread.

## Breaking work into chunks

If you must do heavy work on the main thread, split it so the browser can breathe.

```javascript
function processInChunks(items, chunkSize = 100) {
  let index = 0;
  function doChunk() {
    const end = Math.min(index + chunkSize, items.length);
    for (; index < end; index++) {
      // work on items[index]
    }
    if (index < items.length) {
      setTimeout(doChunk, 0);
    } else {
      console.log('All done');
    }
  }
  doChunk();
}
```

Each `setTimeout` yields control back, so clicks and repaints get a turn.

## Why timers are not exact

```javascript
setTimeout(() => console.log('after 100ms'), 100);
```

That means "not before 100ms", not "exactly at 100ms". If the stack is busy when the timer fires, the callback waits.

```javascript
setTimeout(() => console.log('timer'), 0);
const end = Date.now() + 2000;
while (Date.now() < end) {}
```

The timer callback runs after roughly two seconds, not zero.

Browsers also clamp nested timeouts to about 4ms, and throttle timers in background tabs to save battery.

## Rendering fits in too

The browser repaints between tasks, roughly 60 times a second. Long tasks mean missed frames and janky scrolling.

For animation, use `requestAnimationFrame`, which runs your callback right before the next paint:

```javascript
function animate() {
  // update positions here
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
```

## Node.js is similar but not identical

Node has the same loop idea with extra phases, plus `process.nextTick`, which runs even before promise microtasks.

```javascript
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
```

`nextTick` first, then `promise`, then the timer phases.

## Quick recap

- JavaScript runs on one thread with a call stack.
- Slow work is handed to browser APIs and comes back as a queued callback.
- The event loop runs a queued callback whenever the stack is empty.
- Microtasks, meaning promises, run before tasks like timers.
- Every microtask is drained before the next task starts.
- Long synchronous code freezes the page completely.
- Timer delays are a minimum, never a guarantee.

<code id="code-content" class="language-javascript">
// Synchronous code runs first, always
console.log('1 Start');
// setTimeout goes to the task queue
setTimeout(() =&gt; console.log('5 Timeout 0ms'), 0);
setTimeout(() =&gt; console.log('6 Timeout 10ms'), 10);
// Promises go to the microtask queue, which has priority
Promise.resolve()
  .then(() =&gt; console.log('3 Promise 1'))
  .then(() =&gt; console.log('4 Promise 2'));
queueMicrotask(() =&gt; console.log('3.5 Microtask'));
console.log('2 End');
// Output order:
// 1 Start, 2 End, 3 Promise 1, 3.5 Microtask, 4 Promise 2,
// 5 Timeout 0ms, 6 Timeout 10ms
// Every microtask drains before a single task runs
setTimeout(() =&gt; console.log('task: runs last'), 0);
Promise.resolve().then(() =&gt; {
  console.log('microtask A');
  Promise.resolve().then(() =&gt; console.log('microtask B, still before the task'));
});
// A blocking loop freezes everything, including clicks and repaints
function blockFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() &lt; end) { /* nothing can run */ }
  console.log('Blocked for', ms, 'ms');
}
// blockFor(3000);   // uncomment to freeze the page for 3 seconds
// Splitting heavy work into chunks lets the browser breathe
function processInChunks(items, chunkSize) {
  let index = 0;
  (function doChunk() {
    const end = Math.min(index + chunkSize, items.length);
    for (; index &lt; end; index++) { /* work on items[index] */ }
    if (index &lt; items.length) setTimeout(doChunk, 0);   // yield control
    else console.log('Processed', items.length, 'items');
  })();
}
processInChunks(new Array(1000).fill(0), 100);
</code></pre>

---
course: javascript
slug: settimeout-and-setinterval
experienceLevel: fresher
difficulty: easy
tags:
  - timers
  - async
question: "What is the difference between `setTimeout` and `setInterval`?"
answer: |
  `setTimeout(fn, delay)` runs a function once after at least `delay` milliseconds, while `setInterval(fn, delay)` runs it repeatedly, every `delay` milliseconds, until you stop it.

  Both return an ID (a number in browsers, a `Timeout` object in Node.js) that you pass to `clearTimeout` or `clearInterval` to cancel the timer. Extra arguments after the delay are passed to the callback.

  Important details:

  - The delay is a **minimum**, not a guarantee. The callback is queued as a task and only runs when the call stack is empty, so a busy main thread delays it further.
  - `setTimeout(fn, 0)` does not run immediately. It runs after the current code and after any pending promise callbacks (microtasks).
  - Browsers clamp nested timers to at least about 4 ms, and throttle timers in background tabs, often to once per second or less.
  - `setInterval` does not wait for the previous run to finish logically, and it does not account for drift. If a callback starts async work that takes longer than the interval, runs can overlap.

  Common pitfalls:

  - **Forgetting to clear an interval**, which keeps running forever and can leak memory. In UI components, clear it when the component is removed.
  - Passing a call instead of a function: `setTimeout(save(), 1000)` calls `save` immediately.
  - Losing `this` when passing a method; use an arrow function or `bind`.

  For repeated async work like polling, a **recursive `setTimeout`**, where each run schedules the next after it finishes, is often safer than `setInterval`. For animations, prefer `requestAnimationFrame`.
codeExample: |
  console.log("Start");

  setTimeout(() => console.log("Timeout after 0 ms"), 0);
  Promise.resolve().then(() => console.log("Promise callback"));

  let ticks = 0;
  const intervalId = setInterval(() => {
    ticks++;
    console.log(`Tick ${ticks}`);
    if (ticks === 3) clearInterval(intervalId); // always clean up
  }, 20);

  const cancelled = setTimeout(() => console.log("Never printed"), 10);
  clearTimeout(cancelled);

  setTimeout((name) => console.log(`Hello, ${name}`), 100, "Ada");

  console.log("End");
  // Output: Start
  // Output: End
  // Output: Promise callback
  // Output: Timeout after 0 ms
  // Output: Tick 1
  // Output: Tick 2
  // Output: Tick 3
  // Output: Hello, Ada
popularity: 8.6
isPublished: true
---

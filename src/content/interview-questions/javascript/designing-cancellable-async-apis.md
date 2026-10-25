---
course: javascript
slug: designing-cancellable-async-apis
experienceLevel: senior
difficulty: hard
tags:
  - async
  - api-design
  - abortcontroller
question: "How do you design cancellable async APIs in JavaScript with `AbortSignal`?"
answer: |
  Promises have no built-in cancellation. The platform's standard answer is **`AbortController` and `AbortSignal`**, supported by `fetch`, `addEventListener`, Node's `fs`, `stream`, `timers/promises`, `child_process` and many libraries. A well-designed async API takes an optional `{ signal }` option and honours it.

  The contract your function should follow:

  - **Check early**: call `signal?.throwIfAborted()` before starting work, since the signal may already be aborted.
  - **Listen while pending**: `signal.addEventListener('abort', onAbort, { once: true })`, and on abort, stop the underlying work (clear the timer, abort the inner `fetch`, close the cursor) and reject with `signal.reason`.
  - **Clean up the listener** when the operation finishes normally. Otherwise long-lived signals accumulate listeners and leak.
  - **Pass the signal down** to every async call you make, so cancellation propagates through the whole operation.
  - **Reject with the reason.** By default it's a `DOMException` named `AbortError`, or `TimeoutError` for `AbortSignal.timeout()`. Callers can tell cancellation apart from failure and usually shouldn't log it as an error.

  Composition helpers:

  - `AbortSignal.timeout(ms)` creates a signal that aborts after a delay.
  - `AbortSignal.any([a, b])` aborts when any input does. It's available in current browsers and Node 20+, and it's how you combine a user's cancel button with a timeout.

  Cancellation is **cooperative**. Aborting doesn't stop CPU-bound JavaScript that never checks the signal, and it can't undo server-side effects of a request that already arrived. For long loops, check `signal.aborted` between chunks. For non-idempotent operations, document what state is left after cancellation.
codeExample: |
  function sleep(ms, { signal } = {}) {
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);   // no leaked listener
        resolve(ms);
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  async function syncAll(items, { signal } = {}) {
    for (const item of items) await sleep(50, { signal }); // pass it down
    return 'synced';
  }

  async function main() {
    console.log(await sleep(10));                         // Output: 10

    const userCancel = new AbortController();
    const signal = AbortSignal.any([userCancel.signal, AbortSignal.timeout(120)]);
    try {
      await syncAll([1, 2, 3, 4], { signal });
    } catch (err) {
      console.log(err.name);                              // Output: TimeoutError
    }

    userCancel.abort();
    try { await sleep(10, { signal: userCancel.signal }); }
    catch (err) { console.log(err.name); }                // Output: AbortError
  }
  main();
popularity: 7.7
isPublished: true
---

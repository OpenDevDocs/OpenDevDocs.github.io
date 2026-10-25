---
course: javascript
slug: cancelling-requests-with-abortcontroller
experienceLevel: mid
difficulty: medium
tags:
  - fetch
  - async
  - abort-controller
question: "How do you cancel a fetch request or other async work with `AbortController`?"
answer: |
  Create an `AbortController`, pass its `signal` to `fetch` (or any API that accepts a signal), and call `controller.abort()` when the work is no longer needed; the pending promise then rejects with a `DOMException` named `AbortError` and the browser or Node.js stops the underlying request.

  The building blocks:

  - `controller.signal` is an `AbortSignal` with `aborted`, `reason`, an `abort` event and `throwIfAborted()`.
  - `controller.abort(reason)` aborts with an optional custom reason; the default reason is an `AbortError`.
  - `AbortSignal.timeout(ms)` returns a signal that aborts on its own with a `TimeoutError`, a cleaner replacement for racing against `setTimeout`.
  - `AbortSignal.any([a, b])` combines signals, for example "user clicked cancel **or** 10 seconds passed".

  Common uses:

  1. **Search-as-you-type**: abort the previous request when a new keystroke arrives, so a slow old response cannot overwrite newer results.
  2. **Component cleanup**: abort in React's `useEffect` cleanup so responses do not update an unmounted component.
  3. **Timeouts** on requests.
  4. **Removing event listeners**: `addEventListener(type, fn, { signal })` removes the listener when the signal aborts, so several listeners can be cleaned up with one call.
  5. **Your own async functions**: check `signal.aborted` or call `signal.throwIfAborted()` between steps, and listen for the `abort` event to stop timers.

  Pitfalls:

  - A controller is single-use. Once aborted, its signal stays aborted, so create a new controller for each new request.
  - Distinguish cancellation from real failures: check `err.name === 'AbortError'` (or `'TimeoutError'`) and usually ignore it instead of showing an error message.
  - Aborting on the client does not undo work the server has already done, such as a POST that already created a record.
  - Aborting while the body is being read rejects the `response.json()` promise too.
codeExample: |
  import { createServer } from 'node:http';

  const server = createServer((req, res) => setTimeout(() => res.end('slow'), 300));
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}`;

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);           // e.g. user clicked cancel
  try {
    await fetch(url, { signal: controller.signal });
  } catch (err) {
    console.log(err.name, controller.signal.aborted); // Output: AbortError true
  }

  try {
    await fetch(url, { signal: AbortSignal.timeout(50) });
  } catch (err) {
    console.log(err.name);                            // Output: TimeoutError
  }

  const res = await fetch(url, { signal: AbortSignal.any([new AbortController().signal, AbortSignal.timeout(2000)]) });
  console.log(await res.text());                      // Output: slow

  // One signal can remove many event listeners
  const target = new EventTarget();
  const listeners = new AbortController();
  target.addEventListener('ping', () => console.log('ping received'), { signal: listeners.signal });
  target.dispatchEvent(new Event('ping'));            // Output: ping received
  listeners.abort();
  target.dispatchEvent(new Event('ping'));            // (nothing logged)

  server.closeAllConnections();
  server.close();
popularity: 8.0
isPublished: true
---

---
course: javascript
slug: race-conditions-in-async-ui
experienceLevel: senior
difficulty: hard
tags:
  - async
  - ui
  - concurrency
question: How do race conditions happen in async UI code, and how do you make the latest request win?
answer: |
  JavaScript is single-threaded, but async UI code still has races, because **responses don't arrive in the order requests were sent**. The classic bug is a search box: the user types "re", then "react". The "re" request is slow, the "react" request is fast, and the stale "re" results arrive last and overwrite the correct ones. The same thing happens when switching tabs or routes, paginating quickly, or saving forms twice.

  Ways to make the latest request win:

  - **Abort the previous request.** Keep the `AbortController` of the in-flight request and call `abort()` before starting a new one. This saves bandwidth and server work, and an aborted `fetch` rejects with an `AbortError` you ignore.
  - **Ignore stale responses.** Tag each request with an incrementing ID, or capture the query, and only apply the result if it's still the latest. This also covers work you can't abort, such as a non-fetch API.
  - **Clean up on unmount or dependency change.** In React, the effect cleanup should abort or set an `ignore` flag. Data libraries (TanStack Query, SWR, RTK Query) key requests by parameters and handle this for you.

  Related races to look for in a review:

  - **Double submission**: disable the button or deduplicate with an idempotency key.
  - **Read-modify-write on shared state** across an `await`: state read before the `await` may be stale afterwards. Use functional updates (`setCount((c) => c + 1)`) or re-read after the `await`.
  - **Optimistic updates** that roll back the wrong version when two edits overlap.

  To find them, throttle the network in DevTools, add artificial random latency in development, and write tests that resolve promises out of order.
codeExample: |
  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); });
  });

  // Fake API: shorter queries are slower, so responses arrive out of order
  async function searchApi(query, signal) {
    await sleep(query.length === 2 ? 60 : 10, signal);
    return `results for "${query}"`;
  }

  let controller = null;
  let shown = '';
  async function onInput(query) {
    controller?.abort();                       // cancel the previous request
    controller = new AbortController();
    const { signal } = controller;
    try {
      const results = await searchApi(query, signal);
      if (signal.aborted) return;              // belt and braces: ignore stale
      shown = results;
      console.log('render:', shown);
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
      console.log('aborted:', query);
    }
  }

  onInput('re');
  onInput('react');
  // Output:
  // aborted: re
  // render: results for "react"
popularity: 8.0
isPublished: true
---

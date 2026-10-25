---
course: javascript
slug: fetch-error-handling
experienceLevel: mid
difficulty: medium
tags:
  - fetch
  - error-handling
  - http
question: "Why doesn't `fetch` reject on a 404 or 500, and how should you handle errors properly?"
answer: |
  `fetch` only rejects when the request could not be completed at all, such as a network failure, DNS error, CORS block or abort; an HTTP error status like 404 or 500 is still a successful response, so you must check `response.ok` (status 200-299) yourself.

  Failure modes to handle:

  1. **Network-level errors**: the promise rejects with a `TypeError` (`Failed to fetch` in Chrome, `fetch failed` in Node.js). CORS failures look the same, deliberately, so scripts cannot probe other origins.
  2. **HTTP errors**: the promise resolves. Check `response.ok` or `response.status` and throw your own error, ideally including the status and the error body from the server.
  3. **Body parsing errors**: `response.json()` rejects with a `SyntaxError` if the body is not valid JSON, for example an HTML error page from a proxy, or an empty `204` response.
  4. **Aborts and timeouts**: rejects with a `DOMException` named `AbortError` or `TimeoutError` when you use an `AbortSignal`.

  Practical guidance:

  - Wrap `fetch` in one helper that checks `ok`, parses the body and throws a typed error, so every call site does not repeat this logic.
  - Read the body only once. `response.json()` and `response.text()` consume the stream; use `response.clone()` if you need it twice.
  - Check `content-type` before calling `json()` when the server can return non-JSON, and handle `204 No Content`.
  - Set a timeout with `signal: AbortSignal.timeout(ms)`. `fetch` has no default timeout of its own in browsers.
  - Retry only idempotent requests and only on network errors or 5xx/429 responses, with backoff.
  - With `async`/`await`, remember to `await res.json()`; returning it without `await` inside a `try` will skip that `try` block's `catch`.

  In interviews, the key sentence is: "a resolved `fetch` promise means the server answered, not that the request succeeded".
codeExample: |
  import { createServer } from 'node:http';

  const server = createServer((req, res) => {
    if (req.url === '/ok') res.end('{"name":"Ada"}');
    else if (req.url === '/html') res.end('<html>proxy error</html>');
    else { res.statusCode = 404; res.end('{"error":"not found"}'); }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://localhost:${server.address().port}`;

  class HttpError extends Error {
    constructor(status, body) { super(`HTTP ${status}`); this.name = 'HttpError'; this.body = body; }
  }

  async function getJSON(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) }); // rejects on network errors only
    if (!res.ok) throw new HttpError(res.status, await res.text());
    return await res.json();                                            // may reject with SyntaxError
  }

  for (const path of ['/ok', '/missing', '/html']) {
    try {
      console.log(path, await getJSON(base + path));
    } catch (err) {
      console.log(path, err.name, err.message.slice(0, 20));
    }
  }
  server.close();

  // Output:
  // /ok { name: 'Ada' }
  // /missing HttpError HTTP 404
  // /html SyntaxError Unexpected token '<'
popularity: 8.8
isPublished: true
---

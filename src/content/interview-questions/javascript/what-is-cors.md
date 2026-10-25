---
course: javascript
slug: what-is-cors
experienceLevel: mid
difficulty: medium
tags:
  - cors
  - security
  - http
question: What is CORS and how does a preflight request work?
answer: |
  CORS (Cross-Origin Resource Sharing) is a browser mechanism that lets a server explicitly allow web pages from **other origins** to read its responses; without the right response headers, the browser's same-origin policy blocks JavaScript from reading a cross-origin response.

  Key ideas:

  - An **origin** is scheme + host + port. `https://app.com` and `https://api.app.com` are different origins, and so are `http://localhost:3000` and `http://localhost:5173`.
  - CORS is enforced **by the browser**, not the server. The request often reaches the server; the browser just refuses to expose the response. Server-to-server calls, curl and Postman are not affected.
  - The server opts in with headers such as `Access-Control-Allow-Origin: https://app.com`.

  Simple vs preflighted requests:

  - **Simple** requests (GET, HEAD or POST with only safe headers and a content type of `text/plain`, `multipart/form-data` or `application/x-www-form-urlencoded`) are sent directly. The browser then checks the response's `Access-Control-Allow-Origin`.
  - Anything else, such as `PUT`/`DELETE`, `Content-Type: application/json` or an `Authorization` header, triggers a **preflight**: an automatic `OPTIONS` request with `Origin`, `Access-Control-Request-Method` and `Access-Control-Request-Headers`. The server must answer with matching `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`, and can cache the answer with `Access-Control-Max-Age`.

  Credentials:

  - Cookies are only sent cross-origin with `credentials: 'include'`, and the server must reply with `Access-Control-Allow-Credentials: true` and a **specific** origin. The wildcard `*` is not allowed with credentials.

  Pitfalls and guidance:

  - "Fix" CORS on the server, not by disabling it in the browser. `mode: 'no-cors'` only gives you an unreadable opaque response.
  - Do not reflect any incoming `Origin` blindly when credentials are allowed; check it against an allowlist, and send `Vary: Origin`.
  - CORS is not CSRF protection: it controls who can **read** responses, not who can **send** requests.
  - In development, a dev-server proxy (for example in Vite) avoids cross-origin calls entirely.
codeExample: |
  // A minimal CORS-aware API with node:http, plus a simulated browser preflight
  import { createServer } from 'node:http';

  const ALLOWED = new Set(['https://app.example.com']);

  const server = createServer((req, res) => {
    const origin = req.headers.origin;
    if (ALLOWED.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {                     // preflight
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.writeHead(204).end();
    }
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}/items/1`;

  const preflight = await fetch(url, {
    method: 'OPTIONS',
    headers: { Origin: 'https://app.example.com', 'Access-Control-Request-Method': 'PUT' },
  });
  console.log(preflight.status, preflight.headers.get('access-control-allow-methods'));
  // Output: 204 GET, PUT, DELETE

  const evil = await fetch(url, { headers: { Origin: 'https://evil.example' } });
  console.log(evil.headers.get('access-control-allow-origin')); // Output: null (a browser would block reading it)
  server.close();
popularity: 8.7
isPublished: true
---

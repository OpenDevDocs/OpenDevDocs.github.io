---
publishDate: 2026-10-25T09:30
title: CORS Configuration
slug: cors-configuration
metadescription: Understand why browsers block cross-origin requests and learn to configure CORS in Express 5 with the cors package, including preflight requests and cookies.
updateDate: 2026-10-25T09:30
author: ['bishal-biswas']
level: 2
tags: ['express', 'cors', 'security', 'http']
course: expressjs
---

## What you will learn

- What an **origin** is and why browsers block some requests between origins
- How **CORS** headers tell the browser "this other site is allowed in"
- The difference between simple requests and **preflight** requests
- How to configure the `cors` package for one origin, several origins, and cookies
- Why CORS is not a replacement for real security

## The problem: "blocked by CORS policy"

Picture this. Your React app runs on `http://localhost:5173`. Your Express API runs on `http://localhost:3000`. The frontend calls the API:

```js
// frontend code running in the browser
const res = await fetch('http://localhost:3000/api/notes');
const notes = await res.json();
```

Instead of data, the browser console shows a red error saying the request "has been blocked by CORS policy" because no `Access-Control-Allow-Origin` header is present.

Your server did nothing wrong. In fact, if you look at the server logs, the request arrived and got a `200`. The **browser** received the response and then refused to hand it to your JavaScript. To understand why, you need two ideas: origins and the same-origin policy.

## What is an origin?

An **origin** is the combination of three things in a URL: the **scheme** (`http` or `https`), the **host** (`localhost`, `example.com`) and the **port** (`3000`). If any one of them differs, it is a different origin.

| URL A | URL B | Same origin? |
| --- | --- | --- |
| `http://localhost:3000` | `http://localhost:3000/api` | Yes (only the path differs) |
| `http://localhost:5173` | `http://localhost:3000` | No (different port) |
| `http://example.com` | `https://example.com` | No (different scheme) |
| `https://example.com` | `https://api.example.com` | No (different host) |

## The same-origin policy

Browsers follow a rule called the **same-origin policy**: JavaScript on one origin may *send* requests to another origin, but it may not *read* the response unless the other origin says it is OK.

Why? Imagine you are logged in to your bank in one tab. In another tab you open a shady website. Without this rule, the shady site's JavaScript could call your bank's API, with your cookies attached, and read your balance. The same-origin policy stops that.

**Think of it like an office building with a front desk.** Visitors (requests) can walk up to the desk. But the desk only lets them into the office if their name is on the guest list. **CORS** is how your server writes that guest list.

## What CORS is

**CORS** stands for **Cross-Origin Resource Sharing**. It is a set of HTTP response headers your server sends to tell the browser which other origins may read its responses.

The most important one is:

```http
Access-Control-Allow-Origin: http://localhost:5173
```

That header means "JavaScript from `http://localhost:5173` may read this response". If the header is missing or names a different origin, the browser blocks it.

> **Note:** CORS is enforced by **browsers only**. Tools like `curl`, Postman and other servers ignore it completely. That is why your API "works in curl but not in the browser".

## Simple requests and preflight requests

Browsers sort cross-origin requests into two groups.

A **simple request** is a `GET`, `HEAD` or `POST` with only basic headers, and (for `POST`) a `Content-Type` of `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`. The browser sends it straight away and checks the CORS headers on the response.

Everything else needs a **preflight request** first. That includes `PUT`, `PATCH` and `DELETE`, any request with `Content-Type: application/json`, and any request with a custom header such as `Authorization`. A preflight is an automatic `OPTIONS` request where the browser asks permission *before* sending the real request.

```text
Browser (localhost:5173)                     API (localhost:3000)
   |                                                |
   |-- OPTIONS /api/notes ------------------------->|   "May I send a PATCH
   |   Origin: http://localhost:5173                |    with Content-Type?"
   |   Access-Control-Request-Method: PATCH         |
   |   Access-Control-Request-Headers: content-type |
   |                                                |
   |<-- 204 No Content -----------------------------|   "Yes, you may."
   |   Access-Control-Allow-Origin: localhost:5173  |
   |   Access-Control-Allow-Methods: GET,PATCH,...  |
   |   Access-Control-Allow-Headers: content-type   |
   |                                                |
   |-- PATCH /api/notes/1 (the real request) ----->|
   |<-- 200 OK + Access-Control-Allow-Origin -------|
```

You do not write the preflight yourself. The browser sends it, and the `cors` middleware answers it for you.

## Installing the cors package

You could set these headers by hand with `res.set()`, but the details are fiddly. The `cors` package handles them correctly.

```bash
npm install cors
```

### Allow every origin

The simplest setup allows any website to read your API:

```js
// app.js
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors()); // allow all origins

app.get('/api/notes', (req, res) => {
  res.json([{ id: 1, title: 'Buy milk' }]);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('API on http://localhost:3000');
});
```

Check the headers with `curl -i`. The `-H "Origin: ..."` flag pretends to be a browser on another origin:

```bash
curl -i -H "Origin: http://localhost:5173" http://localhost:3000/api/notes
```

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
...
```

The `*` means "anyone". That is fine for a truly public, read-only API, such as a weather feed. For most apps, you want a guest list.

## Allowing specific origins

Pass an `origin` option. It can be a single string or an array.

```js
// app.js
app.use(cors({
  origin: ['http://localhost:5173', 'https://notes.example.com'],
}));
```

Now `cors` compares each request's `Origin` header with your list. If it matches, the response gets `Access-Control-Allow-Origin` with that exact origin. If not, the header is left out and the browser blocks the response.

The package also adds `Vary: Origin`. This tells caches that the response depends on the `Origin` header, so a cached answer for one site is not reused for another.

### Reading the list from the environment

Your allowed origins differ between your laptop and production, so keep them in an environment variable:

```bash
# .env
CORS_ORIGINS=http://localhost:5173,https://notes.example.com
```

```js
// app.js
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
```

> **Common mistake:** Adding a trailing slash, like `http://localhost:5173/`. Browsers send the origin with no slash and no path, so the strings never match.

### Deciding with a function

For more complex rules, such as "any subdomain of example.com", pass a function. It receives the request's origin and a callback.

```js
// app.js
const isAllowed = (origin) =>
  allowedOrigins.includes(origin) || /^https:\/\/[a-z0-9-]+\.example\.com$/.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    // Requests from curl, mobile apps or same-origin pages have no Origin header
    if (!origin) return callback(null, true);
    callback(null, isAllowed(origin));
  },
}));
```

Calling `callback(null, false)` simply leaves out the CORS headers. You could pass an error instead, but then every blocked request becomes a server error in your logs, which is noisy.

## Configuring preflight responses

These options shape the answer to preflight requests:

| Option | What it does | Default |
| --- | --- | --- |
| `methods` | Which HTTP methods are allowed | `GET,HEAD,PUT,PATCH,POST,DELETE` |
| `allowedHeaders` | Which request headers are allowed | Echoes whatever the browser asked for |
| `exposedHeaders` | Which response headers JavaScript may read | None beyond the basic ones |
| `credentials` | Allow cookies and auth headers | `false` |
| `maxAge` | Seconds the browser may cache the preflight answer | Not set |

A typical API setup:

```js
// app.js
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 600, // cache the preflight for 10 minutes
}));
```

`exposedHeaders` matters more than people expect. By default, browser JavaScript can read only a few "safe" response headers. If your API sends a custom header such as `X-Total-Count` for pagination, the frontend sees `null` until you expose it.

Test a preflight by hand:

```bash
curl -i -X OPTIONS http://localhost:3000/api/notes \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: PATCH" \
  -H "Access-Control-Request-Headers: Content-Type"
```

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5173
Vary: Origin
Access-Control-Allow-Methods: GET,POST,PATCH,DELETE
Access-Control-Allow-Headers: Content-Type,Authorization
Access-Control-Max-Age: 600
Content-Length: 0
```

## Cookies and credentials

By default, cross-origin `fetch` does not send cookies. If your API uses sessions (as in the earlier sessions lesson), both sides must opt in.

On the frontend:

```js
// frontend code
await fetch('http://localhost:3000/api/me', { credentials: 'include' });
```

On the server:

```js
// app.js
app.use(cors({
  origin: allowedOrigins, // must be explicit origins, never '*'
  credentials: true,      // sends Access-Control-Allow-Credentials: true
}));
```

> **Warning:** Browsers refuse `Access-Control-Allow-Origin: *` together with credentials. You must name the origin. Never "fix" this with `origin: true` (which reflects any origin) on an API that uses cookies: that would let every website make logged-in requests and read the answers.

Cookies across *sites* (not just ports) also need the right cookie settings, such as `SameSite=None` and `Secure`. Revisit the cookies lesson if your session cookie does not arrive.

## CORS on a single route

You can apply `cors` to just one route by passing it as route middleware:

```js
// app.js
const publicCors = cors(); // anyone can read this one

app.get('/api/public/stats', publicCors, (req, res) => {
  res.json({ notes: 42 });
});
```

If a route needs preflight, also answer `OPTIONS` for that path:

```js
app.options('/api/public/stats', publicCors);
```

> **Common mistake:** Copying `app.options('*', cors())` from an old Express 4 tutorial. In Express 5, a bare `*` path throws an error at startup. Use a named wildcard such as `app.options('/{*splat}', cors())`, or simply use `app.use(cors(...))`, which already answers preflights for every route.

## Order matters

Put `app.use(cors(...))` **before** your routes. If a route sends the response first, the CORS headers are never added. It should also come before anything that might reject the preflight, such as an authentication check, because browsers never attach credentials to the `OPTIONS` request.

```text
cors  ->  express.json()  ->  auth  ->  routes  ->  404  ->  error handler
```

## CORS is not security for your server

This is the most misunderstood part, so read it twice.

- CORS does **not** stop requests from reaching your server. A *simple* request from a blocked origin still runs your route handler; only the *reading* of the response is blocked. (A failed preflight does stop the browser from sending the real request, but an attacker can simply use a simple request or a non-browser client.)
- Non-browser clients ignore CORS entirely.
- So CORS never replaces authentication, authorization or input validation.

What CORS *does* do is protect your users' browsers from other websites reading data on their behalf. You will learn about the related attack, CSRF, in [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf).

> **Tip:** During development, you can often avoid CORS by using your frontend tool's dev proxy (for example, Vite's `server.proxy` option). The browser then talks to one origin, and the proxy forwards `/api` calls to Express.

## Common mistakes

- **Debugging in curl.** curl never complains about CORS. Test in the browser, or use `curl -i -H "Origin: ..."` and read the response headers.
- **Trailing slashes or wrong scheme in the origin list.** `https://example.com` and `http://example.com` are different origins.
- **Forgetting `exposedHeaders`** for custom headers the frontend needs to read.
- **`origin: '*'` with `credentials: true`.** Browsers reject this combination.
- **Registering `cors` after the routes**, so responses go out without the headers.

## Key takeaways

- An **origin** is scheme + host + port. Browsers block JavaScript from reading cross-origin responses unless the server allows it.
- **CORS** headers, mainly `Access-Control-Allow-Origin`, are the server's guest list.
- Non-simple requests (JSON bodies, `PUT`/`PATCH`/`DELETE`, custom headers) trigger an automatic **preflight** `OPTIONS` request.
- Use the `cors` package with an explicit `origin` list, loaded from the environment, and register it before your routes.
- CORS protects browsers, not your server. Keep authentication and validation in place.

## Practice

1. Serve a tiny HTML page from a second Express app on port 5173 that calls your API on port 3000. Watch it fail, then fix it with `cors`.
2. Restrict `origin` to `http://localhost:5173` and confirm with `curl -i -H "Origin: http://evil.test"` that the `Access-Control-Allow-Origin` header disappears.
3. Add an `X-Total-Count` header to a list route and read it from the frontend with `res.headers.get('X-Total-Count')`. Make it work with `exposedHeaders`.
4. Send a `PATCH` with a JSON body from the browser and find the preflight `OPTIONS` request in the Network tab of DevTools.

## What's next

Now that browsers can reach your API, you need to check that what they send is valid. Continue with [Request Validation with Zod](/courses/expressjs/request-validation-with-zod).

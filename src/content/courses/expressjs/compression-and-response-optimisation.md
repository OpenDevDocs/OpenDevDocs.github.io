---
publishDate: 2026-10-25T09:50
title: Compression and Response Optimisation
slug: compression-and-response-optimisation
metadescription: Learn how to shrink Express 5 responses with the compression middleware, when to compress in a proxy instead, and simple ways to send less data and measure response times.
updateDate: 2026-10-25T09:50
author: ['bishal-biswas']
level: 3
tags: ['express', 'compression', 'performance', 'http']
course: expressjs
---

## What you will learn

- What **HTTP compression** is and how the browser and server agree on it
- How to add the `compression` middleware and tune its options
- Which responses should and should not be compressed
- Whether to compress in Express or in a reverse proxy
- Simple habits that make responses smaller and faster, and how to measure them

## Why response size matters

Every byte your server sends has to travel over the network. On a fast office connection, a 500 KB JSON response feels instant. On a phone with weak signal, it can take seconds. Smaller responses mean faster apps and lower bandwidth bills.

**Think of posting a duvet.** You can post it fluffed up in a huge box, or squeeze the air out with a vacuum bag and post a small parcel. The duvet is the same when it arrives and gets unpacked. **Compression** is the vacuum bag for your responses.

Text formats such as JSON, HTML, CSS and JavaScript repeat themselves a lot (think of every `"name":` key in a list of 1,000 users). Compression algorithms are very good at squeezing out that repetition.

## How the browser and server agree

Compression is a polite negotiation using two headers:

```http
GET /api/report HTTP/1.1
Host: localhost:3000
Accept-Encoding: gzip, deflate, br
```

The browser says, "I can unpack gzip, deflate or Brotli (`br`)." The server picks one it supports and labels the response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Encoding: gzip
Vary: Accept-Encoding
```

| Header | Sent by | Meaning |
| --- | --- | --- |
| `Accept-Encoding` | Client | Which compression formats the client understands |
| `Content-Encoding` | Server | Which format this response body is actually compressed with |
| `Vary: Accept-Encoding` | Server | Tells caches "the body depends on `Accept-Encoding`", so they keep separate compressed and uncompressed copies |

The browser decompresses automatically. Your frontend code never notices.

## Adding the compression middleware

Express does not compress by default. The `compression` package adds it.

```bash
npm install compression
```

Register it **early**, before your routes and static files, so it can wrap every response that comes after it.

```js
// app.js
import express from 'express';
import compression from 'compression';

const app = express();

app.use(compression());
app.use(express.static('public'));

// A large, repetitive JSON response: perfect for compression
app.get('/api/report', (req, res) => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({
    id: i + 1,
    status: 'active',
    country: 'Nepal',
    createdAt: '2026-10-25T09:50:00.000Z',
  }));
  res.json(rows);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

That one line, `app.use(compression())`, is all most apps need.

### Seeing the difference

`curl` does not ask for compression unless you tell it to. Compare the number of bytes downloaded with and without the `Accept-Encoding` header:

```bash
curl -s -o /dev/null -w '%{size_download} bytes\n' http://localhost:3000/api/report
curl -s -o /dev/null -w '%{size_download} bytes\n' -H 'Accept-Encoding: gzip' http://localhost:3000/api/report
```

The second number is the compressed size. For repetitive JSON like this, expect it to be many times smaller than the first. Your exact numbers will depend on the data.

You can also see the headers:

```bash
curl -s -D - -o /dev/null -H 'Accept-Encoding: gzip' http://localhost:3000/api/report
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Vary: Accept-Encoding
Content-Encoding: gzip
Transfer-Encoding: chunked
```

> **Note:** There is no `Content-Length` on the compressed response. The middleware compresses as it goes, so it cannot know the final size in advance. It uses **chunked** transfer instead, which sends the body in pieces.

## What gets compressed (and what does not)

The middleware is smart about what it squeezes:

| Response | Compressed? | Why |
| --- | --- | --- |
| JSON, HTML, CSS, JS, SVG, plain text | Yes | Text compresses very well |
| JPEG, PNG, WebP, MP4, ZIP, PDF | No | Already compressed; squeezing again wastes CPU and can even make them bigger |
| Bodies smaller than 1 KB | No (by default) | The saving is tiny and not worth the effort |
| Requests without `Accept-Encoding` | No | The client cannot unpack it |
| Responses that already have `Content-Encoding` | No | Already done |

### Tuning the options

You can change the defaults:

```js
// app.js
app.use(
  compression({
    threshold: 1024, // only compress bodies of at least 1 KB (the default)
    level: 6, // 0 = none, 9 = smallest but slowest; 6 is a good balance
    filter: (req, res) => {
      // Let a client opt out with a custom header
      if (req.get('x-no-compression')) return false;
      // Otherwise use the library's default rules
      return compression.filter(req, res);
    },
  }),
);
```

The `level` is a trade-off. Higher levels make slightly smaller responses but take more CPU time on every request. The default is fine for almost everyone.

> **Warning:** Compression and **streaming updates** do not mix by default. The middleware waits to collect enough data before compressing it, so Server-Sent Events from [WebSockets and Server-Sent Events](/courses/expressjs/websockets-and-sse) may arrive late or in bursts. The middleware adds a `res.flush()` method: call it after each `res.write()` in an SSE route, or exclude those routes in your `filter`.

## Compress in Express or in a proxy?

In production, many Express apps sit behind a **reverse proxy** such as nginx, Caddy or a cloud load balancer, or behind a CDN. These can compress responses too, often with Brotli, which usually beats gzip on text.

| Where | Pros | Cons |
| --- | --- | --- |
| `compression` middleware in Express | Works everywhere, one line, good for small deployments | Uses your Node.js CPU, which also runs your app |
| Reverse proxy or CDN | Takes the work off Node.js; often faster native code; can cache compressed copies | Needs configuring in another tool |

A sensible rule: **if a proxy or CDN in front of you already compresses, do not also compress in Express.** Doing it twice wastes CPU. If you are not sure, check the response headers in production for `Content-Encoding`. You will learn about proxies in [Reverse Proxies and Trusting Proxy Headers](/courses/expressjs/reverse-proxies-and-trust-proxy).

> **Note:** There is a rare class of attack (called **BREACH**) where an attacker learns secrets by watching compressed sizes change. It only matters when a response contains both a secret (like a CSRF token) and text the attacker controls. Keep secrets out of responses that echo user input, and you are fine.

## Beyond compression: send less in the first place

Compression makes data smaller on the wire. The cheapest byte, though, is the one you never send. Here are simple habits that add up.

### 1. Return only the fields the client needs

A user list page probably needs names and avatars, not every address, setting and timestamp.

```js
// routes/users.js
usersRouter.get('/', async (req, res) => {
  const users = await User.find()
    .select('name avatarUrl') // only these fields
    .limit(20)
    .lean(); // plain objects, faster than full Mongoose documents
  res.json(users);
});
```

### 2. Paginate large lists

Never return 50,000 rows because someone asked for "all orders". You built this in [Pagination, Filtering and Sorting](/courses/expressjs/pagination-filtering-sorting).

### 3. Do not pretty-print JSON in production

`app.set('json spaces', 2)` makes JSON readable while debugging, but adds spaces and newlines to every response. Turn it on only in development:

```js
// app.js
if (process.env.NODE_ENV !== 'production') {
  app.set('json spaces', 2);
}
```

### 4. Let browsers cache what does not change

Use `Cache-Control` and ETags from [Caching with Redis and HTTP Cache Headers](/courses/expressjs/caching-with-redis). A response the browser does not have to download is faster than any compressed one.

### 5. Do expensive work once, not per request

If you read a config file or build a lookup table, do it once at startup instead of inside the route.

```js
// app.js
import { readFile } from 'node:fs/promises';

// Read once when the app starts
const countries = JSON.parse(await readFile(new URL('./data/countries.json', import.meta.url), 'utf8'));

app.get('/api/countries', (req, res) => {
  res.json(countries);
});
```

## Measuring response times

"Optimise" means nothing without numbers. A tiny middleware can log how long each request takes:

```js
// middleware/timing.js
export const timing = (req, res, next) => {
  const start = process.hrtime.bigint(); // a high-precision clock in nanoseconds

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });

  next();
};
```

```js
// app.js
import { timing } from './middleware/timing.js';
app.use(timing);
```

```text
GET /api/report 200 14.2ms
GET /api/countries 200 0.6ms
```

If you already use `pino-http` or `morgan` from [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino), they log response times for you. Look for the slowest and most frequent routes, then optimise those first. In [Load Testing and Performance Tuning](/courses/expressjs/load-testing-and-performance-tuning) you will measure under heavy traffic.

## Common mistakes

- **Adding `compression()` after your routes.** Middleware only affects what comes after it. Put it near the top.
- **Compressing images and videos.** They are already compressed. The default filter skips them; do not force them through.
- **Compressing twice.** If nginx or your CDN compresses, remove the middleware or turn the proxy's compression off.
- **Breaking SSE with buffering.** Call `res.flush()` or skip compression for `text/event-stream`.
- **Optimising without measuring.** A route that runs once a day does not need tuning.

## Key takeaways

- Compression shrinks text responses using `Accept-Encoding` (client) and `Content-Encoding` (server).
- `app.use(compression())` near the top of your app is usually all you need.
- Already-compressed files and tiny bodies are skipped automatically; the default `level` is a good balance.
- If a proxy or CDN compresses, do not compress again in Express.
- Sending less data (fewer fields, pagination, no pretty JSON, caching) often beats any compression setting.

## Practice

1. Add `compression()` to your Notes API and compare `size_download` for `GET /notes` with and without `Accept-Encoding: gzip`.
2. Change `threshold` to `0` and request a tiny endpoint. Is the compressed body actually smaller? Explain why the default is 1 KB.
3. Use `.select()` to trim a list endpoint down to three fields and measure the size difference.
4. Add the timing middleware and find the slowest route in your project.

## What's next

Your responses are now small and cached, but Node.js still uses only one CPU core by default. Continue with [Clustering and Worker Threads](/courses/expressjs/clustering-and-worker-threads).

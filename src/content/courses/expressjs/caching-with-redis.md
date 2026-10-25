---
publishDate: 2026-10-25T09:49
title: Caching with Redis and HTTP Cache Headers
slug: caching-with-redis
metadescription: Learn how to make Express 5 APIs faster with HTTP cache headers, ETags and a Redis cache-aside layer, and how to keep cached data fresh with TTLs and invalidation.
updateDate: 2026-10-25T09:49
author: ['bishal-biswas']
level: 3
tags: ['express', 'redis', 'caching', 'performance']
course: expressjs
---

## What you will learn

- What **caching** is and the two places you can cache: the client side and the server side
- How to control browser and CDN caching with the `Cache-Control` header and ETags
- How to connect Express to **Redis** and use the **cache-aside** pattern
- How to keep cached data fresh with expiry times and invalidation
- What should never be cached

## What is caching?

**Caching** means keeping a copy of an answer so you do not have to work it out again. Your browser caches images. Your brain caches your phone number. Servers cache expensive results.

**Think of a coffee shop.** Making each cup to order is slow. If the shop knows lots of people want plain black coffee at 8am, it brews a big pot and pours from it. The pot is the **cache**. When the coffee gets old, they throw it out and brew a fresh one. That is **expiry**.

There are two places to cache in a web app:

```text
 Browser cache / CDN            Your server                 Database
 (HTTP cache headers)    -->    (Redis cache)       -->     (slow, the "source of truth")
 "I already have this"          "I computed this            "Let me run that big
                                 a minute ago"               query again..."
```

| Layer | Who stores the copy | Saves | You control it with |
| --- | --- | --- | --- |
| **HTTP caching** | The browser, or a **CDN** (a network of servers close to users) | Whole requests never reach your server | Response headers |
| **Server-side caching** | Your server, usually in Redis | Database queries and heavy work | Your own code |

You often use both. Let's start with the one that needs no extra software.

## HTTP caching with Cache-Control

The `Cache-Control` response header tells browsers and CDNs whether they may keep a copy, and for how long.

```js
// app.js
import express from 'express';

const app = express();

app.get('/api/countries', (req, res) => {
  // Anyone may cache this for one hour (3600 seconds)
  res.set('Cache-Control', 'public, max-age=3600');
  res.json([{ code: 'NP', name: 'Nepal' }, { code: 'IN', name: 'India' }]);
});

app.get('/api/me', (req, res) => {
  // Personal data: never store it anywhere
  res.set('Cache-Control', 'no-store');
  res.json({ name: 'Asha' });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

The most useful directives:

| Directive | Meaning |
| --- | --- |
| `max-age=60` | The copy is fresh for 60 seconds |
| `public` | Shared caches (CDNs, proxies) may store it too |
| `private` | Only the user's own browser may store it |
| `no-cache` | You may store it, but must check with the server before using it |
| `no-store` | Do not store it at all |
| `s-maxage=300` | Like `max-age`, but only for shared caches such as CDNs |
| `stale-while-revalidate=30` | After expiry, serve the old copy for 30 more seconds while fetching a new one in the background |

> **Warning:** `no-cache` does **not** mean "do not cache". It means "check first". Use `no-store` for sensitive data such as account details or anything behind a login.

### ETags: "has it changed?"

An **ETag** is a short fingerprint of a response body. Express adds one automatically when you use `res.send()` or `res.json()`.

When the browser asks again, it sends the fingerprint back in an `If-None-Match` header. If the body would be the same, Express replies `304 Not Modified` with an empty body. The browser reuses its copy.

See it with `curl`:

```bash
curl -i http://localhost:3000/api/countries
```

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=3600
Content-Type: application/json; charset=utf-8
ETag: W/"47-8kM1pVh1f8B8s3kz2aVb1vXk3oA"
```

Copy your ETag value and send it back:

```bash
curl -i http://localhost:3000/api/countries -H 'If-None-Match: W/"47-8kM1pVh1f8B8s3kz2aVb1vXk3oA"'
```

```http
HTTP/1.1 304 Not Modified
Cache-Control: public, max-age=3600
ETag: W/"47-8kM1pVh1f8B8s3kz2aVb1vXk3oA"
```

Your ETag will be different. The `W/` means it is a **weak** ETag, which is the Express default.

> **Note:** A `304` saves bandwidth, not server work. Your route still ran and built the full response so Express could fingerprint it. To skip the work itself, you need a server-side cache.

### Caching static files

`express.static()` can set cache headers for you. Files whose names change when their content changes (for example `app.3f9a1c.js` from a build tool) can be cached for a very long time:

```js
// app.js
app.use('/assets', express.static('dist/assets', { maxAge: '1y', immutable: true }));
app.use(express.static('public', { maxAge: '1h' }));
```

`immutable` tells the browser not even to check for a new version while the copy is fresh.

## Server-side caching with Redis

Imagine a "top products" query that takes 800 milliseconds. A thousand visitors a minute means a thousand slow queries, all returning the same answer. A server-side cache runs the query once and serves the saved result to everyone else.

### What is Redis?

**Redis** is a very fast database that keeps data in memory. It stores **keys** and **values**, like a giant shared JavaScript `Map`, and each key can have an expiry time. That makes it perfect for caches.

Why not just use a `Map` inside your app? Because:

- Every copy of your app would have its own separate `Map`.
- The cache would be lost on every restart or deploy.
- It would grow without limit and use up your server's memory.

Redis runs as a separate service that all copies of your app share.

### Running Redis locally

The easiest way is Docker:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

Then install the Node.js client:

```bash
npm install redis
```

Add the connection URL to your `.env` file:

```bash
# .env
REDIS_URL=redis://localhost:6379
```

### Connecting

Put the connection in its own module so every route can share it:

```js
// lib/redis.js
import { createClient } from 'redis';

export const redis = createClient({ url: process.env.REDIS_URL });

redis.on('error', (error) => {
  console.error('Redis error:', error.message);
});

await redis.connect(); // top-level await works in ES modules
```

### The cache-aside pattern

The most common caching recipe is called **cache-aside**. The cache sits "to the side" of your database, and your code checks it first:

```text
 request --> is it in Redis?
               | yes --> return the cached copy (fast)
               | no  --> query the database
                         save the result in Redis with an expiry
                         return the result
```

Here it is in Express. The fake `getTopProducts()` waits 800 ms to act like a slow query.

```js
// app.js
import express from 'express';
import { redis } from './lib/redis.js';

const app = express();

const getTopProducts = async () => {
  await new Promise((resolve) => setTimeout(resolve, 800)); // pretend this is slow
  return [
    { id: 1, name: 'Keyboard', sold: 1200 },
    { id: 2, name: 'Mouse', sold: 950 },
  ];
};

app.get('/api/products/top', async (req, res) => {
  const key = 'products:top';

  const cached = await redis.get(key); // null if the key does not exist
  if (cached) {
    res.set('X-Cache', 'HIT');
    return res.json(JSON.parse(cached));
  }

  const products = await getTopProducts();
  await redis.set(key, JSON.stringify(products), { EX: 60 }); // expire after 60 seconds

  res.set('X-Cache', 'MISS');
  res.json(products);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Start it with your `.env` file loaded (Node.js 20.6+):

```bash
node --env-file=.env app.js
```

Call it twice and compare the time and the `X-Cache` header:

```bash
curl -s -o /dev/null -w '%{time_total}s\n' http://localhost:3000/api/products/top
curl -s -o /dev/null -w '%{time_total}s\n' http://localhost:3000/api/products/top
```

The first call takes a bit over 0.8 seconds. The second returns almost instantly, because the answer came from Redis.

> **Note:** Redis stores strings, so you `JSON.stringify` when saving and `JSON.parse` when reading.

### A reusable helper

Writing that `get / set` dance in every route gets repetitive. Wrap it in a small helper:

```js
// lib/cache.js
import { redis } from './redis.js';

export const remember = async (key, ttlSeconds, compute) => {
  try {
    const cached = await redis.get(key);
    if (cached) return { value: JSON.parse(cached), hit: true };
  } catch (error) {
    console.error('Cache read failed, using the database:', error.message);
  }

  const value = await compute();

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    console.error('Cache write failed:', error.message);
  }

  return { value, hit: false };
};
```

Notice the `try/catch` blocks. A cache is an optimisation. If Redis is down, your app should get slower, not break. Without the `try/catch`, Express 5 would forward the Redis error to your error handler and every request would fail with a `500`.

Now routes stay short:

```js
// routes/products.js
import { Router } from 'express';
import { remember } from '../lib/cache.js';
import { Product } from '../models/product.js';

export const productsRouter = Router();

productsRouter.get('/:id', async (req, res) => {
  const { value: product, hit } = await remember(`product:${req.params.id}`, 300, () =>
    Product.findById(req.params.id).lean(),
  );

  if (!product) return res.status(404).json({ error: 'Product not found' });

  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  res.json(product);
});
```

## Keeping the cache fresh

The hardest part of caching is not saving data. It is knowing when a saved copy is wrong. There are two tools.

### 1. Expiry (TTL)

Every key gets a **TTL** (time to live), like `{ EX: 60 }`. When it runs out, Redis deletes the key and the next request rebuilds it. Pick the TTL by asking: "How old can this data be before a user would notice or care?"

| Data | Reasonable TTL |
| --- | --- |
| List of countries | Hours or days |
| Product details | A few minutes |
| "Top products this hour" | 30-60 seconds |
| Stock level during a flash sale | Probably do not cache |

### 2. Invalidation

**Invalidation** means deleting a cached copy as soon as the real data changes. Do it in the routes that write data:

```js
// routes/products.js (continued)
productsRouter.patch('/:id', async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  await redis.del(`product:${req.params.id}`); // the old copy is now wrong
  await redis.del('products:top'); // lists that include it may be wrong too

  res.json(product);
});
```

> **Tip:** Use a consistent naming scheme for keys, such as `type:id` (`product:42`, `user:7:orders`). It makes invalidation much easier to reason about.

### Caching lists with query strings

For `/api/products?page=2&sort=price`, the query string is part of the answer, so it must be part of the key:

```js
// routes/products.js
productsRouter.get('/', async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const sort = req.query.sort === 'price' ? 'price' : 'name';
  const key = `products:list:page=${page}:sort=${sort}`;

  const { value } = await remember(key, 60, () =>
    Product.find().sort(sort).skip((page - 1) * 20).limit(20).lean(),
  );
  res.json(value);
});
```

Build the key from the **validated** values, not the raw query string. Otherwise `?sort=price&page=2` and `?page=2&sort=price` create two different keys for the same data, and an attacker could fill your Redis with junk keys.

## What not to cache

- **Personal data in shared caches.** Never mark per-user responses as `public`. A CDN could serve one user's data to another.
- **Anything that must be exact right now**, such as a bank balance at checkout.
- **Responses to `POST`, `PUT`, `PATCH`, `DELETE`.** Cache reads, not writes.
- **Errors.** If the database fails, do not save the error message for 60 seconds.

## Common mistakes

- **Caching without an expiry.** Forgotten keys live forever and the data slowly goes stale. Always set `EX`.
- **Forgetting to invalidate on update.** Users edit something and still see the old version.
- **Letting a Redis outage take the whole app down.** Wrap cache calls so they fall back to the database.
- **Confusing `no-cache` and `no-store`.** `no-cache` still stores the response.
- **Caching too early.** Measure first. Cache the slow, popular endpoints, not everything.

## Key takeaways

- **HTTP caching** (`Cache-Control`, ETags) stops repeat requests from reaching your server or re-downloading data.
- Express adds weak **ETags** and answers `304 Not Modified` automatically for `res.send()` and `res.json()`.
- **Redis** is a fast, shared, in-memory store; use `createClient({ url })`, `await client.connect()`, and `set(key, value, { EX: seconds })`.
- **Cache-aside**: check Redis, fall back to the database, save the result with a TTL.
- Keep data fresh with TTLs and by deleting keys when the data changes.

## Practice

1. Add `Cache-Control: public, max-age=300` to a read-only endpoint and confirm with `curl -i` that a second request with the ETag returns `304`.
2. Use the `remember()` helper to cache `GET /api/notes/:id` from your Notes API for 120 seconds, and delete the key in your update and delete routes.
3. Stop the Redis container (`docker stop redis`) while your app runs. Does the app keep answering? Fix it if it does not.
4. Log `X-Cache` hits and misses for a minute of traffic and work out your **hit rate** (hits divided by total requests).

## What's next

Caching avoids doing work twice. Next, you will make every response smaller on the wire. Continue with [Compression and Response Optimisation](/courses/expressjs/compression-and-response-optimisation).

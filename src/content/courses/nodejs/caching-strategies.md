---
publishDate: 2026-10-25T12:55
title: Caching Strategies
slug: caching-strategies
metadescription: Make Node apps faster with caching. Build an in-memory TTL and LRU cache, avoid cache stampedes, use Redis as a shared cache, and set Cache-Control and ETag headers.
updateDate: 2026-10-25T12:55
author: ['bishal-biswas']
level: 3
tags: ['caching', 'redis', 'http', 'performance']
course: nodejs
---

## What is caching?

A cook does not walk to the pantry every time a recipe needs salt. The salt, pepper and oil live on the counter, within arm's reach. The pantry still holds everything, but the things used most often are kept close.

A **cache** is that counter. It is a small, fast store that keeps copies of data that is slow or expensive to get: a database query, a call to another API, a page that takes time to render.

A few words you will see everywhere:

- **Cache hit**: the data was in the cache. Fast.
- **Cache miss**: it was not, so you fetch it from the real source (the **origin**) and usually store it for next time.
- **TTL** (time to live): how long an entry stays valid before it **expires**.
- **Eviction**: removing entries to make room when the cache is full.
- **Invalidation**: removing or updating an entry because the real data changed.

## Where caches live

| Layer | Example | Shared between servers? |
| --- | --- | --- |
| In-process memory | A `Map` inside your Node process | No |
| Shared cache | Redis or Valkey | Yes |
| HTTP caches | The browser, a CDN, a reverse proxy | Yes, controlled by headers |

You will often use more than one. This lesson covers all three.

## An in-memory cache with a TTL

The simplest cache is a `Map` where each entry remembers when it expires:

```javascript
// ttl-cache.mjs
const cache = new Map();

function setCached(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;              // miss
  if (Date.now() > entry.expiresAt) {        // expired: treat as a miss
    cache.delete(key);
    return undefined;
  }
  return entry.value;                        // hit
}

setCached('user:1', { name: 'Asha' }, 1000);
console.log(getCached('user:1')); // { name: 'Asha' }
await new Promise((resolve) => setTimeout(resolve, 1100));
console.log(getCached('user:1')); // undefined (expired)
```

### The cache-aside pattern

The most common way to use a cache is called **cache-aside** (or lazy loading): check the cache first, and only on a miss load from the origin and fill the cache.

```javascript
async function getUser(id) {
  const key = `user:${id}`;
  const cached = getCached(key);
  if (cached) return cached;                 // hit: skip the database

  const user = await db.findUser(id);        // miss: go to the origin
  setCached(key, user, 60_000);              // keep it for one minute
  return user;
}
```

## Bounding the cache: LRU

The TTL cache above has a serious problem: nothing limits its size. Cache a million different keys and you have a memory leak, exactly the kind you learned to hunt in [the Memory Management lesson](/courses/nodejs/memory-management-and-leaks).

An **LRU** (least recently used) cache has a maximum size. When it is full, it evicts the entry nobody has asked for in the longest time.

JavaScript's `Map` makes this easy, because it remembers insertion order. To mark an entry as "recently used", delete it and set it again, which moves it to the end. The first key is always the least recently used.

```javascript
// lru-cache.mjs
class LruCache {
  constructor({ max = 100, ttlMs = 60_000 } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);       // move to the end:
    this.map.set(key, entry);   // now the most recently used
    return entry.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (this.map.size > this.max) {
      const oldestKey = this.map.keys().next().value; // first key = least recently used
      this.map.delete(oldestKey);
    }
  }
}

const books = new LruCache({ max: 2 });
books.set('a', 'Dune');
books.set('b', 'Emma');
books.get('a');            // 'a' is now the most recently used
books.set('c', 'Ulysses'); // full: evicts 'b'
console.log([...books.map.keys()]); // [ 'a', 'c' ]
```

For production, the popular **lru-cache** package does this with more features (size by bytes, stale-while-revalidate and so on).

## Avoiding a cache stampede

Picture a popular entry expiring while 500 requests arrive at once. Every one of them misses, and all 500 hit the database at the same moment. That is a **cache stampede** (or thundering herd).

The fix is to cache the **promise**, not just the result. The first request starts the load and stores the promise. Everyone else awaits that same promise.

```javascript
const inFlight = new Map();

async function getProduct(id) {
  const cached = products.get(id);
  if (cached) return cached;

  if (!inFlight.has(id)) {
    const promise = db.findProduct(id)
      .then((product) => {
        products.set(id, product);
        return product;
      })
      .finally(() => inFlight.delete(id)); // also cleans up after a failure
    inFlight.set(id, promise);
  }
  return inFlight.get(id); // every caller shares one database query
}
```

Because the failed promise is removed in `finally`, an error is not cached and the next request tries again.

## When memory is not enough: Redis

An in-process cache lives inside one Node process. That stops working well when:

- You run **several instances** (the cluster module, several containers, several servers). Each has its own cache, so they disagree and each one does the same work.
- You **restart or deploy**, which empties the cache every time.
- The cache is **large**, and duplicating it in every process wastes memory.

**Redis** is an in-memory data store that runs as its own server. All your Node instances connect to it and share one cache. **Valkey** is an open-source fork that speaks the same protocol, so the same client code works with both.

Run one locally with Docker:

```bash
docker run --rm -p 6379:6379 redis
```

Install the official client:

```bash
npm install redis
```

Cache-aside with Redis looks just like the in-memory version, except values are stored as strings, so you convert to and from JSON:

```javascript
// redis-cache.mjs
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
redis.on('error', (error) => console.error('Redis error', error));
await redis.connect();

async function getUser(id) {
  const key = `user:${id}`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);   // hit

  const user = await db.findUser(id);      // miss
  await redis.set(key, JSON.stringify(user), {
    expiration: { type: 'EX', value: 60 }, // expire after 60 seconds
  });
  return user;
}

async function updateUser(id, changes) {
  await db.updateUser(id, changes);
  await redis.del(`user:${id}`);           // invalidate: next read reloads it
}
```

Redis expires keys for you, so there is no `expiresAt` bookkeeping. Older versions of the client (and many tutorials) write the expiry as `{ EX: 60 }`; newer versions still accept it but mark it deprecated. **ioredis** is another widely used client with a slightly different API.

When your app shuts down, call `await redis.close()`, which waits for pending commands, as part of the routine from [the Graceful Shutdown lesson](/courses/nodejs/graceful-shutdown).

> **Tip:** A cache should make your app faster, not more fragile. If Redis is down, log the error and fall back to the database instead of failing the request.

## HTTP caching

The fastest request is one that never reaches your server. HTTP caching lets browsers, CDNs and proxies reuse responses, and you control it with response headers.

### Cache-Control

The `Cache-Control` header says who may cache a response and for how long:

```http
Cache-Control: public, max-age=3600
```

| Directive | Meaning |
| --- | --- |
| `max-age=3600` | Fresh for 3600 seconds; reuse without asking the server |
| `public` | Any cache may store it, including CDNs |
| `private` | Only the user's browser may store it (use for per-user data) |
| `no-cache` | May be stored, but must be checked with the server before each reuse |
| `no-store` | Never store it at all (use for sensitive data) |
| `s-maxage=600` | A separate max age for shared caches such as CDNs |
| `immutable` | It will never change, so do not even check (for files with a hash in the name) |

Note the confusing pair: `no-cache` does **not** mean "do not cache". It means "always check first". `no-store` is the one that forbids caching.

### ETag and 304 Not Modified

An **ETag** is a fingerprint of a response, often a hash of the body. The browser stores it, and next time sends it back in an `If-None-Match` header. If the fingerprint still matches, the server replies `304 Not Modified` with **no body**, and the browser reuses its copy. You save bandwidth and the client saves download time.

```javascript
// etag-server.mjs
import http from 'node:http';
import { createHash } from 'node:crypto';

const books = [{ id: 1, title: 'Dune' }, { id: 2, title: 'Emma' }];

const server = http.createServer((req, res) => {
  const body = JSON.stringify(books);
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`;

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304).end(); // client copy is still good
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
});

server.listen(3000);
```

```http
GET /books HTTP/1.1
If-None-Match: "VhgL1wM4IfI5eS3GaRydPhQ9-XE"

HTTP/1.1 304 Not Modified
ETag: "VhgL1wM4IfI5eS3GaRydPhQ9-XE"
Cache-Control: public, max-age=0, must-revalidate
```

ETags are quoted strings, so keep the double quotes. The older `Last-Modified` and `If-Modified-Since` headers work the same way using a date instead of a fingerprint.

## Keeping cached data correct

The hard part of caching is not storing data, it is knowing when it is wrong. Three common strategies:

- **Expire it (TTL).** Simple, and the data is at most N seconds stale. Good for most read-heavy data.
- **Delete on write.** When you update the database, delete the cache key, as in `updateUser` above. The next read reloads fresh data.
- **Versioned keys.** Put a version in the key (`products:v2:42`) and bump it to make every old entry irrelevant at once.

Pick the TTL by asking "how stale can this be before anyone minds?" A product catalogue can be minutes old. A bank balance cannot be cached at all.

## Common mistakes

**No size limit.** An unbounded `Map` cache is a memory leak with good intentions. Use an LRU or a TTL plus a maximum size.

**Caching per-user data publicly.** `Cache-Control: public` on a page that shows Asha's account means a CDN might show it to Ravi. Use `private` or `no-store` for anything personal.

**Caching errors.** If the origin fails, do not store the failure as if it were data, or every request gets the error until it expires.

**Handing out shared objects.** Callers that modify a cached object change it for everyone. Return copies (`structuredClone(value)`) or freeze cached values.

**Caching before measuring.** Caches add complexity and stale-data bugs. Profile first, as in [the Reports, Heap Snapshots and Profiling lesson](/courses/nodejs/diagnostics-and-profiling), and cache what is actually slow.

## Quick recap

- A cache keeps copies of slow data close by; hits are fast, misses go to the origin.
- Cache-aside: check the cache, on a miss load from the origin and store it.
- Always bound in-memory caches with a TTL and a maximum size; `Map` order makes an LRU easy.
- Cache the in-flight promise to stop a stampede, and never cache failures.
- Redis (or Valkey) gives every instance one shared cache that survives restarts.
- `Cache-Control` tells browsers and CDNs what to store; `ETag` plus `If-None-Match` enables `304 Not Modified`.
- Invalidate with TTLs, delete-on-write or versioned keys.

<code id="code-content" class="language-javascript">
// caching-demo.mjs: TTL + LRU cache, stampede protection and HTTP ETags
import http from 'node:http';
import { createHash } from 'node:crypto';
class LruCache {
  constructor({ max = 100, ttlMs = 60_000 } = {}) { Object.assign(this, { max, ttlMs, map: new Map() }); }
  get(key) {
    const entry = this.map.get(key);
    if (!entry || Date.now() &gt; entry.expiresAt) { this.map.delete(key); return undefined; }
    this.map.delete(key); this.map.set(key, entry); // mark as most recently used
    return entry.value;
  }
  set(key, value) {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.map.size &gt; this.max) this.map.delete(this.map.keys().next().value); // evict LRU
  }
}
// A slow "database" that counts how often it is called
let dbCalls = 0;
const db = { findBook: async (id) =&gt; { dbCalls++; await new Promise((r) =&gt; setTimeout(r, 50)); return { id, title: `Book ${id}` }; } };
const cache = new LruCache({ max: 2, ttlMs: 5000 });
const inFlight = new Map();
function getBook(id) {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  if (!inFlight.has(id)) {
    inFlight.set(id, db.findBook(id)
      .then((book) =&gt; { cache.set(id, book); return book; })
      .finally(() =&gt; inFlight.delete(id))); // failures are never cached
  }
  return inFlight.get(id);
}
// 100 simultaneous requests for one book: one database call
await Promise.all(Array.from({ length: 100 }, () =&gt; getBook(1)));
console.log('db calls after 100 parallel reads:', dbCalls);
await getBook(2); await getBook(3); // max is 2, so book 1 gets evicted
await getBook(1);
console.log('db calls after eviction and reload:', dbCalls, '| cached keys:', [...cache.map.keys()]);
// HTTP caching: Cache-Control plus ETag / If-None-Match
const server = http.createServer(async (req, res) =&gt; {
  const body = JSON.stringify(await getBook(1));
  const etag = `"${createHash('sha1').update(body).digest('base64url')}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=60');
  if (req.headers['if-none-match'] === etag) return res.writeHead(304).end();
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
});
server.listen(0, async () =&gt; {
  const url = `http://localhost:${server.address().port}/books/1`;
  const first = await fetch(url);
  console.log('first:', first.status, await first.text(), first.headers.get('etag'));
  const second = await fetch(url, { headers: { 'If-None-Match': first.headers.get('etag') } });
  console.log('second:', second.status, '(no body sent)', second.headers.get('cache-control'));
  server.close();
});
</code></pre>

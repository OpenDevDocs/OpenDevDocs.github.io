---
publishDate: 2026-10-25T09:43
title: Rate Limiting and Throttling
slug: rate-limiting
metadescription: Protect your Express 5 API from brute-force logins, scraping and runaway clients with express-rate-limit, per-route limits, Redis stores and throttling.
updateDate: 2026-10-25T09:43
author: ['bishal-biswas']
level: 3
tags: ['express', 'rate-limiting', 'security', 'performance']
course: expressjs
---

## What you will learn

- What **rate limiting** and **throttling** are, and which problems they solve
- How common limiting algorithms work: fixed window, sliding window and token bucket
- How to add a global limit and a strict login limit with `express-rate-limit`
- How to limit by user instead of IP, and share limits across servers with Redis
- Why `trust proxy` matters, and how clients should react to **429 Too Many Requests**

## Why limit requests at all?

Your API answers every request it receives, as fast as it can. That is great for real users and equally great for anyone trying to abuse it. A few realistic scenarios:

- **Brute-force login.** A script tries 10,000 common passwords against `ada@example.com`, one request after another. Slow hashing (from the last lesson) makes each guess cost you CPU, and eventually one guess might succeed.
- **Scraping.** A bot downloads every public note, page by page, thousands of times per minute.
- **Expensive endpoints.** Your "send verification SMS" route costs real money per message. An attacker calls it in a loop.
- **Buggy clients.** A frontend bug calls `/notes` inside an endless loop and floods your server by accident.

**Rate limiting** sets a maximum number of requests a client may make in a period of time, such as "100 requests per 15 minutes". Extra requests get rejected with status **`429 Too Many Requests`**.

Think of a water tap with a flow restrictor. You still get water, just not a fire hose's worth. Normal users never notice the limit; abusers hit it quickly.

### Rate limiting vs throttling

The two terms overlap, but they usually mean:

| | Rate limiting | Throttling |
| --- | --- | --- |
| What happens to extra requests | Rejected with `429` | Delayed, then served |
| Feels like | A locked door | A slower queue |
| Good for | Logins, expensive or abusable routes | Gently slowing heavy users |

## Who are you counting?

A limiter needs a **key**: the thing it counts requests for.

| Key | Good for | Watch out for |
| --- | --- | --- |
| IP address | Anonymous traffic, login forms | Many people can share one IP (offices, mobile networks) |
| User ID | Logged-in API usage | Only works after authentication |
| API key | Third-party developers | Keys must be kept secret |
| Email in the login body | Protecting one account from many IPs | Attackers can lock a victim out temporarily |

Real apps often combine several: a gentle per-IP limit for everything, plus stricter limits on sensitive routes.

## How limiting algorithms work

You do not need to implement these, but knowing them helps you read library docs.

```text
Fixed window (limit 5 per minute)
  12:00:00 ---------------------- 12:01:00 ---------------------- 12:02:00
  | x x x x x  (6th = 429)        | counter resets to 0           |

Sliding window
  At any moment, count requests in the LAST 60 seconds, not "this minute".

Token bucket
  A bucket holds up to 10 tokens and refills 1 token per second.
  Each request spends 1 token. Empty bucket = 429.
  Allows short bursts, then a steady rate.
```

- **Fixed window** is the simplest. Its weakness: a client can send 5 requests at 12:00:59 and 5 more at 12:01:00, which is 10 in two seconds.
- **Sliding window** smooths that edge but needs a bit more bookkeeping.
- **Token bucket** is popular for APIs because it allows short bursts while enforcing an average rate.

### A tiny limiter by hand

Building a toy version makes the idea concrete. This is a fixed-window limiter in about 20 lines:

```js
// middleware/tinyRateLimit.js  (for learning only)
export const tinyRateLimit = ({ windowMs, limit }) => {
  const hits = new Map(); // key -> { count, resetAt }

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }
    next();
  };
};
```

It works, but it never cleans up old keys, it forgets everything on restart, and each server keeps its own counts. A well-tested library solves all of these.

## Using express-rate-limit

```bash
npm install express-rate-limit
```

### A global limit for the whole API

```js
// app.js
import express from 'express';
import { rateLimit } from 'express-rate-limit';

export const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  limit: 300,                 // max requests per IP per window
  standardHeaders: 'draft-8', // send the standard RateLimit headers
  legacyHeaders: false,       // don't send old X-RateLimit-* headers
  message: { error: 'Too many requests, please try again later.' },
});

app.use(express.json());
app.use('/api', apiLimiter); // limit only API routes, not static files
```

> **Note:** Use `limit`, not `max`. Older tutorials use `max`, which is the previous name for the same option.

With `standardHeaders: 'draft-8'`, every response includes a `RateLimit-Policy` header that describes the limit and a `RateLimit` header that tells the client how many requests remain (`r`) and how many seconds until the window resets (`t`). Well-behaved clients can use these to slow down before they hit the wall.

When the limit is exceeded:

```bash
curl -i http://localhost:3000/api/notes
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 812
Content-Type: application/json; charset=utf-8

{"error":"Too many requests, please try again later."}
```

### A strict limit for login

Login deserves a much lower limit. Real users rarely mistype their password more than a few times. With `skipSuccessfulRequests: true`, only failed attempts count, so a user who logs in correctly is never punished.

```js
// middleware/limits.js
import { rateLimit } from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,                    // 10 failed attempts per IP per 15 minutes
  skipSuccessfulRequests: true, // responses with status < 400 don't count
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

// A second limit per account, so an attacker using many IPs is still slowed
export const loginPerEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String(req.body?.email ?? '').toLowerCase()}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts for this account. Try again later.' },
});
```

```js
// routes/auth.js (excerpt)
import { loginLimiter, loginPerEmailLimiter } from '../middleware/limits.js';

authRouter.post('/login', loginLimiter, loginPerEmailLimiter, async (req, res) => {
  // ...check password as before
});
```

The per-email limiter reads `req.body`, so `express.json()` must run before it. Its key generator does not use the IP at all, which is exactly the point.

> **Warning:** A per-account limit means an attacker can deliberately fail logins for someone else and lock them out for the window. That is why the limit is higher than the per-IP one and resets automatically. Never lock accounts permanently because of failed logins.

Apply the same idea to other abusable routes: sign-up, "forgot password", "resend verification email" and anything that costs you money per call.

### Limiting by user instead of IP

For logged-in API usage, limiting by IP is unfair: a whole office behind one IP shares a single budget. Limit by user ID instead. The limiter must run **after** your auth middleware so that `req.user` exists:

```js
// routes/notes.js (excerpt)
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/requireAuth.js';

const perUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60, // 60 requests per minute per user
  keyGenerator: (req) => `user:${req.user.id}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

notesRouter.use(requireAuth, perUserLimiter);
```

You could also give paid plans higher limits: `limit` can be a function, for example `limit: (req) => (req.user.plan === 'pro' ? 600 : 60)`.

## Behind a proxy: get the real IP first

In production, your app usually sits behind a **reverse proxy** or load balancer (Nginx, a cloud load balancer, a hosting platform). Every request then *appears* to come from the proxy's IP. Without extra setup, **all users share one rate limit**, and one busy user blocks everyone.

The proxy passes the real client IP in the `X-Forwarded-For` header. You tell Express to trust exactly one proxy hop:

```js
// app.js
app.set('trust proxy', 1); // we run behind exactly one proxy
```

Now `req.ip` is the real client IP. `express-rate-limit` even checks for this situation and logs a warning if it sees `X-Forwarded-For` while `trust proxy` is off.

> **Common mistake:** Setting `app.set('trust proxy', true)`. That trusts *every* value in `X-Forwarded-For`, which any client can fake. An attacker sends a different made-up IP with each request and is never limited. Trust only the number of proxies you actually have. You will dig into this in [Reverse Proxies and Trusting Proxy Headers](/courses/expressjs/reverse-proxies-and-trust-proxy).

## Many servers: share limits with Redis

By default, `express-rate-limit` stores counts in the memory of one Node process. If you run four copies of your app (you will in [Clustering and Worker Threads](/courses/expressjs/clustering-and-worker-threads)), each copy counts separately, so a client effectively gets four times the limit. Counts also reset on every deploy.

The fix is a shared **store**. Redis is the usual choice because it is fast and has built-in expiring keys. The `rate-limit-redis` package plugs into `express-rate-limit`:

```bash
npm install redis rate-limit-redis
```

```js
// middleware/limits.js (shared store)
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});
```

Every app instance now reads and writes the same counters. You will use Redis much more in [Caching with Redis and HTTP Cache Headers](/courses/expressjs/caching-with-redis).

## Throttling: slow down instead of blocking

Sometimes a hard `429` is too harsh. For a search endpoint, you might prefer to slow heavy users down gradually. The `express-slow-down` package (from the same authors) adds a growing delay after a threshold:

```js
// middleware/limits.js (throttling)
import { slowDown } from 'express-slow-down';

export const searchThrottle = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 30,                      // the first 30 requests per minute are full speed
  delayMs: (hits) => (hits - 30) * 100, // 31st waits 100 ms, 32nd 200 ms, and so on
  maxDelayMs: 5000,                    // never wait more than 5 seconds
});
```

You can combine both: throttle first, then hard-limit at a higher number.

## How clients should handle 429

If you also write the frontend or a script that calls an API, handle `429` politely:

```js
// client/fetchWithRetry.js
export const fetchWithRetry = async (url, options, attempts = 3) => {
  const res = await fetch(url, options);
  if (res.status !== 429 || attempts <= 1) return res;

  const waitSeconds = Number(res.headers.get('Retry-After')) || 1;
  await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  return fetchWithRetry(url, options, attempts - 1);
};
```

Hammering a server that just said "too many" makes things worse for everyone.

## What rate limiting does not do

Rate limiting is an important layer, not a complete shield:

- It does **not** stop large **DDoS** attacks (floods from thousands of machines). Those are handled before traffic reaches Node, by your hosting provider, a CDN or a service like Cloudflare.
- It does **not** replace strong passwords, slow hashing or MFA. It just makes guessing slow.
- Limits inside Node still cost a little work per request. For very high traffic, also limit at the proxy (for example Nginx's `limit_req`).

## Common mistakes

- **One global limit and nothing else.** A limit high enough for normal browsing is far too high for login. Add strict per-route limits.
- **Forgetting `trust proxy` in production**, or setting it to `true`.
- **In-memory counts with several instances.** Use a shared store like Redis.
- **Limiting static files and health checks.** Mount limiters on `/api` or specific routes so your load balancer's health checks are never rejected.
- **Using the old `max` option name** from outdated tutorials. Use `limit`.

## Key takeaways

- **Rate limiting** rejects excess requests with `429`; **throttling** delays them.
- Choose the **key** carefully: IP for anonymous traffic, user ID for logged-in usage, email for login protection.
- Use `express-rate-limit` with `limit`, `standardHeaders: 'draft-8'` and `legacyHeaders: false`, plus stricter limiters on login and other sensitive routes.
- Behind a proxy, set `trust proxy` to the exact number of hops, or every user shares one limit.
- With more than one instance, store counters in **Redis** so limits are shared.

## Practice

1. Add the global API limiter to your Notes API with `limit: 5` and a 1-minute window. Use a `bash` loop of `curl` calls to see the `429` and the `Retry-After` header. Then restore a sensible limit.
2. Add `loginLimiter` to your login route. Confirm that successful logins do not use up the limit but failed ones do.
3. Write a per-user limiter for `POST /notes` that allows 20 new notes per hour.
4. Explain to a friend why `app.set('trust proxy', true)` lets an attacker bypass your limits.

## What's next

Next you will harden every response your app sends with one line of middleware in [Security Headers with Helmet](/courses/expressjs/security-headers-with-helmet).

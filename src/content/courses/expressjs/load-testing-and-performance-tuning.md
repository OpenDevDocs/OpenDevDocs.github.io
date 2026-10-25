---
publishDate: 2026-10-25T10:04
title: Load Testing and Performance Tuning
slug: load-testing-and-performance-tuning
metadescription: Learn to load test an Express 5 API with autocannon and k6, read latency percentiles, find event loop blocking with profiling, and apply the tuning fixes that matter most.
updateDate: 2026-10-25T10:04
author: ['bishal-biswas']
level: 4
tags: ['express', 'performance', 'load-testing', 'nodejs']
course: expressjs
---

## What you will learn

- What **load testing** is and the numbers that matter: throughput, latency percentiles and error rate
- How to run a fair benchmark with **autocannon**, and realistic scenarios with **k6**
- How to spot **event loop blocking**, the most common Node.js performance problem
- How to find slow code with a **CPU profile**
- A practical tuning checklist, in the order that usually pays off

## Why load test?

Your API works perfectly when you click around. But what happens when 500 people use it at the same time? Does it slow down gently, or fall over?

**Load testing** means sending lots of simulated traffic to your app on purpose and measuring how it behaves. It answers questions like:

- How many requests per second can one instance handle?
- At what point do responses get slow?
- Which route breaks first?

Think of a bridge. Engineers don't wait for rush hour to find out how much weight it holds. They test it with heavy trucks first, in a controlled way.

> **Warning:** Only load test systems you own, ideally a local or staging copy. Sending heavy traffic to someone else's server (or to production without telling your team) can look exactly like an attack.

## The numbers that matter

| Term | Meaning | Example |
| --- | --- | --- |
| **Throughput** | Requests handled per second (**RPS**) | 4,000 req/s |
| **Latency** | How long one request takes, from send to response | 25 ms |
| **Percentile** | "X% of requests were faster than this" | p99 = 120 ms |
| **Connections** (concurrency) | How many requests are in flight at once | 100 |
| **Error rate** | The share of requests that failed or timed out | 0.2% |

Why percentiles? Averages hide pain. If 99 requests take 10 ms and one takes 5 seconds, the average is about 60 ms, which sounds fine. But one user in every hundred waited 5 seconds. The **p99** (99th percentile) shows that.

```text
 latency
    ^
    |                                         *  <- p99: the unlucky users
    |                                   *
    |                     * * * *  *            <- p95
    | * * * * * * * * * *                       <- p50 (median): a typical user
    +-------------------------------------------> requests, sorted fastest to slowest
```

As you add load, throughput rises until the server is **saturated** (fully busy). After that, throughput stays flat and latency shoots up because requests wait in a queue. Finding that point is the goal of a load test.

## A demo app with a hidden problem

Let's create an app with three routes. Two of them do the same expensive work (hashing a password) in different ways.

```js
// app.js
import express from 'express';
import { pbkdf2, pbkdf2Sync } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

export const app = express();

app.get('/fast', (req, res) => {
  res.json({ ok: true });
});

// Synchronous: blocks the event loop while it computes
app.get('/hash-sync', (req, res) => {
  const hash = pbkdf2Sync('password', 'salt', 100_000, 64, 'sha512');
  res.json({ hash: hash.toString('hex').slice(0, 16) });
});

// Asynchronous: the work runs on libuv's thread pool
app.get('/hash-async', async (req, res) => {
  const hash = await pbkdf2Async('password', 'salt', 100_000, 64, 'sha512');
  res.json({ hash: hash.toString('hex').slice(0, 16) });
});
```

```js
// server.js
import { app } from './app.js';

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Start it in production mode:

```bash
NODE_ENV=production node server.js
```

(On Windows PowerShell, use `$env:NODE_ENV='production'; node server.js`.)

## Load testing with autocannon

**autocannon** is a fast HTTP benchmarking tool written in Node.js. You can run it with `npx`, no install needed.

```bash
npx autocannon -c 50 -d 10 http://localhost:3000/fast
```

- `-c 50`: keep 50 connections open at once.
- `-d 10`: run for 10 seconds.

You'll get a summary like this (trimmed; the numbers here are only illustrative, yours depend on your machine):

```text
Running 10s test @ http://localhost:3000/fast
50 connections

Stat      2.5%   50%    97.5%   99%     Avg      Max
Latency   2 ms   4 ms   9 ms    12 ms   4.4 ms   60 ms

Stat      1%      50%      97.5%    Avg       Min
Req/Sec   9,000   11,000   11,800   10,900    8,950

109k requests in 10.02s, 26 MB read
```

Read it like this: the median request took 4 ms, 99% took 12 ms or less, and the app handled roughly 11,000 requests per second.

Now try the two hashing routes, one at a time:

```bash
npx autocannon -c 50 -d 10 http://localhost:3000/hash-sync
npx autocannon -c 50 -d 10 http://localhost:3000/hash-async
```

On a machine with several CPU cores, `/hash-async` usually handles several times more requests per second. Why? The async version runs on libuv's **thread pool** (4 threads by default), so several hashes are computed in parallel. The sync version computes one hash at a time on the main thread.

### More autocannon options

```bash
# POST with a JSON body
npx autocannon -c 20 -d 10 -m POST \
  -H "Content-Type: application/json" \
  -b '{"title":"Load test note"}' \
  http://localhost:3000/api/notes
```

| Flag | Meaning |
| --- | --- |
| `-c` | Number of concurrent connections |
| `-d` | Duration in seconds |
| `-m` | HTTP method |
| `-H` | Add a header (repeatable) |
| `-b` | Request body |

### autocannon from a script

You can also call autocannon from Node, which is handy for saving results or comparing runs:

```js
// scripts/bench.js
import autocannon from 'autocannon';

const result = await autocannon({
  url: 'http://localhost:3000/fast',
  connections: 50,
  duration: 10,
});

console.log(autocannon.printResult(result));
console.log({
  p50: result.latency.p50,
  p99: result.latency.p99,
  avgRps: result.requests.average,
  errors: result.errors,
  non2xx: result.non2xx,
});
```

```bash
npm install --save-dev autocannon
node scripts/bench.js
```

Always check `errors` and `non2xx`. A super-fast benchmark where every response is a `500` is not a fast API.

## The event loop: why sync code hurts everyone

Remember that Node.js runs your JavaScript on a **single main thread**, driven by the **event loop** (the loop that picks up the next piece of work when the current one finishes). If one request does heavy synchronous work, *every other request waits*, even trivial ones.

Prove it. While autocannon hammers `/hash-sync` in one terminal, time a request to `/fast` in another:

```bash
npx autocannon -c 50 -d 20 http://localhost:3000/hash-sync
```

```bash
curl -s -o /dev/null -w "%{time_total}s\n" http://localhost:3000/fast
```

The `/fast` route, which does nothing, suddenly takes a long time. Its code is fast; it's just stuck in the queue behind the hashes. Repeat with `/hash-async` and `/fast` stays quick.

Think of a coffee shop with one barista. If the barista hand-grinds beans for one customer for five minutes, the whole queue waits, even people who only want water.

### Measuring event loop delay

**Event loop delay** (or lag) is how late the event loop runs compared to when it should. Node can measure it for you:

```js
// lag-monitor.js
import { monitorEventLoopDelay } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  // Values are in nanoseconds; divide by 1e6 for milliseconds
  const p99 = (histogram.percentile(99) / 1e6).toFixed(1);
  console.log(`event loop delay p99: ${p99} ms`);
  histogram.reset();
}, 5000).unref();
```

Import it at the top of `server.js` with `import './lag-monitor.js';`. A healthy app shows a few milliseconds. Hundreds of milliseconds means something is blocking. (The `prom-client` default metrics from the [observability lesson](/courses/expressjs/observability-and-opentelemetry) record this too, so you can graph it.)

## Finding slow code with a CPU profile

When you don't know *which* code is slow, a **CPU profile** tells you. It samples what the CPU is doing many times per second and shows which functions used the most time.

Node can write one with a flag. The profile is saved when the process exits normally, so add a small handler so `Ctrl+C` exits cleanly:

```js
// server.js (add while profiling)
process.on('SIGINT', () => process.exit(0));
```

```bash
node --cpu-prof server.js
# in another terminal: npx autocannon -c 50 -d 10 http://localhost:3000/hash-sync
# then press Ctrl+C in the server terminal
```

A file like `CPU.20261025.101500.12345.0.001.cpuprofile` appears. Open Chrome DevTools, go to the **Performance** panel, and load the file (or open it directly in VS Code). Look for the widest bars in the **flame chart**: those are the functions where time was spent. Here, `pbkdf2Sync` will stand out clearly.

> **Tip:** Profile under load. A profile of an idle server shows nothing interesting.

## Realistic scenarios with k6

autocannon is perfect for "how fast is this one endpoint?". For "what happens when users log in, browse and create notes over five minutes?", use **k6**. It's a separate program (install it from the k6 website or your package manager) and you write test scripts in JavaScript.

```js
// load-test.js (a k6 script: run with k6, not node)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up to 50 virtual users
    { duration: '1m', target: 50 },  // stay there
    { duration: '10s', target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests under 300 ms
    http_req_failed: ['rate<0.01'],   // less than 1% errors
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/notes');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1); // a real user pauses between clicks
}
```

```bash
k6 run load-test.js
```

**Thresholds** turn the test into a pass or fail check. k6 exits with an error if p95 goes over 300 ms, so you can even run it in a pipeline from the [CI/CD lesson](/courses/expressjs/ci-cd-for-node-apis) against a staging server.

## How to benchmark fairly

Bad benchmarks give confident but wrong answers. Follow these rules:

1. **Use production mode.** `NODE_ENV=production`, no `--watch`, no debug logging.
2. **Separate the load generator from the server** when possible. On one laptop, autocannon and your app fight for the same CPU.
3. **Warm up first.** The first seconds include JIT compilation and cold caches. Run a short warm-up, then measure.
4. **Run each test several times** and look at the spread, not one lucky run.
5. **Change one thing at a time.** Otherwise you won't know which change helped.
6. **Use realistic data.** A database with 10 rows behaves very differently from one with 10 million.

```text
 +-----------+     +------------+     +----------+     +------------+
 | Baseline  | --> | Find the   | --> | Change   | --> | Measure    |
 | measure   |     | bottleneck |     | ONE thing|     | again      |
 +-----------+     +------------+     +----------+     +------------+
       ^                                                     |
       '--------------------- repeat ------------------------'
```

## The tuning checklist

Work through this roughly in order. The top items usually give the biggest wins for the least effort.

| # | Check | Why it helps |
| --- | --- | --- |
| 1 | `NODE_ENV=production` | Express and libraries enable caching and skip development-only work |
| 2 | No sync APIs in request handlers (`readFileSync`, `pbkdf2Sync`, `bcrypt.hashSync`) | Keeps the event loop free for other requests |
| 3 | Database indexes on fields you filter and sort by | A missing index is the most common cause of slow endpoints |
| 4 | Return less data: pagination, field selection, `.lean()` in Mongoose | Less work to query, serialise and send |
| 5 | Cache hot, rarely changing data in Redis or memory | Skip the database entirely for repeat requests |
| 6 | Reasonable log level (`info`, not `debug`) and a fast logger like Pino | Logging every detail costs real time at high traffic |
| 7 | Compression and static files at the reverse proxy | Frees Node's CPU for your API logic |
| 8 | Move heavy CPU work to worker threads or a job queue | One request can't block the others |
| 9 | Use all CPU cores: cluster mode or several containers | Multiplies throughput on multi-core machines |

You covered most of these in earlier lessons: [caching](/courses/expressjs/caching-with-redis), [compression](/courses/expressjs/compression-and-response-optimisation), [clustering and worker threads](/courses/expressjs/clustering-and-worker-threads) and [pagination](/courses/expressjs/pagination-filtering-sorting).

### Keep-alive timeouts behind a load balancer

Node's HTTP server closes idle **keep-alive** connections (connections reused for several requests) after 5 seconds by default. Many cloud load balancers keep idle connections for longer, often 60 seconds. If Node closes a connection just as the load balancer reuses it, some requests fail with random `502` errors under load.

The fix is to make Node's timeout a little *longer* than the load balancer's:

```js
// server.js
import { app } from './app.js';

const server = app.listen(3000, (error) => {
  if (error) throw error;
});

server.keepAliveTimeout = 65_000; // longer than a 60 s load balancer idle timeout
server.headersTimeout = 66_000;   // must be larger than keepAliveTimeout
```

Check your load balancer's idle timeout and set yours a few seconds above it.

## Common mistakes

> **Common mistake:** Benchmarking in development mode with `node --watch` and debug logs on, then drawing conclusions about production.

> **Common mistake:** Looking only at requests per second. A higher RPS with a worse p99 or more errors is not an improvement.

> **Common mistake:** Optimising code before measuring. The slow part is often a missing database index, not your JavaScript.

> **Common mistake:** Testing a route that returns cached or empty data and assuming the real route is just as fast.

## Key takeaways

- **Load testing** shows how your API behaves under pressure; watch throughput, **p95/p99 latency** and error rate together.
- **autocannon** is great for quick endpoint benchmarks; **k6** for realistic, multi-step scenarios with pass/fail thresholds.
- Synchronous CPU work **blocks the event loop** and slows every request, not just its own.
- Measure event loop delay, and use `node --cpu-prof` to find the functions that use the most time.
- Benchmark fairly: production mode, warm-up, several runs, one change at a time.
- Most wins come from production mode, async APIs, database indexes, smaller responses and caching.

## Practice

1. Build the demo app and benchmark `/fast`, `/hash-sync` and `/hash-async`. Write down the req/s and p99 for each.
2. While benchmarking `/hash-sync`, time a request to `/fast` with curl. Repeat with `/hash-async` and compare.
3. Add the event loop delay monitor and watch how the numbers change under each load test.
4. Write a k6 script for your Notes API that lists notes and creates one, with a threshold of p95 under 300 ms.

## What's next

You now know how to run Express on servers you control. For the final lesson, let's look at a very different way to deploy it: [Serverless Express and Edge Runtimes](/courses/expressjs/serverless-express).

---
publishDate: 2026-10-25T13:40
title: Load Testing and Capacity Planning
slug: load-testing-and-capacity-planning
metadescription: Load test a Node server with autocannon and k6, read throughput and latency percentiles, find the bottleneck, and work out how many instances you need.
updateDate: 2026-10-25T13:40
author: ['bishal-biswas']
level: 4
tags: ['performance', 'load-testing', 'scaling']
course: nodejs
---

## Why load test?

A bridge engineer does not wait for rush hour to find out how much weight the bridge can hold. They test it with heavy loads first.

**Load testing** does the same for your server. You send it lots of requests on purpose, in a controlled way, and watch what happens. You want answers to questions like:

- How many requests per second can one instance handle?
- How slow do responses get when it is busy?
- What breaks first: the CPU, memory, the database, or something else?
- How many instances do we need for our busiest day?

That last question is **capacity planning**: using test results to decide how much hardware you need, before your users find out the hard way.

## The two numbers that matter

### Throughput

**Throughput** is how much work gets done per second, usually measured in **requests per second** (req/s or RPS).

### Latency, and why averages lie

**Latency** is how long one request takes, from sending it to getting the full response.

The **average** latency hides problems. Imagine 99 requests take 10 ms and one takes 5 seconds. The average is about 60 ms, which sounds fine. But one user in a hundred waited five seconds.

So we use **percentiles**. Sort all the latencies from fastest to slowest:

- **p50** (the median): half of the requests were faster than this. The "typical" experience.
- **p95**: 95% were faster. One in twenty requests was slower.
- **p99**: 99% were faster. One in a hundred was slower. This is the **tail latency**.

Why care about p99? A single page often makes many requests. If a page makes 20 API calls, most page loads include at least one call from the slow 5%. Tail latency is what your users feel.

> **Tip:** Write your goals as percentiles, for example "p99 under 300 ms at 500 req/s". That is called a **service level objective** (SLO), and it gives your load tests a clear pass or fail.

## Load testing with autocannon

**autocannon** is a fast HTTP load testing tool written in Node. You do not need to install it; `npx` runs it straight away.

Start the server you want to test. Here is a small one with a fast route and a slow, CPU-heavy route:

```javascript
// server.mjs
import http from 'node:http';
import { pbkdf2Sync } from 'node:crypto';

http.createServer((req, res) => {
  // /slow does about 3 ms of blocking CPU work per request
  if (req.url === '/slow') pbkdf2Sync('pw', 'salt', 20_000, 32, 'sha256');
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}).listen(3000);
```

In another terminal, fire 50 connections at it for 10 seconds:

```bash
npx autocannon -c 50 -d 10 http://localhost:3000/
```

- **`-c 50`**: keep 50 connections open, each sending a new request as soon as the previous one finishes.
- **`-d 10`**: run for 10 seconds.

The output has two tables. The first is latency:

```text
┌─────────┬──────┬──────┬───────┬──────┬─────────┬─────────┬───────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │ Stdev   │ Max   │
├─────────┼──────┼──────┼───────┼──────┼─────────┼─────────┼───────┤
│ Latency │ 0 ms │ 1 ms │ 3 ms  │ 4 ms │ 1.12 ms │ 0.93 ms │ 23 ms │
└─────────┴──────┴──────┴───────┴──────┴─────────┴─────────┴───────┘
```

The second shows throughput (`Req/Sec`) and data transferred (`Bytes/Sec`), sampled once per second. At the bottom, autocannon prints the total, such as "155k requests in 5.03s".

Your numbers will be different. What matters is the **pattern**. In a sample run on a laptop, the fast route handled tens of thousands of requests per second with a p99 of a few milliseconds. The `/slow` route managed only a few hundred requests per second, and its p99 latency jumped to around 200 ms.

Useful options:

```bash
npx autocannon -c 100 -d 30 -l http://localhost:3000/        # -l prints a detailed percentile table
npx autocannon -c 50 -d 10 -m POST -H "content-type: application/json" \
  -b '{"title":"Buy milk","author":"Asha"}' http://localhost:3000/notes
```

`-m` sets the method, `-H` adds a header, and `-b` sets the body.

## Understanding the slow result

Why did `/slow` cap at a few hundred requests per second? Each request burns about 3 ms of CPU on the **main thread**. One thread can do at most about 1000 / 3, so roughly 300, of those per second. Requests beyond that just queue up.

There is a handy rule that connects the numbers, called **Little's law**:

```text
requests in flight = throughput x latency
```

With 50 connections and about 290 req/s, each request must spend about 50 / 290, roughly 0.17 seconds, in the system. That matches the ~170 ms median we saw. The server is not "slow" at handling each request; requests are waiting in line.

## Load testing with k6

**k6** is a popular load testing tool from Grafana Labs. You write test scripts in JavaScript, but k6 is a separate program written in Go, not an npm package and not Node. Install it from the k6 website or your system's package manager.

k6 shines when you want realistic scenarios: users that ramp up over time, several steps per user, and automatic pass/fail rules.

```javascript
// load-test.js (runs in k6, not Node)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // ramp up to 50 virtual users
    { duration: '1m', target: 50 },   // hold
    { duration: '15s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'], // latency goals in ms
    http_req_failed: ['rate<0.01'],                 // under 1% errors
  },
};

export default function () {
  const res = http.get('http://localhost:3000/');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1); // a real user pauses between clicks
}
```

```bash
k6 run load-test.js
```

- A **virtual user** (VU) runs the default function in a loop, like a simulated person.
- **`stages`** shape the load over time.
- **`thresholds`** turn your SLO into a pass or fail. If p99 goes over 500 ms, k6 exits with an error code, so it can fail a CI job.

Use **autocannon** for quick "how fast is this endpoint?" checks, and **k6** for realistic, scripted scenarios.

## Kinds of load tests

- **Smoke test**: tiny load, just to check the test and the system work.
- **Load test**: your expected normal and peak traffic. Does it meet the SLO?
- **Stress test**: keep increasing load until something breaks. Where is the limit, and how does it fail?
- **Soak test**: normal load for hours. It finds slow memory leaks and resource exhaustion (see [the Memory Management lesson](/courses/nodejs/memory-management-and-leaks)).
- **Spike test**: a sudden jump in traffic. Does autoscaling react in time?

## Finding the bottleneck

The **bottleneck** is the one resource that runs out first and limits everything else, like the narrow neck of a bottle. Making anything else faster does not help until you widen it.

While a test runs, watch:

| Symptom | Likely bottleneck |
| --- | --- |
| Node process at ~100% of one CPU core, latency climbing | Main thread busy: CPU work in JavaScript |
| CPU low, latency high | Waiting on something: database, another API, the thread pool |
| Memory keeps growing during the test | A leak or an unbounded cache |
| Errors like `ECONNRESET` or timeouts | Out of connections, file handles, or the DB pool is too small |
| High event loop delay | Something is blocking the event loop |

Tools you already know help here:

- **Event loop delay** with `monitorEventLoopDelay` from [the Performance Hooks lesson](/courses/nodejs/performance-hooks-and-benchmarking).
- **CPU profiles** with `node --cpu-prof server.mjs`, from [the Diagnostics lesson](/courses/nodejs/diagnostics-and-profiling). Profile *under load* to see where time really goes.
- **Thread pool starvation**, from [the libuv lesson](/courses/nodejs/nodejs-internals-libuv), when crypto or file work piles up.

Then fix the bottleneck, run the same test again, and compare. Change one thing at a time.

## Capacity planning

Once you know what one instance can do, the planning is arithmetic.

1. **Measure one instance.** Find the highest throughput where it still meets your SLO. Say 400 req/s with p99 under 300 ms.
2. **Leave headroom.** Do not plan to run at 100%. Latency rises sharply near the limit. Many teams plan for 50% to 70% utilisation.
3. **Estimate peak traffic.** Use your analytics, then add a margin for growth and surprises.
4. **Divide.**

```text
peak traffic              = 2,000 req/s
safe capacity per instance = 400 req/s x 0.6 = 240 req/s
instances needed          = 2,000 / 240 = 8.3, so 9 instances
```

Add at least one more so you can lose an instance (or deploy one at a time) and still cope. And remember the database, cache and other services behind your app need to handle the combined load of all those instances.

## Common mistakes

**Running the load tool on the same machine as the server.** They fight over the same CPU, so both numbers are wrong. Use a separate machine for anything you plan with.

**Testing on your laptop and planning for production.** Different CPUs, networks and data give different results. Test in an environment that looks like production.

**Only looking at the average.** Always check p95 and p99.

**Testing an endpoint that does nothing.** A "hello world" route tells you nothing about your real API. Test realistic routes with realistic data sizes.

**Forgetting to warm up.** The first seconds include V8 compiling hot code (see [the V8 lesson](/courses/nodejs/v8-internals-and-optimisation)) and caches filling. Ignore them or run a short warm-up first.

**Load testing someone else's server.** Only test systems you own or have written permission to test. To the owner, a load test looks exactly like an attack.

## Quick recap

- Load testing sends controlled traffic to learn your limits before users do.
- Throughput is requests per second; latency is time per request.
- Use percentiles (p50, p95, p99), not averages; tail latency is what users feel.
- `npx autocannon -c 50 -d 10 <url>` gives a quick throughput and latency picture.
- k6 runs scripted scenarios with ramping virtual users and pass/fail thresholds.
- Find the bottleneck by watching CPU, memory, event loop delay and errors under load.
- Capacity = peak traffic divided by safe per-instance throughput, plus spare instances.

<code id="code-content" class="language-javascript">
// mini-load-test.mjs: a tiny load tester, so you can see what autocannon and k6 measure.
// It starts a local server, hammers it, prints percentiles, then shuts everything down.
// (Real tools run on a separate machine; here both share one process, so numbers are rough.)
import http from 'node:http';
import { pbkdf2Sync } from 'node:crypto';
// The system under test: one fast route, one CPU-heavy route that blocks the event loop
const server = http.createServer((req, res) =&gt; {
  if (req.url === '/slow') pbkdf2Sync('pw', 'salt', 20_000, 32, 'sha256');
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
});
await new Promise((resolve) =&gt; server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
// Pick a value at a percentile from a sorted list of latencies
const pct = (sorted, p) =&gt; sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
async function loadTest(path, { connections = 20, durationMs = 2000 } = {}) {
  const latencies = [];
  let errors = 0;
  const end = performance.now() + durationMs;
  // Each "connection" is a loop that sends a request, waits, and repeats
  const worker = async () =&gt; {
    while (performance.now() &lt; end) {
      const start = performance.now();
      try {
        const res = await fetch(base + path);
        await res.arrayBuffer();
        if (!res.ok) errors++;
      } catch { errors++; }
      latencies.push(performance.now() - start);
    }
  };
  await Promise.all(Array.from({ length: connections }, worker));
  latencies.sort((a, b) =&gt; a - b);
  const seconds = durationMs / 1000;
  console.log(`\n${path} with ${connections} connections for ${seconds}s`);
  console.log(`  requests: ${latencies.length}, errors: ${errors}, throughput: ${Math.round(latencies.length / seconds)} req/s`);
  console.log(`  latency p50 ${pct(latencies, 50).toFixed(1)} ms | p95 ${pct(latencies, 95).toFixed(1)} ms | p99 ${pct(latencies, 99).toFixed(1)} ms | max ${latencies.at(-1).toFixed(1)} ms`);
  return latencies.length / seconds;
}
await loadTest('/');
const slowRps = await loadTest('/slow');
// Capacity planning: how many instances for a peak of 1,000 req/s, running at 60% busy?
const peak = 1000;
const instances = Math.ceil(peak / (slowRps * 0.6));
console.log(`\nAt ${Math.round(slowRps)} req/s per instance, a ${peak} req/s peak needs about ${instances} instances of /slow.`);
server.close();
server.closeAllConnections(); // stop keep-alive sockets so the process can exit
</code></pre>

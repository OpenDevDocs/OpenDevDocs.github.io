---
publishDate: 2026-10-25T09:51
title: Clustering and Worker Threads
slug: clustering-and-worker-threads
metadescription: Learn why one slow calculation can freeze an Express 5 server, and how node:cluster and node:worker_threads let you use every CPU core without blocking requests.
updateDate: 2026-10-25T09:51
author: ['bishal-biswas']
level: 3
tags: ['express', 'cluster', 'worker-threads', 'performance']
course: expressjs
---

## What you will learn

- Why Node.js runs your JavaScript on a single thread, and when that becomes a problem
- How a CPU-heavy route can freeze every other request
- How to run several copies of your Express app with `node:cluster`
- How to move heavy calculations off the main thread with `node:worker_threads`
- What changes when your app runs as more than one process

## One cook, many orders

Node.js runs your JavaScript on **one thread**. A **thread** is a single line of work that a CPU core follows, one step at a time. That one thread runs the **event loop**: it picks up a request, runs your code, and moves on to the next.

**Think of a food truck with one very fast cook.** The cook takes an order, puts the burger on the grill, and while it cooks, takes the next order. Waiting for the grill (like waiting for a database) does not block anyone. That is why Node.js handles thousands of requests with one thread.

But imagine the cook has to hand-carve an ice sculpture for one customer. While carving, nobody else gets served. That is a **CPU-bound** task: work that keeps the CPU busy, rather than waiting on something else.

| Kind of work | Example | Blocks Node.js? |
| --- | --- | --- |
| **I/O-bound** (waiting) | Database query, reading a file, calling an API | No, Node waits in the background |
| **CPU-bound** (calculating) | Resizing images, hashing many passwords, big reports, heavy maths | Yes, the thread is busy until it finishes |

## Seeing the problem

Here is a deliberately slow function: a naive Fibonacci calculation.

```js
// lib/fib.js
export const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
```

```js
// app.js
import express from 'express';
import { fib } from './lib/fib.js';

export const app = express();

app.get('/fast', (req, res) => {
  res.json({ message: 'I am fast', pid: process.pid });
});

app.get('/slow', (req, res) => {
  const n = Math.min(Number(req.query.n) || 40, 45); // cap it, so nobody asks for fib(1000)
  res.json({ n, result: fib(n), pid: process.pid });
});
```

```js
// server.js
import { app } from './app.js';

app.listen(3000, (error) => {
  if (error) throw error;
  console.log(`Worker ${process.pid} listening on http://localhost:3000`);
});
```

Run `node server.js`, then in two terminals, at the same time:

```bash
curl http://localhost:3000/slow
```

```bash
curl http://localhost:3000/fast
```

The `/fast` request waits until `/slow` is done, even though it has nothing to do with it. On a typical laptop, `fib(40)` takes around a second, and every visitor is stuck behind it.

> **Note:** `process.pid` is the **process ID**, a number the operating system gives each running program. It will help you see which copy of your app answered.

There are two different tools for this, and they solve slightly different problems.

## Tool 1: clustering (more cooks, more food trucks)

Most servers have several CPU cores, but one Node.js process uses only one of them for your JavaScript. The built-in `node:cluster` module starts several copies of your app, called **workers**, one per core. A **primary** process starts the workers and shares incoming connections between them.

```text
                     +--> worker 1 (Express app)  pid 4101
 requests --> primary +--> worker 2 (Express app)  pid 4102
  port 3000          +--> worker 3 (Express app)  pid 4103
                     +--> worker 4 (Express app)  pid 4104
```

All workers listen on the same port. You do not change your Express code at all; you add one small entry file.

```js
// cluster.js
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

if (cluster.isPrimary) {
  const count = availableParallelism(); // how many cores Node can use
  console.log(`Primary ${process.pid} starting ${count} workers`);

  for (let i = 0; i < count; i += 1) {
    cluster.fork(); // start a copy of this same file as a worker
  }

  // If a worker crashes, replace it
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} exited (${signal ?? code}). Starting a new one.`);
    cluster.fork();
  });
} else {
  // Workers run the normal server
  await import('./server.js');
}
```

```bash
node cluster.js
```

```text
Primary 4100 starting 4 workers
Worker 4101 listening on http://localhost:3000
Worker 4102 listening on http://localhost:3000
Worker 4103 listening on http://localhost:3000
Worker 4104 listening on http://localhost:3000
```

Call `/fast` a few times and watch the `pid` change. Now a `/slow` request ties up only one worker, and the others keep serving. You also get roughly one core's worth of extra capacity per worker.

> **Warning:** The `exit` handler above restarts any worker that dies. If your app crashes on startup (a typo, a missing environment variable), it will restart forever in a tight loop. Real setups count recent restarts and give up after a few.

### What clustering does not share

Each worker is a completely separate process with its own memory. Anything you stored in a JavaScript variable is **not** shared.

| You stored this in memory... | Problem with several workers | Fix |
| --- | --- | --- |
| Sessions (default `express-session` store) | Logged in on worker 1, "logged out" on worker 2 | Redis or database session store |
| Rate limit counters | Each worker counts separately, so the real limit is multiplied | A shared Redis store for the limiter |
| Simple in-memory cache | Each worker has its own copy | Redis, from [Caching with Redis and HTTP Cache Headers](/courses/expressjs/caching-with-redis) |
| WebSocket or SSE client lists | A broadcast only reaches one worker's clients | Redis pub/sub between workers |

A good rule: **design your app so any copy can answer any request.** This is called being **stateless**, and it is what lets you scale, whether with `cluster`, with several servers, or with containers.

### Do you even need `cluster`?

Often, something else already runs several copies for you:

- **Process managers** such as PM2 have a cluster mode (`pm2 start server.js -i max`).
- **Containers** (Docker, Kubernetes) usually run **one process per container** and scale by starting more containers. In that world, you normally skip `cluster`.
- **Platforms** such as cloud app services run multiple instances behind their own load balancer.

`cluster` is most useful on a single virtual server where you run Node.js directly.

## Tool 2: worker threads (a helper in the back kitchen)

Clustering spreads requests across cores, but a single slow request still blocks its own worker. If one route is genuinely CPU-heavy, a better fix is to move that work **off the main thread**.

The built-in `node:worker_threads` module runs JavaScript on extra threads inside the same process. The main thread hands the job over and stays free to serve other requests. When the worker thread finishes, it sends the result back as a **message**.

```text
 main thread (event loop)                  worker thread
  request /slow  ---- workerData {n} --->   runs fib(n)
  serves /fast, /fast, /fast ...            ... still calculating ...
  sends response <----- postMessage ------  done
```

### The worker file

```js
// workers/fib-worker.js
import { parentPort, workerData } from 'node:worker_threads';
import { fib } from '../lib/fib.js';

// workerData is whatever the main thread passed in
const result = fib(workerData.n);

// Send the answer back to the main thread
parentPort.postMessage(result);
```

### Calling it with a Promise

A small wrapper turns "start a worker and wait for its message" into a function you can `await`:

```js
// lib/run-fib.js
import { Worker } from 'node:worker_threads';

export const runFib = (n) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/fib-worker.js', import.meta.url), {
      workerData: { n },
    });

    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
```

`new URL('...', import.meta.url)` builds a path relative to the current file, which is the ES module way of saying "the file next to me".

### Using it in a route

```js
// app.js
import express from 'express';
import { runFib } from './lib/run-fib.js';

export const app = express();

app.get('/fast', (req, res) => {
  res.json({ message: 'I am fast', pid: process.pid });
});

app.get('/slow', async (req, res) => {
  const n = Math.min(Number(req.query.n) || 40, 45);
  const result = await runFib(n); // runs on another thread; if it fails, Express 5 forwards the error
  res.json({ n, result });
});
```

Repeat the two-terminal test. This time `/fast` answers immediately while `/slow` is still working.

### Worker pools

Starting a brand-new thread for every request has a cost: each one loads its own copy of the JavaScript engine. Under real traffic, you want a **worker pool**: a fixed number of threads that stay alive and take jobs from a queue. Libraries such as `piscina` do this for you, so you rarely manage raw `Worker` objects in production.

> **Tip:** If a heavy job does not need to finish before the response (sending emails, generating a PDF to download later), consider a **job queue** instead. The route saves a job and returns `202 Accepted` straight away, and a separate background process does the work. BullMQ (built on Redis) is a common choice.

## Cluster or worker threads?

| | `node:cluster` | `node:worker_threads` |
| --- | --- | --- |
| What it creates | Separate processes | Threads inside one process |
| Shares memory? | No | Only if you use special shared buffers |
| Main purpose | Handle more requests by using all cores | Keep the event loop free during CPU-heavy work |
| Code changes | A small entry file; app stays the same | Move heavy code into a worker file |
| Crash impact | One worker dies, others keep going | An error in a worker thread can be caught by the main thread |
| Typical use | Single server without containers | Image processing, parsing big files, heavy maths |

You can use both together: a cluster of processes, each with its own small worker pool.

## Common mistakes

- **Using worker threads for I/O.** Database calls and HTTP requests already run in the background. A worker thread adds overhead and no benefit.
- **Keeping state in memory when clustered.** Sessions, rate limits and caches must move to a shared store.
- **Running `cluster` inside containers that are already scaled.** You end up with far more processes than cores.
- **Forgetting to limit input.** `fib(n)` with a huge `n` from the query string is a free denial-of-service attack. Validate and cap user input.
- **Creating a new worker per request under heavy load.** Use a pool.

## Key takeaways

- Node.js runs your JavaScript on one thread; waiting is cheap, but CPU-heavy work blocks every request.
- `node:cluster` runs one copy of your app per core with `cluster.fork()` and `availableParallelism()`, all sharing one port.
- Clustered workers do not share memory, so keep your app **stateless** and put shared data in Redis or a database.
- `node:worker_threads` moves CPU-heavy work off the main thread so the event loop stays responsive.
- In containers you usually scale with more containers instead of `cluster`; use worker pools for heavy jobs.

## Practice

1. Run the cluster example and call `/fast` ten times in a row. How many different `pid` values do you see?
2. Kill one worker with `kill <pid>` (or Task Manager on Windows) and confirm the primary starts a replacement.
3. Write a worker that takes a large array of numbers and returns their sum and average, and call it from a `POST /stats` route.
4. Add a restart limit to `cluster.js`: if more than five workers die within one minute, log an error and stop forking.

## What's next

With several processes running, stopping them safely matters too. Continue with [Graceful Shutdown and Health Checks](/courses/expressjs/graceful-shutdown-and-health-checks).

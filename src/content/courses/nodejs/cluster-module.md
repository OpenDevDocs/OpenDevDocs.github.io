---
publishDate: 2026-10-25T11:45
title: The Cluster Module and Multi-core Scaling
slug: cluster-module
metadescription: Use every CPU core with node:cluster. Fork worker processes that share one port, restart crashed workers, and shut down cleanly.
updateDate: 2026-10-25T11:45
author: ['bishal-biswas']
level: 3
tags: ['cluster', 'scaling', 'http', 'performance']
course: nodejs
---

## Why cluster?

A Node process runs your JavaScript on one thread, so it uses **one CPU core**. A **core** is one of the independent processing units inside your CPU. Most servers have 4, 8 or more.

So a single `node server.js` on an 8-core machine leaves 7 cores doing nothing.

Think of a supermarket with eight tills but only one cashier. The fix is not a faster cashier. It is opening more tills, with a queue manager at the entrance sending each shopper to a free one.

The built-in **`node:cluster`** module does exactly that. It starts several copies of your server, one per core, and spreads incoming connections between them. They all listen on the **same port**, so to the outside world it still looks like one server.

## Primary and workers

A cluster has two roles:

- The **primary** process (the queue manager). It starts and watches the workers. It does not handle requests itself.
- **Worker** processes (the cashiers). Each one is a full copy of your app, started with `cluster.fork()`.

The same file runs in both roles. `cluster.isPrimary` tells you which one you are:

```javascript
// server.mjs
import cluster from 'node:cluster';
import http from 'node:http';
import { availableParallelism } from 'node:os';

const numWorkers = availableParallelism(); // how many cores we can use

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} starting ${numWorkers} workers`);
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork(); // runs this same file again, as a worker
  }
} else {
  http
    .createServer((req, res) => {
      res.end(`Handled by worker ${cluster.worker.id} (pid ${process.pid})\n`);
    })
    .listen(3000);
}
```

Run it and send a few requests from a second terminal:

```bash
node server.mjs
curl http://localhost:3000/
```

```text
Handled by worker 2 (pid 21680)
Handled by worker 1 (pid 20268)
Handled by worker 3 (pid 17180)
Handled by worker 4 (pid 20148)
```

Different workers answered. Each worker is a separate process with its own PID, its own memory and its own event loop.

> **Note:** You may see `cluster.isMaster` in older tutorials. It is the deprecated name for `cluster.isPrimary`.

### How can they all use port 3000?

Normally only one process can listen on a port. In a cluster, when a worker calls `listen(3000)`, it asks the primary to do the listening. The primary owns the port and passes each new connection to a worker.

## How connections are shared

The way connections are handed out is the **scheduling policy**:

- **Round-robin** (`cluster.SCHED_RR`): the primary deals connections out in turn, like cards: worker 1, 2, 3, 4, 1, 2... This is the default on every platform except Windows.
- **Let the OS decide** (`cluster.SCHED_NONE`): workers accept connections directly. This is the default on Windows, and the operating system can end up favouring one worker.

On Windows the first example may show the same worker answering every time. To get round-robin everywhere, set the policy **before** the first `fork()`:

```javascript
cluster.schedulingPolicy = cluster.SCHED_RR;
```

or set the environment variable when you start the app:

```bash
NODE_CLUSTER_SCHED_POLICY=rr node server.mjs
```

## Keeping workers alive

If a worker crashes, its requests fail but the other workers keep serving. The primary gets an `'exit'` event, and the usual response is to start a replacement:

```javascript
if (cluster.isPrimary) {
  for (let i = 0; i < numWorkers; i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died (code ${code}). Starting a new one.`);
    cluster.fork();
  });
}
```

```text
Worker 24244 died (code 1). Starting a new one.
```

This is self-healing: one bug that crashes a worker no longer takes your whole site down.

> **Tip:** Restarting forever can hide a bug that crashes every worker at start-up, creating a tight crash loop. Real setups count recent restarts and give up (or slow down) if there are too many.

## Talking between primary and workers

Workers are forked processes, so they have the same IPC channel you met in [the Child Processes lesson](/courses/nodejs/child-processes):

```javascript
// messages.mjs
import cluster from 'node:cluster';

if (cluster.isPrimary) {
  const worker = cluster.fork();
  worker.on('message', (msg) => {
    console.log('primary got', msg); // prints: primary got { hello: 'from worker 1' }
    worker.disconnect();
  });
} else {
  process.send({ hello: `from worker ${cluster.worker.id}` });
}
```

- In the primary, `worker.send()` and `worker.on('message')`.
- In a worker, `process.send()` and `process.on('message')`.

## Shutting down gracefully

`worker.disconnect()` asks a worker to stop politely: it stops accepting new connections, finishes the ones in progress, then exits. Killing it instead would cut off requests halfway.

```javascript
// in the primary
let shuttingDown = false; // check this in the 'exit' handler before calling fork()

process.on('SIGTERM', () => {
  shuttingDown = true; // so the 'exit' handler does not start replacements
  for (const worker of Object.values(cluster.workers)) {
    worker.disconnect();
  }
});
```

`cluster.workers` is an object holding every live worker. Inside the `'exit'` handler, `worker.exitedAfterDisconnect` is `true` when the worker left because you asked it to, so you can tell a planned exit from a crash. [The Graceful Shutdown lesson](/courses/nodejs/graceful-shutdown) covers this in depth.

## Workers do not share memory

Each worker is a separate process. Anything stored in a variable lives in **one** worker only:

```javascript
let visits = 0; // each worker has its own copy

http.createServer((req, res) => {
  visits++;
  res.end(`Visits: ${visits}\n`); // a different count depending on which worker answers
});
```

The same goes for in-memory caches, login sessions and rate limiters. If one request logs a user in on worker 1, worker 2 knows nothing about it.

The fix is to keep shared state **outside** the workers: in a database, or a shared store such as Redis. Design your app to be **stateless**, meaning any worker can handle any request. That same design also lets you run copies of your app on several machines later.

## Cluster, worker threads or something else?

| Tool | What it scales | Use it for |
| --- | --- | --- |
| `node:cluster` | Whole server processes on one machine | Handling more HTTP requests per machine |
| [Worker threads](/courses/nodejs/worker-threads) | Threads inside one process | Speeding up CPU-heavy calculations |
| Containers or a process manager | Processes across machines | Production scaling and automatic restarts |

In production, many teams skip `cluster` and instead run one Node process per container, letting Docker, Kubernetes or a process manager like PM2 start several copies and restart them. You will see those options in [the Deploying and Scaling lesson](/courses/nodejs/deploying-and-scaling). Understanding `cluster` still helps, because the ideas (several copies, a balancer in front, stateless workers) are the same.

## Common mistakes

### Doing the work in the primary

```javascript
if (cluster.isPrimary) {
  for (let i = 0; i < 4; i++) cluster.fork();
}
http.createServer(handler).listen(3000); // runs in the primary AND every worker
```

Code outside the `if`/`else` runs in every process. Put the server inside the `else`, so only workers serve requests.

### Forking more workers than cores

Starting 32 workers on a 4-core machine does not make it 8 times faster. The workers just fight over the same cores and waste memory. Start with `os.availableParallelism()` workers.

### Expecting it to fix slow code

Clustering spreads requests across cores. One slow request that blocks for 2 seconds still blocks its worker for 2 seconds. Fix the slow code, or move heavy calculations to worker threads.

## Quick recap

- One Node process uses one CPU core. `node:cluster` runs one worker process per core.
- `cluster.isPrimary` picks the role. The primary calls `cluster.fork()`, the workers run the server.
- All workers share one port. The primary hands out connections, round-robin by default except on Windows.
- Listen for `'exit'` and `fork()` again to replace crashed workers.
- `worker.disconnect()` lets a worker finish its requests before exiting.
- Workers share no memory. Keep sessions and caches in a database or Redis so the app is stateless.

<code id="code-content" class="language-javascript">
// cluster-demo.mjs: run with  node cluster-demo.mjs
// The primary starts workers, sends them requests, restarts a crashed one, then shuts down.
import cluster from 'node:cluster';
import http from 'node:http';
import { availableParallelism } from 'node:os';
const PORT = 3000;
if (cluster.isPrimary) {
  cluster.schedulingPolicy = cluster.SCHED_RR; // round-robin on every OS (set before fork)
  const count = Math.min(3, availableParallelism());
  console.log(`Primary ${process.pid} starting ${count} workers`);
  for (let i = 0; i &lt; count; i++) cluster.fork();
  let shuttingDown = false;
  cluster.on('exit', (worker, code) =&gt; {
    console.log(`Worker ${worker.id} (pid ${worker.process.pid}) exited with code ${code}`);
    if (!shuttingDown) {
      console.log('Starting a replacement worker');
      cluster.fork();
    }
  });
  // Wait until every worker is listening, then act as a client
  let listening = 0;
  cluster.on('listening', async () =&gt; {
    if (++listening !== count) return;
    for (let i = 0; i &lt; 6; i++) {
      const res = await fetch(`http://localhost:${PORT}/`, { headers: { connection: 'close' } });
      console.log(await res.text());
    }
    await fetch(`http://localhost:${PORT}/crash`).catch(() =&gt; {}); // kills one worker
    setTimeout(() =&gt; {
      shuttingDown = true;
      console.log('Shutting down: disconnecting all workers');
      for (const worker of Object.values(cluster.workers)) worker.disconnect();
    }, 500);
  });
} else {
  // --- every worker runs this part and shares port 3000 ---
  http
    .createServer((req, res) =&gt; {
      if (req.url === '/crash') process.exit(1); // simulate a crash
      res.end(`Request handled by worker ${cluster.worker.id} (pid ${process.pid})`);
    })
    .listen(PORT);
}
</code></pre>

---
course: javascript
slug: worker-threads-vs-cluster-in-node
experienceLevel: senior
difficulty: hard
tags:
  - node
  - concurrency
  - performance
question: "When should you use `worker_threads` versus `cluster` (or multiple processes) in Node.js?"
answer: |
  They solve different problems.

  **`cluster`** (or simply running several processes behind a load balancer, PM2, or Kubernetes replicas) scales an **I/O-bound server** across CPU cores. Each worker is a full Node **process** with its own memory, event loop and V8 heap. The primary process distributes incoming connections (round-robin by default on Linux). Workers share nothing, so a crash or memory leak is isolated to one process. In containerised deployments, many teams skip `cluster` entirely and run one Node process per container, letting the orchestrator scale replicas.

  **`worker_threads`** runs JavaScript on additional **threads inside one process**. Each worker has its own isolate and event loop, but they can share memory through `SharedArrayBuffer` and transfer `ArrayBuffer`s without copying. Use them to move **CPU-bound** work off the main event loop: image resizing, compression, parsing huge JSON, crypto, report generation. Otherwise that work blocks every request on the server.

  Decision guide:

  - Request throughput on a multi-core machine: multiple processes (cluster or orchestrator).
  - A CPU-heavy operation inside a request: a **pool** of worker threads (Piscina, or a hand-rolled pool). Creating a worker per task costs tens of milliseconds and extra memory.
  - Blocking I/O: neither. Node's async I/O and libuv's threadpool already handle it. (Set `UV_THREADPOOL_SIZE` if `fs`, `dns.lookup`, `crypto` or `zlib` calls queue up.)
  - Untrusted code: a separate process or container, not a worker thread, since threads share a process.

  Costs to remember: data sent with `postMessage` is structured-cloned (copied) unless transferred. Each worker has its own heap, so memory adds up. Errors in workers must be handled through the `'error'` and `'exit'` events. Size pools to the available cores, and in containers check the CPU limit, not the host's core count (`os.availableParallelism()`).
codeExample: |
  const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

  const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2)); // deliberately CPU-heavy

  if (isMainThread) {
    let ticks = 0;
    const heartbeat = setInterval(() => ticks++, 5);      // proves the loop stays free

    const worker = new Worker(__filename, { workerData: 32 });
    worker.once('message', (result) => {
      clearInterval(heartbeat);
      console.log('fib(32) =', result);
      console.log('main loop kept running:', ticks > 0);
    });
    worker.once('error', (err) => console.error('worker failed', err));
  } else {
    parentPort.postMessage(fib(workerData));               // runs on another thread
  }
  // Output:
  // fib(32) = 2178309
  // main loop kept running: true

  // Scaling an HTTP server across cores is a different job: use separate
  // processes, e.g. node:cluster with cluster.fork() per core, or replicas.
popularity: 7.9
isPublished: true
---

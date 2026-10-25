---
publishDate: 2026-10-25T13:30
title: "Node.js Internals: libuv and the Thread Pool"
slug: nodejs-internals-libuv
metadescription: See how libuv gives Node its asynchronous I/O, which work runs on the thread pool, how UV_THREADPOOL_SIZE changes it, and how to spot pool starvation.
updateDate: 2026-10-25T13:30
author: ['bishal-biswas']
level: 4
tags: ['internals', 'libuv', 'performance']
course: nodejs
---

## "Single-threaded", but not quite

You have heard that Node is single-threaded. Your JavaScript does run on one thread. Yet Node can read files, hash passwords and talk to databases all at the same time. How?

The answer is a C library called **libuv**. It sits underneath Node and does the waiting and the heavy lifting, so your one JavaScript thread does not have to.

Picture a restaurant with one waiter (your JavaScript thread). The waiter takes orders and serves plates but never cooks. Orders go to two places:

- Some go to **outside suppliers** who deliver when ready, like a bakery that phones when the bread is done. The waiter does not wait by the phone.
- Some go to a **kitchen with four cooks**. If more than four dishes are ordered at once, the extra ones wait for a free cook.

In Node, the outside suppliers are the **operating system's** own async features. The kitchen is libuv's **thread pool**. This lesson is about knowing which work goes where, because that explains some surprising slowdowns.

## What libuv does

**libuv** is a cross-platform library for asynchronous I/O. (**I/O** means input/output: files, network, anything outside your program's memory.) It provides:

- **The event loop** itself. The phases you learned in [the Event Loop lesson](/courses/nodejs/the-event-loop) (timers, poll, check and so on) are libuv's loop.
- **Network I/O** using the operating system's best mechanism: **epoll** on Linux, **kqueue** on macOS, **IOCP** on Windows.
- **A thread pool** for work the operating system cannot do asynchronously in a portable way.
- Timers, child processes, signals and file watching.

Node's own C++ code connects your JavaScript to these pieces. When you call `fs.readFile`, the request travels down to libuv, and later libuv tells the event loop "this is finished, run the callback".

## Path 1: the operating system does the waiting

For **network** work (TCP sockets, HTTP servers, HTTP requests to an IP address), the operating system can watch thousands of connections at once and tell libuv which ones have data ready. No extra threads are needed.

That is why a single Node process can hold tens of thousands of open connections. Waiting costs almost nothing.

## Path 2: the thread pool does the work

Some jobs have no good async version in every operating system, or they are simply CPU-heavy. libuv hands these to its **thread pool**: a small group of background threads that run the job and then report back to the event loop.

What uses the thread pool:

| Area | Examples |
| --- | --- |
| File system | Almost all `fs` and `fs/promises` calls: `readFile`, `writeFile`, `stat`, `readdir` |
| DNS | `dns.lookup()`, which is what `http`, `net` and `fetch` use to turn a hostname into an IP address |
| Crypto | `crypto.pbkdf2`, `crypto.scrypt`, `crypto.randomBytes` (async), `crypto.generateKeyPair` |
| Compression | Async `zlib` calls such as `gzip` and `deflate` |

What does **not** use the thread pool:

- Network sockets: `http`, `net`, WebSockets (except the DNS step).
- `dns.resolve*()` functions, which talk to DNS servers over the network instead of using the operating system's lookup.
- Timers.
- Your JavaScript, which always runs on the main thread.

## The default size is 4

The thread pool has **4 threads** by default, no matter how many CPU cores you have. So at most four pool jobs run at the same moment. A fifth job waits in a queue until a thread is free.

Let us prove it. This script starts 8 slow password hashes at the same time:

```javascript
// pool.mjs
import { pbkdf2 } from 'node:crypto';

const start = performance.now();

for (let i = 1; i <= 8; i++) {
  // pbkdf2 is deliberately slow: it is designed for hashing passwords
  pbkdf2('secret', 'salt', 300_000, 64, 'sha512', () => {
    console.log(`hash ${i} done at ${Math.round(performance.now() - start)} ms`);
  });
}
```

```bash
node pool.mjs
```

When you run it, you see a clear pattern (your exact numbers will differ):

- The hashes finish in **two waves of four**.
- The first four finish at roughly the same time.
- The second four finish together at about **twice** that time, because they had to wait for free threads.
- The order inside each wave changes from run to run.

## Changing the size: UV_THREADPOOL_SIZE

The **`UV_THREADPOOL_SIZE`** environment variable sets the pool size. Set it when you start Node:

```bash
UV_THREADPOOL_SIZE=8 node pool.mjs
```

On Windows PowerShell:

```powershell
$env:UV_THREADPOOL_SIZE = 8; node pool.mjs
```

Now, on a machine with at least 8 cores, all eight hashes finish together in **one wave**. Each one takes a little longer than before (the cores are all busy at once), but the whole batch finishes sooner.

With `UV_THREADPOOL_SIZE=1`, the opposite happens: the hashes finish **one after another**, evenly spaced.

A few rules:

- The maximum is 1024.
- More threads only help up to roughly the number of CPU cores for CPU-heavy work like hashing. Beyond that, threads just take turns on the same cores.
- For slow disks or network file systems, a larger pool can help even with few cores, because the threads spend their time waiting.
- The pool is created the first time something needs it, so set the variable in the environment before Node starts, not halfway through your program.

> **Note:** All pool work in one process shares the same threads. Your code, your libraries and Node itself all draw from the same small kitchen.

## Pool starvation

Here is where it gets surprising. Because the pool is shared, slow jobs can block unrelated fast ones.

```javascript
// starve.mjs
import { pbkdf2 } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const start = performance.now();
const t = () => Math.round(performance.now() - start);

// Four slow hashes take all four threads
for (let i = 1; i <= 4; i++) {
  pbkdf2('secret', 'salt', 500_000, 64, 'sha512', () => console.log(`hash ${i} done at ${t()} ms`));
}

// A tiny file read that should take about 1 ms
readFile(new URL(import.meta.url), 'utf8').then(() => console.log(`file read done at ${t()} ms`));
```

When you run it, the tiny file read does not finish in a millisecond. It finishes only **after the first hash completes**, because it had to wait for a free thread. This is called **thread pool starvation**.

In a real server it looks like this: a burst of login requests (each hashing a password) suddenly makes unrelated file reads, DNS lookups and compression slow, even though the CPU is not fully used.

The same thing can hit outgoing HTTP requests to a **hostname**, because the hostname lookup uses `dns.lookup()` on the pool. Requests to an IP address skip that step.

### How to fix starvation

- **Raise `UV_THREADPOOL_SIZE`** to match your workload, for example to the number of cores.
- **Move heavy CPU work to worker threads** (see [the Worker Threads lesson](/courses/nodejs/worker-threads)), so it does not compete with I/O in the pool.
- **Cache DNS results** or use connection reuse (keep-alive), so fewer lookups happen.
- **Measure.** Wrap suspicious calls with timings, as you learned in [the Performance Hooks lesson](/courses/nodejs/performance-hooks-and-benchmarking).

## Network I/O does not wait for the pool

Compare that with a network request to an IP address. This server and request run while all four threads are busy hashing:

```javascript
// net.mjs
import { pbkdf2 } from 'node:crypto';
import http from 'node:http';

const server = http.createServer((req, res) => res.end('hi'));

server.listen(0, '127.0.0.1', async () => {
  const start = performance.now();
  for (let i = 0; i < 4; i++) pbkdf2('s', 'salt', 500_000, 64, 'sha512', () => {});

  const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
  console.log(`got "${await res.text()}" after ${Math.round(performance.now() - start)} ms`);
  server.close();
});
```

The HTTP round trip finishes almost immediately, long before any hash is done. Network sockets are handled by the operating system, not the pool.

## Async is not the same as "does not block"

One last important point. The thread pool only helps if you use the **async** version of a function. The `Sync` versions run on the main thread and freeze everything:

```javascript
// sync.mjs
import { pbkdf2Sync } from 'node:crypto';

const start = performance.now();
setTimeout(() => console.log(`timer (wanted 10 ms) ran at ${Math.round(performance.now() - start)} ms`), 10);

pbkdf2Sync('secret', 'salt', 500_000, 64, 'sha512'); // blocks the event loop
console.log('sync hash done');
```

The timer wanted to run after 10 ms, but it runs only after the whole hash finishes. While a `Sync` call runs, your server cannot answer anyone.

## Common mistakes

**Thinking more threads always means faster.** Setting `UV_THREADPOOL_SIZE=128` on a 4-core machine does not make hashing 32 times faster. CPU-bound jobs are limited by cores.

**Using `Sync` functions in request handlers.** `readFileSync` at startup is fine. Inside a request handler it blocks every other request.

```javascript
// Wrong: blocks the event loop on every request
const data = fs.readFileSync('notes.json', 'utf8');
```

```javascript
// Right: runs on the thread pool, the event loop stays free
const data = await readFile('notes.json', 'utf8');
```

**Blaming the network for slow DNS.** If outgoing requests to hostnames slow down only under load, check whether the pool is busy with crypto or `zlib` work first.

## Quick recap

- libuv is the C library that gives Node its event loop and async I/O.
- Network I/O uses the operating system's async features (epoll, kqueue, IOCP) and needs no extra threads.
- File system calls, `dns.lookup`, crypto like `pbkdf2` and `scrypt`, and async `zlib` run on libuv's thread pool.
- The pool has 4 threads by default; change it with `UV_THREADPOOL_SIZE` before Node starts (maximum 1024).
- Slow pool jobs can starve unrelated fast ones: more threads, worker threads and caching help.
- `Sync` functions bypass the pool and block the event loop.

<code id="code-content" class="language-javascript">
// thread-pool.mjs: watch libuv's thread pool at work.
// The script re-runs itself as a child process with different pool sizes.
import { pbkdf2 } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
const JOBS = 8;
if (process.env.POOL_CHILD) {
  // --- Child: start 8 slow hashes at once and record when each finishes ---
  const start = performance.now();
  const done = [];
  let ticks = 0;
  // A heartbeat proves the event loop stays free while the pool works
  const heartbeat = setInterval(() =&gt; ticks++, 10);
  for (let i = 0; i &lt; JOBS; i++) {
    pbkdf2('password', 'salt', 200_000, 64, 'sha512', () =&gt; {
      done.push(Math.round(performance.now() - start));
      if (done.length === JOBS) {
        clearInterval(heartbeat);
        console.log(`finished at (ms): ${done.join(', ')}  | heartbeats meanwhile: ${ticks}`);
      }
    });
  }
} else {
  // --- Parent: run the child with pool sizes 1, 4 (the default) and 8 ---
  console.log(`CPU cores available: ${availableParallelism()}, jobs: ${JOBS}`);
  const self = fileURLToPath(import.meta.url);
  for (const size of ['1', '4', '8']) {
    const output = execFileSync(process.execPath, [self], {
      env: { ...process.env, POOL_CHILD: '1', UV_THREADPOOL_SIZE: size },
      encoding: 'utf8',
    });
    console.log(`UV_THREADPOOL_SIZE=${size}: ${output.trim()}`);
  }
  console.log('Pattern to look for: size 1 finishes one by one, size 4 in two waves of four,');
  console.log('size 8 all together (if you have 8 or more cores). Heartbeats keep ticking throughout.');
}
</code></pre>

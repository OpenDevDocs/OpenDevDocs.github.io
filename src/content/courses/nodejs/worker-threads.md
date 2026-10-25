---
publishDate: 2026-10-25T11:40
title: Worker Threads and Shared Memory
slug: worker-threads
metadescription: Run CPU-heavy JavaScript in parallel with node:worker_threads. Pass messages, transfer buffers, and share memory safely with SharedArrayBuffer and Atomics.
updateDate: 2026-10-25T11:40
author: ['bishal-biswas']
level: 3
tags: ['worker-threads', 'concurrency', 'atomics', 'performance']
course: nodejs
---

## Why worker threads?

Node runs your JavaScript on **one thread**. A **thread** is a single line of work the CPU follows, one instruction after another. As you saw in [the Event Loop lesson](/courses/nodejs/the-event-loop), that one thread is great at juggling I/O (files, network) because it never waits around.

It is bad at heavy **CPU work**: resizing images, hashing passwords, crunching numbers. While the thread is busy calculating, nothing else happens. Timers do not fire. Requests do not get answered.

Picture a café with one barista. Taking orders and handing out drinks is quick. But if the barista stops to bake a wedding cake, the queue grinds to a halt. The fix is to hire a baker in the back room. The barista keeps serving while the cake gets made.

A **worker thread** is that baker: a second JavaScript thread, inside the same process, that runs code in parallel with your main thread.

## Seeing the problem

This script prints a "tick" every 200 ms, then starts a slow calculation:

```javascript
// block.mjs
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2); // deliberately slow
}

const start = Date.now();
const ticker = setInterval(() => console.log('tick at', Date.now() - start, 'ms'), 200);

setTimeout(() => {
  console.log('fib(40) =', fib(40));
}, 300);

setTimeout(() => clearInterval(ticker), 2500);
```

```text
tick at 214 ms
fib(40) = 102334155
tick at 1275 ms
tick at 1487 ms
```

Look at the gap: no ticks between 214 ms and 1275 ms. For a whole second, the program was frozen. In a web server, every user would have been stuck waiting.

## Your first worker

Move the slow function into its own file. This file runs inside the worker:

```javascript
// fib-worker.mjs
import { parentPort, workerData } from 'node:worker_threads';

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.postMessage(fib(workerData.n)); // send the answer back
```

- `workerData` is the starting data the main thread passed in.
- `parentPort` is the worker's line back to the main thread. `postMessage` sends a value along it.

The main thread starts the worker and listens:

```javascript
// main.mjs
import { Worker } from 'node:worker_threads';

const start = Date.now();
const ticker = setInterval(() => console.log('tick at', Date.now() - start, 'ms'), 200);

const worker = new Worker(new URL('./fib-worker.mjs', import.meta.url), {
  workerData: { n: 40 },
});

worker.on('message', (result) => {
  console.log('fib(40) =', result);
  clearInterval(ticker);
});
worker.on('error', (err) => console.error('worker failed:', err));
worker.on('exit', (code) => console.log('worker exited with code', code));
```

```text
tick at 213 ms
tick at 415 ms
tick at 617 ms
tick at 818 ms
fib(40) = 102334155
worker exited with code 0
```

The ticks never stop. The main thread stayed free while the worker did the heavy lifting.

The events you will use most:

| Event | When |
| --- | --- |
| `'message'` | The worker called `parentPort.postMessage()` |
| `'error'` | The worker threw an exception it did not catch |
| `'exit'` | The worker stopped. Code `0` is normal, `1` means it crashed |

When a worker has nothing left to do, it exits by itself. To stop one early, call `await worker.terminate()`.

## One file for both sides

You can keep the main and worker code in one file. `isMainThread` is `true` in the main thread and `false` inside a worker:

```javascript
// one-file.mjs
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (isMainThread) {
  const worker = new Worker(new URL(import.meta.url), { workerData: 'Asha' });
  worker.on('message', (msg) => console.log(msg)); // prints: Hello, Asha
} else {
  parentPort.postMessage(`Hello, ${workerData}`);
}
```

`new URL(import.meta.url)` means "this very file".

## Wrapping a worker in a promise

Event listeners get messy when you have many jobs. Wrap each job in a promise, then use `Promise.all` to run several in parallel:

```javascript
function runFib(n) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fib-worker.mjs', import.meta.url), { workerData: { n } });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}

const results = await Promise.all([runFib(38), runFib(39), runFib(40)]);
console.log(results);
```

An error thrown inside the worker arrives as the `'error'` event, so the promise rejects and your `try`/`catch` works as usual.

## How messages travel

Worker threads do **not** share normal variables. Each worker has its own memory, its own globals and its own event loop. When you `postMessage` an object, Node makes a **copy** of it using the **structured clone** algorithm, the same one browsers use.

Structured clone handles plain objects, arrays, `Date`, `Map`, `Set`, typed arrays and more. It cannot copy functions:

```javascript
worker.postMessage({ greet: () => 'hi' });
```

```text
DataCloneError: () => 'hi' could not be cloned.
```

Send data, not behaviour. Put the functions in the worker's code.

### Transferring instead of copying

Copying a 100 MB buffer is slow. You can **transfer** an `ArrayBuffer` instead: ownership moves to the other thread and nothing is copied. Pass it in the second argument, the **transfer list**:

```javascript
const buffer = new ArrayBuffer(8 * 1024 * 1024); // 8 MB
console.log(buffer.byteLength); // prints: 8388608
worker.postMessage(buffer, [buffer]);
console.log(buffer.byteLength); // prints: 0
```

After the transfer, the sender's buffer is empty. It is like handing over a parcel: you no longer have it.

## Shared memory

Sometimes threads really do need to look at the same memory, for example to update a shared counter. That is what a **SharedArrayBuffer** is for. Unlike a normal `ArrayBuffer`, it is not copied or moved when you post it. Every thread sees the same bytes.

You read and write it through a **typed array**, such as `Int32Array`, which views the bytes as numbers:

```javascript
// counter.mjs
import { Worker, isMainThread, workerData } from 'node:worker_threads';

if (isMainThread) {
  const shared = new SharedArrayBuffer(4); // 4 bytes: room for one 32-bit integer
  const counter = new Int32Array(shared);

  const workers = [];
  for (let i = 0; i < 4; i++) {
    workers.push(new Worker(new URL(import.meta.url), { workerData: { shared } }));
  }
  await Promise.all(workers.map((w) => new Promise((resolve) => w.on('exit', resolve))));
  console.log('final count:', counter[0]);
} else {
  const counter = new Int32Array(workerData.shared);
  for (let i = 0; i < 100_000; i++) {
    counter[0]++; // looks harmless...
  }
}
```

Four workers each add 100,000, so you expect 400,000. Run it a couple of times:

```text
final count: 295629
final count: 302532
```

This is a **race condition**. `counter[0]++` is really three steps: read the value, add one, write it back. Two threads can read the same old value at the same moment, and one of the updates is lost.

### Atomics to the rescue

The `Atomics` object performs these operations as one indivisible step, called an **atomic operation**. No other thread can sneak in halfway:

```javascript
for (let i = 0; i < 100_000; i++) {
  Atomics.add(counter, 0, 1); // add 1 to position 0, safely
}
```

```text
final count: 400000
```

Useful methods:

- `Atomics.add(array, index, value)` and `Atomics.sub(...)`: change a value safely.
- `Atomics.load(array, index)` and `Atomics.store(array, index, value)`: read or write safely.
- `Atomics.wait()` and `Atomics.notify()`: let one thread sleep until another wakes it. These are low-level tools for building locks.

> **Tip:** Shared memory is powerful but easy to get wrong. Prefer plain `postMessage` and only reach for `SharedArrayBuffer` when copying is genuinely too slow.

## How many workers?

Each worker is a full JavaScript engine, with its own memory, and takes a little while to start. Two guidelines:

- Do not start more busy workers than you have CPU cores. `os.availableParallelism()` tells you how many your program can use.
- Do not create a fresh worker for every tiny job. For a server handling many requests, keep a fixed group of workers alive and hand jobs to whichever is free. This is called a **worker pool**. Libraries such as `piscina` provide one ready-made.

## Worker threads or child processes?

| | Worker threads | Child processes (`fork`) |
| --- | --- | --- |
| Lives in | The same process | A separate process |
| Start-up cost | Lower | Higher |
| Shared memory | Yes, with `SharedArrayBuffer` | No |
| An uncaught error | Emits `'error'` on the Worker; crashes the app if unhandled | Ends only the child |
| Can run | JavaScript | Any program |

Use workers for CPU-heavy JavaScript. Use [child processes](/courses/nodejs/child-processes) to run other programs or when you want full isolation.

## Common mistakes

### Using workers for I/O

```javascript
// Pointless: reading a file in a worker
parentPort.postMessage(await readFile('notes.txt', 'utf8'));
```

Node already does file and network I/O in the background without blocking. A worker only adds overhead. Workers help with CPU work, not waiting.

### Forgetting the 'error' listener

If a worker throws and nobody listens for `'error'` on the `Worker` object, the error is rethrown in the main thread and crashes your whole program. Always attach one, or use the promise wrapper above.

### Expecting globals to be shared

```javascript
let total = 0; // each worker gets its OWN copy of this module and this variable
```

Changing `total` in a worker does not change it in the main thread. Send the value back with `postMessage`, or use a `SharedArrayBuffer`.

## Quick recap

- Node runs your JavaScript on one thread. Heavy CPU work blocks everything.
- A **worker thread** runs JavaScript in parallel inside the same process.
- Start one with `new Worker(url, { workerData })`. The worker replies with `parentPort.postMessage()`.
- Messages are **copied** by structured clone. Functions cannot be sent. `ArrayBuffer`s can be **transferred**.
- `SharedArrayBuffer` lets threads share memory. Use `Atomics` to avoid race conditions.
- Match busy workers to `os.availableParallelism()` and reuse them with a pool.

<code id="code-content" class="language-javascript">
// primes.mjs: run with  node primes.mjs
// Counts primes below 2,000,000 by splitting the work across worker threads.
import { Worker, isMainThread, parentPort, workerData, threadId } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
function isPrime(n) {
  if (n &lt; 2) return false;
  for (let i = 2; i * i &lt;= n; i++) if (n % i === 0) return false;
  return true;
}
if (isMainThread) {
  const LIMIT = 2_000_000;
  const threads = Math.min(4, availableParallelism()); // never more than the CPU has
  const chunk = Math.ceil(LIMIT / threads);
  // One shared integer that every worker can update safely with Atomics
  const shared = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const progress = new Int32Array(shared);
  // The event loop stays free: this timer keeps ticking while workers crunch
  const ticker = setInterval(() =&gt; console.log('main thread still responsive...'), 100);
  const started = performance.now();
  const runWorker = (from, to) =&gt;
    new Promise((resolve, reject) =&gt; {
      const worker = new Worker(new URL(import.meta.url), { workerData: { from, to, shared } });
      worker.once('message', resolve); // the worker's answer
      worker.once('error', reject); // an exception thrown inside the worker
    });
  const jobs = [];
  for (let i = 0; i &lt; threads; i++) {
    jobs.push(runWorker(i * chunk, Math.min((i + 1) * chunk, LIMIT)));
  }
  const results = await Promise.all(jobs);
  clearInterval(ticker);
  for (const r of results) console.log(`thread ${r.threadId}: ${r.count} primes in [${r.from}, ${r.to})`);
  const total = results.reduce((sum, r) =&gt; sum + r.count, 0);
  console.log(`Total: ${total} primes below ${LIMIT}`);
  console.log(`Numbers checked (shared counter): ${Atomics.load(progress, 0)}`);
  console.log(`Took ${Math.round(performance.now() - started)} ms with ${threads} threads`);
} else {
  // --- this branch runs inside each worker thread ---
  const { from, to, shared } = workerData;
  const progress = new Int32Array(shared);
  let count = 0;
  for (let n = from; n &lt; to; n++) {
    if (isPrime(n)) count++;
  }
  Atomics.add(progress, 0, to - from); // safe even when threads finish together
  parentPort.postMessage({ threadId, from, to, count });
}
</code></pre>

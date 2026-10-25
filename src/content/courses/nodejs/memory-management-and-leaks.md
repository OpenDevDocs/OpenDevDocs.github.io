---
publishDate: 2026-10-25T12:30
title: Memory Management, GC and Leak Hunting
slug: memory-management-and-leaks
metadescription: Understand how V8 manages memory and garbage collection in Node, read memoryUsage numbers, spot the common causes of leaks and hunt them down with heap snapshots.
updateDate: 2026-10-25T12:30
author: ['bishal-biswas']
level: 3
tags: ['memory', 'garbage-collection', 'leaks', 'v8']
course: nodejs
---

## How Node manages memory

In JavaScript you never free memory yourself. You create objects, and a background helper called the **garbage collector** (GC) removes the ones you no longer use.

Picture a hotel. Guests (your objects) check in to rooms. Housekeeping (the GC) regularly walks the corridors and cleans out any room whose guest has left. But housekeeping has one rule: **if anyone still holds a key to the room, it stays untouched**, even if nobody will ever visit again.

That rule is the whole story of memory leaks in Node.

## Reachability: who holds the key?

The GC starts from a set of **roots**: global variables, the currently running functions and their local variables, and a few internal things. It follows every reference from those roots, then every reference from those objects, and so on.

- An object it can reach is **live** and is kept.
- An object it cannot reach is **garbage** and its memory is reclaimed.

```javascript
let order = { id: 1, items: new Array(100_000).fill('book') };
// order is reachable through the variable, so it is kept

order = null;
// nothing points to the object any more, so the GC can reclaim it
```

You do not have to set things to `null` in normal code. When a function returns, its local variables stop being roots automatically.

## Generations: young and old

V8, the engine inside Node, splits the **heap** (the memory area where objects live) into two main parts, because most objects die young:

- **Young generation (new space)**: where new objects are created. It is small and cleaned very often by a quick collection called a **scavenge** (a **minor GC**).
- **Old generation (old space)**: objects that survive a couple of scavenges are moved here. It is bigger and cleaned less often by a slower **mark-sweep-compact** collection (a **major GC**).

GC work can pause your JavaScript for a moment. V8 does much of it in small steps and on background threads to keep pauses short, but creating huge amounts of short-lived garbage still costs CPU time.

You can watch the GC work with `--trace-gc`:

```bash
node --trace-gc app.js
```

```text
[27228:0000026ACBCEE000]       22 ms: Scavenge 4.4 (5.3) -> 4.1 (6.3) MB, pooled: 0 MB, 1.16 / 0.00 ms  ...
[27228:0000026ACBCEE000]       30 ms: Scavenge 8.0 (10.9) -> 7.1 (14.2) MB, pooled: 0 MB, 3.66 / 0.00 ms  ...
```

Each line shows the heap size before and after (`4.4 -> 4.1 MB`) and how long the pause took.

## Reading memory numbers

`process.memoryUsage()` returns five numbers, in bytes:

```javascript
// usage.mjs
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';
const usage = process.memoryUsage();

for (const [key, value] of Object.entries(usage)) {
  console.log(key.padEnd(12), mb(value));
}
```

```text
rss          51.8 MB
heapTotal    6.1 MB
heapUsed     4.3 MB
external     1.6 MB
arrayBuffers 0.0 MB
```

- **rss** (Resident Set Size): all memory the operating system has given the process, including Node itself, native code and the heap. This is what your hosting dashboard shows.
- **heapTotal**: the size of the V8 heap right now.
- **heapUsed**: the part of the heap actually holding objects. **Watch this one for leaks.**
- **external**: memory used by C++ objects tied to JavaScript objects, such as buffers.
- **arrayBuffers**: memory for `ArrayBuffer` and `Buffer` data (included in `external`).

`process.memoryUsage.rss()` returns just the RSS and is cheaper to call often.

### The heap limit

V8 will not let the heap grow forever. When the old generation hits its limit, Node crashes with `JavaScript heap out of memory`. Check the limit with `node:v8`:

```javascript
import v8 from 'node:v8';

const { heap_size_limit, used_heap_size } = v8.getHeapStatistics();
console.log((heap_size_limit / 1024 / 1024).toFixed(0), 'MB limit');
```

The default depends on your machine's memory. Raise it with a flag (the number is in megabytes):

```bash
node --max-old-space-size=4096 app.js
```

> **Note:** Raising the limit is fine when your app genuinely needs more memory. It does not fix a leak. A leak simply takes longer to crash.

## What is a memory leak?

A **memory leak** is memory that is still reachable but that your program will never use again. The GC cannot help, because someone still holds the key.

The sign is `heapUsed` that keeps climbing over hours and never comes back down, even when traffic is quiet. Memory that rises and then **levels off** is usually just a warm cache, not a leak.

### Leak 1: an unbounded cache or list

```javascript
// leaky: this array lives forever and only grows
const recentRequests = [];

function handleRequest(req) {
  recentRequests.push({ url: req.url, at: Date.now(), headers: req.headers });
}
```

Fix: put a limit on it.

```javascript
const MAX = 1000;
const recentRequests = [];

function handleRequest(req) {
  recentRequests.push({ url: req.url, at: Date.now() });
  if (recentRequests.length > MAX) recentRequests.shift(); // drop the oldest
}
```

Module-level `Map`s used as caches are the most common leak in Node servers. [The Caching Strategies lesson](/courses/nodejs/caching-strategies) shows how to build caches with size limits and expiry times.

### Leak 2: event listeners that are never removed

```javascript
import { EventEmitter } from 'node:events';
const bus = new EventEmitter();

function onConnect(socket) {
  // a new listener for every connection, never removed
  bus.on('price-update', (price) => socket.write(String(price)));
}
```

Each listener keeps its `socket` alive, even after the client disconnects. Node warns you when more than ten listeners pile up on one event:

```text
(node:2268) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 price-update listeners added to [EventEmitter]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
```

Fix: remove the listener when you are done.

```javascript
function onConnect(socket) {
  const send = (price) => socket.write(String(price));
  bus.on('price-update', send);
  socket.on('close', () => bus.off('price-update', send));
}
```

> **Tip:** Do not silence the warning with `setMaxListeners(0)` until you are sure the listeners are cleaned up. The warning is often your first leak alert.

### Leak 3: timers that never stop

```javascript
function startPolling(user) {
  setInterval(() => refresh(user), 5000); // runs forever, holds user forever
}
```

An interval keeps its callback, and everything the callback uses, alive until you clear it:

```javascript
function startPolling(user) {
  const timer = setInterval(() => refresh(user), 5000);
  return () => clearInterval(timer); // give the caller a way to stop it
}
```

### Leak 4: closures holding big data

A **closure** is a function that remembers the variables around it. If it outlives the work, so does everything it remembers:

```javascript
function makeHandler() {
  const hugeReport = new Array(1_000_000).fill('row');
  const total = hugeReport.length;
  return () => total; // only uses total
}
```

Modern V8 usually keeps only the variables a closure actually uses, but when several closures share one scope they may keep each other's data alive. Copy what you need into small variables, as with `total` here.

## Weak references

Sometimes you want to attach data to an object **without** keeping that object alive. JavaScript has tools for that.

A **WeakMap** holds its keys weakly. When the key object is garbage collected, its entry disappears too:

```javascript
const metadata = new WeakMap();

function track(request) {
  metadata.set(request, { startedAt: performance.now() });
}
// when a request object is no longer used anywhere else,
// its metadata entry is cleaned up automatically
```

A **WeakRef** points to an object without stopping the GC from collecting it. A **FinalizationRegistry** lets you run a callback some time after an object has been collected:

```javascript
// weak.mjs (run with: node --expose-gc weak.mjs)
const registry = new FinalizationRegistry((label) => console.log('cleaned up:', label));

let big = { data: new Array(1e6).fill(0) };
const ref = new WeakRef(big);
registry.register(big, 'big object');

console.log('alive?', ref.deref() !== undefined); // true
big = null;                                        // drop the only strong reference

await new Promise((resolve) => setTimeout(resolve, 0));
globalThis.gc();                                   // force a GC (testing only!)
await new Promise((resolve) => setTimeout(resolve, 50));
console.log('after GC:', ref.deref());
```

```text
alive? true
cleaned up: big object
after GC: undefined
```

`--expose-gc` adds a global `gc()` function. Use it only in experiments and tests, never in production code. And never rely on finalisers for important work: the specification does not promise when, or even whether, they run.

## Hunting a leak, step by step

1. **Confirm it.** Log `process.memoryUsage().heapUsed` every minute, or watch your monitoring. Look for growth that never levels off.
2. **Reproduce it.** Run the app locally and send it repeated traffic for the code path you suspect.
3. **Take three heap snapshots.** Take one, send traffic, take another, send more traffic, take a third. The [Reports, Heap Snapshots and Profiling lesson](/courses/nodejs/diagnostics-and-profiling) shows how (`v8.writeHeapSnapshot()`).
4. **Compare.** Load them in Chrome DevTools' Memory tab. Choose the third snapshot and the **Comparison** view against the first. Object types whose count keeps rising are your suspects.
5. **Follow the retainers.** Click a suspect object. The **Retainers** panel shows the chain of references from a root to that object. Somewhere along that chain is the array, map, listener or timer that should have let go.
6. **Fix and verify.** Repeat the same test and confirm `heapUsed` now levels off.

> **Tip:** If production crashes with out-of-memory errors that you cannot reproduce, start Node with `--heapsnapshot-near-heap-limit=1`. It writes a snapshot just before the crash, so the evidence survives.

## Common mistakes

**Watching RSS instead of heapUsed.** RSS includes memory the process has reserved but not handed back to the operating system. It can stay high after a spike without any leak. `heapUsed` tells you about your JavaScript objects.

**Calling `gc()` in production.** Forced collections are slow, pause everything, and hide the real problem.

**Calling it a leak too early.** Memory grows as caches warm up and code gets compiled. Wait for it to level off, then judge.

**Raising `--max-old-space-size` and moving on.** That buys time, not a fix.

## Quick recap

- The GC frees objects that cannot be reached from roots; anything still referenced stays.
- New objects live in the young generation (fast minor GCs); survivors move to the old generation (slower major GCs).
- `process.memoryUsage().heapUsed` is the number to watch for leaks; RSS is the total process memory.
- Common leaks: unbounded caches, listeners never removed, timers never cleared and closures holding big data.
- `WeakMap`, `WeakRef` and `FinalizationRegistry` attach data without keeping objects alive.
- Hunt leaks with three heap snapshots, the Comparison view and the Retainers panel.

<code id="code-content" class="language-javascript">
// memory-demo.mjs: run with  node --expose-gc memory-demo.mjs  for steadier numbers
import { EventEmitter } from 'node:events';
const mb = (bytes) =&gt; (bytes / 1024 / 1024).toFixed(1) + ' MB';
function heapAfterGc() {
  globalThis.gc?.(); // only exists with --expose-gc
  return process.memoryUsage().heapUsed;
}
// A leaky "recent requests" log versus a bounded one
const leakyLog = [];
const boundedLog = [];
const MAX_ENTRIES = 1000;
function handleRequest(id) {
  const entry = { id, url: `/orders/${id}`, payload: 'x'.repeat(200) };
  leakyLog.push(entry);
  boundedLog.push({ ...entry });
  if (boundedLog.length &gt; MAX_ENTRIES) boundedLog.shift();
}
// Simulate traffic in rounds and watch heapUsed
const baseline = heapAfterGc();
for (let round = 1; round &lt;= 4; round++) {
  for (let i = 0; i &lt; 20_000; i++) handleRequest(round * 100_000 + i);
  console.log(`round ${round}: heapUsed ${mb(heapAfterGc())}, leaky=${leakyLog.length}, bounded=${boundedLog.length}`);
}
// Fix the leak: drop the unbounded array and measure again
leakyLog.length = 0;
console.log('after clearing the leaky log:', mb(heapAfterGc()), '(baseline', mb(baseline) + ')');
// Listener hygiene: add and remove listeners in pairs
const bus = new EventEmitter();
function connect(clientName) {
  const send = (price) =&gt; `${clientName} got ${price}`; // would write to the client
  bus.on('price', send);
  return () =&gt; bus.off('price', send); // the cleanup function
}
const disconnects = Array.from({ length: 5 }, (_, i) =&gt; connect(`client-${i}`));
console.log('listeners while connected:', bus.listenerCount('price'));
disconnects.forEach((disconnect) =&gt; disconnect());
console.log('listeners after disconnect:', bus.listenerCount('price'));
// WeakMap: metadata disappears with the object it describes
const meta = new WeakMap();
let request = { url: '/books' };
meta.set(request, { startedAt: performance.now() });
console.log('has metadata:', meta.has(request));
request = null; // the entry can now be collected along with the object
// Heap limit for this process
const { heap_size_limit } = (await import('node:v8')).default.getHeapStatistics();
console.log('heap limit:', mb(heap_size_limit));
</code></pre>

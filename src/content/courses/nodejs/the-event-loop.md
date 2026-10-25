---
publishDate: 2026-10-25T09:40
title: The Event Loop and Its Phases
slug: the-event-loop
metadescription: Learn how Node.js runs many tasks on one thread. The call stack, libuv, the thread pool, the six event loop phases and why blocking code hurts.
updateDate: 2026-10-25T09:40
author: ['bishal-biswas']
level: 2
tags: ['event-loop', 'async', 'libuv']
course: nodejs
---

## One cook, many orders

Picture a small café with a single cook. Orders keep coming in. The cook does not stand by the oven for 20 minutes waiting for one pizza. They put it in, set a timer, and start chopping salad for the next order. When the oven beeps, they come back to it.

Node.js works the same way. Your JavaScript runs on **one thread** (one cook). Slow jobs like reading files or waiting for the network are handed off. When a job finishes, its callback is put on a list, and Node runs it when it is free.

The thing that keeps checking "what is ready to run next?" is called the **event loop**.

## Why you should care

Once you understand the event loop you can:

- Predict the order your code runs in.
- Spot code that freezes your whole server.
- Read error reports and performance advice without feeling lost.

You do not need to memorise every detail. You need a clear picture, and this lesson gives you one.

## Synchronous code runs first

**Synchronous** code runs line by line, and each line finishes before the next starts. **Asynchronous** code starts a job now and finishes it later.

```javascript
// order.mjs
import { readFile } from 'node:fs';

console.log('1. Start reading');

readFile(import.meta.filename, 'utf8', (err, text) => {
  console.log('3. File read, length:', text.length);
});

console.log('2. Carry on with other work');
```

```text
1. Start reading
2. Carry on with other work
3. File read, length: 239
```

`readFile` does not wait. It asks for the file, registers the callback, and returns straight away. Node keeps running your script. Only when the script is finished and the file is ready does the callback run.

> **Note:** `import.meta.filename` is the full path of the current file. You met it in the Globals lesson.

## The call stack

The **call stack** is the list of functions that are running right now. When you call a function it goes on top of the stack. When it returns it comes off.

The rule that explains almost everything is this:

> A callback can only run when the call stack is **empty**.

So even if the file was read in one millisecond, its callback still waits until every line of your script has finished.

## Who does the slow work? libuv and the thread pool

If JavaScript has one thread, who reads the file? The answer is **libuv**, a C library built into Node. It talks to the operating system for you.

- **Network work** (HTTP, TCP sockets) is handled by the operating system itself. It can watch thousands of connections at once without extra threads.
- **Some work the OS cannot do in the background** (most file system calls, `dns.lookup`, some `crypto` and `zlib` functions) goes to the **thread pool**: a small group of helper threads inside libuv. By default there are **4**.

You can see the thread pool limit with a slow hashing function:

```javascript
// threadpool.mjs
import { pbkdf2 } from 'node:crypto';

const start = Date.now();

for (let i = 1; i <= 6; i++) {
  pbkdf2('secret', 'salt', 1_000_000, 64, 'sha512', () => {
    console.log(`Hash ${i} done after ${Date.now() - start} ms`);
  });
}
```

```text
Hash 3 done after 569 ms
Hash 4 done after 632 ms
Hash 1 done after 659 ms
Hash 2 done after 704 ms
Hash 5 done after 1077 ms
Hash 6 done after 1121 ms
```

Your numbers will differ, but the pattern is the same: four hashes finish together, then the last two take another round. Only four helpers were available.

You can change the size with the `UV_THREADPOOL_SIZE` environment variable:

```bash
UV_THREADPOOL_SIZE=6 node threadpool.mjs
```

> **Tip:** Your own JavaScript never runs on the thread pool. The helpers do the slow C work, then hand the result back to the single JavaScript thread.

## The six phases of the event loop

The event loop goes round and round. Each trip round is called a **tick** (or an iteration). On each trip it visits the same phases in the same order. Each phase has its own queue of callbacks.

```text
   ┌───────────────────────────┐
┌─>│          timers           │  setTimeout and setInterval callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  a few system callbacks delayed from last trip
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  used inside Node only
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  wait for I/O, run I/O callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate callbacks
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  'close' events, e.g. socket.on('close')
   └───────────────────────────┘
```

Here is each phase in plain words:

1. **Timers**: runs callbacks from `setTimeout` and `setInterval` whose time is up.
2. **Pending callbacks**: runs a few system-level callbacks, such as some network errors, that were put off from the previous trip.
3. **Idle, prepare**: internal housekeeping. You never use it directly.
4. **Poll**: the busiest phase. It collects finished I/O (a file was read, a request arrived) and runs those callbacks. If there is nothing else to do, the loop **waits here** for new I/O.
5. **Check**: runs `setImmediate` callbacks. It always comes straight after poll.
6. **Close callbacks**: runs `'close'` handlers, for example when a socket is destroyed.

Then it goes back to timers and starts again.

### When does the poll phase wait?

The poll phase is smart about waiting:

- If `setImmediate` callbacks are queued, it does not wait. It moves on to check.
- If a timer is due soon, it waits only until that timer is ready.
- If nothing at all is scheduled, the loop ends and the process exits.

## Microtasks: the queue that jumps ahead

There are two more queues that are not phases at all:

- The **nextTick queue**, filled by `process.nextTick()`.
- The **promise microtask queue**, filled by `.then()`, `await` and `queueMicrotask()`.

These run **as soon as the current piece of JavaScript finishes**, before the loop moves on. That happens after your main script, and again after every single timer, I/O or immediate callback.

```javascript
// micro.mjs
setTimeout(() => console.log('3. timer'), 0);
Promise.resolve().then(() => console.log('2. promise'));
console.log('1. sync');
```

```text
1. sync
2. promise
3. timer
```

The promise callback did not have to wait for the next phase. It ran the moment the call stack was empty.

You will look closely at `process.nextTick`, `setImmediate` and their exact order in [the Timers lesson](/courses/nodejs/timers-and-microtasks).

## A predictable order inside an I/O callback

Inside an I/O callback you are in the poll phase. The next phase is check, so `setImmediate` always runs before a zero-millisecond timer:

```javascript
// phases.mjs
import { readFile } from 'node:fs';

readFile(import.meta.filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});
```

```text
immediate
timeout
```

This order is guaranteed. The timer has to wait for the loop to come back round to the timers phase.

> **Note:** At the top level of a script (not inside a callback), `setTimeout(fn, 0)` and `setImmediate(fn)` can come out in **either order**. It depends on how fast your machine starts the loop. Do not rely on it.

## Blocking the event loop

Because there is one JavaScript thread, a long piece of synchronous code stops **everything**. No timers, no requests, no file callbacks. This is called **blocking the event loop**.

```javascript
// blocking.mjs
const start = Date.now();

setTimeout(() => {
  console.log(`Timer fired after ${Date.now() - start} ms`);
}, 100);

// Busy work for 1 second: the loop cannot move on
while (Date.now() - start < 1000) {}

console.log('Busy loop finished');
```

```text
Busy loop finished
Timer fired after 1002 ms
```

The timer asked for 100 ms but waited a whole second. In a web server, every visitor would wait that second too.

Common ways people block the loop by accident:

- Big loops over huge arrays.
- `JSON.parse` or `JSON.stringify` on very large data.
- The `Sync` file functions such as `readFileSync` inside a request handler.
- Heavy maths or image work.

For heavy CPU work you will later use worker threads, covered in [the Worker Threads lesson](/courses/nodejs/worker-threads).

## When does a Node program exit?

Node keeps the process alive while the event loop has something to wait for: a timer, an open server, a pending file read. When nothing is left, the process exits by itself.

You can tell Node that a timer should not keep the process alive by calling `unref()` on it:

```javascript
// unref.mjs
const timer = setInterval(() => console.log('tick'), 1000);
timer.unref();
console.log('Script done');
```

```text
Script done
```

Without `unref()`, this would print `tick` every second forever. With it, Node sees nothing important left and exits.

## Common mistakes

### Expecting a callback to run "now"

```javascript
// Wrong: 'data' is still undefined when we log it
import { readFile } from 'node:fs';

let data;
readFile('notes.txt', 'utf8', (err, text) => {
  data = text;
});
console.log(data); // prints: undefined
```

The callback runs later, after the script ends. Use the value **inside** the callback, or better, use `await` with `node:fs/promises`:

```javascript
// Right
import { readFile } from 'node:fs/promises';

const data = await readFile('notes.txt', 'utf8');
console.log(data);
```

### Using Sync functions in a server

`readFileSync` is fine in a one-off script. Inside a server it blocks every other visitor while the disk works. Use the promise version instead.

## Quick recap

- Node runs your JavaScript on **one thread**. The **event loop** decides what runs next.
- Slow work goes to the operating system or to libuv's **thread pool** (4 threads by default).
- A callback only runs when the **call stack is empty**.
- The loop has six phases: **timers, pending callbacks, idle/prepare, poll, check, close callbacks**.
- **Microtasks** (promises and `process.nextTick`) run straight after the current code, before the loop moves on.
- Inside an I/O callback, `setImmediate` always beats `setTimeout(fn, 0)`.
- Long synchronous work **blocks** the loop and delays everything.
- The process exits when nothing is left to wait for. `unref()` lets a timer not count.

<code id="code-content" class="language-javascript">
// event-loop.mjs: watch the event loop at work
import { readFile } from 'node:fs';
const start = Date.now();
const elapsed = () =&gt; `${Date.now() - start} ms`;
console.log('1. Sync code always runs first');
// A promise callback is a microtask: it runs as soon as the sync code ends
Promise.resolve().then(() =&gt; console.log('2. Promise callback (microtask)'));
// Slow I/O is handed off; its callback runs later, in the poll phase
readFile(import.meta.filename, 'utf8', (err, text) =&gt; {
  if (err) throw err;
  console.log(`3. Poll phase: read ${text.length} characters`);
  // Inside an I/O callback, check (setImmediate) always beats timers
  setTimeout(() =&gt; console.log('6. Timers phase: setTimeout 0'), 0);
  setImmediate(() =&gt; {
    console.log('4. Check phase: setImmediate');
    blockingDemo();
  });
});
// ---
// Blocking the loop delays everything else, even a "100 ms" timer
function blockingDemo() {
  const t0 = Date.now();
  setTimeout(() =&gt; {
    console.log(`7. Timer asked for 100 ms, waited ${Date.now() - t0} ms`);
  }, 100);
  while (Date.now() - t0 &lt; 500) {
    // busy work: the single thread can do nothing else
  }
  console.log('5. Busy loop finished at', elapsed());
}
// The process exits by itself once nothing is left to wait for
process.on('exit', () =&gt; console.log('8. Nothing left to do, exiting'));
</code></pre>

---
publishDate: 2026-10-25T09:55
title: Timers, setImmediate and process.nextTick
slug: timers-and-microtasks
metadescription: Schedule code with setTimeout, setInterval, setImmediate, process.nextTick and queueMicrotask, learn their real order, and use node:timers/promises.
updateDate: 2026-10-25T09:55
author: ['bishal-biswas']
level: 2
tags: ['timers', 'event-loop', 'microtasks']
course: nodejs
---

## Ways to say "do this later"

Think of a to-do list on the fridge with different kinds of notes:

- "Do this in 10 minutes" (a **timer**).
- "Do this as soon as you finish the current round of chores" (an **immediate**).
- "Do this before you do anything else, even before checking the door" (a **microtask**).

Node gives you a function for each kind of "later". They look similar, but they run at very different moments. Knowing the difference helps you predict your program's output and avoid strange bugs.

This lesson builds on [the Event Loop lesson](/courses/nodejs/the-event-loop). Keep its picture of the phases in mind: timers, poll (I/O), check.

## setTimeout: run once after a delay

`setTimeout(callback, ms)` runs the callback once, after **at least** `ms` milliseconds.

```javascript
// timeout.mjs
setTimeout(() => {
  console.log('Tea is ready');
}, 2000);

console.log('Kettle on');
```

```text
Kettle on
Tea is ready
```

Any extra arguments are passed to the callback:

```javascript
setTimeout((name, food) => {
  console.log(`Hi ${name}, your ${food} is ready`);
}, 100, 'Asha', 'pizza');
// prints: Hi Asha, your pizza is ready
```

### Cancelling a timeout

`setTimeout` returns a **Timeout object**. Pass it to `clearTimeout` to cancel:

```javascript
const reminder = setTimeout(() => console.log('Call Ravi'), 5000);
clearTimeout(reminder); // nothing is printed
```

## setInterval: run again and again

`setInterval(callback, ms)` runs the callback every `ms` milliseconds until you stop it with `clearInterval`.

```javascript
// interval.mjs
let count = 0;

const timer = setInterval(() => {
  count++;
  console.log('tick', count);
  if (count === 3) clearInterval(timer);
}, 200);
```

```text
tick 1
tick 2
tick 3
```

> **Note:** If you never clear an interval, your program never exits. Node keeps running as long as an active timer exists.

## The Timeout object: ref, unref and refresh

In Node (unlike the browser) the value returned by `setTimeout` and `setInterval` is an object with useful methods:

- `timer.unref()`: "do not keep the process alive just for me".
- `timer.ref()`: undo `unref()`.
- `timer.hasRef()`: `true` if the timer keeps the process alive.
- `timer.refresh()`: restart the countdown with the same delay, without making a new timer.

`refresh()` is perfect for "save 300 ms after the user stops typing":

```javascript
// refresh.mjs
const start = Date.now();
const save = setTimeout(() => {
  console.log(`Saved at ${Date.now() - start} ms`);
}, 300);

// The user types again at 200 ms, so restart the countdown
setTimeout(() => save.refresh(), 200);
```

```text
Saved at 516 ms
```

## setImmediate: run after the current I/O

`setImmediate(callback)` runs the callback in the **check phase**, which comes right after the poll (I/O) phase. Think of it as "when this round of the loop is done with I/O".

The name is confusing: it is not truly immediate. It is "on the next pass through the check phase".

`clearImmediate(id)` cancels it.

### setImmediate or setTimeout(fn, 0)?

At the top level of a script, these two can run in either order. Inside an I/O callback, `setImmediate` always runs first, because check comes straight after poll. If you mean "after the current I/O", use `setImmediate`.

## Microtasks: process.nextTick and promises

A **microtask** is a tiny job that runs as soon as the current JavaScript finishes, **before** the event loop moves to its next phase or callback. Node has two microtask queues:

1. The **nextTick queue**, filled by `process.nextTick(callback)`.
2. The **promise queue**, filled by `.then()`, `await` and `queueMicrotask(callback)`.

`queueMicrotask` is the standard web function for adding a microtask without making a promise. It goes in the same queue as promise callbacks.

## The order, all together

Here is every kind of "later" scheduled from inside an I/O callback. Run it as many times as you like; the order never changes:

```javascript
// order.mjs
import { readFile } from 'node:fs';

readFile(import.meta.filename, () => {
  console.log('1. I/O callback starts');
  setTimeout(() => console.log('7. setTimeout'), 0);
  setImmediate(() => console.log('6. setImmediate'));
  Promise.resolve().then(() => console.log('4. promise .then'));
  queueMicrotask(() => console.log('5. queueMicrotask'));
  process.nextTick(() => console.log('3. process.nextTick'));
  console.log('2. I/O callback ends');
});
```

```text
1. I/O callback starts
2. I/O callback ends
3. process.nextTick
4. promise .then
5. queueMicrotask
6. setImmediate
7. setTimeout
```

Read it like this:

1. Synchronous code in the callback runs to the end.
2. The **nextTick queue** is emptied.
3. The **promise queue** is emptied (`.then` and `queueMicrotask`, in the order they were added).
4. The loop moves on to **check**: `setImmediate`.
5. The loop comes round to **timers**: `setTimeout`.

Microtasks also run between each callback in a phase, not just between phases. If one `setImmediate` callback schedules a `process.nextTick`, that tick runs before the next `setImmediate` callback.

## The ES module surprise

Here is a short script run as an ES module (`.mjs`):

```javascript
// top-level.mjs
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
console.log('sync');
```

```text
sync
promise
nextTick
```

The promise ran first! Now save the exact same code as `top-level.cjs` (CommonJS) and run it:

```text
sync
nextTick
promise
```

Why? ES modules are loaded asynchronously, so the top-level code of an ES module itself runs as part of a promise job. When it finishes, Node is already working through the promise queue, so your `.then` runs before it gets back to the nextTick queue. The same happens in any code that runs right after an `await`.

The rule "nextTick before promises" holds when the code is run by the event loop, such as inside a timer, I/O or event callback, which is where most real code lives.

> **Tip:** Do not write code whose correctness depends on whether `nextTick` or a promise runs first. If order matters, chain it explicitly with `await`.

## Starving the event loop

Because microtasks run before the loop can move on, adding them forever blocks everything else. This is called **starvation**.

```javascript
// Wrong: the timer never runs, the program hangs
function spin() {
  process.nextTick(spin); // always adds another tick
}
setTimeout(() => console.log('timer'), 10);
spin();
```

Each nextTick schedules another, so the loop never reaches the timers phase. The same happens with a never-ending chain of promises.

`setImmediate` does not have this problem. Immediates added during the check phase wait for the **next** loop, so timers and I/O get their turn:

```javascript
// Right: the timer still gets a turn
let count = 0;
function spin() {
  count++;
  if (count < 1_000_000) setImmediate(spin);
}
setTimeout(() => {
  console.log('timer ran, spins so far:', count > 0);
  process.exit();
}, 10);
spin();
```

```text
timer ran, spins so far: true
```

> **Tip:** To split a long job into chunks so the server stays responsive, schedule each chunk with `setImmediate`, not `process.nextTick`.

### When is process.nextTick useful?

Its main use is inside libraries: making a callback always run asynchronously, or emitting an event just after a constructor returns so the caller has time to attach listeners. In your own app code, `queueMicrotask` or plain promises are usually clearer.

## Promise-based timers: node:timers/promises

Wrapping `setTimeout` in a promise by hand is so common that Node ships ready-made versions:

```javascript
// sleep.mjs
import { setTimeout as sleep, setImmediate as immediate } from 'node:timers/promises';

const value = await sleep(100, 'hello'); // wait 100 ms, then resolve with 'hello'
console.log(value); // prints: hello

console.log(await immediate('now')); // prints: now
```

We rename `setTimeout` to `sleep` on import so it does not clash with the global `setTimeout`.

### An interval you can loop over

`setInterval` from `node:timers/promises` returns an **async iterator**: something you loop over with `for await`. Each loop waits for the next tick. Breaking out of the loop stops the interval for you.

```javascript
// every.mjs
import { setInterval as every } from 'node:timers/promises';

let round = 0;
for await (const _ of every(100)) {
  round++;
  console.log('round', round);
  if (round === 3) break;
}
console.log('done');
```

```text
round 1
round 2
round 3
done
```

### Cancelling with a signal

All three accept an options object with a `signal`, as you saw in [the Promise Combinators lesson](/courses/nodejs/promise-combinators-and-abortsignal):

```javascript
try {
  await sleep(1000, null, { signal: AbortSignal.timeout(100) });
} catch (err) {
  console.log(err.name); // prints: AbortError
}
```

## Quick reference

| Function | When it runs | Cancel with |
| --- | --- | --- |
| `process.nextTick(fn)` | Right after the current code, before promises | (cannot) |
| `queueMicrotask(fn)`, `.then(fn)` | Right after the current code and nextTicks | (cannot) |
| `setImmediate(fn)` | Check phase, after I/O | `clearImmediate` |
| `setTimeout(fn, ms)` | Timers phase, after at least `ms` | `clearTimeout` |
| `setInterval(fn, ms)` | Timers phase, every `ms` | `clearInterval` |

## Quick recap

- `setTimeout` runs once after **at least** the delay. `setInterval` repeats until cleared.
- Node timers return objects with `unref()`, `ref()`, `hasRef()` and `refresh()`.
- `setImmediate` runs in the check phase, straight after I/O.
- Microtasks run before the loop moves on: first the **nextTick** queue, then the **promise** queue (`.then`, `await`, `queueMicrotask`).
- At the top level of an ES module, promises can run before `nextTick`. Do not depend on that order.
- Endless `nextTick` or promise chains **starve** the loop. Use `setImmediate` to split long work.
- `node:timers/promises` gives you `sleep`-style timers, a `for await` interval, and signal support.

<code id="code-content" class="language-javascript">
// timers.mjs: who runs first?
import { readFile } from 'node:fs';
import { setTimeout as sleep, setInterval as every } from 'node:timers/promises';
// Inside an I/O callback the order below is always the same
readFile(import.meta.filename, async () =&gt; {
  console.log('1. I/O callback starts');
  setTimeout(() =&gt; console.log('7. setTimeout 0 (timers phase, next loop)'), 0);
  setImmediate(() =&gt; console.log('6. setImmediate (check phase)'));
  Promise.resolve().then(() =&gt; console.log('4. promise .then (microtask)'));
  queueMicrotask(() =&gt; console.log('5. queueMicrotask (microtask)'));
  process.nextTick(() =&gt; console.log('3. process.nextTick (runs first)'));
  console.log('2. I/O callback ends');
  // ---
  await sleep(50); // let the lines above finish printing
  // Timer objects: pass arguments, refresh, unref
  const start = Date.now();
  const save = setTimeout((name) =&gt; {
    console.log(`8. Saved ${name}'s note after ${Date.now() - start} ms`);
  }, 100, 'Asha');
  setTimeout(() =&gt; save.refresh(), 60); // restart the 100 ms countdown
  const heartbeat = setInterval(() =&gt; console.log('never printed'), 10_000);
  heartbeat.unref(); // this timer will not keep the process alive
  // ---
  // Promise-based timers from node:timers/promises
  const value = await sleep(200, 'ready');
  console.log('9. sleep resolved with:', value);
  let round = 0;
  for await (const _ of every(50)) {
    round++;
    console.log(`10. interval round ${round}`);
    if (round === 3) break; // breaking out clears the interval
  }
  // Cancel a wait with a time limit
  try {
    await sleep(1000, null, { signal: AbortSignal.timeout(100) });
  } catch (err) {
    console.log('11. long sleep cancelled:', err.name);
  }
});
</code></pre>

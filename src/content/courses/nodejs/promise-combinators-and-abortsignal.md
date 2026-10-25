---
publishDate: 2026-10-25T09:50
title: Promise Combinators and AbortSignal
slug: promise-combinators-and-abortsignal
metadescription: Run async work together with Promise.all, allSettled, race and any, then cancel it cleanly with AbortController, AbortSignal.timeout and AbortSignal.any.
updateDate: 2026-10-25T09:50
author: ['bishal-biswas']
level: 2
tags: ['async', 'promises', 'abortsignal']
course: nodejs
---

## Doing several things at once, and stopping them

Imagine you send three friends to three shops to find a birthday cake. You might want to:

- Wait until **all** of them come back with something.
- Hear a **report** from each, even the ones who found nothing.
- Go with whoever replies **first**.
- Go with the first one who actually **found** a cake.

And sometimes you want to phone them all and say "stop, I found one". That is **cancelling**.

**Promise combinators** are the first part: four built-in functions that combine several promises into one. **AbortController** and **AbortSignal** are the second part: the standard way to cancel async work in Node.

## A helper for the examples

All examples use this small fake task. It waits a while, then succeeds or fails:

```javascript
// task.mjs
import { setTimeout as sleep } from 'node:timers/promises';

function task(name, ms, fail = false) {
  return sleep(ms).then(() => {
    if (fail) throw new Error(`${name} failed`);
    return name;
  });
}
```

`sleep` from `node:timers/promises` returns a promise that fulfils after `ms` milliseconds. You will look at it closely in [the Timers lesson](/courses/nodejs/timers-and-microtasks).

## Promise.all: wait for everything

`Promise.all` takes an array of promises. It fulfils with an array of results, **in the same order you passed them**, not in the order they finished.

```javascript
const results = await Promise.all([task('A', 300), task('B', 100)]);
console.log(results); // prints: [ 'A', 'B' ]
```

If **any** promise rejects, `Promise.all` rejects straight away with that error:

```javascript
try {
  await Promise.all([task('A', 300), task('B', 100, true)]);
} catch (err) {
  console.log('all:', err.message); // prints: all: B failed
}
```

Use it when you need every result, such as loading a user, their orders and their settings before showing a page.

> **Note:** When `Promise.all` rejects, the other tasks **keep running**. Promises cannot be stopped from the outside. Later in this lesson you will see how a signal can stop them.

## Promise.allSettled: a report on each one

`Promise.allSettled` waits for every promise and **never rejects**. You get one object per promise:

```javascript
const results = await Promise.allSettled([task('A', 300), task('B', 100, true)]);

for (const r of results) {
  if (r.status === 'fulfilled') console.log('OK:', r.value);
  else console.log('Failed:', r.reason.message);
}
```

```text
OK: A
Failed: B failed
```

Each object has `status` (`'fulfilled'` or `'rejected'`) plus either `value` or `reason`. Use it when partial results are still useful, like sending emails to 100 people and reporting which ones failed.

## Promise.race: the first to finish

`Promise.race` settles with the **first** promise to settle, whether it succeeded or failed:

```javascript
const winner = await Promise.race([task('A', 300), task('B', 100)]);
console.log(winner); // prints: B
```

If the fastest one fails, the race rejects. Race was the classic way to add a timeout, but `AbortSignal.timeout` (below) is now cleaner.

## Promise.any: the first success

`Promise.any` fulfils with the first promise that **succeeds**. Failures are ignored, unless they all fail:

```javascript
const first = await Promise.any([task('A', 300), task('B', 100, true)]);
console.log(first); // prints: A
```

B failed first, but `any` waited for A. If every promise fails, you get an **AggregateError**, which holds all the errors in an `errors` array:

```javascript
try {
  await Promise.any([task('A', 300, true), task('B', 100, true)]);
} catch (err) {
  console.log(err.name);                          // prints: AggregateError
  console.log(err.errors.map((e) => e.message));  // prints: [ 'A failed', 'B failed' ]
}
```

Use it when you can ask several sources (mirrors, caches) and any answer will do.

## Cancelling with AbortController

An **AbortController** is a remote control with one button: abort. It has a `signal` property, an **AbortSignal**, which you pass to the work you might want to cancel.

```javascript
// controller.mjs
const controller = new AbortController();
const { signal } = controller;

signal.addEventListener('abort', () => {
  console.log('Abort event! reason:', signal.reason.message);
});

console.log(signal.aborted); // prints: false
controller.abort();          // prints: Abort event! reason: This operation was aborted
console.log(signal.aborted); // prints: true
```

The signal tells you three things:

- `signal.aborted`: `true` once abort was called.
- `signal.reason`: why. By default an `AbortError`. You can pass your own: `controller.abort(new Error('User clicked cancel'))`.
- An `'abort'` event you can listen for.

`signal.throwIfAborted()` throws the reason if the signal is already aborted. It is handy at the start of a function.

### Many Node APIs accept a signal

You rarely listen for the event yourself. You pass the signal to an API and it stops for you. These all accept `{ signal }`:

- `fetch(url, { signal })`
- `setTimeout` and `setInterval` from `node:timers/promises`
- `readFile` and `writeFile` from `node:fs/promises`
- `events.once` and `events.on` (see [the EventEmitter lesson](/courses/nodejs/eventemitter))
- `pipeline` from `node:stream/promises`
- `child_process.spawn` and friends

```javascript
// cancel-sleep.mjs
import { setTimeout as sleep } from 'node:timers/promises';

const controller = new AbortController();
setTimeout(() => controller.abort(), 200); // press the button after 200 ms

try {
  await sleep(1000, 'done', { signal: controller.signal });
  console.log('finished');
} catch (err) {
  console.log(err.name, '-', err.message);
}
```

```text
AbortError - The operation was aborted
```

The one-second wait stopped after 200 ms, and the promise rejected with an `AbortError`.

## AbortSignal.timeout: a time limit in one line

Most of the time you want "give up after N milliseconds". `AbortSignal.timeout(ms)` gives you a signal that aborts itself:

```javascript
// timeout.mjs
try {
  const res = await fetch('https://example.com', { signal: AbortSignal.timeout(1) });
} catch (err) {
  console.log(err.name, '-', err.message);
}
```

```text
TimeoutError - The operation was aborted due to timeout
```

The signal's reason is a `TimeoutError`, so you can tell a timeout apart from a manual cancel. Some APIs, like `fetch`, reject with that reason directly. Others, like `node:timers/promises`, reject with an `AbortError` and put the `TimeoutError` in `err.cause`.

> **Tip:** Always give network calls a time limit. A server that never answers would otherwise leave your code waiting forever.

> **Note:** The timer inside `AbortSignal.timeout` is **unref'd**: it does not keep the process alive by itself. If nothing else is pending (no open socket, no other timer), Node may exit before the timeout fires. In real apps there is nearly always something else running, so this rarely matters.

## AbortSignal.any: stop for any reason

Often there are two reasons to stop: the user cancels, or it takes too long. `AbortSignal.any([...])` makes one signal that aborts as soon as **any** of the signals you give it aborts:

```javascript
// any-signal.mjs
import { setTimeout as sleep } from 'node:timers/promises';

const cancelButton = new AbortController();
const signal = AbortSignal.any([cancelButton.signal, AbortSignal.timeout(5000)]);

setTimeout(() => cancelButton.abort(new Error('Cancelled by Asha')), 100);

try {
  await sleep(1000, null, { signal });
} catch (err) {
  console.log(err.name, '-', signal.reason.message);
}
```

```text
AbortError - Cancelled by Asha
```

The combined signal's `reason` is the reason of whichever signal fired first.

## Making your own function cancellable

Follow the same pattern as Node: accept an options object with a `signal`, check it at the start, and listen for `'abort'`.

```javascript
// count-sheep.mjs
function countSheep(total, { signal } = {}) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted(); // already cancelled? stop now

    let count = 0;
    const timer = setInterval(() => {
      count++;
      console.log(`${count} sheep`);
      if (count === total) {
        clearInterval(timer);
        resolve(count);
      }
    }, 100);

    signal?.addEventListener('abort', () => {
      clearInterval(timer);  // clean up
      reject(signal.reason); // reject with the reason
    }, { once: true });
  });
}

try {
  await countSheep(10, { signal: AbortSignal.timeout(350) });
} catch (err) {
  console.log('Stopped:', err.name);
}
```

```text
1 sheep
2 sheep
3 sheep
Stopped: TimeoutError
```

The `?.` means "only if a signal was passed", so the function still works without one.

## Common mistakes

### Thinking Promise.all stops the other tasks

```javascript
// Wrong: B fails, but A and C keep downloading
await Promise.all([download('A'), download('B'), download('C')]);
```

Share one controller and abort it when something fails:

```javascript
// Right
const group = new AbortController();
const { signal } = group;
try {
  await Promise.all([download('A', { signal }), download('B', { signal }), download('C', { signal })]);
} catch (err) {
  group.abort(); // tell the others to stop
  throw err;
}
```

### Swallowing the abort error

```javascript
// Wrong: hides real errors and cancels alike
try { await work({ signal }); } catch {}
```

Check the error name so you only ignore the cancels you expect:

```javascript
// Right
try {
  await work({ signal });
} catch (err) {
  if (err.name !== 'AbortError' && err.name !== 'TimeoutError') throw err;
  console.log('Cancelled, that is fine');
}
```

## Quick recap

- `Promise.all` gives every result or the first failure.
- `Promise.allSettled` never rejects and reports on each promise.
- `Promise.race` takes the first to settle. `Promise.any` takes the first success, or throws an `AggregateError`.
- Promises cannot be stopped from outside. Use an **AbortController** and pass its **signal**.
- Many Node APIs accept `{ signal }`: `fetch`, `node:timers/promises`, `node:fs/promises`, `events.once`, `pipeline`.
- `AbortSignal.timeout(ms)` adds a time limit. `AbortSignal.any([...])` combines signals.
- Make your own functions cancellable with `throwIfAborted()` and an `'abort'` listener.

<code id="code-content" class="language-javascript">
// combinators.mjs: run work together, and cancel it cleanly
import { setTimeout as sleep } from 'node:timers/promises';
// A fake slow download that can be cancelled with a signal
async function download(name, ms, { fail = false, signal } = {}) {
  await sleep(ms, undefined, { signal }); // rejects with AbortError if aborted
  if (fail) throw new Error(`${name} failed`);
  return name;
}
// all: every result, or the first failure
console.log('all:', await Promise.all([download('A', 200), download('B', 100)]));
// allSettled: a report on each one, never rejects
const report = await Promise.allSettled([download('A', 100), download('B', 50, { fail: true })]);
console.log('allSettled:', report.map((r) =&gt; r.status));
// race: the first to settle wins (success or failure)
console.log('race:', await Promise.race([download('slow', 300), download('fast', 50)]));
// any: the first success wins; fails only if all fail
console.log('any:', await Promise.any([download('broken', 50, { fail: true }), download('mirror', 150)]));
// ---
// AbortSignal.timeout: give up after a time limit
try {
  await download('huge file', 2000, { signal: AbortSignal.timeout(200) });
} catch (err) {
  console.log('timeout:', err.name, '| reason:', err.cause?.name);
}
// AbortSignal.any: stop on whichever comes first, a user cancel or a timeout
const cancelButton = new AbortController();
const signal = AbortSignal.any([cancelButton.signal, AbortSignal.timeout(5000)]);
setTimeout(() =&gt; cancelButton.abort(new Error('Asha clicked cancel')), 100);
try {
  await download('video', 1000, { signal });
} catch {
  console.log('any signal:', signal.reason.message);
}
// Cancel the siblings when one task in Promise.all fails
const group = new AbortController();
const jobs = [
  download('photo 1', 300, { signal: group.signal }),
  download('photo 2', 100, { fail: true, signal: group.signal }),
  download('photo 3', 300, { signal: group.signal }),
];
try {
  await Promise.all(jobs);
} catch (err) {
  group.abort(); // the other downloads stop instead of running on
  console.log('group:', err.message, '- others cancelled');
}
// photo 2 shows its own Error; photos 1 and 3 were aborted
const settled = await Promise.allSettled(jobs);
console.log('group results:', settled.map((r) =&gt; r.reason.name));
</code></pre>

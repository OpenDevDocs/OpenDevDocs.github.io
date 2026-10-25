---
publishDate: 2026-10-25T10:05
title: EventEmitter and the Observer Pattern
slug: eventemitter
metadescription: Build event-driven code with Node's EventEmitter. on, once, off and emit, the special error event, events.once and events.on with for await.
updateDate: 2026-10-25T10:05
author: ['bishal-biswas']
level: 2
tags: ['events', 'eventemitter', 'async']
course: nodejs
---

## Subscribe and get told

Think of a newsletter. You **subscribe** once. Whenever a new issue comes out, the publisher sends it to everyone on the list. The publisher does not need to know who you are or what you do with it.

That is the **observer pattern**: one object (the **subject**) keeps a list of interested parties (the **observers**) and notifies all of them when something happens.

In Node, this pattern is built in as the **EventEmitter** class. Servers, streams, child processes and many libraries are EventEmitters. When you write `server.on('request', ...)` or `stream.on('data', ...)`, you are subscribing to an EventEmitter.

## The basics: on and emit

- An **event** is a named signal, like `'order'` or `'ready'`.
- A **listener** is a function you register to run when that event happens.
- `on(name, listener)` subscribes. `emit(name, ...args)` fires the event and passes the arguments to every listener.

```javascript
// shop.mjs
import { EventEmitter } from 'node:events';

const shop = new EventEmitter();

shop.on('order', (item, customer) => {
  console.log(`Kitchen: making ${item} for ${customer}`);
});

shop.on('order', (item) => {
  console.log(`Till: charging for ${item}`);
});

shop.emit('order', 'pizza', 'Asha');
```

```text
Kitchen: making pizza for Asha
Till: charging for pizza
```

Listeners run in the order they were added. `emit` returns `true` if the event had listeners and `false` if nobody was listening.

## emit is synchronous

This is the most important detail about EventEmitter. `emit` calls every listener **right now**, one after another, before it returns. It is not queued for later.

```javascript
console.log('before emit');
shop.emit('order', 'pizza', 'Asha');
console.log('after emit');
```

```text
before emit
Kitchen: making pizza for Asha
Till: charging for pizza
after emit
```

So a slow listener slows down whoever called `emit`. If a listener needs to do slow work, make that work asynchronous inside the listener.

## once, off and friends

### once: listen a single time

`once` registers a listener that removes itself after the first call:

```javascript
shop.once('open', () => console.log('Opened!'));

shop.emit('open'); // prints: Opened!
shop.emit('open'); // prints nothing
```

### off: stop listening

`off(name, listener)` removes a listener. You must pass the **same function**, so give it a name:

```javascript
function logOrder(item) {
  console.log('Log:', item);
}

shop.on('order', logOrder);
shop.off('order', logOrder); // gone
```

`removeListener` is the older name for `off`. `removeAllListeners(name)` removes every listener for an event.

### Other helpers

| Method | What it does |
| --- | --- |
| `prependListener(name, fn)` | Adds a listener to the **front** of the list |
| `listenerCount(name)` | How many listeners an event has |
| `eventNames()` | An array of events that have listeners |
| `setMaxListeners(n)` | Changes the leak warning limit (see below) |

## Making your own emitter class

Most of the time you **extend** EventEmitter so your own class can emit events:

```javascript
// oven.mjs
import { EventEmitter } from 'node:events';

class Oven extends EventEmitter {
  bake(item, ms) {
    this.emit('start', item);
    setTimeout(() => this.emit('done', item), ms);
  }
}

const oven = new Oven();
oven.on('start', (item) => console.log(`Baking ${item}...`));
oven.on('done', (item) => console.log(`${item} is ready`));

oven.bake('bread', 100);
```

```text
Baking bread...
bread is ready
```

The code that uses the oven does not need to know how baking works. It just reacts to `'start'` and `'done'`. This keeps parts of your program loosely connected.

## The special 'error' event

The event name `'error'` has a special rule:

> If you emit `'error'` and **no listener** is registered, Node **throws** the error and the process crashes.

```javascript
// error-event.mjs
import { EventEmitter } from 'node:events';

const printer = new EventEmitter();
printer.emit('error', new Error('Printer out of paper'));
```

```text
Error: Printer out of paper
    at file:///home/asha/app/error-event.mjs:5:23
Emitted 'error' event at:
    at file:///home/asha/app/error-event.mjs:5:9

Node.js v24.12.0
```

So: **always add an `'error'` listener** to emitters that might emit one, especially servers, sockets and streams.

```javascript
printer.on('error', (err) => {
  console.error('Printer problem:', err.message);
});
```

### errorMonitor: watch errors without handling them

If you want to log errors but still let them behave normally, listen on the `errorMonitor` symbol. Its listeners run before the normal `'error'` listeners, and they do **not** count as handling the error:

```javascript
import { EventEmitter, errorMonitor } from 'node:events';

const printer = new EventEmitter();
printer.on(errorMonitor, (err) => console.log('monitor saw:', err.message));
printer.on('error', (err) => console.log('handled:', err.message));

printer.emit('error', new Error('Paper jam'));
```

```text
monitor saw: Paper jam
handled: Paper jam
```

## Async listeners and captureRejections

If a listener is an `async` function and it throws, the error becomes a **rejected promise**. EventEmitter ignores the return value of listeners, so by default nobody handles it, and you get an unhandled rejection crash.

Pass `{ captureRejections: true }` when you create the emitter, and those rejections are sent to the `'error'` event instead:

```javascript
// capture.mjs
import { EventEmitter } from 'node:events';

const store = new EventEmitter({ captureRejections: true });

store.on('save', async () => {
  throw new Error('Database offline');
});
store.on('error', (err) => console.log('captured:', err.message));

store.emit('save'); // prints: captured: Database offline
```

## The memory leak warning

If you add more than **10** listeners for the same event on one emitter, Node prints a warning:

```text
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 data listeners added to [EventEmitter]. MaxListeners is 10. Use emitter.setMaxListeners() to increase limit
```

It is only a warning, but it usually points to a real bug: code that adds a listener every time something happens (for example on every request) and never removes it. Fix the bug first. Only raise the limit with `setMaxListeners(n)` if you truly need many listeners.

## events.once: await a single event

Callbacks are fine, but sometimes you just want to wait for one event with `await`. The `once` **function** from `node:events` (not the method) returns a promise that fulfils with an **array** of the event's arguments:

```javascript
// await-once.mjs
import { EventEmitter, once } from 'node:events';

const oven = new EventEmitter();
setTimeout(() => oven.emit('done', 'cake', 'Maya'), 100);

const [item, customer] = await once(oven, 'done');
console.log(`${item} for ${customer} is ready`); // prints: cake for Maya is ready
```

If the emitter emits `'error'` while you wait, the promise **rejects** with that error, so wrap it in `try`/`catch`.

You can pass a signal to give up waiting, as you learned in [the Promise Combinators lesson](/courses/nodejs/promise-combinators-and-abortsignal):

```javascript
const controller = new AbortController();
setTimeout(() => controller.abort(), 100); // give up after 100 ms

try {
  await once(oven, 'done', { signal: controller.signal });
} catch (err) {
  console.log(err.name); // prints: AbortError
}
```

## events.on: loop over events with for await

The `on` **function** from `node:events` turns an event into an **async iterator**. Each time the event fires, your loop gets the next array of arguments:

```javascript
// ticker.mjs
import { EventEmitter, on } from 'node:events';

const ticker = new EventEmitter();
let n = 0;
const timer = setInterval(() => ticker.emit('tick', ++n), 50);

for await (const [count] of on(ticker, 'tick')) {
  console.log('tick', count);
  if (count === 3) break; // leaving the loop removes the listener
}

clearInterval(timer);
console.log('listeners left:', ticker.listenerCount('tick'));
```

```text
tick 1
tick 2
tick 3
listeners left: 0
```

The loop never ends by itself, because an emitter can always emit again. Stop it with `break`, or pass `{ signal }` and abort it. An `'error'` event makes the loop throw.

## Common mistakes

### Forgetting the 'error' listener

```javascript
// Wrong: if the file is missing, the process crashes
import { createReadStream } from 'node:fs';
const stream = createReadStream('missing.txt');
```

```javascript
// Right
stream.on('error', (err) => console.error('Read failed:', err.code));
```

### Removing an anonymous listener

```javascript
// Wrong: this is a different function, nothing is removed
shop.on('order', (item) => console.log(item));
shop.off('order', (item) => console.log(item));
```

Store the function in a variable and pass that same variable to `on` and `off`.

## Quick recap

- **EventEmitter** implements the observer pattern: `on` subscribes, `emit` notifies.
- `emit` is **synchronous**: listeners run immediately, in order.
- `once` listens one time; `off` removes a named listener.
- Extend `EventEmitter` to give your own classes events.
- An `'error'` event with no listener **crashes** the process. Always listen for it.
- `captureRejections: true` sends errors from async listeners to `'error'`.
- More than 10 listeners on one event triggers a leak warning. Look for a bug before raising the limit.
- `events.once()` lets you `await` one event; `events.on()` lets you `for await` over many. Both accept a `signal`.

<code id="code-content" class="language-javascript">
// events.mjs: a tiny bakery built on EventEmitter
import { EventEmitter, once, on } from 'node:events';
class Bakery extends EventEmitter {
  order(item, customer) {
    if (!item) {
      // Report problems with an 'error' event, not a throw
      this.emit('error', new Error(`Empty order from ${customer}`));
      return;
    }
    this.emit('order', item, customer); // listeners run right now, in order
    setTimeout(() =&gt; this.emit('ready', item, customer), 100);
  }
}
const bakery = new Bakery();
// on: listen every time
bakery.on('order', (item, customer) =&gt; console.log(`Kitchen: baking ${item} for ${customer}`));
bakery.on('order', (item) =&gt; console.log(`Till: charging for ${item}`));
// once: listen a single time
bakery.once('ready', (item) =&gt; console.log(`First thing ready today: ${item}`));
// Always listen for 'error', or an error event crashes the process
bakery.on('error', (err) =&gt; console.log('Problem:', err.message));
console.log('Before order');
bakery.order('bread', 'Asha');
console.log('After order (the listeners already ran)');
bakery.order('', 'Ravi');
// ---
// events.once: await a single event as a promise
const [item, customer] = await once(bakery, 'ready');
console.log(`Awaited: ${item} for ${customer} is ready`);
// off: remove a listener you no longer need
const shout = (thing) =&gt; console.log(`LOUD: ${thing}!`);
bakery.on('order', shout);
bakery.off('order', shout);
console.log('order listeners:', bakery.listenerCount('order'));
// events.on: loop over events with for await
const muffins = ['blueberry', 'banana', 'chocolate'];
muffins.forEach((m, i) =&gt; setTimeout(() =&gt; bakery.order(`${m} muffin`, 'Maya'), i * 30));
let count = 0;
// The signal is a safety net: give up if the muffins take too long
for await (const [readyItem] of on(bakery, 'ready', { signal: AbortSignal.timeout(2000) })) {
  console.log(`Loop got: ${readyItem}`);
  count++;
  if (count === muffins.length) break; // break removes the listener for us
}
console.log('ready listeners left:', bakery.listenerCount('ready'));
</code></pre>

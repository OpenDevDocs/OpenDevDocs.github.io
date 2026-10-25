---
publishDate: 2026-10-25T11:50
title: AsyncLocalStorage and Context Propagation
slug: asynclocalstorage
metadescription: Carry a request ID or user through every await and callback with AsyncLocalStorage, without passing it as a parameter. Includes logging and pitfalls.
updateDate: 2026-10-25T11:50
author: ['bishal-biswas']
level: 3
tags: ['async-hooks', 'context', 'logging']
course: nodejs
---

## The problem: passing things everywhere

A web server handles many requests at once. When something goes wrong, you want every log line to say *which* request it came from, usually with a **request ID**: a unique string given to each request.

The obvious way is to pass the ID down to every function:

```javascript
async function handle(req, requestId) {
  log(requestId, 'start');
  const orders = await findOrders(req.user, requestId);
  await sendEmail(req.user, requestId);
}

async function findOrders(user, requestId) {
  log(requestId, 'querying orders');
  // ...and every function this calls needs requestId too
}
```

Every function grows an extra parameter it does not care about, just to hand it on. This is sometimes called **prop drilling**.

You cannot use a normal global variable either. While request A is waiting on the database, request B starts and overwrites the global. When A wakes up, it reads B's ID.

## What AsyncLocalStorage does

**`AsyncLocalStorage`** gives you a value that behaves like a global, but each chain of async work sees its **own** copy.

Think of a cloakroom ticket. When you arrive, you get a ticket. Wherever you wander in the building, whatever you do, you still have *your* ticket in your pocket. Another guest has theirs. Nobody needs to pass tickets around, and they never get mixed up.

Passing a value along through `await`, timers and callbacks automatically like this is called **context propagation**. The value being carried is the **context**.

## The basics: run and getStore

```javascript
// basics.mjs
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

function log(message) {
  const store = storage.getStore();
  console.log(`[${store?.requestId ?? 'none'}] ${message}`);
}

storage.run({ requestId: 'req-1' }, () => {
  log('inside run'); // prints: [req-1] inside run
});

log('outside run'); // prints: [none] outside run
```

Two methods do almost everything:

- `storage.run(store, callback)` runs `callback` with `store` as the current context. The store is usually an object.
- `storage.getStore()` returns the current store, or `undefined` if you are not inside a `run`.

`run` returns whatever the callback returns, so you can `await storage.run(store, async () => { ... })`.

## It survives await and timers

The real power is that the context follows async work. Here two "requests" run at the same time with different delays:

```javascript
// async.mjs
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

const storage = new AsyncLocalStorage();

function log(message) {
  console.log(`[${storage.getStore()?.requestId}] ${message}`);
}

async function handle(id, delay) {
  await storage.run({ requestId: id }, async () => {
    log('start');
    await sleep(delay); // other work happens while we wait
    log('after sleep');
  });
}

await Promise.all([handle('req-1', 30), handle('req-2', 10)]);
```

```text
[req-1] start
[req-2] start
[req-2] after sleep
[req-1] after sleep
```

The lines interleave, but each one has the right ID. `log` never received an ID as a parameter. The same works across `setTimeout`, `setImmediate`, promise callbacks and most Node APIs with callbacks.

## A real example: request logging

Wrap each incoming request in `run`, and any code it calls can find the request's details:

```javascript
// server.mjs
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const requestContext = new AsyncLocalStorage();

function log(message) {
  const id = requestContext.getStore()?.requestId ?? 'server';
  console.log(`[${id}] ${message}`);
}

async function findOrders(user) {
  log(`querying orders for ${user}`); // no requestId parameter needed
  return [{ item: 'Notebook' }];
}

http
  .createServer((req, res) => {
    requestContext.run({ requestId: randomUUID() }, async () => {
      log(`${req.method} ${req.url}`);
      const orders = await findOrders('Asha');
      res.end(JSON.stringify(orders));
    });
  })
  .listen(3000, () => log('listening on 3000'));
```

```text
[server] listening on 3000
[3f1c9a2e-8b4d-4e2a-9c17-5d0b6a7e1f23] GET /
[3f1c9a2e-8b4d-4e2a-9c17-5d0b6a7e1f23] querying orders for Asha
```

Many logging and tracing libraries work exactly like this under the hood. You will see it again in [the Logging and Observability lesson](/courses/nodejs/logging-and-observability) and [the OpenTelemetry Tracing lesson](/courses/nodejs/opentelemetry-tracing).

### Adding to the store later

The store is a normal object, so code inside the context can add to it. For example, after checking a login token:

```javascript
const ctx = requestContext.getStore();
ctx.user = 'Asha'; // later code in this request can read ctx.user
```

Each request has its own store object, so this never leaks into other requests.

## Nesting and leaving

A `run` inside another `run` gets the inner store, and the outer one comes back afterwards:

```javascript
storage.run({ requestId: 'outer' }, () => {
  storage.run({ requestId: 'inner' }, () => log('nested')); // prints: [inner] nested
  log('back'); // prints: [outer] back
});
```

`storage.exit(callback)` runs a callback with **no** store, which is useful for background work that should not be tied to the current request.

## Capturing the context for later

Sometimes a function is called later from somewhere that has lost the context. Two static helpers capture it:

```javascript
let later;
storage.run({ requestId: 'req-7' }, () => {
  later = AsyncLocalStorage.bind(() => log('called later'));
});
later(); // prints: [req-7] called later
```

- `AsyncLocalStorage.bind(fn)` returns a copy of `fn` that always runs in the context where `bind` was called.
- `AsyncLocalStorage.snapshot()` returns a function `runInContext(fn)` that runs any function in the captured context.

## Under the hood

In Node 24, `AsyncLocalStorage` is built on a newer internal mechanism called **AsyncContextFrame**, which makes it faster than in earlier versions. You do not need to do anything to benefit. (A `--no-async-context-frame` flag switches back to the old implementation if you hit a compatibility problem.)

> **Note:** There is a TC39 proposal called `AsyncContext` that would bring the same idea to JavaScript itself, in browsers too. It is not part of the language yet, so use `AsyncLocalStorage` in Node today.

## Common mistakes

### Calling getStore outside run

```javascript
const storage = new AsyncLocalStorage();
console.log(storage.getStore().requestId); // TypeError: Cannot read properties of undefined
```

Outside a `run` there is no store. Use optional chaining (`getStore()?.requestId`) in code that can run both inside and outside a request.

### Event listeners run in the emitter's context

```javascript
const emitter = new EventEmitter();

storage.run({ requestId: 'setup' }, () => {
  emitter.on('ping', () => log('listener'));
});

storage.run({ requestId: 'emit' }, () => emitter.emit('ping')); // prints: [emit] listener
```

A listener runs in the context of whoever calls `emit`, not whoever registered it. That is usually what you want, but if a long-lived object emits events from background work, listeners may see no store at all. Wrap the listener with `AsyncLocalStorage.bind()` to pin it to the context where it was added.

### Using enterWith instead of run

`storage.enterWith(store)` sets the store for the rest of the current synchronous code *and* everything it schedules, with no clear end. It is easy to leak a store into code that should not have it. Prefer `run`, which has an obvious start and finish.

### Losing context in older libraries

Some older libraries keep their own queues of callbacks, for example a database connection pool that calls you back from shared code. Context can get lost there. If `getStore()` suddenly returns `undefined` after a library call, wrap your callback with `AsyncLocalStorage.bind()`.

### Creating a new AsyncLocalStorage per request

```javascript
http.createServer((req, res) => {
  const storage = new AsyncLocalStorage(); // wrong: other modules cannot see this
  storage.run({ requestId: randomUUID() }, () => handle(req, res));
});
```

Create **one** instance at module level, export it, and call `run` with a new store for each request.

## Quick recap

- `AsyncLocalStorage` (from `node:async_hooks`) carries a value through async work without passing parameters.
- `storage.run(store, fn)` starts a context. `storage.getStore()` reads it, from any function called inside.
- The context follows `await`, timers and callbacks, and concurrent requests never mix up their stores.
- Use one instance per app, a new store object per request, and `getStore()?.` where the store may be missing.
- `AsyncLocalStorage.bind()` and `snapshot()` capture a context for code that runs later.
- Request IDs in logs, the current user and tracing are the classic uses.

<code id="code-content" class="language-javascript">
// request-context.mjs: run with  node request-context.mjs
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
// One shared storage object for the whole app
const requestContext = new AsyncLocalStorage();
// A logger that adds the current request's id without being told it
function log(message) {
  const ctx = requestContext.getStore(); // undefined outside a request
  const id = ctx ? ctx.requestId.slice(0, 8) : 'server';
  const user = ctx?.user ?? '-';
  console.log(`[${id}] [${user}] ${message}`);
}
// Deep "database" code: no req parameter, but it can still log with the id
async function findOrders(user) {
  log(`querying orders for ${user}`);
  await sleep(Math.random() * 50); // pretend the query takes a while
  log('query finished');
  return [{ item: 'Notebook' }, { item: 'Pen' }];
}
async function handleRequest(req, res) {
  const user = new URL(req.url, 'http://x').searchParams.get('user') ?? 'guest';
  requestContext.getStore().user = user; // add to the store for later code
  log(`${req.method} ${req.url}`);
  const orders = await findOrders(user);
  res.end(JSON.stringify(orders));
  log('response sent');
}
// Every request runs inside its own context
const server = http.createServer((req, res) =&gt; {
  requestContext.run({ requestId: randomUUID() }, () =&gt; handleRequest(req, res));
});
server.listen(0, async () =&gt; {
  const { port } = server.address();
  log(`listening on port ${port}`);
  // Fire three requests at once: their log lines interleave, but ids never mix up
  await Promise.all(
    ['Asha', 'Ravi', 'Maya'].map((name) =&gt;
      fetch(`http://localhost:${port}/orders?user=${name}`).then((r) =&gt; r.json()),
    ),
  );
  log('all done, closing');
  server.close();
});
</code></pre>

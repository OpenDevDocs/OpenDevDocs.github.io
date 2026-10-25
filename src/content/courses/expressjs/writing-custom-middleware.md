---
publishDate: 2026-10-25T09:18
title: Writing Custom Middleware
slug: writing-custom-middleware
metadescription: Learn to write your own Express 5 middleware, including a request logger, request IDs, configurable API key checks and async middleware, and how to organise them in files.
updateDate: 2026-10-25T09:18
author: ['bishal-biswas']
level: 2
tags: ['express', 'middleware', 'logging', 'nodejs']
course: expressjs
---

## What you will learn

- A simple recipe for writing any middleware
- How to build a request logger that measures response time
- How to attach data to a request with `req` and `res.locals`
- How to write **configurable middleware** with a factory function
- How `async` middleware works in Express 5, and how to organise middleware in files

In [How the Middleware Stack Works](/courses/expressjs/how-middleware-works) you learned how Express walks a request through the stack. Now you will build your own pieces for that stack.

## Why write your own middleware?

Some jobs are needed by many routes: logging every request, checking an API key, adding a request ID, blocking traffic during maintenance. These are called **cross-cutting concerns**, because they cut across all your routes instead of belonging to one.

You could copy the same lines into every route. But then a change means editing twenty places, and you will forget one. Middleware lets you write the code **once** and plug it in wherever it is needed.

**Think of a kitchen.** Every dish needs clean plates. You do not make each chef wash their own. One person at the start of the line handles plates for everyone. Middleware is that person.

## The recipe

Every middleware follows the same three steps:

```js
const myMiddleware = (req, res, next) => {
  // 1. Do your work: read req, set headers, add data, check something

  // 2. Decide: is this request allowed to continue?
  //    If not, send a response and stop:  return res.status(...).json(...)

  // 3. Otherwise, pass it on:
  next();
};
```

Keep that shape in mind. Every example below is a variation of it.

## Example 1: a request logger with timing

Let's build a logger that prints one line per request, like this:

```text
GET /hello 200 2.4ms
POST /api/notes 201 5.9ms
GET /missing 404 0.8ms
```

The tricky part is the status code and the time. Both are only known **after** the response is sent. But middleware runs **before** the route.

The solution is to listen for the response's **`finish` event**. An **event** is a signal an object sends when something happens. `res` sends `finish` once the whole response has been handed to the network. You attach a listener with `res.on('finish', callback)`, and Node calls it later.

```js
// middleware/logger.js
export const logger = (req, res, next) => {
  const start = performance.now(); // high-precision timer, in milliseconds

  res.on('finish', () => {
    const ms = (performance.now() - start).toFixed(1);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });

  next(); // do not wait for finish, let the request continue now
};
```

Here is what happens over time:

```text
 time --->

 logger runs:      start timer, register "finish" listener, next()
                        |
                        v
 route runs:       ...does its work... res.json(...)
                        |
                        v
 response sent:    "finish" event fires
                        |
                        v
 listener runs:    logs "GET /hello 200 2.4ms"
```

Use it at the very top of your app, so it sees every request:

```js
// app.js
import express from 'express';
import { logger } from './middleware/logger.js';

const app = express();

app.use(logger); // first, so it times everything below

app.get('/hello', (req, res) => {
  res.send('Hi');
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

> **Note:** `performance.now()` is available globally in Node.js, no import needed. It is more precise than `Date.now()` for measuring short durations.

> **Tip:** If the client disconnects before the response is complete, `finish` never fires, but a `close` event does. Production loggers listen for both. In real projects you will usually use a ready-made logger instead, covered in [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino). Writing one yourself is the best way to understand how they work.

## Example 2: adding a request ID

When many requests happen at once, log lines get mixed together. A **request ID** is a unique label for each request. You print it in every log line and send it back in a header. When a user reports a problem, they can give you the ID, and you can find every log line for that exact request.

```js
// middleware/request-id.js
import { randomUUID } from 'node:crypto';

export const requestId = (req, res, next) => {
  req.id = randomUUID();         // e.g. '3b241101-e2bb-4255-8caf-4136c566a962'
  res.set('X-Request-Id', req.id); // let the client see it too
  next();
};
```

`randomUUID()` creates a **UUID**, a random 36-character ID that is practically guaranteed to be unique.

Now any later middleware or route can read `req.id`:

```js
// app.js
app.use(requestId);
app.use(logger);

app.get('/api/orders', (req, res) => {
  console.log(`[${req.id}] loading orders`);
  res.json([]);
});
```

```bash
curl -i http://localhost:3000/api/orders
```

```http
HTTP/1.1 200 OK
X-Request-Id: 3b241101-e2bb-4255-8caf-4136c566a962
Content-Type: application/json; charset=utf-8
```

## Where should middleware store data?

You have two good places to attach data for later code:

| Place | Best for | Example |
| --- | --- | --- |
| `req.something` | Facts about the request that routes need | `req.id`, `req.user`, `req.body` |
| `res.locals.something` | Data for building the response, especially templates | `res.locals.pageTitle`, `res.locals.currentUser` |

Both live for **one request only**. The next request starts fresh.

A few rules keep you out of trouble:

- **Pick names that will not clash.** `req.user` is a common convention. Avoid names Express already uses, such as `req.params`, `req.query` or `req.path`.
- **Do not try to replace `req.query`.** In Express 5 it is a read-only getter. If you want cleaned-up query values, store them under a new name like `req.filters`.
- **Do not store request data in a module-level variable.** A variable outside the function is shared by *all* requests at once, so one user's data can leak into another user's response.

```js
// Bug: one variable shared by every request
let currentUser;
app.use((req, res, next) => {
  currentUser = req.get('X-User'); // user B overwrites user A mid-request
  next();
});

// Right: attach it to this request only
app.use((req, res, next) => {
  req.user = req.get('X-User');
  next();
});
```

## Example 3: configurable middleware (factories)

Remember how you write `express.json()` with brackets? `express.json` is a **factory**: a function that *builds and returns* a middleware. This lets you pass options once and get a customised middleware back.

You can do the same. Here is an API key checker where you choose the key and the header name:

```js
// middleware/require-api-key.js
export const requireApiKey = ({ key, header = 'X-Api-Key' }) => {
  if (!key) {
    throw new Error('requireApiKey: a key is required'); // fail fast at startup
  }

  // This inner function is the real middleware
  return (req, res, next) => {
    if (req.get(header) !== key) {
      return res.status(401).json({ error: 'Missing or invalid API key' });
    }
    next();
  };
};
```

```text
 requireApiKey({ key: 'abc' })      <- runs ONCE, when the app starts
           |
           | returns
           v
 (req, res, next) => { ... }        <- runs on EVERY request
```

Use it with options:

```js
// app.js
import { requireApiKey } from './middleware/require-api-key.js';

const apiKeyCheck = requireApiKey({ key: process.env.API_KEY });

app.get('/api/public', (req, res) => res.json({ hello: 'world' }));

app.get('/api/reports', apiKeyCheck, (req, res) => {
  res.json({ revenue: 1000 });
});
```

Start the app with the key in your `.env` file, as you learned in [Environment Variables and Configuration](/courses/expressjs/environment-variables-and-config):

```bash
# .env
API_KEY=change-me
```

```bash
curl http://localhost:3000/api/reports
# {"error":"Missing or invalid API key"}

curl -H "X-Api-Key: change-me" http://localhost:3000/api/reports
# {"revenue":1000}
```

> **Common mistake:** Writing `app.use(requireApiKey)` without calling it. Express then treats the factory itself as middleware, passing `req` as the options object. Always call the factory: `app.use(requireApiKey({ key: ... }))`.

### Another factory: maintenance mode

Factories are handy for turning features on and off:

```js
// middleware/maintenance.js
export const maintenance = ({ enabled, allowPaths = [] }) => (req, res, next) => {
  if (!enabled || allowPaths.includes(req.path)) {
    return next();
  }
  res.set('Retry-After', '600'); // ask clients to try again in 10 minutes
  res.status(503).json({ error: 'Down for maintenance, back soon' });
};
```

```js
// app.js
app.use(maintenance({
  enabled: process.env.MAINTENANCE === 'true',
  allowPaths: ['/health'], // keep the health check working
}));
```

## Example 4: async middleware

Some middleware needs to wait for something, like looking up a user in a database. Mark it `async` and use `await`, exactly like an async route.

Here we fake a database with a small function that takes a moment to answer:

```js
// db.js (a pretend database for this lesson)
const users = { 'token-ana': { id: 1, name: 'Ana' }, 'token-raj': { id: 2, name: 'Raj' } };

export const findUserByToken = async (token) => {
  await new Promise((resolve) => setTimeout(resolve, 20)); // pretend network delay
  if (token === 'token-crash') throw new Error('Database connection lost');
  return users[token] ?? null;
};
```

```js
// middleware/load-user.js
import { findUserByToken } from '../db.js';

export const loadUser = async (req, res, next) => {
  const token = req.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Please log in' });
  }

  const user = await findUserByToken(token); // may throw
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
};
```

```js
// app.js
import { loadUser } from './middleware/load-user.js';

app.get('/me', loadUser, (req, res) => {
  res.json({ hello: req.user.name });
});
```

```bash
curl -H "Authorization: Bearer token-ana" http://localhost:3000/me
# {"hello":"Ana"}

curl -H "Authorization: Bearer token-crash" http://localhost:3000/me
# 500 Internal Server Error
```

What happened in the second request? `findUserByToken` threw an error. Because `loadUser` is `async`, the error turned into a **rejected promise**: a promise that failed instead of producing a value. **Express 5 notices rejected promises from middleware and passes the error to `next(err)` for you.** The request jumps to the error handler, and the client gets a `500`.

```text
 GET /me  (token-crash)
      |
      v
 [loadUser]  await findUserByToken() --> throws!
      |
      |  Express 5 catches the rejected promise
      |  and calls next(err) automatically
      v
 [GET /me handler]   skipped
      |
      v
 [error handler]  --> 500 Internal Server Error
```

In Express 4, Express did not watch for rejected promises. The request would hang, and on current Node.js versions the **unhandled rejection** could even crash the whole server. You had to wrap everything in `try/catch`. In Express 5 you do not. You will customise that error response in [Error-Handling Middleware](/courses/expressjs/error-handling-middleware).

> **Note:** Fake tokens are just for learning. Real login tokens and password checks are covered in [JWT Authentication](/courses/expressjs/jwt-authentication).

## Organising middleware in files

As you write more middleware, give it its own folder. One file per middleware, using named exports:

```text
my-api/
  app.js
  db.js
  .env
  middleware/
    logger.js
    request-id.js
    require-api-key.js
    maintenance.js
    load-user.js
```

Then `app.js` reads like a table of contents:

```js
// app.js
import express from 'express';
import { requestId } from './middleware/request-id.js';
import { logger } from './middleware/logger.js';
import { maintenance } from './middleware/maintenance.js';
import { requireApiKey } from './middleware/require-api-key.js';
import { loadUser } from './middleware/load-user.js';

const app = express();

// 1. App-wide middleware, runs for every request
app.use(requestId);
app.use(logger);
app.use(maintenance({ enabled: process.env.MAINTENANCE === 'true', allowPaths: ['/health'] }));
app.use(express.json());

// 2. Routes
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/me', loadUser, (req, res) => res.json(req.user));
app.get('/api/reports', requireApiKey({ key: process.env.API_KEY }), (req, res) => {
  res.json({ revenue: 1000 });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Run it with `node --env-file=.env app.js`. Here is the whole stack for `GET /me`:

```text
 GET /me
    |
    v
 [requestId]      req.id = '3b24...'; header X-Request-Id    -> next()
    |
    v
 [logger]         start timer; wait for "finish"            -> next()
    |
    v
 [maintenance]    disabled                                    -> next()
    |
    v
 [express.json()] no JSON body to read                       -> next()
    |
    v
 [GET /health]    path does not match                         -> skipped
    |
    v
 [GET /me]
    |-- [loadUser]  token ok, req.user = { name: 'Ana' }      -> next()
    |-- [handler]   res.json(req.user)                        -> response sent
    |
    v
 "finish" event -> logger prints: GET /me 200 21.7ms
```

### Grouping middleware into an array

If several middleware always go together, export them as an array. `app.use()` and routes both accept arrays.

```js
// middleware/index.js
import { requestId } from './request-id.js';
import { logger } from './logger.js';

export const basics = [requestId, logger];
```

```js
// app.js
import { basics } from './middleware/index.js';

app.use(basics); // same as app.use(requestId); app.use(logger);
```

## Common mistakes

**Calling `next()` twice, or after responding.** Every path through your function should end with exactly one of `next()`, a response, or an error. Use `return` with early responses.

```js
// Bug: when blocked, this sends 403 AND calls next()
const onlyAdmins = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admins only' });
  }
  next();
};
```

**Passing the factory instead of calling it.** `app.use(requireApiKey)` is wrong. `app.use(requireApiKey({ key }))` is right.

**Storing per-request data in shared variables.** Attach it to `req` or `res.locals`, never to a variable outside the function.

**Doing slow work for every request.** Middleware registered with `app.use()` runs on *every* request, including images and CSS. If only a few routes need a database lookup, attach it to those routes only.

**Logging in the wrong place.** A logger placed after your routes will not see requests the routes answered. Register it first.

## Key takeaways

- Custom middleware follows one recipe: do some work, then either respond (and `return`) or call `next()`.
- Use `res.on('finish', ...)` to run code after the response is sent, such as logging the status and time.
- Attach per-request data to `req` (like `req.id` or `req.user`) or `res.locals`, never to shared variables.
- A **factory** is a function that returns middleware. It lets you pass options once, like `express.json()` does.
- In Express 5, errors thrown inside `async` middleware go to the error handler automatically.
- Keep middleware in a `middleware/` folder, one file each, and register app-wide ones before your routes.

## Practice

1. Build the logger and add the request ID to each log line, like `[3b24...] GET /hello 200 2.4ms`. Make sure `requestId` runs before `logger`.
2. Write a factory `slowDown(ms)` that waits `ms` milliseconds before calling `next()`. Use it on one route and watch the logger's timing change.
3. Write an `onlyAdmins` middleware that uses `req.user` from `loadUser` and returns `403` unless `req.user.name === 'Ana'`. Chain both on a route: `app.get('/admin', loadUser, onlyAdmins, handler)`.
4. Turn on maintenance mode with `MAINTENANCE=true`. Confirm `/health` still works and every other route returns `503` with a `Retry-After` header.

## What's next

You have been using `express.json()` in passing. Next, learn exactly how Express reads request bodies, and what can go wrong, in [Built-in Body Parsers: express.json and urlencoded](/courses/expressjs/built-in-body-parsers).

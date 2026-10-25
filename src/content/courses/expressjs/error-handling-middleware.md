---
publishDate: 2026-10-25T09:23
title: Error-Handling Middleware
slug: error-handling-middleware
metadescription: Learn how to write Express 5 error-handling middleware with four parameters, send clean JSON errors, hide stack traces in production and chain several error handlers.
updateDate: 2026-10-25T09:23
author: ['bishal-biswas']
level: 2
tags: ['express', 'error-handling', 'middleware', 'api']
course: expressjs
---

## What you will learn

- What **error-handling middleware** is and why it needs exactly four parameters
- What Express's **default error handler** does, and why you usually replace it
- How to write a central handler that sends clean JSON errors
- How to hide internal details in production and log the real error
- How to chain several error handlers, and the `res.headersSent` check

## One place for everything that goes wrong

In the previous lesson you saw that Express 5 sends errors to `next(err)` automatically. But where do they go next?

They go to **error-handling middleware**: special middleware that only runs when something has failed. Instead of every route deciding how to show errors, you write that logic **once**, in one central place.

**Think of it like a hospital's emergency room.** Most patients go to their normal appointments (your routes). But anyone who gets hurt, anywhere in the building, is sent to the same emergency room, where trained staff handle them in a consistent way.

## The four-parameter rule

An error handler looks like normal middleware with one extra parameter at the **front**: `err`.

```js
// a minimal error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});
```

How does Express know this is an error handler and not normal middleware? It counts the parameters. A function with **exactly four** parameters is treated as an error handler. That is the only signal Express uses.

> **Warning:** You must write all four parameters, even if you never use `next`. If you write `(err, req, res) => {...}`, Express sees three parameters and treats it as normal middleware. It is skipped whenever an error happens, and on normal requests it runs with the request object in the `err` slot. Your error handler silently stops working.

> **Tip:** If your linter complains that `next` is unused, name it `_next`. The name does not matter to Express; only the count does.

## Where error handlers go

Error handlers go **after** all your routes and normal middleware. Here is the full flow:

```text
request
   |
   v
app.use(express.json())        normal middleware
   |
   v
app.get('/users/:id', ...)     route throws or calls next(err)
   |
   |  error! Express now SKIPS every normal handler
   v
app.use((req, res) => ...)     404 handler     <- skipped
   |
   v
app.use((err, req, res, next)) error handler   <- runs
```

Two rules to remember:

1. When there is **no error**, Express skips error handlers.
2. When there **is** an error, Express skips normal handlers until it finds an error handler.

That is why placement matters. An error handler placed before your routes will never see their errors, because those errors happen later in the line.

## The default error handler

If you do not write an error handler, Express uses its own **default error handler**. You already met it in the previous lesson. It:

- Sets the status code from `err.status` or `err.statusCode` if it is a valid 4xx or 5xx code, otherwise 500.
- Sends a small **HTML** page with the error.
- Includes the **stack trace** (the list of function calls that led to the error) unless `NODE_ENV` is `production`.

That is fine while learning, but not great for a real API:

- API clients expect **JSON**, not HTML.
- You want a **consistent** error shape across your whole API.
- You want to **log** errors in your own format.

So let's write our own.

## A good JSON error handler

Here is a complete, realistic app with a central error handler:

```js
// app.js
import express from 'express';

const app = express();
app.use(express.json());

const findUser = async (id) => {
  if (id === '0') throw new Error('Database connection lost');
  if (id === '404') {
    const err = new Error('User not found');
    err.status = 404; // a hint for the error handler
    throw err;
  }
  return { id, name: 'Asha' };
};

app.get('/users/:id', async (req, res) => {
  res.json(await findUser(req.params.id));
});

// error handler: always last
app.use((err, req, res, next) => {
  // 1. if a response already started, let Express close the connection
  if (res.headersSent) {
    return next(err);
  }

  // 2. pick a safe status code
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
    ? err.status
    : 500;

  // 3. log the full error for yourself
  console.error(`${req.method} ${req.originalUrl} failed:`, err);

  // 4. send a safe message to the client
  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : err.message,
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Try all three paths:

```bash
curl http://localhost:3000/users/1
curl http://localhost:3000/users/404
curl http://localhost:3000/users/0
```

```text
{"id":"1","name":"Asha"}
{"error":"User not found"}
{"error":"Internal Server Error"}
```

Let's walk through the four steps.

### Step 1: the headersSent check

**`res.headersSent`** is `true` once the response has started going out. This can happen when an error occurs halfway through streaming a large file, for example. At that point you cannot change the status code or send JSON anymore.

The right move is `return next(err)`. Express's default handler then closes the connection, which tells the client that something went wrong. Always include this check.

### Step 2: a safe status code

Errors can carry a `status` (or `statusCode`) property as a hint. Some libraries set it for you. For example, when `express.json()` receives broken JSON, it creates an error with `status` 400.

But you cannot trust it blindly. In Express 5, `res.status()` only accepts whole numbers from 100 to 999 and **throws** on anything else. An error with `status: '404'` (a string) or `status: 200` would cause trouble. The check above falls back to 500 for anything that is not a real 4xx or 5xx number.

### Step 3: log the real error

The client gets a short message. You, the developer, need the full story: the message, the stack trace, and which request failed. `console.error` is enough for now. In [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino) you will swap it for a proper logger.

### Step 4: hide internals for 500s

Look at this line again:

```js
error: status >= 500 ? 'Internal Server Error' : err.message,
```

For **4xx errors** (client mistakes such as "User not found"), the message is meant for the user, so we show it.

For **5xx errors** (server problems), the message might reveal secrets: table names, file paths, or a database host. Attackers love those clues. So we show a generic message and keep the details in our logs.

> **Warning:** Never send `err.stack` to clients in production. It reveals your folder structure, library versions and code paths.

## Showing more detail while developing

While you are building the app, seeing the stack in the response is handy. You can include it only when you are **not** in production:

```js
// app.js (inside the error handler)
const isProduction = process.env.NODE_ENV === 'production';

res.status(status).json({
  error: status >= 500 ? 'Internal Server Error' : err.message,
  ...(isProduction ? {} : { stack: err.stack }), // dev only
});
```

## Handling broken JSON bodies

Body parsers report their problems through the same error system. Send invalid JSON and see:

```bash
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{bad json'
```

```text
{"error":"Expected property name or '}' in JSON at position 1 ..."}
```

The exact wording comes from JavaScript's `JSON.parse` and can differ between Node.js versions. Because `express.json()` set `err.status` to 400, our handler showed the message and returned 400 instead of 500. These errors also have a `type` property such as `'entity.parse.failed'` (broken JSON) or `'entity.too.large'` (body over the size limit), so you can give friendlier messages:

```js
// app.js (inside the error handler, before sending)
if (err.type === 'entity.parse.failed') {
  return res.status(400).json({ error: 'Request body is not valid JSON' });
}
```

## Chaining several error handlers

Error handlers are middleware, so they can call `next(err)` to pass the error along to the **next** error handler. This lets you split jobs into small pieces:

```js
// app.js
const logErrors = (err, req, res, next) => {
  console.error(err);
  next(err); // pass it on
};

const apiErrors = (err, req, res, next) => {
  if (!req.originalUrl.startsWith('/api')) {
    return next(err); // not an API request: let the next handler decide
  }
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error' });
};

const htmlErrors = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(500).send('<h1>Sorry, something broke.</h1>');
};

app.use(logErrors);
app.use(apiErrors);
app.use(htmlErrors);
```

API requests get JSON, website pages get HTML, and every error is logged exactly once.

> **Note:** Calling `next()` **without** an argument inside an error handler means "the error is handled, continue normally". That is almost never what you want. Pass the error along with `next(err)`.

## Error handlers inside routers

Routers can have their own error handlers too. A router's error handler catches errors from that router's routes. If it calls `next(err)`, the error continues to the app's handlers.

```js
// routes/payments.js
import { Router } from 'express';

const router = Router();

router.post('/', async (req, res) => {
  throw new Error('Payment provider timeout');
});

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.status(502).json({ error: 'Payment service unavailable, try again' });
});

export default router;
```

This is useful when one part of your app needs special error responses. Most apps are fine with a single app-level handler.

## Async error handlers

Error handlers can be `async` too. If your error handler itself throws (for example, while writing to an error-tracking service), Express 5 forwards that new error to the next error handler, and finally to the default one. You do not need extra `try/catch` just to keep the server alive.

## What error handlers do not catch

Error-handling middleware only sees errors that happen **during a request**. Errors at startup, in timers you started outside routes, or in background jobs never reach it. For those, Node itself raises `uncaughtException` or `unhandledRejection`. The safest response there is to log and restart the process cleanly, which you will learn in [Graceful Shutdown and Health Checks](/courses/expressjs/graceful-shutdown-and-health-checks).

## Common mistakes

> **Common mistake:** Placing the error handler **before** the routes. It never sees their errors. Always register error handlers last.

> **Common mistake:** Using default parameters such as `(err, req, res, next = () => {})`. A default value changes the function's parameter count to three, so Express no longer treats it as an error handler.

> **Common mistake:** Responding with `res.status(err.status)` without checking. If `err.status` is missing, `res.status(undefined)` throws in Express 5, and your error handler itself fails.

## Key takeaways

- Error-handling middleware has **exactly four parameters**: `(err, req, res, next)`.
- Register error handlers **after** all routes and normal middleware.
- Check **`res.headersSent`** first and delegate to `next(err)` if the response already started.
- Use `err.status` only when it is a valid 4xx/5xx integer. Default to 500.
- Show friendly messages for 4xx, a generic message for 5xx, and log the full error for yourself.

## Practice

1. Add the JSON error handler to one of your apps. Make a route that throws, and confirm you get JSON instead of HTML.
2. Remove the `next` parameter from your error handler. What happens? Put it back.
3. Send broken JSON to a `POST` route and return the message `Request body is not valid JSON` with status 400.
4. Split your handler into `logErrors` and `sendErrors`, chained with `next(err)`.

## What's next

Setting `err.status` by hand on every error gets repetitive. Next you will create reusable error classes like `NotFoundError`. Continue with [Custom Error Classes and HTTP Errors](/courses/expressjs/custom-error-classes).

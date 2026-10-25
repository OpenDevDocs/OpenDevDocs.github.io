---
publishDate: 2026-10-25T09:24
title: Custom Error Classes and HTTP Errors
slug: custom-error-classes
metadescription: Learn how to create custom error classes like NotFoundError in Express 5, throw them from any route, and turn them into consistent JSON error responses in one handler.
updateDate: 2026-10-25T09:24
author: ['bishal-biswas']
level: 2
tags: ['express', 'error-handling', 'classes', 'api']
course: expressjs
---

## What you will learn

- Why `const err = new Error(); err.status = 404` gets messy fast
- How to build an **`HttpError`** class and small subclasses like `NotFoundError`
- How to give every error response the **same shape**, with a machine-readable code
- The difference between **expected** and **unexpected** errors
- How the popular `http-errors` package does the same job

## The problem with plain errors

In the last lesson, a route signalled "not found" like this:

```js
const err = new Error('User not found');
err.status = 404;
throw err;
```

Three lines for one idea. Now imagine dozens of routes doing this, each slightly differently. Someone types `err.statusCode`, someone else forgets the status entirely, and a "not found" turns into a 500.

What you want instead is one short, readable line:

```js
throw new NotFoundError('User not found');
```

That is what **custom error classes** give you.

## A quick refresher: classes and extends

A **class** is a blueprint for creating objects. JavaScript's built-in `Error` is a class. With **`extends`** you can make your own class that **inherits** everything from `Error` (the message, the stack trace) and adds new properties.

**Think of it like vehicle types.** Every car is a vehicle, but a fire truck is a special vehicle with a ladder and a siren. `NotFoundError` is a special `Error` with a status code built in.

```js
// a tiny example
class NotFoundError extends Error {
  constructor(message) {
    super(message); // let Error set up message and stack
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

const err = new NotFoundError('User not found');
console.log(err.message);               // User not found
console.log(err.status);                // 404
console.log(err instanceof Error);      // true
console.log(err instanceof NotFoundError); // true
```

`super(message)` calls the parent `Error` constructor. You must call it before using `this`. The **`instanceof`** operator checks whether an object was made from a class, or from one of its children. Your error handler will rely on it.

## Building an error toolkit

Let's put all our error classes in one file. First, a **base class** that every HTTP error shares. Then small subclasses for the common status codes.

```js
// errors.js
export class HttpError extends Error {
  constructor(status, message, { code, details, cause } = {}) {
    super(message, { cause }); // "cause" keeps the original error, if any
    this.name = this.constructor.name; // e.g. "NotFoundError"
    this.status = status;
    this.code = code ?? 'HTTP_ERROR';
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', options = {}) {
    super(400, message, { code: 'BAD_REQUEST', ...options });
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Please log in', options = {}) {
    super(401, message, { code: 'UNAUTHORIZED', ...options });
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'You do not have access', options = {}) {
    super(403, message, { code: 'FORBIDDEN', ...options });
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found', options = {}) {
    super(404, message, { code: 'NOT_FOUND', ...options });
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', options = {}) {
    super(409, message, { code: 'CONFLICT', ...options });
  }
}
```

A few things to notice:

- **`this.constructor.name`** gives the class name automatically, so each subclass gets the right `name` without repeating it.
- **`code`** is a short, fixed, machine-readable label like `NOT_FOUND`. Messages may change or be translated, but codes stay stable, so frontend apps can safely check them.
- **`details`** holds extra information, such as which form fields were invalid.
- **`cause`** is a standard `Error` option that stores the original, lower-level error. It is handy for logs.

## Using the errors in routes

Now routes become short and readable. Every failure is one `throw`:

```js
// routes/users.js
import { Router } from 'express';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';

const router = Router();
const users = [{ id: 1, email: 'asha@example.com' }];

router.get('/:id', async (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    throw new NotFoundError(`User ${req.params.id} not found`, { code: 'USER_NOT_FOUND' });
  }
  res.json(user);
});

router.post('/', async (req, res) => {
  const email = req.body?.email;
  if (!email) {
    throw new BadRequestError('Invalid user data', {
      details: [{ field: 'email', message: 'email is required' }],
    });
  }
  if (users.some((u) => u.email === email)) {
    throw new ConflictError('Email already registered', { code: 'EMAIL_TAKEN' });
  }
  const user = { id: users.length + 1, email };
  users.push(user);
  res.status(201).json(user);
});

export default router;
```

Because these handlers are `async`, Express 5 forwards every thrown error to your error handler automatically. No `try/catch`, no `next(err)`.

> **Tip:** You can throw from a normal (non-async) handler too. Synchronous throws have always been caught by Express.

## One handler that understands them all

The error handler now checks: "Is this one of **my** HTTP errors?" If yes, it can trust the status and message. If not, it is an unexpected bug, so it responds with a generic 500.

```js
// app.js
import express from 'express';
import usersRouter from './routes/users.js';
import { HttpError } from './errors.js';

const app = express();
app.use(express.json());
app.use('/users', usersRouter);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    // expected error: safe to show
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // unexpected error: log everything, show nothing sensitive
  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' },
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Try it:

```bash
curl http://localhost:3000/users/99
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email":"asha@example.com"}'
```

```text
{"error":{"code":"USER_NOT_FOUND","message":"User 99 not found"}}
{"error":{"code":"BAD_REQUEST","message":"Invalid user data","details":[{"field":"email","message":"email is required"}]}}
{"error":{"code":"EMAIL_TAKEN","message":"Email already registered"}}
```

Every error now has the **same shape**. Frontend developers can write one piece of code to display any error from your API. (`details` disappears when it is `undefined`, because `JSON.stringify` skips undefined values.)

## Expected vs unexpected errors

This split is the heart of good error handling, so let's name it clearly.

| | Expected errors | Unexpected errors |
| --- | --- | --- |
| Also called | **Operational** errors | **Programmer** errors, bugs |
| Examples | User not found, invalid input, wrong password, email taken | `undefined is not a function`, database down, typo in code |
| Status | 4xx (sometimes 503) | 500 |
| Show the message? | Yes, it is written for the user | No, log it and show a generic message |
| How to signal | `throw new NotFoundError(...)` | They just happen |

Your custom classes are for **expected** errors. Anything that is not an `HttpError` is treated as unexpected. That keeps you safe by default: if you forget to wrap something, it never leaks internal details.

## Translating library errors

Libraries throw their own errors. A database might throw "duplicate key", or a JSON parser might throw a `SyntaxError`. Your users should not see those raw messages. **Translate** them into your own classes, keeping the original as `cause`:

```js
// routes/users.js
router.post('/import', async (req, res) => {
  try {
    await db.insertUser(req.body);
  } catch (err) {
    if (err.code === 'DUPLICATE_KEY') {
      throw new ConflictError('Email already registered', { code: 'EMAIL_TAKEN', cause: err });
    }
    throw err; // anything else stays unexpected
  }
  res.status(201).end();
});
```

The `cause` does not go to the client, but it shows up when you log the error, so you can still see what really happened. You will use this pattern with Mongoose's `CastError` in [CRUD API with MongoDB and Mongoose](/courses/expressjs/crud-api-with-mongodb).

You can also translate in the error handler itself, which is handy for errors that come from middleware you did not write. For example, `express.json()` errors already carry `status: 400` and a `type`:

```js
// app.js (inside the error handler, before the instanceof check)
if (err.type === 'entity.parse.failed') {
  err = new BadRequestError('Request body is not valid JSON', { cause: err });
}
```

## The http-errors package

You do not have to write your own classes. The **`http-errors`** package, maintained by the same community as Express, creates HTTP errors for every status code.

```bash
npm install http-errors
```

```js
// routes/users.js (with http-errors)
import createError from 'http-errors';

router.get('/:id', async (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    throw createError(404, 'User not found');
  }
  res.json(user);
});
```

Errors from `http-errors` have a `status`, a `message`, and an **`expose`** property. `expose` is `true` for 4xx errors (safe to show the message) and `false` for 5xx errors. Your handler can use it like this:

```js
// app.js (error handler using http-errors)
import createError from 'http-errors';

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (createError.isHttpError(err) && err.expose) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

Which should you choose?

| Your own classes | `http-errors` |
| --- | --- |
| Full control over fields like `code` and `details` | Ready to use, covers every status code |
| A few lines of code you own | One more dependency |
| Great for APIs with a fixed error format | Great for quick projects |

Both are fine. This course uses its own small `errors.js` file, because it makes the idea visible.

> **Note:** There is also an official standard for error bodies called **Problem Details** (RFC 9457), which uses the `application/problem+json` content type and fields like `type`, `title`, `status` and `detail`. Some teams adopt it so different APIs share one error format. The class-based approach in this lesson works with it too.

## Common mistakes

> **Common mistake:** Forgetting `super(message)` in a subclass constructor. JavaScript throws `ReferenceError: Must call super constructor in derived class before accessing 'this' or returning from derived constructor` as soon as you create the error.

> **Common mistake:** Throwing strings: `throw 'Not found'`. A string has no stack trace and no `status`, and `instanceof` checks fail. Always throw `Error` objects or your own classes.

> **Common mistake:** Putting secrets in error messages, like `throw new HttpError(500, 'DB password rejected for admin@...')`. Treat any message you might show as public.

## Key takeaways

- Custom error classes turn "create error, set status, throw" into one readable line.
- Use a base **`HttpError`** with `status`, `code` and `details`, plus small subclasses like `NotFoundError`.
- In the error handler, `instanceof HttpError` separates **expected** errors (show them) from **unexpected** ones (log and hide).
- Translate library errors into your own classes and keep the original as **`cause`**.
- The **`http-errors`** package is a ready-made alternative with `createError(404)` and `err.expose`.

## Practice

1. Create `errors.js` with `HttpError`, `NotFoundError` and `BadRequestError`, and update one of your apps to use them.
2. Add a `TooManyRequestsError` (status 429) with the code `RATE_LIMITED`. Throw it from a test route and check the response.
3. Change your error handler so unexpected errors also include a random `requestId` in the response and the log, so users can report it and you can find it.
4. Rewrite one route with `http-errors` instead of your own classes and compare the two styles.

## What's next

There is one kind of error that no route ever throws: a request that matches no route at all. Continue with [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

---
publishDate: 2026-10-25T09:22
title: Async Routes and Automatic Error Forwarding
slug: async-routes-and-error-forwarding
metadescription: Learn how Express 5 catches errors from async route handlers automatically, how it replaces the Express 4 try/catch and next(err) pattern, and what it still misses.
updateDate: 2026-10-25T09:22
author: ['bishal-biswas']
level: 2
tags: ['express', 'async-await', 'error-handling', 'express-5']
course: expressjs
---

## What you will learn

- What happens when an `async` route handler fails
- The Express 4 way: `try/catch` and `next(err)` in every route
- How **Express 5 forwards async errors automatically**, and how it works under the hood
- The cases Express 5 still **cannot** catch, and how to handle them
- When a `try/catch` is still the right tool

This is one of the most important improvements in Express 5. Take your time with it.

## Why routes are async

Real routes rarely answer instantly. They read from a database, call another API or read a file. These tasks take time, so JavaScript uses **promises**: objects that represent "a value that will arrive later, or an error".

With `async/await` you write that waiting code in a friendly, top-to-bottom style:

```js
// app.js
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id); // waits for the database
  res.json(user);
});
```

An **`async` function** always returns a promise. If anything inside it throws, or an `await`ed promise fails, that returned promise becomes **rejected**. A **rejected promise** is simply a promise that ended with an error instead of a value.

The big question is: who notices that rejected promise?

## The Express 4 problem

Express 4 was designed before `async/await` existed. It called your handler and **ignored whatever it returned**. If your async handler failed, the rejected promise went nowhere.

```text
Express 4

request --> your async handler --> throws inside "await"
                                       |
                                       v
                           rejected promise returned
                                       |
                                       v
                          Express 4 ignores it  -->  ???
```

On modern Node.js versions an **unhandled rejection** (a rejected promise nobody handles) crashes the whole process by default. So one failing database call for one user could take the server down for everyone. On older setups the request just hung forever instead. Neither is acceptable.

### The Express 4 fix: try/catch in every route

To stay safe in Express 4, you had to catch the error yourself and hand it to Express with `next(err)`:

```js
// Express 4 style: manual error forwarding
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await db.findUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err); // send the error to Express's error handlers
  }
});
```

This works, but imagine 60 routes, each wrapped in the same five lines. Forget it once and you have a crash waiting to happen.

Developers invented workarounds. The most popular was a small **wrapper function** that catches the rejection for you:

```js
// Express 4 helper: wrap every async handler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user);
}));
```

Packages like `express-async-handler` and `express-async-errors` did the same thing. They all existed to patch one missing feature.

## The Express 5 fix: it is built in

In Express 5, the wrapper is part of Express itself. When your handler or middleware **returns a promise that rejects**, Express catches it and calls `next(err)` for you.

```js
// Express 5: no try/catch, no wrapper
app.get('/users/:id', async (req, res) => {
  const user = await db.findUser(req.params.id); // if this throws...
  res.json(user);
});
// ...Express 5 forwards the error to the error handlers automatically
```

```text
Express 5

request --> your async handler --> throws inside "await"
                                       |
                                       v
                           rejected promise returned
                                       |
                                       v
                Express 5 catches it and calls next(err)
                                       |
                                       v
                           error-handling middleware
```

**Think of it like a safety net under a trapeze.** In Express 4, every performer had to bring their own net (`try/catch`). In Express 5, the circus installs one net under the whole stage.

### How it works under the hood

There is no magic. Express 5's router does roughly this for every handler:

```js
// a simplified view of what Express 5 does internally
try {
  const result = handler(req, res, next);
  if (result instanceof Promise) {
    result.catch((err) => next(err)); // the built-in safety net
  }
} catch (err) {
  next(err); // synchronous errors were always caught, even in Express 4
}
```

So the rule is simple: **if the error ends up in the promise your handler returns, Express 5 sees it.** Keep this rule in mind; it explains every case in the rest of this lesson.

## See it in action

Let's build a tiny app with a fake database that sometimes fails.

```js
// app.js
import express from 'express';

const app = express();

// pretend database call
const findUser = async (id) => {
  if (id === '0') {
    throw new Error('Database connection lost');
  }
  return { id, name: 'Asha' };
};

app.get('/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);
  res.json(user);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

```bash
curl -i http://localhost:3000/users/1
curl -i http://localhost:3000/users/0
```

The first request returns the user. The second fails, but the server stays up and replies with a 500:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html lang="en">
...
<pre>Error: Database connection lost<br> &nbsp; &nbsp;at findUser ...</pre>
...
```

That HTML comes from Express's **default error handler**, the fallback that runs when you have not written your own. It shows the stack trace while developing and hides it when `NODE_ENV=production`. You will replace it with your own JSON-friendly handler in the next lesson.

> **Note:** You do not even need the `next` parameter in async handlers anymore, unless you call `next()` yourself. Writing `async (req, res) => { ... }` is perfectly fine.

## It works for middleware too

The safety net covers every function Express calls: route handlers, `app.use()` middleware, router middleware and handler chains.

```js
// app.js
const loadAccount = async (req, res, next) => {
  res.locals.account = await findUser(req.get('X-User-Id')); // may throw
  next();
};

app.get('/me', loadAccount, (req, res) => {
  res.json(res.locals.account);
});
```

If `findUser` throws, `next()` is never reached, the returned promise rejects, and Express forwards the error. The second handler never runs.

It also covers plain functions that **return** a promise, even without the `async` keyword:

```js
// app.js: returning a promise chain works too
app.get('/users-promise/:id', (req, res) =>
  findUser(req.params.id).then((user) => res.json(user)),
);
```

## What Express 5 still cannot catch

Remember the rule: Express only sees errors that end up in the **returned** promise (or that are thrown synchronously). Here are the cases that escape the net.

| Situation | Caught by Express 5? |
| --- | --- |
| `throw` in a normal (sync) handler | Yes (Express 4 too) |
| `throw` or failed `await` in an `async` handler | **Yes** |
| A returned promise chain that rejects | **Yes** |
| A promise you start but do not `await` or `return` | **No** |
| `throw` inside a callback (`setTimeout`, old callback APIs, event listeners) | **No** |

### Case 1: forgetting await

```js
// BAD: the promise is not awaited
app.post('/orders', async (req, res) => {
  saveOrder(req.body); // no await! if this rejects, nobody catches it
  res.status(201).json({ ok: true });
});
```

The handler's own promise resolves immediately, so Express sees "success". When `saveOrder` fails a moment later, it becomes an unhandled rejection. The fix is one word:

```js
// GOOD
app.post('/orders', async (req, res) => {
  await saveOrder(req.body);
  res.status(201).json({ ok: true });
});
```

> **Tip:** If you really want "fire and forget" background work, attach your own `.catch()` to log the error: `sendWelcomeEmail(user).catch((err) => console.error(err));`.

### Case 2: errors inside callbacks

```js
// BAD: the throw happens later, inside a timer callback
app.get('/later', (req, res) => {
  setTimeout(() => {
    throw new Error('Too late to catch'); // crashes the process
  }, 100);
});
```

By the time the callback runs, the handler has already returned. The error is not in any promise Express is watching. For callback-style code, call `next(err)` yourself:

```js
// GOOD: forward callback errors manually
app.get('/later', (req, res, next) => {
  setTimeout(() => {
    try {
      riskyWork();
      res.send('Done');
    } catch (err) {
      next(err);
    }
  }, 100);
});
```

Even better, turn the callback into a promise so you can `await` it. Node has promise versions of most APIs, such as `node:fs/promises` and `node:timers/promises`:

```js
// GOOD: promise-based APIs keep errors inside the net
import { readFile } from 'node:fs/promises';

app.get('/notes', async (req, res) => {
  const text = await readFile('notes.txt', 'utf8'); // missing file -> forwarded
  res.type('text').send(text);
});
```

> **Warning:** Some libraries still use callbacks, for example parts of `express-session` you will meet later. Inside those callbacks, always check for an error and call `next(err)` yourself.

## When you still want try/catch

Automatic forwarding is for **unexpected** errors: "the database is down, show a 500". But some errors are **expected**, and you want to handle them right there in the route.

Use `try/catch` when you want to **recover** or **translate** an error, not just pass it on:

```js
// app.js
app.post('/users', async (req, res) => {
  try {
    const user = await db.createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    throw err; // anything else: let Express 5 forward it
  }
});
```

Notice the `throw err` at the end. You handle the one case you understand and re-throw the rest. Express 5 then forwards it like any other error.

Here is a quick guide:

| Goal | What to write |
| --- | --- |
| Unexpected failure should become a 500 | Nothing extra: just `await` |
| Turn a specific error into a 404 or 409 | `try/catch`, respond, re-throw others |
| Use a fallback value if something fails | `try/catch` and continue |
| Signal an error yourself | `throw new Error(...)` (or `next(err)`) |

## Express 4 vs Express 5 at a glance

| | Express 4 | Express 5 |
| --- | --- | --- |
| Async error in a handler | Unhandled rejection: crash or hung request | Forwarded to `next(err)` automatically |
| Needed boilerplate | `try/catch` + `next(err)` or a wrapper in every async route | None |
| Wrapper packages | Common (`express-async-handler`, `express-async-errors`) | Not needed; remove them when migrating |
| Callback errors | Call `next(err)` yourself | Still call `next(err)` yourself |

## Common mistakes

> **Common mistake:** Keeping old `try { ... } catch (err) { next(err) }` blocks that do nothing else. They still work in Express 5, but they are noise. Delete them, unless the `catch` actually handles something.

> **Common mistake:** Catching an error and forgetting to respond or re-throw. An empty `catch {}` swallows the error and leaves the request hanging.

> **Common mistake:** Calling an async function inside `array.forEach()`. `forEach` does not wait for promises, so failures escape. Use `for...of` with `await`, or `await Promise.all(items.map(...))`.

## Key takeaways

- An `async` handler returns a promise. If it rejects, Express 5 **automatically** calls `next(err)` with the error.
- In Express 4 you needed `try/catch` + `next(err)` or a wrapper in every async route. Express 5 makes that unnecessary.
- The net only catches errors in the **returned** promise. Always `await` (or `return`) your promises.
- Errors thrown inside **callbacks** still need a manual `next(err)`. Prefer promise-based APIs.
- Use `try/catch` only when you want to **handle** a specific error, and re-throw everything else.

## Practice

1. Build the fake `findUser` app above. Request `/users/0` and confirm the server keeps running after the error.
2. Remove the `await` in front of `findUser` and request `/users/0` again. What happens to the process? Put the `await` back.
3. Write a route that reads a file with `node:fs/promises`. Request it with a file that does not exist and watch the error reach the default handler.
4. Write a `POST /users` route that throws an error with `code: 'DUPLICATE_EMAIL'` when the name is `taken`. Turn that case into a 409 and let all other errors pass through.

## What's next

Errors now reach Express reliably. Next, take control of what the user sees by writing your own error handler. Continue with [Error-Handling Middleware](/courses/expressjs/error-handling-middleware).

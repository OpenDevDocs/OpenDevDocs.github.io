---
publishDate: 2026-10-25T09:21
title: Route Handlers, next() and Chaining
slug: route-handlers-and-next
metadescription: Learn how to give one Express 5 route several handler functions, pass control with next(), skip ahead with next('route'), and share data between steps safely.
updateDate: 2026-10-25T09:21
author: ['bishal-biswas']
level: 2
tags: ['express', 'routing', 'middleware', 'next']
course: expressjs
---

## What you will learn

- How to give a single route **several handler functions** in a row
- Exactly what `next()` does, and the special values `next('route')` and `next('router')`
- How to pass data from one handler to the next with `res.locals`
- The rule "respond once", and how to avoid the "headers already sent" error

## One route, many functions

So far most of your routes had one function: receive the request, send a response. But a route can have **as many handler functions as you like**. Express runs them left to right, like stations on an assembly line.

**Think of it like airport security.** You show your ticket, then your bag is scanned, then you walk through the metal detector. Each station either lets you continue or stops you. Only when you pass every station do you reach the gate.

In Express, each station is a **route handler**: a function with `(req, res, next)`. Calling `next()` means "you may pass to the next station".

```js
// app.js
import express from 'express';

const app = express();

const checkTicket = (req, res, next) => {
  console.log('1. ticket checked');
  next();
};

const scanBag = (req, res, next) => {
  console.log('2. bag scanned');
  next();
};

app.get('/gate', checkTicket, scanBag, (req, res) => {
  console.log('3. at the gate');
  res.send('Welcome aboard');
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

```bash
curl http://localhost:3000/gate
```

Terminal output from the server:

```text
1. ticket checked
2. bag scanned
3. at the gate
```

The last function does not call `next()`. It sends the response, which ends the request.

> **Note:** "Middleware" and "route handler" are the same kind of function. We usually say **middleware** when it runs for many routes (via `app.use`) and **route handler** when it is attached to one route (via `app.get` and friends). Express treats them the same way.

## What next() really means

`next` is a function Express gives you. When you call it, you are telling Express: "I am done, run the next matching function." Express looks at its list in order and picks the next one whose method and path match.

There are only a few things a handler can do:

| What the handler does | What happens |
| --- | --- |
| Sends a response (`res.send`, `res.json`, ...) | The request is finished. Later handlers do not run. |
| Calls `next()` | Express runs the next matching handler. |
| Calls `next(err)` with an error | Express skips to the error handlers (covered soon). |
| Calls `next('route')` | Express skips the rest of **this route's** handlers. |
| Calls `next('router')` | Express skips the rest of **this router**. |
| Does nothing | The request **hangs** until the client gives up. |

That last row is the most common bug. If a handler neither responds nor calls `next()`, the browser spins forever.

## Arrays of handlers

You can also pass handlers as an **array**. This is handy when the same group of checks is used on many routes.

```js
// app.js
const requireJson = (req, res, next) => {
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Send JSON please' });
  }
  next();
};

const requireName = (req, res, next) => {
  if (!req.body?.name) {
    return res.status(400).json({ error: 'name is required' });
  }
  next();
};

const validateUser = [requireJson, requireName];

app.use(express.json());

app.post('/users', validateUser, (req, res) => {
  res.status(201).json({ name: req.body.name });
});

app.put('/users/:id', validateUser, (req, res) => {
  res.json({ id: req.params.id, name: req.body.name });
});
```

Express flattens arrays, so you can even mix them: `app.post('/x', [a, b], c, [d])` runs `a`, `b`, `c`, `d` in that order.

Try the failure path:

```bash
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{}'
```

```text
{"error":"name is required"}
```

> **Tip:** Notice `return res.status(400).json(...)`. The `return` stops the function right there, so the code below it (including `next()`) never runs. Making "return when you respond early" a habit prevents a whole class of bugs.

## Sharing data between handlers

Handlers often need to pass information along. Maybe the first one loads a user and the last one sends it. You have two common places to put that data:

1. **`res.locals`**: an empty object Express creates fresh for every request. It is the official place for "data for this request only".
2. **A property on `req`**: such as `req.user`. Very common in libraries, especially for login data.

```js
// app.js
const users = [{ id: 1, name: 'Asha' }];

const loadUser = (req, res, next) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.locals.user = user; // hand it to the next step
  next();
};

app.get('/users/:id', loadUser, (req, res) => {
  res.json(res.locals.user);
});

app.delete('/users/:id', loadUser, (req, res) => {
  users.splice(users.indexOf(res.locals.user), 1);
  res.status(204).end();
});
```

Now the "find or 404" logic lives in one place, and every route that needs a user gets it for free.

> **Note:** `res.locals` is also automatically available inside templates. You will see this in [Template Engines: EJS, Pug and Handlebars](/courses/expressjs/template-engines).

## Async handlers in a chain

Handlers can be `async`. You simply `await` your work and then call `next()`:

```js
// app.js
const fetchWeather = async (city) => ({ city, tempC: 21 }); // pretend API call

const loadWeather = async (req, res, next) => {
  res.locals.weather = await fetchWeather(req.params.city);
  next();
};

app.get('/weather/:city', loadWeather, (req, res) => {
  res.json(res.locals.weather);
});
```

Express does not wait for "the promise to finish, then continue". You still decide when to continue by calling `next()`. What Express 5 does add is a safety net for errors in async functions. That is the whole topic of the next lesson.

## Skipping ahead with next('route')

Sometimes a handler decides "this route is not for me after all". Calling **`next('route')`** skips the remaining handlers of the current route and moves on to the **next route** that matches.

A classic example is a special value in a URL parameter:

```js
// app.js
app.get(
  '/users/:id',
  (req, res, next) => {
    if (req.params.id === 'me') {
      return next('route'); // jump to the next matching route
    }
    next();
  },
  (req, res) => {
    res.send(`Profile of user ${req.params.id}`);
  },
);

app.get('/users/:id', (req, res) => {
  res.send('Your own profile');
});
```

```bash
curl http://localhost:3000/users/5
curl http://localhost:3000/users/me
```

```text
Profile of user 5
Your own profile
```

> **Warning:** `next('route')` only works in handlers added with `app.METHOD()` or `router.METHOD()` (like `app.get`). Inside `app.use()` middleware it has no "current route" to skip, so it behaves like a plain `next()`.

## Leaving a router with next('router')

**`next('router')`** is the bigger sibling. It skips **everything left in the current router** and goes back to the parent app, which keeps looking for a match after the router.

```js
// routes/beta.js
import { Router } from 'express';

const router = Router();

router.use((req, res, next) => {
  if (req.get('X-Beta') !== 'yes') {
    return next('router'); // not a beta user: leave this router
  }
  next();
});

router.get('/', (req, res) => res.send('New beta dashboard'));

export default router;
```

```js
// app.js
import betaRouter from './routes/beta.js';

app.use('/dashboard', betaRouter);
app.get('/dashboard', (req, res) => res.send('Classic dashboard'));
```

Normal users see the classic dashboard. Users who send `X-Beta: yes` see the new one. You use this one rarely, but it is good to recognise it.

## Grouping methods with app.route()

When one path has handlers for several HTTP methods, `app.route()` (and `router.route()`, from the previous lesson) keeps them together. Each method can still have its own chain:

```js
// app.js
app
  .route('/books/:id')
  .all(loadBook) // runs for every method on this path
  .get((req, res) => res.json(res.locals.book))
  .delete(requireAdmin, (req, res) => res.status(204).end());
```

`.all()` attaches handlers that run for any method, which is perfect for a shared "load the item" step.

## Respond exactly once

Every request gets **one** response. Once you call `res.send()`, `res.json()` or similar, the status and headers have left the server. You cannot send a second response.

If you try, Node throws this error:

```text
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
```

The usual causes are:

```js
// BAD: responds twice
app.get('/bad', (req, res, next) => {
  if (!req.query.q) {
    res.status(400).send('Missing q'); // no return!
  }
  res.send('Searching...'); // still runs, second response
});

// BAD: responds AND calls next
app.get('/also-bad', (req, res, next) => {
  res.send('Done');
  next(); // later handler may try to respond again
});
```

The fix for both is the same: `return` when you respond early, and never call `next()` after you have responded.

## Common mistakes

> **Common mistake:** Calling `next()` twice, for example once inside an `if` and once after it. The next handler then runs twice and usually triggers "headers already sent".

> **Common mistake:** Writing `next` without calling it: `next;` instead of `next();`. The line does nothing and the request hangs.

> **Common mistake:** Expecting `return` to move to the next handler. `return` only ends your function. Express only moves on when you call `next()` or send a response.

## Key takeaways

- A route can have many handlers, passed one by one or as arrays. Express runs them in order.
- Every handler must either **send a response** or **call `next()`**. Doing neither makes the request hang.
- `next('route')` skips to the next matching route. `next('router')` leaves the current router.
- Share per-request data with **`res.locals`** (or a property on `req`).
- Respond **exactly once**. Use `return res...` for early exits to avoid `ERR_HTTP_HEADERS_SENT`.

## Practice

1. Write a `/greet/:name` route with three handlers: one that trims the name, one that capitalises it, and one that responds with `Hello, <Name>!`. Pass the value along with `res.locals`.
2. Create a reusable `requireQuery('q')` function that returns a middleware which sends 400 when that query parameter is missing. Use it on two routes.
3. Use `next('route')` to make `/products/featured` return a special list while `/products/:id` handles every other id.
4. Deliberately trigger `ERR_HTTP_HEADERS_SENT`, read the stack trace, then fix it with `return`.

## What's next

You have seen async handlers in a chain. Now learn what happens when they fail, and how Express 5 catches those failures for you. Continue with [Async Routes and Automatic Error Forwarding](/courses/expressjs/async-routes-and-error-forwarding).

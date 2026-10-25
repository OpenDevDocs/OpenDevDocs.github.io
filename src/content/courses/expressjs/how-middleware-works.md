---
publishDate: 2026-10-25T09:17
title: How the Middleware Stack Works
slug: how-middleware-works
metadescription: Understand Express middleware step by step, how a request travels through the middleware stack, what next() does, and why the order of app.use calls matters.
updateDate: 2026-10-25T09:17
author: ['bishal-biswas']
level: 2
tags: ['express', 'middleware', 'next', 'request-lifecycle']
course: expressjs
---

## What you will learn

- What **middleware** is, in plain words
- How Express builds a **middleware stack** and walks a request through it
- The three things a middleware can do: pass the request on, answer it, or pass an error
- Why the **order** of `app.use()` calls changes how your app behaves
- How to run middleware for every request, for one path prefix, or for one route

You have already used middleware without knowing it: `express.json()` and `express.static()` are both middleware. This lesson explains what was happening behind the scenes.

## What is middleware?

**Middleware** is a function that runs *in the middle*, between the moment a request arrives and the moment your route sends a response. It can look at the request, change it, answer it, or simply let it continue.

**Think of airport security.** Before you reach your plane (the route), you pass a series of checkpoints in a fixed order: check-in, ID check, bag scan, boarding gate. Each checkpoint can wave you through to the next one, or stop you right there. Nobody skips ahead, and the order never changes.

```text
  Passenger arrives
        |
        v
  [ Check-in ]  ---> ok, go on
        |
        v
  [ ID check ]  ---> no ID? stopped here, never reaches the plane
        |
        v
  [ Bag scan ]  ---> ok, go on
        |
        v
  [ Boarding gate ]  ---> board the plane (the response)
```

In Express, each checkpoint is a middleware function. Your route handler is the last checkpoint: the one that actually sends the response.

## The shape of a middleware function

A middleware function receives three arguments:

```js
const myMiddleware = (req, res, next) => {
  // 1. look at or change req and res
  // 2. then either answer, or call next()
  next();
};
```

| Argument | What it is |
| --- | --- |
| `req` | The request object you already know |
| `res` | The response object you already know |
| `next` | A function. Calling it means "I am done, pass the request to the next middleware." |

You register middleware for every request with `app.use()`:

```js
app.use(myMiddleware);
```

Look familiar? A route handler like `(req, res) => res.send('hi')` is just a middleware that answers and never calls `next`. Routes and middleware are the same kind of thing.

## The middleware stack

Every time you call `app.use()`, `app.get()`, `app.post()` and so on, Express adds an entry to an internal list. This list is called the **middleware stack**. When a request arrives, Express starts at the top of the list and walks down, one entry at a time.

Here is a small app:

```js
// app.js
import express from 'express';

const app = express();

app.use((req, res, next) => {
  console.log('1. logger:', req.method, req.originalUrl);
  next();
});

app.use((req, res, next) => {
  console.log('2. add a timestamp');
  req.requestTime = new Date().toISOString(); // add our own property to req
  next();
});

app.get('/hello', (req, res) => {
  console.log('3. route handler');
  res.send(`Hello! Request received at ${req.requestTime}`);
});

app.get('/bye', (req, res) => {
  res.send('Goodbye!');
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Run `curl http://localhost:3000/hello` and look at your terminal:

```text
1. logger: GET /hello
2. add a timestamp
3. route handler
```

This is how the request travelled:

```text
 Request: GET /hello
      |
      v
 +-------------------------------+
 | 1. logger          (app.use)  |  logs, then next()
 +-------------------------------+
      |
      v
 +-------------------------------+
 | 2. timestamp       (app.use)  |  sets req.requestTime, then next()
 +-------------------------------+
      |
      v
 +-------------------------------+
 | 3. GET /hello      (app.get)  |  matches! sends the response. Stop.
 +-------------------------------+
      :
      :   (never reached)
 +-------------------------------+
 | 4. GET /bye        (app.get)  |
 +-------------------------------+

 Response: 200 "Hello! Request received at 2026-10-25T09:17:00.000Z"
```

Notice two things:

1. The timestamp middleware **added a property to `req`**. The route could read it later. This is how middleware passes information down the line. Parsers do exactly this: `express.json()` fills `req.body`.
2. The stack **stops** as soon as someone sends a response. `GET /bye` is never even checked.

## Matching: which entries run?

Express does not run every entry for every request. For each entry, it asks: "Does this one match the request?"

- `app.use(fn)` with no path matches **every** request, any method.
- `app.get('/hello', fn)` matches only `GET` requests to exactly `/hello`.

If an entry does not match, Express silently skips it. For a request to `/bye`:

```text
 Request: GET /bye
      |
      v
 [1. logger]         matches everything  -> runs, next()
      |
      v
 [2. timestamp]      matches everything  -> runs, next()
      |
      v
 [3. GET /hello]     path is /bye        -> skipped
      |
      v
 [4. GET /bye]       matches!            -> sends "Goodbye!"
```

And if nothing sends a response by the end of the stack, Express's own built-in "not found" handler answers with `404 Cannot GET /path`.

## The three choices of a middleware

Every middleware must do **one** of these things:

| Choice | Code | Result |
| --- | --- | --- |
| Pass it on | `next()` | Express moves to the next matching entry. |
| Answer | `res.send(...)`, `res.json(...)` and similar | The response goes out. The rest of the stack is skipped. |
| Report an error | `next(err)` | Express jumps to error-handling middleware. |

There is a fourth thing that can happen by accident: **doing nothing**. If a middleware neither calls `next()` nor sends a response, the request is stuck. The client waits until it gives up.

```js
// Bug: this request will hang forever
app.use((req, res, next) => {
  console.log('I forgot to call next()');
});
```

> **Common mistake:** Forgetting `next()` is the number one middleware bug. If your browser keeps loading forever and the terminal shows no error, check that every middleware either calls `next()` or sends a response.

### Answering early: a gatekeeper

A middleware can stop a request before it reaches the route. This is how login checks work.

```js
// app.js
app.use((req, res, next) => {
  if (req.get('X-Api-Key') !== 'change-me') {
    return res.status(401).json({ error: 'Missing or wrong API key' });
  }
  next(); // key is fine, continue
});

app.get('/api/data', (req, res) => {
  res.json({ secret: 42 });
});
```

```text
 Request without key                    Request with key
      |                                      |
      v                                      v
 [API key check] --> 401, stop          [API key check] --> next()
                                             |
                                             v
                                        [GET /api/data] --> 200 { secret: 42 }
```

Notice the `return` before `res.status(...)`. It stops the function, so `next()` is not also called. Answering *and* calling `next()` leads to the "Cannot set headers after they are sent" error you met in [The Response Object](/courses/expressjs/the-response-object).

> **Note:** A hard-coded key like `'change-me'` is only for learning. Real keys come from environment variables, as you saw in [Environment Variables and Configuration](/courses/expressjs/environment-variables-and-config).

### Passing an error

If something goes wrong, call `next(err)` with an error object. Express then **skips all normal middleware and routes** and jumps straight to **error-handling middleware**: special middleware with four arguments, `(err, req, res, next)`.

```text
 [1. logger]          next()
      |
      v
 [2. load user]       next(new Error('Database down'))
      |
      |  error! skip every normal entry
      |------------------------------------+
      :                                    |
 [3. GET /profile]    skipped              |
      :                                    |
      v                                    v
 [error handler (err, req, res, next)]  <--+  sends 500 response
```

In Express 5, you often do not even need to call `next(err)` yourself. If an `async` middleware or route throws an error or a promise rejects, Express forwards it for you. You will learn all about this in [Async Routes and Automatic Error Forwarding](/courses/expressjs/async-routes-and-error-forwarding) and [Error-Handling Middleware](/courses/expressjs/error-handling-middleware).

## Order is everything

Because Express walks the stack top to bottom, the order you write your code in **is** the order things happen. Small changes in order can break an app in confusing ways.

### Example 1: a parser placed too late

```js
// Bug: the route runs before the JSON parser
app.post('/api/notes', (req, res) => {
  res.json(req.body); // undefined
});

app.use(express.json()); // too late for the route above
```

```text
 POST /api/notes
      |
      v
 [POST /api/notes]   req.body is undefined -> sends response, stop
      :
 [express.json()]    never reached
```

Fix: move `app.use(express.json())` above the routes.

### Example 2: a logger placed after the routes

```js
app.get('/hello', (req, res) => res.send('Hi'));

app.use((req, res, next) => {
  console.log('Request:', req.originalUrl); // only runs for unmatched URLs!
  next();
});
```

The route answers and the stack stops, so the logger never sees `/hello`. It only logs requests that no route matched.

### A good default order

Most Express apps follow roughly this layout:

```text
 +---------------------------------------------+
 | 1. App-wide middleware                      |  logging, security headers,
 |    app.use(...)                             |  body parsers, static files
 +---------------------------------------------+
 | 2. Routes                                   |  app.get, app.post, routers
 +---------------------------------------------+
 | 3. 404 handler                              |  app.use((req, res) => ...)
 |    (runs if no route answered)              |
 +---------------------------------------------+
 | 4. Error handler                            |  app.use((err, req, res, next) => ...)
 |    (runs when something called next(err))  |
 +---------------------------------------------+
```

You will build parts 3 and 4 in [Error-Handling Middleware](/courses/expressjs/error-handling-middleware) and [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

## Three ways to attach middleware

### 1. For every request: `app.use(fn)`

```js
app.use(logger); // runs for every method and every path
```

### 2. For a path prefix: `app.use(path, fn)`

```js
app.use('/admin', requireAdmin);
```

With a path, `app.use()` matches that path **and everything below it**. This is called **prefix matching**. Compare it with `app.get()`, which needs the whole path to match:

| Request path | `app.use('/admin', fn)` | `app.get('/admin', fn)` |
| --- | --- | --- |
| `/admin` | Runs | Runs (if `GET`) |
| `/admin/users` | Runs | Does not run |
| `/admin/users/7` | Runs | Does not run |
| `/administrator` | Does not run (not a full segment) | Does not run |
| `/` | Does not run | Does not run |

`app.use()` also matches **any method**: `GET`, `POST`, `DELETE`, all of them.

Inside a middleware mounted with a path, Express trims the prefix from `req.url` and stores it in `req.baseUrl`. For a request to `/admin/users`:

```js
app.use('/admin', (req, res, next) => {
  console.log(req.baseUrl);     // '/admin'
  console.log(req.url);         // '/users'
  console.log(req.originalUrl); // '/admin/users' (always the full URL)
  next();
});
```

This trimming is what makes routers work, as you will see in [express.Router and Modular Routes](/courses/expressjs/express-router-and-modular-routes).

> **Warning:** Do not write `app.use('*', fn)` to mean "everything". In Express 5 a bare `'*'` path throws an error. Just leave the path out: `app.use(fn)`.

### 3. For one route: pass it before the handler

You can list middleware functions directly in a route. They run in order, only for that route.

```js
const checkApiKey = (req, res, next) => {
  if (req.get('X-Api-Key') !== 'change-me') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/public', (req, res) => res.send('Anyone can see this'));

app.get('/private', checkApiKey, (req, res) => {
  res.send('Only callers with a key see this');
});
```

```text
 GET /private
      |
      v
 [checkApiKey]  --> next()
      |
      v
 [handler]      --> sends response
```

You can pass several middleware, or an array of them: `app.post('/notes', checkApiKey, express.json(), handler)`. This is called **route-level middleware**, and it is perfect for things that only some routes need, like login checks or validation.

## Kinds of middleware

You will hear these names often. They are not different mechanisms, just different places a middleware comes from or is attached to.

| Kind | Example | Where it is attached |
| --- | --- | --- |
| **Application-level** | `app.use(logger)` | Directly on `app` |
| **Route-level** | `app.get('/x', checkKey, handler)` | On one route |
| **Router-level** | `router.use(fn)` | On an `express.Router()` |
| **Built-in** | `express.json()`, `express.static()` | Comes with Express |
| **Third-party** | `cors()`, `helmet()`, `morgan('dev')` | Installed from npm |
| **Error-handling** | `(err, req, res, next) => {}` | Four arguments, placed last |

Notice that `express.json()` has brackets. It is a function that **creates** a middleware function. You call it once, and it returns the real `(req, res, next)` function that goes into the stack. Most third-party middleware works the same way. You will write middleware like this yourself in the next lesson.

## What about code after `next()`?

`next()` is a normal function call. When it returns, your middleware keeps running from the next line.

```js
app.use((req, res, next) => {
  console.log('before');
  next();
  console.log('after next() returned');
});
```

It is tempting to use this to measure how long a request took. But if a later handler is `async` (for example, it waits for a database), `next()` returns **before** the response is sent. The "after" line then runs too early.

The reliable way to run code once the response is finished is to listen for the response's `finish` event. You will use that trick in [Writing Custom Middleware](/courses/expressjs/writing-custom-middleware).

## Common mistakes

**Forgetting `next()`.** The request hangs. Every middleware must call `next()` or send a response.

**Calling `next()` after sending a response.** Use `return res.status(...).json(...)` so the function stops.

**Registering middleware after the routes that need it.** Parsers, loggers and auth checks must come before the routes.

**Using `app.get()` when you meant `app.use()`.** `app.get('/admin', fn)` only matches `GET /admin` exactly. `app.use('/admin', fn)` covers every method and every path below `/admin`.

**Writing `app.use(express.json)` without brackets.** That passes the factory itself, not the middleware it creates. Always call it: `express.json()`.

## Key takeaways

- Middleware is a function `(req, res, next)` that runs between the request arriving and the response leaving.
- Express keeps every `app.use()` and route in one ordered list, the middleware stack, and walks it top to bottom.
- A middleware must either call `next()`, send a response, or call `next(err)`. Doing nothing makes the request hang.
- Order matters: put app-wide middleware first, then routes, then the 404 handler, then the error handler.
- `app.use(path, fn)` matches the path and everything below it, for any method. Route-level middleware runs for one route only.
- Middleware can add properties to `req`, which later middleware and routes can read.

## Practice

1. Build the three-step app from this lesson. Add a fourth `app.use()` that logs `'4. after routes'`. Request `/hello` and then `/nothing`. When does step 4 run, and why?
2. Remove the `next()` call from the timestamp middleware. What happens in the browser? Put it back.
3. Add a middleware with `app.use('/admin', ...)` that logs `req.baseUrl`, `req.url` and `req.originalUrl`. Request `/admin`, `/admin/users` and `/administrator`.
4. Create a route-level middleware that only lets requests through if `req.query.debug === 'yes'`. Attach it to one route and confirm other routes are not affected.

## What's next

Now that you know how the stack works, it is time to build your own useful pieces for it in [Writing Custom Middleware](/courses/expressjs/writing-custom-middleware).

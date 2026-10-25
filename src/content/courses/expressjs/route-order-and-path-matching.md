---
publishDate: 2026-10-25T09:10
title: Route Order and Path Matching
slug: route-order-and-path-matching
metadescription: Learn how Express 5 checks routes from top to bottom, why specific routes must come before general ones, and how trailing slashes, letter case and app.use prefixes affect matching.
updateDate: 2026-10-25T09:10
author: ['bishal-biswas']
level: 1
tags: ['express', 'routing', 'path-matching', 'debugging']
course: expressjs
---

## What you will learn

- How Express searches your routes **from top to bottom** and stops at the first match
- Why `/users/new` must come **before** `/users/:id`
- Where catch-all routes and "not found" handlers belong
- How Express treats trailing slashes, upper and lower case, and the query string
- How `app.use()` matches paths differently from `app.get()`

## The rule: first match wins

When a request arrives, Express doesn't search your routes in a clever way. It walks through them **in the order you wrote them**, from the top of the file to the bottom. For each route it asks two questions:

1. Does the **method** match (for example `GET`)?
2. Does the **path** match?

The first route where both answers are "yes" runs its handler. If that handler sends a response, the search is over. Routes further down never even see the request.

```text
 Request: GET /users/new

  app.get('/users', ...)        path doesn't match  -> skip
  app.post('/users', ...)       method doesn't match -> skip
  app.get('/users/:id', ...)    match! run handler, send response  -> STOP
  app.get('/users/new', ...)    never checked
```

**Think of a queue of shop assistants.** You walk along the counter, asking each one "can you help me with this?". The first one who says yes serves you, and you leave. It doesn't matter that a specialist was standing further down the line.

This simple rule explains almost every "why is the wrong route running?" puzzle you will meet.

## The classic bug: a parameter swallows a fixed path

Here is a very common mistake. Can you spot it?

```js
// server.js
import express from 'express';

const app = express();

app.get('/users/:id', (req, res) => {
  res.send(`Showing user ${req.params.id}`);
});

app.get('/users/new', (req, res) => {
  res.send('Form to create a new user');
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

```bash
curl http://localhost:3000/users/new
```

```text
Showing user new
```

The second route never runs. `/users/:id` means "`/users/` followed by **any** single segment", and `new` is a perfectly good segment. Express reaches `/users/:id` first, captures `id = 'new'`, and responds.

The fix is to put the **specific** route (fixed text) **before** the **general** route (a parameter):

```js
// server.js (fixed)
app.get('/users/new', (req, res) => {
  res.send('Form to create a new user');
});

app.get('/users/:id', (req, res) => {
  res.send(`Showing user ${req.params.id}`);
});
```

```bash
curl http://localhost:3000/users/new
curl http://localhost:3000/users/42
```

```text
Form to create a new user
Showing user 42
```

> **Tip:** A good habit: inside each group of routes, list fixed paths first, then paths with parameters, then wildcards. Specific to general, top to bottom.

## Methods don't compete with each other

Order only matters between routes that could match the **same** request. A `GET` route and a `POST` route never compete, even with the same path:

```js
app.post('/users/:id', (req, res) => res.send('POST handler'));
app.get('/users/new', (req, res) => res.send('GET handler'));
```

`GET /users/new` skips the first route (wrong method) and runs the second. `POST /users/new` runs the first. No conflict.

## Duplicate routes: the second one is ignored

What if you accidentally register the same method and path twice?

```js
app.get('/about', (req, res) => res.send('First about page'));
app.get('/about', (req, res) => res.send('Second about page'));
```

```bash
curl http://localhost:3000/about
```

```text
First about page
```

Express does **not** warn you. The first handler responds, and the second is dead code. This often happens in big files or when copying routes around, so if a change to a route "does nothing", search the project for a duplicate path.

> **Note:** A handler *can* choose to pass the request on to the next matching route instead of responding, by calling a function named `next()`. That's an intentional technique, and you'll learn it in [Route Handlers, next() and Chaining](/courses/expressjs/route-handlers-and-next). Without it, the first match always ends the search.

## Catch-alls go last

A **catch-all** route matches every path. In Express 5 it's written with a named wildcard, such as `'/{*splat}'` (see [Route Parameters and path-to-regexp v8 Syntax](/courses/expressjs/route-parameters-and-path-to-regexp)). Because it matches everything, it must be the **last** route, or it hides every route below it:

```js
// Wrong: the catch-all is first, so /about can never be reached
app.get('/{*splat}', (req, res) => res.send('Catch-all'));
app.get('/about', (req, res) => res.send('About'));
```

```js
// Right: real routes first, catch-all last
app.get('/about', (req, res) => res.send('About'));
app.get('/{*splat}', (req, res) => res.send('Catch-all'));
```

A common real use is a **single-page app** (a front-end app such as React that handles its own pages in the browser): your API routes come first, and a final catch-all sends the app's `index.html` for every other `GET` path.

### The "not found" handler goes after everything

When nothing matches, Express sends its default `404` page (`Cannot GET /something`). To send your own, add a plain `app.use()` handler **after all your routes**. It has no path, so it runs for any request that got this far, meaning no route answered:

```js
// server.js (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: `Nothing found at ${req.method} ${req.originalUrl}` });
});
```

Move it to the top and every request gets a `404`. Order matters here too. You'll build polished versions in [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

## How a path is compared

So far, "the path matches" has meant "the text looks the same". Here are the exact rules Express 5 uses for `app.get()`, `app.post()` and the other route methods.

### The whole path must match

A route path must match the **entire** path, not just the beginning. `app.get('/users', ...)` matches `/users` but **not** `/users/42` or `/users-list`.

### The query string is ignored

Everything after `?` is set aside before matching. These all match `app.get('/search', ...)`:

```text
/search
/search?q=shoes
/search?q=shoes&page=2
```

The query values are still available in `req.query`, as you saw in [Query Strings and the Query Parser](/courses/expressjs/query-strings-and-query-parser).

### A trailing slash is optional by default

`app.get('/about', ...)` matches both `/about` and `/about/`. One extra slash is allowed; `/about//` does not match.

### Letter case is ignored by default

`app.get('/About', ...)` matches `/about`, `/ABOUT` and `/About`. Only the **path** is case-insensitive; the values you capture keep their original case. With `app.get('/users/:name', ...)`, a request for `/USERS/Asha` gives `req.params.name === 'Asha'`.

### Making matching stricter

Two app settings change these defaults. Set them right after creating the app, before your routes:

```js
// server.js
const app = express();

app.set('case sensitive routing', true); // '/About' no longer matches '/about'
app.set('strict routing', true);         // '/about' no longer matches '/about/'
```

| Request | Default | With `case sensitive routing` | With `strict routing` |
| --- | --- | --- | --- |
| Route `/about`, request `/about/` | match | match | **no match** |
| Route `/About`, request `/about` | match | **no match** | match |

Most apps keep the defaults. They are friendlier to people typing URLs by hand.

### Encoded slashes stay inside a parameter

Parameters never span a real `/`, but an **encoded** slash (`%2F`) is decoded **after** matching. So `/users/:id` matches `/users/a%2Fb`, and `req.params.id` is `'a/b'`. Keep this in mind if you use a parameter to build file paths; never trust it without checking.

## app.use() matches by prefix

`app.use()` is mostly used for **middleware**: functions that run for many requests, such as `express.json()`. It follows a different rule from `app.get()`: its path is a **prefix**. It matches the path itself **and anything below it**.

```js
app.use('/admin', (req, res) => {
  res.send(`Admin area. originalUrl=${req.originalUrl}, url=${req.url}`);
});
```

| Request | Matches `app.use('/admin', ...)`? | `req.url` inside |
| --- | --- | --- |
| `/admin` | Yes | `/` |
| `/admin/users/1` | Yes | `/users/1` |
| `/administrator` | No: prefixes match whole segments only | - |

Notice that inside `app.use`, Express **strips the prefix** from `req.url`, while `req.originalUrl` keeps the full original path. This is what lets routers be mounted at a prefix, which you'll use in [express.Router and Modular Routes](/courses/expressjs/express-router-and-modular-routes).

`app.use()` without a path means "every request", which is why `app.use(express.json())` runs for all routes and why the 404 handler above catches everything.

### Middleware order matters too

Because everything runs top to bottom, middleware only affects routes registered **after** it:

```js
// Wrong: this route runs before express.json() and sees req.body as undefined
app.post('/books', (req, res) => res.json({ body: req.body }));
app.use(express.json());
```

```js
// Right: set up middleware first, then routes
app.use(express.json());
app.post('/books', (req, res) => res.json({ body: req.body }));
```

You'll explore this properly in [How the Middleware Stack Works](/courses/expressjs/how-middleware-works).

## A recommended file order

Putting it all together, a typical Express file is laid out like this:

```text
1. Create the app and change settings     const app = express(); app.set(...)
2. Global middleware                       app.use(express.json()), logging...
3. Routes, grouped by resource
     - fixed paths first                   /users/new, /users/me
     - then parameters                     /users/:id
     - then wildcards                      /files/*filepath
4. Catch-all routes (if any)               app.get('/{*splat}', ...)
5. 404 handler                             app.use((req, res) => ...)
6. Error handler                           app.use((err, req, res, next) => ...)
7. app.listen (in server.js)
```

The error handler at step 6 is covered in [Error-Handling Middleware](/courses/expressjs/error-handling-middleware).

## Debugging "the wrong route ran"

When a request reaches an unexpected handler, work through this checklist:

1. **Is a general route above a specific one?** Look for `:param` or wildcard routes above the one you expected.
2. **Is there a duplicate?** Search your project for the path text.
3. **Is the method right?** A browser address bar always sends `GET`. Check `curl -X` or your API client.
4. **Is a catch-all or 404 handler too high?** It must be at the bottom.
5. **Is the path spelled the same?** Remember case and trailing slashes are forgiven by default, but `/user` and `/users` are different.

A quick trick is to log which handler answered:

```js
app.get('/users/:id', (req, res) => {
  console.log('Matched /users/:id with', req.params);
  res.send(`Showing user ${req.params.id}`);
});
```

## Key takeaways

- Express checks routes **top to bottom**; the first route whose **method and path** match handles the request.
- Put **specific** paths (like `/users/new`) **before** general ones (like `/users/:id`), and catch-alls and the 404 handler **last**.
- Duplicate routes don't cause errors: the first one silently wins.
- Route paths must match the **whole** path. The query string is ignored, a trailing slash is optional, and case doesn't matter by default (`strict routing` and `case sensitive routing` change this).
- `app.use(path, ...)` matches by **prefix** and strips that prefix from `req.url`; middleware only affects routes registered after it.

## Practice

1. Recreate the `/users/:id` and `/users/new` bug, confirm it with curl, then fix it by reordering.
2. Add `GET /users/me` that returns `{ "name": "You" }`. Where does it need to go, and why?
3. Turn on `strict routing` and test `/about` and `/about/` with curl. Then turn it off again.
4. Add a custom 404 handler with `app.use`. Move it to the top of the file, observe what breaks, then move it back to the bottom.

## What's next

You can now control exactly which route handles each request. Next, look closely at everything a request carries. Continue with [The Request Object](/courses/expressjs/the-request-object).

---
publishDate: 2026-10-25T09:25
title: Not Found and Fallback Handling
slug: not-found-handling
metadescription: Learn how to replace Express's default 404 page with your own JSON or HTML response, return 405 for wrong methods, and add a safe single-page app fallback in Express 5.
updateDate: 2026-10-25T09:25
author: ['bishal-biswas']
level: 2
tags: ['express', 'error-handling', '404', 'routing']
course: expressjs
---

## What you will learn

- What Express does when **no route matches** a request
- How to write a custom **404 handler**, and exactly where to put it
- How to send JSON 404s for your API and HTML 404s for your website
- When to use **405 Method Not Allowed** instead of 404
- How to add a **fallback route** for single-page apps with Express 5's path syntax

## When nothing matches

You have handled errors that routes throw. But there is one situation where no route even runs: someone asks for a URL you never defined, like `/pizza` or a typo such as `/usres`.

Express walks through every middleware and route. If it reaches the end without anyone sending a response, it gives up and sends a **404 Not Found**. **404** is the HTTP status code that means "there is nothing at this address".

Here is what that default response looks like:

```bash
curl -i http://localhost:3000/nope
```

```http
HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /nope</pre>
</body>
</html>
```

It is correct, but it is HTML, it looks plain, and the "Cannot GET" wording is a well-known sign of an Express server. For an API you want JSON. For a website you want a friendly page with a link home.

> **Note:** A 404 is **not** an error in Express's eyes. Nothing was thrown; the request simply ran out of handlers. That is why your error handler from the last two lessons does not see it. You need a separate 404 handler.

## The 404 handler: a catch-all at the end

**Think of it like the last stop on a bus line.** Every passenger who did not get off earlier ends up there. In Express, a 404 handler is plain middleware placed **after all your routes**. Any request that reaches it was not handled by anything before.

```js
// app.js
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Home');
});

app.get('/about', (req, res) => {
  res.send('About');
});

// 404 handler: after all routes, no path
app.use((req, res) => {
  res.status(404).json({ error: `Cannot find ${req.method} ${req.originalUrl}` });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

```bash
curl http://localhost:3000/pizza
```

```text
{"error":"Cannot find GET /pizza"}
```

Three things make this work:

1. It uses **`app.use()` with no path**, so it matches every method and every URL.
2. It sits **after** every route, so it only runs when nothing else responded.
3. It has **two parameters** `(req, res)`, so it is normal middleware, not an error handler.

> **Warning:** In Express 4 you may have seen `app.get('*', ...)` or `app.all('*', ...)` used for this. In Express 5, a bare `'*'` path **throws an error** when the app starts, because wildcards must now have a name. A path-less `app.use()` is the simplest, most reliable 404 handler.

## The full order of an app

With 404 handling, your app has a clear top-to-bottom shape. Memorise it; almost every Express app follows it.

```text
1. app settings          app.set(...)
2. global middleware     express.json(), logging, static files
3. routes / routers      app.use('/users', usersRouter) ...
4. 404 handler           app.use((req, res) => ...)
5. error handler(s)      app.use((err, req, res, next) => ...)
6. start the server      app.listen(...)
```

If the 404 handler comes before your routes, **every** request gets a 404. If it comes after the error handler, it still works for unmatched URLs, but keeping it just above the error handler is the convention everyone expects.

## Sending 404s through the error handler

If you built the custom error classes from the previous lesson, there is an even tidier option. Instead of responding directly, the 404 handler can **create** a `NotFoundError` and pass it on:

```js
// app.js
import { NotFoundError } from './errors.js';

// ...routes...

app.use((req, res, next) => {
  next(new NotFoundError(`Cannot find ${req.method} ${req.originalUrl}`, { code: 'ROUTE_NOT_FOUND' }));
});

app.use((err, req, res, next) => {
  // the same error handler as before formats every error,
  // including 404s, in one consistent shape
});
```

Now "route does not exist" and "user does not exist" produce exactly the same JSON structure. Your frontend only needs one way to read errors.

> **Tip:** You could also write `throw new NotFoundError(...)` instead of `next(...)`. Both reach the error handler. Using `next(err)` here makes the intent obvious to readers.

## JSON for the API, HTML for the website

Many apps serve both an API under `/api` and normal web pages. Each needs a different kind of 404. You can add a **scoped** 404 handler for the API, then a general one for everything else:

```js
// app.js
import express from 'express';
import apiRouter from './routes/api.js';

const app = express();

app.use(express.static('public'));
app.use('/api', apiRouter);

// 404 for anything under /api that the API router did not handle
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// 404 for everything else: a friendly HTML page
app.use((req, res) => {
  res.status(404).send('<h1>Page not found</h1><p><a href="/">Go home</a></p>');
});
```

Another approach is to let the client tell you what it wants. The `Accept` request header lists the formats a client prefers, and **`req.accepts()`** picks the best match:

```js
// app.js
app.use((req, res) => {
  res.status(404);
  if (req.accepts(['html', 'json']) === 'html') {
    return res.send('<h1>Page not found</h1>');
  }
  res.json({ error: 'Not found' });
});
```

Browsers ask for HTML first, so they get the page. `fetch()` calls and tools that ask for JSON get JSON.

> **Note:** Once you learn templates in the next lesson, you can replace the inline HTML with `res.status(404).render('404')` and get a fully styled page.

## 404 vs 405: wrong address or wrong method?

Suppose your API has `GET /books` and `POST /books`, and someone sends `DELETE /books`. The address exists; only the **method** is wrong. The precise status for that is **405 Method Not Allowed**, and the response should include an **`Allow`** header listing the methods that do work.

Express returns a 404 for this by default. Most APIs are fine with that, but if you want to be precise, `app.route().all()` makes it easy:

```js
// app.js
app
  .route('/books')
  .get((req, res) => res.json([]))
  .post((req, res) => res.status(201).json({ created: true }))
  .all((req, res) => {
    // any other method on /books lands here
    res.set('Allow', 'GET, POST').status(405).json({ error: 'Method not allowed' });
  });
```

```bash
curl -i -X DELETE http://localhost:3000/books
```

```http
HTTP/1.1 405 Method Not Allowed
Allow: GET, POST
Content-Type: application/json; charset=utf-8

{"error":"Method not allowed"}
```

> **Tip:** Express automatically answers `HEAD` requests using your `GET` routes, so you do not need to list `HEAD` handlers yourself.

## Fallback routes for single-page apps

Frontend frameworks like React or Vue often build a **single-page app (SPA)**: one `index.html` file whose JavaScript decides what to show for each URL. The browser might ask your server for `/dashboard/settings`, a page that exists only in the frontend's router.

Your server should answer such requests with `index.html` so the frontend can take over. This is called a **fallback route**.

In Express 5, a wildcard route must have a **name**. `'/*splat'` matches any path with at least one segment, and `'/{*splat}'` also matches the root `/`:

```js
// app.js
import path from 'node:path';
import express from 'express';
import apiRouter from './routes/api.js';

const app = express();
const publicDir = path.join(import.meta.dirname, 'public');

app.use('/api', apiRouter);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' }); // API 404s stay JSON
});

app.use(express.static(publicDir)); // real files: JS, CSS, images

// SPA fallback: every other GET request gets index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

> **Note:** `import.meta.dirname` (the folder of the current file) needs Node.js 20.11 or newer. On older versions, use `path.dirname(fileURLToPath(import.meta.url))` from `node:url`.

The order here is important:

1. **API routes first**, followed by the API 404. A typo in an API URL must return a JSON 404, not your HTML page.
2. **Static files next**, so `/assets/app.js` returns the real file.
3. **The fallback last**. Only `GET` requests that matched nothing else get `index.html`.

Using `app.get` instead of `app.use` means a stray `POST /something` still falls through to a real 404 instead of receiving an HTML page.

> **Warning:** Do not write `app.get('*', ...)`. In Express 5 the old unnamed `*` wildcard is invalid and the app will fail at startup. Use `'/*splat'` or `'/{*splat}'`.

## Common mistakes

> **Common mistake:** Putting the 404 handler above your routers. Every request matches it first, so the whole app returns 404. Keep it near the bottom.

> **Common mistake:** Adding `next` to a 404 handler and then calling `next()`. There is nothing left to run, so Express falls back to its own HTML 404. Either respond, or call `next(err)` with an error.

> **Common mistake:** Placing the SPA fallback before the API. Then `/api/unknown` returns `index.html` with status 200, and frontend code receives HTML when it expected JSON.

## Key takeaways

- A request that matches nothing is **not an error**; Express just ends up with no response and sends its default 404.
- Write a 404 handler with **`app.use((req, res) => ...)`** after all routes and before the error handler.
- Pass a `NotFoundError` to `next(err)` if you want 404s to share your error format.
- Use scoped handlers or `req.accepts()` to send JSON 404s to API clients and HTML to browsers.
- For SPAs, use a named wildcard like **`'/{*splat}'`**, placed after API routes and static files. Bare `'*'` throws in Express 5.

## Practice

1. Add a JSON 404 handler to one of your apps. Request three made-up URLs and check the status code with `curl -i`.
2. Change the handler to call `next(new NotFoundError(...))` and confirm the response uses your error handler's format.
3. Add `.all()` to one `app.route()` so unsupported methods return 405 with an `Allow` header.
4. Create a `public/index.html` and add an SPA fallback. Check that `/`, `/settings` and `/a/b/c` all return the page, while `/api/nope` returns JSON.

## What's next

Your HTML responses so far are strings inside JavaScript. Time to build real pages with layouts and data. Continue with [Template Engines: EJS, Pug and Handlebars](/courses/expressjs/template-engines).

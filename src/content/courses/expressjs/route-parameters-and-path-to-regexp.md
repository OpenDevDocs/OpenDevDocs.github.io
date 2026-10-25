---
publishDate: 2026-10-25T09:08
title: Route Parameters and path-to-regexp v8 Syntax
slug: route-parameters-and-path-to-regexp
metadescription: Master Express 5 route paths - named parameters, optional parts with braces, named wildcards like /*splat, regular expression routes, and the old Express 4 patterns that now throw.
updateDate: 2026-10-25T09:08
author: ['bishal-biswas']
level: 1
tags: ['express', 'routing', 'route-parameters', 'path-to-regexp']
course: expressjs
---

## What you will learn

- How **route parameters** like `:id` capture parts of a URL into `req.params`
- How to use several parameters, and parameters separated by `-` or `.`
- How to make part of a path **optional** with braces: `'/users{/:id}'`
- How **named wildcards** work in Express 5: `'/*splat'` and `'/{*splat}'`
- When to use a **regular expression** route, and which old Express 4 patterns now throw errors

In the last lesson you wrote `'/books/:id'`. That little `:id` is the start of a whole mini-language for describing URLs. Express 5 uses a library called **path-to-regexp** (version 8) to understand it. Version 8 is stricter than what Express 4 used, so this lesson teaches the exact rules, including the old patterns you'll still see in tutorials that no longer work.

## Why route parameters?

Imagine an online shop with 10,000 products. You can't write 10,000 routes:

```js
app.get('/products/1', ...);
app.get('/products/2', ...);
// ... no thanks
```

Instead, you write **one** route with a placeholder:

```js
app.get('/products/:id', (req, res) => {
  res.send(`You asked for product ${req.params.id}`);
});
```

A **route parameter** is a named placeholder in a path. It starts with a colon (`:`) and matches whatever text is in that position of the URL. Express collects all parameters in the **`req.params`** object.

**Think of a form letter:** "Dear `___`, your order `___` has shipped." The blanks are the parameters; each real letter fills them in differently.

| Route path | Request URL | `req.params` |
| --- | --- | --- |
| `/products/:id` | `/products/42` | `{ id: '42' }` |
| `/products/:id` | `/products/blue-shirt` | `{ id: 'blue-shirt' }` |
| `/products/:id` | `/products` | no match (404) |
| `/products/:id` | `/products/42/reviews` | no match (404) |

Two rules from this table matter a lot:

1. A parameter must have **some** text. `/products` alone does not match.
2. A parameter matches **one segment** only. A **segment** is the text between two slashes, so a parameter never contains a `/`.

## Parameters are always strings

Everything in a URL is text, so `req.params.id` is always a **string**, even when it looks like a number:

```js
// server.js
import express from 'express';

const app = express();

const products = [
  { id: 1, name: 'Mug' },
  { id: 2, name: 'Notebook' },
];

app.get('/products/:id', (req, res) => {
  const id = Number(req.params.id); // '2' -> 2

  // Reject anything that isn't a whole positive number, like 'abc' or '2.5'
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'id must be a positive whole number' });
  }

  const product = products.find((p) => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

```bash
curl http://localhost:3000/products/2
curl http://localhost:3000/products/abc
curl http://localhost:3000/products/99
```

```text
{"id":2,"name":"Notebook"}
{"error":"id must be a positive whole number"}
{"error":"Product not found"}
```

> **Common mistake:** Comparing `p.id === req.params.id`. The left side is the number `2`, the right side is the string `'2'`, so `===` is always `false` and every lookup "fails". Convert first.

> **Tip:** `400 Bad Request` means "your request makes no sense" (an id of `abc`). `404 Not Found` means "it makes sense, but that thing doesn't exist" (an id of `99`). Using the right one helps people who use your API.

### Encoded characters are decoded for you

URLs can't contain spaces or some other characters directly, so browsers **encode** them, for example a space becomes `%20`. Express **decodes** parameters before giving them to you:

```js
app.get('/search/:term', (req, res) => {
  res.json({ term: req.params.term });
});
```

```bash
curl http://localhost:3000/search/hello%20world
```

```text
{"term":"hello world"}
```

## Several parameters in one path

You can use as many parameters as you need. Give each one a different name:

```js
app.get('/users/:userId/posts/:postId', (req, res) => {
  res.json(req.params);
});
```

```bash
curl http://localhost:3000/users/7/posts/42
```

```text
{"userId":"7","postId":"42"}
```

### Parameters inside one segment

A parameter name ends at the first character that can't be part of a name. That means a `-` or `.` can separate two parameters **inside one segment**:

```js
// /flights/LAX-SFO  ->  { from: 'LAX', to: 'SFO' }
app.get('/flights/:from-:to', (req, res) => {
  res.json(req.params);
});

// /download/report.pdf  ->  { file: 'report', ext: 'pdf' }
app.get('/download/:file.:ext', (req, res) => {
  res.json(req.params);
});
```

With `/download/archive.tar.gz`, `file` becomes `'archive.tar'` and `ext` becomes `'gz'`: the last dot is used as the separator.

### Naming rules

Parameter names must be valid **JavaScript identifiers**: letters, digits, `_` and `$`, and they can't start with a digit. Good names: `:id`, `:userId`, `:post_id`.

A name with any other character must be wrapped in double quotes:

```js
// Quoted name: req.params['my-param']
app.get('/:"my-param"', (req, res) => {
  res.json(req.params);
});
```

> **Warning:** Without the quotes, `'/:my-param'` does **not** throw an error. It means "a parameter called `my`, followed by the literal text `-param`". So `/abc-param` matches with `{ my: 'abc' }` and `/abc` gives a 404. This is a sneaky bug; prefer camelCase names like `:myParam`.

A colon with no valid name after it, such as `'/:1abc'` or `'/a/:'`, throws `Missing parameter name` when the route is created.

## Optional parts: braces

Sometimes part of a path may or may not be present. In Express 5, you wrap the optional part in **braces** `{ }`. Everything inside the braces is either fully there or fully absent.

```js
// Matches /users and /users/7
app.get('/users{/:id}', (req, res) => {
  if (req.params.id) {
    return res.send(`One user: ${req.params.id}`);
  }
  res.send('All users');
});
```

| Request | `req.params` | Response |
| --- | --- | --- |
| `/users` | `{}` | `All users` |
| `/users/7` | `{ id: '7' }` | `One user: 7` |

Notice that the slash is **inside** the braces: `{/:id}`. That way `/users` is valid without a trailing slash. When the optional part is missing, the parameter is simply not in `req.params`, so `req.params.id` is `undefined`.

More examples:

```js
// Optional file extension: /photo or /photo.jpg
app.get('/:file{.:ext}', (req, res) => {
  const ext = req.params.ext ?? 'none';
  res.send(`File ${req.params.file}, extension: ${ext}`);
});

// Optional static text plus parameter: /products or /products/page/3
app.get('/products{/page/:page}', (req, res) => {
  const page = Number(req.params.page ?? '1'); // default to page 1
  res.send(`Showing page ${page}`);
});
```

> **Note:** In Express 4 you wrote optional parameters with a question mark: `'/users/:id?'`. That syntax is **gone** in Express 5. `'/users/:id?'` now throws `Unexpected ? at index 10` as soon as the route is registered. Use `'/users{/:id}'` instead.

> **Tip:** Optional parameters are handy, but two separate routes (`/users` and `/users/:id`) are often clearer, especially when they do very different things. Use braces when the two versions really share the same handler.

## Wildcards: matching many segments

A normal parameter stops at the next `/`. Sometimes you want to capture **everything** after a point, slashes included, for example a file path like `docs/guides/intro.md`.

A **wildcard** does this. In Express 5, a wildcard is a `*` followed by a **name**, just like parameters have names:

```js
// Matches /files/a.txt, /files/docs/guides/intro.md, ...
app.get('/files/*filepath', (req, res) => {
  console.log(req.params.filepath); // [ 'docs', 'guides', 'intro.md' ]
  res.send(`You asked for ${req.params.filepath.join('/')}`);
});
```

```bash
curl http://localhost:3000/files/docs/guides/intro.md
```

```text
You asked for docs/guides/intro.md
```

Three things to notice:

1. The wildcard has a name, `filepath`. You can choose any valid name; you'll often see `splat` in examples.
2. `req.params.filepath` is an **array of segments**, not a string. Use `.join('/')` to turn it back into a path.
3. A wildcard needs **at least one** segment. `/files` and `/files/` do not match this route.

> **Warning:** A bare `*` without a name throws an error in Express 5. `app.get('*', ...)` and `app.get('/files/*', ...)` both fail with `Missing parameter name` when the route is registered. Old tutorials use them everywhere; always give the wildcard a name.

### Matching the root as well: `'/{*splat}'`

`'/*splat'` matches every path **except** the root `/`, because a wildcard needs at least one segment. If you want to match **every** path including `/`, make the wildcard optional by wrapping it in braces:

| Route path | `/` | `/about` | `/a/b/c` |
| --- | --- | --- | --- |
| `'/*splat'` | no match | `splat: ['about']` | `splat: ['a', 'b', 'c']` |
| `'/{*splat}'` | match, `splat` is `undefined` | `splat: ['about']` | `splat: ['a', 'b', 'c']` |

```js
// Catch every GET path, including the home page
app.get('/{*splat}', (req, res) => {
  const parts = req.params.splat ?? []; // undefined for '/'
  res.send(`Path segments: ${parts.length}`);
});
```

A catch-all route like this must come **after** your other routes, or it would grab their requests too. You'll see why in [Route Order and Path Matching](/courses/expressjs/route-order-and-path-matching).

> **Tip:** You don't need a wildcard to make a "page not found" handler. A plain `app.use((req, res) => ...)` at the end of your routes does that job. See [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

## Special characters are reserved

In Express 4, string paths could contain little bits of regular expression syntax like `'/ab+cd'` or `'/users/:id(\\d+)'`. Express 5 removed all of that, because it was confusing and caused security problems.

In a string path, these characters have special meaning or are **reserved** (kept for possible future use):

```text
:  *  {  }       used by the syntax: parameters, wildcards, optional parts
(  )  [  ]  ?  +  !   reserved: using them throws an error
\                     escapes the next character
```

| Express 4 path | What happens in Express 5 |
| --- | --- |
| `'/users/:id?'` | Throws `Unexpected ?` |
| `'/users/:id(\\d+)'` | Throws `Unexpected (` |
| `'/ab+cd'` | Throws `Unexpected +` |
| `'*'` or `'/files/*'` | Throws `Missing parameter name` |

If you need one of these characters **literally** in a URL, escape it with a backslash. In a JavaScript string you type the backslash twice:

```js
// Matches the literal URL /price(usd)
app.get('/price\\(usd\\)', (req, res) => {
  res.send('Prices in US dollars');
});
```

> **Note:** These errors happen when the route is **registered**, which is when your server starts. That's good news: a broken path crashes immediately with a clear message pointing at the bad character, instead of silently misbehaving later.

## Regular expression routes

What if you really want "only digits" or some other pattern? Pass a **regular expression** (a **RegExp**, a pattern-matching mini-language built into JavaScript) instead of a string. A RegExp is written between slashes, not quotes:

```js
// Only matches /orders/ followed by digits, e.g. /orders/1234
app.get(/^\/orders\/(\d+)$/, (req, res) => {
  res.json({ orderId: req.params[0] });
});
```

- `^` and `$` mean "start" and "end". Always include them, otherwise the pattern can match in the middle of a longer URL, such as `/x/orders/12/y`.
- `\/` is an escaped slash, and `(\d+)` captures one or more digits.
- Unnamed captures appear as `req.params[0]`, `req.params[1]`, and so on.

Use **named groups** to get readable names, written `(?<name>...)`:

```js
// /orders/1234 -> req.params.orderId === '1234'
app.get(/^\/orders\/(?<orderId>\d+)$/, (req, res) => {
  res.json({ orderId: req.params.orderId });
});
```

```bash
curl http://localhost:3000/orders/1234
curl -i http://localhost:3000/orders/abc
```

```text
{"orderId":"1234"}
HTTP/1.1 404 Not Found
...
```

Regular expressions are powerful but hard to read. For most apps, a simple `'/orders/:orderId'` route that **checks** the value inside the handler (as in the products example earlier) is clearer and gives a friendlier `400` error instead of a `404`. Thorough input checking is covered in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod).

## Express 4 to Express 5 cheat sheet

| What you want | Express 4 (old) | Express 5 (now) |
| --- | --- | --- |
| Required parameter | `'/users/:id'` | `'/users/:id'` (unchanged) |
| Optional parameter | `'/users/:id?'` | `'/users{/:id}'` |
| Optional extension | `'/:file.:ext?'` | `'/:file{.:ext}'` |
| Match all paths except `/` | `'*'` or `'/*'` | `'/*splat'` |
| Match all paths including `/` | `'*'` | `'/{*splat}'` |
| Wildcard value | `req.params[0]` (a string) | `req.params.splat` (an **array**) |
| Digits-only parameter | `'/users/:id(\\d+)'` | `/^\/users\/(?<id>\d+)$/` or check in the handler |
| Odd parameter name | `'/:my-param'` | `'/:"my-param"'` |

You can read the full list of changes in [Express 5 Breaking Changes Reference](/courses/expressjs/express-5-breaking-changes).

## Common mistakes

> **Common mistake:** Copying `app.get('*', ...)` from an old tutorial. The server crashes at startup with `Missing parameter name`. Use `'/{*splat}'`, or, for a 404 page, `app.use((req, res) => ...)` after all routes.

> **Common mistake:** Treating a wildcard as a string. `req.params.splat.toUpperCase()` fails because `splat` is an array. Use `req.params.splat.join('/')` first.

> **Common mistake:** Forgetting that optional parameters can be `undefined`. Always provide a default, such as `req.params.page ?? '1'`.

## Key takeaways

- `:name` captures **one segment** of the URL into `req.params.name`. Values are always **strings**; convert and check them.
- Parameter names are JavaScript identifiers. Quote anything else: `'/:"my-param"'`.
- Wrap optional parts in **braces**: `'/users{/:id}'`, `'/:file{.:ext}'`. The old `?` suffix throws in Express 5.
- Wildcards must be **named**: `'/*splat'` gives an **array** of segments; `'/{*splat}'` also matches `/`. A bare `'*'` throws.
- Characters like `( ) [ ] ? + !` are reserved in string paths. Escape them with `\\`, or use a **RegExp** route with `^` and `$`.

## Practice

1. Write `GET /hello/:name` that responds with `Hello, <name>!`. Test it with a name that contains a space, encoded as `%20`.
2. Write `GET /convert/:amount-:currency` (for example `/convert/50-EUR`) that returns `{ "amount": 50, "currency": "EUR" }` with `amount` as a real number.
3. Write one route that matches both `/blog` and `/blog/page/2`, defaulting to page 1.
4. Write `GET /docs/*docPath` that returns the requested path as a single string. What happens at `/docs` with no extra segments? Change the route so `/docs` also works.

## What's next

Paths are only part of the URL. The bit after the `?` carries extra options too. Continue with [Query Strings and the Query Parser](/courses/expressjs/query-strings-and-query-parser).

---
publishDate: 2026-10-25T09:56
title: Express 5 Breaking Changes Reference
slug: express-5-breaking-changes
metadescription: A quick reference of every important change between Express 4 and Express 5, with before and after code for routes, request, response, body parsing and app settings.
updateDate: 2026-10-25T09:56
author: ['bishal-biswas']
level: 4
tags: ['express', 'express-5', 'migration', 'reference']
course: expressjs
---

## What you will learn

- Which Express 4 features were **removed** in Express 5 and what replaces each one
- Which behaviours **changed silently**, so old code still runs but acts differently
- The new route path rules from path-to-regexp v8, side by side with the old ones
- How to spot Express 4 code in old tutorials and Stack Overflow answers

This page is a **reference**: a place to look things up, not a lesson to read top to bottom. Each change has a short table row and a before/after example. For the step-by-step process of upgrading a real project, see [Migrating from Express 4 to Express 5](/courses/expressjs/migrating-from-express-4-to-5).

## How to use this page

A **breaking change** is a change in a new version that can stop old code from working. Express 5 has two kinds, and they need different levels of care:

| Kind | What happens to old code | Example | How you find it |
| --- | --- | --- | --- |
| **Fails loudly** | Throws an error, often at startup | `app.get('*', ...)`, `app.del()` | Run the app and your tests; the error points at the line |
| **Changes silently** | Runs without errors but behaves differently | Default query parser, `req.body` default | Read this page and search your code; tests that check behaviour help |

The silent ones are the risky ones. They are marked **Silent** in the tables below.

> **Note:** Every example uses the Express 5 rules you learned in this course. The `// Express 4` half of each example shows old code you might meet in older projects or tutorials. Do not copy it into new code.

## Quick lookup: removed APIs

If you get an error such as `app.del is not a function`, find the old name here.

| Express 4 | Express 5 replacement |
| --- | --- |
| `app.del(path, ...)` | `app.delete(path, ...)` |
| `req.param('name')` | `req.params.name`, `req.body.name` or `req.query.name` |
| `res.send(404)` | `res.sendStatus(404)` |
| `res.send(body, 404)` | `res.status(404).send(body)` |
| `res.json(obj, 404)` | `res.status(404).json(obj)` |
| `res.sendfile(path)` | `res.sendFile(absolutePath)` |
| `res.redirect(url, 301)` | `res.redirect(301, url)` |
| `res.redirect('back')` | `res.redirect(req.get('Referrer') \|\| '/')` |
| `res.location('back')` | `res.location(req.get('Referrer') \|\| '/')` |
| `req.acceptsCharset()` | `req.acceptsCharsets()` |
| `req.acceptsEncoding()` | `req.acceptsEncodings()` |
| `req.acceptsLanguage()` | `req.acceptsLanguages()` |
| `app.router` | Nothing; just remove it. Routes are registered in order automatically |

## Runtime and installation

| Topic | Express 4 | Express 5 |
| --- | --- | --- |
| Node.js version | Worked on very old Node.js versions | **Node.js 18 or newer** |
| `npm install express` | Installed 4.x | Installs 5.x (the `latest` tag since 2025) |

### Node.js 18+

```bash
# Check before upgrading
node --version

# Express 4 project pinned to the old major version
npm install express@4

# Express 5 (the default)
npm install express
```

> **Tip:** Check `package.json` for `"express": "^4..."`. The caret (`^`) allows minor updates only, so an old project stays on Express 4 until someone changes it on purpose.

## Async error handling

| Topic | Express 4 | Express 5 |
| --- | --- | --- |
| Error thrown in an `async` handler | Not caught; an unhandled rejection, the request could hang | Forwarded to `next(err)` automatically |
| Rejected promise in middleware | Same problem | Forwarded to `next(err)` automatically |

```js
// Express 4: you had to catch and forward async errors yourself
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Express 5: a rejected promise goes to your error handler on its own
app.get('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user);
});
```

Wrapper helpers like `asyncHandler()` and packages such as `express-async-errors` are no longer needed. Covered in [Async Routes and Automatic Error Forwarding](/courses/expressjs/async-routes-and-error-forwarding).

## Route path syntax (path-to-regexp v8)

Express 5 uses a new version of **path-to-regexp**, the library that turns a route string like `/users/:id` into a matcher. The rules are stricter, which removes some confusing and unsafe patterns. Most of these changes **fail loudly**: Express throws an error when the route is registered, so you find them as soon as the app starts.

| Pattern | Express 4 | Express 5 |
| --- | --- | --- |
| Wildcard | `'/files/*'` | `'/files/*splat'` (must be named) |
| Wildcard value | `req.params[0]` is a string `'a/b/c'` | `req.params.splat` is an array `['a', 'b', 'c']` |
| Wildcard that also matches the root | `'*'` | `'/{*splat}'` |
| Bare `'*'` | Matched everything | **Throws an error** |
| Optional parameter | `'/users/:id?'` | `'/users{/:id}'` |
| Optional part | `'/:file.:ext?'` | `'/:file{.:ext}'` |
| Regex characters in strings | `'/user(s)?'`, `'/:id(\\d+)'`, `'/a+'` | Not allowed; use braces or a RegExp literal |
| Parameter names | Loose rules | Valid JavaScript identifiers, or quoted: `'/:"my-param"'` |
| 404 catch-all | `app.use('*', handler)` or `app.get('*', handler)` | A plain `app.use(handler)` after all routes |

### Named wildcards

```js
// Express 4
app.get('/files/*', (req, res) => {
  const filePath = req.params[0]; // 'docs/2026/report.pdf'
  res.send(filePath);
});

// Express 5: name the wildcard; the value is an array of segments
app.get('/files/*splat', (req, res) => {
  const filePath = req.params.splat.join('/'); // ['docs', '2026', 'report.pdf'] -> 'docs/2026/report.pdf'
  res.send(filePath);
});
```

### Matching everything, including the root

```js
// Express 4
app.get('*', (req, res) => {
  res.sendFile(path.resolve('dist/index.html')); // SPA fallback
});

// Express 5: '/*splat' needs at least one segment; '/{*splat}' also matches '/'
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.resolve('dist/index.html'));
});
```

### The 404 handler

```js
// Express 4 (often seen in tutorials)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express 5: no path at all, placed after every route
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

See [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

### Optional parameters

```js
// Express 4
app.get('/users/:id?', handler);
app.get('/files/:name.:ext?', handler);

// Express 5: wrap the optional part in braces
app.get('/users{/:id}', handler); // matches /users and /users/42
app.get('/files/:name{.:ext}', handler); // matches /files/report and /files/report.pdf
```

### Regex characters in string paths

```js
// Express 4
app.get('/user(s)?', handler); // /user or /users
app.get('/posts/:id(\\d+)', handler); // digits only

// Express 5: braces for optional literal text
app.get('/user{s}', handler);

// Express 5: a RegExp literal when you really need a pattern
app.get(/^\/posts\/(\d+)$/, (req, res) => {
  res.send(`Post ${req.params[0]}`); // regex groups are numbered
});

// Express 5: or a normal parameter and validation in the handler (often clearer)
app.get('/posts/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'id must be a number' });
  res.send(`Post ${req.params.id}`);
});
```

### Parameter names

```js
// Express 4: ':my-param' quietly meant a parameter called 'my' followed by '-param'
app.get('/items/:my-param', handler);

// Express 5: use a valid identifier, or quote the name
app.get('/items/:myParam', handler);
app.get('/items/:"my-param"', (req, res) => {
  res.send(req.params['my-param']);
});
```

Full details in [Route Parameters and path-to-regexp v8 Syntax](/courses/expressjs/route-parameters-and-path-to-regexp).

## The request object

| API | Express 4 | Express 5 | Kind |
| --- | --- | --- | --- |
| `req.query` | A normal, writable property | A **read-only getter** | Fails loudly when assigned |
| Default `query parser` | `'extended'` (nested objects from `?a[b]=1`) | `'simple'` (Node's `querystring`, no nesting) | **Silent** |
| `req.body` when nothing was parsed (no body, or a different `Content-Type`) | `{}` | `undefined` | **Silent** until you read a property |
| `express.urlencoded()` default | `extended: true` behaviour | `extended: false` | **Silent** |
| `req.param(name)` | Looked in params, body and query | Removed | Fails loudly |
| `req.acceptsCharset()` and friends | Singular names | Plural names only | Fails loudly |
| `req.host` | Host name without the port | Host name **with** the port | **Silent** |

### req.query is read-only

```js
// Express 4: replacing req.query after validation was a common pattern
app.get('/products', (req, res) => {
  req.query = schema.parse(req.query);
  res.json(req.query);
});

// Express 5: keep the parsed result in your own variable
app.get('/products', (req, res) => {
  const query = schema.parse(req.query);
  res.json(query);
});
```

In ES modules (which run in strict mode), assigning to `req.query` throws a `TypeError`. If middleware needs to pass validated values on, store them in `res.locals` or on a new property such as `req.validatedQuery`.

### Simple query parser by default

```js
// Request: GET /search?filter[color]=red&filter[size]=m

// Express 4 (extended parser)
req.query; // { filter: { color: 'red', size: 'm' } }

// Express 5 (simple parser)
req.query; // { 'filter[color]': 'red', 'filter[size]': 'm' }

// Express 5: opt back in to nested objects if your API relies on them
app.set('query parser', 'extended');
```

Repeated keys still become arrays with the simple parser: `?tag=a&tag=b` gives `{ tag: ['a', 'b'] }`. See [Query Strings and the Query Parser](/courses/expressjs/query-strings-and-query-parser).

### req.body is undefined when nothing was parsed

```js
app.use(express.json());

app.post('/notes', (req, res) => {
  const { title } = req.body;
  res.json({ title });
});

// A request with no body, or with Content-Type: text/plain instead of JSON:
// Express 4: the parser set req.body to {}, so title was simply undefined
// Express 5: req.body stays undefined, so the destructuring line throws a TypeError

// Express 5 fix: guard the read, then validate the value
app.post('/notes', (req, res) => {
  const title = req.body?.title;
  if (typeof title !== 'string') return res.status(400).json({ error: 'title is required' });
  res.json({ title });
});
```

If a route reads `req.body` and there is no parser registered at all, the value is `undefined` in both versions. Make sure `express.json()` (or the parser you need) is registered before your routes.

### urlencoded defaults to extended: false

```js
// Express 4: often written with the option, because of a deprecation warning
app.use(express.urlencoded({ extended: true }));

// Express 5: the default is extended: false (flat key/value pairs)
app.use(express.urlencoded());

// Express 5: say so explicitly if your forms send nested fields like user[name]
app.use(express.urlencoded({ extended: true }));
```

See [Built-in Body Parsers: express.json and urlencoded](/courses/expressjs/built-in-body-parsers).

### req.param() removed

```js
// Express 4: searched params, then body, then query
const id = req.param('id');

// Express 5: say exactly where the value comes from
const id = req.params.id; // from the path: /users/:id
const page = req.query.page; // from the query string: ?page=2
const email = req.body?.email; // from the request body
```

Being explicit is also safer: with `req.param()`, a value in the query string could override the one you expected from the body.

### Plural accepts methods

```js
// Express 4
req.acceptsCharset('utf-8');
req.acceptsEncoding('gzip');
req.acceptsLanguage('en');

// Express 5
req.acceptsCharsets('utf-8');
req.acceptsEncodings('gzip');
req.acceptsLanguages('en');
```

### req.host keeps the port

```js
// Request: GET http://localhost:3000/

// Express 4
req.host; // 'localhost'

// Express 5
req.host; // 'localhost:3000'
req.hostname; // 'localhost' (use this when you want the name only)
```

## The response object

| API | Express 4 | Express 5 | Kind |
| --- | --- | --- | --- |
| `res.send(status)` | Sent the status code | Removed: use `res.sendStatus()` | **Silent** (wrong status) |
| `res.send(body, status)` / `res.json(obj, status)` | Set status and body | Removed: the status argument is ignored | **Silent** (wrong status) |
| `res.status(code)` | Accepted almost anything | Integers **100-999** only; anything else throws | Fails loudly |
| `res.redirect(url, status)` | Accepted either order | Only `res.redirect(status, url)` | Fails or misbehaves |
| `res.redirect('back')` / `res.location('back')` | Magic value for the `Referrer` | Removed | **Silent** (redirects to a path called `back`) |
| `res.sendfile()` | Lowercase `f` | Removed: use `res.sendFile()` | Fails loudly |
| `res.clearCookie(name, options)` | Respected `maxAge` / `expires` | Ignores `maxAge` / `expires` | **Silent** (usually a fix) |

### Status codes: one way to set them

```js
// Express 4
res.send(404);
res.send('Not found', 404);
res.json({ error: 'Not found' }, 404);

// Express 5
res.sendStatus(404); // status plus the standard text 'Not Found'
res.status(404).send('Not found');
res.status(404).json({ error: 'Not found' });
```

> **Warning:** These are the most dangerous silent changes. Old code like `res.json(obj, 404)` still runs in Express 5, but the client receives `200 OK`. Search your code for `res.send(` and `res.json(` calls with two arguments.

### res.status() only accepts valid integers

```js
// Express 4: tolerated strings and odd values
res.status('404').send('Not found');

// Express 5: throws an error for '404', 404.5, 99 or 1000
res.status(404).send('Not found');

// Express 5: convert values that come from elsewhere, such as error objects
res.status(Number(err.status) || 500).json({ error: 'Something went wrong' });
```

### Redirect argument order

```js
// Express 4
res.redirect('/new-home', 301);

// Express 5: status first, then the URL
res.redirect(301, '/new-home');
```

### Redirecting "back"

```js
// Express 4
res.redirect('back');

// Express 5: read the Referrer header yourself, with a fallback
res.redirect(req.get('Referrer') || '/');
```

`req.get('Referrer')` also matches the misspelled `Referer` header that browsers actually send.

### res.sendfile() renamed

```js
// Express 4
res.sendfile('public/report.pdf');

// Express 5: an absolute path, or a relative path plus the root option
res.sendFile(path.resolve('public/report.pdf'));
res.sendFile('report.pdf', { root: 'public' });
```

See [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects).

### res.clearCookie() ignores maxAge and expires

```js
// Express 4: copying the original cookie options could break clearing,
// because maxAge pushed the expiry date into the future again
res.clearCookie('session', { httpOnly: true, secure: true, maxAge: 3600_000 });

// Express 5: maxAge and expires are ignored, so the cookie is always cleared.
// The path and domain must still match the cookie you set.
res.clearCookie('session', { httpOnly: true, secure: true, path: '/' });
```

See [Cookies with cookie-parser](/courses/expressjs/cookies-and-cookie-parser).

## The application object

| API | Express 4 | Express 5 | Kind |
| --- | --- | --- | --- |
| `app.del()` | Alias for `app.delete()` | Removed | Fails loudly |
| `app.router` | Leftover property from Express 3 | Removed | Fails loudly if used |
| `app.listen(port, callback)` errors | Emitted as an `error` event on the server; the callback never saw them | Passed to the callback as its first argument | **Silent** (errors may be swallowed) |

### app.del() removed

```js
// Express 4
app.del('/notes/:id', deleteNote);

// Express 5
app.delete('/notes/:id', deleteNote);
```

### app.router removed

```js
// Express 3 and old Express 4 code
app.use(app.router);

// Express 5: delete the line. Routes and middleware run in the order you register them.
```

### app.listen() reports errors to the callback

```js
// Express 4: a busy port crashed with an unhandled 'error' event
app.listen(3000, () => {
  console.log('Listening on 3000');
});

// Express 5: check the first argument, or the error is silently ignored
app.listen(3000, (error) => {
  if (error) throw error; // for example EADDRINUSE: the port is already in use
  console.log('Listening on 3000');
});
```

> **Common mistake:** Keeping the Express 4 callback with no parameter. If the port is busy, Express 5 calls your callback with the error, your code ignores it and logs "Listening on 3000" even though nothing is listening.

## Static files

| Option | Express 4 | Express 5 | Kind |
| --- | --- | --- | --- |
| `express.static` `dotfiles` | Some dot-folders (such as `.well-known/`) could still be served | `'ignore'` applies to all dotfiles and dot-folders | **Silent** (404 instead of the file) |

```js
// Express 4: files in public/.well-known/ were reachable
app.use(express.static('public'));

// Express 5: dotfiles and dot-folders are ignored by default.
// Serve the one folder that needs it, and keep the safe default for everything else.
app.use('/.well-known', express.static('public/.well-known', { dotfiles: 'allow' }));
app.use(express.static('public'));
```

This matters for things like `/.well-known/security.txt` and domain verification files. See [Serving Static Files with express.static](/courses/expressjs/serving-static-files).

## What did not change

It helps to know what you can leave alone. These work the same in Express 4 and Express 5:

- `express()`, `app.get/post/put/patch/delete/use`, `express.Router()`
- Middleware signature `(req, res, next)` and error handlers with four parameters `(err, req, res, next)`
- `express.json()`, `express.text()`, `express.raw()`, `express.static()` (apart from the defaults above)
- `res.json()`, `res.status()`, `res.send()` with one argument, `res.render()`, `res.cookie()`, `res.set()`
- `app.set('trust proxy', ...)`, `app.set('view engine', ...)`, `req.ip`, `req.params`, `req.get()`
- Most popular middleware: `cors`, `helmet`, `morgan`, `cookie-parser`, `express-session`, `multer`

## Spotting Express 4 code in the wild

When you read an older tutorial or answer, these are the giveaways:

| You see... | It is Express 4 because... |
| --- | --- |
| `app.get('*', ...)` or `app.use('*', ...)` | Unnamed wildcard |
| `'/:id?'` or `'/:id(\\d+)'` | Old optional and regex syntax |
| `try { ... } catch (err) { next(err) }` in every async route | Express 5 does this for you |
| `asyncHandler(...)` or `require('express-async-errors')` | Workarounds for Express 4 |
| `require('body-parser')` with `bodyParser.json()` | Works, but `express.json()` is built in |
| `res.send(404)`, `res.json(obj, 500)`, `res.redirect('back')` | Removed signatures |
| `req.param('id')`, `app.del(...)`, `res.sendfile(...)` | Removed methods |

## Key takeaways

- Express 5 needs **Node.js 18+** and forwards errors from `async` handlers automatically.
- Route strings follow path-to-regexp v8: named wildcards (`/*splat`, `/{*splat}`), braces for optional parts, no regex characters, and no bare `'*'`.
- Removed APIs (`app.del`, `req.param`, `res.sendfile`, old `res.send`/`res.json`/`res.redirect` signatures) have direct one-line replacements.
- The risky changes are the **silent** ones: the simple query parser, `req.body` being `undefined` when nothing was parsed, `urlencoded` `extended: false`, `req.host` with port, ignored status arguments, and `app.listen` errors in the callback.
- Use this page to look things up; use the migration guide for the upgrade process.

## Practice

1. Take this Express 4 snippet and rewrite it for Express 5: `app.get('/files/*', (req, res) => res.sendfile('uploads/' + req.params[0]))`. Check that it cannot read files outside `uploads/`.
2. Search an old Express project (or a tutorial) for every pattern in the "Spotting Express 4 code" table and list what you find.
3. Write a test with Supertest that sends `?filter[color]=red` and prints `req.query` with both the `'simple'` and `'extended'` query parsers.
4. Start two copies of a server on the same port with the Express 5 `app.listen` callback. Confirm the second one reports `EADDRINUSE`.

## What's next

You now know *what* changed. Next you will learn *how* to upgrade a real Express 4 project safely, step by step. Continue with [Migrating from Express 4 to Express 5](/courses/expressjs/migrating-from-express-4-to-5).

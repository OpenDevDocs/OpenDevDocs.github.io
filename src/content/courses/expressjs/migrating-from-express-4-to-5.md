---
publishDate: 2026-10-25T09:57
title: Migrating from Express 4 to Express 5
slug: migrating-from-express-4-to-5
metadescription: A practical, step-by-step guide to upgrading an Express 4 app to Express 5, using the official codemod, fixing route paths and behaviour changes, and testing safely.
updateDate: 2026-10-25T09:57
author: ['bishal-biswas']
level: 4
tags: ['express', 'migration', 'express-5', 'upgrade']
course: expressjs
---

## What you will learn

- A safe, repeatable **upgrade checklist** for moving a real app from Express 4 to Express 5
- How to run the official **codemod** and what it does and does not fix for you
- How to rewrite old route paths (`*`, `:id?`, inline regex) into the new syntax
- Which quiet **behaviour changes** to look for, such as read-only `req.query`
- How to test the upgrade so you can ship it with confidence

The previous lesson was a reference table of every breaking change. This lesson is the hands-on version: the order to do things in, and the fixes you will actually type. Keep the [Express 5 Breaking Changes Reference](/courses/expressjs/express-5-breaking-changes) open in another tab while you work.

## Why migration needs a plan

Most Express 4 code runs unchanged on Express 5. That is good news, but it is also a trap. The parts that *do* change tend to fail in one of two ways:

1. **Loudly at startup.** An old route path like `'*'` throws an error the moment the app starts. Easy to spot.
2. **Quietly at runtime.** A query string that used to become a nested object is now a flat string. Nothing crashes, but a filter stops working.

A plan protects you from the second kind. Think of it like moving house: you don't just throw everything in a truck. You pack room by room, label the boxes, and check each room in the new place before you hand back the old keys.

Here is the whole journey at a glance:

```text
 1. Prepare        Node 18+, tests, clean git branch
       |
 2. Clean up 4.x   latest Express 4, fix deprecation warnings
       |
 3. Upgrade        npm install express@5 (+ @types/express@5)
       |
 4. Codemod        automatic fixes for removed methods
       |
 5. Route paths    manual fixes, the app tells you where
       |
 6. Behaviour      req.query, req.body, parsers, app.listen
       |
 7. Test & ship    automated tests, staging, watch the logs
```

## Step 1: Prepare

### Check your Node.js version

Express 5 needs **Node.js 18 or newer**. Check the version on your machine *and* on your servers, CI and Docker images.

```bash
node --version
```

If any of them is older than 18, upgrade Node first, as a separate change. Mixing a Node upgrade and an Express upgrade in one step makes bugs much harder to trace.

### Make sure you have tests

A **safety net** here means automated tests that hit your real routes. If you followed [Testing with Supertest and the Node Test Runner](/courses/expressjs/testing-with-supertest), you already have one. If not, write a few **smoke tests** first: tiny tests that just check the most important routes still answer with the right status code.

```js
// test/smoke.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';

test('home page responds', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
});

test('unknown route gives 404', async () => {
  const res = await request(app).get('/does-not-exist');
  assert.equal(res.status, 404);
});
```

Run them on Express 4 and make sure they pass. A test that already fails before the upgrade tells you nothing afterwards.

### Work on a branch

```bash
git checkout -b upgrade-express-5
```

A branch keeps the upgrade separate from other work, and makes it easy to review every change with `git diff`.

## Step 2: Clean up on the latest Express 4

Before jumping to version 5, move to the **newest Express 4 release**. Express 4 prints **deprecation warnings** for most of the things that Express 5 removes. A deprecation warning is a message saying "this still works today, but it will be removed".

```bash
npm install express@4
node --trace-deprecation server.js
```

The `--trace-deprecation` flag adds a stack trace to each warning, so you can see the exact file and line. A warning looks like this:

```text
express deprecated res.send(status): Use res.sendStatus(status) instead routes/users.js:42:9
```

Click through your app (or run your tests) and fix every warning you see. Each one you fix here is one less surprise later.

## Step 3: Upgrade the packages

Now install Express 5:

```bash
npm install express@5
```

If your project uses TypeScript, upgrade the types too, because the v4 types describe methods that no longer exist:

```bash
npm install --save-dev @types/express@5
```

Then look at what else depends on Express:

```bash
npm ls express
```

Most middleware packages (`cors`, `helmet`, `morgan`, `multer`, `express-session` and friends) work with Express 5 without changes. Watch out for packages that **patch Express internals**:

| Package | What to do |
| --- | --- |
| `express-async-errors` | Remove it. It patched Express 4 internals, and Express 5 forwards async errors by itself. |
| `express-async-handler` or your own `asyncHandler()` wrapper | Optional to remove. It still works, it's just no longer needed. |
| `body-parser` imported directly | Switch to the built-in `express.json()` and `express.urlencoded()`, or upgrade `body-parser` to 2.x. |

> **Note:** Removing async wrappers is a nice cleanup, but do it in a later commit. Keep the upgrade commit focused so it is easy to review and, if needed, to revert.

## Step 4: Run the codemod

A **codemod** is a program that rewrites your source code for you, following fixed rules. The Express team publishes a migration codemod. Commit your work first so you can see exactly what it changed, then run it from your project folder:

```bash
git add -A && git commit -m "Upgrade to express 5 (before codemod)"
npx codemod@latest @expressjs/v5-migration-recipe
```

The word **recipe** means it is a bundle of smaller codemods run one after another. When it finishes, review its work:

```bash
git diff
```

### What the codemod fixes

The codemod targets the **removed and renamed methods**. Typical rewrites look like this:

| Express 4 code | After the codemod |
| --- | --- |
| `res.send(404)` | `res.sendStatus(404)` |
| `res.json(user, 201)` | `res.status(201).json(user)` |
| `res.redirect('/login', 301)` | `res.redirect(301, '/login')` |
| `res.redirect('back')` | `res.redirect(req.get('Referrer') \|\| '/')` |
| `res.sendfile(path)` | `res.sendFile(path)` |
| `app.del('/items/:id', ...)` | `app.delete('/items/:id', ...)` |
| `req.acceptsLanguage('en')` | `req.acceptsLanguages('en')` |
| `req.param('id')` | `req.params.id` (or `req.body` / `req.query`, check it) |

The exact list of rules grows over time, so read the summary it prints rather than trusting this table blindly.

> **Warning:** Always review `req.param()` rewrites by hand. The old method searched `params`, then `body`, then `query`. The codemod has to pick one, and only you know where the value really comes from.

### What the codemod does NOT fix

A codemod reads code shape. It cannot understand what your app *means*. These are still your job:

- **Route path strings** such as `'*'`, `'/:id?'` and `'/:id(\\d+)'` (Step 5)
- **Behaviour changes** that don't change how code looks: read-only `req.query`, the simpler query parser, `req.body` being `undefined`, the `urlencoded` default (Step 6)
- **Error handling in `app.listen`**
- **Third-party packages** and anything built dynamically, such as a path made with string concatenation
- **Tests** that asserted old behaviour

Think of the codemod as a helpful assistant who fixes the spelling in your essay. It won't notice that a paragraph no longer makes sense.

## Step 5: Fix route paths

Express 5 uses a newer version of the **path-to-regexp** library, the code that turns `'/users/:id'` into a pattern that matches URLs. You learned the new rules in [Route Parameters and path-to-regexp v8 Syntax](/courses/expressjs/route-parameters-and-path-to-regexp). Here is how to apply them to old code.

### Let the app tell you where

You don't need to hunt for every bad path. Invalid paths throw when the route is **registered**, which happens as soon as the app file loads. Just start the server:

```bash
node server.js
```

```text
TypeError: Missing parameter name at index 1: *; visit https://git.new/pathToRegexpError for info
    at ... (routes/index.js:58:5)
```

Fix the line in the stack trace, restart, and repeat until the app starts. Your test file imports `app`, so `npm test` catches these too.

### Before and after

| What you want | Express 4 | Express 5 |
| --- | --- | --- |
| Match everything | `'*'` | `'/*splat'` (or `'/{*splat}'` to include `/`) |
| Everything under a folder | `'/files/*'` | `'/files/*filepath'` |
| Optional parameter | `'/users/:id?'` | `'/users{/:id}'` |
| Optional extension | `'/:file.:ext?'` | `'/:file{.:ext}'` |
| Only digits | `'/users/:id(\\d+)'` | `'/users/:id'` + check in code, or a RegExp |
| Hyphen in a param name | `'/:my-param'` | `'/:"my-param"'` (or rename to `:myParam`) |

### Wildcard values are now arrays

This one is easy to miss, because the app starts fine. In Express 4, `req.params[0]` was a single string. In Express 5 a named wildcard gives you an **array of path segments**.

```js
// Express 4
app.get('/files/*', (req, res) => {
  const filePath = req.params[0]; // 'docs/2026/report.pdf'
  res.send(filePath);
});
```

```js
// Express 5
app.get('/files/*filepath', (req, res) => {
  const filePath = req.params.filepath.join('/'); // ['docs', '2026', 'report.pdf'] -> 'docs/2026/report.pdf'
  res.send(filePath);
});
```

### Regex in paths

Express 5 does not allow regex characters inside string paths. You have two good options:

```js
// routes/users.js
import { Router } from 'express';

export const router = Router();

// Option 1: a normal parameter, validated in the handler
router.get('/users/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'id must be a number' });
  }
  res.json({ id: Number(req.params.id) });
});

// Option 2: a RegExp literal (captured groups land in req.params[0], [1]...)
router.get(/^\/orders\/(\d+)$/, (req, res) => {
  res.json({ orderId: Number(req.params[0]) });
});
```

Option 1 is usually clearer, and it gives the client a helpful `400` error instead of a confusing `404`. For more complex rules, use a Zod schema as in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod).

### The catch-all 404 route

Many Express 4 apps ended with `app.all('*', ...)` or `app.get('*', ...)` as a "not found" handler. Replace it with plain middleware after all your routes:

```js
// app.js (after all routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

## Step 6: Fix behaviour changes

These changes don't throw errors. Search your code for each one and decide if it affects you.

### `req.query` is read-only

In Express 5, `req.query` is a **getter**: a property that is computed every time you read it. Assigning to it throws in ES modules, and changes to its properties don't stick.

```js
// Express 4 habit: overwrite the query with validated values
req.query = schema.parse(req.query); // TypeError in Express 5
```

Store your cleaned-up values somewhere else instead. `res.locals` is a good place, because it lives for exactly one request:

```js
// middleware/validate-query.js
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.issues });
  }
  res.locals.query = result.data; // read it later as res.locals.query
  next();
};
```

### Nested query strings are flat by default

The default query parser is now `"simple"`. A URL like `/products?price[min]=10` used to give you `{ price: { min: '10' } }`. Now you get `{ 'price[min]': '10' }`. If your API relies on the nested style, switch the old parser back on:

```js
// app.js
app.set('query parser', 'extended');
```

### `req.body` can be `undefined`

When no body parser ran (for example, a `GET` request, or a missing `Content-Type: application/json` header), `req.body` is now `undefined` instead of `{}`. Code like this can crash:

```js
const { name } = req.body; // TypeError if req.body is undefined
```

Validate the body (Zod will report it as missing), or use a safe default: `const { name } = req.body ?? {};`.

### `express.urlencoded()` defaults to `extended: false`

If your HTML forms send nested fields such as `address[city]`, pass the option explicitly:

```js
app.use(express.urlencoded({ extended: true }));
```

### Errors in `app.listen`

In Express 5, startup errors such as `EADDRINUSE` (port already in use) are passed to the callback. If you ignore the argument, the error can go unnoticed:

```js
// server.js
import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;

app.listen(port, (error) => {
  if (error) throw error; // stop with a clear message instead of failing silently
  console.log(`Listening on http://localhost:${port}`);
});
```

### Smaller things to scan for

| Search for | Why |
| --- | --- |
| `res.status(` with a value from a string, env var or database | Only integers 100-999 are accepted now. Wrap it in `Number()`. |
| `express.static` serving a `.well-known` folder | Dotfiles are ignored by default. Use `{ dotfiles: 'allow' }` on that mount. |
| `req.host` | It now includes the port, for example `localhost:3000`. Use `req.hostname` if you want only the name. |
| `res.clearCookie(name, { maxAge })` | `maxAge` and `expires` are ignored. Pass the same `path` and `domain` you used when setting the cookie. |

## Step 7: Test and ship

### Run everything

```bash
npm test
```

Then add tests for the things you changed by hand, especially wildcard routes and anything touching `req.query`:

```js
// test/migration.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';

test('wildcard route keeps the full nested path', async () => {
  const res = await request(app).get('/files/docs/2026/report.pdf');
  assert.equal(res.status, 200);
  assert.equal(res.text, 'docs/2026/report.pdf');
});

test('optional id: list and single item both work', async () => {
  assert.equal((await request(app).get('/users')).status, 200);
  assert.equal((await request(app).get('/users/1')).status, 200);
});

test('async errors reach the error handler', async () => {
  const res = await request(app).get('/boom'); // a route that throws in an async handler
  assert.equal(res.status, 500);
});
```

### Roll out gradually

1. **Deploy to staging** (a copy of production for testing) and click through the main flows.
2. **Deploy to production** at a quiet time, with the previous version ready to roll back.
3. **Watch your logs and metrics** for a rise in `404` or `400` responses. A spike on one route often means a path or query change you missed.

> **Tip:** Upgrade one service at a time if you run several. A small, boring upgrade is a successful upgrade.

## Common mistakes

> **Common mistake:** Running the codemod and shipping straight away. The codemod never touches route paths or behaviour changes, so an app can pass a quick look and still break filters or wildcards.

> **Common mistake:** Changing `'*'` to `'/*splat'` but still reading `req.params[0]`. The value is now `req.params.splat`, and it is an array.

> **Common mistake:** Leaving `import 'express-async-errors'` at the top of the app. Remove it; Express 5 already does its job.

## Key takeaways

- Upgrade in stages: Node 18+, latest Express 4 with no deprecation warnings, then Express 5.
- `npx codemod@latest @expressjs/v5-migration-recipe` fixes removed and renamed methods. Review its diff, especially `req.param()`.
- Invalid route paths throw at startup, so starting the app shows you exactly what to fix.
- Named wildcards return arrays, optional parts use braces, and regex goes in a RegExp literal or your own validation.
- Quiet changes (`req.query`, query parser, `req.body`, `urlencoded`, `app.listen`) need a manual search.
- Tests plus a staged rollout turn a scary upgrade into a routine one.

## Practice

1. Take this Express 4 snippet and convert it by hand: `app.get('/docs/*', ...)`, `app.get('/posts/:slug?', ...)`, `res.json(post, 201)`. Then compare with what the codemod produces.
2. Write a middleware that validates `?page=` and `?limit=` with Zod and stores the result in `res.locals.query`. Test it with Supertest.
3. Start an app that registers `app.get('*', ...)` on Express 5 and read the error message. Fix it so the root path `/` is also matched.
4. Find an old Express 4 project (yours or an open source one) and write down every item from this lesson that would need attention.

## What's next

With your app on Express 5, it's time to think about how its code is organised as it grows. Continue with [Layered and Hexagonal Architecture](/courses/expressjs/layered-architecture).

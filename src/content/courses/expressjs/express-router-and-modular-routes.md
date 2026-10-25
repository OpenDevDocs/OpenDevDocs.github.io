---
publishDate: 2026-10-25T09:20
title: express.Router and Modular Routes
slug: express-router-and-modular-routes
metadescription: Learn how to split a growing Express 5 app into small route files with express.Router, mount them on a path prefix, and share middleware and URL parameters between them.
updateDate: 2026-10-25T09:20
author: ['bishal-biswas']
level: 2
tags: ['express', 'router', 'routing', 'project-structure']
course: expressjs
---

## What you will learn

- Why one big `app.js` file becomes a problem as your app grows
- What **`express.Router`** is and how it works like a "mini app"
- How to **mount** a router on a path prefix such as `/users`
- How to add middleware that only runs for one group of routes
- How to read parent URL parameters with `mergeParams`

## The problem: one file that does everything

So far, every route lived in a single `app.js`. That is perfect for learning. But a real API might have routes for users, products, orders, payments and admin tools. Put them all in one file and it quickly grows to hundreds of lines.

A huge file is hard to read, hard to test, and painful when two people edit it at the same time. You also end up repeating the same prefix over and over:

```js
// app.js (getting messy)
app.get('/users', listUsers);
app.post('/users', createUser);
app.get('/users/:id', getUser);
app.patch('/users/:id', updateUser);
app.delete('/users/:id', deleteUser);

app.get('/products', listProducts);
app.post('/products', createProduct);
// ...and 40 more lines like this
```

**Think of it like a big office building.** The reception desk (your `app`) does not handle every task itself. It sends you to the right department: "Users? Third floor. Products? Fifth floor." Each department runs its own work. In Express, each department is a **router**.

## What is express.Router?

**`express.Router()`** creates a **router**: a small, self-contained group of routes and middleware. It has the same methods you already know from `app`: `get`, `post`, `put`, `patch`, `delete`, `use` and `route`.

The difference is that a router does not start a server. It cannot `listen()`. It only becomes active when you plug it into your app. That step is called **mounting**.

Here is the simplest possible router:

```js
// routes/hello.js
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.send('Hello from the router');
});

export default router;
```

> **Note:** `import { Router } from 'express'` and `express.Router()` do the same thing. Use whichever reads better to you. This lesson uses the named import.

And here is how the app mounts it:

```js
// app.js
import express from 'express';
import helloRouter from './routes/hello.js';

const app = express();

app.use('/hello', helloRouter); // mount the router at /hello

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Try it:

```bash
curl http://localhost:3000/hello
```

```text
Hello from the router
```

> **Common mistake:** In ES modules you must write the file extension in local imports: `'./routes/hello.js'`, not `'./routes/hello'`. Without `.js`, Node throws an `ERR_MODULE_NOT_FOUND` error.

## How mounting works

When you write `app.use('/hello', helloRouter)`, Express does two things for every request whose path starts with `/hello`:

1. It **strips** the `/hello` prefix from the path.
2. It hands the request to the router, which matches the rest of the path.

So inside the router, paths are **relative** to the mount point:

```text
Request: GET /users/42

app.use('/users', usersRouter)
        |
        |  prefix "/users" removed
        v
usersRouter sees: GET /42   -->  matches router.get('/:id', ...)
```

This is the big win. The router does not know or care where it is mounted. You could mount the same router at `/users` today and `/api/v2/users` tomorrow without changing a single line inside it.

### Three useful URL properties

Because the prefix is stripped, Express gives you three properties to see the full picture:

| Property | Value for `GET /users/42?sort=name` | Meaning |
| --- | --- | --- |
| `req.originalUrl` | `/users/42?sort=name` | The full URL the client asked for |
| `req.baseUrl` | `/users` | The path where the router is mounted |
| `req.path` | `/42` | The path relative to the router |

`req.originalUrl` is handy for logging, because it always shows what the client really requested.

## A realistic example: a users router

Let's build a proper users module. We will keep the data in a simple array so you can focus on the routing. Later lessons connect a real database.

```js
// routes/users.js
import { Router } from 'express';

const router = Router();

const users = [
  { id: 1, name: 'Asha' },
  { id: 2, name: 'Ravi' },
];

// GET /users
router.get('/', (req, res) => {
  res.json(users);
});

// POST /users
router.post('/', (req, res) => {
  const name = req.body?.name;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const user = { id: users.length + 1, name };
  users.push(user);
  res.status(201).json(user);
});

// GET /users/:id
router.get('/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

export default router;
```

> **Tip:** `req.body?.name` uses optional chaining. In Express 5, `req.body` is `undefined` when no body parser ran, so the `?.` stops your code from crashing if someone sends a request without JSON.

Now a second module for products:

```js
// routes/products.js
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json([{ id: 1, title: 'Keyboard' }]);
});

export default router;
```

And the app becomes short and easy to scan:

```js
// app.js
import express from 'express';
import usersRouter from './routes/users.js';
import productsRouter from './routes/products.js';

const app = express();

app.use(express.json()); // parse JSON bodies for every router

app.use('/users', usersRouter);
app.use('/products', productsRouter);

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Test it:

```bash
curl http://localhost:3000/users/2
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"name":"Mei"}'
```

```text
{"id":2,"name":"Ravi"}
{"id":3,"name":"Mei"}
```

### A folder layout that scales

A common, beginner-friendly structure looks like this:

```text
my-api/
  package.json
  app.js
  routes/
    index.js       <- combines all routers
    users.js
    products.js
```

Some teams add one more layer: an `index.js` that gathers every router, so `app.js` only mounts one thing.

```js
// routes/index.js
import { Router } from 'express';
import usersRouter from './users.js';
import productsRouter from './products.js';

const router = Router();

router.use('/users', usersRouter);
router.use('/products', productsRouter);

export default router;
```

```js
// app.js (only the mounting line changes)
import apiRouter from './routes/index.js';

app.use('/api', apiRouter); // now: /api/users, /api/products
```

Routers can be **nested** like this as deep as you like. Each level strips its own prefix.

## router.route(): one path, many methods

Often several methods share the same path, like `GET`, `PATCH` and `DELETE` on `/:id`. Instead of repeating the path, use **`router.route()`**:

```js
// routes/users.js (an alternative style)
router
  .route('/:id')
  .get((req, res) => {
    res.json({ action: 'read', id: req.params.id });
  })
  .patch((req, res) => {
    res.json({ action: 'update', id: req.params.id });
  })
  .delete((req, res) => {
    res.status(204).end();
  });
```

This reads like a small table of "what can I do with this URL". It also avoids typos, because you type the path once.

## Middleware that only runs for one router

Remember that middleware runs in order for every request it matches. When you call **`router.use()`**, the middleware runs only for requests that reach that router. This is called **router-level middleware**.

A classic use is protecting an admin area:

```js
// routes/admin.js
import { Router } from 'express';

const router = Router();

// runs for every request that reaches this router
router.use((req, res, next) => {
  if (req.get('X-Admin-Key') !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Admins only' });
  }
  next();
});

router.get('/stats', (req, res) => {
  res.json({ users: 2, products: 1 });
});

export default router;
```

```js
// app.js
import adminRouter from './routes/admin.js';

app.use('/admin', adminRouter);
```

Requests to `/users` never touch the admin check. Requests to `/admin/stats` always do. You can also attach middleware at mount time, which is useful for logging or rate limiting a whole section:

```js
// app.js: logRequests runs only for /admin routes
app.use('/admin', logRequests, adminRouter);
```

> **Note:** The header check above is just a teaching example. Real logins and permissions are covered in [JWT Authentication](/courses/expressjs/jwt-authentication) and [Role-Based Authorization](/courses/expressjs/role-based-authorization).

## Reading parent parameters with mergeParams

Sometimes the mount path itself contains a parameter. Think of "posts that belong to a user": `/users/:userId/posts`.

```js
// app.js
app.use('/users/:userId/posts', postsRouter);
```

By default, a router **cannot see** parameters from its parent's path. Inside `postsRouter`, `req.params.userId` would be `undefined`. To fix that, create the router with the **`mergeParams`** option:

```js
// routes/posts.js
import { Router } from 'express';

const router = Router({ mergeParams: true }); // see the parent's :userId

router.get('/', (req, res) => {
  res.json({ message: `Posts for user ${req.params.userId}` });
});

router.get('/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ message: `Post ${postId} by user ${userId}` });
});

export default router;
```

```bash
curl http://localhost:3000/users/7/posts/3
```

```text
{"message":"Post 3 by user 7"}
```

## router.param(): run code for a parameter

If many routes use `:id` and all of them first need to look up the item, you can register a **param callback**. It runs once, before any route that contains that parameter.

```js
// routes/users.js
router.param('id', (req, res, next, id) => {
  const user = users.find((u) => u.id === Number(id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  req.user = user; // share it with the route handlers
  next();
});

router.get('/:id', (req, res) => {
  res.json(req.user); // already loaded
});
```

This keeps the "find or 404" logic in one place. Param callbacks belong to the router they are defined on, so they do not leak into other routers.

## Common mistakes

> **Common mistake:** Repeating the prefix inside the router. If you mount at `/users` and then write `router.get('/users/:id', ...)`, the real URL becomes `/users/users/:id`. Inside a router, write paths relative to the mount point.

> **Common mistake:** Forgetting `export default router` (or importing with the wrong name). If `app.use()` receives `undefined` instead of a router, Express throws a `TypeError` at startup complaining that it expected a function.

> **Common mistake:** Mounting the body parser after the routers. `app.use(express.json())` must come **before** `app.use('/users', usersRouter)`, or `req.body` will be `undefined` inside the router.

## Key takeaways

- **`express.Router()`** creates a mini app with its own routes and middleware. It has no `listen()`.
- **Mounting** with `app.use('/prefix', router)` strips the prefix, so router paths stay relative and reusable.
- `req.originalUrl`, `req.baseUrl` and `req.path` show the full URL, the mount point and the relative path.
- **`router.use()`** adds middleware that only runs for that router's requests.
- Use **`mergeParams: true`** when a router needs parameters from its mount path, and `router.param()` to share parameter lookups.

## Practice

1. Move every route from one of your earlier practice apps into a `routes/` folder with at least two router files.
2. Create a `routes/index.js` that combines your routers and mount it at `/api`. Check that `/api/users` works and `/users` now returns 404.
3. Add a router-level middleware to your products router that logs `req.baseUrl` and `req.path` for each request.
4. Build a `/users/:userId/orders` router with `mergeParams: true` that returns the `userId` in its response.

## What's next

Routers group handlers together, but what happens inside a single route when it has several functions in a row? Continue with [Route Handlers, next() and Chaining](/courses/expressjs/route-handlers-and-next).

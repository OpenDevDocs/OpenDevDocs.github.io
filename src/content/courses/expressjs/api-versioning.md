---
publishDate: 2026-10-25T09:37
title: API Versioning
slug: api-versioning
metadescription: Learn when and how to version an Express 5 API with URL paths or headers, share code between versions, and deprecate old versions without breaking clients.
updateDate: 2026-10-25T09:37
author: ['bishal-biswas']
level: 2
tags: ['express', 'api-versioning', 'rest', 'api-design']
course: expressjs
---

## What you will learn

- What a **breaking change** is, and why APIs need versions
- The three common versioning styles: URL path, header and query string
- How to run `v1` and `v2` side by side with Express routers
- How to share logic between versions instead of copying it
- How to deprecate and retire an old version politely

## Why version an API at all?

Once other people use your API, their code depends on its exact shape. A mobile app in someone's pocket expects `GET /users/1` to return a `name` field. If you rename it to `fullName` one morning, that app breaks, and the user may not update it for months.

**Think of it like a restaurant changing its menu.** Regular customers still ask for "the usual". A good restaurant keeps the old menu available for a while, tells customers about the new one, and only then retires the old dishes. **API versioning** gives you the same freedom: you publish a new version with the changes, while the old version keeps working.

## Breaking vs non-breaking changes

A **breaking change** is any change that can make an existing, correctly written client fail. Only breaking changes need a new version.

| Change | Breaking? |
| --- | --- |
| Add a new endpoint | No |
| Add a new optional field to a response | No (clients should ignore unknown fields) |
| Add a new optional request parameter | No |
| Remove or rename a response field | **Yes** |
| Change a field's type (`"42"` to `42`) | **Yes** |
| Make an optional request field required | **Yes** |
| Change status codes or error format | **Yes** |
| Change the meaning of a value | **Yes** |

> **Tip:** The cheapest version is the one you never need. Design carefully, prefer adding over changing, and you can stay on `v1` for a long time.

## Three ways to say which version you want

| Style | Example | Pros | Cons |
| --- | --- | --- | --- |
| **URL path** | `GET /api/v2/users/1` | Obvious, easy to test in a browser, easy to route and cache | Version is part of every URL |
| **Header** | `API-Version: 2` or `Accept: application/vnd.myapp.v2+json` | Clean URLs | Hidden; harder to test; caches need a `Vary` header |
| **Query string** | `GET /api/users/1?version=2` | Easy to add | Easy to forget; mixes with filters |

The URL path style is the most common, and the easiest to understand, so this lesson starts there.

## URL path versioning with routers

Each version gets its own router. Express mounts them under different prefixes.

```text
src/
  app.js
  services/
    users.service.js       shared business logic and data access
  routes/
    v1/
      index.js             combines all v1 routers
      users.js
    v2/
      index.js
      users.js
```

Here is the shared part. A **service** is a module that holds business logic and data access, with no knowledge of HTTP. Both versions use it.

```js
// src/services/users.service.js
const users = new Map([
  [1, { id: 1, firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com' }],
  [2, { id: 2, firstName: 'Tom', lastName: 'Lee', email: 'tom@example.com' }],
]);

export const findUserById = async (id) => users.get(id) ?? null;
export const listUsers = async () => [...users.values()];
```

Version 1 was released when users had a single `name` field. To keep old clients working, v1 still returns that shape:

```js
// src/routes/v1/users.js
import { Router } from 'express';
import { findUserById, listUsers } from '../../services/users.service.js';

const router = Router();

// v1 response shape: { id, name, email }
const toV1 = (user) => ({
  id: user.id,
  name: `${user.firstName} ${user.lastName}`,
  email: user.email,
});

router.get('/', async (req, res) => {
  const users = await listUsers();
  res.json(users.map(toV1)); // v1 returned a bare array
});

router.get('/:id', async (req, res) => {
  const user = await findUserById(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(toV1(user));
});

export default router;
```

Version 2 splits the name and wraps responses in `data`, two breaking changes:

```js
// src/routes/v2/users.js
import { Router } from 'express';
import { findUserById, listUsers } from '../../services/users.service.js';

const router = Router();

// v2 response shape: { id, firstName, lastName, email }
const toV2 = ({ id, firstName, lastName, email }) => ({ id, firstName, lastName, email });

router.get('/', async (req, res) => {
  const users = await listUsers();
  res.json({ data: users.map(toV2) });
});

router.get('/:id', async (req, res) => {
  const user = await findUserById(Number(req.params.id));
  if (!user) return res.status(404).json({ error: { message: 'User not found' } });
  res.json({ data: toV2(user) });
});

export default router;
```

The functions `toV1` and `toV2` are **serializers**: small functions that turn your internal data into the shape a particular version promises. The data and logic live in one place; only the outer shape differs.

Each version folder has an index router:

```js
// src/routes/v1/index.js
import { Router } from 'express';
import usersRouter from './users.js';

const v1 = Router();
v1.use('/users', usersRouter);

export default v1;
```

```js
// src/routes/v2/index.js
import { Router } from 'express';
import usersRouter from './users.js';

const v2 = Router();
v2.use('/users', usersRouter);

export default v2;
```

And the app mounts them:

```js
// src/app.js
import express from 'express';
import v1 from './routes/v1/index.js';
import v2 from './routes/v2/index.js';

const app = express();
app.use(express.json());

app.use('/api/v1', v1);
app.use('/api/v2', v2);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('API on http://localhost:3000');
});
```

Compare the two versions:

```bash
curl http://localhost:3000/api/v1/users/1
curl http://localhost:3000/api/v2/users/1
```

```text
{"id":1,"name":"Asha Rao","email":"asha@example.com"}
{"data":{"id":1,"firstName":"Asha","lastName":"Rao","email":"asha@example.com"}}
```

### Reusing unchanged routes

Usually only a few endpoints change between versions. You do not have to copy the rest. A v2 index router can reuse v1 routers for resources that did not change:

```js
// src/routes/v2/index.js
import { Router } from 'express';
import usersRouter from './users.js';               // changed in v2
import productsRouter from '../v1/products.js';     // identical in v1 and v2

const v2 = Router();
v2.use('/users', usersRouter);
v2.use('/products', productsRouter);

export default v2;
```

> **Note:** Version the **whole API**, not individual endpoints. Clients should be able to say "I use v2" and get a consistent set of rules, instead of tracking that users are v2 but orders are v4.

## Header-based versioning

Some teams prefer clean URLs and put the version in a header. Express routers are just middleware functions, so you can choose one at runtime and call it.

```js
// src/app.js (header-based alternative)
import express from 'express';
import v1 from './routes/v1/index.js';
import v2 from './routes/v2/index.js';

const app = express();
app.use(express.json());

const versions = new Map([['1', v1], ['2', v2]]); // a Map avoids surprises like "__proto__"
const LATEST_STABLE = '1';

app.use('/api', (req, res, next) => {
  const requested = req.get('API-Version') ?? LATEST_STABLE;
  const router = versions.get(requested);

  if (!router) {
    return res.status(400).json({
      error: { message: `Unsupported API version "${requested}". Use one of: ${[...versions.keys()].join(', ')}` },
    });
  }

  res.set('API-Version', requested); // tell the client which version answered
  res.vary('API-Version');           // caches must store one copy per version
  router(req, res, next);            // hand the request to that version's router
});
```

```bash
curl -H "API-Version: 2" http://localhost:3000/api/users/1
```

The **`Vary`** header tells browsers and caching proxies that the response depends on the `API-Version` request header. Without it, a cache might hand a v1 response to a v2 client.

> **Common mistake:** Making "no version header" mean "latest version". When you release v3, every client that forgot the header suddenly gets breaking changes. Default to a fixed version, or require the header.

## Deprecating an old version

Eventually you want to switch off v1. Do it in stages, and tell clients early.

1. **Announce** the new version and a shutdown date in your docs and changelog.
2. **Signal it in responses**, so developers see it in their tools.
3. **Watch usage** in your logs to see who still calls v1, and contact them.
4. **Retire** the version after the date, returning `410 Gone`.

Two HTTP headers exist for step 2:

- **`Deprecation`** says the endpoint is deprecated. Its value is the moment it was deprecated, written as `@` followed by a Unix timestamp (seconds since 1 January 1970). You may still see `Deprecation: true` in older APIs, from an earlier draft of the standard.
- **`Sunset`** gives the date after which the endpoint will stop working, as an HTTP date.

A `Link` header can point to a migration guide.

```js
// src/middleware/deprecate.js
export const deprecate = ({ since, sunset, docs }) => (req, res, next) => {
  res.set('Deprecation', `@${Math.floor(since.getTime() / 1000)}`);
  res.set('Sunset', sunset.toUTCString());
  res.set('Link', `<${docs}>; rel="deprecation"`);

  req.log?.warn({ version: 'v1', path: req.originalUrl }, 'Deprecated API version used');
  next();
};
```

```js
// src/app.js
import { deprecate } from './middleware/deprecate.js';

app.use(
  '/api/v1',
  deprecate({
    since: new Date('2026-10-01T00:00:00Z'),
    sunset: new Date('2027-04-01T00:00:00Z'),
    docs: 'https://docs.example.com/migrate-to-v2',
  }),
  v1,
);
```

```bash
curl -i http://localhost:3000/api/v1/users/1
```

```http
HTTP/1.1 200 OK
Deprecation: @1790812800
Sunset: Thu, 01 Apr 2027 00:00:00 GMT
Link: <https://docs.example.com/migrate-to-v2>; rel="deprecation"
Content-Type: application/json; charset=utf-8
```

The `req.log?.warn(...)` line uses the pino-http logger from [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino) if it is installed, and does nothing otherwise. Those log lines tell you who still depends on v1.

After the sunset date, replace v1 with a clear message:

```js
// src/app.js (after the sunset date)
app.use('/api/v1', (req, res) => {
  res.status(410).json({
    error: { message: 'API v1 was retired on 2027-04-01. Please use /api/v2.' },
  });
});
```

`410 Gone` means "this existed, but it is gone for good", which is more helpful than a generic `404`.

## Good versioning habits

- **Start with `v1` on day one.** Adding `/v1` later means changing every client's URLs.
- **Only use major versions** in the URL (`v1`, `v2`), not `v1.3.2`. Non-breaking changes do not need a new version.
- **Keep business logic shared**; let versions differ only in routes, validation and serializers.
- **Support few versions at once**, usually the current one and the previous one. Every live version is code you must test and secure.
- **Document every version.** You will generate API docs in [OpenAPI and Swagger Documentation](/courses/expressjs/openapi-and-swagger).

## Common mistakes

- **Shipping breaking changes without a new version**, "because it is a small rename".
- **Copying the whole codebase per version**, so a bug fix must be applied in several places.
- **Defaulting to "latest" when no version is given.**
- **Retiring a version without warning**, or without a helpful `410` message.
- **Forgetting `Vary`** when the version comes from a header.

## Key takeaways

- Version your API so you can make **breaking changes** without breaking existing clients. Additive changes need no new version.
- **URL path versioning** (`/api/v1`, `/api/v2`) is the simplest: one Express router per version.
- Share services between versions and use **serializers** for each version's response shape.
- Header-based versioning keeps URLs clean but needs a sensible default and a `Vary` header.
- Deprecate in stages: announce, send `Deprecation` and `Sunset` headers, watch usage, then return `410 Gone`.

## Practice

1. Build the v1/v2 users example and confirm both shapes with `curl`.
2. Add a `products` router to v1 and reuse it unchanged in v2.
3. Implement the header-based version selector and test it with `-H "API-Version: 2"`, with no header, and with `-H "API-Version: 9"`.
4. Add the `deprecate` middleware to v1 and inspect the headers with `curl -i`.

## What's next

You now have every piece needed for a real API. Put them all together in [Project: Build a Complete Notes API](/courses/expressjs/project-build-a-notes-api).

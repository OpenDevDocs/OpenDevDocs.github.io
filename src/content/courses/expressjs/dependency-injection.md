---
publishDate: 2026-10-25T09:59
title: Dependency Injection in Express Apps
slug: dependency-injection
metadescription: Learn what dependency injection is, how to wire an Express 5 app with factory functions and a composition root, and how it makes testing with fakes simple.
updateDate: 2026-10-25T09:59
author: ['bishal-biswas']
level: 4
tags: ['express', 'architecture', 'testing', 'dependency-injection']
course: expressjs
---

## What you will learn

- What a **dependency** is and why hard-coded imports make code hard to test
- How **dependency injection** works, using plain JavaScript factory functions
- How to build an **app factory** and a single **composition root** that wires everything
- How to swap real parts for **fakes** in tests
- When a DI container library is worth it (and when it isn't)

## What is a dependency?

A **dependency** is anything your code needs from outside itself to do its job: a database connection, a logger, an email sender, the current time, a configuration value.

Look at this service:

```js
// services/welcome.service.js (hard-wired)
import { db } from '../db.js';
import { sendEmail } from '../email.js';

export const registerUser = async (email) => {
  const user = await db.users.insert({ email, createdAt: new Date() });
  await sendEmail(email, 'Welcome!');
  return user;
};
```

It works. But it reaches out and *grabs* three dependencies by itself: `db`, `sendEmail` and the clock (`new Date()`). That causes problems:

- **Testing is painful.** Every test writes to a real database and tries to send a real email.
- **Hidden requirements.** You can't see what the function needs without reading its imports and body.
- **Import side effects.** `db.js` may connect to the database the moment it is imported, even in a test that doesn't need it.
- **Hard to swap.** Moving from one email provider to another means editing every file that imports `sendEmail`.

## Dependency injection in one sentence

**Dependency injection (DI) means giving a piece of code the things it needs, instead of letting it fetch them itself.**

Think of a chef. A chef who must drive to the market for every ingredient is slow and hard to replace. A chef who is *handed* ingredients can cook in any kitchen, and in a cooking class you can hand them plastic vegetables to practise with.

The same service, with DI:

```js
// services/welcome.service.js (dependencies injected)
export const createWelcomeService = ({ usersRepo, mailer, clock }) => ({
  async registerUser(email) {
    const user = await usersRepo.insert({ email, createdAt: clock.now() });
    await mailer.send(email, 'Welcome!');
    return user;
  },
});
```

Now everything the service needs is listed right at the top, in the arguments. Nothing happens at import time. And the caller decides which real (or fake) parts to hand over.

## Three ways to inject

| Style | Example | Good for |
| --- | --- | --- |
| **Function parameter** | `formatPrice(amount, currency)` | Small helpers |
| **Factory function** | `createWelcomeService({ mailer })` returns an object | Services, repositories, controllers (the usual choice in JS) |
| **Class constructor** | `new WelcomeService({ mailer })` | Teams that prefer classes, common in TypeScript |

A **factory function** is a function that builds and returns an object. The returned methods remember the dependencies through a **closure** (a function's ability to keep using variables from where it was created). This course uses factories because they are short, need no `this`, and work naturally with Express handlers.

> **Tip:** Pass dependencies as a single object, `{ usersRepo, mailer, clock }`, not as positional arguments. The order stops mattering and adding a new dependency doesn't break existing callers.

## Building the app as a factory

In [Testing with Supertest](/courses/expressjs/testing-with-supertest) you split `app.js` from `server.js`. Let's take that one step further: `app.js` exports a **function** that builds an app from the dependencies you give it.

```js
// src/app.js
import express from 'express';
import { createUsersRouter } from './routes/users.routes.js';
import { createErrorHandler } from './middleware/error-handler.js';

export const createApp = ({ welcomeService, logger }) => {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', createUsersRouter({ welcomeService }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(createErrorHandler({ logger }));
  return app;
};
```

The router and the error handler are factories too:

```js
// src/routes/users.routes.js
import { Router } from 'express';

export const createUsersRouter = ({ welcomeService }) => {
  const router = Router();

  router.post('/', async (req, res) => {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await welcomeService.registerUser(email);
    res.status(201).json(user);
  });

  return router;
};
```

```js
// src/middleware/error-handler.js
export const createErrorHandler = ({ logger }) => (err, req, res, next) => {
  if (res.headersSent) return next(err);
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
};
```

## The composition root

Somebody has to create the real database connection, the real mailer and so on, and plug them together. That one place is called the **composition root**. It is usually `server.js`, the entry point that starts the app.

```text
 server.js  (composition root: the ONLY place that knows every real part)
    |
    |-- config        <- read from process.env once
    |-- logger        <- pino
    |-- database      <- connect
    |-- usersRepo     <- needs database
    |-- mailer        <- needs config
    |-- welcomeService <- needs usersRepo, mailer, clock
    '-- createApp()   <- needs welcomeService, logger
```

```js
// src/server.js
import pino from 'pino';
import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { createUsersRepo } from './repositories/users.repo.js';
import { createSmtpMailer } from './adapters/smtp-mailer.js';
import { createWelcomeService } from './services/welcome.service.js';
import { createApp } from './app.js';

const config = loadConfig(process.env);
const logger = pino({ level: config.logLevel });

await mongoose.connect(config.mongoUrl); // connect BEFORE accepting requests

const usersRepo = createUsersRepo();
const mailer = createSmtpMailer({ host: config.smtpHost, logger });
const clock = { now: () => new Date() };

const welcomeService = createWelcomeService({ usersRepo, mailer, clock });
const app = createApp({ welcomeService, logger });

app.listen(config.port, (error) => {
  if (error) throw error;
  logger.info(`Listening on port ${config.port}`);
});
```

Top-level `await` works here because the project uses ES modules.

> **Note:** Notice the order: things with no dependencies first, then things that need them. If you ever get a cycle (A needs B and B needs A), it usually means one of them is doing too much and should be split.

### Inject config too

Reading `process.env.SOMETHING` deep inside a service is another hidden dependency. Read and check the environment **once**, then pass plain values down:

```js
// src/config.js
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  MONGO_URL: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
});

export const loadConfig = (env) => {
  const result = schema.safeParse(env);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.issues);
    process.exit(1);
  }
  const e = result.data;
  return { port: e.PORT, mongoUrl: e.MONGO_URL, smtpHost: e.SMTP_HOST, logLevel: e.LOG_LEVEL };
};
```

Because `loadConfig` takes `env` as a parameter, you can even test it with a plain object instead of the real environment.

## The payoff: testing with fakes

A **fake** is a simple stand-in for a real dependency, built just for tests. It behaves the same from the outside, but it is fast and predictable.

### Testing the service

```js
// test/welcome.service.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWelcomeService } from '../src/services/welcome.service.js';

const makeFakes = () => {
  const sent = [];
  return {
    sent,
    usersRepo: { insert: async (data) => ({ id: 'u1', ...data }) },
    mailer: { send: async (to, subject) => { sent.push({ to, subject }); } },
    clock: { now: () => new Date('2026-01-01T00:00:00Z') }, // time stands still in tests
  };
};

test('registers a user and sends a welcome email', async () => {
  const fakes = makeFakes();
  const service = createWelcomeService(fakes);

  const user = await service.registerUser('ada@example.com');

  assert.equal(user.createdAt.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.deepEqual(fakes.sent, [{ to: 'ada@example.com', subject: 'Welcome!' }]);
});
```

No database. No email server. And the fake clock means the test gives the same result every time it runs.

### Testing the HTTP layer

Because `createApp` accepts its dependencies, a route test can hand it a fake service and check only the HTTP behaviour:

```js
// test/users.routes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

const silentLogger = { error: () => {}, info: () => {} };

test('POST /api/users returns 201', async () => {
  const welcomeService = { registerUser: async (email) => ({ id: 'u1', email }) };
  const app = createApp({ welcomeService, logger: silentLogger });

  const res = await request(app).post('/api/users').send({ email: 'ada@example.com' });

  assert.equal(res.status, 201);
  assert.equal(res.body.email, 'ada@example.com');
});

test('service failure becomes a 500', async () => {
  const welcomeService = { registerUser: async () => { throw new Error('mail server down'); } };
  const app = createApp({ welcomeService, logger: silentLogger });

  const res = await request(app).post('/api/users').send({ email: 'ada@example.com' });

  assert.equal(res.status, 500);
});
```

Testing an error path used to mean breaking a real database on purpose. Now it is one line.

```bash
node --test
```

## Request-scoped values

Some things change on every request: the logged-in user, a request ID, a per-request logger (`req.log` from `pino-http`). These are **request-scoped** values. Don't try to inject them at startup. Instead, the controller reads them from `req` and passes them to the service as normal arguments:

```js
router.post('/notes', async (req, res) => {
  const note = await notesService.createNote(req.user.id, req.body ?? {});
  res.status(201).json(note);
});
```

The service gets `ownerId` as a plain string. It still knows nothing about `req`.

> **Note:** Node also offers `AsyncLocalStorage` (from `node:async_hooks`) to carry request context through deep call chains without passing it everywhere. Tracing tools use it under the hood. For your own code, explicit arguments are easier to read and test, so reach for it only when passing values becomes truly painful.

## Do I need a DI container?

A **DI container** is a library that builds the dependency graph for you: you register each part, and it works out the order. Popular ones in the Node world include **Awilix** (plain JavaScript), and **tsyringe** and **InversifyJS** (TypeScript, using decorators). Frameworks such as NestJS have one built in.

| Manual wiring (this lesson) | DI container |
| --- | --- |
| Zero extra packages | One more library to learn |
| Wiring is plain code you can read top to bottom | Wiring is automatic, sometimes "magic" |
| Becomes long with 50+ services | Scales to large graphs |
| Errors are normal JavaScript errors | Errors can be harder to trace |

For most Express apps, manual wiring in a composition root is enough. Consider a container when `server.js` grows into hundreds of lines of wiring and keeping the order right becomes a real chore.

## Shutting down in reverse

The composition root that creates things is also the right place to close them. Close in **reverse order**: stop accepting requests first, then close the database.

```js
// src/server.js (replaces the earlier app.listen call)
const server = app.listen(config.port, (error) => {
  if (error) throw error;
  logger.info(`Listening on port ${config.port}`);
});

process.on('SIGTERM', () => {
  server.close(async () => {
    await mongoose.disconnect();
    logger.info('Shut down cleanly');
    process.exit(0);
  });
});
```

You covered the details in [Graceful Shutdown and Health Checks](/courses/expressjs/graceful-shutdown-and-health-checks).

## Common mistakes

> **Common mistake:** Importing the real database module inside `app.js` "just for one route". One hard-wired import breaks the whole idea, because tests can no longer build the app without a real database.

> **Common mistake:** Building new dependencies on every request, such as `createWelcomeService(...)` inside a handler. Build them once at startup and reuse them.

> **Common mistake:** Turning the injected object into a "bag of everything" (`createApp(container)` where `container` holds 40 items). Ask for exactly what each part needs, so the arguments still document it.

> **Common mistake:** Using fakes for everything and never testing the real adapters. Keep a few integration tests that use a real (test) database.

## Key takeaways

- A **dependency** is anything code needs from outside itself; **dependency injection** hands it in instead of letting the code fetch it.
- In JavaScript, **factory functions** that take a `{ ...deps }` object are the simplest way to inject.
- Build the app with `createApp(deps)` and wire real parts in one **composition root**, usually `server.js`.
- Read configuration once and pass plain values down; inject the clock if time matters.
- **Fakes** make tests fast, predictable and able to cover error paths easily.
- Manual wiring is enough for most apps; reach for a container only when wiring becomes a burden.

## Practice

1. Refactor one hard-wired service in your Notes API to a factory function that receives its repository.
2. Change your `app.js` to export `createApp(deps)` and update `server.js` to be the composition root.
3. Write a Supertest test where the injected service throws a `NotFoundError`, and check that the API answers `404`.
4. Add a `clock` dependency to a service that stamps `createdAt`, and write a test that checks the exact timestamp.

## What's next

Your app is now well structured and easy to test. Next, learn how to see what it is doing in production with [Observability: Metrics and OpenTelemetry Tracing](/courses/expressjs/observability-and-opentelemetry).

---
publishDate: 2026-10-25T09:58
title: Layered and Hexagonal Architecture
slug: layered-architecture
metadescription: Learn how to split a growing Express 5 app into routes, controllers, services and repositories, and how hexagonal architecture keeps business logic independent of Express.
updateDate: 2026-10-25T09:58
author: ['bishal-biswas']
level: 4
tags: ['express', 'architecture', 'clean-code', 'design-patterns']
course: expressjs
---

## What you will learn

- Why "everything in the route handler" stops working as an app grows
- The four common **layers** of an Express app: routes, controllers, services and repositories
- What **hexagonal architecture** (ports and adapters) adds on top of layers
- How to test your business rules without starting Express or a database
- When this structure helps, and when it is overkill

## The problem: fat route handlers

When you start, it feels natural to put everything in one handler. Here is a typical example:

```js
// routes/notes.js (everything in one place)
router.post('/notes', async (req, res) => {
  if (!req.body?.title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const count = await Note.countDocuments({ ownerId: req.user.id });
  if (count >= 100) {
    return res.status(403).json({ error: 'Free plan allows 100 notes' });
  }
  const note = await Note.create({ ...req.body, ownerId: req.user.id });
  res.status(201).json({ id: note._id, title: note.title });
});
```

This handler does four different jobs: it reads HTTP input, applies a **business rule** (a rule about how your product works, like "free users get 100 notes"), talks to MongoDB, and shapes the HTTP response.

That is fine for ten routes. At fifty routes, problems appear:

- The "100 notes" rule is copied into the import feature, the API and the admin panel. Someone changes one copy and forgets the others.
- To test the rule you need a running database and a fake HTTP request.
- Moving from MongoDB to PostgreSQL means touching every handler.

**Architecture** is just a set of decisions about where each kind of code lives. A good architecture makes the next change easy.

## Layers: one job per file

A **layered architecture** splits the code by job. Each layer only talks to the layer directly below it.

Think of a restaurant again:

| Restaurant | Layer | Job |
| --- | --- | --- |
| The menu board | **Routes** | Which URL goes to which controller |
| The waiter | **Controller** | Takes the order (HTTP request), brings back the plate (HTTP response) |
| The chef | **Service** | Knows the recipes, the business rules |
| The pantry | **Repository** | Stores and fetches ingredients, the data |

The waiter doesn't cook. The chef doesn't talk to customers. The pantry doesn't care what dish is being made.

```text
 HTTP request
      |
      v
 +-----------+   URL + method -> controller function
 |  Routes   |
 +-----------+
      |
      v
 +-------------+  read req, call service, send res
 | Controller  |  (the only layer that knows about req/res)
 +-------------+
      |
      v
 +-----------+   business rules, plain JavaScript
 |  Service  |   (no req, no res, no SQL)
 +-----------+
      |
      v
 +-------------+  save and load data
 | Repository  |  (the only layer that knows about the database)
 +-------------+
      |
      v
   Database
```

A typical folder layout:

```text
src/
  app.js
  server.js
  errors.js
  routes/
    notes.routes.js
  controllers/
    notes.controller.js
  services/
    notes.service.js
  repositories/
    notes.mongo-repository.js
    notes.memory-repository.js
```

Let's build each piece for the notes example.

### The repository: data in, data out

A **repository** hides the database. It offers simple functions like `findById` and `create`, and it returns plain JavaScript objects, not Mongoose documents.

```js
// src/repositories/notes.mongo-repository.js
import { Note } from '../models/note.model.js';

// Turn a database record into a plain object the rest of the app understands
const toNote = (doc) => doc && {
  id: String(doc._id),
  title: doc.title,
  body: doc.body,
  ownerId: doc.ownerId,
};

export const createMongoNotesRepository = () => ({
  async countByOwner(ownerId) {
    return Note.countDocuments({ ownerId });
  },
  async create(data) {
    const doc = await Note.create(data);
    return toNote(doc);
  },
  async findById(id) {
    const doc = await Note.findById(id).lean();
    return toNote(doc);
  },
});
```

> **Note:** Returning plain objects matters. If a Mongoose document leaks into the service, the service quietly depends on Mongoose again.

### Domain errors

Services should not know about HTTP status codes. Instead they throw errors that describe *what went wrong in business terms*. We call these **domain errors** (the **domain** is the real-world problem your app solves).

```js
// src/errors.js
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class LimitReachedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LimitReachedError';
  }
}
```

### The service: business rules only

The **service** holds the rules. It receives the repository as an argument instead of importing it. (Passing in what a function needs like this is called **dependency injection**; the next lesson covers it in depth.)

```js
// src/services/notes.service.js
import { LimitReachedError, NotFoundError, ValidationError } from '../errors.js';

const FREE_PLAN_LIMIT = 100;

export const createNotesService = (notesRepo) => ({
  async createNote(ownerId, { title, body = '' }) {
    if (!title || title.trim() === '') {
      throw new ValidationError('Title is required');
    }
    const count = await notesRepo.countByOwner(ownerId);
    if (count >= FREE_PLAN_LIMIT) {
      throw new LimitReachedError(`Free plan allows ${FREE_PLAN_LIMIT} notes`);
    }
    return notesRepo.create({ ownerId, title: title.trim(), body });
  },

  async getNote(ownerId, id) {
    const note = await notesRepo.findById(id);
    if (!note || note.ownerId !== ownerId) {
      throw new NotFoundError('Note not found');
    }
    return note;
  },
});
```

Look at what is *missing*: no `req`, no `res`, no status codes, no Mongoose. This file is plain JavaScript. You could call it from a command-line script, a queue worker or a test.

### The controller: translate HTTP

The **controller** is the translator between HTTP and your service. It reads from `req`, calls the service, and writes to `res`.

```js
// src/controllers/notes.controller.js
export const createNotesController = (notesService) => ({
  create: async (req, res) => {
    const note = await notesService.createNote(req.user.id, req.body ?? {});
    res.status(201).json(note);
  },

  show: async (req, res) => {
    const note = await notesService.getNote(req.user.id, req.params.id);
    res.json(note);
  },
});
```

No `try/catch` needed: in Express 5, a thrown error inside an `async` handler goes straight to your error-handling middleware.

### Routes and wiring

```js
// src/routes/notes.routes.js
import { Router } from 'express';

export const createNotesRouter = (notesController) => {
  const router = Router();
  router.post('/', notesController.create);
  router.get('/:id', notesController.show);
  return router;
};
```

```js
// src/app.js
import express from 'express';
import { createMongoNotesRepository } from './repositories/notes.mongo-repository.js';
import { createNotesService } from './services/notes.service.js';
import { createNotesController } from './controllers/notes.controller.js';
import { createNotesRouter } from './routes/notes.routes.js';
import { requireUser } from './middleware/require-user.js';
import { errorHandler } from './middleware/error-handler.js';

const notesRepo = createMongoNotesRepository();
const notesService = createNotesService(notesRepo);
const notesController = createNotesController(notesService);

export const app = express();
app.use(express.json());
app.use('/api/notes', requireUser, createNotesRouter(notesController));
app.use(errorHandler);
```

### Mapping domain errors to HTTP

One error handler turns domain errors into HTTP responses. This is the only place that knows "a `LimitReachedError` means `403`".

```js
// src/middleware/error-handler.js
const statusByName = {
  ValidationError: 400,
  NotFoundError: 404,
  LimitReachedError: 403,
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = statusByName[err.name];
  if (status) {
    return res.status(status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
};
```

Try it:

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":""}'
```

```text
{"error":"Title is required"}
```

## Hexagonal architecture: ports and adapters

Layers are a great start, but there is a subtle problem. In the diagram above, the service sits *on top of* the repository, so it seems to depend on the database layer. **Hexagonal architecture**, also called **ports and adapters**, flips that view around.

Imagine your business logic as a laptop. The laptop has **ports** (USB, HDMI). It doesn't care whether you plug in a Logitech mouse or a cheap one; any device with the right plug works. The devices are **adapters**.

- The **core** (or domain) is your services and business rules. It sits in the middle.
- A **port** is a contract the core defines: "I need something with `countByOwner`, `create` and `findById`."
- An **adapter** is a concrete thing that fits a port: a MongoDB repository, an in-memory repository, an email sender.

```text
              +-----------------------------+
   Express    |                             |   MongoDB adapter
   (HTTP) --->|  driving      CORE          |---> (implements NotesRepository)
   adapter    |  side      notes.service    |
              |            business rules   |   In-memory adapter
   CLI   ---->|                             |---> (for tests)
   script     |                             |
              +-----------------------------+
          "driving" adapters          "driven" adapters
          call into the core          are called by the core
```

The big idea: **Express itself is just an adapter.** It is one way of calling your core. A command-line script or a background job is another.

### Describing a port in JavaScript

JavaScript has no `interface` keyword, so we describe the port with a JSDoc comment. Your editor will use it for autocomplete. (In TypeScript you would write a real `interface`.)

```js
// src/ports/notes-repository.js

/**
 * The port: anything the notes service can store notes in.
 * @typedef {object} NotesRepository
 * @property {(ownerId: string) => Promise<number>} countByOwner
 * @property {(data: { ownerId: string, title: string, body: string }) => Promise<Note>} create
 * @property {(id: string) => Promise<Note | null>} findById
 */

/**
 * @typedef {object} Note
 * @property {string} id
 * @property {string} ownerId
 * @property {string} title
 * @property {string} body
 */

export {};
```

### A second adapter: in memory

Here is another adapter that fits the same port, using a `Map` instead of a database:

```js
// src/repositories/notes.memory-repository.js
import { randomUUID } from 'node:crypto';

export const createMemoryNotesRepository = () => {
  const notes = new Map();
  return {
    async countByOwner(ownerId) {
      return [...notes.values()].filter((n) => n.ownerId === ownerId).length;
    },
    async create(data) {
      const note = { id: randomUUID(), ...data };
      notes.set(note.id, note);
      return note;
    },
    async findById(id) {
      return notes.get(id) ?? null;
    },
  };
};
```

The service doesn't change at all. You just plug in a different adapter.

### The payoff: fast, simple tests

Now you can test the "100 notes" rule with no Express, no Supertest and no MongoDB:

```js
// test/notes.service.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotesService } from '../src/services/notes.service.js';
import { createMemoryNotesRepository } from '../src/repositories/notes.memory-repository.js';

test('rejects an empty title', async () => {
  const service = createNotesService(createMemoryNotesRepository());
  await assert.rejects(service.createNote('u1', { title: '  ' }), { name: 'ValidationError' });
});

test('stops at the free plan limit', async () => {
  const repo = createMemoryNotesRepository();
  const service = createNotesService(repo);
  for (let i = 0; i < 100; i++) {
    await service.createNote('u1', { title: `Note ${i}` });
  }
  await assert.rejects(service.createNote('u1', { title: 'One too many' }), { name: 'LimitReachedError' });
});

test('users cannot read each other\'s notes', async () => {
  const service = createNotesService(createMemoryNotesRepository());
  const note = await service.createNote('alice', { title: 'Secret' });
  await assert.rejects(service.getNote('bob', note.id), { name: 'NotFoundError' });
});
```

```bash
node --test
```

These tests run in milliseconds. You still keep a few Supertest tests to check the HTTP wiring, but most rules are tested at the service level.

## Layer folders or feature folders?

There are two popular ways to arrange the files:

| By layer | By feature |
| --- | --- |
| `controllers/notes.controller.js` | `notes/notes.controller.js` |
| `controllers/users.controller.js` | `notes/notes.service.js` |
| `services/notes.service.js` | `notes/notes.repository.js` |
| `services/users.service.js` | `users/users.controller.js` |
| Easy to learn | Everything about one feature is in one folder |
| Gets crowded at 30+ features | Scales better in large apps |

Both use the same layers *inside*. For a small team, either is fine. Many teams start by layer and switch to feature folders as the app grows.

## When not to use all this

Layers add files and indirection. For a 5-route webhook receiver or a weekend prototype, a single file is perfectly fine. A rough guide:

- **Tiny app or prototype:** routes with inline logic.
- **Growing app, a few business rules:** split out services. This gives you most of the benefit.
- **Long-lived app, several developers, rules you must test carefully:** full layers plus ports and adapters.

> **Tip:** You don't have to restructure everything at once. Next time you touch a fat handler, pull its business rule into a service. Small steps add up.

## Common mistakes

> **Common mistake:** Passing `req` or `res` into a service. The moment a service reads `req.body`, it depends on Express again. Pass only the values it needs, like `ownerId` and `{ title, body }`.

> **Common mistake:** Returning HTTP status codes from services, such as `return { status: 404 }`. Throw a domain error and let the error handler map it.

> **Common mistake:** Letting database objects leak upwards. A Mongoose document has methods like `.save()`. If the controller calls them, your layers are no longer separate.

> **Common mistake:** Creating "pass-through" layers that add nothing, like a service that only calls `repo.findAll()`. That's acceptable for consistency, but don't add a layer just because a diagram has one.

## Key takeaways

- **Routes** map URLs, **controllers** translate HTTP, **services** hold business rules, **repositories** talk to the database.
- Services should be plain JavaScript with no `req`, `res`, status codes or database calls.
- Throw **domain errors** in services and map them to HTTP status codes in one error handler.
- **Hexagonal architecture** puts the core in the middle; Express and databases are just **adapters** plugged into **ports**.
- An in-memory adapter lets you test business rules quickly without a database.
- Match the structure to the size of the app; don't over-engineer a small one.

## Practice

1. Take a fat route handler from your Notes API project and split it into a controller, a service and a repository.
2. Add an `updateNote(ownerId, id, changes)` method to the service that throws `NotFoundError` for another user's note. Test it with the in-memory repository.
3. Add a `ConflictError` (for example, "a note with this title already exists") and map it to `409` in the error handler.
4. Write a tiny command-line script, `scripts/create-note.js`, that creates a note by calling the service directly. Notice that you didn't need Express at all.

## What's next

You've seen services receive their repository as an argument. Next, learn how to wire a whole app this way and why it makes testing so much easier: [Dependency Injection in Express Apps](/courses/expressjs/dependency-injection).

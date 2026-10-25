---
publishDate: 2026-10-25T09:53
title: Testing with Supertest and the Node Test Runner
slug: testing-with-supertest
metadescription: Learn how to write automated tests for Express 5 APIs using Supertest with the built-in node:test runner, including request bodies, errors, mocks and test-friendly app structure.
updateDate: 2026-10-25T09:53
author: ['bishal-biswas']
level: 3
tags: ['express', 'testing', 'supertest', 'node-test']
course: expressjs
---

## What you will learn

- Why automated tests save time, and what an **integration test** for an API looks like
- How to structure an Express app so it is easy to test
- How to write tests with Node's built-in `node:test` runner and `node:assert/strict`
- How to send requests, bodies and headers with **Supertest**, and check the responses
- How to test errors, use fake dependencies and mock functions

## Why write tests?

So far you have checked your routes by hand with `curl` or a browser. That works for one route. It does not work for fifty routes, every time you change a line of code.

An **automated test** is a small program that uses your code and checks the result. You run all of them with one command. If something you changed breaks something else, a test fails and tells you exactly where.

**Think of a pilot's pre-flight checklist.** The pilot knows how to fly, but still checks every item before every flight, because missing one is expensive. Tests are your app's checklist, and the computer runs it for you in seconds.

| Kind of test | What it checks | Example |
| --- | --- | --- |
| **Unit test** | One function on its own | `slugify('Hello World')` returns `'hello-world'` |
| **Integration test** | Several parts working together | `POST /notes` saves a note and returns `201` |
| **End-to-end test** | The whole system, often through a real browser | A user signs up, logs in and creates a note |

For APIs, integration tests give the best value: they send real HTTP requests to your routes, through your middleware, and check real responses. That is what Supertest is for.

## The tools

- **`node:test`** is Node's built-in test runner. It gives you `describe`, `it`, `beforeEach` and friends. Nothing to install.
- **`node:assert/strict`** gives you checks such as `assert.equal()` and `assert.deepEqual()`. If a check fails, the test fails.
- **Supertest** sends HTTP requests to an Express app **without** you starting a server on a port. It starts a temporary one for each request and cleans up after itself.

```bash
npm install --save-dev supertest
```

Add a test script to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test"
  }
}
```

`node --test` finds test files automatically, such as any file ending in `.test.js` or any `.js` file inside a `test` folder.

## Step 1: separate the app from the server

To test an app, you need to import it **without** it starting to listen on port 3000. So split it into two files:

- `app.js` builds and exports the Express app.
- `server.js` imports the app and calls `app.listen()`.

Even better, make `app.js` export a **function** that builds the app and receives its dependencies (such as the data store). Then each test can build a fresh app with fake data.

```text
notes-api/
  package.json
  src/
    app.js          creates the Express app
    notes-repo.js   stores notes (in memory for this lesson)
    server.js       starts listening
  test/
    notes.test.js
```

```js
// src/notes-repo.js
import { randomUUID } from 'node:crypto';

export const createMemoryNotesRepo = (initialNotes = []) => {
  const notes = new Map(initialNotes.map((note) => [note.id, note]));

  return {
    list: async () => [...notes.values()],
    get: async (id) => notes.get(id) ?? null,
    create: async ({ title }) => {
      const note = { id: randomUUID(), title, createdAt: new Date().toISOString() };
      notes.set(note.id, note);
      return note;
    },
  };
};
```

```js
// src/app.js
import express from 'express';

export const createApp = ({ notesRepo }) => {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/notes', async (req, res) => {
    res.json(await notesRepo.list());
  });

  app.get('/notes/:id', async (req, res) => {
    const note = await notesRepo.get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  });

  app.post('/notes', async (req, res) => {
    const title = req.body?.title;
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }
    const note = await notesRepo.create({ title: title.trim() });
    res.status(201).json(note);
  });

  // 404 for unknown routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler: four parameters, after all routes
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};
```

```js
// src/server.js
import { createApp } from './app.js';
import { createMemoryNotesRepo } from './notes-repo.js';

const app = createApp({ notesRepo: createMemoryNotesRepo() });

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

> **Note:** Passing dependencies into a function like `createApp({ notesRepo })` is a simple form of **dependency injection**. You will explore it properly in [Dependency Injection in Express Apps](/courses/expressjs/dependency-injection).

## Step 2: your first test

```js
// test/notes.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createMemoryNotesRepo } from '../src/notes-repo.js';

describe('GET /health', () => {
  it('returns status ok', async () => {
    const app = createApp({ notesRepo: createMemoryNotesRepo() });

    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });
});
```

Read it like a sentence: "make a request to `app`, `GET /health`, then check the status is 200 and the body is `{ status: 'ok' }`."

- `request(app)` wraps your Express app. You never call `listen()`.
- `res.status` is the status code. `res.body` is the parsed JSON. `res.headers` holds the headers.
- `assert.equal` compares simple values. `assert.deepEqual` compares objects and arrays by their contents.

Run it:

```bash
npm test
```

You should see output similar to this:

```text
▶ GET /health
  ✔ returns status ok (21.4ms)
✔ GET /health (22.9ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

Now break it on purpose: change `'ok'` to `'okay'` in `app.js` and run the tests again. You get a clear message showing the expected and actual values. Always watch a test fail once, so you know it really checks something.

## Step 3: testing a full resource

A good API test suite checks the **happy path** (everything works) and the **sad paths** (bad input, missing items).

```js
// test/notes.test.js (continued, below the first describe block)
describe('Notes API', () => {
  let app;

  // A fresh app and empty store before every test, so tests cannot affect each other
  beforeEach(() => {
    app = createApp({
      notesRepo: createMemoryNotesRepo([
        { id: 'n1', title: 'First note', createdAt: '2026-10-25T09:00:00.000Z' },
      ]),
    });
  });

  it('lists notes', async () => {
    const res = await request(app).get('/notes');

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].title, 'First note');
  });

  it('returns one note by id', async () => {
    const res = await request(app).get('/notes/n1');

    assert.equal(res.status, 200);
    assert.equal(res.body.id, 'n1');
  });

  it('returns 404 for a missing note', async () => {
    const res = await request(app).get('/notes/does-not-exist');

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Note not found' });
  });

  it('creates a note', async () => {
    const res = await request(app).post('/notes').send({ title: '  Buy milk  ' });

    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Buy milk'); // trimmed
    assert.match(res.headers['content-type'], /json/);

    // The new note should now appear in the list
    const list = await request(app).get('/notes');
    assert.equal(list.body.length, 2);
  });

  it('rejects a note without a title', async () => {
    const res = await request(app).post('/notes').send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'title is required');
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');

    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Not found' });
  });
});
```

`.send(object)` sends a JSON body and sets `Content-Type: application/json` for you, just like a real client would.

> **Tip:** Supertest also has its own `.expect()` style: `await request(app).get('/health').expect(200).expect('Content-Type', /json/)`. It is handy for quick checks. Using `assert` keeps all your tests in one consistent style.

### Sending headers, auth and cookies

```js
// test/auth.test.js (examples)
// A header, such as a bearer token
const res = await request(app)
  .get('/me')
  .set('Authorization', `Bearer ${token}`);

// Cookies that should persist between requests: use an agent
const agent = request.agent(app);
await agent.post('/login').send({ email: 'test@example.com', password: 'test-password' });
const profile = await agent.get('/me'); // the session cookie from /login is sent automatically
```

## Step 4: testing errors

Express 5 forwards errors from `async` handlers to your error handler. You should check that your error handler really turns them into a safe `500`. With `createApp`, you can pass in a repo that always fails:

```js
// test/errors.test.js
import { it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

it('returns 500 when the data store fails', async () => {
  const brokenRepo = {
    list: async () => {
      throw new Error('database is down');
    },
  };
  const app = createApp({ notesRepo: brokenRepo });

  const res = await request(app).get('/notes');

  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { error: 'Internal server error' }); // no internal details leaked
});
```

This is the power of passing dependencies in: you can simulate a database outage in three lines, with no real database.

## Step 5: mock functions

Sometimes you want to know **how** a dependency was called. `node:test` has `mock.fn()`, which creates a fake function that records every call.

```js
// test/create-note.test.js
import { it, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

it('passes the trimmed title to the repo', async () => {
  const create = mock.fn(async ({ title }) => ({ id: 'x1', title, createdAt: 'now' }));
  const app = createApp({ notesRepo: { create } });

  await request(app).post('/notes').send({ title: '  Hello  ' });

  assert.equal(create.mock.callCount(), 1);
  assert.deepEqual(create.mock.calls[0].arguments, [{ title: 'Hello' }]);
});
```

## Testing with a real database

In-memory fakes are fast and great for most tests. You should still have some tests that use a real database, to catch problems with queries and schemas.

| Option | How |
| --- | --- |
| A separate test database | Point `MONGODB_URI` or `DATABASE_URL` at a test database, and clear it in `beforeEach` |
| SQLite in memory | With Sequelize: `new Sequelize('sqlite::memory:')`, fresh for each test run |
| In-memory MongoDB | The `mongodb-memory-server` package starts a throwaway MongoDB for tests |

> **Warning:** Never point tests at your production database. Tests create and delete data freely.

## Useful test runner options

| Command | What it does |
| --- | --- |
| `node --test` | Run all test files once |
| `node --test --watch` | Re-run tests when files change |
| `node --test test/notes.test.js` | Run one file |
| `node --test --test-name-pattern="creates"` | Run only tests whose name matches |
| `node --test --experimental-test-coverage` | Show which lines your tests ran (still marked experimental) |

These work on Node.js 22. Some flags exist on older versions with slightly different behaviour.

You can also focus or skip a test while working: `it.only(...)` and `it.skip(...)`. Remember to remove them before committing.

## Common mistakes

- **Calling `app.listen()` in the file you import in tests.** Tests start real servers, ports clash and the test process never exits. Keep `listen()` in `server.js`.
- **Sharing state between tests.** One test creates a note, another expects the list to be empty. Build a fresh app in `beforeEach`.
- **Forgetting `await`.** Without it, the test finishes before the request does and passes for the wrong reason.
- **Only testing the happy path.** Bugs live in the `400`, `404` and `500` cases.
- **Comparing objects with `assert.equal`.** Two objects with the same contents are not "equal" by reference. Use `assert.deepEqual`.

## Key takeaways

- Integration tests send real HTTP requests to your app and check real responses; they give the most value for APIs.
- Export the app (or a `createApp()` function) separately from `app.listen()` so tests can import it.
- Use `node:test` (`describe`, `it`, `beforeEach`, `mock`) with `node:assert/strict`, and run them with `node --test`.
- `request(app).get(...)`, `.post(...).send(body)`, `.set(header, value)` and `request.agent(app)` cover most needs.
- Test sad paths and errors too; passing fake dependencies makes failures easy to simulate.

## Practice

1. Add a `DELETE /notes/:id` route to the example, then write tests for deleting an existing note (`204`) and a missing note (`404`).
2. Write a test proving that `POST /notes` with a title of only spaces returns `400`.
3. Add a test that checks your `/notes` route returns notes in the order they were created.
4. Run `node --test --watch`, then break and fix a route, and watch the tests react.

## What's next

Your tests check that the API works. Next you will describe it so other developers can use it without reading your code. Continue with [OpenAPI and Swagger Documentation](/courses/expressjs/openapi-and-swagger).

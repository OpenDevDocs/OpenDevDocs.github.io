---
publishDate: 2026-10-25T11:10
title: "Project: A Notes REST API with http and node:sqlite"
slug: project-notes-rest-api
metadescription: Build a complete notes REST API with only Node built-ins. CRUD routes, SQLite storage, validation, proper status codes and clean JSON errors.
updateDate: 2026-10-25T11:10
author: ['bishal-biswas']
level: 2
tags: ['project', 'rest-api', 'sqlite', 'http']
course: nodejs
---

## What you will build

Time to put the last few lessons together. You will build a **REST API** for notes, the kind of backend a notes app on your phone would talk to.

**REST** is a popular style for APIs. Each kind of thing (here, notes) gets a URL, and the HTTP method says what to do with it. It is like a library desk: the same counter for every book, and you say "borrow", "return" or "renew".

You will use only Node built-ins:

- `node:http` for the server, from [the http Module lesson](/courses/nodejs/http-module-and-servers).
- A route table, from [the Routing lesson](/courses/nodejs/routing-without-a-framework).
- `node:sqlite` for storage, from [the node:sqlite lesson](/courses/nodejs/node-sqlite).

## Step 1: plan the API

Write the plan first. Every row is one **endpoint** (a method plus a path):

| Method | Path | What it does | Success |
| --- | --- | --- | --- |
| GET | `/health` | Is the server alive? | 200 |
| GET | `/notes` | List notes, with `?q=`, `?limit=`, `?offset=` | 200 |
| POST | `/notes` | Create a note | 201 |
| GET | `/notes/:id` | Get one note | 200 |
| PUT | `/notes/:id` | Replace a note | 200 |
| DELETE | `/notes/:id` | Delete a note | 204 |

Create, read, update, delete: together these are called **CRUD**.

A note looks like this:

```json
{
  "id": 1,
  "title": "Shopping list",
  "body": "Milk, eggs, bread",
  "pinned": false,
  "createdAt": "2026-10-25T11:24:00.192Z",
  "updatedAt": "2026-10-25T11:24:00.192Z"
}
```

And every error has the same shape, so client code can handle them all in one place:

```json
{ "error": { "status": 422, "message": "Validation failed", "details": ["title is required and must be a non-empty string"] } }
```

The error status codes you will use:

| Code | Meaning | When |
| --- | --- | --- |
| 400 | Bad Request | Broken JSON, or a bad `?limit=` |
| 404 | Not Found | Unknown route, or no note with that id |
| 405 | Method Not Allowed | Known path, wrong method |
| 413 | Payload Too Large | Body over the size limit |
| 415 | Unsupported Media Type | Body is not sent as JSON |
| 422 | Unprocessable Entity | Valid JSON, but the data breaks the rules |
| 500 | Internal Server Error | A bug in your code |

The difference between 400 and 422: 400 means "I could not even read that", 422 means "I read it, but it is not acceptable".

## Step 2: set up the project

```bash
mkdir notes-api
cd notes-api
npm init -y
```

Edit `package.json` so it uses ES modules and has two scripts:

```json
{
  "name": "notes-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node --disable-warning=ExperimentalWarning server.js",
    "dev": "node --watch --disable-warning=ExperimentalWarning server.js"
  }
}
```

`--disable-warning=ExperimentalWarning` hides the warning `node:sqlite` prints on Node 24. You will end up with five small files, each with one job:

```text
notes-api/
├── package.json
├── db.js            storage: all the SQL lives here
├── http-helpers.js  sending JSON, reading JSON, HttpError
├── validate.js      the rules for a note
├── app.js           routes and handlers
└── server.js        starts everything
```

Each code block below is the complete, final version of that file.

## Step 3: the database layer

`db.js` hides SQLite from the rest of the app. Other files call friendly methods like `notes.create(...)` and never see SQL.

```javascript
// db.js: everything that talks to SQLite lives here
import { DatabaseSync } from 'node:sqlite';

export function openNotesDb(file = 'notes.db') {
  const db = new DatabaseSync(file);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id        INTEGER PRIMARY KEY,
      title     TEXT    NOT NULL,
      body      TEXT    NOT NULL DEFAULT '',
      pinned    INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT    NOT NULL,
      updatedAt TEXT    NOT NULL
    )
  `);

  // Prepare every statement once, when the app starts
  const sql = {
    list: db.prepare(`
      SELECT * FROM notes
      WHERE title LIKE :pattern OR body LIKE :pattern
      ORDER BY pinned DESC, updatedAt DESC, id DESC
      LIMIT :limit OFFSET :offset
    `),
    get: db.prepare('SELECT * FROM notes WHERE id = ?'),
    insert: db.prepare(`
      INSERT INTO notes (title, body, pinned, createdAt, updatedAt)
      VALUES (:title, :body, :pinned, :now, :now)
    `),
    update: db.prepare(`
      UPDATE notes SET title = :title, body = :body, pinned = :pinned, updatedAt = :now
      WHERE id = :id
    `),
    remove: db.prepare('DELETE FROM notes WHERE id = ?'),
  };

  // SQLite has no booleans: turn 1/0 back into true/false for the API
  function toNote(row) {
    if (!row) return undefined;
    return { ...row, pinned: row.pinned === 1 };
  }

  return {
    list({ q = '', limit = 20, offset = 0 } = {}) {
      return sql.list.all({ pattern: `%${q}%`, limit, offset }).map(toNote);
    },
    get(id) {
      return toNote(sql.get.get(id));
    },
    create({ title, body, pinned }) {
      const now = new Date().toISOString();
      const result = sql.insert.run({ title, body, pinned: pinned ? 1 : 0, now });
      return this.get(result.lastInsertRowid);
    },
    update(id, { title, body, pinned }) {
      const now = new Date().toISOString();
      const result = sql.update.run({ id, title, body, pinned: pinned ? 1 : 0, now });
      return result.changes === 0 ? undefined : this.get(id);
    },
    remove(id) {
      return sql.remove.run(id).changes > 0;
    },
    close() {
      db.close();
    },
  };
}
```

A few details worth noticing:

- `LIKE '%milk%'` finds "milk" anywhere in the text. SQLite's `LIKE` ignores case for English letters.
- Pinned notes come first, then the most recently changed.
- `update` and `remove` use `changes` to tell "done" apart from "no such note".
- The `:now` parameter appears twice in the insert. SQLite fills both with the same value.

Try it before going further. A quick script with an in-memory database:

```javascript
// try-db.js (you can delete this afterwards)
import { openNotesDb } from './db.js';

const notes = openNotesDb(':memory:');
console.log(notes.create({ title: 'Shopping', body: 'Milk, eggs', pinned: false }));
notes.create({ title: 'Call Ravi', body: '', pinned: true });
console.log(notes.list().map((n) => n.title));
console.log(notes.remove(1), notes.remove(1));
```

```bash
node --disable-warning=ExperimentalWarning try-db.js
```

```text
{
  id: 1,
  title: 'Shopping',
  body: 'Milk, eggs',
  pinned: false,
  createdAt: '2026-10-25T11:23:25.557Z',
  updatedAt: '2026-10-25T11:23:25.557Z'
}
[ 'Call Ravi', 'Shopping' ]
true false
```

The pinned note is listed first, and deleting the same note twice returns `false` the second time. The storage layer works.

## Step 4: HTTP helpers

These come straight from the Routing lesson, with two upgrades: errors can carry `details`, and `readJson` insists on a JSON `Content-Type`.

```javascript
// http-helpers.js: small tools for JSON over HTTP
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}

export function sendError(res, status, message, details) {
  const error = { status, message };
  if (details) error.details = details;
  sendJson(res, status, { error });
}

export async function readJson(req, limit = 100_000) {
  const type = req.headers['content-type'] ?? '';
  if (!type.startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, `Body must be under ${limit} bytes`);
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
}
```

## Step 5: validation

Never trust what a client sends. `validateNote` checks the data and returns both a list of problems and a cleaned-up value with defaults filled in:

```javascript
// validate.js: check a note sent by a client
const MAX_TITLE = 100;
const MAX_BODY = 10_000;

export function validateNote(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { errors: ['request body must be a JSON object'] };
  }

  const errors = [];
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const body = data.body ?? '';
  const pinned = data.pinned ?? false;

  if (title === '') {
    errors.push('title is required and must be a non-empty string');
  } else if (title.length > MAX_TITLE) {
    errors.push(`title must be at most ${MAX_TITLE} characters`);
  }

  if (typeof body !== 'string') {
    errors.push('body must be a string');
  } else if (body.length > MAX_BODY) {
    errors.push(`body must be at most ${MAX_BODY} characters`);
  }

  if (typeof pinned !== 'boolean') {
    errors.push('pinned must be true or false');
  }

  return { errors, value: { title, body, pinned } };
}
```

Collecting *all* the problems, instead of stopping at the first, saves the client several round trips.

## Step 6: routes and handlers

`app.js` builds the server. It takes the notes store as an argument instead of opening the database itself. That small choice means a test can hand it an in-memory database, which you will do in [the Built-in Test Runner lesson](/courses/nodejs/built-in-test-runner).

```javascript
// app.js: routes and handlers, built on a notes store from db.js
import http from 'node:http';
import { HttpError, sendJson, sendError, readJson } from './http-helpers.js';
import { validateNote } from './validate.js';

// Read ?limit= and ?offset= as safe whole numbers
function intParam(params, name, { fallback, min, max }) {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, `${name} must be a whole number from ${min} to ${max}`);
  }
  return n;
}

// Read the body, validate it, or throw a 422 with the list of problems
async function readNote(req) {
  const { errors, value } = validateNote(await readJson(req));
  if (errors.length > 0) throw new HttpError(422, 'Validation failed', errors);
  return value;
}

export function createApp(notes) {
  const handlers = {
    health(req, res) {
      sendJson(res, 200, { status: 'ok' });
    },

    list(req, res, params, url) {
      const q = url.searchParams.get('q') ?? '';
      const limit = intParam(url.searchParams, 'limit', { fallback: 20, min: 1, max: 100 });
      const offset = intParam(url.searchParams, 'offset', { fallback: 0, min: 0, max: 1_000_000 });
      sendJson(res, 200, { notes: notes.list({ q, limit, offset }), limit, offset });
    },

    get(req, res, params) {
      const note = notes.get(Number(params.id));
      if (!note) throw new HttpError(404, 'Note not found');
      sendJson(res, 200, note);
    },

    async create(req, res) {
      const note = notes.create(await readNote(req));
      sendJson(res, 201, note, { Location: `/notes/${note.id}` });
    },

    async update(req, res, params) {
      const input = await readNote(req);
      const note = notes.update(Number(params.id), input);
      if (!note) throw new HttpError(404, 'Note not found');
      sendJson(res, 200, note);
    },

    remove(req, res, params) {
      if (!notes.remove(Number(params.id))) throw new HttpError(404, 'Note not found');
      res.writeHead(204);
      res.end();
    },
  };

  const routes = [
    { method: 'GET', pattern: /^\/health$/, handler: handlers.health },
    { method: 'GET', pattern: /^\/notes$/, handler: handlers.list },
    { method: 'POST', pattern: /^\/notes$/, handler: handlers.create },
    { method: 'GET', pattern: /^\/notes\/(?<id>\d+)$/, handler: handlers.get },
    { method: 'PUT', pattern: /^\/notes\/(?<id>\d+)$/, handler: handlers.update },
    { method: 'DELETE', pattern: /^\/notes\/(?<id>\d+)$/, handler: handlers.remove },
  ];

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    try {
      const matches = routes.filter((r) => r.pattern.test(url.pathname));
      if (matches.length === 0) throw new HttpError(404, 'Route not found');

      const route = matches.find((r) => r.method === req.method);
      if (!route) {
        res.setHeader('Allow', matches.map((r) => r.method).join(', '));
        throw new HttpError(405, `Method ${req.method} not allowed here`);
      }

      const params = url.pathname.match(route.pattern).groups ?? {};
      await route.handler(req, res, params, url);
    } catch (err) {
      if (err instanceof HttpError) {
        return sendError(res, err.status, err.message, err.details);
      }
      console.error(err); // a real bug: log it, hide the details from the client
      sendError(res, 500, 'Internal server error');
    } finally {
      console.log(`${req.method} ${req.url} -> ${res.statusCode}`);
    }
  });
}
```

How it fits together:

- Handlers **throw** an `HttpError` when something is wrong. One `catch` turns every error into the same JSON shape, so no handler has to remember the format.
- A successful `POST` replies `201 Created` with a `Location` header pointing at the new note.
- `DELETE` replies `204 No Content` with an empty body.
- The `finally` block logs one line per request, like a tiny access log.

## Step 7: start the server

```javascript
// server.js: start the API
import { openNotesDb } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const notes = openNotesDb(process.env.DB_FILE ?? 'notes.db');
const server = createApp(notes);

server.listen(port, () => {
  console.log(`Notes API running on http://localhost:${port}`);
});

// Ctrl+C (SIGINT) or a stop signal from a host (SIGTERM): finish up cleanly
function shutdown() {
  console.log('Shutting down...');
  server.close(() => {
    notes.close();
    console.log('Bye!');
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

On shutdown, the server stops taking new requests, lets current ones finish, then closes the database. You will go deeper in [the Graceful Shutdown lesson](/courses/nodejs/graceful-shutdown).

```bash
npm run dev
```

```text
Notes API running on http://localhost:3000
```

## Step 8: test it end to end

Open a second terminal and work through every endpoint with curl.

Create two notes:

```bash
curl -i -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d '{"title":"Shopping list","body":"Milk, eggs, bread"}'
curl -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d '{"title":"Call Ravi","pinned":true}'
```

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Location: /notes/1

{"id":1,"title":"Shopping list","body":"Milk, eggs, bread","pinned":false,"createdAt":"2026-10-25T11:24:00.192Z","updatedAt":"2026-10-25T11:24:00.192Z"}
```

```text
{"id":2,"title":"Call Ravi","body":"","pinned":true,"createdAt":"2026-10-25T11:24:00.254Z","updatedAt":"2026-10-25T11:24:00.254Z"}
```

List and search:

```bash
curl http://localhost:3000/notes
curl "http://localhost:3000/notes?q=milk"
```

```text
{"notes":[{"id":2,"title":"Call Ravi",...,"pinned":true,...},{"id":1,"title":"Shopping list",...}],"limit":20,"offset":0}
{"notes":[{"id":1,"title":"Shopping list","body":"Milk, eggs, bread",...}],"limit":20,"offset":0}
```

(Long lines are shortened with `...` here.) The pinned note comes first, and the search found "Milk" even though you typed "milk".

Update, then delete:

```bash
curl -X PUT http://localhost:3000/notes/1 -H "Content-Type: application/json" -d '{"title":"Shopping list","body":"Milk, eggs, bread, rice"}'
curl -i -X DELETE http://localhost:3000/notes/1
```

```text
{"id":1,"title":"Shopping list","body":"Milk, eggs, bread, rice","pinned":false,"createdAt":"2026-10-25T11:24:00.192Z","updatedAt":"2026-10-25T11:24:00.418Z"}
HTTP/1.1 204 No Content
```

Notice `updatedAt` changed but `createdAt` did not.

Now the important part: try to break it. Each bad request should get a clear error, never a crash:

```bash
curl -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d '{"title":"","pinned":"yes"}'
curl -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d '{"title": oops}'
curl -X POST http://localhost:3000/notes -d '{"title":"x"}'
curl "http://localhost:3000/notes?limit=abc"
curl http://localhost:3000/notes/99
curl -i -X PATCH http://localhost:3000/notes/2
curl http://localhost:3000/todos
```

```text
{"error":{"status":422,"message":"Validation failed","details":["title is required and must be a non-empty string","pinned must be true or false"]}}
{"error":{"status":400,"message":"Body must be valid JSON"}}
{"error":{"status":415,"message":"Content-Type must be application/json"}}
{"error":{"status":400,"message":"limit must be a whole number from 1 to 100"}}
{"error":{"status":404,"message":"Note not found"}}
HTTP/1.1 405 Method Not Allowed
Allow: GET, PUT, DELETE
...
{"error":{"status":405,"message":"Method PATCH not allowed here"}}
{"error":{"status":404,"message":"Route not found"}}
```

The third one failed with 415 because curl's `-d` sends `application/x-www-form-urlencoded` unless you set the header.

Meanwhile the server terminal shows the access log:

```text
POST /notes -> 201
POST /notes -> 201
GET /notes -> 200
GET /notes?q=milk -> 200
PUT /notes/1 -> 200
DELETE /notes/1 -> 204
POST /notes -> 422
...
```

Finally, check that the data survives a restart. Start the server with `npm start` this time, then stop it with `Ctrl+C`:

```text
Shutting down...
Bye!
```

Start it again and run `curl http://localhost:3000/notes`. "Call Ravi" is still there, because it lives in `notes.db` on disk.

> **Tip:** On Windows PowerShell, type `curl.exe` instead of `curl`, and put the JSON in a file to avoid quoting trouble: `curl.exe -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d "@note.json"`.

## Ideas to take it further

- Add `PATCH /notes/:id` that changes only the fields sent. You will need a validator where every field is optional.
- Add a `tags` column and a `?tag=` filter.
- Return the total count with the list, using `SELECT COUNT(*)`.
- Escape `%` and `_` in the search text, which `LIKE` treats as wildcards.
- Write automated tests for every endpoint in the next lesson.

## Quick recap

- Plan endpoints, the resource shape and the error format before writing code.
- Split the app by job: storage (`db.js`), HTTP helpers, validation, routes, start-up.
- Handlers throw `HttpError`; one `catch` turns every error into the same JSON shape.
- Use the right status: 201 with `Location` for create, 204 for delete, 404, 405, 415, 422, 500.
- Validate every field and report all the problems at once.
- Pass the database into `createApp` so tests can use `:memory:`.
- Close the server and the database cleanly on `SIGINT` and `SIGTERM`.

<code id="code-content" class="language-javascript">
// notes-mini.mjs: a mini notes API in one file, tested end to end (Node 24)
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(':memory:'); // use 'notes.db' to keep data between runs
db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, updatedAt TEXT NOT NULL)');
const sql = {
  all: db.prepare('SELECT * FROM notes ORDER BY id'),
  get: db.prepare('SELECT * FROM notes WHERE id = ?'),
  insert: db.prepare('INSERT INTO notes (title, body, updatedAt) VALUES (:title, :body, :now)'),
  update: db.prepare('UPDATE notes SET title = :title, body = :body, updatedAt = :now WHERE id = :id'),
  remove: db.prepare('DELETE FROM notes WHERE id = ?'),
};
class HttpError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
const send = (res, status, data) =&gt; res.writeHead(status, { 'Content-Type': 'application/json' }).end(data === undefined ? undefined : JSON.stringify(data)); // writeHead returns res
async function readNote(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'Body must be valid JSON'); }
  const errors = [];
  if (typeof data?.title !== 'string' || !data.title.trim()) errors.push('title is required');
  if (errors.length &gt; 0) throw new HttpError(422, 'Validation failed', errors);
  return { title: data.title.trim(), body: data.body ?? '', now: new Date().toISOString() };
}
const server = http.createServer(async (req, res) =&gt; {
  const { pathname } = new URL(req.url, 'http://localhost');
  const match = pathname.match(/^\/notes\/(\d+)$/);
  const id = match ? Number(match[1]) : null;
  const notFound = () =&gt; { throw new HttpError(404, 'Note not found'); };
  try {
    if (pathname === '/notes' &amp;&amp; req.method === 'GET') return send(res, 200, sql.all.all());
    if (pathname === '/notes' &amp;&amp; req.method === 'POST') {
      const { lastInsertRowid } = sql.insert.run(await readNote(req));
      return send(res, 201, sql.get.get(lastInsertRowid));
    }
    if (id &amp;&amp; req.method === 'GET') return send(res, 200, sql.get.get(id) ?? notFound());
    if (id &amp;&amp; req.method === 'PUT') {
      const { changes } = sql.update.run({ id, ...(await readNote(req)) });
      return changes ? send(res, 200, sql.get.get(id)) : notFound();
    }
    if (id &amp;&amp; req.method === 'DELETE') return sql.remove.run(id).changes ? send(res, 204) : notFound();
    throw new HttpError(404, 'Route not found');
  } catch (err) {
    if (!(err instanceof HttpError)) console.error(err);
    send(res, err.status ?? 500, { error: { message: err.status ? err.message : 'Internal server error', details: err.details } });
  }
});
server.listen(0, async () =&gt; {
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body) =&gt; {
    const res = await fetch(base + path, { method, body: body &amp;&amp; JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    console.log(method, path, res.status, res.status === 204 ? '' : await res.text());
  };
  await call('POST', '/notes', { title: 'Shopping', body: 'Milk, eggs' }); // 201
  await call('POST', '/notes', { title: '' }); // 422
  await call('PUT', '/notes/1', { title: 'Shopping', body: 'Milk, eggs, bread' }); // 200
  await call('DELETE', '/notes/1'); // 204
  await call('GET', '/notes/1'); // 404
  server.close(() =&gt; db.close());
});
</code></pre>

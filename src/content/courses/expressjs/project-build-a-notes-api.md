---
publishDate: 2026-10-25T09:38
title: 'Project: Build a Complete Notes API'
slug: project-build-a-notes-api
metadescription: Build a complete notes REST API in Express 5 step by step, with routes, controllers and models, Zod validation, error and 404 handlers, pagination and curl tests.
updateDate: 2026-10-25T09:38
author: ['bishal-biswas']
level: 2
tags: ['express', 'project', 'rest', 'zod', 'crud']
course: expressjs
---

## What you will learn

- How to organise a real Express 5 API into **routes**, **controllers** and **models**
- How to validate every body, param and query string with Zod in one reusable middleware
- How to return consistent errors with custom error classes, a 404 handler and an error handler
- How to add pagination, filtering, search and sorting to a list endpoint
- How to test every endpoint, including the error cases, with `curl`

This is a guided project. You will not learn a new library here. Instead, you will combine what you learned in the earlier lessons into one small, complete, well-structured API. Type the code yourself rather than copying it; you will remember far more.

## What you will build

A REST API for personal notes. Each note has a title, some content, a list of tags, and a "pinned" flag.

| Method and path | What it does | Success |
| --- | --- | --- |
| `GET /health` | Check that the server is up | `200` |
| `GET /api/v1/notes` | List notes with pagination, search, filters and sorting | `200` |
| `POST /api/v1/notes` | Create a note | `201` + `Location` |
| `GET /api/v1/notes/:id` | Read one note | `200` |
| `PATCH /api/v1/notes/:id` | Update some fields of a note | `200` |
| `DELETE /api/v1/notes/:id` | Delete a note | `204` |

Every error, from a typo in the JSON to an unknown URL, comes back in the same shape:

```json
{ "error": { "code": "NOTE_NOT_FOUND", "message": "Note 3f2a... not found" } }
```

The URLs start with `/api/v1`, following the advice from [API Versioning](/courses/expressjs/api-versioning) to version from day one.

## Choosing where to store notes

You have seen three options: MongoDB, a SQL database through Sequelize, and a plain in-memory `Map`. This project uses an **in-memory store**, which means the notes live in a JavaScript `Map` inside the running process.

Why? Because it keeps the project runnable with the least setup:

- **Nothing to install** beyond three npm packages. No Docker, no database server, no Atlas account.
- **No native modules**, so there is nothing to compile, on any operating system.
- **The focus stays on Express**: structure, validation, errors and pagination.

The trade-off is that notes disappear when the server restarts. That is acceptable for a learning project. More importantly, you will hide the store behind a **model** module with `async` methods. Later, you can replace that one file with a Mongoose or Sequelize version, and the routes and controllers will not change at all. The end of this lesson sketches that swap.

## Step 1: Create the project

You need Node.js 20 or newer for this project (it uses `node --watch` and some newer JavaScript methods).

```bash
mkdir notes-api && cd notes-api
npm init -y
npm install express zod morgan
```

- **express**: the web framework.
- **zod**: validation, as in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod).
- **morgan**: one-line request logs, as in [Logging with Morgan and Pino](/courses/expressjs/logging-with-morgan-and-pino).

Open `package.json` and make it use ES modules, with two scripts. npm has already added a `dependencies` section below these lines; leave it as it is.

```json
{
  "name": "notes-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js"
  }
}
```

## Step 2: Plan the folder structure

Create these folders and empty files now. You will fill them one by one.

```text
notes-api/
  package.json
  src/
    server.js                  starts the HTTP server
    app.js                     builds the Express app (middleware, routes, handlers)
    errors.js                  custom error classes
    models/
      note.model.js            stores and finds notes (the only file that knows about storage)
    schemas/
      note.schemas.js          Zod schemas: what valid input looks like
    middleware/
      validate.js              runs Zod schemas against the request
      not-found.js             404 for unknown routes
      error-handler.js         turns any error into a JSON response
    controllers/
      notes.controller.js      handles each request: read input, call model, send response
    routes/
      notes.routes.js          maps URLs and methods to validation + controllers
```

Each layer has one job:

| Layer | Job | Knows about HTTP? | Knows about storage? |
| --- | --- | --- | --- |
| **Routes** | "Which URL runs which code?" | Yes | No |
| **Controllers** | "What does this request mean, and what do we send back?" | Yes | No |
| **Models** | "How do we save and find notes?" | No | Yes |

Here is how one request travels through the app:

```text
POST /api/v1/notes
   |
   v
morgan (log) -> express.json() (parse body)
   |
   v
routes/notes.routes.js  -- matches POST /
   |
   v
middleware/validate.js  -- Zod checks req.body ---- invalid? -> throw BadRequestError --+
   |                                                                                    |
   v                                                                                    |
controllers/notes.controller.js -- createNote()                                         |
   |                                                                                    |
   v                                                                                    |
models/note.model.js -- NoteModel.create()                                              |
   |                                                                                    |
   v                                                                                    v
201 Created + JSON                                              middleware/error-handler.js
```

> **Tip:** Separating `app.js` from `server.js` means you can import the app in automated tests without starting a real server. You will use this in [Testing with Supertest and the Node Test Runner](/courses/expressjs/testing-with-supertest).

## Step 3: Error classes

Start with the errors, because almost every other file uses them. This is the error toolkit from [Custom Error Classes and HTTP Errors](/courses/expressjs/custom-error-classes), trimmed to what the project needs.

```js
// src/errors.js
export class HttpError extends Error {
  constructor(status, message, { code, details, cause } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.status = status;
    this.code = code ?? 'HTTP_ERROR';
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', options = {}) {
    super(400, message, { code: 'BAD_REQUEST', ...options });
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found', options = {}) {
    super(404, message, { code: 'NOT_FOUND', ...options });
  }
}
```

Anything that is an `HttpError` is an **expected** error, safe to show to the client. Anything else is a bug and becomes a generic `500`.

## Step 4: The model (in-memory store)

The model is the only file that knows notes live in a `Map`. Every method is `async`, even though a `Map` is instant, so the rest of the app already treats storage as something you `await`, exactly like a real database.

```js
// src/models/note.model.js
import { randomUUID } from 'node:crypto';

// The whole "database": note id -> note object. It resets when the server restarts.
const notes = new Map();

// Hand out copies, so code outside this file cannot change stored notes by accident
const copy = (note) => structuredClone(note);

export const NoteModel = {
  async findMany({ page, limit, q, tag, pinned, sort }) {
    const needle = q?.toLowerCase();

    // 1. Filter
    const items = [...notes.values()].filter((note) =>
      (needle === undefined ||
        note.title.toLowerCase().includes(needle) ||
        note.content.toLowerCase().includes(needle)) &&
      (tag === undefined || note.tags.includes(tag)) &&
      (pinned === undefined || note.pinned === pinned),
    );

    // 2. Sort: "-createdAt" means newest first; id is the tie-breaker
    const descending = sort.startsWith('-');
    const field = descending ? sort.slice(1) : sort;
    items.sort((a, b) => {
      const result = a[field].localeCompare(b[field]) || a.id.localeCompare(b.id);
      return descending ? -result : result;
    });

    // 3. Paginate
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit).map(copy),
      total: items.length,
    };
  },

  async findById(id) {
    const note = notes.get(id);
    return note ? copy(note) : null;
  },

  async create({ title, content, tags, pinned }) {
    const now = new Date().toISOString();
    const note = { id: randomUUID(), title, content, tags, pinned, createdAt: now, updatedAt: now };
    notes.set(note.id, note);
    return copy(note);
  },

  async update(id, changes) {
    const note = notes.get(id);
    if (!note) return null;
    Object.assign(note, changes, { updatedAt: new Date().toISOString() });
    return copy(note);
  },

  async remove(id) {
    return notes.delete(id); // true if a note was deleted, false if it did not exist
  },
};
```

A few details worth noticing:

- **`randomUUID()`** creates a **UUID**, a long random id like `0b6f7a52-3c1e-4d7a-9f5e-2a8c1d4e6b90`. It is practically impossible to guess or to repeat.
- **Dates are ISO strings** (`2026-10-25T09:38:12.345Z`). They sort correctly as text, which keeps the sorting code simple.
- **The order is filter, sort, paginate**, as you learned in [Pagination, Filtering and Sorting](/courses/expressjs/pagination-filtering-sorting).
- **`structuredClone`** makes a deep copy, including the `tags` array.

## Step 5: Zod schemas

The schemas describe valid input for every route. They live in their own file so they are easy to find and reuse.

```js
// src/schemas/note.schemas.js
import { z } from 'zod';

// Field rules, shared by the create and update schemas
const title = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(120, 'Title must be 120 characters or fewer');

const content = z.string().max(10_000, 'Content must be 10,000 characters or fewer');

const tags = z
  .array(z.string().trim().toLowerCase().min(1, 'Tags cannot be empty').max(30))
  .max(10, 'A note can have at most 10 tags');

const pinned = z.boolean();

// POST body: title is required, the rest get defaults
export const createNoteSchema = z.strictObject({
  title,
  content: content.default(''),
  tags: tags.default([]),
  pinned: pinned.default(false),
});

// PATCH body: everything optional, NO defaults (they would overwrite saved values)
export const updateNoteSchema = z
  .strictObject({
    title: title.optional(),
    content: content.optional(),
    tags: tags.optional(),
    pinned: pinned.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'Send at least one field to update');

// Route params: /:id must be a UUID
export const noteIdSchema = z.object({
  id: z.uuid('Note id must be a valid UUID'),
});

// Query string for GET /api/v1/notes
export const SORT_OPTIONS = ['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'title', '-title'];

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'page must be 1 or more').default(1),
  limit: z.coerce.number().int().min(1).max(50, 'limit cannot be more than 50').default(10),
  q: z.string().trim().min(1).max(100).optional(),
  tag: z.string().trim().toLowerCase().min(1).optional(),
  pinned: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  sort: z.enum(SORT_OPTIONS, `sort must be one of: ${SORT_OPTIONS.join(', ')}`).default('-createdAt'),
});
```

Design decisions, one by one:

- **`z.strictObject`** for bodies rejects unknown fields like `"colour": "red"`, so typos in client code show up immediately instead of being silently ignored.
- **The query schema uses plain `z.object`**, which ignores unknown keys. Links often carry extra parameters (like tracking codes), and they should not break the list.
- **Tags are trimmed and lower-cased**, so `" Shopping "` and `"shopping"` are the same tag.
- **`pinned` in the query is the text `"true"` or `"false"`**, because query values are always strings. The transform turns it into a real boolean.
- **The update schema has no defaults.** In Zod 4, defaults still apply inside optional fields, so `tags.default([])` there would wipe a note's tags on every PATCH.

## Step 6: The validate middleware

One middleware runs any combination of schemas against `req.body`, `req.params` and `req.query`. Clean data goes on `req.validated`, because `req.query` is read-only in Express 5. Problems become a `BadRequestError` that the error handler formats.

```js
// src/middleware/validate.js
import { BadRequestError } from '../errors.js';

export const validate = (schemas) => (req, res, next) => {
  const validated = {};
  const details = [];

  for (const [part, schema] of Object.entries(schemas)) {
    // Express 5 leaves req.body undefined when there is no JSON body
    const result = schema.safeParse(req[part] ?? {});

    if (result.success) {
      validated[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({ field: [part, ...issue.path].join('.'), message: issue.message });
      }
    }
  }

  if (details.length > 0) {
    throw new BadRequestError('Validation failed', { code: 'VALIDATION_ERROR', details });
  }

  req.validated = validated;
  next();
};
```

Throwing inside middleware is safe: Express catches it and passes it to the error handler.

## Step 7: Controllers

A **controller** is a set of functions that handle requests. Each one reads validated input, asks the model for data, and sends a response. Controllers never touch the `Map` directly, and never check input by hand; the model and the schemas do that.

```js
// src/controllers/notes.controller.js
import { NoteModel } from '../models/note.model.js';
import { NotFoundError } from '../errors.js';

const noteNotFound = (id) =>
  new NotFoundError(`Note ${id} not found`, { code: 'NOTE_NOT_FOUND' });

export const listNotes = async (req, res) => {
  const { page, limit, q, tag, pinned, sort } = req.validated.query;
  const { items, total } = await NoteModel.findMany({ page, limit, q, tag, pinned, sort });
  const totalPages = Math.ceil(total / limit);

  res.json({
    data: items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
};

export const getNote = async (req, res) => {
  const { id } = req.validated.params;
  const note = await NoteModel.findById(id);
  if (!note) throw noteNotFound(id);
  res.json({ data: note });
};

export const createNote = async (req, res) => {
  const note = await NoteModel.create(req.validated.body);
  // req.baseUrl is where the router is mounted: "/api/v1/notes"
  res.status(201).location(`${req.baseUrl}/${note.id}`).json({ data: note });
};

export const updateNote = async (req, res) => {
  const { id } = req.validated.params;
  const note = await NoteModel.update(id, req.validated.body);
  if (!note) throw noteNotFound(id);
  res.json({ data: note });
};

export const deleteNote = async (req, res) => {
  const { id } = req.validated.params;
  const deleted = await NoteModel.remove(id);
  if (!deleted) throw noteNotFound(id);
  res.status(204).end();
};
```

Notice there is no `try/catch` anywhere. These are `async` functions, so in Express 5 any thrown error, or any rejected database promise later on, goes straight to the error handler.

## Step 8: Routes

The router connects each URL and method to its validation and controller. Reading this file should tell you the whole API at a glance.

```js
// src/routes/notes.routes.js
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  createNoteSchema,
  updateNoteSchema,
  noteIdSchema,
  listNotesQuerySchema,
} from '../schemas/note.schemas.js';
import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from '../controllers/notes.controller.js';

const router = Router();

router.get('/', validate({ query: listNotesQuerySchema }), listNotes);
router.post('/', validate({ body: createNoteSchema }), createNote);
router.get('/:id', validate({ params: noteIdSchema }), getNote);
router.patch('/:id', validate({ params: noteIdSchema, body: updateNoteSchema }), updateNote);
router.delete('/:id', validate({ params: noteIdSchema }), deleteNote);

export default router;
```

## Step 9: The 404 handler and the error handler

The **404 handler** runs only when no route matched. Instead of answering directly, it creates a `NotFoundError`, so that 404s use the same format as every other error, as shown in [Not Found and Fallback Handling](/courses/expressjs/not-found-handling).

```js
// src/middleware/not-found.js
import { NotFoundError } from '../errors.js';

export const notFound = (req, res, next) => {
  next(new NotFoundError(`Cannot find ${req.method} ${req.originalUrl}`, { code: 'ROUTE_NOT_FOUND' }));
};
```

The **error handler** has four parameters, so Express knows it handles errors. It sorts errors into three groups: our own `HttpError`s, errors from `express.json()`, and everything else.

```js
// src/middleware/error-handler.js
import { HttpError } from '../errors.js';

export const errorHandler = (err, req, res, next) => {
  // If a response is already on its way, let Express close the connection
  if (res.headersSent) return next(err);

  // 1. Expected errors we created ourselves
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // 2. Errors from express.json(): broken JSON or a body over the size limit
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
  }

  // 3. Anything else is a bug: log the details, show nothing sensitive
  console.error(err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' },
  });
};
```

## Step 10: Assemble the app and start the server

`app.js` puts everything in the right order: logging, body parsing, routes, then the 404 handler, then the error handler.

```js
// src/app.js
import express from 'express';
import morgan from 'morgan';
import notesRouter from './routes/notes.routes.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

// 1. Logging (skipped in automated tests to keep output clean)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 2. Body parsing, with a size limit
app.use(express.json({ limit: '100kb' }));

// 3. Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});
app.use('/api/v1/notes', notesRouter);

// 4. Nothing matched: 404
app.use(notFound);

// 5. Every error ends up here
app.use(errorHandler);

export default app;
```

```js
// src/server.js
import app from './app.js';

const port = Number(process.env.PORT) || 3000;

app.listen(port, (error) => {
  if (error) throw error; // for example, the port is already in use
  console.log(`Notes API listening on http://localhost:${port}`);
});
```

Start it:

```bash
npm run dev
```

```text
Notes API listening on http://localhost:3000
```

## Step 11: Test every endpoint with curl

Keep the server running and open a second terminal. Each command below shows what to expect.

> **Note:** These commands use bash syntax. On Windows, run them in Git Bash or WSL. In PowerShell, call `curl.exe` instead of `curl` and swap the outer single quotes for double quotes, escaping the inner ones.

### Health check

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "uptime": 12 }
```

### Create a note

```bash
curl -i -X POST http://localhost:3000/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","content":"2 litres","tags":[" Shopping ","errands"]}'
```

```http
HTTP/1.1 201 Created
Location: /api/v1/notes/0b6f7a52-3c1e-4d7a-9f5e-2a8c1d4e6b90
Content-Type: application/json; charset=utf-8

{"data":{"id":"0b6f7a52-3c1e-4d7a-9f5e-2a8c1d4e6b90","title":"Buy milk","content":"2 litres","tags":["shopping","errands"],"pinned":false,"createdAt":"2026-10-25T09:38:12.345Z","updatedAt":"2026-10-25T09:38:12.345Z"}}
```

(Some headers are left out above.) Notice that the tag `" Shopping "` was cleaned to `"shopping"`, and `pinned` got its default. Your id will be different. Save it in a shell variable so the next commands are easier to type:

```bash
NOTE_ID=0b6f7a52-3c1e-4d7a-9f5e-2a8c1d4e6b90   # paste your own id here
```

### Add more notes for pagination

This loop creates twelve practice notes, then one pinned note:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -X POST http://localhost:3000/api/v1/notes \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Practice note $i\",\"tags\":[\"practice\"]}"
done

curl -s -X POST http://localhost:3000/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Team meeting on Friday","pinned":true,"tags":["work"]}'
```

You now have 14 notes.

### List with pagination

```bash
curl "http://localhost:3000/api/v1/notes?limit=5&page=2"
```

```json
{
  "data": [
    { "id": "...", "title": "Practice note 8", "...": "..." },
    { "id": "...", "title": "Practice note 7", "...": "..." },
    { "id": "...", "title": "Practice note 6", "...": "..." },
    { "id": "...", "title": "Practice note 5", "...": "..." },
    { "id": "...", "title": "Practice note 4", "...": "..." }
  ],
  "meta": {
    "page": 2,
    "limit": 5,
    "total": 14,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

(The `"...": "..."` entries stand for the other fields of each note.)

The default sort is `-createdAt`, newest first. Work it out: page 1 holds the five newest notes (the meeting note, then practice notes 12, 11, 10 and 9), so page 2 starts at practice note 8. Page 3 holds the last four: notes 3, 2, 1 and "Buy milk". Checking the `meta` block against the data like this is exactly how you catch pagination bugs.

### Filter, search and sort

```bash
# Only pinned notes
curl "http://localhost:3000/api/v1/notes?pinned=true"

# Notes tagged "practice", sorted by title A to Z, first three
curl "http://localhost:3000/api/v1/notes?tag=practice&sort=title&limit=3"

# Search title and content (case-insensitive)
curl "http://localhost:3000/api/v1/notes?q=MILK"
```

The title sort returns `Practice note 1`, `Practice note 10`, `Practice note 11`. That is **alphabetical** order, where "10" comes before "2" because the character "1" comes before "2". Fixing this is one of the practice exercises.

### Read one note

```bash
curl http://localhost:3000/api/v1/notes/$NOTE_ID
```

```json
{ "data": { "id": "0b6f7a52-...", "title": "Buy milk", "content": "2 litres", "tags": ["shopping", "errands"], "pinned": false, "createdAt": "...", "updatedAt": "..." } }
```

### Update a note

```bash
curl -X PATCH http://localhost:3000/api/v1/notes/$NOTE_ID \
  -H "Content-Type: application/json" \
  -d '{"pinned":true,"content":"2 litres, oat milk"}'
```

```json
{ "data": { "id": "0b6f7a52-...", "title": "Buy milk", "content": "2 litres, oat milk", "tags": ["shopping", "errands"], "pinned": true, "createdAt": "2026-10-25T09:38:12.345Z", "updatedAt": "2026-10-25T09:41:03.210Z" } }
```

Only the fields you sent changed. `tags` kept its value, and `updatedAt` moved forward.

### Delete a note

```bash
curl -i -X DELETE http://localhost:3000/api/v1/notes/$NOTE_ID
```

```http
HTTP/1.1 204 No Content
```

```bash
curl http://localhost:3000/api/v1/notes/$NOTE_ID
```

```json
{ "error": { "code": "NOTE_NOT_FOUND", "message": "Note 0b6f7a52-3c1e-4d7a-9f5e-2a8c1d4e6b90 not found" } }
```

### Test the error cases

A good API is judged by how it fails. Try each of these.

**Invalid body** (empty title and an unknown field):

```bash
curl -X POST http://localhost:3000/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"   ","colour":"red"}'
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "body.title", "message": "Title is required" },
      { "field": "body", "message": "Unrecognized key: \"colour\"" }
    ]
  }
}
```

The title `"   "` failed because `.trim()` runs before `.min(1)`. Messages you did not write yourself, like the unrecognized key one, come from Zod, and their exact wording can differ slightly between Zod versions.

**Broken JSON** (missing closing brace):

```bash
curl -X POST http://localhost:3000/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Oops"'
```

```json
{ "error": { "code": "INVALID_JSON", "message": "Request body is not valid JSON" } }
```

**Empty update:**

```bash
curl -X PATCH http://localhost:3000/api/v1/notes/0b6f7a52-3c1e-4d7a-9f5e-2a8c1d4e6b90 \
  -H "Content-Type: application/json" \
  -d '{}'
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "body", "message": "Send at least one field to update" }]
  }
}
```

**Invalid id:**

```bash
curl http://localhost:3000/api/v1/notes/123
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "params.id", "message": "Note id must be a valid UUID" }]
  }
}
```

**Bad query parameters:**

```bash
curl "http://localhost:3000/api/v1/notes?limit=500&sort=colour"
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "query.limit", "message": "limit cannot be more than 50" },
      { "field": "query.sort", "message": "sort must be one of: createdAt, -createdAt, updatedAt, -updatedAt, title, -title" }
    ]
  }
}
```

**Unknown route:**

```bash
curl -i http://localhost:3000/api/v1/notebooks
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8

{"error":{"code":"ROUTE_NOT_FOUND","message":"Cannot find GET /api/v1/notebooks"}}
```

Meanwhile, the server terminal shows a Morgan line for every request, for example:

```text
POST /api/v1/notes 201 2.104 ms - 214
GET /api/v1/notes?limit=5&page=2 200 0.812 ms - 1043
GET /api/v1/notebooks 404 0.390 ms - 82
```

## Swapping in a real database

Because only `note.model.js` knows about storage, moving to MongoDB means rewriting that one file with the same method names. Here is a sketch using Mongoose from [CRUD API with MongoDB and Mongoose](/courses/expressjs/crud-api-with-mongodb):

```js
// src/models/note.model.js (MongoDB version, sketch)
import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, default: '' },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Note = mongoose.model('Note', noteSchema);

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const NoteModel = {
  async findMany({ page, limit, q, tag, pinned, sort }) {
    const filter = {};
    if (q) {
      const pattern = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = [{ title: pattern }, { content: pattern }];
    }
    if (tag) filter.tags = tag;
    if (pinned !== undefined) filter.pinned = pinned;

    const [items, total] = await Promise.all([
      Note.find(filter).sort(`${sort} _id`).skip((page - 1) * limit).limit(limit),
      Note.countDocuments(filter),
    ]);
    return { items, total };
  },
  findById: (id) => Note.findById(id),
  create: (data) => Note.create(data),
  update: (id, changes) => Note.findByIdAndUpdate(id, changes, { new: true, runValidators: true }),
  remove: async (id) => Boolean(await Note.findByIdAndDelete(id)),
};
```

Two other small changes would follow: connect to MongoDB in `server.js` before `app.listen`, and change `noteIdSchema` to accept MongoDB ObjectIds (24 hexadecimal characters) instead of UUIDs. You would also add a `toJSON` transform so responses show `id` instead of `_id`, as in the MongoDB lesson. The routes and controllers stay exactly as they are. That is the payoff of the layered structure.

## Common mistakes

- **Registering the 404 handler or error handler before the routes.** They must come last, in that order: routes, 404, errors.
- **Reading `req.body` in controllers instead of `req.validated.body`.** You would lose the trimming, defaults and type conversion that Zod did.
- **Adding `.default()` to the PATCH schema**, which silently overwrites stored values.
- **Returning the stored object itself from the model.** A controller that changes it would change the "database" without going through `update`. The `copy` helper prevents that.
- **Forgetting `-H "Content-Type: application/json"` in curl.** Without it, `express.json()` skips the body and validation reports that the title is missing.

## Key takeaways

- A clear structure (**routes**, **controllers**, **models**, plus schemas and middleware) keeps each file small and each job in one place.
- One reusable **validate middleware** with Zod checks body, params and query, and stores clean data on `req.validated`.
- Custom error classes, a **404 handler** that forwards a `NotFoundError`, and one **error handler** give every failure the same JSON shape.
- List endpoints need **pagination, filtering and sorting**, validated with limits and allowlists.
- Hiding storage behind an `async` model lets you start in memory and switch to MongoDB or SQL by changing a single file.

## Practice

1. **Natural title sort.** Change the model so `sort=title` puts "Practice note 2" before "Practice note 10". Hint: `localeCompare(other, undefined, { numeric: true })`.
2. **Archive instead of delete.** Add an `archived` boolean. Make `GET /api/v1/notes` hide archived notes unless `?archived=true` is sent, and add `POST /api/v1/notes/:id/archive`.
3. **Tag summary.** Add `GET /api/v1/tags` that returns each tag with how many notes use it, for example `[{ "tag": "practice", "count": 12 }]`.
4. **Persist to a file.** Save the `Map` to a `notes.json` file with `node:fs/promises` after every change, and load it on startup, so notes survive a restart. Only `note.model.js` should change.

## What's next

Right now, anyone can read and delete anyone's notes. Next you will add user accounts and protect routes with tokens in [JWT Authentication](/courses/expressjs/jwt-authentication).

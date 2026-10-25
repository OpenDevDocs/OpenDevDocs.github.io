---
publishDate: 2026-10-25T09:34
title: CRUD API with MongoDB and Mongoose
slug: crud-api-with-mongodb
metadescription: Build a complete create, read, update and delete REST API with Express 5, MongoDB and Mongoose 8, including schemas, validation and database error handling.
updateDate: 2026-10-25T09:34
author: ['bishal-biswas']
level: 2
tags: ['express', 'mongodb', 'mongoose', 'crud', 'rest']
course: expressjs
---

## What you will learn

- What **MongoDB** and **Mongoose** are, and how they fit with Express
- How to connect to MongoDB and start your server only when the database is ready
- How to define a **schema** and **model** with built-in validation
- How to write all five CRUD routes with Mongoose 8 methods
- How to turn database errors into clear `400`, `404` and `409` responses

## MongoDB and Mongoose in plain words

**MongoDB** is a **document database**. Instead of tables with rows, it stores **documents**: JSON-like objects. Documents live in **collections**, the way files live in folders.

```json
{
  "_id": "6718f3a2c4b1e2a9d0f1a2b3",
  "title": "Dune",
  "author": "Frank Herbert",
  "pages": 412,
  "tags": ["sci-fi", "classic"]
}
```

Because documents look like JavaScript objects, MongoDB feels natural in a Node.js app.

**Mongoose** is an **ODM** (Object Document Mapper). It sits between your code and MongoDB and adds structure: you describe what a book looks like, and Mongoose checks every book against that description before saving it.

**Think of it like a filing cabinet with a form template.** MongoDB is the cabinet; it will hold any paper you put in. Mongoose is the printed form that says "title: required, pages: a number above 0". It stops half-filled forms from going into the drawer.

## Step 1: Get a MongoDB database

You need a running MongoDB server. Pick one option.

**Option A: Docker on your computer.** If you have Docker installed, one command starts MongoDB:

```bash
docker run -d --name mongo -p 27017:27017 mongo
```

**Option B: MongoDB Atlas.** Atlas is MongoDB's hosted cloud service and has a free tier. Create a cluster, add a database user, allow your IP address, and copy the **connection string** it gives you.

A **connection string** is a URL that tells Mongoose where the database is and how to log in.

## Step 2: Set up the project

```bash
mkdir bookstore-api && cd bookstore-api
npm init -y
npm install express mongoose
```

Create this structure:

```text
bookstore-api/
  .env
  package.json
  src/
    app.js
    db.js
    server.js
    models/
      book.js
    routes/
      books.js
    middleware/
      error-handler.js
```

Add the connection string to `.env`. The last part of the URL (`bookstore`) is the database name. MongoDB creates it automatically on first write.

```bash
# .env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/bookstore
```

> **Tip:** Use `127.0.0.1` instead of `localhost` for a local database. On some systems `localhost` resolves to the IPv6 address `::1` first, and the connection fails.

Update `package.json` so it uses ES modules and loads `.env` with Node's built-in `--env-file` flag (Node.js 20.6 or newer):

```json
{
  "name": "bookstore-api",
  "type": "module",
  "scripts": {
    "dev": "node --env-file=.env --watch src/server.js",
    "start": "node --env-file=.env src/server.js"
  }
}
```

## Step 3: Connect to the database

```js
// src/db.js
import mongoose from 'mongoose';

export const connectToDatabase = async (uri) => {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
};
```

Keep the Express app in its own file, and start listening only *after* the database is connected. Otherwise the first requests would fail while the connection is still opening.

```js
// src/server.js
import app from './app.js';
import { connectToDatabase } from './db.js';

const port = Number(process.env.PORT) || 3000;

await connectToDatabase(process.env.MONGODB_URI); // top-level await works in ES modules

app.listen(port, (error) => {
  if (error) throw error;
  console.log(`API on http://localhost:${port}`);
});
```

If the database is unreachable, `mongoose.connect` rejects, the error is printed, and the process exits. That is what you want: a server without its database is not useful.

## Step 4: Define a schema and a model

A **schema** describes the shape of a document: field names, types and rules. A **model** is the object you use to query one collection, built from a schema.

```js
// src/models/book.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const bookSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title must be 200 characters or fewer'],
    },
    author: { type: String, required: [true, 'Author is required'], trim: true },
    pages: { type: Number, min: [1, 'Pages must be at least 1'] },
    isbn: { type: String, unique: true, sparse: true, trim: true },
    tags: { type: [String], default: [] },
    published: { type: Boolean, default: false },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
    toJSON: {
      versionKey: false, // hide the internal __v field
      transform: (doc, ret) => {
        ret.id = ret._id.toString(); // clients get "id" instead of "_id"
        delete ret._id;
        return ret;
      },
    },
  },
);

export const Book = model('Book', bookSchema); // collection name: "books"
```

A few things to notice:

- `required`, `min` and `maxlength` are **validators**. Mongoose runs them before saving and refuses bad data.
- `unique: true` is **not** a validator. It creates a **unique index** in MongoDB, a rule the database itself enforces. `sparse: true` lets several books have no ISBN at all.
- The `toJSON` option controls what `res.json(book)` sends, so your API returns a tidy `id` field.

## Step 5: Write the CRUD routes

Express 5 forwards errors from `async` handlers to your error handler automatically. So there is no `try/catch` in these routes: if a database call fails, the error goes straight to the error handler you will write in step 6.

```js
// src/routes/books.js
import { Router } from 'express';
import { Book } from '../models/book.js';

const router = Router();

// Only these fields may come from the client
const FIELDS = ['title', 'author', 'pages', 'isbn', 'tags', 'published'];

const pickFields = (body = {}) =>
  Object.fromEntries(FIELDS.filter((key) => key in body).map((key) => [key, body[key]]));

// CREATE
router.post('/', async (req, res) => {
  const book = await Book.create(pickFields(req.body));
  res.status(201).location(`/books/${book.id}`).json({ data: book });
});

// READ ALL
router.get('/', async (req, res) => {
  const books = await Book.find().sort({ createdAt: -1 }).limit(50);
  res.json({ data: books });
});

// READ ONE
router.get('/:id', async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ error: { message: 'Book not found' } });
  res.json({ data: book });
});

// UPDATE (partial)
router.patch('/:id', async (req, res) => {
  const book = await Book.findByIdAndUpdate(req.params.id, pickFields(req.body), {
    new: true,           // return the updated document, not the old one
    runValidators: true, // apply schema rules to updates too
  });
  if (!book) return res.status(404).json({ error: { message: 'Book not found' } });
  res.json({ data: book });
});

// DELETE
router.delete('/:id', async (req, res) => {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) return res.status(404).json({ error: { message: 'Book not found' } });
  res.status(204).end();
});

export default router;
```

Here is what each Mongoose method does:

| Method | What it does | Returns |
| --- | --- | --- |
| `Book.create(data)` | Validates and inserts a new document | The saved document |
| `Book.find(filter)` | Finds all matching documents | An array (maybe empty) |
| `Book.findById(id)` | Finds one document by `_id` | The document or `null` |
| `Book.findByIdAndUpdate(id, data, options)` | Updates one document | The document or `null` |
| `Book.findByIdAndDelete(id)` | Deletes one document | The deleted document or `null` |

> **Warning:** Without `{ new: true }`, `findByIdAndUpdate` returns the document *as it was before* the update. Without `runValidators: true`, updates skip your schema rules, so a client could set `pages` to `-5`.

Why `pickFields`? Mongoose already drops fields that are not in the schema. But a client could still send fields that *are* in the schema and that you did not mean to expose, such as `createdAt`. Picking known fields, or validating with Zod as in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod), keeps you in control.

## Step 6: Turn database errors into good responses

Three database errors are really the client's fault, so they should not become `500` errors.

| Error | When it happens | Response |
| --- | --- | --- |
| `CastError` | The id is not a valid MongoDB ObjectId, e.g. `/books/abc` | `400` |
| `ValidationError` | A schema rule failed, e.g. missing title | `400` with details |
| Duplicate key (`code` 11000) | A unique field already exists, e.g. same ISBN | `409` |

```js
// src/middleware/error-handler.js
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.name === 'CastError') {
    return res.status(400).json({ error: { message: `Invalid ${err.path}: ${err.value}` } });
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ error: { message: 'Validation failed', details } });
  }

  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue ?? {});
    return res.status(409).json({ error: { message: `Duplicate value for: ${fields.join(', ')}` } });
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong' } });
};
```

## Step 7: Wire up the app

```js
// src/app.js
import express from 'express';
import booksRouter from './routes/books.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(express.json());
app.use('/books', booksRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

app.use(errorHandler);

export default app;
```

Start it:

```bash
npm run dev
```

```text
Connected to MongoDB
API on http://localhost:3000
```

## Step 8: Test every route

```bash
# Create
curl -i -X POST http://localhost:3000/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","pages":412,"isbn":"9780441013593"}'
```

```json
{
  "data": {
    "title": "Dune",
    "author": "Frank Herbert",
    "pages": 412,
    "isbn": "9780441013593",
    "tags": [],
    "published": false,
    "createdAt": "2026-10-25T09:34:12.345Z",
    "updatedAt": "2026-10-25T09:34:12.345Z",
    "id": "6718f3a2c4b1e2a9d0f1a2b3"
  }
}
```

Copy the `id` from your own response, then:

```bash
curl http://localhost:3000/books
curl http://localhost:3000/books/6718f3a2c4b1e2a9d0f1a2b3

curl -X PATCH http://localhost:3000/books/6718f3a2c4b1e2a9d0f1a2b3 \
  -H "Content-Type: application/json" \
  -d '{"published":true}'

curl -i -X DELETE http://localhost:3000/books/6718f3a2c4b1e2a9d0f1a2b3
```

Now try the error cases:

```bash
# 400: missing title
curl -X POST http://localhost:3000/books -H "Content-Type: application/json" -d '{"author":"Anon"}'

# 400: not a valid ObjectId
curl http://localhost:3000/books/abc

# 404: valid id format, but no such book
curl http://localhost:3000/books/6718f3a2c4b1e2a9d0f1a2b4

# 409: create the same ISBN twice
curl -X POST http://localhost:3000/books -H "Content-Type: application/json" \
  -d '{"title":"Copy","author":"X","isbn":"9780441013593"}'
```

> **Note:** If the `409` test does not fail, the unique index may not exist yet. Mongoose builds indexes in the background when the app starts. If you added `unique` after documents with duplicate values already existed, MongoDB cannot build the index. Delete the duplicates and restart.

## Common mistakes

- **Forgetting `await`.** `const book = Book.findById(id)` gives you a query object, not a book. Always `await` Mongoose calls.
- **Starting the server before connecting.** Connect first, then call `app.listen`.
- **Forgetting `new: true` and `runValidators: true`** on `findByIdAndUpdate`.
- **Treating every error as `500`.** Bad ids and failed validation are client errors. Handle `CastError`, `ValidationError` and code `11000`.
- **Passing `req.body` or `req.query` straight into queries.** A body like `{ "title": { "$ne": null } }` could change what a query matches. Validate input first.
- **Committing `.env`.** Add it to `.gitignore`, especially when it holds an Atlas password.

## Key takeaways

- **MongoDB** stores JSON-like documents in collections. **Mongoose** adds schemas, validation and a friendly query API.
- Connect with `mongoose.connect(uri)` *before* `app.listen`.
- A **schema** defines fields and validators; `model()` turns it into something you can query.
- CRUD maps to `create`, `find`/`findById`, `findByIdAndUpdate` (with `new` and `runValidators`) and `findByIdAndDelete`.
- Express 5 forwards async errors for you; translate `CastError`, `ValidationError` and duplicate keys into `400` and `409`.

## Practice

1. Add a `genre` field that only accepts `'fiction'`, `'non-fiction'` or `'poetry'` (hint: the `enum` schema option).
2. Add `GET /books?author=Frank%20Herbert` that filters by exact author. Read the value from `req.query.author` and check that it is a string before using it.
3. Validate the create body with a Zod schema before calling `Book.create`.
4. Add an `authors` collection and store an author's id on each book with `type: Schema.Types.ObjectId, ref: 'Author'`. Look up Mongoose's `populate()` to return the author's name with each book.

## What's next

MongoDB is one popular choice. Many apps use a relational SQL database instead, so next you will build the same API in [CRUD API with SQL and an ORM](/courses/expressjs/crud-api-with-sql).

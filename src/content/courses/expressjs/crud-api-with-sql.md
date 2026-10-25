---
publishDate: 2026-10-25T09:35
title: CRUD API with SQL and an ORM
slug: crud-api-with-sql
metadescription: Build a CRUD REST API with Express 5, Sequelize and SQLite, learn how an ORM maps tables to models, and see how to switch to PostgreSQL for production.
updateDate: 2026-10-25T09:35
author: ['bishal-biswas']
level: 2
tags: ['express', 'sql', 'sequelize', 'sqlite', 'crud']
course: expressjs
---

## What you will learn

- How SQL databases differ from MongoDB, in plain words
- What an **ORM** is and why it saves you from writing raw SQL for everyday tasks
- How to define a **Sequelize** model with validation, using **SQLite** for zero setup
- How to build all five CRUD routes and handle SQL-specific errors
- How to switch the same code to PostgreSQL for production

## SQL databases in plain words

A **relational database** (often called a **SQL database**) stores data in **tables**. A table has fixed **columns** (title, author, pages) and **rows** (one row per book). You talk to it with **SQL** (Structured Query Language).

```sql
SELECT id, title, author FROM Books WHERE author = 'Frank Herbert';
```

Compared with MongoDB from the previous lesson:

| | MongoDB | SQL database |
| --- | --- | --- |
| Stores | Documents in collections | Rows in tables |
| Structure | Flexible; Mongoose adds rules | Strict; every row has the same columns |
| Relations | Embedding or references | Foreign keys and joins, a core strength |
| Query language | JavaScript-style objects | SQL |
| Examples | MongoDB | PostgreSQL, MySQL, SQLite, SQL Server |

Neither is "better". SQL databases shine when your data has many relationships, such as orders, customers and products.

## What is an ORM?

An **ORM** (Object-Relational Mapper) lets you work with database rows as JavaScript objects. You call `Book.findByPk(1)`; the ORM writes the SQL, runs it, and hands you back an object.

**Think of it like a translator.** You speak JavaScript, the database speaks SQL. The ORM translates in both directions, so you can focus on your app.

This lesson uses **Sequelize**, a long-standing ORM for Node.js that supports PostgreSQL, MySQL, MariaDB, SQLite and SQL Server.

## Why SQLite for learning

**SQLite** is a SQL database that lives in a single file. There is no server to install or start. That makes it perfect for learning and for small tools. For a production API with many users, you would usually choose PostgreSQL, and you will see at the end how small that switch is.

## Step 1: Set up the project

```bash
mkdir library-api && cd library-api
npm init -y
npm install express sequelize sqlite3
```

> **Note:** `sqlite3` contains native code. npm normally downloads a prebuilt version for your system. If the install fails, check that you are on a current Node.js LTS version before digging further.

```text
library-api/
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

```json
{
  "name": "library-api",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js"
  }
}
```

## Step 2: Create the Sequelize instance

The **Sequelize instance** is your connection to the database. Every model is attached to it.

```js
// src/db.js
import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DB_FILE ?? 'library.sqlite', // the database file
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
});
```

Setting `logging` to `console.log` prints every SQL statement Sequelize runs. Turn it on while learning; it shows you exactly what the ORM does.

## Step 3: Define the model

A **model** represents one table. You list the columns, their types and their rules.

```js
// src/models/book.js
import { DataTypes } from 'sequelize';
import { sequelize } from '../db.js';

export const Book = sequelize.define('Book', {
  // Sequelize adds an auto-incrementing "id" primary key for you
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notNull: { msg: 'Title is required' },
      notEmpty: { msg: 'Title cannot be empty' },
    },
  },
  author: {
    type: DataTypes.STRING(120),
    allowNull: false,
    validate: { notNull: { msg: 'Author is required' }, notEmpty: true },
  },
  pages: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: { args: [1], msg: 'Pages must be at least 1' } },
  },
  isbn: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true, // a database rule: no two books with the same ISBN
  },
  published: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});
```

Sequelize names the table `Books` (it pluralises the model name) and adds `id`, `createdAt` and `updatedAt` columns automatically.

There are two kinds of rules here:

- **Validations** (`validate: { ... }`) run in JavaScript before Sequelize sends any SQL.
- **Constraints** (`allowNull: false`, `unique: true`) are also written into the table itself, so the database enforces them even if someone bypasses your app.

## Step 4: Create the table and start the server

```js
// src/server.js
import app from './app.js';
import { sequelize } from './db.js';
import './models/book.js'; // make sure the model is registered

const port = Number(process.env.PORT) || 3000;

await sequelize.authenticate(); // check the connection works
await sequelize.sync();         // create missing tables

app.listen(port, (error) => {
  if (error) throw error;
  console.log(`API on http://localhost:${port}`);
});
```

`sequelize.sync()` creates any table that does not exist yet. It does **not** change tables that already exist.

| Call | What it does | Safe? |
| --- | --- | --- |
| `sync()` | Creates missing tables only | Yes |
| `sync({ alter: true })` | Tries to change tables to match models | Risky, can lose data |
| `sync({ force: true })` | Drops and recreates every table | Deletes all data |

> **Warning:** In production, do not rely on `sync()` to change your tables. Use **migrations**: small, versioned scripts that change the database step by step, such as "add a `language` column". Sequelize has a CLI, `sequelize-cli`, for this. `sync()` is fine for learning and prototypes.

## Step 5: Write the CRUD routes

A small middleware, `loadBook`, finds the book for `/:id` routes. It keeps the handlers short and puts the `404` logic in one place.

```js
// src/routes/books.js
import { Router } from 'express';
import { Book } from '../models/book.js';

const router = Router();

const FIELDS = ['title', 'author', 'pages', 'isbn', 'published'];

// Find the book or stop with 400/404; store it on req.book for the next handler
const loadBook = async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: { message: 'Book id must be a positive whole number' } });
  }

  const book = await Book.findByPk(id);
  if (!book) return res.status(404).json({ error: { message: 'Book not found' } });

  req.book = book;
  next();
};

// CREATE
router.post('/', async (req, res) => {
  const book = await Book.create(req.body ?? {}, { fields: FIELDS });
  res.status(201).location(`/books/${book.id}`).json({ data: book });
});

// READ ALL
router.get('/', async (req, res) => {
  const books = await Book.findAll({ order: [['createdAt', 'DESC']], limit: 50 });
  res.json({ data: books });
});

// READ ONE
router.get('/:id', loadBook, (req, res) => {
  res.json({ data: req.book });
});

// UPDATE (partial)
router.patch('/:id', loadBook, async (req, res) => {
  await req.book.update(req.body ?? {}, { fields: FIELDS });
  res.json({ data: req.book });
});

// DELETE
router.delete('/:id', loadBook, async (req, res) => {
  await req.book.destroy();
  res.status(204).end();
});

export default router;
```

The `fields` option is a built-in guard against **mass assignment**: Sequelize ignores any property not in the list, so a client cannot set `id` or `createdAt`.

| Sequelize method | SQL it runs (roughly) |
| --- | --- |
| `Book.create(data)` | `INSERT INTO Books ...` |
| `Book.findAll({ order, limit })` | `SELECT ... ORDER BY ... LIMIT ...` |
| `Book.findByPk(1)` | `SELECT ... WHERE id = 1` |
| `book.update(data)` | `UPDATE Books SET ... WHERE id = 1` |
| `book.destroy()` | `DELETE FROM Books WHERE id = 1` |

`res.json(book)` works because Sequelize model instances have a `toJSON()` method that returns their plain column values.

## Step 6: Handle Sequelize errors

Sequelize throws its own error classes. Two are the client's fault:

- **`UniqueConstraintError`**: a duplicate value in a `unique` column. Respond `409 Conflict`.
- **`ValidationError`**: a validation or `notNull` rule failed. Respond `400`.

```js
// src/middleware/error-handler.js
import { UniqueConstraintError, ValidationError } from 'sequelize';

const toDetails = (err) => err.errors.map((e) => ({ field: e.path, message: e.message }));

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Check this one first: UniqueConstraintError is a kind of ValidationError
  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({ error: { message: 'Duplicate value', details: toDetails(err) } });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({ error: { message: 'Validation failed', details: toDetails(err) } });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong' } });
};
```

> **Note:** The order of `instanceof` checks matters. `UniqueConstraintError` extends `ValidationError`, so if you checked `ValidationError` first, duplicates would come back as `400` instead of `409`.

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

## Step 8: Test it

Start the server with SQL logging turned on (inline environment variables like this work in bash):

```bash
DB_LOGGING=true npm run dev
```

```bash
# Create
curl -i -X POST http://localhost:3000/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","pages":412,"isbn":"9780441013593"}'

# Read
curl http://localhost:3000/books
curl http://localhost:3000/books/1

# Update
curl -X PATCH http://localhost:3000/books/1 \
  -H "Content-Type: application/json" \
  -d '{"published":true}'

# Delete
curl -i -X DELETE http://localhost:3000/books/1
```

The create response:

```json
{
  "data": {
    "id": 1,
    "title": "Dune",
    "author": "Frank Herbert",
    "pages": 412,
    "isbn": "9780441013593",
    "published": false,
    "createdAt": "2026-10-25T09:35:20.512Z",
    "updatedAt": "2026-10-25T09:35:20.512Z"
  }
}
```

The exact order of the keys may differ on your machine. That is normal: JSON objects have no fixed key order.

In the server terminal you see the SQL that Sequelize generated, something like:

```text
Executing (default): INSERT INTO `Books` (`title`,`author`,`pages`,`isbn`,`published`,`createdAt`,`updatedAt`) VALUES ($1,$2,$3,$4,$5,$6,$7);
```

The `$1`, `$2` placeholders are important. Sequelize sends your values *separately* from the SQL text, so a title like `'; DROP TABLE Books; --` is stored as plain text, never run as SQL. This protection is called **parameterised queries**, and it is the main defence against **SQL injection**.

Error cases to try:

```bash
curl -X POST http://localhost:3000/books -H "Content-Type: application/json" -d '{"author":"Anon"}'   # 400
curl http://localhost:3000/books/abc                                                                     # 400
curl http://localhost:3000/books/999                                                                     # 404
```

## When you need raw SQL

ORMs cover everyday queries. For complex reports you may want to write SQL yourself. Use **replacements** so values are still escaped safely:

```js
// src/routes/stats.js
import { Router } from 'express';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../db.js';

const router = Router();

// GET /stats/authors?published=true
router.get('/authors', async (req, res) => {
  const published = req.query.published === 'true';
  const rows = await sequelize.query(
    'SELECT author, COUNT(*) AS total FROM Books WHERE published = ? GROUP BY author',
    { replacements: [published], type: QueryTypes.SELECT }, // "?" is filled in safely
  );
  res.json({ data: rows });
});

export default router;
```

> **Warning:** Never build SQL by gluing strings together, like `` `... WHERE author = '${req.query.author}'` ``. That is exactly how SQL injection happens.

## Switching to PostgreSQL

Because your routes only talk to Sequelize, moving to PostgreSQL mostly means changing `db.js`:

```bash
npm install pg pg-hstore
```

```bash
# .env
DATABASE_URL=postgres://app_user:change-me@localhost:5432/library
```

```js
// src/db.js (PostgreSQL version)
import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
});
```

Load the `.env` file with `node --env-file=.env` as in earlier lessons. Your models and routes stay the same.

## Common mistakes

- **Using `sync({ force: true })` and losing data.** It drops every table. Keep it out of real projects.
- **Forgetting to import the model before `sync()`.** Sequelize only creates tables for models it knows about.
- **Checking `ValidationError` before `UniqueConstraintError`.** Duplicates then look like ordinary validation errors.
- **Passing `req.body` without `fields`.** Clients could set columns they should not touch.
- **String-building SQL.** Always let Sequelize parameterise values, or use `replacements`.

## Key takeaways

- SQL databases store rows in tables with fixed columns. An **ORM** like **Sequelize** maps those rows to JavaScript objects.
- **SQLite** needs no server, which makes it ideal for learning; **PostgreSQL** is a common production choice.
- Define models with types, validations and constraints. Use `sync()` while learning and migrations in production.
- CRUD maps to `create`, `findAll`/`findByPk`, `instance.update` and `instance.destroy`. Use the `fields` option to whitelist columns.
- Map `UniqueConstraintError` to `409` and `ValidationError` to `400`, checking the unique error first.

## Practice

1. Add a `year` column (integer, between 1450 and the current year) and recreate the database file to see it appear.
2. Add `GET /books?published=true` that filters with `Book.findAll({ where: { published: true } })`.
3. Create an `Author` model and connect it with `Author.hasMany(Book)` and `Book.belongsTo(Author)`. Then use `include: Author` when loading a book.
4. Turn on SQL logging and write down the SQL produced by each of your five routes.

## What's next

Your list routes currently return at most 50 rows in a fixed order. Learn to let clients choose pages, filters and sort order in [Pagination, Filtering and Sorting](/courses/expressjs/pagination-filtering-sorting).

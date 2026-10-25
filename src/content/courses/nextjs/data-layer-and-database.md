---
publishDate: 2026-10-25T13:26
title: Building a Data Layer and Talking to a Database
slug: data-layer-and-database
metadescription: "Move Book Nook's lib/books.js onto a real PostgreSQL database with the pg package, keep it server-only, write safe queries, and handle uncached data in Next.js 16."
updateDate: 2026-10-25T13:26
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'database', 'postgres', 'data-layer']
course: nextjs
---

## What you will learn

Until now Book Nook's books lived in an array inside `lib/books.js`. That was perfect for learning, but a real shop needs more: the owner must be able to add books and change prices without editing code, and the data must survive when the server restarts. That is a job for a **database**, a program that stores data safely on disk and lets you search and change it.

In this lesson you will:

- understand what a **data layer** is and why Book Nook already has one
- create a free PostgreSQL database and fill it with Book Nook's books
- connect to it from Next.js with the `pg` package
- rewrite `lib/books.js` so `getBooks`, `getBook` and `searchBooks` read from the database, **without changing a single page**
- protect the data layer with `server-only`
- write queries that are safe from SQL injection
- deal with the build error that real data brings, now that the data is uncached

## The data layer idea

A **data layer** (the Next.js docs call it a **Data Access Layer**) is one place in your code that is allowed to talk to the data. Everything else, pages, Server Actions, Route Handlers, asks the data layer, never the database directly.

Think of a library. Visitors do not walk into the stacks and pull books off the shelves. They ask the librarian at the desk. The librarian knows where everything is, checks that you are allowed to borrow it, and hands over only what you asked for. Book Nook's `lib/books.js` is that librarian.

Look at how pages use it today:

```jsx
// app/books/page.js (part)
const books = await getBooks();
```

The page does not know or care whether the books come from an array, a JSON file or a database on another continent. That is why the functions were `async` from the very first day. Now we only change what happens **inside** them.

## Step 1: choose a database

There are many databases. For Book Nook we use **PostgreSQL** (often just "Postgres"), a free, very popular database, through the **`pg`** package. Good reasons:

- `pg` is plain JavaScript. It installs the same way on Windows, macOS and Linux, with no extra build tools.
- Postgres runs anywhere: on your computer, or as a **hosted** database run by a company for you.
- Next.js already knows `pg` and keeps it out of its bundling automatically.

The easiest start is a free hosted database. Providers such as **Neon** and **Supabase** give you a Postgres database in a minute, with a web page where you can run SQL. Vercel's marketplace offers Postgres databases from these providers too. If you prefer, you can also install PostgreSQL on your own computer from postgresql.org.

Whichever you choose, you end up with a **connection string**, one line that says where the database is and how to log in. It looks like this:

```text
postgres://bookshop:replace-with-your-password@ep-example-123456.eu-central-1.aws.neon.tech/booknook?sslmode=require
```

It contains a password, so treat it like one.

## Step 2: create the books table

A Postgres database stores data in **tables**, like spreadsheets with fixed columns. Create a file to keep your table design in the project:

```sql
-- db/schema.sql
CREATE TABLE IF NOT EXISTS books (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  author      text NOT NULL,
  price       numeric(6, 2) NOT NULL,
  genre       text NOT NULL,
  cover       text NOT NULL,
  description text NOT NULL
);

INSERT INTO books (id, title, author, price, genre, cover, description) VALUES
  ('the-hobbit', 'The Hobbit', 'J.R.R. Tolkien', 12.99, 'fantasy', '/covers/the-hobbit.jpg', 'Bilbo Baggins leaves his cosy home for an adventure with dwarves and a dragon.'),
  ('pride-and-prejudice', 'Pride and Prejudice', 'Jane Austen', 9.99, 'classic', '/covers/pride-and-prejudice.jpg', 'Elizabeth Bennet and Mr Darcy learn that first impressions can be wrong.'),
  ('dune', 'Dune', 'Frank Herbert', 14.50, 'science-fiction', '/covers/dune.jpg', 'A young heir must survive on a desert planet that holds the most precious resource in the universe.'),
  ('the-little-prince', 'The Little Prince', 'Antoine de Saint-Exupery', 8.75, 'classic', '/covers/the-little-prince.jpg', 'A pilot stranded in the desert meets a little prince from a tiny planet.')
ON CONFLICT (id) DO NOTHING;
```

The columns match the shape of a Book Nook book exactly, so the rest of the app sees the same objects as before. A few words of SQL:

- `text` is a string of any length. `numeric(6, 2)` is an exact decimal number with 2 digits after the point, the right type for money.
- `PRIMARY KEY` means every `id` must be unique.
- `ON CONFLICT (id) DO NOTHING` lets you run the file again without errors: books that already exist are skipped.

Open your provider's **SQL editor** in the browser, paste the whole file and run it. (With a local install, you can run it with the `psql` tool instead.) Then check it worked:

```sql
SELECT id, title, price FROM books;
```

```text
 id                  | title               | price
---------------------+---------------------+-------
 the-hobbit          | The Hobbit          | 12.99
 pride-and-prejudice | Pride and Prejudice |  9.99
 dune                | Dune                | 14.50
 the-little-prince   | The Little Prince   |  8.75
```

## Step 3: install pg and add the connection string

In your project folder:

```bash
npm install pg
```

Now give the app the connection string. Create a file called `.env.local` in the project root, next to `package.json`:

```bash
# .env.local
DATABASE_URL=postgres://bookshop:replace-with-your-password@ep-example-123456.eu-central-1.aws.neon.tech/booknook?sslmode=verify-full
```

Paste your own connection string. If it ends with `?sslmode=require`, change that to `?sslmode=verify-full`. Both make an encrypted, checked connection with today's `pg`, but `pg` prints a "SECURITY WARNING" about upcoming changes for `require`, and `verify-full` says exactly what you mean. A local database without encryption needs no `sslmode` at all.

`create-next-app` already lists `.env*` in `.gitignore`, so this file and its password never go to GitHub. Restart the dev server after creating it. You will learn everything about these files in [Environment Variables](/courses/nextjs/environment-variables).

## Step 4: the database connection, lib/db.js

Create a small file whose only job is to connect:

```javascript
// lib/db.js
import 'server-only';
import { Pool, types } from 'pg';

// Postgres sends numeric columns (like price) as strings, to avoid rounding.
// Book Nook's prices are small, so turn them into normal numbers.
types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Add it to .env.local');
}

// Reuse one pool, even when the dev server reloads this file
const pool = globalThis.bookNookPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== 'production') {
  globalThis.bookNookPool = pool;
}

export const db = {
  async query(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
  },
};
```

Line by line:

- `import 'server-only'` makes the **build fail** if any Client Component ever imports this file. Your database password can never end up in the browser by accident. You do not need to install anything for it; Next.js understands this import by itself.
- A **pool** is a small set of open connections that `pg` shares between requests. Opening a new connection for every query would be slow.
- `types.setTypeParser(...)` fixes a classic surprise: without it, `book.price` would be the string `"14.50"`, and `book.price.toFixed(2)` in your components would crash.
- In development, Next.js reloads changed files without restarting the server. Each reload would create a **new** pool, and you could run out of database connections. Keeping the pool on `globalThis` (an object that survives reloads) reuses the same one.
- `db.query` runs a query and returns just the **rows**, an array of plain objects.

## Step 5: rewrite lib/books.js

Now replace the array version of `lib/books.js` with this:

```javascript
// lib/books.js
import 'server-only';
import { db } from './db';

export async function getBooks() {
  return db.query('SELECT * FROM books ORDER BY title');
}

export async function getBook(id) {
  const rows = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function searchBooks(query) {
  return db.query(
    'SELECT * FROM books WHERE title ILIKE $1 OR author ILIKE $1 ORDER BY title',
    [`%${query}%`]
  );
}
```

The three functions have **exactly the same names, arguments and return values** as before:

- `getBooks()` returns an array of books.
- `getBook(id)` returns one book, or `null` if there is none (pages already call `notFound()` for `null`).
- `searchBooks(query)` returns the books whose title or author contains the text. `ILIKE` is a case-insensitive match, and `%` means "any characters here", so `%dune%` finds "Dune" anywhere in the title.

If you added the pretend `getReviews` function in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming), you can keep it at the bottom of the file for now.

### Why $1 and not the value itself

Never build SQL by gluing user input into the text:

```javascript
// DANGEROUS: never do this
db.query(`SELECT * FROM books WHERE title ILIKE '%${query}%'`);
```

If someone searches for `x'; DROP TABLE books; --`, that text becomes part of your SQL command and can delete your table. This attack is called **SQL injection**. With `$1` and a separate array of values, `pg` sends the command and the values to Postgres **separately**. The value is always treated as data, never as a command, whatever it contains.

## Step 6: the build error, and how to fix it

Start the dev server and open `/books`. If your books page still awaits `getBooks()` at the top, the dev overlay shows an issue, and `npm run build` stops with an error you have seen before:

```text
Error: Route "/books": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] For uncached data (`fetch`, database calls): cache the access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route
```

This is expected. The old array was instant, so Next.js baked it into the page at build time. A database query is **uncached data**: it goes over the network, and the answer may be different tomorrow. Next.js will not decide for you whether to freeze it. You choose:

- **[stream]**: show a placeholder, and query the database fresh for every visitor.
- **[cache]**: keep a copy of the result for a while. You will learn this in [Caching with Cache Components and use cache](/courses/nextjs/use-cache).

For now, stream. Move the list into its own component and wrap it in `<Suspense>`:

```jsx
// app/books/page.js
import { Suspense } from 'react';
import BookCard from '@/components/BookCard';
import { getBooks } from '@/lib/books';

export default function BooksPage() {
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="font-serif text-3xl font-bold">All books</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading books...</p>}>
        <BookList />
      </Suspense>
    </main>
  );
}

async function BookList() {
  const books = await getBooks();

  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
```

The heading and the fallback are prerendered; the list comes fresh from the database for each visit. Your book detail page already reads its data inside `loading.js` or `<Suspense>` (because of `params`), so it keeps working with no change. Search the rest of your app for pages that await `getBooks`, `getBook` or `searchBooks` at the top and give them a boundary too. Run `npm run build` until it passes.

Now change a price in your provider's SQL editor:

```sql
UPDATE books SET price = 11.99 WHERE id = 'the-hobbit';
```

Reload `/books`. The new price is there, with no code change and no rebuild. Your shop now runs on real data.

## Step 7: keep the data layer in charge

A few habits make a data layer worth having:

- **Only `lib/` talks to the database.** Pages, Server Actions and Route Handlers import functions from `lib/books.js`, never `db` or `pg` directly.
- **Return only what is needed.** If the table later gets private columns (like the supplier's cost price), select the safe columns in the data layer, not `*`, so private data never reaches a page by accident.
- **Check permissions here.** When Book Nook gets an admin area, functions like `updatePrice` will check that the current user is an admin **inside** the data layer. You will do this in [Protecting Pages, Actions and APIs](/courses/nextjs/authorization) and [Keeping Secrets and Data Safe](/courses/nextjs/data-security).
- **Share results within a request.** If several components call `getBook(id)` on one page, wrap it in React's `cache` so the database is asked only once per request (see [Fetching Data in Server Components](/courses/nextjs/fetching-data)).

## Other options

### No database server: a JSON file

If you just want data that survives restarts on your own computer, you can keep the books in a JSON file and read it with Node's built-in `node:fs` module. Same functions, different insides:

```javascript
// lib/books.js (JSON file version)
import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = path.join(process.cwd(), 'data', 'books.json');

async function readBooks() {
  const text = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(text);
}

export async function getBooks() {
  return readBooks();
}

export async function getBook(id) {
  const books = await readBooks();
  return books.find((book) => book.id === id) ?? null;
}

export async function searchBooks(query) {
  const q = query.toLowerCase();
  const books = await readBooks();
  return books.filter((book) => book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q));
}
```

`process.cwd()` is the project root when Next.js runs, so the file is found on every operating system. Reading a file is uncached data too, so the Suspense fix from Step 6 applies here as well. This is fine for practice, but not for a real shop: two visitors saving at the same moment can overwrite each other, and many hosting platforms do not let your app write files at all.

### ORMs: Prisma and Drizzle

Writing SQL by hand is a great way to learn. Bigger projects often use an **ORM** (object relational mapper), a library that lets you describe tables in JavaScript or a schema file and query them with functions instead of SQL strings, often with helpful autocomplete:

- **Prisma** uses its own schema file and generates a client for you. It has tools for **migrations** (step-by-step changes to your tables over time).
- **Drizzle** describes tables in plain JavaScript or TypeScript and writes queries that look a lot like SQL.

Both work with Postgres and with Next.js. Whichever you pick, it lives **inside** your data layer: `getBooks()` might call Prisma instead of `db.query`, and your pages still do not notice.

## Common mistakes

### Importing the data layer into a Client Component

```text
Error: You're importing a module that depends on "server-only". This API is only available in Server Components in the App Router, but you are using it in the Pages Router.
```

The wording mentions the Pages Router, but the cause is a Client Component (a file with `'use client'`) importing `lib/books.js` or `lib/db.js`, directly or through another file. The "Import traces" part of the message shows the chain. Fetch the data in a Server Component and pass it down as props, or call a Route Handler from the browser ([Fetching Data on the Client](/courses/nextjs/client-side-data-fetching)).

### DATABASE_URL is missing

```text
Error: DATABASE_URL is missing. Add it to .env.local
```

That is your own check from `lib/db.js` doing its job. Make sure `.env.local` is in the project root (next to `package.json`, not inside `app/`), the name is spelled exactly `DATABASE_URL`, and you restarted the dev server.

### Prices are strings

If `book.price.toFixed is not a function` appears, Postgres returned `numeric` values as strings. Check that the `types.setTypeParser(types.builtins.NUMERIC, ...)` line is in `lib/db.js` and runs before any query.

### "Too many connections" during development

Each hot reload created a new pool. Keep the pool on `globalThis` as shown in Step 4, and never create a `new Pool()` inside a function that runs on every request.

### Building SQL with template strings

Putting `${query}` inside the SQL text opens the door to SQL injection. Always use `$1`, `$2` placeholders and pass the values in the array.

## Quick recap

- A **data layer** (`lib/books.js`) is the only code that talks to your data. Pages just call `getBooks()`, `getBook(id)` and `searchBooks(query)`.
- PostgreSQL with the pure-JavaScript `pg` package works on Windows, macOS and Linux. Use a hosted database (Neon, Supabase and others) or a local install.
- Keep the connection string in `.env.local` as `DATABASE_URL`, never in code. With hosted databases use `sslmode=verify-full`.
- `lib/db.js` creates one shared `Pool`, parses `numeric` prices into numbers, and starts with `import 'server-only'`.
- Use `$1` placeholders and a values array for every query to prevent SQL injection.
- Database queries are uncached data: wrap the components that await them in `<Suspense>` (or cache them with `"use cache"`, coming soon), or the build fails.
- A JSON file read with `node:fs` is fine for practice; Prisma and Drizzle are popular ORMs that also fit inside the data layer.

<code id="code-content" class="language-javascript">
// lib/books.js: Book Nook's data layer, now backed by PostgreSQL
import 'server-only'; // the build fails if a Client Component imports this file
import { db } from './db';
// All books, sorted by title
export async function getBooks() {
  return db.query('SELECT * FROM books ORDER BY title');
}
// One book by id, or null when it does not exist
export async function getBook(id) {
  // $1 is a placeholder: the id is sent separately, so it can never become SQL
  const rows = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] ?? null;
}
// Books whose title or author contains the query (ILIKE ignores upper and lower case)
export async function searchBooks(query) {
  return db.query(
    'SELECT * FROM books WHERE title ILIKE $1 OR author ILIKE $1 ORDER BY title',
    [`%${query}%`]
  );
}
// --- next file: lib/db.js
// import 'server-only';
// import { Pool, types } from 'pg';
// // numeric columns arrive as strings: turn prices into numbers
// types.setTypeParser(types.builtins.NUMERIC, (value) =&gt; parseFloat(value));
// const connectionString = process.env.DATABASE_URL; // from .env.local
// if (!connectionString) {
//   throw new Error('DATABASE_URL is missing. Add it to .env.local');
// }
// // one shared pool, kept on globalThis so dev reloads do not open new ones
// const pool = globalThis.bookNookPool ?? new Pool({ connectionString });
// if (process.env.NODE_ENV !== 'production') {
//   globalThis.bookNookPool = pool;
// }
// export const db = {
//   async query(text, params = []) {
//     const result = await pool.query(text, params);
//     return result.rows; // just the rows: an array of plain objects
//   },
// };
</code></pre>

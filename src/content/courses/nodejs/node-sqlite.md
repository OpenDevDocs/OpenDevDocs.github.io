---
publishDate: 2026-10-25T11:05
title: The Built-in node:sqlite Database
slug: node-sqlite
metadescription: Store data in a real SQL database with no install using node:sqlite. Learn DatabaseSync, prepared statements, run, get, all, named parameters and transactions.
updateDate: 2026-10-25T11:05
author: ['bishal-biswas']
level: 2
tags: ['sqlite', 'database', 'sql']
course: nodejs
---

## Why a database?

So far your data has lived in arrays (gone when the server restarts) or JSON files (fine until two requests write at once, or the file gets big). A **database** is a program built to store data safely, find it fast and never leave it half written.

Most databases, like PostgreSQL, are a separate server you install and connect to: a library with a librarian. **SQLite** is different. The whole database is a single file, and the code that reads it runs inside your program: a well-organised notebook you keep in your own bag. It powers phones, browsers and countless apps.

Node ships SQLite as a built-in module, `node:sqlite`. Nothing to install.

## Its status: still marked experimental

Be clear about this before you use it in production:

- `node:sqlite` arrived in Node 22.5 behind a flag. Since Node 22.13 and 23.4 it works without a flag.
- On Node 24.12 it still prints a warning the first time you load it:

```text
(node:20248) ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

- Later Node 24 releases (from 24.15) and Node 25.7+ mark it a **release candidate**, one step before stable, which means the API is close to final.
- Recent Node 26 docs also list the class under a new name, `Database`, with `DatabaseSync` kept as an alias. Check the docs for the version you run.

The code in this lesson works on Node 24 as written. To hide the warning while you learn, run:

```bash
node --disable-warning=ExperimentalWarning app.js
```

> **Note:** If you need a battle-tested SQLite library today, the npm package `better-sqlite3` has a very similar synchronous API. Everything you learn here carries over.

## A tiny bit of SQL

SQLite speaks **SQL** (Structured Query Language). You need just a handful of commands:

```sql
CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, year INTEGER);
INSERT INTO books (title, year) VALUES ('Dune', 1965);
SELECT * FROM books WHERE year < 1900;
UPDATE books SET year = 1966 WHERE id = 1;
DELETE FROM books WHERE id = 1;
```

A **table** is like a spreadsheet: **columns** are the fields, **rows** are the records. `INTEGER PRIMARY KEY` makes `id` a unique number that SQLite fills in for you.

## Opening a database

```javascript
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('library.db'); // creates the file if it does not exist
// const db = new DatabaseSync(':memory:'); // a throwaway database in memory
```

The "Sync" in `DatabaseSync` means its methods are **synchronous**: they return the result directly, with no `await`. That sounds wrong after the event loop lessons, but SQLite reads a local file and is extremely fast, so short queries finish in microseconds. For small and medium apps this is simple and quick.

## Creating a table with `exec()`

`db.exec()` runs SQL that returns no rows. It is perfect for setting up tables:

```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id     INTEGER PRIMARY KEY,
    title  TEXT NOT NULL,
    author TEXT NOT NULL,
    year   INTEGER
  )
`);
```

`IF NOT EXISTS` means you can run this every time the program starts.

## Prepared statements: `run()`, `get()` and `all()`

For everything else you **prepare** a statement once, then run it as often as you like with different values. The `?` marks are **placeholders**:

```javascript
const insertBook = db.prepare('INSERT INTO books (title, author, year) VALUES (?, ?, ?)');

console.log(insertBook.run('Dune', 'Frank Herbert', 1965));
console.log(insertBook.run('Emma', 'Jane Austen', 1815));
console.log(insertBook.run('Persuasion', 'Jane Austen', 1817));
```

```text
{ lastInsertRowid: 1, changes: 1 }
{ lastInsertRowid: 2, changes: 1 }
{ lastInsertRowid: 3, changes: 1 }
```

The values fill the `?` marks in order. A statement has three main methods:

| Method | Use it for | Returns |
| --- | --- | --- |
| `run(...)` | `INSERT`, `UPDATE`, `DELETE` | `{ changes, lastInsertRowid }` |
| `get(...)` | `SELECT` one row | The first row, or `undefined` |
| `all(...)` | `SELECT` many rows | An array of rows (maybe empty) |

`changes` is how many rows were affected. `lastInsertRowid` is the id of the row an `INSERT` just created.

### Reading one row

```javascript
const getBook = db.prepare('SELECT * FROM books WHERE id = ?');

console.log(getBook.get(1));
console.log(getBook.get(99));
```

```text
[Object: null prototype] {
  id: 1,
  title: 'Dune',
  author: 'Frank Herbert',
  year: 1965
}
undefined
```

Each row is an object with one property per column. `[Object: null prototype]` just means the object has no prototype, so it has no inherited methods. Use it like any object (`row.title`), or copy it into a normal one with `{ ...row }`. A missing row gives `undefined`, which is how you detect "not found".

### Reading many rows

```javascript
const byAuthor = db.prepare('SELECT title, year FROM books WHERE author = ? ORDER BY year');
console.log(byAuthor.all('Jane Austen'));
```

```text
[
  [Object: null prototype] { title: 'Emma', year: 1815 },
  [Object: null prototype] { title: 'Persuasion', year: 1817 }
]
```

For very large results, `statement.iterate()` hands you one row at a time in a `for...of` loop instead of building a big array.

## Named parameters

With many columns, counting `?` marks gets error prone. Use **named parameters** instead: write `:name` in the SQL and pass an object:

```javascript
const insertNamed = db.prepare(
  'INSERT INTO books (title, author, year) VALUES (:title, :author, :year)'
);
insertNamed.run({ title: 'Beloved', author: 'Toni Morrison', year: 1987 });

const updateYear = db.prepare('UPDATE books SET year = :year WHERE id = :id');
console.log(updateYear.run({ id: 1, year: 1966 }));  // { lastInsertRowid: 4, changes: 1 }
console.log(updateYear.run({ id: 99, year: 2000 })); // { lastInsertRowid: 4, changes: 0 }
```

SQLite also accepts `$name` and `@name`, and you pass the key without the prefix either way.

`changes: 0` on the second update tells you no book has id 99. That is how an API knows to reply `404`. (`lastInsertRowid` only means something after an `INSERT`; here it is left over from the last insert.)

## Never glue values into SQL

This is the most important rule in this lesson. Look at this search:

```javascript
const author = "nobody' OR '1'='1"; // typed by a sneaky user
const rows = db.prepare(`SELECT title FROM books WHERE author = '${author}'`).all();
console.log(rows); // every book in the table!
```

The user's quote mark ended your string and their `OR '1'='1'` became part of the SQL. This is **SQL injection**, and it can leak or destroy a whole database. With a placeholder, the value is always treated as plain data:

```javascript
const rows = db.prepare('SELECT title FROM books WHERE author = ?').all(author);
console.log(rows); // [] (no author has that strange name)
```

Always use `?` or `:name` for values. Never put them into the SQL string with `${}`.

## SQLite types and JavaScript

SQLite has just a few types. Here is how they map:

- `INTEGER` and `REAL` come back as numbers. `TEXT` as strings. `NULL` as `null`.
- `BLOB` (raw bytes) comes back as a `Uint8Array`.
- There is no boolean. Store `1` or `0`. Passing `true` throws `Provided value cannot be bound to SQLite parameter 1`.
- There is no date type. Store `new Date().toISOString()` as `TEXT`. Do not pass a `Date` object directly.
- `undefined` cannot be stored. Use `null` for "no value".

## Transactions: all or nothing

A **transaction** groups several changes so they either all happen or none do. The classic example is moving money: taking it from Asha and giving it to Ravi must never half happen.

```javascript
db.exec(`CREATE TABLE accounts (
  name TEXT PRIMARY KEY,
  balance INTEGER NOT NULL CHECK (balance >= 0)
)`);
db.exec("INSERT INTO accounts VALUES ('Asha', 100), ('Ravi', 20)");

const change = db.prepare('UPDATE accounts SET balance = balance + :amount WHERE name = :name');

function transfer(from, to, amount) {
  db.exec('BEGIN');
  try {
    change.run({ name: to, amount });
    change.run({ name: from, amount: -amount }); // fails if the balance would go below 0
    db.exec('COMMIT');   // keep both changes
  } catch (err) {
    db.exec('ROLLBACK'); // undo everything since BEGIN
    throw err;
  }
}

transfer('Asha', 'Ravi', 30);
try {
  transfer('Ravi', 'Asha', 500);
} catch (err) {
  console.log('Failed:', err.message);
}
console.log(db.prepare('SELECT * FROM accounts ORDER BY name').all());
```

```text
Failed: CHECK constraint failed: balance >= 0
[
  [Object: null prototype] { name: 'Asha', balance: 70 },
  [Object: null prototype] { name: 'Ravi', balance: 50 }
]
```

In the failed transfer, Asha's balance had already gone up by 500 before Ravi's update failed. `ROLLBACK` undid it, so the totals stay correct.

> **Tip:** Transactions also make bulk inserts far faster. Without one, SQLite saves each insert to disk separately. In a test on a Windows laptop, 2,000 inserts took several seconds on their own, and a few milliseconds wrapped in one `BEGIN`/`COMMIT`.

## Errors

SQLite errors throw normal JavaScript errors with `code: 'ERR_SQLITE_ERROR'`. The message explains the problem:

```javascript
try {
  insertBook.run(null, 'Nobody', 2000); // title is NOT NULL
} catch (err) {
  console.log(err.code, err.message);
}
```

```text
ERR_SQLITE_ERROR NOT NULL constraint failed: books.title
```

Typos in SQL fail as soon as you call `prepare()`, for example `near "SELEC": syntax error`, which is another reason to prepare statements once at startup.

When you are finished, call `db.close()`.

## Common mistakes

### Missing parameters become `NULL`

```javascript
const insert = db.prepare('INSERT INTO books (title, author, year) VALUES (?, ?, ?)');
insert.run('Dune', 'Frank Herbert'); // no error: year is silently NULL
```

Count your values, or use named parameters so missing ones are easy to spot.

### Preparing inside a loop

```javascript
for (const book of books) {
  db.prepare('INSERT INTO books (title) VALUES (?)').run(book.title); // re-parsed every time
}
```

Prepare once, outside the loop, then call `run()` inside it.

## Quick recap

- `node:sqlite` is a built-in SQLite database. On Node 24.12 it works without a flag but prints an `ExperimentalWarning`.
- `new DatabaseSync('file.db')` opens a file; `':memory:'` makes a temporary database.
- `db.exec()` runs setup SQL; `db.prepare()` makes reusable statements.
- `run()` for changes (`changes`, `lastInsertRowid`), `get()` for one row, `all()` for many.
- Use `?` or `:name` placeholders for every value. Never build SQL with `${}`.
- Store booleans as `1`/`0` and dates as ISO strings.
- Wrap related changes in `BEGIN` / `COMMIT`, with `ROLLBACK` on error.

<code id="code-content" class="language-javascript">
// sqlite-demo.mjs: run with  node --disable-warning=ExperimentalWarning sqlite-demo.mjs
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(':memory:'); // use a file name like 'library.db' to keep the data
db.exec(`
  CREATE TABLE books (
    id      INTEGER PRIMARY KEY,
    title   TEXT NOT NULL,
    author  TEXT NOT NULL,
    year    INTEGER,
    inStock INTEGER NOT NULL DEFAULT 1
  )
`);
// Prepare statements once, run them many times
const insert = db.prepare('INSERT INTO books (title, author, year) VALUES (:title, :author, :year)');
const byId = db.prepare('SELECT * FROM books WHERE id = ?');
const byAuthor = db.prepare('SELECT title, year FROM books WHERE author = ? ORDER BY year');
const setStock = db.prepare('UPDATE books SET inStock = :inStock WHERE id = :id');
// Insert several books inside one transaction (all or nothing, and fast)
const books = [
  { title: 'Dune', author: 'Frank Herbert', year: 1965 },
  { title: 'Emma', author: 'Jane Austen', year: 1815 },
  { title: 'Persuasion', author: 'Jane Austen', year: 1817 },
];
db.exec('BEGIN');
try {
  for (const book of books) insert.run(book);
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
// ---
// get(): one row or undefined
console.log({ ...byId.get(1) }); // spread into a normal object
console.log(byId.get(99)); // undefined, so an API would reply 404
// all(): an array of rows
console.log(byAuthor.all('Jane Austen').map((row) =&gt; `${row.title} (${row.year})`));
// run(): changes tells you whether anything matched
console.log(setStock.run({ id: 2, inStock: 0 }).changes); // 1
console.log(setStock.run({ id: 42, inStock: 0 }).changes); // 0
// Placeholders keep sneaky input harmless
const sneaky = "nobody' OR '1'='1";
console.log('Injection attempt found:', byAuthor.all(sneaky).length, 'rows'); // 0
// Constraint errors are normal exceptions
try {
  insert.run({ title: null, author: 'Nobody', year: 2000 });
} catch (err) {
  console.log(err.code, err.message);
}
console.log('Total books:', db.prepare('SELECT COUNT(*) AS n FROM books').get().n);
db.close();
</code></pre>

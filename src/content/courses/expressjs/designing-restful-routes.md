---
publishDate: 2026-10-25T09:33
title: Designing RESTful Routes
slug: designing-restful-routes
metadescription: Learn the REST conventions for naming URLs, picking HTTP methods and status codes, nesting resources and shaping JSON responses, with a complete Express 5 router.
updateDate: 2026-10-25T09:33
author: ['bishal-biswas']
level: 2
tags: ['express', 'rest', 'api-design', 'routing']
course: expressjs
---

## What you will learn

- What **REST** means in plain words and why most APIs follow it
- How to name URLs around **resources** (nouns), not actions (verbs)
- Which HTTP method and status code to use for each operation
- How to handle nested resources and actions that do not fit neatly
- How to build a clean, complete REST router in Express 5

## What is REST?

**REST** (Representational State Transfer) is a style for designing web APIs. It is not a library or a standard you install. It is a set of conventions that most developers recognise, so they can guess how your API works before reading the docs.

The core idea is simple:

1. Your API exposes **resources**: things like books, users or orders.
2. Each resource has a **URL**.
3. You use **HTTP methods** (`GET`, `POST`, `PATCH`, `DELETE`...) to say what to do with it.

**Think of it like a library.** The shelves are labelled with *things* ("Books", "Magazines"). You do not walk up to a shelf labelled "Borrow". Instead, you go to the right shelf and *do* something: look, take, return. In REST, the URL is the shelf (a noun), and the HTTP method is what you do (the verb).

## Resources and URLs

A **resource** is any "thing" your API manages. A **collection** is the list of all of them (`/books`), and an **item** is one of them (`/books/42`).

| Good | Avoid | Why |
| --- | --- | --- |
| `GET /books` | `GET /getAllBooks` | The method already says "get" |
| `POST /books` | `POST /books/create` | `POST` to a collection means "create" |
| `GET /books/42` | `GET /book?id=42` | Item ids belong in the path |
| `DELETE /books/42` | `POST /deleteBook/42` | Use the method that matches the action |
| `/books` | `/book` | Use plural nouns, consistently |
| `/reading-lists` | `/readingLists`, `/reading_lists` | Lowercase, hyphen-separated paths are the common choice |

A few more conventions:

- No trailing slashes: `/books`, not `/books/`.
- No file extensions: `/books/42`, not `/books/42.json`. The `Content-Type` header says it is JSON.
- Use `camelCase` for JSON field names (`createdAt`), because that is what JavaScript clients expect.

## HTTP methods map to actions

Most resources need the same five operations, often called **CRUD**: Create, Read, Update, Delete.

| Method and path | Action | Success status |
| --- | --- | --- |
| `GET /books` | List books | `200 OK` |
| `GET /books/42` | Read one book | `200 OK` |
| `POST /books` | Create a book | `201 Created` |
| `PUT /books/42` | Replace a book completely | `200 OK` |
| `PATCH /books/42` | Change some fields of a book | `200 OK` |
| `DELETE /books/42` | Delete a book | `204 No Content` |

### PUT vs PATCH

Both update, but differently.

- **`PUT`** replaces the whole resource. The client sends *every* field. Missing fields are cleared or rejected.
- **`PATCH`** changes only the fields the client sends. Everything else stays as it was.

```http
PATCH /books/42 HTTP/1.1
Content-Type: application/json

{ "pages": 320 }
```

That request changes only `pages`. Most modern APIs offer `PATCH`, and many skip `PUT` entirely. It is fine to do the same.

### Safe and idempotent methods

Two words appear a lot in API design.

- A **safe** method does not change anything on the server. `GET` and `HEAD` are safe.
- An **idempotent** method has the same effect whether you send it once or ten times. Deleting book 42 twice still leaves book 42 deleted.

| Method | Safe? | Idempotent? |
| --- | --- | --- |
| `GET` | Yes | Yes |
| `PUT` | No | Yes |
| `PATCH` | No | Not guaranteed |
| `DELETE` | No | Yes |
| `POST` | No | No (two POSTs create two books) |

Why care? Browsers, proxies and retry logic assume these rules. If your `GET /books/42/delete` route deletes things, a link preview or web crawler could wipe your data just by visiting the URL. Never change data in a `GET` handler.

## Status codes that tell the truth

Pick the status code that matches what happened. Clients rely on it more than on your message text.

| Situation | Status |
| --- | --- |
| Request worked, here is the data | `200 OK` |
| New resource created | `201 Created` (plus a `Location` header) |
| Worked, nothing to send back | `204 No Content` |
| Body or query is invalid | `400 Bad Request` |
| Not logged in | `401 Unauthorized` |
| Logged in, but not allowed | `403 Forbidden` |
| Resource does not exist | `404 Not Found` |
| Conflicts with current state (duplicate email) | `409 Conflict` |
| Server bug | `500 Internal Server Error` |

The **`Location`** header on a `201` response tells the client the URL of the thing it just created:

```http
HTTP/1.1 201 Created
Location: /books/43
Content-Type: application/json; charset=utf-8

{ "data": { "id": 43, "title": "Dune", "author": "Frank Herbert" } }
```

## Nested resources

Some resources belong to others. A review belongs to a book. Show that relationship in the URL:

```text
GET    /books/42/reviews        list reviews of book 42
POST   /books/42/reviews        add a review to book 42
GET    /reviews/7               read review 7 directly
DELETE /reviews/7               delete review 7
```

> **Tip:** Keep nesting to **one level**. `/authors/3/books/42/reviews/7` is long and forces the client to know three ids. Once an item has its own id, give it a short top-level URL like `/reviews/7`.

In Express, nested routers need `mergeParams: true` to read the parent's params, as you saw in the routers lesson:

```js
// routes/reviews.js
import { Router } from 'express';

const router = Router({ mergeParams: true }); // see :bookId from the parent

router.get('/', (req, res) => {
  res.json({ data: [], bookId: req.params.bookId });
});

export default router;
```

```js
// routes/books.js
import reviewsRouter from './reviews.js';

router.use('/:bookId/reviews', reviewsRouter);
```

## Actions that do not fit CRUD

Sometimes you need an action, like "cancel an order" or "publish a post". You have two good options.

**Option 1: change a field with PATCH.** If "publish" just means `status` becomes `published`, let the client send that:

```http
PATCH /posts/9
Content-Type: application/json

{ "status": "published" }
```

**Option 2: a sub-resource for the action.** If the action has side effects (sending emails, charging money), a dedicated `POST` is clearer:

```text
POST /orders/15/cancel
POST /users/3/password-reset
```

Both are widely used. Avoid inventing verbs at the top level, like `POST /cancelOrder`.

## Consistent response shapes

Clients write code against your response format, so keep it the same everywhere. One common pattern wraps results in a `data` property and errors in an `error` property:

```json
{ "data": { "id": 42, "title": "Dune" } }
```

```json
{ "data": [{ "id": 42, "title": "Dune" }], "meta": { "page": 1, "total": 1 } }
```

```json
{ "error": { "message": "Book not found" } }
```

The wrapper leaves room to add things later, such as pagination info in `meta`, without breaking clients.

## Filtering, sorting and pages use the query string

The path identifies *which* resource. The query string *refines* a list:

```text
GET /books?author=herbert&sort=-year&page=2&limit=20
```

You will build exactly this in [Pagination, Filtering and Sorting](/courses/expressjs/pagination-filtering-sorting). For now, just remember: do not create separate routes like `/books/by-author/herbert`.

## Putting it together: a books router

Here is a complete REST router with an in-memory store. A **store** here is just a `Map` that holds data while the server runs. The next two lessons replace it with a real database.

```js
// routes/books.js
import { Router } from 'express';

const router = Router();

const books = new Map();
let nextId = 1;

// Small helper: find the book or send 404
const findBook = (req, res) => {
  const book = books.get(Number(req.params.id));
  if (!book) res.status(404).json({ error: { message: 'Book not found' } });
  return book;
};

const isValidBook = (body) =>
  typeof body?.title === 'string' && body.title.trim() !== '' &&
  typeof body?.author === 'string' && body.author.trim() !== '';

router.route('/')
  .get((req, res) => {
    res.json({ data: [...books.values()] });
  })
  .post((req, res) => {
    if (!isValidBook(req.body)) {
      return res.status(400).json({ error: { message: 'title and author are required' } });
    }
    const book = { id: nextId++, title: req.body.title, author: req.body.author };
    books.set(book.id, book);
    res.status(201).location(`/books/${book.id}`).json({ data: book });
  });

router.route('/:id')
  .get((req, res) => {
    const book = findBook(req, res);
    if (book) res.json({ data: book });
  })
  .put((req, res) => {
    const book = findBook(req, res);
    if (!book) return;
    if (!isValidBook(req.body)) {
      return res.status(400).json({ error: { message: 'PUT needs title and author' } });
    }
    const replaced = { id: book.id, title: req.body.title, author: req.body.author };
    books.set(book.id, replaced);
    res.json({ data: replaced });
  })
  .patch((req, res) => {
    const book = findBook(req, res);
    if (!book) return;
    const { title, author } = req.body ?? {};
    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    res.json({ data: book });
  })
  .delete((req, res) => {
    const book = findBook(req, res);
    if (!book) return;
    books.delete(book.id);
    res.status(204).end();
  });

export default router;
```

`router.route(path)` lets you chain several methods on one path, so each URL appears only once. Mount it in your app:

```js
// app.js
import express from 'express';
import booksRouter from './routes/books.js';

const app = express();
app.use(express.json());
app.use('/books', booksRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('API on http://localhost:3000');
});
```

> **Note:** The checks above are deliberately simple. In a real API, use the Zod middleware from [Request Validation with Zod](/courses/expressjs/request-validation-with-zod), and only copy fields you expect. The `PATCH` handler here, for example, does not check types.

## Trying every route

```bash
# Create
curl -i -X POST http://localhost:3000/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert"}'

# List and read
curl http://localhost:3000/books
curl http://localhost:3000/books/1

# Partial update
curl -X PATCH http://localhost:3000/books/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune (Deluxe Edition)"}'

# Delete, then confirm it is gone
curl -i -X DELETE http://localhost:3000/books/1
curl -i http://localhost:3000/books/1
```

The first command shows the `201` status and `Location: /books/1` header. The last shows `404 Not Found`.

> **Note:** These commands use bash syntax. On Windows, run them in Git Bash or WSL. In PowerShell, type `curl.exe` instead of `curl` and adjust the quotes.

## Common mistakes

- **Verbs in URLs**, like `/getBooks` or `/books/delete/42`. Let the HTTP method be the verb.
- **Returning `200` for everything**, with `{ "success": false }` in the body. Use real status codes.
- **Changing data in a `GET` route.** Crawlers and prefetching browsers will trigger it.
- **Mixing styles**: `/books` here, `/Author` there, `user_id` in one response and `userId` in another. Pick conventions and stick to them.
- **Deep nesting** that forces clients to know many ids.

## Key takeaways

- REST organises an API around **resources** (plural nouns in URLs) and **HTTP methods** (the verbs).
- `GET` reads, `POST` creates, `PATCH` updates part, `PUT` replaces, `DELETE` removes.
- Return honest status codes: `201` plus `Location` on create, `204` on delete, `404` when missing.
- Nest one level at most, and use `PATCH` or a `POST` sub-resource for special actions.
- Keep your URL style and response shape consistent across the whole API.

## Practice

1. Design (on paper) the routes for a blog with posts, comments and tags. Which ones are nested?
2. Add an `authors` resource to the books API with all five CRUD routes.
3. Add `GET /books/:bookId/reviews` and `POST /books/:bookId/reviews` using a nested router with `mergeParams: true`.
4. Rewrite these bad routes the REST way: `GET /fetchUser?id=3`, `POST /users/3/delete`, `POST /updateUserEmail`.

## What's next

Your routes are designed, but the data disappears when the server restarts. Store it for real in [CRUD API with MongoDB and Mongoose](/courses/expressjs/crud-api-with-mongodb).

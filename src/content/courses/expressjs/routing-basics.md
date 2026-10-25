---
publishDate: 2026-10-25T09:07
title: Routing with app.get, app.post and Friends
slug: routing-basics
metadescription: Learn how Express routes match HTTP methods and paths, build a small in-memory books API with get, post, put, patch and delete, and test every route with curl.
updateDate: 2026-10-25T09:07
author: ['bishal-biswas']
level: 1
tags: ['express', 'routing', 'http-methods', 'rest']
course: expressjs
---

## What you will learn

- What a **route** is: a method, a path and a handler
- How to use `app.get`, `app.post`, `app.put`, `app.patch` and `app.delete`
- How to group routes with `app.all` and `app.route`
- How to send `POST`, `PUT`, `PATCH` and `DELETE` requests with `curl`
- What Express does automatically for `HEAD`, `OPTIONS` and unknown routes

So far your server has had one or two `GET` routes. Real apps need to *create*, *change* and *delete* things too. In this lesson you will build a small API for a list of books, using every common HTTP method.

## What is a route?

**Routing** means deciding which code should run for each incoming request. A **route** is one rule in that decision. Every route has three parts:

```text
app.get(  '/books',  (req, res) => { ... }  )
    |        |                 |
  method    path            handler
```

- The **method** is the HTTP verb the route answers: `get`, `post`, `put`, `patch`, `delete` and so on.
- The **path** is the part of the URL after the host, such as `/books`.
- The **handler** is the function Express calls when **both** the method and the path match.

**Think of a hotel reception desk.** "Check-in at the front desk" and "check-out at the front desk" happen at the same place (the path) but are different actions (the methods), handled by different procedures (the handlers).

This means the same path can have several routes, one per method:

```js
app.get('/books', (req, res) => { /* list books */ });
app.post('/books', (req, res) => { /* add a book */ });
```

A `GET /books` request runs the first handler. A `POST /books` request runs the second.

## The routing methods

Express has one method on `app` for each HTTP verb. The name is simply the verb in lower case:

| Express method | HTTP method | Typical job |
| --- | --- | --- |
| `app.get(path, handler)` | `GET` | Read data |
| `app.post(path, handler)` | `POST` | Create something new |
| `app.put(path, handler)` | `PUT` | Replace something completely |
| `app.patch(path, handler)` | `PATCH` | Update part of something |
| `app.delete(path, handler)` | `DELETE` | Remove something |
| `app.all(path, handler)` | Any method | Run for every method on this path |

> **Note:** Very old tutorials use `app.del()`. It was removed in Express 5; use `app.delete()`.

## Build a books API

Let's write a full example. The books are kept in a plain JavaScript array, which lives in memory. **In memory** means the data only exists while the server runs: restart it and the list resets. That's fine for learning; you will connect a real database in [CRUD API with MongoDB and Mongoose](/courses/expressjs/crud-api-with-mongodb).

```js
// server.js
import express from 'express';

const app = express();

// Lets Express read JSON request bodies into req.body
app.use(express.json());

const books = [
  { id: 1, title: 'Dune', author: 'Frank Herbert' },
  { id: 2, title: 'Emma', author: 'Jane Austen' },
];
let nextId = 3;

// READ all books
app.get('/books', (req, res) => {
  res.json(books);
});

// READ one book
app.get('/books/:id', (req, res) => {
  const book = books.find((b) => b.id === Number(req.params.id));
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  res.json(book);
});

// CREATE a book
app.post('/books', (req, res) => {
  const { title, author } = req.body ?? {};
  if (!title || !author) {
    return res.status(400).json({ error: 'title and author are required' });
  }
  const book = { id: nextId++, title, author };
  books.push(book);
  res.status(201).json(book);
});

// REPLACE a book
app.put('/books/:id', (req, res) => {
  const index = books.findIndex((b) => b.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }
  const { title, author } = req.body ?? {};
  if (!title || !author) {
    return res.status(400).json({ error: 'title and author are required' });
  }
  books[index] = { id: books[index].id, title, author };
  res.json(books[index]);
});

// UPDATE part of a book
app.patch('/books/:id', (req, res) => {
  const book = books.find((b) => b.id === Number(req.params.id));
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  const { title, author } = req.body ?? {};
  if (title) book.title = title;
  if (author) book.author = author;
  res.json(book);
});

// DELETE a book
app.delete('/books/:id', (req, res) => {
  const index = books.findIndex((b) => b.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }
  books.splice(index, 1);
  res.sendStatus(204); // 204 No Content: success, nothing to send back
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Books API on http://localhost:3000');
});
```

Start it with `npm run dev` (or `node --watch server.js`). Let's look at the new ideas, then test every route.

### New idea 1: `:id` in the path

`'/books/:id'` matches `/books/1`, `/books/2`, `/books/99` and so on. The `:id` part is a **route parameter**: a placeholder that captures whatever is in that position of the URL. Express puts the value in `req.params.id`.

The value is always a **string**, so `Number(req.params.id)` converts `'1'` into `1` before comparing. The next lesson, [Route Parameters and path-to-regexp v8 Syntax](/courses/expressjs/route-parameters-and-path-to-regexp), covers parameters in depth.

### New idea 2: `express.json()` and `req.body`

When a client creates a book, it sends the data in the request **body** as JSON. Express does not read bodies by default. The line `app.use(express.json())` adds a small helper (a **middleware**) that reads JSON bodies and puts the result in `req.body`.

If a request has no JSON body, `req.body` stays `undefined` in Express 5. That's why the code says `req.body ?? {}`: "use the body, or an empty object if there isn't one", so destructuring never crashes. You will learn all the details in [Built-in Body Parsers: express.json and urlencoded](/courses/expressjs/built-in-body-parsers).

### New idea 3: status codes and `return`

- `res.status(201)` means **Created**. It's the correct answer after `POST` successfully makes something new.
- `res.status(404)` means **Not Found**, and `res.status(400)` means **Bad Request** (the client sent bad data).
- `res.sendStatus(204)` sends **No Content** with an empty body, the usual answer to a successful `DELETE`.

Notice `return res.status(404).json(...)`. The `return` stops the function right there, so the code below it doesn't also try to send a response. A response can only be sent **once**.

## Test every route with curl

Open a second terminal. On Windows PowerShell, type `curl.exe` wherever you see `curl`.

### GET: read

```bash
curl http://localhost:3000/books
```

```text
[{"id":1,"title":"Dune","author":"Frank Herbert"},{"id":2,"title":"Emma","author":"Jane Austen"}]
```

```bash
curl -i http://localhost:3000/books/99
```

```text
HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8
...

{"error":"Book not found"}
```

### POST: create

To send a body, you need three new curl flags:

| Flag | Meaning |
| --- | --- |
| `-X POST` | Use this HTTP method (the default is `GET`) |
| `-H "Content-Type: application/json"` | Add a request header saying the body is JSON |
| `-d '...'` | The request body (data) |

```bash
curl -i -X POST http://localhost:3000/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Beloved","author":"Toni Morrison"}'
```

```text
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
...

{"id":3,"title":"Beloved","author":"Toni Morrison"}
```

The `\` at the end of a line means "this command continues on the next line". You can also type it all on one line.

> **Warning:** Quoting JSON on the Windows command line is painful. The easiest fix is to put the JSON in a file, for example `book.json`, and send it with `-d @book.json`: `curl.exe -i -X POST http://localhost:3000/books -H "Content-Type: application/json" -d @book.json`. This works on every system. Using Git Bash on Windows also lets you copy the commands exactly as shown.

Try a bad request without an author:

```bash
curl -i -X POST http://localhost:3000/books \
  -H "Content-Type: application/json" \
  -d '{"title":"No Author"}'
```

```text
HTTP/1.1 400 Bad Request
...

{"error":"title and author are required"}
```

### PUT and PATCH: change

```bash
curl -X PUT http://localhost:3000/books/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune Messiah","author":"Frank Herbert"}'
```

```text
{"id":1,"title":"Dune Messiah","author":"Frank Herbert"}
```

```bash
curl -X PATCH http://localhost:3000/books/2 \
  -H "Content-Type: application/json" \
  -d '{"title":"Persuasion"}'
```

```text
{"id":2,"title":"Persuasion","author":"Jane Austen"}
```

`PUT` needs the **whole** book and replaces it. `PATCH` changes only the fields you send; the author stayed the same.

### DELETE: remove

```bash
curl -i -X DELETE http://localhost:3000/books/2
```

```text
HTTP/1.1 204 No Content
...
```

Run `curl http://localhost:3000/books` again and book 2 is gone.

> **Common mistake:** Forgetting `-H "Content-Type: application/json"`. Without it, `express.json()` doesn't recognise the body, `req.body` stays `undefined`, and your route answers with `400`. If a `POST` mysteriously fails, check this header first.

## Grouping routes

### `app.route()`: one path, many methods

Typing `'/books/:id'` four times invites typos. `app.route()` lets you write the path once and chain the methods:

```js
// server.js (same behaviour, less repetition)
app.route('/books/:id')
  .get((req, res) => { /* read one */ })
  .put((req, res) => { /* replace */ })
  .patch((req, res) => { /* update */ })
  .delete((req, res) => { /* remove */ });
```

Each method in the chain works exactly like the separate `app.get`, `app.put`... calls. Later, in [express.Router and Modular Routes](/courses/expressjs/express-router-and-modular-routes), you will move groups of routes into their own files.

### `app.all()`: every method

`app.all()` matches a path for **any** HTTP method. It is useful for things that apply regardless of the verb:

```js
// server.js
app.all('/old-api', (req, res) => {
  res.status(410).json({ error: 'This API was retired. Use /books instead.' });
});
```

`410 Gone` tells clients the resource is permanently gone. A `GET`, `POST` or `DELETE` to `/old-api` all get the same answer.

## What Express does for you automatically

### HEAD requests

A `HEAD` request asks for the headers only, without the body. You never need to write `app.head()`: Express answers `HEAD` using your `GET` route and simply leaves out the body.

```bash
curl -I http://localhost:3000/books
```

(Capital `-I` sends a `HEAD` request.)

### OPTIONS requests

An `OPTIONS` request asks "which methods are allowed here?". Express answers it automatically with an `Allow` header listing the methods you defined:

```bash
curl -i -X OPTIONS http://localhost:3000/books/1
```

```text
HTTP/1.1 200 OK
Allow: DELETE, GET, HEAD, PATCH, PUT
...

DELETE, GET, HEAD, PATCH, PUT
```

Express lists the methods in alphabetical order, in the header and in the body.

### Unknown paths and methods

If no route matches, Express sends a `404` with a short HTML page such as `Cannot GET /authors`. This also happens when the path exists but the **method** doesn't. For example, there is no `app.delete('/books')`, so:

```bash
curl -X DELETE http://localhost:3000/books
```

```text
...
<pre>Cannot DELETE /books</pre>
...
```

## A route can have more than one handler

You can pass several functions to one route. They run in order, and each one decides whether to pass control to the next. This is how features like "check the user is logged in, *then* show the page" work:

```js
app.get('/admin', checkLogin, (req, res) => {
  res.send('Welcome, admin');
});
```

You'll learn how to write functions like `checkLogin` in [Route Handlers, next() and Chaining](/courses/expressjs/route-handlers-and-next). For now, just know that it's possible.

## Key takeaways

- A **route** = HTTP **method** + **path** + **handler**. Both the method and the path must match.
- Use `app.get`, `app.post`, `app.put`, `app.patch` and `app.delete` for the matching verbs, and `app.all` for any verb.
- `app.route(path)` lets you chain several methods on one path.
- Add `app.use(express.json())` to read JSON bodies into `req.body`, and send `Content-Type: application/json` from the client.
- Pick fitting status codes: `201` after creating, `204` after deleting, `400` for bad input, `404` when something is missing.
- Express handles `HEAD`, `OPTIONS` and unknown routes for you.

## Practice

1. Add a `GET /books/count` route that returns `{ "count": 2 }` (the real number of books). Add it **above** `GET /books/:id` and test it. Then try moving it below and see what happens (the reason is explained two lessons from now).
2. Make `POST /books` reject a `title` shorter than 2 characters with a `400` status.
3. Rewrite the four `/books/:id` routes using `app.route()`.
4. Send an `OPTIONS` request to `/books` and check which methods appear in the `Allow` header.

## What's next

You used `:id` to capture part of the URL. Let's explore everything route paths can do in Express 5. Continue with [Route Parameters and path-to-regexp v8 Syntax](/courses/expressjs/route-parameters-and-path-to-regexp).

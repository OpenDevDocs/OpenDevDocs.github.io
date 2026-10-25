---
publishDate: 2026-10-25T10:35
title: Routing and JSON APIs without a Framework
slug: routing-without-a-framework
metadescription: Turn a bare Node http server into a small JSON API. Match methods and paths, read path parameters, parse JSON bodies and send proper errors.
updateDate: 2026-10-25T10:35
author: ['bishal-biswas']
level: 2
tags: ['http', 'routing', 'api', 'json']
course: nodejs
---

## What is routing?

Picture the reception desk in an office building. A visitor says who they want to see, and the receptionist sends them to the right floor and room.

**Routing** is the same job for a web server. Every request says *what* it wants (the method, like `GET` or `POST`) and *where* (the path, like `/books/2`). The **router** looks at both and calls the right piece of code, called a **route handler**.

In [the http Module lesson](/courses/nodejs/http-module-and-servers) you built a server with one handler for everything. Now you will give it proper routes and turn it into a small **JSON API**: a server that programs talk to by sending and receiving JSON instead of HTML pages.

## Step 1: get the path without the query string

`req.url` includes the query string, so `/about?x=1` would not equal `/about`. The built-in `URL` class splits it for you. You will meet `URL` properly in [the URL lesson](/courses/nodejs/url-and-query-strings); for now you only need `pathname`.

```javascript
import http from 'node:http';

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/') {
    res.end('Home page');
  } else if (req.method === 'GET' && pathname === '/about') {
    res.end('About us');
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(3000);
```

`req.url` is only a path, so `URL` needs a base (`'http://localhost'`) to build a full address. The base does not matter here; you only read the path.

```text
GET /          -> Home page
GET /about?x=1 -> About us
GET /nope      -> 404 Not found
```

This `if`/`else` chain works, but it grows messy once you have ten routes and paths like `/books/2`.

## Step 2: helpers for JSON

An API sends JSON in almost every response, so write a helper once:

```javascript
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}
```

Now every error has the same shape, `{ "error": "..." }`. Clients love predictable errors.

Reading a JSON body needs two safety checks: the body might be huge, or it might not be valid JSON. A small custom error class carries the right status code:

```javascript
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(req, limit = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Body too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
}
```

- The size limit (about 1 MB here) stops someone from sending gigabytes and filling your memory. Status `413` means "Payload Too Large".
- `JSON.parse` throws on bad input. You turn that into a `400 Bad Request` instead of a crash.

## Step 3: a route table

Instead of a long `if` chain, list your routes as data. Each route has a method, a **pattern** for the path and a handler.

```javascript
const routes = [
  { method: 'GET', pattern: /^\/books$/, handler: listBooks },
  { method: 'POST', pattern: /^\/books$/, handler: createBook },
  { method: 'GET', pattern: /^\/books\/(?<id>\d+)$/, handler: getBook },
  { method: 'DELETE', pattern: /^\/books\/(?<id>\d+)$/, handler: deleteBook },
];
```

The patterns are regular expressions:

- `^` and `$` mean "start" and "end", so `/books` matches but `/books/extra` does not.
- `(?<id>\d+)` is a **named group**. It captures one or more digits and calls them `id`. This is how you read a **path parameter**, the changing part of a URL like the `2` in `/books/2`.

```javascript
const match = '/books/42'.match(/^\/books\/(?<id>\d+)$/);
console.log(match.groups); // prints: [Object: null prototype] { id: '42' }
```

Note that `id` is the string `'42'`. Everything in a URL is text, so convert it with `Number()` when you need a number.

## Step 4: the router

The router finds the route, handles "not found" and "wrong method", and catches errors in one place:

```javascript
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  const matches = routes.filter((r) => r.pattern.test(pathname));
  if (matches.length === 0) return sendError(res, 404, 'Route not found');

  const route = matches.find((r) => r.method === req.method);
  if (!route) {
    res.setHeader('Allow', matches.map((r) => r.method).join(', '));
    return sendError(res, 405, 'Method not allowed');
  }

  const params = pathname.match(route.pattern).groups ?? {};
  try {
    await route.handler(req, res, params);
  } catch (err) {
    if (err instanceof HttpError) return sendError(res, err.status, err.message);
    console.error(err);
    sendError(res, 500, 'Something went wrong');
  }
});
```

There are two different "not found" cases, and good APIs tell them apart:

- **404 Not Found**: no route has this path at all.
- **405 Method Not Allowed**: the path exists, but not with this method (say, `PUT /books/2`). The `Allow` header lists the methods that would work.

The `try`/`catch` is your safety net. Expected problems (`HttpError`) become clean 4xx replies. Anything else is a bug, so you log it and send a generic `500` without leaking details to the client.

## Step 5: the handlers

Here are the handlers, working on an in-memory array. Data in an array disappears when the server restarts; you will swap it for a real database in [the Notes REST API project](/courses/nodejs/project-notes-rest-api).

```javascript
const books = [
  { id: 1, title: 'Dune', author: 'Frank Herbert' },
  { id: 2, title: 'Emma', author: 'Jane Austen' },
];
let nextId = 3;

function listBooks(req, res) {
  sendJson(res, 200, books);
}

function getBook(req, res, params) {
  const book = books.find((b) => b.id === Number(params.id));
  if (!book) return sendError(res, 404, 'Book not found');
  sendJson(res, 200, book);
}

async function createBook(req, res) {
  const body = await readJson(req);
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return sendError(res, 400, 'title is required');
  }
  const book = { id: nextId++, title: body.title.trim(), author: body.author ?? 'Unknown' };
  books.push(book);
  sendJson(res, 201, book);
}

function deleteBook(req, res, params) {
  const index = books.findIndex((b) => b.id === Number(params.id));
  if (index === -1) return sendError(res, 404, 'Book not found');
  books.splice(index, 1);
  res.writeHead(204);
  res.end();
}
```

Put the helpers, handlers, route table and router in one `books.js` file, add `server.listen(3000)`, and try it with curl:

```bash
curl http://localhost:3000/books/2
curl -X POST http://localhost:3000/books -H "Content-Type: application/json" -d '{"title":"Beloved","author":"Toni Morrison"}'
curl -X POST http://localhost:3000/books -d '{"title": }'
curl -X POST http://localhost:3000/books -d '{"author":"Ravi"}'
curl -i -X PUT http://localhost:3000/books/2
```

```text
{"id":2,"title":"Emma","author":"Jane Austen"}
{"id":3,"title":"Beloved","author":"Toni Morrison"}
{"error":"Body must be valid JSON"}
{"error":"title is required"}
HTTP/1.1 405 Method Not Allowed
Allow: GET, DELETE
...
{"error":"Method not allowed"}
```

> **Tip:** On Windows PowerShell, quoting JSON for curl is painful. Use `curl.exe` with a file (`-d "@book.json"`), or test with `fetch` from a small Node script as the playground below does.

## A newer option: URLPattern

Node 24 also has a global `URLPattern` class, the web standard for matching URLs. It reads more nicely than a regex:

```javascript
const pattern = new URLPattern({ pathname: '/books/:id' });

const match = pattern.exec('http://localhost/books/42');
console.log(match.pathname.groups); // { id: '42' }

console.log(pattern.test('http://localhost/books')); // false
```

It is still marked **experimental** in the Node 24 docs, which is why this lesson uses plain regular expressions. Keep an eye on it.

## Common mistakes

### Comparing `req.url` directly

```javascript
if (req.url === '/books') { /* ... */ } // fails for /books?sort=title
```

Use `new URL(req.url, 'http://localhost').pathname` instead.

### Forgetting to `return` after sending an error

```javascript
if (!book) sendError(res, 404, 'Book not found'); // no return
sendJson(res, 200, book); // runs too, and throws ERR_HTTP_HEADERS_SENT
```

Write `return sendError(...)` so the handler stops.

### Treating an id as a number

```javascript
books.find((b) => b.id === params.id); // 2 === '2' is false, always 404
```

Convert first: `Number(params.id)`.

## When to reach for a framework

Everything you wrote here, frameworks such as Express and Fastify give you ready made: routing, body parsing, error handling and much more. Writing it once yourself means you will understand exactly what they do for you. For a small internal tool, this hand-made router is often all you need.

## Quick recap

- Routing means picking a handler from the request's method and path.
- Use `new URL(req.url, 'http://localhost').pathname` to ignore the query string.
- Keep routes in a table: method, regex pattern, handler.
- Named groups like `(?<id>\d+)` capture path parameters. They are strings.
- Read JSON bodies with a size limit and turn parse errors into `400`.
- Send `404` for unknown paths, `405` with an `Allow` header for wrong methods, `500` for bugs.
- Give every error the same JSON shape, such as `{ "error": "..." }`.

<code id="code-content" class="language-javascript">
// router.mjs: a small JSON API with a route table, then a self-test
import http from 'node:http';
const books = [{ id: 1, title: 'Dune' }, { id: 2, title: 'Emma' }];
let nextId = 3;
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const err = new Error('Body must be valid JSON'); err.status = 400; throw err; }
}
// Each route: method + regex for the path + handler
const routes = [
  { method: 'GET', pattern: /^\/books$/, handler: (req, res) =&gt; sendJson(res, 200, books) },
  { method: 'GET', pattern: /^\/books\/(?&lt;id&gt;\d+)$/, handler: (req, res, params) =&gt; {
    const book = books.find((b) =&gt; b.id === Number(params.id));
    if (!book) return sendJson(res, 404, { error: 'Book not found' });
    sendJson(res, 200, book);
  } },
  { method: 'POST', pattern: /^\/books$/, handler: async (req, res) =&gt; {
    const body = await readJson(req);
    if (typeof body.title !== 'string' || !body.title.trim()) return sendJson(res, 400, { error: 'title is required' });
    const book = { id: nextId++, title: body.title.trim() };
    books.push(book);
    sendJson(res, 201, book);
  } },
];
const server = http.createServer(async (req, res) =&gt; {
  const { pathname } = new URL(req.url, 'http://localhost');
  const matches = routes.filter((r) =&gt; r.pattern.test(pathname));
  if (matches.length === 0) return sendJson(res, 404, { error: 'Route not found' });
  const route = matches.find((r) =&gt; r.method === req.method);
  if (!route) {
    res.setHeader('Allow', matches.map((r) =&gt; r.method).join(', '));
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  try {
    await route.handler(req, res, pathname.match(route.pattern).groups ?? {});
  } catch (err) {
    sendJson(res, err.status ?? 500, { error: err.status ? err.message : 'Something went wrong' });
  }
});
server.listen(0, async () =&gt; {
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body) =&gt; {
    const res = await fetch(base + path, { method, body });
    console.log(method, path, '-&gt;', res.status, await res.text());
  };
  await call('GET', '/books');
  await call('GET', '/books/2');
  await call('POST', '/books', JSON.stringify({ title: 'Beloved' }));
  await call('POST', '/books', '{ broken'); // 400
  await call('DELETE', '/books/1'); // 405, no DELETE route here
  await call('GET', '/authors'); // 404
  server.close();
});
</code></pre>

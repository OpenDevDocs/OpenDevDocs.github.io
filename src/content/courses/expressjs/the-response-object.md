---
publishDate: 2026-10-25T09:12
title: The Response Object
slug: the-response-object
metadescription: Learn how the Express res object sends answers back to the client with res.send, res.json and res.status, and why every request needs exactly one response.
updateDate: 2026-10-25T09:12
author: ['bishal-biswas']
level: 1
tags: ['express', 'nodejs', 'response', 'http']
course: expressjs
---

## What you will learn

- What the **response object** (`res`) is and what it is for
- How `res.send()`, `res.json()` and `res.end()` differ
- How to set a status code with `res.status()` and `res.sendStatus()`
- The golden rule: **one request, exactly one response**
- How to share data with `res.locals`

## What is the response object?

In the last lesson you learned that `req` is everything the client sent. The second argument to your handler, `res`, is the tool you use to **answer**.

**Back to the restaurant:** `req` is the order slip the waiter hands to the kitchen. `res` is the plate. You choose what goes on it (the body), add a label (the status code and headers), and send it out. Once the plate leaves the kitchen, you cannot add more food to it.

```js
app.get('/', (req, res) => {
  res.send('Hello from Express');
});
```

Every response has three parts:

```text
 +------------------------------------------+
 | Status line:  HTTP/1.1 200 OK            |  <- res.status()
 +------------------------------------------+
 | Headers:      Content-Type: text/html    |  <- res.set(), res.type()
 |               Content-Length: 18         |
 +------------------------------------------+
 | Body:         Hello from Express         |  <- res.send(), res.json()
 +------------------------------------------+
```

Express fills in sensible defaults for you. Most of the time you only choose the body and, sometimes, the status code.

> **Note:** Like `req`, `res` is Node's built-in `http.ServerResponse` object with extra Express helpers on top.

## `res.send()`: the all-rounder

`res.send(body)` sends a response and **finishes** it. It looks at what you pass in and picks a `Content-Type` header for you.

| You pass | Express sends | `Content-Type` |
| --- | --- | --- |
| A string | The text | `text/html; charset=utf-8` |
| An object or array | JSON | `application/json; charset=utf-8` |
| A `Buffer` (raw bytes) | The bytes | `application/octet-stream` |

```js
// app.js
import express from 'express';

const app = express();

app.get('/text', (req, res) => {
  res.send('<h1>Plain HTML string</h1>');
});

app.get('/object', (req, res) => {
  res.send({ framework: 'Express', version: 5 });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Use `curl -i` to see the headers too. The `-i` flag means "include the response headers in the output".

```bash
curl -i http://localhost:3000/object
```

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 35
ETag: W/"23-..."
Date: Sun, 25 Oct 2026 09:12:00 GMT
Connection: keep-alive

{"framework":"Express","version":5}
```

Notice that Express also added `Content-Length` and an `ETag` for you. An **ETag** is a short fingerprint of the body that helps browsers cache responses.

## `res.json()`: say exactly what you mean

`res.json(data)` always sends JSON. It converts the value with `JSON.stringify()` and sets `Content-Type: application/json`.

```js
app.get('/api/user', (req, res) => {
  res.json({ id: 1, name: 'Asha', admin: false });
});
```

Why use it when `res.send()` can also send objects? Because it is clearer to anyone reading your code, and it also handles values that `res.send()` treats differently, such as `null` or a number. For APIs, always prefer `res.json()`.

You will learn more JSON tricks, plus sending files and redirects, in [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects).

## `res.status()`: set the status code

The **status code** is a three-digit number that tells the client how things went. `200` means OK, `201` means "created", `404` means "not found", `500` means "the server broke".

If you do not set one, Express uses `200`. To set a different code, call `res.status()` **before** sending.

```js
app.post('/api/notes', (req, res) => {
  res.status(201).json({ id: 123, title: 'New note' });
});

app.get('/api/secret', (req, res) => {
  res.status(403).json({ error: 'You are not allowed to see this' });
});
```

`res.status()` returns `res` itself, so you can **chain** the next call right after it with a dot. That is why `res.status(201).json(...)` works.

> **Warning:** In Express 5, `res.status()` only accepts whole numbers from 100 to 999. Passing a string like `'404'` or a number like `1000` throws an error. If a status code comes from somewhere else, convert and check it first.

The full list of useful codes is in [Status Codes and Response Headers](/courses/expressjs/status-codes-and-headers).

## `res.sendStatus()` and `res.end()`

Sometimes you only want to send a status code with no real body.

**`res.sendStatus(code)`** sets the status and sends its standard name as plain text.

```js
app.delete('/api/notes/:id', (req, res) => {
  // ...delete the note...
  res.sendStatus(204); // 204 No Content: success, nothing to send back
});

app.get('/health', (req, res) => {
  res.sendStatus(200); // body: "OK"
});
```

**`res.end()`** comes from Node. It finishes the response without any Express helpers: no automatic `Content-Type`, no ETag. Use it when you have nothing to send.

```js
app.get('/ping', (req, res) => {
  res.status(204).end();
});
```

| Method | Sets status | Sends body | Typical use |
| --- | --- | --- | --- |
| `res.send(body)` | No (keeps current, default 200) | Yes, any type | HTML or text |
| `res.json(data)` | No (keeps current, default 200) | Yes, as JSON | APIs |
| `res.sendStatus(code)` | Yes | Status name as text | Quick status-only answers |
| `res.end()` | No | Optional raw data | Empty responses |

> **Common mistake:** Writing `res.send(404)` to send a "not found" response. That was removed in Express 5. Today it sends the number `404` as the body with status `200`. Use `res.sendStatus(404)` or `res.status(404).send('Not found')`.

## The golden rule: exactly one response

Every request must get **one** response. Not zero, not two.

**Zero responses:** if your handler never calls `res.send()`, `res.json()` or similar, the client just waits. The browser shows a spinning icon until it gives up. This is called a **hanging request**.

```js
// Bug: no response is ever sent
app.get('/forgot', (req, res) => {
  console.log('I forgot to answer');
});
```

**Two responses:** once a response is sent, it is gone. Trying to send another one causes this famous error:

```text
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
```

It usually happens when you forget a `return`:

```js
// Bug: when id is missing, BOTH responses run
app.get('/api/items', (req, res) => {
  if (!req.query.id) {
    res.status(400).json({ error: 'id is required' });
  }
  res.json({ id: req.query.id, name: 'Lamp' });
});
```

The fix is to `return` as soon as you respond. This pattern is called an **early return**.

```js
// Fixed: return stops the function after the first response
app.get('/api/items', (req, res) => {
  if (!req.query.id) {
    return res.status(400).json({ error: 'id is required' });
  }
  res.json({ id: req.query.id, name: 'Lamp' });
});
```

> **Tip:** Get into the habit of writing `return res.status(...)...` for every response that is not the last line of the function. It prevents a whole family of bugs.

If you ever need to check whether a response has already gone out, read `res.headersSent`. It is `true` after headers were sent. You will use this inside error handlers later.

## Setting headers

Express sets the common headers for you. You can add or change your own with `res.set()`, read one back with `res.get()`, and set the content type quickly with `res.type()`.

```js
app.get('/report.txt', (req, res) => {
  res.set('Cache-Control', 'no-store'); // do not cache this
  res.type('text');                     // Content-Type: text/plain; charset=utf-8
  res.send('Daily report: all good');
});
```

Headers must be set **before** the body is sent. After `res.send()` it is too late. You will go deeper in [Status Codes and Response Headers](/courses/expressjs/status-codes-and-headers).

## Answering in more than one format: `res.format()`

Some endpoints should return HTML to browsers and JSON to apps. `res.format()` picks the right function based on the client's `Accept` header.

```js
app.get('/team', (req, res) => {
  const team = ['Asha', 'Ben', 'Chen'];

  res.format({
    html: () => res.send(`<ul>${team.map((n) => `<li>${n}</li>`).join('')}</ul>`),
    json: () => res.json(team),
    default: () => res.status(406).send('Not Acceptable'),
  });
});
```

```bash
curl -H "Accept: application/json" http://localhost:3000/team
# ["Asha","Ben","Chen"]
```

A browser asks for HTML first, so it gets the list. This idea is called **content negotiation**: the client and server agree on a format.

## Sharing data with `res.locals`

`res.locals` is an empty object that lives for **one request only**. Anything you put in it is available to later code that handles the same request, and to templates when you render HTML.

```js
app.get('/dashboard', (req, res) => {
  res.locals.pageTitle = 'Dashboard';
  res.send(`<h1>${res.locals.pageTitle}</h1>`);
});
```

On its own that looks pointless. It becomes useful once **middleware** (functions that run before your route) stores things there, such as the logged-in user. You will see this in [Writing Custom Middleware](/courses/expressjs/writing-custom-middleware) and [Template Engines](/courses/expressjs/template-engines).

## Other response methods you will meet later

| Method | What it does | Lesson |
| --- | --- | --- |
| `res.redirect()` | Sends the client to another URL | [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects) |
| `res.sendFile()` / `res.download()` | Sends a file from disk | [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects) |
| `res.cookie()` / `res.clearCookie()` | Sets or removes a cookie | [Cookies with cookie-parser](/courses/expressjs/cookies-and-cookie-parser) |
| `res.render()` | Builds HTML from a template | [Template Engines](/courses/expressjs/template-engines) |

## Common mistakes

**Forgetting to respond.** Every code path in a handler must send something. Check your `if/else` branches.

**Responding twice.** Use `return` with early responses so the rest of the function does not run.

**Setting the status after sending.** `res.json(data).status(201)` does not work. The status must come first: `res.status(201).json(data)`.

**Using removed Express 4 forms.** `res.send(404)`, `res.json(obj, 201)` and `res.send(body, 201)` are gone. Always use `res.status(code)` first.

## Key takeaways

- `res` is how you answer a request: status code, headers and body.
- `res.send()` handles text, HTML, objects and buffers. `res.json()` is the clear choice for APIs.
- Set the status with `res.status(code)` before sending. It accepts integers from 100 to 999 only.
- `res.sendStatus()` and `res.end()` cover responses with little or no body.
- Every request gets exactly one response. Use `return` to avoid sending two.
- `res.locals` holds data for the current request only.

## Practice

1. Create `GET /api/time` that returns `{ "now": "<current ISO date>" }` with `res.json()`. Check the headers with `curl -i`.
2. Create `POST /api/things` that responds with status `201` and a JSON body. Then create `DELETE /api/things/:id` that responds with `204` and no body.
3. Write a route with an `if` check that responds twice on purpose. Read the error in your terminal, then fix it with an early `return`.
4. Use `res.format()` to make `GET /about` return HTML for browsers and JSON for `curl -H "Accept: application/json"`.

## What's next

You know the basic response tools. Now let's send richer things back in [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects).

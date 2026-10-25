---
publishDate: 2026-10-25T09:19
title: 'Built-in Body Parsers: express.json and urlencoded'
slug: built-in-body-parsers
metadescription: Learn how Express 5 reads request bodies with express.json, express.urlencoded, express.text and express.raw, and how to handle Content-Type, size limits and bad JSON.
updateDate: 2026-10-25T09:19
author: ['bishal-biswas']
level: 2
tags: ['express', 'middleware', 'json', 'forms']
course: expressjs
---

## What you will learn

- What a **request body** is and why Express does not read it automatically
- How `express.json()` turns JSON into `req.body`, and why the `Content-Type` header matters
- How `express.urlencoded()` reads HTML form data, and what `extended` means
- When to use `express.text()` and `express.raw()`, for example for webhooks
- How to handle bad JSON, oversized bodies and an `undefined` body safely

## What is a request body?

A `GET` request usually carries all its information in the URL. But when a client wants to **send** data, like a new blog post, a sign-up form or a file, it puts that data in the **body** of the request. Bodies are mostly used with `POST`, `PUT` and `PATCH`.

Here is a raw HTTP request with a JSON body:

```http
POST /api/notes HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 38

{"title":"Shopping","text":"Buy milk"}
```

The headers come first, then an empty line, then the body. The **`Content-Type`** header is a label that says what format the body is in.

## Why Express does not read bodies by itself

The body does not arrive all at once. It flows in as a **stream**: a sequence of small chunks of raw bytes that arrive over time. Someone has to collect the chunks, join them, and decode them into something useful.

Express leaves that job to opt-in middleware for three good reasons:

1. **Format.** Only the `Content-Type` says how to decode the bytes. JSON, form data, plain text and images all need different handling.
2. **Cost.** Reading a body takes memory and time. Many routes, like `GET /products`, never need it.
3. **Safety.** Someone could send a 2 GB body. A parser needs limits, and you should choose them.

**Think of a parcel at a post office.** It arrives in pieces, with a label on the box. The body parser is the clerk who collects the pieces, reads the label, unpacks the contents into a form you can use (`req.body`), and refuses parcels that are too heavy.

Until a parser runs, `req.body` is `undefined` in Express 5.

## The four built-in parsers

Express 5 ships with four body parsers. Each one handles a different `Content-Type`.

| Parser | Handles `Content-Type` | `req.body` becomes | Typical use |
| --- | --- | --- | --- |
| `express.json()` | `application/json` | Object or array | APIs, `fetch()` from a frontend |
| `express.urlencoded()` | `application/x-www-form-urlencoded` | Object of strings | Classic HTML forms |
| `express.text()` | `text/plain` | String | Plain text payloads |
| `express.raw()` | `application/octet-stream` | `Buffer` (raw bytes) | Webhooks, binary data |

All four are factories, just like the ones you wrote in [Writing Custom Middleware](/courses/expressjs/writing-custom-middleware). You call them to get the real middleware: `express.json()`, with brackets.

## `express.json()`: reading JSON

This is the parser you will use most. Add it near the top of your app, before your routes.

```js
// app.js
import express from 'express';

const app = express();

app.use(express.json()); // parse JSON bodies for every route below

const notes = [];

app.post('/api/notes', (req, res) => {
  const note = { id: notes.length + 1, title: req.body.title, text: req.body.text };
  notes.push(note);
  res.status(201).json(note);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

```bash
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Shopping","text":"Buy milk"}'
# {"id":1,"title":"Shopping","text":"Buy milk"}
```

> **Note:** On Windows PowerShell, quoting JSON for `curl` is awkward. You can save the JSON in a file `note.json` and send it with `curl ... -d "@note.json"`, or use an API client such as the REST Client extension in your editor.

Here is what the parser does for each request:

```text
 POST /api/notes   Content-Type: application/json
      |
      v
 +-----------------------------------------------------------+
 | express.json()                                            |
 |   Is Content-Type application/json?                       |
 |     no  -> leave req.body undefined, next()               |
 |     yes -> collect chunks (max 100kb)                     |
 |            too big?        -> next(err) 413               |
 |            JSON.parse ok?  -> req.body = { ... }, next()  |
 |            parse failed?   -> next(err) 400               |
 +-----------------------------------------------------------+
      |
      v
 +-----------------------------------------------------------+
 | POST /api/notes handler                                   |
 |   reads req.body.title, req.body.text                     |
 +-----------------------------------------------------------+
```

### The `Content-Type` header must match

The parser only works when the `Content-Type` header says JSON. If the header is missing or different, the parser **skips** the request and `req.body` stays `undefined`.

Try sending JSON without the header:

```bash
curl -X POST http://localhost:3000/api/notes -d '{"title":"Oops"}'
```

`curl -d` labels data as `application/x-www-form-urlencoded` by default, so `express.json()` ignores it. `req.body` is `undefined`, and `req.body.title` throws a `TypeError`. The client gets a `500` error.

From the browser, set the header in `fetch()`:

```js
// browser code (for example public/app.js)
const response = await fetch('/api/notes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Shopping', text: 'Buy milk' }),
});
const note = await response.json();
```

> **Common mistake:** Forgetting `'Content-Type': 'application/json'` in `fetch()`, or forgetting `JSON.stringify()`. Both lead to an empty `req.body` on the server. If `req.body` is unexpectedly `undefined`, check the request's headers first, in the browser's Network tab.

### Being safe when `req.body` might be undefined

In Express 5, `req.body` is `undefined` whenever no parser handled the request. Destructuring it then crashes:

```js
const { title } = req.body; // TypeError if req.body is undefined
```

Two simple guards:

```js
const { title, text } = req.body ?? {};   // default to an empty object
const title2 = req.body?.title;           // optional chaining
```

Even with a guard, `title` could still be missing, empty or the wrong type. The client controls the body, so never trust it. You will learn to check it properly in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod).

## `express.json()` options

You can pass an options object to change how the parser behaves.

| Option | Default | What it does |
| --- | --- | --- |
| `limit` | `'100kb'` | Largest body allowed. Strings like `'1mb'` or a number of bytes. |
| `strict` | `true` | Only accept objects and arrays at the top level, not `"text"` or `42`. |
| `type` | `'application/json'` | Which `Content-Type` values to parse. |
| `reviver` | none | A function passed to `JSON.parse` to transform values. |
| `inflate` | `true` | Accept compressed (gzip, deflate) bodies. |

Most apps only change `limit`:

```js
app.use(express.json({ limit: '1mb' }));
```

Keep limits as small as your app allows. A small limit protects your server from clients that send huge bodies to use up its memory. You will dig deeper in [Input Sanitisation and Payload Limits](/courses/expressjs/input-sanitisation-and-payload-limits).

The `type` option is useful when a service sends JSON with an unusual content type, like `application/vnd.api+json`:

```js
app.use(express.json({ type: ['application/json', 'application/vnd.api+json'] }));
```

## When the JSON is broken

What if a client sends invalid JSON, like a missing quote?

```bash
curl -i -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title": Shopping}'
```

`express.json()` cannot parse it, so it calls `next(err)` with an error that has `status` 400. Your route is skipped, and Express's built-in error handler replies:

```http
HTTP/1.1 400 Bad Request
Content-Type: text/html; charset=utf-8
```

In development the body is an HTML page with the `SyntaxError` and a stack trace. That is not friendly for an API client that expects JSON.

The fix is an **error-handling middleware**: a middleware with **four** arguments, `(err, req, res, next)`, placed after all your routes. Body parser errors carry a `type` property that tells you what went wrong. Here is a small preview; the full story is in [Error-Handling Middleware](/courses/expressjs/error-handling-middleware).

```js
// app.js (after all routes)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  next(err); // not a body error: let Express handle it
});
```

| `err.type` | `err.status` | Cause |
| --- | --- | --- |
| `'entity.parse.failed'` | `400` | The body is not valid JSON |
| `'entity.too.large'` | `413` | The body is bigger than `limit` |
| `'encoding.unsupported'` | `415` | Unknown character set or compression |

## `express.urlencoded()`: reading HTML forms

When a plain HTML form is submitted, the browser does not send JSON. It sends **URL-encoded** data: the same `key=value&key=value` format you saw in query strings, but inside the body. The `Content-Type` is `application/x-www-form-urlencoded`.

Let's build a sign-up form.

```html
<!-- public/signup.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sign up</title>
  </head>
  <body>
    <form method="POST" action="/signup">
      <label>Name <input name="name" /></label>
      <label>Email <input name="email" type="email" /></label>
      <label><input type="checkbox" name="topics" value="news" /> News</label>
      <label><input type="checkbox" name="topics" value="offers" /> Offers</label>
      <button type="submit">Sign up</button>
    </form>
  </body>
</html>
```

```js
// app.js
import express from 'express';
import path from 'node:path';

const app = express();

app.use(express.static(path.join(import.meta.dirname, 'public')));
app.use(express.urlencoded()); // parse HTML form bodies

app.post('/signup', (req, res) => {
  console.log(req.body);
  res.send(`<p>Thanks, ${req.body.name}!</p>`);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Open `http://localhost:3000/signup.html`, fill in the form, tick both boxes and submit. The browser sends:

```http
POST /signup HTTP/1.1
Content-Type: application/x-www-form-urlencoded

name=Asha&email=asha%40example.com&topics=news&topics=offers
```

And your terminal shows:

```text
{ name: 'Asha', email: 'asha@example.com', topics: [ 'news', 'offers' ] }
```

Notice that the parser **decoded** `%40` back into `@`, and that the repeated `topics` field became an array. All values are strings, just like in `req.query`.

> **Warning:** The example above puts `req.body.name` straight into HTML. If someone types `<script>` as their name, it would run in the page. This is a security hole called **XSS** (cross-site scripting). Template engines escape values for you, as you will see in [Template Engines](/courses/expressjs/template-engines), and [Preventing Injection, XSS and CSRF](/courses/expressjs/preventing-injection-xss-csrf) covers it fully.

> **Tip:** In a real app, redirect after a successful form post instead of sending HTML, using `res.redirect(303, '/thanks')`. This stops the browser from re-submitting the form on refresh. See [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects).

### The `extended` option

`express.urlencoded()` has an option called `extended` that decides how field names with brackets are handled. In Express 5 it defaults to `false`.

| Form data | `extended: false` (default) | `extended: true` |
| --- | --- | --- |
| `name=Asha` | `{ name: 'Asha' }` | `{ name: 'Asha' }` |
| `tag=a&tag=b` | `{ tag: ['a', 'b'] }` | `{ tag: ['a', 'b'] }` |
| `user[name]=Asha` | `{ 'user[name]': 'Asha' }` | `{ user: { name: 'Asha' } }` |

With `false`, Express uses Node's simple built-in parser, and bracket names stay as plain text. With `true`, it uses the `qs` library, which builds **nested objects** from bracket names.

```js
app.use(express.urlencoded({ extended: true })); // only if your forms use user[name]-style fields
```

Stick with the default unless your forms really need nested data. Flat data is easier to validate and harder to abuse.

Other useful options are `limit` (default `'100kb'`) and `parameterLimit` (default `1000`), the maximum number of fields allowed.

### What about file uploads?

Forms that upload files use a different format, `multipart/form-data`. None of the built-in parsers read it. For that you will use the `multer` package in [File Uploads with Multer](/courses/expressjs/file-uploads-with-multer).

## `express.text()` and `express.raw()`

These two are less common, but useful to know.

**`express.text()`** reads a `text/plain` body into a **string**.

```js
app.post('/api/echo', express.text(), (req, res) => {
  res.type('text').send(`You said: ${req.body}`);
});
```

```bash
curl -X POST http://localhost:3000/api/echo -H "Content-Type: text/plain" -d "hello there"
# You said: hello there
```

**`express.raw()`** reads the body into a **`Buffer`**: the exact bytes, with no decoding at all. Its default `type` is `application/octet-stream`, which means "some binary data".

The most common real use is **webhooks**. A **webhook** is a request another service (like a payment provider) sends to your server when something happens. These services sign each request so you can check it really came from them. To check the signature, you need the body **exactly** as it arrived, byte for byte. If `express.json()` has already parsed and changed it, the check fails.

So you use `express.raw()` on that one route, and parse the JSON yourself after verifying:

```js
// app.js
import express from 'express';

const app = express();

// Webhook route FIRST, with its own raw parser
app.post('/webhooks/payments', express.raw({ type: 'application/json' }), (req, res) => {
  console.log(Buffer.isBuffer(req.body)); // true
  // 1. verify the signature using req.body (the exact bytes) and a secret
  // 2. only then turn it into an object:
  const event = JSON.parse(req.body.toString('utf8'));
  console.log('Payment event:', event.type);
  res.sendStatus(200);
});

// JSON parser for everything else
app.use(express.json());

app.post('/api/notes', (req, res) => {
  res.status(201).json(req.body);
});
```

Why is the webhook route **above** `app.use(express.json())`? Remember that the stack runs in order. A body can only be read once. If `express.json()` ran first, it would consume the body, and `express.raw()` would have nothing left to read.

```text
 POST /webhooks/payments                 POST /api/notes
        |                                       |
        v                                       v
 [POST /webhooks/payments]               [POST /webhooks/payments] -> path differs, skipped
   express.raw() -> req.body = Buffer           |
   handler -> 200, stop                         v
                                         [express.json()] -> req.body = { ... }
                                                |
                                                v
                                         [POST /api/notes] -> 201
```

## Global or per route?

You can register parsers for the whole app or only for routes that need them.

```js
// Global: every route below gets parsed JSON bodies
app.use(express.json());

// Per route: only this route parses JSON
app.post('/api/feedback', express.json({ limit: '10kb' }), (req, res) => {
  res.status(201).json({ received: req.body });
});
```

| Approach | Pros | Cons |
| --- | --- | --- |
| Global `app.use(express.json())` | Simple. Every route just works. | Same limit everywhere. |
| Per route | Each route gets exactly the parser and limit it needs. | More to write. Easy to forget one. |

A common, sensible setup for an API is a global `express.json()` with a modest limit, plus special per-route parsers (like `express.raw()` for webhooks) registered before it.

> **Note:** Before Express 4.16, these parsers lived in a separate package called `body-parser`, and old tutorials still show `app.use(bodyParser.json())`. `express.json()` is the same parser, built in. You do not need to install `body-parser`.

## Common mistakes

**No parser at all.** `req.body` is `undefined`. Add `app.use(express.json())` or `app.use(express.urlencoded())` above your routes.

**Parser registered after the routes.** The routes run first and see no body. Order matters.

**Wrong `Content-Type`.** `express.json()` ignores bodies not labelled `application/json`. Check the header in `curl` or `fetch()`.

**Writing `express.json` without brackets.** `app.use(express.json)` passes the factory, not the middleware. Write `express.json()`.

**Expecting files in `req.body`.** File uploads use `multipart/form-data`, which needs `multer`.

**Trusting the body.** Every field can be missing, the wrong type or malicious. Always validate before you use it.

## Key takeaways

- The request body is a stream of bytes. Express only reads it when you add a body parser.
- `express.json()` parses `application/json` into `req.body`. `express.urlencoded()` parses HTML form data.
- Parsers only act when the `Content-Type` matches. Otherwise `req.body` stays `undefined` in Express 5.
- The default size limit is `100kb`. Bad JSON becomes a `400` error, and oversized bodies a `413`.
- `express.urlencoded()` defaults to `extended: false` in Express 5, so `user[name]` is not turned into a nested object.
- Use `express.raw()` on webhook routes, registered before your global JSON parser, when you need the exact bytes.

## Practice

1. Build the notes API. Send one request with the correct `Content-Type` and one without. Log `req.body` and compare.
2. Send broken JSON and look at the default error page. Then add the error-handling middleware from this lesson and confirm you get a JSON error instead.
3. Set `express.json({ limit: '1kb' })` and send a body bigger than 1 KB. Which status code do you get?
4. Build the sign-up form. Add a field named `address[city]`. Compare `req.body` with `extended: false` and `extended: true`.

## What's next

Your `app.js` is getting long. Next, learn to split routes into separate files in [express.Router and Modular Routes](/courses/expressjs/express-router-and-modular-routes).

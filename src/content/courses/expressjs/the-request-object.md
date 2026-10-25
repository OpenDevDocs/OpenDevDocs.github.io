---
publishDate: 2026-10-25T09:11
title: The Request Object
slug: the-request-object
metadescription: Learn what the Express req object holds, from the URL, params and query to headers, IP address and body, and how to read each piece safely in Express 5.
updateDate: 2026-10-25T09:11
author: ['bishal-biswas']
level: 1
tags: ['express', 'nodejs', 'request', 'http']
course: expressjs
---

## What you will learn

- What the **request object** (`req`) is and where it comes from
- How to read the method, URL, path, params and query string
- How to read **headers**, the client's IP address and the host name
- Why `req.body` is `undefined` until you add a body parser
- Handy helpers like `req.get()`, `req.is()` and `req.accepts()`

You have already used `req.params` and `req.query` in the routing lessons. This lesson gives you the full tour.

## What is the request object?

Every time a client sends a request, Express builds a JavaScript object that describes it. That object is passed to your handler as the first argument. By convention it is called `req`.

**Think of it like an envelope arriving at a post office.** The envelope has an address (the URL), a stamp that says how it was sent (the method), notes written on the outside (the headers), and maybe a letter inside (the body). `req` lets you read all of it.

```js
app.get('/hello', (req, res) => {
  // req = everything the client sent
  // res = the tool you use to answer
  res.send('Hi!');
});
```

> **Note:** `req` is Node's own `http.IncomingMessage` object with extra Express properties and methods added on top. That is why some properties (like `req.headers`) come from Node and others (like `req.query`) come from Express.

## A quick tour: logging a request

The fastest way to learn `req` is to print it. Create this file and run it.

```js
// app.js
import express from 'express';

const app = express();

app.get('/products/:id', (req, res) => {
  res.json({
    method: req.method,
    url: req.url,
    path: req.path,
    params: req.params,
    query: req.query,
    hostname: req.hostname,
    ip: req.ip,
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Now send a request with `curl`:

```bash
curl "http://localhost:3000/products/42?color=red&size=m"
```

You should see something like this (formatted for reading):

```text
{
  "method": "GET",
  "url": "/products/42?color=red&size=m",
  "path": "/products/42",
  "params": { "id": "42" },
  "query": { "color": "red", "size": "m" },
  "hostname": "localhost",
  "ip": "::1"
}
```

Let's walk through each part.

## The method

`req.method` is the **HTTP method** (the verb) as an uppercase string: `'GET'`, `'POST'`, `'PUT'`, `'PATCH'` or `'DELETE'`.

When you use `app.get()` or `app.post()`, Express already checked the method for you. You mostly use `req.method` in code that runs for *every* request, like a logger.

```js
console.log(`${req.method} ${req.url}`); // GET /products/42?color=red&size=m
```

## The URL, path and original URL

Express gives you a few slightly different views of the URL. It is easy to mix them up, so here they are side by side for the request above.

| Property | Value | What it is |
| --- | --- | --- |
| `req.url` | `/products/42?color=red&size=m` | Path plus query string |
| `req.originalUrl` | `/products/42?color=red&size=m` | The URL exactly as the client sent it |
| `req.path` | `/products/42` | Only the path, no query string |
| `req.baseUrl` | `''` (empty) | The prefix a router is mounted on |

Right now `req.url` and `req.originalUrl` look identical. They start to differ when you split routes into routers mounted on a prefix such as `/api`. You will see that in [express.Router and Modular Routes](/courses/expressjs/express-router-and-modular-routes).

> **Tip:** When you log requests, use `req.originalUrl`. It always shows the full URL the client asked for, even inside a router.

## Route parameters: `req.params`

**Route parameters** are the named parts of a path, like `:id`. Express puts their values in `req.params`.

```js
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.send(`Post ${postId} by user ${userId}`);
});
```

```bash
curl http://localhost:3000/users/7/posts/99
# Post 99 by user 7
```

Remember two things from the routing lessons:

1. Params are always **strings**. `req.params.id` is `'42'`, not `42`. Convert it with `Number()` when you need a number.
2. A named wildcard such as `'/files/*filepath'` gives you an **array** of path segments in `req.params.filepath`.

```js
app.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).send('id must be a whole number');
  }

  res.send(`Product number ${id}`);
});
```

> **Note:** Express 4 had a `req.param('name')` method that looked in params, body and query all at once. It was removed in Express 5. Read from `req.params`, `req.query` or `req.body` directly, so you always know where a value came from.

## The query string: `req.query`

The **query string** is the part of the URL after `?`. Express parses it into `req.query`.

```bash
curl "http://localhost:3000/search?q=shoes&tag=sale&tag=new"
```

```js
app.get('/search', (req, res) => {
  console.log(req.query);
  // { q: 'shoes', tag: [ 'sale', 'new' ] }
  res.json(req.query);
});
```

Values are strings, and a repeated key becomes an array of strings. A missing key is simply `undefined`, so give it a default:

```js
const page = Number(req.query.page ?? 1);
```

In Express 5, `req.query` is a **read-only getter**. A **getter** is a property that is calculated when you read it, instead of being stored. You cannot replace `req.query` with a new object. Copy the values you need into your own variables instead.

```js
// Wrong in Express 5: this throws a TypeError
// req.query = { page: 1 };

// Right: build your own object
const filters = {
  page: Number(req.query.page ?? 1),
  q: req.query.q ?? '',
};
```

The query parser itself was covered in [Query Strings and the Query Parser](/courses/expressjs/query-strings-and-query-parser).

## Headers: `req.headers` and `req.get()`

**Headers** are extra pieces of information the client sends with every request, written as `Name: value` pairs. For example, which browser it is, what format it wants back, or a login token.

Node stores them in `req.headers`. All header names are **lowercase** there.

```js
app.get('/whoami', (req, res) => {
  console.log(req.headers);
  res.send('Check your terminal');
});
```

```text
{
  host: 'localhost:3000',
  'user-agent': 'curl/8.7.1',
  accept: '*/*'
}
```

The easier way is `req.get()`. It is **case-insensitive**, so you do not have to remember the lowercase rule.

```js
app.get('/whoami', (req, res) => {
  const agent = req.get('User-Agent');
  const auth = req.get('Authorization'); // undefined if not sent
  res.json({ agent, hasAuth: Boolean(auth) });
});
```

Send your own header with `curl -H`:

```bash
curl -H "Authorization: Bearer abc123" http://localhost:3000/whoami
# {"agent":"curl/8.7.1","hasAuth":true}
```

> **Tip:** `req.header('X-Name')` is an alias for `req.get('X-Name')`. Pick one and stick to it. This course uses `req.get()`.

## Who is asking? IP, host and protocol

These properties tell you about the connection itself.

| Property | Example value | Meaning |
| --- | --- | --- |
| `req.ip` | `'::1'` | The client's IP address |
| `req.ips` | `[]` | List of IPs from proxy headers (only with `trust proxy`) |
| `req.hostname` | `'localhost'` | Host name, without the port |
| `req.host` | `'localhost:3000'` | Host name, **with** the port (Express 5) |
| `req.protocol` | `'http'` | `'http'` or `'https'` |
| `req.secure` | `false` | `true` when the protocol is `https` |
| `req.subdomains` | `[]` | For `api.shop.example.com`, this is `['api']` |

On your own machine, `req.ip` is often `::1` or `::ffff:127.0.0.1`. Both mean "this computer" (`localhost`), written in the IPv6 format.

> **Note:** In production your app usually sits behind a **reverse proxy**, a server like Nginx that receives traffic first and passes it on. Then `req.ip` shows the proxy's address, not the real visitor's. The fix is `app.set('trust proxy', 1)`, explained in [Reverse Proxies and Trusting Proxy Headers](/courses/expressjs/reverse-proxies-and-trust-proxy).

## The body: `req.body`

The **body** is the data sent inside a `POST`, `PUT` or `PATCH` request, such as a JSON object or form fields.

Here is the surprise for many beginners. This code does not work yet:

```js
// app.js (body is not parsed yet)
app.post('/notes', (req, res) => {
  console.log(req.body); // undefined
  res.send('ok');
});
```

The body arrives as a stream of raw bytes. Express does not read it unless you ask. Until then, `req.body` is `undefined` in Express 5.

One line fixes it for JSON:

```js
// app.js
app.use(express.json()); // read JSON bodies into req.body

app.post('/notes', (req, res) => {
  console.log(req.body); // { title: 'Shopping', text: 'Milk' }
  res.status(201).json(req.body);
});
```

```bash
curl -X POST http://localhost:3000/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Shopping","text":"Milk"}'
```

`app.use()` adds **middleware**, a function that runs before your routes. You will learn exactly how that works in [How the Middleware Stack Works](/courses/expressjs/how-middleware-works), and all the body parsers in [Built-in Body Parsers](/courses/expressjs/built-in-body-parsers).

> **Common mistake:** Writing `const { title } = req.body;` without a body parser. In Express 5 this throws `Cannot destructure property 'title' of 'req.body' as it is undefined`. Add the parser, or write `const { title } = req.body ?? {};` to be safe.

## Content helpers: `req.is()` and `req.accepts()`

Two small helpers answer common questions.

**`req.is(type)`** checks what the client *sent*. It looks at the `Content-Type` header.

```js
app.post('/upload', (req, res) => {
  if (!req.is('application/json')) {
    return res.status(415).send('Please send JSON');
  }
  res.send('Thanks for the JSON');
});
```

It returns the matching type (a truthy string), `false` if it does not match, or `null` if there is no body.

**`req.accepts(types)`** checks what the client *wants back*. It reads the `Accept` header and returns the best match, or `false`.

```js
app.get('/greeting', (req, res) => {
  const best = req.accepts(['html', 'json']);

  if (best === 'json') {
    return res.json({ message: 'Hello' });
  }
  res.send('<h1>Hello</h1>');
});
```

```bash
curl -H "Accept: application/json" http://localhost:3000/greeting
# {"message":"Hello"}
```

Related helpers use plural names in Express 5: `req.acceptsLanguages()`, `req.acceptsCharsets()` and `req.acceptsEncodings()`. The old singular names were removed.

```js
const lang = req.acceptsLanguages('en', 'fr', 'de') || 'en';
```

## Other properties you will meet later

You do not need these yet, but it helps to know they exist.

| Property | Filled in by | Lesson |
| --- | --- | --- |
| `req.cookies` | `cookie-parser` | [Cookies with cookie-parser](/courses/expressjs/cookies-and-cookie-parser) |
| `req.session` | `express-session` | [Sessions with express-session](/courses/expressjs/sessions-with-express-session) |
| `req.file` | `multer` | [File Uploads with Multer](/courses/expressjs/file-uploads-with-multer) |
| `req.user` | Your auth code or Passport | [JWT Authentication](/courses/expressjs/jwt-authentication) |

Notice the pattern: Express starts `req` small, and **middleware adds properties** to it as the request moves along. You will write your own middleware that does this soon.

## Common mistakes

**Treating params and query values as numbers.** They are strings. `'10' > '9'` is `false` because strings compare letter by letter. Convert with `Number()` first.

**Expecting a value in the wrong place.** Data in the URL path is in `req.params`. Data after `?` is in `req.query`. Data in a `POST` body is in `req.body`. Each has its own box.

**Reading headers with the wrong case.** `req.headers['Content-Type']` is `undefined` because Node stores names in lowercase. Use `req.get('Content-Type')`.

**Trusting what the client sends.** Everything in `req` comes from the outside world and can be faked. Always check it before you use it. You will learn proper validation in [Request Validation with Zod](/courses/expressjs/request-validation-with-zod).

## Key takeaways

- `req` describes the incoming request: method, URL, headers, connection details and body.
- Use `req.params` for path parts, `req.query` for the query string, and `req.body` for the body. All values from the URL are strings.
- `req.query` is a read-only getter in Express 5. Copy values out instead of changing it.
- Read headers with `req.get()`, which ignores upper and lower case.
- `req.body` is `undefined` until a body parser such as `express.json()` runs.
- Middleware can add new properties to `req`, like `req.cookies` or `req.user`.

## Practice

1. Build a `GET /debug` route that returns `req.method`, `req.originalUrl`, `req.query` and the `User-Agent` header as JSON. Call it from your browser and from `curl` and compare the results.
2. Create `GET /add/:a/:b` that returns the sum of the two numbers. Make sure `/add/2/3` returns `5`, not `23`.
3. Write `GET /hello` that answers in French when `Accept-Language` prefers `fr`, and in English otherwise. Test it with `curl -H "Accept-Language: fr"`.
4. Add `app.use(express.json())` and a `POST /echo` route that sends `req.body` back. Then remove the parser line and see what happens.

## What's next

You can now read everything a client sends. Next, learn the other half of the conversation in [The Response Object](/courses/expressjs/the-response-object).

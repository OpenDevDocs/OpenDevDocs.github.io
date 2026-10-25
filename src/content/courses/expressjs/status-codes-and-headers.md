---
publishDate: 2026-10-25T09:14
title: Status Codes and Response Headers
slug: status-codes-and-headers
metadescription: Learn which HTTP status codes to send and when, and how to read and set response headers in Express 5 with res.status, res.set, res.append and res.type.
updateDate: 2026-10-25T09:14
author: ['bishal-biswas']
level: 1
tags: ['express', 'http', 'status-codes', 'headers']
course: expressjs
---

## What you will learn

- What the five families of **HTTP status codes** mean
- The dozen or so status codes you will use almost every day
- How to set a status code safely in Express 5
- How to set, add, read and remove **response headers**
- Which headers Express adds for you, and how to inspect them

## Why status codes matter

Imagine you post a letter and get a reply. Before reading the letter, you glance at a coloured sticker on the envelope: green means "all good", yellow means "go somewhere else", red means "you made a mistake", black means "we had a problem". That sticker is the **status code**.

A **status code** is a three-digit number at the very start of every HTTP response. Programs read it before anything else. A frontend app checks it to decide whether to show data or an error. Search engines use it to decide whether a page still exists. Monitoring tools count `500`s to know when your server is in trouble.

Sending the right code is part of being a good API. Sending `200 OK` with `{ "error": "not found" }` in the body confuses every tool that talks to you.

## The five families

The first digit tells you the family:

| Range | Family | Meaning in plain words |
| --- | --- | --- |
| `1xx` | Informational | "Hold on, still working." Rare in Express apps. |
| `2xx` | Success | "It worked." |
| `3xx` | Redirection | "Look somewhere else." |
| `4xx` | Client error | "You (the client) sent something wrong." |
| `5xx` | Server error | "We (the server) broke." |

A good rule: **4xx means the client should change the request; 5xx means the client can try again later but the fix is on your side.**

## The codes you will actually use

You do not need to memorise all of them. These cover most real apps.

### Success (2xx)

| Code | Name | Use it when |
| --- | --- | --- |
| `200` | OK | A normal successful response. The default in Express. |
| `201` | Created | A `POST` created something new. |
| `204` | No Content | Success with nothing to send back, often after `DELETE`. |

### Redirection (3xx)

| Code | Name | Use it when |
| --- | --- | --- |
| `301` | Moved Permanently | A URL moved forever. |
| `302` | Found | A temporary redirect. The `res.redirect()` default. |
| `304` | Not Modified | The client's cached copy is still fresh. Express sends this for you. |

You met these in [Sending JSON, Files and Redirects](/courses/expressjs/sending-json-files-and-redirects).

### Client errors (4xx)

| Code | Name | Use it when |
| --- | --- | --- |
| `400` | Bad Request | The request is broken or invalid, like malformed JSON or a missing field. |
| `401` | Unauthorized | The client is not logged in, or the login token is invalid. |
| `403` | Forbidden | The client is logged in, but not allowed to do this. |
| `404` | Not Found | The resource does not exist. |
| `405` | Method Not Allowed | The URL exists, but not for this method. |
| `409` | Conflict | The request clashes with current data, like an email already taken. |
| `413` | Content Too Large | The request body is too big. |
| `415` | Unsupported Media Type | The body is in a format you do not accept. |
| `422` | Unprocessable Content | The data is well formed but fails your rules. Some APIs use `400` for this instead. |
| `429` | Too Many Requests | The client is sending requests too fast. |

> **Note:** `401` vs `403` trips up everyone. Think of a club. `401` is "I don't know who you are, show me your ID". `403` is "I know who you are, and you are not on the list".

### Server errors (5xx)

| Code | Name | Use it when |
| --- | --- | --- |
| `500` | Internal Server Error | Something unexpected went wrong in your code. |
| `502` | Bad Gateway | A server your app depends on sent a bad answer. |
| `503` | Service Unavailable | The server is overloaded or down for maintenance. |

## Status codes Express sends for you

You do not always have to set the code yourself:

- A normal `res.send()` or `res.json()` uses **200**.
- When no route matches, Express sends **404** with `Cannot GET /path`.
- When your code throws an error, Express's built-in error handler sends **500**.
- `res.redirect()` sends **302**.
- When a browser's cached copy is still fresh, Express answers **304** with no body (more on this below).

## Setting the status code

You already know `res.status()`. Here it is in a small "users" API that uses several codes correctly.

```js
// app.js
import express from 'express';

const app = express();
app.use(express.json()); // read JSON bodies (explained in a later lesson)

const users = [{ id: 1, email: 'asha@example.com' }];

app.get('/api/users/:id', (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user); // 200
});

app.post('/api/users', (req, res) => {
  const email = req.body?.email;

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'email already registered' });
  }

  const user = { id: users.length + 1, email };
  users.push(user);
  res.status(201).json(user);
});

app.delete('/api/users/:id', (req, res) => {
  const index = users.findIndex((u) => u.id === Number(req.params.id));
  if (index === -1) {
    return res.sendStatus(404);
  }
  users.splice(index, 1);
  res.sendStatus(204);
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Listening on http://localhost:3000');
});
```

Try it and watch the first line of each response:

```bash
curl -i -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" -d '{"email":"ben@example.com"}'
# HTTP/1.1 201 Created

curl -i -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" -d '{"email":"ben@example.com"}'
# HTTP/1.1 409 Conflict

curl -i -X DELETE http://localhost:3000/api/users/1
# HTTP/1.1 204 No Content
```

### Express 5 is strict about status codes

In Express 5, `res.status()` only accepts **integers from 100 to 999**. Anything else throws an error right away:

```js
res.status('404');  // throws TypeError: Invalid status code (not an integer)
res.status(200.5);  // throws TypeError
res.status(1000);   // throws RangeError (outside 100-999)
```

This is good: in Express 4 these mistakes could slip through silently. But watch out when a code comes from a variable, for example from an error object or a config file. Make sure it is a real number.

```js
const code = Number(someValue);
const isValid = Number.isInteger(code) && code >= 100 && code <= 999;
res.status(isValid ? code : 500).json({ error: 'Something failed' });
```

> **Tip:** Node has a built-in list of status names. `http.STATUS_CODES[418]` returns `"I'm a Teapot"`. Import it with `import http from 'node:http';`. Handy for logging.

## What are response headers?

**Response headers** are `Name: value` lines sent before the body. They describe the response: what type of data it is, how long it is, whether it may be cached, and more. The browser reads them but does not show them on the page.

Use `curl -i` to see them:

```bash
curl -i http://localhost:3000/api/users/1
```

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 35
ETag: W/"23-..."
Date: Sun, 25 Oct 2026 09:14:00 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":1,"email":"asha@example.com"}
```

You can also see headers in the browser: open the developer tools (F12), go to the **Network** tab, click a request, and look at **Response Headers**.

### Headers Express and Node add for you

| Header | Added by | What it means |
| --- | --- | --- |
| `Content-Type` | Express (`res.send`, `res.json`) | The format of the body |
| `Content-Length` | Express | Size of the body in bytes |
| `ETag` | Express | A fingerprint of the body, for caching |
| `X-Powered-By` | Express | Says "Express". You may want to remove it. |
| `Date` | Node | When the response was created |
| `Connection`, `Keep-Alive` | Node | Lets the client reuse the connection |

## Setting headers

### `res.set()`: set one or many

`res.set(name, value)` sets a header. If the header already exists, it is **replaced**.

```js
app.get('/api/report', (req, res) => {
  res.set('Cache-Control', 'no-store');   // never cache this
  res.set('X-Report-Version', '3');       // your own custom header
  res.json({ total: 42 });
});
```

You can set several at once with an object:

```js
res.set({
  'Cache-Control': 'public, max-age=3600', // cache for one hour
  'Content-Language': 'en',
});
```

Header names are **case-insensitive**, so `cache-control` and `Cache-Control` are the same header.

### `res.append()`: add without replacing

Some headers can appear more than once. `res.append()` adds a value instead of overwriting.

```js
res.append('Link', '</api/users?page=2>; rel="next"');
res.append('Link', '</api/users?page=9>; rel="last"');
// Link: </api/users?page=2>; rel="next", </api/users?page=9>; rel="last"
```

`Set-Cookie` is the most common header that appears many times. Express gives you `res.cookie()` for that, which you will use in [Cookies with cookie-parser](/courses/expressjs/cookies-and-cookie-parser).

### `res.type()`: the content type shortcut

`res.type()` sets `Content-Type` from a short name or file extension.

```js
res.type('json');  // application/json; charset=utf-8
res.type('html');  // text/html; charset=utf-8
res.type('.png');  // image/png
res.type('text');  // text/plain; charset=utf-8
```

This is useful when `res.send()` would guess wrong. For example, sending a string of plain text would otherwise be labelled as HTML:

```js
app.get('/robots.txt', (req, res) => {
  res.type('text').send('User-agent: *\nDisallow: /admin');
});
```

### Reading and removing headers

```js
res.set('X-Trace', 'abc');
res.get('X-Trace');          // 'abc'
res.removeHeader('X-Trace'); // gone (this one comes from Node)
```

### Removing `X-Powered-By`

The `X-Powered-By: Express` header tells everyone which framework you use. It does no harm by itself, but there is no reason to advertise it. Turn it off with an Express setting:

```js
const app = express();
app.disable('x-powered-by');
```

Later, [Security Headers with Helmet](/courses/expressjs/security-headers-with-helmet) shows how one package removes this header and adds many protective ones.

## Timing: headers go first

HTTP sends the status line and headers **before** the body. Once Express starts sending the body, the headers are locked. Any change after that throws `ERR_HTTP_HEADERS_SENT`.

```text
 Your code                          What goes over the wire
 ---------                          -----------------------
 res.status(201)        ---+
 res.set('X-Id', '7')   ---+--->   HTTP/1.1 201 Created
                                   X-Id: 7
                                   Content-Type: application/json
 res.json({ id: 7 })    ------>    {"id":7}        (response finished)
 res.set('X-Late', '1') ------>    ERROR: headers already sent
```

So always: **status, then headers, then body**.

## ETag and 304: free caching

Remember the `ETag` header? It is a fingerprint of the body. When a browser asks for the same URL again, it sends that fingerprint back in an `If-None-Match` header. If the body would be identical, Express skips sending it and answers `304 Not Modified` with an empty body. The browser then uses its cached copy.

```text
 1st request:  GET /api/users/1
               <- 200 OK, ETag: W/"23-abc", body: {...}

 2nd request:  GET /api/users/1, If-None-Match: W/"23-abc"
               <- 304 Not Modified, no body (use your copy)
```

This saves bandwidth with zero work from you. If you see `304` in the Network tab, nothing is broken. It is caching doing its job. You will learn to control caching yourself in [Caching with Redis and HTTP Cache Headers](/courses/expressjs/caching-with-redis).

## Common mistakes

**Always sending 200.** Returning `res.json({ error: 'Not found' })` sends `200 OK`. The client thinks it worked. Add `res.status(404)`.

**Mixing up 401 and 403.** Not logged in: `401`. Logged in but not allowed: `403`.

**Using 500 for bad input.** If the client sent bad data, that is a `4xx`. Save `5xx` for your own failures.

**Passing a string to `res.status()`.** Express 5 throws on `res.status('404')`. Use the number `404`.

**Setting headers after the body.** Set the status and headers first, then call `res.send()` or `res.json()` last.

## Key takeaways

- Status codes come in five families: 1xx info, 2xx success, 3xx redirect, 4xx client error, 5xx server error.
- Learn the everyday ones: `200`, `201`, `204`, `301`, `302`, `400`, `401`, `403`, `404`, `409`, `500`.
- In Express 5, `res.status()` throws unless you pass an integer from 100 to 999.
- Use `res.set()` to set or replace headers, `res.append()` to add, and `res.type()` for `Content-Type`.
- Headers must be set before the body is sent.
- Express adds `ETag` for you and answers `304` when the client's cache is still fresh.

## Practice

1. Run `curl -i` against three different routes in your app and write down every header you see. Which ones did your code set?
2. Add `app.disable('x-powered-by')` and confirm with `curl -i` that the header is gone.
3. Create `GET /api/teapot` that answers with status `418` and a JSON body. Then try `res.status('418')` and read the error.
4. Request the same JSON route twice in the browser with the Network tab open. Do you see a `304` on the second request? Find the `ETag` and `If-None-Match` headers.

## What's next

So far you have sent files one route at a time. Next, learn to serve a whole folder of images, CSS and JavaScript in [Serving Static Files with express.static](/courses/expressjs/serving-static-files).

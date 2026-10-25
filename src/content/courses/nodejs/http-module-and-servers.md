---
publishDate: 2026-10-25T10:30
title: The http Module and a Server from Scratch
slug: http-module-and-servers
metadescription: Build a web server with only Node's built-in http module. Learn requests, responses, status codes, headers, request bodies and ports.
updateDate: 2026-10-25T10:30
author: ['bishal-biswas']
level: 2
tags: ['http', 'server', 'web']
course: nodejs
---

## What is a web server?

Think of a restaurant. A customer (the **client**, usually a browser) gives an order to the waiter. The kitchen (the **server**) prepares it and the waiter brings back a plate.

On the web, the order is an **HTTP request** and the plate is an **HTTP response**. HTTP is simply the set of rules browsers and servers use to talk to each other.

Node ships with a module called `node:http` that lets you write the kitchen yourself, with no framework and nothing to install. Express, Fastify and every other Node framework are built on top of it, so learning it first makes them much less magical.

## Your first server

```javascript
// server.js
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.end('Hello from Node!');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
```

Run it:

```bash
node server.js
```

```text
Server running at http://localhost:3000
```

Open `http://localhost:3000` in your browser and you will see `Hello from Node!`.

Three things happened:

- `http.createServer()` made a server. You gave it a function called the **request handler**. Node calls it once for every request that arrives.
- `server.listen(3000)` started listening on **port** 3000. A port is like a door number on your computer. Different programs listen on different doors.
- `res.end()` sent the reply and told Node the response is finished.

Notice that the program does not exit. A listening server keeps Node's event loop busy, waiting for the next customer. Press `Ctrl+C` to stop it.

> **Tip:** Run `node --watch server.js` while you work. Node restarts the server every time you save the file, as you saw in [the Watch Mode lesson](/courses/nodejs/watch-mode).

## The request object (`req`)

The handler receives two objects. The first, `req`, describes what the client asked for.

```javascript
import http from 'node:http';

const server = http.createServer((req, res) => {
  console.log(req.method, req.url);
  console.log(req.headers['user-agent']);
  res.end('Check your terminal');
});

server.listen(3000);
```

Visit `http://localhost:3000/books?sort=title` with curl (`curl http://localhost:3000/books?sort=title`) and the terminal prints:

```text
GET /books?sort=title
curl/8.9.0
```

- `req.method` is the **HTTP method**: `GET` to read, `POST` to create, `PUT` or `PATCH` to update, `DELETE` to remove.
- `req.url` is the path plus any query string. It does not include the domain.
- `req.headers` is an object of **headers**, small labelled notes sent with the request. Node lowercases every header name, so use `req.headers['content-type']`, not `'Content-Type'`.

> **Note:** Your browser often makes a second request to `/favicon.ico` for the tab icon. If you see two log lines per visit, that is why.

Here is what a request looks like on the wire. It is just text:

```http
GET /books?sort=title HTTP/1.1
Host: localhost:3000
User-Agent: curl/8.9.0
Accept: */*
```

## The response object (`res`)

The second object, `res`, is how you answer. A response has three parts: a **status code**, some **headers** and a **body**.

```javascript
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.write('<h1>Welcome</h1>');
  res.write('<p>This page came from Node.</p>');
  res.end();
});

server.listen(3000);
```

- `res.statusCode` sets the status. It defaults to `200`.
- `res.setHeader(name, value)` adds a header. `Content-Type` tells the browser what kind of data the body is.
- `res.write()` sends a piece of the body. You can call it many times.
- `res.end()` finishes the response. You can also pass the last piece straight to it: `res.end('bye')`.

Ask curl to show the headers too with `-i`:

```bash
curl -i http://localhost:3000
```

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Date: Sun, 25 Oct 2026 11:06:54 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

<h1>Welcome</h1><p>This page came from Node.</p>
```

Node added the `Date`, `Connection` and `Transfer-Encoding` headers for you.

### Status codes you will use most

| Code | Meaning | When to send it |
| --- | --- | --- |
| 200 | OK | The request worked |
| 201 | Created | A `POST` created something new |
| 204 | No Content | It worked, and there is nothing to send back |
| 400 | Bad Request | The client sent something invalid |
| 404 | Not Found | Nothing lives at that URL |
| 500 | Internal Server Error | Your code crashed |

The first digit tells the story: 2xx means success, 4xx means the client made a mistake, 5xx means the server did.

### `writeHead()` does it in one line

`res.writeHead()` sets the status code and several headers at once. It is the usual way to send JSON:

```javascript
import http from 'node:http';

const server = http.createServer((req, res) => {
  const book = { id: 1, title: 'Dune', author: 'Frank Herbert' };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(book));
});

server.listen(3000);
```

```text
{"id":1,"title":"Dune","author":"Frank Herbert"}
```

`res.end()` only accepts a string or bytes, so you turn the object into JSON text with `JSON.stringify()` first.

> **Note:** Very old tutorials sometimes call `res.writeHeader()`. It was an undocumented alias and Node 26 removed it. Always use `writeHead()`.

## Reading the request body

When a client sends data, for example with a `POST`, the data arrives in the **body**. It may come in several pieces, because `req` is a **readable stream** (you met these in [the Streams lesson](/courses/nodejs/streams-fundamentals)). Each piece is a Buffer.

The simplest way to collect them all is a `for await` loop:

```javascript
// body.js
import http from 'node:http';

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk); // each chunk is a Buffer
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST') {
    const text = await readBody(req);
    res.end(`You sent ${text.length} characters: ${text}`);
  } else {
    res.end('Send me a POST request');
  }
});

server.listen(3000);
```

Test it from a second terminal:

```bash
curl -X POST -d "Hi Asha" http://localhost:3000
curl http://localhost:3000
```

```text
You sent 7 characters: Hi Asha
Send me a POST request
```

The handler is marked `async` so it can `await` the body. Node does not care what the handler returns, so this is fine.

## Handling server errors

The most common server error happens before any request arrives: the port is already taken, usually by an older copy of your server that is still running. Listen for the `error` event:

```javascript
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.end('ok');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port 3000 is already in use. Try another port.');
    process.exit(1);
  }
  throw err;
});

server.listen(3000);
```

```text
Port 3000 is already in use. Try another port.
```

Two more useful tricks:

- `server.listen(0)` asks the operating system for any free port. Read the chosen one with `server.address().port`. This is handy in tests.
- `server.close()` stops accepting new connections and lets the program exit once the current requests finish.

Hosting services often choose the port for you through an environment variable, so a common pattern is `server.listen(Number(process.env.PORT) || 3000)`.

## Common mistakes

### Forgetting `res.end()`

```javascript
const server = http.createServer((req, res) => {
  res.write('Hello');
  // no res.end(), so the browser keeps spinning
});
```

Without `res.end()` the client waits until it gives up. Every path through your handler must end the response exactly once.

### Setting headers after the body has gone

```javascript
const server = http.createServer((req, res) => {
  res.end('done');
  res.setHeader('X-Late', 'yes'); // throws
});
```

```text
ERR_HTTP_HEADERS_SENT Cannot set headers after they are sent to the client
```

Headers travel before the body. Set every header first, then write the body.

### Sending a number or an object

```javascript
res.end(42);           // throws ERR_INVALID_ARG_TYPE
res.end({ ok: true }); // throws too
```

The fix is to send text: `res.end(String(42))` or `res.end(JSON.stringify({ ok: true }))`.

## What about HTTPS?

Browsers expect **HTTPS**, the encrypted version of HTTP. Node has a `node:https` module with the same `createServer()` shape, plus a key and certificate. In practice most Node apps run plain `http` behind a reverse proxy or hosting platform that handles HTTPS for them, so plain `http` is what you will write most of the time.

## Quick recap

- `http.createServer(handler)` makes a server; `server.listen(port)` starts it.
- The handler runs once per request with `req` (what was asked) and `res` (your answer).
- `req.method`, `req.url` and `req.headers` describe the request. Header names are lowercase.
- A response is a status code, headers and a body. Use `writeHead()` then `end()`.
- `req` is a stream: collect the body with `for await` and `Buffer.concat()`.
- Always end every response once, set headers before the body, and send strings or Buffers.
- Handle `EADDRINUSE`, use port `0` for a random free port, and `server.close()` to stop.

<code id="code-content" class="language-javascript">
// server.mjs: a tiny web server that tests itself, then shuts down
import http from 'node:http';
// Read the whole request body (the request is a readable stream)
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
const server = http.createServer(async (req, res) =&gt; {
  console.log('Request:', req.method, req.url);
  if (req.method === 'GET' &amp;&amp; req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Hello from Node!');
  } else if (req.method === 'GET' &amp;&amp; req.url === '/book') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 1, title: 'Dune' }));
  } else if (req.method === 'POST' &amp;&amp; req.url === '/echo') {
    const text = await readBody(req);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`You sent: ${text}`);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});
server.on('error', (err) =&gt; console.error('Server error:', err.message));
// Port 0 asks the operating system for any free port
server.listen(0, async () =&gt; {
  const { port } = server.address();
  const base = `http://localhost:${port}`;
  console.log('Listening on', base);
  // ---
  // Act as our own client (fetch is built in, see the fetch lesson)
  const a = await fetch(`${base}/`);
  console.log(a.status, await a.text()); // 200 Hello from Node!
  const b = await fetch(`${base}/book`);
  console.log(b.status, await b.json()); // 200 { id: 1, title: 'Dune' }
  const c = await fetch(`${base}/echo`, { method: 'POST', body: 'Hi Asha' });
  console.log(c.status, await c.text()); // 200 You sent: Hi Asha
  const d = await fetch(`${base}/nope`);
  console.log(d.status, await d.text()); // 404 Not found
  // Stop accepting connections so the script can exit
  server.close(() =&gt; console.log('Server closed'));
});
</code></pre>

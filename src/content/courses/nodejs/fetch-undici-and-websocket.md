---
publishDate: 2026-10-25T10:45
title: Built-in fetch, Undici and the WebSocket Client
slug: fetch-undici-and-websocket
metadescription: Call web APIs from Node with the built-in fetch, handle errors and timeouts, learn what Undici is, and open a live connection with the WebSocket client.
updateDate: 2026-10-25T10:45
author: ['bishal-biswas']
level: 2
tags: ['fetch', 'http-client', 'websocket', 'undici']
course: nodejs
---

## Your server as a customer

So far your Node programs have been the kitchen, answering requests. Very often a program also needs to *place* orders: get the weather, charge a card, ask another service for data. Now Node is the customer, or the **HTTP client**.

Node has a global `fetch()` function for this, the same one browsers have. It has been built in since Node 18 and marked stable since Node 21, so there is nothing to install.

## A first GET request

```javascript
// get.mjs
const res = await fetch('https://jsonplaceholder.typicode.com/todos/1');

console.log(res.status, res.ok, res.headers.get('content-type'));
console.log(await res.json());
```

```text
200 true application/json; charset=utf-8
{ userId: 1, id: 1, title: 'delectus aut autem', completed: false }
```

JSONPlaceholder is a free fake API that is handy for practice.

`fetch()` returns a promise for a **Response** object. Getting the body is a second step, because the body may still be arriving:

- `res.status` is the status code, like `200` or `404`.
- `res.ok` is `true` for any 2xx status.
- `res.headers.get(name)` reads a response header.
- `await res.json()` reads the body and parses it as JSON. There is also `res.text()` for plain text and `res.arrayBuffer()` for raw bytes.

> **Note:** You can only read a body once. A second `res.text()` throws `TypeError: Body is unusable: Body has already been read`. Save the result in a variable if you need it twice.

## fetch does not throw on 404

This surprises nearly everyone. A `404` or `500` is still a valid HTTP reply, so `fetch` resolves normally:

```javascript
const res = await fetch('https://jsonplaceholder.typicode.com/todos/999999');
console.log(res.status, res.ok); // prints: 404 false
```

`fetch` only **rejects** (throws with `await`) when there is no reply at all. Always check `res.ok` yourself. A small helper keeps that tidy:

```javascript
async function getJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}
```

## Sending data with POST

Pass a second argument with the method, headers and body:

```javascript
const res = await fetch('https://jsonplaceholder.typicode.com/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Hello', body: 'From Node', userId: 1 }),
});

console.log(res.status, await res.json());
```

```text
201 { title: 'Hello', body: 'From Node', userId: 1, id: 101 }
```

The `body` must be text or bytes, so turn objects into JSON first, and set `Content-Type` so the server knows how to read it.

Some body types set the `Content-Type` for you:

```javascript
// Sent as application/x-www-form-urlencoded, like a classic HTML form
await fetch(url, { method: 'POST', body: new URLSearchParams({ q: 'node js' }) });

// Sent as multipart/form-data, used for file uploads
const form = new FormData();
form.append('name', 'Asha');
await fetch(url, { method: 'POST', body: form });
```

## When there is no reply: network errors

If the server is down, the address is wrong or your Wi-Fi is off, `fetch` rejects with a `TypeError`. The useful detail is hidden in `err.cause`:

```javascript
try {
  await fetch('http://localhost:4799/');
} catch (err) {
  console.log(err.name, err.message, err.cause?.code);
}
```

```text
TypeError fetch failed ECONNREFUSED
```

`ECONNREFUSED` means nothing was listening on that port. Other common codes are `ENOTFOUND` (the hostname does not exist) and `ECONNRESET` (the connection was cut).

## Timeouts and cancelling

By default `fetch` waits a long time for a slow server. Add your own limit with `AbortSignal.timeout()`:

```javascript
try {
  const res = await fetch('http://localhost:3000/slow', {
    signal: AbortSignal.timeout(1000), // give up after 1 second
  });
  console.log(await res.text());
} catch (err) {
  console.log(err.name, '|', err.message);
}
```

```text
TimeoutError | The operation was aborted due to timeout
```

To cancel for other reasons, such as a user pressing Stop, use an `AbortController` and call `controller.abort()`. You met both in [the Promise Combinators and AbortSignal lesson](/courses/nodejs/promise-combinators-and-abortsignal).

> **Tip:** Put a timeout on every request to another service. One slow dependency without a timeout can make your whole app hang.

## Streaming a big download

`res.json()` and `res.text()` hold the whole body in memory. For a large file, stream it to disk instead. `res.body` is a **web ReadableStream** (see [the Web Streams lesson](/courses/nodejs/web-streams)), and `Readable.fromWeb()` turns it into a Node stream you can pipe:

```javascript
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const res = await fetch('https://nodejs.org/dist/index.json');
if (!res.ok) throw new Error(`HTTP ${res.status}`);

await pipeline(Readable.fromWeb(res.body), createWriteStream('releases.json'));
console.log('Saved releases.json');
```

Only a small piece of the file is in memory at any moment.

## What is Undici?

The `fetch` inside Node is powered by **Undici**, an HTTP client written for Node by the Node team. Node bundles a copy, and you can see its version:

```javascript
console.log(process.versions.undici); // 7.16.0 on Node 24.12
```

Undici is also published on npm. You install it when you need more than plain `fetch`:

```bash
npm install undici
```

- `request()`: a lower-level, faster API that skips some of the web standard's overhead.
- `Agent`: a **connection pool** you can tune. A pool keeps sockets open and reuses them, so repeat requests to the same server skip the connection setup.
- `MockAgent`: fakes HTTP replies in tests, so they never touch the real network.

```javascript
import { fetch, Agent } from 'undici';

const agent = new Agent({
  connections: 10,          // at most 10 sockets per server
  keepAliveTimeout: 10_000, // keep idle sockets open for 10 seconds
});

const res = await fetch('https://jsonplaceholder.typicode.com/todos/1', { dispatcher: agent });
console.log(res.status); // prints: 200

await agent.close();
```

> **Note:** If you install the npm `undici`, import `fetch` from it too, as above. The npm version is usually newer than Node's bundled copy, and passing its `Agent` to the global `fetch` can fail with an `invalid onRequestStart method` error because the two versions do not match.

For most apps, the global `fetch` is all you need.

## The WebSocket client

HTTP is like sending letters: you ask, you get one answer, done. A **WebSocket** is more like a phone call. The connection stays open and either side can talk at any moment. Chats, live scores and multiplayer games use WebSockets.

Node has a global `WebSocket` class, the same as in browsers. It is enabled by default since Node 22 and no longer experimental since Node 22.4.

```javascript
// ws-client.mjs
const socket = new WebSocket('wss://echo.websocket.org');

socket.addEventListener('open', () => {
  console.log('Connected');
  socket.send('Hello from Node!');
  socket.send(JSON.stringify({ type: 'greeting', name: 'Asha' }));
});

socket.addEventListener('message', (event) => {
  console.log('Received:', event.data);
});

socket.addEventListener('close', (event) => {
  console.log('Closed with code', event.code);
});

socket.addEventListener('error', () => {
  console.log('Could not connect');
});

// Hang up after 3 seconds
setTimeout(() => socket.close(1000, 'Done'), 3000);
```

`wss://` is the encrypted version of `ws://`, just as `https://` is for `http://`. An **echo server** sends back whatever you send it, so you should see your two messages return as `Received:` lines. Public echo services sometimes add a welcome message of their own, and they can be offline, so do not be alarmed if the output differs a little.

The pieces to remember:

- Events: `open` (connected), `message` (data arrived, in `event.data`), `close` and `error`.
- `socket.send()` sends text or bytes. Only call it after `open`.
- `socket.close(code, reason)` hangs up politely. Code `1000` means "normal closure".
- Text messages arrive as strings. Binary messages arrive as a `Blob` by default; set `socket.binaryType = 'arraybuffer'` to get an `ArrayBuffer` instead.

Node only ships the **client** side. To build your own WebSocket server, most projects use the popular `ws` package from npm.

## Common mistakes

### Forgetting the second `await`

```javascript
const data = await fetch(url).json(); // TypeError: fetch(...).json is not a function
```

`fetch()` returns a promise, not a Response. Await it first:

```javascript
const res = await fetch(url);
const data = await res.json();
```

### Assuming errors throw

```javascript
const data = await (await fetch(url)).json(); // a 404 page sneaks through as "data"
```

Check `res.ok` before you use the body, as `getJson` does.

### Calling `json()` on something that is not JSON

```javascript
await (await fetch('http://localhost:3000/missing')).json();
// SyntaxError: Unexpected token 'o', "nope" is not valid JSON
```

Error pages are often plain text or HTML. Check `res.ok` (and if needed `res.headers.get('content-type')`) first.

## Quick recap

- `fetch()` is global in Node 18+ and stable since Node 21. It returns a promise for a Response.
- Read the body with `await res.json()`, `res.text()` or `res.arrayBuffer()`, and only once.
- HTTP errors like `404` do **not** reject. Check `res.ok`.
- Network failures reject with `TypeError: fetch failed`; look at `err.cause.code`.
- Add `signal: AbortSignal.timeout(ms)` to every request to another service.
- Stream large downloads with `Readable.fromWeb(res.body)` and `pipeline`.
- Undici powers Node's fetch; install it from npm for pools, `request()` and mocks.
- The global `WebSocket` client keeps a two-way connection open: `open`, `message`, `send`, `close`.

<code id="code-content" class="language-javascript">
// fetch-demo.mjs: built-in fetch against a tiny local server
import http from 'node:http';
// A small server to talk to: /book, /echo, /slow and everything else 404
const server = http.createServer(async (req, res) =&gt; {
  if (req.url === '/book') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ id: 1, title: 'Dune' }));
  }
  if (req.url === '/echo' &amp;&amp; req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(Buffer.concat(chunks));
  }
  if (req.url === '/slow') return setTimeout(() =&gt; res.end('late'), 2000);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});
await new Promise((resolve) =&gt; server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;
// A reusable helper: throws on HTTP errors and on timeouts
async function getJson(url, options = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(1000), ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
// 1. GET JSON
console.log(await getJson(`${base}/book`)); // { id: 1, title: 'Dune' }
// 2. POST JSON
const created = await getJson(`${base}/echo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Emma', author: 'Jane Austen' }),
});
console.log('Created:', created);
// 3. A 404 does not throw by itself, so getJson checks res.ok
try { await getJson(`${base}/missing`); } catch (err) { console.log(err.message); }
// 4. A slow server is cut off by AbortSignal.timeout
try { await getJson(`${base}/slow`); } catch (err) { console.log(err.name); } // TimeoutError
// 5. Several requests in parallel
const results = await Promise.all([1, 2, 3].map(() =&gt; getJson(`${base}/book`)));
console.log('Parallel results:', results.length);
console.log('Built-in Undici version:', process.versions.undici);
// 6. Stop the server. Now nobody is listening, so fetch rejects with a TypeError
await new Promise((resolve) =&gt; server.close(resolve));
try { await fetch(`${base}/book`); } catch (err) { console.log(err.message, err.cause?.code); } // fetch failed ECONNREFUSED
</code></pre>

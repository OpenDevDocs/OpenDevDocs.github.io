---
publishDate: 2026-10-25T09:48
title: WebSockets and Server-Sent Events
slug: websockets-and-sse
metadescription: Learn how to push live updates from Express 5 to the browser with Server-Sent Events and two-way WebSockets using the ws library, and when to pick each one.
updateDate: 2026-10-25T09:48
author: ['bishal-biswas']
level: 3
tags: ['express', 'websockets', 'sse', 'real-time']
course: expressjs
---

## What you will learn

- Why normal request/response is not enough for live features like chat or notifications
- How to send live updates with **Server-Sent Events (SSE)** using only `res.write()`
- How to add two-way **WebSockets** to an Express app with the `ws` library
- How to keep connections healthy, check who is connecting, and clean up properly
- How to choose between polling, SSE and WebSockets

## The problem: the server cannot speak first

Everything you have built so far follows one rule: the **client asks, the server answers**. The browser sends a request, Express sends a response, and the conversation is over.

That works for loading a page or saving a note. It does not work well when the *server* has news. Think of a chat message from a friend, a new order on a dashboard, or a live football score. The server knows something changed, but it has no open line to tell the browser.

**Think of it like waiting for a parcel:**

| Approach | Parcel analogy | Web version |
| --- | --- | --- |
| **Polling** | You call the courier every 10 seconds: "Is it here yet?" | The browser sends a request every few seconds |
| **Server-Sent Events** | The courier keeps a radio channel open and announces updates | One long response that the server keeps writing to |
| **WebSockets** | You and the courier are on a phone call, both can talk | A two-way connection that stays open |

Polling is simple but wasteful: most requests come back with "nothing new". SSE and WebSockets keep a connection open, so updates arrive the moment they happen.

## Server-Sent Events: a response that never ends

**Server-Sent Events (SSE)** is a browser standard for one-way updates from server to client. It is just HTTP. The server sends headers, then keeps the response open and writes small text messages into it whenever it wants.

In the last lesson you saw that a response can be written in pieces with `res.write()`. SSE uses exactly that idea.

### The SSE message format

Each message is plain text. A message ends with a **blank line** (two newline characters).

```text
data: Hello from the server

data: {"price": 101.5}

event: alert
data: Disk almost full
id: 42

: this line is a comment, browsers ignore it

```

| Field | Meaning |
| --- | --- |
| `data:` | The message content. Required. |
| `event:` | An optional event name, so the browser can listen for different types |
| `id:` | An optional message ID. The browser sends the last one back if it reconnects |
| `retry:` | How many milliseconds the browser should wait before reconnecting |
| `:` | A comment. Useful as a "heartbeat" to keep the connection alive |

### Your first SSE endpoint

This route sends the current time every second.

```js
// app.js
import express from 'express';

const app = express();
app.use(express.static('public'));

app.get('/events/clock', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream', // tells the browser this is SSE
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders(); // send the headers now instead of waiting for the first write

  const timer = setInterval(() => {
    res.write(`data: ${new Date().toISOString()}\n\n`);
  }, 1000);

  // Runs when the client goes away (tab closed, network lost)
  res.on('close', () => {
    clearInterval(timer);
  });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Notice there is no `res.end()` and no `res.send()`. The response stays open on purpose.

Try it with `curl`. The `-N` flag turns off buffering so you see each message as it arrives:

```bash
curl -N http://localhost:3000/events/clock
```

```text
data: 2026-10-25T09:48:01.120Z

data: 2026-10-25T09:48:02.121Z

data: 2026-10-25T09:48:03.122Z
```

Press `Ctrl+C` to stop. The `close` event fires on the server and the timer is cleared.

> **Common mistake:** Forgetting to clean up on `close`. Every open SSE connection that you forget about keeps a timer running forever. After a few hundred visitors, your server slowly runs out of memory.

### Listening in the browser

Browsers have a built-in `EventSource` object. It connects, reads messages and even **reconnects automatically** if the connection drops.

```html
<!-- public/index.html -->
<!doctype html>
<html lang="en">
  <body>
    <h1>Server time</h1>
    <p id="clock">Waiting...</p>

    <script>
      const source = new EventSource('/events/clock');

      source.onmessage = (event) => {
        document.getElementById('clock').textContent = event.data;
      };

      source.onerror = () => {
        console.log('Connection lost, the browser will retry');
      };
    </script>
  </body>
</html>
```

Open `http://localhost:3000` and the time ticks every second.

### Broadcasting to many clients

A clock is a toy. A real feature usually sends the **same** update to everyone who is listening, such as an announcement. To do that, keep a list of open responses.

```js
// app.js
import express from 'express';

const app = express();
app.use(express.json());
app.use(express.static('public'));

const clients = new Set(); // every open SSE response

const sendEvent = (res, { event, data, id }) => {
  if (event) res.write(`event: ${event}\n`);
  if (id) res.write(`id: ${id}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n'); // reconnect after 5 seconds if dropped

  clients.add(res);

  // A comment every 25 seconds stops proxies from closing an "idle" connection
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

let nextId = 1;

app.post('/announcements', (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }

  const announcement = { text: text.trim(), at: new Date().toISOString() };
  for (const client of clients) {
    sendEvent(client, { event: 'announcement', data: announcement, id: nextId });
  }
  nextId += 1;

  res.status(202).json({ deliveredTo: clients.size });
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Server running on http://localhost:3000');
});
```

Because this message has an `event:` name, the browser listens with `addEventListener` instead of `onmessage`:

```html
<!-- public/index.html (script part) -->
<script>
  const source = new EventSource('/events');
  source.addEventListener('announcement', (event) => {
    const announcement = JSON.parse(event.data);
    console.log('New announcement:', announcement.text);
  });
</script>
```

Open two browser tabs, then send an announcement:

```bash
curl -X POST http://localhost:3000/announcements \
  -H 'Content-Type: application/json' \
  -d '{"text":"Deploy finished"}'
```

```json
{ "deliveredTo": 2 }
```

Both tabs log the message at the same time.

> **Tip:** When the browser reconnects, it sends the last `id` it saw in a `Last-Event-ID` request header. You can read it with `req.get('Last-Event-ID')` and resend anything the client missed.

> **Warning:** If you use the `compression` middleware (covered two lessons from now), it buffers output, so SSE messages may not arrive until the buffer fills. Call `res.flush()` after each write, or skip compression for `text/event-stream` routes. Reverse proxies such as nginx can buffer too; the header `X-Accel-Buffering: no` turns that off for nginx.

## WebSockets: a two-way connection

SSE is one-way. The browser can still send data, but only with normal `fetch` requests. For things like chat, multiplayer games or collaborative editors, both sides want to talk constantly. That is what **WebSockets** are for.

A **WebSocket** starts life as an ordinary HTTP request with a special header asking to "upgrade" the connection. If the server agrees, both sides switch to the WebSocket protocol and the connection stays open. From then on, either side can send a message at any time.

```text
Browser                                   Server
   |  GET /ws  (Upgrade: websocket)  -->     |
   |  <--  101 Switching Protocols           |
   |                                         |
   |  <====== messages both ways ======>     |
   |                                         |
   |  close  -->                             |
```

### Why Express needs a helper

Express is built around request/response. It does not handle WebSocket messages itself. The popular `ws` package does, and it plugs into the same Node.js HTTP server that Express uses.

```bash
npm install ws
```

The key step: instead of `app.listen()`, you create the HTTP server yourself with `http.createServer(app)`. Then both Express and `ws` can share it.

```js
// server.js
import http from 'node:http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
app.use(express.static('public'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const server = http.createServer(app); // Express handles normal HTTP requests
const wss = new WebSocketServer({ server, path: '/ws' }); // ws handles upgrades on /ws

wss.on('connection', (socket, req) => {
  console.log('Client connected from', req.socket.remoteAddress);
  socket.send(JSON.stringify({ type: 'welcome', text: 'Hi! Say something.' }));

  socket.on('message', (data) => {
    // data arrives as a Buffer, so turn it into text first
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      socket.send(JSON.stringify({ type: 'error', text: 'Send JSON please' }));
      return;
    }

    // Broadcast to everyone who is still connected
    const outgoing = JSON.stringify({ type: 'chat', text: String(message.text ?? '') });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(outgoing);
      }
    }
  });

  socket.on('close', () => console.log('Client left'));
});

server.listen(3000, () => {
  console.log('HTTP and WebSocket server on http://localhost:3000');
});
```

> **Note:** `server.listen()` here is Node's own method, not Express's. Node reports problems such as a busy port through the server's `error` event, not the callback. Add `server.on('error', (error) => { throw error; })` if you want the same "crash loudly" behaviour as `app.listen()`.

### The browser side

Browsers have a built-in `WebSocket` object too.

```html
<!-- public/chat.html -->
<!doctype html>
<html lang="en">
  <body>
    <ul id="log"></ul>
    <form id="form">
      <input id="text" autocomplete="off" />
      <button>Send</button>
    </form>

    <script>
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${protocol}://${location.host}/ws`);
      const log = document.getElementById('log');

      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        const item = document.createElement('li');
        item.textContent = message.text; // textContent, never innerHTML, to avoid XSS
        log.append(item);
      });

      document.getElementById('form').addEventListener('submit', (event) => {
        event.preventDefault();
        const input = document.getElementById('text');
        socket.send(JSON.stringify({ text: input.value }));
        input.value = '';
      });
    </script>
  </body>
</html>
```

Open `http://localhost:3000/chat.html` in two tabs and chat with yourself.

> **Tip:** `ws://` is plain WebSocket and `wss://` is WebSocket over TLS, just like `http://` and `https://`. In production always use `wss://`.

### Keeping connections healthy with ping/pong

Connections can die silently: a laptop goes to sleep, or a phone loses signal. The server may not notice for a long time. The fix is a **heartbeat**: every so often the server sends a `ping`, and a healthy client answers with a `pong` automatically.

```js
// server.js (add after creating wss)
wss.on('connection', (socket) => {
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });
});

const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate(); // no pong since last check: assume it is dead
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30_000);

wss.on('close', () => clearInterval(heartbeat));
```

Browsers answer pings for you. You do not write any client code for this.

### Checking who is connecting

Here is an important surprise: **Express middleware does not run for WebSocket messages.** Your `requireAuth` middleware, rate limiter and body parser only see normal HTTP requests. You must check the user yourself, during the **upgrade** step, before accepting the connection.

To do that, create the `WebSocketServer` with `noServer: true` and handle the upgrade yourself:

```js
// server.js (auth version)
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const ALLOWED_ORIGINS = ['http://localhost:3000'];

const reject = (socket, status, text) => {
  socket.write(`HTTP/1.1 ${status} ${text}\r\n\r\n`);
  socket.destroy();
};

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/ws') return reject(socket, 404, 'Not Found');

  // Stop other websites from opening sockets with your users' cookies
  if (!ALLOWED_ORIGINS.includes(req.headers.origin)) {
    return reject(socket, 403, 'Forbidden');
  }

  let user;
  try {
    user = jwt.verify(url.searchParams.get('token') ?? '', process.env.JWT_SECRET);
  } catch {
    return reject(socket, 401, 'Unauthorized');
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, user);
  });
});

wss.on('connection', (socket, req, user) => {
  socket.send(JSON.stringify({ type: 'welcome', text: `Hello, user ${user.sub}` }));
});

server.listen(3000, () => console.log('Listening on http://localhost:3000'));
```

> **Warning:** A token in the URL can end up in server and proxy logs. Use short-lived tokens made just for the socket connection, or rely on a session cookie, which the browser sends automatically during the upgrade request for your own site.

## SSE or WebSockets?

| Question | Polling | SSE | WebSockets |
| --- | --- | --- | --- |
| Direction | Client asks repeatedly | Server to client | Both ways |
| Protocol | Plain HTTP | Plain HTTP | Upgrades to WebSocket |
| Extra library on server | No | No | Yes (`ws`) |
| Auto-reconnect in browser | Not needed | Built in | You write it |
| Data type | Anything | Text only | Text or binary |
| Works through most proxies | Yes | Yes (watch buffering) | Usually, needs upgrade support |
| Good for | Rare updates | Notifications, live feeds, progress bars | Chat, games, collaboration |

A simple rule: **start with SSE if only the server needs to push.** It is less code and uses tools you already know. Reach for WebSockets when the client also sends a steady stream of messages.

> **Note:** You may also hear about **Socket.IO**. It is a library built on top of WebSockets that adds rooms, automatic reconnection and fallbacks. It uses its own protocol, so a Socket.IO server needs a Socket.IO client. It is a fine choice, but learning plain `ws` first shows you what it does for you.

## Real-time apps with more than one server

Both SSE and WebSockets keep a list of connected clients **in memory**. That list lives inside one Node.js process. If you run three copies of your app behind a load balancer, a message published on copy 1 never reaches clients connected to copy 2.

The usual fix is a shared message channel, such as Redis **pub/sub** (publish/subscribe): every copy subscribes, and any copy can publish. You will meet Redis in the next lesson and multiple processes in [Clustering and Worker Threads](/courses/expressjs/clustering-and-worker-threads).

## Common mistakes

- **Not cleaning up on disconnect.** Always remove the client from your list and clear timers in `close`.
- **Calling `res.send()` or `res.json()` in an SSE route.** Those end the response. Use `res.write()`.
- **Using `app.listen()` and then wondering where to attach `ws`.** Either use `http.createServer(app)`, or keep the server returned by `const server = app.listen(...)` and pass that to `ws`.
- **Expecting Express middleware to protect WebSockets.** Check auth and the `Origin` header in the `upgrade` handler.
- **Trusting incoming messages.** Messages from a socket are user input, just like `req.body`. Parse them safely and validate them.

## Key takeaways

- HTTP normally lets only the client start a conversation. SSE and WebSockets let the server push updates.
- **SSE** is one long HTTP response: set `Content-Type: text/event-stream`, then `res.write('data: ...\n\n')`.
- **WebSockets** give a two-way connection. Use the `ws` library attached to `http.createServer(app)`.
- Clean up on `close`, send heartbeats, and authenticate during the upgrade, because Express middleware does not run there.
- Pick SSE for server-to-client feeds and WebSockets for constant two-way traffic.

## Practice

1. Build an SSE endpoint `/events/progress` that sends `data: 10`, `data: 20` ... up to `100`, one per second, then calls `res.end()`. Show a progress bar in the browser.
2. Extend the announcement example so a reconnecting client receives any announcements it missed, using the `Last-Event-ID` header and an array of the last 20 messages.
3. Add usernames to the WebSocket chat: the first message a client sends sets its name, and every broadcast includes who sent it.
4. Add the ping/pong heartbeat to your chat server, then close your laptop lid for a minute and watch the server terminate the dead socket.

## What's next

Live updates are fast, but repeating the same expensive database query for every visitor is not. Continue with [Caching with Redis and HTTP Cache Headers](/courses/expressjs/caching-with-redis).

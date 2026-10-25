---
publishDate: 2026-10-25T09:52
title: Graceful Shutdown and Health Checks
slug: graceful-shutdown-and-health-checks
metadescription: Learn how to stop an Express 5 server without dropping requests by handling SIGTERM, closing connections in order, and adding liveness and readiness health check endpoints.
updateDate: 2026-10-25T09:52
author: ['bishal-biswas']
level: 3
tags: ['express', 'graceful-shutdown', 'health-checks', 'production']
course: expressjs
---

## What you will learn

- What happens to in-flight requests when your server stops suddenly
- What **signals** such as `SIGTERM` and `SIGINT` are
- How to shut down Express in the right order: stop accepting, finish work, close the database, exit
- The difference between **liveness** and **readiness** health checks, and how to build both
- How to handle crashes from unexpected errors

## The problem with stopping abruptly

Your app gets restarted far more often than you might think: every deploy, every scale-down, every server update. If the process just dies, any request it was halfway through is cut off. A user's payment might be half-saved, or an upload just disappears with a network error.

**Think of a shop closing for the night.** A bad shopkeeper switches off the lights with customers still at the till. A good one locks the front door so no new customers come in, serves the people already inside, then cashes up and goes home. That is a **graceful shutdown**.

```text
 1. Signal arrives         "Please stop" (SIGTERM)
 2. Mark as not ready      load balancer stops sending new traffic
 3. Stop new connections   server.close()
 4. Finish in-flight work  let current requests complete
 5. Close resources        database, Redis, queues
 6. Exit                   process.exit(0)
    (safety net)           force exit if it takes too long
```

## Signals: how the outside world says "stop"

A **signal** is a short message the operating system sends to a running process. You have already sent one: pressing `Ctrl+C` in a terminal sends **`SIGINT`** (interrupt).

| Signal | Who sends it | Meaning |
| --- | --- | --- |
| `SIGINT` | You, with `Ctrl+C` | "Please stop" |
| `SIGTERM` | Docker, Kubernetes, PM2, systemd, most hosting platforms | "Please stop, you have a few seconds" |
| `SIGKILL` | The platform, if you ignore `SIGTERM` for too long | "Stop now." Cannot be caught. |

By default, Node.js exits immediately on `SIGINT` and `SIGTERM`. To shut down gracefully, you listen for them with `process.on()` and do the cleanup yourself.

## A slow route to test with

To see the difference, add a route that takes five seconds:

```js
// app.js
import express from 'express';

export const app = express();

app.get('/slow', async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  res.json({ message: 'Finished after 5 seconds' });
});
```

Start the server, run `curl http://localhost:3000/slow`, and press `Ctrl+C` on the server within five seconds. With the default behaviour, `curl` reports an error such as "Empty reply from server". The request was lost.

## Building a graceful shutdown

In Express 5, `app.listen()` returns Node's `http.Server`. Keep a reference to it, because `server.close()` is what stops new connections.

```js
// server.js
import { app } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

const server = app.listen(PORT, (error) => {
  if (error) throw error; // in Express 5, errors like EADDRINUSE arrive here
  console.log(`Listening on http://localhost:${PORT} (pid ${process.pid})`);
});

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return; // pressing Ctrl+C twice should not run this twice
  shuttingDown = true;
  console.log(`${signal} received: shutting down gracefully`);

  // Safety net: if cleanup hangs, exit anyway after 10 seconds
  const forceExit = setTimeout(() => {
    console.error('Shutdown took too long, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref(); // this timer alone should not keep the process alive

  try {
    // Stop accepting new connections and wait for in-flight requests to finish
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections(); // drop keep-alive connections that are doing nothing
    });
    console.log('HTTP server closed');

    // Close other resources here (database, Redis, ...)

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Repeat the test. Start `curl http://localhost:3000/slow`, then press `Ctrl+C` on the server:

```text
Listening on http://localhost:3000 (pid 5120)
SIGINT received: shutting down gracefully
HTTP server closed
```

The server waits, `curl` receives its JSON, and only then does the process exit.

### Why `closeIdleConnections()`?

Browsers and HTTP clients use **keep-alive**: they keep a connection open after a response, ready for the next request. `server.close()` waits for *every* connection to end, so an idle keep-alive connection could delay shutdown until it times out. `server.closeIdleConnections()` (Node.js 18.2+) closes the ones that are not currently handling a request. Recent Node.js versions do this inside `server.close()` already, but calling it is harmless and keeps older versions happy.

> **Note:** If you really need to cut everything off, `server.closeAllConnections()` closes active connections too. Use it only in the force-exit path, because it drops in-flight requests.

### Closing the database

Close your database **after** the HTTP server, because in-flight requests may still need it. With Mongoose:

```js
// server.js
import mongoose from 'mongoose';

// ... later, inside shutdown(), right after the HTTP server has closed:
await mongoose.connection.close();
console.log('MongoDB connection closed');
```

Do the same for anything else that holds a connection open: Redis clients, message queues, intervals and timers. Many libraries have a `close()` or `quit()` method; check their docs.

## Health checks: "Are you OK?"

Load balancers, Docker and Kubernetes need a way to ask your app whether it is working. You answer with **health check** endpoints: tiny routes that report status.

There are two different questions, and they need two endpoints.

| Check | Question | If it fails... | Should check the database? |
| --- | --- | --- | --- |
| **Liveness** | "Is the process alive and not stuck?" | The platform **restarts** the app | No |
| **Readiness** | "Can you handle traffic right now?" | The platform **stops sending traffic** (but does not restart) | Yes |

Why keep them separate? Imagine the database goes down for a minute. If liveness checked the database, the platform would restart every copy of your app, which does not fix the database and makes things worse. Readiness failing is the right reaction: "do not send me traffic for now".

```js
// app.js
import express from 'express';
import mongoose from 'mongoose';

export const app = express();
export const health = { ready: false }; // server.js flips this

// Liveness: if this route can answer, the event loop is running
app.get('/healthz', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ok' });
});

// Readiness: are we accepting traffic and is the database reachable?
app.get('/readyz', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const database = mongoose.connection.readyState === 1 ? 'up' : 'down'; // 1 means connected

  if (!health.ready || database !== 'up') {
    return res.status(503).json({ status: 'not ready', database });
  }
  res.json({ status: 'ready', database });
});

// ... your other middleware and routes go after the health checks
```

> **Tip:** Register health routes **before** authentication, rate limiting and noisy request logging. The load balancer cannot log in, and you do not want thousands of health check lines in your logs.

Try it:

```bash
curl -i http://localhost:3000/readyz
```

```http
HTTP/1.1 200 OK
Cache-Control: no-store
Content-Type: application/json; charset=utf-8

{"status":"ready","database":"up"}
```

## Putting it all together

Now connect readiness to the startup and shutdown flow. The app reports "not ready" until the database is connected, and switches back to "not ready" the moment shutdown begins.

```js
// server.js
import mongoose from 'mongoose';
import { app, health } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

await mongoose.connect(process.env.MONGODB_URI);

const server = app.listen(PORT, (error) => {
  if (error) throw error;
  health.ready = true; // only now can we take traffic
  console.log(`Listening on http://localhost:${PORT}`);
});

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  health.ready = false; // /readyz now returns 503, so the load balancer stops routing to us
  console.log(`${signal} received: shutting down`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  try {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections();
    });
    await mongoose.connection.close();
    console.log('Clean shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Start it with your `.env` file (Node.js 20.6+):

```bash
node --env-file=.env server.js
```

> **Note:** On some platforms there is a short delay between "you are being stopped" and "the load balancer has noticed". Some teams wait a few seconds after setting `health.ready = false` before calling `server.close()`, so no new requests are refused. Your platform's docs will say whether you need this.

### Telling the platform about your checks

In Kubernetes, you point probes at your endpoints. The grace period is how long it waits after `SIGTERM` before sending `SIGKILL`, so keep your force-exit timer shorter than it.

```yaml
# deployment.yaml (part of a Pod spec)
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: api
      image: my-api:1.0.0
      ports:
        - containerPort: 3000
      livenessProbe:
        httpGet:
          path: /healthz
          port: 3000
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /readyz
          port: 3000
        periodSeconds: 5
```

Docker has a `HEALTHCHECK` instruction too. You will use it in [Dockerising an Express API](/courses/expressjs/dockerising-an-express-api).

> **Warning:** In Docker, start your app with `CMD ["node", "server.js"]` rather than `npm start`. Then the signal goes straight to Node.js instead of passing through npm, and your shutdown code runs reliably.

## When things crash: uncaught errors

Express 5 sends errors from routes and middleware to your error handler, including rejected promises in `async` handlers. But errors can also happen **outside** a request: in a timer, an event listener, or a background job. Node.js treats those as fatal.

```js
// server.js (add near the top)
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception, exiting', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection, exiting', reason);
  process.exit(1);
});
```

Why exit instead of carrying on? After an unexpected error, your app may be in a broken, half-updated state. The safe move is to log the problem, exit, and let the platform start a fresh, clean copy. That is also why your startup must be fast and reliable.

## Common mistakes

- **Not keeping the server reference.** You cannot call `server.close()` if you threw away the return value of `app.listen()`.
- **Closing the database first.** In-flight requests then fail. Close the HTTP server first, then the database.
- **No force-exit timer.** One stuck connection can hang shutdown until the platform kills you with `SIGKILL`.
- **Checking the database in the liveness probe.** A database blip then restarts every instance at once.
- **Putting health checks behind auth.** The load balancer gets `401` and marks you as broken.

## Key takeaways

- Platforms stop apps with `SIGTERM`; `Ctrl+C` sends `SIGINT`. Listen for both with `process.on()`.
- Graceful shutdown order: mark not ready, `server.close()`, finish requests, close the database, exit, with a force-exit timer as a safety net.
- In Express 5, `app.listen()` returns the `http.Server`, and startup errors arrive as the callback's first argument.
- **Liveness** asks "am I alive?" (restart if not). **Readiness** asks "can I take traffic?" (stop routing if not).
- For errors outside requests, log and exit, then let the platform restart a clean process.

## Practice

1. Add the graceful shutdown code to your Notes API and prove with the `/slow` route that an in-flight request completes after `Ctrl+C`.
2. Stop your MongoDB (or Redis) while the app runs and watch `/readyz` switch to `503` while `/healthz` stays `200`.
3. Lower the force-exit timer to 2 seconds and the slow route to 5 seconds. What happens to the request now?
4. Add a `uptime` field (from `process.uptime()`) and a `version` field (from `package.json` or an environment variable) to `/healthz`.

## What's next

Your app now starts, stops and reports its health properly. Next, you will make sure it keeps working with automated tests. Continue with [Testing with Supertest and the Node Test Runner](/courses/expressjs/testing-with-supertest).

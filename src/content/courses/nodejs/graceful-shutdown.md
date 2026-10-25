---
publishDate: 2026-10-25T12:45
title: Graceful Shutdown and Signal Handling
slug: graceful-shutdown
metadescription: "Stop a Node server without dropping requests: handle SIGINT and SIGTERM, close servers and keep-alive connections, add a timeout, and avoid Windows and Docker traps."
updateDate: 2026-10-25T12:45
author: ['bishal-biswas']
level: 3
tags: ['shutdown', 'signals', 'production', 'http']
course: nodejs
---

## What is a graceful shutdown?

Think about a restaurant at closing time. The staff do not throw diners out mid-meal. They lock the front door so nobody new comes in, let the people already eating finish, clean up the kitchen, and then turn off the lights. If one table lingers for an hour, someone politely asks them to leave.

A **graceful shutdown** is the same for a server:

1. Stop accepting new work.
2. Let work already in progress finish.
3. Close resources: database pools, file handles, message queues, telemetry.
4. Exit.
5. If that takes too long, force it.

Servers get stopped far more often than you might think: every deploy, every restart, every time a platform moves your app to another machine. Without a graceful shutdown, each of those drops the requests in flight, can leave half-written data behind, and loses the last few logs and traces.

## Signals: how the outside world says "stop"

A **signal** is a small message the operating system sends to a process. The ones that matter here:

| Signal | Who sends it | Can Node catch it? |
| --- | --- | --- |
| `SIGINT` | You, pressing Ctrl+C in the terminal | Yes |
| `SIGTERM` | `docker stop`, Kubernetes, systemd, most hosting platforms | Yes (not on Windows, see below) |
| `SIGHUP` | The terminal window closing | Yes |
| `SIGKILL` | `kill -9`, or a platform that ran out of patience | **No**, the process dies instantly |

With no listener, Node exits straight away on `SIGINT` and `SIGTERM`. As soon as you add a listener, that default is gone: Node runs your handler and **keeps running** until you finish the job.

```javascript
// signals.mjs
process.on('SIGINT', () => {
  console.log('Got SIGINT (Ctrl+C). Cleaning up...');
  process.exit(0);
});

console.log('Press Ctrl+C to stop');
setInterval(() => {}, 1000); // keep the process alive
```

```text
Press Ctrl+C to stop
Got SIGINT (Ctrl+C). Cleaning up...
```

## Closing an HTTP server

`server.close()` stops the server from accepting **new** connections. It waits for requests already being handled to finish, then calls its callback.

```javascript
// close.mjs
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';

const server = http.createServer(async (req, res) => {
  await sleep(1000); // a slow request
  res.end('done\n');
});

server.listen(3000, () => console.log('Listening on 3000'));

process.on('SIGINT', () => {
  console.log('Closing server...');
  server.close(() => console.log('All requests finished, server closed'));
});
```

If a request is in progress when you press Ctrl+C, it still gets its `done` reply, and only then does the server close.

### Keep-alive connections

Browsers and HTTP clients use **keep-alive**: after a response, they keep the TCP connection open so the next request is faster. An open but unused connection is called **idle**.

Idle connections used to keep a closing server alive for seconds. Since Node 19, `server.close()` also closes idle connections, so this is handled for you. Two methods give you more control:

- `server.closeIdleConnections()` closes connections that are not handling a request right now.
- `server.closeAllConnections()` closes **every** connection, including ones mid-request. Use it only as a last resort, when your time is up.

There is one catch. A request that was still running when you called `close()` finishes later, and its connection then becomes idle and stays open until the client or the server's `keepAliveTimeout` (5 seconds by default) closes it. Tell the client not to reuse the connection once shutdown has started. Here `shuttingDown` is a flag you set when shutdown begins, as in the full routine below:

```javascript
const server = http.createServer(async (req, res) => {
  // ...handle the request...
  if (shuttingDown) res.setHeader('Connection', 'close'); // close after this response
  res.end('done\n');
});
```

In a test, this took a shutdown with one slow in-flight request from about 3.7 seconds down to the 0.7 seconds the request itself needed.

## A complete shutdown routine

Here is the pattern most production Node servers use:

```javascript
// server.mjs
import http from 'node:http';

let shuttingDown = false;

const server = http.createServer((req, res) => {
  if (shuttingDown) res.setHeader('Connection', 'close');
  res.end('Hello from the orders API\n');
});
server.listen(3000);

async function shutdown(signal) {
  if (shuttingDown) return; // ignore a second signal while we are busy
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  // Safety net: if cleanup hangs, force the exit
  const forceTimer = setTimeout(() => {
    console.error('Shutdown took too long, forcing exit');
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forceTimer.unref(); // this timer alone must not keep the process alive

  try {
    // 1. Stop new connections and wait for in-flight requests
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    // 2. Close other resources here: database pools, queues, telemetry
    // await db.end();
    // await sdk.shutdown();
    console.log('Clean shutdown complete');
    process.exitCode = 0;
  } catch (error) {
    console.error('Error during shutdown', error);
    process.exitCode = 1;
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

A few details worth noticing:

- **The `shuttingDown` flag** stops the routine running twice if a second signal arrives.
- **`unref()`** tells Node that this timer should not by itself keep the process running. If everything closes quickly, Node exits without waiting ten seconds.
- **`process.exitCode`** sets the exit code but lets Node finish naturally once nothing is left to do. Calling `process.exit()` too early would cut off pending writes such as the last log lines.

> **Tip:** Some teams let a second Ctrl+C force an immediate exit, which is handy in development: if `shuttingDown` is already true, call `process.exit(1)` instead of returning.

## Tell the load balancer first

In a real deployment, a load balancer spreads traffic across several copies of your app. When one copy starts shutting down, the load balancer may keep sending it requests for a few seconds until it notices.

Two habits help:

- Expose a **health check** route that returns `503 Service Unavailable` once shutdown begins, so the load balancer stops routing to you.
- Optionally wait a few seconds after the signal before calling `server.close()`, giving the load balancer time to react.

```javascript
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(shuttingDown ? 503 : 200).end(shuttingDown ? 'stopping' : 'ok');
    return;
  }
  res.end('Hello\n');
});
```

## Cancelling long-running work

Some work is not an HTTP request: a background job, a long export, a polling loop. Give it an `AbortSignal` (from [the Promise Combinators and AbortSignal lesson](/courses/nodejs/promise-combinators-and-abortsignal)) and abort it during shutdown:

```javascript
import { setTimeout as sleep } from 'node:timers/promises';

const shutdownController = new AbortController();

async function pollQueue(signal) {
  while (!signal.aborted) {
    // ...process a batch of jobs...
    await sleep(5000, undefined, { signal }).catch(() => {}); // wakes early on abort
  }
  console.log('Queue poller stopped');
}

pollQueue(shutdownController.signal);
process.on('SIGTERM', () => shutdownController.abort());
```

Long-lived connections such as WebSockets and Server-Sent Events never finish on their own either. Close them yourself during shutdown, ideally with a message telling clients to reconnect.

## Windows is different

Windows does not have Unix signals, so Node imitates some of them:

- **`SIGINT`** works: Ctrl+C in a terminal triggers it.
- **`SIGTERM`** can be listened for, but Windows never sends it. Worse, `process.kill(pid, 'SIGTERM')` or `child.kill('SIGTERM')` on Windows terminates the target **immediately**, without running its handler.
- **`SIGBREAK`** is sent when you press Ctrl+Break.
- **`SIGHUP`** is sent when the console window is closed, and Windows only gives the process a few seconds before killing it.

To test your shutdown code on Windows, use Ctrl+C, or trigger the handlers from inside the process:

```javascript
process.emit('SIGTERM'); // runs your SIGTERM listeners, does not kill anything
```

Your production servers most likely run on Linux, where `SIGTERM` behaves normally.

## Containers and platforms

When Docker stops a container, it sends `SIGTERM`, waits 10 seconds by default, then sends `SIGKILL`. Kubernetes does the same with a default grace period of 30 seconds. Keep your force-exit timeout **shorter** than that grace period so your own cleanup decides the ending, not `SIGKILL`.

Two Docker pitfalls stop the signal from ever reaching Node:

```dockerfile
# Good: exec form, Node receives SIGTERM directly
CMD ["node", "server.js"]

# Risky: a shell or npm sits in between and may not pass the signal on
# CMD npm start
```

The first process in a container (**PID 1**) is special on Linux: signals it has not set up a handler for are ignored instead of killing it. Your own `SIGTERM` handler covers that, but running with `docker run --init` (or a tiny init such as `tini`) also handles signals and cleans up zombie child processes. [The Dockerising Node Applications lesson](/courses/nodejs/dockerising-node-applications) covers this in depth.

## Common mistakes

**Calling `process.exit()` straight away in the handler.** That kills in-flight requests, which defeats the point. Close things first.

**No timeout.** One stuck connection or database call and the process never exits, until the platform sends `SIGKILL` anyway. Always add the safety timer.

**Forgetting non-HTTP resources.** Database pools, open intervals and message consumers keep the event loop alive. If your process will not exit after `server.close()`, something else is still open. A diagnostic report's `libuv` section (from [the Reports lesson](/courses/nodejs/diagnostics-and-profiling)) lists every open handle.

**Trying to keep running after `uncaughtException`.** After an unexpected error the app may be in a broken state. Log it, then shut down (gracefully if you can) and let your process manager restart it.

## Quick recap

- A graceful shutdown stops new work, finishes current work, closes resources and exits.
- `SIGINT` comes from Ctrl+C; `SIGTERM` comes from Docker, Kubernetes and hosting platforms; `SIGKILL` cannot be caught.
- Adding a signal listener removes Node's default exit, so your handler must finish the job.
- `server.close()` waits for in-flight requests; `closeAllConnections()` is the last resort.
- Use a guard flag, an `unref()`'d force-exit timer and `process.exitCode`.
- On Windows, `SIGTERM` is never delivered; test with Ctrl+C or `process.emit()`.
- In containers, use exec-form `CMD ["node", ...]` and keep your timeout below the grace period.

<code id="code-content" class="language-javascript">
// graceful.mjs: a server that shuts down without dropping requests
import http from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
let shuttingDown = false;
const server = http.createServer(async (req, res) =&gt; {
  if (req.url === '/health') {
    res.writeHead(shuttingDown ? 503 : 200).end(shuttingDown ? 'stopping' : 'ok');
    return;
  }
  if (req.url === '/slow') await sleep(800); // a request still in flight at shutdown
  if (shuttingDown) res.setHeader('Connection', 'close'); // do not keep this socket open
  res.end(`done ${req.url}\n`);
});
async function shutdown(signal) {
  if (shuttingDown) {
    console.log('Second signal: forcing exit');
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`${signal} received, stopping new connections`);
  const forceTimer = setTimeout(() =&gt; {
    console.error('Took too long, closing every connection');
    server.closeAllConnections();
    process.exit(1);
  }, 5000);
  forceTimer.unref(); // never keeps the process alive on its own
  const started = Date.now();
  await new Promise((resolve) =&gt; server.close(resolve)); // waits for in-flight requests
  // Close databases, queues and telemetry here, e.g. await db.end()
  console.log(`Server closed after ${Date.now() - started} ms`);
  process.exitCode = 0; // let Node exit naturally once everything is closed
}
process.on('SIGINT', () =&gt; shutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () =&gt; shutdown('SIGTERM')); // Docker, Kubernetes, systemd
server.listen(0, async () =&gt; {
  const base = `http://localhost:${server.address().port}`;
  console.log('Listening on', base);
  console.log('health:', await (await fetch(`${base}/health`)).text());
  const slow = fetch(`${base}/slow`).then((r) =&gt; r.text()); // starts, does not finish yet
  await sleep(100);
  // Simulate Ctrl+C. process.emit runs our handler on every OS, including Windows
  process.emit('SIGINT');
  console.log('slow request still answered:', (await slow).trim());
});
</code></pre>

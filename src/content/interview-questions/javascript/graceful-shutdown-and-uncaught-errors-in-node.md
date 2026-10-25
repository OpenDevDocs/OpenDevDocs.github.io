---
course: javascript
slug: graceful-shutdown-and-uncaught-errors-in-node
experienceLevel: senior
difficulty: hard
tags:
  - node
  - error-handling
  - reliability
question: How do you implement graceful shutdown and handle uncaught errors in a Node.js service?
answer: |
  **Graceful shutdown** means that when the platform asks the process to stop (Kubernetes, systemd and Docker send `SIGTERM`; Ctrl+C sends `SIGINT`), the service finishes in-flight work and exits cleanly instead of dropping requests.

  A solid sequence:

  1. Mark the instance **not ready** so the load balancer stops sending traffic. Readiness probes should fail from now on.
  2. Call `server.close()` to stop accepting new connections. Existing ones finish. Call `server.closeIdleConnections()` so idle keep-alive sockets don't hold the process open.
  3. Wait for in-flight requests and background jobs, then close resources in reverse order of creation: queue consumers, database pools, telemetry exporters (flush them).
  4. Exit, with a **hard timeout** (shorter than the orchestrator's grace period, for example 10 s of Kubernetes' default 30 s) that calls `process.exit(1)` if something hangs. Use `.unref()` on that timer so it doesn't keep the process alive by itself.

  **Uncaught errors** are a different situation. After an `uncaughtException`, the process is in an **unknown state**: a half-finished operation may have left locks held or data inconsistent. The safe policy is to log it with full context, try a best-effort graceful shutdown with a short timeout, and **exit non-zero** so the supervisor restarts the process. Don't use the handler to "keep going".

  For promises: since Node 15, an **unhandled rejection** is raised as an uncaught exception by default (`--unhandled-rejections=throw`), and the process crashes. Treat it the same way. Add an `unhandledRejection` handler only for logging, then rethrow or exit. Fix the root cause by awaiting promises or attaching `.catch`.

  Also handle signals only once (a second `SIGINT` should force exit), and make sure the container runs Node as PID 1 correctly (use `--init` or `tini`, or `exec node` in shell scripts) so signals actually reach your process.
codeExample: |
  const http = require('node:http');

  const server = http.createServer((req, res) => setTimeout(() => res.end('done'), 50));
  let shuttingDown = false;

  async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`shutting down: ${reason}`);
    setTimeout(() => { console.error('forced exit'); process.exit(1); }, 10_000).unref();

    await new Promise((resolve) => {
      server.close(resolve);              // wait for in-flight requests
      server.closeIdleConnections();      // drop idle keep-alive sockets
    });
    // await db.end(); await telemetry.flush();
    console.log('closed cleanly');
    process.exitCode = exitCode;
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('fatal', err);          // state is unknown: shut down, exit non-zero
    shutdown('uncaughtException', 1);
  });

  server.listen(0, async () => {
    const pending = fetch(`http://localhost:${server.address().port}/`).then((r) => r.text());
    setTimeout(() => process.emit('SIGTERM'), 10);  // simulate the orchestrator
    console.log('in-flight request got:', await pending);
  });
  // Output:
  // shutting down: SIGTERM
  // in-flight request got: done
  // closed cleanly
popularity: 8.3
isPublished: true
---

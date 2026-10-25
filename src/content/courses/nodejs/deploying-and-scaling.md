---
publishDate: 2026-10-25T13:20
title: Deploying and Scaling in Production
slug: deploying-and-scaling
metadescription: Run Node in production with environment config, systemd or PM2, an nginx reverse proxy, health checks, horizontal scaling and zero-downtime restarts.
updateDate: 2026-10-25T13:20
author: ['bishal-biswas']
level: 4
tags: ['deployment', 'scaling', 'production']
course: nodejs
---

## From laptop to production

Running `node server.js` in a terminal is fine while you develop. But close the terminal and the server dies. Crash at 3 a.m. and nobody restarts it. Get popular and one process cannot keep up.

Think of the difference between cooking dinner at home and running a restaurant. The recipe is the same. What changes is everything around it: opening hours, a host at the door, more cooks when it gets busy, and swapping staff without closing the doors.

This lesson covers those "everything around it" parts:

1. **Configuration** that changes per environment.
2. A **process manager** that keeps Node running.
3. A **reverse proxy** in front of Node.
4. **Health checks** so machines know when your app is working.
5. **Horizontal scaling** to handle more traffic.
6. **Zero-downtime restarts** for deploying new versions.

## 1. Configuration from the environment

The same code should run on your laptop, in staging and in production. What differs is **configuration**: ports, database URLs, API keys. Keep it in **environment variables**, not in the code. (This is one of the rules of the well-known "twelve-factor app" guide.)

You learned the tools in [the Environment Variables lesson](/courses/nodejs/environment-variables-and-env-file). In production, add one more habit: **validate config at startup and fail fast**.

```javascript
// config.js
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
};
```

If `DATABASE_URL` is missing, the app refuses to start, with a clear message. That is much better than starting "fine" and failing on the first real request an hour later.

> **Tip:** Set `NODE_ENV=production` in production. Many libraries use it to turn off slow debugging features. Your own code should not depend on it for anything important, though; use explicit settings instead.

## 2. Keeping Node running: process managers

A **process manager** starts your app, restarts it when it crashes, starts it again after the server reboots, and collects its logs.

### systemd

On most Linux servers, **systemd** is already there. It is the program that starts and supervises everything on the machine. You describe your app in a **unit file**:

```text
# /etc/systemd/system/notes-api.service
[Unit]
Description=Notes API
After=network.target

[Service]
User=notes
WorkingDirectory=/srv/notes-api
EnvironmentFile=/etc/notes-api.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
```

- **`User=notes`** runs the app as a normal user, not root.
- **`EnvironmentFile`** loads `KEY=value` lines (your secrets) from a file only root and that user can read.
- **`Restart=on-failure`** restarts the app if it crashes, after `RestartSec` seconds.
- **`TimeoutStopSec=15`** gives your app 15 seconds to shut down gracefully after SIGTERM before it is killed.

Then turn it on:

```bash
sudo systemctl daemon-reload            # read the new unit file
sudo systemctl enable --now notes-api   # start now and on every boot
systemctl status notes-api              # is it running?
journalctl -u notes-api -f              # follow its logs
```

Anything your app writes with `console.log` ends up in the **journal**, systemd's log store.

### PM2

**PM2** is a popular process manager written in Node. It is handy on servers where you want one tool that also does clustering and zero-downtime reloads.

```bash
npm install -g pm2
pm2 start server.js --name notes-api -i max   # one process per CPU core
pm2 status
pm2 logs notes-api
pm2 reload notes-api                           # restart one process at a time
pm2 save && pm2 startup                        # survive reboots
```

`-i max` runs PM2 in **cluster mode**, using the same idea as [the Cluster Module lesson](/courses/nodejs/cluster-module): several Node processes share one port.

> **Note:** If you deploy with Docker, you usually do not need either. The container platform (Docker's restart policy, Kubernetes, or your cloud host) does the supervising, and you run one Node process per container.

## 3. A reverse proxy in front of Node

A **reverse proxy** is a web server that sits between the internet and your app. Visitors talk to the proxy; the proxy passes requests to Node. Think of a receptionist who greets every visitor and walks them to the right office.

**nginx** is the most common choice. It is very good at:

- **HTTPS**: handling certificates and encryption.
- **Static files**: serving images and CSS faster than Node.
- **Load balancing**: spreading requests over several Node processes.
- **Protection**: limiting request sizes and slow clients before they reach your app.

```text
# /etc/nginx/sites-available/notes-api
upstream notes_api {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name notes.example.com;

    location / {
        proxy_pass http://notes_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- **`upstream`** lists the Node processes. nginx takes turns sending requests to each.
- **`keepalive`** with `proxy_http_version 1.1` and an empty `Connection` header reuses connections to Node instead of opening a new one per request.
- **`X-Forwarded-For`** passes the visitor's real IP address. Without it, every request seems to come from `127.0.0.1`.

For free HTTPS certificates, the `certbot` tool from Let's Encrypt can update this file for you: `sudo certbot --nginx -d notes.example.com`.

Because nginx is the public face, make Node listen only on `127.0.0.1` on this kind of server, so nobody can skip the proxy.

## 4. Health checks

Load balancers, process managers and container platforms need to ask your app "are you OK?". Give them two simple routes:

- **Liveness** (`/healthz`): "Is the process alive at all?" If this fails, restart it.
- **Readiness** (`/readyz`): "Should you get traffic right now?" This is false while the app is starting up (connecting to the database, warming caches) and while it is shutting down.

```javascript
let ready = false;

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') return res.end('alive');
  if (req.url === '/readyz') {
    res.statusCode = ready ? 200 : 503;
    return res.end(ready ? 'ready' : 'not ready');
  }
  // ... normal routes
});

await connectToDatabase();
ready = true;
```

Keep health checks cheap. They are called every few seconds, so they should not run heavy queries.

## 5. Scaling: up or out

When one server is not enough, you have two choices.

- **Vertical scaling (scaling up)**: buy a bigger machine. Easy, but there is a limit, and one machine is still one point of failure.
- **Horizontal scaling (scaling out)**: run more copies of your app and put a load balancer in front. No hard limit, and if one copy dies, the others keep serving.

Node runs your JavaScript on one thread, so even on a single big machine you scale *out*: one process per CPU core (with cluster, PM2 `-i max`, or several containers).

### The golden rule: be stateless

Horizontal scaling only works if any copy can answer any request. That means **no important state in memory**:

| Instead of keeping this in memory... | ...keep it here |
| --- | --- |
| Login sessions | Redis, or signed cookies/tokens |
| Uploaded files on local disk | Object storage such as S3 |
| A cache only one process can see | Redis (see [the Caching Strategies lesson](/courses/nodejs/caching-strategies)) |
| Scheduled jobs (`setInterval`) | A job queue, or one dedicated worker |

If a user logs in on copy A and their next request hits copy B, B must still know who they are.

## 6. Zero-downtime restarts

Deploying a new version means stopping the old code. Done carelessly, users see errors for a few seconds. A **zero-downtime** (or **rolling**) restart replaces instances one at a time:

1. Start a new instance with the new code.
2. Wait until its readiness check returns 200.
3. Send the old instance SIGTERM.
4. The old instance marks itself not ready, finishes the requests it already has, then exits.
5. Repeat for the next instance.

Because at least one instance is always ready, the load balancer always has somewhere to send traffic.

With PM2, `pm2 reload notes-api` does this for you. With systemd and the nginx config above, you can run two instances (for example on ports 3000 and 3001) and restart them one after the other. Container platforms like Kubernetes do rolling updates out of the box.

Step 4 is your code's job. You built it in [the Graceful Shutdown lesson](/courses/nodejs/graceful-shutdown), and the playground below puts it together with readiness.

## Common mistakes

**Mismatched keep-alive timeouts.** Node closes idle connections after 5 seconds by default. Many load balancers keep them for 60 seconds. If Node closes a connection just as the load balancer reuses it, users get random 502 errors. Make Node's timeout longer than the load balancer's:

```javascript
server.keepAliveTimeout = 65_000; // longer than a 60 second load balancer timeout
server.headersTimeout = 66_000;   // must be a bit larger than keepAliveTimeout
```

**Running as root.** Use a dedicated user in systemd (`User=`), in Docker (`USER node`), everywhere.

**Logging to files inside the app.** Write logs to stdout and let systemd, PM2 or the container platform collect them, as in [the Logging lesson](/courses/nodejs/logging-and-observability).

**Storing sessions in a plain object.** It works with one process and breaks the moment you add a second one.

## Quick recap

- Keep configuration in environment variables and validate it at startup.
- Use a process manager (systemd or PM2) or a container platform to restart and supervise Node.
- Put a reverse proxy such as nginx in front for HTTPS, static files and load balancing.
- Expose cheap `/healthz` (alive) and `/readyz` (send me traffic) routes.
- Scale out with more stateless processes; move sessions, files and caches to shared stores.
- Zero-downtime deploys replace instances one at a time, and each old instance drains before exiting.

<code id="code-content" class="language-javascript">
// deploy-ready.mjs: config, health checks and a zero-downtime style shutdown.
// It starts, checks itself like a load balancer would, then "gets deployed over".
import http from 'node:http';
// 1. Read and validate config once, at startup. Fail fast if it is wrong.
function loadConfig(env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port &lt; 1 || port &gt; 65535) throw new Error(`Bad PORT: ${env.PORT}`);
  return { port, env: env.NODE_ENV ?? 'development', instance: env.INSTANCE_ID ?? `pid-${process.pid}` };
}
const config = loadConfig(process.env);
// 2. Readiness: false until warmed up, false again while shutting down
let ready = false;
const server = http.createServer((req, res) =&gt; {
  if (req.url === '/healthz') return res.end('alive'); // liveness: the process works
  if (req.url === '/readyz') {
    res.statusCode = ready ? 200 : 503; // readiness: send me traffic?
    return res.end(ready ? 'ready' : 'not ready');
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ message: 'Hello from the notes API', instance: config.instance }));
});
// Keep idle connections open longer than the load balancer does (avoids random 502s)
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.listen(config.port, async () =&gt; {
  console.log(`[${config.instance}] ${config.env} server on port ${config.port}`);
  const base = `http://127.0.0.1:${config.port}`;
  const check = async (path) =&gt; {
    const res = await fetch(base + path);
    console.log(`  GET ${path.padEnd(8)} -&gt; ${res.status} ${await res.text()}`);
  };
  await check('/readyz'); // 503: still warming up
  ready = true; // pretend caches are warm and the database is connected
  await check('/readyz'); // 200: the load balancer starts sending traffic
  await check('/');
  // 3. A deploy sends SIGTERM to the old instance. Simulate that here.
  process.emit('SIGTERM');
  await check('/readyz'); // 503: the load balancer stops sending new requests
});
process.on('SIGTERM', () =&gt; {
  console.log(`[${config.instance}] SIGTERM: marking not ready, draining...`);
  ready = false;
  // Give the load balancer a moment to notice, then stop and exit cleanly
  setTimeout(() =&gt; {
    server.close(() =&gt; {
      console.log(`[${config.instance}] drained, exiting with code 0`);
      process.exit(0);
    });
    server.closeIdleConnections();
  }, 500);
});
</code></pre>

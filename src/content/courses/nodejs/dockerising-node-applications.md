---
publishDate: 2026-10-25T13:10
title: Dockerising Node Applications
slug: dockerising-node-applications
metadescription: Package a Node app into a small, secure Docker image with a multi-stage build, npm ci --omit=dev, a non-root user, a health check and proper signals.
updateDate: 2026-10-25T13:10
author: ['bishal-biswas']
level: 4
tags: ['docker', 'containers', 'deployment']
course: nodejs
---

## Why put Node in a container?

"It works on my machine" is the oldest excuse in programming. Your laptop has Node 24, the server has Node 22, a teammate has a different operating system, and suddenly the same code behaves differently.

A **container** fixes that by packing your app together with everything it needs: the right Node version, your `node_modules`, your code and its settings. Think of a shipping container. The ship does not care whether it carries bananas or bicycles. Any port can lift it, because the box is a standard shape.

**Docker** is the most popular tool for building and running containers. A few words you will need:

- An **image** is the packed box: a read-only snapshot of a file system with your app inside.
- A **container** is a running copy of an image. You can start many containers from one image.
- A **Dockerfile** is the recipe that builds the image, one instruction per line.
- A **registry** (such as Docker Hub or GitHub Container Registry) is where images are stored and shared.

## The app we will containerise

A small notes API with a health check. The full version is in the playground at the end of this lesson. The important parts:

```javascript
// server.js
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }
  res.writeHead(404).end('Not found');
});

// No host given, so Node listens on all network interfaces
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));
```

## A first, simple Dockerfile

Here is the simplest Dockerfile that works:

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
```

- `FROM` picks the **base image**: an official image with Node 24 already installed.
- `WORKDIR` makes `/app` the current folder inside the image.
- `COPY . .` copies your project into it.
- `RUN` runs a command while building the image.
- `CMD` is the command that runs when a container starts.

It works, but it has problems: it copies your local `node_modules`, installs dev tools you do not need in production, rebuilds every dependency whenever any file changes, and runs as the all-powerful `root` user. Let us fix each one.

## Choosing a base image

The official `node` images come in a few flavours:

| Tag | What it is | Size |
| --- | --- | --- |
| `node:24` | Full Debian with build tools | Large |
| `node:24-slim` | Debian with only the basics | Medium |
| `node:24-alpine` | Alpine Linux, very small | Small |

`node:24-slim` is a safe default. **Alpine** is smaller, but it uses a different C library (musl instead of glibc), which can break packages with native addons. If you pick Alpine, test carefully.

> **Tip:** For repeatable builds, pin an exact version such as `node:24.12.0-slim`. A tag like `node:24-slim` moves to each new 24.x release, which is convenient but means two builds a month apart can differ.

## Step 1: ignore what does not belong

Before Docker builds, it sends your project folder (the **build context**) to the builder. A **`.dockerignore`** file lists what to leave out, just like `.gitignore`:

```text
node_modules
npm-debug.log
.git
.env
.env.*
coverage
dist
Dockerfile
.dockerignore
```

- `node_modules` must be ignored. Your local one may contain binaries built for Windows or macOS, which will not run on Linux.
- `.env` must be ignored, or your secrets end up baked into the image for anyone to read.

## Step 2: cache dependencies with layer order

Each instruction in a Dockerfile creates a **layer**. Docker caches layers and only rebuilds from the first one that changed.

So copy `package.json` and the lockfile first, install, and only then copy your code:

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

Now editing `server.js` reuses the cached `npm ci` layer. Builds go from minutes to seconds.

**`npm ci`** installs exactly what the lockfile says and fails if `package.json` and the lockfile disagree. That is what you want for a build.

## Step 3: a multi-stage build

Many projects have a build step, such as compiling TypeScript into a `dist` folder. The compiler is a dev dependency: you need it to build, but not to run.

A **multi-stage build** uses more than one `FROM`. The first stage builds. The last stage copies only the results. Everything else is thrown away, so the final image stays small.

```dockerfile
# syntax=docker/dockerfile:1

# ---- Stage 1: build ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: run ----
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the built output from the first stage
COPY --from=build /app/dist ./dist

# Drop root privileges
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "dist/server.js"]
```

Key lines:

- **`AS build`** names the first stage so you can copy from it.
- **`npm ci --omit=dev`** skips `devDependencies`. No TypeScript, no test runner, no linters in production.
- **`npm cache clean --force`** deletes npm's download cache so it does not take up space in the image.
- **`COPY --from=build`** pulls just the `dist` folder out of the first stage.
- **`ENV NODE_ENV=production`** tells many libraries to switch to their faster production behaviour.

If your project has no build step, drop the first stage and simply `COPY . .` after the `npm ci --omit=dev` line.

## Step 4: do not run as root

By default, a container runs as `root`. If an attacker finds a hole in your app, they get root inside the container, which makes escaping or doing damage much easier.

The official Node images already include a normal user called **`node`**. One line switches to it:

```dockerfile
USER node
```

In the Dockerfile above, the files are copied while still root, so the `node` user can read them but not change them. That is good: a compromised app cannot rewrite its own code.

> **Note:** Keep a high port such as 3000 inside the container and map it to 80 or 443 outside (or let a reverse proxy handle it). Ports below 1024 have traditionally needed root, and some platforms still enforce that.

## Step 5: a health check

**`HEALTHCHECK`** tells Docker how to ask "are you actually working?". Docker runs the command every `--interval`. Exit code `0` means healthy, anything else means unhealthy.

The slim image does not include `curl`, so the check uses Node's built-in `fetch` to call `/healthz`. You can see the result in `docker ps`:

```text
CONTAINER ID   IMAGE       STATUS                    PORTS
3f2a1c9e8b7d   notes-api   Up 2 minutes (healthy)    0.0.0.0:3000->3000/tcp
```

Orchestrators like Docker Swarm use this status to restart broken containers. Kubernetes ignores `HEALTHCHECK` and uses its own probes, but they usually call the same `/healthz` URL.

## Step 6: signals and PID 1

When you run `docker stop`, Docker sends **SIGTERM** (a polite "please shut down" message) to your app. If the app is still running 10 seconds later, Docker sends **SIGKILL**, which ends it instantly.

There is a catch. Inside a container, your app is **PID 1**, the first process. Linux treats PID 1 specially: signals that have no handler are ignored instead of stopping the process. PID 1 is also expected to clean up finished child processes ("reaping zombies"), which Node does not do.

You have two fixes, and you should use both:

**1. Handle SIGTERM in your code**, as you learned in [the Graceful Shutdown lesson](/courses/nodejs/graceful-shutdown):

```javascript
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

**2. Run a tiny init process in front of Node.** The easiest way is the `--init` flag, which makes Docker start **tini**, a minimal init program that forwards signals and reaps zombies:

```bash
docker run --init -p 3000:3000 notes-api
```

If your platform does not support `--init` (Kubernetes, for example), install tini in the image instead:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
```

On Alpine it is `RUN apk add --no-cache tini` and the path is `/sbin/tini`.

> **Tip:** Always use the JSON array form for `CMD`, like `["node", "server.js"]`. The plain form `CMD node server.js` wraps your app in a shell, and the shell may not pass SIGTERM on. Also prefer `node` over `npm start`, so there is no extra process in the middle.

## Building and running

```bash
# Build the image and give it a name (a "tag")
docker build -t notes-api .

# Run it, mapping port 3000 on your machine to 3000 in the container
docker run --init --rm -p 3000:3000 --env-file .env notes-api

# In another terminal
curl http://localhost:3000/healthz
```

```text
ok
```

- `-p 3000:3000` maps `host port : container port`.
- `--env-file .env` passes settings at run time, so secrets never go into the image.
- `--rm` deletes the container when it stops.

With Docker Compose, the same settings live in a file:

```yaml
# compose.yaml
services:
  api:
    build: .
    init: true
    ports:
      - '3000:3000'
    env_file: .env
    restart: unless-stopped
```

Start it with `docker compose up --build`.

## Common mistakes

**Listening on localhost inside the container.** `127.0.0.1` inside a container means "this container only", so the port mapping cannot reach it.

```javascript
// Wrong: unreachable from outside the container
server.listen(3000, '127.0.0.1');
```

```javascript
// Right: listen on all interfaces (the default when you pass no host)
server.listen(3000);
```

**Copying code before installing.** Every code change then reinstalls every dependency. Copy the package files first.

**Baking secrets into the image.** `COPY . .` with no `.dockerignore`, or `ENV API_KEY=...` in the Dockerfile, puts secrets into a layer that anyone with the image can read. Pass them at run time.

**Using `npm install` instead of `npm ci`.** `npm install` may update the lockfile and pick different versions than you tested.

## Quick recap

- An image is a packed snapshot of your app and its Node version; a container is a running copy.
- Use an official `node:24-slim` (or `-alpine`) base image and a `.dockerignore` that excludes `node_modules` and `.env`.
- Copy `package.json` and the lockfile before your code so the install layer is cached.
- A multi-stage build compiles in one stage and ships only the output with `npm ci --omit=dev`.
- Switch to the built-in `node` user with `USER node`.
- Add a `HEALTHCHECK` that calls a `/healthz` route.
- Handle SIGTERM in code, use the JSON form of `CMD`, and run with `--init` (or tini) so signals reach Node.

<code id="code-content" class="language-javascript">
// server.mjs: a container-friendly Node server.
// In Docker: CMD ["node", "server.mjs"]   Locally: node server.mjs
import http from 'node:http';
// Config comes from environment variables (docker run -e PORT=8080 ...)
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0'; // all interfaces, not localhost
const notes = [
  { id: 1, title: 'Buy milk', author: 'Asha' },
  { id: 2, title: 'Call Ravi', author: 'Maya' },
];
let shuttingDown = false;
const server = http.createServer((req, res) =&gt; {
  // Health check endpoint used by HEALTHCHECK and load balancers
  if (req.url === '/healthz') {
    res.writeHead(shuttingDown ? 503 : 200, { 'content-type': 'text/plain' });
    return res.end(shuttingDown ? 'shutting down' : 'ok');
  }
  if (req.url === '/notes') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(notes));
  }
  res.writeHead(404).end('Not found');
});
server.listen(PORT, HOST, () =&gt; {
  // process.getuid only exists on Linux and macOS; in the container it prints 1000 (the node user)
  console.log(`Listening on http://${HOST}:${PORT} as user ${process.getuid?.() ?? 'n/a'}`);
});
// docker stop sends SIGTERM; Ctrl+C sends SIGINT. Handle both.
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, closing server...`);
  // Stop accepting new connections and let in-flight requests finish
  server.close(() =&gt; {
    console.log('All connections closed, bye.');
    process.exit(0);
  });
  server.closeIdleConnections();
  // Docker sends SIGKILL after 10 seconds, so give up a little earlier
  setTimeout(() =&gt; process.exit(1), 8000).unref();
}
process.on('SIGTERM', () =&gt; shutdown('SIGTERM'));
process.on('SIGINT', () =&gt; shutdown('SIGINT'));
</code></pre>

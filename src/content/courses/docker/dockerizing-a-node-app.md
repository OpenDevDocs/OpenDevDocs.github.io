---
publishDate: 2026-10-25T16:20
title: 'Project: Dockerizing a Node.js App'
slug: dockerizing-a-node-app
metadescription: 'Build a production-ready Docker image for a small Node.js API step by step, with caching, a non-root user, a health check and graceful shutdown.'
updateDate: 2026-10-25T16:20
author: ['bishal-biswas']
level: 2
tags: ['docker', 'nodejs', 'project', 'dockerfile']
course: docker
---

## What you will build

In this project you will take the **notes-api** app from an empty folder to a finished, production-ready Docker image. You will use everything from the "Writing Dockerfiles" section of this course:

- A small, cache-friendly Dockerfile ([Layer Caching](/courses/docker/layer-caching))
- A `.dockerignore` file ([The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore))
- A non-root user ([Running Containers as a Non-Root User](/courses/docker/running-as-non-root))
- A health check ([Health Checks](/courses/docker/healthchecks))
- Exec form `CMD` so the app shuts down cleanly ([CMD vs ENTRYPOINT](/courses/docker/cmd-vs-entrypoint))

By the end you will have an image that starts fast, stops cleanly, reports its health, and is safe to deploy.

You need Docker installed and a terminal. Node.js on your computer is helpful (to create the lock file) but not required for running the final image.

## Step 1: create the app

Make a folder with this layout:

```text
notes-api/
  package.json
  package-lock.json
  src/
    server.js
  .dockerignore
  Dockerfile
```

Start with `package.json`. The app uses only Node's built-in modules, so it has no dependencies:

```json
{
  "name": "notes-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test"
  }
}
```

`"type": "module"` lets you use `import` instead of `require`. You can read more about this file in [package.json Explained](/courses/nodejs/package-json-explained).

Now `src/server.js`:

```javascript
import http from 'node:http';

// Read the port from the environment, with 3000 as the default
const port = Number(process.env.PORT ?? 3000);

const notes = [
  { id: 1, text: 'Learn Docker' },
  { id: 2, text: 'Write a Dockerfile' },
];

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  if (req.method === 'GET' && req.url === '/notes') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(notes));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

// 0.0.0.0 means "all network interfaces", so traffic from outside the container can reach us
server.listen(port, '0.0.0.0', () => {
  console.log(`notes-api listening on port ${port}`);
});

// docker stop sends SIGTERM. Stop accepting new requests, finish open ones, then exit.
function shutdown(signal) {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

Two lines matter a lot for Docker:

- `'0.0.0.0'`: if the app listened on `127.0.0.1`, it would only accept connections from inside the container itself, and `-p` would not work.
- The `SIGTERM` handler: this is how the app finishes its work when Docker stops it. You can learn more in [Graceful Shutdown](/courses/nodejs/graceful-shutdown).

Create the lock file. Even with no dependencies, `npm ci` needs it:

```bash
npm install
```

> **Tip:** No Node.js on your computer? Create the lock file with Docker itself: `docker run --rm -v "$PWD":/app -w /app node:24-alpine npm install`.

## Step 2: add a .dockerignore

This keeps junk and secrets out of the build context:

```text
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
Dockerfile
.dockerignore
*.md
```

Ignoring `node_modules` is important. Your local `node_modules` may contain packages built for Windows or macOS, which would break inside a Linux container. The image installs its own.

## Step 3: write the Dockerfile

Here is the full Dockerfile. Read the comments, then the notes below it.

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine

# Tells libraries to run in production mode
ENV NODE_ENV=production
WORKDIR /app

# Dependency files first, for good layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Then the source code
COPY src ./src

# Do not run as root
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

# Exec form: node is PID 1 and receives SIGTERM directly
CMD ["node", "src/server.js"]
```

Why each choice:

| Line | Reason |
|---|---|
| `node:24-alpine` | Small official image with Node.js 24 (an LTS release) |
| `npm ci --omit=dev` | Installs exactly what the lock file says, without dev tools |
| `npm cache clean --force` | Removes npm's download cache so the layer is smaller |
| `COPY src ./src` | Copies only the code, not everything in the folder |
| `USER node` | The ready-made non-root user in Node.js images |
| `wget` in the health check | `node:24-alpine` has BusyBox `wget` but no `curl` |
| `CMD ["node", ...]` | Not `npm start`: npm would sit between Docker and your app and can get in the way of signals |

## Step 4: build the image

```bash
docker build -t notes-api:1.0.0 .
docker images notes-api
```

```text
REPOSITORY   TAG     IMAGE ID       CREATED         SIZE
notes-api    1.0.0   4c9e2a7b13d0   5 seconds ago   162MB
```

Almost all of that size is Node.js itself. Your app adds only a few kilobytes. Change a line in `server.js` and build again: the `npm ci` step should say `CACHED`.

## Step 5: run and test it

```bash
docker run -d --name notes-api -p 3000:3000 notes-api:1.0.0
curl http://localhost:3000/notes
```

```json
[{"id":1,"text":"Learn Docker"},{"id":2,"text":"Write a Dockerfile"}]
```

Check the logs, the health and the user:

```bash
docker logs notes-api
docker ps --filter name=notes-api
docker exec notes-api whoami
```

```text
notes-api listening on port 3000
```

```text
CONTAINER ID   IMAGE             STATUS                    PORTS                    NAMES
e5b07f1c8a2d   notes-api:1.0.0   Up 40 seconds (healthy)   0.0.0.0:3000->3000/tcp   notes-api
```

```text
node
```

## Step 6: change the configuration

Because the port comes from `process.env.PORT`, you can change it without rebuilding. You learned this in [Configuring Containers with Environment Variables](/courses/docker/environment-variables).

```bash
docker run -d --name notes-api-8080 -e PORT=8080 -p 8080:8080 notes-api:1.0.0
curl http://localhost:8080/health
```

```text
ok
```

> **Warning:** The health check in the Dockerfile still calls port 3000, so this container will become `unhealthy`. In real projects, either keep the internal port fixed (and change only the host side of `-p`), or make the health check read `$PORT` too.

Clean up the extra container:

```bash
docker rm -f notes-api-8080
```

## Step 7: test graceful shutdown

Stop the main container and time it:

```bash
time docker stop notes-api
docker logs notes-api
```

```text
notes-api
real    0m0.4s
```

```text
notes-api listening on port 3000
SIGTERM received, closing server
```

The container stopped in under a second, and the log shows your handler ran. If you had used the shell form `CMD node src/server.js`, a shell would sit in front of Node.js and might not pass the signal on. Docker would wait the full 10 seconds and then kill the app with `SIGKILL`, cutting off any requests in progress.

## Bonus: let `docker init` start it for you

For new projects, `docker init` asks a few questions and writes a starter `Dockerfile`, `compose.yaml` and `.dockerignore`:

```bash
docker init
```

It is a good starting point, but always read what it generates. Now that you understand every line of a Dockerfile, you can adjust it with confidence. For more Node.js specific advice, see [Dockerising Node Applications](/courses/nodejs/dockerising-node-applications) and [Dockerising an Express API](/courses/expressjs/dockerising-an-express-api).

## Troubleshooting

| Problem | Likely cause |
|---|---|
| `curl` says "connection refused" or "empty reply" | App listens on `127.0.0.1` instead of `0.0.0.0`, or `-p` is missing |
| `npm ci` fails: "requires a package-lock.json" | The lock file was not created or is in `.dockerignore` |
| `docker stop` takes exactly 10 seconds | Shell form `CMD`, `npm start`, or no `SIGTERM` handler |
| Status stays `unhealthy` | Wrong port in the health check, or a tool missing from the image |
| `EACCES: permission denied` | App writes to a folder owned by root. See the non-root lesson |

When a container will not start at all, [Debugging Containers That Will Not Start](/courses/docker/debugging-containers) has a step by step method.

## Quick recap

- The app listens on `0.0.0.0`, reads `PORT` from the environment and handles `SIGTERM`.
- `.dockerignore` keeps `node_modules`, `.git` and `.env` out of the image.
- Copy package files, run `npm ci --omit=dev`, then copy the source.
- Run as `node`, add a `HEALTHCHECK`, and start with exec form `CMD ["node", "src/server.js"]`.
- Test the image: request the API, check logs, health and user, and time `docker stop`.

Next, you will do the same for a Python web app in [Project: Dockerizing a Python App](/courses/docker/dockerizing-a-python-app).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Production-ready Dockerfile for notes-api (Node.js 24, no build step).
# Build: docker build -t notes-api:1.0.0 .
# Run:   docker run -d --name notes-api -p 3000:3000 notes-api:1.0.0
# Test:  curl http://localhost:3000/notes
# Stop:  docker stop notes-api   (should take under a second)
#
FROM node:24-alpine
# Tell libraries to run in production mode
ENV NODE_ENV=production
WORKDIR /app
# 1. Dependency files first, so npm ci stays cached when only code changes
COPY package.json package-lock.json ./
# 2. Exact versions from the lock file, no dev dependencies, no download cache
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
# 3. Only the source code (.dockerignore keeps node_modules, .git and .env out)
COPY src ./src
# 4. Run as the unprivileged "node" user that the official image provides
USER node
# 5. Document the port the app listens on (publish it with -p at run time)
EXPOSE 3000
# 6. Mark the container healthy only when /health answers
#    (BusyBox wget is in node:24-alpine, curl is not)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
# 7. Exec form: node is PID 1 and receives SIGTERM from docker stop
CMD ["node", "src/server.js"]
</code></pre>

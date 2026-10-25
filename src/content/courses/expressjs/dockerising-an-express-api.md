---
publishDate: 2026-10-25T10:01
title: Dockerising an Express API
slug: dockerising-an-express-api
metadescription: Learn to package an Express 5 API in a small, secure Docker image with a multi-stage build, a non-root user and a health check, then run it with a database using Docker Compose.
updateDate: 2026-10-25T10:01
author: ['bishal-biswas']
level: 4
tags: ['express', 'docker', 'deployment', 'devops']
course: expressjs
---

## What you will learn

- What **containers**, **images** and **Dockerfiles** are, in plain words
- How to write a production-ready **multi-stage** Dockerfile for an Express 5 API
- Why the image should run as a **non-root user** and include a **health check**
- How to run your API next to MongoDB with **Docker Compose**
- The classic Docker mistakes and how to avoid them

## The problem Docker solves

"It works on my machine" is one of the oldest jokes in software. Your laptop has Node 22, the server has Node 18. Your laptop is Windows, the server is Linux. A native package compiled on one doesn't run on the other.

**Docker** solves this by packing your app *together with* everything it needs to run: the right Node.js version, the operating system files, your `node_modules` and your code. That bundle runs the same way on your laptop, in CI and on any server.

Think of a **shipping container**. The ship doesn't care whether it carries bananas or bicycles; every container has the same shape and the same hooks. Docker gives your app the same standard shape.

Three words to know:

| Term | Meaning | Analogy |
| --- | --- | --- |
| **Dockerfile** | A text file with step-by-step instructions to build the package | The recipe |
| **Image** | The finished, read-only package built from the Dockerfile | The cake in the box |
| **Container** | A running instance of an image | A slice being eaten. You can run many containers from one image. |

You'll need Docker Desktop (Windows and macOS) or Docker Engine (Linux) installed.

## Get the app ready first

A container-friendly Express app follows a few rules you've already learned:

1. **Reads its port from the environment.** The platform decides the port, not you.
2. **Has a health endpoint**, so Docker can check if it's alive.
3. **Shuts down gracefully on `SIGTERM`**, the signal Docker sends when stopping a container.
4. **Has a `package-lock.json`** committed, so installs are repeatable.

```js
// server.js
import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, (error) => {
  if (error) throw error;
  console.log(`Listening on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server');
  server.close(() => process.exit(0));
});
```

```js
// app.js
import express from 'express';

export const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from a container' });
});
```

> **Note:** `app.listen(port)` with no host listens on all network interfaces, which is what you want inside a container. If you ever pass `'127.0.0.1'` as the host, the app is only reachable from inside the container itself.

## Step 1: The .dockerignore file

When you build, Docker sends your project folder to the builder. This is called the **build context**. A `.dockerignore` file lists what to leave out, just like `.gitignore`.

```text
# .dockerignore
node_modules
npm-debug.log
.git
.env
.env.*
coverage
Dockerfile
.dockerignore
```

The two most important lines:

- `node_modules`: your host's packages may be built for the wrong operating system. The image installs its own.
- `.env`: secrets must never be baked into an image. Anyone who can pull the image could read them.

## Step 2: A first, simple Dockerfile

Let's start simple to see the basic instructions:

```dockerfile
# Dockerfile (simple version)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Line by line:

| Instruction | What it does |
| --- | --- |
| `FROM node:22-alpine` | Start from an official image with Node 22 on **Alpine Linux**, a very small Linux distribution |
| `WORKDIR /app` | Create `/app` and work inside it |
| `COPY package*.json ./` | Copy `package.json` and `package-lock.json` only |
| `RUN npm ci --omit=dev` | Install exact versions from the lock file, without dev dependencies |
| `COPY . .` | Copy the rest of your code |
| `EXPOSE 3000` | Document which port the app uses |
| `CMD ["node", "server.js"]` | The command that runs when a container starts |

### Why copy package files first?

Docker builds images in **layers**, one per instruction, and **caches** each layer. If nothing a layer depends on has changed, Docker reuses it instead of running the step again.

```text
 FROM node:22-alpine          cached
 COPY package*.json ./        cached   (you didn't change dependencies)
 RUN npm ci --omit=dev        cached   (the slow step is skipped!)
 COPY . .                     rebuilt  (you edited app.js)
```

By copying the package files before the code, editing `app.js` doesn't trigger a full reinstall. Builds go from minutes to seconds.

> **Tip:** `npm ci` is made for automated builds. It installs exactly what's in `package-lock.json` and fails if the lock file doesn't match `package.json`. `npm install` might quietly change versions.

## Step 3: The production Dockerfile

The simple version works, but it has three weaknesses: it runs as **root** (the all-powerful admin user), it doesn't set production mode, and Docker can't tell whether the app is healthy. A **multi-stage build** also lets us keep build tools out of the final image.

A **multi-stage build** uses several `FROM` lines. Earlier stages do the messy work; the final stage copies only the results. It's like cooking in a busy kitchen but serving only the clean plate.

```dockerfile
# Dockerfile
# ---- Stage 1: install production dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Stage 2: the small runtime image ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Copy dependencies and code, owned by the unprivileged "node" user
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# Never run as root
USER node

EXPOSE 3000

# Ask the app itself if it's healthy (Alpine has no curl, but Node 22 has fetch)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
```

What each improvement gives you:

- **`ENV NODE_ENV=production`**: Express and many libraries switch to production behaviour, such as caching views and hiding stack traces in default error pages.
- **`USER node`**: the official Node images include a user called `node`. If an attacker ever breaks into your app, they don't get root inside the container.
- **`--chown=node:node`**: makes the copied files belong to that user.
- **`HEALTHCHECK`**: Docker runs the command regularly. Exit code `0` means healthy, `1` means unhealthy. Orchestrators use this to restart broken containers.

### Build and run it

```bash
docker build -t notes-api .
docker run --rm -p 3000:3000 --name notes-api notes-api
```

`-p 3000:3000` connects port 3000 on your machine to port 3000 in the container. In another terminal:

```bash
curl http://localhost:3000/api/hello
docker ps
```

```text
{"message":"Hello from a container"}

CONTAINER ID   IMAGE       STATUS                    PORTS                    NAMES
3f2c1a9b7d10   notes-api   Up 40 seconds (healthy)   0.0.0.0:3000->3000/tcp   notes-api
```

See the `(healthy)` status? That's your `HEALTHCHECK` at work.

### Passing configuration

Configuration comes in at **run time**, not build time. Use `-e` for single values or `--env-file` for a file that stays on the server:

```bash
docker run --rm -p 3000:3000 --env-file .env.production notes-api
```

### A TypeScript version

If your app is written in TypeScript (as in [TypeScript with Express 5](/courses/expressjs/typescript-with-express)), add a **build stage** that has dev dependencies and compiles the code. Only the compiled JavaScript reaches the final image.

```dockerfile
# Dockerfile (TypeScript)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
```

`package.json` is copied so Node can see `"type": "module"`. TypeScript, `tsx` and type packages never reach production.

## Step 4: Signals and PID 1

When you run `docker stop`, Docker sends `SIGTERM` to the main process in the container, waits (10 seconds by default), then forces it to stop with `SIGKILL`.

The main process in a container gets **process ID 1** (**PID 1**). PID 1 is special in Linux: it doesn't get default signal handling. Two rules keep shutdown working:

1. **Use the exec form of `CMD`**: `CMD ["node", "server.js"]` with square brackets. The shell form, `CMD node server.js`, starts a shell that may not pass `SIGTERM` on to Node.
2. **Don't start through `npm start`** in production images. npm adds another process in between that can swallow signals.

For extra safety, run with Docker's tiny built-in init process, which forwards signals and cleans up zombie processes:

```bash
docker run --init --rm -p 3000:3000 notes-api
```

Your `SIGTERM` handler from [Graceful Shutdown and Health Checks](/courses/expressjs/graceful-shutdown-and-health-checks) then gets a chance to finish in-flight requests.

## Step 5: Docker Compose for the API and its database

Real APIs need a database. **Docker Compose** runs several containers together from one YAML file, with a private network between them.

```yaml
# compose.yaml
services:
  api:
    build: .
    init: true
    ports:
      - '3000:3000'
    environment:
      PORT: 3000
      MONGO_URL: mongodb://mongo:27017/notes
    depends_on:
      mongo:
        condition: service_healthy

  mongo:
    image: mongo:8
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ['CMD', 'mongosh', '--quiet', '--eval', "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo-data:
```

Notice the database address: `mongodb://mongo:27017`. Inside Compose, each service is reachable by its **service name**. `localhost` inside the API container means *the API container itself*, not your laptop and not the database.

- `depends_on` with `service_healthy` waits until MongoDB passes its health check before starting the API.
- The **volume** `mongo-data` keeps your data when containers are recreated.
- `init: true` is the Compose version of `--init`.

```bash
docker compose up --build
docker compose logs -f api
docker compose down
```

> **Warning:** This Compose file is for local development. A production database needs authentication, backups and usually a managed service. Never expose MongoDB's port to the internet without a password.

## Keeping images small and safe

| Habit | Why |
| --- | --- |
| Use `node:22-alpine` or `node:22-slim` | Smaller images download and start faster, and contain fewer things that could have security holes |
| Pin the major version (`node:22-alpine`, not `node:latest`) | Builds don't change under you when a new Node version comes out |
| `npm ci --omit=dev` | No test tools or compilers in production |
| `USER node` | Limits damage if the app is compromised |
| No secrets in the Dockerfile or image | Images are often shared and stored in registries |
| Scan images (for example `docker scout`) | Finds known vulnerabilities in OS packages and dependencies |

Check your image size with:

```bash
docker images notes-api
```

## Common mistakes

> **Common mistake:** Connecting to `localhost:27017` from the API container. Use the Compose service name (`mongo`) instead.

> **Common mistake:** Copying `node_modules` from your machine into the image. Packages with native code (like `bcrypt`) compiled on Windows or macOS won't run on Alpine Linux. Always add `node_modules` to `.dockerignore`.

> **Common mistake:** Copying `.env` into the image. Pass configuration with `-e`, `--env-file` or your platform's secret settings.

> **Common mistake:** `COPY . .` before `npm ci`. Every code change then reinstalls all dependencies and builds become slow.

> **Common mistake:** Using `CMD npm start`. Signals may not reach Node, so the container is killed after the timeout instead of shutting down gracefully.

## Key takeaways

- A **Dockerfile** is the recipe, an **image** is the package, a **container** is a running copy.
- Copy `package*.json` and run `npm ci --omit=dev` **before** copying code, so Docker's layer cache keeps builds fast.
- A **multi-stage** build keeps build tools out of the final image; use a build stage for TypeScript.
- Run as `USER node`, set `NODE_ENV=production`, and add a `HEALTHCHECK`.
- Use exec-form `CMD ["node", "server.js"]` plus `--init` so `SIGTERM` reaches your graceful shutdown code.
- In Docker Compose, services talk to each other by **service name**, not `localhost`.

## Practice

1. Write a `.dockerignore` and the production Dockerfile for your Notes API. Build it and confirm `docker ps` shows `(healthy)`.
2. Change one line in `app.js`, rebuild, and watch which steps say `CACHED`.
3. Create a `compose.yaml` that runs your API with MongoDB, and check that notes survive a `docker compose down` and `up` (thanks to the volume).
4. Make the health check fail on purpose (return a `500` from `/health`) and watch the status change to `(unhealthy)`.

## What's next

In production your container usually sits behind a reverse proxy or load balancer, which changes what Express sees about each request. Continue with [Reverse Proxies and Trusting Proxy Headers](/courses/expressjs/reverse-proxies-and-trust-proxy).

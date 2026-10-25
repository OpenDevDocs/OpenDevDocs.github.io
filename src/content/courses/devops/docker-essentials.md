---
publishDate: 2026-10-25T11:45
title: 'Docker Essentials: Images, Containers and Dockerfiles'
slug: docker-essentials
metadescription: Learn the Docker essentials, running containers, ports, volumes and logs, writing a Dockerfile, layer caching, multi-stage builds, small secure images, and pushing images to a registry from CI.
updateDate: 2026-10-25T11:45
author: ['bishal-biswas']
level: 2
tags: ['devops', 'docker', 'containers', 'dockerfile']
course: devops
---

## Docker in one lesson

In [Containers vs Virtual Machines](/courses/devops/containers-vs-virtual-machines) you learned **what** containers are. Now you will use the most popular tool for working with them: **Docker**.

By the end of this lesson you will be able to run any containerised software, read and write a **Dockerfile**, build a small, secure image for a Node.js app, and push it to a registry from your pipeline.

> **Note:** This lesson covers the Docker you need for DevOps work. For much more depth on networking, storage, Compose, BuildKit and security, take the full [Docker course](/courses/docker/what-is-docker).

## Installing Docker

- **Windows and macOS:** install **Docker Desktop** from docker.com. On Windows it uses WSL 2 under the hood.
- **Linux servers:** install **Docker Engine** by following the official instructions for your distribution on docs.docker.com, which add Docker's own package repository so you get current versions.

Check that it works:

```bash
docker version
docker run hello-world
```

```text
Hello from Docker!
This message shows that your installation appears to be working correctly.
...
```

That one command did a lot: Docker looked for the `hello-world` image locally, did not find it, **pulled** (downloaded) it from **Docker Hub**, created a container from it, ran it, and printed its output.

> **Tip:** On Linux, add yourself to the `docker` group (`sudo usermod -aG docker $USER`, then log out and in) so you do not need `sudo` for every command. Be aware that membership of this group is effectively root access to the machine.

## Running containers

### The basics

```bash
docker run -it --rm ubuntu:24.04 bash     # an interactive Ubuntu shell; deleted when you exit
docker run -d --name web -p 8080:80 nginx:1.29   # run nginx in the background
docker ps                                  # list running containers
docker ps -a                               # ...including stopped ones
```

```text
CONTAINER ID   IMAGE        COMMAND                  STATUS          PORTS                  NAMES
4b1e0c7a92f3   nginx:1.29   "/docker-entrypoint.…"   Up 12 seconds   0.0.0.0:8080->80/tcp   web
```

The flags you will use constantly:

| Flag | Meaning |
|---|---|
| `-d` | **Detached**: run in the background |
| `-it` | **Interactive** with a terminal, for shells |
| `--rm` | Delete the container automatically when it stops |
| `--name web` | Give it a name instead of a random one |
| `-p 8080:80` | **Publish a port**: host port 8080 forwards to port 80 inside the container |
| `-e KEY=value` | Set an environment variable |
| `-v source:/path` | Mount a volume or a host folder into the container |

Open `http://localhost:8080` and you will see nginx's welcome page, served from inside the container.

### Ports

A container has its own network namespace, so a program listening on port 80 inside it is **not** reachable from outside until you publish the port with `-p host:container`. The two numbers do not have to match: `-p 8080:80` and `-p 9000:80` both reach the same nginx.

> **Note:** Your app must listen on `0.0.0.0` inside the container, not `127.0.0.1`. Published traffic arrives from outside the container's own loopback, so an app bound to `127.0.0.1` will never see it. You met this in [IP Addresses, Ports and Protocols](/courses/devops/ip-addresses-ports-and-protocols).

### Looking inside and cleaning up

```bash
docker logs -f web            # follow the container's output (Ctrl+C to stop following)
docker exec -it web sh        # open a shell inside the running container
docker inspect web            # every detail, as JSON
docker stats                  # live CPU and memory use per container
docker stop web               # stop gracefully (SIGTERM, then SIGKILL after 10 seconds)
docker rm web                 # delete the stopped container
docker images                 # list images on this machine
docker rmi nginx:1.29         # delete an image
docker system prune           # remove stopped containers, unused networks and dangling images
```

### Volumes: keeping data

A container's own writable layer is **thrown away** when the container is removed. Anything that must survive, such as database files, goes in a **volume**:

```bash
docker volume create pgdata
docker run -d --name db -e POSTGRES_PASSWORD=devpassword \
  -v pgdata:/var/lib/postgresql/data postgres:17-alpine
```

Now you can delete and recreate the `db` container, for example to upgrade it, and the data stays in `pgdata`. A **bind mount** (`-v "$PWD:/app"`) shares a folder from your computer instead, which is handy during development.

## Image names and tags

An image's full name has up to four parts:

```text
ghcr.io / your-name / recipe-api : 1.0.0
   |          |           |          |
registry  namespace   repository    tag
```

When parts are missing, Docker fills in defaults: `nginx:1.29` really means `docker.io/library/nginx:1.29` (Docker Hub, official images). A missing tag means `:latest`, which, as you learned in [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning), is just "whatever was pushed last". Always use specific tags.

## Writing a Dockerfile

A **Dockerfile** is a recipe for building an image: a list of instructions, run top to bottom. Here are the ones you will use most:

| Instruction | What it does |
|---|---|
| `FROM node:24-alpine` | Start from a **base image** |
| `WORKDIR /app` | Set the working folder for the following instructions (creates it if needed) |
| `COPY src dest` | Copy files from the **build context** (your project folder) into the image |
| `RUN npm ci` | Run a command at **build** time; the result becomes a new layer |
| `ENV NODE_ENV=production` | Set an environment variable for the build and the running container |
| `EXPOSE 3000` | Document which port the app listens on (it does not publish it) |
| `USER node` | Run the following instructions, and the container, as this user |
| `HEALTHCHECK` | A command Docker runs regularly to decide if the container is healthy |
| `CMD ["node", "dist/server.js"]` | The default command when a container **starts** |

### A first Dockerfile

Take the `recipe-api` project from [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline) and give it a small web server, `src/server.js`:

```javascript
import http from 'node:http';
import { total } from './price.js';

const port = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') return res.end('ok');
  if (url.pathname === '/total') {
    const prices = (url.searchParams.get('prices') ?? '').split(',').filter(Boolean).map(Number);
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ total: total(prices) }));
  }
  res.statusCode = 404;
  res.end('not found');
});

// 0.0.0.0, not 127.0.0.1: inside a container, requests arrive from outside it
server.listen(port, '0.0.0.0', () => console.log(`recipe-api listening on port ${port}`));

// Docker sends SIGTERM to stop a container: finish open requests, then exit
process.on('SIGTERM', () => server.close(() => process.exit(0)));
```

The simplest Dockerfile that works looks like this:

```docker
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
CMD ["node", "dist/server.js"]
```

It works, but it has three problems: it rebuilds everything whenever **any** file changes, it ships ESLint and every other dev tool to production, and it runs as **root**. The code panel has the improved version. Let us look at what it fixes.

## Layer caching: order matters

Every instruction creates a **layer**, and Docker **caches** layers. When you rebuild, Docker reuses each cached layer until it reaches the first instruction whose inputs changed; from there on, everything is rebuilt.

In the simple Dockerfile, `COPY . .` comes before `RUN npm ci`. Change one line of code, and the copied files change, so `npm ci` runs again from scratch, which is slow.

The fix is to copy the **package files first**, install, and only then copy the rest:

```docker
COPY package.json package-lock.json ./
RUN npm ci                 # cached until package.json or the lock file changes
COPY . .                   # source code changes often; only the steps after this rerun
RUN npm run build
```

Now a code change reuses the cached `npm ci` layer, and rebuilds take seconds. The rule: **put the things that change least at the top**.

## .dockerignore

`COPY . .` copies your whole project folder (the **build context**) into the image. Keep junk and secrets out with a `.dockerignore` file next to the Dockerfile:

```text
node_modules
dist
.git
.env
*.log
```

This makes builds faster, images smaller, and makes sure your local `.env` with real passwords never ends up inside an image.

## Multi-stage builds

A **multi-stage build** uses several `FROM` lines in one Dockerfile. Early stages have all the heavy build tools; the final stage copies in **only** the finished output:

```docker
FROM node:24-alpine AS build
# ...install everything, run the build...

FROM node:24-alpine
COPY --from=build /app/dist ./dist
# ...only production dependencies...
```

Only the last stage becomes your image. Compilers, dev dependencies and source files stay behind in the build stage. For compiled languages such as Go, Rust or .NET, the difference can be hundreds of megabytes.

## Small and secure images

- **Choose a small base.** The full `node:24` image includes a whole Debian system with compilers, often over 1 GB. `node:24-slim` is much smaller, and `node:24-alpine` (based on the tiny **Alpine Linux**) smaller still. Alpine uses a different C library (**musl**), which occasionally causes trouble for packages with native code; if so, use `-slim`. **Distroless** images go further and contain no shell at all.
- **Do not run as root.** Add `USER node` (the official Node images include a `node` user). If an attacker breaks into the app, they are not root inside the container.
- **One main process per container.** Run the web app in one container and the database in another, not both in one. Compose and Kubernetes connect them.
- **Log to stdout and stderr.** Do not write log files inside the container: `docker logs` and every log collector read the standard output streams. See [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).
- **Never put secrets in an image.** Anything copied or set in a Dockerfile stays in the image's layers, even if a later step deletes it, and anyone who can pull the image can read it. Pass secrets in at run time. See [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).
- **Use the exec form for `CMD`.** `CMD ["node", "dist/server.js"]` runs Node directly as PID 1, so it receives the `SIGTERM` that `docker stop` sends and can shut down cleanly. The shell form, `CMD node dist/server.js`, wraps it in a shell that may not pass the signal on, and the container is killed after a 10-second wait.

## Building and running your image

With the code panel's Dockerfile saved in the project folder:

```bash
docker build -t recipe-api:1.0.0 .
docker run -d --name recipe-api -p 3000:3000 recipe-api:1.0.0
curl "http://localhost:3000/total?prices=100,250"
```

```text
{"total":350}
```

The `.` at the end of `docker build` is the **build context**: the folder whose files `COPY` can see. After about 30 seconds, `docker ps` shows the result of the `HEALTHCHECK` in the STATUS column, such as `Up 2 minutes (healthy)`.

## Pushing to a registry

To run the image anywhere else, push it to a **registry**. With GitHub Container Registry:

```bash
docker login ghcr.io -u your-name          # use a personal access token as the password
docker tag recipe-api:1.0.0 ghcr.io/your-name/recipe-api:1.0.0
docker push ghcr.io/your-name/recipe-api:1.0.0
```

In a real pipeline, CI does this for you. Docker's official actions for GitHub Actions build and push in a few lines, using the automatic `GITHUB_TOKEN`:

```yaml
  image:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write                       # allow pushing to GitHub Container Registry
    steps:
      - uses: actions/checkout@v5
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/${{ github.repository }}:sha-${{ github.sha }}
```

> **Note:** Image names must be **lowercase**. If your GitHub username or repository name has capital letters, write the image name out in lowercase instead of using `${{ github.repository }}`.

Every commit to `main` now produces an image tagged with its exact commit, ready for the deployment pipeline you built in [Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment).

## Common misunderstandings

### "EXPOSE publishes the port"

`EXPOSE` is only documentation. The port is reachable from the host only when you run the container with `-p`.

### "I can change files in a running container to fix it"

You can, with `docker exec`, but the change disappears when the container is replaced, and the next deployment brings the bug back. Fix the code or Dockerfile, build a new image and redeploy. Containers are meant to be **disposable**.

### "Deleting a secret in a later RUN step removes it"

Each instruction is a separate layer. The secret still sits in the earlier layer and can be extracted with standard tools. Keep secrets out of the build entirely.

## Quick recap

- `docker run` starts containers: `-d` background, `-p host:container` ports, `-e` variables, `-v` volumes, `--rm` auto-delete.
- `docker ps`, `logs`, `exec`, `stop` and `rm` are your everyday tools; **volumes** keep data that must survive.
- A **Dockerfile** builds an image layer by layer: `FROM`, `WORKDIR`, `COPY`, `RUN`, `USER`, `CMD`.
- Order instructions for **layer caching**: package files and installs before source code.
- Use **.dockerignore**, **multi-stage builds**, a small base image and a **non-root user**; never bake in secrets.
- Tag images specifically and **push** them to a registry from CI.

Next, you will run several containers together with one command in [Multi-Container Apps with Docker Compose](/courses/devops/docker-compose-basics).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Dockerfile for recipe-api: a small, production-ready image built in two stages.
# Build it:  docker build -t recipe-api:1.0.0 .
# Run it:    docker run -d --name recipe-api -p 3000:3000 recipe-api:1.0.0
# ---------- Stage 1 "build": all the tools needed to build ----------
FROM node:24-alpine AS build
WORKDIR /app
# Copy only the package files first, so this slow layer is cached until they change
COPY package.json package-lock.json ./
RUN npm ci
# Now the source code, which changes often, and the build itself
COPY . .
RUN npm run build
# ---------- Stage 2: the final image, with nothing it does not need ----------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
# Take only the built output from stage 1; dev tools and source stay behind
COPY --from=build /app/dist ./dist
# Run as the unprivileged "node" user from the official image, never as root
USER node
EXPOSE 3000
# Docker marks the container "unhealthy" if this check keeps failing
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((r) =&gt; process.exit(r.ok ? 0 : 1)).catch(() =&gt; process.exit(1))"
# Exec form (a JSON list) so node is PID 1 and receives the stop signal directly
CMD ["node", "dist/server.js"]
</code></pre>

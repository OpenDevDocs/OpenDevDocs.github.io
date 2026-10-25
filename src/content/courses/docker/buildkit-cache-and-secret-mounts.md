---
publishDate: 2026-10-25T17:55
title: 'BuildKit Cache Mounts and Build Secrets'
slug: buildkit-cache-and-secret-mounts
metadescription: 'Learn to speed up Docker builds with RUN cache mounts, keep tokens out of image layers with secret mounts, and reuse build cache in CI pipelines.'
updateDate: 2026-10-25T17:55
author: ['bishal-biswas']
level: 3
tags: ['docker', 'buildkit', 'secrets', 'performance']
course: docker
---

## Two problems with RUN

Every `RUN` instruction in a Dockerfile runs in a fresh, empty environment, and everything it leaves behind becomes part of a layer. That simple rule causes two real problems.

**Problem 1: slow installs.** You add one package to `package.json`. The `npm ci` layer is no longer cached, so npm downloads **every** package again from the internet, even the 300 that did not change. On your laptop, npm normally keeps a download cache in `~/.npm`. Inside a build, that cache is thrown away each time.

**Problem 2: leaking secrets.** Your project uses a private npm package, so `npm ci` needs a token. If you `COPY` a file with the token, or pass it as a build argument, it ends up in the image. You learned in [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore) and [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env) why that is dangerous: anyone who pulls the image can read it, even if a later step deletes the file.

**BuildKit**, the build engine Docker uses by default, solves both with **mounts for RUN**. A mount makes something available **only while one RUN step runs**, and it never becomes part of the image. In this lesson you will learn:

- **cache mounts**, to keep package manager caches between builds
- **secret mounts**, to use tokens during a build without leaking them
- **SSH mounts**, for cloning private Git repositories
- how to keep build cache in **CI**, where every run starts on a fresh machine

## The syntax line

These features need a modern Dockerfile syntax. Put this line at the very top of your Dockerfile:

```docker
# syntax=docker/dockerfile:1
```

It tells BuildKit to use the newest stable version of the Dockerfile language. You have seen it in earlier lessons such as [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds).

## Cache mounts

A **cache mount** is a folder that BuildKit keeps between builds and attaches to a `RUN` step. It is like a shelf next to the kitchen where you keep ingredients you bought last time. The shelf is never part of the dish you serve.

You add it with `--mount=type=cache,target=<folder>`:

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# Keep npm's download cache between builds. It is NOT stored in the image.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev
COPY src ./src
CMD ["node", "src/server.js"]
```

`/root/.npm` is where npm keeps its cache when it runs as root, which is the default during a build. Now when `package.json` changes:

- the layer cache still misses, so `npm ci` runs again (that is correct, because dependencies changed)
- but npm finds most packages in `/root/.npm`, so it downloads only the new one

Compare two builds after adding one package:

```text
Without cache mount:   => [4/5] RUN npm ci --omit=dev        38.4s
With cache mount:      => [4/5] RUN --mount=type=cache,...    6.1s
```

> **Note:** A cache mount is different from **layer caching**, which you learned in [Layer Caching: Faster Builds by Ordering Instructions](/courses/docker/layer-caching). Layer caching skips a step completely when nothing changed. A cache mount makes a step faster when it **does** have to run. Use both.

### Cache folders for common tools

| Tool | Cache folder to mount |
|---|---|
| npm | `/root/.npm` |
| pip | `/root/.cache/pip` |
| Go modules | `/go/pkg/mod` (and `/root/.cache/go-build` for compiled code) |
| apt | `/var/cache/apt` and `/var/lib/apt` |

For example, for the Python **quotes-app** from [Project: Dockerizing a Python App](/courses/docker/dockerizing-a-python-app):

```docker
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt
```

> **Tip:** With a pip cache mount, remove `--no-cache-dir` from your `pip install`. That flag tells pip not to use its cache, which would defeat the purpose.

### Cache mounts for apt

Debian and Ubuntu images delete apt's download cache automatically after each install. To use a cache mount with apt, turn that off first. `sharing=locked` makes parallel builds take turns, because apt cannot share its cache safely:

```docker
FROM ubuntu:24.04
RUN rm -f /etc/apt/apt.conf.d/docker-clean
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends curl
```

### Where does the cache live?

Cache mounts are stored by the builder, not in any image. See how much space the build cache uses, and clear it:

```bash
docker buildx du               # disk usage of the build cache
docker builder prune           # remove unused build cache
```

You learned about cleaning up in [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker). Clearing the cache is always safe. The next build is just slower.

## Secret mounts

A **secret mount** makes a secret available as a file during **one** RUN step. The file is not in the build context, not in any layer and not in the image history.

There are two parts: the Dockerfile says which secret it needs, and the `docker build` command supplies it.

### Step 1: the Dockerfile

For a private npm package, npm reads its token from a `.npmrc` file. A safe way is to keep a `.npmrc` that refers to an environment variable, and fill the variable from the secret only during `npm ci`:

```text
# .npmrc (safe to commit: it contains no token, only a variable name)
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# The secret appears at /run/secrets/npm_token only during this step
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci --omit=dev
COPY src ./src
CMD ["node", "src/server.js"]
```

### Step 2: the build command

Pass the secret with `--secret`. The `id` must match the Dockerfile. The `src` is a file on your computer:

```bash
printf 'demo-api-key-not-real' > npm_token.txt     # in real life, your token
docker build --secret id=npm_token,src=npm_token.txt -t notes-api:1.4.2 .
```

You can also take the value from an environment variable instead of a file, which is common in CI:

```bash
export NPM_TOKEN=demo-api-key-not-real
docker build --secret id=npm_token,env=NPM_TOKEN -t notes-api:1.4.2 .
```

### Proving it did not leak

Look at the image history. The `RUN` step is there, but the token is not:

```bash
docker history --no-trunc notes-api:1.4.2 | grep npm
```

```text
... RUN /bin/sh -c NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci --omit=dev # buildkit
```

The command is visible, but `$(cat ...)` was only run during the build. The value itself is nowhere in the image.

> **Warning:** Add `npm_token.txt` (and any other secret file) to both `.gitignore` and `.dockerignore`. The secret mount keeps the token out of the image, but only if you do not also copy it in with `COPY . .`.

> **Note:** Build secrets are for **build time**. Secrets your app needs while it **runs**, such as a database password, are passed when the container starts. You learned that in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).

### Build secrets in Compose

Compose can pass build secrets too. Declare the secret at the top level, then list it under `build.secrets`:

```yaml
services:
  api:
    build:
      context: .
      secrets:
        - npm_token            # available to RUN --mount=type=secret,id=npm_token
secrets:
  npm_token:
    environment: NPM_TOKEN     # value comes from the NPM_TOKEN variable
```

## SSH mounts for private Git repositories

If a build step clones a private Git repository, it needs your SSH key. Do not copy the key into the image. Use an **SSH mount**, which forwards your local SSH agent into one RUN step:

```docker
RUN --mount=type=ssh \
    git clone git@github.com:your-name/private-lib.git
```

```bash
docker build --ssh default -t notes-api:1.4.2 .
```

`default` means "use the SSH agent of my current shell". The key never leaves your machine. The image needs `git` and `openssh-client` installed, and you should add GitHub's host key to `known_hosts` first.

## Keeping cache in CI

On a CI runner, every job starts on a clean machine, so there is no build cache at all. BuildKit can **export** the cache to somewhere that survives between runs, and **import** it next time.

| Cache backend | Where the cache goes | Good for |
|---|---|---|
| `type=gha` | GitHub Actions' own cache storage | GitHub Actions |
| `type=registry` | A separate image tag in your registry | Any CI system |
| `type=local` | A folder on disk | Self-hosted runners |

In GitHub Actions, `docker/build-push-action@v6` takes `cache-from` and `cache-to`:

```yaml
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/your-name/notes-api:1.4.2
          cache-from: type=gha
          cache-to: type=gha,mode=max      # mode=max also saves the cache of earlier stages
          secrets: |
            npm_token=${{ secrets.NPM_TOKEN }}
```

With any CI system, the registry backend works from the command line:

```bash
docker buildx build \
  --cache-from type=registry,ref=ghcr.io/your-name/notes-api:buildcache \
  --cache-to type=registry,ref=ghcr.io/your-name/notes-api:buildcache,mode=max \
  -t ghcr.io/your-name/notes-api:1.4.2 --push .
```

This saves **layer** cache. Cache mounts (like `/root/.npm`) are not exported with it. So in CI, good layer ordering matters even more than cache mounts. You will put this together in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

## Common mistakes

### Forgetting the syntax line

Without `# syntax=docker/dockerfile:1`, older Docker versions may not understand `--mount`. Always put it on the first line.

### Mounting the wrong cache folder

If you switch to `USER node` before `npm ci`, npm's cache is `/home/node/.npm`, not `/root/.npm`. The build works, but the cache mount is unused. Mount the folder for the user that runs the step, or install before switching user, as in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root).

### Passing tokens with --build-arg

`--build-arg NPM_TOKEN=...` stores the value in the image's metadata, visible with `docker history`. Use `--secret` for anything secret.

### Writing the secret to a file inside a RUN

`RUN --mount=type=secret,id=npm_token cp /run/secrets/npm_token /app/.token` copies the secret into the layer. That defeats the whole point. Read the secret, use it, and do not save it anywhere.

## Quick recap

- `RUN --mount=...` attaches something to **one** step without adding it to the image.
- **Cache mounts** (`type=cache,target=...`) keep package caches between builds. Use them with good layer ordering.
- **Secret mounts** (`type=secret,id=...`) expose a secret at `/run/secrets/<id>` during one step. Supply it with `docker build --secret id=...,src=...` or `env=...`.
- **SSH mounts** (`type=ssh` with `--ssh default`) forward your SSH agent for private Git repositories.
- In CI, export layer cache with `cache-to` and import it with `cache-from`, for example `type=gha` or `type=registry`.
- Never pass secrets with `--build-arg` or `COPY`.

Next, you will check your images for known security problems in [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Dockerfile for notes-api with BuildKit cache and secret mounts
# Build (token from a file):  docker build --secret id=npm_token,src=npm_token.txt -t notes-api:1.4.2 .
# Build (token from env):     docker build --secret id=npm_token,env=NPM_TOKEN -t notes-api:1.4.2 .
# Keep npm_token.txt in .gitignore and .dockerignore
# ---------- Stage 1: install production dependencies ----------
FROM node:24-alpine AS deps
WORKDIR /app
# .npmrc only names the variable: //registry.npmjs.org/:_authToken=${NPM_TOKEN}
COPY package.json package-lock.json .npmrc ./
# cache mount: npm's download cache survives between builds, outside the image
# secret mount: the token exists at /run/secrets/npm_token only during this step
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npm_token \
    NPM_TOKEN="$(cat /run/secrets/npm_token)" npm ci --omit=dev
# ---------- Stage 2: the final image ----------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# Copy the installed packages, but not .npmrc (it is not needed at run time)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Run as the unprivileged node user from the official image
USER node
EXPOSE 3000
# Exec form so node receives SIGTERM from docker stop
CMD ["node", "src/server.js"]
</code></pre>

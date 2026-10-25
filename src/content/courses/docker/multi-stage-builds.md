---
publishDate: 2026-10-25T16:05
title: 'Multi-Stage Builds for Small Images'
slug: multi-stage-builds
metadescription: 'Learn how multi-stage builds use several FROM lines to build your app with all the tools, then ship only the result in a small, clean final image.'
updateDate: 2026-10-25T16:05
author: ['bishal-biswas']
level: 2
tags: ['docker', 'dockerfile', 'multi-stage', 'image-size']
course: docker
---

## Building needs tools, running does not

To **build** an app you often need many tools: a compiler, a bundler, test libraries, header files. To **run** the finished app you need much less. A web frontend, once built, is just a folder of HTML, CSS and JavaScript files. It does not need Node.js at all.

If you build and run in the same image, all those build tools end up in the image you ship. That makes the image:

- **Bigger**, so it is slower to push, pull and start.
- **Less secure**, because every extra program is something an attacker could use, and something a scanner will report vulnerabilities for (you will scan images in [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout)).

A **multi-stage build** solves this. You use one stage to build, and a second, clean stage that receives only the finished files. In this lesson you will write multi-stage Dockerfiles for a static frontend and for the **notes-api** app, copy files between stages, and build a single stage on purpose.

## What is a stage?

A **stage** is everything from one `FROM` line to the next. A normal Dockerfile, like the one in [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile), has one stage. A multi-stage Dockerfile has two or more:

```docker
# syntax=docker/dockerfile:1

# Stage 1: has all the build tools
FROM node:24-alpine AS build
# ... build steps ...

# Stage 2: the final image, starts again from a clean base
FROM nginx:1.29-alpine
# ... copy only the results from stage 1 ...
```

Three things to understand:

1. `AS build` gives the stage a **name**, so you can refer to it later.
2. Each `FROM` starts from a **fresh** base image. Nothing from the earlier stage comes along by itself.
3. The **last stage** becomes your image. Earlier stages are only used during the build and are not shipped.

To move files from one stage to another you use `COPY --from=<stage-name>`.

Think of it like a kitchen and a dining room. You cook in the kitchen with knives, pans and a messy counter. Then you carry only the finished plate to the dining room. The guests never see the kitchen.

## Example 1: a static frontend

Imagine a small frontend for notes-api, built with a tool such as Vite. Running `npm run build` creates a `dist/` folder of static files. Here is a multi-stage Dockerfile for it:

```docker
# syntax=docker/dockerfile:1

# ---------- Stage 1: build the static files ----------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Install ALL dependencies, including dev tools like the bundler
RUN npm ci
COPY . .
# Creates /app/dist with HTML, CSS and JS
RUN npm run build

# ---------- Stage 2: serve them with nginx ----------
FROM nginx:1.29-alpine
# Take ONLY the built files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

Build it and look at the size:

```bash
docker build -t notes-web:1.0.0 .
docker images notes-web
```

```text
REPOSITORY   TAG     IMAGE ID       CREATED          SIZE
notes-web    1.0.0   7d2c41a9e0b3   10 seconds ago   52MB
```

The final image is nginx plus your files. Node.js, npm, `node_modules` and your source code all stayed behind in the build stage. If you had shipped the build stage instead, the image would be several hundred megabytes.

> **Note:** Exact sizes depend on your app and on the image versions. The point is the difference: a few tens of megabytes instead of hundreds.

## Example 2: notes-api with a test stage

notes-api is plain JavaScript, so there is no compile step. But a multi-stage build still helps. You can:

- Run the tests in one stage, with dev dependencies installed.
- Ship a final stage that has only production dependencies.

```docker
# syntax=docker/dockerfile:1

# ---------- Stage "deps": production dependencies only ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage "test": all dependencies, runs the tests ----------
FROM node:24-alpine AS test
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test

# ---------- Final stage: what we ship ----------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
```

Notice how each stage keeps the cache-friendly order you learned in [Layer Caching: Faster Builds by Ordering Instructions](/courses/docker/layer-caching): dependency files first, then the install, then the code.

## Building one stage with `--target`

By default `docker build` builds the last stage. With `--target` you can stop at a named stage instead:

```bash
# Build up to and including the "test" stage. If a test fails, the build fails.
docker build --target test -t notes-api:test .

# Build the final image (the default)
docker build -t notes-api:1.0.0 .
```

This is very handy in CI ([Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions)): one command runs the tests inside the same environment as production, and a failing test stops the pipeline.

### BuildKit skips stages you do not need

**BuildKit**, the default builder in Docker, looks at which stages the target actually depends on. In Example 2, the final stage copies from `deps` but not from `test`. So a plain `docker build` builds `deps` and the final stage, and **skips the test stage completely**.

That is useful, but it can surprise you. If you want the tests to always run, build with `--target test` first (as above), or make the final stage depend on the test stage, for example by copying a small file from it.

BuildKit also builds stages that do not depend on each other **at the same time**, which makes builds faster.

## Copying from an image, not a stage

`COPY --from` also accepts an image name. Docker pulls the image and copies the file out of it, without making it a stage:

```docker
# Copy nginx's default config out of the official image, to look at or edit
COPY --from=nginx:1.29-alpine /etc/nginx/nginx.conf /tmp/nginx.conf.default
```

This is a neat way to grab a single file or program from another image. Use specific tags here too, never `:latest`.

## Choosing the final base image

The final stage is where image size and security really matter, so choose its base carefully. You compared full, slim, Alpine and distroless images in [Choosing a Base Image: Full, Slim, Alpine and Distroless](/courses/docker/choosing-a-base-image).

| Final stage base | Good for |
|---|---|
| `nginx:1.29-alpine` | Static websites and frontends |
| `node:24-alpine` or `node:24-slim` | Node.js servers |
| `python:3.13-slim` | Python apps |
| A distroless image | Apps that need no shell at all, for the smallest attack surface |

## Common mistakes

### Forgetting to copy something the app needs

The final stage starts empty, apart from its base image. If your app reads a file such as `config/default.json` and you did not copy it, the container crashes at start. Run the image and test it, not only the build.

### Copying all of `node_modules` from a build stage

If the build stage ran `npm ci` (with dev dependencies) and you copy its `node_modules`, the dev tools come along. Install production dependencies in a separate stage, as in Example 2, or run `npm ci --omit=dev` in the final stage.

### Using stage numbers instead of names

`COPY --from=0` refers to the first stage by number. It works, but it breaks silently if you add a stage above it. Always name stages with `AS`.

### Thinking a secret in an early stage is safe

An early stage is not in the final image, but it is still in your local build cache, and anyone with access to the build machine could read it. Never pass secrets with `COPY` or `ARG`. Use BuildKit secret mounts, covered in [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

## Quick recap

- A **stage** runs from one `FROM` to the next. Name it with `AS name`.
- Only the **last stage** (or the `--target` stage) becomes the image.
- `COPY --from=name` copies files from an earlier stage; `COPY --from=image:tag` copies from an image.
- Build with all the tools, then ship only the results: smaller, faster and more secure.
- `docker build --target test` builds and stops at a named stage, great for running tests.
- BuildKit skips stages the target does not need, and runs independent stages in parallel.

Next, you will teach Docker how to check whether your app is really working in [Health Checks: Telling Docker Your App Is Working](/courses/docker/healthchecks).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for notes-api.
# Run tests:   docker build --target test -t notes-api:test .
# Final image: docker build -t notes-api:1.0.0 .
#
# ---------- Stage "deps": production dependencies only ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
#
# ---------- Stage "test": all dependencies, runs the test suite ----------
FROM node:24-alpine AS test
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# If any test fails, this step fails and so does the build
RUN npm test
#
# ---------- Final stage: the only one that is shipped ----------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# Bring in only what is needed to run, from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Run as the unprivileged "node" user
USER node
EXPOSE 3000
# Exec form so node receives SIGTERM from docker stop
CMD ["node", "src/server.js"]
</code></pre>

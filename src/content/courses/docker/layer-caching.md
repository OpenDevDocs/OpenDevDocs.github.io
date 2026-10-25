---
publishDate: 2026-10-25T16:00
title: 'Layer Caching: Faster Builds by Ordering Instructions'
slug: layer-caching
metadescription: 'Learn how the Docker build cache works, why one changed line can rebuild everything after it, and how to order a Dockerfile so rebuilds take seconds.'
updateDate: 2026-10-25T16:00
author: ['bishal-biswas']
level: 2
tags: ['docker', 'dockerfile', 'build-cache', 'performance']
course: docker
---

## Why your second build should be fast

The first time you build an image, Docker runs every instruction in your Dockerfile. Installing packages can take a minute or more. That is fine once. But you build many times a day, and if every small code change means waiting for `npm ci` again, you will lose a lot of time.

Docker has a solution called the **build cache**. A **cache** is a store of saved results that you can reuse instead of doing the same work again. In this lesson you will learn how the build cache decides what to reuse, why the order of your instructions matters so much, and how to write a Dockerfile for the **notes-api** app that rebuilds in a few seconds.

You learned in [Images and Layers Explained](/courses/docker/images-and-layers) that an image is a stack of **layers**. Each instruction such as `RUN` or `COPY` adds a layer. The build cache is simply a collection of layers that Docker built earlier and kept.

## How the cache works

When Docker builds an image, it goes through the Dockerfile from top to bottom. For each instruction it asks one question:

> "Have I already built this exact step, on top of this exact parent layer?"

If the answer is yes, Docker reuses the saved layer. This is called a **cache hit**, and it takes almost no time. If the answer is no, Docker runs the instruction for real. This is a **cache miss**.

How Docker answers that question depends on the instruction:

| Instruction | Docker reuses the cached layer when... |
|---|---|
| `FROM` | The same base image is already on your machine |
| `RUN` | The command text is exactly the same as last time |
| `COPY` and `ADD` | The files being copied have exactly the same content as last time |
| `ENV`, `WORKDIR`, `EXPOSE`, `USER` | The instruction text is the same |

Two details are worth remembering:

- For `RUN`, Docker only compares the **text** of the command. It does not know what the command does. `RUN apt-get update` will be reused even if the package lists on the internet changed last week.
- For `COPY`, Docker looks at the **content** of the files (a checksum, which is like a fingerprint of the file). Changing one character in one copied file is enough to cause a miss.

## The chain rule: one miss breaks everything below it

This is the most important idea in the lesson. Each layer sits on top of the one before it. If a layer changes, every layer above it is built on a different parent, so Docker cannot trust the old ones. After the first cache miss, **every instruction after it runs again**.

```text
FROM node:24-alpine           cache hit
WORKDIR /app                  cache hit
COPY . .                      MISS (you edited src/server.js)
RUN npm ci                    runs again, even though dependencies did not change
CMD ["node", "src/server.js"] runs again
```

Think of it like a stack of plates. If you need to replace the third plate, you have to lift off every plate above it first.

So the goal is simple: put the things that **rarely change** near the top, and the things that **change often** near the bottom.

## A slow Dockerfile

Here is a first version of a Dockerfile for notes-api. It works, but it is slow to rebuild.

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
# Copies EVERYTHING, including source code
COPY . .
# Depends on the line above, so it reruns on every code change
RUN npm ci
CMD ["node", "src/server.js"]
```

The problem is `COPY . .` before `npm ci`. Your source code changes all the time. Each change causes a miss on the `COPY` line, and the chain rule then forces `npm ci` to run again, downloading every package from scratch.

## A fast Dockerfile

The fix is to split the copy into two steps. First copy only the files that describe your dependencies, install them, and only then copy the rest of the code.

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
# 1. Dependency files change rarely
COPY package.json package-lock.json ./
# 2. So this slow step is cached until package files change
RUN npm ci --omit=dev
# 3. Source code changes often, so it comes last
COPY . .
CMD ["node", "src/server.js"]
```

Now when you edit `src/server.js`, the `COPY package.json ...` step is still a hit (those files did not change), so `npm ci` is also a hit. Only the final `COPY . .` runs again, which takes a fraction of a second.

The same pattern works for every language. In Python you copy `requirements.txt` first, then run `pip install`, then copy the code. You will do that in [Project: Dockerizing a Python App](/courses/docker/dockerizing-a-python-app).

## Seeing the cache in action

Build the image once:

```bash
docker build -t notes-api:dev .
```

Now change a line in `src/server.js` and build again. Look for the word `CACHED` in the output:

```text
 => [1/5] FROM docker.io/library/node:24-alpine                    0.0s
 => CACHED [2/5] WORKDIR /app                                      0.0s
 => CACHED [3/5] COPY package.json package-lock.json ./            0.0s
 => CACHED [4/5] RUN npm ci --omit=dev                             0.0s
 => [5/5] COPY . .                                                 0.1s
 => exporting to image                                             0.2s
```

Steps 2 to 4 say `CACHED`. Only step 5 ran. The whole build took well under a second.

> **Tip:** If the build output moves too fast to read, add `--progress=plain` to `docker build`. It prints every step as plain text, which is also useful when you need to see the output of a `RUN` command.

You can also see the layers of a finished image, and how big each one is, with `docker history`:

```bash
docker history notes-api:dev
```

## More ordering tips

### Order from least to most frequently changed

A good general order for most Dockerfiles is:

1. `FROM` the base image
2. System packages (`apt-get install`, `apk add`)
3. `WORKDIR`, users and other setup
4. Dependency files, then the install step
5. Your source code
6. `CMD` or `ENTRYPOINT`

### Keep `apt-get update` and `apt-get install` together

This looks harmless but causes a real bug:

```docker
RUN apt-get update
RUN apt-get install -y curl
```

The first line is cached forever because its text never changes. Weeks later you add a new package to the second line. Docker reruns only the install step, using the old, stale package list, and the install can fail. Put both in one `RUN` so they are always cached (or rebuilt) together:

```docker
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

### Keep the build context small

`COPY . .` checks every file it copies. If your folder contains `node_modules`, `.git` or log files, any change to them causes a cache miss for no good reason. A `.dockerignore` file stops these files from being sent to the build at all. You learned how in [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore).

```text
node_modules
.git
*.log
.env
```

### Put build arguments as late as possible

A changed `ARG` value can cause misses from the point where it is first used. If you pass something like a version number or build date with `--build-arg`, declare and use it near the end of the Dockerfile, so it does not break the cache for the slow steps above. See [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env) for more about `ARG`.

## Forcing a fresh build

Sometimes you want Docker to ignore the cache. For example, a `RUN apt-get upgrade` step may be cached for months, so it never picks up security fixes.

```bash
# Ignore the cache for every step
docker build --no-cache -t notes-api:dev .

# Also download a newer version of the base image if one exists
docker build --pull -t notes-api:dev .

# Do both, for example in a weekly scheduled build
docker build --pull --no-cache -t notes-api:dev .
```

| Flag | What it does |
|---|---|
| `--no-cache` | Runs every instruction again, ignoring saved layers |
| `--pull` | Checks the registry for a newer base image before building |

> **Note:** BuildKit, Docker's default builder, can also keep a cache of downloaded packages that survives even a cache miss, using `RUN --mount=type=cache`. You will learn this in [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

## The cache in CI

On your laptop the cache lives on your disk and is there the next time you build. A CI runner, such as a GitHub Actions machine, often starts empty every time, so it has no cache at all. Good ordering still helps, but you need a little extra setup to save and restore the cache between CI runs. You will see that in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

## Common mistakes

### Copying everything before installing dependencies

`COPY . .` before `npm ci` or `pip install` is the number one cause of slow builds. Always copy the dependency files first.

### Expecting `RUN` to notice changes on the internet

`RUN curl https://example.com/script.sh | sh` is cached by its text. If the script on the website changes, Docker will not notice. Use `--no-cache`, or download a specific, versioned file.

### Forgetting `package-lock.json`

If you copy only `package.json`, `npm ci` fails because it needs the lock file. Copy both: `COPY package.json package-lock.json ./`.

### Thinking the cache makes images smaller

The cache makes builds **faster**, not images **smaller**. To make images smaller you need multi-stage builds, which come next.

## Quick recap

- Each Dockerfile instruction makes a layer, and Docker keeps built layers in the **build cache**.
- `RUN` is reused when its text is the same; `COPY` is reused when the file content is the same.
- After the first **cache miss**, every later instruction runs again.
- Put rarely changing steps first and often changing steps (your source code) last.
- Copy dependency files, install, then copy the code.
- Keep `apt-get update` and `install` in one `RUN`, and use `.dockerignore`.
- Use `--no-cache` and `--pull` when you need a truly fresh build.

Next, you will use several `FROM` lines in one Dockerfile to keep build tools out of your final image in [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Cache-friendly Dockerfile for notes-api.
# Rule: things that change rarely go at the top, things that change often go at the bottom.
# Build:   docker build -t notes-api:dev .
# Fresh:   docker build --pull --no-cache -t notes-api:dev .
#
# 1. Base image: changes only when you choose a new version
FROM node:24-alpine
# 2. Setup steps: almost never change
ENV NODE_ENV=production
WORKDIR /app
# 3. Copy ONLY the dependency files first
COPY package.json package-lock.json ./
# 4. Slow install step: stays CACHED until the package files change
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
# 5. Source code: changes all the time, so it is copied last
#    (.dockerignore keeps node_modules, .git and .env out of this copy)
COPY . .
# 6. Metadata and start command
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
</code></pre>

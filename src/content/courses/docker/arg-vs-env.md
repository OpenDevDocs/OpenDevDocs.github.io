---
publishDate: 2026-10-25T15:50
title: 'Build Arguments and Environment Variables: ARG vs ENV'
slug: arg-vs-env
metadescription: 'Learn the difference between ARG and ENV in a Dockerfile, when each value exists, how to set and override them, and why neither is safe for secrets.'
updateDate: 2026-10-25T15:50
author: ['bishal-biswas']
level: 2
tags: ['docker', 'dockerfile', 'build-args', 'environment-variables']
course: docker
---

## Two kinds of variables

Dockerfiles often need values that can change: a Node.js version, a port, an app mode such as "production". Hard-coding them works, but then you must edit the Dockerfile every time. Docker gives you two instructions for variables:

- **`ARG`** is a **build argument**. It exists only **while the image is being built**.
- **`ENV`** is an **environment variable**. It exists while building **and** inside every container started from the image.

A simple way to remember it: `ARG` is a note for the builder, `ENV` is a note for the running app.

In this lesson you will learn:

- how to declare and use `ARG` and `ENV`
- how to set them from the command line
- the **scope** rules (where each value can be seen)
- a common pattern that turns an `ARG` into an `ENV`
- why you must not use either one for passwords and keys

You already set environment variables at run time with `docker run -e` in [Configuring Containers with Environment Variables](/courses/docker/environment-variables). Now you will set them inside the image.

## ENV: values the app can read

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY src ./src
EXPOSE ${PORT}
CMD ["node", "src/server.js"]
```

`ENV` does two things:

1. Later Dockerfile instructions can use the value, like `${PORT}` in `EXPOSE`.
2. The value is saved in the image. Every container gets it as a normal environment variable.

notes-api reads `process.env.PORT`, so it picks up the value. You can check what a container sees:

```bash
docker build -t notes-api:env .
docker run --rm notes-api:env node -e "console.log(process.env.NODE_ENV, process.env.PORT)"
```

```text
production 3000
```

### Overriding ENV at run time

An `ENV` value is a **default**. `docker run -e` wins over it:

```bash
docker run --rm -e PORT=4000 -p 4000:4000 notes-api:env
```

```text
notes-api listening on port 4000
```

This is the most useful thing about `ENV`: you build **one** image and change its behavior per environment, without rebuilding. You can read more about this idea in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

### Setting several at once

You can set more than one value in a single line:

```docker
ENV NODE_ENV=production PORT=3000
```

> **Tip:** `NODE_ENV=production` matters for Node apps. Many libraries run faster with it, and `npm ci` skips dev dependencies when it is set. Learn more in [Environment Variables and .env Files](/courses/nodejs/environment-variables-and-env-file).

## ARG: values for the build only

```docker
# syntax=docker/dockerfile:1
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY src ./src
CMD ["node", "src/server.js"]
```

`ARG NODE_VERSION=24` declares a build argument with a **default value** of `24`. You change it with `--build-arg` when you build:

```bash
docker build -t notes-api:node24 .
docker build --build-arg NODE_VERSION=22 -t notes-api:node22 .
```

Now you have two images from the same Dockerfile, one on Node.js 24 and one on Node.js 22. This is handy for testing your app on several versions.

If an `ARG` has no default and you do not pass it, its value is an empty string. That can produce confusing errors, so give useful defaults.

### ARG is gone in the container

```docker
ARG APP_MODE=demo
RUN echo "Building in $APP_MODE mode"
```

During the build you see `Building in demo mode`. But in a running container:

```bash
docker run --rm notes-api:args sh -c 'echo "APP_MODE is [$APP_MODE]"'
```

```text
APP_MODE is []
```

Empty. The build argument was used and then left behind.

## Scope: where each value is visible

This is the part that trips people up. **Scope** means "the part of the Dockerfile where a variable can be used".

### Rule 1: an ARG before FROM is only for FROM lines

```docker
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine
# NODE_VERSION is EMPTY here, unless you declare it again
RUN echo "Node version: $NODE_VERSION"
```

```text
Node version:
```

An `ARG` written before `FROM` can only be used in `FROM` lines. To use it after `FROM`, declare it again, without a value. It then takes the value from before:

```docker
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine
ARG NODE_VERSION
RUN echo "Node version: $NODE_VERSION"
```

```text
Node version: 24
```

### Rule 2: each stage starts fresh

In a multi-stage build, every `FROM` starts a new **stage**. `ARG` and `ENV` values from one stage do not carry into the next. Declare them in each stage that needs them. You will see this in [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds).

### Rule 3: a variable works from its line down

Instructions above the `ARG` or `ENV` line cannot see it. Order matters.

### Summary table

| | `ARG` | `ENV` |
|---|---|---|
| Available during build (`RUN`, `COPY`, ...) | Yes, after its line in that stage | Yes, after its line in that stage |
| Available in the running container | No | Yes |
| Can be used in `FROM` | Yes, if declared before `FROM` | No |
| Set from the command line | `docker build --build-arg NAME=value` | `docker run -e NAME=value` |
| Default value in the Dockerfile | `ARG NAME=value` | `ENV NAME=value` |
| Typical use | Versions, build options | App settings, ports, modes |

## Pattern: ARG with an ENV default

Sometimes you want a value you can choose at **build** time that the app can also read at **run** time. Combine them:

```docker
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
```

```bash
docker build --build-arg APP_VERSION=1.4.0 -t notes-api:1.4.0 .
docker run --rm notes-api:1.4.0 node -e "console.log(process.env.APP_VERSION)"
```

```text
1.4.0
```

Now the app can show its own version in logs or at a `/version` endpoint. CI systems often pass the Git commit this way. You will tag images like this in [Tagging Images for Releases](/courses/docker/tagging-strategy).

## Build arguments and the cache

Changing a build argument can break the cache. Docker treats the first instruction that **uses** a changed `ARG` as changed, and everything after it rebuilds.

```docker
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
# Declared late on purpose: changing APP_VERSION only rebuilds from here
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}
CMD ["node", "src/server.js"]
```

If you put `ARG APP_VERSION` at the top, a new version number would rerun `npm ci` on every build. Declare arguments as late as you can. You will learn the full rules in [Layer Caching: Faster Builds by Ordering Instructions](/courses/docker/layer-caching).

## Never put secrets in ARG or ENV

It is tempting to write:

```docker
# DO NOT DO THIS
ARG NPM_TOKEN
ENV DATABASE_PASSWORD=devpassword
```

Both leak:

- **`ENV` values are saved in the image.** Anyone who can pull it can read them:

```bash
docker image inspect --format '{{json .Config.Env}}' notes-api:bad
```

```text
["PATH=/usr/local/sbin:...","DATABASE_PASSWORD=devpassword"]
```

- **`ARG` values can show up in the image history** and build records, especially when a `RUN` line uses them:

```bash
docker history --no-trunc notes-api:bad
```

BuildKit even prints a warning when it sees `ARG` or `ENV` names that look like secrets, such as ones containing `PASSWORD` or `TOKEN`.

Instead:

- **For run-time secrets** (database passwords, API keys), pass them when the container starts, with `-e`, an env file, or Compose secrets. See [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).
- **For build-time secrets** (a private npm token), use BuildKit **secret mounts**, which never end up in a layer:

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t notes-api:1.4.0 .
```

You will learn this in [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

## Common mistakes

### Using ARG for something the app needs

`ARG PORT=3000` and then `process.env.PORT` in the app gives `undefined`, because `ARG` is gone at run time. Use `ENV`, or the ARG-to-ENV pattern.

### Forgetting to re-declare after FROM

`ARG NODE_VERSION` before `FROM` and `$NODE_VERSION` in a later `RUN` prints nothing. Add `ARG NODE_VERSION` again after `FROM`.

### Expecting variables in exec form CMD

`CMD ["node", "${APP_FILE}"]` passes the text `${APP_FILE}` literally, because no shell runs. You saw why in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint). Read the variable inside your app instead.

### Rebuilding just to change a setting

If you rebuild the image for every environment because a value is baked in, make it an `ENV` default and override it with `-e` at run time.

## Quick recap

- **`ARG`**: build time only. Set with `--build-arg`. Gone in the container.
- **`ENV`**: build time and run time. Override with `docker run -e`.
- An `ARG` before `FROM` is only for `FROM`. Re-declare it after `FROM` to use it later.
- Each stage starts fresh. Variables work from their line downwards.
- `ARG X` plus `ENV X=${X}` lets a build value reach the running app.
- Declare `ARG`s late to protect the cache, and **never** use `ARG` or `ENV` for secrets.

Next, you will learn exactly which files Docker can see during a build, and how to keep junk and secrets out, in [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# notes-api showing ARG (build time) and ENV (build time and run time).
# Build:             docker build -t notes-api:1.4.0 --build-arg APP_VERSION=1.4.0 .
# Other Node version: docker build --build-arg NODE_VERSION=22 -t notes-api:node22 .
# Override at run:   docker run --rm -e PORT=4000 -p 4000:4000 notes-api:1.4.0
#
# An ARG before FROM can only be used in FROM lines
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine
# Re-declare it (no value) to use it after FROM
ARG NODE_VERSION
RUN echo "Building on Node.js $NODE_VERSION"
# ENV: saved in the image, readable by the app, overridable with docker run -e
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
# Declared late so a new version number does not rerun npm ci
ARG APP_VERSION=dev
# Turn the build argument into a run-time variable the app can read
ENV APP_VERSION=${APP_VERSION}
EXPOSE ${PORT}
# Never put passwords or tokens in ARG or ENV: they stay visible in the image
CMD ["node", "src/server.js"]
</code></pre>

---
publishDate: 2026-10-25T15:45
title: 'CMD vs ENTRYPOINT: Choosing What a Container Runs'
slug: cmd-vs-entrypoint
metadescription: 'Understand CMD and ENTRYPOINT, exec form vs shell form, how they combine and get overridden, and how to write a safe entrypoint script.'
updateDate: 2026-10-25T15:45
author: ['bishal-biswas']
level: 2
tags: ['docker', 'dockerfile', 'entrypoint', 'signals']
course: docker
---

## What runs when a container starts?

An image is a frozen file system. A container is that file system **plus one running program**. Two Dockerfile instructions decide which program:

- **`CMD`** sets the **default command**. It is easy to replace when you run the container.
- **`ENTRYPOINT`** sets the **main program**. It is harder to replace, and anything you pass to `docker run` becomes its arguments.

They look similar, and they can work together, which confuses many people. In this lesson you will learn:

- the **exec form** and the **shell form**, and why the exec form matters for stopping containers
- how `CMD` and `ENTRYPOINT` combine
- how to override each one with `docker run`
- how to write an **entrypoint script** that does setup and then starts your app

You already used `CMD ["node", "src/server.js"]` in [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile). Now you will see exactly why it is written that way.

## Exec form and shell form

Both instructions can be written in two forms:

```docker
# Exec form: a JSON list with double quotes
CMD ["node", "src/server.js"]

# Shell form: a plain string
CMD node src/server.js
```

They look like small style choices, but they run differently:

| | Exec form | Shell form |
|---|---|---|
| How it runs | Docker runs `node` directly | Docker runs `/bin/sh -c "node src/server.js"` |
| Process ID 1 (PID 1) | `node` | `sh` (on many images) |
| Gets `SIGTERM` from `docker stop`? | Yes | Often not |
| `$VARIABLES`, `&&`, pipes | Do not work (no shell) | Work |

### Why PID 1 and signals matter

Every process has a number called a **PID** (process ID). Inside a container, the first program gets **PID 1**. When you run `docker stop`, Docker sends a **signal** called `SIGTERM` to PID 1. A signal is a short message from the operating system, here meaning "please finish and exit". If the container has not stopped after 10 seconds, Docker sends `SIGKILL`, which ends it at once. You met this in [The Container Lifecycle: Create, Start, Stop and Remove](/courses/docker/container-lifecycle).

With the shell form, PID 1 is often the shell, not your app. The shell may not pass the signal on. So your app never hears it, never closes its connections, and gets killed after 10 seconds.

Try both. notes-api prints a message when it gets `SIGTERM`:

```bash
# Image built with: CMD ["node", "src/server.js"]
time docker stop notes-exec
```

```text
notes-exec
real    0m0.4s
```

```bash
# Image built with: CMD node src/server.js
time docker stop notes-shell
```

```text
notes-shell
real    0m10.3s
```

Ten seconds of waiting, and the app was killed instead of shutting down cleanly. On every deploy, every restart.

> **Note:** Some shells, like the `sh` in some images, replace themselves with a single simple command, so the shell form sometimes works by luck. Do not depend on it. Use the exec form.

You can read more about clean shutdown in Node in [Graceful Shutdown](/courses/nodejs/graceful-shutdown).

> **Warning:** In the exec form, use **double quotes**. `CMD ['node', 'src/server.js']` with single quotes is not valid JSON, so Docker quietly treats the whole line as the shell form.

## CMD: the default command

`CMD` is a **default**. Anything you write after the image name in `docker run` replaces it completely.

```docker
FROM node:24-alpine
WORKDIR /app
COPY src ./src
CMD ["node", "src/server.js"]
```

```bash
docker run --rm notes-api:1.0                      # runs: node src/server.js
docker run --rm notes-api:1.0 node --version       # runs: node --version
docker run --rm -it notes-api:1.0 sh               # runs: sh (a shell for poking around)
```

```text
v24.11.0
```

This makes `CMD` perfect for apps where you sometimes want to run something else, like a shell for debugging or a one-off script.

If a Dockerfile has several `CMD` lines, only the **last** one counts. The same is true for `ENTRYPOINT`.

## ENTRYPOINT: the main program

`ENTRYPOINT` makes the container behave like **one program**. Whatever you type after the image name is added as **arguments** to it.

A small example: an image that is just `curl`.

```docker
# syntax=docker/dockerfile:1
FROM alpine:3.22
RUN apk add --no-cache curl
ENTRYPOINT ["curl"]
```

```bash
docker build -t mycurl .
docker run --rm mycurl -s https://example.com
# runs: curl -s https://example.com
```

The container acts like the `curl` command itself.

## Using both together

When you use both, `ENTRYPOINT` is the program and `CMD` gives its **default arguments**:

```docker
ENTRYPOINT ["curl"]
CMD ["--help"]
```

```bash
docker run --rm mycurl                          # runs: curl --help
docker run --rm mycurl -I https://example.com   # runs: curl -I https://example.com
```

Here is the full picture of how they combine (exec form for both):

| ENTRYPOINT | CMD | What runs with `docker run image` | With `docker run image ARGS` |
|---|---|---|---|
| (none) | `["node", "src/server.js"]` | `node src/server.js` | `ARGS` |
| `["curl"]` | (none) | `curl` | `curl ARGS` |
| `["curl"]` | `["--help"]` | `curl --help` | `curl ARGS` |

You saw this pattern in [Choosing a Base Image: Full, Slim, Alpine and Distroless](/courses/docker/choosing-a-base-image): the distroless Node image has `node` as its `ENTRYPOINT`, so your `CMD` contains only the script name.

> **Warning:** If `ENTRYPOINT` is in **shell form**, `CMD` and any `docker run` arguments are ignored completely. Always use the exec form for `ENTRYPOINT`.

## Overriding at run time

| What you want | How |
|---|---|
| Replace `CMD` | Put the new command after the image name |
| Replace `ENTRYPOINT` | `--entrypoint` flag, before the image name |

```bash
# Replace the entrypoint with a shell, to look inside the mycurl image
docker run --rm -it --entrypoint sh mycurl
```

Note that `--entrypoint` takes only the program. Its arguments go after the image name:

```bash
docker run --rm --entrypoint ls mycurl -la /usr/bin
# runs: ls -la /usr/bin
```

## Entrypoint scripts: setup, then start

A very common pattern is an **entrypoint script**: a small shell script that does some setup each time the container starts, and then starts the real app. Many official images, like `postgres`, work this way.

Create `entrypoint.sh` in the notes-api folder:

```bash
#!/bin/sh
# Stop at the first error
set -e

# Setup that must happen at start time, not build time
echo "notes-api starting in ${NODE_ENV:-development} mode"

# Replace this script with the real command (the CMD), so it becomes PID 1
exec "$@"
```

The last line is the most important one:

- `"$@"` means "all the arguments this script received". Docker passes the `CMD` as arguments to the `ENTRYPOINT`, so here that is `node src/server.js`.
- `exec` **replaces** the shell with that command. The shell disappears and `node` becomes PID 1, so it gets `SIGTERM` directly.

Without `exec`, the shell stays as PID 1 and you are back to the signal problem.

Use it in the Dockerfile:

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
# --chmod makes the script executable while copying
COPY --chmod=755 entrypoint.sh /usr/local/bin/notes-entrypoint.sh
ENTRYPOINT ["notes-entrypoint.sh"]
CMD ["node", "src/server.js"]
```

> **Note:** The official `node` image already has its own `ENTRYPOINT`, a script called `docker-entrypoint.sh`. Your `ENTRYPOINT` line replaces it. That is why the lesson gives your script a different name, so the two are never confused.

```bash
docker build -t notes-api:1.3 .
docker run --rm -p 3000:3000 notes-api:1.3
```

```text
notes-api starting in development mode
notes-api listening on port 3000
```

And you can still run other commands through the script, because they replace `CMD`:

```bash
docker run --rm -it notes-api:1.3 sh
```

> **Tip:** On Windows, editors may save the script with Windows line endings (CRLF). Linux then fails with a confusing error such as `exec /usr/local/bin/notes-entrypoint.sh: no such file or directory`. Save shell scripts with LF line endings.

### Even safer: a tiny init process

If your app starts child processes, a small **init** program can forward signals and clean up finished children. Docker has one built in. Turn it on with `--init`:

```bash
docker run --init -d -p 3000:3000 notes-api:1.3
```

For a simple Node app with the exec form, you do not need it, but it is good to know it exists.

## Which one should I use?

- **A normal app (web server, worker):** use `CMD` in exec form. Easy to override for debugging.
- **A tool image that should act like one command:** use `ENTRYPOINT` for the program and `CMD` for default arguments.
- **Setup needed at start:** use an entrypoint script with `exec "$@"`, and `CMD` for the app.

## Common mistakes

### Shell form for the main process

`CMD npm start` or `CMD node src/server.js` leads to slow, unclean stops. Use `CMD ["node", "src/server.js"]`.

### Starting through npm

`CMD ["npm", "start"]` puts `npm` as PID 1, and npm does not always forward signals well to your app. Run `node` directly.

### Forgetting `exec` in the script

`node src/server.js` as the last line of the script, without `exec`, keeps the shell as PID 1.

### Expecting variables in exec form

`CMD ["node", "$APP_FILE"]` passes the text `$APP_FILE` literally, because there is no shell to replace it. Read environment variables inside your app instead, or use an entrypoint script. You will learn about variables in [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env).

## Quick recap

- `CMD` is the **default command**; `docker run image other-command` replaces it.
- `ENTRYPOINT` is the **main program**; `docker run` arguments are added to it, and `--entrypoint` replaces it.
- With both, `CMD` becomes the default **arguments** for `ENTRYPOINT`.
- Use the **exec form** (JSON list, double quotes) so your app is PID 1 and gets `SIGTERM`.
- Entrypoint scripts end with `exec "$@"` to hand over to the real command.

Next, you will learn how to pass values into builds and containers in [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# notes-api with an entrypoint script for start-time setup.
# The script (entrypoint.sh) does its setup, then ends with: exec "$@"
# so the CMD below replaces the shell and node becomes PID 1.
# Build: docker build -t notes-api:1.3 .
# Run:   docker run --rm -p 3000:3000 notes-api:1.3
# Shell: docker run --rm -it notes-api:1.3 sh            (replaces CMD)
# Skip the script: docker run --rm -it --entrypoint sh notes-api:1.3
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
# Copy the script and make it executable in one step (save it with LF line endings)
COPY --chmod=755 entrypoint.sh /usr/local/bin/notes-entrypoint.sh
# ENTRYPOINT: the program that always runs. Exec form, or CMD is ignored
ENTRYPOINT ["notes-entrypoint.sh"]
# CMD: default arguments for the ENTRYPOINT. Exec form with double quotes
CMD ["node", "src/server.js"]
</code></pre>

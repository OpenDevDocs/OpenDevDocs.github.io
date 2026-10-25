---
publishDate: 2026-10-25T15:40
title: 'Dockerfile Instructions: FROM, RUN, COPY, ADD and WORKDIR'
slug: dockerfile-instructions
metadescription: 'Learn the five core Dockerfile instructions, FROM, RUN, COPY, ADD and WORKDIR, with clear examples, good habits and the mistakes to avoid.'
updateDate: 2026-10-25T15:40
author: ['bishal-biswas']
level: 1
tags: ['docker', 'dockerfile', 'instructions']
course: docker
---

## The building blocks of every Dockerfile

In [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile) you built notes-api with a few instructions. An **instruction** is one line in a Dockerfile that starts with a keyword in capital letters, such as `FROM` or `RUN`.

This lesson looks closer at the five instructions that do most of the work:

| Instruction | In one sentence |
|---|---|
| `FROM` | Pick the image to start from |
| `WORKDIR` | Set the current folder inside the image |
| `COPY` | Copy files from your project into the image |
| `ADD` | Like `COPY`, with two extra tricks (URLs and archives) |
| `RUN` | Run a command at build time and save the result |

By the end you will know how each one behaves, which options matter, and the habits that keep images small and builds fast.

> **Note:** Keywords are not case-sensitive, but everyone writes them in CAPITALS so they stand out from the arguments. Do the same.

## How instructions become layers

Before the details, one important idea. Docker reads the Dockerfile from top to bottom. Instructions that change files (`RUN`, `COPY`, `ADD`) each create a new **layer**, a saved set of file changes. Others, like `WORKDIR`, `ENV` or `CMD`, mostly change settings. You learned about layers in [Images and Layers Explained](/courses/docker/images-and-layers).

So every instruction is a step that Docker can **cache** and reuse on the next build. Keep that in mind: the way you write and order instructions changes how fast your builds are and how big your image is.

## FROM: the starting point

`FROM` must be the first instruction (only comments, the `# syntax` line and `ARG` may come before it).

```docker
FROM node:24-alpine
```

Some things to know:

- **Always use a tag.** `FROM node` means `node:latest`, which can change under you.
- **You can pin a digest** for builds that must be exactly the same every time:

```docker
FROM node:24-alpine@sha256:<digest-from-docker-image-inspect>
```

- **You can name a stage** with `AS`. This is for multi-stage builds, where one Dockerfile has several `FROM` lines:

```docker
FROM node:24-alpine AS build
# ... build steps ...

FROM node:24-alpine
COPY --from=build /app/dist ./dist
```

You will use this in [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds). For how to choose the image itself, see [Choosing a Base Image: Full, Slim, Alpine and Distroless](/courses/docker/choosing-a-base-image).

## WORKDIR: where you are

`WORKDIR` sets the current folder for the instructions after it, and for the running container. If the folder does not exist, Docker creates it.

```docker
WORKDIR /app
COPY package.json ./      # lands in /app/package.json
RUN ls                    # runs inside /app
```

Good habits:

- **Use absolute paths** (starting with `/`). A relative path is added to the previous `WORKDIR`, which is confusing:

```docker
WORKDIR /app
WORKDIR src        # now you are in /app/src
```

- **Use `WORKDIR` instead of `RUN cd`.** Each `RUN` starts fresh in the current `WORKDIR`, so a `cd` does not carry over to the next line:

```docker
RUN cd /app        # does nothing for the next instruction
RUN npm ci         # still runs in the old folder
```

## COPY: bringing files in

`COPY` copies files and folders from the **build context** (the folder you pass to `docker build`) into the image.

```docker
COPY <source> <destination>
```

### Common forms

```docker
# One file into the current WORKDIR
COPY package.json ./

# Several files: the destination must end with /
COPY package.json package-lock.json ./

# A folder: its contents go into the destination folder
COPY src ./src

# Everything in the build context
COPY . .
```

### The trailing slash rule

When the destination ends with `/`, Docker treats it as a folder. Without the slash and with a single source file, the destination is treated as a file name:

```docker
COPY server.js /app/       # creates /app/server.js
COPY server.js /app/main   # creates a FILE called /app/main
```

When in doubt, add the `/`.

### Copying a folder copies its contents

```docker
COPY src /app/
```

This puts the files **from inside** `src` into `/app`, not `/app/src`. Write `COPY src /app/src` (or `COPY src ./src` after `WORKDIR /app`) to keep the folder.

### Setting the owner

By default, copied files belong to `root`. If your app runs as another user and needs to write to its files, set the owner while copying:

```docker
COPY --chown=node:node src ./src
```

This is much better than `RUN chown -R` afterwards, which copies all the files into a second layer and makes the image bigger. You will learn about users in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root).

> **Warning:** `COPY` can only see files inside the build context. `COPY ../secrets.txt .` fails. This is on purpose. See [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore).

## ADD: COPY with extras

`ADD` does everything `COPY` does, plus two extra things:

1. **It can download from a URL:**

```docker
ADD https://example.com/tool.tar.gz /tmp/
```

2. **It unpacks local tar archives automatically:**

```docker
ADD vendor-files.tar.gz /opt/vendor/
# /opt/vendor/ now contains the unpacked files, not the .tar.gz
```

These extras sound handy, but they can surprise you. You might want to copy an archive as it is, and `ADD` unpacks it. So the rule is simple:

> **Tip:** Use `COPY` by default. Use `ADD` only when you really want automatic unpacking of a local archive, or a download that you check (for example with the `--checksum` option of `ADD` for URL sources).

For downloads, many people prefer `RUN` with `curl` or `wget`, because you can download, check and clean up in one layer:

```docker
RUN wget -q -O /tmp/tool.tar.gz https://example.com/tool.tar.gz \
 && tar -xzf /tmp/tool.tar.gz -C /usr/local/bin \
 && rm /tmp/tool.tar.gz
```

## RUN: doing work at build time

`RUN` runs a command inside the image while building, then saves the changed files as a layer. You use it to install packages, create folders, compile code and so on.

### Shell form and exec form

```docker
# Shell form: runs with /bin/sh -c, so && and $VARIABLES work
RUN npm ci && npm cache clean --force

# Exec form: a JSON list, no shell is used
RUN ["npm", "ci"]
```

For `RUN`, the shell form is the normal choice, because you usually want shell features. (For `CMD` it is the other way round, as you will see in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint).)

### Chain related commands

Each `RUN` is a layer. Files deleted in a **later** layer still take space in the **earlier** one. So install and clean up in the **same** `RUN`:

```docker
# Bad: three layers, and the package lists stay in the first one
RUN apt-get update
RUN apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*

# Good: one layer, and the cleanup really saves space
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

The `\` at the end of a line continues the command on the next line. `&&` runs the next command only if the previous one worked, so the build stops at the first error.

Keeping `apt-get update` and `apt-get install` in the same `RUN` also matters for caching. If they are separate, Docker may reuse an old cached `update` layer and try to install from stale package lists.

On Alpine the package manager is `apk`, and the cleanup is built in:

```docker
RUN apk add --no-cache curl
```

### Make the build fail on errors

`RUN` fails the build when the **last** command returns an error. With `&&` chains every step counts. But with pipes (`|`), only the last command is checked:

```docker
# If wget fails, the build still continues, because tar is the last command
RUN wget -qO- https://example.com/tool.tar.gz | tar -xz
```

You can make the shell stricter with the `SHELL` instruction on Debian-based images that have `bash`:

```docker
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN wget -qO- https://example.com/tool.tar.gz | tar -xz
```

### RUN is not for starting your app

`RUN node src/server.js` would start the server **during the build** and the build would wait forever. Starting the app is the job of `CMD`.

## Putting it together

Here is a notes-api Dockerfile that uses all five instructions with good habits:

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app

# A small tool for debugging, installed and cleaned in one layer
RUN apk add --no-cache curl

# Package files first for caching, owned by the node user
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Source code last
COPY --chown=node:node src ./src

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
```

Build it and look at the layers:

```bash
docker build -t notes-api:1.2 .
docker history notes-api:1.2
```

```text
IMAGE          CREATED          CREATED BY                                      SIZE
4d1f0e7b2c9a   10 seconds ago   CMD ["node" "src/server.js"]                    0B
<missing>      10 seconds ago   EXPOSE map[3000/tcp:{}]                         0B
<missing>      10 seconds ago   USER node                                       0B
<missing>      10 seconds ago   COPY src ./src # buildkit                       4.1kB
<missing>      10 seconds ago   RUN /bin/sh -c npm ci --omit=dev && npm cach…   12kB
<missing>      11 seconds ago   COPY package.json package-lock.json ./ # bui…   1.2kB
<missing>      11 seconds ago   RUN /bin/sh -c apk add --no-cache curl # bui…   5.6MB
<missing>      11 seconds ago   WORKDIR /app                                    0B
...
```

You can see each instruction and how much space it added. Settings like `CMD`, `EXPOSE` and `USER` add 0 bytes.

## Common mistakes

### Using `COPY . .` too early

Copying everything before `RUN npm ci` means any code change reruns the install. Copy package files first. See [Layer Caching: Faster Builds by Ordering Instructions](/courses/docker/layer-caching).

### Cleaning up in a separate RUN

`RUN rm -rf /tmp/big-file` in its own line hides the file but does not shrink the image. Clean up in the same `RUN` that created the mess.

### Using ADD for normal files

`ADD . .` works, but it tells readers "something special happens here". Use `COPY` so your intent is clear.

### Forgetting `-y` for apt-get

Without `-y`, `apt-get install` waits for you to type "yes". There is no one to type it during a build, so it fails.

## Quick recap

- `FROM` picks the base. Always use a tag. `AS name` names a stage.
- `WORKDIR` sets and creates the current folder. Use absolute paths, not `RUN cd`.
- `COPY` brings files from the build context. Mind the trailing slash, and use `--chown` for ownership.
- `ADD` also downloads URLs and unpacks local archives. Prefer `COPY`.
- `RUN` runs build-time commands. Chain with `&&` and clean up in the same layer.

Next, you will learn the two instructions that decide what a container runs when it starts in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# notes-api, showing FROM, WORKDIR, COPY, ADD and RUN with good habits.
# Build: docker build -t notes-api:1.2 .
# Run:   docker run -d --name notes-api -p 3000:3000 notes-api:1.2
#
# FROM: always a specific tag (add @sha256:... to pin it exactly)
FROM node:24-alpine
# WORKDIR: absolute path, created if missing. Use it instead of RUN cd
WORKDIR /app
# RUN: install and clean up in ONE layer (apk --no-cache needs no cleanup)
RUN apk add --no-cache curl
# On Debian images the same idea looks like this:
# RUN apt-get update &amp;&amp; apt-get install -y --no-install-recommends curl &amp;&amp; rm -rf /var/lib/apt/lists/*
#
# COPY: package files first so npm ci is cached; destination ends with /
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
# COPY a folder: write the folder name on both sides to keep it
COPY --chown=node:node src ./src
# ADD: only when you want a local archive unpacked automatically, for example:
# ADD vendor-files.tar.gz /opt/vendor/
#
# Settings, not files: these layers add 0 bytes
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
</code></pre>

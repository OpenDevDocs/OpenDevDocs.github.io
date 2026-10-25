---
publishDate: 2026-10-25T15:25
title: 'Choosing a Base Image: Full, Slim, Alpine and Distroless'
slug: choosing-a-base-image
metadescription: 'Compare full, slim, Alpine and distroless base images by size, tools and security, and learn a simple way to pick the right one for your app.'
updateDate: 2026-10-25T15:25
author: ['bishal-biswas']
level: 2
tags: ['docker', 'base-image', 'alpine', 'security']
course: docker
---

## Why the base image matters

Every image starts from another image. The first line of a Dockerfile, `FROM node:24-alpine`, picks that starting point. It is called the **base image**. Your app sits on top of it like a house sits on its foundation.

The base image decides a lot:

- **Size.** How many megabytes you download and store, on every machine, for every version.
- **Tools.** Is there a shell, a package manager, `curl`, a compiler?
- **Security.** Every program in the image can have security holes. More programs means more to patch.
- **Compatibility.** Some software only works with a certain C library or operating system.

In this lesson you will compare the four common flavors (**full**, **slim**, **Alpine** and **distroless**) and learn a simple rule for choosing. You saw on Docker Hub in [Docker Hub and Official Images](/courses/docker/docker-hub-and-official-images) that official images come in these variants. Now you will see what the difference really is.

## The four flavors at a glance

Here are the Node.js options, pulled on the same day. Sizes are approximate and change with every release.

```bash
docker pull node:24
docker pull node:24-slim
docker pull node:24-alpine
docker images node
```

```text
REPOSITORY   TAG         IMAGE ID       CREATED      SIZE
node         24          5e2f...        3 days ago   1.1GB
node         24-slim     a91c...        3 days ago   240MB
node         24-alpine   3b7d...        3 days ago   160MB
```

The same app, the same Node.js version, and the full image is about seven times bigger than Alpine. Where does all that space go?

| Flavor | Built on | What is inside | Typical size (Node) |
|---|---|---|---|
| **Full** (`node:24`) | Debian | Node, npm, a shell, compilers (`gcc`, `make`), `git`, `curl` and many libraries | about 1 GB |
| **Slim** (`node:24-slim`) | Debian | Node, npm, a shell and the basic Debian system. No compilers. | about 240 MB |
| **Alpine** (`node:24-alpine`) | Alpine Linux | Node, npm, a small shell (`sh` from BusyBox) and the `apk` package manager | about 160 MB |
| **Distroless** | Debian (only the libraries) | Node and the libraries it needs. No shell, no package manager. | about 150 to 200 MB |

> **Note:** Size on Docker Hub is usually the **compressed** download size. `docker images` shows the size **on disk** after unpacking, which is bigger. Do not be surprised when the two numbers differ.

## Full images: everything included

The full image is a complete Debian system with build tools. It is the easiest to start with, because almost everything just works. If an npm package needs to compile native code (C or C++), the compiler is already there.

Use it when:

- you are learning and do not want surprises
- you need to compile things during the build (often as the first stage of a multi-stage build)

Avoid it for the image you ship to production. You carry compilers and tools you never use at run time, and each one is something attackers could use and something scanners will report.

## Slim images: the safe default

`-slim` is the same Debian, with the extras removed. It keeps the normal C library (**glibc**, the one almost all Linux software expects), so compatibility is very good.

```docker
# syntax=docker/dockerfile:1
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "src/server.js"]
```

If you need an extra system package, Debian's `apt-get` is there:

```docker
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

The last line deletes the package lists that `apt-get update` downloaded, so they do not stay in the layer. You will learn more about `RUN` in [Dockerfile Instructions: FROM, RUN, COPY, ADD and WORKDIR](/courses/docker/dockerfile-instructions).

## Alpine images: very small

**Alpine Linux** is a tiny Linux made for small systems. The bare `alpine:3.22` image is under 10 MB. Its package manager is `apk`:

```docker
RUN apk add --no-cache curl
```

`--no-cache` means apk does not keep its package index in the image, so you do not need a cleanup step.

Alpine has one big difference: it uses **musl** instead of glibc as its C library. A C library is the basic code that almost every program uses to talk to the operating system. Most programs do not care. But some do:

- npm or Python packages that ship **precompiled native code** built for glibc may not work, or may need to compile from source (which needs build tools).
- Some programs behave a little differently, for example in DNS lookups or speed.

```text
Error: Error loading shared library ld-linux-x86-64.so.2: No such file or directory
```

If you see an error like this on Alpine, it usually means a binary was built for glibc. The easiest fix is to switch to `-slim`.

> **Tip:** For plain JavaScript apps like notes-api, which has no native modules, Alpine works perfectly. It is the image used in most lessons of this course.

## Distroless images: no shell at all

**Distroless** images, made by Google, take one more step. They contain your language runtime and the libraries it needs. Nothing else. No shell, no `apt`, no `ls`, no `cat`.

That brings two big benefits:

- **Fewer security holes.** Fewer programs means fewer things to patch and less noise in scanner reports.
- **Harder to abuse.** If an attacker gets into the app, there is no shell to run commands with.

And one big cost: **you cannot install anything or open a shell** in the final image. So you build in a normal image and copy the result into distroless. This is a **multi-stage build**, which you will learn properly in [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds):

```docker
# syntax=docker/dockerfile:1
# Stage 1: install dependencies with npm (distroless has no npm)
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: copy the result into a distroless Node image
FROM gcr.io/distroless/nodejs24-debian12
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
# The image already starts "node", so CMD is only the script to run
CMD ["src/server.js"]
```

Notice two details:

- Use a **Debian** stage (`-slim`) for building, not Alpine, because distroless is Debian-based and uses glibc.
- The distroless Node image already sets `node` as its entry point, so `CMD` holds only the file name. You will see why in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint).

> **Note:** Distroless image names include the runtime version and the Debian version. Check the distroless project page for the current list before you pick one.

### Debugging without a shell

`docker exec -it app sh` fails on distroless, because `sh` does not exist. Distroless offers `:debug` tags that add a small BusyBox shell for troubleshooting. Use them only while debugging, never in production. You will learn more ways in [Debugging Containers That Will Not Start](/courses/docker/debugging-containers).

## Other bases you will meet

| Base | When people use it |
|---|---|
| `ubuntu:24.04` | When a tool's install guide is written for Ubuntu |
| `debian` (for example `debian:trixie-slim`) | A plain Debian system to install your own runtime on |
| `alpine:3.22` | Tiny images for shell scripts or single static programs |
| `busybox` | Very small test and helper containers |
| `scratch` | A completely empty image. Only for programs that need nothing at all, such as static Go binaries |

## How to choose

Follow this order and stop at the first one that works for you:

1. **Start with the official language image** (`node`, `python`, and so on). It is maintained and patched.
2. **Use `-slim` as your default** for production. It is small and compatible.
3. **Try `-alpine`** if you want smaller images and your app has no native code problems. Test it well.
4. **Consider distroless** when security matters a lot and you are comfortable with multi-stage builds and debugging without a shell.
5. **Use the full image** for build stages, or while learning.

Whatever you pick, use the **same base in development, CI and production**. "It works on my machine" bugs often come from different bases.

You can ask Docker Scout for advice too. It compares your base image with other tags and tells you which ones have fewer known problems:

```bash
docker scout recommendations node:24
```

You will use Scout properly in [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout).

## Common mistakes

### Choosing Alpine only because it is smallest

A few megabytes saved are not worth hours of debugging native modules. If your app has trouble on Alpine, switch to `-slim` and move on.

### Mixing Alpine and Debian between stages

You install `node_modules` in an Alpine stage and copy them into a Debian or distroless stage. Native modules built for musl will not work with glibc. Keep all stages on the same family.

### Never updating the base

A base image is a snapshot. Security fixes only reach you when you **rebuild**. Rebuild and redeploy regularly, even when your own code did not change.

### Using `:latest` as a base

`FROM node:latest` can jump to a new major version and break the build. Always pick a version, like `node:24-slim`.

## Quick recap

- The **base image** sets your image's size, tools, security and compatibility.
- **Full**: everything, very big. Good for building and learning.
- **Slim**: Debian with glibc and fewer extras. A safe default.
- **Alpine**: tiny, uses **musl**, which can break native code.
- **Distroless**: no shell or package manager. Most secure, needs a multi-stage build.
- Keep build stages and the final stage on the same family, and rebuild often to get fixes.

Next, you will see another way to make images, by saving a container's changes, and why Dockerfiles are better, in [docker commit, save and load (and Why Dockerfiles Win)](/courses/docker/docker-commit-save-and-load).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# notes-api on a slim Debian base: small, and compatible with almost every npm package.
# Build: docker build -t notes-api:slim .
# Run:   docker run -d --name notes-api -p 3000:3000 notes-api:slim
#
# Other base choices (swap the FROM line and test):
#   FROM node:24          full Debian with compilers, about 1 GB, good for build stages
#   FROM node:24-alpine   smallest official option, uses musl (check native modules)
#   distroless            no shell, needs a multi-stage build (see the lesson)
FROM node:24-slim
# Tell Node and npm this is production
ENV NODE_ENV=production
WORKDIR /app
# Extra system packages on Debian: install, then delete the package lists in the same layer
# RUN apt-get update &amp;&amp; apt-get install -y --no-install-recommends curl &amp;&amp; rm -rf /var/lib/apt/lists/*
# On Alpine the same thing is: RUN apk add --no-cache curl
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
# The official Node images include an unprivileged "node" user
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
</code></pre>

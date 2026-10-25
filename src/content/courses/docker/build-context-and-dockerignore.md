---
publishDate: 2026-10-25T15:55
title: 'The Build Context and .dockerignore'
slug: build-context-and-dockerignore
metadescription: 'Learn what the Docker build context is, why a big context slows builds and leaks secrets, and how to write a .dockerignore file that keeps it small.'
updateDate: 2026-10-25T15:55
author: ['bishal-biswas']
level: 1
tags: ['docker', 'dockerfile', 'dockerignore', 'build-context']
course: docker
---

## What is that dot?

Every build command you have typed so far ends with a dot:

```bash
docker build -t notes-api:1.0 .
```

That dot is the **build context**. It tells Docker: "these are the files you are allowed to use for this build". Here, `.` means the current folder and everything inside it.

The build context is a little like the ingredients you put on the kitchen counter before cooking. The recipe (your Dockerfile) can only use what is on the counter. If you dump the whole kitchen on the counter, cooking gets slow and messy.

In this lesson you will learn:

- what the build context is and how Docker uses it
- why a large context makes builds slow and can leak secrets
- how to write a **`.dockerignore`** file
- how to use a Dockerfile from a different folder

## How the context works

When you run `docker build`, two programs are involved, as you learned in [How Docker Works: Engine, Client, Images and Registries](/courses/docker/docker-architecture): the **client** (the `docker` command) and the **builder** (BuildKit, running inside the Docker engine). The builder may even run on another machine.

So the builder cannot simply read files from your disk. The client **sends** the files in the build context to the builder. BuildKit is smart about it: it only transfers the files that instructions like `COPY` actually ask for, and it remembers what it already has. But the whole context still has to be checked, and everything `COPY . .` asks for gets sent.

You can see the transfer in the build output:

```text
 => [internal] load build context                                  0.1s
 => => transferring context: 1.53kB                                0.0s
```

1.53 kB is tiny: just the three files of notes-api. Now imagine you ran `npm install` on your computer, so the folder has a `node_modules` folder with thousands of files, plus a `.git` folder with your whole history:

```text
 => [internal] load build context                                 14.2s
 => => transferring context: 412.80MB                             14.1s
```

Fourteen seconds before the build even starts, and those files are now inside your image after `COPY . .`.

## Three problems a big context causes

1. **Slow builds.** Sending hundreds of megabytes takes time, on every build.
2. **Big, broken images.** `COPY . .` copies your local `node_modules` over the one `npm ci` built inside the image. Your local modules may be built for Windows or macOS and fail on Linux.
3. **Leaked secrets.** Your `.env` file with real passwords, an SSH key or a cloud credentials file in the folder all get copied into the image. Anyone who pulls the image can read them.

The third problem is the worst one. As you learned in [Images and Layers Explained](/courses/docker/images-and-layers), files in a layer stay there, even if you delete them in a later step. It is the same reason you never put passwords in `ENV`, from [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env). When a build really needs a secret, use a secret mount instead, which you will learn in [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

## Only the context is visible

Docker never lets `COPY` reach outside the context:

```docker
COPY ../shared/config.json ./
```

```text
ERROR: failed to compute cache key: "/shared/config.json": not found
```

This is a safety feature. A Dockerfile cannot quietly grab files from anywhere on your computer. If you need a file from a parent folder, make the parent folder the context (see "Using a Dockerfile from another folder" below).

## The .dockerignore file

A **`.dockerignore`** file lists files and folders to leave **out** of the build context. Put it in the root of the context (the folder you pass to `docker build`), next to your Dockerfile. The name starts with a dot and has no extension.

Here is a good one for notes-api:

```text
# Dependencies are installed inside the image by npm ci
node_modules
npm-debug.log*

# Version control and editor files
.git
.gitignore
.vscode
.idea

# Secrets and local settings: never send these to the builder
.env
.env.*
*.pem

# Docker files themselves are not needed inside the image
Dockerfile
.dockerignore
compose*.yaml

# Tests, docs and build output
coverage
docs
*.md

# OS junk
.DS_Store
Thumbs.db
```

Build again and the context is small:

```bash
docker build -t notes-api:1.0 .
```

```text
 => => transferring context: 1.61kB                                0.0s
```

> **Note:** Leaving `Dockerfile` and `.dockerignore` out of the context is fine. Docker still reads them, because it loads them separately before the context.

## Pattern rules

The patterns in `.dockerignore` look like `.gitignore` patterns, with a few differences. Paths are relative to the root of the context.

| Pattern | Matches |
|---|---|
| `node_modules` | The `node_modules` folder in the root of the context |
| `*.log` | Any `.log` file in the root |
| `**/*.log` | Any `.log` file in **any** folder (`**` means "any number of folders") |
| `temp?` | `temp1`, `tempA` and so on (`?` is one character) |
| `docs/` or `docs` | The `docs` folder in the root and everything inside it |
| `# comment` | A comment line, ignored |
| `!README.md` | An **exception**: include this file even if an earlier line excluded it |

Two rules surprise people coming from Git:

- **`node_modules` only matches the root folder.** In `.gitignore` it matches at any depth. In `.dockerignore`, write `**/node_modules` to catch nested ones too.
- **The last matching line wins.** Order matters with `!` exceptions:

```text
# Ignore all Markdown files, but keep README.md
*.md
!README.md
```

If you swap these two lines, `README.md` is ignored, because `*.md` comes last.

### An "allow list" style

Some teams turn the idea around: ignore **everything**, then list only what the image needs:

```text
# Ignore everything...
*
# ...then allow just these
!package.json
!package-lock.json
!src/
```

This is very safe, because new files (like a new secret file) are left out by default. The downside: when you add a new folder that the image needs, you must remember to allow it here. Otherwise `COPY` fails with "not found".

## Check what is in your context

There is no single command that lists the context, but a tiny throwaway Dockerfile can show you. Save this as `Dockerfile.context`:

```docker
# syntax=docker/dockerfile:1
FROM busybox
WORKDIR /ctx
COPY . .
CMD ["find", ".", "-maxdepth", "2"]
```

```bash
docker build -f Dockerfile.context -t context-check .
docker run --rm context-check
```

```text
.
./package.json
./package-lock.json
./src
./src/server.js
```

If you see `node_modules`, `.git` or `.env` in the list, fix your `.dockerignore`. Remove the test image afterwards with `docker rmi context-check`.

## Using a Dockerfile from another folder

The Dockerfile and the context do not have to be in the same place. The `-f` flag (short for `--file`) picks the Dockerfile, and the last argument is still the context:

```bash
# Dockerfile in docker/, context is the project root
docker build -f docker/Dockerfile -t notes-api:1.0 .
```

Paths in `COPY` are always relative to the **context**, not to the Dockerfile. So inside `docker/Dockerfile` you still write `COPY src ./src`.

This is how you can use files from a "parent" folder: run the build from the parent and point `-f` at the Dockerfile:

```bash
# From the folder above notes-api/ and shared/
docker build -f notes-api/Dockerfile -t notes-api:1.0 .
```

### One ignore file per Dockerfile

If one project has several Dockerfiles that need different ignore rules, BuildKit looks for an ignore file named after the Dockerfile first. For `docker/Dockerfile.prod`, it checks for `docker/Dockerfile.prod.dockerignore` next to it. If that file exists, it is used instead of the `.dockerignore` in the context root.

## Other kinds of context

You will mostly use a local folder, but Docker accepts other contexts too:

```bash
# A Git repository: Docker clones it and uses it as the context
docker build -t notes-api:main https://github.com/your-name/notes-api.git#main

# No context at all: the Dockerfile comes from standard input
docker build -t tools - < Dockerfile.tools
```

With no context, `COPY` has nothing to copy, so the Dockerfile can only use `FROM`, `RUN` and settings. That is fine for images that just install tools.

## Common mistakes

### No .dockerignore at all

This is the most common one. Every project with a Dockerfile should also have a `.dockerignore`. `docker init`, which you will meet in [Project: Dockerizing a Node.js App](/courses/docker/dockerizing-a-node-app), creates one for you.

### Forgetting `.env`

Your `.env` file is in `.gitignore`, so you feel safe. But Docker does not read `.gitignore`. Add `.env` to `.dockerignore` too.

### Ignoring a file the Dockerfile needs

If you ignore `package-lock.json`, `COPY package.json package-lock.json ./` fails with "not found". When `COPY` says a file is missing but you can see it on disk, check `.dockerignore` first.

### Running the build from the wrong folder

`docker build -t notes-api .` from your home folder sends your whole home folder as the context. Always run it from the project folder, or give the right path as the last argument.

## Quick recap

- The **build context** is the set of files sent to the builder. The `.` in `docker build .` is the context.
- `COPY` can only see files inside the context. Paths are relative to the context, even with `-f`.
- A big context means slow builds, broken `node_modules` and **leaked secrets**.
- A **`.dockerignore`** in the context root leaves files out. Use `**/` for nested matches and `!` for exceptions. The last match wins.
- `-f path/Dockerfile` uses a Dockerfile from another folder; `Dockerfile.name.dockerignore` gives it its own rules.

Next, you will make builds much faster by ordering instructions well in [Layer Caching: Faster Builds by Ordering Instructions](/courses/docker/layer-caching).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Build context and .dockerignore: a setup script and cheat sheet for notes-api
# Run it from the notes-api project folder.
#
# --- 1. Create a .dockerignore next to the Dockerfile ---
cat &gt; .dockerignore &lt;&lt;'EOF'
# Dependencies are installed inside the image by npm ci (** catches nested ones)
**/node_modules
npm-debug.log*
# Version control and editor files
.git
.gitignore
.vscode
.idea
# Secrets and local settings: never send these to the builder
.env
.env.*
*.pem
# Docker files are read separately, so they are not needed in the context
Dockerfile
.dockerignore
compose*.yaml
# Tests, docs and build output, but keep README.md (the last match wins)
coverage
docs
*.md
!README.md
# OS junk
.DS_Store
Thumbs.db
EOF
#
# --- 2. Build: the final "." is the build context ---
docker build -t notes-api:1.0 .
# Look for a small number in: transferring context: 1.61kB
#
# --- 3. Use a Dockerfile from another folder (COPY paths stay relative to the context) ---
docker build -f docker/Dockerfile -t notes-api:1.0 .
#
# --- 4. Build from a Git repository as the context ---
docker build -t notes-api:main https://github.com/your-name/notes-api.git#main
#
# --- 5. Build with no context (Dockerfile from standard input, COPY is not possible) ---
docker build -t tools - &lt; Dockerfile.tools
</code></pre>

---
publishDate: 2026-10-25T14:45
title: 'Configuring Containers with Environment Variables'
slug: environment-variables
metadescription: 'Learn how to configure containers with -e and --env-file, see which variables a container has, and keep passwords out of images and shell history.'
updateDate: 2026-10-25T14:45
author: ['bishal-biswas']
level: 1
tags: ['docker', 'configuration', 'environment-variables']
course: docker
---

## One image, many settings

Imagine you build one image of your app. You want to run it on your laptop, on a test server and in production. Each place needs different settings: a different port, a different database, a different log level.

You do not want to build three different images. Instead, you build **one** image and give it different settings when it starts. The most common way to do this is with **environment variables**.

In this lesson you will learn:

- what environment variables are
- how to pass them with `-e` and `--env-file`
- how to check which variables a container has
- which images need variables to start at all
- why environment variables are not a perfect place for secrets

## What is an environment variable?

An **environment variable** is a named value that a program can read when it runs. It is like a sticky note attached to the program: "PORT is 3000", "LOG_LEVEL is debug".

Every operating system has them. On Linux you can see yours with `env`:

```bash
env | head -3
```

```text
HOME=/home/you
PATH=/usr/local/bin:/usr/bin:/bin
SHELL=/bin/bash
```

Programs read them in their own language. In Node.js it is `process.env`:

```javascript
// notes-api reads its port from the environment, with 3000 as the default
const port = Number(process.env.PORT ?? 3000);
```

This idea, keeping configuration outside the code, is a key part of good app design. The Node.js course explains it in [Environment Variables and the .env File](/courses/nodejs/environment-variables-and-env-file), and the DevOps course covers it in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

## Passing a variable with -e

Use `-e` (long form: `--env`) with `docker run`:

```bash
docker run --rm -e GREETING=hello alpine:3.22 env
```

```text
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
HOSTNAME=3f9a2b1c7d8e
GREETING=hello
HOME=/root
```

The container ran the `env` command, which printed all its variables. You can see `GREETING=hello` in the list. Notice that the container has its own small set of variables. It does **not** get all the variables from your computer.

You can pass as many as you like. Use one `-e` for each:

```bash
docker run --rm -e APP_NAME=notes -e LOG_LEVEL=debug alpine:3.22 env
```

### Values with spaces

Put quotes around the whole `KEY=value` pair:

```bash
docker run --rm -e "WELCOME_TEXT=Hello from Docker" alpine:3.22 sh -c 'echo "$WELCOME_TEXT"'
```

```text
Hello from Docker
```

> **Note:** The single quotes around `echo "$WELCOME_TEXT"` matter. They stop **your** shell from replacing `$WELCOME_TEXT` before Docker sees it. The variable is then read inside the container, where it exists.

### Copying a variable from your shell

If you write only the name, with no `=value`, Docker copies the value from your current shell:

```bash
export LOG_LEVEL=warn
docker run --rm -e LOG_LEVEL alpine:3.22 sh -c 'echo "level is $LOG_LEVEL"'
```

```text
level is warn
```

This is useful for secrets, because the value does not appear in the command itself.

## Changing the port of notes-api

notes-api listens on `process.env.PORT`. Let us run it on port 4000 instead of 3000:

```bash
# Run from inside the notes-api folder
docker run -d --name notes -e PORT=4000 -p 4000:4000 \
  -v "$PWD:/app" -w /app node:24-alpine node src/server.js
docker logs notes
```

```text
notes-api listening on port 4000
```

Remember from [Publishing Ports](/courses/docker/publishing-ports): the right side of `-p` must match the port the app really listens on. Here the app listens on 4000 because of `PORT=4000`, so we publish `4000:4000`.

## Many variables: --env-file

Typing many `-e` flags gets tiring. Put them in a file instead. Create a file called `notes.env`:

```text
# Settings for notes-api in development
PORT=3000
LOG_LEVEL=debug
NOTES_TITLE=My Notes
```

Then pass the file:

```bash
docker run --rm --env-file notes.env alpine:3.22 env
```

```text
...
PORT=3000
LOG_LEVEL=debug
NOTES_TITLE=My Notes
...
```

Rules for this file:

- One `KEY=value` per line.
- Lines starting with `#` are comments.
- Spaces in the value are kept as they are. You do not need quotes.
- Quotes are **not** removed. `NAME="Bob"` gives the value `"Bob"`, with the quote characters included.

> **Tip:** You can use `--env-file` and `-e` together. If the same name appears in both, the `-e` value wins. This is a nice way to use a shared file and override one value.

> **Warning:** Never commit an env file with real passwords to Git. Add it to `.gitignore`, and later to `.dockerignore` too, which you will learn about in [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore).

## Images that need variables

Some official images will not start without certain variables. PostgreSQL is the classic example. Try it without a password:

```bash
docker run --rm postgres:17-alpine
```

```text
Error: Database is uninitialized and superuser password is not specified.
       You must specify POSTGRES_PASSWORD to a non-empty value for the
       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
...
```

The image stopped and told you what it needs. Run it again with the variables that notes-api will use later in the course:

```bash
docker run -d --name db \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  postgres:17-alpine
```

How do you know which variables an image supports? Read its page on Docker Hub. Official images list them in an "Environment Variables" section. You will explore Docker Hub in [Docker Hub and Official Images](/courses/docker/docker-hub-and-official-images).

## Checking a container's variables

### From inside, with docker exec

```bash
docker exec db env
```

```text
POSTGRES_USER=notes
POSTGRES_PASSWORD=devpassword
POSTGRES_DB=notes
PGDATA=/var/lib/postgresql/data
...
```

Notice `PGDATA`. You did not set it. It comes from the **image**. Image authors set default variables with the `ENV` instruction in the Dockerfile, and your `-e` values are added on top (or replace them if the name is the same). You will write `ENV` yourself in [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env).

`docker exec` is explained fully in the next lesson, [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec).

### From outside, with docker inspect

```bash
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' db
```

```text
POSTGRES_USER=notes
POSTGRES_PASSWORD=devpassword
POSTGRES_DB=notes
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
...
```

This works even when the container is stopped. You will learn more about `inspect` in [Inspecting Containers](/courses/docker/inspecting-containers).

## Changing a variable

You **cannot** change the environment variables of an existing container. They are fixed when the container is created. To change one, remove the container and run a new one:

```bash
docker rm -f notes
docker run -d --name notes -e PORT=5000 -p 5000:5000 \
  -v "$PWD:/app" -w /app node:24-alpine node src/server.js
```

This feels strange at first, but it is how containers are meant to work. A container is cheap and disposable. Its configuration should be written down in a command or file, so you can recreate it any time. Later, Docker Compose will store these settings for you, as you will see in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).

## Are environment variables safe for secrets?

They are much better than writing a password into your code or your image. But they are not perfect:

- Anyone who can run `docker inspect` on the machine can read them.
- A value typed after `-e` is saved in your shell history.
- Some apps print all their variables when they crash, so secrets can end up in logs.

For learning and local development, `-e` and `--env-file` are fine. For production, Docker has better tools, such as Compose secrets that appear as files in `/run/secrets/`. Never put a secret in a Dockerfile `ENV` line, because it is then stored inside the image for anyone to read.

## Common mistakes

### Putting -e after the image name

```bash
# Wrong: everything after the image name is the command to run
docker run --rm alpine:3.22 -e GREETING=hello env
```

Flags for Docker go **before** the image name. Anything after the image name is passed to the container as its command. Correct form: `docker run --rm -e GREETING=hello alpine:3.22 env`.

### Expecting $VAR to be read inside the container

```bash
docker run --rm -e NAME=docker alpine:3.22 echo "hi $NAME"
```

This prints `hi ` with nothing after it, because **your** shell replaced `$NAME` (which is empty on your computer) before Docker ran. Wrap the command in `sh -c '...'` with single quotes, as shown earlier.

### Quotes inside an env file

`PASSWORD="devpassword"` in an `--env-file` gives a password that includes the quote marks. Leave the quotes out.

### Spaces around the equals sign

`PORT = 3000` is not valid. Write `PORT=3000`, with no spaces.

## Quick recap

- **Environment variables** let you run one image with different settings.
- Use `-e KEY=value` for one variable, `-e KEY` to copy it from your shell, and `--env-file file` for many.
- Images add their own defaults with `ENV`. Your values are added on top.
- Check variables with `docker exec name env` or `docker inspect`.
- Variables are fixed when a container is created. To change them, recreate the container.
- Keep secrets out of images and out of Git.

Next, you will learn to see what your containers are doing in [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec).

<code id="code-content" class="language-bash">
# Environment variables: cheat sheet
#
# One variable (flags always go BEFORE the image name)
docker run --rm -e GREETING=hello alpine:3.22 env
#
# Several variables, and a value with spaces
docker run --rm -e APP_NAME=notes -e "WELCOME_TEXT=Hello from Docker" alpine:3.22 env
#
# Read the variable INSIDE the container (single quotes stop your shell expanding it)
docker run --rm -e NAME=docker alpine:3.22 sh -c 'echo "hi $NAME"'
#
# Copy a value from your own shell (it does not appear in the command)
export LOG_LEVEL=warn
docker run --rm -e LOG_LEVEL alpine:3.22 sh -c 'echo "level is $LOG_LEVEL"'
#
# Many variables from a file: KEY=value per line, # for comments, no quotes
# notes.env contains:  PORT=3000  LOG_LEVEL=debug  NOTES_TITLE=My Notes
docker run --rm --env-file notes.env alpine:3.22 env
#
# A file plus an override (-e wins)
docker run --rm --env-file notes.env -e LOG_LEVEL=info alpine:3.22 env
#
# notes-api on another port: the -p container port must match PORT
docker run -d --name notes -e PORT=4000 -p 4000:4000 -v "$PWD:/app" -w /app node:24-alpine node src/server.js
#
# PostgreSQL will not start without POSTGRES_PASSWORD
docker run -d --name db -e POSTGRES_USER=notes -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=notes postgres:17-alpine
#
# See a container's variables (from inside, then from outside)
docker exec db env
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' db
#
# Variables cannot be changed later: recreate the container instead
docker rm -f notes db
</code></pre>

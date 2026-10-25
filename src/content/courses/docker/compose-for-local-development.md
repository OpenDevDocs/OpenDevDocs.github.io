---
publishDate: 2026-10-25T17:30
title: 'Local Development with Compose: Bind Mounts and Watch'
slug: compose-for-local-development
metadescription: 'Learn to code inside Compose without rebuilding after every change, using bind mounts with node --watch and the Compose watch feature with sync and rebuild.'
updateDate: 2026-10-25T17:30
author: ['bishal-biswas']
level: 2
tags: ['docker', 'docker-compose', 'development', 'bind-mounts']
course: docker
---

## The slow loop

You change one line in `src/server.js`. To see the change in your container, you run:

```bash
docker compose build api
docker compose up -d api
```

Then you wait. Then you test. Then you change another line and do it all again. This is slow and boring, and it pushes people back to running everything outside Docker.

There is a better way. In this lesson you will set up a **fast feedback loop**: you save a file, and a second later the running container uses the new code. You will learn two ways to do this:

1. **Bind mounts** plus a file watcher inside the container
2. **Compose watch**, which copies changed files into the container for you

You will also learn which one to choose, and the problems people hit on Windows and macOS.

## Way 1: bind mount your source code

You learned in [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts) that a **bind mount** makes a folder on your computer appear inside the container. It is the same folder, not a copy. When you save a file in your editor, the container sees the change immediately.

In Compose, add it under `volumes` with a path that starts with `./`:

```yaml
services:
  api:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src          # your src folder appears at /app/src in the container
```

Now the files change inside the container. But Node already loaded the old code when it started, so it keeps running the old version. You need something that restarts Node when a file changes.

### Restarting Node with --watch

Node has a built-in **watch mode**. `node --watch` restarts your program whenever one of its files changes. No extra package is needed.

Override the image's start command for development only:

```yaml
services:
  api:
    build: .
    command: ["node", "--watch", "src/server.js"]   # restart on every save
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
```

Start it and follow the logs:

```bash
docker compose up -d
docker compose logs -f api
```

Edit `src/server.js` and save. The logs show:

```text
api-1  | notes-api listening on port 3000
api-1  | Restarting 'src/server.js'
api-1  | notes-api listening on port 3000
```

No rebuild. The change is live in about a second.

> **Note:** This mount uses `./src`, not `./` (the whole project). That is on purpose. If you mount the whole project over `/app`, you also hide the `node_modules` folder that was installed in the image. See the next section.

### The node_modules problem

Imagine you mount the entire project folder:

```yaml
    volumes:
      - ./:/app                 # the whole project
```

The bind mount **covers** everything in `/app` inside the image, including `/app/node_modules` that `npm ci` created during the build. Now the container sees your laptop's `node_modules`, which may be empty, or may contain packages built for Windows or macOS instead of Linux. You get errors like:

```text
Error: Cannot find module 'pg'
```

There are two fixes:

- **Mount only what you edit**, such as `./src`, like above. This is the simplest.
- If you must mount the whole folder, add an **anonymous volume** for `node_modules`. It is listed with only a container path:

```yaml
    volumes:
      - ./:/app
      - /app/node_modules       # keep the image's node_modules, do not use the host's
```

The second line tells Docker: "for this one folder, use a separate volume, not the bind mount". You learned about volumes in [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes).

## Way 2: Compose watch

Bind mounts are simple, but they have downsides. File sharing between Windows or macOS and the Linux VM that runs Docker can be slow for big projects. And file change events do not always reach the container.

**Compose watch** solves this differently. Instead of sharing the folder, Compose watches your files on the host. When a file changes, Compose **copies** it into the running container, or rebuilds the image, depending on rules you write.

You add the rules under `develop.watch` in the service:

```yaml
services:
  api:
    build: .
    command: ["node", "--watch", "src/server.js"]
    ports:
      - "3000:3000"
    develop:
      watch:
        - action: sync               # copy changed files into the container
          path: ./src                # watch this folder on your computer
          target: /app/src           # ...and copy into this folder in the container
        - action: rebuild            # rebuild the image and recreate the container
          path: package.json
```

Then start the project in watch mode:

```bash
docker compose watch
```

```text
[+] Running 2/2
 ✔ Container notes-db-1   Started
 ✔ Container notes-api-1  Started
Watch enabled
```

Now edit `src/server.js`. Compose copies the file into the container, and `node --watch` restarts the app. Change `package.json` (for example, add a dependency), and Compose rebuilds the image, so `npm ci` runs again with the new package list.

You can also start the app and the watcher in one command, with the normal logs in the same terminal:

```bash
docker compose up --watch
```

### The three actions

| Action | What happens on a change | Use it for |
|---|---|---|
| `sync` | The changed files are copied into the container | Source code, when the app reloads itself (like `node --watch`) |
| `rebuild` | The image is rebuilt and the container replaced | `package.json`, `package-lock.json`, the Dockerfile |
| `sync+restart` | Files are copied, then the container is restarted | Config files the app reads only at startup |

Here is an example of `sync+restart` for an nginx config, which nginx reads only when it starts:

```yaml
  web:
    image: nginx:1.29-alpine
    develop:
      watch:
        - action: sync+restart
          path: ./nginx/default.conf
          target: /etc/nginx/conf.d/default.conf
```

### Ignoring files

Some files change all the time but do not matter, such as test output or editor backups. Add `ignore` to a rule. The patterns are relative to `path`:

```yaml
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - "**/*.test.js"          # do not sync test files
```

> **Tip:** Compose watch also respects your `.dockerignore` file. Files in `.dockerignore`, such as `node_modules` and `.git`, are never synced. You learned about it in [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore).

### Requirements for sync

For `sync` to work, two things must be true:

1. The service must have a `build` section. Watch is meant for images you build, not images you pull.
2. The user inside the container must be allowed to **write** to the `target` folder. If your Dockerfile switches to `USER node`, as you learned in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root), make sure `/app` is owned by that user, for example with `COPY --chown=node:node . .`.

## Bind mounts or watch?

Both are good. Use this table to choose:

| | Bind mount | Compose watch |
|---|---|---|
| How it works | Shares the real folder | Copies changed files |
| Speed on Windows and macOS | Can be slow for big projects | Fast, the container has its own copy |
| Rebuild on dependency change | No, you rebuild by hand | Yes, with `action: rebuild` |
| Changes inside the container appear on your disk | Yes | No, sync goes one way only |
| Setup | One line | A few lines of rules |

A good default for a Node project is **Compose watch**: `sync` for `src`, `rebuild` for `package.json`. Use a bind mount when a tool inside the container must **write** files back to your project, such as a code generator.

## Keep development settings separate

Notice that `command: ["node", "--watch", ...]` and `develop.watch` are only for development. In production you want the image's normal `CMD` and no watcher.

A clean way to do this is to keep your production settings in `compose.yaml` and put development extras in a second file that Compose merges automatically. You will learn exactly how in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides).

> **Tip (Windows):** With Docker Desktop on WSL 2, keep your project inside the Linux file system (for example `~/projects/notes-api` in your WSL distro), not on `C:\`. File access and change events are much faster there. You learned about WSL 2 in [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker).

## Common mistakes

### Saving a file and nothing happens

Check three things. Is the process inside the container watching for changes (`node --watch`)? Did you run `docker compose watch` or `up --watch`, not plain `up`? Does the `path` in your rule match where you are editing?

### Mounting over node_modules

Mounting `./:/app` hides the dependencies installed in the image. Mount only `./src`, or add `- /app/node_modules` as an anonymous volume.

### Permission denied when syncing

The container runs as a non-root user that cannot write to `target`. Give that user ownership of the folder in the Dockerfile.

### Expecting watch to work with an image you pulled

`develop.watch` needs a `build` section. For a pulled image such as `postgres:17-alpine`, use a bind mount for files you want to change.

## Quick recap

- A **bind mount** shares a host folder with the container. Combine it with `node --watch` to reload on save.
- Mount only the folders you edit, or protect `node_modules` with an anonymous volume.
- **Compose watch** watches host files and applies rules in `develop.watch`: `sync`, `rebuild` or `sync+restart`.
- Start it with `docker compose watch` or `docker compose up --watch`.
- `sync` needs a `build` section and a writable `target` folder.
- Keep development-only settings out of your production configuration.

Next, you will split development and production settings cleanly in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides).

<code id="code-content" class="language-yaml">
# compose.yaml for notes-api: a fast local development loop
# Start with watch:  docker compose up --watch
#   (or run "docker compose up -d" and then "docker compose watch")
services:
  api:
    build: .
    # node --watch restarts the app when a file inside the container changes
    command: ["node", "--watch", "src/server.js"]
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        # Source code: copy changed files in, node --watch reloads
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - "**/*.test.js"
        # Dependencies changed: rebuild the image so npm ci runs again
        - action: rebuild
          path: package.json
        - action: rebuild
          path: package-lock.json
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    ports:
      # Optional: reach the database from tools on your computer
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "notes", "-d", "notes"]
      interval: 5s
      timeout: 3s
      retries: 5
# Alternative to watch: a bind mount for src (comment out develop.watch above)
#    volumes:
#      - ./src:/app/src
volumes:
  pgdata:
</code></pre>

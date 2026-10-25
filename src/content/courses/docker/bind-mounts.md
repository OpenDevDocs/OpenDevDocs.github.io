---
publishDate: 2026-10-25T16:40
title: 'Bind Mounts: Sharing Folders with a Container'
slug: bind-mounts
metadescription: 'Learn how bind mounts share a folder from your computer with a container, when to use them instead of volumes, and how to avoid common traps.'
updateDate: 2026-10-25T16:40
author: ['bishal-biswas']
level: 1
tags: ['docker', 'bind-mounts', 'storage', 'development']
course: docker
---

## Sharing a folder with a container

In [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes) you stored data in a **volume**, a storage area that Docker creates and manages for you. Volumes are great for database files, but sometimes you want something different: you want a container to see a folder that already exists **on your own computer**.

For example:

- You are writing code and want the container to run your latest files, without rebuilding the image after every change.
- You want a container to read a config file you edit in your normal text editor.
- You want a container to write a report or a backup file that you can open right away on your computer.

For all of these, Docker has **bind mounts**. A **bind mount** connects a folder (or a single file) on the host to a path inside the container. It is like a window between the two: both sides look at the very same files. Change a file on your computer and the container sees the change at once. The container writes a file and it appears on your computer.

By the end of this lesson you will be able to create bind mounts with `-v` and `--mount`, make them read-only, use them for live development, and avoid the traps that confuse most beginners.

## Your first bind mount

Make a folder with a simple web page in it:

```bash
mkdir site
echo "<h1>Hello from my computer</h1>" > site/index.html
```

Now run nginx and mount the `site` folder over nginx's web folder:

```bash
docker run -d --name web -p 8080:80 \
  -v "$(pwd)/site:/usr/share/nginx/html" \
  nginx:1.29-alpine
```

Open `http://localhost:8080` and you see "Hello from my computer". nginx did not copy your file. It reads it straight from your folder through the bind mount.

Now edit the file on your computer:

```bash
echo "<h1>I changed this file</h1>" > site/index.html
curl http://localhost:8080
```

```text
<h1>I changed this file</h1>
```

No restart, no rebuild. The container saw the change at once, because it is looking at the same file.

> **Note:** `$(pwd)` means "the current folder" in bash. A bind mount needs an **absolute path** (a full path from the root, such as `/home/sam/site`). If you write just `site:/usr/share/nginx/html`, Docker thinks `site` is the name of a volume, not a folder.

### On Windows PowerShell

PowerShell uses a different way to get the current folder:

```powershell
docker run -d --name web -p 8080:80 `
  -v "${PWD}/site:/usr/share/nginx/html" `
  nginx:1.29-alpine
```

> **Tip:** On Windows, Docker Desktop runs containers inside WSL 2 (you set this up in [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker)). Bind mounts from a Windows folder such as `C:\Users\sam\project` work, but file access is slower. For the best speed, keep your project inside the WSL file system (for example `/home/sam/project` in your Ubuntu terminal) and run Docker commands from there.

## The two ways to write a bind mount

Docker gives you two flags. They do the same job with different styles.

### The short way: `-v`

```bash
docker run -v /host/path:/container/path image
```

The format is `source:target`, optionally followed by `:ro` for read-only. It is short and you will see it everywhere.

### The long way: `--mount`

```bash
docker run --mount type=bind,source=/host/path,target=/container/path image
```

It is longer, but each part has a name, so it is easier to read and harder to get wrong.

| | `-v` | `--mount` |
|---|---|---|
| Style | `source:target:options` | `key=value` pairs |
| Host folder does not exist | Docker **creates** an empty folder | Docker shows an **error** |
| Read-only | `:ro` at the end | `readonly` in the list |
| Best for | Quick commands | Scripts and anything you want to be clear |

That second row matters. With `-v`, a typing mistake in the path quietly creates a new empty folder, and your container sees nothing. With `--mount`, you get a clear error instead:

```bash
docker run --rm --mount type=bind,source="$(pwd)/sitee",target=/data alpine:3.22 ls /data
```

```text
docker: Error response from daemon: invalid mount config for type "bind": bind source path does not exist: /home/sam/sitee
```

## Read-only bind mounts

Often a container only needs to **read** your files, not change them. A config file is a good example. Make the mount **read-only** so the container cannot change or delete anything by mistake:

```bash
# Short form: add :ro
docker run -d --name web -p 8080:80 \
  -v "$(pwd)/site:/usr/share/nginx/html:ro" \
  nginx:1.29-alpine

# Long form: add readonly
docker run -d --name web2 -p 8081:80 \
  --mount type=bind,source="$(pwd)/site",target=/usr/share/nginx/html,readonly \
  nginx:1.29-alpine
```

Try to write from inside the container:

```bash
docker exec web sh -c "echo hacked > /usr/share/nginx/html/index.html"
```

```text
sh: can't create /usr/share/nginx/html/index.html: Read-only file system
```

> **Tip:** Use read-only as your default. Only remove `:ro` when the container really needs to write.

## Mounting a single file

You can mount one file instead of a whole folder. This is handy for config files:

```bash
docker run -d --name proxy -p 8080:80 \
  -v "$(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.29-alpine
```

Here only `default.conf` is replaced. Everything else in `/etc/nginx` stays as it was in the image.

> **Warning:** Some editors save a file by writing a new file and renaming it. A single-file bind mount keeps pointing at the old file, so the container may not see your edit. If that happens, restart the container, or mount the folder that holds the file instead.

## Using bind mounts for live development

The most popular use of bind mounts is development. You learned in [Project: Dockerizing a Node.js App](/courses/docker/dockerizing-a-node-app) how to build an image for **notes-api**. During development, rebuilding after every code change is slow. Instead, mount your source code into a container:

```bash
cd notes-api
docker run --rm -it --name notes-dev -p 3000:3000 \
  -v "$(pwd):/app" \
  -w /app \
  node:24-alpine \
  sh -c "npm ci && node --watch src/server.js"
```

What each part does:

- `-v "$(pwd):/app"` shares your whole project folder at `/app`.
- `-w /app` sets the working folder inside the container.
- `node --watch` restarts Node whenever a file changes.

Edit `src/server.js` in your editor, save, and Node restarts inside the container within a second.

### The node_modules trap

There is a problem hiding in that command. `npm ci` inside the container writes `node_modules` into `/app`, which is your project folder. So the container's Linux `node_modules` lands on your computer and may clash with the one you use outside Docker. Packages with native code (compiled C or C++ parts) built for Linux will not work on Windows or macOS, and the other way round.

A common fix is to put an **anonymous volume** on top of `node_modules`:

```bash
docker run --rm -it -p 3000:3000 \
  -v "$(pwd):/app" \
  -v /app/node_modules \
  -w /app \
  node:24-alpine \
  sh -c "npm ci && node --watch src/server.js"
```

The second `-v` has only a container path. Docker creates a fresh volume for `/app/node_modules`, which covers that one folder. The container installs its packages there, and your computer's folder is left alone.

> **Note:** Typing these long commands every day gets old fast. In [Local Development with Compose: Bind Mounts and Watch](/courses/docker/compose-for-local-development) you will put all of this in a `compose.yaml` file and also meet Compose Watch, which syncs files without a bind mount.

## A bind mount hides what was there

This is the most surprising rule: when you mount over a folder, **everything the image had in that folder is hidden** while the mount is active. It is not deleted. It is just covered, like putting a sheet of paper over a page.

See it for yourself:

```bash
# The image has a default index.html
docker run --rm nginx:1.29-alpine ls /usr/share/nginx/html
```

```text
50x.html
index.html
```

```bash
# Mount an empty folder over it
mkdir empty
docker run --rm -v "$(pwd)/empty:/usr/share/nginx/html" nginx:1.29-alpine ls /usr/share/nginx/html
```

```text
(no output: the folder looks empty)
```

Nothing is listed. Your empty folder covers the image's files. This is why mounting your project over `/app` hides the `node_modules` that your Dockerfile installed at build time.

## Bind mounts vs volumes

Both keep data outside the container's writable layer (you learned why that matters in [Why Container Data Disappears: The Writable Layer](/courses/docker/container-storage-basics)). They suit different jobs.

| | Bind mount | Volume |
|---|---|---|
| Where the data lives | A folder **you** choose on the host | A place **Docker** manages |
| How you name it | A full path, like `/home/sam/site` | A name, like `pgdata` |
| Created by | You (or `-v` creates an empty folder) | `docker volume create` or automatically |
| Shows up in `docker volume ls` | No | Yes |
| Speed on Docker Desktop | Slower from Windows or macOS folders | Fast |
| Best for | Source code, config files, sharing files with you | Database data and anything the app owns |
| Works the same on every machine | No, paths differ | Yes |

A simple rule: **use a bind mount when you need to see or edit the files yourself. Use a volume when only the app needs them.**

## File ownership on Linux

On a Linux host, files keep their numeric user ID (UID) across a bind mount. If the container runs as root and writes a file, that file is owned by root on your computer too, and you may need `sudo` to delete it.

```bash
docker run --rm -v "$(pwd)/out:/out" alpine:3.22 touch /out/report.txt
ls -l out
```

```text
-rw-r--r-- 1 root root 0 Oct 25 16:40 report.txt
```

You can run the container as your own user to avoid this:

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$(pwd)/out:/out" alpine:3.22 touch /out/report.txt
```

You learned more about users inside containers in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root).

> **Note:** On Docker Desktop for Windows and macOS, file sharing handles ownership for you, so you rarely see this problem there.

## Checking a container's mounts

To see what is mounted into a running container, use `docker inspect` with a format string:

```bash
docker inspect --format '{{ json .Mounts }}' web
```

```json
[{"Type":"bind","Source":"/home/sam/site","Destination":"/usr/share/nginx/html","Mode":"ro","RW":false,"Propagation":"rprivate"}]
```

`"Type":"bind"` tells you it is a bind mount, and `"RW":false` shows it is read-only.

## Common mistakes

### Using a relative path with `-v`

`-v site:/data` creates a **volume** named `site`, not a bind mount of your `site` folder. Always use a full path, such as `"$(pwd)/site"`. If you are unsure, use `--mount type=bind`, which refuses names that are not paths.

### A typo in the path creates an empty folder

With `-v`, a wrong path is created as a new empty folder and the container sees nothing. Use `--mount` when you want Docker to stop you.

### Forgetting that the mount hides the image's files

If your app suddenly "loses" files that the Dockerfile copied in, check whether a bind mount covers that folder.

### Using bind mounts in production for app code

Bind mounts tie a container to one machine's folder layout. In production, put your code **inside the image** so every server runs exactly the same thing. Keep bind mounts for development and for small things like config files.

### Spaces in paths

If a path has spaces, wrap the whole `-v` value in double quotes: `-v "$(pwd)/My Site:/data"`.

## Quick recap

- A **bind mount** shares a host folder or file with a container. Both sides see the same files at the same time.
- Use `-v /full/path:/container/path` for short commands and `--mount type=bind,source=...,target=...` when you want clear errors.
- Add `:ro` or `readonly` so the container cannot change your files.
- Bind mounts are perfect for live development; protect `node_modules` with an anonymous volume.
- Mounting over a folder **hides** what the image had there.
- Use bind mounts when **you** need the files; use volumes when only the **app** does.

Next, you will learn about memory-only storage and how to back up a volume in [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups).

<code id="code-content" class="language-bash">
# Bind mounts cheat sheet
# A bind mount shares a folder or file from your computer with a container.
# ---------- Share a folder (short -v form) ----------
# Format: -v /full/host/path:/path/in/container
docker run -d --name web -p 8080:80 \
  -v "$(pwd)/site:/usr/share/nginx/html" \
  nginx:1.29-alpine
# ---------- Same thing, read-only ----------
docker run -d --name web-ro -p 8081:80 \
  -v "$(pwd)/site:/usr/share/nginx/html:ro" \
  nginx:1.29-alpine
# ---------- Long --mount form: errors if the host path is missing ----------
docker run -d --name web-mount -p 8082:80 \
  --mount type=bind,source="$(pwd)/site",target=/usr/share/nginx/html,readonly \
  nginx:1.29-alpine
# ---------- Mount a single config file ----------
docker run -d --name proxy -p 8083:80 \
  -v "$(pwd)/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.29-alpine
# ---------- Live development for notes-api ----------
# Project folder at /app, plus an anonymous volume so node_modules stays in the container
docker run --rm -it --name notes-dev -p 3000:3000 \
  -v "$(pwd):/app" \
  -v /app/node_modules \
  -w /app \
  node:24-alpine \
  sh -c "npm ci &amp;&amp; node --watch src/server.js"
# ---------- Linux: write files as your own user, not root ----------
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$(pwd)/out:/out" alpine:3.22 touch /out/report.txt
# ---------- See what is mounted into a container ----------
docker inspect --format '{{ json .Mounts }}' web
# ---------- Windows PowerShell uses ${PWD} and a backtick for new lines ----------
# docker run -d -p 8080:80 -v "${PWD}/site:/usr/share/nginx/html" nginx:1.29-alpine
</code></pre>

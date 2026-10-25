---
publishDate: 2026-10-25T16:15
title: 'Running Containers as a Non-Root User'
slug: running-as-non-root
metadescription: 'Learn why containers run as root by default, why that is risky, and how to use USER, --chown and --user so your app runs safely without root.'
updateDate: 2026-10-25T16:15
author: ['bishal-biswas']
level: 2
tags: ['docker', 'security', 'dockerfile', 'users']
course: docker
---

## Containers run as root by default

Try this:

```bash
docker run --rm node:24-alpine whoami
```

```text
root
```

Unless an image says otherwise, the main process inside a container runs as **root**. Root is the all-powerful administrator user on Linux, with user ID (**UID**) `0`.

Root inside a container is limited by Docker's isolation, so it is not exactly the same as root on your server. But it is still much more powerful than your app needs. If an attacker finds a bug in your app, they get whatever power the app has. As root, they can install tools, change any file in the container, and, if something else is misconfigured (a bad mount, a kernel bug), have a much better chance of escaping to the host.

The fix is cheap and easy: run your app as a normal user. This follows the **principle of least privilege**, which means "give a program only the permissions it really needs". In this lesson you will switch the **notes-api** image to a non-root user, fix the file permission problems that come with it, and check the result.

## Users in Linux, in one minute

Every Linux process runs as a **user**, and every file is **owned** by a user and a **group**. A program can only read or write a file if the file's permissions allow its user to do so.

You can see the current user with `id`:

```bash
docker run --rm node:24-alpine id
```

```text
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

Users inside a container are identified by **number** (UID and GID), not by name. Remember that, it matters later. You can read more about users and permissions in [SSH, Users and Permissions](/courses/devops/ssh-users-and-permissions).

## The USER instruction

The `USER` instruction in a Dockerfile sets which user runs every following `RUN`, `CMD` and `ENTRYPOINT`. The official Node.js images already contain a user called `node` (UID 1000), so for notes-api it is one line:

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
# Everything after this line runs as "node", not root
USER node
CMD ["node", "src/server.js"]
```

Build it and check:

```bash
docker build -t notes-api:nonroot .
docker run --rm notes-api:nonroot whoami
```

```text
node
```

> **Tip:** Put `USER` **late** in the Dockerfile, after steps that need root, such as `apt-get install` or `apk add`. Installing system packages needs root.

## Creating your own user

Most images do not come with a ready-made user like `node`. Then you create one. The command depends on the base image:

```docker
# Alpine based images (BusyBox tools)
RUN addgroup -S app && adduser -S app -G app
USER app
```

```docker
# Debian and Ubuntu based images, such as python:3.13-slim
RUN groupadd --system app && useradd --system --gid app --no-create-home app
USER app
```

The `-S` and `--system` flags create a **system user**: one without a password, meant for running a service, not for a person to log in.

You can also give a fixed UID, which makes file permissions predictable across images and hosts:

```docker
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home app
USER 10001:10001
```

Using the number in `USER` (rather than the name) also lets tools check that the image does not run as root, without having to look up the name.

## The permission problem, and `--chown`

Here is the most common trouble after switching to a non-root user. Files copied with `COPY` are owned by **root** by default. Your app can usually read them, but it **cannot write** to them.

Imagine notes-api writes uploaded files to `/app/uploads`:

```text
Error: EACCES: permission denied, mkdir '/app/uploads'
```

The `/app` folder was created by `WORKDIR` while the build was still running as root, so root owns it. The `node` user is not allowed to create folders inside it.

There are two clean fixes.

### Fix 1: copy files with the right owner

`COPY --chown=user:group` sets the owner while copying. It is faster and creates a smaller image than running `chown` afterwards:

```docker
COPY --chown=node:node . .
```

### Fix 2: create writable folders on purpose

Better still, keep your code **read-only** for the app (owned by root) and create only the folders it really needs to write to:

```docker
COPY . .
# Only this folder is writable by the app user
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
```

This is safer. Even if an attacker takes control of the app, they cannot change the app's own code.

> **Warning:** Do not "fix" permission errors with `chmod -R 777`. That makes every file writable by every user, which removes the protection you just added.

### Volumes and ownership

When you mount a new, empty named volume at a folder, Docker copies the folder's existing content **and ownership** from the image into the volume. So if you create `/app/uploads` and `chown` it in the Dockerfile (Fix 2), a volume mounted there will also be writable by `node`. You will learn more in [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes).

Bind mounts are different. A **bind mount** shares a folder from your computer, and it keeps the owner it has on your computer. If the numbers do not match the container user, you get permission errors. That is covered in [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts).

## Choosing the user at run time

`docker run --user` (or `-u`) overrides the image's user. It accepts a name or numbers:

```bash
# Run as UID 1000, GID 1000
docker run --rm --user 1000:1000 notes-api:nonroot id
```

```text
uid=1000(node) gid=1000(node) groups=1000(node)
```

This is useful for testing, and for running images that you did not build as a non-root user. If the image's files are not readable by that UID, the app will fail, so test it.

You can also go the other way for debugging. If you need root inside a running non-root container, for example to install a tool while investigating, use `docker exec`:

```bash
docker exec -it --user root notes-api sh
```

## Ports below 1024

On a normal Linux system, only root may listen on ports below 1024, such as 80 and 443. Inside containers, recent Docker versions relax this rule, but other container runtimes and platforms may not. The simple, portable habit is to make your app listen on a high port such as `3000` or `8080` inside the container and map it with `-p`:

```bash
docker run -d -p 80:3000 notes-api:nonroot
```

The host listens on port 80, and the app inside listens on 3000 as a normal user. You learned how port mapping works in [Publishing Ports: Reaching Apps Inside Containers](/courses/docker/publishing-ports).

## Checking an image's user

To see which user an image will run as, without starting it:

```bash
docker image inspect --format '{{.Config.User}}' notes-api:nonroot
```

```text
node
```

An empty result means the image runs as root. Security scanners also report this. You will see more checks like this in [Container Security Best Practices](/courses/docker/container-security-best-practices).

> **Note:** There is also **rootless mode**, where the Docker daemon itself runs without root on the host. That is a separate, extra layer of protection for the host. A non-root `USER` inside the image is still a good idea either way.

## Common mistakes

### Putting `USER` before installing packages

`apk add` and `apt-get install` need root. If `USER` comes first, the build fails with a permission error. Install packages first, then switch user.

### `COPY` files the app needs to write

Copied files belong to root. Use `--chown`, or create a writable folder with `chown`, as shown above.

### Using `sudo` inside the image

Do not install `sudo` to switch users. It adds a way back to root. Use `USER` in the Dockerfile and `docker exec --user root` for debugging.

### Assuming names match between host and container

UID 1000 might be `node` in the container and `alice` on your laptop. Linux only compares the numbers.

## Quick recap

- Containers run as **root** by default. Check with `whoami` or `id`.
- Add `USER` late in the Dockerfile. Node.js images have a ready-made `node` user.
- Create your own user with `adduser -S` (Alpine) or `useradd --system` (Debian).
- Copied files are owned by root: use `COPY --chown`, or `chown` only the folders the app writes to.
- Override at run time with `--user`; debug with `docker exec --user root`.
- Listen on a high port such as 3000 inside the container and map it with `-p`.

Next, you will put everything from this section together in [Project: Dockerizing a Node.js App](/courses/docker/dockerizing-a-node-app).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# notes-api running as a non-root user.
# Build: docker build -t notes-api:nonroot .
# Check: docker run --rm notes-api:nonroot whoami   (prints "node")
#
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# Steps that need root (installing packages, creating folders) come first
COPY package.json package-lock.json ./
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
# App code stays owned by root, so the app cannot change its own code
COPY src ./src
# Create ONLY the folder the app needs to write to, owned by the node user
RUN mkdir -p /app/uploads &amp;&amp; chown node:node /app/uploads
# The official Node.js image includes the "node" user (UID 1000)
# For other images, create one first, for example on Alpine:
#   RUN addgroup -S app &amp;&amp; adduser -S app -G app
USER node
# A high port works without root on every platform
EXPOSE 3000
CMD ["node", "src/server.js"]
</code></pre>

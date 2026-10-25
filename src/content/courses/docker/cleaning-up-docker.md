---
publishDate: 2026-10-25T15:05
title: 'Cleaning Up: Pruning Containers, Images and Volumes'
slug: cleaning-up-docker
metadescription: 'Learn where Docker uses disk space, check it with docker system df, and safely remove old containers, images, volumes, networks and build cache with prune commands.'
updateDate: 2026-10-25T15:05
author: ['bishal-biswas']
level: 1
tags: ['docker', 'disk-space', 'maintenance', 'cli']
course: docker
---

## Where did my disk space go?

After a few weeks of using Docker, many people get a surprise: their disk is almost full. Docker never deletes anything on its own. Every image you pull, every stopped container, every volume and every build step stays on disk until you remove it.

The good news: cleaning up is easy, and Docker has commands built for it. The word Docker uses is **prune**, like cutting dead branches off a tree.

In this lesson you will learn:

- what takes up space in Docker
- how to measure it with `docker system df`
- how to remove one thing at a time
- how to prune many unused things at once
- what is safe to delete and what is not

> **Warning:** Pruning **permanently** deletes things. There is no recycle bin. Read what each command removes before you press "y", especially for volumes, which may hold database data.

## What uses disk space

| Thing | What it is | Why it piles up |
|---|---|---|
| **Images** | The templates containers are made from | Every pull and build adds one. Old versions stay when you pull new ones. |
| **Containers** | Running or stopped instances | Stopped containers stay until removed (unless you used `--rm`). |
| **Volumes** | Stored data, such as databases | They outlive containers on purpose, so nothing removes them automatically. |
| **Build cache** | Saved results of build steps | Every `docker build` adds layers to the cache. |
| **Networks** | Virtual networks | They use almost no space, but unused ones clutter the list. |

You will learn much more about images in [Images and Layers Explained](/courses/docker/images-and-layers) and about volumes in [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes).

## Measuring with docker system df

`df` is a classic Linux command for "disk free". `docker system df` shows how much space Docker uses:

```bash
docker system df
```

```text
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          14        3         4.21GB    3.38GB (80%)
Containers      9         2         48.3MB    41.0MB (84%)
Local Volumes   6         1         1.12GB    970.5MB (86%)
Build Cache     57        0         2.65GB    2.65GB
```

How to read it:

- **TOTAL**: how many there are.
- **ACTIVE**: how many are in use by a container (running or stopped).
- **SIZE**: total size on disk.
- **RECLAIMABLE**: space you could get back by removing the unused ones.

For a detailed list of every image, container and volume with its size, add `-v` (verbose):

```bash
docker system df -v
```

> **Note:** On Windows and macOS, Docker Desktop stores everything inside one big virtual disk file. After pruning, Docker uses less space inside it, but the file may not shrink straight away. Docker Desktop has a setting and a "Clean / Purge data" option in its Troubleshoot menu for this.

## Removing things one at a time

You already know some of these from [The Docker CLI: Commands You Will Use Every Day](/courses/docker/docker-cli-basics) and [The Container Lifecycle](/courses/docker/container-lifecycle):

```bash
docker rm web                 # remove a stopped container
docker rm -f web              # stop and remove a running container
docker rmi nginx:1.29-alpine  # remove an image (same as docker image rm)
docker volume rm pgdata       # remove a volume
docker network rm my-net      # remove a network
```

Docker protects you from some mistakes. You cannot remove an image while a container (even a stopped one) uses it:

```bash
docker rmi nginx:1.29-alpine
```

```text
Error response from daemon: conflict: unable to remove repository reference "nginx:1.29-alpine"
(must force) - container a1b2c3d4e5f6 is using its referenced image 7c3f1a2b9d8e
```

Remove the container first, then the image. You also cannot remove a volume that a container is using.

To remove several at once, you can pass a list of IDs. For example, remove every **stopped** container:

```bash
docker rm $(docker ps -aq --filter status=exited)
```

Here `docker ps -aq` prints only the IDs (`-q` means quiet), and `$( ... )` passes them to `docker rm`. But the prune commands below do this more safely.

## Pruning: removing unused things in bulk

Each type of object has its own `prune` command. Every one of them asks for confirmation first, and prints how much space it freed.

### Stopped containers

```bash
docker container prune
```

```text
WARNING! This will remove all stopped containers.
Are you sure you want to continue? [y/N] y
Deleted Containers:
4b1e0c7a92f3...
9d8e7f6a5b4c...

Total reclaimed space: 41.0MB
```

Running containers are never touched.

### Images: dangling vs unused

Two words are important here:

- A **dangling** image has no name and no tag. It shows as `<none>:<none>` in `docker images`. This happens when you build a new version with the same tag: the old image loses its tag but stays on disk.
- An **unused** image is any image that no container uses, even if it has a proper name.

```bash
docker image prune        # removes only DANGLING images (safe, small)
docker image prune -a     # removes ALL images not used by any container
```

`docker image prune -a` frees much more space. The cost: next time you need one of those images, Docker downloads or builds it again. On a development machine that is usually fine.

### Volumes

```bash
docker volume prune       # removes unused ANONYMOUS volumes
docker volume prune -a    # removes ALL unused volumes, including named ones
```

An **anonymous** volume has a long random name, and is often created automatically by images. A **named** volume is one you named yourself, like `pgdata`. Modern Docker only prunes anonymous volumes by default, to protect named ones that might hold your data. Add `-a` only when you are sure.

> **Warning:** A database volume is "unused" whenever its container is removed, even if you plan to start it again tomorrow. `docker volume prune -a` will delete it. Back up important volumes first, as you will learn in [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups).

### Networks and build cache

```bash
docker network prune      # removes networks no container is connected to
docker builder prune      # removes dangling build cache
docker builder prune -a   # removes ALL build cache
```

Removing build cache makes your next build slower, because every step must run again. You will learn why the cache is valuable in [Layer Caching: Faster Builds by Ordering Instructions](/courses/docker/layer-caching).

## docker system prune: everything at once

`docker system prune` runs several prunes in one go:

```bash
docker system prune
```

```text
WARNING! This will remove:
  - all stopped containers
  - all networks not used by at least one container
  - all dangling images
  - unused build cache

Are you sure you want to continue? [y/N]
```

By default it does **not** remove volumes, and it removes only **dangling** images. You can make it stronger:

| Command | Also removes |
|---|---|
| `docker system prune` | Stopped containers, unused networks, dangling images, unused build cache |
| `docker system prune -a` | ...and all images not used by a container |
| `docker system prune --volumes` | ...and unused anonymous volumes |
| `docker system prune -a --volumes` | Both of the above |

## Useful options for pruning

### Skip the question: -f

`-f` (force) skips the "Are you sure?" question. Useful in scripts, dangerous when typed in a hurry:

```bash
docker image prune -f
```

### Only old things: --filter until

Remove only things older than a certain time. This keeps your recent work:

```bash
# Images not used by containers and created more than 7 days (168 hours) ago
docker image prune -a --filter "until=168h"
#
# Stopped containers older than 24 hours
docker container prune --filter "until=24h"
```

### Keep important things: labels

If you add a **label** (a name tag) to things you want to keep, you can tell prune to skip them:

```bash
docker run -d --name keep-me --label keep=true nginx:1.29-alpine
docker container prune --filter "label!=keep=true"
```

## Avoiding the mess in the first place

- Use `--rm` for short test containers: `docker run --rm -it alpine:3.22 sh`. They delete themselves when they stop.
- Use specific tags, so you know which old versions are safe to delete. See [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests).
- Choose smaller base images. A `node:24-alpine` image is a fraction of the size of `node:24`. See [Choosing a Base Image](/courses/docker/choosing-a-base-image).
- On build servers and CI machines, run a scheduled cleanup, for example once a day:

```bash
# A safe daily cleanup for a build server (keeps the last 24 hours)
docker system prune -af --filter "until=24h"
docker builder prune -f --filter "until=24h"
```

## Common mistakes

### Pruning volumes without thinking

The most painful mistake. `docker volume prune -a` or `docker system prune --volumes` on a machine where the database container was just removed deletes the data. Check with `docker volume ls` first, and back up what matters.

### Expecting docker rm to free image space

Removing a container frees only its small writable layer. The image stays. Remove the image too, or run `docker image prune`.

### Using -a on a slow internet connection

`docker image prune -a` removes images you may need again. Pulling several gigabytes back can take a long time.

### Deleting files in Docker's folder by hand

Never delete files in `/var/lib/docker` directly. Docker keeps a database of what is stored there, and deleting files by hand can break it. Always use the Docker commands.

## Quick recap

- Docker keeps everything until you remove it: images, containers, volumes and build cache.
- `docker system df` shows how much space each type uses and how much you can reclaim.
- `docker container prune`, `image prune`, `volume prune`, `network prune` and `builder prune` remove unused things of one type.
- `docker system prune` cleans several types at once. Add `-a` for all unused images, `--volumes` for volumes.
- **Dangling** images have no tag. **Unused** images just have no container.
- Volumes may hold your data. Be careful and back up first.

Next, you will see what images really are, and why they share space so well, in [Images and Layers Explained](/courses/docker/images-and-layers).

<code id="code-content" class="language-bash">
# Cleaning up Docker: cheat sheet (prune deletes PERMANENTLY)
#
# ---------- Measure first ----------
docker system df            # space per type, and how much is reclaimable
docker system df -v         # every image, container and volume with its size
#
# ---------- One at a time ----------
docker rm web               # a stopped container (-f to stop and remove)
docker rmi nginx:1.29-alpine
docker volume rm pgdata
docker network rm my-net
#
# ---------- Prune by type (each asks for confirmation) ----------
docker container prune      # all stopped containers
docker image prune          # dangling images only (&lt;none&gt;:&lt;none&gt;)
docker image prune -a       # every image not used by a container
docker volume prune         # unused anonymous volumes
docker volume prune -a      # ALL unused volumes, named ones too (check first!)
docker network prune        # networks with no containers
docker builder prune        # dangling build cache (-a for all of it)
#
# ---------- Everything at once ----------
docker system prune                  # containers, networks, dangling images, build cache
docker system prune -a --volumes     # the strongest version: think before running
#
# ---------- Safer pruning ----------
docker image prune -a --filter "until=168h"            # only older than 7 days
docker container prune --filter "label!=keep=true"     # skip things labelled keep=true
#
# Daily cleanup for a build server: -f skips the question
docker system prune -af --filter "until=24h"
docker builder prune -f --filter "until=24h"
#
# Avoid clutter: test containers that delete themselves
docker run --rm -it alpine:3.22 sh
</code></pre>

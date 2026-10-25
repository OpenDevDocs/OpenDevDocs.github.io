---
publishDate: 2026-10-25T15:10
title: 'Images and Layers Explained'
slug: images-and-layers
metadescription: 'Learn what a Docker image really is: a stack of read-only layers, how layers are shared and cached, how containers add a writable layer, and how to see it with history.'
updateDate: 2026-10-25T15:10
author: ['bishal-biswas']
level: 1
tags: ['docker', 'images', 'layers', 'storage']
course: docker
---

## What is inside an image?

You have pulled and run many images by now. But what **is** an image? It is not one big file, like a zip. It is a **stack of layers**.

Understanding layers explains a lot of things that may have seemed strange:

- why pulling a second image is sometimes much faster than the first
- why ten containers from the same image use almost no extra disk space
- why changing one line of code can make a build slow or fast
- why files you change inside a container disappear when you remove it

In this lesson you will see layers with your own eyes, and learn the few rules that control them.

## The image is a recipe, the container is the meal

A quick reminder from [What is Docker and Why Use It?](/courses/docker/what-is-docker):

- An **image** is a **read-only** template. It contains the files an app needs (the operating system parts, the language runtime, your code) plus some settings (which command to run, which user, which variables).
- A **container** is a running instance of an image. You can start many containers from one image, just like you can cook many meals from one recipe.

The key word is **read-only**. Nothing a container does can change its image.

## Layers: an image is a stack of changes

Each **layer** is a set of file changes: "these files were added", "this file was changed", "this file was deleted". Stack the layers on top of each other, and you get the full set of files that a container sees.

Here is a simplified picture of an image for notes-api:

```text
 +----------------------------------------------+
 | Layer 3: COPY src/ (your code, 5 KB)         |   changes most often
 +----------------------------------------------+
 | Layer 2: RUN npm ci (node_modules, 20 MB)    |
 +----------------------------------------------+
 | Layer 1: COPY package*.json (2 KB)           |
 +----------------------------------------------+
 | Base layers: node:24-alpine (about 160 MB)   |   changes least often
 |   Alpine Linux files, Node.js, npm           |
 +----------------------------------------------+
```

Each instruction in a Dockerfile that changes files (`RUN`, `COPY`, `ADD`) creates a new layer. Instructions like `ENV`, `CMD` and `EXPOSE` only change the image's settings, so they add no files. You will write Dockerfiles like this starting in [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile).

### How layers combine

Docker uses a **union filesystem** (on Linux, usually one called **overlay2**). It shows all the layers as one single folder tree. If the same file exists in two layers, the **upper** layer wins.

```text
 Layer 3:   /app/config.json  (new version)       <-- this is what you see
 Layer 1:   /app/config.json  (old version)       <-- hidden underneath
            /etc/os-release
 ------------------------------------------------
 Result:    /app/config.json  (new version)
            /etc/os-release
```

Deleting a file in an upper layer does not really remove it from the lower one. Docker just puts a marker that says "hide this file". The file still takes space in the lower layer. This detail matters, as you will see below.

## Seeing layers when you pull

Pull an image and watch the output:

```bash
docker pull node:24-alpine
```

```text
24-alpine: Pulling from library/node
f18232174bc9: Pull complete
a54a1e7f3a1b: Pull complete
3f4cd6b2c5e2: Pull complete
6e1e2c0b4a77: Pull complete
Digest: sha256:...
Status: Downloaded newer image for node:24-alpine
docker.io/library/node:24-alpine
```

Each line with "Pull complete" is one layer. The long hex string is the start of the layer's ID.

Now pull a different image that is built on the same base:

```bash
docker pull node:24-alpine3.22
```

```text
24-alpine3.22: Pulling from library/node
f18232174bc9: Already exists
a54a1e7f3a1b: Already exists
...
```

"Already exists" means Docker already has that layer and does not download it again. This is why the second pull is so fast. (Depending on the current release, these two tags may even point at exactly the same image.)

## Layer IDs are content hashes

Each layer is identified by a **hash**: a long number calculated from its contents, using an algorithm called SHA-256. It looks like `sha256:f18232174bc9...`.

A hash works like a fingerprint:

- The same content always gives the same hash.
- Changing even one byte gives a completely different hash.

So if two images contain a layer with the same hash, Docker knows they are identical and stores it only once. This is called **content addressing**. You will see the same idea used for whole images in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests).

You can list an image's layer hashes:

```bash
docker image inspect --format '{{range .RootFS.Layers}}{{println .}}{{end}}' node:24-alpine
```

```text
sha256:...
sha256:...
sha256:...
sha256:...
```

## docker image history: how the image was built

`docker image history` shows each step that built an image, newest at the top, with the size it added:

```bash
docker image history nginx:1.29-alpine
```

```text
IMAGE          CREATED       CREATED BY                                      SIZE      COMMENT
7c3f1a2b9d8e   2 weeks ago   CMD ["nginx" "-g" "daemon off;"]                0B        buildkit.dockerfile.v0
<missing>      2 weeks ago   STOPSIGNAL SIGQUIT                              0B        buildkit.dockerfile.v0
<missing>      2 weeks ago   EXPOSE map[80/tcp:{}]                           0B        buildkit.dockerfile.v0
<missing>      2 weeks ago   ENTRYPOINT ["/docker-entrypoint.sh"]            0B        buildkit.dockerfile.v0
<missing>      2 weeks ago   COPY 30-tune-worker-processes.sh /docker-ent…   4.62kB    buildkit.dockerfile.v0
<missing>      2 weeks ago   RUN /bin/sh -c set -x     && addgroup -g 101…   5.4MB     buildkit.dockerfile.v0
<missing>      2 weeks ago   ENV NGINX_VERSION=1.29.0                        0B        buildkit.dockerfile.v0
<missing>      2 weeks ago   CMD ["/bin/sh"]                                 0B        buildkit.dockerfile.v0
<missing>      2 weeks ago   ADD alpine-minirootfs-3.22.0-x86_64.tar.gz /…   8.3MB     buildkit.dockerfile.v0
```

What you can learn here:

- The bottom row is the base, a tiny Alpine Linux file system.
- `RUN` and `COPY` steps add size. `ENV`, `EXPOSE` and `CMD` add **0B** because they only change settings.
- `<missing>` is normal. It only means those steps were built on another computer, so there is no local ID for them.

Add `--no-trunc` to see the full commands. This is a great way to learn how official images are made.

> **Tip:** `history` is also a quick way to find out **why** an image is big. Look for the rows with the largest SIZE.

## Sharing layers saves space

Run three containers from the same image:

```bash
docker run -d --name web1 nginx:1.29-alpine
docker run -d --name web2 nginx:1.29-alpine
docker run -d --name web3 nginx:1.29-alpine
docker ps -s
```

```text
NAMES   IMAGE               SIZE
web3    nginx:1.29-alpine   1.09kB (virtual 52.4MB)
web2    nginx:1.29-alpine   1.09kB (virtual 52.4MB)
web1    nginx:1.29-alpine   1.09kB (virtual 52.4MB)
```

The `-s` flag shows size. Each container uses only about **1 KB** of its own. The "virtual" size of 52 MB is the image underneath, and it is stored **once** and shared by all three. (The exact numbers depend on your system and Docker version.)

Images share layers too. If ten of your images all start `FROM node:24-alpine`, the Node base layers are stored only once on disk, and pulled only once from the registry. That is a big reason to use the same base image across a team.

## The container's writable layer

If an image is read-only, how can a container write files? Docker adds one more thin layer on top, just for that container: the **writable layer** (also called the container layer).

```text
 +---------------------------------+
 | writable layer (container web1) |  <-- your changes go here
 +---------------------------------+
 | image layer 3     (read-only)   |
 | image layer 2     (read-only)   |  shared by every container
 | image layer 1     (read-only)   |  from this image
 +---------------------------------+
```

When a container changes a file that comes from the image, Docker first copies that file up into the writable layer, then changes the copy. This is called **copy-on-write**. The image itself never changes.

You saw this layer in [Inspecting Containers](/courses/docker/inspecting-containers): `docker diff` lists exactly what is in it.

When you remove the container, its writable layer is deleted with it. That is why data inside a container disappears. You will learn the full story, and the fix, in [Why Container Data Disappears: The Writable Layer](/courses/docker/container-storage-basics) and [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes).

## Three rules that follow from layers

### 1. Deleting in a later layer does not save space

```docker
# syntax=docker/dockerfile:1
FROM alpine:3.22
# Layer A: downloads a 100 MB file
RUN wget -O /tmp/big.tar.gz https://example.com/big.tar.gz
# Layer B: "deletes" it, but layer A still contains it
RUN rm /tmp/big.tar.gz
```

The image is still about 100 MB bigger. The file is hidden, not gone. Do the download, use and cleanup in the **same** `RUN` step:

```docker
RUN wget -O /tmp/big.tar.gz https://example.com/big.tar.gz \
 && tar -xzf /tmp/big.tar.gz -C /opt \
 && rm /tmp/big.tar.gz
```

The same rule applies to secrets. A password copied in one layer and deleted in the next is still inside the image. You will learn the safe way in [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

### 2. Layers are cached in order

When you build an image again, Docker reuses each layer from its cache as long as the instruction and its input files have not changed. As soon as one layer changes, every layer **above** it must be rebuilt. So put things that change rarely (the base, dependencies) at the bottom and things that change often (your code) at the top. This is the whole topic of [Layer Caching](/courses/docker/layer-caching).

### 3. Small base, small image

Everything in the base image is in every layer stack you build on it. A smaller base means faster pulls and less disk use. See [Choosing a Base Image](/courses/docker/choosing-a-base-image).

## Common mistakes

### Thinking each container copies the image

It does not. The image layers are shared. Each container adds only its own small writable layer.

### Confusing image size and download size

`docker images` shows the size **unpacked** on disk. Registries store layers compressed, so the download is usually smaller.

### Expecting docker commit to be a good way to save changes

You can turn a container's writable layer into a new image layer with `docker commit`, but nobody can see how that image was made. Dockerfiles are better, as you will see in [docker commit, save and load](/courses/docker/docker-commit-save-and-load).

## Quick recap

- An **image** is a stack of **read-only layers**, plus settings such as the default command.
- Each `RUN`, `COPY` or `ADD` instruction adds a layer. `ENV`, `CMD` and `EXPOSE` only change settings.
- Layers are identified by **content hashes**, so identical layers are stored and downloaded only once.
- `docker image history` shows how an image was built and which steps added size.
- Each container adds a thin **writable layer** using **copy-on-write**. It is deleted with the container.
- Deleting a file in a later layer does not make the image smaller.

Next, you will learn exactly how images are named and versioned in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Dockerfile for notes-api, annotated to show which lines create LAYERS.
# Build:   docker build -t notes-api:layers .
# Inspect: docker image history notes-api:layers
#
# Base image: its layers are shared with every other image built FROM it
FROM node:24-alpine
#
# Settings only (0B in history): no new files
ENV NODE_ENV=production
#
# WORKDIR creates the folder, so it may add a tiny layer
WORKDIR /app
#
# LAYER: package files (small, change rarely)
COPY package.json package-lock.json ./
#
# LAYER: dependencies. Install and clean up in ONE RUN step:
# a file deleted in a later layer would still take space in this one
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
#
# LAYER: your code (changes most often, so it goes near the top)
COPY src ./src
#
# Settings only (0B in history)
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
#
# Every container from this image adds its own thin writable layer on top.
# That layer is deleted with the container: use volumes for data you need to keep.
</code></pre>

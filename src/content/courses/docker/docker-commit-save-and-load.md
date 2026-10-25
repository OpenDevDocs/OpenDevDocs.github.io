---
publishDate: 2026-10-25T15:30
title: 'docker commit, save and load (and Why Dockerfiles Win)'
slug: docker-commit-save-and-load
metadescription: 'Learn how docker commit turns a container into an image, how save and load move images without a registry, and why a Dockerfile is the better way.'
updateDate: 2026-10-25T15:30
author: ['bishal-biswas']
level: 2
tags: ['docker', 'images', 'docker-commit', 'offline']
course: docker
---

## Making images without a Dockerfile

So far you have only used images that someone else built. There are two ways to make your own:

1. **By hand:** start a container, change things inside it, then save the result as an image with `docker commit`.
2. **With a recipe:** write a **Dockerfile** and let `docker build` do the steps for you.

This lesson shows the first way, so you understand what it does and why almost nobody uses it for real work. You will also learn `docker save` and `docker load`, which move images between machines **without a registry**, and that part is genuinely useful.

By the end you will be able to:

- turn a container into an image with `docker commit`
- see why committed images are hard to repeat and trust
- copy an image to another machine as a single file
- know the difference between `save`/`load` and `export`/`import`

## docker commit: a snapshot of a container

In [Images and Layers Explained](/courses/docker/images-and-layers) you learned that a container is an image plus a thin **writable layer** on top. `docker commit` takes that writable layer and turns it into a new, read-only layer. The result is a new image.

Let us try it. Start an Ubuntu container and install `curl` inside it:

```bash
docker run -it --name builder ubuntu:24.04 bash
```

Now you are inside the container:

```bash
apt-get update
apt-get install -y curl
curl --version
exit
```

The container has stopped, but its writable layer still exists. You can see what changed with `docker diff`, which you met in [Inspecting Containers: inspect, stats, top and diff](/courses/docker/inspecting-containers):

```bash
docker diff builder | head -n 5
```

```text
C /etc
A /etc/ssl/certs/ca-certificates.crt
C /usr/bin
A /usr/bin/curl
C /var/lib/apt
```

`A` means added, `C` means changed and `D` means deleted. Now save it as an image:

```bash
docker commit -m "Add curl" builder my-ubuntu-curl:1.0
```

```text
sha256:9f3b2c...
```

And use it like any other image:

```bash
docker run --rm my-ubuntu-curl:1.0 curl --version
```

```text
curl 8.5.0 (x86_64-pc-linux-gnu) ...
```

It works. You made an image without writing a Dockerfile.

### Setting the start command

By default, the committed image keeps the old start command (`bash` here). You can change settings while committing with `--change`, which accepts Dockerfile-style instructions:

```bash
docker commit \
  --change 'CMD ["curl", "--version"]' \
  -m "Add curl, run curl by default" \
  builder my-ubuntu-curl:1.1
```

## Why Dockerfiles win

Look at the history of the committed image:

```bash
docker history my-ubuntu-curl:1.0
```

```text
IMAGE          CREATED          CREATED BY                                      SIZE      COMMENT
9f3b2c4e1a77   2 minutes ago    bash                                            45MB      Add curl
...            3 weeks ago      /bin/sh -c #(nop)  CMD ["/bin/bash"]            0B
...
```

The layer you made says only `bash` and "Add curl". There is no record of **what** you typed. Six months from now, nobody (including you) knows exactly how this image was made.

Here is the same image as a Dockerfile:

```docker
# syntax=docker/dockerfile:1
FROM ubuntu:24.04
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
CMD ["curl", "--version"]
```

```bash
docker build -t my-ubuntu-curl:2.0 .
```

Compare the two ways:

| | `docker commit` | Dockerfile |
|---|---|---|
| Can you repeat it? | Only if you remember every command | Yes, run `docker build` again |
| Can others review it? | No, the steps are hidden | Yes, it is a text file in Git |
| Easy to update the base? | Redo everything by hand | Change the `FROM` line and rebuild |
| Leftover junk? | Often (caches, temp files, shell history) | You control every layer |
| Works in CI? | Not really | Yes, every pipeline builds from Dockerfiles |
| Layer caching? | No | Yes, unchanged steps are reused |

A Dockerfile is like a written recipe. `docker commit` is like a photo of a cake. The photo shows the result, but you cannot bake the same cake again from it.

> **Warning:** A committed image keeps everything in the container's writable layer: downloaded files, log files and even passwords you typed or saved while you were inside. Never commit a container you used with real secrets.

### When commit is still handy

`docker commit` has a few small uses:

- **Debugging.** A container is broken in a strange state. Commit it, then start a new container from that image to look around without touching the original.
- **Quick experiments.** You want to try a few commands and keep the result for an hour.

Once the experiment works, write the steps into a Dockerfile. You will write your first one in the next lesson.

## docker save and load: images as files

Sometimes you need to move an image to a machine that cannot reach a registry. For example:

- a server with no internet access (an **air-gapped** server)
- a slow connection where you would rather copy a file once
- sending an image to a colleague on a USB stick

`docker save` writes one or more images, with all their layers, tags and settings, into a single **tar archive** (a file that bundles many files together, like a zip file).

```bash
docker save -o notes-images.tar postgres:17-alpine redis:8-alpine
ls -lh notes-images.tar
```

```text
-rw------- 1 you you 390M Oct 25 15:30 notes-images.tar
```

You can compress it on the way to make the file smaller:

```bash
docker save postgres:17-alpine | gzip > postgres-17.tar.gz
```

Copy the file to the other machine (for example with `scp`, which you can learn about in [SSH, Users and Permissions](/courses/devops/ssh-users-and-permissions)), then load it:

```bash
docker load -i notes-images.tar
```

```text
Loaded image: postgres:17-alpine
Loaded image: redis:8-alpine
```

`docker load` understands gzip files too, so this works without unpacking first:

```bash
docker load -i postgres-17.tar.gz
```

The images arrive with their names and tags, ready to use with `docker run`.

> **Tip:** On a machine with access to a registry, pushing and pulling is still the better way. Registries only send the layers that are missing, while a tar file always contains everything. You will push images in [Pushing Images to Docker Hub and GitHub Container Registry](/courses/docker/pushing-images-to-a-registry).

## export and import: not the same thing

Docker has two more commands with similar names. They are easy to confuse.

| Command pair | Works on | Keeps layers and history? | Keeps CMD, ENV, ports? |
|---|---|---|---|
| `docker save` / `docker load` | **Images** | Yes | Yes |
| `docker export` / `docker import` | A **container's** file system | No, everything becomes one flat layer | No |

```bash
# Flatten a container's files into a tar file
docker export -o builder-fs.tar builder
# Turn that tar file into a brand new image with one layer
docker import builder-fs.tar my-flat-image:1.0
```

The imported image has no `CMD`, no environment variables and no history, so you must give a command every time you run it. For moving images, almost always use `save` and `load`.

## Common mistakes

### Committing instead of fixing the Dockerfile

You `docker exec` into a container, fix a bug, and commit. It works today. But the next `docker build` brings the bug back, because the Dockerfile never changed. Fix the source, then rebuild.

### Thinking `docker save` works on containers

`docker save` takes **image** names. If you give it a container name, it fails or saves the wrong thing. To save a container's changes, commit it first, then save the image.

### Forgetting the tags

`docker save` with an image ID (`docker save 9f3b2c4e1a77`) saves the layers but not the name. After loading, the image shows as `<none>`. Save by name and tag instead.

## Quick recap

- `docker commit` turns a container's writable layer into a new image. `docker diff` shows what changed.
- Committed images are hard to repeat, review and update, and can hide secrets. **Dockerfiles win** for real work.
- `docker save -o file.tar image:tag` puts images in one file; `docker load -i file.tar` brings them back with tags.
- Pipe through `gzip` to make the file smaller; `docker load` reads gzip directly.
- `export`/`import` work on a container's flat file system and lose history and settings.

Next, you will write a real recipe for the notes-api app in [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# docker commit, save and load: cheat sheet
#
# --- Make an image by hand (for experiments only) ---
docker run -it --name builder ubuntu:24.04 bash
#   inside: apt-get update &amp;&amp; apt-get install -y curl &amp;&amp; exit
# See what changed in the container (A = added, C = changed, D = deleted)
docker diff builder
# Save the container's changes as a new image
docker commit -m "Add curl" builder my-ubuntu-curl:1.0
# Change the start command while committing
docker commit --change 'CMD ["curl", "--version"]' builder my-ubuntu-curl:1.1
# The history shows no real build steps: this is why Dockerfiles win
docker history my-ubuntu-curl:1.0
#
# --- Move images without a registry ---
# Save one or more images, with layers and tags, to a tar file
docker save -o notes-images.tar postgres:17-alpine redis:8-alpine
# Save and compress in one go
docker save postgres:17-alpine | gzip &gt; postgres-17.tar.gz
# On the other machine: load them (gzip files work too)
docker load -i notes-images.tar
docker load -i postgres-17.tar.gz
#
# --- Flatten a container (loses history, CMD and ENV) ---
docker export -o builder-fs.tar builder
docker import builder-fs.tar my-flat-image:1.0
#
# --- Clean up the experiment ---
docker rm builder
docker rmi my-ubuntu-curl:1.0 my-ubuntu-curl:1.1 my-flat-image:1.0
</code></pre>

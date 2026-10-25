---
publishDate: 2026-10-25T16:30
title: 'Why Container Data Disappears: The Writable Layer'
slug: container-storage-basics
metadescription: 'Learn where a container stores the files it writes, why that data is lost when the container is removed, and which storage options keep it safe.'
updateDate: 2026-10-25T16:30
author: ['bishal-biswas']
level: 1
tags: ['docker', 'storage', 'containers', 'beginner']
course: docker
---

## Where did my data go?

Here is a story that happens to almost everyone who learns Docker. You run a database in a container. You add some data. Later you update to a newer image: you remove the old container and start a new one. And all your data is **gone**.

Nothing was broken. Docker did exactly what it was designed to do. In this lesson you will see why, by running a small experiment, and you will learn about the **writable layer**, which is where a container keeps the files it changes. Then you will meet the three ways Docker offers to store data safely outside it.

## An experiment: what survives and what does not

Start a small Alpine container that just waits:

```bash
docker run -d --name demo alpine:3.22 sleep infinity
```

Write a file inside it, and read it back:

```bash
docker exec demo sh -c 'echo "my important note" > /notes.txt'
docker exec demo cat /notes.txt
```

```text
my important note
```

### Test 1: stop and start

```bash
docker stop demo
docker start demo
docker exec demo cat /notes.txt
```

```text
my important note
```

The file is still there. (The stop takes about 10 seconds, because `sleep` ignores the polite stop signal and Docker has to wait before forcing it. You learned why in [The Container Lifecycle: Create, Start, Stop and Remove](/courses/docker/container-lifecycle).)

### Test 2: remove and run again

Now do what you would do when updating to a new image: remove the container and create a fresh one from the same image.

```bash
docker rm -f demo
docker run -d --name demo alpine:3.22 sleep infinity
docker exec demo cat /notes.txt
```

```text
cat: can't open '/notes.txt': No such file or directory
```

The file is gone. So the rule is:

| Action | Data written inside the container |
|---|---|
| `docker stop`, then `docker start` | Kept |
| `docker restart` | Kept |
| `docker rm`, then `docker run` again | **Lost** |
| The container is recreated by Compose or a deploy | **Lost** |

To understand why, you need to look at how a container's files are built.

## The writable layer

You learned in [Images and Layers Explained](/courses/docker/images-and-layers) that an image is a stack of **read-only layers**. Read-only means they can never change. Many containers can share the same image because nobody is allowed to change it.

When Docker creates a container, it adds one more, thin layer on top: the **writable layer**. Every file the container creates, changes or deletes is recorded in this layer.

```text
+--------------------------------------+
|  Writable layer (this container only) |  <- /notes.txt lives here
+--------------------------------------+
|  Image layer 3 (read-only)            |
|  Image layer 2 (read-only)            |
|  Image layer 1 (read-only)            |
+--------------------------------------+
```

The container sees all the layers merged together as one normal-looking file system. That merging is done by a **storage driver**, usually `overlay2` on Linux.

Here is the key point: the writable layer **belongs to the container**. It is created with the container and **deleted with the container**. `docker rm` throws it away. A new container gets a new, empty writable layer on top of the same image.

A good comparison is a printed form with a sheet of tracing paper on top. You write on the tracing paper, not on the form. The form (the image) stays clean, so it can be used again. When you throw the tracing paper away (remove the container), your writing goes with it.

## Copy-on-write

What happens if a container changes a file that came from the image, such as `/etc/profile`? The image layer is read-only, so Docker cannot change it there.

Instead, Docker uses **copy-on-write**: the first time the container writes to that file, Docker copies it up into the writable layer, and the change happens on the copy. The original in the image is untouched. Deleting a file from the image works in a similar way: Docker adds a small marker in the writable layer that says "this file is hidden".

You can see every change in the writable layer with `docker diff`, which you met in [Inspecting Containers: inspect, stats, top and diff](/courses/docker/inspecting-containers):

```bash
docker exec demo sh -c 'echo hello > /root/hello.txt; echo "# changed" >> /etc/profile; rm /etc/motd'
docker diff demo
```

```text
C /etc
C /etc/profile
D /etc/motd
C /root
A /root/hello.txt
```

| Letter | Meaning |
|---|---|
| `A` | Added: a new file or folder |
| `C` | Changed: a file or folder from the image was modified |
| `D` | Deleted: a file from the image was removed (hidden) |

## How big is the writable layer?

`docker ps --size` (or `-s`) shows how much each container has written:

```bash
docker ps --size
```

```text
CONTAINER ID   IMAGE         COMMAND            STATUS         NAMES   SIZE
9c41e7d2b8a0   alpine:3.22   "sleep infinity"   Up 2 minutes   demo    1.05kB (virtual 8.32MB)
```

The first number is the writable layer. The "virtual" number adds the read-only image layers, which are shared with other containers.

On Linux the layers live under `/var/lib/docker`. On Docker Desktop (Windows and macOS) they live inside Docker's own small Linux virtual machine, so you will not find them in your normal folders. Either way, you should not edit them by hand.

## Why the writable layer is the wrong place for data

The writable layer is fine for temporary files. It is a poor home for data you care about:

- **It is deleted with the container.** Updates, redeploys and `docker compose down` all recreate containers.
- **It is tied to one container.** Another container cannot easily read it, and you cannot easily back it up.
- **It is slower.** Copy-on-write adds work, which matters for programs that write a lot, such as databases.
- **It grows quietly.** Logs or uploads written inside the container keep growing until the disk is full.

This is also why you should treat containers as **disposable**: you should be able to delete any container and create a new one at any time without losing anything. To make that possible, data must live **outside** the container.

## Three ways to keep data outside the container

Docker gives you three kinds of **mounts**. A mount makes a storage location appear as a folder inside the container. Writes to that folder go to the mount, not to the writable layer.

| Mount type | Where the data lives | Best for | Lesson |
|---|---|---|---|
| **Volume** | A storage area managed by Docker | Databases and any data that must survive | [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes) |
| **Bind mount** | A folder on your computer that you choose | Sharing source code during development, config files | [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts) |
| **tmpfs mount** | Memory (RAM) only, never written to disk | Temporary or sensitive files | [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups) |

Here is a quick preview of the fix for our experiment, using a volume:

```bash
docker rm -f demo
docker run -d --name demo -v demo-data:/data alpine:3.22 sleep infinity
docker exec demo sh -c 'echo "my important note" > /data/notes.txt'

# Remove the container and create a brand new one with the same volume
docker rm -f demo
docker run -d --name demo -v demo-data:/data alpine:3.22 sleep infinity
docker exec demo cat /data/notes.txt
```

```text
my important note
```

The note survived, because it was stored in the `demo-data` volume, not in the writable layer.

## Going further: read-only containers

If your app should not write anywhere except a few known folders, you can make the whole container file system read-only with `--read-only`. Any write outside a mount then fails:

```bash
docker run --rm --read-only alpine:3.22 sh -c 'echo test > /test.txt'
```

```text
sh: can't create /test.txt: Read-only file system
```

This is a useful security setting, because an attacker cannot change your app's files. You will learn more in [Container Security Best Practices](/courses/docker/container-security-best-practices).

## Common mistakes

### Thinking `docker stop` deletes data

It does not. Stop and start keep the writable layer. Only removing the container deletes it.

### Running a database without a volume

It works perfectly until the first update, then the data is gone. Always give databases a volume.

### Writing logs to files inside the container

The files grow in the writable layer and are lost on removal. Write logs to standard output instead, so `docker logs` can read them, as you learned in [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec).

### Using `docker commit` to "save" data

`docker commit` turns a container's writable layer into a new image layer. It mixes your data into the image and is not a backup method. Use volumes.

## Quick recap

- Every container has a thin **writable layer** on top of the read-only image layers.
- Files the container creates or changes go into that layer, using **copy-on-write**.
- Stop and start keep the layer. **Removing the container deletes it.**
- `docker diff` shows what changed; `docker ps --size` shows how big the layer is.
- Keep important data outside the container with a **volume**, **bind mount** or **tmpfs mount**.

Clean up the experiment with `docker rm -f demo` and `docker volume rm demo-data`. Next, you will learn the right way to keep data in [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes).

<code id="code-content" class="language-bash">
# Cheat sheet: the container writable layer
#
# Start a test container that just waits
docker run -d --name demo alpine:3.22 sleep infinity
# Write a file into the writable layer
docker exec demo sh -c 'echo "my important note" &gt; /notes.txt'
# Stop and start: the file is KEPT
docker stop demo
docker start demo
docker exec demo cat /notes.txt
# Remove and recreate: the file is LOST (new, empty writable layer)
docker rm -f demo
docker run -d --name demo alpine:3.22 sleep infinity
docker exec demo cat /notes.txt
#
# See what a container changed compared to its image (A added, C changed, D deleted)
docker diff demo
# See how much each container has written (first number = writable layer)
docker ps --size
#
# Keep data safe: write to a volume instead of the writable layer
docker rm -f demo
docker run -d --name demo -v demo-data:/data alpine:3.22 sleep infinity
docker exec demo sh -c 'echo "my important note" &gt; /data/notes.txt'
docker rm -f demo
docker run -d --name demo -v demo-data:/data alpine:3.22 sleep infinity
# Still there, because it lives in the volume
docker exec demo cat /data/notes.txt
#
# Make the container file system read-only (writes outside mounts fail)
docker run --rm --read-only alpine:3.22 sh -c 'echo test &gt; /test.txt'
#
# Clean up
docker rm -f demo
docker volume rm demo-data
</code></pre>

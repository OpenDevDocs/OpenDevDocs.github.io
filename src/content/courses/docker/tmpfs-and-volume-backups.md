---
publishDate: 2026-10-25T16:45
title: 'tmpfs Mounts and Backing Up Volumes'
slug: tmpfs-and-volume-backups
metadescription: 'Learn how tmpfs mounts keep temporary files in memory, and how to back up, restore and copy Docker volumes safely with simple tar commands.'
updateDate: 2026-10-25T16:45
author: ['bishal-biswas']
level: 2
tags: ['docker', 'volumes', 'tmpfs', 'backups']
course: docker
---

## Two storage jobs you will meet soon

So far in this section you have met two kinds of storage. In [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes) you used **volumes** that Docker manages, and in [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts) you shared folders from your own computer.

This lesson covers two more jobs:

1. **Storing temporary files in memory.** Some files should never touch the disk at all: short-lived cache files, session files, or a secret that a program writes for a moment. For this, Docker has **tmpfs mounts**.
2. **Backing up a volume.** A volume keeps your data safe when a container is removed, but it does not protect you if the disk dies or someone runs `docker volume rm` by mistake. You need a **backup**, a copy of the data stored somewhere else.

By the end you will be able to add a tmpfs mount, run a container with a read-only file system, and back up, restore and copy any volume.

## Part 1: tmpfs mounts

### What a tmpfs mount is

A **tmpfs mount** is a folder inside the container whose files live only in the host's **memory (RAM)**. Think of it as a whiteboard: fast to write on, and wiped clean when you leave the room.

- Files are **never written to disk**.
- When the container **stops**, the files are **gone**. Even a restart wipes them.
- It is very **fast**, because memory is faster than disk.
- It cannot be shared between containers.

> **Note:** tmpfs is a Linux feature. It works on Linux hosts and on Docker Desktop (because Docker Desktop runs a small Linux system for you). It does not work with Windows containers.

### Adding a tmpfs mount

There are two ways, just like bind mounts.

The short form uses `--tmpfs`:

```bash
docker run --rm -it --tmpfs /scratch alpine:3.22 sh
```

The long form uses `--mount`:

```bash
docker run --rm -it \
  --mount type=tmpfs,destination=/scratch,tmpfs-size=67108864 \
  alpine:3.22 sh
```

`tmpfs-size` is in bytes. `67108864` bytes is 64 MB. Inside the container, check it with `df` (disk free):

```bash
df -h /scratch
```

```text
Filesystem                Size      Used Available Use% Mounted on
tmpfs                    64.0M         0     64.0M   0% /scratch
```

> **Warning:** Without a size limit, a tmpfs mount can grow until the host runs low on memory. Always set a size. With the short form you can write `--tmpfs /scratch:size=64m`.

### Seeing it disappear

Run a container that writes a file to tmpfs, then restart it:

```bash
docker run -d --name temp-demo --tmpfs /scratch alpine:3.22 sleep 3600
docker exec temp-demo sh -c "echo hello > /scratch/note.txt"
docker exec temp-demo cat /scratch/note.txt
```

```text
hello
```

```bash
docker restart temp-demo
docker exec temp-demo cat /scratch/note.txt
```

```text
cat: can't open '/scratch/note.txt': No such file or directory
```

The file is gone after the restart. Compare that with the writable layer you learned about in [Why Container Data Disappears: The Writable Layer](/courses/docker/container-storage-basics), which survives a restart and is only lost when the container is removed.

### The best use: read-only containers

A strong security habit is to run a container with a **read-only root file system**. The `--read-only` flag makes the whole container file system read-only, so an attacker who breaks into the app cannot change its files or drop new programs onto the disk.

The problem is that many apps need to write a few temporary files. tmpfs solves this:

```bash
docker run -d --name web -p 8080:80 \
  --read-only \
  --tmpfs /var/cache/nginx:size=32m \
  --tmpfs /var/run:size=1m \
  --tmpfs /tmp:size=16m \
  nginx:1.29-alpine
```

nginx can write its cache and process ID file to memory, and everything else stays locked. You will see more of this in [Container Security Best Practices](/courses/docker/container-security-best-practices).

### Which storage should I use?

| Type | Lives in | Survives restart | Survives `docker rm` | Typical use |
|---|---|---|---|---|
| Writable layer | Container | Yes | No | Nothing important |
| Volume | Docker's storage | Yes | Yes | Database data |
| Bind mount | Your folder | Yes | Yes | Source code, config |
| tmpfs | Memory | **No** | No | Temp files, caches, secrets in use |

## Part 2: backing up volumes

### Why volumes need backups

A volume survives the container, but it lives on one disk on one machine. You can still lose it if:

- someone runs `docker volume rm pgdata` or `docker volume prune` (see [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker)),
- the disk fails,
- a bad app update corrupts the data,
- you move to a new server.

A backup is a copy of the data you keep somewhere else.

### The trick: a helper container

You cannot just open a volume like a normal folder (on Docker Desktop it lives inside the Linux virtual machine). The usual trick is to start a small **helper container** that mounts two things:

1. the **volume** you want to back up, and
2. a **bind mount** to a folder on your computer where the backup file will go.

Then the helper runs `tar` to pack the volume into one file. **tar** is a classic tool that packs many files into one archive file, like a zip file.

```text
 your computer                 helper container (alpine)
 ./backups  <---- bind mount ---->  /backup
                                       ^
                                       | tar packs /data into /backup/pgdata.tar.gz
                                       |
 volume pgdata  <---- volume ----->  /data
```

### Step 1: stop the app that writes to the volume

If a database is writing while you copy its files, the copy can be broken. Stop the container first:

```bash
docker stop db
```

### Step 2: create the backup

```bash
mkdir -p backups
docker run --rm \
  -v pgdata:/data:ro \
  -v "$(pwd)/backups:/backup" \
  alpine:3.22 \
  tar czf /backup/pgdata-2026-10-25.tar.gz -C /data .
```

Line by line:

- `--rm` removes the helper container when it finishes.
- `-v pgdata:/data:ro` mounts the volume read-only, so the backup cannot change it.
- `-v "$(pwd)/backups:/backup"` mounts your `backups` folder.
- `tar czf` means **c**reate an archive, g**z**ip it, write it to a **f**ile.
- `-C /data .` means "go into `/data` and pack everything there".

Check the result and start the database again:

```bash
ls -lh backups
docker start db
```

```text
-rw-r--r-- 1 sam sam 6.1M Oct 25 16:45 pgdata-2026-10-25.tar.gz
```

### Step 3: restore the backup

To restore, do the opposite: unpack the file into a volume. It is safest to restore into a **new, empty** volume:

```bash
docker volume create pgdata-restored
docker run --rm \
  -v pgdata-restored:/data \
  -v "$(pwd)/backups:/backup:ro" \
  alpine:3.22 \
  tar xzf /backup/pgdata-2026-10-25.tar.gz -C /data
```

`tar xzf` means e**x**tract a g**z**ipped **f**ile. Now start a database container with the restored volume and check your data:

```bash
docker run -d --name db-restored \
  -e POSTGRES_PASSWORD=devpassword \
  -v pgdata-restored:/var/lib/postgresql/data \
  postgres:17-alpine
```

> **Tip:** A backup you have never restored is only a hope. Test your restore regularly, on a different volume, so you know it works before you need it.

### Copying a volume

The same idea copies one volume to another, for example before a risky upgrade:

```bash
docker volume create pgdata-copy
docker run --rm \
  -v pgdata:/from:ro \
  -v pgdata-copy:/to \
  alpine:3.22 \
  sh -c "cp -a /from/. /to/"
```

`cp -a` copies everything and keeps file owners and permissions, which databases care about.

### A better way for databases: use their own tools

File-level backups work for any volume, but they need the database to be stopped. Databases come with their own backup tools that make a **consistent** copy while they keep running. For PostgreSQL that tool is `pg_dump`, and you can run it with `docker exec` (you learned `exec` in [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec)):

```bash
# Back up the "notes" database into a plain SQL file on your computer
docker exec db pg_dump -U notes notes > backups/notes-2026-10-25.sql
```

```bash
# Restore it into a running database
docker exec -i db psql -U notes notes < backups/notes-2026-10-25.sql
```

The `-i` flag keeps standard input open so the SQL file can flow into `psql`.

| Method | Database must stop? | Works for | Result |
|---|---|---|---|
| `tar` with a helper container | Yes, for databases | Any volume | Exact copy of files |
| `pg_dump` | No | PostgreSQL only | SQL file, portable across versions |

> **Note:** For production servers, you would run backups on a schedule (for example with cron) and copy the files to another machine or to cloud storage. You will see how that fits in [Deploying a Compose App to a Linux Server](/courses/docker/deploying-with-docker-on-a-server).

## Common mistakes

### Putting important data in tmpfs

tmpfs is wiped on every stop and restart. Never use it for anything you need later.

### No size limit on tmpfs

An unlimited tmpfs can eat the host's memory. Always set `size=` or `tmpfs-size=`.

### Backing up a running database by copying files

The copy may be half-written and fail to start. Stop the container first, or use the database's own tool like `pg_dump`.

### Keeping the backup on the same disk

If the disk dies, the volume and the backup die together. Copy backups to another machine or service.

### Restoring over a live volume

Unpacking into a volume that a running database is using can corrupt it. Restore into a new volume and switch the container to it.

## Quick recap

- A **tmpfs mount** keeps files in memory only. They vanish when the container stops.
- Add one with `--tmpfs /path:size=64m` or `--mount type=tmpfs,destination=/path,tmpfs-size=...`.
- Combine `--read-only` with tmpfs mounts for a locked-down container.
- Back up a volume with a helper container that mounts the volume and a backup folder, then runs `tar czf`.
- Restore with `tar xzf` into a new volume, and test your restores.
- For databases, prefer their own tools, such as `pg_dump`.

Next, you will learn how containers talk to each other and to the outside world in [Docker Networking Basics](/courses/docker/docker-networking-basics).

<code id="code-content" class="language-bash">
# tmpfs mounts and volume backups cheat sheet
# ---------- tmpfs: files in memory only, wiped on every stop ----------
docker run --rm -it --tmpfs /scratch:size=64m alpine:3.22 sh
# Long form (tmpfs-size is in bytes: 67108864 = 64 MB)
docker run --rm -it --mount type=tmpfs,destination=/scratch,tmpfs-size=67108864 alpine:3.22 sh
# ---------- Read-only container with small tmpfs folders for temp files ----------
docker run -d --name web -p 8080:80 \
  --read-only \
  --tmpfs /var/cache/nginx:size=32m \
  --tmpfs /var/run:size=1m \
  --tmpfs /tmp:size=16m \
  nginx:1.29-alpine
# ---------- Back up a volume to ./backups ----------
mkdir -p backups
docker stop db
docker run --rm \
  -v pgdata:/data:ro \
  -v "$(pwd)/backups:/backup" \
  alpine:3.22 \
  tar czf /backup/pgdata-2026-10-25.tar.gz -C /data .
docker start db
# ---------- Restore into a new, empty volume ----------
docker volume create pgdata-restored
docker run --rm \
  -v pgdata-restored:/data \
  -v "$(pwd)/backups:/backup:ro" \
  alpine:3.22 \
  tar xzf /backup/pgdata-2026-10-25.tar.gz -C /data
# ---------- Copy one volume to another ----------
docker volume create pgdata-copy
docker run --rm -v pgdata:/from:ro -v pgdata-copy:/to alpine:3.22 sh -c "cp -a /from/. /to/"
# ---------- PostgreSQL: consistent backup while the database runs ----------
docker exec db pg_dump -U notes notes &gt; backups/notes-2026-10-25.sql
docker exec -i db psql -U notes notes &lt; backups/notes-2026-10-25.sql
</code></pre>

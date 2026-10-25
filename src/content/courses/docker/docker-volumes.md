---
publishDate: 2026-10-25T16:35
title: 'Docker Volumes: Keeping Data Safe'
slug: docker-volumes
metadescription: 'Learn how to create, mount, inspect, share and remove Docker volumes, and use one to keep a Postgres database safe when its container is replaced.'
updateDate: 2026-10-25T16:35
author: ['bishal-biswas']
level: 1
tags: ['docker', 'volumes', 'storage', 'postgres']
course: docker
---

## Data that outlives the container

In [Why Container Data Disappears: The Writable Layer](/courses/docker/container-storage-basics) you saw that files written inside a container are deleted when the container is removed. For a database, that is a disaster.

A **volume** is the fix. A volume is a storage area that Docker creates and manages for you, separate from any container. You **mount** it into a container at a folder path. Everything the container writes to that folder goes into the volume. When the container is removed, the volume stays, and you can attach it to the next container.

Think of a volume as a USB drive. You can plug it into one computer, save files, unplug it, throw that computer away, and plug the drive into a new computer. The files are still there.

In this lesson you will create and inspect volumes, run Postgres for the **notes-api** app with a volume, prove the data survives, share a volume between containers, and clean up safely.

## Your first volume

Create a volume, list volumes, and look at its details:

```bash
docker volume create notes-data
docker volume ls
```

```text
DRIVER    VOLUME NAME
local     notes-data
```

```bash
docker volume inspect notes-data
```

```json
[
    {
        "CreatedAt": "2026-10-25T16:35:12Z",
        "Driver": "local",
        "Labels": null,
        "Mountpoint": "/var/lib/docker/volumes/notes-data/_data",
        "Name": "notes-data",
        "Options": null,
        "Scope": "local"
    }
]
```

- **Driver** `local` means the data is stored on this machine's disk. (Other drivers can store data on network storage, but `local` is what you will use almost always.)
- **Mountpoint** is where the files really live on the Docker host.

> **Note:** On Docker Desktop (Windows and macOS), the `Mountpoint` is inside Docker's own Linux virtual machine, not on your normal disk. That is fine. You work with volumes through Docker commands, not by browsing their folders.

## Mounting a volume

There are two ways to write a mount in `docker run`. Both do the same thing.

### The short `-v` form

```bash
docker run -d --name demo -v notes-data:/data alpine:3.22 sleep infinity
```

`-v notes-data:/data` means "mount the volume `notes-data` at the folder `/data` inside the container". If the volume does not exist yet, Docker creates it for you.

### The long `--mount` form

```bash
docker run -d --name demo2 \
  --mount type=volume,source=notes-data,target=/data \
  alpine:3.22 sleep infinity
```

| | `-v` | `--mount` |
|---|---|---|
| Example | `-v notes-data:/data` | `--mount type=volume,source=notes-data,target=/data` |
| Length | Short | Longer, but every part is named |
| Read-only | `-v notes-data:/data:ro` | `--mount type=volume,source=notes-data,target=/data,readonly` |
| Best for | Typing quickly | Scripts and docs, where clarity matters |

Remove both test containers before moving on (the volume stays):

```bash
docker rm -f demo demo2
```

## A real example: Postgres for notes-api

Later in the course, notes-api will store its notes in Postgres. The official Postgres image keeps its database files in `/var/lib/postgresql/data`, so that is where the volume goes:

```bash
docker run -d --name db \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  -v notes-data:/var/lib/postgresql/data \
  postgres:17-alpine
```

Wait a few seconds for Postgres to start (check with `docker logs db`), then create a table and add a note using `psql`, the Postgres command line tool that is included in the image:

```bash
docker exec db psql -U notes -d notes -c "CREATE TABLE notes (id serial PRIMARY KEY, text text NOT NULL);"
docker exec db psql -U notes -d notes -c "INSERT INTO notes (text) VALUES ('Learn volumes');"
docker exec db psql -U notes -d notes -c "SELECT * FROM notes;"
```

```text
 id |     text
----+---------------
  1 | Learn volumes
(1 row)
```

### The test: replace the container

Now remove the database container completely, as you would when upgrading, and start a new one with the **same volume**:

```bash
docker rm -f db

docker run -d --name db \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  -v notes-data:/var/lib/postgresql/data \
  postgres:17-alpine

docker exec db psql -U notes -d notes -c "SELECT * FROM notes;"
```

```text
 id |     text
----+---------------
  1 | Learn volumes
(1 row)
```

The note survived. The container is brand new, but the data lives in the volume. This is the pattern for every database you run in Docker.

> **Tip:** The `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` variables are only used the **first time**, when the volume is empty and Postgres creates a new database. If you change the password later, the existing database in the volume keeps the old one. You learned about these variables in [Configuring Containers with Environment Variables](/courses/docker/environment-variables).

## Named and anonymous volumes

The volumes so far have a name you chose, like `notes-data`. These are **named volumes**.

If you leave out the name and give only a path, Docker creates an **anonymous volume** with a long random name:

```bash
docker run -d --name temp -v /data alpine:3.22 sleep infinity
docker volume ls
```

```text
DRIVER    VOLUME NAME
local     8f3b2c6e1d0a47b9a5e2f61c7d9e3b04c1a2f5e8d7b6c3a9e0f1d2c4b5a6e7f8
local     notes-data
```

Anonymous volumes are hard to find again, because the name means nothing to you. Use named volumes for data you care about.

### The VOLUME instruction

Some images declare a folder as a volume in their Dockerfile with the `VOLUME` instruction. The Postgres image does this for `/var/lib/postgresql/data`. If you run such an image **without** `-v`, Docker quietly creates an anonymous volume for that folder.

```docker
# In an image's Dockerfile: this folder will always be a volume
VOLUME /var/lib/postgresql/data
```

This protects the data from the writable layer, but you end up with many anonymous volumes. Give the mount a name with `-v name:/path`, and you get a named volume instead.

`docker rm -v` removes a container **and** its anonymous volumes. Named volumes are never removed by `docker rm`.

```bash
docker rm -f -v temp
```

## A new volume is filled from the image

Here is a helpful detail. When you mount an **empty** named volume at a folder that already contains files in the image, Docker first **copies those files (and their owners) into the volume**. If the volume already has data, nothing is copied, and the volume's content wins.

```bash
# nginx's image has default HTML files in this folder
docker run --rm -v web-content:/usr/share/nginx/html nginx:1.29-alpine ls /usr/share/nginx/html
```

```text
50x.html
index.html
```

The new `web-content` volume now holds nginx's default pages. This is also why creating a folder and setting its owner in the Dockerfile makes a volume writable for a non-root user, as you saw in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root).

## Sharing a volume between containers

Several containers can mount the same volume at the same time. For example, one container writes a file and another reads it:

```bash
docker run --rm -v shared:/data alpine:3.22 sh -c 'echo "hello from writer" > /data/message.txt'
docker run --rm -v shared:/data:ro alpine:3.22 cat /data/message.txt
```

```text
hello from writer
```

The second container mounts it with `:ro` (**read-only**), so it can read but not change anything. Use read-only mounts whenever a container only needs to read.

> **Warning:** Never let two database containers use the same data volume at the same time. Databases expect to be the only program writing to their files, and sharing will corrupt the data.

## Removing volumes

Volumes are never deleted by accident when you remove containers. You must delete them yourself:

```bash
# Remove one volume (fails if a container still uses it)
docker volume rm shared

# Remove all unused ANONYMOUS volumes
docker volume prune

# Remove ALL unused volumes, named ones too
docker volume prune --all
```

> **Warning:** `docker volume rm` and `docker volume prune --all` delete data **permanently**. There is no undo. Back up anything important first. You will learn how in [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups), and more about cleaning up in [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker).

## Volumes in Compose

Typing long `docker run` commands gets tiring. In a `compose.yaml` file you declare the volume once at the top level and mount it in a service. Here is a preview of what you will write in [Anatomy of a compose.yaml File](/courses/docker/compose-file-anatomy):

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    volumes:
      - notes-data:/var/lib/postgresql/data

volumes:
  notes-data:
```

`docker compose down` keeps this volume. Only `docker compose down --volumes` (or `-v`) removes it.

## Common mistakes

### Mounting at the wrong path

If you mount the volume at `/var/lib/postgres` instead of `/var/lib/postgresql/data`, Postgres writes to its usual folder in the writable layer, and the volume stays empty. Check the image's documentation on Docker Hub for the right path.

### Forgetting the volume name

`-v /var/lib/postgresql/data` (no name) creates an anonymous volume. The data is safe for now, but hard to find later. Always write `-v name:/path`.

### Expecting new environment variables to change an existing database

Postgres only reads `POSTGRES_PASSWORD` when the volume is empty. To start fresh in development, remove the volume. In production, change the password inside the database.

### Pruning without thinking

`docker volume prune --all` removes every volume that no container is using right now, including the database for a project you stopped yesterday.

## Quick recap

- A **volume** is storage managed by Docker that lives independently of containers.
- Create with `docker volume create`, list with `ls`, view details with `inspect`.
- Mount with `-v name:/path` or `--mount type=volume,source=name,target=/path`. Add `:ro` or `readonly` for read-only.
- Removing a container never removes its **named** volume, so data survives updates.
- An empty volume is filled with the image's files at that path the first time.
- Delete volumes on purpose with `docker volume rm` or `docker volume prune`, and back up first.

Next, you will share a folder from your own computer with a container in [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts).

<code id="code-content" class="language-bash">
# Cheat sheet: Docker volumes
#
# Create, list and inspect
docker volume create notes-data
docker volume ls
docker volume inspect notes-data
#
# Mount with the short form (creates the volume if it does not exist)
docker run -d --name demo -v notes-data:/data alpine:3.22 sleep infinity
# Same thing with the long, explicit form
docker run -d --name demo2 --mount type=volume,source=notes-data,target=/data alpine:3.22 sleep infinity
docker rm -f demo demo2
#
# Postgres for notes-api with its data in a named volume
docker run -d --name db \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  -v notes-data:/var/lib/postgresql/data \
  postgres:17-alpine
docker exec db psql -U notes -d notes -c "CREATE TABLE notes (id serial PRIMARY KEY, text text NOT NULL);"
docker exec db psql -U notes -d notes -c "INSERT INTO notes (text) VALUES ('Learn volumes');"
# Replace the container: the data survives because it is in the volume
docker rm -f db
docker run -d --name db -e POSTGRES_USER=notes -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=notes -v notes-data:/var/lib/postgresql/data postgres:17-alpine
docker exec db psql -U notes -d notes -c "SELECT * FROM notes;"
#
# Share a volume: one container writes, another reads (read-only with :ro)
docker run --rm -v shared:/data alpine:3.22 sh -c 'echo "hello from writer" &gt; /data/message.txt'
docker run --rm -v shared:/data:ro alpine:3.22 cat /data/message.txt
#
# Remove a container AND its anonymous volumes
docker rm -f -v some-container
#
# Delete volumes (permanent, back up first!)
docker volume rm shared
# Unused anonymous volumes only
docker volume prune
# All unused volumes, including named ones
docker volume prune --all
</code></pre>

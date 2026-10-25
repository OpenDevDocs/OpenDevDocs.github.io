---
publishDate: 2026-10-25T14:25
title: 'The Docker CLI: Commands You Will Use Every Day'
slug: docker-cli-basics
metadescription: 'Learn how Docker commands are organized, how to get help, and the everyday commands for images, containers, logs and disk space, with filters and formats.'
updateDate: 2026-10-25T14:25
author: ['bishal-biswas']
level: 1
tags: ['docker', 'cli', 'commands', 'beginners']
course: docker
---

## Getting comfortable with the docker command

In [Running Your First Container](/courses/docker/your-first-container) you used a handful of commands: `run`, `ps`, `logs`, `stop` and `rm`. The Docker **CLI** (command-line interface, the `docker` command) has many more. You do not need all of them. About fifteen commands cover almost everything you do in a normal day.

In this lesson you will learn:

- how Docker commands are built, so new ones are easy to guess
- how to get help for any command
- the everyday commands for **images** and **containers**
- how to refer to containers by name or ID
- how to filter and format output
- how to check disk use

Keep this lesson open as a reference. The code panel has a cheat sheet of every command.

## How a Docker command is built

Every Docker command follows the same pattern:

```text
docker  [object]  verb  [options]  [arguments]

docker  container  ls    -a
docker  image      pull           nginx:1.29-alpine
docker  container  run   -d -p 8080:80   nginx:1.29-alpine
```

- **object** is the kind of thing you work with: `container`, `image`, `volume`, `network`, `system` and others. These are called **management commands**.
- **verb** is what you want to do: `ls`, `run`, `rm`, `inspect`, `prune` and so on.
- **options** (flags) change how it behaves, like `-a` or `-d`.
- **arguments** are what the command acts on, like an image name.

### Short forms

The most common commands also have a short form without the object. Both forms do exactly the same thing:

| Long form | Short form |
|---|---|
| `docker container run` | `docker run` |
| `docker container ls` | `docker ps` |
| `docker container stop` | `docker stop` |
| `docker container rm` | `docker rm` |
| `docker container logs` | `docker logs` |
| `docker container exec` | `docker exec` |
| `docker image ls` | `docker images` |
| `docker image pull` | `docker pull` |
| `docker image rm` | `docker rmi` |
| `docker image build` | `docker build` |

You will see both forms in tutorials. The short forms are faster to type. The long forms are easier to guess: if you know `docker volume ls`, you can guess `docker network ls`.

> **Tip:** When you meet a new object, try `docker <object> ls`, `docker <object> inspect` and `docker <object> rm`. They exist for containers, images, volumes and networks.

## Getting help

You never need to memorize flags. Ask Docker:

```bash
docker --help              # all commands
docker container --help    # all container commands
docker run --help          # every flag of docker run
```

```text
Usage:  docker container ls [OPTIONS]

List containers

Aliases:
  docker container ls, docker container list, docker container ps, docker ps

Options:
  -a, --all             Show all containers (default shows just running)
  -f, --filter filter   Filter output based on conditions provided
      --format string   Format output using a custom template
  -q, --quiet           Only display container IDs
  ...
```

The "Aliases" line is useful: it shows all the names for the same command. The full documentation for every command is also on docs.docker.com, under "Reference".

## Working with images

You learned in [What is Docker and Why Use It?](/courses/docker/what-is-docker) that an image is the read-only package a container starts from. These commands manage images on your machine.

```bash
docker pull node:24-alpine        # download an image without running it
docker images                     # list images on this machine
docker rmi node:24-alpine         # remove an image
docker image inspect nginx:1.29-alpine   # all details about an image, as JSON
docker image history nginx:1.29-alpine   # the layers and the steps that made them
```

```text
REPOSITORY   TAG           IMAGE ID       CREATED       SIZE
node         24-alpine     1f2e3d4c5b6a   3 weeks ago   163MB
nginx        1.29-alpine   4a5b6c7d8e9f   2 weeks ago   52.5MB
ubuntu       24.04         7c8d9e0f1a2b   4 weeks ago   78.1MB
hello-world  latest        74cc54e27dc4   9 months ago  10.1kB
```

> **Note:** You cannot remove an image while a container (even a stopped one) uses it. Docker prints an error like "image is being used by stopped container". Remove the container first, or add `-f` to force it.

You will learn much more about images in [Images and Layers Explained](/courses/docker/images-and-layers) and [Docker Hub and Official Images](/courses/docker/docker-hub-and-official-images).

## Working with containers

These are the container commands you will use most. Start a test container to try them:

```bash
docker run -d --name web -p 8080:80 nginx:1.29-alpine
```

| Command | What it does |
|---|---|
| `docker ps` | List running containers |
| `docker ps -a` | List all containers, including stopped |
| `docker logs web` | Show the container's output |
| `docker logs -f web` | Follow the output live (`Ctrl+C` to stop following) |
| `docker exec -it web sh` | Open a shell inside a running container |
| `docker stop web` | Stop it gracefully |
| `docker start web` | Start a stopped container again |
| `docker restart web` | Stop and start |
| `docker rm web` | Remove a stopped container |
| `docker rm -f web` | Stop and remove in one step |
| `docker inspect web` | Every detail, as JSON |
| `docker stats` | Live CPU and memory use |

Try a few:

```bash
docker exec web nginx -v
docker stats --no-stream
```

```text
nginx version: nginx/1.29.2

CONTAINER ID   NAME   CPU %     MEM USAGE / LIMIT     MEM %   NET I/O       BLOCK I/O   PIDS
b41c9f2e7a6d   web    0.00%     9.2MiB / 7.66GiB      0.12%   1.2kB / 0B    0B / 4kB    9
```

`docker exec` runs a command inside a container that is already running. It is different from `docker run`, which creates a new container. You will use both a lot in [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec).

## Names and IDs

Every container has a long **ID** and a **name**. You can use either in any command.

```bash
docker ps --no-trunc --format '{{.ID}}  {{.Names}}'
```

```text
b41c9f2e7a6d5c3b1e0f9a8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2d1c0b9a8f  web
```

- **Name**: easy to read. Set it with `--name`, or Docker picks a random one like `quirky_turing`.
- **ID**: a 64-character code. `docker ps` shows the first 12 characters. You only need to type enough characters to be unique, often 2 or 3.

These all mean the same container:

```bash
docker logs web
docker logs b41c9f2e7a6d
docker logs b41
```

> **Tip:** Always give long-running containers a clear `--name`. It makes every other command easier to type and read.

## Filtering and formatting output

When you have many containers, the lists get long. Two options help.

### Filter with `--filter` (or `-f`)

```bash
docker ps -a --filter status=exited          # only stopped containers
docker ps --filter name=web                  # names that contain "web"
docker ps --filter ancestor=nginx:1.29-alpine  # containers made from this image
docker images --filter dangling=true         # images with no name (left over from builds)
```

### Format with `--format`

`--format` uses a small template language. Field names go inside double curly braces:

```bash
docker ps --format '{{.Names}}: {{.Status}}'
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}'
```

```text
NAMES     IMAGE               PORTS
web       nginx:1.29-alpine   0.0.0.0:8080->80/tcp
```

The word `table` at the start adds a header row, and `\t` puts a tab between columns.

### Quiet mode: just the IDs

`-q` prints only IDs. This is useful to feed one command into another:

```bash
docker ps -q           # IDs of running containers
docker ps -aq          # IDs of all containers
```

On Linux, macOS or WSL you can combine it with another command. This stops all running containers:

```bash
docker stop $(docker ps -q)
```

> **Warning:** Commands like `docker rm -f $(docker ps -aq)` remove **every** container on the machine, including ones from other projects. Read them twice before you press Enter. There are safer cleanup commands in [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker).

## Checking the system

Two commands tell you about Docker as a whole:

```bash
docker info        # Engine details: version, storage, number of containers and images
docker system df   # how much disk space images, containers and volumes use
```

```text
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          4         1         293.8MB   241.3MB (82%)
Containers      1         1         1.1kB     0B (0%)
Local Volumes   0         0         0B        0B
Build Cache     0         0         0B        0B
```

"RECLAIMABLE" is space you could free up by removing things that are not in use.

## A day with the Docker CLI

Here is what a typical session looks like, using commands from this lesson:

```bash
docker pull postgres:17-alpine                 # get a database image
docker run -d --name db -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
docker ps                                      # is it running?
docker logs db | tail -5                       # did it start correctly?
docker exec -it db psql -U postgres            # open the database shell
docker stop db                                 # done for today
docker start db                                # next morning, start it again
docker rm -f db                                # project finished, remove it
```

```text
...
LOG:  database system is ready to accept connections
```

The `-e` flag sets an environment variable. You will learn it properly in [Configuring Containers with Environment Variables](/courses/docker/environment-variables). The next lesson covers all the important `docker run` flags.

## Common mistakes

### Mixing up `docker run` and `docker start`

`docker run` always creates a **new** container. `docker start` starts an **existing** stopped one. If you `docker run` the same command every morning, you collect many old containers. Use `docker start` for a container you want to keep.

### Mixing up `docker rm` and `docker rmi`

`rm` removes **containers**. `rmi` removes **images**. With the long form it is clearer: `docker container rm` and `docker image rm`.

### Putting options after the image name

```bash
docker run nginx:1.29-alpine -d -p 8080:80   # wrong
docker run -d -p 8080:80 nginx:1.29-alpine   # right
```

Everything after the image name is passed to the program **inside** the container, not to Docker. Docker options always go **before** the image name.

### Quotes on Windows PowerShell

`--format '{{.Names}}'` works in Bash and PowerShell. In the old Windows `cmd.exe`, use double quotes instead: `--format "{{.Names}}"`.

## Quick recap

- Docker commands follow `docker [object] verb [options] [arguments]`.
- Many commands have a short form: `docker ps` is `docker container ls`.
- Use `--help` on any command instead of memorizing flags.
- Image commands: `pull`, `images`, `rmi`, `image inspect`, `image history`.
- Container commands: `ps`, `logs`, `exec`, `stop`, `start`, `restart`, `rm`, `inspect`, `stats`.
- Use a container's **name** or a short part of its **ID**.
- `--filter`, `--format` and `-q` help with long lists; `docker system df` shows disk use.
- Docker options go **before** the image name.

Next, you will learn the `docker run` flags that matter most in [docker run in Depth: The Flags That Matter](/courses/docker/docker-run-in-depth).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Docker CLI cheat sheet: the commands you will use every day.
# Pattern: docker [object] verb [options] [arguments]
#
# ---------- Help ----------
docker --help
docker container --help
docker run --help
#
# ---------- Images ----------
docker pull node:24-alpine                 # download an image
docker images                              # list images (docker image ls)
docker image inspect nginx:1.29-alpine     # full details as JSON
docker image history nginx:1.29-alpine     # layers and the steps that made them
docker rmi node:24-alpine                  # remove an image (docker image rm)
#
# ---------- Containers ----------
docker run -d --name web -p 8080:80 nginx:1.29-alpine   # create and start
docker ps                                  # running containers (docker container ls)
docker ps -a                               # all containers
docker logs web                            # output so far
docker logs -f web                         # follow output live, Ctrl+C to stop
docker exec -it web sh                     # shell inside a running container
docker stats --no-stream                   # CPU and memory, one snapshot
docker inspect web                         # full details as JSON
docker stop web                            # graceful stop
docker start web                           # start an existing stopped container
docker restart web                         # stop then start
docker rm web                              # remove a stopped container
docker rm -f web                           # stop and remove in one step
#
# ---------- Filters, formats and IDs ----------
docker ps -a --filter status=exited
docker ps --filter name=web
docker images --filter dangling=true
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}'
docker ps -q                               # only IDs, useful in scripts
docker stop $(docker ps -q)                # stop all running containers (careful)
#
# ---------- System ----------
docker info                                # Engine details
docker system df                           # disk space used by Docker
</code></pre>

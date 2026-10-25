---
publishDate: 2026-10-25T14:30
title: 'docker run in Depth: The Flags That Matter'
slug: docker-run-in-depth
metadescription: 'Master the docker run flags you really need: background and interactive modes, names, ports, environment variables, volumes, users, limits and restarts.'
updateDate: 2026-10-25T14:30
author: ['bishal-biswas']
level: 1
tags: ['docker', 'docker-run', 'cli', 'containers']
course: docker
---

## One command, many options

`docker run` is the command you will type more than any other. Running `docker run --help` shows over 90 flags. That looks scary, but you only need about fifteen of them in daily work. This lesson groups those flags by the job they do, so they are easy to remember.

In this lesson you will learn:

- how a `docker run` command is put together
- flags for **how** the container runs: in the background, interactive, auto-remove
- flags for **reaching** it: names, ports, networks
- flags for **configuring** it: environment variables, files and folders
- flags for **controlling** it: user, working folder, command, limits and restarts
- how to read a long real-world `docker run` command

You used some of these flags in [Running Your First Container](/courses/docker/your-first-container). Now you will see the full set.

## The shape of a docker run command

```text
docker run  [DOCKER OPTIONS]  IMAGE[:TAG]  [COMMAND]  [ARGUMENTS...]
            \______________/  \_________/  \_____________________/
             how to run it    what to run   override the default
                                            program (optional)
```

The most important rule: **Docker options go before the image name.** Anything after the image is given to the program inside the container.

```bash
# -d and --name are Docker options. "node --version" is the command inside.
docker run --rm --name check node:24-alpine node --version
```

## Group 1: how the container runs

| Flag | Meaning | Use it when |
|---|---|---|
| `-d`, `--detach` | Run in the background | Servers, databases, anything long-running |
| `-i`, `--interactive` | Keep input open | You want to type into it |
| `-t`, `--tty` | Give it a terminal | Shells and interactive tools (use with `-i`) |
| `--rm` | Delete the container when it exits | Short tests and one-off commands |

```bash
docker run -d nginx:1.29-alpine                    # background server
docker run -it --rm ubuntu:24.04 bash              # interactive shell, cleaned up on exit
docker run --rm alpine:3.22 echo "hello"           # one-off command
```

Without `-d`, the container runs in the **foreground**: its output appears in your terminal, and `Ctrl+C` stops it. This is fine for quick tests.

> **Tip:** `-it` is really two flags, `-i` and `-t`, written together. You almost always use them as a pair.

## Group 2: reaching the container

### `--name`: a clear name

```bash
docker run -d --name web nginx:1.29-alpine
```

Without a name, Docker picks a random one like `eager_lovelace`. With a name, every later command is easy: `docker logs web`, `docker stop web`. Names must be unique on the machine.

### `-p`: publish a port

A container has its own network. A program listening inside it is not reachable from your computer until you **publish** the port:

```text
-p  HOST_PORT : CONTAINER_PORT
-p  8080      : 80
```

```bash
docker run -d --name web -p 8080:80 nginx:1.29-alpine        # http://localhost:8080
docker run -d --name web2 -p 127.0.0.1:8081:80 nginx:1.29-alpine  # only reachable from this computer
```

The second form adds an IP address. `127.0.0.1` means only your own computer can connect, not other machines on the network. This is safer for databases on a laptop. You will learn the details in [Publishing Ports: Reaching Apps Inside Containers](/courses/docker/publishing-ports).

### `--network`: join a network

```bash
docker network create appnet
docker run -d --name db --network appnet -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
docker run --rm --network appnet alpine:3.22 ping -c 1 db
```

```text
PING db (172.18.0.2): 56 data bytes
64 bytes from 172.18.0.2: seq=0 ttl=64 time=0.101 ms
```

Containers on the same **user-defined network** can find each other by name. That is how an API container talks to a `db` container. You will learn this in [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks).

## Group 3: configuring the container

### `-e` and `--env-file`: environment variables

Most images are configured with **environment variables**: named values that the program reads when it starts.

```bash
docker run -d --name db \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  postgres:17-alpine
```

The `\` at the end of a line means "the command continues on the next line" in Bash. (In PowerShell, use a backtick `` ` `` instead, or write it all on one line.)

With many variables, put them in a file:

```text
# db.env
POSTGRES_USER=notes
POSTGRES_PASSWORD=devpassword
POSTGRES_DB=notes
```

```bash
docker run -d --name db --env-file db.env postgres:17-alpine
```

Full details are in [Configuring Containers with Environment Variables](/courses/docker/environment-variables).

### `-v` and `--mount`: keep data and share files

```bash
# A named volume: Docker manages the storage. Data survives when the container is removed.
docker run -d --name db -e POSTGRES_PASSWORD=devpassword \
  -v pgdata:/var/lib/postgresql/data postgres:17-alpine

# A bind mount: share a folder from your computer (here, the current folder)
docker run -d --name site -p 8080:80 \
  -v "$PWD/public:/usr/share/nginx/html:ro" nginx:1.29-alpine
```

The `:ro` at the end means **read-only**: the container can read the files but not change them.

`--mount` does the same job with a longer but clearer syntax:

```bash
docker run -d --name site -p 8080:80 \
  --mount type=bind,source="$PWD/public",target=/usr/share/nginx/html,readonly \
  nginx:1.29-alpine
```

| | `-v` | `--mount` |
|---|---|---|
| Style | Short, `source:target:options` | Long, `key=value` pairs |
| Missing host folder (bind) | Created automatically, often as an empty folder | Error, which helps you catch typos |
| Best for | Quick commands | Scripts and clarity |

You will learn storage properly in [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes) and [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts).

## Group 4: controlling the container

### `-w` and `-u`: working folder and user

```bash
# Start in /usr/share as the "nobody" user, then print the folder and the user
docker run --rm -w /usr/share -u nobody alpine:3.22 sh -c 'pwd; whoami'
```

```text
/usr/share
nobody
```

- `-w` (`--workdir`) sets the folder the command starts in.
- `-u` (`--user`) sets which user runs the command. Many images run as **root** by default. Running as a normal user is safer. See [Running Containers as a Non-Root User](/courses/docker/running-as-non-root).

### Overriding the command

Every image has a default command. For `nginx`, it starts the web server. For `ubuntu`, it starts `bash`. Anything after the image name **replaces** that default:

```bash
docker run --rm nginx:1.29-alpine nginx -v       # print the version instead of starting the server
docker run --rm node:24-alpine node -e "console.log(1 + 1)"
```

```text
nginx version: nginx/1.29.2
2
```

Some images also have an **entrypoint**, a fixed program that always runs. `--entrypoint` replaces it. This is useful for debugging:

```bash
docker run --rm -it --entrypoint sh nginx:1.29-alpine
```

The difference between the two is explained in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint).

### `--memory` and `--cpus`: resource limits

By default a container can use all the memory and CPU of the machine. Limits protect the rest of the system:

```bash
docker run -d --name api --memory 256m --cpus 0.5 node:24-alpine sleep 3600
docker stats --no-stream api
```

```text
CONTAINER ID   NAME   CPU %   MEM USAGE / LIMIT   MEM %   ...
2c4e6a8b0d1f   api    0.00%   1.1MiB / 256MiB     0.43%   ...
```

`--cpus 0.5` means "half of one CPU core". If the app goes over the memory limit, the kernel stops it.

### `--restart`: what happens when it stops

```bash
docker run -d --name web --restart unless-stopped -p 8080:80 nginx:1.29-alpine
```

| Policy | Behavior |
|---|---|
| `no` | Never restart (the default) |
| `on-failure[:max]` | Restart only if it exits with an error, optionally at most `max` times |
| `always` | Always restart, also after the Docker Engine restarts |
| `unless-stopped` | Like `always`, but not if you stopped it yourself |

Both limits and restart policies get a full lesson in [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits).

## Group 5: useful extras

| Flag | Meaning |
|---|---|
| `--init` | Run a tiny init process as PID 1 that forwards signals and cleans up child processes |
| `--read-only` | Make the container's file system read-only (safer) |
| `--hostname name` | Set the hostname inside the container |
| `--pull always` | Always check the registry for a newer copy of the image before running |
| `--platform linux/amd64` | Run an image built for a different CPU type (uses emulation if needed) |

```bash
docker run --rm --pull always --init alpine:3.22 echo "fresh image"
```

## Reading a real command

Here is a command you might see in a project README. Read it group by group:

```bash
docker run -d \
  --name notes-db \
  --restart unless-stopped \
  -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  -v notes-pgdata:/var/lib/postgresql/data \
  --memory 512m \
  postgres:17-alpine
```

1. **How it runs:** `-d`, in the background.
2. **Reaching it:** named `notes-db`, port 5432 published only on `127.0.0.1`.
3. **Configuring it:** three environment variables set the user, password and database name. A named volume keeps the data.
4. **Controlling it:** restarts unless you stop it, and may use at most 512 MB of memory.
5. **What to run:** the `postgres:17-alpine` image with its default command.

When commands get this long, it is time for **Docker Compose**, which puts the same settings in a file. You will meet it in [What is Docker Compose?](/courses/docker/what-is-docker-compose).

## Common mistakes

### Flags after the image name

```bash
docker run nginx:1.29-alpine -p 8080:80     # wrong: "-p 8080:80" goes to nginx, not Docker
docker run -p 8080:80 nginx:1.29-alpine     # right
```

### Swapping the port numbers

`-p 80:8080` means "host port 80 to container port 8080". If nginx listens on port 80 inside, this does not work. Remember: **host first, container second**.

### Relative paths with `-v`

`-v ./data:/data` works in recent Docker versions, but `-v data:/data` (no `./`) creates a **named volume** called `data`, not a bind mount of your folder. When you mean a folder, start the path with `./`, `/` or `$PWD`.

### Putting real secrets in `-e` on shared machines

Values passed with `-e` are visible to anyone who can run `docker inspect`. For local development placeholders like `devpassword` are fine. For production, see [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).

## Quick recap

- Shape: `docker run [options] IMAGE [command]`. Options always come **before** the image.
- **How it runs:** `-d`, `-it`, `--rm`.
- **Reaching it:** `--name`, `-p host:container`, `--network`.
- **Configuring it:** `-e`, `--env-file`, `-v`, `--mount`.
- **Controlling it:** `-w`, `-u`, a command after the image, `--entrypoint`, `--memory`, `--cpus`, `--restart`.
- **Extras:** `--init`, `--read-only`, `--pull always`, `--platform`.
- Long `docker run` commands are a sign to move to Docker Compose.

Next, you will follow a container through its whole life in [The Container Lifecycle: Create, Start, Stop and Remove](/courses/docker/container-lifecycle).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# docker run in depth: the flags that matter, grouped by job.
# Shape: docker run [DOCKER OPTIONS] IMAGE[:TAG] [COMMAND] [ARGS...]
#
# ---------- 1. How it runs ----------
docker run -d nginx:1.29-alpine                     # background (detached)
docker run -it --rm ubuntu:24.04 bash               # interactive shell, removed on exit
docker run --rm alpine:3.22 echo "hello"            # one-off command
#
# ---------- 2. Reaching it ----------
docker run -d --name web -p 8080:80 nginx:1.29-alpine           # host 8080 -&gt; container 80
docker run -d --name web2 -p 127.0.0.1:8081:80 nginx:1.29-alpine # only this computer
docker network create appnet
docker run -d --name db --network appnet -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
docker run --rm --network appnet alpine:3.22 ping -c 1 db        # find "db" by name
#
# ---------- 3. Configuring it ----------
docker run -d --name notes-db -e POSTGRES_USER=notes -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
docker run -d --name notes-db2 --env-file db.env postgres:17-alpine
docker run -d --name pg -e POSTGRES_PASSWORD=devpassword -v pgdata:/var/lib/postgresql/data postgres:17-alpine
docker run -d --name site -p 8082:80 -v "$PWD/public:/usr/share/nginx/html:ro" nginx:1.29-alpine
#
# ---------- 4. Controlling it ----------
docker run --rm -w /usr/share -u nobody alpine:3.22 sh -c 'pwd; whoami'
docker run --rm nginx:1.29-alpine nginx -v                      # replace the default command
docker run --rm -it --entrypoint sh nginx:1.29-alpine           # replace the entrypoint
docker run -d --name api --memory 256m --cpus 0.5 node:24-alpine sleep 3600
docker run -d --name web3 --restart unless-stopped -p 8083:80 nginx:1.29-alpine
#
# ---------- 5. Extras ----------
docker run --rm --pull always --init alpine:3.22 echo "fresh image"
docker run --rm --read-only alpine:3.22 touch /test             # fails: read-only file system
docker run --rm --platform linux/amd64 alpine:3.22 uname -m     # x86_64, emulated on ARM
#
# ---------- Clean up everything from this lesson ----------
docker rm -f web web2 db notes-db notes-db2 pg site api web3
docker network rm appnet
docker volume rm pgdata
</code></pre>

---
publishDate: 2026-10-25T18:05
title: 'Container Security Best Practices'
slug: container-security-best-practices
metadescription: 'Learn practical ways to secure Docker containers: non-root users, read-only filesystems, dropped capabilities, resource limits, secrets and safe images.'
updateDate: 2026-10-25T18:05
author: ['bishal-biswas']
level: 3
tags: ['docker', 'security', 'hardening', 'production']
course: docker
---

## Containers are a fence, not a vault

A container keeps a process separate from the rest of the computer. It has its own files, its own network and its own process list. But all containers on a host share **one Linux kernel** (the core of the operating system). If an attacker breaks into your app and finds a way out of the container, they are on your server.

So container security works in **layers**, like a house with a fence, a locked door, and a safe inside. No single layer is perfect. Together they make an attack much harder.

In this lesson you will harden the `notes-api` service step by step. By the end you will have a compose file where the container:

- runs as a normal user, not root,
- cannot write to its own files,
- has almost no special Linux powers,
- cannot use unlimited memory or CPU,
- gets secrets safely at run time.

You will see each idea with `docker run` first, then in `compose.yaml`.

> **Note:** This lesson builds on [Running Containers as a Non-Root User](/courses/docker/running-as-non-root) and [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout). Read those first if they are new to you.

## The threat model in one picture

Before adding locks, ask "what are we protecting against?". This simple list is called a **threat model**:

```text
1. A bug in our code or a package lets an attacker run commands in the container.
2. From there, they try to:
   a. read secrets (passwords, keys)
   b. change files to keep access (install a backdoor)
   c. use lots of CPU or memory (crypto mining, crashing the server)
   d. escape the container to reach the host
   e. reach other containers on the network
```

Each practice below blocks one or more of these.

## 1. Start with a small, trusted, scanned image

Fewer packages means fewer bugs to exploit, and fewer tools for an attacker to use. An image without `curl`, `wget` or a package manager is a poor place to download a hacking tool.

- Use **official** or **verified** images from Docker Hub, as you learned in [Docker Hub and Official Images](/courses/docker/docker-hub-and-official-images).
- Prefer small bases like `node:24-alpine` or `node:24-slim`.
- Use a multi-stage build so build tools stay out of the final image.
- Scan with Docker Scout and rebuild often with `docker build --pull`.

### Pin by digest for maximum trust

A tag like `node:24-alpine` can point to a different image tomorrow. A **digest** is a fingerprint of one exact image and never changes:

```docker
# syntax=docker/dockerfile:1
# The tag is for humans, the digest is what Docker actually uses
FROM node:24-alpine@sha256:<digest-you-copied-from-docker-images-or-hub>
```

You can find the digest with:

```bash
docker images --digests node
```

Pinning stops surprise changes, but it also stops automatic patches. Use a tool such as Dependabot or Renovate to update the digest for you. See [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests) for more.

## 2. Never run as root

By default, the process in a container runs as **root** (user ID 0). Root inside a container is not the same as root on the host, but it is much closer than you want. If there is ever a container escape bug, root inside often becomes root outside.

In the Dockerfile:

```docker
USER node        # the official Node images include a "node" user with ID 1000
```

Or at run time, even for images you did not build:

```bash
docker run --rm --user 1000:1000 alpine:3.22 id
```

```text
uid=1000 gid=1000 groups=1000
```

Check what a running container uses:

```bash
docker exec notes-api id
```

## 3. Make the filesystem read-only

Your app should not need to change its own code while it runs. If the filesystem is **read-only**, an attacker cannot install a backdoor or change your files.

```bash
docker run -d --name notes-api --read-only \
  --tmpfs /tmp \
  -p 3000:3000 notes-api:1.0.0
```

- `--read-only` makes the container's whole filesystem read-only.
- `--tmpfs /tmp` gives the app a small writable folder in memory, because many programs need a temp folder. You learned about tmpfs in [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups).

Test it:

```bash
docker exec notes-api sh -c 'echo hack > /app/evil.js'
```

```text
sh: can't create /app/evil.js: Read-only file system
```

Data that must be saved, such as a database, still goes in a **volume**. Volumes stay writable even when the rest is read-only.

## 4. Drop Linux capabilities

Linux splits root's powers into about 40 small pieces called **capabilities**. For example, `CAP_NET_BIND_SERVICE` allows using ports below 1024, and `CAP_CHOWN` allows changing who owns a file. Docker gives containers a default set of about 14 of them.

A web API on port 3000 needs **none** of them. So drop them all:

```bash
docker run -d --name notes-api \
  --cap-drop ALL \
  -p 3000:3000 notes-api:1.0.0
```

If something breaks, add back only the one it needs:

```bash
# nginx starts as root on port 80 and needs a few capabilities, such as these
docker run -d --cap-drop ALL \
  --cap-add NET_BIND_SERVICE --cap-add CHOWN --cap-add SETUID --cap-add SETGID \
  -p 8080:80 nginx:1.29-alpine
```

> **Tip:** An even simpler trick for web servers: listen on a port above 1024 inside the container (like 8080) and publish it as any port you like. Then you do not need `NET_BIND_SERVICE` at all.

### Block privilege escalation

Some programs have a special flag (called **setuid**) that lets them run as root even when a normal user starts them. `sudo` is the classic example. Block this trick completely:

```bash
docker run -d --security-opt no-new-privileges:true notes-api:1.0.0
```

Now no process in the container can gain more power than it started with.

## 5. Never use --privileged (and guard the Docker socket)

`--privileged` turns off almost every protection: all capabilities, access to all host devices, no security profiles. A privileged container is close to being root on the host.

```bash
# Do not do this unless you really know why
docker run --privileged ...
```

The same is true for mounting the Docker socket:

```bash
# Also dangerous: this container can now control Docker itself
docker run -v /var/run/docker.sock:/var/run/docker.sock ...
```

Anyone who can talk to the Docker socket can start a new privileged container that mounts the host's disk. That is full control of the server. This is the same reason that membership in the `docker` group is equal to root, as you learned in [Installing Docker](/courses/docker/installing-docker).

> **Warning:** Some tools (like reverse proxies that read container labels, or CI runners) ask for the Docker socket. Only give it to software you trust completely, and mount it read-only (`:ro`) where possible. Read-only does not make it safe, but it is a little better.

## 6. Limit resources

Without limits, one container can use all the memory and CPU on the server. That can be an attack (crypto mining, or flooding your app) or just a bug (a memory leak). Either way, every other container suffers.

```bash
docker run -d --name notes-api \
  --memory 256m \
  --cpus 0.5 \
  --pids-limit 100 \
  notes-api:1.0.0
```

| Flag | What it limits |
|---|---|
| `--memory 256m` | Maximum RAM. The container is killed if it goes over. |
| `--cpus 0.5` | At most half of one CPU core |
| `--pids-limit 100` | At most 100 processes, which stops a "fork bomb" |

You learned these in more detail in [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits).

## 7. Keep secrets out of images and out of env where you can

Anything in a Dockerfile (`ENV`, `COPY`, `ARG`) stays in the image layers. Anyone who can pull the image can read it.

```docker
# Wrong: this password is now inside the image forever
ENV DB_PASSWORD=devpassword
```

Pass secrets at **run time** instead. Environment variables are fine for many apps, but they can leak: they show up in `docker inspect`, and some tools print them in error reports. A **secret file** is safer. Compose mounts secrets as files under `/run/secrets/`:

```yaml
services:
  api:
    image: notes-api:1.0.0
    secrets:
      - db_password          # appears at /run/secrets/db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt   # a file on the host, never committed to git
```

You learned the details in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets). For secrets needed during the **build** (like a private npm token), use BuildKit secret mounts from [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

## 8. Limit the network

Containers on the same network can talk to each other. Your database does not need to talk to the internet, and your frontend does not need to talk to your database.

- Put services on **separate networks** so only the right ones can reach each other.
- Do not publish database ports (`-p 5432:5432`) on a server. The API reaches the database over the internal network.
- When you must publish a port that only the host needs, bind it to localhost: `-p 127.0.0.1:3000:3000`.

```yaml
networks:
  frontend:            # web and api
  backend:             # api and db
    internal: true     # containers here cannot reach the internet at all
```

See [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks) for how this works.

## 9. Keep Docker and the host updated

Container escapes usually need a bug in the kernel or in Docker itself. Keep the host OS, the kernel and Docker Engine updated. On Ubuntu that means regular `sudo apt-get update && sudo apt-get upgrade`, which also updates Docker if you installed it from Docker's apt repository.

### Going further: rootless mode

Docker can run the whole daemon as a normal user, called **rootless mode**. Then even a full container escape lands the attacker in a normal user account, not root. It has some limits (for example with some networking features), so it is a choice to test, not a default. The Docker docs explain setup.

## Putting it all together

Here is the hardened `notes-api` service in Compose. Each line maps to a practice above:

```yaml
services:
  api:
    image: notes-api:1.0.0
    user: "1000:1000"                     # 2. not root
    read_only: true                       # 3. no writes to the filesystem
    tmpfs:
      - /tmp                              # 3. except a small temp folder in memory
    cap_drop:
      - ALL                               # 4. no special Linux powers
    security_opt:
      - no-new-privileges:true            # 4. no sudo-style escalation
    mem_limit: 256m                       # 6. memory limit
    cpus: 0.5                             # 6. CPU limit
    pids_limit: 100                       # 6. process limit
    ports:
      - "127.0.0.1:3000:3000"             # 8. only reachable from the host itself
```

Start it and check that it still works:

```bash
docker compose up -d
curl http://127.0.0.1:3000/health
```

```text
ok
```

If the app breaks, read the logs. The error usually tells you exactly what it tried to do: write a file (add a `tmpfs` or volume for that path) or use a capability (add back only that one).

## A quick self-check

Run this against a running container to see some of its security settings:

```bash
docker inspect notes-api --format 'User={{.Config.User}} ReadOnly={{.HostConfig.ReadonlyRootfs}} CapDrop={{.HostConfig.CapDrop}} Privileged={{.HostConfig.Privileged}}'
```

```text
User=1000:1000 ReadOnly=true CapDrop=[ALL] Privileged=false
```

## Common mistakes

### "It is in a container, so it is safe"

Containers share the host kernel. Treat a container as one layer of defense, not the only one.

### Fixing a permission error by running as root

When a non-root container gets "permission denied", the quick fix is to remove `USER`. The right fix is to give the folder to the right user in the Dockerfile (`COPY --chown=node:node` or `RUN chown`), or to use a volume.

### Publishing every port "just in case"

Every published port is a door. On a server, the database, cache and admin tools should have no published ports at all.

### Putting a secret in a build argument

`ARG` values can be seen in the image history with `docker history`. Use a build secret mount instead.

## Quick recap

- Containers share the host kernel, so use **many layers** of protection.
- Use small, official, scanned images; pin by **digest** for full control.
- Run as a **non-root** user, with a **read-only** filesystem and `tmpfs` for temp files.
- `--cap-drop ALL` and `no-new-privileges` remove powers your app does not need.
- Never use `--privileged` and never hand out the Docker socket casually.
- Set **memory, CPU and process limits**.
- Keep secrets out of images; use **secret files** at run time.
- Separate networks, and do not publish ports you do not need.

Next, you will make sure your containers' logs do not fill up the disk in [Logging Drivers and Log Rotation](/courses/docker/logging-drivers).

<code id="code-content" class="language-yaml">
# compose.yaml: a hardened notes-api service with PostgreSQL
# Start:  docker compose up -d
# Check:  curl http://127.0.0.1:3000/health
services:
  api:
    image: notes-api:1.0.0
    # Run as the unprivileged "node" user (ID 1000), never root
    user: "1000:1000"
    # The app cannot change its own files; only /tmp is writable, in memory
    read_only: true
    tmpfs:
      - /tmp
    # Remove every Linux capability; a web API on port 3000 needs none
    cap_drop:
      - ALL
    # Block setuid programs (like sudo) from gaining more power
    security_opt:
      - no-new-privileges:true
    # Resource limits: memory, CPU and number of processes
    mem_limit: 256m
    cpus: 0.5
    pids_limit: 100
    environment:
      PORT: "3000"
      DB_HOST: db
      DB_USER: notes
      # The app reads the password from this file instead of an env variable
      DB_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    # Only reachable from the server itself (a reverse proxy sits in front)
    ports:
      - "127.0.0.1:3000:3000"
    # frontend: so the published port works; backend: to reach the database
    networks:
      - frontend
      - backend
    restart: unless-stopped
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_DB: notes
      # The official postgres image supports *_FILE variables for secrets
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    # No "ports:" at all: the database is never published
    networks:
      - backend
    mem_limit: 512m
    restart: unless-stopped
networks:
  frontend:
  backend:
    # internal: containers only on this network cannot reach the internet
    internal: true
volumes:
  pgdata:
secrets:
  db_password:
    # Keep this file out of git (add it to .gitignore)
    file: ./secrets/db_password.txt
</code></pre>

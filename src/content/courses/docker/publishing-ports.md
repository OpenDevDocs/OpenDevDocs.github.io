---
publishDate: 2026-10-25T14:40
title: 'Publishing Ports: Reaching Apps Inside Containers'
slug: publishing-ports
metadescription: 'Learn how to publish container ports with -p, choose host ports, bind to localhost only, check mappings with docker port, and fix common port errors.'
updateDate: 2026-10-25T14:40
author: ['bishal-biswas']
level: 1
tags: ['docker', 'networking', 'ports', 'containers']
course: docker
---

## Why you cannot reach your app (yet)

You start a web server in a container. It says "listening on port 80". You open `http://localhost` in your browser and... nothing. The page does not load.

This is normal. A container is a closed box. It has its own small network, separate from your computer. A program inside the box can listen on a port, but nobody outside the box can reach it until you open a door.

Opening that door is called **publishing a port**. In this lesson you will learn:

- what a port is and why containers need port publishing
- how the `-p` flag works and how to read `8080:80`
- how to keep a port private to your own machine
- how to check which ports a container uses
- how to fix the most common port errors

You already used `-p` briefly in [Running Your First Container](/courses/docker/your-first-container) and [docker run in Depth](/courses/docker/docker-run-in-depth). Now you will understand it fully.

## A quick reminder: what is a port?

A computer can run many network programs at the same time. A **port** is a number from 1 to 65535 that tells the computer which program should get a message. Think of a big office building: the IP address is the street address, and the port is the room number.

Some common ports:

| Port | Usually used by |
|---|---|
| 80 | HTTP websites |
| 443 | HTTPS websites |
| 3000 | Node.js apps during development |
| 5432 | PostgreSQL |
| 6379 | Redis |

If you want a deeper explanation, see [IP Addresses, Ports and Protocols](/courses/devops/ip-addresses-ports-and-protocols) in the DevOps course.

## How container networking looks

Every container gets its own **network namespace**. A namespace is a private copy of network settings: its own IP address, its own ports, its own `localhost`. So port 80 inside a container is not the same as port 80 on your computer.

```text
 Your computer (the host)
 +---------------------------------------------+
 |  browser --> localhost:8080                 |
 |                  |                          |
 |                  | Docker forwards traffic  |
 |                  v                          |
 |   +-----------------------------+           |
 |   | container "web"             |           |
 |   | nginx listening on port 80  |           |
 |   +-----------------------------+           |
 +---------------------------------------------+
```

When you publish a port, Docker sets up forwarding. Traffic that arrives at a port on your computer is sent on to a port inside the container. You will learn more about how Docker networks work in [Docker Networking Basics](/courses/docker/docker-networking-basics).

## Publishing a port with -p

The flag is `-p` (long form: `--publish`). The format is:

```text
-p HOST_PORT:CONTAINER_PORT
```

The **left** number is the port on your computer. The **right** number is the port inside the container. A simple way to remember it: "outside, then inside".

Try it with nginx:

```bash
docker run -d --name web -p 8080:80 nginx:1.29-alpine
```

Now open `http://localhost:8080`. You will see the nginx welcome page. You can also test from the terminal:

```bash
curl -I http://localhost:8080
```

```text
HTTP/1.1 200 OK
Server: nginx/1.29.0
Content-Type: text/html
...
```

The host port and the container port do not need to match. All of these reach the same nginx on port 80 inside:

```bash
docker run -d --name web1 -p 8080:80 nginx:1.29-alpine
docker run -d --name web2 -p 8081:80 nginx:1.29-alpine
docker run -d --name web3 -p 9000:80 nginx:1.29-alpine
```

This is very useful. Three containers can each listen on port 80 inside, because each one has its own network. But on your computer each host port can be used only once, so you give them different host ports.

## Seeing which ports are published

The `PORTS` column of `docker ps` shows the mapping:

```bash
docker ps
```

```text
CONTAINER ID   IMAGE               COMMAND                  STATUS         PORTS                                     NAMES
a1b2c3d4e5f6   nginx:1.29-alpine   "/docker-entrypoint.…"   Up 5 seconds   0.0.0.0:8080->80/tcp, [::]:8080->80/tcp   web
```

Read `0.0.0.0:8080->80/tcp` as "port 8080 on every network address of this computer goes to port 80 inside, using TCP". The `[::]` part is the same thing for IPv6.

For one container, `docker port` gives a cleaner list:

```bash
docker port web
```

```text
80/tcp -> 0.0.0.0:8080
80/tcp -> [::]:8080
```

## Keeping a port private to your machine

By default, `-p 8080:80` listens on **all** network addresses of your computer (that is what `0.0.0.0` means). Other computers on the same Wi-Fi or office network may be able to reach it. On a cloud server, the whole internet may reach it.

To allow only your own computer, put an IP address in front:

```bash
# Only reachable from this computer (localhost)
docker run -d --name db -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
```

The full format is `IP:HOST_PORT:CONTAINER_PORT`. Use `127.0.0.1` for databases, admin panels and anything else that should not be public.

> **Warning:** On Linux servers, Docker writes its own firewall rules. A port published with `-p 5432:5432` can be reachable from the internet **even if** a tool like `ufw` says the port is closed. If a port must stay private, bind it to `127.0.0.1` or do not publish it at all.

## More forms of -p

| Example | Meaning |
|---|---|
| `-p 8080:80` | Host port 8080 to container port 80, on all addresses |
| `-p 127.0.0.1:8080:80` | Same, but only from this computer |
| `-p 80` | Container port 80 to a **random** free host port |
| `-p 5353:53/udp` | Publish a UDP port (TCP is the default) |
| `-p 8000-8002:8000-8002` | Publish a range of ports |
| `-P` | Publish every port listed by `EXPOSE` in the image, each to a random host port |

Random ports are handy when you do not care which port you get. Use `docker port` to find out:

```bash
docker run -d --name random-web -P nginx:1.29-alpine
docker port random-web
```

```text
80/tcp -> 0.0.0.0:32768
80/tcp -> [::]:32768
```

## EXPOSE is not the same as -p

Many images contain an `EXPOSE` instruction in their Dockerfile, for example `EXPOSE 80`. This is only **documentation**. It tells people "this app listens on port 80". It does **not** open the port.

Only `-p` (or `-P`) at run time publishes a port. You will write `EXPOSE` yourself in [Dockerfile Instructions](/courses/docker/dockerfile-instructions).

You can see which ports an image exposes:

```bash
docker image inspect --format '{{json .Config.ExposedPorts}}' nginx:1.29-alpine
```

```text
{"80/tcp":{}}
```

## The notes-api example

Throughout this course you will work with a tiny Node.js API called **notes-api**. Its server listens on the port from the `PORT` environment variable, or 3000 if it is not set. The important line in `src/server.js` is:

```javascript
const port = Number(process.env.PORT ?? 3000);
// 0.0.0.0 means "every network address inside the container"
server.listen(port, '0.0.0.0', () => console.log(`notes-api listening on port ${port}`));
```

Until you build your own image in [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile), you can run it with the official Node image and a bind mount (you will learn bind mounts in [Bind Mounts](/courses/docker/bind-mounts)):

```bash
# Run from inside the notes-api folder
docker run -d --name notes -p 3000:3000 -v "$PWD:/app" -w /app node:24-alpine node src/server.js
curl http://localhost:3000/health
```

```text
ok
```

## Common mistakes

### The app listens on 127.0.0.1 inside the container

This is the number one port problem. If the app inside the container listens on `127.0.0.1` (or `localhost`), it only accepts traffic from **inside** the same container. Forwarded traffic comes from outside, so it never arrives. You get an error such as "connection reset" or "empty reply".

Fix: make the app listen on `0.0.0.0`. That is why notes-api uses `server.listen(port, '0.0.0.0')`. Many dev servers have a `--host 0.0.0.0` option for the same reason.

### The host port is already in use

```text
docker: Error response from daemon: ... Bind for 0.0.0.0:8080 failed: port is already allocated.
```

Another container, or another program on your computer, already uses port 8080. Pick a different host port (`-p 8081:80`), or stop the other container. To find which container has it:

```bash
docker ps --filter "publish=8080"
```

### Swapping the two numbers

`-p 80:8080` means "host 80 to container 8080". If nginx listens on 80 inside, nothing answers on 8080, so the request fails. Remember: **outside, then inside**.

### Trying to add a port to a running container

You cannot add or change a published port on a running container. Remove it and run it again with the new `-p`:

```bash
docker rm -f web
docker run -d --name web -p 9090:80 nginx:1.29-alpine
```

This is fine, because containers are meant to be replaced, as you saw in [The Container Lifecycle](/courses/docker/container-lifecycle).

### Forgetting to publish at all

Without `-p`, the container still works, but only other containers on the same Docker network can reach it. Sometimes that is exactly what you want, for example a database that only your API should talk to. You will use this in [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks).

## Quick recap

- A container has its own network, so its ports are hidden until you **publish** them.
- `-p HOST:CONTAINER` forwards a port on your computer to a port in the container. "Outside, then inside."
- Add `127.0.0.1:` in front to keep a port private to your own machine.
- `docker ps` and `docker port` show which ports are published.
- `EXPOSE` only documents a port. It does not publish it.
- Apps inside containers must listen on `0.0.0.0`, not `127.0.0.1`.

Next, you will learn how to pass settings into containers in [Configuring Containers with Environment Variables](/courses/docker/environment-variables).

<code id="code-content" class="language-bash">
# Publishing ports: cheat sheet
# Format: -p [IP:]HOST_PORT:CONTAINER_PORT[/udp]   ("outside, then inside")
#
# Host port 8080 forwards to port 80 inside the container
docker run -d --name web -p 8080:80 nginx:1.29-alpine
curl -I http://localhost:8080
#
# Only reachable from this computer (good for databases and admin tools)
docker run -d --name db -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
#
# Let Docker pick a random free host port for every EXPOSEd port
docker run -d --name random-web -P nginx:1.29-alpine
#
# A UDP port, and a range of ports
docker run -d --name dns-test -p 5353:53/udp alpine:3.22 sleep 3600
docker run -d --name range-test -p 8000-8002:8000-8002 alpine:3.22 sleep 3600
#
# See which ports are published
docker ps
docker port web
docker port random-web
#
# Which ports does an image document with EXPOSE?
docker image inspect --format '{{json .Config.ExposedPorts}}' nginx:1.29-alpine
#
# Find the container that is using host port 8080
docker ps --filter "publish=8080"
#
# You cannot change ports on a running container: replace it instead
docker rm -f web
docker run -d --name web -p 9090:80 nginx:1.29-alpine
#
# Clean up the examples
docker rm -f web db random-web dns-test range-test
</code></pre>

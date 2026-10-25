---
publishDate: 2026-10-25T16:50
title: 'Docker Networking Basics'
slug: docker-networking-basics
metadescription: 'Learn how Docker networking works: network drivers, the default bridge, container IP addresses, internet access, published ports and reaching the host.'
updateDate: 2026-10-25T16:50
author: ['bishal-biswas']
level: 1
tags: ['docker', 'networking', 'bridge']
course: docker
---

## Why containers need networking

A real app is rarely one container. The **notes-api** you built earlier needs to talk to a database. A frontend needs to talk to an API. And all of them may need to reach the internet to download packages or call other services.

So you need to answer three questions:

1. How does a container reach the **internet**?
2. How do **you** (and your users) reach a container?
3. How do **containers reach each other**?

Docker answers all three with **networks**. This lesson gives you the big picture and shows how the default network behaves. The next two lessons go deeper into the network types you will actually use.

You do not need to be a network expert. If words like "IP address" and "port" are new to you, read [IP Addresses, Ports and Protocols](/courses/devops/ip-addresses-ports-and-protocols) first. It takes ten minutes.

## Every container gets its own network

When Docker starts a container, it gives the container its own private **network namespace**. A **namespace** is a Linux feature that makes a process think it has something all to itself. With a network namespace, the container gets:

- its own **network card** (a virtual one, called `eth0`),
- its own **IP address**,
- its own **ports**, so two containers can both listen on port 80 without a fight,
- its own **loopback** address, `127.0.0.1`, which means "this container only".

Think of each container as a small flat in a big building. Each flat has its own door number (IP address) and its own rooms (ports). The building's hallway is the **network** that connects the flats.

You can see this for yourself:

```bash
docker run --rm alpine:3.22 ip addr show eth0
```

```text
2: eth0@if7: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP
    link/ether 02:42:ac:11:00:02 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.2/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```

The container has the address `172.17.0.2`. That address is private: it only means something on this Docker host.

## Network drivers

Docker can build different kinds of networks. Each kind is made by a **driver**, a plug-in that knows how to wire containers together in one particular way.

| Driver | What it does | Where you learn more |
|---|---|---|
| `bridge` | A private network on one host. Containers on it can talk to each other. **The default.** | [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks) |
| `host` | No separate network. The container uses the host's network directly. | [Host and None Networks, and When to Use Them](/courses/docker/host-and-none-networks) |
| `none` | No network at all, only loopback. | [Host and None Networks, and When to Use Them](/courses/docker/host-and-none-networks) |
| `overlay` | One network across many hosts, used by Docker Swarm. | Beyond this course |
| `macvlan` / `ipvlan` | Gives a container an address on your real local network, like a physical machine. | Beyond this course |

For everyday work you will use `bridge` networks almost all the time.

## The networks Docker creates for you

Docker creates three networks when it is installed. List them:

```bash
docker network ls
```

```text
NETWORK ID     NAME      DRIVER    SCOPE
3f9c2a1b7d10   bridge    bridge    local
8e1d44c0a2b9   host      host      local
c0a7f5e9d321   none      null      local
```

- `bridge` is the **default bridge network**. Every container joins it unless you say otherwise.
- `host` and `none` are special networks for the `host` and `none` drivers.
- `SCOPE local` means the network exists only on this machine.

## The default bridge network

A **bridge** network is like a small network switch inside your computer. Containers plug into it, get an address from it, and can send traffic to each other through it. On Linux you can even see the bridge as a network card on the host called `docker0`.

```text
                 the host (your computer or server)
 +-------------------------------------------------------------+
 |                                                             |
 |   container web1          container web2                    |
 |   172.17.0.2              172.17.0.3                        |
 |        \                     /                              |
 |         \                   /                               |
 |       [ bridge network "bridge" (docker0) 172.17.0.1 ]      |
 |                       |                                     |
 |                 host network card ----> internet            |
 +-------------------------------------------------------------+
```

### Containers can reach each other by IP address

Start two containers and look at their addresses:

```bash
docker run -d --name web1 nginx:1.29-alpine
docker run -d --name web2 nginx:1.29-alpine
docker inspect --format '{{ .NetworkSettings.IPAddress }}' web1 web2
```

```text
172.17.0.2
172.17.0.3
```

From `web2`, try to reach `web1` by its IP address:

```bash
docker exec web2 wget -qO- http://172.17.0.2
```

```text
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
...
```

It works. Both containers are on the same bridge, so they can talk.

### But not by name

Now try the container's **name** instead:

```bash
docker exec web2 wget -qO- http://web1
```

```text
wget: bad address 'web1'
```

This is the most important fact about the default bridge network: **it has no name-based DNS**. **DNS** is the system that turns names into IP addresses (you can read how it works in [How DNS Works](/courses/devops/how-dns-works)). On the default bridge, containers cannot find each other by name.

Why is that a problem? Container IP addresses change. Stop and start `web1` in a different order and it may get `172.17.0.3` next time. Writing IP addresses into your app's settings would break all the time.

The fix is a **user-defined bridge network**, which you create yourself. It has built-in DNS, so containers find each other by name. That is the topic of [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks).

> **Note:** Old tutorials use `--link` to connect containers on the default bridge. It is a legacy feature. Use a user-defined network instead.

## Question 1: reaching the internet

Containers on a bridge network can reach the internet out of the box:

```bash
docker run --rm alpine:3.22 wget -qO- https://example.com | head -n 4
```

```text
<!doctype html>
<html>
<head>
    <title>Example Domain</title>
```

This works through **NAT** (network address translation). The container sends traffic to the bridge, and the host forwards it to the internet as if it came from the host itself. Replies come back the same way. The outside world never sees the container's private `172.17.x.x` address.

Docker also gives each container DNS settings, usually copied from the host, so names like `example.com` work.

## Question 2: reaching a container from outside

Traffic can go **out** freely, but nothing from outside can come **in** unless you open a door. That door is a **published port**, which you learned about in [Publishing Ports: Reaching Apps Inside Containers](/courses/docker/publishing-ports):

```bash
docker run -d --name web -p 8080:80 nginx:1.29-alpine
```

Now port `8080` on the host forwards to port `80` inside the container.

```text
 browser --> host port 8080 --> bridge --> container web, port 80
```

By default `-p 8080:80` listens on **all** of the host's network addresses. On a server, that means anyone on the internet who can reach the server can reach the container. To allow only your own machine, bind to `127.0.0.1`:

```bash
docker run -d --name admin -p 127.0.0.1:8081:80 nginx:1.29-alpine
```

> **Warning:** On Linux, Docker adds its own firewall rules for published ports. Those rules can skip past simple firewall tools such as `ufw`, so a port you thought was blocked may still be open. If a port should be private, bind it to `127.0.0.1` or do not publish it at all.

Check which ports a container publishes:

```bash
docker port web
```

```text
80/tcp -> 0.0.0.0:8080
80/tcp -> [::]:8080
```

## Question 3: reaching the host from a container

Sometimes a container needs to talk to a program running directly on your computer, for example a database you installed without Docker. Inside a container, `localhost` means **the container itself**, not your computer, so `localhost` will not work.

Docker Desktop gives you a special name for this: `host.docker.internal`.

```bash
# On Docker Desktop: reach a server running on your computer's port 5000
docker run --rm alpine:3.22 wget -qO- http://host.docker.internal:5000
```

On Linux with Docker Engine, that name does not exist by default. Add it yourself with the special value `host-gateway`:

```bash
docker run --rm --add-host=host.docker.internal:host-gateway \
  alpine:3.22 wget -qO- http://host.docker.internal:5000
```

> **Tip:** The program on your computer must listen on an address the container can reach. If it only listens on `127.0.0.1`, it may refuse connections from containers. This is the same rule as inside containers: servers should listen on `0.0.0.0`.

## Looking at a network

`docker network inspect` shows everything about a network, including which containers are on it:

```bash
docker network inspect bridge --format '{{ json .Containers }}'
```

```json
{"5b1c...":{"Name":"web1","IPv4Address":"172.17.0.2/16"},"9d2e...":{"Name":"web2","IPv4Address":"172.17.0.3/16"}}
```

(The real output has a few more fields per container. They are trimmed here.)

## Common mistakes

### Using `localhost` to reach another container

Inside a container, `localhost` is that container only. To reach another container, use its name on a user-defined network, or a published port from the host.

### Expecting names to work on the default bridge

They do not. Create your own network with `docker network create`.

### Publishing database ports to the world

If only other containers need the database, do not publish its port. Containers on the same network can reach it without `-p`.

### App listening on 127.0.0.1 inside the container

Published traffic arrives through `eth0`, not loopback. Make your app listen on `0.0.0.0`. The **notes-api** already does this.

## Quick recap

- Each container has its own **network namespace**: its own IP address, ports and `localhost`.
- **Drivers** decide how a network works: `bridge` (default), `host`, `none`, `overlay`, `macvlan`.
- Docker creates three networks: `bridge`, `host` and `none`.
- On the **default bridge**, containers reach each other by IP but **not by name**.
- Containers reach the internet through NAT; outsiders reach containers only through **published ports**.
- Bind sensitive ports to `127.0.0.1`. Use `host.docker.internal` to reach the host (add `--add-host=host.docker.internal:host-gateway` on Linux).

Next, you will create your own networks so containers can find each other by name in [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks).

<code id="code-content" class="language-bash">
# Docker networking basics cheat sheet
# ---------- See the networks Docker created ----------
docker network ls
# ---------- Every container has its own IP on the default bridge ----------
docker run -d --name web1 nginx:1.29-alpine
docker run -d --name web2 nginx:1.29-alpine
docker inspect --format '{{ .NetworkSettings.IPAddress }}' web1 web2
# By IP: works
docker exec web2 wget -qO- http://172.17.0.2
# By name: fails on the default bridge (no DNS there)
docker exec web2 wget -qO- http://web1
# ---------- Containers can reach the internet through NAT ----------
docker run --rm alpine:3.22 wget -qO- https://example.com
# ---------- Let the outside world in with a published port ----------
docker run -d --name web -p 8080:80 nginx:1.29-alpine
# Only this machine can reach it
docker run -d --name admin -p 127.0.0.1:8081:80 nginx:1.29-alpine
docker port web
# ---------- Reach a program running on the host ----------
# Docker Desktop:
docker run --rm alpine:3.22 wget -qO- http://host.docker.internal:5000
# Linux Docker Engine: add the name yourself
docker run --rm --add-host=host.docker.internal:host-gateway alpine:3.22 wget -qO- http://host.docker.internal:5000
# ---------- Look inside a network ----------
docker network inspect bridge
# ---------- Clean up ----------
docker rm -f web1 web2 web admin
</code></pre>

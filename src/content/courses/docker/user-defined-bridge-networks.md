---
publishDate: 2026-10-25T16:55
title: 'Bridge Networks and Container DNS'
slug: user-defined-bridge-networks
metadescription: 'Learn to create your own Docker bridge networks so containers find each other by name, and how to connect, isolate and inspect them.'
updateDate: 2026-10-25T16:55
author: ['bishal-biswas']
level: 2
tags: ['docker', 'networking', 'dns', 'bridge']
course: docker
---

## Containers that find each other by name

In [Docker Networking Basics](/courses/docker/docker-networking-basics) you saw a problem: on the **default bridge network**, containers can reach each other only by IP address, and those addresses change. That makes it hard to connect an API to its database.

The solution is to create your **own** bridge network. Docker calls this a **user-defined bridge network**. It works like the default one, with one big extra: **built-in DNS**. Every container on it can reach every other container **by name**.

In this lesson you will:

- create a network and put containers on it,
- connect the **notes-api** to a PostgreSQL database by name,
- see how Docker's DNS works,
- connect a container to more than one network, and keep some containers apart on purpose.

## Creating a network

Creating a network takes one command:

```bash
docker network create notes-net
```

```text
6c1f0b8a3d27e9f4c5a1b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3
```

The long string is the network's ID. The driver is `bridge` by default, so you do not need to say `--driver bridge`. Check it:

```bash
docker network ls --filter name=notes-net
```

```text
NETWORK ID     NAME        DRIVER    SCOPE
6c1f0b8a3d27   notes-net   bridge    local
```

## Putting containers on the network

Use `--network` when you start a container. Start two simple containers:

```bash
docker run -d --name web1 --network notes-net nginx:1.29-alpine
docker run -d --name web2 --network notes-net nginx:1.29-alpine
```

Now try the test that failed on the default bridge:

```bash
docker exec web2 wget -qO- http://web1
```

```text
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
...
```

It works. `web2` found `web1` **by name**. You never had to look up an IP address.

## How container DNS works

On a user-defined network, Docker runs a small **DNS server** for the containers. It lives at the special address `127.0.0.11` inside every container on that network. When your app asks "what is the address of `web1`?", this DNS server answers with the current IP of the container named `web1`.

You can look at it from inside a container:

```bash
docker exec web2 cat /etc/resolv.conf
```

```text
nameserver 127.0.0.11
options ndots:0
```

And ask it a question with `nslookup`:

```bash
docker exec web2 nslookup web1
```

```text
Server:     127.0.0.11
Address:    127.0.0.11:53

Non-authoritative answer:
Name:   web1
Address: 172.18.0.2
```

```text
 web2 asks: "where is web1?"
      |
      v
 Docker DNS (127.0.0.11) --> looks at containers on notes-net --> "172.18.0.2"
      |
      v
 web2 connects to 172.18.0.2
```

If `web1` is recreated and gets a new IP, the DNS server simply gives the new one. Your app keeps using the name and never notices.

For names that are not containers, such as `example.com`, Docker's DNS server passes the question on to the host's normal DNS servers. So internet access still works.

> **Note:** Notice the network uses `172.18.x.x`, not `172.17.x.x`. Each network gets its own **subnet** (its own range of addresses). Docker picks a free one for you.

## Connecting notes-api to PostgreSQL

Now do something useful. Run the database and the **notes-api** from [Project: Dockerizing a Node.js App](/courses/docker/dockerizing-a-node-app) on the same network.

First the database. The container **name** is `db`, and that name becomes its DNS name:

```bash
docker volume create notes-data
docker run -d --name db --network notes-net \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  -v notes-data:/var/lib/postgresql/data \
  postgres:17-alpine
```

Then the API. Its `DATABASE_URL` uses `db` as the host name:

```bash
docker run -d --name api --network notes-net \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://notes:devpassword@db:5432/notes \
  notes-api:1.0.0
```

Look at the address in `DATABASE_URL`:

```text
postgres://notes:devpassword@db:5432/notes
           user  password    host port database
```

The host is just `db`. Docker's DNS turns it into the database container's IP.

Two more things to notice:

- The **database has no `-p`**. Only the API needs to reach it, and containers on the same network can use any port of each other without publishing. This keeps the database hidden from the outside world.
- The **API has `-p 3000:3000`**, because you want to reach it from your browser.

```text
  browser
     |
     | localhost:3000 (published)
     v
 +------------------- network notes-net -------------------+
 |   api  ------------ db:5432 (not published) -------> db  |
 +---------------------------------------------------------+
```

Test it:

```bash
curl http://localhost:3000/health
```

```text
ok
```

> **Tip:** This is exactly what Docker Compose does for you automatically. It creates a network for your project and names each container's DNS entry after its service. You will see this in [What is Docker Compose?](/courses/docker/what-is-docker-compose).

## Connecting and disconnecting running containers

A container can join or leave a network while it runs:

```bash
# Start a container on the default bridge, then add it to notes-net
docker run -d --name tools alpine:3.22 sleep 3600
docker network connect notes-net tools
docker exec tools ping -c 1 db
```

```text
PING db (172.18.0.4): 56 data bytes
64 bytes from 172.18.0.4: seq=0 ttl=64 time=0.112 ms
```

```bash
# Take it off again
docker network disconnect notes-net tools
```

## Extra names with network aliases

A container can have extra DNS names on a network, called **aliases**. This is useful when an app expects a fixed host name, such as `postgres`:

```bash
docker run -d --name db2 --network notes-net \
  --network-alias postgres \
  -e POSTGRES_PASSWORD=devpassword \
  postgres:17-alpine
```

Now other containers on `notes-net` can reach it as `db2` **or** `postgres`.

> **Note:** If several containers share the same alias, Docker's DNS returns all of their addresses. This is a very simple form of load balancing, but for real traffic spreading use a reverse proxy (see [Reverse Proxies and Load Balancers](/courses/devops/reverse-proxies-and-load-balancers)).

## Isolation: networks keep containers apart

Containers on **different** user-defined networks cannot talk to each other. This lets you separate parts of your system. A common design is:

- a `frontend` network for the web server and the API,
- a `backend` network for the API and the database.

The API joins **both**. The web server can reach the API but never the database directly.

```bash
# Remove the containers from the earlier examples first, so the names are free
docker rm -f web1 web2 api db

docker network create frontend
docker network create backend

docker run -d --name db --network backend \
  -e POSTGRES_PASSWORD=devpassword postgres:17-alpine

docker run -d --name api --network backend \
  -e DATABASE_URL=postgres://postgres:devpassword@db:5432/postgres \
  notes-api:1.0.0
docker network connect frontend api

docker run -d --name web --network frontend -p 8080:80 nginx:1.29-alpine
```

```text
  web ----- frontend ----- api ----- backend ----- db
   (web cannot see db: they share no network)
```

Prove it:

```bash
docker exec web ping -c 1 -W 2 db
```

```text
ping: bad address 'db'
```

The name `db` does not even resolve, because `web` and `db` share no network.

### Internal networks: no internet

Add `--internal` to make a network with **no route to the outside world**. Containers on it can talk to each other, but not to the internet:

```bash
docker network create --internal backend-private
```

This is a good fit for a database that never needs to download anything.

## Inspecting and removing networks

```bash
docker network inspect notes-net
```

The output is JSON with the subnet, the gateway and the containers on the network. A trimmed part:

```json
{
  "Name": "notes-net",
  "Driver": "bridge",
  "IPAM": { "Config": [ { "Subnet": "172.18.0.0/16", "Gateway": "172.18.0.1" } ] },
  "Containers": {
    "a81f...": { "Name": "api", "IPv4Address": "172.18.0.3/16" },
    "4c2d...": { "Name": "db", "IPv4Address": "172.18.0.2/16" }
  }
}
```

Remove a network when you no longer need it. Docker refuses while containers are still connected:

```bash
docker network rm notes-net
```

```text
Error response from daemon: error while removing network: network notes-net has active endpoints
```

Remove the containers first, or clean up every unused network at once:

```bash
docker network prune
```

## Default bridge vs user-defined bridge

| | Default `bridge` | User-defined bridge |
|---|---|---|
| Created by | Docker, at install | You, with `docker network create` |
| Find containers by name | **No** | **Yes**, built-in DNS |
| Isolation | All containers share it | Only containers you add |
| Connect or disconnect while running | Awkward | Easy |
| Extra names (aliases) | No | Yes |
| Recommended | Only for quick tests | **Yes, for real apps** |

## Common mistakes

### Using the container ID or an IP in config

Use the container **name** (or an alias). Names keep working when containers are replaced.

### Forgetting `--network` on one container

If one container is on the default bridge, it cannot resolve the others. Check with `docker inspect --format '{{ json .NetworkSettings.Networks }}' api`.

### Publishing the database port "so the API can reach it"

Containers on the same network already reach each other on any port. `-p` is only for traffic from **outside** Docker.

### Using `localhost:5432` from the API

Inside the API container, `localhost` is the API container. Use `db:5432`.

### Using the published port number between containers

If you publish `-p 5433:5432`, other containers still use the **container** port: `db:5432`. The `5433` is only for the host.

## Quick recap

- Create your own network with `docker network create name` and join it with `--network name`.
- User-defined bridge networks have **built-in DNS** at `127.0.0.11`: containers reach each other **by name**.
- Container ports are open to other containers on the same network. Publish only what outsiders need.
- `docker network connect` and `disconnect` change networks on running containers. `--network-alias` adds extra names.
- Different networks are **isolated**. Put a container on two networks to bridge them on purpose. `--internal` blocks internet access.

Next, you will meet the two special network modes that skip the bridge entirely in [Host and None Networks, and When to Use Them](/courses/docker/host-and-none-networks).

<code id="code-content" class="language-bash">
# User-defined bridge networks cheat sheet
# ---------- Create a network (bridge driver by default) ----------
docker network create notes-net
# ---------- Database: its name "db" becomes its DNS name. No -p needed ----------
docker volume create notes-data
docker run -d --name db --network notes-net \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  -v notes-data:/var/lib/postgresql/data \
  postgres:17-alpine
# ---------- API: reaches the database at host "db", published for your browser ----------
docker run -d --name api --network notes-net \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://notes:devpassword@db:5432/notes \
  notes-api:1.0.0
curl http://localhost:3000/health
# ---------- Check the built-in DNS ----------
docker exec api cat /etc/resolv.conf
docker run --rm --network notes-net alpine:3.22 nslookup db
# ---------- Join and leave networks while running ----------
docker run -d --name tools alpine:3.22 sleep 3600
docker network connect notes-net tools
docker network disconnect notes-net tools
# ---------- An extra DNS name ----------
docker run -d --name db2 --network notes-net --network-alias postgres \
  -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
# ---------- Isolation: frontend and backend, api joins both ----------
docker network create frontend
docker network create --internal backend
# ---------- Inspect and clean up ----------
docker network inspect notes-net
docker rm -f api db db2 tools
docker network rm notes-net
docker network prune
</code></pre>

---
publishDate: 2026-10-25T17:00
title: 'Host and None Networks, and When to Use Them'
slug: host-and-none-networks
metadescription: 'Learn what the Docker host and none network modes do, how they differ from bridge networks, and when each one is the right choice.'
updateDate: 2026-10-25T17:00
author: ['bishal-biswas']
level: 2
tags: ['docker', 'networking', 'security']
course: docker
---

## Two special network modes

In the last two lessons you worked with **bridge** networks. A bridge gives each container its own private network, and you open doors with published ports. You learned the basics in [Docker Networking Basics](/courses/docker/docker-networking-basics) and built your own networks in [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks).

Docker has two more modes that work very differently:

- **host**: the container has **no network of its own**. It uses the host's network directly, as if the program was installed on the host.
- **none**: the container has **no network at all**. It is completely cut off.

Think of the flats in a building again. A bridge network gives each flat its own door number. **Host** mode is like taking down the walls so the container lives in the main house. **None** mode is like a room with no door and no window.

By the end of this lesson you will know how both modes behave, what they are good for, and why you should use them only when you have a real reason.

## Host mode

### What it does

With `--network host`, Docker skips the private network namespace. The container sees the host's real network cards, the host's IP addresses and the host's ports.

```bash
docker run --rm --network host alpine:3.22 ip addr
```

```text
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP
    inet 192.168.1.50/24 brd 192.168.1.255 scope global eth0
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
...
```

Those are the **host's** network cards, including `docker0`, the default bridge. Compare this with a normal container, which only sees its own `lo` and `eth0`.

### No published ports needed

In host mode, a program that listens on a port listens **directly on the host**. There is no `-p`:

```bash
docker run -d --name web-host --network host nginx:1.29-alpine
curl http://localhost:80
```

```text
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
...
```

nginx listens on port 80, so it is on the host's port 80. If you add `-p`, Docker ignores it and warns you:

```bash
docker run -d --network host -p 8080:80 nginx:1.29-alpine
```

```text
WARNING: Published ports are discarded when using host network mode
```

### The catch: port conflicts

Because all host-mode containers share the host's ports, two of them cannot listen on the same port. Try a second nginx:

```bash
docker run -d --name web-host2 --network host nginx:1.29-alpine
docker logs web-host2
```

```text
nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address in use)
```

With bridge networks this was never a problem: each container had its own port 80, and you mapped them to different host ports.

### Where host mode works

Host mode is a **Linux feature**. On a Linux server with Docker Engine it works exactly as shown.

On Docker Desktop for Windows and macOS, containers run inside a small Linux virtual machine, so "the host" means that virtual machine, not your computer. Recent versions of Docker Desktop can turn on host networking as an option in Settings, but it does not behave exactly like Linux. Treat host mode as something for Linux servers.

### When to use host mode

| Good reason | Why host mode helps |
|---|---|
| Network tools that watch the host's traffic | They need to see the real network cards |
| An app that opens many or random ports | You cannot publish thousands of ports one by one |
| Very high network performance | Skips the bridge and NAT, which saves a little time per packet |
| Discovery protocols (finding devices on the local network) | They need to send and receive broadcast messages on the real network |

For a normal web app or API, a bridge network with published ports is better. The speed difference is small for most apps, and you lose a lot of safety.

### The cost: less isolation

> **Warning:** A host-mode container can listen on **any** port of the host and connect to services that only listen on the host's `127.0.0.1`, such as a local database or admin panel. If an attacker breaks into the container, they are much closer to the host. Only use host mode for software you trust, and run it as a non-root user (see [Running Containers as a Non-Root User](/courses/docker/running-as-non-root)).

Also, container DNS names do not work in host mode, because the container is not on a Docker network. It reaches other containers only through their **published ports** on `localhost`.

## None mode

### What it does

With `--network none`, the container gets **only** the loopback interface. No `eth0`, no IP address, no route anywhere.

```bash
docker run --rm --network none alpine:3.22 ip addr
```

```text
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
```

Try to reach anything:

```bash
docker run --rm --network none alpine:3.22 wget -qO- https://example.com
```

```text
wget: bad address 'example.com'
```

The container cannot even look up a name, let alone connect.

### It can still do useful work

A container with no network still has its file system, volumes and bind mounts (you learned these in [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes) and [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts)). So it can read input files and write output files. For example, compress a folder of logs with no network at all:

```bash
docker run --rm --network none \
  -v "$(pwd)/logs:/in:ro" \
  -v "$(pwd)/out:/out" \
  alpine:3.22 \
  tar czf /out/logs.tar.gz -C /in .
```

### When to use none mode

| Good reason | Example |
|---|---|
| Processing **untrusted** files | Converting user uploads, opening documents from unknown sources |
| Jobs that must not leak data | A script that reads private data and writes a report to a volume |
| Pure computation | Image resizing, data crunching, running a test suite with no network calls |
| Checking that something really works offline | Proving your build does not secretly download files |

If the code inside turns out to be harmful, it has no way to send your data anywhere or download more harmful code. That makes `none` a simple and strong safety tool, and you will see it again in [Container Security Best Practices](/courses/docker/container-security-best-practices).

> **Tip:** You can combine `--network none` with `--read-only` and a tmpfs mount from [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups) for a very locked-down container.

## A bonus mode: sharing another container's network

There is one more option you may see: `--network container:<name>`. The new container **joins another container's network namespace**. They share one IP address and one `localhost`.

This is handy for debugging. Say the **notes-api** container has no tools like `curl`. Start a helper that shares its network:

```bash
docker run --rm -it --network container:api alpine:3.22 sh
# inside the helper:
wget -qO- http://localhost:3000/health
```

```text
ok
```

Inside the helper, `localhost:3000` is the API, because they share a network. You will use tricks like this in [Debugging Containers That Will Not Start](/courses/docker/debugging-containers).

## Comparing the modes

| | Bridge (user-defined) | Host | None |
|---|---|---|---|
| Own IP address | Yes | No, uses the host's | No |
| Needs `-p` to be reached | Yes | No (`-p` is ignored) | Cannot be reached |
| Can reach the internet | Yes | Yes | **No** |
| DNS names for other containers | Yes | No | No |
| Port conflicts between containers | No | **Yes** | No |
| Isolation | Good | **Weak** | **Strongest** |
| Works the same on Docker Desktop | Yes | No, Linux only | Yes |
| Use it for | Almost everything | Special network tools, many ports | Untrusted or offline jobs |

### A simple decision guide

```text
Does the container need any network at all?
 |-- No  --> --network none
 |-- Yes --> Does it need the host's real network cards or many ports?
             |-- Yes, and I am on Linux and trust the software --> --network host
             |-- No --> a user-defined bridge network (the normal choice)
```

## Using these modes in Compose

You will start using Docker Compose in [What is Docker Compose?](/courses/docker/what-is-docker-compose). There, the mode is set with `network_mode`:

```yaml
services:
  monitor:
    image: alpine:3.22
    network_mode: host     # use the host's network
  converter:
    image: alpine:3.22
    network_mode: none     # no network at all
```

## Common mistakes

### Using host mode "to make ports work"

If you cannot reach your app, the usual reason is a missing `-p` or an app listening on `127.0.0.1`. Fix that instead of switching to host mode and losing isolation.

### Expecting host mode on Docker Desktop to expose ports on your laptop

On Windows and macOS, "host" is Docker Desktop's virtual machine unless you turn on the special setting, so `localhost` on your computer may not reach the container.

### Running two host-mode containers on the same port

The second one fails with "Address in use". Give each a different port in its own config.

### Forgetting that none means no DNS either

In none mode, even names like `example.com` do not resolve. If your job needs to download one thing first, download it before, or use an `--internal` network instead.

## Quick recap

- **Host mode** (`--network host`) shares the host's network. No `-p`, no private IP, and ports can clash. It is a Linux feature with weaker isolation.
- Use host mode only for special cases: network tools, apps with many ports, or extreme performance needs.
- **None mode** (`--network none`) removes all networking except loopback. Volumes and bind mounts still work.
- Use none mode for untrusted files, offline jobs and pure computation.
- `--network container:<name>` shares another container's network, which is great for debugging.
- For almost everything else, use a **user-defined bridge network**.

Next, you will stop typing long `docker run` commands and describe whole apps in one file in [What is Docker Compose?](/courses/docker/what-is-docker-compose).

<code id="code-content" class="language-bash">
# Host and none network modes cheat sheet
# ---------- HOST mode: use the host's network directly (Linux) ----------
# The container sees the host's real network cards
docker run --rm --network host alpine:3.22 ip addr
# nginx listens straight on the host's port 80. No -p (it would be ignored)
docker run -d --name web-host --network host nginx:1.29-alpine
curl http://localhost:80
# A second host-mode nginx fails: port 80 is already taken
docker run -d --name web-host2 --network host nginx:1.29-alpine
docker logs web-host2
# ---------- NONE mode: no network at all, only loopback ----------
docker run --rm --network none alpine:3.22 ip addr
# This fails: no DNS and no route
docker run --rm --network none alpine:3.22 wget -qO- https://example.com
# Still useful: process files through volumes and bind mounts, fully offline
docker run --rm --network none \
  -v "$(pwd)/logs:/in:ro" \
  -v "$(pwd)/out:/out" \
  alpine:3.22 \
  tar czf /out/logs.tar.gz -C /in .
# Extra locked down: no network, read-only file system, small temp folder
docker run --rm --network none --read-only --tmpfs /tmp:size=16m alpine:3.22 sh -c "echo safe &gt; /tmp/x &amp;&amp; cat /tmp/x"
# ---------- BONUS: share another container's network for debugging ----------
docker run --rm -it --network container:api alpine:3.22 wget -qO- http://localhost:3000/health
# ---------- Clean up ----------
docker rm -f web-host web-host2
</code></pre>

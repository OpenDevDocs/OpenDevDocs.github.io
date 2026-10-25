---
publishDate: 2026-10-25T14:10
title: 'How Docker Works: Engine, Client, Images and Registries'
slug: docker-architecture
metadescription: 'See how the Docker client, the Docker Engine, images, containers and registries work together when you type a command like docker run.'
updateDate: 2026-10-25T14:10
author: ['bishal-biswas']
level: 1
tags: ['docker', 'architecture', 'docker-engine', 'registries']
course: docker
---

## What happens when you type a Docker command?

When you type `docker run nginx:1.29-alpine`, it looks like one program does everything. In fact, several parts work together. Knowing these parts makes Docker much less mysterious. It also helps a lot later, when something goes wrong and you need to understand an error message.

In this lesson you will learn:

- the difference between the Docker **client** and the Docker **Engine**
- how they talk to each other
- where **images** and **containers** live
- what a **registry** is and how pulling and pushing work
- the full journey of one `docker run` command

You learned the basic words "image" and "container" in [What is Docker and Why Use It?](/courses/docker/what-is-docker). Now we will put them in the bigger picture.

## The big picture

```text
  YOUR TERMINAL                DOCKER HOST                     REGISTRY
 +--------------+      +----------------------------+      +--------------+
 |              |      |  Docker Engine (dockerd)   |      |  Docker Hub  |
 | docker CLI   | ---> |    - images  (on disk)     | <--> |  ghcr.io     |
 | (the client) |  API |    - containers            | pull |  ...         |
 |              |      |    - networks, volumes     | push |              |
 +--------------+      +----------------------------+      +--------------+
```

There are three main parts:

1. **The client**: the `docker` command you type in the terminal.
2. **The Docker Engine**: a background service that does the real work.
3. **A registry**: an online store where images are kept and shared.

A good analogy is a **restaurant**. You (the client) give your order to the kitchen (the Engine). The kitchen cooks the meal (runs the container). If the kitchen does not have an ingredient (an image), it orders it from a supplier (the registry).

## The Docker client

The **Docker client** is the `docker` program in your terminal. It is surprisingly simple. It does not run containers itself. It only:

1. reads the command you typed
2. turns it into a request
3. sends that request to the Docker Engine
4. shows you the answer

You can see both sides with `docker version`:

```bash
docker version
```

```text
Client:
 Version:           28.5.1
 API version:       1.51
 OS/Arch:           linux/amd64
 ...

Server: Docker Engine - Community
 Engine:
  Version:          28.5.1
  API version:      1.51 (minimum version 1.24)
  OS/Arch:          linux/amd64
 containerd:
  Version:          1.7.28
 runc:
  Version:          1.3.0
 ...
```

The output has two parts: **Client** and **Server**. They are two different programs. (Your version numbers will be different. That is normal.)

> **Tip:** If you see the Client part but get an error like `Cannot connect to the Docker daemon`, the client is fine but the Engine is not running. On Windows and macOS, start Docker Desktop. On Linux, run `sudo systemctl start docker`.

## The Docker Engine

The **Docker Engine** is the part that does the real work. Its main program is called **dockerd**, the Docker **daemon**. A daemon is a program that runs quietly in the background, waiting for requests.

The Engine is responsible for:

- **building** images from Dockerfiles
- **storing** images on disk
- **creating, starting and stopping** containers
- managing **networks** and **volumes**
- **pulling** and **pushing** images to and from registries

### The layers inside the Engine

dockerd does not start containers all by itself. It hands the work down to smaller tools:

```text
dockerd      receives API requests, manages images, networks and volumes
   |
containerd   manages the life of containers (start, stop, watch)
   |
runc         asks the Linux kernel to create the isolated process
   |
your app     running inside namespaces and cgroups
```

- **containerd** is a container manager. It is also used directly by Kubernetes.
- **runc** is a tiny tool that talks to the Linux kernel to create the namespaces and cgroups you met in [Containers vs Virtual Machines](/courses/docker/containers-vs-virtual-machines).

You will almost never use containerd or runc directly. It is enough to know they exist. You can see their versions in the `docker version` output above.

## How the client talks to the Engine

The client and the Engine talk using an **API** (Application Programming Interface), a set of agreed requests and answers. The Docker API uses normal HTTP requests with JSON, the same kind of messages websites use. If HTTP is new to you, see [HTTP, HTTPS and TLS](/courses/devops/http-https-and-tls).

On Linux, the messages usually travel through a special file called a **Unix socket**:

```text
/var/run/docker.sock
```

Because it is just an API, you can even talk to the Engine without the `docker` command. This `curl` call (on Linux) asks the Engine for its version, the same way the client does:

```bash
curl --unix-socket /var/run/docker.sock http://localhost/version
```

```json
{"Platform":{"Name":"Docker Engine - Community"},"Version":"28.5.1","ApiVersion":"1.51","Os":"linux","Arch":"amd64"}
```

> **Warning:** Anyone who can use `/var/run/docker.sock` can control Docker, and Docker can do anything on the machine. Access to this socket, or membership of the `docker` group, is the same as **root access**. Never mount the socket into a container you do not fully trust.

### Remote Engines and contexts

The client and the Engine do not have to be on the same computer. The client can control an Engine on a server over SSH. Docker calls each target a **context**:

```bash
docker context ls
```

```text
NAME              DESCRIPTION                               DOCKER ENDPOINT
default *         Current DOCKER_HOST based configuration   unix:///var/run/docker.sock
desktop-linux     Docker Desktop                            npipe:////./pipe/dockerDesktopLinuxEngine
```

The star shows the context you are using now. On Windows, Docker Desktop uses a **named pipe** (`npipe`) instead of a Unix socket, but the idea is the same.

## Images: where they live

An **image** is stored on the Docker host's disk, managed by the Engine. It is made of **layers**: each layer is a set of file changes, stacked on top of each other. Layers are shared between images, so ten images based on `node:24-alpine` store the Node.js files only once.

```bash
docker images
```

```text
REPOSITORY   TAG           IMAGE ID       CREATED       SIZE
nginx        1.29-alpine   4a5b6c7d8e9f   2 weeks ago   52.5MB
node         24-alpine     1f2e3d4c5b6a   3 weeks ago   163MB
```

You will learn how layers work in [Images and Layers Explained](/courses/docker/images-and-layers).

## Containers: where they live

A **container** is also managed by the Engine. When Docker creates a container, it takes the image's read-only layers and adds one thin **writable layer** on top. Your app can change files in that writable layer. The image itself never changes.

```text
+----------------------------+
| writable layer (container) |  <- changes made while running
+----------------------------+
| image layer 3 (read-only)  |
| image layer 2 (read-only)  |
| image layer 1 (read-only)  |
+----------------------------+
```

When you remove the container, its writable layer is deleted. The image stays, ready to create more containers.

## Registries: sharing images

A **registry** is a server that stores images so others can download them. Some common registries:

| Registry | Address | Notes |
|---|---|---|
| Docker Hub | `docker.io` | The default. Has official images like `nginx` and `postgres` |
| GitHub Container Registry | `ghcr.io` | Linked to GitHub accounts and repositories |
| Cloud registries | Amazon ECR, Google Artifact Registry, Azure Container Registry | Used with each cloud |
| Your own | any address | You can run a private registry yourself |

Two actions move images between your Engine and a registry:

- **pull**: download an image from a registry to your machine
- **push**: upload an image from your machine to a registry

```bash
docker pull nginx:1.29-alpine                # download
docker push ghcr.io/your-name/notes-api:1.0.0  # upload (needs login)
```

When you write only `nginx:1.29-alpine`, Docker fills in the missing parts: the full name is `docker.io/library/nginx:1.29-alpine`. You will learn to read full image names in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests) and to push your own images in [Pushing Images to Docker Hub and GitHub Container Registry](/courses/docker/pushing-images-to-a-registry).

## The journey of one docker run

Now put it all together. Here is what happens when you run:

```bash
docker run -d -p 8080:80 nginx:1.29-alpine
```

1. The **client** reads your command and sends a "create container" request to the **Engine** through the API.
2. The **Engine** looks for the image `nginx:1.29-alpine` on disk.
3. It is not there, so the Engine **pulls** it from **Docker Hub**, layer by layer.
4. The Engine creates a **container**: the image layers plus a new writable layer, a network connection, and a rule that forwards port 8080 on the host to port 80 in the container.
5. The Engine asks **containerd**, which uses **runc**, to start the nginx process in its own namespaces and cgroups.
6. The Engine sends the new container ID back to the **client**, which prints it.

```text
Unable to find image 'nginx:1.29-alpine' locally
1.29-alpine: Pulling from library/nginx
...
Status: Downloaded newer image for nginx:1.29-alpine
9c2b7e1f0a4d3e8b6c5a7f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c
```

The long string on the last line is the container ID. The next time you run the same image, step 3 is skipped, because the image is already on disk.

## Where the build fits

There is one more path you will use a lot: **building** images. When you run `docker build`, the client sends your project folder (the **build context**) to the Engine. The Engine's builder, called **BuildKit**, follows the Dockerfile step by step and saves the result as a new image.

```text
Dockerfile + project files --docker build--> IMAGE --docker run--> CONTAINER
                                               |
                                          docker push
                                               v
                                           REGISTRY
```

You will write your first one in [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile).

## Common mistakes

### "docker: command not found" vs "cannot connect to the Docker daemon"

These are different problems. The first means the **client** is not installed or not on your PATH. The second means the client works but the **Engine** is not running or you do not have permission to use it.

### Running every command with sudo on Linux

On Linux you either use `sudo` or add your user to the `docker` group. Both work, but remember the group is root-equivalent. You will set this up in [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker).

### Thinking images are stored "in Docker Hub" only

Once pulled, an image is stored **locally** on your Docker host. Docker uses the local copy until you pull again. This is why an image can be out of date on your machine even if a newer one exists online.

## Quick recap

- The **client** (`docker` command) sends requests; the **Engine** (`dockerd`) does the work.
- They talk through an HTTP API, usually over `/var/run/docker.sock` on Linux.
- Inside the Engine, **containerd** and **runc** start the actual container processes.
- **Images** live on the host's disk as read-only layers; a **container** adds a writable layer.
- **Registries** like Docker Hub and GHCR store images; you **pull** and **push** them.
- Access to the Docker socket is the same as root access.

Next, you will install Docker on your own computer in [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# How Docker works: commands that show each part of the architecture.
#
# The client and the Engine (server) are two programs: see both versions
docker version
# A full report from the Engine: storage driver, number of images and containers, and more
docker info
#
# Which Engine is the client talking to? The star marks the current context
docker context ls
#
# Talk to the Engine API directly over the Unix socket (Linux only)
curl --unix-socket /var/run/docker.sock http://localhost/version
#
# Pull an image from the registry (Docker Hub) into the local image store
docker pull nginx:1.29-alpine
# The short name is really docker.io/library/nginx:1.29-alpine
docker pull docker.io/library/nginx:1.29-alpine
# List images stored on this Docker host
docker images
#
# Create and start a container: client -&gt; Engine -&gt; containerd -&gt; runc
docker run -d --name web -p 8080:80 nginx:1.29-alpine
# List running containers managed by the Engine
docker ps
#
# Clean up the container (the image stays on disk)
docker rm -f web
</code></pre>

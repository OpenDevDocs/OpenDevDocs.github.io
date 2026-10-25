---
publishDate: 2026-10-25T14:00
title: 'What is Docker and Why Use It?'
slug: what-is-docker
metadescription: 'Learn what Docker is, what problem it solves, and how images and containers let you run the same app the same way on any computer.'
updateDate: 2026-10-25T14:00
author: ['bishal-biswas']
level: 1
tags: ['docker', 'containers', 'beginners', 'devops']
course: docker
---

## The problem Docker solves

Imagine you write a small web app on your laptop. It works perfectly. You send it to a friend, and it fails on their computer. Maybe they have a different version of Node.js. Maybe a library is missing. Maybe their operating system is different.

Every developer has heard this sentence: **"It works on my machine."**

**Docker** is a tool that fixes this problem. It lets you pack your app **together with everything it needs to run** into one box. Then that box runs the same way on your laptop, on your friend's laptop, on a test server and in production.

In this lesson you will learn:

- what Docker is, in plain words
- the two most important words in Docker: **image** and **container**
- why teams use Docker every day
- what Docker is not good for
- what you will build in this course

You do not need to install anything yet. You will do that in [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker).

## Docker in one sentence

Docker is a tool that **packages an app and its environment into a container, so it runs the same way everywhere.**

Think about shipping containers on a cargo ship. Before standard containers existed, every item was loaded by hand: boxes, barrels, bags of different sizes. It was slow, and things broke. Then the world agreed on one standard metal box. Now any ship, train or truck can carry any container, and nobody needs to know what is inside.

Docker does the same for software. Your app goes inside a standard "box". Any computer with Docker can run that box, and it does not need to know if the app inside is written in Node.js, Python, Go or Java.

## The two words you must know

### Image

An **image** is a read-only package that contains everything an app needs: the app's code, the runtime (for example Node.js), libraries, and small parts of an operating system.

A good analogy is a **recipe**, or a cake mould. It describes exactly what to make, but you cannot eat it. An image does not run by itself. It just sits on disk.

### Container

A **container** is a running copy of an image. When you "run" an image, Docker creates a container from it. The container is a real process on your computer, but it is kept separate from other processes. It has its own files, its own network and its own view of the system.

If the image is the recipe, the container is the cake. You can bake many cakes from one recipe. In the same way, you can start many containers from one image.

```text
            docker run
  IMAGE  ---------------->  CONTAINER 1  (running)
 (recipe)  ---------------->  CONTAINER 2  (running)
           ---------------->  CONTAINER 3  (stopped)
```

> **Note:** You will learn exactly how images, containers, the Docker Engine and registries fit together in [How Docker Works: Engine, Client, Images and Registries](/courses/docker/docker-architecture).

## A first look at Docker commands

You will run these yourself in a later lesson. For now, just read them and see how short they are.

```bash
# Download and run a web server. No installation of nginx needed.
docker run -d -p 8080:80 nginx:1.29-alpine

# Start an Ubuntu shell, even if your computer runs Windows or macOS
docker run -it --rm ubuntu:24.04 bash

# Start a PostgreSQL database for testing
docker run -d -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
```

Each command does a lot of work for you:

1. Docker checks if the image is already on your computer.
2. If not, it **pulls** (downloads) the image from a **registry**, which is an online store of images. The best known one is **Docker Hub**.
3. It creates a container from the image.
4. It starts the container.

With one line you have a working web server, a Linux shell or a database. When you are done, you delete the container and your computer is clean again.

## Why developers and teams use Docker

### 1. The same environment everywhere

The image contains the exact version of Node.js, Python or any other tool your app needs. Your laptop, your teammate's laptop and the production server all run the **same image**. "It works on my machine" becomes "it works in the image", and the image is the same everywhere.

### 2. Fast setup for new team members

Without Docker, a new developer may spend a full day installing a database, a cache, the right language version and many tools. With Docker, they often run one command, such as `docker compose up`, and the whole project starts. You will learn Compose in [What is Docker Compose?](/courses/docker/what-is-docker-compose).

### 3. Apps do not fight each other

Project A needs Node.js 20. Project B needs Node.js 24. Project C needs PostgreSQL 15 and Project D needs PostgreSQL 17. On one computer this is painful. With Docker, each project runs in its own containers with its own versions. They never conflict.

### 4. Containers are light and quick

A container is not a full virtual computer. It shares the host's operating system **kernel** (the core part of the operating system that talks to the hardware). Because of this, a container usually starts in less than a second and uses little memory. You will see the details in [Containers vs Virtual Machines](/courses/docker/containers-vs-virtual-machines).

### 5. Easy to throw away and recreate

Containers are meant to be **disposable**. If something goes wrong, you delete the container and start a fresh one from the image in seconds. Your computer stays clean, because nothing is installed globally.

### 6. A standard for deployment

Most modern hosting platforms, CI systems and tools like Kubernetes understand container images. If you can build an image, you can deploy it almost anywhere. In the DevOps course you can see where Docker fits in a delivery pipeline, in [Continuous Integration](/courses/devops/continuous-integration).

## Docker before and after

| Task | Without Docker | With Docker |
|---|---|---|
| Run a database for testing | Download installer, configure service, remember to uninstall | `docker run postgres:17-alpine` |
| Use two versions of Node.js | Version managers, path problems | Each project uses its own image |
| Onboard a new developer | Long setup guide, many errors | `docker compose up` |
| Deploy to a server | Install runtime on server, copy files, hope versions match | Pull the image and run it |
| Clean up | Leftover files and services | Remove the container and image |

## What Docker is not

It helps to know the limits too.

- **Docker is not a virtual machine.** A container does not have its own kernel. Linux containers need a Linux kernel. On Windows and macOS, Docker Desktop runs a small hidden Linux system for you.
- **Docker does not make bad code good.** If your app has a bug, it has the same bug inside a container.
- **Docker does not save your data by default.** Files written inside a container are lost when the container is removed, unless you use a **volume**. You will learn this in [Why Container Data Disappears: The Writable Layer](/courses/docker/container-storage-basics).
- **Docker is not the only container tool.** Tools like Podman can also run containers, because images follow an open standard called **OCI** (Open Container Initiative). Docker is simply the most popular and the easiest place to start.

> **Tip:** You do not need to remember every term today. Each one gets its own lesson. Just keep the big picture in mind: **image = package, container = running copy**.

## Key words in this course

| Word | Simple meaning |
|---|---|
| **Image** | A read-only package with an app and everything it needs |
| **Container** | A running (or stopped) copy of an image |
| **Dockerfile** | A text file with step-by-step instructions to build an image |
| **Registry** | An online store for images, such as Docker Hub or GitHub Container Registry |
| **Docker Engine** | The background program that builds and runs containers |
| **Volume** | Storage that lives outside a container, so data survives |
| **Docker Compose** | A tool to run several containers together from one file |

## What you will build in this course

Through the course you will work with a tiny Node.js API called **notes-api**. It has two routes: `GET /health` returns `ok`, and `GET /notes` returns a list of notes as JSON.

Step by step you will:

1. run ready-made containers from Docker Hub
2. write a **Dockerfile** for notes-api, starting in [Writing Your First Dockerfile](/courses/docker/your-first-dockerfile)
3. make the image small, fast to build and secure
4. connect it to a PostgreSQL database and a Redis cache with Docker Compose
5. push the image to a registry and build it automatically in CI
6. deploy the whole app to a Linux server

Here is a small preview of the kind of Dockerfile you will write. You do not need to understand it yet. It is in the code panel too.

```docker
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "src/server.js"]
```

Six lines, and anyone with Docker can run your API without installing Node.js.

## Common mistakes

### Thinking a container is a small virtual machine

It looks like one from the inside, because you can open a shell and see a file system. But it is really an isolated process sharing the host's kernel. This is why it is so fast. Treat it as a process, not a server you log into and maintain.

### Changing a running container by hand

Beginners often open a shell inside a container, install things, and fix files there. Those changes disappear when the container is replaced. Always change the Dockerfile and build a new image instead.

### Using `latest` for everything

Writing `nginx` means `nginx:latest`, which is simply "whatever was published last". It can change under you. Use a clear version such as `nginx:1.29-alpine`. You will learn more in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests).

## Quick recap

- Docker packages an app with everything it needs, so it runs the same way everywhere.
- An **image** is a read-only package (the recipe). A **container** is a running copy of it (the cake).
- Images come from **registries** such as Docker Hub.
- Containers are light, start fast and are easy to delete and recreate.
- Containers share the host kernel, so they are not virtual machines.
- Data inside a container is lost when it is removed, unless you use volumes.

Next, you will see exactly how containers differ from virtual machines in [Containers vs Virtual Machines](/courses/docker/containers-vs-virtual-machines).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# A first look at a Dockerfile for the notes-api project.
# You will learn every line of this file later in the course.
# Build it:  docker build -t notes-api:1.0.0 .
# Run it:    docker run -d --name notes-api -p 3000:3000 notes-api:1.0.0
#
# Start from an official image that already has Node.js 24 installed
FROM node:24-alpine
# All the next steps happen inside the /app folder of the image
WORKDIR /app
# Copy the package files first, then install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Copy the source code of the app
COPY src ./src
# Tell readers the app listens on port 3000 (this does not publish it)
EXPOSE 3000
# The command that runs when a container starts from this image
CMD ["node", "src/server.js"]
</code></pre>

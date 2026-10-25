---
publishDate: 2026-10-25T15:35
title: 'Writing Your First Dockerfile'
slug: your-first-dockerfile
metadescription: 'Write your first Dockerfile step by step for a small Node.js API, then build it into an image, run it as a container and test it with curl.'
updateDate: 2026-10-25T15:35
author: ['bishal-biswas']
level: 1
tags: ['docker', 'dockerfile', 'nodejs', 'beginner']
course: docker
---

## From recipe to running app

A **Dockerfile** is a plain text file with step-by-step instructions for building an image. Think of it as a recipe: "start with this base, add these files, run this command, and when someone starts a container, run this program".

In [docker commit, save and load (and Why Dockerfiles Win)](/courses/docker/docker-commit-save-and-load) you saw why a written recipe is better than changing a container by hand. Now you will write one.

In this lesson you will:

- create a tiny Node.js API called **notes-api**
- write a Dockerfile for it, one line at a time
- build an image with `docker build`
- run it, test it and change it

You do not need Node.js installed on your computer. Docker brings it inside the image. That is one of the best things about containers.

## Step 1: create the app

Make a new folder called `notes-api` and add three files. The app is the running example for the rest of this course, so keep it.

The folder will look like this:

```text
notes-api/
  package.json
  package-lock.json
  src/
    server.js
```

First, `package.json`. It describes the project and tells Node how to start it. You can read more in [package.json Explained](/courses/nodejs/package-json-explained).

```json
{
  "name": "notes-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js"
  }
}
```

Next, `src/server.js`. It uses only Node's built-in `node:http` module, so there is nothing to install:

```javascript
import http from 'node:http';

const port = Number(process.env.PORT ?? 3000);

const notes = [
  { id: 1, text: 'Learn Docker' },
  { id: 2, text: 'Write a Dockerfile' },
];

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    return res.end('ok');
  }
  if (req.url === '/notes') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(notes));
  }
  res.statusCode = 404;
  res.end('not found');
});

// Listen on 0.0.0.0 so traffic from outside the container can reach the app
server.listen(port, '0.0.0.0', () => {
  console.log(`notes-api listening on port ${port}`);
});

// docker stop sends SIGTERM: close the server and exit cleanly
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
```

Finally, `package-lock.json`. It records the exact version of every dependency. Our app has no dependencies yet, so a minimal lock file is enough:

```json
{
  "name": "notes-api",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "notes-api",
      "version": "1.0.0"
    }
  }
}
```

> **Tip:** If you have Node.js installed, you can run `npm install` once in the folder and npm creates this file for you. Learn why lock files matter in [Semver and Lockfiles](/courses/nodejs/semver-and-lockfiles).

## Step 2: write the Dockerfile

Create a file named exactly `Dockerfile` (capital D, no file extension) in the `notes-api` folder, next to `package.json`. Add the lines one at a time and read what each one does.

### Line 1: the syntax line

```docker
# syntax=docker/dockerfile:1
```

This special comment tells **BuildKit** (Docker's build engine) to use the newest stable Dockerfile features. It is optional, but a good habit.

### FROM: pick a starting image

```docker
FROM node:24-alpine
```

Every Dockerfile starts from a **base image**. `node:24-alpine` is the official Node.js 24 image on small Alpine Linux. It already contains `node` and `npm`. You compared base images in [Choosing a Base Image: Full, Slim, Alpine and Distroless](/courses/docker/choosing-a-base-image).

### WORKDIR: choose a folder inside the image

```docker
WORKDIR /app
```

This creates the folder `/app` inside the image and makes it the current folder for every instruction after it. It is like running `mkdir /app && cd /app`.

### COPY: put your files in

```docker
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
```

`COPY` copies files from your project folder into the image. `./` means "the current folder", which is `/app`.

`RUN npm ci` runs a command **while building**. `npm ci` installs exactly what the lock file says. With no dependencies it finishes almost instantly, but the step is ready for when you add some.

Why copy the package files first and the source code later? Because Docker **caches** each step. If only your code changes, Docker can reuse the saved `npm ci` result. You will learn this properly in [Layer Caching: Faster Builds by Ordering Instructions](/courses/docker/layer-caching).

### EXPOSE: document the port

```docker
EXPOSE 3000
```

This is a note for people and tools: "this app listens on port 3000". It does **not** open the port. You still publish it with `-p` when you run the container, as you learned in [Publishing Ports: Reaching Apps Inside Containers](/courses/docker/publishing-ports).

### CMD: what to run when the container starts

```docker
CMD ["node", "src/server.js"]
```

`CMD` sets the default command for the container. Everything above it runs at **build** time. `CMD` runs at **start** time, every time a container starts.

Write it in the **exec form**, a JSON list with double quotes. Then `node` runs directly and receives the stop signal from `docker stop`. You will dig into this in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint).

### The whole file

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
EXPOSE 3000
CMD ["node", "src/server.js"]
```

Eight lines, and you have a complete recipe.

## Step 3: build the image

Open a terminal in the `notes-api` folder and run:

```bash
docker build -t notes-api:1.0 .
```

- `-t notes-api:1.0` gives the image a name and tag (`-t` means tag).
- `.` is the **build context**: the folder Docker can copy files from. You will learn more in [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore).

The output looks something like this:

```text
[+] Building 8.4s (10/10) FINISHED
 => [internal] load build definition from Dockerfile               0.0s
 => [internal] load metadata for docker.io/library/node:24-alpine   1.2s
 => [internal] load .dockerignore                                  0.0s
 => [1/5] FROM docker.io/library/node:24-alpine@sha256:...         5.1s
 => [internal] load build context                                  0.0s
 => => transferring context: 1.53kB                                0.0s
 => [2/5] WORKDIR /app                                             0.1s
 => [3/5] COPY package.json package-lock.json ./                   0.0s
 => [4/5] RUN npm ci                                               1.4s
 => [5/5] COPY src ./src                                           0.0s
 => exporting to image                                             0.2s
 => => naming to docker.io/library/notes-api:1.0                   0.0s
```

Each `[n/5]` line is one step of your Dockerfile. Check that the image exists:

```bash
docker images notes-api
```

```text
REPOSITORY   TAG   IMAGE ID       CREATED          SIZE
notes-api    1.0   7c41d2e9a0b3   20 seconds ago   165MB
```

## Step 4: run and test it

Start a container from your new image:

```bash
docker run -d --name notes-api -p 3000:3000 notes-api:1.0
```

Test it with `curl` (or open the addresses in your browser):

```bash
curl http://localhost:3000/health
curl http://localhost:3000/notes
```

```text
ok
[{"id":1,"text":"Learn Docker"},{"id":2,"text":"Write a Dockerfile"}]
```

Check the logs and stop it:

```bash
docker logs notes-api
docker stop notes-api
docker logs notes-api
```

```text
notes-api listening on port 3000
SIGTERM received, shutting down
```

The second log line proves that your app received the signal and shut down cleanly, thanks to the exec form of `CMD`. Remove the container when you are done:

```bash
docker rm notes-api
```

## Step 5: change something and rebuild

Images never change once built. To change the app, you change the code and build a **new** image.

Add a third note in `src/server.js`, then build with a new tag:

```bash
docker build -t notes-api:1.1 .
```

This time the build is faster. Look for `CACHED` in the output: Docker reused the steps whose inputs did not change.

```text
 => CACHED [2/5] WORKDIR /app
 => CACHED [3/5] COPY package.json package-lock.json ./
 => CACHED [4/5] RUN npm ci
 => [5/5] COPY src ./src
```

Run the new version on a different host port to see both side by side:

```bash
docker run -d --rm --name notes-old -p 3000:3000 notes-api:1.0
docker run -d --rm --name notes-new -p 3001:3000 notes-api:1.1
curl http://localhost:3001/notes
docker stop notes-old notes-new
```

## Common mistakes

### Naming the file wrong

`dockerfile.txt` or `DockerFile` will not be found by default. Name it exactly `Dockerfile`. (You can use another name with `docker build -f`, but start simple.)

### Forgetting the dot

`docker build -t notes-api:1.0` without the `.` at the end gives an error, because Docker needs to know the build context.

### Listening on 127.0.0.1

If the app listens on `127.0.0.1` (localhost) inside the container, `curl` from your computer gets "connection reset". Inside a container, listen on `0.0.0.0`.

### Expecting the running container to update

Building a new image does not change containers that already run. Stop the old container and start a new one from the new image.

## Quick recap

- A **Dockerfile** is a recipe for an image, read from top to bottom.
- `FROM` picks the base, `WORKDIR` sets the folder, `COPY` adds files, `RUN` runs build commands.
- `EXPOSE` only documents a port. `CMD` sets what runs when a container starts.
- `docker build -t name:tag .` builds the image from the current folder.
- Change code, then rebuild with a new tag. Unchanged steps come from the **cache**.

Next, you will look closer at each instruction you used today, and meet `ADD`, in [Dockerfile Instructions: FROM, RUN, COPY, ADD and WORKDIR](/courses/docker/dockerfile-instructions).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Dockerfile for notes-api: your first complete image recipe.
# Build: docker build -t notes-api:1.0 .
# Run:   docker run -d --name notes-api -p 3000:3000 notes-api:1.0
# Test:  curl http://localhost:3000/health
#
# Start from the official Node.js 24 image on small Alpine Linux
FROM node:24-alpine
# Create /app and use it as the current folder from here on
WORKDIR /app
# Copy the package files first, so the install step can be cached
COPY package.json package-lock.json ./
# Install exactly what package-lock.json lists (runs at build time)
RUN npm ci
# Copy the source code last, because it changes most often
COPY src ./src
# Documentation only: the app listens on port 3000 (publish it with -p)
EXPOSE 3000
# Runs at start time. Exec form, so node gets the SIGTERM from docker stop
CMD ["node", "src/server.js"]
</code></pre>

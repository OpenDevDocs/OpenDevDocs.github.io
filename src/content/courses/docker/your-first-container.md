---
publishDate: 2026-10-25T14:20
title: 'Running Your First Container'
slug: your-first-container
metadescription: 'Run your first Docker containers step by step: hello-world, an nginx web server and an interactive Ubuntu shell, then list, stop and remove them.'
updateDate: 2026-10-25T14:20
author: ['bishal-biswas']
level: 1
tags: ['docker', 'containers', 'docker-run', 'beginners']
course: docker
---

## Time to run something

You have Docker installed from [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker). Now the fun part begins. In this lesson you will run three different containers, each teaching you something new:

1. **hello-world**: a container that prints a message and exits
2. **nginx**: a web server that keeps running in the background
3. **ubuntu**: a Linux shell you can type commands into

Along the way you will learn to list, stop and remove containers. By the end you will feel comfortable starting and cleaning up containers on your own.

Open a terminal (PowerShell or Windows Terminal on Windows, Terminal on macOS or Linux) and follow along. Typing the commands yourself helps you remember them.

## Container 1: hello-world

Run this:

```bash
docker run hello-world
```

```text
Unable to find image 'hello-world:latest' locally
latest: Pulling from library/hello-world
e6590344b1a5: Pull complete
Digest: sha256:...
Status: Downloaded newer image for hello-world:latest

Hello from Docker!
This message shows that your installation appears to be working correctly.
...
```

### What just happened?

Read the output from the top:

1. **"Unable to find image locally"**: Docker looked on your computer for the `hello-world` image. It was not there.
2. **"Pulling from library/hello-world"**: Docker downloaded the image from **Docker Hub**. `library` means it is an **official image**.
3. **"Pull complete"**: each line like this is one **layer** of the image.
4. **"Hello from Docker!"**: Docker created a container from the image and started it. The program inside printed this message.

Then the program finished, so the container **stopped**. A container only runs as long as its main program runs.

Run the same command again:

```bash
docker run hello-world
```

This time there is no "Pulling" part. The image is already on your computer, so Docker uses it straight away. You learned how the client, Engine and registry work together in [How Docker Works: Engine, Client, Images and Registries](/courses/docker/docker-architecture).

## Where are my containers?

List the **running** containers:

```bash
docker ps
```

```text
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

Empty! The hello-world containers have already stopped. To see **all** containers, including stopped ones, add `-a`:

```bash
docker ps -a
```

```text
CONTAINER ID   IMAGE         COMMAND    CREATED          STATUS                      PORTS     NAMES
3f1c2a9b8d7e   hello-world   "/hello"   10 seconds ago   Exited (0) 9 seconds ago              quirky_turing
a8b7c6d5e4f3   hello-world   "/hello"   2 minutes ago    Exited (0) 2 minutes ago              nostalgic_hopper
```

Two stopped containers, one for each time you ran the command. Each `docker run` creates a **new** container.

| Column | Meaning |
|---|---|
| CONTAINER ID | A short unique ID. You can use it in other commands |
| IMAGE | The image the container was made from |
| COMMAND | The program the container ran |
| STATUS | `Up ...` if running, `Exited (code)` if stopped. Code `0` means success |
| PORTS | Published ports (none here) |
| NAMES | A name. Docker picks a random funny one if you do not give one |

### Remove stopped containers

Stopped containers still take a little disk space. Remove them with `docker rm` and the name or ID:

```bash
docker rm quirky_turing nostalgic_hopper
```

You only need to type enough of the ID to be unique, for example `docker rm 3f1`.

> **Tip:** Add `--rm` to `docker run` and Docker deletes the container automatically when it stops: `docker run --rm hello-world`. Use it for short test containers so they do not pile up.

## Container 2: an nginx web server

**nginx** (say "engine-x") is a popular web server. This time the container will keep running, because a web server waits for requests forever.

```bash
docker run -d --name web -p 8080:80 nginx:1.29-alpine
```

```text
1.29-alpine: Pulling from library/nginx
...
Status: Downloaded newer image for nginx:1.29-alpine
b41c9f2e7a6d5c3b1e0f9a8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2d1c0b9a8f
```

There are three new flags here:

| Flag | Meaning |
|---|---|
| `-d` | **Detached**: run in the background and give me my terminal back |
| `--name web` | Call the container `web` instead of a random name |
| `-p 8080:80` | **Publish** a port: traffic to port 8080 on your computer goes to port 80 inside the container |

The tag `1.29-alpine` picks nginx version 1.29 built on the small **Alpine Linux**. It is better to choose a version than to use the default `latest`.

Now open **http://localhost:8080** in your browser. You will see the "Welcome to nginx!" page. That page is served from inside the container.

You can also check from the terminal:

```bash
curl http://localhost:8080
```

```text
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
...
```

> **Note:** On Windows PowerShell, `curl` may be an alias for a different command. Use `curl.exe http://localhost:8080` or just use the browser.

Check it is running:

```bash
docker ps
```

```text
CONTAINER ID   IMAGE               COMMAND                  CREATED          STATUS          PORTS                  NAMES
b41c9f2e7a6d   nginx:1.29-alpine   "/docker-entrypoint.…"   30 seconds ago   Up 29 seconds   0.0.0.0:8080->80/tcp   web
```

The STATUS says `Up`, and PORTS shows the port mapping. Ports have a whole lesson: [Publishing Ports: Reaching Apps Inside Containers](/courses/docker/publishing-ports).

### See what the server is doing

Every time your browser loads the page, nginx writes a line to its output. Docker collects it:

```bash
docker logs web
```

```text
...
172.17.0.1 - - [25/Oct/2026:14:21:07 +0000] "GET / HTTP/1.1" 200 615 "-" "Mozilla/5.0 ..."
```

Refresh the browser and run `docker logs web` again to see a new line. You will learn more about logs in [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec).

### Stop and remove it

```bash
docker stop web
```

```text
web
```

`docker stop` asks the program inside to shut down nicely. Now refresh your browser: the page no longer loads. The container still exists, just stopped:

```bash
docker ps -a --filter name=web
```

```text
CONTAINER ID   IMAGE               COMMAND                  CREATED         STATUS                     PORTS     NAMES
b41c9f2e7a6d   nginx:1.29-alpine   "/docker-entrypoint.…"   3 minutes ago   Exited (0) 5 seconds ago             web
```

You could start it again with `docker start web`. Instead, remove it:

```bash
docker rm web
```

> **Tip:** `docker rm -f web` stops **and** removes a running container in one step. It is handy, but it does not give the app time to shut down cleanly, so prefer `stop` then `rm` for real apps.

## Container 3: an interactive Ubuntu shell

Containers do not have to be servers. You can open a shell inside one and explore, like a tiny Linux computer.

```bash
docker run -it --rm ubuntu:24.04 bash
```

| Flag | Meaning |
|---|---|
| `-i` | **Interactive**: keep the input open so you can type |
| `-t` | Give the container a **terminal** (TTY), so the shell looks normal |
| `--rm` | Delete the container when you exit |
| `bash` | The command to run inside, instead of the image's default |

Your prompt changes. You are now inside the container, as `root`:

```text
root@5e4d3c2b1a09:/#
```

Try some commands:

```bash
cat /etc/os-release | head -2
ls /
whoami
ps aux
```

```text
PRETTY_NAME="Ubuntu 24.04.3 LTS"
NAME="Ubuntu"
bin  boot  dev  etc  home  lib  ...  usr  var
root
USER   PID %CPU %MEM    VSZ   RSS TTY  STAT START   TIME COMMAND
root     1  0.0  0.0   4588  3840 pts/0 Ss  14:25   0:00 bash
root     9  0.0  0.0   7888  3968 pts/0 R+  14:25   0:00 ps aux
```

Notice that `bash` is process number 1, and only two processes exist. This is the isolation you learned about in [Containers vs Virtual Machines](/courses/docker/containers-vs-virtual-machines). If Linux commands are new to you, see [Linux for DevOps](/courses/devops/linux-for-devops).

### Changes inside a container are temporary

Create a file and exit:

```bash
echo "hello" > /tmp/test.txt
exit
```

Now start a new Ubuntu container and look for the file:

```bash
docker run -it --rm ubuntu:24.04 bash
ls /tmp
exit
```

The file is gone. Each `docker run` starts a **fresh** container from the same clean image. The old container, with your file, was deleted by `--rm`. This is a key idea: containers are **disposable**, and data you want to keep goes in a **volume**. You will learn this in [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes).

## Bonus: a one-off command

You can run a single command and exit, without an interactive shell. This prints the Node.js version, without Node.js installed on your computer:

```bash
docker run --rm node:24-alpine node --version
```

```text
v24.10.0
```

This is a great way to try tools without installing them.

## Common mistakes

### Forgetting `-d` for a server

Without `-d`, `docker run nginx:1.29-alpine` stays in the foreground and shows the logs. Your terminal looks "stuck". Press `Ctrl+C` to stop it, then run again with `-d`.

### Forgetting `-it` for a shell

`docker run ubuntu:24.04 bash` without `-it` starts bash with no input, so bash exits at once. You need `-it` to type into it.

### "Bind for 0.0.0.0:8080 failed: port is already allocated"

Another program, or another container, is already using port 8080 on your computer. Stop the other container or choose another host port, such as `-p 8081:80`.

### "The container name /web is already in use"

Names must be unique, even for stopped containers. Remove the old one with `docker rm web` first.

## Quick recap

- `docker run IMAGE` pulls the image if needed, creates a **new** container and starts it.
- A container stops when its main program stops.
- `docker ps` lists running containers; `docker ps -a` lists all of them.
- `-d` runs in the background, `--name` sets a name, `-p host:container` publishes a port.
- `-it` gives you an interactive terminal; `--rm` deletes the container when it exits.
- `docker logs`, `docker stop` and `docker rm` let you watch, stop and remove containers.
- Changes inside a container are lost when it is removed.

Next, you will get to know the commands you will use every day in [The Docker CLI: Commands You Will Use Every Day](/courses/docker/docker-cli-basics).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Your first containers: every command from this lesson, in order.
#
# 1. hello-world: pull the image, print a message, exit
docker run hello-world
# Run it again: no pull this time, the image is cached locally
docker run --rm hello-world
#
# 2. List containers
docker ps          # running only
docker ps -a       # all, including stopped (Exited) ones
# Remove a stopped container by name or short ID
docker rm quirky_turing
#
# 3. nginx web server in the background on http://localhost:8080
docker run -d --name web -p 8080:80 nginx:1.29-alpine
curl http://localhost:8080
docker ps
# Read what the server printed (one line per request)
docker logs web
# Stop it nicely, then remove it
docker stop web
docker rm web
#
# 4. Interactive Ubuntu shell, deleted when you type exit
docker run -it --rm ubuntu:24.04 bash
#   inside: cat /etc/os-release, ls /, whoami, ps aux, exit
#
# 5. One-off command: use Node.js without installing it
docker run --rm node:24-alpine node --version
</code></pre>

---
publishDate: 2026-10-25T14:50
title: 'Reading Logs and Running Commands Inside Containers'
slug: logs-and-exec
metadescription: 'Learn to read container output with docker logs, follow and filter it, open a shell with docker exec, run one-off commands and copy files with docker cp.'
updateDate: 2026-10-25T14:50
author: ['bishal-biswas']
level: 1
tags: ['docker', 'logs', 'debugging', 'cli']
course: docker
---

## Seeing what happens inside a container

A container running in the background (with `-d`) is quiet. You do not see its output in your terminal. So how do you know if it is working? How do you find out why it crashed?

Docker gives you two main tools:

- **`docker logs`** shows what the program inside the container has printed.
- **`docker exec`** runs a new command inside a running container, for example a shell, so you can look around.

With these two commands you can answer most "what is going on in there?" questions. In this lesson you will also meet `docker cp` for copying files, and `docker attach`.

Start a container to practice with:

```bash
docker run -d --name web -p 8080:80 nginx:1.29-alpine
```

## Where logs come from

Every program has two standard output streams:

- **stdout** (standard output) for normal messages
- **stderr** (standard error) for error messages

When you run a program in your terminal, both streams go to your screen. In a container, Docker **captures** both streams and saves them. `docker logs` shows you what was saved.

```text
 program in container
   |  stdout ---+
   |  stderr ---+--> Docker saves the lines --> docker logs
```

This is why containerized apps should print their logs to stdout and stderr, and not write log files inside the container. The official nginx image does exactly this: it links its log files to stdout and stderr.

> **Note:** Docker can send logs to other places too, such as a central log system. These are called logging drivers. You will learn about them, and how to stop logs filling your disk, in [Logging Drivers and Log Rotation](/courses/docker/logging-drivers).

## docker logs

Visit `http://localhost:8080` once or twice, then read the logs:

```bash
docker logs web
```

```text
/docker-entrypoint.sh: Configuration complete; ready for start up
2026/10/25 14:50:12 [notice] 1#1: nginx/1.29.0
2026/10/25 14:50:12 [notice] 1#1: start worker processes
172.17.0.1 - - [25/Oct/2026:14:50:30 +0000] "GET / HTTP/1.1" 200 615 "-" "curl/8.5.0" "-"
```

The last line is a request log. The `172.17.0.1` address is your computer as seen from inside the container.

### Useful flags

| Flag | What it does |
|---|---|
| `-f` or `--follow` | Keep watching and print new lines as they arrive. Press Ctrl+C to stop watching. |
| `--tail 20` | Show only the last 20 lines |
| `-t` or `--timestamps` | Add the time Docker received each line |
| `--since 10m` | Only lines from the last 10 minutes (also `2h`, or a date like `2026-10-25T14:00:00`) |
| `--until 5m` | Only lines older than 5 minutes |

You can combine them. This is the command you will use most:

```bash
# Last 20 lines, then keep following new ones
docker logs -f --tail 20 web
```

Leave it running, open `http://localhost:8080` in your browser, and watch the new request lines appear. Press **Ctrl+C** to stop following. This does not stop the container. It only stops watching.

### Searching logs

`docker logs` prints both stdout and stderr. To search them with `grep`, join the two streams first with `2>&1`:

```bash
docker logs web 2>&1 | grep "GET /"
```

### Logs from a stopped container

Logs stay with the container until you remove it. This is very helpful when a container crashes:

```bash
docker run --name broken alpine:3.22 sh -c 'echo starting; echo "something went wrong" >&2; exit 1'
docker ps -a --filter name=broken
docker logs broken
```

```text
starting
something went wrong
```

Once you run `docker rm broken`, its logs are gone too. You will use this a lot in [Debugging Containers That Will Not Start](/courses/docker/debugging-containers).

## docker exec: running commands inside

`docker exec` starts a **new** process inside a container that is already running. The main program keeps running. You are just adding a visitor.

The format is:

```text
docker exec [OPTIONS] CONTAINER COMMAND [ARGS...]
```

### A one-off command

```bash
docker exec web nginx -v
docker exec web ls /usr/share/nginx/html
docker exec web cat /etc/os-release
```

```text
nginx version: nginx/1.29.0
50x.html
index.html
NAME="Alpine Linux"
...
```

Each command runs, prints its output, and ends.

### An interactive shell

To look around freely, open a shell. You need `-i` (keep input open) and `-t` (give it a terminal), usually written together as `-it`:

```bash
docker exec -it web sh
```

```text
/ # whoami
root
/ # ps
PID   USER     TIME  COMMAND
    1 root      0:00 nginx: master process nginx -g daemon off;
   30 nginx     0:00 nginx: worker process
   45 root      0:00 sh
   51 root      0:00 ps
/ # exit
```

Look at the process list. **PID 1** is the main program, nginx. Your shell is just another process. When you type `exit`, only the shell ends. The container keeps running.

> **Tip:** Alpine based images have `sh` but not `bash`. Debian and Ubuntu based images usually have `bash`. If `bash` gives "executable file not found", try `sh`. Some very small images have no shell at all. You will see those in [Choosing a Base Image](/courses/docker/choosing-a-base-image).

### Useful exec flags

| Flag | Example | What it does |
|---|---|---|
| `-it` | `docker exec -it web sh` | Interactive shell |
| `-u` | `docker exec -u root web id` | Run as another user |
| `-w` | `docker exec -w /etc/nginx web ls` | Start in this folder |
| `-e` | `docker exec -e DEBUG=1 web env` | Add an environment variable for this command only |
| `-d` | `docker exec -d web touch /tmp/flag` | Run in the background |

The `-u` flag matters once your images run as a normal user, as you will do in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root). If you need to install a debugging tool, `-u root` gives you the permissions.

### Exec with notes-api

With notes-api running (as in the [Environment Variables](/courses/docker/environment-variables) lesson), you can test the API from **inside** its own container:

```bash
docker exec notes wget -qO- http://127.0.0.1:3000/health
```

```text
ok
```

If this works but `curl http://localhost:3000/health` from your computer does not, the app is fine and the problem is the port publishing. That simple test saves a lot of time.

### Exec only works on running containers

```bash
docker exec broken ls
```

```text
Error response from daemon: container ... is not running
```

For a stopped container, read its logs instead, or start a new container from the same image with a shell: `docker run --rm -it alpine:3.22 sh`.

## docker cp: copying files in and out

Sometimes you want a file out of a container, such as a config file, or you want to put one in. `docker cp` works on running and stopped containers:

```bash
# Container to your computer
docker cp web:/etc/nginx/nginx.conf ./nginx.conf
#
# Your computer to the container
echo "<h1>Hello</h1>" > index.html
docker cp ./index.html web:/usr/share/nginx/html/index.html
curl http://localhost:8080
```

```text
<h1>Hello</h1>
```

> **Warning:** Changes you make with `docker exec` or `docker cp` live only in that one container. Remove the container and they are gone. For lasting changes, put them in a Dockerfile or use a volume or bind mount. The reason is explained in [Why Container Data Disappears](/courses/docker/container-storage-basics).

## docker attach (and why to be careful)

`docker attach web` connects your terminal to the **main** process (PID 1) of the container. You see its live output, a bit like `docker logs -f`.

The danger: if you press **Ctrl+C** while attached, the signal goes to the main process, and that can **stop the container**. For watching output, `docker logs -f` is safer. For running commands, use `docker exec`.

## Common mistakes

### Thinking Ctrl+C on docker logs -f stops the container

It does not. It only stops following the log. The container keeps running.

### Forgetting -it for a shell

`docker exec web sh` without `-it` starts a shell with no input, which exits immediately. Always use `-it` for interactive programs.

### Apps that log to files

If an app writes logs only to a file like `/app/logs/app.log`, `docker logs` shows nothing. Configure the app to log to stdout and stderr instead.

### Fixing production with exec

It is tempting to edit a file inside a running container to fix a bug. The fix disappears when the container is replaced. Use exec to **investigate**, then fix the image.

## Quick recap

- Docker saves everything a container prints to **stdout** and **stderr**. Read it with `docker logs`.
- `docker logs -f --tail 20 name` shows recent lines and follows new ones.
- Logs survive a stopped container, but not `docker rm`.
- `docker exec name command` runs a command in a running container. `docker exec -it name sh` opens a shell.
- `docker cp` copies files between your computer and a container.
- Prefer `docker logs -f` over `docker attach`.

Next, you will dig into every detail of a container in [Inspecting Containers: inspect, stats, top and diff](/courses/docker/inspecting-containers).

<code id="code-content" class="language-bash">
# Logs and exec: cheat sheet
docker run -d --name web -p 8080:80 nginx:1.29-alpine
#
# ---------- docker logs: what the container printed (stdout + stderr) ----------
docker logs web                      # everything so far
docker logs --tail 20 web            # only the last 20 lines
docker logs -f --tail 20 web         # last 20, then follow (Ctrl+C stops watching, not the container)
docker logs -t --since 10m web       # last 10 minutes, with timestamps
docker logs web 2&gt;&amp;1 | grep "GET /"  # join stderr into stdout, then search
#
# Logs stay after a crash, until the container is removed
docker run --name broken alpine:3.22 sh -c 'echo starting; echo "something went wrong" &gt;&amp;2; exit 1'
docker logs broken
docker rm broken
#
# ---------- docker exec: run a new command in a RUNNING container ----------
docker exec web nginx -v                       # one-off command
docker exec -it web sh                         # interactive shell (type exit to leave)
docker exec -u root web id                     # as another user
docker exec -w /etc/nginx web ls               # in another folder
docker exec -e DEBUG=1 web env                 # with an extra variable
#
# Test an app from inside its own container (rules out port problems)
docker exec web wget -qO- http://127.0.0.1:80/
#
# ---------- docker cp: copy files in and out ----------
docker cp web:/etc/nginx/nginx.conf ./nginx.conf
docker cp ./index.html web:/usr/share/nginx/html/index.html
#
# Clean up
docker rm -f web
</code></pre>

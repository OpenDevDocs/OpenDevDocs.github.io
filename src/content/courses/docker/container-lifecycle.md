---
publishDate: 2026-10-25T14:35
title: 'The Container Lifecycle: Create, Start, Stop and Remove'
slug: container-lifecycle
metadescription: 'Follow a container through its life: created, running, paused, exited and removed. Learn stop vs kill, signals, exit codes and graceful shutdown.'
updateDate: 2026-10-25T14:35
author: ['bishal-biswas']
level: 1
tags: ['docker', 'containers', 'lifecycle', 'signals']
course: docker
---

## A container has a life story

A container is not just "on" or "off". It is born, it runs, it can pause, it stops, and finally it is removed. Each step has its own command, and knowing them helps you understand what Docker is doing and why a container is in a certain state.

In this lesson you will learn:

- the **states** a container can be in
- the commands that move a container from one state to another
- the difference between `docker run`, `create` and `start`
- the difference between `stop` and `kill`, and what **signals** are
- how to read **exit codes**
- how an app should shut down cleanly when Docker stops it

You used `run`, `stop` and `rm` in [Running Your First Container](/courses/docker/your-first-container). Now you will see the full picture.

## The states of a container

```text
               docker create
                    |
                    v
              +-----------+   docker start    +-----------+
              |  created  | ----------------> |  running  | <---+
              +-----------+                   +-----------+     |
                                       pause  |   ^    |        | docker start
                                              v   |    |        | docker restart
                                       +-----------+   |        |
                                       |  paused   |   | stop / kill / app exits
                                       +-----------+   |        |
                                        unpause        v        |
                                              +-----------+     |
                                              |  exited   | ----+
                                              +-----------+
                                                    |
                                                docker rm
                                                    v
                                                (removed)
```

| State | Meaning |
|---|---|
| **created** | The container exists (file system, settings) but its program has never started |
| **running** | Its main program is running |
| **paused** | Its processes are frozen in memory. They use no CPU but keep their memory |
| **restarting** | Docker is restarting it because of a restart policy |
| **exited** | Its main program has stopped. The container and its files still exist |
| **dead** | Docker tried to remove it and failed. Rare |

A good analogy is a **laptop**. Created is a new laptop still in the box. Running is switched on. Paused is sleep mode. Exited is shut down, but your files are still on the disk. Removed is when you throw the laptop away, files and all.

## Create, start, run

`docker run` is really two steps in one: **create** then **start**. You can do them separately:

```bash
docker create --name web -p 8080:80 nginx:1.29-alpine
docker ps -a --filter name=web
```

```text
CONTAINER ID   IMAGE               COMMAND                  CREATED         STATUS    PORTS     NAMES
5d6e7f8a9b0c   nginx:1.29-alpine   "/docker-entrypoint.…"   3 seconds ago   Created             web
```

The STATUS is `Created`. Nothing is running yet. Now start it:

```bash
docker start web
docker ps --filter name=web
```

```text
CONTAINER ID   IMAGE               COMMAND                  CREATED          STATUS         PORTS                  NAMES
5d6e7f8a9b0c   nginx:1.29-alpine   "/docker-entrypoint.…"   20 seconds ago   Up 2 seconds   0.0.0.0:8080->80/tcp   web
```

| Command | What it does |
|---|---|
| `docker create` | Make a new container, do not start it |
| `docker start` | Start an existing container (created or exited) |
| `docker run` | `create` + `start` in one step, always a **new** container |

> **Note:** Settings like ports, environment variables and volumes are fixed when the container is **created**. `docker start` cannot change them. To change a setting, remove the container and create a new one. This is normal and fast in Docker.

## Pause and unpause

```bash
docker pause web
docker ps --filter name=web --format '{{.Names}}: {{.Status}}'
```

```text
web: Up 1 minute (Paused)
```

While paused, nginx cannot answer requests. Try `curl http://localhost:8080` and it will hang. Unfreeze it:

```bash
docker unpause web
```

Pause uses the **cgroup freezer**, a Linux kernel feature you met in [Containers vs Virtual Machines](/courses/docker/containers-vs-virtual-machines). You will rarely need it, but it is useful to free CPU for a moment without losing the state in memory.

## Stopping: stop vs kill

There are two ways to stop a running container, and they are very different.

### What is a signal?

A **signal** is a short message the operating system sends to a process. Two matter here:

- **SIGTERM** ("terminate"): a polite request. "Please finish what you are doing and exit." The program can catch it and clean up first.
- **SIGKILL** ("kill"): not a request. The kernel ends the process at once. The program cannot catch it or clean up.

### docker stop: polite, then forceful

```bash
docker stop web
```

`docker stop` does this:

1. sends **SIGTERM** to the main process (PID 1) in the container
2. waits up to **10 seconds** for it to exit
3. if it is still running, sends **SIGKILL**

You can change the waiting time with `-t` (or `--timeout`):

```bash
docker stop -t 30 web    # wait up to 30 seconds before forcing
```

### docker kill: forceful right away

```bash
docker kill web
```

`docker kill` sends **SIGKILL** by default. No waiting, no cleanup. Use it only when a container is stuck and will not stop. You can also send a different signal with `-s`:

```bash
docker kill -s SIGHUP web   # nginx reloads its config on SIGHUP
```

| | `docker stop` | `docker kill` |
|---|---|---|
| First signal | SIGTERM | SIGKILL (by default) |
| Waits | Yes, 10 seconds by default | No |
| App can clean up | Yes | No |
| Use it | Normally | When a container is stuck |

### Restart

`docker restart web` is a `stop` followed by a `start`. It uses the same 10-second timeout.

## Exit codes: why did it stop?

When the main program ends, it returns a number called an **exit code**. Docker shows it in `docker ps -a`:

```bash
docker run --name ok alpine:3.22 true
docker run --name fail alpine:3.22 false
docker ps -a --filter name=ok --filter name=fail --format '{{.Names}}: {{.Status}}'
```

```text
fail: Exited (1) 3 seconds ago
ok: Exited (0) 5 seconds ago
```

| Exit code | Usual meaning |
|---|---|
| `0` | Success, the program finished normally |
| `1` | A general error in the app |
| `125` | Docker itself failed to run the container (for example, a bad flag) |
| `126` | The command was found but could not be executed |
| `127` | The command was not found inside the image |
| `137` | Killed with SIGKILL (128 + 9). Often `docker kill`, a stop timeout, or out of memory |
| `143` | Stopped by SIGTERM (128 + 15). A normal `docker stop` of an app that did not handle it itself |

You can also wait for a container to finish and print its exit code with `docker wait`:

```bash
docker run -d --name job alpine:3.22 sh -c 'sleep 3; exit 3'
docker wait job
```

```text
3
```

> **Tip:** Exit code `137` together with `"OOMKilled": true` in `docker inspect` means the container used more memory than its limit. You will learn to check this in [Inspecting Containers: inspect, stats, top and diff](/courses/docker/inspecting-containers).

## Graceful shutdown: making stop fast and safe

When you run `docker stop` on a well-written app, it should:

1. stop accepting new requests
2. finish the requests it is already handling
3. close database connections
4. exit with code `0`

This is called a **graceful shutdown**. Here is how the course's **notes-api** does it in `src/server.js`:

```javascript
import http from 'node:http';

const port = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  if (req.url === '/health') return res.end('ok');
  if (req.url === '/notes') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify([{ id: 1, text: 'Learn Docker' }]));
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(port, '0.0.0.0', () => console.log(`notes-api listening on port ${port}`));

// docker stop sends SIGTERM: stop taking new requests, finish open ones, then exit
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(() => process.exit(0));
});
```

Try it with a bind mount (you will learn bind mounts properly in [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts)). From the project folder:

```bash
docker run -d --name notes -p 3000:3000 -v "$PWD:/app" -w /app node:24-alpine node src/server.js
docker stop notes
docker logs notes
docker ps -a --filter name=notes --format '{{.Status}}'
```

```text
notes-api listening on port 3000
SIGTERM received, shutting down
Exited (0) 2 seconds ago
```

It stopped in well under a second with exit code `0`. An app that ignores SIGTERM would make `docker stop` wait the full 10 seconds and then get killed with code `137`.

> **Warning:** Signals only reach your app if it is **PID 1** or the process that receives them. In a Dockerfile, write `CMD ["node", "src/server.js"]` (the **exec form**, a JSON list). The **shell form**, `CMD node src/server.js`, starts a shell first, which may not pass SIGTERM on. You will learn why in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint). For more on graceful shutdown in Node.js, see [Graceful Shutdown](/courses/nodejs/graceful-shutdown).

## Removing containers

An exited container still exists. It keeps its writable layer, its logs and its settings. Remove it when you no longer need it:

```bash
docker rm notes                  # remove a stopped container
docker rm -f web                 # stop (with SIGKILL) and remove a running one
docker container prune           # remove ALL stopped containers (asks first)
```

```text
WARNING! This will remove all stopped containers.
Are you sure you want to continue? [y/N] y
Deleted Containers:
...
```

Remember: removing a container deletes everything written inside it. Only data in **volumes** survives. More cleanup commands are in [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker).

> **Tip:** `docker run --rm` removes the container automatically when it exits, so you skip the `rm` step for short-lived containers.

## Watching lifecycle events

Docker records every state change as an **event**. Open a second terminal and run:

```bash
docker events --filter type=container
```

Then, in your first terminal, run `docker run --rm alpine:3.22 echo hi`. The second terminal shows each step:

```text
2026-10-25T14:40:01 container create 1a2b3c... (image=alpine:3.22, name=happy_euler)
2026-10-25T14:40:01 container attach 1a2b3c... (image=alpine:3.22, name=happy_euler)
2026-10-25T14:40:01 container start 1a2b3c... (image=alpine:3.22, name=happy_euler)
2026-10-25T14:40:01 container die 1a2b3c... (exitCode=0, image=alpine:3.22, name=happy_euler)
2026-10-25T14:40:01 container destroy 1a2b3c... (image=alpine:3.22, name=happy_euler)
```

Here you can see create, start, die (the program exited) and destroy (removed by `--rm`). Press `Ctrl+C` to stop watching.

## Common mistakes

### Using `docker run` when you mean `docker start`

Each `docker run` makes a brand new container. If you want yesterday's container with its data, use `docker start name`.

### Always using `docker rm -f` or `docker kill`

They skip graceful shutdown. Databases may need recovery on the next start, and in-flight requests fail. Use `docker stop` first.

### Thinking "Exited" means "deleted"

An exited container is still there, using disk space, until you `docker rm` it. `docker ps` hides it, so use `docker ps -a`.

### Containers that take exactly 10 seconds to stop

This is a sign the app does not handle SIGTERM, or the shell form of `CMD` is hiding the signal. Fix the app or the Dockerfile instead of lowering the timeout.

## Quick recap

- States: **created**, **running**, **paused**, **restarting**, **exited**, **dead**, then removed.
- `docker run` = `docker create` + `docker start`, and always makes a new container.
- `docker stop` sends **SIGTERM**, waits 10 seconds (`-t` to change), then sends **SIGKILL**.
- `docker kill` sends SIGKILL right away; use it only for stuck containers.
- Exit code `0` is success, `137` means killed, `143` means terminated by SIGTERM.
- Apps should handle SIGTERM and shut down cleanly; use the exec form of `CMD`.
- `docker rm`, `docker rm -f` and `docker container prune` remove containers; data outside volumes is lost.

Next, you will learn how to reach apps inside containers from your browser and other machines in [Publishing Ports: Reaching Apps Inside Containers](/courses/docker/publishing-ports).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# The container lifecycle: every state change, step by step.
#
# ---------- created -&gt; running ----------
docker create --name web -p 8080:80 nginx:1.29-alpine   # state: Created
docker start web                                        # state: Up (running)
# docker run does both steps at once and always makes a NEW container
#
# ---------- running -&gt; paused -&gt; running ----------
docker pause web                                        # state: Up (Paused)
docker unpause web
#
# ---------- running -&gt; exited ----------
docker stop web             # SIGTERM, wait 10 s, then SIGKILL
docker start web
docker stop -t 30 web       # wait up to 30 s before forcing
docker start web
docker kill web             # SIGKILL now, no cleanup (exit code 137)
docker start web
docker kill -s SIGHUP web   # send another signal (nginx reloads config)
docker restart web          # stop + start
#
# ---------- exit codes ----------
docker run --name ok alpine:3.22 true                    # Exited (0)
docker run --name fail alpine:3.22 false                 # Exited (1)
docker ps -a --format '{{.Names}}: {{.Status}}'
docker run -d --name job alpine:3.22 sh -c 'sleep 3; exit 3'
docker wait job                                          # prints 3
#
# ---------- graceful shutdown of notes-api ----------
docker run -d --name notes -p 3000:3000 -v "$PWD:/app" -w /app node:24-alpine node src/server.js
docker stop notes                                        # app logs "SIGTERM received"
docker logs notes
#
# ---------- watch events in a second terminal ----------
docker events --filter type=container
#
# ---------- exited -&gt; removed ----------
docker rm ok fail job notes          # remove stopped containers
docker rm -f web                     # stop and remove a running one
docker container prune               # remove ALL stopped containers (asks first)
</code></pre>

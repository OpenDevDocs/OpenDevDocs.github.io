---
publishDate: 2026-10-25T15:00
title: 'Restart Policies and Resource Limits'
slug: restart-policies-and-resource-limits
metadescription: 'Learn how Docker restart policies bring crashed containers back, and how to limit memory, CPU and processes so one container cannot slow down the whole machine.'
updateDate: 2026-10-25T15:00
author: ['bishal-biswas']
level: 2
tags: ['docker', 'production', 'resources', 'reliability']
course: docker
---

## Two problems on a real server

When you run containers on a real server, two things will happen sooner or later:

1. **An app crashes.** Maybe a bug, maybe a lost database connection. Without help, the container just stays stopped until someone notices.
2. **An app uses too much.** A memory leak or a busy loop eats all the memory or CPU, and every other container on the machine becomes slow or crashes too.

Docker has simple answers for both:

- **Restart policies** tell Docker to start a container again when it stops.
- **Resource limits** put a ceiling on how much memory, CPU and processes a container may use.

In this lesson you will set both, test them, and change them on running containers.

## Restart policies

A **restart policy** is a rule Docker follows when a container's main process exits. You set it with `--restart` on `docker run`.

| Policy | What Docker does |
|---|---|
| `no` | Never restart. This is the default. |
| `on-failure` | Restart only if the exit code is **not** 0 (the app crashed). |
| `on-failure:5` | Same, but give up after 5 restart attempts. |
| `always` | Always restart, whatever the exit code. Also starts it again when the Docker daemon starts. |
| `unless-stopped` | Like `always`, but if **you** stopped it, it stays stopped, even after the daemon restarts. |

> **Note:** The Docker **daemon** is the background service that runs your containers, as you learned in [How Docker Works](/courses/docker/docker-architecture). It restarts when the server reboots or when Docker is updated.

### Watching on-failure in action

This container prints a line and then exits with code 1, which counts as a failure:

```bash
docker run -d --name flaky --restart on-failure:3 \
  alpine:3.22 sh -c 'echo "started at $(date +%T)"; sleep 2; exit 1'
```

Wait about half a minute, then check:

```bash
docker logs flaky
docker inspect --format 'restarts={{.RestartCount}} status={{.State.Status}}' flaky
```

```text
started at 15:00:01
started at 15:00:03
started at 15:00:06
started at 15:00:10
restarts=3 status=exited
```

Docker started it once, then restarted it 3 times, then gave up. Notice the gaps grow longer each time. Docker waits a little before each restart, and doubles the wait every time (starting from 100 milliseconds), so a broken app does not restart thousands of times per second. The wait goes back to normal once a container has run for at least 10 seconds.

If the app exits with code 0, `on-failure` does **not** restart it, because 0 means "finished fine".

### always vs unless-stopped

Both keep a container running through crashes and reboots. The difference only shows when you stop a container by hand:

```text
                             always         unless-stopped
 app crashes                 restarted      restarted
 server reboots              started        started
 you run docker stop,        started        stays stopped
 then the server reboots     again!
```

For most long-running services, such as a web app or a database, **`unless-stopped`** is the best choice. It does what you expect: it keeps running until you say stop.

```bash
docker run -d --name web --restart unless-stopped -p 8080:80 nginx:1.29-alpine
```

> **Tip:** A restart policy never fights you. If you run `docker stop web`, Docker does not restart it straight away, even with `always`. The policies only differ in what happens at the next daemon start.

### Which policy to choose?

| Kind of container | Good policy |
|---|---|
| Web app, API, database on a server | `unless-stopped` |
| A job that should retry if it fails, but end when it succeeds | `on-failure:5` |
| Something you are testing on your laptop | `no` (the default) |
| A one-off command with `--rm` | `no` |

When you move to Docker Compose, you set the same values with a `restart:` line, as you will see in [Anatomy of a compose.yaml File](/courses/docker/compose-file-anatomy).

### What a restart policy cannot do

A restart policy only reacts when the main process **exits**. If your app is still running but stuck (for example it no longer answers requests), Docker does not know anything is wrong. To detect that, you need a **health check**, which you will add in [Health Checks: Telling Docker Your App Is Working](/courses/docker/healthchecks).

## Resource limits

By default a container has **no limits**. It can use all the memory and all the CPU cores of the machine. That is fine for one container on your laptop, but risky on a shared server.

### Memory: --memory

```bash
docker run -d --name web-small --memory 128m nginx:1.29-alpine
docker stats --no-stream web-small
```

```text
CONTAINER ID   NAME        CPU %   MEM USAGE / LIMIT   MEM %   NET I/O   BLOCK I/O   PIDS
c3d4e5f6a7b8   web-small   0.00%   8.9MiB / 128MiB     6.95%   796B / 0B 0B / 0B     9
```

The limit column now shows `128MiB` instead of the whole machine. You can use units `b`, `k`, `m` and `g`, for example `512m` or `2g`.

What happens if a container tries to use more? The Linux kernel **kills** the process. This is called an **OOM kill** (out of memory). Let us force one:

```bash
# tail keeps reading /dev/zero into memory until the 50 MB limit is hit
docker run --name hungry --memory 50m alpine:3.22 \
  sh -c 'tail /dev/zero'
docker inspect --format 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' hungry
```

```text
exit=137 oom=true
```

Exit code 137 together with `OOMKilled` true is the sign of a memory limit being hit. You saw how to read these in [Inspecting Containers](/courses/docker/inspecting-containers). Combine a memory limit with a restart policy, and Docker will start the container again after an OOM kill.

> **Note:** Docker can also use **swap** (disk space used as slow extra memory). Setting `--memory-swap` to the **same** value as `--memory`, for example `--memory 256m --memory-swap 256m`, means "no extra swap at all". This gives more predictable behavior.

### Memory for Node.js apps

Node.js decides how big its memory heap can be based on the memory it can see. Recent Node versions respect the container limit, but it is good to leave room for things outside the heap. A common pattern for notes-api:

```bash
docker run -d --name notes --restart unless-stopped \
  --memory 256m -e NODE_OPTIONS="--max-old-space-size=192" \
  -p 3000:3000 -v "$PWD:/app" -w /app node:24-alpine node src/server.js
```

This caps the JavaScript heap at 192 MB inside a 256 MB container, so Node throws a clear error before the kernel kills it.

### CPU: --cpus

`--cpus` sets how many CPU cores' worth of time a container may use:

```bash
docker run -d --name busy --cpus 0.5 alpine:3.22 sh -c 'while true; do :; done'
docker stats --no-stream busy
```

```text
NAME   CPU %    MEM USAGE / LIMIT
busy   50.12%   400KiB / 7.6GiB
```

The loop tries to use 100% of a core, but Docker holds it to about 50%. `--cpus 2` would allow up to two full cores.

Unlike memory, hitting the CPU limit does **not** kill anything. The container just runs slower. This makes CPU limits safe to use.

> **Tip:** If you want a container to run only on certain cores, `--cpuset-cpus "0,1"` pins it to cores 0 and 1. Most people never need this.

### Processes: --pids-limit

A bug, or an attack called a **fork bomb**, can create thousands of processes and freeze a machine. Limit the number of processes:

```bash
docker run -d --name limited --pids-limit 100 nginx:1.29-alpine
```

The `PIDS` column in `docker stats` shows how many are in use.

### Summary of limit flags

| Flag | Example | What happens at the limit |
|---|---|---|
| `--memory` / `-m` | `--memory 256m` | The process is killed (exit 137, OOMKilled) |
| `--memory-swap` | `--memory-swap 256m` | Same as `--memory` means no swap |
| `--cpus` | `--cpus 1.5` | The container is slowed down, never killed |
| `--pids-limit` | `--pids-limit 200` | New processes cannot be created |

## Changing settings on a running container

Unlike ports and environment variables, restart policies and limits **can** be changed without recreating the container. Use `docker update`:

```bash
docker update --restart unless-stopped flaky
docker update --memory 512m --memory-swap 512m --cpus 1 web-small
docker inspect --format 'mem={{.HostConfig.Memory}} cpus={{.HostConfig.NanoCpus}}' web-small
```

```text
mem=536870912 cpus=1000000000
```

The numbers are in bytes and in billionths of a CPU, so 536870912 is 512 MB and 1000000000 is one CPU.

> **Warning:** Still write the final settings in your run command, script or `compose.yaml`. If the container is recreated, settings changed with `docker update` are lost.

## Docker Desktop has its own limit

On Windows and macOS, all containers run inside one small Linux virtual machine. That machine has its own memory and CPU limits, which you can change in Docker Desktop under **Settings, Resources** (on Windows with WSL 2, through the `.wslconfig` file). A container can never use more than this virtual machine has. You learned about this setup in [Installing Docker](/courses/docker/installing-docker).

## Common mistakes

### Using always for a job that should finish

A backup script that exits with 0 will be started again and again with `--restart always`. Use `on-failure` for jobs.

### Setting memory too low

A limit below what the app really needs causes constant OOM kills and restarts. Watch `docker stats` under normal load first, then set the limit with some room to spare, for example 1.5 times normal use.

### Thinking restart fixes a stuck app

A frozen app that has not exited is not restarted. Add a health check, and later an orchestrator such as Kubernetes (covered in [From Docker to Kubernetes](/courses/docker/docker-to-kubernetes-next-steps)) can replace unhealthy containers.

### Hiding crash loops

A container that crashes and restarts every few seconds looks "Up" most of the time. Check `RestartCount` and the logs regularly: `docker inspect --format '{{.RestartCount}}' name`.

## Quick recap

- `--restart` sets a **restart policy**: `no`, `on-failure[:max]`, `always` or `unless-stopped`.
- Use `unless-stopped` for long-running services and `on-failure` for jobs.
- Restart policies react only to exits, not to a stuck app. Health checks cover that.
- `--memory` sets a hard memory limit. Going over it gives an **OOM kill** (exit 137).
- `--cpus` slows a container down instead of killing it. `--pids-limit` caps processes.
- `docker update` changes policies and limits on a running container.

Next, you will free up disk space safely in [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker).

<code id="code-content" class="language-bash">
# Restart policies and resource limits: cheat sheet
#
# ---------- Restart policies: no | on-failure[:max] | always | unless-stopped ----------
# A long-running service: keep it up until YOU stop it
docker run -d --name web --restart unless-stopped -p 8080:80 nginx:1.29-alpine
#
# A job that should retry on failure, at most 3 times
docker run -d --name flaky --restart on-failure:3 alpine:3.22 sh -c 'echo "started at $(date +%T)"; sleep 2; exit 1'
docker inspect --format 'restarts={{.RestartCount}} status={{.State.Status}}' flaky
#
# ---------- Memory limits (going over = OOM kill, exit 137) ----------
docker run -d --name web-small --memory 128m nginx:1.29-alpine
docker run --name hungry --memory 50m alpine:3.22 sh -c 'tail /dev/zero'
docker inspect --format 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' hungry
#
# Same value for --memory-swap means no extra swap
docker run -d --name strict --memory 256m --memory-swap 256m nginx:1.29-alpine
#
# ---------- CPU and process limits (CPU limit slows, never kills) ----------
docker run -d --name busy --cpus 0.5 alpine:3.22 sh -c 'while true; do :; done'
docker run -d --name limited --pids-limit 100 nginx:1.29-alpine
docker stats --no-stream
#
# ---------- A sensible notes-api container ----------
docker run -d --name notes --restart unless-stopped --memory 256m --cpus 1 --pids-limit 200 -e NODE_OPTIONS="--max-old-space-size=192" -p 3000:3000 -v "$PWD:/app" -w /app node:24-alpine node src/server.js
#
# ---------- Change policies and limits without recreating ----------
docker update --restart unless-stopped flaky
docker update --memory 512m --memory-swap 512m --cpus 1 web-small
#
# Clean up
docker rm -f web flaky web-small hungry strict busy limited notes
</code></pre>

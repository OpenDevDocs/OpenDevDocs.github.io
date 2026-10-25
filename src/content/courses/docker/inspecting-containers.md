---
publishDate: 2026-10-25T14:55
title: 'Inspecting Containers: inspect, stats, top and diff'
slug: inspecting-containers
metadescription: 'Learn to look inside containers with docker inspect and --format, watch CPU and memory with docker stats, list processes with top and see file changes with diff.'
updateDate: 2026-10-25T14:55
author: ['bishal-biswas']
level: 1
tags: ['docker', 'debugging', 'monitoring', 'cli']
course: docker
---

## Four ways to look at a container

In the last lesson, [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec), you learned to read what a container prints and to run commands inside it. But sometimes you need different answers:

- "Which image, ports and variables does this container use?"
- "Why did it stop? What was the exit code?"
- "How much memory is it using right now?"
- "Which processes are running in it?"
- "Which files has it changed?"

Docker has one command for each question:

| Command | Answers |
|---|---|
| `docker inspect` | Every setting and the current state, as JSON |
| `docker stats` | Live CPU, memory, network and disk use |
| `docker top` | The processes running in the container |
| `docker diff` | Files added, changed or deleted since the container started |

Start two containers to practice with:

```bash
docker run -d --name web -p 8080:80 nginx:1.29-alpine
docker run -d --name db -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
```

## docker inspect: the full picture

`docker inspect` prints everything Docker knows about a container. The output is **JSON**, a common text format of names and values inside curly braces.

```bash
docker inspect web
```

```json
[
  {
    "Id": "a1b2c3d4e5f6...",
    "Created": "2026-10-25T14:55:01.123Z",
    "Path": "/docker-entrypoint.sh",
    "Args": ["nginx", "-g", "daemon off;"],
    "State": {
      "Status": "running",
      "Running": true,
      "Pid": 12345,
      "ExitCode": 0,
      "OOMKilled": false,
      "StartedAt": "2026-10-25T14:55:01.456Z"
    },
    "Name": "/web",
    "RestartCount": 0,
    "HostConfig": {
      "PortBindings": { "80/tcp": [{ "HostIp": "", "HostPort": "8080" }] },
      "RestartPolicy": { "Name": "no", "MaximumRetryCount": 0 }
    },
    "Config": {
      "Image": "nginx:1.29-alpine",
      "Env": ["PATH=/usr/local/sbin:...", "NGINX_VERSION=1.29.0"]
    },
    "NetworkSettings": { "...": "..." }
  }
]
```

The real output is a few hundred lines long. This is a shortened version. The most useful parts are:

| Section | What you find there |
|---|---|
| `State` | Is it running? Exit code, start and finish time, was it killed for using too much memory (`OOMKilled`)? |
| `Config` | The image, environment variables, command, labels |
| `HostConfig` | Ports, restart policy, memory and CPU limits, mounts |
| `Mounts` | Volumes and bind mounts |
| `NetworkSettings` | Networks and IP addresses |

> **Tip:** `docker inspect` also works on images, volumes and networks: `docker inspect nginx:1.29-alpine`, `docker volume inspect`, `docker network inspect`. For containers it works whether they are running or stopped.

### Picking one value with --format

Scrolling through hundreds of lines is slow. The `--format` flag (short form `-f`) prints only what you ask for. It uses **Go templates**: you write the path to the value inside double curly braces, starting with a dot.

```bash
docker inspect --format '{{.State.Status}}' web
```

```text
running
```

A few more useful examples:

```bash
# Which image is it running?
docker inspect --format '{{.Config.Image}}' web
#
# When did it start?
docker inspect --format '{{.State.StartedAt}}' web
#
# The restart policy (you will set these in the next lesson)
docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' web
#
# A whole section as JSON, on one line
docker inspect --format '{{json .HostConfig.PortBindings}}' web
```

```text
nginx:1.29-alpine
2026-10-25T14:55:01.456Z
no
{"80/tcp":[{"HostIp":"","HostPort":"8080"}]}
```

For lists, use `range` to loop over each item:

```bash
# Every environment variable on its own line
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' db
#
# The IP address on each network the container is connected to
docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' web
```

```text
172.17.0.2
```

> **Note:** If you have `jq` installed (a JSON tool), `docker inspect web | jq '.[0].State'` is another nice way to read the output.

### Why did my container stop?

This is where `inspect` shines. Make a container that fails:

```bash
docker run --name crash alpine:3.22 sh -c 'exit 3'
docker inspect --format 'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' crash
```

```text
status=exited exit=3 oom=false
```

Some exit codes you will see often:

| Exit code | Usual meaning |
|---|---|
| 0 | The program finished normally |
| 1 | A general error in the app |
| 125 | Docker itself could not run the container (for example a bad flag) |
| 126 | The command was found but could not be run |
| 127 | The command was not found |
| 137 | Killed with SIGKILL, often because of a memory limit (check `OOMKilled`) or `docker kill` |
| 143 | Stopped with SIGTERM, for example by `docker stop` |

Codes above 128 mean "killed by a signal". Subtract 128 to get the signal number: 137 is 128 + 9 (SIGKILL), 143 is 128 + 15 (SIGTERM). You will meet memory limits in [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits).

## docker stats: live resource use

`docker stats` shows a live table of how much each running container uses. It updates every second, like the Task Manager on Windows.

```bash
docker stats
```

```text
CONTAINER ID   NAME   CPU %   MEM USAGE / LIMIT     MEM %   NET I/O          BLOCK I/O        PIDS
a1b2c3d4e5f6   web    0.00%   9.1MiB / 7.6GiB       0.12%   1.2kB / 860B     0B / 12.3kB      9
b7c8d9e0f1a2   db     0.02%   38.4MiB / 7.6GiB      0.49%   1.1kB / 0B       0B / 48.1MB      6
```

Press **Ctrl+C** to quit. The columns:

- **CPU %**: how much processor time it uses. 100% means one full CPU core.
- **MEM USAGE / LIMIT**: memory used, and the most it may use. With no limit set, the limit is the whole memory of the machine (or of the Docker Desktop virtual machine).
- **NET I/O**: data received and sent over the network.
- **BLOCK I/O**: data read from and written to disk.
- **PIDS**: how many processes and threads are running.

Useful variations:

```bash
docker stats web db                 # only these containers
docker stats --no-stream            # print once and exit (good for scripts)
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

```text
NAME   CPU %   MEM USAGE / LIMIT
web    0.00%   9.1MiB / 7.6GiB
db     0.01%   38.4MiB / 7.6GiB
```

> **Note:** `docker stats` is for a quick look. For history and alerts over time, you need a real monitoring tool. See [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting) in the DevOps course.

## docker top: processes in a container

`docker top` lists the processes running in a container, without needing a shell inside it:

```bash
docker top web
```

```text
UID      PID     PPID    C   STIME   TTY   TIME       CMD
root     12345   12320   0   14:55   ?     00:00:00   nginx: master process nginx -g daemon off;
101      12401   12345   0   14:55   ?     00:00:00   nginx: worker process
101      12402   12345   0   14:55   ?     00:00:00   nginx: worker process
```

Two things to notice:

- The **PID** numbers are the process IDs **on the host**, not inside the container. Inside the container, the nginx master process is PID 1.
- The **UID** column shows which user runs each process. Here the master runs as `root` and the workers as user 101 (`nginx`). This helps when you check that your own apps do not run as root.

This is different from `docker exec web ps`, which runs `ps` inside the container. That only works if the image includes `ps`. `docker top` always works.

## docker diff: what files changed?

Every container has its own thin writable layer on top of the image. `docker diff` lists what the container has changed in that layer compared to the image:

```bash
docker exec web sh -c 'echo test > /tmp/hello.txt'
docker exec web rm /usr/share/nginx/html/50x.html
docker diff web
```

```text
C /tmp
A /tmp/hello.txt
C /usr
C /usr/share
C /usr/share/nginx
C /usr/share/nginx/html
D /usr/share/nginx/html/50x.html
C /var/cache/nginx
...
```

The letters mean:

| Letter | Meaning |
|---|---|
| `A` | Added: a new file or folder |
| `C` | Changed: an existing file or folder was modified |
| `D` | Deleted |

This is useful for finding out where an app writes its data. If you see a database writing lots of files in a folder, that folder probably needs a volume, or the data is lost when the container is removed. You will learn why in [Why Container Data Disappears: The Writable Layer](/courses/docker/container-storage-basics), and how layers work in [Images and Layers Explained](/courses/docker/images-and-layers).

## Putting it together: a quick health check routine

When something seems wrong with a container, try this order:

```bash
docker ps -a --filter name=web                     # 1. Is it running? What status?
docker logs --tail 50 web                          # 2. What did it print?
docker inspect --format '{{.State.ExitCode}} {{.State.OOMKilled}}' web   # 3. How did it stop?
docker stats --no-stream web                       # 4. Is it using too much CPU or memory?
docker top web                                     # 5. Which processes are running?
```

You will build a full troubleshooting method in [Debugging Containers That Will Not Start](/courses/docker/debugging-containers).

## Common mistakes

### Wrong capital letters in --format

The paths are case sensitive. `{{.state.status}}` fails. It must be `{{.State.Status}}`, exactly as it appears in the JSON.

### Quotes on Windows

In PowerShell, single quotes around the template work like in bash. In the old Windows Command Prompt (`cmd.exe`), use double quotes instead: `docker inspect --format "{{.State.Status}}" web`.

### Reading memory without a limit

If `MEM USAGE / LIMIT` shows the whole machine's memory as the limit, that does not mean the container uses it. It means no limit is set, so the container **could** use it all.

## Quick recap

- `docker inspect` shows every setting and the state of a container as JSON. Use `--format '{{.Path.To.Value}}'` to pick one value.
- `State.ExitCode` and `State.OOMKilled` tell you why a container stopped. 137 often means "out of memory".
- `docker stats` shows live CPU, memory, network and disk use. Add `--no-stream` for one snapshot.
- `docker top` lists processes with host PIDs and users.
- `docker diff` shows files the container added (A), changed (C) or deleted (D).

Next, you will make containers recover from crashes and stop them from using too many resources in [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits).

<code id="code-content" class="language-bash">
# Inspecting containers: cheat sheet
docker run -d --name web -p 8080:80 nginx:1.29-alpine
docker run -d --name db -e POSTGRES_PASSWORD=devpassword postgres:17-alpine
#
# ---------- docker inspect: every setting and the state, as JSON ----------
docker inspect web
docker inspect --format '{{.State.Status}}' web
docker inspect --format '{{.Config.Image}}' web
docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' web
docker inspect --format '{{json .HostConfig.PortBindings}}' web
docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' db
docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' web
#
# Why did it stop? (137 = SIGKILL, often out of memory; 143 = SIGTERM)
docker run --name crash alpine:3.22 sh -c 'exit 3'
docker inspect --format 'status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}}' crash
#
# ---------- docker stats: live CPU, memory, network, disk ----------
docker stats                          # live table, Ctrl+C to quit
docker stats --no-stream web db       # one snapshot of chosen containers
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
#
# ---------- docker top: processes (host PIDs and users) ----------
docker top web
#
# ---------- docker diff: A = added, C = changed, D = deleted ----------
docker exec web sh -c 'echo test &gt; /tmp/hello.txt'
docker diff web
#
# Clean up
docker rm -f web db crash
</code></pre>

---
publishDate: 2026-10-25T18:20
title: 'Debugging Containers That Will Not Start'
slug: debugging-containers
metadescription: 'A step by step method to find out why a Docker container exits, crashes or restarts in a loop, using logs, exit codes, inspect and a debug shell.'
updateDate: 2026-10-25T18:20
author: ['bishal-biswas']
level: 2
tags: ['docker', 'debugging', 'troubleshooting']
course: docker
---

## "It just exits"

You run a container. It starts, and one second later it is gone. Or it keeps restarting, over and over. There is no error on screen. This is one of the most common and most frustrating moments with Docker.

The good news: Docker records a lot of clues. You just need to know where to look and in what order. In this lesson you will learn a simple **five-step method**:

1. See the state and the **exit code**.
2. Read the **logs**.
3. **Inspect** the details.
4. Get a **shell** in the image and try things by hand.
5. Check the usual suspects: ports, network, permissions, architecture.

Like a doctor, you look at symptoms first, then run tests, and only then decide on the cure.

## Step 1: what state is it in?

`docker ps` only shows running containers. A container that crashed is not running, so it seems to vanish. Add `-a` to see all of them:

```bash
docker ps -a
```

```text
CONTAINER ID   IMAGE             COMMAND                  STATUS                      NAMES
8d2f4c1a9b07   notes-api:1.0.0   "docker-entrypoint.s…"   Exited (1) 5 seconds ago    notes-api
```

The important part is `Exited (1)`. The number in brackets is the **exit code**: the number a program returns when it stops. Zero means "all good". Anything else means something went wrong, and the number gives you a hint.

| Exit code | Usual meaning | Where to look next |
|---|---|---|
| `0` | The program finished normally | It had nothing to do. Check the `CMD`. |
| `1` | General error from the app | The logs, almost always |
| `125` | Docker itself could not run the container | The error printed by `docker run` |
| `126` | Command found but cannot run | Permissions on the file, or wrong format |
| `127` | Command not found | Typo in `CMD`, or the program is not in the image |
| `137` | Killed by SIGKILL (128 + 9) | Out of memory, or `docker stop` timed out |
| `139` | Segmentation fault (128 + 11) | A crash in native code, or wrong CPU type |
| `143` | Stopped by SIGTERM (128 + 15) | Normal for `docker stop`; not a bug |

> **Tip:** Codes above 128 mean "killed by a signal". Subtract 128 to get the signal number. 137 minus 128 is 9, which is SIGKILL.

### Restart loops

If the container has a restart policy, you might see this instead:

```text
STATUS
Restarting (1) 3 seconds ago
```

The container crashes, Docker restarts it, it crashes again. The exit code is still there in brackets. While you debug, it can help to stop the loop:

```bash
docker update --restart no notes-api
```

You learned about restart policies in [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits).

## Step 2: read the logs

Logs work even for **stopped** containers. This is the most useful command in this lesson:

```bash
docker logs notes-api
```

```text
node:internal/modules/cjs/loader:1228
  throw err;
  ^

Error: Cannot find module '/app/src/server.js'
```

That one line usually solves the mystery. In this case, the file is not where `CMD` says it is. Maybe the `COPY` line copied to a different folder.

If the log is long, look at the end:

```bash
docker logs --tail 50 notes-api
```

> **Note:** If `docker logs` shows **nothing**, the app crashed before printing anything, or it logs to a file instead of stdout. Move on to step 3 and 4.

With Compose, use the service name:

```bash
docker compose ps -a
docker compose logs api
```

## Step 3: inspect the details

`docker inspect` shows everything Docker knows about a container as JSON. It is a lot of text, so use `--format` to pick what you need. You met this command in [Inspecting Containers](/courses/docker/inspecting-containers).

```bash
docker inspect notes-api --format '{{json .State}}'
```

```json
{"Status":"exited","Running":false,"Restarting":false,"OOMKilled":true,"Dead":false,"Pid":0,"ExitCode":137,"Error":"","StartedAt":"2026-10-25T18:20:01Z","FinishedAt":"2026-10-25T18:20:09Z"}
```

Look at these fields:

- `ExitCode`: the same number as in `docker ps -a`.
- `OOMKilled`: `true` means the container used more memory than its limit and the kernel killed it. **OOM** means "out of memory".
- `Error`: sometimes Docker writes a reason here.

Other useful checks:

```bash
# What command does it actually run? (ENTRYPOINT + CMD)
docker inspect notes-api --format '{{json .Config.Entrypoint}} {{json .Config.Cmd}}'

# Which environment variables did it get?
docker inspect notes-api --format '{{json .Config.Env}}'

# Is the health check failing? (for containers with a HEALTHCHECK)
docker inspect notes-api --format '{{json .State.Health}}'
```

The health check output includes the last few results with their output text, which tells you exactly why Docker thinks the app is **unhealthy**. See [Health Checks](/courses/docker/healthchecks).

### Watch what happens live

`docker events` streams everything Docker does. Run it in a second terminal, then start your container in the first:

```bash
docker events --filter container=notes-api
```

```text
2026-10-25T18:20:01 container start 8d2f4c1a9b07 (image=notes-api:1.0.0, name=notes-api)
2026-10-25T18:20:09 container oom 8d2f4c1a9b07 (image=notes-api:1.0.0, name=notes-api)
2026-10-25T18:20:09 container die 8d2f4c1a9b07 (exitCode=137, image=notes-api:1.0.0, name=notes-api)
```

## Step 4: get a shell and try it by hand

When the container exits immediately, you cannot `docker exec` into it, because there is nothing running. Instead, start a **new** container from the same image, but replace the command with a shell:

```bash
docker run -it --rm --entrypoint sh notes-api:1.0.0
```

- `--entrypoint sh` replaces the image's `ENTRYPOINT`, so it starts a shell instead of your app.
- Alpine images have `sh`. Debian and Ubuntu based images also have `bash`.

Now you are inside, with the same files and settings. Look around and run the app yourself:

```bash
/app $ ls -la
/app $ ls src
/app $ env | sort
/app $ node src/server.js
```

Running it by hand shows the real error, right in front of you. You can try fixes quickly (for example setting a missing variable with `export PORT=3000`). When you find the fix, put it in the Dockerfile or compose file and rebuild. Changes inside this debug container are lost when you exit, which is fine.

> **Tip:** Some images have no shell at all, such as **distroless** images. For those, debug with a version of the image that has a shell (many distroless images have a `:debug` tag), or copy files out as shown below. Docker Desktop also has a `docker debug` command that can attach a toolbox to shell-less containers.

### Copy files out of a dead container

Even a stopped container still has its files. Copy them out to look at them:

```bash
docker cp notes-api:/app/package.json ./from-container-package.json
```

### Check the build, not just the run

Sometimes the image itself is wrong. See what each layer did:

```bash
docker history notes-api:1.0.0
```

And rebuild with full output so you can read every step:

```bash
docker build --progress=plain --no-cache -t notes-api:1.0.0 .
```

## Step 5: the usual suspects

Most "will not start" problems are one of these. Learn to recognize them.

### "port is already allocated"

```text
docker: Error response from daemon: driver failed programming external connectivity on endpoint notes-api: Bind for 0.0.0.0:3000 failed: port is already allocated.
```

Another container or program already uses port 3000 on your computer. Find it, or use a different host port such as `-p 3001:3000`:

```bash
docker ps --filter publish=3000
```

### The app starts, but you cannot reach it

The container is `Up`, but `curl` fails. The classic cause: the app listens on `127.0.0.1` inside the container. Published traffic comes from outside the container, so it never arrives. Listen on `0.0.0.0`. You learned this in [Publishing Ports](/courses/docker/publishing-ports).

```bash
docker logs notes-api
```

```text
notes-api listening on http://127.0.0.1:3000    <- the problem
```

### "exec format error"

```text
exec /usr/local/bin/docker-entrypoint.sh: exec format error
```

The image was built for a different CPU type. For example, an ARM image (built on an Apple Silicon Mac) running on an Intel server. Rebuild for the right platform, or build a multi-platform image as shown in [Multi-Platform Images with Buildx](/courses/docker/multi-platform-builds). You can check an image's platform:

```bash
docker image inspect notes-api:1.0.0 --format '{{.Os}}/{{.Architecture}}'
```

### "no such file or directory" for a script that exists

```text
exec /app/entrypoint.sh: no such file or directory
```

If the file really is there, the cause is often **Windows line endings**. A script saved on Windows ends each line with `\r\n` instead of `\n`. Linux reads the first line as `#!/bin/sh\r` and cannot find a program called `sh\r`. Fix it by saving the file with LF line endings in your editor, or tell Git to do it with a `.gitattributes` line such as `*.sh text eol=lf`.

### "permission denied"

```text
Error: EACCES: permission denied, open '/app/data/notes.json'
```

The app runs as a non-root user but tries to write to a folder owned by root. Give that folder to the right user in the Dockerfile with `COPY --chown=node:node` or `RUN chown`, or use a volume. See [Running Containers as a Non-Root User](/courses/docker/running-as-non-root).

### Cannot connect to the database

```text
Error: getaddrinfo ENOTFOUND db
Error: connect ECONNREFUSED 172.18.0.2:5432
```

- `ENOTFOUND db`: the name `db` cannot be found. The two containers are not on the same user-defined network, or the service name is spelled differently. See [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks).
- `ECONNREFUSED`: the name works, but nothing is listening yet. The database is still starting. Use `depends_on` with `condition: service_healthy`, from [Startup Order with depends_on and Health Checks](/courses/docker/compose-depends-on-and-healthchecks).

### Missing environment variable

```text
Error: DATABASE_URL is not set
```

Check what the container actually received with `docker inspect ... '{{json .Config.Env}}'`. With Compose, `docker compose config` prints the final file with every variable filled in, which shows typos in your `.env` quickly:

```bash
docker compose config
```

### Exit code 0 right away

The container did its job and finished. A container lives only as long as its main process. If `CMD` is something like `node --version`, or a script that starts the app in the background and then ends, the container stops. The main process must keep running in the **foreground**.

## A debugging checklist

```text
1. docker ps -a                       -> state and exit code
2. docker logs --tail 50 <name>       -> the error message
3. docker inspect <name> --format ... -> OOMKilled, command, env, health
4. docker run -it --rm --entrypoint sh <image>  -> try it by hand
5. ports? 0.0.0.0? network? permissions? CPU type? line endings?
```

## Common mistakes

### Guessing instead of reading the logs

Changing random lines and rebuilding wastes a lot of time. `docker logs` takes two seconds and usually names the exact problem.

### Debugging with `--rm`

If you run with `--rm`, the container is deleted as soon as it exits, and its logs are deleted with it. While debugging, leave out `--rm` so you can still read the logs.

### Fixing it inside the container

A fix you make with `docker exec` or in a debug shell is lost when the container is recreated. Always move the fix into the Dockerfile or compose file.

## Quick recap

- Use `docker ps -a` to see stopped containers and their **exit code**.
- `docker logs` works on stopped containers and usually shows the error.
- `docker inspect --format '{{json .State}}'` reveals **OOMKilled**, the exit code and health check results.
- `docker run -it --rm --entrypoint sh <image>` gives you a shell to run the app by hand.
- Know the usual suspects: port in use, `127.0.0.1` binding, wrong CPU type, Windows line endings, permissions, network names and missing variables.

Next, you will put everything on a real server in [Deploying a Compose App to a Linux Server](/courses/docker/deploying-with-docker-on-a-server).

<code id="code-content" class="language-bash">
# Debugging a container that will not start: a cheat sheet
# ---------- 1. State and exit code ----------
# -a shows stopped containers too; look for "Exited (N)"
docker ps -a
docker compose ps -a
# Stop a restart loop while you investigate
docker update --restart no notes-api
# ---------- 2. Logs (work on stopped containers) ----------
docker logs --tail 50 notes-api
docker compose logs api
# ---------- 3. Inspect ----------
# ExitCode, OOMKilled (out of memory) and Error
docker inspect notes-api --format '{{json .State}}'
# What command really runs, and with which variables
docker inspect notes-api --format '{{json .Config.Entrypoint}} {{json .Config.Cmd}}'
docker inspect notes-api --format '{{json .Config.Env}}'
# Why is the health check failing?
docker inspect notes-api --format '{{json .State.Health}}'
# Watch Docker events live (start, oom, die...)
docker events --filter container=notes-api
# The final compose file with all variables filled in
docker compose config
# ---------- 4. Get inside ----------
# A new container from the same image, with a shell instead of the app
docker run -it --rm --entrypoint sh notes-api:1.0.0
# Copy a file out of a stopped container
docker cp notes-api:/app/package.json ./from-container-package.json
# See how the image was built, and rebuild with full output
docker history notes-api:1.0.0
docker build --progress=plain --no-cache -t notes-api:1.0.0 .
# ---------- 5. Usual suspects ----------
# Who already uses host port 3000?
docker ps --filter publish=3000
# Which CPU type was the image built for? (exec format error)
docker image inspect notes-api:1.0.0 --format '{{.Os}}/{{.Architecture}}'
# Exit codes: 0 done, 1 app error, 125 docker error, 126 cannot run,
# 127 not found, 137 killed (often OOM), 139 crash, 143 stopped by SIGTERM
</code></pre>

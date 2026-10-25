---
publishDate: 2026-10-25T17:15
title: 'Docker Compose Commands: up, down, logs and exec'
slug: compose-commands
metadescription: 'Learn the everyday Docker Compose commands: up, down, ps, logs, exec, run, build, restart and config, with examples and the flags that matter.'
updateDate: 2026-10-25T17:15
author: ['bishal-biswas']
level: 1
tags: ['docker', 'docker-compose', 'cli']
course: docker
---

## Driving your Compose app

You can now read and write a Compose file, thanks to [Anatomy of a compose.yaml File](/courses/docker/compose-file-anatomy). This lesson is about the **commands** you use to run that file every day: start the app, see what is running, read logs, open a shell, run one-off tasks, rebuild and clean up.

Good news: if you know the normal Docker commands from [The Docker CLI: Commands You Will Use Every Day](/courses/docker/docker-cli-basics), you already know most of these. Compose commands look the same, but they work on **services** in your project instead of single containers, and you use service names like `api` and `db` instead of container names.

All examples use the **notes-api** project from the last lesson, with services `api`, `db` and `cache`. Run every command from the project folder, the one with `compose.yaml` in it.

## The commands at a glance

| Command | What it does |
|---|---|
| `docker compose up -d` | Create and start everything in the background |
| `docker compose down` | Stop and remove containers and networks |
| `docker compose ps` | List the project's containers |
| `docker compose logs -f` | Show and follow logs |
| `docker compose exec api sh` | Run a command in a running service |
| `docker compose run --rm api ...` | Run a one-off command in a new container |
| `docker compose build` | Build images for services with `build:` |
| `docker compose pull` | Download newer versions of images |
| `docker compose stop` / `start` / `restart` | Stop or start without removing |
| `docker compose config` | Check the file and print the final version |

Now each one in detail.

## `up`: start the app

```bash
docker compose up -d
```

`up` does everything needed to make reality match your file: it builds missing images, pulls missing images, creates the network and volumes, and creates and starts the containers.

```text
[+] Running 6/6
 ✔ Network notes-api_frontend     Created
 ✔ Network notes-api_backend      Created
 ✔ Volume "notes-api_notes-data"  Created
 ✔ Container notes-api-db-1       Healthy
 ✔ Container notes-api-cache-1    Started
 ✔ Container notes-api-api-1      Started
```

### With or without `-d`

- `docker compose up` (no `-d`) runs in the **foreground**. You see every service's logs mixed together, with colors. Press `Ctrl+C` to stop everything.
- `docker compose up -d` runs **detached** (in the background) and gives you your terminal back. This is what you will use most.

### Useful flags for `up`

```bash
docker compose up -d --build           # rebuild images first, even if they exist
docker compose up -d api               # start only "api" (and what it depends on)
docker compose up -d --force-recreate  # recreate containers even if nothing changed
docker compose up -d --remove-orphans  # remove containers for services you deleted from the file
docker compose up -d --wait            # wait until services are running or healthy, then return
```

> **Tip:** After you change your app's **code**, run `docker compose up -d --build`. Plain `up -d` will not notice code changes, because it only checks the Compose file and whether the image exists. Rebuilding by hand gets tiring, so [Local Development with Compose: Bind Mounts and Watch](/courses/docker/compose-for-local-development) shows how to make updates automatic.

### Running `up` again is safe

`up` compares what is running with what the file says. If nothing changed, nothing happens. If you change one service, only that service is recreated:

```text
[+] Running 3/3
 ✔ Container notes-api-db-1      Running
 ✔ Container notes-api-cache-1   Running
 ✔ Container notes-api-api-1     Recreated
```

## `ps`: what is running?

```bash
docker compose ps
```

```text
NAME                IMAGE                COMMAND                  SERVICE   CREATED         STATUS                   PORTS
notes-api-api-1     notes-api:dev        "docker-entrypoint.s…"   api       2 minutes ago   Up 2 minutes             0.0.0.0:3000->3000/tcp
notes-api-cache-1   redis:8-alpine       "docker-entrypoint.s…"   cache     2 minutes ago   Up 2 minutes (healthy)   6379/tcp
notes-api-db-1      postgres:17-alpine   "docker-entrypoint.s…"   db        2 minutes ago   Up 2 minutes (healthy)   5432/tcp
```

Unlike `docker ps`, it shows **only this project's** containers. Add `-a` to include stopped ones, which is useful when a service crashed:

```bash
docker compose ps -a
```

```text
NAME              ...   STATUS
notes-api-api-1   ...   Exited (1) 5 seconds ago
```

To see every Compose project on your machine, from any folder:

```bash
docker compose ls
```

```text
NAME        STATUS       CONFIG FILES
notes-api   running(3)   /home/sam/notes-api/compose.yaml
```

## `logs`: what is happening?

```bash
docker compose logs
```

This prints the logs of all services, each line starting with the service name, so you can tell them apart:

```text
db-1     | LOG:  database system is ready to accept connections
cache-1  | * Ready to accept connections tcp
api-1    | notes-api listening on port 3000
```

The flags you will use most:

```bash
docker compose logs -f              # follow: keep printing new lines (Ctrl+C to stop)
docker compose logs -f api          # only the api service
docker compose logs --tail 50 api   # only the last 50 lines
docker compose logs -t db           # add a timestamp to each line
```

> **Note:** `Ctrl+C` while following logs only stops **watching**. The containers keep running. This is different from `docker compose up` without `-d`, where `Ctrl+C` stops the app. You learned more about container logs in [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec).

## `exec`: run a command in a running service

`exec` runs a command inside a container that is **already running**. Use the service name:

```bash
docker compose exec api sh
```

```text
/app $ ls
node_modules  package-lock.json  package.json  src
/app $ exit
```

There is no `-it` needed. Compose gives you an interactive terminal by default.

Some useful examples:

```bash
# Open the PostgreSQL client in the db service
docker compose exec db psql -U notes notes

# Ask Redis if it is alive
docker compose exec cache redis-cli ping

# Check the API's environment variables
docker compose exec api env
```

```text
PONG
```

### Using `exec` in scripts: `-T`

When you pipe output into a file or run `exec` from a script or CI job, there is no terminal. Add `-T` to turn off the terminal, or the output may contain strange characters:

```bash
docker compose exec -T db pg_dump -U notes notes > notes-backup.sql
```

## `run`: one-off tasks

`run` starts a **new** container for a service, runs one command, and then stops. It uses the same image, environment, volumes and network as the service. Add `--rm` so the container is deleted afterwards:

```bash
docker compose run --rm api node --version
```

```text
v24.11.0
```

Perfect for tasks like database migrations, seed scripts or running tests:

```bash
docker compose run --rm api npm test
```

### `exec` vs `run`

| | `exec` | `run` |
|---|---|---|
| Container | Uses the **running** one | Creates a **new** one |
| Service must be running | Yes | No |
| Publishes the service's ports | Not relevant | No, unless you add `--service-ports` |
| Good for | Looking around, debugging | One-off jobs: migrations, tests, scripts |
| Clean up | Nothing to clean | Use `--rm` |

> **Warning:** Forgetting `--rm` with `run` leaves a stopped container behind every time, named something like `notes-api-api-run-3f2a1b`. `docker compose down` removes them, or you can add `--remove-orphans`.

## `build` and `pull`: update images

```bash
docker compose build            # build every service with a build: section
docker compose build api        # build just one
docker compose build --no-cache # ignore the layer cache and build from scratch
docker compose pull             # download newer versions of image: services
```

Building or pulling does **not** restart anything. Run `docker compose up -d` afterwards so containers use the new images.

A common update routine on a server:

```bash
docker compose pull
docker compose up -d
```

## `stop`, `start` and `restart`

These **keep** the containers. Nothing is removed:

```bash
docker compose stop          # stop all services (SIGTERM, then SIGKILL after 10 seconds)
docker compose stop api      # stop one service
docker compose start         # start the stopped containers again
docker compose restart api   # stop and start one service
```

> **Note:** `restart` does **not** pick up changes in `compose.yaml`. It just restarts the same container. To apply file changes, use `docker compose up -d`.

Compose stops containers the same way as `docker stop`: it sends **SIGTERM** first, so the app can finish its work, then **SIGKILL** after 10 seconds. The **notes-api** handles SIGTERM by closing its server, so it stops quickly and cleanly.

## `down`: stop and clean up

```bash
docker compose down
```

```text
[+] Running 5/5
 ✔ Container notes-api-api-1     Removed
 ✔ Container notes-api-cache-1   Removed
 ✔ Container notes-api-db-1      Removed
 ✔ Network notes-api_frontend    Removed
 ✔ Network notes-api_backend     Removed
```

`down` removes the containers and networks. It **keeps** volumes and images. Two flags change that:

```bash
docker compose down -v            # ALSO delete named volumes (your database data!)
docker compose down --rmi local   # ALSO delete images that Compose built
```

| Command | Containers | Networks | Volumes | Images |
|---|---|---|---|---|
| `stop` | Stopped, kept | Kept | Kept | Kept |
| `down` | Removed | Removed | **Kept** | Kept |
| `down -v` | Removed | Removed | **Removed** | Kept |
| `down -v --rmi local` | Removed | Removed | Removed | Built ones removed |

> **Warning:** `docker compose down -v` deletes your database volume for good. It is great for starting fresh in development, but think twice before typing it on a server. Back up first, as you learned in [tmpfs Mounts and Backing Up Volumes](/courses/docker/tmpfs-and-volume-backups).

## A few more handy commands

```bash
docker compose config           # check the file and print the final result
docker compose top              # show processes running in each service
docker compose images           # show the images used by the project
docker compose port api 3000    # which host port maps to api's port 3000?
```

## Global options: `-f` and `-p`

Two options go **before** the command and work with all of them:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d   # use more than one file
docker compose -p notes-test up -d                          # use a different project name
```

- `-f` picks which Compose files to use. You will use this in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides).
- `-p` sets the project name. With a different name, you can run a second copy of the same app side by side, for example for tests (as long as their published ports do not clash).

## A typical day with Compose

```bash
docker compose up -d --build     # morning: start everything with fresh code
docker compose logs -f api       # watch the API while you work
docker compose exec db psql -U notes notes   # look at the data
docker compose run --rm api npm test         # run the tests
docker compose down              # evening: clean up (data stays in the volume)
```

## Common mistakes

### Running commands from the wrong folder

Compose looks for `compose.yaml` in the current folder. Elsewhere, you get `no configuration file provided: not found`. Change folder or use `-f path/to/compose.yaml`.

### Using container names instead of service names

`docker compose exec notes-api-api-1 sh` fails. Use the **service** name: `docker compose exec api sh`.

### Expecting `restart` to apply file changes

It only restarts. Use `docker compose up -d` after editing `compose.yaml`.

### Forgetting `--build` after code changes

`up -d` reuses the old image. Add `--build`, or set up Compose Watch.

### Typing `down -v` out of habit

It deletes your data volumes. Use plain `down` unless you really want a fresh start.

## Quick recap

- `up -d` creates and starts everything. Add `--build` after code changes. Running it again only changes what changed.
- `ps` lists the project's containers, `ls` lists all projects, `logs -f api` follows one service's logs.
- `exec` runs a command in a **running** service (no `-it` needed, `-T` for scripts). `run --rm` runs a one-off command in a **new** container.
- `build` and `pull` update images. Follow them with `up -d`.
- `stop`, `start` and `restart` keep containers. `down` removes containers and networks but keeps volumes. `down -v` deletes volumes too.
- `-f` chooses files and `-p` chooses the project name.

Next, you will keep settings and passwords out of your Compose file in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).

<code id="code-content" class="language-bash">
# Docker Compose commands cheat sheet (run from the folder with compose.yaml)
# ---------- Start ----------
docker compose up -d                  # create and start everything in the background
docker compose up -d --build          # rebuild images first (after code changes)
docker compose up -d api              # start one service and what it depends on
docker compose up -d --wait           # return only when services are running or healthy
docker compose up -d --remove-orphans # remove containers of services deleted from the file
# ---------- Look ----------
docker compose ps                     # this project's containers
docker compose ps -a                  # including stopped ones
docker compose ls                     # every Compose project on this machine
docker compose logs -f                # follow all logs (Ctrl+C stops watching only)
docker compose logs -f --tail 50 api  # last 50 lines of api, then follow
docker compose top                    # processes in each service
docker compose config                 # check the file and print the final result
# ---------- Run commands ----------
docker compose exec api sh            # shell in the running api service
docker compose exec db psql -U notes notes
docker compose exec cache redis-cli ping
docker compose exec -T db pg_dump -U notes notes &gt; notes-backup.sql   # -T for scripts and pipes
docker compose run --rm api npm test  # one-off command in a new container, removed after
# ---------- Update images ----------
docker compose build                  # build services that have build:
docker compose build --no-cache api   # build from scratch
docker compose pull                   # download newer image: versions
docker compose up -d                  # then recreate containers with the new images
# ---------- Stop and start (containers are kept) ----------
docker compose stop
docker compose start
docker compose restart api            # does NOT apply compose.yaml changes
# ---------- Clean up ----------
docker compose down                   # remove containers and networks, keep volumes
docker compose down -v                # ALSO delete volumes (all data is lost)
docker compose down --rmi local       # ALSO delete images Compose built
# ---------- Global options go before the command ----------
docker compose -f compose.yaml -f compose.prod.yaml up -d
docker compose -p notes-test up -d
</code></pre>

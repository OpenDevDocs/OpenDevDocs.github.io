---
publishDate: 2026-10-25T17:10
title: 'Anatomy of a compose.yaml File'
slug: compose-file-anatomy
metadescription: 'Learn every important part of a compose.yaml file: YAML basics, services, images, builds, ports, environment, volumes, networks and health checks.'
updateDate: 2026-10-25T17:10
author: ['bishal-biswas']
level: 1
tags: ['docker', 'docker-compose', 'yaml']
course: docker
---

## Reading a Compose file with confidence

In [What is Docker Compose?](/courses/docker/what-is-docker-compose) you ran the **notes-api** and a database with a short `compose.yaml`. In this lesson you will take a Compose file apart, piece by piece, so you can read any Compose file you find and write your own.

You will learn:

- just enough **YAML** to avoid the common errors,
- the **top-level sections** of a Compose file,
- the **service settings** you will use most: `image`, `build`, `ports`, `environment`, `volumes`, `networks`, `restart`, `healthcheck` and more,
- how to check your file with `docker compose config`.

## Just enough YAML

**YAML** is a text format for settings. Compose files are YAML. It has only a few rules.

### Maps: `key: value`

A **map** is a list of names with values. Indentation (spaces at the start of a line) shows what belongs to what:

```yaml
db:
  image: postgres:17-alpine   # "image" belongs to "db"
  restart: unless-stopped     # so does "restart"
```

### Lists: lines starting with `-`

A **list** is several items in order:

```yaml
ports:
  - "3000:3000"
  - "9229:9229"
```

### The rules that trip people up

| Rule | Example |
|---|---|
| Use **spaces**, never tabs | Two spaces per level is normal |
| A space after the colon | `image: nginx:1.29-alpine`, not `image:nginx` |
| Comments start with `#` | `# this is a comment` |
| Quote port mappings | `"3000:3000"`, not `3000:3000` |
| Quote values like `yes`, `no`, `on`, `off` | `ENABLED: "yes"`, or YAML may read them as true or false |

> **Note:** Why quote ports? Old YAML rules can read numbers with a colon, like `22:22`, as a time value in base 60 and turn them into a single number. Quotes make sure Compose sees text. It is a good habit for every port line.

## The top-level sections

A Compose file has a few **top-level keys**, written with no indentation. Only `services` is required.

```yaml
name: notes            # optional project name (default: the folder name)

services:              # the containers to run (required)
  api: ...
  db: ...

volumes:               # named volumes used by the services
  notes-data:

networks:              # extra networks, if the default one is not enough
  backend:

secrets:               # sensitive values, mounted as files
  db_password:
    file: ./db_password.txt
```

| Key | What it holds |
|---|---|
| `name` | The project name. Sets the prefix for containers, networks and volumes |
| `services` | One entry per part of your app |
| `volumes` | Named volumes. A service can only use a named volume listed here |
| `networks` | Custom networks. Without this, every service joins one network called `default` |
| `secrets` | Secret files that services can read at `/run/secrets/<name>`. Covered in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets) |

> **Warning:** Do not add a `version:` line. It belonged to the old Compose v1. Today it is ignored and only causes a warning.

## Services: the heart of the file

Each entry under `services` describes one part of your app. The name you give it (like `api` or `db`) is also its **DNS name** on the project network.

### `image`: use a ready-made image

```yaml
services:
  cache:
    image: redis:8-alpine
```

Compose pulls the image from a registry if it is not on your machine yet. Always use a specific tag, not `latest` (you learned why in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests)).

### `build`: build your own image

The short form points at a folder with a Dockerfile:

```yaml
services:
  api:
    build: .
```

The long form lets you set more options:

```yaml
services:
  api:
    build:
      context: .                # the build context folder
      dockerfile: Dockerfile    # the Dockerfile to use (this is the default name)
      target: production        # build only up to this stage of a multi-stage file
      args:
        NODE_VERSION: "24"      # build arguments for ARG lines
    image: notes-api:1.0.0      # name the built image
```

If you give both `build` and `image`, Compose builds the image and tags it with that name. `args` sets values for `ARG` lines, which you met in [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env). `target` picks a stage from a multi-stage Dockerfile.

### `ports`: publish ports

```yaml
services:
  api:
    ports:
      - "3000:3000"              # host 3000 to container 3000
      - "127.0.0.1:9229:9229"    # only this machine can reach the debugger port
```

The format is the same as `-p` with `docker run`: `HOST:CONTAINER`. There is also a long form, which is easier to read:

```yaml
    ports:
      - target: 3000        # port inside the container
        published: "3000"   # port on the host
        host_ip: 127.0.0.1  # optional: listen only on this address
```

> **Tip:** Only publish what **you** need to reach from outside. Services reach each other on the project network without any `ports`. The database usually has no `ports` at all.

### `environment` and `env_file`: settings for the app

You can write environment variables as a map:

```yaml
services:
  api:
    environment:
      PORT: "3000"
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
```

Or as a list:

```yaml
    environment:
      - PORT=3000
      - DATABASE_URL=postgres://notes:devpassword@db:5432/notes
```

Both do the same thing. Pick one style and keep it. You can also load variables from a file:

```yaml
    env_file:
      - .env.api
```

You will learn the details, including `${VAR}` values and secrets, in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).

### `volumes`: keep and share data

The short form looks like `-v`:

```yaml
services:
  db:
    volumes:
      - notes-data:/var/lib/postgresql/data   # named volume (listed at the top level)
  web:
    volumes:
      - ./public:/usr/share/nginx/html:ro     # bind mount, read-only

volumes:
  notes-data:
```

How does Compose know which is which? A source that starts with `.` or `/` is a **bind mount** (a folder on your computer, see [Bind Mounts: Sharing Folders with a Container](/courses/docker/bind-mounts)). A plain name is a **named volume** (see [Docker Volumes: Keeping Data Safe](/courses/docker/docker-volumes)). In Compose, relative paths like `./public` are relative to the folder of the Compose file, which is much nicer than `$(pwd)`.

The long form spells everything out:

```yaml
    volumes:
      - type: bind
        source: ./public
        target: /usr/share/nginx/html
        read_only: true
```

### `networks`: choose networks

Without a `networks` key, every service joins the project's `default` network. To separate parts of your app, define networks and list them per service:

```yaml
services:
  web:
    image: nginx:1.29-alpine
    networks: [frontend]
  api:
    build: .
    networks: [frontend, backend]   # the api joins both
  db:
    image: postgres:17-alpine
    networks: [backend]

networks:
  frontend:
  backend:
    internal: true                  # no internet access for this network
```

This is the same idea you built by hand in [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks): `web` can reach `api`, but not `db`.

### `command` and `entrypoint`: change what runs

```yaml
services:
  api:
    build: .
    command: ["node", "--watch", "src/server.js"]   # replaces the image's CMD
```

`command` replaces the image's `CMD`, and `entrypoint` replaces its `ENTRYPOINT`. You learned the difference in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint). Use the list form, like in a Dockerfile, so signals reach your app.

### `restart`: what to do when a container stops

```yaml
services:
  api:
    restart: unless-stopped
```

The values are the same as with `docker run`: `"no"`, `on-failure`, `always` and `unless-stopped`. Quote `"no"`, because a bare `no` is read as false. See [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits).

### `healthcheck`: is the service really working?

```yaml
services:
  db:
    image: postgres:17-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notes -d notes"]
      interval: 10s       # how often to check
      timeout: 3s         # how long one check may take
      retries: 5          # failures in a row before "unhealthy"
      start_period: 10s   # grace time while the service starts
```

This works like the `HEALTHCHECK` instruction from [Health Checks: Telling Docker Your App Is Working](/courses/docker/healthchecks). `CMD` runs a program directly. `CMD-SHELL` runs the text through a shell.

### `depends_on`: start order

```yaml
services:
  api:
    depends_on:
      db:
        condition: service_healthy   # wait until db's health check passes
```

With `condition: service_healthy`, Compose starts the API only after the database reports healthy. The full story is in [Startup Order with depends_on and Health Checks](/courses/docker/compose-depends-on-and-healthchecks).

### Other useful settings

| Setting | What it does | Example |
|---|---|---|
| `container_name` | Fixed container name instead of `project-service-1` | `container_name: notes-db` |
| `user` | Run as this user | `user: "1000:1000"` |
| `working_dir` | Working folder inside the container | `working_dir: /app` |
| `expose` | Document a port for other services (does not publish) | `expose: ["3000"]` |
| `deploy.resources.limits` | Limit memory and CPU | `memory: 256M`, `cpus: "0.50"` |
| `profiles` | Only start this service when a profile is chosen | `profiles: [debug]` |
| `read_only` | Read-only root file system | `read_only: true` |
| `tmpfs` | Memory-only folders | `tmpfs: [/tmp]` |
| `network_mode` | Use `host` or `none` mode | `network_mode: none` |

> **Tip:** Avoid `container_name` unless you really need it. A fixed name stops you from running two copies of the project, and Compose's own names already work well.

## Variables in the Compose file

You can use `${VAR}` anywhere in the file. Compose fills in values from your shell or from a file called `.env` next to `compose.yaml`:

```yaml
services:
  api:
    image: notes-api:${API_TAG:-dev}   # use API_TAG, or "dev" if it is not set
```

```text
# .env (read automatically by Compose)
API_TAG=1.2.0
```

`${API_TAG:-dev}` means "the value of API_TAG, or `dev` if it is empty or missing". Different setups for development and production are covered in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides).

## Checking your file: `docker compose config`

Before you start anything, ask Compose to read and print the file:

```bash
docker compose config
```

It shows the **final** file after filling in variables and defaults. If there is a mistake, it tells you where:

```text
yaml: line 7: mapping values are not allowed in this context
```

This error usually means a missing space after a colon or a wrong indent near that line. To check the file without printing it, use `docker compose config --quiet`. No output means the file is valid.

## Putting it all together

The code panel shows a complete `compose.yaml` for **notes-api** with an API, a PostgreSQL database and a Redis cache, using most of the settings from this lesson. Read it top to bottom. Every line has a comment explaining it.

## Common mistakes

### Mixing tabs and spaces

YAML fails with confusing errors. Set your editor to insert spaces for YAML files.

### Forgetting to list a named volume at the top level

If a service uses `notes-data:/var/lib/postgresql/data`, the top-level `volumes:` must include `notes-data:`. Otherwise Compose says the volume is undefined.

### Writing `restart: no` without quotes

YAML reads `no` as false. Write `restart: "no"`.

### Using container ports and host ports the wrong way round

`"8080:80"` means host 8080 to container 80. The **container** port is always on the right.

### Putting real secrets in the file

The Compose file is usually committed to Git. Keep real passwords out of it. Use placeholders for development and secrets for anything real.

## Quick recap

- YAML uses **indentation with spaces**, `key: value` maps and `-` lists. Quote ports and values like `"no"`.
- Top-level keys: `name`, `services` (required), `volumes`, `networks`, `secrets`. No `version:`.
- Each **service** uses `image` or `build`, and often `ports`, `environment`, `volumes`, `networks`, `restart`, `healthcheck` and `depends_on`.
- Paths starting with `.` or `/` are bind mounts. Plain names are named volumes.
- `${VAR:-default}` fills values from your shell or `.env`.
- Run `docker compose config` to check and see the final file.

Next, you will learn the commands to run, watch and manage your Compose app in [Docker Compose Commands: up, down, logs and exec](/courses/docker/compose-commands).

<code id="code-content" class="language-yaml">
# compose.yaml for notes-api: API + PostgreSQL + Redis
# Check it:  docker compose config
# Start it:  docker compose up -d
# Project name (default would be the folder name)
name: notes-api
services:
  # ---------- The API, built from the Dockerfile in this folder ----------
  api:
    build:
      context: .
      dockerfile: Dockerfile
    # Name the image Compose builds. API_TAG comes from the shell or .env, default "dev"
    image: notes-api:${API_TAG:-dev}
    # Host port 3000 to container port 3000 (quoted, always)
    ports:
      - "3000:3000"
    environment:
      PORT: "3000"
      # Service names work as host names on the project network
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
      REDIS_URL: redis://cache:6379
    # Start only after the database health check passes
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_started
    restart: unless-stopped
    # Limit memory and CPU so one service cannot starve the others
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.50"
    networks: [frontend, backend]
  # ---------- PostgreSQL: no ports, only the api reaches it ----------
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    # Named volume keeps the data when containers are removed
    volumes:
      - notes-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notes -d notes"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s
    restart: unless-stopped
    networks: [backend]
  # ---------- Redis cache ----------
  cache:
    image: redis:8-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped
    networks: [backend]
# ---------- Named volumes ----------
volumes:
  notes-data:
# ---------- Networks: frontend for public traffic, backend for data ----------
networks:
  frontend:
  backend:
</code></pre>

---
publishDate: 2026-10-25T11:50
title: Multi-Container Apps with Docker Compose
slug: docker-compose-basics
metadescription: Learn Docker Compose, defining services, networks and volumes in compose.yaml, service-name DNS, health-checked startup order, environment files, everyday commands and when Compose is enough for production.
updateDate: 2026-10-25T11:50
author: ['bishal-biswas']
level: 2
tags: ['devops', 'docker', 'docker-compose', 'containers']
course: devops
---

## One app, many containers

Real applications are rarely a single container. Even a small one usually needs an **API**, a **database**, perhaps a **cache** such as Redis, and a **background worker**. As you learned in [Docker Essentials](/courses/devops/docker-essentials), each of these should run in its own container.

Starting them by hand gets painful fast:

```bash
docker network create recipes
docker volume create db-data
docker run -d --name db --network recipes -e POSTGRES_PASSWORD=... -v db-data:/var/lib/postgresql/data postgres:17-alpine
docker run -d --name api --network recipes -p 3000:3000 -e DATABASE_URL=... recipe-api:dev
```

Every developer has to type these exactly right, in the right order, and remember to clean up afterwards. **Docker Compose** replaces all of it with one file and one command.

## What Compose is

**Docker Compose** lets you describe a whole multi-container application in a single YAML file, usually called `compose.yaml`, and then manage it as one unit:

```bash
docker compose up -d      # create and start everything
docker compose down       # stop and remove everything
```

It is part of Docker Desktop and installs as a plugin with Docker Engine. The file lives in your repository, next to the code, so every developer and every CI run starts exactly the same setup. It is "environment as code".

> **Note:** You may see the older `docker-compose` command (with a hyphen) and files called `docker-compose.yml` that start with a `version:` line. Modern Compose is `docker compose` (with a space), prefers the name `compose.yaml`, and no longer needs `version:`. It still reads the old file names.

## Anatomy of compose.yaml

The code panel for this lesson has a complete file for `recipe-api` plus a PostgreSQL database. Here are its parts.

### Services

Each entry under `services:` becomes one container (or several copies of it). A service either uses a ready-made **image** or **builds** one from a Dockerfile:

```yaml
services:
  api:
    build: .                 # build from ./Dockerfile
    image: recipe-api:dev    # ...and name the result
    ports:
      - "3000:3000"
  db:
    image: postgres:17-alpine
```

`ports` works like `docker run -p`: `"3000:3000"` publishes the API on your machine's port 3000. Quote port mappings in YAML, because some forms like `"22:22"` can otherwise be misread as numbers.

### Networking: services find each other by name

Compose creates a private **network** for each project and connects every service to it. On that network, Compose runs a small **DNS** server, so each service can reach the others **by service name**:

```yaml
    environment:
      DATABASE_URL: postgres://recipes:devpassword@db:5432/recipes
```

`db` in that URL is simply the name of the database service. No IP addresses, no `localhost`. This is the "connect to names, not addresses" idea from [DNS: How Domain Names Become Addresses](/courses/devops/how-dns-works), working for you automatically.

Notice that the `db` service has **no** `ports:` section. The API can reach it over the private network, but nothing outside the project can. Only publish the ports that people actually need to reach from your machine.

> **Tip:** Inside a container, `localhost` means **that container**, not your computer and not other containers. "Connection refused to localhost:5432" from the API container almost always means it should be connecting to `db:5432` instead.

### Volumes: data that survives

```yaml
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

The top-level `volumes:` section declares a **named volume**, and the service mounts it where PostgreSQL keeps its files. You can stop, delete and recreate the database container, or upgrade it to a newer image, and the data stays.

### Start-up order and health checks

The API cannot work until the database is ready. `depends_on` controls start-up order, and with a **condition** it waits for more than "the container started":

```yaml
  api:
    depends_on:
      db:
        condition: service_healthy

  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U recipes -d recipes"]
      interval: 5s
      timeout: 3s
      retries: 10
```

PostgreSQL takes a few seconds to initialise after its container starts. The `healthcheck` runs `pg_isready` every five seconds, and the API only starts once the database reports **healthy**. Without this, the API often crashes on its first connection attempt.

### Restart policies

```yaml
    restart: unless-stopped
```

If the process crashes, or the server reboots, Docker starts the container again, unless you stopped it on purpose. Other options are `no` (the default), `always` and `on-failure`.

### Environment variables and .env

Compose fills in `${VARIABLE}` placeholders from your shell, or from a file called `.env` in the same folder:

```yaml
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}
```

```text
# .env (never committed: add it to .gitignore)
DB_PASSWORD=a-much-better-local-password
```

`${DB_PASSWORD:-devpassword}` means "use `DB_PASSWORD` if it is set, otherwise `devpassword`". That keeps the file working out of the box for local development, without committing a real password. You can also load a whole file into a container with `env_file: .env.api`.

## Everyday commands

Run these from the folder containing `compose.yaml`:

```bash
docker compose up -d --build      # build images if needed, then start everything in the background
docker compose ps                 # what is running, and is it healthy?
docker compose logs -f api        # follow one service's logs
docker compose exec db psql -U recipes recipes   # open a shell (here, psql) in a running service
docker compose restart api        # restart one service
docker compose pull               # fetch newer versions of the images
docker compose config             # check the file and show it with every variable filled in
docker compose down               # stop and remove containers and the network
docker compose down -v            # ...and delete the volumes too (your data!)
```

Starting the project from the code panel looks something like this:

```text
[+] Running 4/4
 ✔ Network recipe-api_default    Created
 ✔ Volume "recipe-api_db-data"   Created
 ✔ Container recipe-api-db-1     Healthy
 ✔ Container recipe-api-api-1    Started
```

Compose named everything after the **project**, which defaults to the folder name (`recipe-api`). Notice the API container was only started after the database became **Healthy**.

```bash
docker compose ps
```

```text
NAME               IMAGE                COMMAND                  SERVICE   STATUS                    PORTS
recipe-api-api-1   recipe-api:dev       "docker-entrypoint.s…"   api       Up 20 seconds (healthy)   0.0.0.0:3000->3000/tcp
recipe-api-db-1    postgres:17-alpine   "docker-entrypoint.s…"   db        Up 26 seconds (healthy)   5432/tcp
```

The database shows `5432/tcp` with no `0.0.0.0:` in front: it is listening inside the network but not published to your machine, exactly as intended.

## Compose in everyday DevOps work

### Local development

A new team member clones the repository, runs `docker compose up`, and has the whole stack running in minutes, with the right database version and settings. No "install PostgreSQL 17 and create a user called..." page in the wiki.

For fast feedback while coding, you can mount your source folder into the container, or use `docker compose watch`, which syncs changed files into running containers or rebuilds them automatically.

### Integration tests in CI

The same file can start real dependencies for the [integration tests](/courses/devops/testing-in-the-pipeline) in your pipeline:

```yaml
      - run: docker compose up -d --wait db     # --wait blocks until db is healthy
      - run: npm run test:integration
      - run: docker compose down -v
```

### Overrides for different situations

Compose automatically merges `compose.override.yaml` on top of `compose.yaml` if it exists. Teams use this for developer-only settings, such as publishing the database port or mounting source code, while the main file stays close to production. You can also pick files explicitly with `-f`, for example `docker compose -f compose.yaml -f compose.ci.yaml up`.

### Is Compose enough for production?

For **one server**, often yes. Plenty of small products run happily on a single VM with Compose, `restart: unless-stopped`, regular backups of the volumes, and a reverse proxy in front.

Compose starts to struggle when you need:

- containers spread over **several servers**, for capacity or to survive a server failing;
- automatic **rescheduling** when a machine dies;
- zero-downtime **rolling updates** and automatic scaling.

That is the job of an **orchestrator**, and the most popular one is the subject of the next lesson.

## Common misunderstandings

### "depends_on means the database is ready"

On its own, `depends_on` only waits for the database **container to start**, not for PostgreSQL inside it to accept connections. Add a `healthcheck` and `condition: service_healthy`, and make your app retry its connection anyway.

### "docker compose down deletes my data"

Not by default: named volumes are kept. `down -v` is the command that deletes them. Be careful with it on anything that matters.

### "I should commit .env so the team has the settings"

Commit the **structure**, not the secrets: a `.env.example` file with placeholder values, plus safe defaults in `compose.yaml`. Each person and each environment keeps its own real `.env`.

## Quick recap

- **Docker Compose** describes a multi-container app in `compose.yaml` and runs it with `docker compose up`.
- **Services** use an `image` or `build` one; `ports` publishes only what you need.
- Services reach each other **by name** on a private network: `db:5432`, never `localhost`.
- **Named volumes** keep data; `depends_on` with a **health check** gets the start-up order right.
- `${VAR:-default}` and a git-ignored `.env` keep secrets out of the file.
- Compose is great for development, CI and single-server production; beyond that, you need an **orchestrator**.

Next, you will see what that orchestrator does in [Why Kubernetes? Container Orchestration Concepts](/courses/devops/why-kubernetes).

<code id="code-content" class="language-yaml">
# compose.yaml: recipe-api plus a PostgreSQL database, started with one command.
# Start:  docker compose up -d --build        Logs: docker compose logs -f api
# Stop:   docker compose down                 (add -v to also delete the database data)
services:
  api:
    build: .                                # build the image from ./Dockerfile
    image: recipe-api:dev
    ports:
      - "3000:3000"                         # host port : container port
    environment:
      PORT: 3000
      # "db" is the other service's name: Compose's built-in DNS turns it into an address
      DATABASE_URL: postgres://recipes:${DB_PASSWORD:-devpassword}@db:5432/recipes
    depends_on:
      db:
        condition: service_healthy          # wait until the database really accepts connections
    restart: unless-stopped
  db:
    image: postgres:17-alpine               # pin the major version; 18 moved its data folder
    environment:
      POSTGRES_USER: recipes
      POSTGRES_PASSWORD: ${DB_PASSWORD:-devpassword}   # from .env, or this dev-only default
      POSTGRES_DB: recipes
    volumes:
      - db-data:/var/lib/postgresql/data    # data survives when the container is replaced
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U recipes -d recipes"]
      interval: 5s
      timeout: 3s
      retries: 10
    # No "ports:" on purpose: only services on this project's network can reach the database
volumes:
  db-data:
</code></pre>

---
publishDate: 2026-10-25T17:05
title: 'What is Docker Compose?'
slug: what-is-docker-compose
metadescription: 'Learn what Docker Compose is, why it beats long docker run commands, and how one compose.yaml file starts a whole multi-container app.'
updateDate: 2026-10-25T17:05
author: ['bishal-biswas']
level: 1
tags: ['docker', 'docker-compose', 'containers']
course: docker
---

## The problem: too many long commands

In [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks) you connected the **notes-api** to a PostgreSQL database. It worked, but look at everything you had to type:

```bash
docker network create notes-net
docker volume create notes-data
docker run -d --name db --network notes-net \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  -v notes-data:/var/lib/postgresql/data \
  postgres:17-alpine
docker build -t notes-api:1.0.0 .
docker run -d --name api --network notes-net \
  -p 3000:3000 \
  -e DATABASE_URL=postgres://notes:devpassword@db:5432/notes \
  notes-api:1.0.0
```

That is five commands for just two containers. Now imagine:

- adding a Redis cache and a web server,
- a new teammate who needs to run all of this on their laptop,
- remembering the exact flags three months from now,
- stopping and removing everything cleanly.

It gets messy fast. You could save the commands in a script, but a script does not know what is already running, what changed, or how to clean up.

## The solution: Docker Compose

**Docker Compose** is a tool for running apps made of several containers. Instead of typing commands, you **describe** your app in one file called `compose.yaml`. Then one command starts everything, and one command stops it.

Here are the same two containers as a Compose file:

```yaml
services:
  api:
    build: .                     # build the image from the Dockerfile in this folder
    ports:
      - "3000:3000"              # publish port 3000 to the host
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes

  db:
    image: postgres:17-alpine    # use a ready-made image
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    volumes:
      - notes-data:/var/lib/postgresql/data

volumes:
  notes-data:                    # a named volume, created for you
```

And to run it:

```bash
docker compose up -d
```

That is all. Compose builds the API image, creates a network, creates the volume, and starts both containers in the right setup.

Think of it like a recipe card versus telling a cook every step out loud. The `docker run` commands are you shouting instructions. The `compose.yaml` file is a written recipe that anyone can follow, as many times as they like, with the same result.

## Key words

Compose uses a few words you will see in every lesson from now on:

| Word | Meaning |
|---|---|
| **Compose file** | The YAML file that describes your app, usually `compose.yaml` |
| **Service** | One part of your app, such as `api` or `db`. Compose runs one or more containers for each service |
| **Project** | The whole app. Its name comes from the folder name by default |
| **YAML** | A simple text format that uses indentation (spaces) to show structure |

> **Note:** YAML cares about spaces. Use spaces, never tabs, and keep the indentation the same (two spaces is normal). A wrong indent is the most common Compose error. You will learn the file in detail in [Anatomy of a compose.yaml File](/courses/docker/compose-file-anatomy).

## Running it for the first time

Put `compose.yaml` in the **notes-api** project folder, next to the `Dockerfile` from [Project: Dockerizing a Node.js App](/courses/docker/dockerizing-a-node-app):

```text
notes-api/
  compose.yaml
  Dockerfile
  .dockerignore
  package.json
  package-lock.json
  src/
    server.js
```

Start the project:

```bash
cd notes-api
docker compose up -d
```

```text
[+] Building 8.2s (10/10) FINISHED
 ...
[+] Running 4/4
 ✔ Network notes-api_default       Created
 ✔ Volume "notes-api_notes-data"   Created
 ✔ Container notes-api-db-1        Started
 ✔ Container notes-api-api-1       Started
```

See what is running:

```bash
docker compose ps
```

```text
NAME              IMAGE                COMMAND                  SERVICE   CREATED          STATUS          PORTS
notes-api-api-1   notes-api-api        "docker-entrypoint.s…"   api       12 seconds ago   Up 11 seconds   0.0.0.0:3000->3000/tcp
notes-api-db-1    postgres:17-alpine   "docker-entrypoint.s…"   db        12 seconds ago   Up 12 seconds   5432/tcp
```

Test the API:

```bash
curl http://localhost:3000/health
```

```text
ok
```

And when you are done:

```bash
docker compose down
```

```text
[+] Running 3/3
 ✔ Container notes-api-api-1   Removed
 ✔ Container notes-api-db-1    Removed
 ✔ Network notes-api_default   Removed
```

Notice that `down` removed the containers and the network but **kept the volume**, so your notes are still there next time. You will learn all the commands in [Docker Compose Commands: up, down, logs and exec](/courses/docker/compose-commands).

## What Compose does for you

Look again at the output of `up`. Compose did several things you used to do by hand.

### It creates a network automatically

Compose created a network called `notes-api_default`. Every service in the file joins it. This is a **user-defined bridge network**, so it has built-in DNS.

### Service names become host names

The API reaches the database at `db`, because `db` is the **service name**. You did not set any container name or network flag. Compose wires the DNS for you.

### Names get the project as a prefix

Compose puts the project name in front of everything it creates, so two projects never clash:

| You wrote | Compose created |
|---|---|
| service `api` | container `notes-api-api-1` |
| service `db` | container `notes-api-db-1` |
| volume `notes-data` | volume `notes-api_notes-data` |
| (nothing) | network `notes-api_default` |
| `build: .` for `api` | image `notes-api-api` |

The `-1` at the end is a number. If you ever run more than one container for a service, they become `-1`, `-2` and so on.

### It knows what is already running

Run `docker compose up -d` a second time and nothing restarts:

```text
[+] Running 2/2
 ✔ Container notes-api-db-1    Running
 ✔ Container notes-api-api-1   Running
```

Change one setting in `compose.yaml` and run `up -d` again, and Compose recreates **only** the service that changed. This is called being **declarative**: you describe the result you want, and Compose works out the steps to get there.

## Compose v2: `docker compose`, not `docker-compose`

You may see two spellings online:

| | Compose v1 (old) | Compose v2 (current) |
|---|---|---|
| Command | `docker-compose` (with a dash) | `docker compose` (with a space) |
| Written in | Python | Go, as a Docker CLI plugin |
| Status | Retired, no longer updated | Included with Docker Desktop and Docker Engine packages |
| File name | `docker-compose.yml` | `compose.yaml` (old names still work) |
| `version:` key at the top | Needed | **Not used**, leave it out |

Always use `docker compose` with a space. Check that you have it:

```bash
docker compose version
```

```text
Docker Compose version v2.40.0
```

Your version number may be different. Anything starting with `v2` is fine. If you installed Docker following [Installing Docker on Windows, macOS and Linux](/courses/docker/installing-docker), you already have it.

> **Tip:** If an old tutorial's file starts with `version: "3.8"`, just delete that line. Compose v2 ignores it and prints a warning.

## Dockerfile vs Compose file

Beginners often mix these up. They do different jobs and work together.

| | Dockerfile | compose.yaml |
|---|---|---|
| Describes | How to **build one image** | How to **run a whole app** |
| Contains | `FROM`, `COPY`, `RUN`, `CMD` | services, ports, volumes, networks, environment |
| Used by | `docker build` | `docker compose` |
| Example | "Install Node packages and copy the code" | "Run the API on port 3000 next to a Postgres database" |

A Compose file can **use** a Dockerfile (`build: .`) or a ready-made image from a registry (`image: postgres:17-alpine`), or both in the same file.

## What Compose is good for

- **Local development.** One command gives every developer the same database, cache and API. You will set this up properly in [Local Development with Compose: Bind Mounts and Watch](/courses/docker/compose-for-local-development).
- **Automated tests.** CI can start the app and its database, run tests, then remove everything.
- **Small production setups.** A single server running a few containers works well with Compose. See [Deploying a Compose App to a Linux Server](/courses/docker/deploying-with-docker-on-a-server).
- **Documentation.** The file itself shows exactly what your app needs to run.

### What Compose is not for

Compose runs containers on **one machine**. If you need many servers, automatic failover when a server dies, or scaling across a cluster, you need an orchestrator such as Kubernetes. You will see how the ideas carry over in [From Docker to Kubernetes: What Comes Next](/courses/docker/docker-to-kubernetes-next-steps).

## Common mistakes

### Using tabs or wrong indentation

YAML needs spaces. If Compose says something like `yaml: line 5: did not find expected key`, check the indentation around that line.

### Running `docker compose` in the wrong folder

Compose looks for `compose.yaml` in the **current folder**. If you are somewhere else, you get `no configuration file provided: not found`. `cd` into the project folder first.

### Using `localhost` to reach another service

Inside the `api` container, `localhost` is the API itself. Use the service name, such as `db`.

### Thinking `down` deletes your data

`docker compose down` keeps named volumes. Only `docker compose down -v` removes them.

## Quick recap

- **Docker Compose** runs multi-container apps from one file, `compose.yaml`.
- A **service** is one part of your app. The **project** is the whole app, named after the folder.
- `docker compose up -d` starts everything. `docker compose down` removes containers and the network but keeps volumes.
- Compose creates a **network** for you, and **service names** work as host names.
- Use `docker compose` (v2, with a space) and leave out the old `version:` key.
- A Dockerfile builds **one image**. A Compose file runs **the whole app**.

Next, you will go through every part of a Compose file in [Anatomy of a compose.yaml File](/courses/docker/compose-file-anatomy).

<code id="code-content" class="language-yaml">
# compose.yaml for notes-api: the API plus a PostgreSQL database
# Start:  docker compose up -d
# Stop:   docker compose down        (keeps the notes-data volume)
# Wipe:   docker compose down -v     (also deletes the volume and all notes)
services:
  # ---------- The Node.js API ----------
  api:
    # Build the image from the Dockerfile in this folder
    build: .
    # Publish container port 3000 on host port 3000
    ports:
      - "3000:3000"
    environment:
      # "db" is the service name below. Compose's network turns it into an IP
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
  # ---------- The database ----------
  db:
    # A ready-made image from Docker Hub
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    # No ports: only the api needs the database, and it reaches it on the project network
    volumes:
      - notes-data:/var/lib/postgresql/data
# Named volumes used above. Compose creates "notes-api_notes-data" for you
volumes:
  notes-data:
</code></pre>

---
publishDate: 2026-10-25T18:10
title: 'Logging Drivers and Log Rotation'
slug: logging-drivers
metadescription: 'Learn where Docker stores container logs, how logging drivers work, and how to set up log rotation so logs never fill your server''s disk.'
updateDate: 2026-10-25T18:10
author: ['bishal-biswas']
level: 2
tags: ['docker', 'logging', 'production', 'operations']
course: docker
---

## The disk that filled up overnight

Here is a story that happens to many teams. An app runs fine for months. One morning the server stops working. The cause: the disk is 100% full, and almost all of the space is one giant log file for one container.

By default, Docker keeps **every line** a container ever prints, forever. In this lesson you will learn:

- where those logs actually live,
- what a **logging driver** is and which ones to use,
- how to turn on **log rotation** so old logs are deleted automatically,
- how to set this for one container, for a compose project, and for the whole server.

You already know how to read logs with `docker logs` from [Reading Logs and Running Commands Inside Containers](/courses/docker/logs-and-exec). This lesson is about what happens behind that command.

## How container logging works

A container's main process writes text to two streams: **stdout** (standard output, normal messages) and **stderr** (standard error, error messages). It does not write to a log file. Docker catches both streams and hands every line to a **logging driver**.

A logging driver is a small plug-in that decides **where the lines go**. Think of it like a mail sorter: the app drops letters in one box, and the sorter decides whether they go to a file on disk, to the system journal, or to a log service in the cloud.

```text
 your app  --stdout/stderr-->  Docker  --logging driver-->  file on disk
                                                        or  journald
                                                        or  syslog / Fluentd / cloud service
```

> **Tip:** This is why you should always log to stdout and stderr in containers, not to files inside the container. Then you can change where logs go without touching your app. `console.log` in Node.js and `print` in Python already do this.

## The default: json-file

On a normal Docker Engine install, the default driver is **json-file**. Check yours:

```bash
docker info --format '{{.LoggingDriver}}'
```

```text
json-file
```

It writes every line to a JSON file on the host. Start a container and find its log file:

```bash
docker run -d --name notes-api -p 3000:3000 notes-api:1.0.0
docker inspect notes-api --format '{{.LogPath}}'
```

```text
/var/lib/docker/containers/7c1e.../7c1e...-json.log
```

Each line in that file looks like this:

```json
{"log":"notes-api listening on port 3000\n","stream":"stdout","time":"2026-10-25T18:10:02.123456789Z"}
```

> **Note:** On Docker Desktop (Windows and macOS), this path is inside Docker's Linux virtual machine, so you cannot open it directly from your normal file explorer. `docker logs` still works.

### The problem with the default

The json-file driver has **no size limit** unless you set one. A chatty app that logs every request can write gigabytes a week. The file keeps growing until the disk is full. Even `docker logs` gets slow when the file is huge.

Check how big your container logs are on a Linux server:

```bash
sudo du -sh /var/lib/docker/containers/*/*-json.log
```

```text
4.0K    /var/lib/docker/containers/1a2b.../1a2b...-json.log
7.9G    /var/lib/docker/containers/7c1e.../7c1e...-json.log
```

That 7.9G file is the kind of thing that takes servers down.

## Log rotation

**Log rotation** means: when a log file gets too big, start a new file and delete the oldest ones. You keep recent logs and throw away old ones automatically.

The json-file driver supports rotation with two **log options**:

| Option | Meaning | Example |
|---|---|---|
| `max-size` | Start a new file when the current one reaches this size | `10m` (10 megabytes) |
| `max-file` | How many files to keep in total | `3` |

With `max-size=10m` and `max-file=3`, each container uses at most about 30 MB of log space. When the third file fills up, the oldest one is deleted.

### For one container

```bash
docker run -d --name notes-api \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -p 3000:3000 notes-api:1.0.0
```

Check that the options were applied:

```bash
docker inspect notes-api --format '{{.HostConfig.LogConfig}}'
```

```text
{json-file map[max-file:3 max-size:10m]}
```

## The local driver: a better default

Docker has another driver called **local**. It was made to be a better choice for most servers:

- It **rotates by default**: it keeps 5 files of 20 MB each, so about 100 MB per container. You can change both numbers.
- It **compresses** older files, so they take less space.
- It uses a compact file format that is faster than JSON.
- `docker logs` works with it just like with json-file.

```bash
docker run -d --name notes-api \
  --log-driver local \
  --log-opt max-size=10m \
  -p 3000:3000 notes-api:1.0.0
```

The only reason to keep json-file is if another tool reads the JSON files directly from disk. Some log collectors do this, so check before you switch.

## Other drivers you may meet

| Driver | Where logs go | When to use it |
|---|---|---|
| `json-file` | JSON file per container (the default) | Simple setups; set `max-size`! |
| `local` | Compact, rotated, compressed files | Good default for a single server |
| `journald` | The systemd journal on the host | Servers where you already use `journalctl` |
| `syslog` | A syslog server | Older central logging setups |
| `fluentd` | A Fluentd or Fluent Bit collector | Central logging for many servers |
| `gelf` | Graylog or Logstash | If you run Graylog |
| `awslogs`, `gcplogs` | AWS CloudWatch, Google Cloud Logging | Running on those clouds |
| `none` | Nowhere, logs are thrown away | Very noisy containers you never debug |

> **Note:** For drivers that send logs elsewhere (like `syslog` or `fluentd`), recent Docker versions also keep a small local copy so `docker logs` still works. This is called **dual logging**, and it is on by default.

With journald, you read logs with the normal system tool:

```bash
docker run -d --name notes-api --log-driver journald notes-api:1.0.0
journalctl CONTAINER_NAME=notes-api -f
```

For collecting logs from many servers in one place, see [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).

## Setting logging in Compose

In a compose file, use the `logging` key on each service:

```yaml
services:
  api:
    image: notes-api:1.0.0
    logging:
      driver: local
      options:
        max-size: "10m"
        max-file: "3"
```

> **Warning:** Option values must be **strings** in YAML. Write `"3"` with quotes, not `3`. Without quotes, Compose may refuse to start with an error about the type.

Writing the same block for every service is boring and easy to forget. Use a YAML **anchor**: write the block once and reuse it. Top-level keys that start with `x-` are ignored by Compose, so they are a safe place to keep it:

```yaml
x-logging: &default-logging     # "&" creates an anchor named default-logging
  driver: local
  options:
    max-size: "10m"
    max-file: "3"

services:
  api:
    image: notes-api:1.0.0
    logging: *default-logging   # "*" pastes the anchor here
  db:
    image: postgres:17-alpine
    logging: *default-logging
```

You learned the rest of the compose file structure in [Anatomy of a compose.yaml File](/courses/docker/compose-file-anatomy).

## Setting a default for the whole server

The best protection is a server-wide default, so **every** container is safe, even ones you forget to configure. Docker reads its settings from `/etc/docker/daemon.json` on Linux. Create or edit it:

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Then restart Docker so it reads the new file:

```bash
sudo systemctl restart docker
docker info --format '{{.LoggingDriver}}'
```

```text
local
```

> **Warning:** The new default only applies to containers **created after** the change. Existing containers keep their old settings. Recreate them (for example with `docker compose up -d --force-recreate`) to pick up the new driver. Also, restarting Docker stops running containers for a moment unless you have enabled `live-restore`, so do it at a quiet time.

On Docker Desktop, you set the same JSON in **Settings, Docker Engine**.

## Reading logs well

Rotation means old lines are gone, so learn to find what you need quickly:

```bash
docker logs --tail 100 notes-api          # only the last 100 lines
docker logs --since 30m notes-api         # only the last 30 minutes
docker logs -f --since 5m notes-api       # follow, starting 5 minutes ago
docker logs -t notes-api                  # add a timestamp to each line
docker compose logs -f api                # follow one compose service
```

`--tail` is especially useful on big log files, because `docker logs` without it prints everything from the start.

## Emergency: the disk is already full

If a log file has already filled the disk, you can empty it without stopping the container:

```bash
sudo truncate -s 0 $(docker inspect notes-api --format '{{.LogPath}}')
```

This sets the file size to zero. The container keeps running and keeps writing. Then fix the cause by adding rotation, so it does not happen again. Do **not** delete the file with `rm`: Docker keeps it open, so the space is not freed until the container restarts.

You can also find other big users of space with `docker system df`, as you learned in [Cleaning Up: Pruning Containers, Images and Volumes](/courses/docker/cleaning-up-docker).

## Common mistakes

### Changing daemon.json and expecting old containers to change

The daemon setting is a default for **new** containers only. Recreate your containers after changing it.

### Writing logs to a file inside the container

If your app writes `app.log` inside the container, Docker never sees it. It is not rotated by Docker, it is lost when the container is removed, and `docker logs` shows nothing. Log to stdout and stderr.

### Numbers instead of strings in compose

`max-file: 3` can cause an error. Use `max-file: "3"`.

### Logging too much

Rotation protects the disk, but if your app logs 1000 lines per second, you only keep the last few minutes. Log useful events, not every tiny step. Use log levels (info, warn, error) and turn off debug logs in production.

## Quick recap

- Apps in containers log to **stdout and stderr**; Docker passes each line to a **logging driver**.
- The default **json-file** driver has **no size limit**, which can fill your disk.
- Turn on **rotation** with `max-size` and `max-file`, or use the **local** driver, which rotates and compresses by default.
- Set logging per container (`--log-driver`, `--log-opt`), per service (`logging:` in compose), or for the whole server in `/etc/docker/daemon.json`.
- Daemon changes only affect **new** containers.
- Use `docker logs --tail` and `--since` to read big logs quickly.

Next, you will automate building and pushing images in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

<code id="code-content" class="language-yaml">
# compose.yaml: notes-api and PostgreSQL with log rotation on every service
# Any top-level key starting with "x-" is ignored by Compose, so it is a safe
# place for a reusable block. "&amp;" creates an anchor, "*" reuses it.
x-logging: &amp;default-logging
  # local: compact, compressed files, rotated automatically
  driver: local
  options:
    # Start a new file at 10 MB and keep 3 files: about 30 MB per container at most
    # Values must be strings, so keep the quotes
    max-size: "10m"
    max-file: "3"
services:
  api:
    image: notes-api:1.0.0
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
    depends_on:
      - db
    restart: unless-stopped
    logging: *default-logging
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    logging: *default-logging
volumes:
  pgdata:
#
# Server-wide default instead (Linux): put this in /etc/docker/daemon.json
#   { "log-driver": "local", "log-opts": { "max-size": "10m", "max-file": "3" } }
# then: sudo systemctl restart docker, and recreate containers to apply it.
#
# Read logs:  docker compose logs -f --tail 100 api
</code></pre>

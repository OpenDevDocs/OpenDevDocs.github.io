---
publishDate: 2026-10-25T16:10
title: 'Health Checks: Telling Docker Your App Is Working'
slug: healthchecks
metadescription: 'Learn how the HEALTHCHECK instruction lets Docker test that your app really works, what healthy and unhealthy mean, and how to write a good check.'
updateDate: 2026-10-25T16:10
author: ['bishal-biswas']
level: 2
tags: ['docker', 'dockerfile', 'healthcheck', 'reliability']
course: docker
---

## Running is not the same as working

When you run `docker ps`, a container shows `Up 5 minutes`. That only means the main process has not exited. It does **not** mean the app is doing its job.

The process could be stuck in an endless loop, waiting forever for a database, or out of memory and answering every request with an error. Docker would still say `Up`.

A **health check** fixes this. It is a small command that Docker runs inside the container again and again, to ask the app "are you OK?". Based on the answer, Docker marks the container as **healthy** or **unhealthy**.

In this lesson you will add a health check to the **notes-api** image, read the health status, tune the timing options, and learn what Docker does (and does not do) with an unhealthy container.

## The HEALTHCHECK instruction

notes-api already has a `GET /health` route that returns `ok`. We just need Docker to call it. Add a `HEALTHCHECK` line to the Dockerfile:

```docker
# syntax=docker/dockerfile:1
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "src/server.js"]
```

The rule for the check command is simple. Docker only looks at its **exit code** (the number a program returns when it finishes):

| Exit code | Meaning |
|---|---|
| `0` | Success: the container is healthy |
| `1` | Failure: the container is unhealthy |

`wget` exits with a non-zero code if the request fails or returns an error status. The `|| exit 1` part means "if the command before failed, exit with code 1", so Docker always gets a clean `0` or `1`.

> **Note:** The check runs **inside** the container, so `127.0.0.1` means the container itself, not your computer. You do not need to publish a port for the health check to work.

## The three health states

A container with a health check is always in one of three states:

| State | Meaning |
|---|---|
| `starting` | The container just started and has not passed a check yet |
| `healthy` | The last check passed |
| `unhealthy` | The check failed `retries` times in a row |

Build and run the image, then watch `docker ps`:

```bash
docker build -t notes-api:health .
docker run -d --name notes-api -p 3000:3000 notes-api:health
docker ps
```

```text
CONTAINER ID   IMAGE              STATUS                            PORTS                    NAMES
a81f3c2d9e04   notes-api:health   Up 4 seconds (health: starting)   0.0.0.0:3000->3000/tcp   notes-api
```

Wait a little and run `docker ps` again:

```text
CONTAINER ID   IMAGE              STATUS                    PORTS                    NAMES
a81f3c2d9e04   notes-api:health   Up 35 seconds (healthy)   0.0.0.0:3000->3000/tcp   notes-api
```

## The timing options

| Option | Default | What it controls |
|---|---|---|
| `--interval` | `30s` | Time between checks |
| `--timeout` | `30s` | How long one check may take before it counts as a failure |
| `--retries` | `3` | How many failures in a row make the container `unhealthy` |
| `--start-period` | `0s` | Grace time at startup. Failures here do not count towards `retries` |
| `--start-interval` | `5s` | Time between checks during the start period (needs Docker Engine 25 or newer) |

Some practical advice:

- Keep `--timeout` short (2 to 5 seconds). A health endpoint should answer almost instantly.
- Set `--start-period` to a bit more than your app's normal startup time. A Java app that needs 40 seconds to start will look unhealthy without it.
- With the default `--interval=30s` and `--retries=3`, a broken app is noticed after about 90 seconds. Lower the interval if you need faster detection, but remember every check costs a little CPU.

## Writing a good check command

### Use a tool that exists in the image

This is the most common problem. Many small images do **not** include `curl`:

| Base image | `curl` | `wget` |
|---|---|---|
| `node:24-alpine` | No | Yes (from BusyBox) |
| `node:24-slim` | No | No |
| `python:3.13-slim` | No | No |
| `nginx:1.29-alpine` | Yes | Yes |

You can install `curl` just for the check, but it is often better to use the language that is already there. For Node.js, the built-in `fetch` works everywhere:

```docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
```

For Python, use the standard library:

```docker
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" || exit 1
```

### Keep the health endpoint cheap

The check runs every few seconds, forever. The `/health` route should do very little: answer `ok` if the server can handle requests. Avoid slow work such as big database queries. If your app cannot work at all without its database, a quick `SELECT 1` is reasonable, but nothing heavier.

### Use exec form or shell form

Like `CMD`, `HEALTHCHECK CMD` accepts both forms. Shell form (a plain string) is run with `/bin/sh -c`, which lets you use `||`. Exec form (a JSON list) needs no shell:

```docker
HEALTHCHECK CMD ["node", "healthcheck.js"]
```

## Reading the health details

`docker inspect` shows the recent results, including any output from the check. This is very useful when a container is unhealthy and you want to know why:

```bash
docker inspect --format '{{json .State.Health}}' notes-api
```

```json
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2026-10-25T16:10:31.512Z",
      "End": "2026-10-25T16:10:31.598Z",
      "ExitCode": 0,
      "Output": ""
    }
  ]
}
```

(The real output is on one line; it is formatted here so it is easy to read.) Docker keeps the last five results in `Log`. You learned more about `docker inspect` in [Inspecting Containers: inspect, stats, top and diff](/courses/docker/inspecting-containers).

You can also watch health changes as they happen:

```bash
docker events --filter event=health_status
```

## Adding a health check at run time

You do not have to change a Dockerfile to add a check. `docker run` has matching flags. This is handy for images you did not build, such as the official Postgres image, which includes the `pg_isready` tool:

```bash
docker run -d --name db \
  -e POSTGRES_USER=notes -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=notes \
  --health-cmd "pg_isready -U notes -d notes" \
  --health-interval 10s --health-timeout 3s --health-retries 5 \
  postgres:17-alpine
```

To turn off a health check that an image defines, use `--no-healthcheck` with `docker run`, or `HEALTHCHECK NONE` in a Dockerfile that builds on that image.

## What Docker does with an unhealthy container

This surprises many people: on its own, plain Docker **only reports** the status. It does **not** restart an unhealthy container.

- [Restart policies](/courses/docker/restart-policies-and-resource-limits) such as `unless-stopped` react only when the main process **exits**, not when it is unhealthy.
- **Docker Compose** uses health status to control startup order. With `depends_on` and `condition: service_healthy`, the API waits until the database is healthy. You will use this in [Startup Order with depends_on and Health Checks](/courses/docker/compose-depends-on-and-healthchecks).
- **Orchestrators** such as Docker Swarm replace unhealthy containers automatically. Kubernetes has its own probes that work in a similar way, which you will meet in [From Docker to Kubernetes: What Comes Next](/courses/docker/docker-to-kubernetes-next-steps).
- Monitoring tools can read the status and alert you. See [Monitoring, Logging and Alerting](/courses/devops/monitoring-logging-and-alerting).

> **Tip:** A simple trick for single-server setups: make your app exit when it detects it is badly broken. Then a restart policy will restart it.

## Common mistakes

### Using `curl` in an image that does not have it

The check fails with "not found", and the container is unhealthy even though the app is fine. Run `docker inspect` to see the `Output`, then switch to a tool that exists in the image.

### Checking `localhost` on the wrong port

The check uses the port the app listens on **inside** the container (3000 for notes-api), not the published host port.

### No start period for a slow app

The container is marked unhealthy before the app has finished starting. Add `--start-period`.

### A health endpoint that does too much

If `/health` calls three other services, one slow service can mark every container unhealthy at the same time. Keep it simple and fast.

## Quick recap

- `Up` only means the process is running. A **health check** tests that the app really works.
- `HEALTHCHECK CMD ...` runs a command inside the container; exit code `0` is healthy, `1` is unhealthy.
- States are `starting`, `healthy` and `unhealthy`, shown in `docker ps`.
- Tune `--interval`, `--timeout`, `--retries` and `--start-period`.
- Use a tool that exists in the image; `curl` often does not.
- Plain Docker reports health but does not restart; Compose, Swarm and monitoring tools act on it.

Next, you will make your containers safer by not running them as root in [Running Containers as a Non-Root User](/courses/docker/running-as-non-root).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# notes-api with a health check.
# Build: docker build -t notes-api:health .
# Run:   docker run -d --name notes-api -p 3000:3000 notes-api:health
# Check: docker ps   (look for "healthy" in STATUS)
# Debug: docker inspect --format '{{json .State.Health}}' notes-api
#
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev &amp;&amp; npm cache clean --force
COPY . .
USER node
EXPOSE 3000
# Ask the app every 30s. Fail a check after 3s. Unhealthy after 3 failures in a row.
# Failures in the first 10s (startup) do not count.
# Uses Node's built-in fetch, because curl is not in node:24-alpine.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r =&gt; process.exit(r.ok ? 0 : 1)).catch(() =&gt; process.exit(1))"
# Exec form so node receives SIGTERM from docker stop
CMD ["node", "src/server.js"]
</code></pre>

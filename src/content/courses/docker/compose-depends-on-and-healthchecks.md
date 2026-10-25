---
publishDate: 2026-10-25T17:25
title: 'Startup Order with depends_on and Health Checks'
slug: compose-depends-on-and-healthchecks
metadescription: 'Learn how to start Compose services in the right order with depends_on, and how health checks make the API wait until the database is truly ready.'
updateDate: 2026-10-25T17:25
author: ['bishal-biswas']
level: 2
tags: ['docker', 'docker-compose', 'healthchecks']
course: docker
---

## The "database is not ready" problem

You run `docker compose up` for the first time. The API starts, tries to connect to PostgreSQL, and crashes:

```text
api-1  | Error: connect ECONNREFUSED 172.20.0.2:5432
api-1 exited with code 1
db-1   | LOG:  database system is ready to accept connections
```

Look at the order. The API tried to connect **before** the database was ready. A PostgreSQL container needs a few seconds on first start to create its files. During that time the container is "running", but the database inside it is not accepting connections yet.

In this lesson you will fix this properly. You will learn:

- what `depends_on` does, and what it does **not** do
- how to add a **health check** to a Compose service
- how `condition: service_healthy` makes one service wait for another
- how to run one-off jobs, such as database migrations, before the app starts

## depends_on: the short form

The `depends_on` key tells Compose that one service needs another. In its short form it is a list of service names:

```yaml
services:
  api:
    build: .
    depends_on:
      - db            # start db before api
  db:
    image: postgres:17-alpine
```

This changes two things:

1. **Start order.** `docker compose up` starts `db` first, then `api`. `docker compose down` stops them in the reverse order.
2. **Automatic start.** `docker compose up api` also starts `db`, because `api` needs it.

But here is the important part: the short form only waits until the `db` **container has started**. It does not wait until PostgreSQL inside it is ready. So the crash from the start of this lesson can still happen.

> **Note:** "Container started" and "app ready" are different moments. A container starts in milliseconds. The app inside may need seconds to load data, run setup or open its port.

## Health checks: how Docker knows an app is ready

A **health check** is a small command that Docker runs inside the container again and again. If the command succeeds (exit code 0), the container is **healthy**. If it keeps failing, the container is **unhealthy**.

You met the `HEALTHCHECK` Dockerfile instruction in [Health Checks: Telling Docker Your App Is Working](/courses/docker/healthchecks). In Compose you can write the same thing with the `healthcheck` key, which is handy for images you did not build yourself, such as `postgres`.

PostgreSQL ships with a tool called `pg_isready` that checks if the server accepts connections. It is perfect for this:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "notes", "-d", "notes"]
      interval: 5s          # run the check every 5 seconds
      timeout: 3s           # a check that takes longer than 3s counts as failed
      retries: 5            # unhealthy after 5 failures in a row
      start_period: 10s     # failures in the first 10s do not count
```

Here is what each option means:

| Option | Meaning |
|---|---|
| `test` | The command to run. `CMD` runs it directly. `CMD-SHELL` runs it through a shell, so you can use `&&` or `\|\|` |
| `interval` | Time between checks |
| `timeout` | How long one check may take |
| `retries` | How many failures in a row make the container unhealthy |
| `start_period` | A warm-up time. Failures here do not count, but one success marks it healthy straight away |

Start it and watch the status change:

```bash
docker compose up -d db
docker compose ps
```

```text
NAME        IMAGE                COMMAND                  SERVICE   STATUS                            PORTS
notes-db-1  postgres:17-alpine   "docker-entrypoint.s…"   db        Up 3 seconds (health: starting)   5432/tcp
```

A few seconds later:

```text
NAME        IMAGE                COMMAND                  SERVICE   STATUS                    PORTS
notes-db-1  postgres:17-alpine   "docker-entrypoint.s…"   db        Up 15 seconds (healthy)   5432/tcp
```

## depends_on: the long form with conditions

Now connect the two ideas. The long form of `depends_on` lets you say **what** to wait for:

```yaml
services:
  api:
    build: .
    depends_on:
      db:
        condition: service_healthy    # wait until db's health check passes
  db:
    image: postgres:17-alpine
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "notes", "-d", "notes"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
```

Now `docker compose up` starts `db`, waits until it is **healthy**, and only then starts `api`. The crash is gone.

There are three conditions you can use:

| Condition | Compose waits until... | Typical use |
|---|---|---|
| `service_started` | the container has started (same as the short form) | services that are ready instantly |
| `service_healthy` | the health check passes | databases, caches, other APIs |
| `service_completed_successfully` | the container has **exited with code 0** | one-off jobs like migrations |

If the dependency never becomes healthy, Compose stops and shows an error instead of starting the app:

```text
dependency failed to start: container notes-db-1 is unhealthy
```

## Health checks for Redis and for notes-api

Most services have a simple way to check themselves. For Redis, the `redis-cli ping` command answers `PONG` when the server is ready:

```yaml
  cache:
    image: redis:8-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

For your own notes-api, the `/health` endpoint already returns `ok`. The `node:24-alpine` image has no `curl`, but Node itself has `fetch`, so you can use a one-line Node script:

```yaml
  api:
    build: .
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
```

> **Tip:** If the image already has a `HEALTHCHECK` in its Dockerfile, Compose uses it automatically. You only need `healthcheck` in `compose.yaml` to add one or to change it. Use `healthcheck: { disable: true }` to turn an image's check off.

## One-off jobs: migrations before the app

Many apps need a setup step before they start, such as creating database tables. This is called a **migration**. You can run it as its own short-lived service, and make the API wait until it finishes successfully.

```yaml
services:
  migrate:
    build: .
    command: ["node", "src/migrate.js"]   # creates tables, then exits
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
    depends_on:
      db:
        condition: service_healthy

  api:
    build: .
    depends_on:
      migrate:
        condition: service_completed_successfully   # wait for exit code 0
      db:
        condition: service_healthy
```

The order is now: `db` starts and becomes healthy, `migrate` runs and exits with code 0, and then `api` starts. If the migration fails, the API does not start, which is exactly what you want.

## Waiting from the command line with --wait

When a script or a test needs the whole stack ready, add `--wait` to `docker compose up`. Compose then waits until all services are running and healthy before it returns:

```bash
docker compose up -d --wait
curl http://localhost:3000/health
```

```text
ok
```

This is very useful in CI pipelines, where the next step runs tests against the app. You will build such a pipeline in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

## depends_on is not enough on its own

Health checks fix the **startup** problem. But databases can also restart later: after an upgrade, a crash or a server reboot. Compose does not stop your API when the database goes away for a moment.

So your app should still be **resilient**: when a connection fails, it should wait a little and try again, instead of crashing forever. A simple retry loop is enough for notes-api:

```javascript
// Try to connect up to 10 times, waiting 2 seconds between tries
async function connectWithRetry(connect, tries = 10) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await connect();
    } catch (err) {
      console.log(`database not ready (try ${i}/${tries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('could not connect to the database');
}
```

Add a restart policy as a safety net, as you learned in [Restart Policies and Resource Limits](/courses/docker/restart-policies-and-resource-limits):

```yaml
  api:
    restart: unless-stopped
```

Health checks, `depends_on` and retries work together. None of them alone is the full answer.

## Common mistakes

### Using the short form and expecting it to wait

`depends_on: [db]` only orders the start. It does not wait for PostgreSQL. Use the long form with `condition: service_healthy`, and give `db` a health check.

### A health check that uses a missing tool

`test: ["CMD", "curl", "-f", "http://localhost:3000/health"]` fails forever in images that do not have `curl`, such as `node:24-alpine`. Check what is in the image with `docker compose exec api which curl`, or use a tool the image already has.

### Checking localhost from the wrong place

The health check runs **inside** the container. So `127.0.0.1` means the container itself, which is correct. Do not use the host port you published with `ports`. Use the port the app listens on inside the container.

### A timeout that is too short

If the check sometimes takes longer than `timeout`, the container may flip between healthy and unhealthy. Give slow services a longer `timeout` and a generous `start_period`.

## Quick recap

- Short `depends_on` only controls **start order**. It does not wait for the app to be ready.
- A **health check** is a command Docker runs repeatedly. Exit code 0 means healthy.
- Use `pg_isready` for PostgreSQL, `redis-cli ping` for Redis, and your own `/health` endpoint for your app.
- Long `depends_on` with `condition: service_healthy` makes a service wait for a healthy dependency.
- `service_completed_successfully` is for one-off jobs such as migrations.
- `docker compose up --wait` waits for a healthy stack. Your app should still retry connections.

Next, you will make Compose great for day-to-day coding in [Local Development with Compose: Bind Mounts and Watch](/courses/docker/compose-for-local-development).

<code id="code-content" class="language-yaml">
# compose.yaml for notes-api: start order with health checks
# Start everything and wait until it is healthy:  docker compose up -d --wait
# Check the status column:                        docker compose ps
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      # pg_isready exits with 0 when PostgreSQL accepts connections
      test: ["CMD", "pg_isready", "-U", "notes", "-d", "notes"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
  cache:
    image: redis:8-alpine
    healthcheck:
      # redis-cli ping answers PONG when Redis is ready
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
  migrate:
    # A one-off job: create tables, then exit with code 0
    build: .
    command: ["node", "src/migrate.js"]
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
    depends_on:
      db:
        condition: service_healthy
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
      REDIS_URL: redis://cache:6379
    depends_on:
      # Wait for the migration to finish, and for db and cache to be healthy
      migrate:
        condition: service_completed_successfully
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    healthcheck:
      # node:24-alpine has no curl, so use Node's built-in fetch
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then(r =&gt; process.exit(r.ok ? 0 : 1)).catch(() =&gt; process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
    # A safety net if the app crashes later
    restart: unless-stopped
volumes:
  pgdata:
</code></pre>

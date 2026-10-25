---
publishDate: 2026-10-25T18:35
title: 'Capstone: Containerize a Full-Stack App'
slug: capstone-full-stack-app
metadescription: 'Put the whole Docker course together: containerize notes-api, PostgreSQL and an nginx frontend with Compose, health checks, CI and a server deployment.'
updateDate: 2026-10-25T18:35
author: ['bishal-biswas']
level: 3
tags: ['docker', 'docker-compose', 'project', 'deployment']
course: docker
---

## The final project

You have learned a lot in this course: images, Dockerfiles, volumes, networks, Compose, health checks, security, CI and deployment. Now you will use all of it together to build one complete app, from an empty folder to a running website on a server.

You will containerize a small **full-stack app**. "Full-stack" means it has every part a real web app has:

- a **frontend**: the web page people see, served by **nginx**,
- a **backend**: the `notes-api` Node.js API you have used all course,
- a **database**: **PostgreSQL**, which stores the notes.

When you are done, you will be able to open a page, type a note, and see it saved in the database. More importantly, you will have a project structure you can copy for your own apps.

> **Note:** This is a long lesson. Take it one part at a time. Each part ends with something you can run and check, so you always know you are on the right track.

## What you will build

```text
              Browser
                 |
                 |  http://localhost:8080
                 v
        +------------------+
        |  web  (nginx)    |   serves index.html and app.js
        |                  |   forwards /api/... to the api
        +------------------+
                 |  "frontend" network
                 v
        +------------------+
        |  api  (Node.js)  |   GET /health, GET /notes, POST /notes
        +------------------+
                 |  "backend" network (internal, no internet)
                 v
        +------------------+
        |  db  (Postgres)  |----- pgdata volume (the notes live here)
        +------------------+
```

Some design choices, and the lessons they come from:

| Choice | Why | Lesson |
|---|---|---|
| Only `web` publishes a port | One door from outside; the api and db stay private | [Publishing Ports](/courses/docker/publishing-ports) |
| Two networks | The web server cannot talk to the database at all | [Bridge Networks and Container DNS](/courses/docker/user-defined-bridge-networks) |
| A named volume for the database | Notes survive container updates | [Docker Volumes](/courses/docker/docker-volumes) |
| Health checks on every service | Services start in the right order and you can see their state | [Startup Order with depends_on and Health Checks](/courses/docker/compose-depends-on-and-healthchecks) |
| nginx proxies `/api/` | The browser talks to one address, so there are no CORS problems | [Reverse Proxies and Load Balancers](/courses/devops/reverse-proxies-and-load-balancers) |

**CORS** (Cross-Origin Resource Sharing) is a browser rule that blocks a page on one address from freely calling an API on another address. Because the page and the API share the same address here (`localhost:8080`), the rule never gets in the way.

## Project layout

Create this folder structure:

```text
notes-app/
  compose.yaml              # the production-ready description of the app
  compose.override.yaml     # extra settings for local development only
  .env.example              # example settings, safe to commit
  .env                      # your real settings, never committed
  .gitignore
  api/
    Dockerfile
    .dockerignore
    package.json
    package-lock.json
    src/
      server.js
  web/
    Dockerfile
    nginx.conf
    public/
      index.html
      app.js
```

Each service gets its **own folder** with its own Dockerfile. That keeps each build context small, as you learned in [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore).

## Part 1: the API

### package.json

```json
{
  "name": "notes-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js"
  },
  "dependencies": {
    "pg": "^8.16.0"
  }
}
```

`pg` is the most common PostgreSQL client for Node.js. Run `npm install` once inside `api/` to create `package-lock.json`. The Dockerfile needs that lock file, so `npm ci` installs the exact same versions every time. See [Semver and Lockfiles](/courses/nodejs/semver-and-lockfiles).

### src/server.js

This is the same `notes-api` from earlier lessons, now with real storage in PostgreSQL:

```javascript
import http from 'node:http';
import pg from 'pg';

const port = Number(process.env.PORT ?? 3000);

// A pool keeps a few database connections open and reuses them
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Create the table on startup if it does not exist yet
await pool.query(`
  CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || '{}');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return res.end('ok');
    }

    if (req.method === 'GET' && req.url === '/notes') {
      const { rows } = await pool.query(
        'SELECT id, text, created_at FROM notes ORDER BY id DESC LIMIT 50'
      );
      return sendJson(res, 200, rows);
    }

    if (req.method === 'POST' && req.url === '/notes') {
      const { text } = await readJson(req);
      if (typeof text !== 'string' || text.trim() === '') {
        return sendJson(res, 400, { error: 'text is required' });
      }
      // $1 is a placeholder: pg sends the value separately, which prevents SQL injection
      const { rows } = await pool.query(
        'INSERT INTO notes (text) VALUES ($1) RETURNING id, text, created_at',
        [text.trim().slice(0, 500)]
      );
      return sendJson(res, 201, rows[0]);
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'internal error' });
  }
});

// 0.0.0.0 so requests from other containers can reach it
server.listen(port, '0.0.0.0', () => {
  console.log(`notes-api listening on port ${port}`);
});

// docker stop and docker compose down send SIGTERM: finish requests, close the pool, exit
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
```

Three Docker details are worth noticing:

- It reads all settings from **environment variables** (`PORT`, `DATABASE_URL`). The same image works on your laptop and on the server. See [Configuring Containers with Environment Variables](/courses/docker/environment-variables).
- It listens on **0.0.0.0**, not 127.0.0.1.
- It handles **SIGTERM**, so stopping is fast and clean. See [Graceful Shutdown](/courses/nodejs/graceful-shutdown).

### api/.dockerignore

```text
node_modules
npm-debug.log
.env
.git
Dockerfile
.dockerignore
```

### api/Dockerfile

```docker
# syntax=docker/dockerfile:1

# ---------- Stage 1: install production dependencies ----------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# A cache mount keeps npm's download cache between builds (it is not saved in the image)
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# ---------- Stage 2: the final, small image ----------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Run as the unprivileged "node" user that the official image provides
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
```

This uses ideas from several lessons: [Layer Caching](/courses/docker/layer-caching) (package files first), [Multi-Stage Builds](/courses/docker/multi-stage-builds), [BuildKit Cache Mounts](/courses/docker/buildkit-cache-and-secret-mounts), [Running as Non-Root](/courses/docker/running-as-non-root) and the exec form of `CMD` from [CMD vs ENTRYPOINT](/courses/docker/cmd-vs-entrypoint).

There is no `HEALTHCHECK` in this Dockerfile. You will define the health check in `compose.yaml` instead, so all three services are configured in one place. Both ways work.

**Check point:** build it on its own to make sure the Dockerfile is correct.

```bash
cd notes-app
docker build -t notes-api:dev ./api
```

```text
 => [deps 4/4] RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev     3.1s
 => [stage-1 5/5] COPY src ./src                                              0.0s
 => exporting to image                                                        0.2s
 => => naming to docker.io/library/notes-api:dev                              0.0s
```

## Part 2: the frontend

The frontend is just two static files. nginx serves them, and forwards API calls.

### web/public/index.html

The course code blocks do not have an HTML highlighter, so this one is shown as plain text:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Notes</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
    form { display: flex; gap: 0.5rem; }
    input { flex: 1; padding: 0.5rem; }
  </style>
</head>
<body>
  <h1>Notes</h1>
  <form id="note-form">
    <input id="note-text" placeholder="Write a note" maxlength="500" required>
    <button>Add</button>
  </form>
  <ul id="notes"></ul>
  <script src="app.js"></script>
</body>
</html>
```

### web/public/app.js

```javascript
const list = document.querySelector('#notes');
const form = document.querySelector('#note-form');
const input = document.querySelector('#note-text');

async function loadNotes() {
  // A relative URL: the browser calls the same address the page came from
  const res = await fetch('/api/notes');
  const notes = await res.json();
  list.replaceChildren(
    ...notes.map((note) => {
      const li = document.createElement('li');
      li.textContent = note.text; // textContent, not innerHTML: safe from HTML injection
      return li;
    })
  );
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await fetch('/api/notes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: input.value }),
  });
  input.value = '';
  loadNotes();
});

loadNotes();
```

### web/nginx.conf

This file replaces nginx's default site. It does two jobs: serve the static files, and **proxy** (forward) every request that starts with `/api/` to the api container.

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # The frontend: static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # The backend: /api/notes is forwarded to http://api:3000/notes
    location /api/ {
        # "api" is the compose service name; Docker's DNS turns it into an IP address.
        # The trailing slash removes the /api/ prefix before forwarding.
        proxy_pass http://api:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The trailing slash in `proxy_pass http://api:3000/;` matters. With it, `/api/notes` becomes `/notes` on the api. Without it, the api would receive `/api/notes` and answer 404.

### web/Dockerfile

```docker
# syntax=docker/dockerfile:1
FROM nginx:1.29-alpine
# Our site config replaces the default one
COPY nginx.conf /etc/nginx/conf.d/default.conf
# The static frontend
COPY public/ /usr/share/nginx/html/
# The nginx image already sets EXPOSE 80 and the right CMD
```

That is the whole Dockerfile. The official nginx image does the rest.

**Check point:**

```bash
docker build -t notes-web:dev ./web
```

Do not run it on its own yet. nginx checks that the name `api` exists when it starts, and there is no `api` until Compose creates one. You will see that error in the "Common mistakes" section.

## Part 3: the compose file

Now connect the three services. The complete `compose.yaml` is in the code panel. Let us walk through it piece by piece.

### Settings in .env

Compose reads `.env` in the project folder and fills in every `${VARIABLE}` in the compose file. Commit an example file, and keep the real one private:

```text
# .env.example: copy to .env and change the values
TAG=dev
POSTGRES_PASSWORD=devpassword
```

```text
# .gitignore
.env
api/node_modules
```

```bash
cp .env.example .env
```

> **Tip:** Use only letters and numbers in `POSTGRES_PASSWORD`. The password is placed inside `DATABASE_URL`, and characters like `@`, `/` or `:` would break the URL. `openssl rand -hex 24` makes a good one.

You learned this in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets).

### The db service

```yaml
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_DB: notes
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notes -d notes"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
```

- `${POSTGRES_PASSWORD:?...}` means "stop with this message if the variable is missing". Much better than starting a database with an empty password.
- `pg_isready` is a small tool inside the postgres image that answers "is the database accepting connections?".
- No `ports:`. Nothing outside Docker can reach the database.

### The api service

```yaml
  api:
    image: ghcr.io/your-name/notes-api:${TAG:-dev}
    environment:
      PORT: "3000"
      DATABASE_URL: postgres://notes:${POSTGRES_PASSWORD}@db:5432/notes
    networks:
      - frontend
      - backend
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
```

- `image:` names the image with a **tag variable**. Locally `TAG` is `dev`. On the server it will be a real version like `1.0.0`.
- `@db:5432` uses the service name `db` as the host name.
- `condition: service_healthy` makes the api wait until PostgreSQL really accepts connections, not just until its container has started. Without it, the `CREATE TABLE` on startup would often fail.
- The health check uses Node's built-in `fetch`, because the Alpine Node image has no `curl`.
- The last block hardens the container, exactly as in [Container Security Best Practices](/courses/docker/container-security-best-practices).

### The web service

```yaml
  web:
    image: ghcr.io/your-name/notes-web:${TAG:-dev}
    ports:
      - "127.0.0.1:8080:80"
    networks:
      - frontend
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1/"]
      interval: 10s
      timeout: 3s
      retries: 3
```

- The only published port. It is bound to `127.0.0.1`, so on a server only a local reverse proxy can reach it. On your own computer, `http://localhost:8080` still works.
- It waits for a **healthy** api, which also solves nginx's "host not found" problem at startup.
- `wget` comes with Alpine's BusyBox tools, so it is available in the nginx Alpine image. `--spider` checks the page without downloading it.

### Networks, volumes and logging

```yaml
networks:
  frontend:
  backend:
    internal: true    # no internet access for containers only on this network

volumes:
  pgdata:
```

`web` is only on `frontend`, and `db` is only on `backend`. So the web server cannot reach the database even if someone breaks into it. The `api` is on both and acts as the bridge between them. The full file also sets **log rotation** for every service with a YAML anchor, as in [Logging Drivers and Log Rotation](/courses/docker/logging-drivers).

### compose.override.yaml: development extras

`compose.yaml` only says which **images** to run. For local work you also want Compose to **build** them, and to update the containers when you save a file. Put that in `compose.override.yaml`. Compose merges it automatically when it is present:

```yaml
# compose.override.yaml: local development only (do not copy this to the server)
services:
  api:
    build: ./api
    develop:
      watch:
        - action: sync+restart        # copy changed code in, then restart the app
          path: ./api/src
          target: /app/src
        - action: rebuild             # dependencies changed: rebuild the image
          path: ./api/package.json
  web:
    build: ./web
    develop:
      watch:
        - action: sync                # nginx serves the new files right away
          path: ./web/public
          target: /usr/share/nginx/html
        - action: rebuild
          path: ./web/nginx.conf
```

You learned this split in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides) and the watch feature in [Local Development with Compose](/courses/docker/compose-for-local-development).

## Part 4: run it and test it

From the `notes-app` folder:

```bash
docker compose up --build -d
```

Watch the services start in order: db first, then api, then web.

```bash
docker compose ps
```

```text
NAME              IMAGE                             SERVICE   STATUS                    PORTS
notes-app-api-1   ghcr.io/your-name/notes-api:dev   api       Up 25 seconds (healthy)   3000/tcp
notes-app-db-1    postgres:17-alpine                db        Up 31 seconds (healthy)   5432/tcp
notes-app-web-1   ghcr.io/your-name/notes-web:dev   web       Up 12 seconds (healthy)   127.0.0.1:8080->80/tcp
```

All three say `(healthy)`. If one does not, jump to "Common mistakes" below, or use the method from [Debugging Containers That Will Not Start](/courses/docker/debugging-containers).

### Test through nginx, like the browser does

```bash
curl http://localhost:8080/api/health
```

```text
ok
```

```bash
curl -X POST http://localhost:8080/api/notes \
  -H 'content-type: application/json' \
  -d '{"text":"Hello from the capstone"}'
```

```json
{"id":1,"text":"Hello from the capstone","created_at":"2026-10-25T18:40:12.345Z"}
```

```bash
curl http://localhost:8080/api/notes
```

```json
[{"id":1,"text":"Hello from the capstone","created_at":"2026-10-25T18:40:12.345Z"}]
```

Now open `http://localhost:8080` in your browser. You see the page, the note you just added, and you can add more.

### Test that the data survives

```bash
docker compose down        # removes containers and networks, but keeps volumes
docker compose up -d
curl http://localhost:8080/api/notes
```

Your note is still there, because it lives in the `pgdata` volume, not in the container.

> **Warning:** `docker compose down -v` also deletes **volumes**. Locally, that is a handy way to start fresh. On a server, it deletes your data.

### Test graceful shutdown

```bash
time docker compose stop api
docker compose logs api --tail 3
```

```text
notes-app-api-1  | SIGTERM received, shutting down
```

The stop takes well under a second. If it took about 10 seconds, the app would not be receiving the signal, and Docker would have to kill it. Start it again with `docker compose start api`.

### Test the network separation

```bash
# web cannot reach the database: they share no network
docker compose exec web wget -q -T 2 -O- http://db:5432 || echo "blocked, as planned"
```

```text
wget: bad address 'db:5432'
blocked, as planned
```

## Part 5: check quality and security

A few quick checks that a real team would do before shipping.

### Image sizes

```bash
docker images --filter reference='ghcr.io/your-name/*'
```

```text
REPOSITORY                    TAG   IMAGE ID       CREATED         SIZE
ghcr.io/your-name/notes-api   dev   3c4d5e6f7a8b   5 minutes ago   170MB
ghcr.io/your-name/notes-web   dev   9a8b7c6d5e4f   5 minutes ago   52MB
```

Your numbers will differ a little, but both images should be small, thanks to Alpine bases and the multi-stage build. Compare with the full `node:24` base, which alone is over 1 GB.

### Who is the app running as?

```bash
docker compose exec api id
```

```text
uid=1000(node) gid=1000(node) groups=1000(node)
```

Not root. Good.

### Known vulnerabilities

```bash
docker scout quickview ghcr.io/your-name/notes-api:dev
docker scout quickview ghcr.io/your-name/notes-web:dev
```

Fix any critical or high CVEs that have a fix, usually by rebuilding with `--pull`. See [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout).

## Part 6: build and push with CI

Each service needs its own image in the registry. A GitHub Actions **matrix** runs the same job once per service. Put this in `.github/workflows/images.yml`:

```yaml
name: images

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        service: [api, web]          # one run for ./api, one for ./web
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        if: github.event_name != 'pull_request'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/your-name/notes-${{ matrix.service }}
          tags: |
            type=sha
            type=semver,pattern={{version}}
      - uses: docker/build-push-action@v6
        with:
          context: ./${{ matrix.service }}
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}
```

The `scope` keeps the two services' build caches apart. To release, push a Git tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

CI pushes `ghcr.io/your-name/notes-api:1.0.0` and `ghcr.io/your-name/notes-web:1.0.0`. Every step here is explained in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

## Part 7: deploy to a server

Follow [Deploying a Compose App to a Linux Server](/courses/docker/deploying-with-docker-on-a-server) to prepare an Ubuntu server with Docker Engine and a firewall. Then the deploy itself is short, because `compose.yaml` was written for production from the start.

### Copy only what the server needs

The server needs exactly two files. No source code, no override file:

```bash
# On your computer
ssh deploy@203.0.113.10 'mkdir -p /opt/notes-app'
scp compose.yaml deploy@203.0.113.10:/opt/notes-app/
```

Create the real `.env` on the server:

```bash
# On the server
cd /opt/notes-app
nano .env
chmod 600 .env
```

```text
TAG=1.0.0
POSTGRES_PASSWORD=change-me-use-openssl-rand-hex-24
```

### Pull and start

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Because there is no `compose.override.yaml` on the server, there is no `build:` key, so Compose only pulls and runs the images CI built. The exact same images you tested.

### Add HTTPS

The web service listens on `127.0.0.1:8080` only. Put the host nginx and certbot setup from the deployment lesson in front, with one change in the proxy line:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;      # the notes-app web container
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then run `sudo certbot --nginx -d notes.example.com`, and your app is live at `https://notes.example.com`.

### Update and roll back

```bash
# Deploy 1.1.0
sed -i 's/^TAG=.*/TAG=1.1.0/' .env
docker compose pull
docker compose up -d

# Something wrong? Go back to 1.0.0
sed -i 's/^TAG=.*/TAG=1.0.0/' .env
docker compose up -d
```

### Back up the notes

```bash
docker compose exec -T db pg_dump -U notes notes > notes-$(date +%F).sql
```

Run it every night with cron and copy the file off the server.

## Common mistakes

### nginx exits with "host not found in upstream"

```text
nginx: [emerg] host not found in upstream "api" in /etc/nginx/conf.d/default.conf:17
```

nginx looks up `api` when it starts. If the api container does not exist yet, or is not on the same network, nginx stops. Check that `web` and `api` share the `frontend` network and that `web` has `depends_on: api: condition: service_healthy`.

### 502 Bad Gateway after recreating the api

nginx remembers the api's IP address from when it started. If the api container is recreated and gets a new IP, nginx may still send requests to the old one. The quick fix is `docker compose restart web`. A permanent fix is to tell nginx to use Docker's internal DNS server (`resolver 127.0.0.11`) and put the upstream address in a variable, which makes nginx look the name up again regularly.

### 404 from the api for every /api/ request

The trailing slash is missing in `proxy_pass http://api:3000/;`, so the api receives `/api/notes` instead of `/notes`.

### The api restarts with "password authentication failed"

PostgreSQL only uses `POSTGRES_PASSWORD` the **first time** it creates the database in an empty volume. If you change the password in `.env` later, the database still has the old one. Locally, start fresh with `docker compose down -v`. On a server, change the password inside PostgreSQL with `ALTER USER` instead.

### "required variable POSTGRES_PASSWORD is missing a value"

You have no `.env` file, or it is in a different folder. Run `cp .env.example .env` in the folder that holds `compose.yaml`.

### Changes to the frontend do not appear

You are running without watch, and the files are baked into the image. Use `docker compose up --watch`, or rebuild with `docker compose up --build -d`. Also try a hard refresh in the browser, which skips its cache.

## What you practiced

| Skill | Where in this project |
|---|---|
| Writing Dockerfiles | `api/Dockerfile`, `web/Dockerfile` |
| Layer caching, multi-stage, cache mounts | `api/Dockerfile` |
| `.dockerignore` and build contexts | `api/.dockerignore`, one folder per service |
| Non-root, read-only, dropped capabilities | `api` service |
| Volumes | `pgdata` |
| User-defined and internal networks | `frontend` and `backend` |
| Health checks and startup order | every service, `depends_on` |
| Environment variables and `.env` | `TAG`, `POSTGRES_PASSWORD`, `DATABASE_URL` |
| Override files and watch | `compose.override.yaml` |
| Log rotation | the `x-logging` anchor |
| Scanning | `docker scout quickview` |
| CI, tags and registries | `.github/workflows/images.yml` |
| Deployment, updates, rollback, backups | Part 7 |

## Ideas to extend it

When this works, try one or more of these on your own:

- Add **Redis** (`redis:8-alpine`, service name `cache`) on the backend network and cache the `GET /notes` result for a few seconds.
- Use a Compose **secret** file for the database password instead of an environment variable. The postgres image supports `POSTGRES_PASSWORD_FILE`.
- Add a `DELETE /notes/:id` endpoint and a delete button.
- Build both images for `linux/amd64` and `linux/arm64` with [Multi-Platform Images with Buildx](/courses/docker/multi-platform-builds).
- Add a CI step that fails on critical CVEs.
- Write the Kubernetes manifests for all three services, starting from [From Docker to Kubernetes: What Comes Next](/courses/docker/docker-to-kubernetes-next-steps).

## Quick recap

- A full-stack app becomes **three services**: `web` (nginx), `api` (Node.js) and `db` (PostgreSQL), each with its own image.
- Only `web` publishes a port; nginx serves the frontend and **proxies `/api/`** to the api by service name.
- Two networks keep the web server away from the database; a **named volume** keeps the data.
- **Health checks** plus `depends_on: condition: service_healthy` start everything in the right order.
- `compose.yaml` describes production, and `compose.override.yaml` adds builds and watch for development.
- CI builds and tags both images; the server only needs `compose.yaml` and `.env` to pull, run, update and roll back.

Congratulations, you have finished the Docker course! You can now take almost any app, put it in containers, and run it reliably from your laptop to a server. To keep going, explore the wider pipeline in the DevOps course, starting with [What is DevOps?](/courses/devops/what-is-devops), or revisit the beginning with [What is Docker and Why Use It?](/courses/docker/what-is-docker) and see how much you have learned.

<code id="code-content" class="language-yaml">
# compose.yaml: the notes-app capstone (nginx frontend, Node.js API, PostgreSQL)
# Local:  cp .env.example .env, then docker compose up --build -d   (compose.override.yaml adds build and watch)
# Server: copy only this file plus a real .env, then docker compose pull &amp;&amp; docker compose up -d
# Open:   http://localhost:8080
#
# .env holds:  TAG=dev  and  POSTGRES_PASSWORD=devpassword  (letters and numbers only)
name: notes-app
# Log rotation for every service: "&amp;" creates the anchor, "*" reuses it
x-logging: &amp;default-logging
  driver: local
  options:
    max-size: "10m"
    max-file: "3"
services:
  # ---------- web: nginx serves the frontend and proxies /api/ to the api ----------
  web:
    image: ghcr.io/your-name/notes-web:${TAG:-dev}
    # The only published port; 127.0.0.1 so on a server only the local reverse proxy reaches it
    ports:
      - "127.0.0.1:8080:80"
    # Only on frontend: the web server can never reach the database
    networks:
      - frontend
    # Start after the api is healthy (nginx needs the name "api" to exist)
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1/"]
      interval: 10s
      timeout: 3s
      retries: 3
    restart: unless-stopped
    logging: *default-logging
  # ---------- api: the Node.js notes-api ----------
  api:
    image: ghcr.io/your-name/notes-api:${TAG:-dev}
    environment:
      PORT: "3000"
      # "db" is the service name below; Docker DNS turns it into an IP address
      DATABASE_URL: postgres://notes:${POSTGRES_PASSWORD}@db:5432/notes
    # No ports: only nginx talks to it, over the frontend network
    networks:
      - frontend
      - backend
    # Wait until PostgreSQL really accepts connections
    depends_on:
      db:
        condition: service_healthy
    # Node's built-in fetch, because the Alpine Node image has no curl
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) =&gt; process.exit(r.ok ? 0 : 1)).catch(() =&gt; process.exit(1))"]
      interval: 10s
      timeout: 3s
      retries: 3
      start_period: 10s
    # Hardening: read-only files, temp folder in memory, no capabilities, no escalation
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    mem_limit: 256m
    restart: unless-stopped
    logging: *default-logging
  # ---------- db: PostgreSQL stores the notes ----------
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_DB: notes
      # Stop with a clear message if the password is missing from .env
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
    # The data lives in a named volume and survives updates (docker compose down -v deletes it!)
    volumes:
      - pgdata:/var/lib/postgresql/data
    # No ports and only on the internal backend network
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notes -d notes"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    restart: unless-stopped
    logging: *default-logging
networks:
  frontend:
  backend:
    # Containers only on this network get no internet access
    internal: true
volumes:
  pgdata:
</code></pre>

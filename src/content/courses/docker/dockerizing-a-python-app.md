---
publishDate: 2026-10-25T16:25
title: 'Project: Dockerizing a Python App'
slug: dockerizing-a-python-app
metadescription: 'Containerize a small Flask app step by step: a slim Python base image, cached pip installs, gunicorn, a non-root user, a health check and clean shutdown.'
updateDate: 2026-10-25T16:25
author: ['bishal-biswas']
level: 2
tags: ['docker', 'python', 'flask', 'project']
course: docker
---

## What you will build

In the last project you containerized a Node.js API. Now you will do the same for a Python web app called **quotes-app**. It is a tiny **Flask** app (Flask is a popular, small web framework for Python) that returns a random quote.

The ideas are the same as before, but Python has a few details of its own:

- Which base image to use (`python:3.13-slim`, not Alpine)
- Installing packages with `pip` in a cache-friendly way
- Two environment variables that every Python container should set
- Running the app with **gunicorn**, a production web server, instead of Flask's development server

By the end you will have a small, safe image that runs as a non-root user, reports its health and stops cleanly.

## Step 1: create the app

```text
quotes-app/
  app.py
  requirements.txt
  .dockerignore
  Dockerfile
```

`requirements.txt` lists the packages the app needs. Pin them to a range so builds are repeatable:

```text
Flask>=3.1,<4
gunicorn>=23,<24
```

> **Tip:** For fully repeatable builds, pin exact versions (for example with `pip freeze > requirements.txt` from a working environment, or with a lock tool). It is the Python version of `package-lock.json`, which you met in [Semver and Lockfiles](/courses/nodejs/semver-and-lockfiles).

Now `app.py`:

```python
import random

from flask import Flask, jsonify

app = Flask(__name__)

QUOTES = [
    {"text": "Simple is better than complex.", "author": "The Zen of Python"},
    {"text": "Readability counts.", "author": "The Zen of Python"},
    {"text": "Errors should never pass silently.", "author": "The Zen of Python"},
]


@app.get("/health")
def health():
    # Cheap check used by Docker's HEALTHCHECK
    return "ok"


@app.get("/quote")
def quote():
    return jsonify(random.choice(QUOTES))
```

Notice there is no `app.run()` at the bottom. Gunicorn will import `app` from `app.py` and run it. The name `app:app` that you will see later means "the `app` object inside the `app` module (file)".

## Step 2: add a .dockerignore

```text
__pycache__
*.pyc
.venv
venv
.git
.env
.pytest_cache
Dockerfile
.dockerignore
```

Ignoring `.venv` is important. A local virtual environment contains files built for your computer, and it can be large. The image installs its own packages. See [The Build Context and .dockerignore](/courses/docker/build-context-and-dockerignore) for why this matters.

## Step 3: choose a base image

| Image | Size | Notes |
|---|---|---|
| `python:3.13` | Large | Full Debian with compilers. Useful for building, too big to ship |
| `python:3.13-slim` | Medium | Debian with only what Python needs. **The usual choice** |
| `python:3.13-alpine` | Small | Uses musl instead of glibc, so many prebuilt packages do not fit and must be compiled |

For Python, Alpine is often a trap. Many packages ship ready-made **wheels** (prebuilt package files) for glibc, the C library that Debian uses. On Alpine, pip may have to compile them from source, which is slow and needs extra tools. `slim` avoids this. You compared these options in [Choosing a Base Image: Full, Slim, Alpine and Distroless](/courses/docker/choosing-a-base-image).

## Step 4: write the Dockerfile

```docker
# syntax=docker/dockerfile:1
FROM python:3.13-slim

# Do not write .pyc files, and print logs straight away
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Create a non-root user while we are still root
RUN groupadd --system app && useradd --system --gid app --no-create-home app

# Requirements first, so the pip step is cached until they change
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then the code
COPY app.py .

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" || exit 1

# Exec form, so gunicorn receives SIGTERM from docker stop
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "app:app"]
```

What each Python-specific line does:

| Line | Reason |
|---|---|
| `PYTHONDONTWRITEBYTECODE=1` | Python normally saves compiled `.pyc` files next to your code. In a container they are not useful and the folder may not be writable |
| `PYTHONUNBUFFERED=1` | Python normally holds output in a buffer. Without this, `print()` and log lines can appear in `docker logs` late, or be lost if the container crashes |
| `PIP_DISABLE_PIP_VERSION_CHECK=1` | Stops pip from checking online for a newer pip on every run |
| `pip install --no-cache-dir` | Does not keep downloaded files, so the layer is smaller |
| `useradd --system` | Creates a user with no password and no login, just for running the app |
| Health check with `urllib` | `python:3.13-slim` has no `curl` or `wget`, but Python itself can make the request |
| `--bind 0.0.0.0:8000` | Listen on all interfaces, so `-p` can reach the app |
| `--access-logfile -` | Print one line per request to standard output, where `docker logs` can see it |

> **Note:** During the build, pip may print a warning about "running pip as the root user". Inside an image build this is expected and safe, because the whole image is the isolated environment. If it bothers you, add `PIP_ROOT_USER_ACTION=ignore` to the `ENV` line.

### Why not `flask run`?

`flask run` starts Flask's **development server**. It is made for your laptop, handles one thing at a time, and Flask itself warns you not to use it in production. **Gunicorn** is a production server. It starts several **worker** processes (here 2) so it can handle requests at the same time, and it restarts a worker if it crashes.

A common starting rule for the number of workers is two per CPU core, plus one. Start small and measure.

## Step 5: build and run

```bash
docker build -t quotes-app:1.0.0 .
docker run -d --name quotes -p 8000:8000 quotes-app:1.0.0
curl http://localhost:8000/quote
```

```json
{"author":"The Zen of Python","text":"Readability counts."}
```

Look at the logs:

```bash
docker logs quotes
```

```text
[2026-10-25 16:25:01 +0000] [1] [INFO] Starting gunicorn 23.0.0
[2026-10-25 16:25:01 +0000] [1] [INFO] Listening at: http://0.0.0.0:8000 (1)
[2026-10-25 16:25:01 +0000] [1] [INFO] Using worker: sync
[2026-10-25 16:25:01 +0000] [7] [INFO] Booting worker with pid: 7
[2026-10-25 16:25:01 +0000] [8] [INFO] Booting worker with pid: 8
172.17.0.1 - - [25/Oct/2026:16:25:09 +0000] "GET /quote HTTP/1.1" 200 58 "-" "curl/8.5.0"
```

The `[1]` shows that the main gunicorn process has process ID 1: it is the container's main process, thanks to the exec form `CMD`. You learned about this in [CMD vs ENTRYPOINT: Choosing What a Container Runs](/courses/docker/cmd-vs-entrypoint).

Check the user and health:

```bash
docker exec quotes whoami
docker ps --filter name=quotes
```

```text
app
```

```text
CONTAINER ID   IMAGE              STATUS                    PORTS                    NAMES
3f8a0d2c71e9   quotes-app:1.0.0   Up 45 seconds (healthy)   0.0.0.0:8000->8000/tcp   quotes
```

## Step 6: stop it cleanly

```bash
docker stop quotes
docker logs --tail 4 quotes
```

```text
[2026-10-25 16:27:12 +0000] [1] [INFO] Handling signal: term
[2026-10-25 16:27:12 +0000] [7] [INFO] Worker exiting (pid: 7)
[2026-10-25 16:27:12 +0000] [8] [INFO] Worker exiting (pid: 8)
[2026-10-25 16:27:12 +0000] [1] [INFO] Shutting down: Master
```

Gunicorn treats `SIGTERM` as "finish the current requests, then exit". By default it waits up to 30 seconds for slow requests, but `docker stop` only waits 10 seconds before it sends `SIGKILL`. If your app has slow requests, either lower gunicorn's wait with `--graceful-timeout 8`, or give Docker more time with `docker stop -t 35`. You learned about stop timeouts in [The Container Lifecycle: Create, Start, Stop and Remove](/courses/docker/container-lifecycle).

## Going further: a multi-stage build with a virtual environment

Some Python packages must be **compiled** during `pip install`, which needs a compiler such as `gcc`. You do not want a compiler in the final image. The solution is a multi-stage build: install into a **virtual environment** (a self-contained folder of packages) in a build stage, then copy only that folder. You learned this technique in [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds).

```docker
# syntax=docker/dockerfile:1
FROM python:3.13-slim AS build
# Tools needed only to compile packages
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/opt/venv/bin:$PATH"
# Only the finished packages come across, no compiler
COPY --from=build /opt/venv /opt/venv
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY app.py .
USER app
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "app:app"]
```

quotes-app does not need this, because Flask and gunicorn are pure Python. But it is the pattern to use when you add packages with C code, such as some database drivers.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| `docker logs` shows nothing, or logs appear late | `PYTHONUNBUFFERED=1` is missing |
| `ModuleNotFoundError: No module named 'flask'` | `requirements.txt` not copied before `pip install`, or a typo in it |
| `Failed to find attribute 'app' in 'app'` | The Flask object is not called `app`, or the file is not `app.py`. Match the `module:object` name |
| Connection refused from your computer | `--bind` uses `127.0.0.1`, or `-p` is missing |
| Build very slow on Alpine | Packages compiling from source. Use `python:3.13-slim` |

## Quick recap

- Use `python:3.13-slim` as the base; Alpine often forces packages to compile.
- Set `PYTHONDONTWRITEBYTECODE=1` and `PYTHONUNBUFFERED=1`.
- Copy `requirements.txt`, run `pip install --no-cache-dir`, then copy the code.
- Run with gunicorn, not `flask run`, using exec form and `--bind 0.0.0.0:8000`.
- Create a user with `useradd --system` and switch with `USER`.
- Use Python's own `urllib` for the health check, since slim images have no `curl`.
- For packages that need compiling, use a multi-stage build with a virtual environment.

You can now package apps into images. But what happens to the data a container writes? Find out in [Why Container Data Disappears: The Writable Layer](/courses/docker/container-storage-basics).

<code id="code-content" class="language-docker">
# syntax=docker/dockerfile:1
# Production Dockerfile for quotes-app (Flask served by gunicorn on port 8000).
# Build: docker build -t quotes-app:1.0.0 .
# Run:   docker run -d --name quotes -p 8000:8000 quotes-app:1.0.0
# Test:  curl http://localhost:8000/quote
#
# Slim Debian base: small, and prebuilt wheels work (unlike Alpine)
FROM python:3.13-slim
# No .pyc files, logs appear immediately, no pip self-update check
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
# Create a system user while still root (no password, no login, no home)
RUN groupadd --system app &amp;&amp; useradd --system --gid app --no-create-home app
# Requirements first, so this slow step stays cached when only code changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Then the application code (.dockerignore keeps .venv, .git and .env out)
COPY app.py .
# Drop root for running the app
USER app
EXPOSE 8000
# slim has no curl or wget, so use Python's standard library for the check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" || exit 1
# Exec form: gunicorn is PID 1 and handles SIGTERM as a graceful shutdown
# "app:app" means: the object named app inside app.py
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "app:app"]
</code></pre>

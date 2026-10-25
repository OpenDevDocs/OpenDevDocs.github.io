---
publishDate: 2026-10-25T17:20
title: 'Environment Variables and Secrets in Compose'
slug: compose-environment-and-secrets
metadescription: 'Learn how to pass settings to Compose services with environment, env_file and .env interpolation, and how to keep passwords safe with Compose secrets.'
updateDate: 2026-10-25T17:20
author: ['bishal-biswas']
level: 2
tags: ['docker', 'docker-compose', 'environment-variables', 'secrets']
course: docker
---

## Settings that change, code that does not

Your app needs settings: a port, a database address, a log level, a password. These settings are different on your laptop, on a test server and in production. The code stays the same.

In [Configuring Containers with Environment Variables](/courses/docker/environment-variables) you passed settings to one container with `docker run -e`. In this lesson you will do the same thing for a whole Compose project. You will learn:

- how to set variables for a service with `environment` and `env_file`
- how the special `.env` file fills in values inside `compose.yaml` itself
- how to check the final result with `docker compose config`
- how to keep passwords out of environment variables with **Compose secrets**

We will keep using the **notes-api** app from earlier lessons, with a `db` service running `postgres:17-alpine`.

## Three different things with similar names

Beginners often mix these up, so let us name them first.

| Feature | Where you write it | What it does |
|---|---|---|
| `environment:` | inside a service in `compose.yaml` | Sets variables **inside the container** |
| `env_file:` | inside a service in `compose.yaml` | Reads variables from a file and sets them **inside the container** |
| `.env` file | next to `compose.yaml` | Fills in `${VAR}` placeholders **in the compose.yaml text** before Compose runs it |

The first two affect what your app sees at run time. The third one affects the Compose file itself. Keep this table in mind for the rest of the lesson.

## Setting variables with environment

The simplest way is the `environment` key. You can write it as a map (key and value) or as a list. Both do the same thing.

```yaml
services:
  api:
    build: .
    environment:
      PORT: "3000"                 # map style: KEY: value
      LOG_LEVEL: debug
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
```

```yaml
services:
  api:
    build: .
    environment:
      - PORT=3000                  # list style: KEY=value
      - LOG_LEVEL=debug
```

> **Tip:** Put numbers and words like `yes`, `no`, `true` in quotes in map style. YAML might read `true` as a boolean, and environment variables are always text.

Start the project and look inside the container:

```bash
docker compose up -d
docker compose exec api printenv LOG_LEVEL
```

```text
debug
```

You learned `docker compose exec` in [Docker Compose Commands: up, down, logs and exec](/courses/docker/compose-commands).

### Passing a value from your shell

If you write only the name, with no value, Compose copies the value from the shell where you run `docker compose`:

```yaml
services:
  api:
    environment:
      - LOG_LEVEL          # no "=": take LOG_LEVEL from my terminal
```

```bash
LOG_LEVEL=info docker compose up -d
```

If `LOG_LEVEL` is not set in your shell, the variable is simply not set in the container.

## Reading variables from a file with env_file

When a service has many variables, a long `environment` list becomes hard to read. Move them to a file instead. A file like this is often called an **env file**: one `KEY=value` per line.

```text
# api.env
PORT=3000
LOG_LEVEL=debug
NOTES_PAGE_SIZE=20
```

```yaml
services:
  api:
    build: .
    env_file:
      - api.env                    # every line becomes a variable in the container
```

You can list more than one file. Later files win when the same key appears twice. If a key is in both `env_file` and `environment`, the value in `environment` wins.

> **Note:** Lines that start with `#` are comments. Do not put spaces around `=`. Quotes are allowed but usually not needed.

## The .env file and interpolation

Now the third feature. **Interpolation** means "filling in blanks". You can write `${NAME}` anywhere in `compose.yaml`, and Compose replaces it with a value before it does anything else.

Where does the value come from? First from your shell, and then from a file called `.env` in the same folder as `compose.yaml`. Compose reads this file automatically.

```text
# .env (read by Compose itself, not by your app)
POSTGRES_TAG=17-alpine
API_PORT=3000
```

```yaml
services:
  db:
    image: postgres:${POSTGRES_TAG}          # becomes postgres:17-alpine
  api:
    build: .
    ports:
      - "${API_PORT}:3000"                    # becomes "3000:3000"
```

This is useful for things that change between machines, such as which host port to use. If port 3000 is busy on your laptop, set `API_PORT=3001` in your own `.env` and nobody else is affected.

> **Warning:** The `.env` file does **not** automatically put its variables inside your containers. It only fills in `${...}` in `compose.yaml`. If you want a value inside the container, you must also pass it with `environment` or `env_file`.

### Defaults and required values

Interpolation has a small syntax for default values and errors:

| Syntax | Meaning |
|---|---|
| `${VAR}` | The value of VAR (empty if it is not set) |
| `${VAR:-default}` | The value of VAR, or `default` if it is unset or empty |
| `${VAR:?message}` | The value of VAR, or stop with an error showing `message` |

```yaml
services:
  api:
    build: .
    ports:
      - "${API_PORT:-3000}:3000"             # 3000 unless .env says otherwise
    environment:
      LOG_LEVEL: ${LOG_LEVEL:-info}
      ADMIN_EMAIL: ${ADMIN_EMAIL:?set ADMIN_EMAIL in your .env file}
```

If `ADMIN_EMAIL` is missing, Compose refuses to start and prints your message. This is much better than an app that starts and then fails in a strange way.

> **Tip:** To write a real dollar sign in `compose.yaml`, double it: `$$`. For example, `echo $$HOME` in a `command` reaches the container as `echo $HOME`.

## Check the result with docker compose config

With three sources of values, it is easy to lose track. The command `docker compose config` prints the final file after interpolation and after merging `env_file` values. Use it often.

```bash
docker compose config
```

```text
name: notes
services:
  api:
    build:
      context: /home/you/notes
      dockerfile: Dockerfile
    environment:
      ADMIN_EMAIL: admin@example.com
      LOG_LEVEL: info
    ports:
      - mode: ingress
        target: 3000
        published: "3000"
        protocol: tcp
...
```

You will see this command again in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides).

## Which value wins?

When the same variable is set in several places, Compose uses an order of priority. From strongest to weakest:

1. `docker compose run -e KEY=value` on the command line
2. `environment:` in the service
3. `env_file:` in the service
4. `ENV` in the image's Dockerfile

For interpolation (`${VAR}` in the file), your shell variables beat the `.env` file.

## Why environment variables are not great for passwords

Putting `devpassword` in `environment` works on your laptop. For real passwords it has problems:

- Anyone who can run `docker inspect` sees every variable in plain text.
- Variables are passed to every child process and often end up in crash reports and logs.
- It is easy to commit `compose.yaml` with a real password to Git.

```bash
docker inspect notes-api-1 --format '{{json .Config.Env}}'
```

```text
["DATABASE_URL=postgres://notes:devpassword@db:5432/notes","PORT=3000",...]
```

You learned about `inspect` in [Inspecting Containers: inspect, stats, top and diff](/courses/docker/inspecting-containers). A better way to handle passwords is a **secret**.

## Compose secrets

A **secret** in Compose is a file that Compose mounts into the container at `/run/secrets/<name>`. The value is not an environment variable, so it does not show up in `docker inspect` output for `Env`, and your app reads it only when it needs it.

There are two steps. First, declare the secret at the top level of `compose.yaml` and say where its value comes from. Second, give it to the services that need it.

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_DB: notes
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password   # read the password from a file
    secrets:
      - db_password                                       # step 2: give it to this service

secrets:
  db_password:                                            # step 1: declare it
    file: ./secrets/db_password.txt                       # the value lives in this file
```

Create the file and keep it out of Git:

```bash
mkdir -p secrets
printf 'devpassword' > secrets/db_password.txt
echo "secrets/" >> .gitignore
```

Inside the container the secret is just a file:

```bash
docker compose exec db cat /run/secrets/db_password
```

```text
devpassword
```

> **Note:** The official `postgres` image understands variables that end in `_FILE`, such as `POSTGRES_PASSWORD_FILE`. Many official images (MySQL, MariaDB and others) follow the same pattern. Check the image's page on Docker Hub, as you learned in [Docker Hub and Official Images](/courses/docker/docker-hub-and-official-images).

A secret can also come from a variable in your shell or `.env` instead of a file:

```yaml
secrets:
  db_password:
    environment: DB_PASSWORD        # take the value from the DB_PASSWORD variable
```

### Reading a secret in notes-api

Your own app needs a little code to read the file. A common pattern is: read `X_FILE` if it is set, otherwise fall back to `X`.

```javascript
import { readFileSync } from 'node:fs';

// Read a setting from NAME_FILE (a secret file) or from NAME (a plain variable)
function readSetting(name) {
  const file = process.env[`${name}_FILE`];
  if (file) return readFileSync(file, 'utf8').trim();   // trim removes a trailing newline
  return process.env[name];
}

const dbPassword = readSetting('DB_PASSWORD');
const databaseUrl = `postgres://notes:${dbPassword}@db:5432/notes`;
```

Then give `api` the same secret:

```yaml
services:
  api:
    build: .
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
```

Now the password lives in one file, both services read it, and it never appears in `compose.yaml`.

> **Warning:** Secrets in plain Compose are a big improvement, but they are still files on your disk. On a server, protect the file with tight permissions (`chmod 600`). Never bake secrets into an image either. For secrets needed during `docker build`, see [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

## Common mistakes

### Expecting .env values inside the container

You set `LOG_LEVEL=debug` in `.env` and your app still sees nothing. The `.env` file only fills in `${...}` in `compose.yaml`. Add `LOG_LEVEL: ${LOG_LEVEL}` to `environment`, or use `env_file: .env` if you really want every line passed in.

### Committing .env or secret files

Add `.env` and your `secrets/` folder to `.gitignore`. Commit a `.env.example` file with fake values instead, so teammates know which variables to set. The [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets) lesson in the DevOps course explains this pattern in more detail.

### A trailing newline in the secret file

Many editors add a newline at the end of a file. If your app reads the password with the newline, the login fails. Use `printf` (not `echo`) to create the file, and `.trim()` the value in code.

### Forgetting to recreate the container

Changing `environment` in `compose.yaml` does nothing until the container is recreated. Run `docker compose up -d` again. Compose sees the change and recreates only the affected services.

## Quick recap

- `environment` and `env_file` set variables **inside containers**. `environment` wins over `env_file`.
- The `.env` file fills in `${VAR}` placeholders **in compose.yaml**. Your shell wins over `.env`.
- Use `${VAR:-default}` for defaults and `${VAR:?message}` for required values.
- Run `docker compose config` to see the final, filled-in file.
- Put passwords in **secrets**: declare them at the top level, give them to services, and read them from `/run/secrets/<name>`.
- Use `_FILE` variables such as `POSTGRES_PASSWORD_FILE` when the image supports them.

Next, you will make sure the database is ready before the API starts in [Startup Order with depends_on and Health Checks](/courses/docker/compose-depends-on-and-healthchecks).

<code id="code-content" class="language-yaml">
# compose.yaml for notes-api: settings with environment, env_file, .env and secrets
# Before the first run:
#   mkdir -p secrets &amp;&amp; printf 'devpassword' &gt; secrets/db_password.txt
#   echo "API_PORT=3000" &gt; .env
# Then: docker compose config   (check the result)
#       docker compose up -d
services:
  api:
    build: .
    ports:
      # API_PORT comes from your shell or .env, with 3000 as the default
      - "${API_PORT:-3000}:3000"
    env_file:
      # Plain, non-secret settings: PORT, LOG_LEVEL, NOTES_PAGE_SIZE
      - api.env
    environment:
      # environment wins over env_file when a key is in both
      LOG_LEVEL: ${LOG_LEVEL:-info}
      DB_HOST: db
      # The app reads the password from this file, not from a variable
      DB_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
  db:
    image: postgres:${POSTGRES_TAG:-17-alpine}
    environment:
      POSTGRES_USER: notes
      POSTGRES_DB: notes
      # The official postgres image reads the password from this file
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
# Top-level secrets: each one is mounted at /run/secrets/&lt;name&gt;
secrets:
  db_password:
    # Keep this file out of Git (add secrets/ to .gitignore)
    file: ./secrets/db_password.txt
volumes:
  pgdata:
</code></pre>

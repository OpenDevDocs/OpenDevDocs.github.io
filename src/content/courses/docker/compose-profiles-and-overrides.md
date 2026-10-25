---
publishDate: 2026-10-25T17:35
title: 'Compose Profiles, Override Files and Multiple Environments'
slug: compose-profiles-and-overrides
metadescription: 'Learn to use one Compose setup for development and production with compose.override.yaml, extra files passed with -f, and profiles for optional services.'
updateDate: 2026-10-25T17:35
author: ['bishal-biswas']
level: 2
tags: ['docker', 'docker-compose', 'profiles', 'environments']
course: docker
---

## One project, several situations

Your notes-api project now runs in several situations:

- **On your laptop**, you want watch mode, a published database port and maybe a database admin tool.
- **In CI**, you want the app and database, plus a container that runs the tests.
- **On a server**, you want the production image, restart policies and no development tools.

You could copy `compose.yaml` three times and edit each copy. But then every change must be made three times, and the copies slowly drift apart.

Compose has better tools. In this lesson you will learn:

- **override files**: a base file plus small files that change only what is different
- the special `compose.override.yaml` that Compose merges automatically
- how to choose files with `-f`
- **profiles**: optional services that start only when you ask for them

## The base file

Start with a `compose.yaml` that contains what is the same everywhere. Keep it close to production:

```yaml
# compose.yaml: the shared base
services:
  api:
    build: .
    image: notes-api:dev
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "notes", "-d", "notes"]
      interval: 5s
      timeout: 3s
      retries: 5
volumes:
  pgdata:
```

Notice there are no `ports` and no watch rules. Those depend on the situation.

## compose.override.yaml: merged automatically

If a file called `compose.override.yaml` is next to `compose.yaml`, Compose reads **both** and merges them. You do not need any flag. Put your development extras there:

```yaml
# compose.override.yaml: development only, merged automatically
services:
  api:
    command: ["node", "--watch", "src/server.js"]
    ports:
      - "3000:3000"
    environment:
      LOG_LEVEL: debug
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json
  db:
    ports:
      - "5432:5432"          # let tools on your laptop reach the database
```

Now plain `docker compose up --watch` on your laptop gives you the development setup. You built this watch configuration in [Local Development with Compose: Bind Mounts and Watch](/courses/docker/compose-for-local-development).

### How merging works

Compose combines the files key by key. The rules are simple once you see them:

| Kind of option | Examples | What happens |
|---|---|---|
| A single value | `image`, `command`, `restart` | The later file **replaces** it |
| A map of keys | `environment`, `labels` | Keys are **combined**. Same key: the later file wins |
| A list | `ports`, `expose` | The lists are **joined together** |
| Volumes and secrets in a service | `volumes` | Combined. Same container path: the later file wins |

So in our example, the `api` service ends up with both `DATABASE_URL` (from the base) and `LOG_LEVEL` (from the override).

### See the merged result

You saw `docker compose config` in [Environment Variables and Secrets in Compose](/courses/docker/compose-environment-and-secrets). It is even more useful now, because it shows the final, merged file:

```bash
docker compose config
```

```text
name: notes
services:
  api:
    command:
      - node
      - --watch
      - src/server.js
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
      LOG_LEVEL: debug
    ports:
      - mode: ingress
        target: 3000
        published: "3000"
        protocol: tcp
...
```

> **Tip:** When something behaves strangely, run `docker compose config` first. Most "Compose is ignoring my setting" problems are merge surprises you can see here.

## Choosing files with -f

The `-f` flag tells Compose exactly which files to use. When you use `-f`, Compose **does not** read `compose.override.yaml` automatically any more. Files are merged in the order you list them, and later files win.

Create a production file with only the production differences:

```yaml
# compose.prod.yaml: production differences
services:
  api:
    image: ghcr.io/your-name/notes-api:1.4.0   # a pushed, versioned image
    ports:
      - "3000:3000"
    restart: unless-stopped
    environment:
      LOG_LEVEL: info
  db:
    restart: unless-stopped
```

Run it with the base file plus the production file:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

Your development override is not used, so there is no watch and no published database port. You will learn about the versioned image name in [Tagging Images for Releases](/courses/docker/tagging-strategy), and deploy a setup like this in [Deploying a Compose App to a Linux Server](/courses/docker/deploying-with-docker-on-a-server).

> **Tip:** Typing `-f` twice every time is easy to forget. Set the `COMPOSE_FILE` variable instead. Files are separated by `:` on Linux and macOS, and by `;` on Windows. You can put it in the server's `.env` file:
>
> ```text
> COMPOSE_FILE=compose.yaml:compose.prod.yaml
> ```

### Replacing a list instead of joining it

Because lists such as `ports` are joined, an override cannot remove a port from the base file. If you really need to replace a whole value, Compose supports the `!override` YAML tag, and `!reset` to remove a value completely:

```yaml
services:
  api:
    ports: !override
      - "8080:3000"          # use only this port, ignore the base file's ports
```

The simpler habit is to keep `ports` out of the base file, as we did, and add them only in the files that need them.

## Profiles: optional services

Sometimes you want a service that does not start by default. Examples:

- a database admin web tool, only when you need to look at data
- a container that runs tests, only in CI
- a one-off job that loads sample data

A **profile** is a label you put on a service. Services with a profile start **only** when that profile is active. Services without any profile always start.

```yaml
services:
  api:
    build: .            # no profile: always starts
  db:
    image: postgres:17-alpine
  adminer:
    image: adminer:5
    ports:
      - "8081:8080"
    profiles: ["tools"]          # starts only with the "tools" profile
  tests:
    build: .
    command: ["npm", "test"]
    profiles: ["test"]           # starts only with the "test" profile
```

Now:

```bash
docker compose up -d                       # api and db only
docker compose --profile tools up -d       # api, db and adminer
docker compose --profile test run --rm tests   # run the tests once
```

You can activate profiles with a variable too, which is handy in CI:

```bash
COMPOSE_PROFILES=tools,test docker compose up -d
```

> **Note:** If you run a profiled service by name, for example `docker compose run --rm tests`, Compose starts it even without `--profile`. Profiles only control what starts when you do not name services.

### Stopping profiled services

`docker compose down` only stops services in active profiles. To stop everything including `adminer`, pass the profile again:

```bash
docker compose --profile tools down
```

## Putting it together

Here is a common layout for a real project:

```text
notes-api/
|-- compose.yaml            # shared base, close to production
|-- compose.override.yaml   # dev extras, used automatically on laptops
|-- compose.prod.yaml       # production differences, used with -f
|-- .env                    # local values for ${VAR} (not committed)
`-- .env.example            # fake values, committed, as a template
```

| Where | Command | Files used |
|---|---|---|
| Laptop | `docker compose up --watch` | `compose.yaml` + `compose.override.yaml` |
| Laptop, with tools | `docker compose --profile tools up -d` | same, plus profiled tools |
| CI | `docker compose -f compose.yaml --profile test run --rm tests` | base only, plus tests |
| Server | `docker compose -f compose.yaml -f compose.prod.yaml up -d` | base + production |

This idea of the same app with different configuration per environment is explained from the DevOps side in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

## Common mistakes

### Thinking -f adds to the override file

When you pass any `-f`, the automatic `compose.override.yaml` is no longer loaded. If you want it, list it yourself: `-f compose.yaml -f compose.override.yaml -f compose.extra.yaml`.

### Ports appearing twice

The base file publishes `3000:3000` and the production file also publishes `3000:3000`. Lists are joined, and the result may be a duplicate or a port conflict. Keep `ports` in only one place per environment.

### Committing a personal override

Some teams use `compose.override.yaml` for personal settings. If you do that, add it to `.gitignore` and commit a `compose.override.example.yaml` instead. Decide as a team and be consistent.

### Forgetting that profiles must be active for down

Profiled services keep running after a plain `docker compose down`. Use `--profile` with `down` too.

## Quick recap

- Keep shared settings in `compose.yaml`, close to production.
- `compose.override.yaml` is merged **automatically**. Use it for development extras.
- `-f` picks files explicitly, in order. Later files win. Using `-f` skips the automatic override.
- Single values are replaced, maps are combined by key, lists are joined.
- `docker compose config` shows the merged result.
- **Profiles** mark optional services. Start them with `--profile name` or `COMPOSE_PROFILES`.

Next, you will share your images with other machines in [Pushing Images to Docker Hub and GitHub Container Registry](/courses/docker/pushing-images-to-a-registry).

<code id="code-content" class="language-yaml">
# compose.yaml for notes-api: the shared base, with optional profiles
# Laptop (also loads compose.override.yaml):  docker compose up --watch
# With the admin tool:                         docker compose --profile tools up -d
# Run the tests once:                          docker compose --profile test run --rm tests
# Production:  docker compose -f compose.yaml -f compose.prod.yaml up -d
# See the merged result:                       docker compose config
services:
  api:
    build: .
    image: notes-api:dev
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
    depends_on:
      db:
        condition: service_healthy
    # No ports here: each environment adds its own
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notes
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: notes
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "notes", "-d", "notes"]
      interval: 5s
      timeout: 3s
      retries: 5
  adminer:
    # A web UI for the database, only when you ask for it
    image: adminer:5
    ports:
      - "8081:8080"
    depends_on:
      - db
    profiles: ["tools"]
  tests:
    # Runs the test suite once against the real database
    build: .
    command: ["npm", "test"]
    environment:
      DATABASE_URL: postgres://notes:devpassword@db:5432/notes
    depends_on:
      db:
        condition: service_healthy
    profiles: ["test"]
volumes:
  pgdata:
</code></pre>

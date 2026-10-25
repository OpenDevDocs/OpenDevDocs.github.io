---
publishDate: 2026-10-25T10:03
title: CI/CD Pipelines for Node APIs
slug: ci-cd-for-node-apis
metadescription: Learn what CI/CD is and build a GitHub Actions pipeline for an Express 5 API that runs tests against a real database, builds a Docker image and deploys safely.
updateDate: 2026-10-25T10:03
author: ['bishal-biswas']
level: 4
tags: ['express', 'ci-cd', 'github-actions', 'devops']
course: expressjs
---

## What you will learn

- What **continuous integration** (CI) and **continuous delivery/deployment** (CD) mean
- How to write a **GitHub Actions** workflow that installs, lints and tests your Express API
- How to run tests against a real MongoDB using **service containers**
- How to build and publish a Docker image, then deploy and smoke-test it
- How to keep secrets safe and stop broken code from reaching `main`

## The problem: "I forgot to run the tests"

You've written tests. You've written a Dockerfile. But both only help if someone actually runs them, every time, before code goes live. People forget. People are in a hurry on Friday afternoon.

**CI/CD** hands that job to a robot.

- **Continuous integration (CI):** every time someone pushes code or opens a pull request, a server automatically installs dependencies and runs the tests. Problems are caught within minutes, while the change is still fresh in your mind.
- **Continuous delivery (CD):** after CI passes, the code is automatically packaged (for example as a Docker image) and made *ready* to deploy. A human presses the final button.
- **Continuous deployment:** the same, but there is no button. Every passing change on `main` goes live automatically.

Think of a car factory. CI is the quality inspection at every station. CD is the conveyor belt that takes inspected cars to the showroom.

```text
 git push / pull request
        |
        v
 +-------------+     fails? -> stop, show a red X on the PR
 |  CI: test   |     install, lint, test (with a real database)
 +-------------+
        | passes (main branch only)
        v
 +-------------+
 |  Build      |     docker build, push image to a registry
 +-------------+
        |
        v
 +-------------+
 |  Deploy     |     tell the server to run the new image
 +-------------+
        |
        v
 +-------------+
 | Smoke test  |     curl /health on the live site
 +-------------+
```

## GitHub Actions basics

**GitHub Actions** is the CI/CD service built into GitHub. It's free for public repositories and has a free monthly allowance for private ones. Other tools (GitLab CI, CircleCI, Jenkins) follow the same ideas.

A few terms:

| Term | Meaning |
| --- | --- |
| **Workflow** | A YAML file in `.github/workflows/` describing an automated process |
| **Trigger** (`on`) | The event that starts it: a push, a pull request, a schedule... |
| **Job** | A group of steps that runs on one fresh virtual machine (a **runner**) |
| **Step** | One command (`run:`) or one ready-made **action** (`uses:`) |
| **Action** | A reusable building block, like `actions/checkout` to download your code |

Jobs run in parallel by default. Use `needs:` to make one wait for another.

## Prepare your package.json

The pipeline runs the same commands you run locally, so make them simple and reliable:

```json
{
  "name": "notes-api",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "lint": "eslint .",
    "test": "node --test"
  },
  "engines": {
    "node": ">=22"
  }
}
```

`node --test` finds files like `*.test.js` automatically. Make sure `package-lock.json` is committed, because CI uses `npm ci`, which needs it.

## Step 1: A first CI workflow

Create this file in your repository:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Run tests
        run: npm test
```

What happens:

1. `actions/checkout@v4` downloads your repository onto the runner.
2. `actions/setup-node@v4` installs Node 22. `cache: npm` saves npm's download cache between runs, so installs get faster.
3. `npm ci` installs the exact versions from your lock file.
4. `--if-present` skips the lint step if you don't have a `lint` script yet.
5. If any step exits with a non-zero code (a failing test, for example), the job fails.

Commit and push. Open the **Actions** tab on GitHub to watch it run. On a pull request you'll see a green check or a red cross next to each commit.

## Step 2: Test against a real database

Unit tests with fakes are great, but you also want a few integration tests against a real database. GitHub Actions can start **service containers**: Docker containers that run next to your job for its whole lifetime.

```yaml
# .github/workflows/ci.yml (test job with MongoDB)
jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongo:
        image: mongo:8
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --quiet --eval 'db.runCommand({ping:1})'"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      MONGO_URL: mongodb://localhost:27017/notes_test
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test
```

The `--health-*` options make GitHub wait until MongoDB answers before running your steps. Your tests read `process.env.MONGO_URL` exactly as they would locally.

> **Tip:** Give each test file its own database name, or clear collections in a `beforeEach` hook, so tests don't depend on each other's leftovers.

### Testing on several Node versions

If you publish a library or support several Node versions, a **matrix** runs the same job for each value:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm test
```

For an app that only ever runs on one version in production, testing that one version is usually enough.

### Extra checks worth adding

```yaml
      - name: Check for known vulnerabilities
        run: npm audit --omit=dev --audit-level=high
```

`npm audit` compares your dependencies with a database of known security problems. `--omit=dev` ignores dev-only packages and `--audit-level=high` only fails for serious issues, which keeps the pipeline from failing over minor warnings.

## Step 3: Build and publish a Docker image

Once tests pass on `main`, package the app. We'll push the image built from the Dockerfile in [Dockerising an Express API](/courses/expressjs/dockerising-an-express-api) to the **GitHub Container Registry** (GHCR), a free place to store images next to your code.

```yaml
# .github/workflows/ci.yml (add a second job)
  docker:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/your-github-name/notes-api:latest
            ghcr.io/your-github-name/notes-api:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- `needs: test` means this job only starts if the tests passed.
- The `if:` line skips it for pull requests, so only `main` produces images.
- `secrets.GITHUB_TOKEN` is created automatically for each run. `packages: write` gives it permission to push.
- Tagging with `github.sha` (the commit ID) gives every image a unique name, so you can always roll back to an exact version.
- `cache-from` / `cache-to` with `type=gha` reuse Docker layers between runs.

> **Note:** Registry image names must be lowercase. Replace `your-github-name` with your GitHub user or organisation name in lowercase.

## Step 4: Deploy and smoke-test

How you deploy depends on where you host. Many platforms (Render, Railway, Fly.io and others) offer a **deploy hook**: a secret URL that starts a deployment when you send it a request. Here's the general pattern:

```yaml
# .github/workflows/ci.yml (add a third job)
  deploy:
    needs: docker
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Trigger deployment
        env:
          DEPLOY_HOOK_URL: ${{ secrets.DEPLOY_HOOK_URL }}
        run: curl -fsS -X POST "$DEPLOY_HOOK_URL"

      - name: Smoke test
        run: |
          curl -fsS --retry 10 --retry-delay 6 --retry-all-errors \
            https://api.example.com/health
```

- A **smoke test** is a tiny check that the live app is basically working, here just "does `/health` answer?". The name comes from electronics: switch it on and see if smoke comes out.
- `curl -f` makes curl fail on HTTP errors, so the step fails if the app is down. `--retry` gives the new version time to start.
- `environment: production` links the job to a GitHub **environment**. In your repository settings you can require a manual approval for that environment. That turns continuous *deployment* into continuous *delivery*: the pipeline pauses until someone clicks "Approve".

## Secrets: keep them out of your code

A **secret** is a value like an API key, a deploy hook URL or a database password. Never write them in the workflow file or commit them. Store them in **Settings > Secrets and variables > Actions** and read them as `${{ secrets.NAME }}`.

> **Warning:** Pass secrets to commands through `env:`, as in the deploy step above, rather than pasting `${{ secrets.X }}` directly into a `run:` line. GitHub hides secret values in logs, but the `env:` style avoids accidental leaks through shell quoting and is easier to review.

> **Note:** Secrets are not given to workflows triggered by pull requests from forks. That's a safety feature: a stranger can't open a PR that prints your secrets. Design your test job so it doesn't need any.

## Protect the main branch

CI only protects you if broken code can't skip it. In your repository, go to **Settings > Branches** (or **Rules**) and add a rule for `main`:

- **Require a pull request before merging.**
- **Require status checks to pass**, and select your `test` job.

Now nobody, including you, can merge a pull request with failing tests.

## Keeping dependencies fresh

Outdated packages slowly collect security problems. **Dependabot**, built into GitHub, opens pull requests to update them, and your CI tests each one automatically:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

## Making the pipeline fast

A slow pipeline gets ignored. Some easy wins:

| Tip | How |
| --- | --- |
| Cache npm downloads | `cache: npm` in `actions/setup-node` |
| Cache Docker layers | `cache-from: type=gha` |
| Cancel outdated runs | A `concurrency` block (below) |
| Run independent jobs in parallel | Only use `needs:` where order really matters |
| Keep unit tests fast | Use fakes for most tests, a real DB only for a few |

```yaml
# .github/workflows/ci.yml (top level, next to "on:")
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

If you push three commits quickly to the same branch, only the newest run continues.

## Common mistakes

> **Common mistake:** Using `npm install` in CI. It can change versions and update the lock file. Use `npm ci`.

> **Common mistake:** Tests that pass locally but fail in CI because they depend on your `.env` file. Set the needed values with `env:` in the workflow, and never commit `.env`.

> **Common mistake:** Deploying on every push to every branch. Limit deploy jobs with `if: github.ref == 'refs/heads/main'` and `needs:`.

> **Common mistake:** Only tagging images as `latest`. Without a unique tag such as the commit SHA, you can't tell what's running or roll back to a known good version.

## Key takeaways

- **CI** runs your install, lint and tests automatically on every push and pull request.
- **CD** packages and deploys passing code; add a manual approval for continuous *delivery*.
- In GitHub Actions use `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22` and `cache: npm`, then `npm ci` and `npm test`.
- **Service containers** give your tests a real MongoDB or PostgreSQL for each run.
- Tag images with the commit SHA, smoke-test after deploying, and keep secrets in GitHub's secret store.
- Protect `main` so failing checks block merges.

## Practice

1. Add the first CI workflow to your Notes API repository and open a pull request that breaks a test. Watch the red cross appear.
2. Add a MongoDB service container and write one integration test that creates and reads a note.
3. Add the Docker job and pull the image back with `docker pull ghcr.io/<your-name>/notes-api:<sha>`.
4. Set up branch protection on `main` so the `test` job must pass before merging.

## What's next

Your pipeline proves the code works. Next, find out how much traffic it can handle and how to make it faster: [Load Testing and Performance Tuning](/courses/expressjs/load-testing-and-performance-tuning).

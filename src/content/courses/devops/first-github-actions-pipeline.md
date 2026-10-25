---
publishDate: 2026-10-25T11:15
title: Your First Pipeline with GitHub Actions
slug: first-github-actions-pipeline
metadescription: Build a real CI pipeline with GitHub Actions step by step, workflows, triggers, jobs, steps, runners, actions, matrix builds, caching, artifacts and branch protection, for a small Node.js project.
updateDate: 2026-10-25T11:15
author: ['bishal-biswas']
level: 2
tags: ['devops', 'ci-cd', 'github-actions', 'yaml', 'automation']
course: devops
---

## What you will build

In [Continuous Integration Explained](/courses/devops/continuous-integration) you learned **why** every push should be built and tested automatically. In this lesson you will make it happen for a real project, using **GitHub Actions**, the automation service built into GitHub.

By the end you will have:

- a small Node.js project with a linter, tests and a build step;
- a pipeline that runs on every push and pull request;
- tests running on two Node.js versions at once;
- the build output saved as a downloadable **artifact**;
- `main` protected, so nothing can be merged unless the pipeline is green.

You need a free **GitHub account**, **Git** and **Node.js** (the current LTS version). GitHub Actions is free for public repositories, and private repositories get a monthly allowance of free minutes.

## The building blocks

GitHub Actions has its own vocabulary. Here it is in one table:

| Term | What it is |
|---|---|
| **Workflow** | One automated process, defined in a YAML file in `.github/workflows/`. A repo can have many. |
| **Event** (trigger) | What starts the workflow: a push, a pull request, a schedule, a button click... |
| **Job** | A group of steps that runs on one machine. Jobs run **in parallel** unless you say otherwise. |
| **Step** | One task inside a job: either a shell command (`run`) or a ready-made action (`uses`). |
| **Runner** | The machine a job runs on. `ubuntu-latest` is a fresh Linux virtual machine provided by GitHub. |
| **Action** | A reusable building block, such as `actions/checkout`, shared on the GitHub Marketplace. |

Put together:

```text
Workflow (ci.yml)
 ├── on: push, pull_request          <- events
 ├── Job: lint   (runner: ubuntu-latest)
 │     ├── step: check out the code  <- uses: an action
 │     └── step: npm run lint        <- run: a command
 └── Job: test   (runner: ubuntu-latest)
       └── ...
```

## Step 1: the project

Create a folder called `recipe-api` with this `package.json`:

```json
{
  "name": "recipe-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "eslint .",
    "test": "node --test",
    "build": "node build.js"
  }
}
```

A small piece of code, `src/price.js`:

```javascript
export function total(prices) {
  return prices.reduce((sum, price) => sum + price, 0);
}
```

A test for it, `test/price.test.js`, using Node's built-in test runner:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { total } from '../src/price.js';

test('total adds up prices', () => {
  assert.equal(total([100, 250]), 350);
});

test('total of nothing is zero', () => {
  assert.equal(total([]), 0);
});
```

A stand-in for a real build step, `build.js`:

```javascript
// A stand-in for a real build step: copy src/ into a clean dist/ folder.
import { cp, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await cp('src', 'dist', { recursive: true });
console.log('Built dist/');
```

And a linter. **ESLint** finds common mistakes, such as unused variables, without running the code. Install it and add `eslint.config.js`:

```bash
npm install --save-dev eslint @eslint/js globals
```

```javascript
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/'] },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
];
```

Check that everything works on your machine first:

```bash
npm run lint
npm test
npm run build
```

Finally, add a `.gitignore` with `node_modules/` and `dist/`, commit everything, create an empty repository on GitHub and push to it.

> **Tip:** Always commit `package-lock.json`. The pipeline installs with `npm ci`, which uses the **exact** versions in the lock file, so CI tests exactly what you tested locally.

## Step 2: the first workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

Line by line:

- **`name`** is what the workflow is called in the **Actions** tab.
- **`on`** lists the events: every push to `main`, and every pull request.
- **`jobs`** holds one job called `test`.
- **`runs-on: ubuntu-latest`** asks for a fresh Ubuntu virtual machine.
- **`uses: actions/checkout@v5`** downloads your repository onto the runner. Without it, the runner is empty.
- **`uses: actions/setup-node@v5`** installs Node.js 24. `with:` passes settings to an action.
- **`run:`** lines are ordinary shell commands, run one after another. If any command fails, the job stops and is marked as failed.

> **Note:** YAML is picky about **indentation**: use spaces, never tabs, and keep items at the same level lined up exactly. Most "my workflow does nothing" problems are an indentation mistake. VS Code's GitHub Actions extension highlights them as you type.

Commit and push the file. Open your repository on GitHub and click the **Actions** tab. You will see the workflow running. Click into it to watch each step's live output. A minute later you should see a green tick.

## Step 3: break it on purpose

A pipeline you have never seen fail is a pipeline you do not really trust. Add an unused variable to `src/price.js`:

```javascript
const unused = 1;
```

Push it. The `npm run lint` step fails, the job turns red, and the log shows exactly why, something like:

```text
/home/runner/work/recipe-api/recipe-api/src/price.js
  4:7  error  'unused' is assigned a value but never used  no-unused-vars

✖ 1 problem (1 error, 0 warnings)
Error: Process completed with exit code 1.
```

GitHub marks the commit with a red cross and, by default, emails you. Remove the line, push again, and it goes green. That is the CI loop.

## Step 4: a better pipeline

The first workflow works, but it is slow and does everything in one long line. The code panel for this lesson has the improved version. Here is what changed and why.

### Separate jobs that run in parallel

```yaml
jobs:
  lint:
    ...
  test:
    ...
  build:
    needs: [lint, test]
```

`lint` and `test` start at the same time on separate runners, so the pipeline finishes sooner. `needs:` makes `build` wait until **both** have passed. If either fails, `build` never runs.

### A matrix: test on several versions at once

```yaml
  test:
    strategy:
      matrix:
        node-version: [22, 24]
    steps:
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ matrix.node-version }}
```

A **matrix** runs the same job once for each value: here, one job on Node 22 and one on Node 24, in parallel. `${{ ... }}` is an **expression**: GitHub replaces it with a value before the step runs. Matrices can also cover operating systems (`ubuntu-latest`, `windows-latest`, `macos-latest`).

### Caching

```yaml
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
```

Downloading packages on every run is slow. `cache: npm` saves npm's download cache between runs, keyed on `package-lock.json`, so later runs reuse it. On bigger projects this saves minutes per run.

### Saving the build as an artifact

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
          retention-days: 14
```

Runners are thrown away after each job, along with everything on their disks. An **artifact** is a file or folder the workflow keeps. Here, the built `dist/` folder is saved under a name containing the commit ID, and anyone can download it from the run's page for 14 days. In [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning) you will see why "build once, keep the artifact" matters so much.

### More triggers, tighter permissions, no wasted runs

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

- **`workflow_dispatch`** adds a **Run workflow** button, so you can start it by hand.
- **`permissions`** limits what the automatic `GITHUB_TOKEN` can do. This pipeline only needs to read the code, so that is all it gets: the [least privilege](/courses/devops/ssh-users-and-permissions) idea again.
- **`concurrency`** cancels an older run on the same branch when you push again. There is no point finishing tests for a commit that has already been replaced.

## Step 5: protect main

Right now, anyone with write access can still push straight to `main` or merge a red pull request. Let GitHub enforce the rules from [Branching Strategies](/courses/devops/branching-strategies):

1. In your repository, open **Settings → Rules → Rulesets** and choose **New branch ruleset**.
2. Set **Enforcement status** to **Active**, and under **Target branches** add the **default branch**.
3. Tick **Require a pull request before merging**, with at least one approval if you work in a team.
4. Tick **Require status checks to pass**, and add your jobs: `lint`, `test (22)`, `test (24)` and `build`. (Each matrix job gets its own check name.)
5. Tick **Block force pushes**, and save.

Now every change goes through a pull request, and the **Merge** button stays disabled until all checks are green.

## Secrets

Pipelines often need passwords or tokens, for example to deploy. **Never** write them in the workflow file. Store them in **Settings → Secrets and variables → Actions**, then read them in a step:

```yaml
      - run: ./deploy.sh
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

GitHub hides secret values in the logs (replacing them with `***`) and, for safety, does not give secrets to workflows triggered by pull requests from **forks** of your repository. You will use secrets for deployment in [Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment).

## Good habits

- **Pin action versions.** `actions/checkout@v5` always means the latest v5. For actions from people or companies you do not know well, pin to a full **commit SHA** instead, so the code you run cannot change underneath you.
- **Use well-known actions.** An action runs with access to your code and token. Prefer official (`actions/...`) and widely used ones, and read what you add.
- **Keep the pipeline fast.** Parallel jobs, caching and fast tests first. Watch the run times in the Actions tab as the project grows.
- **Treat workflow files as code.** Review changes to `.github/workflows/` as carefully as any other change: they control what runs with your secrets.

## Common misunderstandings

### "The workflow runs on my computer"

It runs on a fresh virtual machine in GitHub's data centres, which is thrown away afterwards. Nothing from your laptop is there unless it is committed. (Tools such as `act` can imitate a run locally, but the real thing is the runner.)

### "A green tick means it is deployed"

This pipeline only **builds and tests**. Getting the result onto servers is **delivery** and **deployment**, which you will add in the next lessons.

### "Jobs share files"

Each job gets its own fresh runner. To pass files from one job to another, upload them as an artifact in the first job and download them in the second.

## Quick recap

- A **workflow** is a YAML file in `.github/workflows/`; **events** start it; **jobs** run in parallel on **runners**; **steps** are `run` commands or `uses` actions.
- Check out the code with `actions/checkout`, install tools with actions like `actions/setup-node`, install dependencies with `npm ci`.
- Use `needs` to order jobs, a **matrix** to test several versions, **caching** for speed and **artifacts** to keep build output.
- Limit the token with `permissions`, cancel stale runs with `concurrency`, and keep credentials in **secrets**.
- Protect `main` with a **ruleset** that requires pull requests and green status checks.

Next, you will decide what those tests should actually check in [Automated Testing in the Pipeline](/courses/devops/testing-in-the-pipeline).

<code id="code-content" class="language-yaml">
# .github/workflows/ci.yml: a complete CI pipeline for a Node.js project.
# Lint and test in parallel, then build once and keep the result as an artifact.
name: CI
on:
  push:
    branches: [main]
  pull_request:                       # every pull request, to any branch
  workflow_dispatch:                  # adds a "Run workflow" button in the Actions tab
# The job's token may only read the code (least privilege)
permissions:
  contents: read
# A newer push to the same branch or PR cancels the older, now pointless, run
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm                  # reuse downloaded packages between runs
      - run: npm ci
      - run: npm run lint
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22, 24]        # one job per Node version you support
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm test
  build:
    needs: [lint, test]               # only build code that passed every check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
          retention-days: 14
</code></pre>

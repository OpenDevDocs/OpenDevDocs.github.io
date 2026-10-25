---
publishDate: 2026-10-25T13:15
title: CI/CD for Node Projects
slug: ci-cd-for-node-projects
metadescription: Run your Node tests automatically on every push with GitHub Actions, test on Node 24 and 26 with a matrix, cache npm, and add a simple deploy step.
updateDate: 2026-10-25T13:15
author: ['bishal-biswas']
level: 4
tags: ['ci', 'github-actions', 'testing']
course: nodejs
---

## What CI/CD means

Imagine a bakery where every new loaf is tasted before it goes on the shelf. Nobody has to remember to do it. It just happens, every time.

**CI** (continuous integration) is that taste test for code. Every time someone pushes a commit or opens a pull request, a server checks out the code, installs it and runs the tests. If anything fails, everyone sees a red cross before the change is merged.

**CD** (continuous delivery or deployment) is the next step: when the checks pass on the main branch, the same system ships the code, for example by building a Docker image and deploying it.

Without CI, "I forgot to run the tests" eventually breaks production. With CI, a computer never forgets.

## GitHub Actions in one minute

This lesson uses **GitHub Actions**, which is built into GitHub and free for public repositories. The vocabulary:

- A **workflow** is a YAML file in `.github/workflows/`. It describes when to run and what to do.
- An **event** (or trigger) is what starts it: a push, a pull request, a release, a schedule.
- A **job** is a group of steps that runs on one fresh virtual machine, called a **runner**.
- A **step** is either a shell command (`run:`) or a reusable **action** (`uses:`).

## Your first workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci
      - run: npm test
```

Line by line:

- **`on`**: run on pushes to `main` and on every pull request.
- **`permissions: contents: read`**: the workflow can read the code but not change the repository. Give workflows the least power they need.
- **`runs-on: ubuntu-latest`**: use a fresh Linux machine provided by GitHub.
- **`actions/checkout@v4`**: download your repository onto the runner. Without it, the machine is empty.
- **`actions/setup-node@v4`**: install Node.
- **`npm ci`**: a clean install that follows the lockfile exactly.
- **`npm test`**: run your tests. If the command exits with a non-zero code, the step fails and the job turns red.

Push this file, open the **Actions** tab on GitHub, and you will see it run.

## Picking the Node version

### node-version-file

**`node-version-file`** tells `setup-node` to read the version from a file in your repository, so CI and your laptop always agree. A common choice is `.nvmrc`, which you met in [the Installing Node.js lesson](/courses/nodejs/installing-nodejs-and-version-managers):

```text
24
```

`setup-node` can also read the `engines.node` field from `package.json` if you point `node-version-file` at `package.json`.

### cache: npm

Downloading every package on every run is slow. **`cache: npm`** saves npm's download cache between runs, keyed on your `package-lock.json`. When the lockfile has not changed, installs are much faster.

> **Note:** The cache needs a lockfile committed to the repository. Without `package-lock.json`, `setup-node` cannot build the cache key and `npm ci` will fail anyway.

## Testing on several Node versions with a matrix

Your users might run Node 24, the Active LTS line, or Node 26, which becomes LTS in late October 2026. You want to know your code works on both.

A **matrix** runs the same job several times with different values:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [24, 26]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci
      - run: npm test
```

- **`matrix.node-version: [24, 26]`** creates two jobs: one with Node 24, one with Node 26. They run in parallel.
- **`${{ matrix.node-version }}`** is an **expression**. GitHub replaces it with the value for each job.
- **`fail-fast: false`** keeps the other jobs running if one fails, so you can see whether the problem is only on one version.

Here we use `node-version` instead of `node-version-file`, because each job needs a different version.

You can test on several operating systems too:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [24, 26]
runs-on: ${{ matrix.os }}
```

That makes 3 x 2 = 6 jobs. It is worth it for CLI tools and libraries, where path and line-ending differences bite. For a web API that only ever runs on Linux, one OS is enough.

## A fuller CI job

Real projects usually check more than tests:

```yaml
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm run build --if-present
      - run: npm test
      - run: npm audit --audit-level=high
```

- `--if-present` skips a script that does not exist, so the same workflow fits many projects.
- `npm audit --audit-level=high` fails the job if a dependency has a known high or critical vulnerability (see [the Security lesson](/courses/nodejs/security-and-supply-chain)).

Steps run in order and stop at the first failure, so put the fastest checks first.

## Cancelling outdated runs

If you push three commits in a row, you do not need three full runs. A **concurrency** group cancels the older one:

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Put this at the top level of the workflow, next to `on:`.

## Adding CD: deploy when main is green

Now the delivery part. A second job builds a Docker image and pushes it to GitHub Container Registry, but only after the tests pass, and only on `main`:

```yaml
  deploy:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

      - name: Build and push the image
        run: |
          IMAGE=ghcr.io/${{ github.repository }}:${{ github.sha }}
          docker build -t "$IMAGE" .
          docker push "$IMAGE"
```

- **`needs: test`** waits for every matrix job of `test` to pass.
- **`if:`** skips deploys on pull requests and other branches.
- **`environment: production`** links the job to a GitHub **environment**, where you can require a manual approval and store production-only secrets.
- **`secrets.GITHUB_TOKEN`** is a short-lived token GitHub creates for each run. Other secrets, such as an API key for your host, are added under the repository's **Settings > Secrets and variables > Actions** and read the same way: `${{ secrets.DEPLOY_KEY }}`.
- Tagging the image with **`github.sha`** (the commit id) means you always know exactly which code is running, and rolling back is just deploying an older tag.

What happens after the push depends on your host: a server pulls the new image, a platform redeploys, and so on. You will see those options in [the Deploying and Scaling lesson](/courses/nodejs/deploying-and-scaling).

## Keeping workflows healthy

- **Pin actions to a major version** like `@v4`, so you get fixes but no breaking changes. For extra safety, some teams pin to a full commit SHA.
- **Let Dependabot update them.** A `.github/dependabot.yml` file can open pull requests when new versions of your npm packages or actions come out.
- **Never print secrets.** GitHub hides known secrets in logs, but transforming them (for example, base64 encoding) can leak them.

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

## Common mistakes

**Using `npm install` in CI.** It can change the lockfile and install versions you never tested.

```yaml
# Wrong
- run: npm install
```

```yaml
# Right
- run: npm ci
```

**Forgetting `actions/checkout`.** The runner starts empty, so `npm ci` fails with "could not read package.json".

**Tests that pass locally but not in CI.** Common causes: a test depends on your time zone, a file only on your disk, or an environment variable from your `.env`. CI is a clean machine, which is exactly why it catches these.

**Writing the version as a number with a trailing zero.** YAML reads `22.10` as the number 22.1. Quote versions that look like decimals: `node-version: '22.10'`. Whole numbers like `24` are fine.

## Quick recap

- CI runs your checks on every push and pull request; CD ships the code when checks pass.
- A GitHub Actions workflow lives in `.github/workflows/` and is made of jobs and steps.
- `actions/checkout@v4` gets the code; `actions/setup-node@v4` installs Node, with `node-version-file` and `cache: npm`.
- Use `npm ci`, then `npm test`; a non-zero exit code fails the job.
- A matrix over `[24, 26]` tests both LTS lines in parallel.
- A deploy job uses `needs`, `if` and `environment` so it only runs after green tests on `main`.

<code id="code-content" class="language-javascript">
// ci-check.mjs: the kind of file your CI pipeline runs on every push.
// Run it with: node ci-check.mjs   (in CI it would run via: npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
// --- The code under test: a tiny order calculator ---
export function orderTotal(items, { discount = 0 } = {}) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  const subtotal = items.reduce((sum, item) =&gt; sum + item.price * item.qty, 0);
  return Math.round(subtotal * (1 - discount) * 100) / 100;
}
// --- Where am I running? GitHub Actions sets CI=true and GITHUB_ACTIONS=true ---
const inCI = process.env.CI === 'true';
console.log(`Node ${process.version} on ${process.platform}, CI: ${inCI ? 'yes' : 'no (local run)'}`);
if (process.env.GITHUB_ACTIONS) {
  console.log(`Repository: ${process.env.GITHUB_REPOSITORY}, commit: ${process.env.GITHUB_SHA?.slice(0, 7)}`);
}
// --- The tests: if any fails, the process exits with code 1 and the CI job turns red ---
test('adds up quantities and prices', () =&gt; {
  const items = [
    { name: 'Notebook', price: 3.5, qty: 2 },
    { name: 'Pen', price: 1.25, qty: 4 },
  ];
  assert.equal(orderTotal(items), 12);
});
test('applies a discount', () =&gt; {
  assert.equal(orderTotal([{ name: 'Book', price: 20, qty: 1 }], { discount: 0.1 }), 18);
});
test('an empty order costs nothing', () =&gt; {
  assert.equal(orderTotal([]), 0);
});
test('rejects bad input', () =&gt; {
  assert.throws(() =&gt; orderTotal('not a list'), TypeError);
});
// Features differ between Node lines, which is why the matrix runs 24 and 26
test('works on every Node line in the matrix', () =&gt; {
  const major = Number(process.versions.node.split('.')[0]);
  assert.ok(major &gt;= 24, `expected Node 24 or newer, got ${major}`);
  // false on Node 24, true on Node 26 (Temporal is on by default there)
  console.log(`  Temporal available: ${typeof globalThis.Temporal !== 'undefined'}`);
});
</code></pre>

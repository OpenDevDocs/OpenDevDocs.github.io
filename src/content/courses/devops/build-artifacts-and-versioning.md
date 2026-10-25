---
publishDate: 2026-10-25T11:25
title: Build Artifacts and Versioning
slug: build-artifacts-and-versioning
metadescription: Learn what build artifacts are, why you build once and deploy the same artifact everywhere, where artifacts are stored, how Semantic Versioning and Conventional Commits work, and how to tag releases and container images.
updateDate: 2026-10-25T11:25
author: ['bishal-biswas']
level: 2
tags: ['devops', 'ci-cd', 'artifacts', 'semver', 'releases']
course: devops
---

## What is a build artifact?

A **build artifact** is the finished, ready-to-run output of your build: the thing you actually ship. Source code is the recipe; the artifact is the cooked dish.

What it looks like depends on the project:

| Project | Typical artifact |
|---|---|
| Static website (React, Astro, Vue) | A folder of HTML, CSS and JS, often zipped |
| Node.js library | An npm package (`.tgz`) |
| Java service | A `.jar` file |
| .NET service | A published folder or NuGet package |
| Go or Rust tool | A single compiled binary per operating system |
| Almost anything, today | A **container image** |

You saved your first artifact with `actions/upload-artifact` in [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline). This lesson is about why artifacts matter so much and how to name them.

## Build once, deploy many

This is one of the most important rules in continuous delivery:

> **Build the artifact once. Test that exact artifact. Deploy that exact artifact to every environment.**

Picture the opposite. The pipeline builds the code to run the tests. Later, someone builds it again for staging, and again for production. Each build happens on a different day, on a different machine, perhaps with a dependency that released a new version in between. The thing that reaches production is **not** the thing that was tested. Any difference, however small, is an untested risk.

With build-once:

```text
commit 3ef9d3a ──> build ──> artifact shop-1.5.0 ──> tests
                                    │
                                    ├──> deploy to staging     (same file)
                                    └──> deploy to production  (same file)
```

Only the **configuration** changes between environments (database address, API keys, feature flags), and that comes from outside the artifact. You will see how in [Configuration, Environments and Secrets](/courses/devops/configuration-environments-and-secrets).

### Artifacts are immutable

Once an artifact is published with a version, **never change it**. If `shop-1.5.0` has a bug, you publish `shop-1.5.1`. You do not quietly replace `1.5.0`. Otherwise "version 1.5.0" means different things on different days, and nobody can be sure what is running.

## Where artifacts live

Pipeline runners are thrown away after every job, so artifacts must be stored somewhere permanent. These stores are called **artifact repositories** or **registries**:

| Store | Holds |
|---|---|
| **CI artifact storage** (e.g. GitHub Actions artifacts) | Short-term: passing files between jobs, downloads for a few weeks |
| **Package registries**: npm, PyPI, NuGet, Maven Central | Libraries for other people to install |
| **GitHub Packages** / **GitLab Package Registry** | Packages and images next to your code |
| **Container registries**: Docker Hub, GitHub Container Registry (GHCR), Amazon ECR, Azure ACR, Google Artifact Registry | Container images |
| **Universal repositories**: JFrog Artifactory, Sonatype Nexus | Everything, often inside large companies |

A good registry gives you versioned, immutable storage, access control, and **retention rules** that clean up old builds automatically so storage does not grow forever.

## Versioning

Every artifact needs a name that says exactly **which** build it is. That is what a **version** is for. The most widely used scheme is **Semantic Versioning**.

### Semantic Versioning (SemVer)

A SemVer version has three numbers:

```text
   2 . 4 . 1
   |   |   |
   |   |   +-- PATCH: bug fixes that change nothing else
   |   +------ MINOR: new features that do not break existing users
   +---------- MAJOR: changes that BREAK existing users
```

The rules:

| Change | Example | New version from `2.4.1` |
|---|---|---|
| Fix a bug, nothing else changes | Correct a rounding error | `2.4.2` |
| Add a feature, everything old still works | New optional search filter | `2.5.0` (patch resets to 0) |
| Break something existing users rely on | Rename an API field, remove an endpoint | `3.0.0` (minor and patch reset) |

The beauty of SemVer is that the number **communicates risk**. Upgrading from `2.4.1` to `2.4.2` should be safe. Upgrading to `3.0.0` means "read the release notes first".

A few extra parts you will see:

- **Pre-releases** add a dash and a label: `3.0.0-beta.1`, `3.0.0-rc.2`. They sort **before** `3.0.0`.
- **`0.x` versions** (`0.7.3`) mean "still in early development: anything may change".
- **Build metadata** after a plus sign, such as `1.5.0+sha.3ef9d3a`, is informational and ignored when comparing versions.

### Calendar versioning

Some projects use dates instead, called **CalVer**. Ubuntu's `24.04` means "released in April 2024". It is a good fit for products released on a schedule, where "how new is it?" matters more than "does it break things?".

### Commit IDs for traceability

For services you deploy yourself, many teams add the **Git commit ID** to every artifact. Then, for anything running anywhere, you can answer the most important question in an incident: **exactly which code is this?** A common pattern is to give one build several names:

```text
shop:1.5.0          the release version
shop:1.5            "the newest 1.5.x"
shop:sha-3ef9d3a    the exact commit, never reused
```

> **Note:** Be careful with the `latest` tag on container images. It just means "whatever was pushed last", so two servers both running `shop:latest` might be running different code. Deploy **specific, immutable** tags such as `1.5.0` or `sha-3ef9d3a`.

## Conventional Commits: versions from your history

Deciding by hand whether each release is a major, minor or patch is easy to get wrong. **Conventional Commits** is a simple convention for commit messages that lets a tool decide for you:

```text
fix: show the right currency symbol on receipts        -> PATCH
feat(search): filter recipes by cooking time           -> MINOR
feat!: return prices in paise instead of rupees        -> MAJOR (the ! means breaking)
docs: explain discount codes in the README             -> no release
```

The type comes first (`feat`, `fix`, `docs`, `test`, `chore`, `perf`, `refactor`...), an optional **scope** in brackets, then a colon and the description. A `!` after the type, or a line starting `BREAKING CHANGE:` in the body, marks a breaking change.

Tools such as **semantic-release**, **release-please** and **Changesets** read these messages and automatically work out the next version, update the changelog, create the Git tag and publish the release.

## Tagging a release

When a release is ready, tag the commit (as you saw in [Version Control with Git](/courses/devops/version-control-with-git)) and let the pipeline take it from there:

```bash
git tag -a v1.5.0 -m "Release 1.5.0"
git push origin v1.5.0
```

A workflow can be triggered by tags instead of branches:

```yaml
on:
  push:
    tags: ['v*.*.*']
```

That workflow builds the artifact, names it from the tag, publishes it to the registry and creates a release page with notes.

## Proving an artifact is genuine

As your pipeline matures, add a few more guarantees:

- **Checksums.** Publish a SHA-256 hash next to each file, so anyone can confirm it was not corrupted or swapped: `sha256sum shop-1.5.0.tgz`.
- **Signatures.** Tools such as **Sigstore's cosign** sign artifacts and container images, so you can prove they came from your pipeline.
- **SBOM** (Software Bill of Materials). A list of every dependency inside the artifact, so when a new vulnerability is announced you can find out in seconds whether you are affected.

You will come back to these in [DevSecOps: Security in the Pipeline](/courses/devops/devsecops-basics).

## Working out the next version

The code panel for this lesson has a Node.js script that reads Conventional Commit messages and works out the next Semantic Version, plus a set of image tags. With its built-in sample commits:

```bash
node next-version.mjs
```

```text
Current version: 1.4.2

  patch  fix: show the right currency symbol on receipts
  -      docs: explain the discount codes in the README
  minor  feat(search): filter recipes by cooking time
  -      test: cover rounding in applyDiscount

Next version:    1.5.0
Git tag:         v1.5.0
Image tags:      shop:1.5.0, shop:1.5, shop:sha-a1b2c3d
```

The biggest change wins: one `feat` outweighs any number of `fix` commits, so the release is a **minor** one. Run it with `--git` inside one of your own repositories and it reads the latest tag and the commits since then. After a breaking change it looks like this:

```text
Current version: v1.0.0

  major  feat!: prices are now returned in paise
  -      Convert paise to rupees on receipts

Next version:    2.0.0
Git tag:         v2.0.0
Image tags:      shop:2.0.0, shop:2.0, shop:sha-0fc6b8b
```

## Common misunderstandings

### "Rebuilding is the same as reusing"

Two builds of the same commit can differ: a dependency range resolved to a newer version, a different compiler, a different timestamp. Lock files (`package-lock.json`) reduce the risk, but only **reusing the exact artifact** removes it.

### "Version numbers are just for marketing"

For a library, SemVer is a promise to every project that depends on you. Breaking it with a "minor" release breaks other people's builds.

### "The artifact should contain the production config"

Then you need a different artifact per environment, which breaks build-once. Keep configuration **outside** the artifact and inject it at deploy time.

## Quick recap

- A **build artifact** is the ready-to-run output you ship: a folder, package, binary or container image.
- **Build once, deploy many**: test and deploy the exact same artifact everywhere; only configuration changes.
- Published artifacts are **immutable** and stored in **registries** with retention rules.
- **SemVer** (`MAJOR.MINOR.PATCH`) communicates risk; **Conventional Commits** let tools pick the next version.
- Add the **commit ID** for traceability, and avoid deploying `latest`.
- Checksums, signatures and SBOMs prove an artifact is genuine.

Next, you will take that artifact all the way to production in [Continuous Delivery vs Continuous Deployment](/courses/devops/continuous-delivery-vs-deployment).

<code id="code-content" class="language-javascript">
// next-version.mjs: work out the next release number from commit messages.
// Uses Semantic Versioning (MAJOR.MINOR.PATCH) and the Conventional Commits style.
// Run it with: node next-version.mjs            (uses the sample commits below)
//          or: node next-version.mjs --git      (reads your repo's tags and history)
import { execSync } from 'node:child_process';
const sh = (cmd) =&gt; execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
// What kind of change is each commit?
function bumpFor(message) {
  if (/^\w+(\(.+\))?!:/.test(message) || message.includes('BREAKING CHANGE')) return 'major';
  if (/^feat(\(.+\))?:/.test(message)) return 'minor';
  if (/^(fix|perf)(\(.+\))?:/.test(message)) return 'patch';
  return null;                                   // docs:, test:, chore: ... no release needed
}
function nextVersion(current, messages) {
  const [major, minor, patch] = current.replace(/^v/, '').split('.').map(Number);
  const bumps = new Set(messages.map(bumpFor));
  if (bumps.has('major')) return `${major + 1}.0.0`;
  if (bumps.has('minor')) return `${major}.${minor + 1}.0`;
  if (bumps.has('patch')) return `${major}.${minor}.${patch + 1}`;
  return null;
}
let current = '1.4.2';
let commits = [
  'fix: show the right currency symbol on receipts',
  'docs: explain the discount codes in the README',
  'feat(search): filter recipes by cooking time',
  'test: cover rounding in applyDiscount',
];
const useGit = process.argv.includes('--git');
if (useGit) {
  try {
    current = sh('git describe --tags --abbrev=0');            // the latest tag, e.g. v1.4.2
    commits = sh(`git log ${current}..HEAD --format=%B%x00`).split('\0');
  } catch {
    current = '0.0.0';                                         // no tags yet
    commits = sh('git log --format=%B%x00').split('\0');
  }
  commits = commits.map((c) =&gt; c.trim()).filter(Boolean);
}
console.log(`Current version: ${current}\n`);
for (const message of commits) {
  console.log(`  ${(bumpFor(message) ?? '-').padEnd(6)} ${message.split('\n')[0]}`);
}
const next = nextVersion(current, commits);
if (!next) {
  console.log('\nNothing user-facing changed: no new release needed.');
  process.exit(0);
}
const sha = useGit ? sh('git rev-parse --short HEAD') : 'a1b2c3d';
const [major, minor] = next.split('.');
console.log(`\nNext version:    ${next}`);
console.log(`Git tag:         v${next}`);
console.log('Image tags:      ' + [`shop:${next}`, `shop:${major}.${minor}`, `shop:sha-${sha}`].join(', '));
</code></pre>

---
publishDate: 2026-10-25T18:00
title: 'Scanning Images for Vulnerabilities with Docker Scout'
slug: image-scanning-with-docker-scout
metadescription: 'Learn how to find known security holes in your Docker images with Docker Scout, read the results, fix them, and block risky images in CI.'
updateDate: 2026-10-25T18:00
author: ['bishal-biswas']
level: 2
tags: ['docker', 'security', 'docker-scout', 'vulnerabilities']
course: docker
---

## Why scan your images?

Your image is not only your code. It also contains a base image (an operating system like Alpine or Debian), system libraries, and every npm or pip package your app installs. Each of these pieces is written by other people, and from time to time someone finds a security bug in one of them.

When a security bug becomes public, it gets an ID called a **CVE** (Common Vulnerabilities and Exposures), for example `CVE-2025-12345`. A **vulnerability scanner** is a tool that looks at every package inside your image and checks it against a big list of known CVEs. Think of it like a food safety inspector: it does not cook your food, it checks the ingredients against a list of recalled products.

**Docker Scout** is the scanner built into Docker. In this lesson you will:

- scan the `notes-api` image and read the summary,
- list the CVEs and understand severity levels,
- ask Scout how to fix them,
- make a scan fail your build when serious problems appear.

> **Note:** A scanner only finds problems that are already known and listed. A clean scan does not mean your app is safe. It means none of your packages are on the "recalled" list today. You will learn the other half of the story in [Container Security Best Practices](/courses/docker/container-security-best-practices).

## Getting ready

Docker Scout ships with Docker Desktop and with recent Docker Engine installs as the `docker scout` command. Check that you have it:

```bash
docker scout version
```

Scout needs you to be signed in with a Docker account, because it downloads its vulnerability data from Docker's servers:

```bash
docker login
```

> **Tip:** Analyzing images on your own computer with the CLI works with a free Docker account. Paid plans add features such as watching many repositories in the Docker Scout dashboard.

You need an image to scan. Build the `notes-api` image from [Project: Dockerizing a Node.js App](/courses/docker/dockerizing-a-node-app) if you do not already have it:

```bash
docker build -t notes-api:1.0.0 .
```

## Step 1: the quick overview

Start with `quickview`. It prints a short summary of what is inside the image:

```bash
docker scout quickview notes-api:1.0.0
```

```text
    ✓ Image stored for indexing
    ✓ Indexed 212 packages

  Target             │  notes-api:1.0.0  │    0C     1H     3M     2L
    digest           │  4f2a91c0e7b3     │
  Base image         │  node:24-alpine   │    0C     1H     2M     2L
  Updated base image │  node:24-alpine   │    0C     0H     0M     0L
                     │                   │    -1     -2     -2
```

Your numbers will be different, because new CVEs are found every week. Here is how to read it:

| Part | Meaning |
|---|---|
| `Target` | Your image, with the count of CVEs in it |
| `C H M L` | **C**ritical, **H**igh, **M**edium, **L**ow severity |
| `Base image` | The image in your `FROM` line and its own CVEs |
| `Updated base image` | A newer build of the same base image, if one exists |

This example tells a clear story: most problems come from the base image, and a fresh copy of `node:24-alpine` has none of them. The fix is simply to rebuild on the updated base.

**Indexing** is the first thing Scout does. It makes a list of every package in the image, called an **SBOM** (Software Bill of Materials). The SBOM is like the ingredients label on food. Scout then compares that label against its CVE database.

## Step 2: list the actual CVEs

To see each problem, use `cves`:

```bash
docker scout cves notes-api:1.0.0
```

```text
    ✓ SBOM of image already cached, 212 packages indexed
    ✗ Detected 3 vulnerable packages with a total of 6 vulnerabilities

   0C     1H     1M     0L  openssl 3.5.1-r0
pkg:apk/alpine/openssl@3.5.1-r0

    ✗ HIGH CVE-2025-00001
      https://scout.docker.com/v/CVE-2025-00001
      Affected range : <3.5.2-r0
      Fixed version  : 3.5.2-r0
...
```

For each vulnerable package, Scout shows:

- the package name and version (`openssl 3.5.1-r0`),
- the CVE ID and a link to read more,
- the **affected range**: which versions have the bug,
- the **fixed version**: the first version without the bug, if there is one.

> **Note:** The CVE IDs above are made up for the example. Run the command on your own image to see real ones.

### Filtering the list

A real image can have dozens of low-severity CVEs. Focus on what matters first:

```bash
# Only show critical and high problems
docker scout cves --only-severity critical,high notes-api:1.0.0

# Only show problems that already have a fix you can install
docker scout cves --only-fixed notes-api:1.0.0
```

The second filter is very practical. A CVE with no fixed version yet is something you can only watch. A CVE with a fix is something you can solve today.

### Understanding severity

Severity is a score that says how bad the bug could be in the worst case:

| Severity | Rough meaning |
|---|---|
| Critical | Easy to attack from the network, big damage. Fix now. |
| High | Serious. Fix soon, usually within days. |
| Medium | Harder to use or less damage. Plan a fix. |
| Low | Small risk. Fix when convenient. |

Severity is about the package in general, not about your app. A high CVE in a tool your app never runs is less urgent than it looks, but it is still worth removing. The easiest way to remove it is to not ship that package at all, which is why small base images help so much.

## Step 3: ask Scout how to fix it

Scout can suggest a better base image:

```bash
docker scout recommendations notes-api:1.0.0
```

```text
  Recommended fixes for image notes-api:1.0.0

  Base image is  node:24-alpine

  Refresh base image
  Rebuild the image using a newer base image version. Updating this may result in breaking changes.

            Tag            │                        Details                         │ Pushed
  ─────────────────────────┼────────────────────────────────────────────────────────┼─────────
   24-alpine               │ Benefits:                                              │ 3 days ago
                           │ • Same OS detected                                     │
                           │ • Image contains 2 fewer vulnerabilities               │
```

There are two kinds of advice:

- **Refresh base image:** your tag (for example `node:24-alpine`) has been rebuilt with patches since you last pulled it. Just rebuild.
- **Change base image:** a different tag (for example a newer Node version, or a `-slim` variant) has fewer problems. This can change behavior, so test it.

You learned how to pick between `alpine`, `slim` and full images in [Choosing a Base Image](/courses/docker/choosing-a-base-image).

## Step 4: fix and scan again

Most fixes fall into three groups.

### Fix 1: rebuild with a fresh base image

Docker caches the base image on your machine. If you pulled `node:24-alpine` two months ago, `docker build` keeps using that old copy. Add `--pull` to always fetch the newest one:

```bash
docker build --pull -t notes-api:1.0.1 .
docker scout quickview notes-api:1.0.1
```

This one flag fixes a surprising number of CVEs. Many teams rebuild every image once a week just to pick up base image patches.

### Fix 2: update your app's packages

If the CVE is in an npm package, update it in your project, not in the Dockerfile:

```bash
npm audit             # npm's own list of known problems
npm update            # update within the ranges in package.json
npm audit fix         # try to fix automatically
```

Then rebuild. Your `package-lock.json` now pins the fixed versions, and `npm ci` in the Dockerfile installs them.

### Fix 3: ship less

Every package you do not ship is a package that cannot have a CVE. Two tools from earlier lessons help a lot:

- [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds) keep compilers and dev dependencies out of the final image.
- `npm ci --omit=dev` installs only production dependencies.

Here is a quick comparison you can try yourself:

```bash
docker scout quickview node:24        # full Debian based image
docker scout quickview node:24-slim   # smaller Debian based image
docker scout quickview node:24-alpine # tiny Alpine based image
```

The full image usually has many more CVEs, simply because it contains many more packages.

## Seeing what is inside: the SBOM

Sometimes you just want the ingredients list, for example to check if a library is present at all:

```bash
docker scout sbom --format list notes-api:1.0.1
```

```text
           Name                Version        Type
  ─────────────────────────────────────────────────────
  busybox                     1.37.0-r18    apk
  musl                        1.2.5-r10     apk
  openssl                     3.5.2-r0      apk
  pg                          8.16.3        npm
  ...
```

This is handy when a big CVE hits the news and your manager asks "are we affected?". You can answer in seconds.

## Making scans part of your workflow

Scanning by hand once is good. Scanning every build is better.

### Fail the build on serious problems

`docker scout cves` can return an error exit code when it finds vulnerabilities. Combine it with the severity filter:

```bash
docker scout cves --exit-code --only-severity critical,high notes-api:1.0.1
echo $?    # 0 means clean, a non-zero number means problems were found
```

In a CI pipeline, a non-zero exit code stops the job. That means an image with a critical CVE never reaches your registry. You will build that pipeline in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions). Docker also publishes an official `docker/scout-action` for GitHub Actions if you prefer a ready-made step.

### Scan images you pull, too

You can scan any image, not only your own. Before you add a new database or tool to your stack, take a look:

```bash
docker scout quickview postgres:17-alpine
docker scout quickview redis:8-alpine
```

### A simple routine

| When | What to do |
|---|---|
| Every build in CI | `cves --exit-code --only-severity critical,high` |
| Every week | Rebuild with `--pull`, then scan |
| When a big CVE is in the news | Check the SBOM of your images |
| When choosing a base image | Compare with `quickview` |

> **Tip:** Rebuilding with `--pull` changes the image content even if your code did not change. Give it a new tag, as you learned in [Tagging Images for Releases](/courses/docker/tagging-strategy), so you can always tell which build is running.

## Common mistakes

### Scanning once and forgetting

An image that was clean in January can have five high CVEs in March, without any change to the image. The packages did not change, but the list of known bugs did. Scan regularly.

### Trying to reach zero at any cost

Some CVEs have no fix yet, and some are in code your app never uses. Spending days chasing every low CVE is not a good use of time. Fix critical and high ones that have a fix, keep the image small, and move on.

### Updating packages inside the Dockerfile with a blind upgrade

Adding `RUN apk upgrade` to every Dockerfile makes builds unpredictable, because each build gets different versions. Prefer rebuilding on a fresh base image with `--pull`. The base image maintainers already test their updates.

### Forgetting that the scan is about the image, not the container

Scout looks at the image file, not at what is running. If you fix the image but never redeploy, your running containers still have the old packages.

## Quick recap

- A **CVE** is a publicly known security bug. A **scanner** checks every package in your image against the CVE list.
- `docker scout quickview` gives a summary, `docker scout cves` lists each problem, `docker scout recommendations` suggests a better base image.
- Filter with `--only-severity critical,high` and `--only-fixed` to focus on what you can fix now.
- Most fixes are: rebuild with `docker build --pull`, update app packages, and ship fewer packages with multi-stage builds and small bases.
- Add `--exit-code` in CI so risky images never get pushed, and rescan on a schedule.

For the bigger security picture, see [DevSecOps Basics](/courses/devops/devsecops-basics). Next, you will harden the running container itself in [Container Security Best Practices](/courses/docker/container-security-best-practices).

<code id="code-content" class="language-bash">
# Docker Scout cheat sheet: scanning notes-api for known vulnerabilities (CVEs)
# Scout needs a Docker account, so sign in first
docker login
docker scout version
# ---------- Build the image to scan ----------
# --pull always fetches the newest base image, which fixes many CVEs by itself
docker build --pull -t notes-api:1.0.1 .
# ---------- Look ----------
# Short summary: CVE counts by severity, base image, and whether a newer base exists
docker scout quickview notes-api:1.0.1
# Full list of every vulnerable package and CVE
docker scout cves notes-api:1.0.1
# Focus on what matters: only critical and high
docker scout cves --only-severity critical,high notes-api:1.0.1
# Focus on what you can fix today: only CVEs that have a fixed version
docker scout cves --only-fixed notes-api:1.0.1
# ---------- Fix ----------
# Suggestions for a refreshed or different base image
docker scout recommendations notes-api:1.0.1
# App dependencies: fix them in the project, then rebuild
npm audit
npm audit fix
# ---------- Investigate ----------
# The ingredients list (SBOM) of the image
docker scout sbom --format list notes-api:1.0.1
# Check third-party images before you use them
docker scout quickview postgres:17-alpine
# ---------- Automate ----------
# In CI: a non-zero exit code fails the job when critical or high CVEs are found
docker scout cves --exit-code --only-severity critical,high notes-api:1.0.1
</code></pre>

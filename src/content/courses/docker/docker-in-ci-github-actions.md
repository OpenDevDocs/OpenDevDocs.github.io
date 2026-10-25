---
publishDate: 2026-10-25T18:15
title: 'Building and Pushing Images in GitHub Actions'
slug: docker-in-ci-github-actions
metadescription: 'Build, tag, scan and push Docker images automatically with GitHub Actions, using Docker''s official actions, build caching and multi-platform builds.'
updateDate: 2026-10-25T18:15
author: ['bishal-biswas']
level: 2
tags: ['docker', 'ci-cd', 'github-actions', 'registry']
course: docker
---

## Let a robot build your images

So far you have built and pushed images from your own computer. That works, but it has problems:

- You might forget to push, or push from a folder with uncommitted changes.
- Your laptop might build a slightly different image than your teammate's laptop.
- Nobody can tell which commit an image came from.

**Continuous Integration** (CI) fixes this. A CI service runs a list of steps every time you push code. **GitHub Actions** is the CI service built into GitHub. In this lesson you will write a workflow that, on every push:

1. builds the `notes-api` image,
2. gives it useful tags,
3. pushes it to a registry (only from `main` and version tags),
4. reuses a build cache so it is fast.

If GitHub Actions is new to you, read [Your First Pipeline with GitHub Actions](/courses/devops/first-github-actions-pipeline) first. It explains workflows, jobs and steps.

## The building blocks

Docker publishes official actions for GitHub Actions. An **action** is a ready-made step you can use with one `uses:` line, like a function from a library.

| Action | What it does |
|---|---|
| `actions/checkout@v5` | Downloads your repository's code onto the runner |
| `docker/setup-qemu-action@v3` | Adds emulation so you can build for other CPU types (like ARM) |
| `docker/setup-buildx-action@v3` | Sets up **Buildx**, the BuildKit builder with extra features |
| `docker/login-action@v3` | Signs in to a registry |
| `docker/metadata-action@v5` | Creates tags and labels from the Git branch, tag and commit |
| `docker/build-push-action@v6` | Builds the image and (optionally) pushes it |

A **runner** is the computer that runs your workflow. GitHub gives you a fresh Ubuntu virtual machine with Docker already installed, every time.

## Step 1: the smallest working workflow

Create `.github/workflows/docker.yml` in the `notes-api` repository:

```yaml
name: docker

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .              # the build context, same as "." in docker build
          push: false             # just build for now
          tags: notes-api:test
```

Commit and push. Open the **Actions** tab of your repository on GitHub, and you will see the build run. This already proves that your Dockerfile builds on a clean machine, which catches "it works on my computer" problems.

## Step 2: log in and push to GHCR

**GitHub Container Registry** (GHCR) lives at `ghcr.io`. The nice thing about it in CI: you do not need to create a password. Each workflow run gets a temporary token called `GITHUB_TOKEN`. You only need to give it permission to write packages:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read        # read the code
      packages: write       # push images to ghcr.io
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}          # the user who triggered the run
          password: ${{ secrets.GITHUB_TOKEN }}  # created automatically by GitHub
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/your-name/notes-api:main
```

Replace `your-name` with your GitHub username, in **lowercase**. Image names must be lowercase, even if your username has capital letters.

You learned how registries and logins work in [Pushing Images to Docker Hub and GitHub Container Registry](/courses/docker/pushing-images-to-a-registry).

### Pushing to Docker Hub instead

For Docker Hub, create an **access token** in your Docker Hub account settings. Then store your username and the token as **repository secrets** in GitHub (Settings, Secrets and variables, Actions), for example `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`:

```yaml
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
```

With no `registry:` line, the action logs in to Docker Hub. Your tag then looks like `docker.io/your-name/notes-api:main`.

> **Warning:** Never write a token directly in the workflow file. Anyone who can read the repository could copy it. Always use `secrets.SOMETHING`. GitHub hides secret values in the logs.

## Step 3: good tags automatically

Writing `tags: ...:main` by hand is limiting. You want tags that tell you exactly what is inside, as you learned in [Tagging Images for Releases](/courses/docker/tagging-strategy). The **metadata action** creates them from Git for you:

```yaml
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/your-name/notes-api
          tags: |
            type=ref,event=branch
            type=sha
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
```

Each `type=` line is a rule:

| Rule | When it applies | Example tag |
|---|---|---|
| `type=ref,event=branch` | Push to a branch | `main` |
| `type=sha` | Every run | `sha-4f2a91c` |
| `type=semver,pattern={{version}}` | Push of a Git tag like `v1.4.2` | `1.4.2` |
| `type=semver,pattern={{major}}.{{minor}}` | Same | `1.4` |

Then pass the results to the build step:

```yaml
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

The `labels` add standard information to the image, such as the source repository and the commit. You can see them later with `docker inspect`.

Now, to release version 1.4.2, you just create and push a Git tag:

```bash
git tag v1.4.2
git push origin v1.4.2
```

The workflow runs and pushes the same image under three tags:

```text
  ghcr.io/your-name/notes-api:1.4.2
  ghcr.io/your-name/notes-api:1.4
  ghcr.io/your-name/notes-api:sha-4f2a91c
```

## Step 4: build pull requests, but do not push them

You want every **pull request** (a proposed change) to be built, so a broken Dockerfile is caught before merging. But you do not want every experiment pushed to the registry. Also, pull requests from forks do not get a token with write access.

The trick: run on both events, and only push when it is not a pull request:

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:

# ...later, in the build step:
          push: ${{ github.event_name != 'pull_request' }}
```

Skip the login step for pull requests too:

```yaml
      - uses: docker/login-action@v3
        if: github.event_name != 'pull_request'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
```

## Step 5: make it fast with caching

Every run starts on a fresh machine, so by default there is no layer cache. Every build reinstalls all npm packages. Buildx can save the cache in **GitHub's own cache storage**:

```yaml
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- `cache-from: type=gha` reads layers saved by earlier runs.
- `cache-to: type=gha,mode=max` saves layers for next time. `mode=max` saves layers from **all** stages, including build stages of a multi-stage Dockerfile.

The good layer order from [Layer Caching](/courses/docker/layer-caching) matters even more in CI. If `package.json` did not change, the `npm ci` layer comes from the cache and the build takes seconds.

## Step 6: build for Intel and ARM

Many servers and all Apple Silicon Macs use ARM processors. To build one image that works on both, add QEMU and a `platforms` line:

```yaml
      - uses: docker/setup-qemu-action@v3
      - uses: docker/setup-buildx-action@v3
      # ...
      - uses: docker/build-push-action@v6
        with:
          platforms: linux/amd64,linux/arm64
```

Emulated ARM builds are slower, sometimes much slower. Only add platforms you actually run on. [Multi-Platform Images with Buildx](/courses/docker/multi-platform-builds) explains how this works.

## Step 7 (optional): scan before you push

You can add a scan step so a dangerous image never reaches the registry. A simple way is to build and load the image locally first, scan it, and only then push. Docker publishes `docker/scout-action` for this, and you learned the CLI commands in [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout). Many teams start without this step and add it once the basic pipeline works.

## The complete workflow

All the pieces together are in the code panel. When it runs, the Actions log shows something like:

```text
#12 exporting to image
#12 pushing layers 1.2s done
#12 pushing manifest for ghcr.io/your-name/notes-api:main@sha256:9b1f... done
#12 DONE 3.4s
```

Your image now appears under **Packages** on your GitHub profile.

> **Tip:** New GHCR packages are **private** by default. To let a server pull without logging in, open the package settings on GitHub and change its visibility to public. For private images, log in on the server with a token that has the `read:packages` permission.

## Using the image

Anyone with access can now run the exact image built from a commit:

```bash
docker pull ghcr.io/your-name/notes-api:sha-4f2a91c
docker run -d -p 3000:3000 ghcr.io/your-name/notes-api:sha-4f2a91c
```

That is the starting point for deployments. You will deploy it to a server in [Deploying a Compose App to a Linux Server](/courses/docker/deploying-with-docker-on-a-server).

## Common mistakes

### "denied: installation not allowed to Create organization package"

Usually the `permissions: packages: write` block is missing, or the repository's package settings do not give the workflow write access. Add the permissions block first.

### Uppercase letters in the image name

`ghcr.io/Your-Name/notes-api` fails with "repository name must be lowercase". Write the name in lowercase.

### Building on every push with no cache

Without `cache-from` and `cache-to`, every run downloads and installs everything again. Add the `gha` cache.

### Pushing `latest` from every branch

If every branch pushes `latest`, nobody knows what `latest` is. Let the metadata action choose tags, and deploy using the `sha-` or version tags.

## Quick recap

- GitHub Actions runs your build on a clean machine for every push, so images are **repeatable**.
- Use Docker's official actions: **checkout**, **setup-qemu**, **setup-buildx**, **login**, **metadata** and **build-push**.
- For GHCR, `GITHUB_TOKEN` plus `packages: write` is enough. For Docker Hub, use an access token stored as a **secret**.
- The **metadata action** creates branch, `sha-` and version tags from Git.
- Build pull requests but **do not push** them.
- `cache-from: type=gha` and `cache-to: type=gha,mode=max` make builds fast.

For more about pipelines in general, see [Continuous Integration](/courses/devops/continuous-integration). Next, you will learn what to do when a container refuses to start in [Debugging Containers That Will Not Start](/courses/docker/debugging-containers).

<code id="code-content" class="language-yaml">
# .github/workflows/docker.yml
# Builds the notes-api image on every push and pull request.
# Pushes to GitHub Container Registry only from main and from version tags (v1.2.3).
name: docker
on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
jobs:
  image:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      # Needed to push to ghcr.io with the automatic GITHUB_TOKEN
      packages: write
    steps:
      - uses: actions/checkout@v5
      # Emulation for building ARM images on an Intel runner
      - uses: docker/setup-qemu-action@v3
      # BuildKit builder with cache export and multi-platform support
      - uses: docker/setup-buildx-action@v3
      # Sign in, but not for pull requests (they never push)
      - uses: docker/login-action@v3
        if: github.event_name != 'pull_request'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      # Work out tags and labels from the branch, Git tag and commit
      - id: meta
        uses: docker/metadata-action@v5
        with:
          # Image names must be lowercase
          images: ghcr.io/your-name/notes-api
          tags: |
            type=ref,event=branch
            type=sha
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
      # Build (and push when allowed), reusing layers from earlier runs
      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
</code></pre>

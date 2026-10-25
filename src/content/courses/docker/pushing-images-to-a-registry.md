---
publishDate: 2026-10-25T17:40
title: 'Pushing Images to Docker Hub and GitHub Container Registry'
slug: pushing-images-to-a-registry
metadescription: 'Learn how to log in, tag and push your own images to Docker Hub and GitHub Container Registry, and how to pull them on another machine safely.'
updateDate: 2026-10-25T17:40
author: ['bishal-biswas']
level: 1
tags: ['docker', 'registry', 'docker-hub', 'ghcr']
course: docker
---

## Sharing your image

You built the notes-api image on your laptop. It works. Now a teammate wants it, your CI pipeline wants to test it, and your server needs to run it. How does the image get there?

You could send the image as a file with `docker save`, as you saw in [docker commit, save and load (and Why Dockerfiles Win)](/courses/docker/docker-commit-save-and-load). But that is slow and messy. The normal way is a **registry**: a server that stores images, like a library stores books. You **push** (upload) an image to the registry once, and any machine can **pull** (download) it.

In this lesson you will push notes-api to the two most common registries:

- **Docker Hub** (`docker.io`), Docker's own public registry
- **GitHub Container Registry**, called **GHCR** (`ghcr.io`), part of GitHub

You will learn how to log in safely, how to name images for a registry, and how to push and pull.

## How image names point to a registry

You learned the parts of an image name in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests). Here is a quick reminder:

```text
ghcr.io / your-name / notes-api : 1.0.0
   |          |          |          |
registry  namespace  repository    tag
```

The name tells Docker **where** to push. There is no separate "push to this server" setting. If the name starts with `ghcr.io/`, the image goes to GHCR. If there is no registry part, Docker uses Docker Hub.

| Name | Where it goes |
|---|---|
| `notes-api:1.0.0` | Nowhere. It is a local name only. A push would try Docker Hub's `library` namespace and fail |
| `your-name/notes-api:1.0.0` | Docker Hub, account `your-name` |
| `docker.io/your-name/notes-api:1.0.0` | Docker Hub, the same as above but written in full |
| `ghcr.io/your-name/notes-api:1.0.0` | GitHub Container Registry, user or organization `your-name` |

> **Note:** Image names must be **lowercase**. If your GitHub username is `BishalDev`, the image name is `ghcr.io/bishaldev/notes-api`.

## Pushing to Docker Hub

### Step 1: create an access token

You need a free account on hub.docker.com. Do not log in from the terminal with your account password. Instead, create a **personal access token**: a long random string that works like a password, but only for the tool you give it to, with only the permissions you choose. You can delete it at any time without changing your real password.

In Docker Hub, open your account settings, find **Personal access tokens**, and create one with **Read & Write** access. Copy it now, because it is shown only once.

### Step 2: log in

```bash
docker login -u your-name
```

```text
Password:
Login Succeeded
```

Paste the token when it asks for a password. In scripts, pipe the token in instead of typing it, so it does not end up in your shell history:

```bash
echo "$DOCKERHUB_TOKEN" | docker login -u your-name --password-stdin
```

> **Tip:** Docker Desktop stores your login in the operating system's secure credential store (Windows Credential Manager or macOS Keychain). On a Linux server without a credential helper, Docker saves it in `~/.docker/config.json`, only lightly encoded. Protect that file and log out with `docker logout` when you no longer need access.

### Step 3: tag the image with the registry name

Your local image is called `notes-api:1.0.0`. Give it a second name that includes your Docker Hub account. `docker tag` does not copy anything. It just adds another name to the same image:

```bash
docker tag notes-api:1.0.0 your-name/notes-api:1.0.0
docker images notes-api
docker images your-name/notes-api
```

```text
REPOSITORY            TAG     IMAGE ID       CREATED         SIZE
notes-api             1.0.0   3f9a1c2b7d4e   5 minutes ago   168MB
REPOSITORY            TAG     IMAGE ID       CREATED         SIZE
your-name/notes-api   1.0.0   3f9a1c2b7d4e   5 minutes ago   168MB
```

Same IMAGE ID, two names. You can also build with the full name from the start: `docker build -t your-name/notes-api:1.0.0 .`

### Step 4: push

```bash
docker push your-name/notes-api:1.0.0
```

```text
The push refers to repository [docker.io/your-name/notes-api]
5f70bf18a086: Pushed
a2c3d4e5f6a7: Pushed
8e1f2a3b4c5d: Mounted from library/node
1.0.0: digest: sha256:7c1e9a...e42b size: 1789
```

Look at the lines. Docker pushes **layers**, not one big file. Layers that Docker Hub already has, such as the `node:24-alpine` base layers, are not uploaded again ("Mounted from library/node"). This is why pushes after the first one are fast. You learned about layers in [Images and Layers Explained](/courses/docker/images-and-layers).

The last line shows the image **digest**. Save it if you want to refer to this exact image forever.

On Docker Hub, a new repository is **public** by default on a free account, so anyone can pull it. You can make it private in the repository settings.

## Pushing to GitHub Container Registry

GHCR is a good choice when your code already lives on GitHub. The steps are the same, only the login and the name change.

### Step 1: create a token

In GitHub, go to **Settings**, then **Developer settings**, then **Personal access tokens**. Create a **classic** token with the `write:packages` scope (it includes `read:packages`). Give it an expiry date.

> **Note:** Inside GitHub Actions you do not need a personal token. The automatic `GITHUB_TOKEN` can push to GHCR when the workflow has `packages: write` permission. You will do that in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

### Step 2: log in to ghcr.io

Notice the registry name after `login`. Without it, Docker would log in to Docker Hub:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u your-name --password-stdin
```

```text
Login Succeeded
```

### Step 3 and 4: tag and push

```bash
docker tag notes-api:1.0.0 ghcr.io/your-name/notes-api:1.0.0
docker push ghcr.io/your-name/notes-api:1.0.0
```

A new package on GHCR is **private** by default. To share it publicly, open the package page on GitHub (your profile, then **Packages**) and change its visibility in the package settings.

### Linking the image to your repository

GHCR can show the image on your repository page and reuse the repository's permissions. Add this **label** to your Dockerfile. A label is a key and value stored in the image's metadata:

```docker
LABEL org.opencontainers.image.source="https://github.com/your-name/notes-api"
```

Build and push again, and GitHub connects the package to that repository.

## Pulling on another machine

On your server, or a teammate's laptop, the image name is all you need:

```bash
docker pull ghcr.io/your-name/notes-api:1.0.0
docker run -d -p 3000:3000 ghcr.io/your-name/notes-api:1.0.0
```

For a private image, run `docker login ghcr.io` on that machine first, with a token that has only `read:packages`. Give servers read-only tokens. They never need to push.

In Compose, just use the full name in `image`:

```yaml
services:
  api:
    image: ghcr.io/your-name/notes-api:1.0.0
    ports:
      - "3000:3000"
```

`docker compose pull` downloads every image in the file, and `docker compose up -d` then uses them. You saw how a production file can use a pushed image in [Compose Profiles, Override Files and Multiple Environments](/courses/docker/compose-profiles-and-overrides).

## Docker Hub or GHCR?

| | Docker Hub | GHCR |
|---|---|---|
| Name prefix | `docker.io/` (or none) | `ghcr.io/` |
| Default visibility | Public | Private |
| Login | Docker account + access token | GitHub account + token, or `GITHUB_TOKEN` in Actions |
| Best for | Public images many people will pull | Images for projects hosted on GitHub |
| Pull limits | Anonymous and free accounts have rate limits | Tied to your GitHub plan |

Both are fine. Many teams push to GHCR for their own apps and pull base images from Docker Hub. Other registries work the same way, such as the ones from AWS, Azure and Google Cloud. Only the login step is different.

## Common mistakes

### "denied: requested access to the resource is denied"

You pushed a name without your account in it, such as `notes-api:1.0.0`, or you are logged in to a different registry. Check the name with `docker images` and log in to the right registry.

### Logging in to the wrong registry

`docker login` without a server name logs in to Docker Hub. For GHCR, you must write `docker login ghcr.io`.

### Uppercase letters in the name

`ghcr.io/BishalDev/notes-api` is rejected with an "invalid reference format" error. Use only lowercase.

### Using your real password

Use access tokens, give each one only the scope it needs, and set an expiry. A leaked token can be deleted. A leaked password is a much bigger problem.

### Pushing only latest

If you push only `:latest`, nobody can tell which version is running, and rolling back is hard. Push a version tag. The next lesson explains how.

## Quick recap

- A **registry** stores images. You **push** to it and **pull** from it.
- The image name decides the registry: `ghcr.io/...` for GHCR, no prefix or `docker.io/...` for Docker Hub.
- Log in with **access tokens**, using `--password-stdin` in scripts. Use `docker login ghcr.io` for GHCR.
- `docker tag` adds a registry name to a local image. `docker push` uploads only the layers the registry does not have.
- Docker Hub repositories start public; GHCR packages start private.
- Servers should use read-only tokens to pull.

Next, you will decide which tags to give each release in [Tagging Images for Releases](/courses/docker/tagging-strategy).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Push notes-api to Docker Hub and GitHub Container Registry
# Tokens come from environment variables, never typed into the script
set -euo pipefail
VERSION="1.0.0"
# --- Build once with a local name ---
docker build -t notes-api:"$VERSION" .
# --- Docker Hub: docker.io/your-name/notes-api ---
echo "$DOCKERHUB_TOKEN" | docker login -u your-name --password-stdin
docker tag notes-api:"$VERSION" your-name/notes-api:"$VERSION"
docker push your-name/notes-api:"$VERSION"
# --- GitHub Container Registry: ghcr.io/your-name/notes-api ---
# Note the server name after "login"
echo "$GHCR_TOKEN" | docker login ghcr.io -u your-name --password-stdin
docker tag notes-api:"$VERSION" ghcr.io/your-name/notes-api:"$VERSION"
docker push ghcr.io/your-name/notes-api:"$VERSION"
# --- On another machine: pull and run ---
# docker login ghcr.io -u your-name        (only for private images, read-only token)
# docker pull ghcr.io/your-name/notes-api:1.0.0
# docker run -d -p 3000:3000 ghcr.io/your-name/notes-api:1.0.0
# --- Clean up stored logins when you are done ---
docker logout
docker logout ghcr.io
</code></pre>

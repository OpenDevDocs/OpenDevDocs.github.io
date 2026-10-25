---
publishDate: 2026-10-25T15:15
title: 'Image Names, Tags and Digests'
slug: image-names-tags-and-digests
metadescription: 'Learn how Docker image names work: registry, namespace, repository and tag, why latest is risky, how to add tags, and how digests pin an exact image version.'
updateDate: 2026-10-25T15:15
author: ['bishal-biswas']
level: 1
tags: ['docker', 'images', 'tags', 'versioning']
course: docker
---

## What is in a name?

You have typed names like `nginx:1.29-alpine` and `postgres:17-alpine` many times. These short names hide a lot of information. A full image name says **where** an image lives, **who** owns it, **what** it is and **which version** it is.

In this lesson you will learn:

- the four parts of an image name, and the defaults Docker fills in
- what a **tag** is, and why tags can change
- why `:latest` causes trouble
- how to give an image more names with `docker tag`
- what a **digest** is, and how it pins one exact image forever

## The four parts of an image name

Here is a full image name:

```text
ghcr.io / your-name / notes-api : 1.2.0
   |          |           |         |
registry  namespace   repository   tag
```

| Part | What it means | Example |
|---|---|---|
| **Registry** | The server that stores the image | `docker.io` (Docker Hub), `ghcr.io` (GitHub) |
| **Namespace** | The user or organization that owns it | `your-name`, `library` |
| **Repository** | The name of the app or tool | `notes-api`, `nginx` |
| **Tag** | A label for one version | `1.2.0`, `24-alpine` |

A **registry** is like an app store for images. You learned about them in [How Docker Works: Engine, Client, Images and Registries](/courses/docker/docker-architecture).

### Defaults Docker fills in

Most of the time you leave parts out, and Docker fills them in:

- No registry? Docker uses **Docker Hub**, `docker.io`.
- No namespace on Docker Hub? Docker uses **`library`**, which is where **official images** live.
- No tag? Docker uses **`latest`**.

So these pairs mean exactly the same:

| You type | Docker reads |
|---|---|
| `nginx` | `docker.io/library/nginx:latest` |
| `nginx:1.29-alpine` | `docker.io/library/nginx:1.29-alpine` |
| `your-name/notes-api:1.2.0` | `docker.io/your-name/notes-api:1.2.0` |
| `ghcr.io/your-name/notes-api:1.2.0` | (already complete) |

You will learn more about official images in [Docker Hub and Official Images](/courses/docker/docker-hub-and-official-images).

### Naming rules

- Names must be **lowercase**. `Notes-API` is not allowed; use `notes-api`.
- Repository names can use letters, numbers, `.`, `_` and `-`, and `/` to separate parts.
- Tags can use letters (upper or lower case), numbers, `.`, `_` and `-`, up to 128 characters.

## Tags: labels for versions

A **tag** is a human friendly label that points to one image. One repository usually has many tags. The official `node` repository, for example, has tags like these:

```text
node:24              Node 24, full Debian based image
node:24-slim         Node 24, smaller Debian based image
node:24-alpine       Node 24, on tiny Alpine Linux
node:24.11.0-alpine  one exact Node version, on Alpine
```

Many tags can point to the **same** image. On the day Node 24.11.0 comes out, `node:24-alpine`, `node:24.11-alpine` and `node:24.11.0-alpine` may all point to the same image. Later, when 24.12.0 is released, `node:24-alpine` and the other broad tags move to the new image, while `node:24.11.0-alpine` stays where it was.

> **Note:** The exact version numbers above are examples. Check the image's Docker Hub page for the tags that exist today.

### Tags can move

This is the most important thing to understand about tags: **a tag is a pointer, not a promise**. The owner can push a new image with the same tag at any time, and the tag then points to the new image.

Think of a tag like a sticky note with "current version" written on it. Someone can take it off one box and put it on another box.

How specific a tag is tells you how often it moves:

| Tag | How often it moves |
|---|---|
| `latest` | Every release, including big breaking ones |
| `24-alpine` | Every Node 24 release and every base image update |
| `24.11-alpine` | Patch releases and security updates |
| `24.11.0-alpine` | Rarely (sometimes rebuilt for security fixes in the base) |

## Why :latest is risky

`latest` is just a normal tag. It does **not** mean "the newest version" in any clever way. It is simply the default name when no tag is given, and image owners usually point it at their newest release.

Problems with using it:

- **Surprise upgrades.** Today `postgres:latest` may be version 17. One day it becomes 18, and your next `docker pull` gives you a new major version that cannot read your old data files without an upgrade.
- **Different machines, different versions.** Your laptop pulled `latest` last month. The server pulled it today. They are now running different software with the same name.
- **No easy rollback.** If the new `latest` breaks, which version were you on before? The name does not tell you.

The rule: **always use a specific tag** for anything that matters. Use `postgres:17-alpine`, not `postgres`. You will build a full tagging plan for your own releases in [Tagging Images for Releases](/courses/docker/tagging-strategy). The DevOps course also explains this in [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning).

## Listing and adding tags

`docker images` (or `docker image ls`) lists your local images with their tags:

```bash
docker images
```

```text
REPOSITORY   TAG         IMAGE ID       CREATED       SIZE
nginx        1.29-alpine 7c3f1a2b9d8e  2 weeks ago   52.4MB
node         24-alpine   1e9c2a4b7d3f   3 weeks ago   163MB
postgres     17-alpine   5a8b3c1d9e2f   3 weeks ago   278MB
```

The **IMAGE ID** is a short form of the image's own hash. Two rows with the same IMAGE ID are the same image with different names.

### docker tag: give an image another name

`docker tag` adds a new name to an existing image. It does not copy anything. It just adds another sticky note to the same box:

```bash
docker tag nginx:1.29-alpine my-nginx:dev
docker tag nginx:1.29-alpine ghcr.io/your-name/nginx:1.29-alpine
docker images --filter reference='*nginx*'
```

```text
REPOSITORY                TAG          IMAGE ID       CREATED       SIZE
ghcr.io/your-name/nginx   1.29-alpine  7c3f1a2b9d8e   2 weeks ago   52.4MB
my-nginx                  dev          7c3f1a2b9d8e   2 weeks ago   52.4MB
nginx                     1.29-alpine  7c3f1a2b9d8e   2 weeks ago   52.4MB
```

Same IMAGE ID, three names. Removing one name with `docker rmi my-nginx:dev` only removes that tag ("Untagged"). The image stays until its last name is removed.

You need `docker tag` before pushing to a registry, because the name decides **where** the image goes. You will do this in [Pushing Images to Docker Hub and GitHub Container Registry](/courses/docker/pushing-images-to-a-registry).

When you build your own image, you name it with `-t`, and you can give several names at once:

```bash
docker build -t notes-api:1.2.0 -t notes-api:1.2 .
```

## Digests: the name that never changes

Tags can move. Sometimes you need a name that is **guaranteed** to always mean the exact same image. That is a **digest**.

A **digest** is a hash of the image's contents, written as `sha256:` followed by 64 hexadecimal characters. You saw in [Images and Layers Explained](/courses/docker/images-and-layers) that a hash is like a fingerprint: change one byte and you get a different hash. So a digest cannot be moved to another image. If the content changes, the digest changes.

### Seeing digests

When you pull, Docker prints the digest:

```bash
docker pull nginx:1.29-alpine
```

```text
1.29-alpine: Pulling from library/nginx
Digest: sha256:4a1c...e9b2
Status: Image is up to date for nginx:1.29-alpine
docker.io/library/nginx:1.29-alpine
```

(The digest is shortened here. The real one is 64 characters long.) You can also list digests of your local images:

```bash
docker images --digests nginx
```

```text
REPOSITORY   TAG           DIGEST              IMAGE ID       CREATED       SIZE
nginx        1.29-alpine   sha256:4a1c...e9b2  7c3f1a2b9d8e   2 weeks ago   52.4MB
```

### Using a digest

Put `@` and the digest after the repository name:

```bash
docker pull nginx@sha256:<the-64-character-digest>
docker run -d -p 8080:80 nginx@sha256:<the-64-character-digest>
```

You can even keep the tag for humans to read. Docker then uses the digest and ignores the tag:

```text
nginx:1.29-alpine@sha256:<the-64-character-digest>
```

This form is common in production config files: people can see "this is nginx 1.29", and the digest makes sure it is exactly the image that was tested.

### Tags vs digests

| | Tag | Digest |
|---|---|---|
| Looks like | `nginx:1.29-alpine` | `nginx@sha256:4a1c...e9b2` |
| Easy to read | Yes | No |
| Can change over time | Yes | Never |
| Gets security updates automatically when you pull | Yes | No, you must update the digest |
| Good for | Daily work, development | Production, audits, reproducible builds |

> **Tip:** Pinning digests means you will not get security fixes until you update them. Tools such as Dependabot or Renovate can open pull requests that update digests for you. Scanning images, covered in [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout), tells you when it is time.

### One tag, many platforms

Many official images support several CPU types, such as Intel and AMD (`amd64`) and ARM (`arm64`, used by Apple Silicon Macs and many cloud servers). The tag `nginx:1.29-alpine` actually points to an **index**, a small list of images, one per platform. Docker picks the right one for your computer.

That means the digest you see for a tag is usually the digest of the index, which covers all platforms. You can look inside with:

```bash
docker buildx imagetools inspect nginx:1.29-alpine
```

```text
Name:      docker.io/library/nginx:1.29-alpine
MediaType: application/vnd.oci.image.index.v1+json
Digest:    sha256:4a1c...e9b2

Manifests:
  Name:      docker.io/library/nginx:1.29-alpine@sha256:...
  Platform:  linux/amd64
  ...
  Name:      docker.io/library/nginx:1.29-alpine@sha256:...
  Platform:  linux/arm64
  ...
```

You will build images like this yourself in [Multi-Platform Images with Buildx](/courses/docker/multi-platform-builds).

## Common mistakes

### Leaving out the tag

`docker run postgres` silently means `postgres:latest`. Always write the tag.

### Capital letters in the name

`docker build -t Notes-API .` fails with "repository name must be lowercase". Use lowercase for the repository part.

### Thinking a tag is fixed

`node:24-alpine` today and `node:24-alpine` in three months are probably different images. If you need the exact same image, use a specific version tag or a digest.

### Thinking docker tag copies the image

It only adds a name. No extra disk space is used.

## Quick recap

- A full image name is `registry/namespace/repository:tag`. Defaults: `docker.io`, `library`, `latest`.
- Names are lowercase. Tags are labels for versions.
- A tag is a **pointer**. It can move to a new image at any time.
- Avoid `:latest`. Use specific tags like `postgres:17-alpine`.
- `docker tag` adds another name to an image without copying it.
- A **digest** (`@sha256:...`) is a content hash. It always means exactly one image.
- One tag can point to an index of images for several platforms.

Next, you will explore where most images come from in [Docker Hub and Official Images](/courses/docker/docker-hub-and-official-images).

<code id="code-content" class="language-bash">
# Image names, tags and digests: cheat sheet
# Full name:  registry/namespace/repository:tag   e.g. ghcr.io/your-name/notes-api:1.2.0
# Defaults:   nginx  =  docker.io/library/nginx:latest
#
# ---------- Always use a specific tag ----------
docker pull postgres:17-alpine          # good: you know what you get
docker pull nginx:1.29-alpine
#
# ---------- List images, tags and IDs ----------
docker images
docker images --digests nginx
docker images --filter reference='*nginx*'
#
# ---------- Add names (no copy: same IMAGE ID) ----------
docker tag nginx:1.29-alpine my-nginx:dev
docker tag nginx:1.29-alpine ghcr.io/your-name/nginx:1.29-alpine
docker rmi my-nginx:dev                 # removes only that name ("Untagged")
#
# Name your own builds, several tags at once (names must be lowercase)
docker build -t notes-api:1.2.0 -t notes-api:1.2 .
#
# ---------- Digests: an exact image that never changes ----------
docker inspect --format '{{json .RepoDigests}}' nginx:1.29-alpine
docker pull nginx@sha256:&lt;the-64-character-digest&gt;
docker run -d -p 8080:80 nginx:1.29-alpine@sha256:&lt;the-64-character-digest&gt;
#
# ---------- One tag, many platforms (an image index) ----------
docker buildx imagetools inspect nginx:1.29-alpine
</code></pre>

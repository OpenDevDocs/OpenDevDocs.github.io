---
publishDate: 2026-10-25T15:20
title: 'Docker Hub and Official Images'
slug: docker-hub-and-official-images
metadescription: 'Learn what Docker Hub is, how to find and judge images, what official and verified images are, and how pull limits and docker login work.'
updateDate: 2026-10-25T15:20
author: ['bishal-biswas']
level: 1
tags: ['docker', 'docker-hub', 'images', 'registry']
course: docker
---

## Where do images come from?

Every time you ran `docker run nginx:1.29-alpine` so far, Docker downloaded the image from somewhere. That somewhere is **Docker Hub**, the default **registry** that Docker uses. A registry is a server that stores images, a bit like an app store, but for container images.

In this lesson you will learn how to:

- find images on Docker Hub, on the website and from the terminal
- tell the difference between **official**, **verified** and community images
- read an image page so you pick the right tag
- log in, and understand **pull rate limits**
- decide if an image is safe enough to use

You already know how image names work from [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests). Docker Hub is the place where most of those names live.

## What Docker Hub is

Docker Hub (hub.docker.com) is a public registry run by Docker, the company. It holds millions of images. Some are made by Docker and well-known software projects. Most are uploaded by ordinary users and companies.

When you write an image name without a registry, Docker uses Docker Hub:

```text
nginx:1.29-alpine            is short for   docker.io/library/nginx:1.29-alpine
your-name/notes-api:1.0.0    is short for   docker.io/your-name/notes-api:1.0.0
```

The special namespace `library` is where **official images** live. That is why official images have short names such as `nginx`, `node` or `postgres`, with no user name in front.

> **Note:** Docker Hub is not the only registry. GitHub Container Registry (`ghcr.io`), Quay (`quay.io`), Microsoft (`mcr.microsoft.com`) and the big cloud providers all run registries too. You will push your own images to Docker Hub and GHCR in [Pushing Images to Docker Hub and GitHub Container Registry](/courses/docker/pushing-images-to-a-registry).

## Three kinds of trusted images

Docker Hub marks some images with a badge. The badge tells you who made the image and how much you can trust it.

| Badge | Who makes it | Example names |
|---|---|---|
| **Docker Official Image** | A Docker team works with the software's maintainers. Images follow strict rules and get regular security updates. | `nginx`, `node`, `python`, `postgres`, `redis`, `ubuntu`, `alpine` |
| **Verified Publisher** | A company that Docker has checked. The image comes straight from the vendor. | images under company namespaces such as a database or monitoring vendor |
| **Sponsored OSS** | An open source project that Docker supports. | images from well-known open source projects |
| (no badge) | Anyone with a Docker Hub account. | `some-user/some-tool` |

For a beginner, a simple rule works well: **start with Docker Official Images**. For the notes-api app in this course, everything you need is official: `node`, `postgres`, `redis` and `nginx`.

Images with no badge are not automatically bad. Many are fine. But nobody has checked them, so you need to check them yourself (see the checklist later in this lesson).

## Searching for images

### On the website

Open hub.docker.com and type a name in the search box. You can filter the results by the badges above. Click an image to open its page.

### From the terminal

`docker search` asks Docker Hub from your terminal:

```bash
docker search postgres --limit 5
```

```text
NAME                    DESCRIPTION                                     STARS     OFFICIAL
postgres                The PostgreSQL object-relational database sy…   14000     [OK]
bitnami/postgresql      Bitnami container image for PostgreSQL          300
...
```

The `OFFICIAL` column shows `[OK]` for Docker Official Images. You can show only those with a filter:

```bash
docker search --filter is-official=true redis
```

> **Tip:** `docker search` is handy for a quick check, but it does not show tags. To choose a tag you still need the image page on the website.

## Reading an image page

An official image page has a few parts worth knowing. Open the `node` page as an example.

1. **Supported tags.** A list near the top, such as `24-alpine`, `24-slim`, `24` and exact versions like `24.11.0-alpine`. Each line groups tags that point to the same image.
2. **How to use this image.** Short examples: which port it uses, where data lives, which environment variables it reads.
3. **Image variants.** An explanation of the full, `-slim` and `-alpine` versions. You will compare these in [Choosing a Base Image: Full, Slim, Alpine and Distroless](/courses/docker/choosing-a-base-image).
4. **Tags tab.** Every tag, with its size, the date it was pushed and the **platforms** it supports (for example `linux/amd64` and `linux/arm64`).

The "How to use" part is the most useful for you as a beginner. For example, the `postgres` page tells you that the image needs `POSTGRES_PASSWORD`, which you met in [Configuring Containers with Environment Variables](/courses/docker/environment-variables):

```bash
docker run -d --name db \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  postgres:17-alpine
```

### Picking a tag

Tags on official images usually come in levels:

```text
node:24.11.0-alpine   exact version, never changes its meaning
node:24.11-alpine     newest 24.11.x patch
node:24-alpine        newest 24.x release
node:alpine           newest of everything (moves to a new major version one day)
```

The more exact the tag, the fewer surprises. A good middle ground for learning and many projects is the major version, like `node:24-alpine`. For production you can go further and pin the **digest**, as you learned in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests).

> **Warning:** Avoid `:latest` (or no tag at all) in anything you plan to keep. "latest" just means "whatever was pushed last". One day it can jump to a new major version and break your app without you changing a single line.

## Pulling images

`docker pull` downloads an image without starting a container:

```bash
docker pull node:24-alpine
```

```text
24-alpine: Pulling from library/node
2d35ebdb57d9: Pull complete
...
Digest: sha256:4c1e...
Status: Downloaded newer image for node:24-alpine
docker.io/library/node:24-alpine
```

Notice the last line. Docker prints the full name, with `docker.io/library/`, which proves the image came from the official namespace on Docker Hub.

`docker run` pulls automatically when the image is missing, so you rarely need `docker pull`. It is useful when you want to download images ahead of time, for example before going offline, or to get the newest image behind a tag you already have.

## Logging in and pull rate limits

Docker Hub limits how many images you can pull in a given time. This is called a **pull rate limit**. The limit is low for **anonymous** users (people who are not logged in) and higher for logged-in users. Paid plans have higher limits again. The exact numbers change from time to time, so check the Docker Hub documentation for the current values.

On your own laptop you will rarely hit the limit. It matters more on shared machines, such as a CI server where many builds pull images from the same IP address.

To log in:

```bash
docker login
```

Docker shows a code and a web address. You open the address, sign in to your Docker account and confirm the code. After that, `docker pull` uses your account.

In scripts and CI you cannot click a web page, so you use a **personal access token** (a long password made for one purpose, which you create in your Docker Hub account settings):

```bash
# DOCKERHUB_TOKEN holds the token; --password-stdin keeps it out of your shell history
echo "$DOCKERHUB_TOKEN" | docker login -u your-name --password-stdin
```

To log out:

```bash
docker logout
```

> **Warning:** Never paste a real token directly into a command or commit it to Git. Keep it in a secret store, such as GitHub Actions secrets. You will use one in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

## Is this image safe to use?

When an image has no badge, go through this short checklist before you use it:

- **Who made it?** Is there a link to a source code repository, such as GitHub? Can you see the Dockerfile?
- **Is it maintained?** Look at the "last pushed" date on the Tags tab. An image not updated for years has old software with known security holes.
- **Is it popular?** Pull counts and stars are not proof, but an image used by thousands of people is more likely to be checked.
- **Does it do something you could do yourself?** Often a small Dockerfile on top of an official image is safer than a random image that does "everything".

You can also scan any image for known security problems. You will learn how in [Scanning Images for Vulnerabilities with Docker Scout](/courses/docker/image-scanning-with-docker-scout):

```bash
docker scout quickview node:24-alpine
```

> **Note:** Official images are rebuilt often when security fixes come out. That is a big reason to prefer them: if you pull `node:24-alpine` again next month, you get the fixes for free.

## Common mistakes

### Using a look-alike name

`nginx` is official. `ngnix/nginx` or `nginx-official/nginx` are not. Attackers sometimes upload images with names that look similar to famous ones. Check for the badge, or check that the name has no user name in front.

### Forgetting that tags move

You pulled `node:24-alpine` six months ago and it still works on your machine. On a new machine, the same tag downloads a newer image. Usually that is good (security fixes), but it means two machines can run slightly different images. Pin a digest when you need both to be exactly the same.

### Hitting rate limits in CI

Many builds in CI pull from Docker Hub as anonymous users and suddenly fail with a "too many requests" error. The fix is to log in with an access token at the start of the job.

## Quick recap

- **Docker Hub** is Docker's default registry. Names without a registry go to `docker.io`.
- **Official images** live in the `library` namespace and have short names like `node` or `postgres`.
- Badges show trust: **Docker Official Image**, **Verified Publisher**, **Sponsored OSS**. Start with official images.
- Use the image page to read the supported tags and the "How to use" examples.
- Pick specific tags, avoid `:latest`, and pin digests when you need exact repeats.
- Anonymous pulls have lower **rate limits**. Use `docker login`, with an access token in scripts.

Next, you will compare the different flavors of an image in [Choosing a Base Image: Full, Slim, Alpine and Distroless](/courses/docker/choosing-a-base-image).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Docker Hub cheat sheet: finding, judging and pulling images
#
# --- Search Docker Hub from the terminal ---
docker search postgres --limit 5
# Only Docker Official Images
docker search --filter is-official=true redis
#
# --- Short names expand to Docker Hub ---
# nginx:1.29-alpine  is the same as  docker.io/library/nginx:1.29-alpine
docker pull nginx:1.29-alpine
docker pull docker.io/library/nginx:1.29-alpine
#
# --- Choose a specific tag, never :latest ---
docker pull node:24-alpine
docker pull postgres:17-alpine
docker pull redis:8-alpine
#
# --- See the digest of what you pulled (to pin it later) ---
docker image inspect --format '{{index .RepoDigests 0}}' node:24-alpine
#
# --- Use an official image the way its page describes ---
docker run -d --name db \
  -e POSTGRES_USER=notes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=notes \
  postgres:17-alpine
#
# --- Log in to raise pull rate limits ---
# Interactive: follow the code and web address Docker prints
docker login
# Scripts and CI: use a personal access token from your Docker Hub settings
echo "$DOCKERHUB_TOKEN" | docker login -u your-name --password-stdin
docker logout
#
# --- Check an image before you trust it ---
docker scout quickview node:24-alpine
</code></pre>

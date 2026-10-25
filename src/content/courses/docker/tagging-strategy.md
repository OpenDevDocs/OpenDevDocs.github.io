---
publishDate: 2026-10-25T17:45
title: 'Tagging Images for Releases'
slug: tagging-strategy
metadescription: 'Learn a clear tagging strategy for Docker images: version tags, moving tags, Git commit tags and digests, so you always know what runs and can roll back.'
updateDate: 2026-10-25T17:45
author: ['bishal-biswas']
level: 2
tags: ['docker', 'tags', 'versioning', 'releases']
course: docker
---

## Which image is running?

A bug report arrives: "notes-api is returning the wrong notes in production". Your first question is: which version is running? If the server runs `notes-api:latest`, you cannot tell. `latest` might be from yesterday or from three weeks ago. And if you want to go back to the version that worked, which tag is that?

A good **tagging strategy** answers these questions. It is a set of rules for which tags you give each image you push. In this lesson you will learn:

- the difference between **fixed** tags and **moving** tags
- how to use **semantic versioning** tags such as `1.4.2`, `1.4` and `1`
- why tagging with the Git commit is useful
- when to use a **digest** instead of a tag
- how to add several tags to one build, and store version info in **labels**

## A tag is just a pointer

You learned in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests) that a tag is a human-friendly name for an image. The important detail is that a tag is a **pointer**, like a sticky note. It can be moved to a different image at any time by pushing again with the same tag.

A **digest** (`sha256:...`) is different. It is calculated from the image's content, so it always points to exactly the same image and can never be moved.

```text
notes-api:1.4      --points to-->  sha256:7c1e...   (today)
notes-api:1.4      --points to-->  sha256:b2f9...   (after 1.4.3 is released)
notes-api@sha256:7c1e...   always the same image, forever
```

So there are two kinds of tags:

| Kind | Example | Moves? | Use it to... |
|---|---|---|---|
| **Fixed** (immutable by habit) | `1.4.2`, `sha-3f9a1c2` | Never, if you follow the rules | Deploy, roll back, debug |
| **Moving** | `latest`, `1.4`, `1`, `main` | Yes, on every matching release | Let people follow updates |

> **Warning:** Most registries do not stop you from pushing a new image with an old tag such as `1.4.2`. A fixed tag stays fixed only because your team agrees never to reuse it. Some registries offer a setting to block overwriting tags. Use it if you can.

## Semantic versioning tags

**Semantic versioning** (often called **semver**) is a version number with three parts: `MAJOR.MINOR.PATCH`, for example `1.4.2`.

- **PATCH** goes up for bug fixes (`1.4.2` to `1.4.3`)
- **MINOR** goes up for new features that do not break anything (`1.4.3` to `1.5.0`)
- **MAJOR** goes up for breaking changes (`1.5.0` to `2.0.0`)

The Node.js course explains semver for packages in [Semver and Lockfiles](/courses/nodejs/semver-and-lockfiles). For images, the common pattern is to push **several tags** for each release:

```text
Release 1.4.2 gets these tags:
  1.4.2    fixed: exactly this release
  1.4      moving: the newest 1.4.x
  1        moving: the newest 1.x.x
  latest   moving: the newest release of all
```

Official images on Docker Hub use exactly this pattern. That is why you can write `node:24-alpine` (the newest Node 24) or a full version like `node:24.11.0-alpine`. Users pick how much change they accept:

| A user who pulls... | gets... |
|---|---|
| `notes-api:1.4.2` | never any change |
| `notes-api:1.4` | bug fixes only |
| `notes-api:1` | bug fixes and new features, no breaking changes |
| `notes-api:latest` | everything, including breaking changes |

## Git commit tags

Version numbers are made for releases. But your CI pipeline builds an image on **every** commit, and most of those commits are not releases. For those, tag the image with the **Git commit hash**: the unique ID of the commit, usually shortened to 7 characters.

```bash
GIT_SHA=$(git rev-parse --short HEAD)       # for example 3f9a1c2
docker build -t ghcr.io/your-name/notes-api:sha-$GIT_SHA .
```

Now any image can be traced back to the exact code that built it. If `sha-3f9a1c2` has a bug, you run `git show 3f9a1c2` and see the code. The `sha-` prefix makes the tag easy to recognize and stops it from ever looking like a version number.

The DevOps course explains this idea of traceable build artifacts in [Build Artifacts and Versioning](/courses/devops/build-artifacts-and-versioning).

> **Tip:** A tag can be up to 128 characters and may contain letters, digits, `_`, `.` and `-`. It cannot contain `/`. So a branch called `feature/login` must become something like `feature-login` before you use it as a tag.

## Adding several tags in one build

You do not need to build the image four times. Pass `-t` several times to `docker build`. All tags point to the same image:

```bash
IMAGE=ghcr.io/your-name/notes-api
docker build \
  -t $IMAGE:1.4.2 \
  -t $IMAGE:1.4 \
  -t $IMAGE:1 \
  -t $IMAGE:latest \
  -t $IMAGE:sha-$(git rev-parse --short HEAD) \
  .
```

Then push all of them at once with `--all-tags`:

```bash
docker push --all-tags ghcr.io/your-name/notes-api
```

```text
The push refers to repository [ghcr.io/your-name/notes-api]
1: digest: sha256:7c1e9a...e42b size: 1789
1.4: digest: sha256:7c1e9a...e42b size: 1789
1.4.2: digest: sha256:7c1e9a...e42b size: 1789
latest: digest: sha256:7c1e9a...e42b size: 1789
sha-3f9a1c2: digest: sha256:7c1e9a...e42b size: 1789
```

Every tag shows the same digest, because it is one image with five names. The layers are uploaded only once.

> **Note:** In GitHub Actions, the `docker/metadata-action@v5` action creates this list of tags for you from Git tags, branches and commits. You will use it in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

## Deploying by digest

For production, even a fixed tag relies on people following the rules. A **digest** is the strictest choice: it cannot change. Find it after a push or pull:

```bash
docker buildx imagetools inspect ghcr.io/your-name/notes-api:1.4.2
```

```text
Name:      ghcr.io/your-name/notes-api:1.4.2
MediaType: application/vnd.oci.image.index.v1+json
Digest:    sha256:7c1e9a...e42b
...
```

You can use both the tag and the digest in one name. Docker uses the digest and ignores the tag, but the tag still tells humans which version it is:

```yaml
services:
  api:
    image: ghcr.io/your-name/notes-api:1.4.2@sha256:7c1e9a...e42b
```

A good middle ground for most teams: deploy **fixed version tags**, and record the digest of each deployment in your release notes or deploy log.

## Recording versions with labels

Tags live in the registry. **Labels** live inside the image itself, so they travel with it. The **OCI** (Open Container Initiative, the group that defines the image format) has standard label names. Pass the values in with build arguments, which you learned about in [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env):

```docker
ARG VERSION=dev
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.source="https://github.com/your-name/notes-api"
```

```bash
docker build --build-arg VERSION=1.4.2 --build-arg GIT_SHA=$(git rev-parse HEAD) -t notes-api:1.4.2 .
docker image inspect notes-api:1.4.2 --format '{{index .Config.Labels "org.opencontainers.image.version"}}'
```

```text
1.4.2
```

Now, even if someone retags the image, you can still ask the image itself which version and commit it came from.

## A simple strategy you can copy

Here is a complete strategy for notes-api. It works well for most small and medium projects:

| When | Tags pushed |
|---|---|
| Every push to `main` | `sha-<short commit>`, `main` |
| Pull request builds | `pr-<number>` (often not pushed at all) |
| A Git tag `v1.4.2` is created | `1.4.2`, `1.4`, `1`, `latest`, `sha-<short commit>` |

And the rules for using them:

- **Servers** run a fixed tag such as `1.4.2` (or a digest), never `latest` or `main`.
- **Staging** can follow `main` to always test the newest code.
- **Rollback** means deploying the previous fixed tag, for example `1.4.1`.
- **Never** push a different image to an existing version tag. Make a new version instead.

## Common mistakes

### Running latest in production

`latest` is just the default tag name, not "the newest stable version". It moves, and it hides which code is running. You learned why to avoid it in [Image Names, Tags and Digests](/courses/docker/image-names-tags-and-digests).

### Reusing a version tag

You find a bug in `1.4.2`, fix it, and push again as `1.4.2`. Now two different images have had the same name, and servers that pulled earlier still run the old one. Release `1.4.3` instead.

### Forgetting the moving tags

You push `1.5.0` but forget `1.5`, `1` and `latest`. Users who follow `1` never get the update. Automate tagging in CI so this cannot happen.

### Using slashes in tags

A branch name like `feature/login` is not a valid tag. Replace `/` with `-`.

## Quick recap

- A **tag** is a movable pointer. A **digest** never changes.
- **Fixed** tags (`1.4.2`, `sha-3f9a1c2`) are for deploying and rolling back. **Moving** tags (`1.4`, `1`, `latest`) are for following updates.
- Push semver tags at three levels, plus a Git commit tag.
- Add many tags in one build with several `-t` flags, and push them with `docker push --all-tags`.
- Use **OCI labels** to store the version and commit inside the image.
- Never reuse a version tag. Never run `latest` in production.

Next, you will build one image that runs on both Intel and ARM machines in [Multi-Platform Images with Buildx](/courses/docker/multi-platform-builds).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# release.sh: build and push one notes-api release with a full set of tags
# Usage: ./release.sh 1.4.2
set -euo pipefail
VERSION="$1"                                  # for example 1.4.2
MINOR="${VERSION%.*}"                         # 1.4
MAJOR="${VERSION%%.*}"                        # 1
GIT_SHA="$(git rev-parse --short HEAD)"       # for example 3f9a1c2
IMAGE="ghcr.io/your-name/notes-api"           # always lowercase
# One build, many tags. Labels record the version and commit inside the image.
docker build \
  --build-arg VERSION="$VERSION" \
  --build-arg GIT_SHA="$(git rev-parse HEAD)" \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:$MINOR" \
  -t "$IMAGE:$MAJOR" \
  -t "$IMAGE:latest" \
  -t "$IMAGE:sha-$GIT_SHA" \
  .
# Push every tag of this repository (layers are uploaded only once)
docker push --all-tags "$IMAGE"
# Print the digest so you can record it in the release notes
docker buildx imagetools inspect "$IMAGE:$VERSION"
# Deploy rule: servers use the fixed tag, for example
#   image: ghcr.io/your-name/notes-api:1.4.2
# Roll back by deploying the previous fixed tag, never by reusing a tag
</code></pre>

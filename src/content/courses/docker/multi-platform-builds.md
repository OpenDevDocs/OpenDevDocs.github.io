---
publishDate: 2026-10-25T17:50
title: 'Multi-Platform Images with Buildx'
slug: multi-platform-builds
metadescription: 'Learn to build one Docker image that runs on both amd64 and arm64 machines with docker buildx, using QEMU emulation or faster cross-compilation.'
updateDate: 2026-10-25T17:50
author: ['bishal-biswas']
level: 3
tags: ['docker', 'buildx', 'multi-platform', 'arm64']
course: docker
---

## "exec format error"

You build notes-api on your new laptop with an Apple M-series chip, push it, and run it on your Linux server. The container stops immediately:

```text
exec /usr/local/bin/docker-entrypoint.sh: exec format error
```

The image is fine. The problem is the **CPU architecture**. A container shares the kernel and CPU of the machine it runs on, as you learned in [Containers vs Virtual Machines](/courses/docker/containers-vs-virtual-machines). Programs are compiled for one kind of CPU. Your laptop built an image for **ARM** CPUs, and your server has an **Intel or AMD** CPU. The server cannot run ARM programs directly.

In this lesson you will build **multi-platform images**: one image name that works on several kinds of machines. You will learn:

- what a **platform** is, and which ones matter
- how one image name can hold several versions (an **image index**)
- how to build for many platforms with `docker buildx`
- the difference between **emulation** and **cross-compilation**
- how to do it in GitHub Actions

## Platforms

A **platform** is the pair "operating system / CPU architecture". Docker writes it like `linux/amd64`. These are the ones you will meet most:

| Platform | Also called | Where you find it |
|---|---|---|
| `linux/amd64` | x86-64, x64, Intel/AMD | Most servers, most Windows PCs, older Macs |
| `linux/arm64` | aarch64, ARM 64-bit | Apple silicon Macs, AWS Graviton and other ARM cloud servers, Raspberry Pi 4 and 5 |
| `linux/arm/v7` | 32-bit ARM | Older Raspberry Pi and small devices |

Check which platform your machine uses:

```bash
docker version --format '{{.Server.Os}}/{{.Server.Arch}}'
```

```text
linux/arm64
```

Even on a Mac or Windows PC, the answer starts with `linux`, because Docker Desktop runs Linux containers in a small Linux VM.

## One name, many images

How do official images such as `node:24-alpine` work everywhere? When you pull them, Docker picks the right version for your machine automatically.

The trick is an **image index** (also called a **manifest list**). It is a small list stored under the tag, which says "for amd64 use this image, for arm64 use that one". Look at one:

```bash
docker buildx imagetools inspect node:24-alpine
```

```text
Name:      docker.io/library/node:24-alpine
MediaType: application/vnd.oci.image.index.v1+json
Digest:    sha256:2c8f...

Manifests:
  Name:      docker.io/library/node:24-alpine@sha256:91a3...
  Platform:  linux/amd64

  Name:      docker.io/library/node:24-alpine@sha256:d4e7...
  Platform:  linux/arm64
...
```

One tag, several images inside. Your goal in this lesson is to push notes-api the same way.

You can also ask for a specific platform when you pull or run. This is handy for testing:

```bash
docker run --rm --platform linux/amd64 alpine:3.22 uname -m
```

```text
x86_64
```

On an ARM Mac, this works thanks to emulation, which is explained below.

## Meet buildx

**Buildx** is the Docker command for **BuildKit**, the modern build engine that Docker uses by default. `docker build` already uses BuildKit, but `docker buildx` gives you more options, including building for many platforms at once.

Builds happen in a **builder**. List your builders:

```bash
docker buildx ls
```

```text
NAME/NODE         DRIVER/ENDPOINT   STATUS    BUILDKIT   PLATFORMS
default*          docker
 \_ default        \_ default       running   v0.25.1    linux/amd64, linux/arm64, ...
```

The **driver** decides where BuildKit runs. The default `docker` driver builds inside Docker itself. For multi-platform builds, the most reliable choice is the `docker-container` driver, which runs BuildKit in its own container. Create one and make it the default:

```bash
docker buildx create --name multi --driver docker-container --use
docker buildx inspect --bootstrap        # start it and show its platforms
```

> **Note:** Docker Desktop with the **containerd image store** turned on can build and store multi-platform images with the default builder too. The `docker-container` builder works everywhere, including Linux servers and CI, so we use it here.

## Building for two platforms

Use `--platform` with a comma-separated list. Add `--push` to send the result straight to your registry:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/your-name/notes-api:1.4.2 \
  --push \
  .
```

```text
[+] Building 74.2s (18/18) FINISHED
 => [linux/amd64 2/5] WORKDIR /app
 => [linux/arm64 2/5] WORKDIR /app
 => [linux/arm64 3/5] COPY package.json package-lock.json ./
 => [linux/amd64 3/5] COPY package.json package-lock.json ./
 ...
 => pushing manifest for ghcr.io/your-name/notes-api:1.4.2
```

You see every step twice, once per platform. BuildKit builds both, then pushes them together with an image index. You learned how to log in and push in [Pushing Images to Docker Hub and GitHub Container Registry](/courses/docker/pushing-images-to-a-registry).

Check the result:

```bash
docker buildx imagetools inspect ghcr.io/your-name/notes-api:1.4.2
```

Now your server and your Mac both pull `notes-api:1.4.2` and each gets the right version.

> **Warning:** With the `docker-container` builder, the result is not in your local `docker images` list unless you push it or load it. `--load` works for a **single** platform (for example `--platform linux/arm64 --load`). Loading several platforms at once needs the containerd image store.

## Emulation with QEMU

How did your ARM laptop build the amd64 version? Through **emulation**. **QEMU** is a program that pretends to be a different CPU. It translates each instruction of an amd64 program into instructions your ARM CPU understands. The Linux kernel feature that connects them is called **binfmt_misc**.

- **Docker Desktop** includes QEMU already. It just works.
- On a **Linux machine**, install the emulators once with a small helper image:

```bash
docker run --privileged --rm tonistiigi/binfmt --install all
```

Emulation is easy, but it is **slow**. Every instruction is translated. For notes-api, which is plain JavaScript, there is little to do during the build (copy files, run `npm ci`), so the extra time is small. For a project that compiles a lot of code, emulation can make builds 5 to 20 times slower.

> **Note:** The `--privileged` flag gives the helper container full access to the host so it can register the emulators in the kernel. Only use it with trusted images.

## Faster: cross-compilation

The faster way is **cross-compilation**: run the compiler on your own machine's CPU, but tell it to produce programs for the other CPU. Many languages support this, such as Go and Rust.

BuildKit gives you automatic build arguments that tell you about the platforms. You learned about `ARG` in [Build Arguments and Environment Variables: ARG vs ENV](/courses/docker/arg-vs-env):

| Argument | Meaning | Example |
|---|---|---|
| `BUILDPLATFORM` | The machine doing the build | `linux/arm64` |
| `TARGETPLATFORM` | The platform being built for | `linux/amd64` |
| `TARGETOS` | Just the OS part of the target | `linux` |
| `TARGETARCH` | Just the CPU part of the target | `amd64` |

The pattern uses a **multi-stage build**, which you learned in [Multi-Stage Builds for Small Images](/courses/docker/multi-stage-builds). The build stage runs on your native platform. The final stage is for the target platform:

```docker
# syntax=docker/dockerfile:1
# The build stage always runs natively, so it is fast
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS build
ARG TARGETOS
ARG TARGETARCH
WORKDIR /src
COPY . .
# Tell the Go compiler which platform to produce a program for
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/app .

# The final stage uses the base image for the target platform
FROM alpine:3.22
COPY --from=build /out/app /usr/local/bin/app
CMD ["app"]
```

This example uses Go because it cross-compiles easily. For notes-api you do not need this: JavaScript is not compiled, and `node:24-alpine` already exists for both platforms.

### What about native npm packages?

Some npm packages contain compiled code, for example image processing or password hashing libraries. They must be installed **for the target platform**. So for a Node app, keep `npm ci` in a stage that runs on the target platform (the normal case, without `--platform=$BUILDPLATFORM`). Under emulation this is slower, but correct.

## Multi-platform builds in GitHub Actions

GitHub's standard runners use amd64. The official Docker actions set up QEMU and Buildx for you:

```yaml
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-qemu-action@v3      # emulators for other CPUs
      - uses: docker/setup-buildx-action@v3    # a docker-container builder
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ghcr.io/your-name/notes-api:1.4.2
```

You will build the full workflow in [Building and Pushing Images in GitHub Actions](/courses/docker/docker-in-ci-github-actions).

> **Tip:** If emulated builds are too slow, GitHub also offers ARM runners. Some teams build each platform on a native runner and merge the results into one index. Start with QEMU, and change only when speed becomes a real problem.

## Common mistakes

### Building on a Mac and deploying to an amd64 server

A plain `docker build` on Apple silicon makes an arm64 image. Either build with `--platform linux/amd64,linux/arm64`, or let CI build the images.

### Base image without your platform

Multi-platform builds only work if the base image exists for every platform you ask for. Check with `docker buildx imagetools inspect <base image>`. Official images usually support both amd64 and arm64.

### Expecting --load to work with two platforms

With the `docker-container` builder, use `--push` for multi-platform builds, or `--load` with one platform at a time.

### Downloading a binary for the wrong CPU

A `RUN curl ... /tool-linux-amd64` line breaks on arm64. Use `$TARGETARCH` in the download URL so each platform gets its own file.

## Quick recap

- A **platform** is OS plus CPU, like `linux/amd64` or `linux/arm64`. A wrong one gives `exec format error`.
- An **image index** lets one tag hold images for several platforms. Docker picks the right one on pull.
- Create a `docker-container` builder with `docker buildx create --use`.
- Build with `docker buildx build --platform linux/amd64,linux/arm64 --push`.
- **QEMU emulation** is easy but slow. **Cross-compilation** with `BUILDPLATFORM` and `TARGETARCH` is fast.
- In GitHub Actions, use `setup-qemu-action`, `setup-buildx-action` and `build-push-action` with `platforms`.

Next, you will make builds faster and safer with [BuildKit Cache Mounts and Build Secrets](/courses/docker/buildkit-cache-and-secret-mounts).

<code id="code-content" class="language-bash">
#!/usr/bin/env bash
# Multi-platform images for notes-api with docker buildx
# --- 1. Which platform is this machine? ---
docker version --format '{{.Server.Os}}/{{.Server.Arch}}'
# --- 2. Linux only: install QEMU emulators once (Docker Desktop has them) ---
docker run --privileged --rm tonistiigi/binfmt --install all
# --- 3. Create a builder that runs BuildKit in its own container ---
docker buildx create --name multi --driver docker-container --use
docker buildx inspect --bootstrap
docker buildx ls
# --- 4. Log in, then build for two platforms and push one image index ---
echo "$GHCR_TOKEN" | docker login ghcr.io -u your-name --password-stdin
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/your-name/notes-api:1.4.2 \
  --push \
  .
# --- 5. Check that the tag lists both platforms ---
docker buildx imagetools inspect ghcr.io/your-name/notes-api:1.4.2
# --- 6. Test one platform locally (load works for one platform at a time) ---
docker buildx build --platform linux/amd64 -t notes-api:amd64-test --load .
docker run --rm --platform linux/amd64 notes-api:amd64-test node -p "process.arch"
# --- 7. Switch back to the default builder when you are done ---
docker buildx use default
</code></pre>

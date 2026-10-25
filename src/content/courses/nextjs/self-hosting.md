---
publishDate: 2026-10-25T13:59
title: Self-Hosting with Node.js and Docker
slug: self-hosting
metadescription: Self-host a Next.js 16 app with next start, output standalone, a multi-stage Dockerfile, an nginx reverse proxy and notes on caching across servers.
updateDate: 2026-10-25T13:59
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'self-hosting', 'docker', 'nginx']
course: nextjs
---

## Why host it yourself?

[Deploying to Vercel](/courses/nextjs/deploying-to-vercel) is the easiest way to go live, but it is not the only way. Next.js is open source, and a Next.js app is "just" a Node.js program. You can run it on any computer that runs Node.js: a cheap virtual private server (**VPS**), a company server, or a container platform. Reasons people do this include cost, company rules about where data lives, or simply wanting full control.

The Next.js docs list four ways to deploy. Two of them, a Node.js server and a Docker container, support **every** feature, including Server Actions, Cache Components and image optimization. That is what this lesson covers:

1. Running `next build` and `next start` on a Linux server.
2. Keeping the app alive with a process manager.
3. Putting **nginx** in front as a reverse proxy.
4. Making a small, self-contained build with `output: 'standalone'`.
5. Packing it all into a **Docker** image.
6. What changes when you run more than one copy.

This lesson is marked Advanced because you are now doing the jobs a host normally does for you. Take it one step at a time.

## Option 1: a Node.js server with next start

The simplest self-hosted setup is the same thing you did in [Building for Production](/courses/nextjs/building-for-production), on a server instead of your laptop.

On a Linux server with **Node.js 20.9 or newer** (Next.js 16 needs at least that):

```bash
git clone https://github.com/your-username/book-nook.git
cd book-nook
npm ci
npm run build
npm run start
```

`npm ci` installs exactly the versions in `package-lock.json`, which is what you want on a server. Before you build, create the environment variables on the server (for example in a `.env.production.local` file that you never commit, or in your process manager's settings), because the app reads `DATABASE_URL`, `SESSION_SECRET` and friends. The database must also be reachable during `npm run build`, because the build runs your cached `getBooks()` to prerender pages.

The app now answers on port 3000. But if you close the terminal, it stops. And if it crashes, nobody restarts it.

### Keep it running with systemd

Most Linux servers come with **systemd**, the program that starts and watches background services. Create a service file (the path and user names here are examples):

```text
# /etc/systemd/system/book-nook.service
[Unit]
Description=Book Nook Next.js app
After=network.target

[Service]
Type=simple
User=booknook
WorkingDirectory=/home/booknook/book-nook
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/home/booknook/book-nook/.env.production.local
ExecStart=/usr/bin/npm run start
Restart=always

[Install]
WantedBy=multi-user.target
```

Then turn it on:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now book-nook
sudo systemctl status book-nook
journalctl -u book-nook -f
```

`Restart=always` brings the app back after a crash or a reboot, and `journalctl -f` shows your server logs live. (PM2 is a popular alternative process manager written in Node.js; either is fine.)

When systemd stops the service, it sends a `SIGTERM` signal. Next.js then finishes requests that are already in progress before it exits, so allow it a few seconds.

## Put nginx in front

You could open port 3000 to the world, but the Next.js docs recommend a **reverse proxy** in front of it instead. A reverse proxy is a doorman: visitors talk to it, and it passes their requests on to your app. It handles the boring, risky jobs: HTTPS certificates, very slow or malformed requests, upload size limits and rate limiting. Your Next.js server can then spend its time rendering pages.

Here is a small nginx site config:

```text
# /etc/nginx/sites-available/book-nook
server {
  listen 80;
  server_name booknook.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Let streamed HTML (Suspense, Partial Prerendering) reach the browser right away
    proxy_buffering off;
  }
}
```

Two settings matter specially for Next.js:

- **Streaming.** Book Nook streams parts of pages behind `<Suspense>`. By default nginx **buffers** responses (collects the whole thing before sending), which hides the static shell until everything is done. `proxy_buffering off` fixes that. The Next.js docs also show another way: sending an `X-Accel-Buffering: no` header from `next.config.mjs`:

```javascript
// next.config.mjs (add to your existing config)
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
      },
    ];
  },
};
```

- **Keep-alive timeouts.** If there is a load balancer in front, Next.js should keep idle connections open a little longer than the proxy does, or the proxy may reuse a connection Node.js already closed. `next start` has a flag for this:

```bash
npx next start --keepAliveTimeout 70000
```

Add HTTPS with a free certificate (for example from Let's Encrypt using `certbot --nginx`), and you have a real production setup.

## Option 2: a standalone build

`npm ci` on the server installs every dependency, including dev tools like ESLint and Tailwind that the running app never uses. Next.js can do better. Add one line to `next.config.mjs`:

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  output: 'standalone',
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

With `output: 'standalone'`, `next build` **traces** your code: it follows every `import` to find out which files the server really needs, and copies only those into `.next/standalone`, together with a tiny `server.js` that replaces `next start`. When we built Book Nook this way, the standalone folder was about 25 MB, far smaller than the full `node_modules`.

```text
.next/standalone/
├── .next/          the server build
├── node_modules/   only the packages the server really uses
├── package.json
└── server.js       a minimal server: run it with node
```

The standalone folder does not include `public/` or `.next/static/` (the browser JavaScript and CSS), because many teams serve those from a CDN. To let `server.js` serve them itself, copy them in after the build:

```bash
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
```

On Windows PowerShell, the same copy is:

```bash
Copy-Item -Recurse public .next/standalone/
Copy-Item -Recurse .next/static .next/standalone/.next/
```

Then start it with plain Node.js:

```bash
node .next/standalone/server.js
```

```text
▲ Next.js 16.4.3
- Local:         http://localhost:3000
- Network:       http://0.0.0.0:3000
✓ Ready in 0ms
```

Choose the port and network address with environment variables, for example `PORT=8080 HOSTNAME=0.0.0.0 node server.js`. You can now copy just the `standalone` folder to a server and run it, with no `npm install` there at all.

## Option 3: a Docker image

**Docker** packs your app, the right Node.js version and the operating system files it needs into one **image**. You can run that image anywhere Docker runs, and it behaves the same everywhere. A running image is called a **container**.

The Dockerfile below follows the official `with-docker` example from the Next.js repository. It uses a **multi-stage build**: one stage installs packages, one builds the app, and the last one keeps only the standalone output. The final image does not contain your source code or dev dependencies. It needs `output: 'standalone'` from the previous section.

```dockerfile
# Dockerfile
ARG NODE_VERSION=24.13.0-slim

# Stage 1: install dependencies
FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Stage 2: build the app in standalone mode
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Stage 3: the small image that actually runs
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder --chown=node:node /app/public ./public

# The prerender cache is written here at run time
RUN mkdir .next
RUN chown node:node .next

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Do not run as root
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

The official example also detects Yarn and pnpm lock files; this version keeps only npm, since that is what the course uses. Pick a current Node.js LTS version for `NODE_VERSION` when you build.

Next to it, add a `.dockerignore` file so Docker does not copy junk (or secrets) into the build:

```text
# .dockerignore
node_modules/
.next/
out/
.git/
.vscode/
*.md
coverage/
playwright-report/
test-results/
e2e/
__tests__/
.env
.env*.local
Dockerfile*
.dockerignore
```

Ignoring `.env*.local` matters: anything left in the build folder is read by `next build` and can end up inside the image. Pass secrets when the container **starts** instead.

Build and run it:

```bash
docker build -t book-nook .
docker run -p 3000:3000 \
  -e SESSION_SECRET=replace-with-a-long-random-string \
  -e DATABASE_URL=postgres://bookshop:replace-with-your-password@your-database-host/booknook \
  -e SITE_URL=https://booknook.example.com \
  book-nook
```

`-p 3000:3000` connects port 3000 on your machine to port 3000 in the container. Open `http://localhost:3000` and Book Nook is running inside Docker.

> **Honesty note:** The `next.config.mjs`, standalone build and `node server.js` steps in this lesson were run for real on Book Nook. The Dockerfile follows the official example line by line, but it could not be run while writing this lesson, because the computer used had no Docker installed. If something does not work for you, compare it with the `with-docker` example in the Next.js GitHub repository, and check Docker's own Next.js guide on [docker.com](https://docs.docker.com/guides/nextjs/).

Docker is great for production, but the Next.js docs suggest running `npm run dev` directly on your computer during development, especially on Windows and macOS, where Docker's file watching is slower.

## Environment variables when self-hosting

Remember the build-time and run-time split from [Environment Variables](/courses/nextjs/environment-variables):

- `NEXT_PUBLIC_` variables are written into the browser JavaScript **during `next build`**. In Docker, that means during `docker build`. Changing them needs a new image.
- Other variables are read by the server **at run time**, as long as the code reads them while handling a request. That lets you build one image and run it in testing and production with different `-e` values.

## Caching when you run more than one copy

With one `next start` process and a normal disk, caching just works. Prerendered pages and cached data are kept in memory and on disk, and `updateTag` refreshes them. Things change when you run **several** copies of the app behind a load balancer (for example, three containers):

- **Each copy has its own cache.** The default `'use cache'` store lives in each process's memory. If an admin changes a price and `updateTag('books')` runs on copy A, copies B and C keep showing the old price until their own cache expires.
- **Fix it with a shared cache handler.** Next.js lets you plug in your own cache storage. `cacheHandlers` (plural) is for `'use cache'` and `'use cache: remote'`; `cacheHandler` (singular) is for the page and ISR cache. Both are usually backed by a shared store such as Redis, which every copy can reach. The Next.js repository has a Redis example to start from.
- **Use the same Server Actions key everywhere.** Next.js encrypts some Server Action data with a key that is different for every build. Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (a base64 key of 16, 24 or 32 bytes) when building, so all copies agree. Otherwise you may see `Failed to find Server Action` errors.
- **Set a `deploymentId`** in `next.config.mjs` during rolling updates, so a browser that loaded the old version does not mix files from the new one.

```javascript
// next.config.mjs (only needed when you run several copies)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const nextConfig = {
  output: 'standalone',
  deploymentId: process.env.DEPLOYMENT_VERSION,
  cacheHandlers: {
    default: require.resolve('./cache-handlers/redis-handler.js'),
  },
  // ...the rest of your config
};

export default nextConfig;
```

`require.resolve` turns the file name into a full path, which is what Next.js expects. Because our config is an `.mjs` file (which uses `import`, not `require`), `createRequire` gives us a `require` function to call it with.

Writing a cache handler is advanced work and outside this course. For one server, which is what most small shops need, none of this is required. Book Nook's books and reviews already live in Postgres ([Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database)), so every copy reads the same data; only the cache in front of it needs sharing.

## Common mistakes

### Pages without CSS or JavaScript in standalone mode

You ran `node .next/standalone/server.js`, the HTML appears, but there is no styling and buttons do nothing. You forgot to copy `.next/static` (and `public`) into the standalone folder. Run the copy commands, or use the Dockerfile, which does it for you.

### The container is running but you cannot reach it

Inside a container, the server must listen on all network addresses, not only `localhost`. The Dockerfile sets `HOSTNAME="0.0.0.0"` for this. Also check that you passed `-p 3000:3000` to `docker run`.

### Streaming looks broken behind nginx

The page shows nothing, then everything at once, and `loading.js` never appears. nginx is buffering. Add `proxy_buffering off;` or the `X-Accel-Buffering: no` header.

### An old Node.js on the server

```text
You are using Node.js 18.19.0. For Next.js, Node.js version ">=20.9.0" is required.
```

Next.js 16 needs Node.js 20.9 or newer. Upgrade Node.js on the server (or bump `NODE_VERSION` in the Dockerfile).

### Prices differ between page loads

You are running several copies with the default in-memory cache, so `updateTag` only refreshed one of them. Use one copy, or add a shared cache handler.

## Quick recap

- Self-hosting with `next build` plus `next start` (or Docker) supports every Next.js feature.
- Keep the app alive with systemd or PM2, and put nginx in front as a reverse proxy, with buffering off so streaming works.
- `output: 'standalone'` creates `.next/standalone` with a minimal `server.js`; copy `public` and `.next/static` into it.
- The official multi-stage Dockerfile builds with full dependencies and ships only the standalone output, running as a non-root user.
- Keep secrets out of the image; pass them with `-e` at run time. `NEXT_PUBLIC_` values are fixed at build time.
- Several copies need a shared cache handler, the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, and a `deploymentId`.

<code id="code-content" class="language-bash">
# Self-hosting Book Nook: three ways to run it
# --- Option 1: plain Node.js on a server (Node.js 20.9 or newer)
npm ci
npm run build
npm run start
# keep it alive with systemd: see /etc/systemd/system/book-nook.service
sudo systemctl enable --now book-nook
# --- Option 2: standalone build (next.config.mjs has output: 'standalone')
npm run build
cp -r public .next/standalone/ &amp;&amp; cp -r .next/static .next/standalone/.next/
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
# --- Option 3: Docker (uses the multi-stage Dockerfile and output: 'standalone')
docker build -t book-nook .
docker run -p 3000:3000 \
  -e SESSION_SECRET=replace-with-a-long-random-string \
  -e DATABASE_URL=postgres://bookshop:replace-with-your-password@your-database-host/booknook \
  -e SITE_URL=https://booknook.example.com \
  book-nook
# --- Behind a load balancer: keep connections open longer than the proxy does
npx next start --keepAliveTimeout 70000
</code></pre>

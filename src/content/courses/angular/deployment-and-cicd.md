---
publishDate: 2026-06-30T14:05
title: Deployment and CI/CD
slug: deployment-and-cicd
metadescription: Build, test and deploy an Angular application reliably, with a pipeline that catches problems before users do.
updateDate: 2026-09-07T14:05
author: ['bishal-biswas']
level: 4
tags: ['deployment', 'cicd', 'production']
course: angular
---

## The production build

```bash
ng build
```

That is already the production build. It minifies, tree shakes, hashes filenames, compiles ahead of time and enforces your budgets.

```text
dist/my-app/
├── browser/          static files, what you upload
│   ├── index.html
│   ├── main-K3XR2A.js
│   └── styles-B7QW1P.css
└── server/           only with SSR
    └── server.mjs
```

Without server-side rendering, `browser/` is the whole deployment.

## Static hosting

The simplest deployment, and the right one for most applications.

```bash
ng build
# upload dist/my-app/browser to any static host
```

The one thing you must configure: **serve `index.html` for any path that is not a real file**. Otherwise refreshing on `/about` returns a 404.

```text
nginx        try_files $uri $uri/ /index.html;
Netlify      _redirects:  /*  /index.html  200
Vercel       rewrites in vercel.json
Firebase     "rewrites": [{ "source": "**", "destination": "/index.html" }]
S3+CloudFront  error document set to index.html with a 200 response
```

This catches people out after their first deploy: routing works while clicking around, then breaks on refresh.

## Caching headers

Angular hashes filenames, so the strategy is simple and effective.

```text
index.html          Cache-Control: no-cache
*.js, *.css         Cache-Control: public, max-age=31536000, immutable
assets              Cache-Control: public, max-age=86400
```

`index.html` must not be cached, because it references the hashed files. If a browser serves a stale `index.html`, it requests files that no longer exist and the application fails to load.

The hashed files can be cached forever, since a new build produces new names.

Getting this backwards is a common and confusing production problem: users on an old version who cannot get the new one until they hard refresh.

## Deploying to a subfolder

```bash
ng build --base-href=/my-app/
```

Without it, every asset and route resolves from the domain root and 404s.

## Server rendered deployment

```bash
ng build
node dist/my-app/server/server.mjs
```

Now you need a running Node process, which means a platform that hosts one: a container, a virtual machine, or a serverless function.

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/my-app/server/server.mjs"]
```

The multi stage build keeps the final image small by leaving build tooling behind.

For static hosting with a static image, a smaller final stage works well:

```dockerfile
FROM nginx:alpine
COPY --from=build /app/dist/my-app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

## A pipeline

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npx ng lint
      - run: npx ng test --watch=false --coverage
      - run: npx ng build

      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  e2e:
    needs: verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    needs: [verify, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist }
      - run: ./deploy.sh
```

Points that matter:

**`npm ci`, not `npm install`.** It installs exactly what the lockfile says, so the build is reproducible.

**Build once, deploy that artifact.** Rebuilding for each environment means deploying something you did not test.

**Run on pull requests too.** Catching a failure before merge is the point.

**Upload the Playwright report on failure**, so you can open the trace from the pipeline rather than reproducing locally.

## Environment configuration

The awkward part of building once and deploying everywhere: the API URL differs per environment, and the bundle is already built.

**Runtime configuration** solves it. Fetch a small file at startup:

```typescript
export interface AppConfig {
  apiUrl: string;
  environment: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(async () => {
      const http = inject(HttpClient);
      const config = await firstValueFrom(http.get<AppConfig>('/assets/config.json'));

      // store it for the token below
      (globalThis as any).__config = config;
    }),
    {
      provide: APP_CONFIG,
      useFactory: () => (globalThis as any).__config as AppConfig,
    },
  ],
};
```

The deployment writes `config.json` per environment, and one build works everywhere.

**Nothing in that file is secret.** It is served to browsers. Keys and connection strings belong on a server.

## Verifying a deployment

```bash
curl -I https://example.com/
curl -I https://example.com/some/route     # should be 200, not 404
curl -s https://example.com/ | grep -o 'main-[a-zA-Z0-9]*\.js'
```

The middle check is the one people forget, and it is exactly the fallback rule that breaks.

Add a version endpoint so you can confirm what is live:

```json
{ "version": "1.4.0", "commit": "a1b2c3d", "builtAt": "2026-09-07T12:00:00Z" }
```

## Rolling back

The best rollback is redeploying the previous artifact, which is why keeping build artifacts matters.

For static hosting, most platforms keep previous deployments and offer one click rollback. For containers, keep the previous image tagged and redeploy it.

Do not roll back by reverting the commit and rebuilding. That is slower, and the rebuild may differ from what was actually running.

## A checklist

```text
budgets configured so the build fails on bundle growth
index.html served for every route, verified by curl
index.html not cached, hashed assets cached forever
base href correct if deploying to a subfolder
HTTPS with HSTS
security headers, including a content security policy
source maps generated hidden and uploaded to an error tracker
error reporting configured with the release version
a version endpoint you can check
a rollback you have actually tested
```

The last one is worth doing before you need it. A rollback nobody has run is not a rollback.

## Quick recap

- `ng build` is already the production build.
- Serve `index.html` for every route, or refreshes 404.
- Never cache `index.html`, always cache hashed assets.
- Use `npm ci` and build once, then deploy that same artifact everywhere.
- Fetch runtime configuration at startup so one build works in every environment.
- Nothing served to a browser is secret.
- Test your rollback before you need it.

<code id="code-content" class="language-bash">
# ng build IS the production build: minified, tree shaken, hashed,
# ahead of time compiled, with your budgets enforced.
ng build
ng build --base-href=/my-app/       # deploying to a subfolder
# Output: dist/my-app/browser/  is the whole deployment without SSR
# THE ONE THING TO CONFIGURE: serve index.html for any path that is not a
# real file, or refreshing on /about returns a 404. Routing works while
# clicking around and breaks on refresh, which catches everyone once.
#   nginx     try_files $uri $uri/ /index.html;
#   Netlify   _redirects:  /*  /index.html  200
#   Firebase  "rewrites": [{ "source": "**", "destination": "/index.html" }]
# CACHING. Getting this backwards leaves users stuck on an old version
# until they hard refresh.
#   index.html   Cache-Control: no-cache        it names the hashed files
#   *.js *.css   max-age=31536000, immutable    new build, new names
# VERIFY THE DEPLOYMENT. The middle one is the check people forget, and
# it is exactly the rule that breaks.
curl -I https://example.com/
curl -I https://example.com/some/route          # must be 200, not 404
curl -s https://example.com/ | grep -o 'main-[a-zA-Z0-9]*\.js'
# A PIPELINE
#   npm ci                    exact lockfile install, reproducible
#   npx ng lint
#   npx ng test --watch=false --coverage
#   npx ng build              ONCE, then deploy that same artifact
#   npx playwright test       upload the report on failure
# Rebuilding per environment means deploying something you did not test.
# So configuration must be fetched at RUNTIME, not baked in:
#   provideAppInitializer(() =&gt; loadConfigFrom('/assets/config.json'))
# The deployment writes config.json per environment and one build works
# everywhere. NOTHING in that file is secret: it is served to browsers.
# Dockerfile: multi stage keeps build tooling out of the final image
#   FROM node:22-alpine AS build
#   WORKDIR /app
#   COPY package*.json ./ &amp;&amp; RUN npm ci
#   COPY . . &amp;&amp; RUN npm run build
#   FROM nginx:alpine
#   COPY --from=build /app/dist/my-app/browser /usr/share/nginx/html
# With SSR you need a running Node process instead:
#   CMD ["node", "dist/my-app/server/server.mjs"]
# ROLL BACK by redeploying the PREVIOUS ARTIFACT, not by reverting the
# commit and rebuilding: that is slower, and the rebuild may differ from
# what was actually running. Keep artifacts and image tags.
# A rollback nobody has ever run is not a rollback. Test it first.
</code></pre>

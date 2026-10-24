---
publishDate: 2026-05-29T10:25
title: Deployment and CI/CD
slug: deployment-and-cicd
metadescription: Ship a React app safely with build pipelines, environment configuration, preview deployments and monitoring.
updateDate: 2026-09-05T10:25
author: ['bishal-biswas']
level: 4
tags: ['deployment', 'ci-cd', 'operations']
course: react
---

## Two kinds of deployment

**A static app**, from Vite, produces plain files in `dist/`. Any static host will serve them: Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3.

**A server rendered app**, from Next.js, needs a running Node process or an equivalent runtime. Vercel, Netlify, Railway, Fly.io, or your own container.

The difference decides your hosting options, so know which you have.

## The static deploy gotcha

```bash
/*  /index.html  200
```

A client rendered app is one HTML file. Visiting `/about` directly asks the server for a file that does not exist, so you get a 404.

Every host has a way to say "serve `index.html` for everything". Netlify uses `_redirects`, Vercel does it automatically, nginx uses `try_files`. **If your links work but refreshing 404s, this is why.**

## Environment configuration

```bash
VITE_API_URL=http://localhost:3000
VITE_API_URL=https://staging-api.example.com
VITE_API_URL=https://api.example.com
```

Two rules that matter.

**Anything with `VITE_` or `NEXT_PUBLIC_` is public.** It is compiled into the bundle and readable in DevTools. Publishable keys only.

**Never commit `.env.local`.** Add it to `.gitignore`, and put real values in the host's environment settings.

Fail loudly when something is missing:

```javascript
const required = ['VITE_API_URL'];
for (const key of required) {
  if (!import.meta.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}
```

A build that fails is better than one that deploys with `undefined` in every URL.

## A pipeline

```javascript
// .github/workflows/ci.yml
// name: CI
// on:
//   pull_request:
//   push:
//     branches: [main]
// jobs:
//   check:
//     runs-on: ubuntu-latest
//     steps:
//       - uses: actions/checkout@v4
//       - uses: actions/setup-node@v4
//         with:
//           node-version: 22
//           cache: npm
//       - run: npm ci
//       - run: npm run lint
//       - run: npm run typecheck
//       - run: npm test
//       - run: npm run build
```

Note `npm ci`, not `npm install`. It installs exactly what the lockfile says, so a build is reproducible.

Order the steps cheapest first. Linting fails in seconds, so run it before a five minute test suite.

## Preview deployments

Every pull request gets its own URL.

This is the single highest value thing in a front end pipeline. Reviewers click a link instead of pulling the branch and running it locally, designers check the real thing, and product people try it before it merges.

Vercel, Netlify and Cloudflare Pages all do this automatically. If you host yourself, it is worth building.

## Caching headers

```javascript
// /assets/*
//   Cache-Control: public, max-age=31536000, immutable
// /index.html
//   Cache-Control: public, max-age=0, must-revalidate
```

Hashed assets can be cached for a year, because the filename changes when the content does.

**HTML must not be cached**, or users keep loading an old page that references deleted asset files. That produces the confusing "it works after a hard refresh" bug.

## Handling stale clients

A user with the page open when you deploy has an old bundle. Lazy loaded chunks they have not fetched yet no longer exist.

```javascript
<ErrorBoundary
  fallback={
    <div>
      <p>A new version is available.</p>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  }
>
  <Suspense fallback={<Spinner />}>
    <LazyRoute />
  </Suspense>
</ErrorBoundary>
```

Or detect it and prompt:

```javascript
function useVersionCheck(interval = 5 * 60 * 1000) {
  const [hasUpdate, setHasUpdate] = useState(false);
  useEffect(() => {
    const current = import.meta.env.VITE_BUILD_ID;
    const id = setInterval(async () => {
      const response = await fetch('/version.json', { cache: 'no-store' });
      const { buildId } = await response.json();
      if (buildId !== current) setHasUpdate(true);
    }, interval);
    return () => clearInterval(id);
  }, [interval]);
  return hasUpdate;
}
```

A quiet banner offering to reload is much better than a mysterious error.

## Monitoring

```javascript
import * as Sentry from '@sentry/react';
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_BUILD_ID,
  tracesSampleRate: 0.1
});
```

Upload source maps at build time and keep them private. Without them a production stack trace is unreadable minified names. With them, you get the original line.

Also wire up the React 19 root error handlers, since errors no longer reach `window.onerror`:

```javascript
createRoot(container, {
  onUncaughtError(error, info) {
    Sentry.captureException(error, { extra: info });
  }
});
```

And measure real performance:

```javascript
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(report);
onINP(report);
onCLS(report);
```

## Rolling out safely

**Deploy small and often.** A change with twenty commits is hard to diagnose. One with two is not.

**Use feature flags** to separate deploying from releasing, so you can turn something off without a rollback.

**Know how to roll back.** Most platforms make a previous deployment instant to restore. Practise it before you need it at midnight.

**Watch after deploying.** Error rate and Core Web Vitals for the next twenty minutes tell you most of what you need to know.

## Quick recap

- Static apps need a rule serving `index.html` for every path.
- Public environment variables are readable by anyone.
- Use `npm ci` in CI, and order steps cheapest first.
- Preview deployments per pull request are the highest value addition.
- Cache hashed assets forever, never cache HTML.
- Handle stale clients after a deploy with a reload prompt.
- Upload private source maps and wire up the React 19 error handlers.
- Deploy small, use flags, and know your rollback.

<code id="code-content" class="language-javascript">
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { onLCP, onINP, onCLS } from 'web-vitals';
import { useState, useEffect } from 'react';
// FAIL THE BUILD when configuration is missing. Better than deploying
// with "undefined" in every URL.
const required = ['VITE_API_URL'];
for (const key of required) {
  if (!import.meta.env[key]) {
    throw new Error('Missing environment variable: ' + key);
  }
}
// Anything with VITE_ or NEXT_PUBLIC_ is compiled into the bundle and
// readable in DevTools. Publishable keys only, never secrets.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_BUILD_ID,   // ties errors to a deploy
  tracesSampleRate: 0.1
});
// React 19 no longer sends errors to window.onerror, so report them here
createRoot(document.getElementById('root'), {
  onUncaughtError(error, info) {
    Sentry.captureException(error, { extra: info });
  },
  onCaughtError(error, info) {
    Sentry.captureException(error, { extra: { ...info, caught: true } });
  }
}).render(&lt;App /&gt;);
// Real user performance, which is what Google measures
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
// A user with the page open when you deploy has an OLD bundle, and the
// lazy chunks they have not fetched yet no longer exist. Detect it and
// offer a reload, rather than showing a mysterious error.
function useVersionCheck(interval = 5 * 60 * 1000) {
  const [hasUpdate, setHasUpdate] = useState(false);
  useEffect(() =&gt; {
    const current = import.meta.env.VITE_BUILD_ID;
    const id = setInterval(async () =&gt; {
      const response = await fetch('/version.json', { cache: 'no-store' });
      const { buildId } = await response.json();
      if (buildId !== current) setHasUpdate(true);
    }, interval);
    return () =&gt; clearInterval(id);
  }, [interval]);
  return hasUpdate;
}
// ---------- Hosting configuration ----------
// A client rendered app is ONE html file, so /about must serve it too.
// If links work but refreshing 404s, this is the missing piece.
//   Netlify _redirects:   /*  /index.html  200
// Hashed assets can be cached for a year, because the filename changes
// when the content does. HTML must NOT be cached, or users keep loading
// a page that references deleted asset files.
//   /assets/*     Cache-Control: public, max-age=31536000, immutable
//   /index.html   Cache-Control: public, max-age=0, must-revalidate
// ---------- CI, cheapest steps first ----------
//   npm ci            exact lockfile install, reproducible
//   npm run lint      fails in seconds
//   npm run typecheck
//   npm test
//   npm run build
// And give every pull request a PREVIEW URL. It is the single highest
// value thing in a front end pipeline.
</code></pre>

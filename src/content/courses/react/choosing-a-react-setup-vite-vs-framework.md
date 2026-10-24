---
publishDate: 2026-05-02T09:04
title: 'Choosing a Setup: Vite vs a React Framework'
slug: choosing-a-react-setup-vite-vs-framework
metadescription: Decide between a plain Vite app and a full framework like Next.js, and understand why Create React App is no longer recommended.
updateDate: 2026-09-05T09:04
author: ['bishal-biswas']
level: 1
tags: ['setup', 'tooling']
course: react
---

## Three ways to start

1. **Vite**, a fast build tool. You get React and nothing else.
2. **A framework** such as Next.js, which adds routing, data fetching and server rendering.
3. **A script tag**, with no build step at all. Rare, but useful to know.

## Create React App is gone

For years the answer was `npx create-react-app`. It was officially retired in 2025, and the React documentation now points people at Vite or a framework instead.

If a tutorial starts with `create-react-app`, it is out of date. The React itself will still be relevant, but the tooling advice will not.

## Vite

```bash
npm create vite@latest my-app
cd my-app
npm install
npm run dev
```

You get a dev server that starts in well under a second, instant updates when you save, and a production build with one command.

**Choose Vite when:**

- You are learning React and want as little magic as possible.
- You are building a dashboard, an admin panel, or anything behind a login.
- Search engines do not need to read your content.
- You already have a backend and only need a front end.

**The trade off** is that you assemble the rest yourself. Routing, data fetching, and server rendering are all decisions you have to make and wire together.

## Next.js

```bash
npx create-next-app@latest my-app
```

Next.js is React plus everything around it: file based routing, server rendering, data fetching, image optimisation, and API routes.

**Choose a framework when:**

- Search engines need to read your pages, as for a blog, shop or marketing site.
- The first paint has to be fast on slow connections.
- You want Server Components, which need a framework to work.
- You would rather accept sensible defaults than make twenty decisions.

**The trade off** is more to learn at once. You are learning React and the framework's conventions at the same time, and it can be hard to tell which is which.

There are alternatives worth knowing: **React Router** in framework mode, and **TanStack Start**. The reasoning is the same.

## Client rendering versus server rendering

This is the real difference underneath.

With **Vite**, the browser downloads an almost empty HTML file, then downloads your JavaScript, runs it, and builds the page. Search crawlers may see nothing useful, and users stare at a blank screen for a moment.

```html
<div id="root"></div>
```

With a **framework**, the server sends finished HTML. The page is readable immediately, then React attaches behaviour to it. That step is called hydration.

For an internal tool nobody will notice. For a public site it matters a lot.

## No build step at all

React can run straight in the browser.

```html
<script type="importmap">
  { "imports": { "react": "https://esm.sh/react@19", "react-dom/client": "https://esm.sh/react-dom@19/client" } }
</script>
<script type="module">
  import { createRoot } from 'react-dom/client';
  createRoot(document.getElementById('root')).render('Hello');
</script>
```

Note there is no JSX here, because nothing is compiling it. This is fine for a demo or for adding a small React widget to an existing page, and impractical for anything larger.

## A recommendation

**If you are learning React, start with Vite.** Fewer moving parts means that when something breaks, it is React you are debugging rather than a framework's conventions.

Once components, state and effects feel comfortable, move to Next.js for real projects. The React you learned transfers completely.

## What Vite gives you

The generated project is small on purpose:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()]
});
```

That plugin is what compiles JSX and enables Fast Refresh, which keeps component state while you edit.

```bash
npm run dev
npm run build
npm run preview
```

`npm run build` writes static files to `dist/`, which you can host anywhere: Netlify, Vercel, GitHub Pages, or your own server.

## One gotcha with plain Vite

A client rendered app is a single HTML file. Visiting `/about` directly gives a 404, because no such file exists.

The fix is a host rule that serves `index.html` for every path. On Netlify:

```bash
/*  /index.html  200
```

Every host has an equivalent. If your routes work when you click but 404 on refresh, this is why.

## Quick recap

- Create React App is retired, so use Vite or a framework.
- Vite is minimal and fast, ideal while learning and for apps behind a login.
- Next.js adds routing, data fetching and server rendering for public sites.
- Client rendering ships an empty page and builds it in the browser.
- Server rendering ships finished HTML, which crawlers and slow connections need.
- React can run with no build step, but then you lose JSX.
- A plain Vite app needs a host rule so deep links do not 404.

<code id="code-content" class="language-javascript">
// ---------- Starting a project ----------
// Plain Vite, minimal and fast, best while learning:
//   npm create vite@latest my-app -- --template react
//   cd my-app &amp;&amp; npm install &amp;&amp; npm run dev
// A full framework, best for public sites that need SEO:
//   npx create-next-app@latest my-app
// ---------- vite.config.js: almost nothing to configure ----------
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],          // compiles JSX and enables Fast Refresh
  server: { port: 3000 },
  build: { outDir: 'dist' }
});
// ---------- The scripts you will actually run ----------
// npm run dev       start the dev server, updates instantly on save
// npm run build     write static files to dist/
// npm run preview   serve the production build locally before deploying
// ---------- Client rendering: what the browser first receives ----------
// &lt;div id="root"&gt;&lt;/div&gt;          an empty shell, filled in by JavaScript
// Server rendering sends finished HTML instead, then React attaches
// behaviour to it. That second step is called hydration.
// ---------- Deploying a plain Vite app ----------
// A client rendered app is one HTML file, so visiting /about directly
// would 404. Tell the host to serve index.html for every path.
// Netlify _redirects:
//   /*  /index.html  200
// If your routes work when clicked but break on refresh, this is why.
// ---------- React with no build step at all ----------
// Works, but you lose JSX, because nothing is compiling it:
// import { createRoot } from 'react-dom/client';
// import { createElement } from 'react';
// createRoot(document.getElementById('root'))
//   .render(createElement('h1', null, 'Hello without JSX'));
</code></pre>

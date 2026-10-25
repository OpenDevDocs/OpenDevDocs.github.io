---
publishDate: 2026-10-25T13:21
title: The public Folder and Third-Party Scripts
slug: public-folder-and-scripts
metadescription: "Serve static files from the Next.js public folder and load third-party scripts safely with next/script and its loading strategies, inline scripts and events."
updateDate: 2026-10-25T13:21
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'public', 'scripts', 'performance']
course: nextjs
---

## What you will learn

Not everything in a website is a React component. Book Nook also needs plain files, like cover images, a PDF of the shop's opening hours, or a file that a search engine asks for. And sooner or later someone will ask you to add a script from another company: a chat widget, an analytics tool, a map.

This lesson covers both:

- the `public` folder, for files you want to serve exactly as they are
- the `<Script>` component from `next/script`, for loading outside JavaScript without slowing your pages down

Think of the `public` folder as the shop window: whatever you put there, anyone walking by can see, unchanged. Third-party scripts are like delivery vans: useful, but if they all park at the front door at opening time, customers cannot get in. `next/script` decides when each van is allowed to arrive.

## Part 1: the public folder

### How it works

Every new Next.js project has a `public` folder in the project root. `create-next-app` put a few SVG files in it:

```text
book-nook/
├── app/
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
└── package.json
```

Any file in `public` is served from the **root** of your site. The word `public` is not part of the address:

| File on disk | Address in the browser |
| --- | --- |
| `public/next.svg` | `/next.svg` |
| `public/covers/dune.jpg` | `/covers/dune.jpg` |
| `public/docs/opening-hours.pdf` | `/docs/opening-hours.pdf` |

That is why the starter `app/page.js` shows the Next.js logo with `src="/next.svg"`, and why Book Nook covers are written as `'/covers/dune.jpg'` in `lib/books.js` (see [Optimizing Images with next/image](/courses/nextjs/optimizing-images)).

### Using public files

Link to a file like any other address:

```jsx
// app/about/page.js
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">About Book Nook</h1>
      <p className="mt-4">
        Download our{' '}
        <a href="/docs/opening-hours.pdf" className="text-brand-700 underline">
          opening hours (PDF)
        </a>
        .
      </p>
    </main>
  );
}
```

Use a plain `<a>` here, not `<Link>`. `<Link>` is for moving between pages of your app. A PDF is a file, so the browser should simply open or download it.

For images, prefer `<Image>` from `next/image` with the same `/...` path, so they are resized and lazy-loaded. For files that should not be changed at all (SVG logos, PDFs, a `manifest` you wrote by hand, a sound effect), `public` is the right home.

### Good to know about public

- **Everyone can read it.** Never put secrets, private data or `.env` files in `public`. If a file is in there, anyone can download it by guessing its name.
- **Caching:** Next.js cannot know if you will change a public file, so it sends it with `Cache-Control: public, max-age=0`. Browsers check for a new version each time. If you replace `logo.svg` with a new design, visitors see it straight away. If you want long caching, put the version in the file name instead (`logo-v2.svg`).
- **Names must not clash with routes.** Do not create `public/books` when you also have an `app/books` route. Pick different names.
- **Icons and robots.txt belong in `app`.** For `favicon.ico`, `robots.txt` and `sitemap.xml`, the App Router has special files inside the `app` folder (that is why `create-next-app` put `favicon.ico` in `app/`, not `public/`). You will learn them in [Sitemaps, robots.txt and App Icons](/courses/nextjs/sitemap-robots-and-icons).

## Part 2: third-party scripts

### Why not just a script tag?

A plain `<script src="...">` tag in your layout runs whenever the browser reaches it. A large analytics or chat script can then compete with your own JavaScript and make the page feel slow to respond. It may also run again on every page change, or load twice.

The `<Script>` component from `next/script` fixes this:

- It loads each script **once**, even when visitors move between pages.
- You choose **when** it loads with a `strategy`.
- It can tell you when the script has loaded, so you can use it safely.

### Your first Script

Book Nook wants a chat widget on every page. Add it to the root layout:

```jsx
// app/layout.js
import Script from 'next/script';
import { geistSans, geistMono, lora } from './fonts';
import './globals.css';

export const metadata = {
  title: 'Book Nook',
  description: 'A small online bookshop',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Script src="https://chat.example.com/widget.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
```

(`https://chat.example.com/widget.js` stands in for whatever address your chat provider gives you.)

Where you put `<Script>` decides which pages load it:

- In the **root layout**: every page.
- In a **nested layout**, like `app/books/layout.js`: every page under `/books`.
- In a **single page**: only that page.

Load scripts only where they are needed. A map script that only the "Visit us" page uses should live in that page, not in the root layout.

### Choosing a strategy

The `strategy` prop has three values you will use, plus one experimental one:

| Strategy | When it loads | Good for |
| --- | --- | --- |
| `afterInteractive` (the default) | Early, but after the page has started to become interactive | Analytics, tag managers |
| `lazyOnload` | Later, when the browser is idle | Chat widgets, social media embeds, anything not urgent |
| `beforeInteractive` | Before any Next.js code, placed in the `<head>` | Rare: cookie consent managers, bot detection |
| `worker` | In a web worker (experimental) | Not supported with the App Router yet, so skip it |

Some rules for `beforeInteractive`:

- It must be placed in the **root layout** (`app/layout.js`).
- It is always moved into the page's `<head>`, wherever you write it.
- It runs once when the page first loads. Moving to another page in your app does not run it again.

When in doubt, use the default, or `lazyOnload` for things the visitor does not need straight away.

### Inline scripts

Sometimes you have a few lines of JavaScript instead of a file. Put the code inside `<Script>` as a string, and **always give it an `id`** so Next.js can keep track of it:

```jsx
// app/books/page.js
<Script id="books-page-view">
  {`console.log('Someone is browsing the books');`}
</Script>
```

Here is a useful real example. In [Styling with Tailwind CSS](/courses/nextjs/tailwind-css) you made a dark mode toggle that forgot the choice on reload. If the toggle also saves the choice in `localStorage`, a tiny inline script in the root layout can switch the `dark` class back on before the page paints:

```jsx
// app/layout.js
<html
  lang="en"
  className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
  suppressHydrationWarning
>
  <body className="min-h-full flex flex-col font-sans">
    {children}
    <Script id="theme-init" strategy="beforeInteractive">
      {`if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');`}
    </Script>
  </body>
</html>
```

```jsx
// components/ThemeToggle.js
'use client';

export default function ThemeToggle() {
  function toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  return <button onClick={toggle}>Toggle theme</button>;
}
```

`classList.toggle` returns `true` when it added the class, so the toggle knows what to save. The script changes the `class` of `<html>` before React takes over, so the HTML from the server and the page in the browser no longer match. `suppressHydrationWarning` on `<html>` tells React that this one difference is expected. It only affects that element, not its children.

### Running code when a script loads

Many scripts create a global object you can only use after they finish loading. `<Script>` has three event props:

- `onLoad`: runs once, after the script has loaded.
- `onReady`: runs after it has loaded, and again every time the component mounts (for example when you come back to the page).
- `onError`: runs if the script fails to load.

These are functions, and functions only work in the browser, so the component that uses them **must be a Client Component**. Imagine the "Visit us" page shows a map from a map provider:

```jsx
// components/ShopMap.js
'use client';

import Script from 'next/script';

export default function ShopMap() {
  return (
    <>
      <div id="shop-map" className="h-80 w-full rounded-lg bg-zinc-100" />
      <Script
        src="https://maps.example.com/v1/map.js"
        onReady={() => {
          // The provider's script created window.ExampleMaps for us
          new window.ExampleMaps.Map('shop-map', { lat: 51.5, lng: -0.12 });
        }}
        onError={() => {
          document.getElementById('shop-map').textContent = 'The map could not be loaded.';
        }}
      />
    </>
  );
}
```

`onReady` is the right choice here: if the visitor leaves the page and comes back, the script is already loaded (so `onLoad` would not fire again), but the map `div` is new and needs drawing again.

Use `<ShopMap />` from any page, even a Server Component page. Only `ShopMap` itself needs `'use client'` (as you learned in [Mixing Server and Client Components](/courses/nextjs/server-client-boundary)).

### Ready-made components for popular services

For Google Analytics, Google Tag Manager, Google Maps embeds and YouTube embeds, the Next.js team publishes the `@next/third-parties` package. It wraps the right `<Script>` setup for you:

```bash
npm install @next/third-parties@latest
```

```jsx
// app/layout.js
import { GoogleAnalytics } from '@next/third-parties/google';

// inside <html>, after <body>...</body>
<GoogleAnalytics gaId="G-XXXXXXXXXX" />
```

Replace `G-XXXXXXXXXX` with your own measurement ID. Remember that analytics usually needs the visitor's consent in many countries, so check the rules where you sell.

## Common mistakes

### Writing /public in the path

```jsx
<img src="/public/covers/dune.jpg" alt="Dune" />
```

This gives a 404 error. The `public` folder is the root, so the right path is `/covers/dune.jpg`.

### Passing onLoad from a Server Component

```text
Error: Event handlers cannot be passed to Client Component props.
  {src: ..., onLoad: function onLoad}
                     ^^^^^^^^^^^^^^^
If you need interactivity, consider converting part of this to a Client Component.
```

Pages and layouts are Server Components by default, and they cannot send functions to the browser. Move the `<Script>` with `onLoad`, `onReady` or `onError` into its own component that starts with `'use client'`, like `ShopMap` above.

### An inline script without an id

Without an `id`, Next.js cannot tell your inline scripts apart, and the script may not be optimized or may run more than once. Give every inline `<Script>` a unique `id`.

### beforeInteractive outside the root layout

`beforeInteractive` is only meant for `app/layout.js`. In a page or nested layout it will not behave as you expect. In most cases you do not need it at all: use the default strategy or `lazyOnload`.

### Putting private files in public

A file in `public` is downloadable by anyone who knows or guesses its name. Keep data files, backups and anything with passwords outside `public`, and read them on the server instead (you will do this in [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database)).

## Quick recap

- Files in `public/` are served unchanged from the site root: `public/docs/menu.pdf` is at `/docs/menu.pdf`.
- Public files are visible to everyone and are sent with `Cache-Control: public, max-age=0`. Put favicons and `robots.txt` in `app/` instead.
- `<Script>` from `next/script` loads each third-party script once and lets you choose when.
- Strategies: `afterInteractive` (default), `lazyOnload` (when idle), `beforeInteractive` (root layout only, rare). Skip `worker` in the App Router.
- Place a `<Script>` in the root layout, a nested layout or a single page to control which pages load it.
- Inline scripts need an `id`.
- `onLoad`, `onReady` and `onError` only work inside a Client Component.
- `@next/third-parties` has ready-made components for Google Analytics, Tag Manager, Maps and YouTube.

<code id="code-content" class="language-jsx">
// app/layout.js: Book Nook's root layout with a remembered theme and a lazy chat widget
import Script from 'next/script';
import { geistSans, geistMono, lora } from './fonts';
import './globals.css';
export const metadata = {
  title: 'Book Nook',
  description: 'A small online bookshop',
};
export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the theme script may add the "dark" class before React starts
    &lt;html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} h-full antialiased`}
      suppressHydrationWarning
    &gt;
      &lt;body className="min-h-full flex flex-col font-sans"&gt;
        {children}
        {/* Runs before the page becomes interactive: restores the saved dark mode choice */}
        &lt;Script id="theme-init" strategy="beforeInteractive"&gt;
          {`if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');`}
        &lt;/Script&gt;
        {/* Not urgent: loads when the browser is idle, once for the whole visit */}
        &lt;Script src="https://chat.example.com/widget.js" strategy="lazyOnload" /&gt;
      &lt;/body&gt;
    &lt;/html&gt;
  );
}
// --- Files in public/ are served from the site root:
// public/covers/dune.jpg        -&gt; /covers/dune.jpg
// public/docs/opening-hours.pdf -&gt; /docs/opening-hours.pdf
</code></pre>

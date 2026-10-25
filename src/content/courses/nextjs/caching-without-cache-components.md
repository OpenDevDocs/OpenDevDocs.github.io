---
publishDate: 2026-10-25T13:33
title: Caching in Projects Without Cache Components
slug: caching-without-cache-components
metadescription: Read and maintain older Next.js caching code. fetch cache options, export const revalidate, dynamic, unstable_cache, and how each maps to use cache.
updateDate: 2026-10-25T13:33
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'caching', 'isr', 'migration']
course: nextjs
---

## What you will learn

Everything in this course so far uses **Cache Components**, because Book Nook was created with `cacheComponents: true`. But many real projects you will join were started earlier, or never switched the option on. They cache in a different way, with its own words: `force-cache`, `export const revalidate`, `force-dynamic`, `unstable_cache`.

> **This lesson describes the previous caching model.** It applies only when `cacheComponents` is **not** set to `true` in `next.config`. Do not mix it into Book Nook: with Cache Components on, most of these options are errors.

By the end you will be able to read such a project, know what each option does, and know what it becomes if the team moves to Cache Components.

## How to tell which model a project uses

Open `next.config.js` (or `.mjs` or `.ts`):

```javascript
// next.config.mjs in an older project
/** @type {import('next').NextConfig} */
const nextConfig = {
  // no cacheComponents line here
};

export default nextConfig;
```

- `cacheComponents: true` present: the **new model** (the rest of this course).
- No `cacheComponents` line, or `false`: the **previous model** (this lesson).

The build output gives it away too, as you will see below.

## The big difference

In the previous model, Next.js decides **per route** (per page), like a light switch:

- If a page uses nothing request-specific, the whole page is **static**: built once, served to everyone.
- The moment anything in the page reads `cookies()`, `headers()` or `searchParams`, or makes an uncached fetch after such a read, the **whole page** becomes **dynamic**: rendered on every request.

In the new model you met in [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering), the same page would get a static shell with one dynamic hole. In the previous model, there are no holes: it is all or nothing.

## Caching fetch requests

In the previous model the extended `fetch` is the main caching tool. Since Next.js 15, a `fetch` is **not cached** by default. You opt in per request:

```jsx
// app/books/page.js (previous model)
export default async function BooksPage() {
  const res = await fetch('https://api.example.com/books', {
    cache: 'force-cache', // keep the response in Next.js's Data Cache
  });
  const books = await res.json();
  // ...render
}
```

You can also give the response a lifetime and tags:

```javascript
// Refresh at most once an hour
fetch('https://api.example.com/books', { next: { revalidate: 3600 } });

// Label it so you can clear it later with revalidateTag
fetch('https://api.example.com/books', { next: { tags: ['books'] } });

// Never cache, fetch on every request
fetch('https://api.example.com/cart', { cache: 'no-store' });
```

`next.revalidate` is a number of **seconds**: `false` means keep forever, `0` means never cache. The cached responses live in the **Data Cache**, which in this model keeps entries even across new deployments.

> **Good to know:** Even an uncached `fetch` runs only once during `next build` if the page has no request-specific code before it, because the whole page is prerendered then. This "is it static or not?" guessing is a big reason Cache Components was created.

## Caching other data with unstable_cache

Database queries do not go through `fetch`. For them the previous model offers `unstable_cache`, which wraps a function:

```javascript
// lib/books.js (previous model)
import { unstable_cache } from 'next/cache';
import { db } from './db';

export const getBooks = unstable_cache(
  async () => {
    return db.query('SELECT * FROM books ORDER BY title');
  },
  ['books'], // extra key parts
  { tags: ['books'], revalidate: 3600 },
);
```

The second argument adds to the cache key, and the third sets tags and a lifetime in seconds. Despite the name, it is widely used in older projects, and it still works even with Cache Components on.

## Route segment config

You can set caching rules for a whole page or layout by exporting special constants from the file. This is called **route segment config**.

### export const revalidate

The default lifetime, in seconds, for the whole route:

```jsx
// app/books/page.js (previous model)
import { getBooks } from '@/lib/books';

export const revalidate = 3600; // rebuild this page at most once an hour

export default async function BooksPage() {
  const books = await getBooks();
  // ...render
}
```

This is **Incremental Static Regeneration** (ISR) in the previous model: the page is built ahead of time, then rebuilt in the background when it is older than an hour and someone visits. The number must be written plainly (`3600`, not `60 * 60`), because Next.js reads it without running your code.

If several layouts and pages in one route set different values, the **lowest** wins.

### export const dynamic

Forces the whole route one way or the other:

```jsx
// app/cart/page.js (previous model)
export const dynamic = 'force-dynamic';
```

The four possible values:

- `'auto'` (the default): decide automatically.
- `'force-dynamic'`: render on every request, with no caching of its fetches.
- `'force-static'`: always prerender; `cookies()` and `headers()` return empty values.
- `'error'`: prerender, and fail the build if anything request-specific is used.

You will most often see `force-dynamic` on pages that must always be fresh, like a cart or admin dashboard.

There is also `export const fetchCache = '...'` to change the default for every `fetch` in a route. It is an advanced option; if you meet it, check the [Next.js docs](https://nextjs.org/docs/app/guides/caching-without-cache-components) for its exact values.

### generateStaticParams and dynamicParams

`generateStaticParams` works as in [Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params), with two differences:

- Returning an empty array `[]` is allowed, and means "build none now, build each on its first visit".
- `export const dynamicParams = false` makes every id that was not listed a 404.

## Reading the build output

The route table uses different symbols in the previous model. Here is a real build of a small project without Cache Components, where `/books` exports `revalidate = 3600`, `/books/[id]` lists two ids with `generateStaticParams` and exports `revalidate = 86400`, `/cart` reads a cookie, and `/force` exports `dynamic = 'force-dynamic'`:

```text
Route (app)              Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ○ /books                       1h      1y
├   /books/[id]
│ ├ ● /books/the-hobbit          1d      1y
│ └ ● /books/dune                1d      1y
├ ƒ /cart
└ ƒ /force


○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand
```

Notice what is missing: there is no ◐. Reading one cookie made all of `/cart` dynamic (ƒ), not just a part of it. And `●` (SSG, "static site generation") marks pages prerendered from `generateStaticParams`.

## Refreshing on demand

`revalidateTag` and `revalidatePath` work in both models, from Server Actions and Route Handlers:

```javascript
// app/admin/actions.js
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

export async function addBook(formData) {
  // ...save the book
  revalidateTag('books', 'max'); // data tagged with fetch next.tags or unstable_cache tags
  revalidatePath('/books'); // the /books page
}
```

`updateTag`, which you met in [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation), also works in the previous model inside Server Actions.

## Old option, new equivalent

If the team decides to switch on Cache Components, each old option has a new home:

| Previous model | With Cache Components |
| --- | --- |
| `fetch(url, { cache: 'force-cache' })` | put the fetch inside a `'use cache'` function |
| `fetch(url, { next: { revalidate: 3600 } })` | `cacheLife('hours')` in that function |
| `fetch(url, { next: { tags: ['books'] } })` | `cacheTag('books')` in that function |
| `unstable_cache(fn, keys, options)` | a `'use cache'` function (may stay as it is for now) |
| `export const revalidate = 3600` | `'use cache'` + `cacheLife('hours')` on the data or page |
| `export const revalidate = 0` | remove it: uncached data already runs per request |
| `export const dynamic = 'force-dynamic'` | remove it; put request-time parts inside `<Suspense>` |
| `export const dynamic = 'force-static'` | remove it; cache data with `'use cache'`; optionally `ensureStatic` |
| `export const dynamicParams = false` | remove it; call `notFound()` for unknown ids |
| `generateStaticParams` returning `[]` | return at least one real param |
| `unstable_noStore()` | remove it, or use `await connection()` |
| `experimental.ppr` / `experimental_ppr` | remove it: PPR comes with Cache Components |

Two notes about the move:

- The old Data Cache and `unstable_cache` keep entries across deployments. `'use cache'` starts fresh with each deployment, and by default keeps runtime entries in server memory.
- Keeping an old option after switching fails the build. For example, a real build with `export const revalidate = 60` left in a page stops with:

```text
Error: Route segment config "revalidate" is not compatible with `nextConfig.cacheComponents`. Please remove it.
```

## Common mistakes

### Copying old examples into a Cache Components project

Many tutorials online were written for the previous model. If a snippet uses `export const revalidate`, `dynamic` or `fetchCache`, translate it with the table above before pasting it into Book Nook.

### Expecting fetch to be cached by default

Next.js 13 and 14 cached `fetch` by default; Next.js 15 and later do not. Older projects that upgraded may suddenly hit their APIs much more often. Add `cache: 'force-cache'` or `next: { revalidate }` where caching is wanted.

### Writing revalidate as a calculation

```javascript
export const revalidate = 60 * 60; // not allowed
export const revalidate = 3600; // correct
```

The value must be a plain number that Next.js can read without running the file.

### Thinking one cookie read only affects one component

In the previous model it makes the whole route dynamic. If a page suddenly shows ƒ in the build, look for `cookies()`, `headers()`, `searchParams` or a `no-store` fetch somewhere in its layouts and components.

## Quick recap

- This model applies only when `cacheComponents` is not `true`.
- Caching is per route: one request-specific read makes the whole page dynamic (ƒ).
- `fetch` is uncached by default; opt in with `cache: 'force-cache'`, `next.revalidate` and `next.tags`.
- `unstable_cache` caches non-fetch functions with key parts, tags and a lifetime.
- Route segment config: `revalidate` (seconds, plain number), `dynamic`, `fetchCache`, `dynamicParams`.
- Build symbols: ○ static, ● SSG from `generateStaticParams`, ƒ dynamic. No ◐.
- Each old option maps to `'use cache'`, `cacheLife`, `cacheTag`, `<Suspense>` or `notFound()` in the new model.

<code id="code-content" class="language-jsx">
// app/books/page.js: the PREVIOUS caching model (cacheComponents is NOT enabled)
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
// --- Route segment config: rebuild this page at most once an hour (ISR)
export const revalidate = 3600; // plain number of seconds, no calculations
// --- Cache a database query (non-fetch data) with key parts, tags and a lifetime
const getBooks = unstable_cache(
  async () =&gt; db.query('SELECT * FROM books ORDER BY title'),
  ['books'],
  { tags: ['books'], revalidate: 3600 },
);
export default async function BooksPage() {
  const books = await getBooks();
  // --- Cache a fetch for a day and tag it
  const res = await fetch('https://api.example.com/bestsellers', {
    next: { revalidate: 86400, tags: ['bestsellers'] },
  });
  const bestsellers = await res.json();
  return (
    &lt;main&gt;
      &lt;h1&gt;All books&lt;/h1&gt;
      &lt;ul&gt;{books.map((b) =&gt; &lt;li key={b.id}&gt;{b.title}&lt;/li&gt;)}&lt;/ul&gt;
      &lt;p&gt;{bestsellers.length} bestsellers this week&lt;/p&gt;
    &lt;/main&gt;
  );
}
// --- With Cache Components, this becomes a 'use cache' function with
// --- cacheLife('hours') and cacheTag('books'), and the revalidate export is removed.
</code></pre>

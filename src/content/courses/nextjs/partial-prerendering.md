---
publishDate: 2026-10-25T13:32
title: "Partial Prerendering: Static Shells with Dynamic Parts"
slug: partial-prerendering
metadescription: See how Partial Prerendering serves a static shell instantly and streams dynamic parts, with real HTML and headers from a Book Nook build.
updateDate: 2026-10-25T13:32
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'ppr', 'streaming', 'cache-components']
course: nextjs
---

## What you will learn

Over the last four lessons you collected the pieces:

- static UI that is ready at build time ([Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering))
- cached data with `'use cache'` and `cacheLife` ([Caching with Cache Components and use cache](/courses/nextjs/use-cache))
- prerendered dynamic routes ([Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params))
- request-time parts behind `<Suspense>`

**Partial Prerendering** (PPR) is the name for what happens when all of these live on one page: Next.js prerenders a **static shell** and leaves **holes** that are filled at request time, all in a single response. In this lesson you will build Book Nook's book page in that style, look at the real HTML and headers it produces, and learn how to make the shell as useful as possible.

## You are already using it

In Next.js 14 and 15, PPR was an experiment you switched on with `experimental.ppr` or `export const experimental_ppr = true`. Both are **gone** in Next.js 16. PPR is now simply how pages render when `cacheComponents: true` is set, as it is in Book Nook. Every ◐ in your route table is a partially prerendered page.

If you find `experimental_ppr` in an old project, delete it.

## The plan for the book page

A book page has parts with very different needs:

```text
/books/dune
├── Header and navigation      static        (same for everyone, never changes)
├── Title, author, description cached        (same for everyone, changes rarely)
├── "In your cart?" status     dynamic       (depends on this visitor's cookie)
└── Reviews                    cached        (same for everyone, refreshed by tag)
```

The goal is to get everything except the cart status into the static shell, and give the cart status a small fallback of its own.

## Step 1: build the page

```jsx
// app/books/[id]/page.js
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books';
import { getReviews } from '@/lib/reviews';

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

// Cached: getBook uses 'use cache'
async function BookDetails({ id }) {
  const book = await getBook(id);
  if (!book) notFound();
  return (
    <section>
      <h1 className="text-3xl font-bold">{book.title}</h1>
      <p className="text-zinc-600">by {book.author}</p>
    </section>
  );
}

// Cached: getReviews uses 'use cache' and cacheTag(`reviews-${id}`)
async function Reviews({ id }) {
  const reviews = await getReviews(id);
  return (
    <ul>
      {reviews.map((review) => (
        <li key={review.id}>{review.text}</li>
      ))}
    </ul>
  );
}

// Dynamic: reads this visitor's cookie
async function CartStatus({ id }) {
  const cart = (await cookies()).get('cart')?.value.split(',') ?? [];
  return <p>{cart.includes(id) ? 'In your cart' : 'Not in your cart yet'}</p>;
}

export default async function BookPage({ params }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-2xl p-8">
      <BookDetails id={id} />
      <Suspense fallback={<p>Checking your cart...</p>}>
        <CartStatus id={id} />
      </Suspense>
      <h2 className="mt-8 text-xl font-semibold">Reviews</h2>
      <Reviews id={id} />
    </main>
  );
}
```

Plus a `loading.js` in the same folder that shows `Loading book...`, for ids that were not prerendered.

Notice where the `<Suspense>` boundary sits: tightly around `CartStatus` only. `BookDetails` and `Reviews` are outside it, because cached data does not need a fallback when it is ready at build time.

## Step 2: read the build output

This is the real route table for that page, built with two books listed (other routes trimmed):

```text
Route (app)              Revalidate  Expire
├   /books/[id]
│ ├ ◐ /books/[id]
│ ├ ◐ /books/the-hobbit          1d      1w
│ └ ◐ /books/dune                1d      1w
```

In the previous lesson these rows were ○. Now they are ◐, because each page has one dynamic hole: the cart status. Everything else on the page was still prerendered, which is the point of PPR. The `1d` and `1w` show the shortest cache lifetime used on the page.

## Step 3: look at what the browser receives

We started the app with `npm run start` and requested `/books/dune`. Here is the `<body>` of the HTML, tidied up (scripts removed, line breaks added) so it is readable:

```html
<main>
  <section><h1>Dune</h1><p>by Frank Herbert</p></section>
  <!--$?--><template id="B:0"></template><p>Checking your cart...</p><!--/$-->
  <h2>Reviews</h2>
  <ul><li>The best science fiction I have read.</li></ul>
</main>
<!-- ...later in the same response... -->
<div hidden id="S:0"><p>Not in your cart yet</p></div>
<script>/* a tiny React script swaps S:0 into the B:0 spot */</script>
```

Read it from top to bottom, the way the browser does:

1. The title, author and reviews arrive as finished HTML. That part was prerendered.
2. Where the cart status belongs, there is the fallback, `Checking your cart...`, plus an invisible marker `B:0`.
3. Further down the **same response**, the server streams the real cart status inside a hidden `div` with id `S:0`, as soon as it has read the cookie.
4. A small script moves it into place and removes the fallback.

There is no second request from the browser. The shell is sent first, and the dynamic part follows on the same connection. That is what "server-streamed content" in the route table legend means.

The response headers show the difference between page types. A fully static page (○) is served from the cache and may be stored by a CDN:

```http
x-nextjs-cache: HIT
Cache-Control: s-maxage=86400, stale-while-revalidate=518400
```

A partially prerendered page (◐) is marked as "postponed" (it has holes to fill) and is not stored by shared caches, because the streamed part belongs to one visitor:

```http
x-nextjs-postponed: 1
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

## Make the shell as useful as possible

PPR rewards one habit above all: **do request-time work as deep in the tree as you can**. Every `await` on runtime data near the top of a page or layout drags everything below it out of the shell.

### Push reads into small components

```jsx
// Before: the whole layout waits for the cookie
export default async function ShopLayout({ children }) {
  const cart = (await cookies()).get('cart')?.value;
  return (
    <>
      <Header cartCount={cart ? cart.split(',').length : 0} />
      {children}
    </>
  );
}
```

```jsx
// After: only the cart badge waits
export default function ShopLayout({ children }) {
  return (
    <>
      <Header
        cartBadge={
          <Suspense fallback={<span>Cart</span>}>
            <CartBadge />
          </Suspense>
        }
      />
      {children}
    </>
  );
}
```

### Pass params down instead of awaiting at the top

For routes **without** `generateStaticParams` (or for ids not listed), `params` is runtime data. If a layout awaits it at the top, the layout cannot be in the shell. Pass the promise down and await it inside a boundary instead. For a small piece, you can even resolve it inline with `.then()`:

```jsx
// app/genres/[genre]/layout.js
import { Suspense } from 'react';

// Not async: this layout never awaits params itself
export default function GenreLayout({ children, params }) {
  return (
    <div>
      <nav>All genres</nav>
      <Suspense fallback={<h1>Loading genre...</h1>}>
        {params.then(({ genre }) => (
          <h1 className="text-2xl capitalize">{genre}</h1>
        ))}
      </Suspense>
      {children}
    </div>
  );
}
```

The navigation and `children` stay in the shell; only the heading waits.

### Prefer several small boundaries to one big one

One `loading.js` for a whole route is fine to start with, but it replaces the entire page with one spinner. Separate boundaries let each region appear on its own, and let static regions skip the wait entirely:

```jsx
<main>
  <h1>Your account</h1>
  <Suspense fallback={<OrdersSkeleton />}>
    <RecentOrders />
  </Suspense>
  <Suspense fallback={<WishlistSkeleton />}>
    <Wishlist />
  </Suspense>
</main>
```

Make each fallback roughly the same size as the content it stands in for, so the page does not jump when the real content arrives.

### Cache what can be shared

Before reaching for `<Suspense>`, ask whether the data is really per request. A list of genres, a book description, a bestseller list: these are the same for everyone, so `'use cache'` moves them into the shell, which is better than a fallback.

## Keeping a page fully static

Sometimes you want the opposite guarantee: "this page must never get a dynamic hole". Next.js 16.4 added a page option for that, `ensureStatic`:

```jsx
// app/about/page.js
export const ensureStatic = 'navigation';

export default function AboutPage() {
  return <h1>About Book Nook</h1>;
}
```

If someone later adds a `cookies()` call or an uncached query to this page, the build fails instead of quietly turning ○ into ◐. You will not need it often, but it is a good safety net for marketing or help pages.

## Things to know about hosting

- PPR needs **streaming**. `next start` on your own Node.js server supports it, and so does Vercel. See [Self-Hosting with Node.js and Docker](/courses/nextjs/self-hosting) and [Deploying to Vercel](/courses/nextjs/deploying-to-vercel).
- A **static export** (plain HTML files with no server) cannot fill holes at request time, so request-time parts and `'use cache'` do not work there. See [Static Exports for Any Web Host](/courses/nextjs/static-exports).
- Some search engine bots and link previewers cannot handle streamed content. Next.js detects them and renders the whole page at request time for them, so they see complete HTML.

## Common mistakes

### One Suspense around the whole page

It builds, but the shell is just a spinner, so you lose most of the benefit. Move static and cached parts outside the boundary.

### Awaiting cookies in the root layout

The root layout wraps every page. An `await cookies()` at its top makes every route lose its shell. Push the read into a small component behind `<Suspense>`.

### Expecting the ◐ page to be cached by a CDN

The shell itself is prerendered, but the full response contains per-visitor parts, so it is sent with `Cache-Control: private, no-store`. If a page must be served entirely from a CDN, remove its dynamic parts (and consider `ensureStatic`).

### Looking for experimental_ppr

It was removed in Next.js 16. If an old tutorial tells you to add it, skip that step: `cacheComponents: true` already gives you PPR.

## Quick recap

- Partial Prerendering = a prerendered static shell plus dynamic holes, sent in one streamed response.
- It is the default with Cache Components; `experimental.ppr` and `experimental_ppr` no longer exist.
- Static UI and cached data go in the shell; runtime reads go inside small `<Suspense>` boundaries.
- In the HTML, fallbacks appear first and the real content streams in later in the same response.
- Static pages are served as `x-nextjs-cache: HIT`; ◐ pages are `x-nextjs-postponed: 1` and private.
- Push `await` calls deep, pass `params` promises down, and prefer several small boundaries.
- `export const ensureStatic = 'navigation'` makes the build fail if a page stops being fully static.

<code id="code-content" class="language-jsx">
// app/books/[id]/page.js: static shell + cached parts + one dynamic hole
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books'; // 'use cache' inside
import { getReviews } from '@/lib/reviews'; // 'use cache' + cacheTag inside
// --- Prerender the known books (unknown ids get loading.js, then ISR)
export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) =&gt; ({ id: book.id }));
}
// --- Cached: part of the static shell
async function BookDetails({ id }) {
  const book = await getBook(id);
  if (!book) notFound();
  return (
    &lt;section&gt;
      &lt;h1 className="text-3xl font-bold"&gt;{book.title}&lt;/h1&gt;
      &lt;p className="text-zinc-600"&gt;by {book.author}&lt;/p&gt;
    &lt;/section&gt;
  );
}
// --- Cached: part of the static shell, refreshed with updateTag(`reviews-${id}`)
async function Reviews({ id }) {
  const reviews = await getReviews(id);
  return &lt;ul&gt;{reviews.map((r) =&gt; &lt;li key={r.id}&gt;{r.text}&lt;/li&gt;)}&lt;/ul&gt;;
}
// --- Dynamic: reads this visitor's cookie, streamed in at request time
async function CartStatus({ id }) {
  const cart = (await cookies()).get('cart')?.value.split(',') ?? [];
  return &lt;p&gt;{cart.includes(id) ? 'In your cart' : 'Not in your cart yet'}&lt;/p&gt;;
}
// --- The page: only the cart status has a fallback
export default async function BookPage({ params }) {
  const { id } = await params;
  return (
    &lt;main className="mx-auto max-w-2xl p-8"&gt;
      &lt;BookDetails id={id} /&gt;
      &lt;Suspense fallback={&lt;p&gt;Checking your cart...&lt;/p&gt;}&gt;
        &lt;CartStatus id={id} /&gt;
      &lt;/Suspense&gt;
      &lt;h2 className="mt-8 text-xl font-semibold"&gt;Reviews&lt;/h2&gt;
      &lt;Reviews id={id} /&gt;
    &lt;/main&gt;
  );
}
</code></pre>

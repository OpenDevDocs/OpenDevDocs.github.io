---
publishDate: 2026-10-25T13:31
title: Pre-rendering Dynamic Routes with generateStaticParams
slug: generate-static-params
metadescription: Use generateStaticParams to prerender Book Nook's book pages at build time, and learn what Next.js 16 does for ids you did not list.
updateDate: 2026-10-25T13:31
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'generatestaticparams', 'dynamic-routes', 'isr']
course: nextjs
---

## What you will learn

Book Nook has one file, `app/books/[id]/page.js`, that shows every book: `/books/dune`, `/books/the-hobbit`, and so on. You built it in [Dynamic Routes and params](/courses/nextjs/dynamic-routes).

During `next build`, Next.js has a problem with this page: it does not know which ids exist. To Next.js, `params` is information that only arrives with a request, just like a cookie. So it cannot make the HTML for `/books/dune` ahead of time.

`generateStaticParams` solves that. It is a function you export from the page that returns the list of ids to build in advance. In this lesson you will:

- see why the book page fails to build without help
- prerender every book with `generateStaticParams`
- learn what happens when someone visits a book you did not list
- handle ids that do not exist

## Step 1: the problem

Here is a simple book page, with `getBook()` reading from the database:

```jsx
// app/books/[id]/page.js
import { getBook } from '@/lib/books';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">{book.title}</h1>
      <p className="text-zinc-600">by {book.author}</p>
      <p className="mt-4">{book.description}</p>
    </main>
  );
}
```

Run `npm run build` and it stops:

```text
Error: Route "/books/[id]": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.
```

You met this message in [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering). Here two things are unknown during the build: the `id`, and the database result. One fix is to stream: add a `loading.js` file next to the page. It wraps the page in `<Suspense>` for you, so its content becomes the static shell:

```jsx
// app/books/[id]/loading.js
export default function Loading() {
  return <p className="p-8">Loading book...</p>;
}
```

That builds, but every visitor now sees "Loading book..." first, and the server queries the database on every visit. For a bookshop, where book pages hardly change, we can do much better.

## Step 2: list the ids with generateStaticParams

Export a function called `generateStaticParams` from the page. It returns an **array of objects**, one per page to build. Each object has a key named after the folder, `[id]`, so the key is `id`:

```jsx
// app/books/[id]/page.js
import { getBook, getBooks } from '@/lib/books';

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  // ...same JSX as before
}
```

For Book Nook's four books this returns:

```javascript
[
  { id: 'the-hobbit' },
  { id: 'pride-and-prejudice' },
  { id: 'dune' },
  { id: 'the-little-prince' },
]
```

During the build, Next.js calls `generateStaticParams` first, then renders the page once for each object, with `params` already filled in. Values must be strings, so convert numbers with `String(...)` if your ids are numbers.

## Step 3: cache the data too

Knowing the `id` is only half the story. If `getBook()` still does an uncached database query, the build still stops on the same error, now pointing at `BookPage`. The page cannot be complete HTML while it waits for a live query.

So cache the data, as you learned in [Caching with Cache Components and use cache](/courses/nextjs/use-cache):

```javascript
// lib/books.js
import { cacheLife, cacheTag } from 'next/cache';

export async function getBook(id) {
  'use cache';
  cacheLife('days');
  cacheTag('books', `book-${id}`);
  // ...query the database
}
```

Keep the `loading.js` file from Step 1; you will see why in a moment. Now build again. This is real output from a Book Nook build with two books listed (other routes trimmed):

```text
Route (app)              Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ○ /books                       1h      1d
└   /books/[id]
  ├ ◐ /books/[id]
  ├ ○ /books/the-hobbit          1d      1w
  └ ○ /books/dune                1d      1w


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

How to read it:

- `/books/[id]` without a symbol is just a group heading.
- `○ /books/the-hobbit` and `○ /books/dune`: fully built HTML, ready before anyone visits. Fast for visitors, and no database work on the server.
- `◐ /books/[id]`: a **fallback** for any id that was not in the list. Its static shell is the "Loading book..." text from `loading.js`.

## Step 4: what happens with an id you did not list?

You do not have to list every book. A shop with 50,000 books would take ages to build. Maybe you only prerender the 100 most popular:

```jsx
// app/books/[id]/page.js
export async function generateStaticParams() {
  const books = await getBooks();
  return books.slice(0, 100).map((book) => ({ id: book.id }));
}
```

When someone opens a book that was not listed, Next.js does this:

1. It sends the fallback shell (`Loading book...`) **immediately**.
2. It renders the real page for that id on the server and streams it in.
3. It **saves** the finished page. The next visitor gets the complete HTML straight away, as if it had been built ahead of time.

This "build it on first visit, then keep it" idea is called **Incremental Static Regeneration (ISR)**. We checked it on a production server (`npm run build`, then `npm run start`) with a book that was not in the list. The first request answered with the loading shell and streamed the book in. The second request for the same URL came straight from the cache:

```http
x-nextjs-cache: HIT
Cache-Control: s-maxage=86400, stale-while-revalidate=518400
```

Those numbers match the `days` profile of `getBook`: refresh after a day, keep for up to a week.

> **Good to know:** A plain `<Link>` prefetches only the general shell of a route. If you want the browser to prefetch an unlisted book's own content before the click, use `<Link href="/books/dune" prefetch={true}>`. See [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating).

## Step 5: ids that do not exist

What about `/books/not-a-real-book`? Next.js will happily try to render it, `getBook()` returns `null`, and `book.title` crashes. Check for it and show the 404 page, as you learned in [Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects):

```jsx
// app/books/[id]/page.js
import { notFound } from 'next/navigation';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    notFound();
  }
  // ...render the book
}
```

In older Next.js code you may see `export const dynamicParams = false`, which turned every unlisted id into a 404. With Cache Components that option is not allowed, and the build fails with:

```text
Route segment config "dynamicParams" is not compatible with `nextConfig.cacheComponents`.
```

Delete it and use `notFound()` instead.

## Routes with more than one dynamic part

Imagine genre pages with books inside them: `app/genres/[genre]/[id]/page.js`. Return both keys from the deepest page:

```jsx
// app/genres/[genre]/[id]/page.js
export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ genre: book.genre, id: book.id }));
}
```

Or split the work: `app/genres/[genre]/layout.js` returns the genres, and the page's `generateStaticParams` receives each parent value and returns only the ids:

```jsx
// app/genres/[genre]/[id]/page.js
export async function generateStaticParams({ params }) {
  const books = await getBooks();
  return books
    .filter((book) => book.genre === params.genre)
    .map((book) => ({ id: book.id }));
}
```

The `params` argument here is a plain object (no `await` needed) and contains only the parent segments.

## When does generateStaticParams run?

- **`next build`**: once, before the pages of that route are built.
- **`next dev`**: when you navigate to the route, so you can test it without building.
- **ISR**: it is **not** called again when unlisted pages are generated later.

## Common mistakes

### Returning an empty array

Old tutorials return `[]` to mean "build nothing now, everything on demand". With Cache Components the build refuses:

```text
Error: When using Cache Components, all `generateStaticParams` functions must return at least one result. This is to ensure that we can perform build-time validation that there is no other dynamic accesses that would cause a runtime error.
```

Return at least one real id. Next.js uses it to check that the page can be built at all; every other id is still handled on demand.

### Listing ids but not caching the data

`generateStaticParams` only answers "which ids?". If `getBook()` is not cached, the build still fails with "encountered uncached or runtime data". Add `'use cache'` to the data function, or accept a streamed page by wrapping the data part in `<Suspense>`.

### Using the wrong key name

The keys must match the folder name exactly. For `app/books/[id]/`, return `{ id: 'dune' }`, not `{ slug: 'dune' }` or `{ bookId: 'dune' }`.

### Reading cookies only for some ids

The build only runs your page with the ids you list. If a code path that reads `cookies()` only runs for other ids, the build cannot check it, and the problem appears when a visitor hits that id. Keep runtime reads inside `<Suspense>` everywhere, not just on the paths you happen to build.

## Quick recap

- In a dynamic route, `params` is unknown during the build unless you provide values.
- `generateStaticParams` returns an array like `[{ id: 'dune' }]`; keys match the `[folder]` name and values are strings.
- Listed ids plus cached data give fully static pages (○). The route also keeps a fallback shell (◐) for other ids.
- Unlisted ids get the fallback instantly, are rendered on the server, then saved for the next visitor (ISR).
- With Cache Components, return at least one id, do not use `dynamicParams`, and call `notFound()` for ids that do not exist.

<code id="code-content" class="language-jsx">
// app/books/[id]/page.js: prerendered book pages for Book Nook
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books'; // both use 'use cache'
// --- Build these ids ahead of time (at least one is required)
export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) =&gt; ({ id: book.id })); // key matches the [id] folder
}
// --- Rendered once per listed id during the build, and on first visit for others
export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id); // cached, so its result joins the HTML
  if (!book) {
    notFound(); // unknown ids show the 404 page
  }
  return (
    &lt;main className="mx-auto max-w-2xl p-8"&gt;
      &lt;h1 className="text-3xl font-bold"&gt;{book.title}&lt;/h1&gt;
      &lt;p className="text-zinc-600"&gt;by {book.author}&lt;/p&gt;
      &lt;p className="mt-4"&gt;{book.description}&lt;/p&gt;
      &lt;p className="mt-4 font-semibold"&gt;${book.price.toFixed(2)}&lt;/p&gt;
    &lt;/main&gt;
  );
}
// --- app/books/[id]/loading.js: the fallback shell for ids that were not listed
// export default function Loading() {
//   return &lt;p className="p-8"&gt;Loading book...&lt;/p&gt;;
// }
</code></pre>

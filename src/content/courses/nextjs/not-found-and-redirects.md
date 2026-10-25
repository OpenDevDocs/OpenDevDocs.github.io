---
publishDate: 2026-10-25T13:11
title: Not Found Pages and Redirects
slug: not-found-and-redirects
metadescription: Show friendly 404 pages with notFound() and not-found.js, and send visitors elsewhere with redirect, permanentRedirect and redirects in next.config.mjs.
updateDate: 2026-10-25T13:11
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'routing', 'not-found', 'redirects']
course: nextjs
---

## What you will learn

Book Nook has a page for every book at `/books/[id]`. But what happens when someone visits `/books/harry-potter`, a book the shop does not sell? Or types a URL that does not exist at all? And what if you rename a page and old links still point at the old address?

In this lesson you will handle all of these:

- `notFound()` and `not-found.js`: show a friendly "not found" page.
- `app/not-found.js`: the 404 page for URLs that match nothing.
- `redirect()`: send the visitor to another page while your code runs.
- `permanentRedirect()`: the same, but telling browsers the move is forever.
- `redirects` in `next.config.mjs`: redirect old URLs before any page code runs.

## Two kinds of "not found"

There are two different situations, and Next.js handles them in slightly different ways:

1. **The URL matches no route.** For example `/blahblah`. There is no `app/blahblah/page.js`, so Next.js shows its 404 page by itself.
2. **The URL matches a route, but the data is missing.** For example `/books/harry-potter`. The route `app/books/[id]/page.js` matches, so your page runs. Only your code can know that this book does not exist, so your code must say so.

## Step 1: call notFound() for a missing book

Here is the book page from [Dynamic Routes and params](/courses/nextjs/dynamic-routes). Right now, if `getBook` returns `null`, the page crashes when it reads `book.title`. Import `notFound` from `next/navigation` and call it when there is no book:

```jsx
// app/books/[id]/page.js
import { notFound } from 'next/navigation';
import { getBook } from '@/lib/books';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    notFound();
  }

  return (
    <main>
      <h1>{book.title}</h1>
      <p>by {book.author}</p>
      <p>{book.description}</p>
    </main>
  );
}
```

`notFound()` works by **throwing** a special error. That stops your component right there, so the lines after it never run with a missing book. You do not need to write `return notFound()`; calling it is enough.

Book Nook has Cache Components turned on, so a page that awaits `params` for an id not known at build time needs a loading placeholder. If your project does not have one yet, add this small file next to the page:

```jsx
// app/books/[id]/loading.js
export default function Loading() {
  return <p>Loading book...</p>;
}
```

`loading.js` wraps the page in a `<Suspense>` boundary. Without it, `npm run build` stops with "Next.js encountered uncached or runtime data during prerendering". You will learn exactly how `loading.js` works in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming).

Now visit `http://localhost:3000/books/harry-potter`. Instead of a crash, you see Next.js's built-in 404 page:

```text
404
This page could not be found.
```

## Step 2: design the not-found page with not-found.js

The built-in page is plain. Make your own by adding a `not-found.js` file in the same folder:

```jsx
// app/books/[id]/not-found.js
import Link from 'next/link';

export default function BookNotFound() {
  return (
    <main>
      <h1>We could not find that book</h1>
      <p>It may have sold out, or the link may be wrong.</p>
      <Link href="/books">Browse all books</Link>
    </main>
  );
}
```

When `notFound()` runs, Next.js looks for the nearest `not-found.js`, starting in the folder of the page and walking up. It renders it inside your layouts, so the Book Nook header is still there.

A `not-found.js` component receives **no props**, so it cannot know which id was missing. Keep the message general.

### What about the status code?

Search engines care about the HTTP **status code**, a number the server sends with every page. `200` means "OK" and `404` means "not found".

Because Book Nook's book page streams (the loading placeholder is sent first), the `200` status has already gone out by the time `notFound()` runs. Next.js handles this for you: it adds a `<meta name="robots" content="noindex">` tag, which tells search engines not to list the page. For a page that does not stream, `notFound()` sends a real `404`.

## Step 3: a 404 page for the whole site

Create `app/not-found.js` at the top of the `app` folder:

```jsx
// app/not-found.js
import Link from 'next/link';

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>Sorry, there is no page at this address.</p>
      <Link href="/">Back to Book Nook</Link>
    </main>
  );
}
```

This root file does two jobs:

- It catches `notFound()` calls from any page that has no closer `not-found.js`.
- It is shown for **every URL that matches no route at all**, like `/blahblah`, with a real `404` status.

You can check the status in a terminal while the dev server runs (`curl` comes with Windows 10 and newer, macOS and most Linux systems):

```bash
curl -I http://localhost:3000/blahblah
```

```text
HTTP/1.1 404 Not Found
```

> **Note:** There is also an experimental `global-not-found.js` file for apps with several root layouts, where no single layout can wrap the 404 page. Book Nook does not need it.

## Step 4: send visitors elsewhere with redirect()

A **redirect** tells the browser "what you want is at a different address" and sends it there. The `redirect()` function from `next/navigation` does this from inside your code.

Book Nook will have an admin area at `/admin` that only logged-in staff may see. Real login comes in [Adding Login with Sessions and Cookies](/courses/nextjs/authentication). For now, fake the check with a constant:

```jsx
// app/admin/page.js
import { redirect } from 'next/navigation';

// A stand-in until the authentication lesson
const isLoggedIn = false;

export default function AdminPage() {
  if (!isLoggedIn) {
    redirect('/login');
  }

  return <h1>Admin dashboard</h1>;
}
```

Visit `/admin` and you land on `/login`. Like `notFound()`, `redirect()` **throws**, so nothing after it runs.

`redirect()` sends a **307 Temporary Redirect**. "Temporary" means: browsers and search engines should keep asking for `/admin`, because next time the answer may be different (for example, once you have logged in).

You can call `redirect()` in Server Components, Server Functions (see [Server Functions and Server Actions](/courses/nextjs/server-actions)) and Route Handlers, and while a Client Component renders. You **cannot** call it inside a click handler. In an event handler, use the router instead:

```jsx
// components/GoToCartButton.js
'use client';

import { useRouter } from 'next/navigation';

export default function GoToCartButton() {
  const router = useRouter();
  return <button onClick={() => router.push('/cart')}>Go to cart</button>;
}
```

## Step 5: permanentRedirect() for things that moved forever

Suppose an early version of Book Nook used the id `hobbit`, and you later renamed it to `the-hobbit`. Old links are still out there. This move is **permanent**, so use `permanentRedirect()`:

```jsx
// app/books/[id]/page.js
import { notFound, permanentRedirect } from 'next/navigation';
import { getBook } from '@/lib/books';

// Old ids that were renamed: old id -> new id
const renamedIds = { hobbit: 'the-hobbit' };

export default async function BookPage({ params }) {
  const { id } = await params;

  if (renamedIds[id]) {
    permanentRedirect(`/books/${renamedIds[id]}`);
  }

  const book = await getBook(id);
  if (!book) {
    notFound();
  }

  // ...render the book as before
}
```

`permanentRedirect()` uses status **308 Permanent Redirect**. Browsers may remember it and skip the old URL next time, and search engines move the old page's ranking to the new address.

Why 307 and 308 instead of the older 302 and 301? Old browsers often changed a `POST` request (like a form submit) into a `GET` when following a 302 or 301. The 307 and 308 codes promise to keep the same request method.

As with `notFound()`, if the page is already streaming, the redirect cannot change the status code any more, so Next.js redirects in the browser with a small meta tag instead. The visitor still lands on the right page. For URLs you know about in advance, the next step is a cleaner tool.

## Step 6: redirects in next.config.mjs

When a whole URL has moved, you do not need any page code at all. Add a `redirects` function to `next.config.mjs`. These redirects run **before** Next.js looks for a page, so they are fast and always send a real 307 or 308.

Book Nook used to call its book list "the shop" at `/shop`, and its book pages lived at `/store/[id]`. Keep your existing options and add `redirects`:

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      {
        source: '/shop',
        destination: '/books',
        permanent: true,
      },
      {
        source: '/store/:id',
        destination: '/books/:id',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

Each redirect is an object with three keys:

- `source`: the incoming path. `:id` is a **path parameter**: it matches one segment, like `dune`.
- `destination`: where to go. You can reuse `:id` here.
- `permanent`: `true` sends a 308, `false` sends a 307.

Any query string is carried over automatically, so `/store/dune?ref=email` goes to `/books/dune?ref=email`.

When you save `next.config.mjs`, the dev server notices and restarts itself:

```text
Found a change in next.config.mjs. Restarting the server to apply the changes...
```

Then check the redirect:

```bash
curl -I http://localhost:3000/shop
```

```text
HTTP/1.1 308 Permanent Redirect
location: /books
```

## Which tool should I use?

| Situation | Tool |
| --- | --- |
| The data for this URL does not exist | `notFound()` plus a `not-found.js` |
| The URL matches no route | `app/not-found.js` (automatic) |
| Send the visitor elsewhere for now, based on a check in your code | `redirect()` |
| A single item moved forever, and only your code knows the new address | `permanentRedirect()` |
| A known URL or URL pattern moved | `redirects` in `next.config.mjs` |
| Navigate after a click | `router.push()` from `useRouter` |

Later, [Running Code Before Requests with Proxy](/courses/nextjs/proxy) shows one more place to redirect: code that runs before every request.

## Common mistakes

### Calling redirect() inside try/catch

```jsx
try {
  redirect('/login');
} catch (error) {
  console.error(error); // catches the redirect!
}
```

`redirect()`, `permanentRedirect()` and `notFound()` all work by throwing. A `catch` block swallows that throw, so the redirect never happens. Call them **outside** the `try` block.

### Calling redirect() in an onClick handler

`redirect()` is meant for code that runs while the page is rendering on the server or in a Server Function. In a click handler, use `router.push('/cart')` from `useRouter()`.

### Forgetting the slash before a parameter

```javascript
{ source: '/store:id', destination: '/books:id', permanent: true }
```

Without a `/` before `:id`, the colon is treated as normal text, and the rule never matches the way you expect (or loops forever). Write `/store/:id`.

### Using permanent: true while you are still testing

Browsers can remember a 308 for a long time. While you are experimenting, use `permanent: false`. Switch to `true` once you are sure the move is final.

## Quick recap

- `notFound()` throws and shows the nearest `not-found.js`. Use it when a route matches but the data is missing.
- `app/not-found.js` is also the 404 page for URLs that match no route, with a real 404 status.
- `redirect()` sends a 307 (temporary). `permanentRedirect()` sends a 308 (permanent). Both throw, so call them outside `try/catch`.
- In event handlers, navigate with `useRouter().push()` instead.
- `redirects` in `next.config.mjs` move whole URLs or URL patterns before any page runs, and keep the query string.
- In a streamed page, Next.js still shows the right UI, but uses a `noindex` tag or a meta redirect because the status code was already sent.

<code id="code-content" class="language-jsx">
// app/books/[id]/page.js: one book, with a 404 for missing books and a redirect for renamed ids
import { notFound, permanentRedirect } from 'next/navigation';
import { getBook } from '@/lib/books';
// Old ids that were renamed: old id -&gt; new id
const renamedIds = { hobbit: 'the-hobbit' };
export default async function BookPage({ params }) {
  const { id } = await params;
  // Moved forever: send a 308 (or a meta redirect if the page is already streaming)
  if (renamedIds[id]) {
    permanentRedirect(`/books/${renamedIds[id]}`);
  }
  const book = await getBook(id);
  // No such book: throw, and show app/books/[id]/not-found.js
  if (!book) {
    notFound();
  }
  return (
    &lt;main&gt;
      &lt;h1&gt;{book.title}&lt;/h1&gt;
      &lt;p&gt;by {book.author}&lt;/p&gt;
      &lt;p&gt;{book.description}&lt;/p&gt;
    &lt;/main&gt;
  );
}
// --- next file: app/books/[id]/not-found.js
// import Link from 'next/link';
// export default function BookNotFound() {
//   return &lt;main&gt;&lt;h1&gt;We could not find that book&lt;/h1&gt;&lt;Link href="/books"&gt;Browse all books&lt;/Link&gt;&lt;/main&gt;;
// }
// --- next file: app/books/[id]/loading.js (needed with Cache Components)
// export default function Loading() { return &lt;p&gt;Loading book...&lt;/p&gt;; }
// --- next.config.mjs: add inside nextConfig
// async redirects() {
//   return [
//     { source: '/shop', destination: '/books', permanent: true },
//     { source: '/store/:id', destination: '/books/:id', permanent: true },
//   ];
// },
</code></pre>

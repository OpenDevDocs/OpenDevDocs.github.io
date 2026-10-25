---
publishDate: 2026-10-25T13:29
title: Caching with Cache Components and use cache
slug: use-cache
metadescription: Learn the use cache directive in Next.js 16. Cache data functions, components and whole files, understand cache keys, and avoid the common errors.
updateDate: 2026-10-25T13:29
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'use-cache', 'caching', 'cache-components']
course: nextjs
---

## What you will learn

In [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering) the build stopped on the books page and offered two good fixes: **[stream]** the data behind `<Suspense>`, or **[cache]** it. You tried streaming. Now you will learn caching.

A **cache** is a place where you keep a result so you do not have to work it out again. Book Nook's book list changes maybe a few times a day, yet without a cache every visitor makes the server ask the database again. With a cache, the server asks once, keeps the answer, and reuses it.

Back to the bakery from the last lesson: caching is like baking a batch of cakes, freezing them, and taking one out for each customer. Much faster than baking to order, as long as you throw the batch away when it gets too old.

In Next.js 16 you turn caching on for a piece of code with one line: the `"use cache"` **directive**. A directive is a special string at the top of a function or file that tells Next.js to treat that code differently. You already know `"use client"`; this one works the same way.

## Before you start

`"use cache"` only works when **Cache Components** is switched on. In Book Nook it already is. Here is the real `next.config.mjs` that `create-next-app` made:

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
};

export default nextConfig;
```

The line that matters here is `cacheComponents: true`.

## Step 1: cache a data function

Open `lib/books.js` and add two lines to the top of `getBooks()`:

```javascript
// lib/books.js
import { cacheLife } from 'next/cache';
import { db } from './db';

export async function getBooks() {
  'use cache';
  cacheLife('hours');

  // Your query from the data layer lesson. Yours may look a little different.
  return db.query('SELECT * FROM books ORDER BY title');
}
```

- `'use cache'` must be the **first statement** in the function body. It marks the function's result as cacheable.
- `cacheLife('hours')` says how long the result stays fresh. Always pair the two. If you leave `cacheLife` out, Next.js uses a `default` profile, which works but hides the decision. You will learn every option in [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation).

Now the books page can go back to its simple form, with no `<Suspense>`:

```jsx
// app/books/page.js
import { getBooks } from '@/lib/books';

export default async function BooksPage() {
  const books = await getBooks();
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">All books</h1>
      <ul>
        {books.map((book) => (
          <li key={book.id}>{book.title}</li>
        ))}
      </ul>
    </main>
  );
}
```

Run `npm run build`. The error is gone, and the route table now has extra columns (trimmed here to the pages we care about):

```text
Route (app)              Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ○ /books                       1h      1d
└ ◐ /cart
```

`/books` is now **○ fully static**. During the build, Next.js called `getBooks()`, stored the result, and baked the list into the HTML. The `1h` and `1d` columns come from the `hours` profile: the page is refreshed in the background after an hour, and thrown away after a day without visitors.

Compare the two fixes:

| | Streaming with Suspense | Caching with use cache |
| --- | --- | --- |
| When the database is asked | on every request | once, then reused until it expires |
| What the visitor sees first | a fallback, then the list | the full list straight away |
| Best for | data that must be fresh or is per visitor | data that is the same for everyone |

## Step 2: arguments become part of the cache key

Every cached result is stored under a **cache key**, like a label on a freezer bag. Next.js builds the key from:

- the function itself (which file, which function)
- the **arguments** you pass in
- any outside variables the function uses
- the build ID, so a new deployment starts with an empty cache

So this function keeps a separate entry for each book:

```javascript
// lib/books.js
export async function getBook(id) {
  'use cache';
  cacheLife('days');

  const rows = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] ?? null;
}
```

`getBook('dune')` and `getBook('the-hobbit')` are two different freezer bags. Calling `getBook('dune')` again, from any page, reuses the first bag.

## Step 3: cache a whole component

`"use cache"` also works on an `async` Server Component. The cached result is the rendered UI itself:

```jsx
// components/FeaturedBooks.js
import { cacheLife } from 'next/cache';
import { getBooks } from '@/lib/books';
import BookCard from '@/components/BookCard';

export default async function FeaturedBooks({ genre = 'classic' }) {
  'use cache';
  cacheLife('days');

  const books = await getBooks();
  const featured = books.filter((book) => book.genre === genre).slice(0, 3);

  return (
    <section>
      <h2 className="text-xl font-semibold">Featured {genre} books</h2>
      <div className="grid grid-cols-3 gap-4">
        {featured.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}
```

Props work like arguments: `<FeaturedBooks genre="fantasy" />` and `<FeaturedBooks genre="classic" />` are cached separately.

Which level should you choose?

- **Data level** (a function in `lib/`): the same data is used in many places. This is the usual choice.
- **Component level**: building the UI itself takes work (filtering, sorting, formatting), or you want one self-contained cached box.

## Step 4: cache a whole file

Put `'use cache'` at the very top of a file, and **every exported function** in it is cached:

```javascript
// lib/genres.js
'use cache';

import { cacheLife } from 'next/cache';
import { db } from './db';

export async function getGenres() {
  cacheLife('weeks');
  return db.query('SELECT DISTINCT genre FROM books');
}

export async function countBooksInGenre(genre) {
  cacheLife('days');
  return db.query('SELECT COUNT(*) FROM books WHERE genre = $1', [genre]);
}
```

Every export in such a file must be `async`. You can do the same at the top of a `page.js` or `layout.js`, but caching the data functions is usually clearer.

## The rules of a cached function

A cached function runs in a small sealed room. That keeps the results predictable, and it gives you a few rules.

### It must be async

```text
Error: "use cache" functions must be async functions.
```

Add `async` before `function`.

### It cannot read the request

Inside `"use cache"` you cannot call `cookies()`, `headers()` or read `searchParams`. A cached answer is shared by many visitors, so it must not depend on one visitor's request. Here is the real error:

```text
Error: Route "/account": `cookies()` can't be read inside `"use cache"`. Read it outside the cached function and pass what you need as an argument.
Learn more: https://nextjs.org/docs/messages/next-request-in-use-cache
```

The fix is exactly what the message says: read the value outside, then pass it in. The value becomes part of the cache key:

```jsx
// app/account/page.js
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { cacheLife } from 'next/cache';

// Cached: one entry per favourite genre, shared by everyone with that genre
async function Recommendations({ genre }) {
  'use cache';
  cacheLife('hours');
  // ...look up books in this genre
  return <p>Because you like {genre} books...</p>;
}

// Not cached: reads this visitor's cookie, then hands the value over
async function PersonalRecommendations() {
  const genre = (await cookies()).get('favourite-genre')?.value ?? 'classic';
  return <Recommendations genre={genre} />;
}

export default function AccountPage() {
  return (
    <main>
      <h1>Your account</h1>
      <Suspense fallback={<p>Finding books for you...</p>}>
        <PersonalRecommendations />
      </Suspense>
    </main>
  );
}
```

Pass the **value** (the genre string), never the promise from `cookies()` itself. A promise that waits on the request can never finish during the build, and the build stops after 50 seconds with an error that says "Filling a cache during prerender timed out".

### Inputs and outputs must be serializable

Arguments and return values are stored, so they must be things that can be turned into data: strings, numbers, booleans, `null`, plain objects, arrays, `Date`, `Map`, `Set`. Cached components may also return JSX. Class instances, functions and symbols do not work as inputs.

There is one useful exception: you may **pass through** things you do not look at, like `children`:

```jsx
// components/CachedFrame.js
export default async function CachedFrame({ children }) {
  'use cache';
  cacheLife('days');
  return (
    <div className="rounded border p-4">
      <p className="text-sm text-zinc-500">Book Nook recommends</p>
      {children}
    </div>
  );
}
```

The frame is cached, while whatever you put inside it can still be dynamic.

## Where does the cached result live?

A cached result can be kept in several places:

- **In the static HTML** made at build time, as you saw with `/books`.
- **In the server's memory** at run time, for results first made after the build. On your own server this memory survives between requests. On serverless hosting each request may land on a fresh machine, so the memory is often empty. For that case Next.js has `"use cache: remote"`, which stores results in a shared cache service your platform provides.
- **In the browser** for a short time, so moving between pages feels instant.

Every new deployment starts with a fresh cache, because the build ID is part of every key.

> **Good to know:** There is also `"use cache: private"`, for rare cases where a result must be cached per visitor and may read cookies directly. Start with plain `"use cache"`; it covers most needs.

## Seeing the cache work

In `npm run dev`, `console.log` calls inside a cached function show up in the terminal with a `Cache` label when the result is replayed from the cache. During `npm run build` we added `console.log('getBooks ran')` to `getBooks()`. The build needed the book list in two places, but the function body ran only once:

```text
getBooks ran
```

That is the cache saving you a database trip.

## use cache or React cache()?

You may have seen `cache()` from React in [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database). They solve different problems:

- **React `cache()`** removes duplicate calls **within one request**, then forgets everything.
- **`"use cache"`** keeps results **across requests** and visitors, until they expire or you clear them.

You can use both in the same project.

## Common mistakes

### Forgetting cacheLife

The code works, but the lifetime comes silently from the `default` profile (refresh after 15 minutes). Always write a `cacheLife(...)` call next to `'use cache'` so anyone reading the code knows the plan.

### Caching per-visitor data

If a cached function returns something personal (like "Hello, Asha"), every visitor could see Asha's greeting. Only cache things that are the same for everyone with the same inputs, and pass the personal value in as an argument.

### Putting the directive in the wrong place

`'use cache'` must be the first line inside the function (or the first line of the file). After any other statement it is just a string and does nothing.

### Expecting it to work without Cache Components

`"use cache"`, `cacheLife` and `cacheTag` need `cacheComponents: true` in `next.config.mjs`. Older projects use a different system; see [Caching in Projects Without Cache Components](/courses/nextjs/caching-without-cache-components).

## Quick recap

- `'use cache'` at the top of an `async` function, component or file caches its result.
- Pair it with `cacheLife(...)` to choose how long the result stays fresh.
- The cache key is built from the function, its arguments and captured values, and the build ID.
- Cached code cannot read `cookies()`, `headers()` or `searchParams`. Read them outside and pass plain values in.
- Inputs and outputs must be serializable; `children` can pass through untouched.
- Cached data can join the static shell, turning a ◐ page into a ○ page.
- Next up: choose lifetimes and clear the cache on demand in [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation).

<code id="code-content" class="language-javascript">
// lib/books.js: Book Nook's data layer with "use cache"
import { cacheLife } from 'next/cache';
import { db } from './db'; // your database helper from the data layer lesson
// --- The whole catalogue: the same for every visitor, changes a few times a day
export async function getBooks() {
  'use cache'; // must be the first statement in the function
  cacheLife('hours'); // fresh for about an hour
  return db.query('SELECT * FROM books ORDER BY title');
}
// --- One book: the id is part of the cache key, so each book has its own entry
export async function getBook(id) {
  'use cache';
  cacheLife('days');
  const rows = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] ?? null;
}
// --- Search: different for every query, so it is NOT cached
export async function searchBooks(query) {
  const q = `%${query.toLowerCase()}%`;
  return db.query('SELECT * FROM books WHERE lower(title) LIKE $1 OR lower(author) LIKE $1', [q]);
}
// --- In a page: no Suspense needed, the result joins the static shell
// const books = await getBooks();
</code></pre>

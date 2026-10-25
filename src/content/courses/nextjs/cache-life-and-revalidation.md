---
publishDate: 2026-10-25T13:30
title: Cache Lifetimes, Tags and Revalidation
slug: cache-life-and-revalidation
metadescription: Control how long cached data lives with cacheLife, label it with cacheTag, and refresh it on demand with updateTag, revalidateTag, revalidatePath and refresh.
updateDate: 2026-10-25T13:30
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'cachelife', 'cachetag', 'revalidation']
course: nextjs
---

## What you will learn

In [Caching with Cache Components and use cache](/courses/nextjs/use-cache) you cached Book Nook's book list with `'use cache'` and `cacheLife('hours')`. Caching raises two new questions:

1. **How long** should a cached result be trusted?
2. When the data really changes (a price drops, a new book arrives), **how do you throw the old result away** right now instead of waiting?

The answer to the first is `cacheLife`. The answer to the second is **revalidation**: telling Next.js that cached data is out of date so it makes a fresh copy. You will use `cacheTag` to label cached data, and `updateTag`, `revalidateTag`, `revalidatePath` and `refresh` to refresh it.

## The three numbers in a cache lifetime

Think of a carton of milk in a shop fridge. It has more than one date on it, in a way:

- How long the customer at home keeps using it without checking. That is **`stale`**.
- When the shop starts putting a fresh carton out the back, while still selling the old one. That is **`revalidate`**.
- When the old carton must go in the bin, no matter what. That is **`expire`**.

In Next.js terms:

- **`stale`**: how long the **browser** reuses a cached page without asking the server. Next.js never uses less than 30 seconds here, so prefetched links stay useful.
- **`revalidate`**: after this time, the next request still gets the cached copy **immediately**, and the server makes a fresh copy **in the background** for the people after it. This trick is called **stale-while-revalidate**.
- **`expire`**: if nobody visits for this long, the old copy is thrown away. The next visitor waits while a fresh copy is made.

So with `cacheLife('hours')` (revalidate 1 hour, expire 1 day): a visitor 2 hours after the build gets the old list instantly and triggers a refresh; the visitor after that gets the new list. If the page had no visitors for a whole day, the next visitor waits a moment for a fresh one.

## The built-in profiles

`cacheLife` accepts a profile name. These are the built-in ones:

| Profile | `stale` | `revalidate` | `expire` | Good for |
| --- | --- | --- | --- | --- |
| `default` | 5 min | 15 min | never | used when you call no `cacheLife` |
| `seconds` | 30 s | 1 s | 1 min | near real-time data |
| `minutes` | 5 min | 1 min | 1 hour | feeds, stock levels |
| `hours` | 5 min | 1 hour | 1 day | the book catalogue |
| `days` | 5 min | 1 day | 1 week | book details, articles |
| `weeks` | 5 min | 1 week | 30 days | newsletters |
| `max` | 5 min | 30 days | 1 year | pages that almost never change |

Here is how Book Nook might choose:

```javascript
// lib/books.js
import { cacheLife } from 'next/cache';

export async function getBooks() {
  'use cache';
  cacheLife('hours'); // new books arrive during the day
  // ...query the database
}

export async function getBook(id) {
  'use cache';
  cacheLife('days'); // a book's description rarely changes
  // ...query the database
}
```

The build shows each page's shortest lifetimes in the route table:

```text
Route (app)              Revalidate  Expire
├ ○ /books                       1h      1d
├   /books/[id]
│ ├ ◐ /books/[id]
│ ├ ○ /books/the-hobbit          1d      1w
│ └ ○ /books/dune                1d      1w
```

## Your own lifetimes

If no profile fits, pass an object with numbers in **seconds**:

```javascript
// lib/books.js
export async function getBestsellers() {
  'use cache';
  cacheLife({
    stale: 300, // browser reuses it for 5 minutes
    revalidate: 1800, // refresh in the background after 30 minutes
    expire: 86400, // throw away after a day without visitors
  });
  // ...query the database
}
```

Any number you leave out is taken from the `default` profile. `expire` must be longer than `revalidate`, or Next.js reports an error.

If you use the same numbers in many places, give them a name in `next.config.mjs`:

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    catalogue: {
      stale: 300, // 5 minutes
      revalidate: 1800, // 30 minutes
      expire: 86400, // 1 day
    },
  },
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

Then use it like a built-in profile: `cacheLife('catalogue')`.

## Very short lifetimes become dynamic holes

A cache that lives only a few seconds is not worth baking into the static shell: it would be out of date before anyone saw it. So results with a `revalidate` of 0, or an `expire` under 5 minutes, are **left out of the prerender** and fetched at request time. Of the built-in profiles, only `seconds` does this.

That means a `seconds` cache behaves like uncached data, and it needs `<Suspense>`. Without it, a real build of a "today's deals" page fails with the familiar message:

```text
Error: Route "/deals": Next.js encountered uncached or runtime data during prerendering.
```

Wrap it, and the page becomes ◐ with a static shell:

```jsx
// app/deals/page.js
import { Suspense } from 'react';
import { getDeals } from '@/lib/books'; // uses cacheLife('seconds')

async function Deals() {
  const deals = await getDeals();
  return (
    <ul>
      {deals.map((book) => (
        <li key={book.id}>{book.title}: now ${book.price}</li>
      ))}
    </ul>
  );
}

export default function DealsPage() {
  return (
    <main>
      <h1>Today&apos;s deals</h1>
      <Suspense fallback={<p>Loading deals...</p>}>
        <Deals />
      </Suspense>
    </main>
  );
}
```

> **Good to know:** If a cached component uses another cached function inside it, the outer one keeps its own `cacheLife` when you set one. If you set none, a shorter inner lifetime can shorten the outer one. One more reason to always write `cacheLife` explicitly.

## Label cached data with cacheTag

Time-based refreshing is fine for "new books arrive sometime today". But when an admin changes the price of Dune, waiting a whole day for `getBook('dune')` to refresh is not acceptable.

First, label the cached data with **tags**. A tag is just a string you choose:

```javascript
// lib/books.js
import { cacheLife, cacheTag } from 'next/cache';

export async function getBooks() {
  'use cache';
  cacheLife('hours');
  cacheTag('books');
  // ...query the database
}

export async function getBook(id) {
  'use cache';
  cacheLife('days');
  cacheTag('books', `book-${id}`);
  // ...query the database
}
```

`getBook('dune')` now carries two labels: `books` (everything about books) and `book-dune` (just this book). Tags are case-sensitive, and one result can have many tags.

## Four ways to refresh on demand

Next.js gives you four tools. They all come from `next/cache`:

| Tool | Where you can call it | What happens next |
| --- | --- | --- |
| `updateTag(tag)` | Server Actions only | Tagged data expires now. The next read waits for fresh data. |
| `revalidateTag(tag, 'max')` | Server Actions and Route Handlers | Tagged data is marked old. The next read gets the old copy while a fresh one is made in the background. |
| `revalidatePath(path)` | Server Actions and Route Handlers | Everything cached for that page path is refreshed on its next visit. |
| `refresh()` | Server Actions only | Re-renders the current page for the user, without clearing any cache. |

### updateTag: the user should see their own change

An admin edits a price. They expect to see the new price immediately. This is called **read-your-own-writes**, and it is what `updateTag` is for. It works only inside a **Server Action**, a function that runs on the server when a form is submitted. You will learn Server Actions properly in [Server Functions and Server Actions](/courses/nextjs/server-actions); here is a sneak peek:

```javascript
// app/admin/actions.js
'use server';

import { updateTag } from 'next/cache';
import { db } from '@/lib/db';

export async function updatePrice(bookId, formData) {
  // (check that the user is an admin first: see the authorization lesson)
  const price = Number(formData.get('price'));
  await db.query('UPDATE books SET price = $1 WHERE id = $2', [price, bookId]);

  updateTag(`book-${bookId}`); // this book's page
  updateTag('books'); // lists that show the price
}
```

### revalidateTag: a webhook from outside

Say Book Nook's stock comes from a supplier's system, and the supplier can call a URL on your site whenever its catalogue changes. That kind of "call me when something happens" URL is a **webhook**. It is a [Route Handler](/courses/nextjs/route-handlers), not a Server Action, so `updateTag` is not allowed there. Use `revalidateTag` with the `'max'` profile:

```javascript
// app/api/revalidate/route.js
import { revalidateTag } from 'next/cache';

export async function POST(request) {
  // Only the supplier knows this secret (see the environment variables lesson)
  const secret = request.headers.get('x-webhook-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ message: 'Invalid secret' }, { status: 401 });
  }

  revalidateTag('books', 'max');
  return Response.json({ revalidated: true });
}
```

The second argument says how long the old copy may still be served while the fresh one is made. `'max'` means "always serve the old copy instantly and refresh in the background", which is what Next.js recommends. Calling `revalidateTag('books')` with only one argument is the old form and is deprecated, so always pass the profile. Store `REVALIDATE_SECRET` as explained in [Environment Variables](/courses/nextjs/environment-variables).

### revalidatePath: refresh one page

When you do not know which tags a page uses, refresh it by its path:

```javascript
import { revalidatePath } from 'next/cache';

revalidatePath('/books'); // one page
revalidatePath('/books/[id]', 'page'); // every book page
revalidatePath('/', 'layout'); // everything in the app
```

Use the file path pattern (with `[id]`) plus `'page'` or `'layout'` to cover many URLs. Tags are usually more precise, because a tag refreshes the data on **every** page that uses it, while `revalidatePath('/books')` leaves other pages with the same data untouched.

### refresh: just redraw the page

`refresh()` reloads the current page's server components for the user who ran the action, without clearing any cached data. It is handy when the action changed something that is not cached at all.

## Choosing the right tool

- A user changed something and must see it now: **`updateTag`** in the Server Action.
- Something outside your app changed, or a short delay is fine: **`revalidateTag(tag, 'max')`**.
- You only know the URL that is affected: **`revalidatePath`**.
- Nothing cached changed, you just want a redraw: **`refresh`**.

And for data that changes on a schedule, you need no code at all: a sensible `cacheLife` does the work.

A common, powerful combination: give rarely changing data a long life (`cacheLife('max')`) plus a tag, and refresh the tag whenever the data changes. The page stays static nearly all the time, yet is never out of date for long.

## Common mistakes

### Calling updateTag in a Route Handler

`updateTag` only works inside Server Actions. In a Route Handler the request fails, and the server terminal shows:

```text
⨯ Error: updateTag can only be called from within a Server Action. To invalidate cache tags in Route Handlers or other contexts, use revalidateTag instead. See more info here: https://nextjs.org/docs/app/api-reference/functions/updateTag
```

Use `revalidateTag(tag, 'max')` there instead (or `revalidateTag(tag, { expire: 0 })` if the old data must disappear immediately).

### Forgetting to tag the function

`updateTag('books')` only affects cached results that called `cacheTag('books')`. If nothing changes after your action, check that the cached function really sets that tag, with exactly the same spelling and case.

### Code after redirect never runs

In a Server Action, `redirect()` stops the function. Call `updateTag` or `revalidatePath` **before** `redirect`, or the destination page shows old data.

### Expecting revalidateTag to update the page instantly

With `'max'`, the first request after the call still gets the old copy, by design. If the person who made the change must see it straight away, use `updateTag` in a Server Action.

## Quick recap

- `cacheLife` sets three times: `stale` (browser), `revalidate` (background refresh), `expire` (hard limit).
- Built-in profiles go from `seconds` to `max`; you can pass your own object or name a profile in `next.config.mjs`.
- Lifetimes under about 5 minutes (like `seconds`) are not prerendered and need `<Suspense>`.
- `cacheTag('books', 'book-dune')` labels cached results so you can refresh them by name.
- `updateTag` (Server Actions only) shows the change immediately; `revalidateTag(tag, 'max')` refreshes in the background and also works in Route Handlers.
- `revalidatePath` refreshes by URL; `refresh` redraws without clearing caches.

<code id="code-content" class="language-javascript">
// lib/books.js: cached, tagged data for Book Nook
import { cacheLife, cacheTag } from 'next/cache';
import { db } from './db'; // your database helper from the data layer lesson
// --- Catalogue: refresh in the background every hour, tag "books"
export async function getBooks() {
  'use cache';
  cacheLife('hours');
  cacheTag('books');
  return db.query('SELECT * FROM books ORDER BY title');
}
// --- One book: two tags, one for all books and one for just this book
export async function getBook(id) {
  'use cache';
  cacheLife('days');
  cacheTag('books', `book-${id}`);
  const rows = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] ?? null;
}
// --- app/admin/actions.js (Server Action): the admin sees the change at once
// 'use server';
// import { updateTag } from 'next/cache';
// export async function updatePrice(bookId, formData) {
//   await db.query('UPDATE books SET price = $1 WHERE id = $2', [Number(formData.get('price')), bookId]);
//   updateTag(`book-${bookId}`);
//   updateTag('books');
// }
// --- app/api/revalidate/route.js (webhook): background refresh
// import { revalidateTag } from 'next/cache';
// export async function POST(request) {
//   if (request.headers.get('x-webhook-secret') !== process.env.REVALIDATE_SECRET) {
//     return Response.json({ message: 'Invalid secret' }, { status: 401 });
//   }
//   revalidateTag('books', 'max');
//   return Response.json({ revalidated: true });
// }
</code></pre>

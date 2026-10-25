---
publishDate: 2026-10-25T13:25
title: Fetching Data on the Client
slug: client-side-data-fetching
metadescription: "Fetch data in Next.js Client Components: stream a server promise into use(), call a Route Handler from the browser, and build a live search with SWR."
updateDate: 2026-10-25T13:25
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'data-fetching', 'swr', 'client-components']
course: nextjs
---

## What you will learn

Most of Book Nook's data is fetched on the server, in Server Components, as you learned in [Fetching Data in Server Components](/courses/nextjs/fetching-data). That should stay your first choice. But some data belongs in the browser:

- data that depends on what the visitor is **doing right now**, like a search box that updates as they type
- data that should **refresh by itself**, like stock levels, without reloading the page
- interactive widgets that need server data **plus** state, like a reviews list with a "Show all" button

In this lesson you will learn three ways to get data into Client Components, from simplest to most powerful:

1. Start the fetch on the server and hand a **promise** to a Client Component, which reads it with React's `use()`.
2. Fetch from the browser with plain `fetch` and `useEffect`, calling a **Route Handler**.
3. Use the **SWR** library, which handles loading, errors, caching and refreshing for you.

## Pattern 1: pass a promise to a Client Component

### The problem

In [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming) you showed reviews with a Server Component. Now the shop wants to show only the first review, with a **Show all** button. A button needs `useState`, so the list must become a Client Component. But Client Components cannot be `async`, so how do they get the data?

### The solution: hand over a promise

A **promise** is an "IOU": a value that says "the answer is coming". The server can **start** loading the reviews, and instead of waiting, pass the IOU straight to the Client Component. React's `use()` hook then reads the answer when it arrives.

On the page, call `getReviews` **without** `await`:

```jsx
// app/books/[id]/page.js (part)
import { Suspense } from 'react';
import { getReviews } from '@/lib/books';
import Reviews from '@/components/Reviews';

// inside BookDetails, after you have the book:
const reviewsPromise = getReviews(book.id); // no await: just start it

return (
  <article>
    <h1 className="font-serif text-3xl font-bold">{book.title}</h1>
    {/* ... */}
    <Suspense fallback={<p className="mt-4 text-zinc-500">Loading reviews...</p>}>
      <Reviews reviewsPromise={reviewsPromise} />
    </Suspense>
  </article>
);
```

Then the Client Component unwraps the promise with `use`:

```jsx
// components/Reviews.js
'use client';

import { use, useState } from 'react';

export default function Reviews({ reviewsPromise }) {
  const reviews = use(reviewsPromise);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? reviews : reviews.slice(0, 1);

  return (
    <section className="mt-4">
      <ul className="space-y-3">
        {visible.map((review) => (
          <li key={review.id} className="rounded-lg bg-zinc-50 p-4">
            <p className="font-semibold">{review.name}</p>
            <p className="text-zinc-700">{review.text}</p>
          </li>
        ))}
      </ul>
      {reviews.length > 1 && (
        <button onClick={() => setShowAll(!showAll)} className="mt-3 text-brand-700 underline">
          {showAll ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
        </button>
      )}
    </section>
  );
}
```

What happens:

1. The server starts `getReviews` and sends the page straight away, with "Loading reviews..." in place.
2. `use(reviewsPromise)` tells React: "wait here until this promise is ready". While it waits, the nearest `<Suspense>` shows its fallback.
3. When the reviews arrive, React streams them to the browser and `Reviews` renders, with a working button.

This is the simplest client pattern, and often all you need. The data still comes from the server, your data code never reaches the browser, and you add no library. The `<Suspense>` around it is required, exactly like for an async Server Component.

> **Good to know:** The data inside the promise travels from server to browser, so it must be plain data: objects, arrays, strings, numbers, dates. Do not put functions or class instances in it.

## Pattern 2: fetch from the browser

Pattern 1 only fetches **once**, when the page loads. A search box is different: every time the visitor types, you need new results. That request has to start in the browser.

### Step 1: a Route Handler as the data source

The browser cannot call `searchBooks()` from `lib/books.js` directly, because that code runs only on the server. It needs a URL to ask. A **Route Handler** is a file called `route.js` that answers HTTP requests with data instead of a page. Create `app/api/books/route.js`:

```javascript
// app/api/books/route.js
import { getBooks, searchBooks } from '@/lib/books';

export async function GET(request) {
  const q = request.nextUrl.searchParams.get('q');
  const books = q ? await searchBooks(q) : await getBooks();
  return Response.json(books);
}
```

- `export async function GET` answers `GET` requests to `/api/books`.
- `request.nextUrl.searchParams.get('q')` reads the `?q=...` part of the URL.
- `Response.json(books)` sends the books back as JSON.

Open `http://localhost:3000/api/books?q=dune` in the browser and you see the raw data:

```text
[{"id":"dune","title":"Dune","author":"Frank Herbert","price":14.5,"genre":"science-fiction","cover":"/covers/dune.jpg","description":"A young heir must survive on a desert planet that holds the most precious resource in the universe."}]
```

You will learn Route Handlers properly in [Building APIs with Route Handlers](/courses/nextjs/route-handlers). For now, this one file is enough.

### Step 2: fetch with useEffect

Here is a search box written with plain React:

```jsx
// components/BookSearch.js
'use client';

import { useEffect, useState } from 'react';

export default function BookSearch() {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query) {
      setBooks([]);
      return;
    }

    let ignore = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/books?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Search failed');
        return res.json();
      })
      .then((data) => {
        if (!ignore) setBooks(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [query]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title or author"
        className="w-full rounded border px-3 py-2"
      />
      {isLoading && <p className="mt-2 text-sm text-zinc-500">Searching...</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <ul className="mt-4">
        {books.map((book) => (
          <li key={book.id}>{book.title} by {book.author}</li>
        ))}
      </ul>
    </div>
  );
}
```

It works, but look how much code it takes for one request:

- three pieces of state (`books`, `isLoading`, `error`)
- an `ignore` flag, so a slow old answer cannot overwrite a newer one (type "du" then "dune" quickly and the "du" answer might arrive last)
- no memory: typing "dune", deleting it and typing it again fetches the same thing twice
- no refreshing: if the stock changes, the list does not know

Notice the URL is just `/api/books?...`, with no `http://localhost:3000`. In the browser, a URL starting with `/` goes to the same site the page came from, so it works on your laptop and on the live site.

## Pattern 3: SWR

**SWR** is a small library from the Next.js team that does all that bookkeeping for you. The name comes from "stale-while-revalidate": show the data you already have (even if it might be a bit old, or **stale**), and quietly fetch a fresh copy in the background (**revalidate**).

Think of a newspaper stand. SWR hands you today's paper straight away, and if a newer edition arrives while you read, it swaps it in.

### Step 1: install it

```bash
npm install swr
```

### Step 2: the same search with useSWR

```jsx
// components/BookSearch.js
'use client';

import { useState } from 'react';
import useSWR from 'swr';

async function fetcher(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Search failed. Please try again.');
  }
  return res.json();
}

export default function BookSearch() {
  const [query, setQuery] = useState('');

  const { data: books, error, isLoading } = useSWR(
    query ? `/api/books?q=${encodeURIComponent(query)}` : null,
    fetcher,
    { keepPreviousData: true }
  );

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title or author"
        className="w-full rounded border px-3 py-2"
      />
      {isLoading && <p className="mt-2 text-sm text-zinc-500">Searching...</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error.message}</p>}
      <ul className="mt-4">
        {books?.map((book) => (
          <li key={book.id}>{book.title} by {book.author}</li>
        ))}
      </ul>
    </div>
  );
}
```

`useSWR` takes three things:

1. A **key**: here, the URL. SWR stores results by key. Ask for the same key again and you get the stored answer instantly.
2. A **fetcher**: any async function that turns the key into data. Ours calls `fetch` and checks `res.ok`, because `fetch` does **not** throw on a 404 or 500 by itself.
3. **Options**: `keepPreviousData: true` keeps showing the old results while new ones load, so the list does not flash empty on every key press.

It gives back `data`, `error` and `isLoading`. Compare it with the `useEffect` version: no `ignore` flag, no manual state, and you get extras for free:

- **Caching and deduplication:** two components asking for the same key share one request.
- **No race problems:** SWR only shows the answer for the current key.
- **Revalidate on focus:** switch to another tab and back, and SWR refreshes the data.
- **Polling:** add `{ refreshInterval: 30000 }` to refresh every 30 seconds.

The `null` key is a handy trick: when `query` is empty, the key is `null` and SWR does not fetch at all.

### Step 3: use it on a page

`BookSearch` is a Client Component, so you can put it in any page, including a Server Component page:

```jsx
// app/search/page.js
import BookSearch from '@/components/BookSearch';

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="font-serif text-3xl font-bold">Search the shop</h1>
      <div className="mt-6">
        <BookSearch />
      </div>
    </main>
  );
}
```

The page heading is static and part of the prerendered shell. The search box comes alive in the browser.

### Other libraries

**TanStack Query** (formerly React Query) does the same job as SWR with more built-in features, such as fine control over how long data counts as fresh. Both work well with Next.js; pick one per project. The Next.js docs also show how to give these libraries their **first** data from a Server Component (with SWR's `SWRConfig` `fallback` option), so the page shows results immediately and the library takes over after that.

## Which pattern should I use?

| You need... | Use |
| --- | --- |
| Data for the first view, shown once | A Server Component that awaits it |
| Server data in a component with state or event handlers | Pattern 1: pass a promise, read it with `use()` |
| Data that changes with what the visitor types or clicks | Pattern 3: SWR (or TanStack Query) and a Route Handler |
| Data that refreshes on its own while the page is open | SWR with `refreshInterval` |
| A one-off request in a tiny widget | Pattern 2 is fine, but SWR saves you the bugs |

For a search that updates the URL and works without JavaScript, there is also a server-side approach with the `<Form>` component, covered in [Search Forms with the Form Component](/courses/nextjs/search-with-next-form).

## Common mistakes

### Creating the promise inside the Client Component

```jsx
'use client';
export default function Reviews({ bookId }) {
  const reviews = use(fetch(`/api/reviews/${bookId}`).then((r) => r.json())); // new promise every render
}
```

```text
A component was suspended by an uncached promise. Creating promises inside a Client Component or hook is not yet supported, except via a Suspense-compatible library or framework.
```

Every render makes a brand new promise, so React can never finish waiting. Create the promise in a **Server Component** and pass it down as a prop (Pattern 1), or use a library like SWR (Pattern 3).

### Using hooks in a Server Component

`useSWR`, `useState` and `useEffect` only work in Client Components. If you forget `'use client'` at the top of `BookSearch.js`, the build fails with an error that the hook needs a Client Component. Add `'use client'` as the first line.

### Forgetting to check res.ok in the fetcher

`fetch` only rejects when the network fails. A `404` or `500` still "succeeds", and `res.json()` hands SWR an error page or error object as if it were data, so `books.map` crashes. Always check `res.ok` and `throw` in the fetcher, so SWR puts it in `error`.

### Putting the full localhost address in the URL

```jsx
fetch('http://localhost:3000/api/books'); // breaks on the live site
```

In the browser, use a relative URL starting with `/`. It always points at the site the page came from.

### Fetching on the client when the server could do it

If the data is needed for the first view and does not change while the visitor is on the page, fetch it in a Server Component. It is faster (no extra round trip after the page loads), sends less JavaScript, and search engines see the content.

## Quick recap

- Prefer fetching in Server Components. Fetch on the client for interactive, user-driven or self-refreshing data.
- **Pattern 1:** start a request on the server without `await`, pass the promise as a prop, wrap the Client Component in `<Suspense>`, and read it with `use(promise)`.
- **Pattern 2:** the browser fetches from a Route Handler (`app/api/books/route.js`) with a relative URL. Plain `useEffect` works but needs loading, error and race handling by hand.
- **Pattern 3:** `useSWR(key, fetcher, options)` gives you `data`, `error` and `isLoading`, plus caching, deduplication and revalidation. A `null` key skips the request.
- Always check `res.ok` in a fetcher and throw on failure.
- Never create a new promise inside a Client Component and pass it to `use()`.

<code id="code-content" class="language-jsx">
// components/BookSearch.js: a live search box powered by SWR and a Route Handler
'use client'; // hooks only work in Client Components
import { useState } from 'react';
import useSWR from 'swr';
// Turns a URL into data, and turns HTTP errors into real errors
async function fetcher(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Search failed. Please try again.');
  }
  return res.json();
}
export default function BookSearch() {
  const [query, setQuery] = useState('');
  // The key is the URL. A null key means "do not fetch yet".
  const { data: books, error, isLoading } = useSWR(
    query ? `/api/books?q=${encodeURIComponent(query)}` : null,
    fetcher,
    { keepPreviousData: true } // keep old results on screen while new ones load
  );
  return (
    &lt;div&gt;
      &lt;input
        value={query}
        onChange={(e) =&gt; setQuery(e.target.value)}
        placeholder="Search by title or author"
        className="w-full rounded border px-3 py-2"
      /&gt;
      {isLoading &amp;&amp; &lt;p className="mt-2 text-sm text-zinc-500"&gt;Searching...&lt;/p&gt;}
      {error &amp;&amp; &lt;p className="mt-2 text-sm text-red-700"&gt;{error.message}&lt;/p&gt;}
      &lt;ul className="mt-4"&gt;
        {books?.map((book) =&gt; (
          &lt;li key={book.id}&gt;{book.title} by {book.author}&lt;/li&gt;
        ))}
      &lt;/ul&gt;
    &lt;/div&gt;
  );
}
// --- app/api/books/route.js: the data source the browser calls
// import { getBooks, searchBooks } from '@/lib/books';
// export async function GET(request) {
//   const q = request.nextUrl.searchParams.get('q');
//   const books = q ? await searchBooks(q) : await getBooks();
//   return Response.json(books);
// }
</code></pre>

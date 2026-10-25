---
publishDate: 2026-10-25T13:22
title: Fetching Data in Server Components
slug: fetching-data
metadescription: "Fetch data in Next.js 16 Server Components with async/await, call your data layer or fetch an API, run requests in parallel, and handle uncached data."
updateDate: 2026-10-25T13:22
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'data-fetching', 'server-components', 'async']
course: nextjs
---

## What you will learn

Almost every real page shows data: a list of books, one book's details, prices, reviews. In a classic React app you would fetch that data in the browser with `useEffect`, show a spinner, and wait. In Next.js you can do something simpler: **fetch the data on the server, inside the component itself**, and send the finished HTML to the browser.

You already know that pages are **Server Components** by default ([Server Components Explained](/courses/nextjs/server-components)). In this lesson you will use their super power: they can be `async` and `await` data directly.

By the end you will know how to:

- write an `async` Server Component that awaits data
- read Book Nook's data from `lib/books.js`
- call an outside API with `fetch`
- understand why Next.js 16 asks you to wrap some data in `<Suspense>`
- make several requests at the same time instead of one after another

## Step 1: an async Server Component

Here is the books page reading from Book Nook's data layer, `lib/books.js`:

```jsx
// app/books/page.js
import BookCard from '@/components/BookCard';
import { getBooks } from '@/lib/books';

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="font-serif text-3xl font-bold">All books</h1>
      <p className="mt-2 text-zinc-600">{books.length} books in stock</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </main>
  );
}
```

Two small words do all the work:

- `async` in front of the function lets the component wait for things.
- `await getBooks()` pauses the component until the books are ready, then carries on with real data.

No `useState`, no `useEffect`, no "loading" flag. The code reads top to bottom like a recipe: get the books, then show them.

This only works in **Server Components**. A Client Component (a file with `'use client'`) cannot be `async`. You will see how the browser side fetches data in [Fetching Data on the Client](/courses/nextjs/client-side-data-fetching).

## Step 2: why this is safe and fast

The component runs on the server, so:

- **Secrets stay secret.** The code that talks to your database, and any passwords it uses, never reach the browser. The browser only receives the finished HTML.
- **Less JavaScript.** The visitor does not download a data-fetching library or your data code.
- **Fewer round trips.** The server is usually close to the database, so it fetches faster than a phone on a slow network would.

Think of a restaurant. With browser fetching, the waiter brings you an empty plate and a list of ingredients, and you cook at the table. With Server Components, the kitchen cooks and the waiter brings a finished meal.

## Step 3: look at lib/books.js again

Book Nook's data layer has three functions:

```javascript
// lib/books.js
const books = [
  { id: 'the-hobbit', title: 'The Hobbit', author: 'J.R.R. Tolkien', price: 12.99, genre: 'fantasy', cover: '/covers/the-hobbit.jpg', description: 'Bilbo Baggins leaves his cosy home for an adventure with dwarves and a dragon.' },
  { id: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', price: 9.99, genre: 'classic', cover: '/covers/pride-and-prejudice.jpg', description: 'Elizabeth Bennet and Mr Darcy learn that first impressions can be wrong.' },
  { id: 'dune', title: 'Dune', author: 'Frank Herbert', price: 14.5, genre: 'science-fiction', cover: '/covers/dune.jpg', description: 'A young heir must survive on a desert planet that holds the most precious resource in the universe.' },
  { id: 'the-little-prince', title: 'The Little Prince', author: 'Antoine de Saint-Exupery', price: 8.75, genre: 'classic', cover: '/covers/the-little-prince.jpg', description: 'A pilot stranded in the desert meets a little prince from a tiny planet.' },
];

export async function getBooks() {
  return books;
}

export async function getBook(id) {
  return books.find((book) => book.id === id) ?? null;
}

export async function searchBooks(query) {
  const q = query.toLowerCase();
  return books.filter((book) => book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q));
}
```

The data is just an array in a file, but every function is `async` on purpose. Pages always `await` them. Later, in [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database), the insides of these functions will talk to a real database, and your pages will not need to change at all.

Keeping all data access in one `lib/` file is a good habit. Pages ask for "the books" and do not care where they come from.

## Step 4: fetch data from an API

Server Components can also call any web API with the normal `fetch` function. Let us show "More by this author" on a book page, using the free Open Library search API:

```jsx
// components/MoreByAuthor.js
export default async function MoreByAuthor({ author }) {
  const res = await fetch(
    `https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&limit=5`
  );

  if (!res.ok) {
    return <p className="text-sm text-zinc-500">Could not load more books right now.</p>;
  }

  const data = await res.json();

  return (
    <ul className="mt-2 list-disc pl-5">
      {data.docs.map((doc) => (
        <li key={doc.key}>
          {doc.title} ({doc.first_publish_year ?? 'year unknown'})
        </li>
      ))}
    </ul>
  );
}
```

- `fetch(url)` sends the request and gives back a **response**.
- `res.ok` is `true` when the server answered with success. Checking it lets you show a friendly message instead of crashing. You will learn more ways to deal with failures in [Handling Errors with error.js](/courses/nextjs/error-handling).
- `await res.json()` reads the response body as JavaScript data.
- `encodeURIComponent` makes the author's name safe to put in a URL (spaces become `%20`).

The component fetches its own data. You do not need to fetch everything in the page and pass it down through many props. If two components on the same page make the **exact same** `fetch` call, Next.js only sends it once.

## Step 5: Cache Components and Suspense

Your Book Nook project was created with `--cache-components`, so `next.config.mjs` has `cacheComponents: true`. This changes one important thing about data.

When you run `npm run build`, Next.js tries to **prerender** each page: it renders the page ahead of time and saves the HTML, so it can be sent instantly later. To do that, it has to know which parts of the page can be made in advance and which must be made fresh for every visitor.

- `getBooks()` from our array finishes instantly, with no network or disk access. Next.js can safely bake the result into the page. That is why `/books` builds as a static page.
- A `fetch` to another server (or, later, a database query) is **uncached data**. Next.js does not know if the answer will be the same tomorrow, so it will not quietly bake it in. You have to tell it what you want.

Try using `MoreByAuthor` directly in a page, with nothing around it, and run `npm run build`:

```text
Error: Route "/books/[id]": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] For uncached data (`fetch`, database calls): cache the access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-dynamic
```

The dev server shows the same problem in its error overlay. The message gives you two good choices:

1. **Stream it:** wrap the component in `<Suspense>` with a placeholder. The rest of the page is prerendered, and the uncached part is fetched fresh for each visitor and appears when ready.
2. **Cache it:** mark the data with `"use cache"`, so Next.js stores the result and can include it in the prerendered page. You will learn this in [Caching with Cache Components and use cache](/courses/nextjs/use-cache).

For "More by this author", fresh data is fine, so we stream it. `<Suspense>` comes from React:

```jsx
// app/books/[id]/page.js (part)
import { Suspense } from 'react';
import MoreByAuthor from '@/components/MoreByAuthor';

<Suspense fallback={<p className="text-sm text-zinc-500">Loading more books by {book.author}...</p>}>
  <MoreByAuthor author={book.author} />
</Suspense>
```

`fallback` is what visitors see while the data is on its way. Notice the list of uncached things in the error also includes `params`. On a dynamic route like `/books/[id]`, the `id` is only known when someone visits, so reading `params` counts too. The full page in the next step handles both.

[Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming) explains how streaming works in detail, and [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering) explains how Next.js decides what to prerender.

## Step 6: the book page, with parallel fetching

The book detail page needs two things: the book itself, and all books (to show others in the same genre). The obvious code waits for them **one after the other**:

```jsx
// Slow: the second request only starts when the first one has finished
const book = await getBook(id);
const allBooks = await getBooks();
```

This is called a **waterfall**: each request waits for the one before it, like water falling down steps. If each took one second, the page would take two.

These two requests do not depend on each other, so start them both at once and wait for both with `Promise.all`:

```jsx
// Fast: both requests run at the same time
const [book, allBooks] = await Promise.all([getBook(id), getBooks()]);
```

`Promise.all` takes a list of promises and gives back a list of results, in the same order, once **all** of them are done. Now the page waits about as long as the slowest request, not the total.

Here is the complete page:

```jsx
// app/books/[id]/page.js
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books';
import MoreByAuthor from '@/components/MoreByAuthor';

export default function BookPage({ params }) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <Suspense fallback={<p>Loading book...</p>}>
        <BookDetails params={params} />
      </Suspense>
    </main>
  );
}

async function BookDetails({ params }) {
  const { id } = await params;
  const [book, allBooks] = await Promise.all([getBook(id), getBooks()]);

  if (!book) {
    notFound();
  }

  const sameGenre = allBooks.filter((b) => b.genre === book.genre && b.id !== book.id);

  return (
    <article>
      <h1 className="font-serif text-3xl font-bold">{book.title}</h1>
      <p className="text-zinc-600">by {book.author}</p>
      <p className="mt-4">{book.description}</p>

      {sameGenre.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">More {book.genre} books</h2>
          <ul className="mt-2 list-disc pl-5">
            {sameGenre.map((b) => (
              <li key={b.id}>{b.title}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">More by {book.author}</h2>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading...</p>}>
          <MoreByAuthor author={book.author} />
        </Suspense>
      </section>
    </article>
  );
}
```

Notice how it is built:

- The page component itself is **not** `async`. It passes the `params` promise down to `BookDetails` without awaiting it.
- `BookDetails` awaits `params` (remember, in Next.js 16 `params` is a Promise, as you saw in [Dynamic Routes and params](/courses/nextjs/dynamic-routes)) inside a `<Suspense>` boundary. Next.js can prerender the page shell with its "Loading book..." fallback, and fill in the book for each visit.
- The book and all books are loaded in parallel with `Promise.all`.
- If the book does not exist, `notFound()` shows the 404 page ([Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects)).
- The slow outside API call sits in its own `<Suspense>`, so the book details never wait for Open Library.

Run `npm run build` and look at the route list. You will see `/books` as static and `/books/[id]` as **Partial Prerender**:

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /books
├   /books/[id]
│ └ ◐ /books/[id]

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

## Step 7: when requests must wait for each other

Sometimes a request really does need the result of another one. "More by this author" needs the book first, because it needs the author's name. That is fine: it is a real dependency, not a mistake. The trick is to wrap the dependent part in its own `<Suspense>`, as you did above, so the rest of the page does not wait for it.

A simple rule: **start requests that do not depend on each other together; put requests that do depend on others in their own Suspense boundary.**

## Step 8: reusing data in many components

Imagine the page header and the page body both need the same book. With `fetch`, identical requests in one page render are sent only once, so you can call it in both places. For other data sources, such as a database, wrap the function in React's `cache` so many components can call it during the same request and share one result:

```javascript
// lib/books.js (later, with a database)
import { cache } from 'react';

export const getBook = cache(async (id) => {
  // ...query the database for one book
});
```

`cache` only remembers results **during one request** for one visitor. It is not a long-term cache. You will meet the long-term kind, `"use cache"`, in the caching lessons.

## Common mistakes

### Making a Client Component async

```jsx
'use client';

export default async function BookList() { // not allowed
  const books = await getBooks();
}
```

Only Server Components can be `async`. Remove `'use client'` if the component does not need interactivity, or fetch on the server and pass the data down as props.

### The blocking route error during build

```text
Error: Route "/books/[id]": Next.js encountered uncached or runtime data during prerendering.
```

Something in that route reads uncached data (`fetch`, a database, `params`, `cookies()`...) outside a `<Suspense>` boundary. Wrap the component that awaits it in `<Suspense fallback={...}>`, as in Step 6, or cache it with `"use cache"`. A `loading.js` file in the route folder also counts as a Suspense boundary (see the next lesson).

### Accidental waterfalls

```jsx
const book = await getBook(id);
const allBooks = await getBooks(); // waits for no reason
```

If the second call does not use the result of the first, start both together with `Promise.all`.

### Forgetting to await

```jsx
const books = getBooks();
books.map(...); // TypeError: books.map is not a function
```

An `async` function returns a **Promise**, not the data. Add `await`.

### Fetching your own Route Handler from a Server Component

Calling `fetch('http://localhost:3000/api/books')` from a Server Component makes the server send an HTTP request to itself. It is slower, and the address is different on every computer. Import and call `getBooks()` from `lib/books.js` directly instead. Route Handlers are for the **browser** and for other apps.

## Quick recap

- Server Components can be `async` and `await` data directly: no `useEffect`, no loading flags.
- Keep data access in `lib/books.js` (`getBooks`, `getBook`, `searchBooks`) and call it from pages.
- Use `fetch` for outside APIs. Check `res.ok`, then `await res.json()`.
- With Cache Components on, uncached data (`fetch`, databases, `params`) must sit inside `<Suspense>` or be cached with `"use cache"`, or the build fails.
- Pass the `params` promise down and await it inside a Suspense boundary.
- Use `Promise.all` to run independent requests in parallel and avoid waterfalls.
- Use React's `cache` to share one result between components in the same request.

<code id="code-content" class="language-jsx">
// app/books/[id]/page.js: a book page that fetches in parallel and streams slow parts
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books';
import MoreByAuthor from '@/components/MoreByAuthor';
// The page is not async: it passes the params promise down without waiting
export default function BookPage({ params }) {
  return (
    &lt;main className="mx-auto max-w-3xl p-8"&gt;
      {/* params is only known per visit, so read it inside Suspense */}
      &lt;Suspense fallback={&lt;p&gt;Loading book...&lt;/p&gt;}&gt;
        &lt;BookDetails params={params} /&gt;
      &lt;/Suspense&gt;
    &lt;/main&gt;
  );
}
async function BookDetails({ params }) {
  const { id } = await params; // params is a Promise in Next.js 16
  // Start both requests at once and wait for both (no waterfall)
  const [book, allBooks] = await Promise.all([getBook(id), getBooks()]);
  if (!book) {
    notFound(); // shows the 404 page
  }
  const sameGenre = allBooks.filter((b) =&gt; b.genre === book.genre &amp;&amp; b.id !== book.id);
  return (
    &lt;article&gt;
      &lt;h1 className="font-serif text-3xl font-bold"&gt;{book.title}&lt;/h1&gt;
      &lt;p className="text-zinc-600"&gt;by {book.author}&lt;/p&gt;
      &lt;p className="mt-4"&gt;{book.description}&lt;/p&gt;
      &lt;ul className="mt-6 list-disc pl-5"&gt;
        {sameGenre.map((b) =&gt; (
          &lt;li key={b.id}&gt;{b.title}&lt;/li&gt;
        ))}
      &lt;/ul&gt;
      {/* The outside API is slow and uncached: stream it in its own boundary */}
      &lt;Suspense fallback={&lt;p&gt;Loading more by {book.author}...&lt;/p&gt;}&gt;
        &lt;MoreByAuthor author={book.author} /&gt;
      &lt;/Suspense&gt;
    &lt;/article&gt;
  );
}
// --- components/MoreByAuthor.js
// export default async function MoreByAuthor({ author }) {
//   const res = await fetch(`https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&amp;limit=5`);
//   if (!res.ok) return &lt;p&gt;Could not load more books right now.&lt;/p&gt;;
//   const data = await res.json();
//   return &lt;ul&gt;{data.docs.map((doc) =&gt; &lt;li key={doc.key}&gt;{doc.title}&lt;/li&gt;)}&lt;/ul&gt;;
// }
</code></pre>

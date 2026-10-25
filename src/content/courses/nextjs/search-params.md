---
publishDate: 2026-10-25T13:09
title: Reading Search Params from the URL
slug: search-params
metadescription: Read the query string in Next.js 16 with the searchParams prop and useSearchParams, filter Book Nook by genre, and build links with query strings.
updateDate: 2026-10-25T13:09
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'search-params', 'routing', 'query-string']
course: nextjs
---

## What you will build

Right now the `/books` page in Book Nook shows every book. In this lesson you will let visitors filter the list by genre with a URL like this:

```text
http://localhost:3000/books?genre=classic
```

Along the way you will learn:

- What the **query string** is and when to use it instead of a dynamic route.
- How to read it in a page with the `searchParams` prop (a Promise in Next.js 16).
- Why Book Nook puts that code inside `<Suspense>`.
- How to build links that carry a query string.
- How to read it in a Client Component with the `useSearchParams` hook, and why that hook also needs `<Suspense>`.

You should already have the `/books` page and `lib/books.js` from [Dynamic Routes and params](/courses/nextjs/dynamic-routes).

## What is a query string?

Look at this URL:

```text
/books?genre=classic&sort=price
```

Everything after the `?` is the **query string**. It is a list of `name=value` pairs joined with `&`. Each pair is called a **search param** (or query param). Here there are two: `genre` is `classic` and `sort` is `price`.

Think of a URL like an address on an envelope. The path (`/books`) is the house. The query string is a sticky note on the envelope: "only the classics, please, sorted by price". It is the same house, just a different request.

So when do you use a dynamic route (`/books/dune`) and when a search param (`/books?genre=classic`)?

| Use a dynamic route for... | Use a search param for... |
| --- | --- |
| The identity of one thing: a book, a user, a post | Options on a page: filters, sorting, a page number, a search term |
| URLs that should always exist | Values that are optional and can be left out |
| `/books/dune` | `/books?genre=classic`, `/books?page=2` |

## Step 1: read searchParams in a page

Every `page.js` receives a `searchParams` prop. In Next.js 16 it is a **Promise**, a value that will be ready a moment later, so you must `await` it before you can use it:

```jsx
// app/books/page.js (first try)
export default async function BooksPage({ searchParams }) {
  const { genre } = await searchParams;

  return <h1>Genre: {genre}</h1>;
}
```

Visit a few URLs and see what `searchParams` resolves to:

| URL | `await searchParams` |
| --- | --- |
| `/books` | `{}` |
| `/books?genre=classic` | `{ genre: 'classic' }` |
| `/books?genre=classic&sort=price` | `{ genre: 'classic', sort: 'price' }` |
| `/books?genre=classic&genre=fantasy` | `{ genre: ['classic', 'fantasy'] }` |

Notice three things:

- A param that is not in the URL is simply `undefined`.
- Values are always **strings**. `?page=2` gives you the string `'2'`, not the number `2`. Use `Number(page)` if you need a number.
- If the same name appears twice, you get an **array** of strings.

`searchParams` is a plain JavaScript object, so you read it with `.genre` or destructuring, not with `.get('genre')`.

## Step 2: why Book Nook needs Suspense here

Run `npm run build` with the page above and the build stops:

```text
Error: Route "/books": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] For uncached data (`fetch`, database calls): cache the access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route
```

Here is why. Book Nook was created with **Cache Components** turned on. With it, Next.js builds a **static shell** of every page ahead of time: the parts of the HTML that are the same for every visitor. But nobody knows at build time which query string a visitor will type. So the code that reads `searchParams` cannot be part of the shell. You must tell Next.js where the "wait for the request" part begins, and you do that with React's **`<Suspense>`** component. Suspense shows a **fallback** (a placeholder) until the code inside it is ready.

The fix is to move the `await` into a small child component and wrap that child in `<Suspense>`. You pass the Promise down without awaiting it:

```jsx
// app/books/page.js
import { Suspense } from 'react';

export default function BooksPage({ searchParams }) {
  return (
    <main>
      <h1>Books</h1>
      <Suspense fallback={<p>Loading books...</p>}>
        <BookList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BookList({ searchParams }) {
  const { genre } = await searchParams;
  return <p>Showing genre: {genre ?? 'all'}</p>;
}
```

Now the heading and the fallback text go into the static shell, and only `BookList` waits for the real request. The page itself is no longer `async`, because it never awaits anything. You will learn much more about this in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming) and [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering).

## Step 3: filter the books

Now use the genre to filter the real book list from `lib/books.js`:

```jsx
// app/books/page.js
import { Suspense } from 'react';
import Link from 'next/link';
import { getBooks } from '@/lib/books';

export default function BooksPage({ searchParams }) {
  return (
    <main>
      <h1>Books</h1>
      <Suspense fallback={<p>Loading books...</p>}>
        <BookList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BookList({ searchParams }) {
  const { genre } = await searchParams;
  const books = await getBooks();

  // No genre in the URL means "show everything"
  const shown = genre ? books.filter((book) => book.genre === genre) : books;

  if (shown.length === 0) {
    return <p>No books in this genre yet.</p>;
  }

  return (
    <ul>
      {shown.map((book) => (
        <li key={book.id}>
          <Link href={`/books/${book.id}`}>{book.title}</Link> by {book.author}
        </li>
      ))}
    </ul>
  );
}
```

Start the dev server with `npm run dev` and try:

```text
/books                        4 books
/books?genre=classic          Pride and Prejudice, The Little Prince
/books?genre=fantasy          The Hobbit
/books?genre=poetry           No books in this genre yet.
```

> **Tip:** Never trust a search param. Anyone can type anything into the address bar. Here an unknown genre just shows an empty list, which is safe. If you use a param for something like a page number, check that it really is a sensible number before you use it.

## Step 4: build links with query strings

Visitors will not type query strings by hand, so give them links. A `Link` `href` can be a normal string with the query string on the end:

```jsx
<Link href="/books?genre=classic">Classics</Link>
```

It can also be an object with a `pathname` and a `query`. Next.js turns the object into the right URL for you, including any escaping of special characters:

```jsx
<Link href={{ pathname: '/books', query: { genre: 'science-fiction' } }}>
  Science fiction
</Link>
```

That link goes to `/books?genre=science-fiction`. Let us add a row of genre links above the list. Create a small Server Component:

```jsx
// components/GenreLinks.js
import Link from 'next/link';

const genres = [
  { value: 'classic', label: 'Classics' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'science-fiction', label: 'Science fiction' },
];

export default function GenreLinks() {
  return (
    <nav>
      <Link href="/books">All</Link>
      {genres.map((genre) => (
        <Link key={genre.value} href={{ pathname: '/books', query: { genre: genre.value } }}>
          {genre.label}
        </Link>
      ))}
    </nav>
  );
}
```

Then render it in the page, **outside** the Suspense boundary. It does not read the URL, so it can stay in the static shell:

```jsx
// app/books/page.js
import GenreLinks from '@/components/GenreLinks';

export default function BooksPage({ searchParams }) {
  return (
    <main>
      <h1>Books</h1>
      <GenreLinks />
      <Suspense fallback={<p>Loading books...</p>}>
        <BookList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

When you click a link, Next.js navigates on the client (as you saw in [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating)), and the page receives the new `searchParams`.

If you need to build a query string with several values in plain JavaScript, use the browser's built-in **`URLSearchParams`** class:

```javascript
const params = new URLSearchParams({ genre: 'classic', sort: 'price' });
params.toString(); // 'genre=classic&sort=price'
```

## Step 5: read the query string in a Client Component

Sometimes a component that runs in the browser needs the query string, for example a dropdown that changes the genre. Client Components cannot receive `searchParams` the same way a page does, so Next.js gives them the **`useSearchParams`** hook from `next/navigation`. (Client Components and the `'use client'` line are explained fully in [Client Components and the use client Directive](/courses/nextjs/client-components). For now, just know that this file runs in the browser too.)

```jsx
// components/GenreSelect.js
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function GenreSelect() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // .get() returns the value as a string, or null when it is missing
  const current = searchParams.get('genre') ?? '';

  function handleChange(event) {
    // Copy the current params, then change only "genre"
    const params = new URLSearchParams(searchParams.toString());
    if (event.target.value) {
      params.set('genre', event.target.value);
    } else {
      params.delete('genre');
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <select value={current} onChange={handleChange}>
      <option value="">All genres</option>
      <option value="classic">Classics</option>
      <option value="fantasy">Fantasy</option>
      <option value="science-fiction">Science fiction</option>
    </select>
  );
}
```

What is going on here:

- `useSearchParams()` returns a **read-only** `URLSearchParams` object. You read values with `.get('genre')`, `.has('genre')` or `.getAll('genre')`. Unlike the page prop, it has methods, and a missing value is `null`.
- You cannot change it directly. Instead, copy it into a new `URLSearchParams`, change the copy, and navigate to the new URL with `router.push`.
- Copying first keeps any other params (like `sort`) that are already in the URL.

Now add it to the page, wrapped in its own `<Suspense>`:

```jsx
// app/books/page.js
import GenreSelect from '@/components/GenreSelect';

export default function BooksPage({ searchParams }) {
  return (
    <main>
      <h1>Books</h1>
      <Suspense fallback={<p>Loading filter...</p>}>
        <GenreSelect />
      </Suspense>
      <Suspense fallback={<p>Loading books...</p>}>
        <BookList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

Why does a hook need Suspense? For the same reason as before: the query string only exists when a real visitor makes a request. Leave the boundary out and `npm run build` fails with:

```text
Error: Route "/books": Next.js encountered URL data `useSearchParams()` in a Client Component outside of `<Suspense>`.

This blocks prerendering because the value is only available at runtime.
```

Be careful: in development, pages are rendered on demand, so the page may look fine without Suspense. The problem only shows up when you build. Make wrapping `useSearchParams` in `<Suspense>` a habit.

## The prop or the hook?

| | `searchParams` prop | `useSearchParams()` hook |
| --- | --- | --- |
| Where | `page.js` only | Any Client Component |
| What you get | A Promise of a plain object | A read-only `URLSearchParams` |
| Read a value | `(await searchParams).genre` | `searchParams.get('genre')` |
| Missing value | `undefined` | `null` |
| Best for | Fetching or filtering data on the server | Interactive UI that changes the URL |

A good rule: read the prop in the page when you need the value to load data, and only reach for the hook in small interactive pieces. You can also read the prop in the page and pass the value down to a Client Component as a normal prop.

Note that **layouts do not receive `searchParams`**. A layout stays on screen while you move between pages, so it would show stale values. If something in a layout needs the query string, put that piece in a Client Component and use the hook.

Later, in [Search Forms with the Form Component](/courses/nextjs/search-with-next-form), you will build a search box that writes `?q=...` into the URL using a plain form.

## Common mistakes

### Forgetting to await

```jsx
export default function BooksPage({ searchParams }) {
  const genre = searchParams.genre; // always undefined
}
```

`searchParams` is a Promise, and a Promise has no `genre` property. Await it (in an `async` component) first: `const { genre } = await searchParams;`.

### Calling .get() on the page prop

```text
TypeError: searchParams.get is not a function
```

The page prop resolves to a plain object, not a `URLSearchParams`. Use `.genre`. The `.get()` method belongs to the object returned by `useSearchParams()`.

### Reading search params without Suspense

The build fails with "Next.js encountered uncached or runtime data during prerendering" (for the prop) or "Next.js encountered URL data `useSearchParams()` in a Client Component outside of `<Suspense>`" (for the hook). Move the code that reads the query string into a component wrapped in `<Suspense>`, as in Steps 2 and 5.

### Treating values as numbers

`?page=2` gives `'2'`. Writing `page + 1` gives `'21'`, not `3`. Convert first with `Number(page)` and check the result with `Number.isInteger()`.

## Quick recap

- The query string is the part of the URL after `?`, made of `name=value` pairs. Use it for optional page options like filters, sorting and page numbers.
- In a page, `searchParams` is a Promise. Await it to get a plain object of strings (or arrays of strings).
- With Cache Components on, read search params inside a component wrapped in `<Suspense>`, and pass the Promise down to it.
- Build links with `href="/books?genre=classic"` or `href={{ pathname: '/books', query: { genre: 'classic' } }}`.
- In Client Components, use `useSearchParams()` from `next/navigation`, read with `.get()`, and change the URL with `router.push`.
- Always wrap a component that calls `useSearchParams()` in `<Suspense>`, or the build fails.
- Layouts do not get `searchParams`.

<code id="code-content" class="language-jsx">
// app/books/page.js: the Book Nook book list, filtered by ?genre=...
import { Suspense } from 'react';
import Link from 'next/link';
import { getBooks } from '@/lib/books';
import GenreLinks from '@/components/GenreLinks';
import GenreSelect from '@/components/GenreSelect';
// The page is not async: it passes the searchParams Promise down unopened
export default function BooksPage({ searchParams }) {
  return (
    &lt;main&gt;
      &lt;h1&gt;Books&lt;/h1&gt;
      {/* Plain links: no URL data, so they stay in the static shell */}
      &lt;GenreLinks /&gt;
      {/* useSearchParams needs a Suspense boundary */}
      &lt;Suspense fallback={&lt;p&gt;Loading filter...&lt;/p&gt;}&gt;
        &lt;GenreSelect /&gt;
      &lt;/Suspense&gt;
      {/* Reading searchParams waits for the request, so it sits in Suspense */}
      &lt;Suspense fallback={&lt;p&gt;Loading books...&lt;/p&gt;}&gt;
        &lt;BookList searchParams={searchParams} /&gt;
      &lt;/Suspense&gt;
    &lt;/main&gt;
  );
}
async function BookList({ searchParams }) {
  const { genre } = await searchParams; // e.g. { genre: 'classic' } or {}
  const books = await getBooks();
  const shown = genre ? books.filter((book) =&gt; book.genre === genre) : books;
  if (shown.length === 0) {
    return &lt;p&gt;No books in this genre yet.&lt;/p&gt;;
  }
  return (
    &lt;ul&gt;
      {shown.map((book) =&gt; (
        &lt;li key={book.id}&gt;
          &lt;Link href={`/books/${book.id}`}&gt;{book.title}&lt;/Link&gt; by {book.author}
        &lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
// --- next file: components/GenreSelect.js
// 'use client';
// import { usePathname, useRouter, useSearchParams } from 'next/navigation';
// export default function GenreSelect() {
//   const searchParams = useSearchParams();
//   const pathname = usePathname();
//   const router = useRouter();
//   function handleChange(event) {
//     const params = new URLSearchParams(searchParams.toString());
//     if (event.target.value) params.set('genre', event.target.value);
//     else params.delete('genre');
//     const query = params.toString();
//     router.push(query ? `${pathname}?${query}` : pathname);
//   }
//   return (
//     &lt;select value={searchParams.get('genre') ?? ''} onChange={handleChange}&gt;
//       &lt;option value=""&gt;All genres&lt;/option&gt;
//       &lt;option value="classic"&gt;Classics&lt;/option&gt;
//     &lt;/select&gt;
//   );
// }
</code></pre>

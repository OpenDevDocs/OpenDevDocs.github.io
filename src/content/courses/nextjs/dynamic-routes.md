---
publishDate: 2026-10-25T13:08
title: Dynamic Routes and params
slug: dynamic-routes
metadescription: "Build one Next.js page for every book with a [id] dynamic route, read params with await, and learn catch-all and optional catch-all segments."
updateDate: 2026-10-25T13:08
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'dynamic-routes', 'params', 'routing']
course: nextjs
---

## What you will build

A bookshop needs a page for every book: `/books/the-hobbit`, `/books/dune`, `/books/pride-and-prejudice`, and hundreds more later. You do not want to create a folder for each one. Instead, you will create **one** page that works for **all** of them.

In this lesson you will:

- create `lib/books.js`, the Book Nook data file used for the rest of the course
- load the book list from it on `/books`, with a link to each book
- build `app/books/[id]/page.js`, one page that shows any book
- read the URL value with `params`, which is a **Promise** in Next.js 16
- learn **catch-all** `[...slug]` and **optional catch-all** `[[...slug]]` segments

You need the header and layouts from [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating).

## What is a dynamic route?

So far, every folder name was fixed: `about`, `books`, `cart`. Those are **static segments**: they match exactly one word in the URL.

A **dynamic segment** is a folder whose name is wrapped in square brackets, like `[id]`. It matches **any** value in that spot of the URL, and Next.js tells your page which value it was.

```text
app/books/[id]/page.js

/books/dune                  →  id is "dune"
/books/the-hobbit            →  id is "the-hobbit"
/books/the-little-prince     →  id is "the-little-prince"
```

Think of a fill-in-the-blank form: "Show me the book called ____." The folder `[id]` is the blank, and the URL fills it in.

The word inside the brackets is up to you. `[id]` is a good name for Book Nook, because each book has an `id`. Blogs often use `[slug]`. Whatever you choose becomes the name you read in your code.

## Step 1: create the book data

Real shops keep their books in a database. You will connect one in [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database). For now, a plain JavaScript file is perfect.

Create a `lib` folder at the top of the project (next to `app` and `components`), and add `books.js`:

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

A few things about this file:

- Each book has an `id` made of lowercase words and dashes. It is safe to put in a URL, so it doubles as the address: `/books/the-hobbit`.
- `getBooks()` returns every book. `getBook(id)` finds one book, or returns `null` if there is no book with that id. (`??` means "if the left side is empty, use the right side".) `searchBooks` will be used in [Reading Search Params from the URL](/courses/nextjs/search-params).
- The functions are `async` even though they do not wait for anything yet. That is on purpose: when you swap the array for a real database later, the pages that call them will not need to change at all.
- The `cover` images do not exist yet. You will add them in [Optimizing Images with next/image](/courses/nextjs/optimizing-images).

## Step 2: list the books on /books

Replace the hand-typed list in `app/books/page.js` with real data and a link to each book:

```jsx
// app/books/page.js
import Link from 'next/link';
import { getBooks } from '@/lib/books';

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <section>
      <h1 className="text-3xl font-bold">All books</h1>
      <ul className="mt-6 space-y-3">
        {books.map((book) => (
          <li key={book.id}>
            <Link href={`/books/${book.id}`} className="font-semibold underline">
              {book.title}
            </Link>
            <span className="text-zinc-600"> by {book.author}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- The component is `async`, so it can `await getBooks()`. Pages are Server Components, and Server Components are allowed to be async. More on that in [Fetching Data in Server Components](/courses/nextjs/fetching-data).
- Each link's `href` is built from the book's id with a template string: `` `/books/${book.id}` `` becomes `/books/dune`.

Visit `/books`. You see four linked titles. Click one and you get a 404 page, because the book page does not exist yet. Let us build it.

## Step 3: create the dynamic page

Create a folder called `[id]` (square brackets included) inside `app/books`, and a `page.js` inside it:

```jsx
// app/books/[id]/page.js
import Link from 'next/link';
import { getBook } from '@/lib/books';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    return <h1 className="text-2xl font-bold">Sorry, we could not find that book.</h1>;
  }

  return (
    <article>
      <h1 className="text-3xl font-bold">{book.title}</h1>
      <p className="mt-1 text-zinc-600">by {book.author}</p>
      <p className="mt-4 text-xl font-semibold">${book.price.toFixed(2)}</p>
      <p className="mt-4">{book.description}</p>
      <Link href="/books" className="mt-6 inline-block underline">
        Back to all books
      </Link>
    </article>
  );
}
```

Let us read it slowly:

- Next.js calls your page with a prop called **`params`**. It holds the values of the dynamic segments.
- In Next.js 16, `params` is a **Promise**: a value that will arrive a moment later. So you write `await params` before you can read from it. That is why the component is `async`.
- `const { id } = await params;` takes out the `id`. The name `id` matches the folder name `[id]`.
- `getBook(id)` looks up the book. If it returns `null`, the page shows a friendly message instead of crashing.
- `book.price.toFixed(2)` shows the price with two decimals, so `14.5` becomes `14.50`.

## Step 4: add a loading file

There is one more file to add, because Book Nook uses **Cache Components**. Create `app/books/[id]/loading.js`:

```jsx
// app/books/[id]/loading.js
export default function Loading() {
  return <p className="text-zinc-500">Loading book...</p>;
}
```

Why is this needed? With Cache Components, Next.js prepares as much of each page as it can **before** anyone visits. But for `/books/[id]`, the value of `id` is only known when a visitor asks for a real URL. Reading `params` therefore has to happen inside a "waiting area", so Next.js can send the rest of the page right away and fill in the book a moment later.

A `loading.js` file creates that waiting area for its page. It shows its content while the page waits, then swaps in the real page. Without it, the dev overlay and `npm run build` stop with this error:

```text
Error: Route "/books/[id]": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.
```

Our data is so fast that you will rarely see "Loading book..." at all. You will learn how loading files and `<Suspense>` work in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming), and how to prepare every book page ahead of time in [Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params).

## Step 5: try it

Go to `/books` and click **Dune**. You land on `/books/dune` and see:

```text
Dune
by Frank Herbert

$14.50

A young heir must survive on a desert planet that holds the most precious resource in the universe.

Back to all books
```

Click **Back to all books**, then try another title. One page file, four books. Add a fifth book to the array in `lib/books.js`, and it gets its own page instantly, with no new files.

Now type a made-up address, like `/books/harry-potter`. `getBook` returns `null`, so you see "Sorry, we could not find that book." Later, in [Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects), you will show a proper 404 page instead.

Also notice that **Books** in the header is still underlined on every book page. The `startsWith` check in your header from the last lesson already handles dynamic pages.

## Static segments win

Book Nook already has `app/books/bestsellers/page.js`. So what does `/books/bestsellers` show now: the bestsellers page, or the book page with `id` set to `"bestsellers"`?

```text
app/books/
├── bestsellers/page.js    /books/bestsellers  (exact match)
└── [id]/page.js           /books/anything-else
```

Next.js always prefers an exact, static folder name over a dynamic one. `/books/bestsellers` shows the bestsellers page, and every other `/books/...` URL goes to `[id]`.

## More than one dynamic segment

A URL can have several dynamic parts. Each folder adds one key to `params`:

| File | URL | `params` |
| --- | --- | --- |
| `app/books/[id]/page.js` | `/books/dune` | `{ id: 'dune' }` |
| `app/authors/[author]/books/[id]/page.js` | `/authors/tolkien/books/the-hobbit` | `{ author: 'tolkien', id: 'the-hobbit' }` |

```jsx
// app/authors/[author]/books/[id]/page.js
export default async function AuthorBookPage({ params }) {
  const { author, id } = await params;
  return <h1>{id} by {author}</h1>;
}
```

Values from the URL are always **strings**, even if they look like numbers. `/orders/42` gives `'42'`, not `42`. Use `Number(id)` if you need a number.

Layouts inside a dynamic folder receive `params` too. A file at `app/books/[id]/layout.js` can `await params` to read the same `id`.

## Catch-all segments: [...slug]

Sometimes one page should handle URLs of **any depth**. Imagine a help centre for Book Nook:

```text
/help/shipping
/help/shipping/international
/help/returns/damaged-books
```

Add three dots inside the brackets to make a **catch-all segment**. It catches every remaining part of the URL:

```jsx
// app/help/[...topic]/page.js
export default async function HelpPage({ params }) {
  const { topic } = await params;

  return (
    <section>
      <h1 className="text-3xl font-bold">Help</h1>
      <p className="mt-2 text-zinc-600">{topic.join(' > ')}</p>
    </section>
  );
}
```

With a catch-all, the value is an **array** of strings, one item per URL segment:

| URL | `params` |
| --- | --- |
| `/help/shipping` | `{ topic: ['shipping'] }` |
| `/help/shipping/international` | `{ topic: ['shipping', 'international'] }` |
| `/help/returns/damaged-books` | `{ topic: ['returns', 'damaged-books'] }` |
| `/help` | no match: 404 page |

`topic.join(' > ')` turns `['shipping', 'international']` into `shipping > international`.

Notice the last row: a catch-all needs **at least one** segment, so plain `/help` is not matched. You would add a separate `app/help/page.js` for it, or use the next kind of segment.

## Optional catch-all segments: [[...slug]]

Wrap the catch-all in **double** square brackets, and it also matches the URL with **no** extra segments. Let us use it for a genres page where `/genres` shows every genre, and `/genres/classic` shows the classic books:

```jsx
// app/genres/[[...genre]]/page.js
import Link from 'next/link';
import { getBooks } from '@/lib/books';

export default async function GenresPage({ params }) {
  const { genre } = await params;
  const books = await getBooks();

  // No genre in the URL: list every genre
  if (!genre) {
    const genres = [...new Set(books.map((book) => book.genre))];
    return (
      <section>
        <h1 className="text-3xl font-bold">All genres</h1>
        <ul className="mt-4 space-y-2">
          {genres.map((name) => (
            <li key={name}>
              <Link href={`/genres/${name}`} className="underline">{name}</Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // A genre in the URL: list the books in it
  const matches = books.filter((book) => book.genre === genre[0]);
  return (
    <section>
      <h1 className="text-3xl font-bold">Genre: {genre[0]}</h1>
      <ul className="mt-4 space-y-2">
        {matches.map((book) => (
          <li key={book.id}>
            <Link href={`/books/${book.id}`} className="underline">{book.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

| URL | `params` |
| --- | --- |
| `/genres` | `{ genre: undefined }` |
| `/genres/classic` | `{ genre: ['classic'] }` |
| `/genres/classic/old` | `{ genre: ['classic', 'old'] }` |

When the URL has no extra parts, `genre` is `undefined`, so always check for it before using it. `new Set(...)` removes duplicates, so `classic` appears only once in the list.

Like the book page, both of these pages read `params`, so give each folder a `loading.js` too:

```jsx
// app/genres/[[...genre]]/loading.js
export default function Loading() {
  return <p className="text-zinc-500">Loading...</p>;
}
```

## Quick comparison

| Folder | Matches | `params` value |
| --- | --- | --- |
| `[id]` | exactly one segment | a string |
| `[...topic]` | one or more segments | an array of strings |
| `[[...genre]]` | zero or more segments | an array, or `undefined` |

## Reading params in a Client Component

`params` is mainly for pages and layouts, which are Server Components. If a page itself is a Client Component (with `'use client'`), you cannot use `await` in it. Use React's `use` function to unwrap the Promise instead:

```jsx
// A client page (only when you really need one)
'use client';

import { use } from 'react';

export default function BookPage({ params }) {
  const { id } = use(params);
  return <p>Book: {id}</p>;
}
```

Any other Client Component, deeper in the tree, can read the same values with the `useParams()` hook from `next/navigation`. For Book Nook, keep pages as Server Components and use `await params`.

## Check the build

Run a production build to see how Next.js treats your routes:

```bash
npm run build
```

Near the end, you get a table like this:

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ○ /books
├   /books/[id]
│ └ ◐ /books/[id]
├ ○ /books/bestsellers
├ ○ /cart
├   /genres/[[...genre]]
│ └ ◐ /genres/[[...genre]]
└   /help/[...topic]
  └ ◐ /help/[...topic]

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

`○` pages are built completely ahead of time. `◐` pages are **partially** prepared: the layouts, header and loading message are ready in advance, and the book itself streams in for each visit. That is exactly what your `loading.js` made possible.

## Common mistakes

### Forgetting to await params

```jsx
// Wrong in Next.js 16
export default async function BookPage({ params }) {
  const { id } = params; // params is a Promise, so id is undefined
  const book = await getBook(id);
  // ...
}
```

`params` is a Promise, so `params.id` does not exist. `id` is `undefined`, `getBook` returns `null`, and every book shows "Sorry, we could not find that book." Older tutorials (Next.js 14 and earlier) read `params` directly. Always write `const { id } = await params;`.

### The name does not match the folder

If the folder is `[bookId]` but you write `const { id } = await params;`, `id` is `undefined`. The key in `params` is exactly the text inside the brackets. Rename one of them so they match.

### Missing loading.js with Cache Components

Without a `loading.js` (or your own `<Suspense>`), the build fails with "Next.js encountered uncached or runtime data during prerendering". Add `loading.js` next to every `page.js` that reads `params` from a dynamic segment.

### Treating a catch-all value as a string

With `[...topic]`, `topic` is an **array**. Writing `<h1>{topic.toUpperCase()}</h1>` throws `TypeError: topic.toUpperCase is not a function`. Use `topic[0]` for the first part, or `topic.join('/')` for all of them.

### Forgetting the brackets

A folder called `id` (without brackets) is a static segment. It only matches the literal URL `/books/id`. The square brackets are what make it dynamic.

## Quick recap

- A folder named `[id]` is a **dynamic segment**: one `page.js` handles every value in that spot of the URL.
- The page receives `params`, a **Promise** in Next.js 16. Read it with `const { id } = await params;`. The key matches the folder name.
- `lib/books.js` holds the Book Nook data, with async `getBooks()`, `getBook(id)` and `searchBooks(query)`.
- Link to each book with `` href={`/books/${book.id}`} ``. Static folders like `bestsellers` win over `[id]`.
- With Cache Components on, add a `loading.js` next to dynamic pages that read `params`.
- `[...topic]` catches one or more segments as an array. `[[...genre]]` also matches zero segments, giving `undefined`.
- URL values are always strings. Client Components read params with `use(params)` or `useParams()`.

<code id="code-content" class="language-jsx">
// app/books/[id]/page.js: one page for every book (/books/dune, /books/the-hobbit, ...)
import Link from 'next/link';
import { getBook } from '@/lib/books';
export default async function BookPage({ params }) {
  // params is a Promise in Next.js 16. The key "id" matches the folder name [id].
  const { id } = await params;
  const book = await getBook(id); // null when there is no such book
  if (!book) {
    return &lt;h1 className="text-2xl font-bold"&gt;Sorry, we could not find that book.&lt;/h1&gt;;
  }
  return (
    &lt;article&gt;
      &lt;h1 className="text-3xl font-bold"&gt;{book.title}&lt;/h1&gt;
      &lt;p className="mt-1 text-zinc-600"&gt;by {book.author}&lt;/p&gt;
      &lt;p className="mt-4 text-xl font-semibold"&gt;${book.price.toFixed(2)}&lt;/p&gt;
      &lt;p className="mt-4"&gt;{book.description}&lt;/p&gt;
      &lt;Link href="/books" className="mt-6 inline-block underline"&gt;
        Back to all books
      &lt;/Link&gt;
    &lt;/article&gt;
  );
}
// --- next file: app/books/[id]/loading.js (needed with Cache Components)
// export default function Loading() {
//   return &lt;p className="text-zinc-500"&gt;Loading book...&lt;/p&gt;;
// }
// --- in app/books/page.js, link to each book:
// &lt;Link href={`/books/${book.id}`}&gt;{book.title}&lt;/Link&gt;
// --- catch-all: app/help/[...topic]/page.js gives topic = ['shipping', 'international']
// --- optional catch-all: app/genres/[[...genre]]/page.js gives genre = undefined on /genres
</code></pre>

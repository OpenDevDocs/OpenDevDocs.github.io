---
publishDate: 2026-10-25T13:53
title: "Reading Older Projects: The Pages Router"
slug: pages-router-basics
metadescription: Learn just enough of the Next.js Pages Router to read older projects, from pages/, _app and _document to getStaticProps, getServerSideProps and API routes.
updateDate: 2026-10-25T13:53
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'pages-router', 'getstaticprops', 'migration']
course: nextjs
---

## Two routers, one framework

Everything in this course uses the **App Router**: the `app` folder, Server Components, layouts, `page.js` files. But Next.js had a different router for its first six years, the **Pages Router**, built around a `pages` folder. It is still part of Next.js 16 and still supported, and a huge number of real projects, tutorials and Stack Overflow answers use it.

Sooner or later you will open a project, see a `pages` folder and functions called `getServerSideProps`, and wonder what is going on. This lesson gives you just enough to **read** that code, and to see how each idea maps to what you already know. Think of it as learning to read an older edition of a book: same story, different chapter names.

You will learn:

- how the `pages` folder turns files into routes
- what `_app.js` and `_document.js` do
- the three data functions: `getStaticProps`, `getStaticPaths` and `getServerSideProps`
- API routes in `pages/api`
- a translation table from Pages Router ideas to App Router ideas

## How to tell which router a project uses

Look at the project root:

```text
old-bookshop/
├── pages/            Pages Router
│   ├── _app.js
│   ├── _document.js
│   ├── index.js
│   └── api/
└── app/              App Router (may also be there, see below)
```

A project can have **both** folders. That is how teams move from one router to the other gradually, page by page. Each URL is served by one router only. If both folders claim the same path, the build stops:

```text
Error: App Router and Pages Router both match path: /books/[id]
Next.js does not support having both App Router and Pages Router routes matching the same path. Please remove one of the conflicting routes.
```

## Routing: every file is a page

In the Pages Router, the **file itself** is the route. There is no `page.js` inside folders:

| File | URL |
| --- | --- |
| `pages/index.js` | `/` |
| `pages/about.js` | `/about` |
| `pages/books/index.js` | `/books` |
| `pages/books/[id].js` | `/books/dune`, `/books/the-hobbit` |
| `pages/api/books.js` | `/api/books` (an API route, not a page) |

Compare that with the App Router, where you write `app/about/page.js` and `app/books/[id]/page.js`. Dynamic segments use the same square brackets, as you learned in [Dynamic Routes and params](/courses/nextjs/dynamic-routes).

A page is just a React component exported as default:

```jsx
// pages/about.js
export default function About() {
  return <h1>About Book Nook</h1>;
}
```

Two big differences hide in that small file:

- **There are no Server Components.** Every page and every component in `pages` is shipped to the browser and hydrated, like a Client Component in the App Router. You never write `'use client'` there; it would mean nothing.
- **Components cannot be `async`.** You cannot `await` data inside the component. Data comes from special functions instead (see below) and arrives as **props**.

### Reading the URL: next/router

To read dynamic segments or query strings, Pages Router code uses `useRouter` from **`next/router`**:

```jsx
// pages/books/[id].js
import { useRouter } from 'next/router';

export default function BookPage() {
  const router = useRouter();
  return <p>You are looking at {router.query.id}</p>;
}
```

`router.query` holds both the dynamic segment and the search params, mixed together. In the App Router, the matching tools are `useRouter`, `usePathname`, `useSearchParams` and `useParams` from **`next/navigation`**, and they keep params and search params separate.

### Titles: next/head

There is no `metadata` export in the Pages Router. Pages set their `<title>` and `<meta>` tags with the `Head` component:

```jsx
// pages/about.js
import Head from 'next/head';

export default function About() {
  return (
    <>
      <Head>
        <title>About | Book Nook</title>
        <meta name="description" content="Who we are and why we love books." />
      </Head>
      <h1>About Book Nook</h1>
    </>
  );
}
```

In the App Router you use `export const metadata` or `generateMetadata` instead, from [Page Titles, Descriptions and Metadata](/courses/nextjs/metadata).

## _app.js: the wrapper around every page

`pages/_app.js` is a component that wraps every page. Next.js passes it the current page as `Component`, and that page's data as `pageProps`:

```jsx
// pages/_app.js
import '@/styles/globals.css';
import Header from '@/components/Header';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Header />
      <Component {...pageProps} />
    </>
  );
}
```

- **Global CSS** is imported here, in old projects only here.
- Shared UI like a header lives here, because there are no nested layouts.
- Context providers (theme, cart) wrap `<Component />` here.

When you navigate, `Component` changes to the new page, but `MyApp` stays mounted, so the header keeps its state. That is what the App Router's root `app/layout.js` does for you now.

## _document.js: the HTML shell

`pages/_document.js` controls the outer `<html>` and `<body>` tags. It only runs on the server:

```jsx
// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

- `<Main />` is where the app (`_app.js` plus the page) is rendered.
- `<NextScript />` adds the JavaScript Next.js needs.
- All four pieces are required. The `Head` here comes from `next/document` and is **not** the same as `next/head`: it is only for tags shared by every page.
- No `onClick` or state here: it never runs in the browser.

In the App Router, `_app.js` and `_document.js` are **both** replaced by one root layout that renders `<html>` and `<body>` itself (see [Templates and the Root Layout in Depth](/courses/nextjs/templates-and-root-layout)).

## Getting data, the Pages Router way

Since page components cannot fetch data themselves, a page file can export **one** special server function next to the component. Next.js runs it on the server and passes the result to the component as props. The function's code is removed from the browser bundle, so it can talk to a database directly.

### getStaticProps: data at build time

```jsx
// pages/books/index.js
import Link from 'next/link';
import { getBooks } from '@/lib/books';

export async function getStaticProps() {
  const books = await getBooks();
  return {
    props: { books },
    revalidate: 3600, // optional: rebuild this page in the background at most once an hour
  };
}

export default function BooksPage({ books }) {
  return (
    <ul>
      {books.map((book) => (
        <li key={book.id}>
          <Link href={`/books/${book.id}`}>{book.title}</Link>
        </li>
      ))}
    </ul>
  );
}
```

- `getBooks` here stands for whatever data helper the old project has. (Book Nook's own `lib/books.js` uses `'use cache'`, which is an App Router feature.)
- `getStaticProps` runs during `next build`. The page is saved as static HTML, like a prerendered page in the App Router.
- It must return an object with `props` (or `notFound: true`, or a `redirect`).
- `revalidate` turns on **ISR** (Incremental Static Regeneration): after that many seconds, the next visit triggers a fresh rebuild in the background. In the App Router you get this with `'use cache'` and `cacheLife`, from [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation).
- Everything in `props` is put into the HTML as JSON so the browser can hydrate the page. Never pass secrets through props.

### getStaticPaths: which dynamic pages to build

A dynamic page like `pages/books/[id].js` that uses `getStaticProps` also needs `getStaticPaths`, to say which ids to build:

```jsx
// pages/books/[id].js
import { getBook, getBooks } from '@/lib/books';

export async function getStaticPaths() {
  const books = await getBooks();
  return {
    paths: books.map((book) => ({ params: { id: book.id } })),
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const book = await getBook(params.id);
  if (!book) {
    return { notFound: true };
  }
  return { props: { book }, revalidate: 3600 };
}

export default function BookPage({ book }) {
  return (
    <main>
      <h1>{book.title}</h1>
      <p>by {book.author}</p>
    </main>
  );
}
```

- `paths` lists the pages to build ahead of time, each as `{ params: { id } }`.
- `fallback` decides what happens for ids not in the list: `false` means 404, `'blocking'` means build it on the first visit, and `true` shows a loading version first.
- Note that `params` here is a **plain object**, not a Promise. Only the App Router made params async.

The App Router equivalent is `generateStaticParams`, which simply returns `[{ id: 'dune' }, ...]` (see [Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params)).

The build output of an older project shows these pages with a filled circle:

```text
Route (pages)                      Revalidate  Expire
└   /shop/[id] (321 ms)                    1h      1y
  └ ● /shop/dune (321 ms)
```

### getServerSideProps: data on every request

When a page must be fresh for every visit, or depends on the visitor (cookies, headers), old code uses `getServerSideProps`:

```jsx
// pages/cart.js
export async function getServerSideProps({ req, query }) {
  const cartId = req.cookies.cartId ?? null;
  const items = cartId ? await getCartItems(cartId) : [];
  return {
    props: { items, from: query.from ?? null },
  };
}

export default function CartPage({ items }) {
  return <p>You have {items.length} books in your cart.</p>;
}
```

- It runs on the server for **every** request, before the page renders.
- Its argument (the **context**) includes `params`, `query` (search params), `req` and `res` (the raw Node.js request and response), so it can read cookies and headers.
- A page cannot export both `getServerSideProps` and `getStaticProps`.

In the App Router, a component simply `await`s `cookies()` from `next/headers` or `searchParams`, inside `<Suspense>`, as you did in [Reading Cookies and Headers](/courses/nextjs/cookies-and-headers).

> **Good to know:** You may also see `getInitialProps` in very old code (on pages or on `_app.js`). It is the oldest data method of all. The docs advise against it today; treat it like `getServerSideProps` when reading.

## API routes: pages/api

Files in `pages/api` are server-only endpoints. Each exports one default function that receives `req` and `res`:

```javascript
// pages/api/books.js
import { getBooks } from '@/lib/books';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const books = await getBooks();
  res.status(200).json(books);
}
```

- **One function handles every method.** You check `req.method` yourself.
- `req.query`, `req.cookies` and `req.body` are parsed for you.
- You answer with `res.status(...).json(...)` instead of returning a `Response`.

The App Router replacement is a Route Handler, `app/api/books/route.js`, with a separate exported function per method (`export async function GET()`) that returns `Response.json(books)`. See [Building APIs with Route Handlers](/courses/nextjs/route-handlers).

## The translation table

Keep this table nearby when you read an older project:

| Pages Router | App Router |
| --- | --- |
| `pages/about.js` | `app/about/page.js` |
| `pages/books/[id].js` | `app/books/[id]/page.js` |
| `pages/_app.js` and `pages/_document.js` | `app/layout.js` (root layout) |
| Shared layout pattern in `_app.js` | Nested `layout.js` files |
| `pages/404.js` | `app/not-found.js` |
| `pages/_error.js` | `error.js` files |
| `next/head` | `metadata` and `generateMetadata` |
| `useRouter` from `next/router` | `useRouter`, `usePathname`, `useSearchParams`, `useParams` from `next/navigation` |
| `getStaticProps` | An `async` Server Component (cached with `'use cache'`) |
| `getStaticProps` with `revalidate` | `'use cache'` with `cacheLife` |
| `getStaticPaths` | `generateStaticParams` |
| `getServerSideProps` | An `async` Server Component that reads request data inside `<Suspense>` |
| `pages/api/books.js` | `app/api/books/route.js` |
| Every component is hydrated | Server Components by default, `'use client'` where needed |

## Side by side: one book page, two routers

Pages Router:

```jsx
// pages/books/[id].js
import Head from 'next/head';
import { getBook, getBooks } from '@/lib/books';

export async function getStaticPaths() {
  const books = await getBooks();
  return { paths: books.map((b) => ({ params: { id: b.id } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const book = await getBook(params.id);
  if (!book) return { notFound: true };
  return { props: { book } };
}

export default function BookPage({ book }) {
  return (
    <>
      <Head>
        <title>{`${book.title} | Book Nook`}</title>
      </Head>
      <h1>{book.title}</h1>
    </>
  );
}
```

App Router (what you wrote in this course):

```jsx
// app/books/[id]/page.js
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books';

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  return { title: book?.title ?? 'Book not found' };
}

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();
  return <h1>{book.title}</h1>;
}
```

The App Router version has no "props hand-off" step: the component fetches what it needs itself, and nothing about the data fetching is sent to the browser.

## Should you convert an old project?

Not necessarily. The Pages Router works fine and is still maintained. If you do move, do it gradually: create an `app` folder next to `pages`, move one route at a time, and delete the old file as each new one goes live. Links between pages served by different routers do a full page load rather than a fast client-side navigation, which is fine during a migration. The official [App Router migration guide](https://nextjs.org/docs/app/guides/migrating/app-router-migration) covers every step.

## Common mistakes

### Using next/router in the app folder

```text
Error: NextRouter was not mounted.
```

`next/router` only works in `pages`. In the `app` folder, import `useRouter` from `next/navigation`.

### Exporting getServerSideProps from a component file

These functions only work in files inside `pages`. In `components/BookCard.js` they are just unused functions, and the component never gets its props. Fetch in the page and pass the data down.

### Expecting params to be a Promise

In `getStaticProps({ params })` and `getServerSideProps({ params })`, `params` is a plain object. `params.id` is correct there. Only App Router code needs `await params`.

### Same route in both folders

Having `pages/books/[id].js` and `app/books/[id]/page.js` at the same time fails the build with "App Router and Pages Router both match path". Delete the old file once the new one works.

## Quick recap

- The Pages Router uses a `pages` folder where every file is a route. It still works in Next.js 16 and can live next to `app`.
- `_app.js` wraps every page (global CSS, shared header, providers) and `_document.js` renders the `<html>` shell. Both became the root `layout.js`.
- Pages are hydrated in the browser and cannot be `async`. Data arrives as props from `getStaticProps` (build time, optional `revalidate`), `getStaticPaths` (which dynamic pages to build) or `getServerSideProps` (every request).
- `params` in these functions is a plain object, not a Promise.
- `pages/api/*.js` exports one `handler(req, res)` for all methods. The App Router uses `route.js` with one function per method.
- `next/router` and `next/head` belong to the Pages Router. The App Router uses `next/navigation` and the Metadata API.

<code id="code-content" class="language-jsx">
// pages/books/[id].js: a Book Nook book page written for the Pages Router
import Head from 'next/head';
import { getBook, getBooks } from '@/lib/books';
// Which ids to build at "next build" (App Router: generateStaticParams)
export async function getStaticPaths() {
  const books = await getBooks();
  return {
    paths: books.map((book) =&gt; ({ params: { id: book.id } })),
    fallback: 'blocking', // unknown ids are built on their first visit
  };
}
// Runs on the server only; the result becomes the page's props
export async function getStaticProps({ params }) {
  const book = await getBook(params.id); // params is a plain object here
  if (!book) {
    return { notFound: true };
  }
  return { props: { book }, revalidate: 3600 }; // ISR: refresh at most hourly
}
// The page cannot be async: it just receives props
export default function BookPage({ book }) {
  return (
    &lt;&gt;
      &lt;Head&gt;
        &lt;title&gt;{`${book.title} | Book Nook`}&lt;/title&gt;
      &lt;/Head&gt;
      &lt;h1&gt;{book.title}&lt;/h1&gt;
      &lt;p&gt;by {book.author}&lt;/p&gt;
    &lt;/&gt;
  );
}
// --- next file: pages/api/books.js (App Router: app/api/books/route.js)
// export default async function handler(req, res) {
//   if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
//   res.status(200).json(await getBooks());
// }
</code></pre>

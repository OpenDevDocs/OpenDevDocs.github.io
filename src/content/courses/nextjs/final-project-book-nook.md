---
publishDate: 2026-10-25T14:02
title: "Final Project: The Book Nook Store"
slug: final-project-book-nook
metadescription: Build the complete Book Nook store in Next.js 16 with Postgres, search, a cart, cached pages, reviews, admin login, SEO and a real production build.
updateDate: 2026-10-25T14:02
author: ['bishal-biswas']
level: 4
tags: ['nextjs', 'project', 'full-stack', 'capstone']
course: nextjs
---

## What you are about to build

This is the big one. Over the whole course you built Book Nook piece by piece, one lesson at a time. Now you will build the **complete store in one go**, from an empty folder to a production build, so you can see how all the pieces fit together.

When you finish, Book Nook will have:

- A **home page** with staff picks and an **about** page.
- A **book list** at `/books` with a **search box** that uses the URL (`/books?q=dune`).
- A **page for every book** at `/books/[id]`, with its own title and description for search engines.
- A **shopping cart** that remembers books while you browse, shared through a React context.
- **Reviews**: a form that saves to the database through a Server Action, checks the input with Zod, shows errors with `useActionState`, and appears on the page straight away.
- **Caching**: the book list and book pages are cached with `'use cache'` and `cacheTag`, and refreshed with `updateTag` after every change.
- An **admin area** behind a login, protected by a Data Access Layer, where the shop owner can change prices.
- **SEO**: page titles, a `sitemap.xml` and a `robots.txt`.
- A small **JSON API** at `/api/books`.

Think of this lesson as the full recipe after a cooking course. You have already practised each technique. Now you cook the whole meal, in the right order, and every step links back to the lesson where you learned it, in case you want a refresher.

The code in this lesson was built and tested for real with Next.js 16.4.3: it passes `next build`, ESLint, the Vitest unit tests and the Playwright end-to-end tests from the testing lessons.

Here is the finished project. Do not worry, you will create every file step by step:

```text
book-nook/
├── app/
│   ├── (auth)/login/page.js     /login
│   ├── about/page.js            /about
│   ├── actions.js               Server Action: createReview
│   ├── actions/auth.js          Server Actions: login, logout
│   ├── admin/
│   │   ├── actions.js           Server Action: updatePrice
│   │   └── page.js              /admin (protected)
│   ├── api/books/route.js       /api/books
│   ├── books/
│   │   ├── [id]/
│   │   │   ├── loading.js
│   │   │   └── page.js          /books/the-hobbit, /books/dune, ...
│   │   └── page.js              /books and /books?q=...
│   ├── cart/page.js             /cart
│   ├── globals.css
│   ├── layout.js
│   ├── not-found.js
│   ├── page.js                  /
│   ├── robots.js                /robots.txt
│   └── sitemap.js               /sitemap.xml
├── components/
│   ├── AddToCartButton.js
│   ├── BookCard.js
│   ├── CartContents.js
│   ├── CartCount.js
│   ├── CartProvider.js
│   ├── Header.js
│   ├── LoginForm.js
│   └── ReviewForm.js
├── db/schema.sql
├── lib/
│   ├── books.js                 the data layer for books
│   ├── cart.js                  plain cart helpers
│   ├── dal.js                   the Data Access Layer for sessions
│   ├── db.js                    the Postgres connection
│   ├── reviews.js               the data layer for reviews
│   ├── session.js               signed session cookies
│   └── users.js                 demo users
├── .env.local
└── next.config.mjs
```

## Step 1: create the project

You need Node.js 20.9 or newer (see [Setting Up Your Computer for Next.js](/courses/nextjs/setting-up-your-computer)). Create the project with the same settings as the rest of the course, as in [Creating Your First Next.js App](/courses/nextjs/create-your-first-app):

```bash
npx create-next-app@latest book-nook --js --tailwind --eslint --app --cache-components --no-src-dir --import-alias "@/*" --no-react-compiler --no-agents-md
cd book-nook
```

Then install the extra packages the store needs:

```bash
npm install pg zod jose bcryptjs
```

- `pg` talks to Postgres ([Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database)).
- `zod` checks form input ([Validating Forms and Showing Errors](/courses/nextjs/form-validation)).
- `jose` signs the session cookie, and `bcryptjs` checks hashed passwords ([Adding Login with Sessions and Cookies](/courses/nextjs/authentication)).

Open `next.config.mjs`. `create-next-app` already turned on Cache Components. Add the one-line CSS Modules fix from [Global CSS and CSS Modules](/courses/nextjs/global-css-and-css-modules), so the Tailwind loader skips `.module.css` files:

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
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

`cacheComponents: true` is what makes `'use cache'`, `cacheTag` and `updateTag` work, and turns on Partial Prerendering for every page ([Caching with Cache Components and use cache](/courses/nextjs/use-cache)).

## Step 2: the database

Book Nook keeps its books and reviews in **Postgres**. Create a free hosted database (Neon and Supabase both work) or install Postgres locally, exactly as in the data layer lesson. Then run this SQL once in your database's SQL editor:

```sql
-- db/schema.sql: run once in your database's SQL editor
CREATE TABLE IF NOT EXISTS books (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  author      text NOT NULL,
  price       numeric(6, 2) NOT NULL,
  genre       text NOT NULL,
  cover       text NOT NULL,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id         serial PRIMARY KEY,
  book_id    text NOT NULL REFERENCES books(id),
  name       text NOT NULL,
  rating     integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO books (id, title, author, price, genre, cover, description) VALUES
  ('the-hobbit', 'The Hobbit', 'J.R.R. Tolkien', 12.99, 'fantasy', '/covers/the-hobbit.jpg', 'Bilbo Baggins leaves his cosy home for an adventure with dwarves and a dragon.'),
  ('pride-and-prejudice', 'Pride and Prejudice', 'Jane Austen', 9.99, 'classic', '/covers/pride-and-prejudice.jpg', 'Elizabeth Bennet and Mr Darcy learn that first impressions can be wrong.'),
  ('dune', 'Dune', 'Frank Herbert', 14.50, 'science-fiction', '/covers/dune.jpg', 'A young heir must survive on a desert planet that holds the most precious resource in the universe.'),
  ('the-little-prince', 'The Little Prince', 'Antoine de Saint-Exupery', 8.75, 'classic', '/covers/the-little-prince.jpg', 'A pilot stranded in the desert meets a little prince from a tiny planet.')
ON CONFLICT (id) DO NOTHING;
```

The `reviews` table is new: each review belongs to a book (`REFERENCES books(id)`), and the database itself refuses ratings outside 1 to 5.

Now create `.env.local` in the project root. Use your own connection string, and make a long random secret ([Environment Variables](/courses/nextjs/environment-variables)):

```text
DATABASE_URL=postgres://bookshop:replace-with-your-password@your-database-host/booknook?sslmode=require
SESSION_SECRET=replace-with-a-long-random-string-at-least-32-characters
SITE_URL=http://localhost:3000
```

A quick way to make a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. None of these variables start with `NEXT_PUBLIC_`, so they never reach the browser.

The connection lives in one small file, the same one you wrote in the data layer lesson:

```javascript
// lib/db.js
import 'server-only';
import { Pool, types } from 'pg';

// Postgres sends numeric columns (like price) as strings. Turn them into numbers.
types.setTypeParser(types.builtins.NUMERIC, (value) => parseFloat(value));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Add it to .env.local');
}

// Reuse one pool, even when the dev server reloads this file
const pool = globalThis.bookNookPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== 'production') {
  globalThis.bookNookPool = pool;
}

export const db = {
  async query(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
  },
};
```

## Step 3: the data layer

Every page talks to `lib/`, never to the database directly. First the books. All the functions are `async`, and the two that every visitor needs are **cached**:

```javascript
// lib/books.js: the only place that reads and writes books
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { db } from './db';

export async function getBooks() {
  'use cache';
  cacheLife('hours');
  cacheTag('books');
  return db.query('SELECT * FROM books ORDER BY title');
}

export async function getBook(id) {
  'use cache';
  cacheLife('days');
  cacheTag('books', `book-${id}`);
  const rows = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Not cached: every search term is different, and results must be fresh
export async function searchBooks(query) {
  return db.query(
    'SELECT * FROM books WHERE title ILIKE $1 OR author ILIKE $1 ORDER BY title',
    [`%${query}%`]
  );
}

export async function updateBookPrice(id, price) {
  await db.query('UPDATE books SET price = $1 WHERE id = $2', [price, id]);
}
```

How the caching works ([Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)):

- `'use cache'` stores the result, so the database is not asked again for every visitor.
- `cacheLife('hours')` and `cacheLife('days')` say how long a result may be reused before Next.js refreshes it in the background.
- `cacheTag('books')` puts a label on the result. Later, `updateTag('books')` throws away everything with that label at once. `getBook` gets two labels, so we can refresh one book, or all of them.
- `searchBooks` is **not** cached: every search term is different, and the results must be fresh. Notice the `$1`: user input is never glued into SQL text.

Reviews get their own small data layer, with one tag per book:

```javascript
// lib/reviews.js
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { db } from './db';

export async function getReviews(bookId) {
  'use cache';
  cacheLife('days');
  cacheTag(`reviews-${bookId}`);
  return db.query(
    'SELECT id, name, rating, text FROM reviews WHERE book_id = $1 ORDER BY created_at DESC',
    [bookId]
  );
}

export async function addReview({ bookId, name, rating, text }) {
  await db.query(
    'INSERT INTO reviews (book_id, name, rating, text) VALUES ($1, $2, $3, $4)',
    [bookId, name, rating, text]
  );
}
```

Both files start with `import 'server-only'`, so if a Client Component ever imports them by accident, the build fails instead of leaking server code.

## Step 4: the cart logic, the provider and the header

The cart lives in the browser, so it is client state ([State, Context and Providers in Next.js](/courses/nextjs/state-context-and-providers)). The logic itself sits in plain functions with no React, which makes it easy to unit test ([Unit Testing with Vitest](/courses/nextjs/testing-with-vitest)):

```javascript
// lib/cart.js: plain cart helpers with no React, easy to unit test
export function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

export function addItem(items, book) {
  const existing = items.find((item) => item.id === book.id);
  if (existing) {
    return items.map((item) => (item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item));
  }
  return [...items, { id: book.id, title: book.title, price: book.price, quantity: 1 }];
}

export function removeItem(items, id) {
  return items.filter((item) => item.id !== id);
}

export function cartTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function cartCount(items) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
```

The provider keeps the cart in state and shares it through context. React 19 lets you render `<CartContext value={...}>` directly:

```jsx
// components/CartProvider.js
'use client';

import { createContext, useContext, useState } from 'react';
import { addItem, removeItem, cartCount, cartTotal } from '@/lib/cart';

const CartContext = createContext(null);

export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  function addToCart(book) {
    setItems((current) => addItem(current, book));
  }

  function removeFromCart(id) {
    setItems((current) => removeItem(current, id));
  }

  const count = cartCount(items);
  const total = cartTotal(items);

  return (
    <CartContext value={{ items, count, total, addToCart, removeFromCart }}>
      {children}
    </CartContext>
  );
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return cart;
}
```

The header shows the number of books in the cart:

```jsx
// components/CartCount.js
'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartCount() {
  const { count } = useCart();
  return <Link href="/cart">Cart ({count})</Link>;
}
```

And the header itself highlights the current section with `usePathname` ([Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating)):

```jsx
// components/Header.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CartCount from './CartCount';

const links = [
  { href: '/books', label: 'Books' },
  { href: '/about', label: 'About' },
  { href: '/admin', label: 'Admin' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b px-6 py-4">
      <nav className="mx-auto flex max-w-3xl gap-6">
        <Link href="/" className="font-bold">Book Nook</Link>
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? 'font-semibold underline' : 'text-zinc-600'}
            >
              {link.label}
            </Link>
          );
        })}
        <span className="ml-auto">
          <CartCount />
        </span>
      </nav>
    </header>
  );
}
```

Now the root layout puts it all together ([Pages and Layouts](/courses/nextjs/pages-and-layouts) and [Page Titles, Descriptions and Metadata](/courses/nextjs/metadata)):

```jsx
// app/layout.js
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import CartProvider from '@/components/CartProvider';
import Header from '@/components/Header';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Book Nook',
    template: '%s | Book Nook',
  },
  description: 'A small online bookshop for big stories.',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <Suspense fallback={<header className="border-b px-6 py-4 font-bold">Book Nook</header>}>
            <Header />
          </Suspense>
          <main className="mx-auto w-full max-w-3xl flex-1 p-8">{children}</main>
          <footer className="border-t px-6 py-4 text-sm text-zinc-500">
            Book Nook: a small shop for big stories.
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
```

Four things to notice:

- `CartProvider` wraps everything, so every page and the header share one cart. It is a Client Component, but the pages inside it stay Server Components, because they are passed in as `children` ([Mixing Server and Client Components](/courses/nextjs/server-client-boundary)).
- `Header` reads the URL with `usePathname`. With Cache Components, reading the URL outside `<Suspense>` would stop the build, so the header sits inside a boundary with a simple fallback.
- `metadataBase` lets relative URLs in metadata become full URLs, and the title `template` turns a page title like `Dune` into `Dune | Book Nook`.
- The layout owns `<main>`, so every page below uses `<section>` as its top element.

## Step 5: the home and about pages

A small reusable card shows one book. It is a Server Component: it has no state and no clicks.

```jsx
// components/BookCard.js
import Link from 'next/link';
import { formatPrice } from '@/lib/cart';

export default function BookCard({ book }) {
  return (
    <li className="rounded border p-4">
      <Link href={`/books/${book.id}`} className="text-lg font-semibold underline">
        {book.title}
      </Link>
      <p className="text-zinc-600">by {book.author}</p>
      <p className="mt-2 font-semibold">{formatPrice(book.price)}</p>
    </li>
  );
}
```

The home page shows two staff picks. Because `getBooks()` is cached, the whole page can be prerendered at build time ([Fetching Data in Server Components](/courses/nextjs/fetching-data)):

```jsx
// app/page.js
import Link from 'next/link';
import BookCard from '@/components/BookCard';
import { getBooks } from '@/lib/books';

export default async function HomePage() {
  const books = await getBooks(); // cached, so this page is prerendered
  const staffPicks = books.slice(0, 2);

  return (
    <section>
      <h1 className="text-3xl font-bold">Welcome to Book Nook</h1>
      <p className="mt-2 text-zinc-600">A small shop for big stories.</p>
      <h2 className="mt-8 text-xl font-semibold">Staff picks</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {staffPicks.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </ul>
      <Link href="/books" className="mt-6 inline-block underline">See all books</Link>
    </section>
  );
}
```

The about page is plain content with its own metadata:

```jsx
// app/about/page.js
export const metadata = {
  title: 'About',
  description: 'Who runs Book Nook and why.',
};

export default function AboutPage() {
  return (
    <section>
      <h1 className="text-3xl font-bold">About Book Nook</h1>
      <p className="mt-2">We are a tiny bookshop that loves classic stories.</p>
    </section>
  );
}
```

## Step 6: the book list with search

The book list uses the Next.js `<Form>` component, which updates the URL to `/books?q=...` and navigates without a full page reload ([Search Forms with the Form Component](/courses/nextjs/search-with-next-form)):

```jsx
// app/books/page.js
import { Suspense } from 'react';
import Form from 'next/form';
import BookCard from '@/components/BookCard';
import { getBooks, searchBooks } from '@/lib/books';

export const metadata = {
  title: 'All books',
  description: 'Browse and search every book in the Book Nook shop.',
};

export default function BooksPage({ searchParams }) {
  return (
    <section>
      <h1 className="text-3xl font-bold">All books</h1>
      <Form action="/books" className="mt-4 flex gap-2">
        <input
          name="q"
          placeholder="Search by title or author"
          className="flex-1 rounded border px-3 py-2"
        />
        <button className="rounded bg-zinc-800 px-4 py-2 text-white">Search</button>
      </Form>
      <Suspense fallback={<p className="mt-6">Loading books...</p>}>
        <BookResults searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function BookResults({ searchParams }) {
  const { q = '' } = await searchParams;
  const books = q ? await searchBooks(q) : await getBooks();

  if (books.length === 0) {
    return <p className="mt-6">No books match &quot;{q}&quot;.</p>;
  }

  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </ul>
  );
}
```

Why is the list in its own `BookResults` component? `searchParams` is request data: it is different for every visitor. With Cache Components, request data must be read inside `<Suspense>`. So the heading and the search box are prerendered into a **static shell**, and only the results stream in for each request ([Reading Search Params from the URL](/courses/nextjs/search-params) and [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering)).

## Step 7: a page for every book

The add-to-cart button is a small Client Component. It changes its label after a click, so shoppers know it worked:

```jsx
// components/AddToCartButton.js
'use client';

import { useState } from 'react';
import { useCart } from './CartProvider';

export default function AddToCartButton({ book }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addToCart(book);
    setAdded(true);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800"
    >
      {added ? 'Added! Add another' : 'Add to cart'}
    </button>
  );
}
```

The book page brings together dynamic routes, `generateStaticParams`, `generateMetadata`, `notFound()` and cached data:

```jsx
// app/books/[id]/page.js
import { notFound } from 'next/navigation';
import AddToCartButton from '@/components/AddToCartButton';
import ReviewForm from '@/components/ReviewForm';
import { getBook, getBooks } from '@/lib/books';
import { getReviews } from '@/lib/reviews';
import { formatPrice } from '@/lib/cart';

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) {
    return { title: 'Book not found' };
  }
  return {
    title: book.title,
    description: book.description,
  };
}

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) {
    notFound();
  }
  const reviews = await getReviews(id);

  return (
    <section>
      <h1 className="text-3xl font-bold">{book.title}</h1>
      <p className="text-zinc-600">by {book.author}</p>
      <p className="mt-4">{book.description}</p>
      <p className="mt-4 text-xl font-semibold">{formatPrice(book.price)}</p>
      <div className="mt-4">
        <AddToCartButton book={book} />
      </div>

      <h2 className="mt-10 text-xl font-semibold">Reviews</h2>
      {reviews.length === 0 && <p className="mt-2">No reviews yet. Be the first!</p>}
      <ul className="mt-2 space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="rounded border p-3">
            <p className="font-semibold">{review.name}: {review.rating} out of 5</p>
            <p>{review.text}</p>
          </li>
        ))}
      </ul>
      <ReviewForm bookId={book.id} />
    </section>
  );
}
```

- `generateStaticParams` tells the build which ids exist, so every current book is prerendered as complete HTML ([Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params)).
- `generateMetadata` gives each page its own `<title>` and description, which the layout's template turns into `Dune | Book Nook`.
- `params` is a Promise in Next.js 16, so we `await` it ([Dynamic Routes and params](/courses/nextjs/dynamic-routes)).
- `notFound()` shows `app/not-found.js` for an unknown id ([Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects)).

Reading `params` is request data too. For a book that was added after the build, Next.js needs something to show while it renders the page. That is the job of `loading.js`, which wraps the page in a Suspense boundary for you ([Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming)):

```jsx
// app/books/[id]/loading.js
export default function Loading() {
  return <p>Loading book...</p>;
}
```

Without it, `next dev` warns that `params` is "accessed outside of `<Suspense>`".

## Step 8: the cart page

The cart page is a Server Component that renders one Client Component, which reads the cart context:

```jsx
// components/CartContents.js
'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';
import { formatPrice } from '@/lib/cart';

export default function CartContents() {
  const { items, total, removeFromCart } = useCart();

  if (items.length === 0) {
    return (
      <p className="mt-4">
        Your cart is empty. <Link href="/books" className="underline">Find a book</Link>.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded border p-3">
            <span>{item.title} x {item.quantity}</span>
            <span className="flex items-center gap-4">
              {formatPrice(item.price * item.quantity)}
              <button onClick={() => removeFromCart(item.id)} className="text-sm underline">
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xl font-semibold">Total: {formatPrice(total)}</p>
    </div>
  );
}
```

```jsx
// app/cart/page.js
import CartContents from '@/components/CartContents';

export const metadata = {
  title: 'Your cart',
};

export default function CartPage() {
  return (
    <section>
      <h1 className="text-3xl font-bold">Your cart</h1>
      <CartContents />
    </section>
  );
}
```

Try it now: run `npm run dev`, add a book or two, and watch the count in the header go up. Then open the cart and remove one.

## Step 9: reviews with a Server Action

Now the shop can **change** data. The review form sends its data to a Server Action that validates it with Zod 4, saves it, and refreshes the cache ([Server Functions and Server Actions](/courses/nextjs/server-actions) and [Validating Forms and Showing Errors](/courses/nextjs/form-validation)):

```javascript
// app/actions.js
'use server';

import * as z from 'zod';
import { updateTag } from 'next/cache';
import { getBook } from '@/lib/books';
import { addReview } from '@/lib/reviews';

const reviewSchema = z.object({
  name: z.string().trim().min(2, { error: 'Please enter your name (2 letters or more).' }),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10, { error: 'Your review needs at least 10 characters.' }).max(500),
});

// Called by useActionState as createReview(bookId, previousState, formData)
export async function createReview(bookId, prevState, formData) {
  const values = {
    name: formData.get('name'),
    rating: formData.get('rating'),
    text: formData.get('text'),
  };

  const result = reviewSchema.safeParse(values);
  if (!result.success) {
    return {
      errors: z.flattenError(result.error).fieldErrors,
      values, // send the typed text back so the form can show it again
      message: 'Please fix the errors below.',
    };
  }

  // Never trust the bookId just because it came from our own form
  const book = await getBook(bookId);
  if (!book) {
    return { errors: {}, values, message: 'That book does not exist.' };
  }

  await addReview({ bookId, ...result.data });
  updateTag(`reviews-${bookId}`); // the book page shows the new review straight away

  return { errors: {}, values: {}, message: 'Thanks! Your review is live.' };
}
```

Step by step:

1. `'use server'` at the top makes every export a Server Action: the browser can call it, but it always runs on the server.
2. The action receives `bookId` first (we will `bind` it), then the previous state and the form data, because the form uses `useActionState`.
3. `reviewSchema.safeParse` checks every field. On failure we return the errors **and** the typed values. React 19 resets a form after its action runs, so without `values` the visitor would lose everything they typed.
4. We check that the book really exists. Never trust data just because it came from your own form: anyone can send a request to a Server Action.
5. `updateTag` throws away the cached reviews for this one book, so the new review shows on the page at once.

The form is a Client Component, because `useActionState` is a hook ([Pending States and Optimistic Updates](/courses/nextjs/pending-and-optimistic-ui)):

```jsx
// components/ReviewForm.js
'use client';

import { useActionState } from 'react';
import { createReview } from '@/app/actions';

const initialState = { errors: {}, values: {}, message: '' };

export default function ReviewForm({ bookId }) {
  // bind() fixes the first argument, so the action knows which book this is for
  const createReviewForBook = createReview.bind(null, bookId);
  const [state, formAction, isPending] = useActionState(createReviewForBook, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-3 rounded border p-4">
      <h3 className="font-semibold">Write a review</h3>

      <label className="block">
        Your name
        <input name="name" defaultValue={state.values?.name} className="mt-1 block w-full rounded border px-2 py-1" />
      </label>
      {state.errors?.name && <p className="text-sm text-red-600">{state.errors.name[0]}</p>}

      <label className="block">
        Rating
        <select name="rating" defaultValue={state.values?.rating ?? '5'} className="mt-1 block rounded border px-2 py-1">
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1</option>
        </select>
      </label>

      <label className="block">
        Review
        <textarea name="text" rows={3} defaultValue={state.values?.text} className="mt-1 block w-full rounded border px-2 py-1" />
      </label>
      {state.errors?.text && <p className="text-sm text-red-600">{state.errors.text[0]}</p>}

      <button disabled={isPending} className="rounded bg-zinc-800 px-4 py-2 text-white disabled:opacity-50">
        {isPending ? 'Sending...' : 'Post review'}
      </button>
      {state.message && <p aria-live="polite">{state.message}</p>}
    </form>
  );
}
```

`createReview.bind(null, bookId)` makes a new function with the first argument already filled in. `isPending` is `true` while the action runs, so the button can say "Sending..." and avoid double posts. Each input has a `<label>`, which helps screen readers (and Playwright's `getByLabel`).

Try it: post a review with a two-letter comment, read the error, fix it, and post again. Your name stays in the box, and the review appears in the list.

## Step 10: log in

The admin area needs a login. Four files are **exactly** the ones you wrote in [Adding Login with Sessions and Cookies](/courses/nextjs/authentication), so copy them from that lesson without changes:

- `lib/users.js`: two demo users, `reader@booknook.test` (role `customer`) and `admin@booknook.test` (role `admin`), with passwords hashed by `bcryptjs`, plus `findUserByEmail(email)` and `findUserById(id)`. A real shop would keep users in the database.
- `lib/session.js`: `encrypt` and `decrypt` sign and check a JWT with `jose` and your `SESSION_SECRET`; `createSession(user)` stores `{ userId, role }` in an `httpOnly` cookie called `session` for seven days, and `deleteSession()` removes it.
- `app/actions/auth.js`: the `login(prevState, formData)` Server Action validates the email and password with Zod, compares the password with `bcrypt.compare`, calls `createSession(user)` and redirects admins to `/admin` and customers to `/books`. `logout()` deletes the session and redirects home.
- `components/LoginForm.js`: a Client Component that calls `login` through `useActionState` and shows field errors, with inputs labelled **Email** and **Password** and a **Log in** button.

Here is the heart of the session file, as a reminder of what the cookie holds:

```javascript
// lib/session.js (part)
export async function createSession(user) {
  const expiresAt = new Date(Date.now() + SEVEN_DAYS);
  const token = await encrypt({ userId: user.id, role: user.role });

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}
```

The **Data Access Layer** is the one place that answers "who is asking?". Pages and actions call it; they never read the cookie themselves ([Protecting Pages, Actions and APIs](/courses/nextjs/authorization)):

```javascript
// lib/dal.js: the Data Access Layer for "who is asking?"
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decrypt } from '@/lib/session';
import { findUserById } from '@/lib/users';

// Who is this? Returns { userId, role } or null. Never throws, never redirects.
export const getSession = cache(async () => {
  const token = (await cookies()).get('session')?.value;
  const payload = await decrypt(token);
  if (!payload?.userId) return null;

  // The user must still exist, and the role comes from our data, not the cookie
  const user = await findUserById(payload.userId);
  if (!user) return null;

  return { userId: user.id, role: user.role };
});

// For pages and actions: a logged-in user, or off to the login page
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
});

// For admin pages and actions: an admin, or back to the shop
export const requireAdmin = cache(async () => {
  const session = await verifySession();
  if (session.role !== 'admin') redirect('/');
  return session;
});
```

React's `cache` makes sure the cookie is checked only once per request, even if several components ask. `requireAdmin` builds on `verifySession`: strangers go to `/login`, logged-in customers go back to the shop.

The login page lives in a **route group** called `(auth)`. The brackets keep the folder name out of the URL, so the page is still `/login` ([Route Groups and Private Folders](/courses/nextjs/route-groups-and-private-folders)):

```jsx
// app/(auth)/login/page.js
import LoginForm from '@/components/LoginForm';

export const metadata = {
  title: 'Log in',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <section>
      <h1 className="text-3xl font-bold">Log in</h1>
      <LoginForm />
    </section>
  );
}
```

`robots: { index: false }` asks search engines not to list this page.

## Step 11: the admin area

The admin page shows every book with a price box. The action checks the session **again**, because a Server Action can be called directly, without ever opening the page:

```javascript
// app/admin/actions.js
'use server';

import * as z from 'zod';
import { updateTag } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { updateBookPrice } from '@/lib/books';

const priceSchema = z.coerce.number().positive().max(1000);

export async function updatePrice(bookId, formData) {
  // Never trust the page: check the session again inside the action
  await requireAdmin();

  const result = priceSchema.safeParse(formData.get('price'));
  if (!result.success) {
    return;
  }

  await updateBookPrice(bookId, result.data);
  updateTag(`book-${bookId}`); // this book's page
  updateTag('books'); // every list that shows the price
}
```

```jsx
// app/admin/page.js
import { Suspense } from 'react';
import { requireAdmin } from '@/lib/dal';
import { getBooks } from '@/lib/books';
import { updatePrice } from './actions';
import { logout } from '@/app/actions/auth';

export const metadata = {
  title: 'Admin',
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <section>
      <h1 className="text-3xl font-bold">Admin</h1>
      <Suspense fallback={<p className="mt-4">Checking your access...</p>}>
        <AdminPanel />
      </Suspense>
    </section>
  );
}

async function AdminPanel() {
  await requireAdmin(); // strangers go to /login, customers go home
  const books = await getBooks();

  return (
    <div className="mt-4">
      <ul className="space-y-3">
        {books.map((book) => (
          <li key={book.id} className="rounded border p-3">
            <form action={updatePrice.bind(null, book.id)} className="flex items-center gap-3">
              <span className="flex-1">{book.title}</span>
              <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={book.price}
                aria-label={`Price of ${book.title}`}
                className="w-24 rounded border px-2 py-1"
              />
              <button className="rounded bg-zinc-800 px-3 py-1 text-white">Save</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={logout} className="mt-6">
        <button className="underline">Log out</button>
      </form>
    </div>
  );
}
```

- `requireAdmin()` reads a cookie, so `AdminPanel` sits inside `<Suspense>`. The heading is prerendered, and the panel streams in.
- `updatePrice.bind(null, book.id)` gives each form its own book id, so no hidden input is needed.
- After saving, `updateTag('books')` and `updateTag('book-dune')` throw away the cached book list and that book's page. The admin sees the new price in the response, and every other page gets it on its next render.
- The page's metadata also says `robots: { index: false }`.

Log in at `/login` with `admin@booknook.test` and the demo password from `lib/users.js`, change the price of Dune, and open `/books` in another tab. Then log out and try `/admin` again: you are sent to the login page.

## Step 12: SEO, the API and the 404 page

Search engines get a sitemap built from the same data layer ([Sitemaps, robots.txt and App Icons](/courses/nextjs/sitemap-robots-and-icons)):

```javascript
// app/sitemap.js
import { getBooks } from '@/lib/books';

const baseUrl = process.env.SITE_URL ?? 'http://localhost:3000';

export default async function sitemap() {
  const books = await getBooks();

  const bookUrls = books.map((book) => ({
    url: `${baseUrl}/books/${book.id}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/books`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, changeFrequency: 'yearly', priority: 0.5 },
    ...bookUrls,
  ];
}
```

```javascript
// app/robots.js
const baseUrl = process.env.SITE_URL ?? 'http://localhost:3000';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/login', '/cart', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

`robots.txt` keeps crawlers out of private pages and points them at the sitemap. Both use `SITE_URL`, so they print the right address in development and in production.

A small JSON API lets other programs read the catalogue ([Building APIs with Route Handlers](/courses/nextjs/route-handlers)):

```javascript
// app/api/books/route.js
import { getBooks } from '@/lib/books';

export async function GET() {
  const books = await getBooks();
  return Response.json(books);
}
```

And a friendly page for unknown addresses:

```jsx
// app/not-found.js
import Link from 'next/link';

export default function NotFound() {
  return (
    <section>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2">We could not find that page. Maybe it is on another shelf?</p>
      <Link href="/books" className="mt-4 inline-block underline">Back to all books</Link>
    </section>
  );
}
```

## Step 13: build it for production

Everything is in place. Run the same checks a real team would ([Building for Production](/courses/nextjs/building-for-production)):

```bash
npm run lint
npm run build
```

Here is the real route table from building this exact code:

```text
Route (app)                       Revalidate  Expire
┌ ○ /                                     1h      1d
├ ○ /_not-found
├ ○ /about
├ ◐ /admin
├ ○ /api/books                            1h      1d
├ ◐ /books
├   /books/[id]
│ ├ ◐ /books/[id]
│ ├ ○ /books/dune                         1d      1w
│ ├ ○ /books/pride-and-prejudice          1d      1w
│ └ ◐ [+2 more paths]
├ ○ /cart
├ ○ /login
├ ○ /robots.txt
└ ○ /sitemap.xml                          1h      1d


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

Read it like a report card:

- `/`, `/about`, `/cart`, `/login`, the sitemap, `robots.txt` and the JSON API are fully static (`○`). Visitors get ready-made files.
- The known books are fully static too, refreshed in the background at most once a day (`1d`), or right away when `updateTag` runs.
- `/books` and `/admin` are `◐`: a static shell, with the search results or the admin panel streamed in, because they depend on the URL or a cookie.
- The `◐ /books/[id]` row is the fallback for books added after the build: `loading.js` shows first, then the page streams in.

Start the production server and click through the whole shop:

```bash
npm run start
```

Then run your tests from the testing lessons:

```bash
npx vitest run
npx playwright test
```

## Step 14: ship it

Push the project to GitHub and import it into Vercel, as in [Deploying to Vercel](/courses/nextjs/deploying-to-vercel). Add the three environment variables (`DATABASE_URL`, `SESSION_SECRET` and `SITE_URL`) in the project settings, with a **new** secret and your real site address. The database must be reachable from the internet, and also during the build, because `next build` runs your cached `getBooks()` to prerender pages.

Prefer your own server? [Self-Hosting with Node.js and Docker](/courses/nextjs/self-hosting) shows how to run the same build with `next start` or in a Docker container.

Before real customers arrive, change the demo users: store users in the database, with passwords hashed by `bcryptjs`, and never commit real passwords.

## Ideas to keep going

You now have a real, working full-stack app. If you want to keep practising, here are some next steps, each building on a lesson you have done:

- Save the cart in a cookie or the database, so it survives a page reload.
- Add an `opengraph-image.js` for each book, so shared links show the cover ([Open Graph Images and Social Cards](/courses/nextjs/og-images)).
- Show book covers with `next/image` and `preload` on the first one ([Optimizing Images with next/image](/courses/nextjs/optimizing-images)).
- Let the admin add new books with a validated form, then call `updateTag('books')`.
- Add a `proxy.js` that quickly redirects visitors without a session cookie away from `/admin` ([Running Code Before Requests with Proxy](/courses/nextjs/proxy)). Keep the DAL check as well: proxy is the doorman, the DAL is the lock.
- Translate the shop ([Building a Multi-Language Site](/courses/nextjs/internationalization)).

## Common mistakes

### The build fails with "DATABASE_URL is missing"

```text
Error: DATABASE_URL is missing. Add it to .env.local
```

`lib/db.js` throws this on purpose. The build needs the database too, because it prerenders the cached pages. Check the file name (`.env.local`, in the project root) and restart the dev server or build after changing it. On Vercel, add the variable in the project settings.

### Reading the URL or a cookie outside Suspense

```text
Error: Route "/books": Next.js encountered uncached or runtime data during prerendering.
```

Something read `searchParams`, `params`, `cookies()` or `usePathname` outside a `<Suspense>` boundary. Move that read into a child component inside `<Suspense>` (as in `BooksPage` and `AdminPage`), or add a `loading.js` next to the page.

### The new review or price does not appear

The cached data was not refreshed. Check that the tag in `updateTag` is spelled exactly like the one in `cacheTag` (`reviews-dune`, not `review-dune`), and that `updateTag` is called **after** the database write.

### The form forgets what the visitor typed

React 19 resets forms after an action. Return the typed `values` from the action, and use them as `defaultValue`, as `ReviewForm` does.

### A customer can reach the admin action

If you only check the role on the page, anyone can still call the Server Action directly. Always call `requireAdmin()` inside the action too, as `updatePrice` does.

## Quick recap

- The project is the course in one place: a Postgres data layer in `lib/`, Server Components for pages, a few small Client Components for interaction.
- `getBooks`, `getBook` and `getReviews` are cached with `'use cache'`, `cacheLife` and `cacheTag`; Server Actions call `updateTag` after every change.
- Request data (`searchParams`, `params`, cookies, `usePathname`) lives inside `<Suspense>` or next to a `loading.js`, so every page keeps a static shell.
- Forms use Server Actions, Zod 4 validation and `useActionState`, and return typed values so nothing is lost.
- A signed `httpOnly` session cookie plus a Data Access Layer protects the admin page **and** the admin action.
- Metadata, `generateMetadata`, `sitemap.js` and `robots.js` make the shop friendly to search engines.
- `npm run build` proves it all fits together, and the route table shows what is static and what streams.

<code id="code-content" class="language-javascript">
// app/actions.js
'use server';
import * as z from 'zod';
import { updateTag } from 'next/cache';
import { getBook } from '@/lib/books';
import { addReview } from '@/lib/reviews';
const reviewSchema = z.object({
  name: z.string().trim().min(2, { error: 'Please enter your name (2 letters or more).' }),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10, { error: 'Your review needs at least 10 characters.' }).max(500),
});
// Called by useActionState as createReview(bookId, previousState, formData)
export async function createReview(bookId, prevState, formData) {
  const values = {
    name: formData.get('name'),
    rating: formData.get('rating'),
    text: formData.get('text'),
  };
  const result = reviewSchema.safeParse(values);
  if (!result.success) {
    return {
      errors: z.flattenError(result.error).fieldErrors,
      values, // send the typed text back so the form can show it again
      message: 'Please fix the errors below.',
    };
  }
  // Never trust the bookId just because it came from our own form
  const book = await getBook(bookId);
  if (!book) {
    return { errors: {}, values, message: 'That book does not exist.' };
  }
  await addReview({ bookId, ...result.data });
  updateTag(`reviews-${bookId}`); // the book page shows the new review straight away
  return { errors: {}, values: {}, message: 'Thanks! Your review is live.' };
}
</code></pre>

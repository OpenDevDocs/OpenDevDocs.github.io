---
publishDate: 2026-10-25T13:40
title: Reading Cookies and Headers
slug: cookies-and-headers
metadescription: Read request headers and cookies with the async cookies() and headers() in Next.js 16, and set cookies safely in Server Actions and Route Handlers.
updateDate: 2026-10-25T13:40
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'cookies', 'headers', 'http']
course: nextjs
---

## What you will build

Every request the browser sends carries a little envelope of extra information: which browser it is, which languages the person prefers, and any **cookies** your site saved earlier. In this lesson you will read that envelope from the server and write cookies back.

Book Nook already has a simple cart cookie from [Server Functions and Server Actions](/courses/nextjs/server-actions). You will make it solid:

- a careful helper that reads the `cart` cookie without trusting it,
- `addToCart` and `clearCart` actions that set the cookie with safe options and an expiry date,
- a `/cart` page that shows prices in the visitor's own number format, using the `Accept-Language` header.

## Headers and cookies in one minute

An HTTP request is a bit like a letter. The **body** is the letter itself. The **headers** are what is written on the envelope: who it is from, what language they read, and so on. A request for `/cart` might carry:

```http
GET /cart HTTP/1.1
Host: localhost:3000
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Accept-Language: en-GB,en;q=0.9
Cookie: cart=["the-hobbit","dune"]; theme=dark
```

A **cookie** is a small piece of text the server asks the browser to keep. The server sends it with a `Set-Cookie` response header, and from then on the browser sends it back in the `Cookie` request header on every request to your site. That is how a site "remembers" you between pages.

Two things to keep in mind from the start:

- The browser stores cookies, so **the user can read and change them**. Never trust a cookie blindly, and never put secrets or prices in one.
- Cookies are sent with every request, so keep them small (browsers allow about 4 KB per cookie).

## Reading headers with headers()

Import `headers` from `next/headers`. In Next.js 16 it is **async**, so you `await` it:

```jsx
// app/cart/page.js (first try)
import { headers } from 'next/headers';

export default async function CartPage() {
  const headerList = await headers();
  const language = headerList.get('accept-language');
  return <p>Your browser prefers: {language}</p>;
}
```

`headers()` gives you a read-only **`Headers`** object, the same type as in the browser's `fetch` API. Use `.get(name)` (names are not case-sensitive), `.has(name)`, or loop over it with `.entries()`.

You can only **read** request headers this way. To send headers back, you return them from a Route Handler or set them in [Proxy](/courses/nextjs/proxy).

### The Cache Components rule

Your project has Cache Components on, and a header is **runtime data**: it is different for every visitor, so it cannot be baked into the static shell at build time. If you `await headers()` or `await cookies()` at the top of a page without a `<Suspense>` boundary, `next build` stops with:

```text
Error: Route "/cart": Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.
```

The fix is the pattern you know from [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering): move the reading into a child component and wrap it in `<Suspense>`. You will do that below.

Also, you cannot call `cookies()` or `headers()` inside a function marked `'use cache'`, because the cached result would be shared between visitors. Read the value outside and pass it in as an argument instead (see [Caching with Cache Components and use cache](/courses/nextjs/use-cache)).

## Reading cookies with cookies()

`cookies()` is also async and also comes from `next/headers`:

```javascript
import { cookies } from 'next/headers';

const cookieStore = await cookies();

cookieStore.get('cart');   // { name: 'cart', value: '["dune"]' } or undefined
cookieStore.has('cart');   // true or false
cookieStore.getAll();      // an array of every cookie
```

Note that `.get()` returns an **object**, not the text. The text is in `.value`.

In [Server Functions and Server Actions](/courses/nextjs/server-actions) you stored the cart as a comma-separated list of book ids in a cookie called `cart`, like `dune,the-hobbit`. Because the user can edit that cookie, give the reading part its own careful helper:

```javascript
// lib/cart.js
import { cookies } from 'next/headers';

export async function readCart() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('cart')?.value ?? '';

  return raw
    .split(',')
    .filter((id) => /^[a-z0-9-]+$/.test(id)) // only id-shaped values
    .slice(0, 50); // and not too many of them
}
```

Anything that does not look like a book id (empty parts, spaces, odd symbols) is dropped, and a cart can never hold more than 50 entries.

The cart holds only **ids**. The price always comes from `getBook()` on the server. If you stored prices in the cookie, anyone could make a book cost one cent.

## Setting cookies: only in Server Actions and Route Handlers

Here is the most important rule of the lesson: **you can read cookies anywhere on the server, but you can only set or delete them in a Server Action or a Route Handler.**

Why? A cookie is set with a `Set-Cookie` **response header**. When a page renders, Next.js streams the HTML to the browser as it goes, and once streaming has started the headers are already sent. Server Actions and Route Handlers finish their work before the response goes out, so they can still add headers.

If you try `cookieStore.set()` inside a Server Component, you get:

```text
Error: Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options
```

`addToCart` from the Server Actions lesson already lives in `app/actions.js`. Upgrade it to use `readCart` and safer cookie options, and add a `clearCart` action next to it:

```javascript
// app/actions.js (the cart actions)
import { cookies } from 'next/headers';
import { getBook } from '@/lib/books';
import { readCart } from '@/lib/cart';

const cartCookie = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days, in seconds
};

export async function addToCart(bookId) {
  // Only real books can go in the cart
  const book = await getBook(bookId);
  if (!book) return;

  const cart = await readCart();
  if (!cart.includes(book.id)) cart.push(book.id); // one of each book

  const cookieStore = await cookies();
  cookieStore.set('cart', cart.join(','), cartCookie);
}

export async function clearCart() {
  const cookieStore = await cookies();
  cookieStore.delete('cart');
}
```

The file already starts with `'use server'`, and `removeFromCart` from the earlier lesson can use `readCart` and `cartCookie` the same way.

The options control how the browser treats the cookie:

| Option | What it does |
| --- | --- |
| `httpOnly: true` | Browser JavaScript (`document.cookie`) cannot read it. Protects it from many attacks. |
| `secure: true` | Only sent over HTTPS. Use it in production. |
| `sameSite: 'lax'` | Not sent with most requests started by other websites. Helps against CSRF attacks. |
| `maxAge` | How many **seconds** to keep it. Without `maxAge` or `expires`, it is deleted when the browser closes. |
| `expires` | An exact `Date` when it ends (an alternative to `maxAge`). |
| `path: '/'` | Which URLs get the cookie. `'/'` (the default) means the whole site. |

A nice bonus: when a Server Action sets or deletes a cookie, Next.js automatically re-renders the current page in the same response, so anything that reads that cookie (like a cart badge) updates without extra code.

## The Add to cart button

You built this button in [Server Functions and Server Actions](/courses/nextjs/server-actions). As a reminder, a Server Action that takes an argument can be used straight from a Server Component with `bind`, with no `"use client"`:

```jsx
// app/books/[id]/page.js (inside the page's JSX)
import { addToCart } from '@/app/actions';

// ...
<form action={addToCart.bind(null, book.id)}>
  <button type="submit" className="mt-2 rounded border px-3 py-1">
    Add to cart
  </button>
</form>
```

`addToCart.bind(null, book.id)` makes a new function with `book.id` filled in as the first argument. React calls it when the form is submitted. Want a "Adding..." label? Swap the button for the `SubmitButton` from [Pending States and Optimistic Updates](/courses/nextjs/pending-and-optimistic-ui).

## The cart page

Now put it together. The parts that read cookies and headers sit in `CartItems`, inside `<Suspense>`:

```jsx
// app/cart/page.js
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { getBook } from '@/lib/books';
import { readCart } from '@/lib/cart';
import { clearCart } from '@/app/actions';

async function CartItems() {
  const ids = await readCart();
  const books = (await Promise.all(ids.map((id) => getBook(id)))).filter(Boolean);

  // "en-GB,en;q=0.9" -> "en-GB"
  const language = (await headers()).get('accept-language')?.split(',')[0] || 'en-US';
  const money = new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' });

  if (books.length === 0) {
    return <p>Your cart is empty.</p>;
  }

  const total = books.reduce((sum, book) => sum + book.price, 0);

  return (
    <>
      <ul>
        {books.map((book) => (
          <li key={book.id}>{book.title}: {money.format(book.price)}</li>
        ))}
      </ul>
      <p className="mt-2 font-semibold">Total: {money.format(total)}</p>
      <form action={clearCart}>
        <button type="submit" className="mt-4 underline">Empty the cart</button>
      </form>
    </>
  );
}

export default function CartPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Your cart</h1>
      <Suspense fallback={<p>Loading your cart...</p>}>
        <CartItems />
      </Suspense>
    </main>
  );
}
```

Add **The Hobbit** to the cart and open `/cart`:

```text
Your cart
The Hobbit: $12.99
Total: $12.99
Empty the cart
```

A visitor whose browser prefers German (`de-DE`) sees `12,99 $` instead. Same data, their own format.

`filter(Boolean)` removes `null` entries, in case the cookie holds the id of a book that no longer exists.

## Cookies and headers in Route Handlers

Route Handlers can use the same `cookies()` and `headers()` functions. They can also read straight from the request:

```javascript
// app/api/cart/route.js
import { NextResponse } from 'next/server';
import { readCart } from '@/lib/cart';

export async function GET(request) {
  const hasCart = request.cookies.has('cart'); // straight from the request
  const cart = await readCart(); // or through cookies(), with our safe parser
  const agent = request.headers.get('user-agent');
  return NextResponse.json({ hasCart, cart, agent });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('cart');
  return response;
}
```

`request.cookies` and `response.cookies` are the `NextRequest` and `NextResponse` helpers. Inside Route Handlers you may use `await cookies()` with `.set()` too, whichever reads better to you.

## Seeing your cookies in the browser

Open the developer tools, go to **Application** (Chrome and Edge) or **Storage** (Firefox), then **Cookies**, and pick `http://localhost:3000`. You can see the `cart` cookie, its value, its expiry date and the **HttpOnly** tick. Try editing the value to `dune,,%%%,not-a-book` and reload `/cart`: `readCart` drops the odd parts, `getBook` returns `null` for the unknown id, and the page simply shows Dune instead of crashing.

## Common mistakes

### Forgetting await

```text
TypeError: cookieStore.get is not a function
```

`cookies()` and `headers()` return Promises in Next.js 16. Older tutorials call them without `await`; that worked in Next.js 14, had a temporary fallback in 15, and is gone in 16. Always write `const cookieStore = await cookies()`.

### Setting a cookie while rendering

```text
Error: Cookies can only be modified in a Server Action or Route Handler.
```

You called `.set()` or `.delete()` in a page, layout or component. Move it into a Server Action (called from a form or button) or a Route Handler.

### Reading cookies outside Suspense

The build fails with "Next.js encountered uncached or runtime data during prerendering". Move the `cookies()` or `headers()` call into a component wrapped in `<Suspense>`.

### Trusting what is in the cookie

The user can change any cookie. Validate its shape (like `readCart` does), and look up anything important, like prices or permissions, on the server. For logins, a cookie must be **signed** so changes can be detected. That is the job of [Adding Login with Sessions and Cookies](/courses/nextjs/authentication).

## Quick recap

- Headers are the envelope of a request; cookies are small texts the browser stores and sends back in the `Cookie` header.
- `await headers()` gives a read-only `Headers` object; `await cookies()` gives a store with `get`, `has`, `getAll`.
- Both are async in Next.js 16 and are runtime data: with Cache Components, read them inside `<Suspense>`, never inside `'use cache'`.
- Set and delete cookies only in Server Actions or Route Handlers, with `httpOnly`, `sameSite`, `secure` and an expiry.
- Setting a cookie in a Server Action re-renders the current page automatically.
- Users can edit cookies: store ids, not prices or secrets, and validate what you read.

<code id="code-content" class="language-javascript">
// app/actions.js (cart part): a cookie-based cart for Book Nook
'use server';
import { cookies } from 'next/headers';
import { getBook } from '@/lib/books';
// Read the cart cookie safely (the user can edit it). Normally in lib/cart.js.
async function readCart() {
  const cookieStore = await cookies(); // async in Next.js 16
  const raw = cookieStore.get('cart')?.value ?? ''; // .get() returns { name, value }
  return raw
    .split(',')
    .filter((id) =&gt; /^[a-z0-9-]+$/.test(id)) // only id-shaped values
    .slice(0, 50);
}
const cartCookie = {
  httpOnly: true, // page JavaScript cannot read it
  sameSite: 'lax', // not sent with most cross-site requests
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
};
// Setting cookies is allowed here because this is a Server Action
export async function addToCart(bookId) {
  const book = await getBook(bookId);
  if (!book) return; // only real books
  const cart = await readCart();
  if (!cart.includes(book.id)) cart.push(book.id); // store ids, never prices
  const cookieStore = await cookies();
  cookieStore.set('cart', cart.join(','), cartCookie);
  // Next.js re-renders the current page, so the cart updates on screen
}
export async function clearCart() {
  const cookieStore = await cookies();
  cookieStore.delete('cart');
}
// --- In a Server Component (inside Suspense when Cache Components is on):
// const language = (await headers()).get('accept-language');
// &lt;form action={addToCart.bind(null, book.id)}&gt;&lt;button&gt;Add to cart&lt;/button&gt;&lt;/form&gt;
</code></pre>

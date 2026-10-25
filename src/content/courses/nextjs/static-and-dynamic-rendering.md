---
publishDate: 2026-10-25T13:28
title: Static and Dynamic Rendering
slug: static-and-dynamic-rendering
metadescription: Understand prerendering in Next.js 16 with Cache Components, the static shell, what makes a part dynamic, and how to read the build route table.
updateDate: 2026-10-25T13:28
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'rendering', 'cache-components', 'suspense']
course: nextjs
---

## What you will learn

Every page in Book Nook has to become HTML before a browser can show it. The big question is **when** that HTML is made:

- **Ahead of time**, while you run `next build`. This is called **prerendering**, and the result is **static**: the same HTML is sent to everyone, very fast.
- **At request time**, when a visitor asks for the page. This is **dynamic** rendering: the HTML can be different for each visitor, but the server does work on every request.

In this lesson you will learn how Next.js 16 decides which parts of a page are static and which are dynamic, what the **static shell** is, and how to read the symbols in the `next build` output. This is the base for the whole Caching and Rendering section, so take your time.

## A bakery, not a light switch

Older versions of Next.js treated each page like a light switch: the whole page was static, or the whole page was dynamic. If one small part needed the visitor's cookie, the entire page became dynamic.

Book Nook is built with **Cache Components** switched on (you chose it when you created the project, and it is the `cacheComponents: true` line in `next.config.mjs`). With Cache Components, Next.js decides **per component**, not per page.

Think of a bakery:

- **Bread baked in the morning** is ready on the shelf before customers arrive. That is the **static** part of a page: headings, navigation, text, anything that does not depend on the visitor.
- **Cakes from the freezer** were made earlier and kept for a while, with a "best before" date. That is **cached** data, which you will meet in the next lesson.
- **An omelette made to order** can only be cooked once the customer says what they want. That is a **dynamic** part: it needs information from the request, like a cookie.

While the omelette cooks, the customer gets a little card saying "Your order is being prepared". In Next.js that card is a `<Suspense>` **fallback**.

Everything that is ready ahead of time, plus those fallback cards, is called the **static shell**. Next.js sends the static shell instantly, then streams in the dynamic parts as they finish. Each page can have a lot of shell and a few dynamic holes, or the other way around.

## What Next.js does during the build

When you run `npm run build`, Next.js renders each page's component tree and sorts every part into one of these groups:

| What the component does | Where it ends up |
| --- | --- |
| Plain JSX, imports, simple calculations | in the static shell automatically |
| Data marked with `"use cache"` | in the static shell (next lesson) |
| Reads `cookies()`, `headers()`, `searchParams`, or `params` it cannot know yet | dynamic: must be inside `<Suspense>` |
| Waits on uncached data (a `fetch`, a database query) | dynamic: inside `<Suspense>`, or cache it |
| Uses `new Date()`, `Math.random()` or `crypto.randomUUID()` | you must choose: per request or cached |

The things in the third row are called **runtime APIs** (or request-time APIs): they need information that only exists when a real visitor sends a request.

The important rule: **Next.js wants every page to have a static shell.** If a dynamic part is not inside a `<Suspense>` boundary, there is no fallback to put in the shell, so the build stops and tells you.

## Step 1: a fully static page

Here is a simple About page:

```jsx
// app/about/page.js
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">About Book Nook</h1>
      <p>A small online bookshop for curious readers.</p>
    </main>
  );
}
```

Nothing here depends on the visitor, so the whole page is made during the build.

What about the book list from earlier lessons? With the starting version of `lib/books.js` (a plain array in memory), `getBooks()` finishes instantly, so a page that awaits it is also fully static. Next.js only counts work as "uncached data" when it really waits on the outside world. Once [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database) made `getBooks()` ask a real database, things change. Let's see how.

## Step 2: meet the build error

Here is the books page, reading from the database:

```jsx
// app/books/page.js
import { getBooks } from '@/lib/books';

export default async function BooksPage() {
  const books = await getBooks(); // a real database query
  return (
    <ul>
      {books.map((book) => (
        <li key={book.id}>{book.title}</li>
      ))}
    </ul>
  );
}
```

Run a production build:

```bash
npm run build
```

The build fails with this message (from a real build of this code):

```text
Error: Route "/books": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] For uncached data (`fetch`, database calls): cache the access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-dynamic
```

This is not Next.js being difficult. It is asking you a question: "this page waits for data, and I have nothing to show while it waits. What do you want?" The message offers three answers:

- **[stream]**: show a fallback now and stream the data in. You will do this below.
- **[cache]**: keep the result for a while so it can be part of the static shell. That is the next lesson, [Caching with Cache Components and use cache](/courses/nextjs/use-cache).
- **[block]**: let the page wait with nothing to show. This is an escape hatch for moving old apps over, not something to reach for first.

> **Tip:** In `npm run dev` you see the same problem as an "insight" in the dev overlay, with clickable fixes. The build stops; the dev server warns. Production build errors often point only at `body` and `html`. To get the exact line, open the page in `next dev`, or run `npx next build --debug-prerender`.

## Step 3: fix it by streaming

Move the waiting into its own component and wrap it in `<Suspense>`:

```jsx
// app/books/page.js
import { Suspense } from 'react';
import { getBooks } from '@/lib/books';

async function BookList() {
  const books = await getBooks();
  return (
    <ul>
      {books.map((book) => (
        <li key={book.id}>{book.title}</li>
      ))}
    </ul>
  );
}

export default function BooksPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">All books</h1>
      <Suspense fallback={<p>Loading books...</p>}>
        <BookList />
      </Suspense>
    </main>
  );
}
```

Now the heading and the "Loading books..." text form the static shell. The list is a dynamic hole that is filled at request time. Notice that `BooksPage` itself is no longer `async`: it does not wait for anything. You already used this pattern in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming); now you know why Next.js insists on it.

## Step 4: read cookies without making the whole page dynamic

The cart page needs the visitor's `cart` cookie. That is a runtime API, so the same rule applies:

```jsx
// app/cart/page.js
import { Suspense } from 'react';
import { cookies } from 'next/headers';

async function CartSummary() {
  const cookieStore = await cookies();
  const ids = cookieStore.get('cart')?.value.split(',').filter(Boolean) ?? [];
  return <p>You have {ids.length} book(s) in your cart.</p>;
}

export default function CartPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <Suspense fallback={<p>Loading your cart...</p>}>
        <CartSummary />
      </Suspense>
    </main>
  );
}
```

If you read the cookie at the top of `CartPage` instead, the build fails with the same "uncached or runtime data" message, this time pointing at `cookies()`. Reading cookies only makes **that component** dynamic. The heading is still static. You will learn more about cookies in [Reading Cookies and Headers](/courses/nextjs/cookies-and-headers).

## Step 5: times and random numbers

What should this show?

```jsx
// app/time/page.js
export default function TimePage() {
  return <p>The time is {new Date().toLocaleTimeString()}</p>;
}
```

If Next.js runs it during the build, every visitor sees the build time forever. Probably not what you meant. So Next.js makes you decide:

```text
Error: Route "/time": Next.js encountered the unstable value `new Date()` while prerendering.

This value can change between renders, so it must be either prerendered or computed later.

Ways to fix this:
  - [dynamic] Render at request time by adding a dynamic data access (e.g. `await connection()`) before this call
  - [cache] Prerender and cache the value with `"use cache"`
  - [client] Render the value on the client with `"use client"`
  - [measure] If the value is for telemetry, use a timing API such as `performance.now()`
```

To get a fresh value for every visitor, call `connection()` first. It tells Next.js "wait for a real request before running the rest of this component". Then wrap the component in `<Suspense>`, like any other dynamic part:

```jsx
// app/time/page.js
import { Suspense } from 'react';
import { connection } from 'next/server';

async function Clock() {
  await connection(); // everything below runs at request time
  return <p>The time is {new Date().toLocaleTimeString()}</p>;
}

export default function TimePage() {
  return (
    <Suspense fallback={<p>Checking the clock...</p>}>
      <Clock />
    </Suspense>
  );
}
```

The same goes for `Math.random()` and `crypto.randomUUID()`.

> **Good to know:** Next.js 16.3 added `io()` from `next/cache`, which works like `connection()` for this job and also cooperates with caching and prefetching. You will see it in newer examples. `connection()` is the clearest choice when you simply mean "wait for a visitor".

## Step 6: read the route table

When the build succeeds, Next.js prints a **route table** with a symbol for every page. Here is the real output for the pages in this lesson:

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ◐ /books
├ ◐ /cart
└ ◐ /time


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

What the symbols mean:

- **○ Static**: the whole page was prerendered. Nothing runs on the server when someone visits.
- **◐ Partial Prerender**: there is a static shell (heading plus fallback), and some parts stream in at request time. Most pages that touch visitor data look like this.
- **ƒ Dynamic**: the build produced no useful HTML, so the page renders fully on each request. With Cache Components you mostly see this for Route Handlers, or for pages that opted out with `export const instant = false`.

Older guides talk about `●` (SSG) as well. That symbol belongs to projects without Cache Components, covered in [Caching in Projects Without Cache Components](/courses/nextjs/caching-without-cache-components).

## Push the dynamic part down

The deeper a dynamic read sits in the tree, the more of the page can be static. Compare:

```jsx
// Not great: the whole page waits for the cookie
export default async function CartPage() {
  const cookieStore = await cookies();
  // ...
}

// Better: only the small component that needs the cookie waits
export default function CartPage() {
  return (
    <main>
      <h1>Your cart</h1>
      <Suspense fallback={<p>Loading your cart...</p>}>
        <CartSummary />
      </Suspense>
    </main>
  );
}
```

Ask yourself for each piece of a page: "Does this really need the visitor's request?" If not, keep it out of the `<Suspense>` boundary so it lands in the shell. [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering) goes deeper into this.

## Common mistakes

### Wrapping the whole page in one Suspense

A single `<Suspense>` around everything does fix the error, but the shell is then just one "Loading..." line. Keep headings, navigation and other fixed content outside the boundary, and wrap only the part that waits.

### Expecting Suspense alone to make something dynamic

`<Suspense>` only gives a fallback. If the component inside does nothing that waits for a request, Next.js still renders it during the build. Use `connection()` when you really need request-time work and nothing else in the component triggers it.

### Using a date in a Server Component without deciding

```text
Error: Route "/time": Next.js encountered the unstable value `new Date()` while prerendering.
```

Choose: `await connection()` inside `<Suspense>` for a fresh value per visitor, `"use cache"` for one shared value, or move it into a Client Component.

### Testing caching behaviour only in dev

`npm run dev` renders pages on every request so you see your changes. To see what is really static, run `npm run build` and look at the route table, then `npm run start`.

## Quick recap

- **Prerendering** makes HTML during `next build`; **dynamic** rendering makes it per request.
- With Cache Components, the choice is made per component. A page can be a static shell with dynamic holes.
- The **static shell** is everything ready ahead of time plus the `<Suspense>` fallbacks.
- Runtime APIs (`cookies()`, `headers()`, `searchParams`, unknown `params`) and uncached data must sit inside `<Suspense>`, or be cached.
- `new Date()`, `Math.random()` and friends need a choice: `await connection()` (per request) or `"use cache"` (shared).
- Route table: ○ fully static, ◐ static shell plus streamed parts, ƒ rendered on each request.

<code id="code-content" class="language-jsx">
// app/cart/page.js: a static shell with one dynamic hole
import { Suspense } from 'react';
import { cookies } from 'next/headers';
// --- Dynamic part: it needs the visitor's cookie, so it runs at request time
async function CartSummary() {
  const cookieStore = await cookies();
  const ids = cookieStore.get('cart')?.value.split(',').filter(Boolean) ?? [];
  if (ids.length === 0) {
    return &lt;p&gt;Your cart is empty.&lt;/p&gt;;
  }
  return &lt;p&gt;You have {ids.length} book(s) in your cart.&lt;/p&gt;;
}
// --- The page itself is not async: it never waits, so it can be prerendered
export default function CartPage() {
  return (
    &lt;main className="mx-auto max-w-2xl p-8"&gt;
      {/* Static: part of the shell, sent instantly */}
      &lt;h1 className="text-3xl font-bold"&gt;Your cart&lt;/h1&gt;
      {/* The fallback is in the shell; CartSummary streams in at request time */}
      &lt;Suspense fallback={&lt;p&gt;Loading your cart...&lt;/p&gt;}&gt;
        &lt;CartSummary /&gt;
      &lt;/Suspense&gt;
    &lt;/main&gt;
  );
}
// --- Build output for this page: ◐ /cart (Partial Prerender)
</code></pre>

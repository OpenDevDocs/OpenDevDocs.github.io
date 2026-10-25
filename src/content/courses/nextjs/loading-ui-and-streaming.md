---
publishDate: 2026-10-25T13:23
title: Loading UI, Suspense and Streaming
slug: loading-ui-and-streaming
metadescription: "Show instant loading states in Next.js with loading.js and React Suspense, stream slow parts of a page as they become ready, and design a good static shell."
updateDate: 2026-10-25T13:23
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'streaming', 'suspense', 'loading']
course: nextjs
---

## What you will learn

In [Fetching Data in Server Components](/courses/nextjs/fetching-data) you wrapped slow data in `<Suspense>` to make the build happy. In this lesson you will see what that really does, and how to use it to make Book Nook feel fast even when some data is slow.

The idea is called **streaming**. Without it, the server builds the whole page and only then sends it, so one slow database query keeps the visitor staring at a blank screen. With streaming, the server sends the page **in pieces**: the parts that are ready go out straight away, and slow parts follow when they are done, each one sliding into its place.

Think of a restaurant again. A slow kitchen that waits until every dish is ready leaves you hungry and bored. A good kitchen brings bread and drinks first, then starters, then the main course as each one is cooked. You are never left with an empty table.

You will learn:

- how to add an instant loading screen for a whole page with `loading.js`
- how to stream just one slow part of a page with `<Suspense>`
- what the **static shell** is, and why Next.js wants one for every page
- where to put your Suspense boundaries for the best result

## Step 1: make something slow on purpose

Book Nook's data is an array, so everything is instant. To see streaming, you need something slow. Add a pretend reviews function to `lib/books.js` that waits two seconds, like a slow database would:

```javascript
// lib/books.js (add at the bottom)
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getReviews(bookId) {
  await delay(2000); // pretend this is a slow database query
  return [
    { id: 1, bookId, name: 'Asha', rating: 5, text: 'Could not put it down.' },
    { id: 2, bookId, name: 'Tom', rating: 4, text: 'A lovely read for a rainy weekend.' },
  ];
}
```

Waiting on a timer is not something Next.js can finish ahead of time, so it counts as **uncached** data, exactly like a real database call or a `fetch`.

## Step 2: a loading screen for the whole page with loading.js

The quickest way to add a loading state is a special file called `loading.js`, placed in a route folder next to `page.js`. You already made a simple one in [Dynamic Routes and params](/courses/nextjs/dynamic-routes), that just said "Loading book...":

```text
app/
└── books/
    └── [id]/
        ├── loading.js
        └── page.js
```

Let us turn it into a proper loading screen:

```jsx
// app/books/[id]/loading.js
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl animate-pulse p-8">
      <div className="h-8 w-2/3 rounded bg-zinc-200" />
      <div className="mt-3 h-4 w-1/3 rounded bg-zinc-200" />
      <div className="mt-6 h-24 w-full rounded bg-zinc-200" />
    </main>
  );
}
```

This is a **skeleton**: grey boxes in the shape of the real page. Tailwind's `animate-pulse` makes them gently fade in and out, so people can see something is happening.

What Next.js does with this file: it wraps your `page.js` in a `<Suspense>` boundary and uses `Loading` as the fallback. In other words, for this folder it builds this for you:

```jsx
<Layout>
  <Suspense fallback={<Loading />}>
    <Page />
  </Suspense>
</Layout>
```

So now you could write the book page in the simplest way, awaiting `params` and the data right at the top, and it would still build:

```jsx
// app/books/[id]/page.js
import { notFound } from 'next/navigation';
import { getBook } from '@/lib/books';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-serif text-3xl font-bold">{book.title}</h1>
      <p className="text-zinc-600">by {book.author}</p>
      <p className="mt-4">{book.description}</p>
    </main>
  );
}
```

Book Nook's `getBook` is instant, so to watch the skeleton, temporarily add `await delay(2000);` as the first line inside `getBook` in `lib/books.js`. Then click from `/books` to a book. You see the skeleton at once, and the real page replaces it two seconds later. (Remove the delay again afterwards.) Some nice details come for free:

- The **layout stays on screen and keeps working**. Your header and cart button do not disappear.
- The loading screen is **prefetched** along with the link, so it appears instantly when you click.
- Navigation can be **interrupted**: if you click somewhere else while it is loading, Next.js just goes there.

`loading.js` also covers every folder below it. A file in `app/books/loading.js` would show for `/books` and for `/books/[id]`.

## Step 3: stream only the slow part with Suspense

`loading.js` replaces the **whole page** while anything in it is loading. But the book's title and description are fast; only the reviews are slow. Why should the reader wait two seconds to see the title?

Use `<Suspense>` yourself, around just the slow part. First, a component that loads the reviews:

```jsx
// components/Reviews.js
import { getReviews } from '@/lib/books';

export default async function Reviews({ bookId }) {
  const reviews = await getReviews(bookId);

  return (
    <ul className="mt-4 space-y-3">
      {reviews.map((review) => (
        <li key={review.id} className="rounded-lg bg-zinc-50 p-4">
          <p className="font-semibold">{review.name}: {'★'.repeat(review.rating)}</p>
          <p className="text-zinc-700">{review.text}</p>
        </li>
      ))}
    </ul>
  );
}
```

Then wrap it in the page:

```jsx
// app/books/[id]/page.js
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getBook } from '@/lib/books';
import Reviews from '@/components/Reviews';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-serif text-3xl font-bold">{book.title}</h1>
      <p className="text-zinc-600">by {book.author}</p>
      <p className="mt-4">{book.description}</p>

      <h2 className="mt-8 text-xl font-semibold">Reviews</h2>
      <Suspense fallback={<p className="mt-4 text-zinc-500">Loading reviews...</p>}>
        <Reviews bookId={book.id} />
      </Suspense>
    </main>
  );
}
```

Now the book appears straight away with "Loading reviews..." under it, and the reviews pop in two seconds later. The rest of the page never waits for them.

How does that work over one HTTP response? The server sends the first part of the HTML, including the fallback, and **keeps the connection open**. When `Reviews` finishes, the server sends one more small chunk of HTML plus a tiny script that swaps the fallback for the real content. That is streaming.

## Step 4: several boundaries side by side

Each `<Suspense>` boundary is independent. Put two slow parts in two boundaries, and each one appears as soon as **its own** data is ready, in whatever order that happens:

```jsx
// app/books/[id]/page.js (part)
<div className="mt-8 grid gap-8 md:grid-cols-2">
  <section>
    <h2 className="text-xl font-semibold">Reviews</h2>
    <Suspense fallback={<p>Loading reviews...</p>}>
      <Reviews bookId={book.id} />
    </Suspense>
  </section>

  <section>
    <h2 className="text-xl font-semibold">More by {book.author}</h2>
    <Suspense fallback={<p>Loading more books...</p>}>
      <MoreByAuthor author={book.author} />
    </Suspense>
  </section>
</div>
```

If you want two parts to appear **together**, put them in the **same** boundary. The fallback then stays until both are ready.

You can also **nest** boundaries: an outer one for a whole section, and inner ones for slower details inside it. The page then fills in step by step, from the outside in.

## Step 5: the static shell

Because Book Nook has Cache Components turned on, Next.js does something clever at build time. It renders each page as far as it can **without** waiting for uncached data. Everything it can render goes into the **static shell**: your layouts, the header, the fast parts of the page, and the **fallbacks** of your Suspense boundaries. That shell is saved as HTML when you build and can be sent instantly to every visitor. Only the parts inside Suspense are made fresh for each request and streamed in.

This mix is called **Partial Prerendering**, and it is the default with Cache Components. In the build output it shows up with the half-filled circle:

```text
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

This is also why the build refuses uncached data outside Suspense. If a slow request had no boundary above it, the server could not send **anything** until it finished, and there would be no instant shell. Next.js walks up from the slow component looking for the nearest `<Suspense>` (or `loading.js`). If it finds none, the build stops with the "uncached or runtime data during prerendering" error you saw in the previous lesson.

The deeper story of static and dynamic pages is in [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering) and [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering).

## Step 6: push slow work down the tree

A Suspense boundary only helps for what is **inside** it. Look at the page in Step 3 again: it awaits `params` at the very top. On a route like `/books/[id]`, `params` is only known when someone visits, so everything after that line has to wait for the request. With a `loading.js` in the folder, the shell is just the skeleton.

To get more into the instant shell, do the slow part deeper down. Pass the `params` promise into a child component and await it there, inside its own boundary:

```jsx
// app/books/[id]/page.js
import { Suspense } from 'react';

export default function BookPage({ params }) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <p className="text-sm text-zinc-500">Book Nook / Books</p>
      <Suspense fallback={<BookSkeleton />}>
        <BookDetails params={params} />
      </Suspense>
    </main>
  );
}
```

Now the breadcrumb line and the skeleton are part of the static shell, and only `BookDetails` waits for the visit. This is the pattern you used in [Fetching Data in Server Components](/courses/nextjs/fetching-data). The rule of thumb: **await things as late as possible, in the component that actually needs them.**

## Step 7: loading.js or Suspense?

| | `loading.js` | `<Suspense>` |
| --- | --- | --- |
| Covers | The whole page (and pages below it) | Any part you wrap |
| Setup | Drop in one file | Wrap components yourself |
| Prefetched for instant navigation | Yes | Not by default |
| Best for | Pages where nothing useful shows without the data | Most pages, for fine control |

You can use both: `loading.js` as a safety net for the whole route, and `<Suspense>` around the slow sections inside it.

One limit to remember: `loading.js` sits **inside** the layout of the same folder. It does not cover that layout. If `app/books/layout.js` itself awaits uncached data (for example `cookies()` for a "Hello, Asha" message), `app/books/loading.js` cannot help. Wrap that part of the layout in its own `<Suspense>`, or move the data into the page.

## Step 8: good loading states

A few tips for loading UI people do not mind seeing:

- **Match the shape** of the real content. A skeleton the same size as the finished section stops the page from jumping when the content arrives.
- **Be specific.** "Loading reviews..." is better than a lonely spinner in the middle of the page.
- **Keep fallbacks light.** They are part of the static shell, so they should not fetch anything themselves.
- **Do not wrap tiny fast things.** A boundary around something that is always instant only adds flicker.

## Common mistakes

### Putting Suspense inside the slow component

```jsx
// Does not help: the await happens before Suspense is even rendered
export default async function Reviews({ bookId }) {
  const reviews = await getReviews(bookId);
  return <Suspense fallback={<p>Loading...</p>}>...</Suspense>;
}
```

A boundary catches waiting that happens **below** it. Put `<Suspense>` in the **parent**, around `<Reviews />`.

### Awaiting everything at the top of the page

```jsx
export default async function BookPage({ params }) {
  const { id } = await params;
  const reviews = await getReviews(id); // the whole page now waits 2 seconds
  ...
}
```

If you await slow data in the page itself, a `<Suspense>` further down the page cannot help, because nothing renders until that line finishes. Move the slow call into its own component inside a boundary.

### loading.js does not show for slow layout data

You added `app/books/loading.js`, but navigation still freezes. Check `app/books/layout.js`: `loading.js` does not cover the layout in its own folder. Wrap the slow part of the layout in `<Suspense>`.

### Expecting a 404 status after streaming has started

Once the first chunk has been sent, the HTTP status (`200 OK`) cannot change. If `notFound()` is called inside a boundary that streams later, the visitor still sees your 404 page, and Next.js adds a `noindex` tag so search engines skip it, but the status code stays 200. For most shops that is fine. If you really need a true `404` status, the check has to happen before the page starts streaming, for example in Proxy ([Running Code Before Requests with Proxy](/courses/nextjs/proxy)).

### Thinking Suspense makes something dynamic

`<Suspense>` only shows a fallback while something is waiting. A component that does no slow work still renders straight away and goes into the static shell, Suspense or not.

## Quick recap

- **Streaming** sends a page in pieces: ready parts first, slow parts when they finish.
- `loading.js` in a route folder wraps that page in `<Suspense>` with your component as the fallback. The layout stays visible and the fallback is prefetched.
- `<Suspense fallback={...}>` around one component streams just that part. Each boundary is independent; nest them or group them as you like.
- With Cache Components, the **static shell** (layouts, fast content and fallbacks) is prerendered. Uncached parts inside Suspense are streamed per request. This is Partial Prerendering.
- Await slow data as deep in the tree as possible, in the component that needs it.
- `loading.js` does not cover the layout in its own folder.
- Make fallbacks look like the content they replace.

<code id="code-content" class="language-jsx">
// app/books/[id]/page.js: the book page streams in two steps
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getBook } from '@/lib/books';
import Reviews from '@/components/Reviews';
// Not async: the breadcrumb and the skeleton go into the static shell
export default function BookPage({ params }) {
  return (
    &lt;main className="mx-auto max-w-3xl p-8"&gt;
      &lt;p className="text-sm text-zinc-500"&gt;Book Nook / Books&lt;/p&gt;
      &lt;Suspense fallback={&lt;BookSkeleton /&gt;}&gt;
        &lt;BookDetails params={params} /&gt;
      &lt;/Suspense&gt;
    &lt;/main&gt;
  );
}
// Step 1 of streaming: the book itself (needs the id from the URL)
async function BookDetails({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) {
    notFound();
  }
  return (
    &lt;article&gt;
      &lt;h1 className="font-serif text-3xl font-bold"&gt;{book.title}&lt;/h1&gt;
      &lt;p className="text-zinc-600"&gt;by {book.author}&lt;/p&gt;
      &lt;p className="mt-4"&gt;{book.description}&lt;/p&gt;
      &lt;h2 className="mt-8 text-xl font-semibold"&gt;Reviews&lt;/h2&gt;
      {/* Step 2 of streaming: slow reviews arrive later, the book does not wait */}
      &lt;Suspense fallback={&lt;p className="mt-4 text-zinc-500"&gt;Loading reviews...&lt;/p&gt;}&gt;
        &lt;Reviews bookId={book.id} /&gt;
      &lt;/Suspense&gt;
    &lt;/article&gt;
  );
}
// A skeleton the same shape as the real content, so nothing jumps
function BookSkeleton() {
  return (
    &lt;div className="animate-pulse"&gt;
      &lt;div className="h-8 w-2/3 rounded bg-zinc-200" /&gt;
      &lt;div className="mt-3 h-4 w-1/3 rounded bg-zinc-200" /&gt;
      &lt;div className="mt-6 h-24 w-full rounded bg-zinc-200" /&gt;
    &lt;/div&gt;
  );
}
// --- app/books/[id]/loading.js: optional safety net for the whole page
// export default function Loading() {
//   return &lt;p className="p-8"&gt;Loading book...&lt;/p&gt;;
// }
</code></pre>

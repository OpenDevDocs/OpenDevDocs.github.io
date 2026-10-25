---
publishDate: 2026-10-25T13:48
title: Parallel Routes and Intercepting Routes
slug: parallel-and-intercepting-routes
metadescription: Learn @folder slots, why default.js is required in Next.js 16, and build a Book Nook preview modal with an intercepting route that still works on refresh.
updateDate: 2026-10-25T13:48
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'parallel-routes', 'intercepting-routes', 'modal']
course: nextjs
---

## The goal: a book preview that opens in a modal

On the `/books` page, Book Nook lists every book. Right now, clicking a title loads the full `/books/the-hobbit` page and the list disappears. Many shops do something nicer: the book opens in a **modal** (a box that floats over the page), the list stays visible behind it, and the address bar still changes to `/books/the-hobbit`. That gives you the best of both worlds:

- The URL can be copied and shared.
- Pressing the browser's **Back** button closes the modal.
- Opening the shared link, or pressing refresh, shows the normal full book page.

Building this by hand with `useState` gets messy fast. Next.js solves it with two routing features that work together:

- **Parallel routes** let one layout show more than one page at the same time, in named **slots**.
- **Intercepting routes** let you "catch" a navigation to another URL and show something different for it, while the URL still changes.

This is an advanced lesson. You should be comfortable with [Pages and Layouts](/courses/nextjs/pages-and-layouts), [Dynamic Routes and params](/courses/nextjs/dynamic-routes) and [Client Components and the use client Directive](/courses/nextjs/client-components).

## Part 1: parallel routes and slots

### What a slot is

You already know that a layout receives `children`, which is the current page. A **slot** is an extra, named "hole" in a layout that can show a page of its own. You create a slot with a folder whose name starts with `@`:

```text
app/books/
├── layout.js
├── page.js            fills the children slot
└── @modal/
    └── default.js     fills the modal slot when nothing else matches
```

The layout in the same folder now receives a prop with the slot's name, next to `children`:

```jsx
// app/books/layout.js
export default function BooksLayout({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

Think of a TV with a picture-in-picture window. `children` is the main programme. `modal` is the small window in the corner, which can show a different channel. Both are on screen at once, and you can change one without changing the other.

Three facts about slots:

- A slot is **not** part of the URL. `app/books/@modal/something/page.js` is served at `/books/something`, not `/books/@modal/something`.
- `children` is really a slot too, just one without a folder. `app/books/page.js` works as if it were `app/books/@children/page.js`.
- Slots are passed only to the layout in the **same folder** as the `@` folder.

### default.js: what a slot shows when it has nothing to show

Every slot must have something to render for every URL its layout handles. When you visit `/books`, the `children` slot has `app/books/page.js`. But what should `@modal` show? It has no `page.js`. That is the job of **`default.js`**, the fallback for a slot.

For a modal the answer is "nothing", so it returns `null`:

```jsx
// app/books/@modal/default.js
export default function Default() {
  return null;
}
```

In Next.js 16, `default.js` is **required** for every slot. If it is missing, `npm run build` fails:

```text
Error: Parallel route slots cannot render the same URLs
The following layouts have parallel route slots that cannot render the same URLs:
app/books/layout.js
- /books is missing a matching page or default.tsx in @modal
- /books/[id] is missing a matching page or default.tsx in @modal

Every URL matched by one slot must have a matching page or default.tsx in every sibling slot.
```

(The message says `default.tsx`, but `default.js` is what you use in a JavaScript project.)

### Soft and hard navigation

Why is `default.js` needed at all? Because slots behave differently depending on how you arrive at a URL:

- **Soft navigation** is a click on a `<Link>` (or `router.push`). Next.js updates only what changed. A slot that has no match for the new URL simply **keeps showing what it showed before**.
- **Hard navigation** is a full page load: typing the URL, pressing refresh, or opening a shared link. Next.js has no "before" to remember, so for a slot with no match it renders `default.js`.

Keep these two words in mind. The whole modal trick depends on them.

## Part 2: intercepting routes

### The (.) folder names

An **intercepting route** is a folder whose name starts with a dot pattern in brackets. It says: "when the user *soft navigates* to this other route, render me instead". The pattern works like `./` and `../` in file paths, but counts **route segments**:

| Folder name | Intercepts a route... |
| --- | --- |
| `(.)name` | on the **same level** |
| `(..)name` | **one level above** |
| `(..)(..)name` | **two levels above** |
| `(...)name` | starting from the **root** of `app` |

One detail trips everyone up: `@slot` folders do **not** count as a level, because they are not part of the URL. So a folder at `app/books/@modal/(.)[id]` is on the same level as `app/books/[id]`, and `(.)` is the right choice.

### Interception only happens on soft navigation

| How the user gets to `/books/dune` | What they see |
| --- | --- |
| Clicks the Dune link on `/books` | The intercepting route: a modal over the list |
| Refreshes the page, or opens a shared link | The real `app/books/[id]/page.js` full page |

That is exactly the behaviour a shop wants.

## Part 3: build the book preview modal

Here is the full folder layout you will end up with:

```text
app/books/
├── layout.js                 renders children and the modal slot
├── page.js                   the book list
├── [id]/
│   └── page.js               the full book page (already exists)
└── @modal/
    ├── default.js            nothing, on hard navigation
    ├── page.js               nothing, when back on /books
    └── (.)[id]/
        └── page.js           the book inside a modal
```

### Step 1: the layout and the default

Create `app/books/layout.js` and `app/books/@modal/default.js` exactly as shown in Part 1. Run `npm run dev` and visit `/books`. Nothing looks different yet, which is correct: the modal slot shows `null`.

> **Tip:** When you add a new `@slot` folder while the dev server is running, it sometimes does not notice. If the new prop is `undefined`, stop the server with Ctrl + C and run `npm run dev` again.

### Step 2: a reusable Modal component

The modal needs a click handler to close itself, so it must be a Client Component. Closing is easy: go back one step in history, which also puts the URL back to `/books`.

```jsx
// components/Modal.js
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Modal({ children }) {
  const router = useRouter();

  // Close with the Escape key too
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') router.back();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => router.back()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
        <button
          onClick={() => router.back()}
          className="mt-4 rounded bg-stone-800 px-4 py-2 text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- Clicking the dark background calls `router.back()`.
- `event.stopPropagation()` on the white box stops a click *inside* the box from reaching the background, so it does not close by accident.
- The modal only wraps `children`, so the content inside can still be a Server Component that reads data. This is the pattern from [Mixing Server and Client Components](/courses/nextjs/server-client-boundary).

### Step 3: the intercepting page

Now create the folder `app/books/@modal/(.)[id]` (yes, with the brackets and the dot) and a page inside it:

```jsx
// app/books/@modal/(.)[id]/page.js
import { notFound } from 'next/navigation';
import Modal from '@/components/Modal';
import { getBook, getBooks } from '@/lib/books';

// Cache Components: list the ids so the modal can be prerendered
export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

// Keep the tab title right while the modal is open
export async function generateMetadata({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  return { title: book ? book.title : 'Book not found' };
}

export default async function BookModal({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  return (
    <Modal>
      <h2 className="text-xl font-bold">{book.title}</h2>
      <p className="text-stone-600">by {book.author}</p>
      <p className="mt-2">{book.description}</p>
      <p className="mt-2 font-semibold">${book.price.toFixed(2)}</p>
      <a href={`/books/${book.id}`} className="mt-2 block underline">
        Open the full page
      </a>
    </Modal>
  );
}
```

This is a normal page: it awaits `params`, loads the book and returns JSX. The only special things are where it lives and that it wraps its content in `<Modal>`.

Why `generateStaticParams` here too? The course project has Cache Components on, and this page reads `params`. Without a list of known ids, the build stops with:

```text
Error: Route "/books/(.)[id]": Next.js encountered uncached or runtime data during prerendering.
```

Listing the ids, just like the full book page does, lets Next.js prerender the modal for every book. See [Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params).

The "Open the full page" link is a plain `<a>` on purpose. A `<Link>` would be a soft navigation, which would be intercepted again and just show the modal. An `<a>` does a hard navigation and loads the real page.

### Step 4: try it

Go to `http://localhost:3000/books` and click **Dune**:

- The list stays on screen, darkened, with Dune in a box on top.
- The address bar says `/books/dune`, and the tab says **Dune | Book Nook**.
- Press **Escape**, click **Close**, click the dark area, or press the browser's Back button. The modal closes and the URL is `/books` again.
- Press **Forward**. The modal opens again.

Now open `/books/dune` and press refresh. This time you get the full book page from `app/books/[id]/page.js`, with no list behind it. On a hard navigation there is nothing to intercept, and the `@modal` slot falls back to `default.js`, which renders nothing.

### Step 5: close the modal when navigating inside /books

There is one more case. Suppose the modal (or a header) has a link back to `/books`. That is a soft navigation, and the `@modal` slot has no page for `/books`, so it **keeps showing the old modal**. The list is updated, but the modal stays open on top!

The fix is to give the slot a page for `/books` that renders nothing:

```jsx
// app/books/@modal/page.js
export default function ModalPage() {
  return null;
}
```

Now a soft navigation to `/books` matches this page, and the modal disappears. Navigating to routes outside `/books` (like `/` or `/cart`) already works, because the whole books layout, slot included, is replaced.

## Other things parallel routes are good for

The modal is the most common use, but slots are handy whenever one screen shows several independent parts:

- **Dashboards:** an `/admin` layout with `@sales` and `@orders` slots. Each slot can have its own `loading.js` and `error.js`, so a slow sales chart does not hold up the orders table (see [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming)).
- **Tabs inside a section:** a slot can have its own `layout.js` with links, and switching tabs only changes that slot.
- **Different views by role:** a layout can choose which slot to return. Be careful: every slot still **runs on the server**, even the one you do not show. Check permissions inside each slot's page too, as in [Protecting Pages, Actions and APIs](/courses/nextjs/authorization).

## Common mistakes

### Missing default.js

The build fails with "Parallel route slots cannot render the same URLs". Add a `default.js` to every `@slot` folder. Return `null` for "show nothing", or call `notFound()` from `next/navigation` if a missing match should be a 404.

### Counting the @modal folder as a level

```text
app/books/@modal/(..)[id]/page.js    wrong
app/books/@modal/(.)[id]/page.js     right
```

`@modal` is not a URL segment, so `[id]` is on the same level as the folder you want to intercept. `(..)[id]` would point one level higher, to a `/[id]` route at the root of the site, which Book Nook does not have.

Whenever an intercepting route has no real page to match, the build tells you:

```text
Error: Interception routes must have a canonical route
The following interception routes do not have a canonical route:
- /books/(.)[id] (expected /books/[id])
```

(This exact message is what you get if you delete `app/books/[id]/page.js`.) Every intercepted URL needs a real page for refreshes and shared links.

### The slot prop is undefined

The layout must be in the **same folder** as the `@modal` folder, and the prop name must match the folder name without the `@`. `app/books/@modal` gives `app/books/layout.js` a `modal` prop, not the root layout. Restart the dev server after adding a new slot.

### The modal will not go away

You navigated with a `<Link>` to a URL inside the same layout and the modal stayed. Add a slot page that returns `null` for that URL (`@modal/page.js` for `/books`), or close with `router.back()`.

## Quick recap

- A folder named `@something` creates a **slot**. The layout in the same folder gets it as a prop, next to `children`. Slots do not appear in the URL.
- On soft navigation, a slot with no match keeps its old content. On hard navigation, it renders `default.js`. In Next.js 16 every slot must have a `default.js`, or the build fails.
- Intercepting folders start with `(.)`, `(..)`, `(..)(..)` or `(...)` and count route segments, ignoring `@slot` folders.
- Interception happens only on soft navigation. Refresh or a shared link shows the real page.
- A modal route is `@modal/(.)[id]/page.js` wrapped in a client `Modal` that closes with `router.back()`.
- With Cache Components on, give the intercepting page its own `generateStaticParams`.
- Add `@modal/page.js` returning `null` so links back to `/books` close the modal.

<code id="code-content" class="language-jsx">
// app/books/@modal/(.)[id]/page.js: show a book in a modal over the list
import { notFound } from 'next/navigation';
import Modal from '@/components/Modal';
import { getBook, getBooks } from '@/lib/books';
// Cache Components: prerender the modal for every known book
export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) =&gt; ({ id: book.id }));
}
export default async function BookModal({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();
  return (
    &lt;Modal&gt;
      &lt;h2 className="text-xl font-bold"&gt;{book.title}&lt;/h2&gt;
      &lt;p&gt;{book.description}&lt;/p&gt;
      {/* A plain a tag does a hard navigation, so the full page loads */}
      &lt;a href={`/books/${book.id}`}&gt;Open the full page&lt;/a&gt;
    &lt;/Modal&gt;
  );
}
// --- next file: app/books/layout.js
// export default function BooksLayout({ children, modal }) {
//   return (&lt;&gt;{children}{modal}&lt;/&gt;);
// }
// --- next file: app/books/@modal/default.js (required in Next.js 16)
// export default function Default() { return null; }
// --- next file: app/books/@modal/page.js (closes the modal on /books)
// export default function ModalPage() { return null; }
// --- next file: components/Modal.js
// 'use client';
// import { useRouter } from 'next/navigation';
// export default function Modal({ children }) {
//   const router = useRouter();
//   return (
//     &lt;div className="fixed inset-0 bg-black/50" onClick={() =&gt; router.back()}&gt;
//       &lt;div onClick={(e) =&gt; e.stopPropagation()}&gt;{children}&lt;/div&gt;
//     &lt;/div&gt;
//   );
// }
</code></pre>

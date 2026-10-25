---
publishDate: 2026-10-25T13:49
title: Lazy Loading with next/dynamic
slug: lazy-loading
metadescription: Send less JavaScript to the browser by lazy loading Client Components with next/dynamic, React.lazy and import(), and skip server rendering with ssr false.
updateDate: 2026-10-25T13:49
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'next-dynamic', 'performance', 'code-splitting']
course: nextjs
---

## Why load less JavaScript

Every Client Component you write becomes JavaScript the browser has to download, read and run before the page is interactive. On a fast laptop you barely notice. On a cheap phone with a weak connection, a big bundle can mean several seconds of staring at a page that ignores taps.

**Lazy loading** means: do not send code until it is actually needed. Think of a restaurant. The kitchen does not cook every dish on the menu when you sit down. It cooks what you order, when you order it. In this lesson you will:

- load a Client Component only when the user asks for it, with `next/dynamic`
- show a placeholder while it loads
- turn off server rendering for a component that only works in the browser, with `ssr: false`
- do the same with React's own `lazy` and `Suspense`
- load a whole library (a fuzzy search tool) only on first use, with `import()`

## First: what you do not need to lazy load

**Server Components are already split automatically.** Their code runs on the server and never reaches the browser, so there is nothing to lazy load. (You learned this in [Server Components Explained](/courses/nextjs/server-components).) Each route also gets its own bundle, so code for `/cart` is not downloaded on `/books`.

Lazy loading is for **Client Components** and **browser libraries** that are big and not needed right away: a reviews panel behind a button, a chart, a rich text editor, a map, a date picker.

## Step 1: load a component on demand with next/dynamic

Book Nook's book page should get a **Reviews** panel with a star picker and a long list. Most visitors never open it, so there is no point downloading it for everyone. Here is the component (a normal Client Component, nothing special yet):

```jsx
// components/ReviewsPanel.js
'use client';

import { useState } from 'react';

export default function ReviewsPanel({ bookTitle }) {
  const [stars, setStars] = useState(0);

  return (
    <section className="mt-6 rounded border p-4">
      <h2 className="text-lg font-semibold">Reviews of {bookTitle}</h2>
      <p>Your rating:</p>
      <div>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
            {n <= stars ? '★' : '☆'}
          </button>
        ))}
      </div>
      {/* imagine a long list of reviews and a big form here */}
    </section>
  );
}
```

Now make a small Client Component with a button that shows the panel. Instead of a normal `import`, use `dynamic` from `next/dynamic`:

```jsx
// components/ReviewsToggle.js
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const ReviewsPanel = dynamic(() => import('./ReviewsPanel'), {
  loading: () => <p>Loading reviews...</p>,
});

export default function ReviewsToggle({ bookTitle }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen(true)} className="underline">
        Show reviews
      </button>
      {open && <ReviewsPanel bookTitle={bookTitle} />}
    </div>
  );
}
```

Finally, use the toggle on the book page (a Server Component):

```jsx
// app/books/[id]/page.js (inside the returned JSX)
<ReviewsToggle bookTitle={book.title} />
```

What changed?

- `dynamic(() => import('./ReviewsPanel'))` does not load the file yet. It returns a stand-in component. The real code is put into a separate file (a **chunk**) by the bundler.
- `{open && <ReviewsPanel />}` means the stand-in is only rendered after the click. That is the moment the browser downloads the chunk.
- `loading` is what shows while the chunk downloads. On a fast connection you may only see it for a blink.

To see it working, open the browser developer tools, go to the **Network** tab, and filter by **JS**. Load a book page, then click **Show reviews**. A new JavaScript file appears in the list only after the click.

> **Good to know:** If you render a dynamic component straight away (without a condition), it still goes into its own chunk, but that chunk is loaded immediately. That helps a little with caching, but the real win comes from loading it **later**, behind a click, a tab or a scroll.

## Step 2: browser-only components with ssr: false

Client Components are still **prerendered** on the server to make the first HTML. Usually that is great. But some code only works in a browser, because it uses things like `window`, `localStorage` or `navigator`, which do not exist on the server.

Book Nook wants a "Recently viewed" box that reads from `window.localStorage`:

```jsx
// components/RecentlyViewed.js
'use client';

export default function RecentlyViewed() {
  const saved = JSON.parse(window.localStorage.getItem('recently-viewed') ?? '[]');

  if (saved.length === 0) return null;

  return (
    <aside className="mt-6">
      <h2 className="font-semibold">Recently viewed</h2>
      <ul>
        {saved.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </aside>
  );
}
```

Import it normally and the server tries to render it, which fails:

```text
ReferenceError: window is not defined
```

Tell Next.js to skip the server for this one component with `ssr: false`:

```jsx
// components/RecentlyViewedLoader.js
'use client';

import dynamic from 'next/dynamic';

const RecentlyViewed = dynamic(() => import('./RecentlyViewed'), {
  ssr: false,
  loading: () => <p className="mt-6 text-stone-500">Loading your history...</p>,
});

export default function RecentlyViewedLoader() {
  return <RecentlyViewed />;
}
```

Now the server sends the `loading` placeholder in the HTML, and the browser swaps in the real component once its code has loaded.

Notice the extra file. **`ssr: false` is only allowed inside a Client Component.** Put it in a Server Component (like `page.js`) and the build stops:

```text
Error: `ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component.
```

That is why `RecentlyViewedLoader.js` exists: a tiny `'use client'` wrapper whose only job is to hold the `dynamic(..., { ssr: false })` call. The page imports the wrapper:

```jsx
// app/books/[id]/page.js
import RecentlyViewedLoader from '@/components/RecentlyViewedLoader';

// ...inside the returned JSX
<RecentlyViewedLoader />
```

> **Tip:** `ssr: false` is a tool for code that truly cannot run on the server. If you only need `window` inside a click handler or a `useEffect`, you do not need it: those never run on the server anyway.

## Step 3: named exports

`dynamic` expects the module's **default** export. If a file uses a named export, pick it out with `.then`:

```jsx
// components/BookExtras.js
'use client';

export function GiftWrapOptions() {
  return <p>Gift wrap available for 2 dollars.</p>;
}
```

```jsx
// components/ExtrasToggle.js
'use client';

import dynamic from 'next/dynamic';

const GiftWrapOptions = dynamic(() =>
  import('./BookExtras').then((mod) => mod.GiftWrapOptions)
);
```

## Step 4: the plain React way, React.lazy and Suspense

`next/dynamic` is built on two React features: `lazy` and `<Suspense>`. You can use them directly too:

```jsx
// components/ReviewsToggle.js
'use client';

import { lazy, Suspense, useState } from 'react';

const ReviewsPanel = lazy(() => import('./ReviewsPanel'));

export default function ReviewsToggle({ bookTitle }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen(true)}>Show reviews</button>
      {open && (
        <Suspense fallback={<p>Loading reviews...</p>}>
          <ReviewsPanel bookTitle={bookTitle} />
        </Suspense>
      )}
    </div>
  );
}
```

The fallback works just like the `<Suspense>` boundaries from [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming). Which should you use?

| | `next/dynamic` | `React.lazy` + `Suspense` |
| --- | --- | --- |
| Placeholder | `loading` option | `fallback` on `<Suspense>` |
| Skip server rendering | `ssr: false` | Not available |
| Works outside Next.js | No | Yes |

Pick `next/dynamic` when you need `ssr: false`. Otherwise both are fine; use whichever reads better to you.

## Step 5: lazy load a library with import()

Lazy loading is not only for components. Any big library can be loaded with the **dynamic `import()`** function, which returns a Promise of the module.

Book Nook's search box would be friendlier with **fuzzy search**, so "hobit" still finds "The Hobbit". The `fuse.js` library does that, but there is no reason to download it until someone types. Install it:

```bash
npm install fuse.js
```

Then load it inside the event handler:

```jsx
// components/FuzzySearch.js
'use client';

import { useState } from 'react';

export default function FuzzySearch({ books }) {
  const [results, setResults] = useState([]);

  async function handleChange(event) {
    const query = event.target.value;

    // Downloaded the first time someone types, then reused
    const Fuse = (await import('fuse.js')).default;
    const fuse = new Fuse(books, { keys: ['title', 'author'] });

    setResults(fuse.search(query).map((result) => result.item));
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Search books (typos are fine)"
        onChange={handleChange}
        className="rounded border px-2 py-1"
      />
      <ul>
        {results.map((book) => (
          <li key={book.id}>{book.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

A Server Component page can fetch the books and pass them in:

```jsx
// app/books/page.js (inside the returned JSX)
<FuzzySearch books={books} />
```

The browser caches the module after the first `import()`, so later keystrokes do not download it again. `.default` is needed because `fuse.js` puts its main class on the default export.

## Rules that keep lazy loading working

The bundler has to find your `import()` calls while building, before any code runs. So:

- **Write the path as plain text.** `import('./ReviewsPanel')` works. `import(componentName)` or a template string with a variable does not.
- **Call `dynamic()` at the top level of the file**, outside any component. Calling it inside a component creates a new component on every render.
- **Use it for big things.** Splitting a 20 line button into its own chunk adds a network request and saves nothing.

## Common mistakes

### ssr: false in a Server Component

```text
Error: `ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component.
```

Move the `dynamic` call into a small file that starts with `'use client'`, and import that file from the page.

### "window is not defined"

```text
ReferenceError: window is not defined
```

A Client Component touched a browser-only object while rendering on the server. Move the code into `useEffect` or an event handler, or load the component with `dynamic(..., { ssr: false })` from a Client Component.

### Expecting dynamic() in a Server Component to split the code

```jsx
// app/books/[id]/page.js (a Server Component)
const ReviewsPanel = dynamic(() => import('@/components/ReviewsPanel'));
```

This is allowed, but when a Server Component dynamically imports a Client Component, automatic code splitting is currently not supported. To get a separate chunk that loads on demand, do the `dynamic` import from inside a Client Component, as in Step 1.

### The placeholder flashes and the layout jumps

When the real component is taller than the `loading` placeholder, the page jumps as it appears. Give the placeholder roughly the same height (for example `className="h-40"`), as you would for any skeleton.

## Quick recap

- Server Components are split automatically. Lazy load **Client Components** and **libraries** that are big and not needed at first.
- `const X = dynamic(() => import('./X'), { loading: () => <p>...</p> })` creates a component whose code is downloaded when it first renders.
- Render it behind a condition (`{open && <X />}`) to delay the download until the user asks.
- `ssr: false` skips server rendering for browser-only components, and only works inside Client Components.
- `React.lazy` with `<Suspense fallback>` does the same job, without `ssr: false`.
- `await import('library')` inside an event handler loads a library on first use.
- Keep import paths as plain strings and call `dynamic()` at the top level of the file.

<code id="code-content" class="language-jsx">
// components/ReviewsToggle.js: load the reviews panel only when asked
'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
// The panel's code goes into its own chunk; nothing downloads yet
const ReviewsPanel = dynamic(() =&gt; import('./ReviewsPanel'), {
  loading: () =&gt; &lt;p&gt;Loading reviews...&lt;/p&gt;, // shown while the chunk downloads
});
// Browser-only box: skip server rendering (allowed only in a Client Component)
const RecentlyViewed = dynamic(() =&gt; import('./RecentlyViewed'), {
  ssr: false,
});
export default function ReviewsToggle({ bookTitle }) {
  const [open, setOpen] = useState(false);
  return (
    &lt;div&gt;
      &lt;button onClick={() =&gt; setOpen(true)}&gt;Show reviews&lt;/button&gt;
      {/* The chunk is requested the first time this renders */}
      {open &amp;&amp; &lt;ReviewsPanel bookTitle={bookTitle} /&gt;}
      &lt;RecentlyViewed /&gt;
    &lt;/div&gt;
  );
}
// --- Loading a library on first use, inside an event handler:
// const Fuse = (await import('fuse.js')).default;
// const fuse = new Fuse(books, { keys: ['title', 'author'] });
</code></pre>

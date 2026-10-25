---
publishDate: 2026-10-25T13:24
title: Handling Errors with error.js
slug: error-handling
metadescription: "Handle errors in Next.js 16: return expected errors as values, catch crashes with error.js and retry, wrap sections with catchError, and add global-error.js."
updateDate: 2026-10-25T13:24
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'errors', 'error-boundary']
course: nextjs
---

## What you will learn

Things go wrong. An outside API is down, a database times out, someone types a book id that does not exist, or there is simply a bug in your code. A good app does not show a blank white page when that happens. It shows a helpful message, keeps the rest of the page working, and gives the visitor a way to try again.

Next.js splits errors into two kinds, and handles them differently:

- **Expected errors** are things you know can happen during normal use: a book that does not exist, a form with a missing field, an API that sometimes fails. You **check for them** and show a message, like any other result.
- **Unexpected errors** (also called **uncaught exceptions**) are crashes you did not plan for: a bug, or a server that is completely down. You let them **throw**, and a safety net called an **error boundary** catches them and shows a fallback screen.

Think of a shop. A customer asking for a book you do not stock is expected: you say "sorry, we do not have that one". A burst water pipe is unexpected: you put up a sign, close that section, and the rest of the shop stays open.

In this lesson you will:

- handle expected errors as normal return values
- add `error.js` files to catch crashes in a route
- let visitors retry with `retry()`
- protect a single section of a page with `catchError`
- add a last-resort `global-error.js`

## Part 1: expected errors

### Check, do not throw

In [Fetching Data in Server Components](/courses/nextjs/fetching-data) you already handled an expected error without thinking about it:

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
  // ...show the list
}
```

The outside API failing is normal life on the internet, so the component checks `res.ok` and shows a calm message. The rest of the page is not affected at all.

### Missing things: notFound()

A book id that does not exist is also expected. You handle it with `notFound()`, which shows your 404 page ([Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects)):

```jsx
// app/books/[id]/page.js (part)
const book = await getBook(id);

if (!book) {
  notFound();
}
```

### Errors from forms and actions: return them

When a visitor submits a form, problems like "the email is missing" are expected too. The Next.js docs are clear here: **model expected errors as return values**, not as thrown errors. A Server Action returns an object describing the problem:

```javascript
// app/actions.js
'use server';

export async function subscribe(prevState, formData) {
  const email = formData.get('email');

  if (!email || !email.includes('@')) {
    return { message: 'Please enter a valid email address.' };
  }

  // ...save the email
  return { message: 'Thanks! You are on the list.' };
}
```

A Client Component shows that message with React's `useActionState` hook:

```jsx
// components/NewsletterForm.js
'use client';

import { useActionState } from 'react';
import { subscribe } from '@/app/actions';

export default function NewsletterForm() {
  const [state, formAction, pending] = useActionState(subscribe, { message: '' });

  return (
    <form action={formAction} className="flex gap-2">
      <input name="email" type="email" className="rounded border px-3 py-1" />
      <button disabled={pending} className="rounded bg-brand-500 px-3 py-1 text-white">
        Subscribe
      </button>
      {state.message && <p aria-live="polite">{state.message}</p>}
    </form>
  );
}
```

Do not worry about the details yet. Server Actions and forms have their own lessons: [Server Functions and Server Actions](/courses/nextjs/server-actions) and [Validating Forms and Showing Errors](/courses/nextjs/form-validation). The idea to take away now: **if you can predict it, return it.**

## Part 2: unexpected errors with error.js

### Step 1: break something on purpose

To see an error boundary at work, you need a crash. Temporarily add a `throw` to the top of `getBook` in `lib/books.js`:

```javascript
// lib/books.js (temporary, remove it later)
export async function getBook(id) {
  throw new Error('The book database is not answering');
  return books.find((book) => book.id === id) ?? null;
}
```

Open any book page. In development you get the red **error overlay** with the message and the file and line where it happened. That overlay is only for you, the developer. Close it (press **Esc** or click the close button) and you see what a visitor would see: the default Next.js error screen. Let us replace it with something friendlier.

### Step 2: add error.js

Create `app/books/error.js`:

```jsx
// app/books/error.js
'use client';

import { useEffect } from 'react';

export default function BooksError({ error, retry }) {
  useEffect(() => {
    // Send the error to your logging tool here
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl p-8 text-center">
      <h2 className="font-serif text-2xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-zinc-600">We could not load this part of the shop. Please try again.</p>
      <button
        onClick={() => retry()}
        className="mt-6 rounded-full bg-brand-500 px-5 py-2 text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </main>
  );
}
```

Things to notice:

- **`'use client'` is required.** Error boundaries are a React feature that runs in the browser, so `error.js` must be a Client Component. Forget it and the build stops (see Common mistakes).
- The component receives the thrown value as `error`.
- The `useEffect` is the place to report the error to a logging service, so you hear about problems your visitors hit.
- `retry` is a function that tries again (Step 4).

Reload the book page and close the overlay. The visitor now sees your message. Better still, your **layout is still there**: the header, the navigation and the cart all keep working. Only the part of the page inside `app/books` was replaced.

### Step 3: where does error.js catch errors?

`error.js` wraps the route segment it lives in, **and every segment below it**, in an error boundary. For our file:

```text
app/
├── layout.js          not covered (it is above)
└── books/
    ├── layout.js      not covered (same folder, but error.js sits inside it)
    ├── error.js       the boundary
    ├── loading.js     covered
    ├── page.js        covered (/books)
    └── [id]/
        └── page.js    covered (/books/[id])
```

Errors **bubble up** to the nearest boundary above them. If `app/books/[id]/error.js` existed, a crash on a book page would use that one instead; a crash on `/books` would still use `app/books/error.js`.

Just like `loading.js`, an `error.js` does **not** protect the `layout.js` in its own folder. An error in `app/books/layout.js` goes up to `app/error.js`. Many apps add one `app/error.js` as a general safety net for everything, plus more specific ones where a custom message helps.

### Step 4: try again with retry()

Now remove the temporary `throw` from `getBook` and save. Back in the browser, click **Try again**.

`retry()` asks Next.js to fetch that part of the page **from the server again** and re-render it. The book loads, and your error screen disappears without a full page reload. This is perfect for errors that are temporary, like a database that was restarting for a moment.

The error component also receives a second function, `reset()`. It only clears the error and re-renders **without** fetching again from the server, so it cannot fix an error that happened in a Server Component. In almost every case, use `retry()`.

> **Good to know:** `retry` became a stable part of Next.js in version 16.3. In 16.2 it was called `unstable_retry`, and older tutorials only use `reset`. In Next.js 16.4 your error component receives `error`, `retry` and `reset`.

### Step 5: what the visitor sees in production

In development, `error.message` holds your real message ("The book database is not answering"). In a **production** build, errors that happen in Server Components are hidden from the browser, because a message might contain private details, like a database address. The message is replaced with a generic one, and `error` gets a `digest` property instead: a short code that matches the error written in your **server logs**.

So never show `error.message` from a Server Component to visitors and expect it to be useful. Show your own friendly text, and if you like, show the digest so a customer can quote it to support:

```jsx
// app/books/error.js (part)
{error?.digest && (
  <p className="mt-4 text-xs text-zinc-400">Error code: {error.digest}</p>
)}
```

## Part 3: protecting one section with catchError

`error.js` replaces a whole route segment. Sometimes that is too much. If only the reviews on a book page fail, you still want to show the book and its "Add to cart" button.

For that, Next.js 16 has `catchError` from `next/error`. It turns a small fallback function into an error boundary component you can wrap around **any** part of the page:

```jsx
// components/SectionErrorBoundary.js
'use client';

import { catchError } from 'next/error';

function SectionError(props, { error, retry }) {
  return (
    <div className="rounded-lg bg-red-50 p-4 text-red-800">
      <p>{props.message}</p>
      <button onClick={() => retry()} className="mt-2 underline">
        Try again
      </button>
    </div>
  );
}

export default catchError(SectionError);
```

The fallback function gets two arguments: the **props** you pass to the boundary (here `message`), and an object with `error`, `retry` and `reset`. Use it in the book page:

```jsx
// app/books/[id]/page.js (part)
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

<SectionErrorBoundary message="Reviews are not available right now.">
  <Suspense fallback={<p>Loading reviews...</p>}>
    <Reviews bookId={book.id} />
  </Suspense>
</SectionErrorBoundary>
```

Now if `getReviews` throws, only the reviews box shows the red message. Everything else on the page works. `catchError` also knows about Next.js's own special "errors" such as `notFound()` and `redirect()`, so it lets those pass through instead of catching them by mistake.

## Part 4: errors in event handlers

Error boundaries catch errors that happen **while rendering**. They do not catch errors in event handlers like `onClick`, because those run later, after rendering is finished. Handle those yourself with `try...catch` and some state.

Here is a "Copy link" button for a book page. Copying to the clipboard can fail, for example if the browser blocks it:

```jsx
// components/CopyLinkButton.js
'use client';

import { useState } from 'react';

export default function CopyLinkButton() {
  const [status, setStatus] = useState('');

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus('Link copied!');
    } catch (err) {
      setStatus('Sorry, we could not copy the link. Please copy it from the address bar.');
    }
  }

  return (
    <div>
      <button onClick={handleClick} className="rounded-full border px-4 py-2 hover:bg-zinc-100">
        Copy link
      </button>
      {status && <p className="mt-2 text-sm text-zinc-600">{status}</p>}
    </div>
  );
}
```

The same pattern works for any click that might fail, such as adding to the cart from your `CartProvider` ([State, Context and Providers in Next.js](/courses/nextjs/state-context-and-providers)) or calling an API: catch the error, save a message in state, and show it.

## Part 5: global-error.js, the last safety net

`app/error.js` catches errors in your pages, but not in the **root layout** (`app/layout.js`) itself. For that rare case, add `app/global-error.js`:

```jsx
// app/global-error.js
'use client';

export default function GlobalError({ error, retry }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <title>Something went wrong | Book Nook</title>
        <h2>Sorry, Book Nook is having trouble.</h2>
        <button onClick={() => retry()}>Try again</button>
      </body>
    </html>
  );
}
```

When it is active, it **replaces the root layout completely**. That has three consequences:

- It must render its own `<html>` and `<body>` tags.
- Your global CSS, fonts and providers are **not** there. That is why this example uses a simple inline `style` instead of Tailwind classes.
- It cannot export `metadata` (it is a Client Component), so use React's `<title>` element for the tab title, as above.

You will rarely see this screen. It is a safety net for when everything else has failed.

## Common mistakes

### Forgetting 'use client' in error.js

```text
Error: app/books/error.js must be a Client Component. Add the "use client" directive the top of the file to resolve this issue.
```

Add `'use client';` as the very first line of every `error.js` and `global-error.js`.

### Using unstable_retry from an older tutorial

In Next.js 16.4 the prop is called `retry`. If you write `({ error, unstable_retry })`, that prop is `undefined`, and clicking the button fails with `TypeError: unstable_retry is not a function`. Rename it to `retry`.

### Expecting error.js to catch layout errors in the same folder

An `error.js` protects the pages and nested layouts **below** it, not the `layout.js` next to it. Put an `error.js` one level higher (for example `app/error.js`), and use `global-error.js` for the root layout.

### Throwing for expected problems

```javascript
if (!email) {
  throw new Error('Email is required'); // shows the error screen
}
```

A missing form field is not a crash. Return `{ message: '...' }` from the action and show it in the form, so the visitor keeps what they typed and can fix it.

### Showing error.message to visitors

In production, Server Component error messages are replaced with a generic message on purpose. Write your own friendly text in the error component instead of displaying `error.message`.

## Quick recap

- **Expected errors** (missing data, failed API calls, bad form input): check for them and return a message or call `notFound()`. Do not throw.
- **Unexpected errors**: let them throw, and catch them with an `error.js` file in a route folder.
- `error.js` must start with `'use client'`. It receives `error`, `retry` and `reset`.
- `retry()` fetches the segment from the server again and re-renders it; use it instead of `reset()`. In 16.4 it is `retry`, not `unstable_retry`.
- Errors bubble up to the nearest `error.js`. An `error.js` does not cover the `layout.js` in its own folder.
- In production, Server Component error messages are hidden; use `error.digest` to find the error in your server logs.
- `catchError` from `next/error` makes an error boundary for any single section of a page.
- Error boundaries do not catch errors in event handlers; use `try...catch` and state there.
- `app/global-error.js` replaces the root layout when it fails, so it needs its own `<html>` and `<body>`.

<code id="code-content" class="language-jsx">
// app/books/error.js: a friendly error screen for everything under /books
'use client'; // error boundaries must be Client Components
import { useEffect } from 'react';
export default function BooksError({ error, retry }) {
  useEffect(() =&gt; {
    // Report the error to your logging service here
    console.error(error);
  }, [error]);
  return (
    &lt;main className="mx-auto max-w-3xl p-8 text-center"&gt;
      &lt;h2 className="font-serif text-2xl font-bold"&gt;Something went wrong&lt;/h2&gt;
      &lt;p className="mt-2 text-zinc-600"&gt;We could not load this part of the shop. Please try again.&lt;/p&gt;
      {/* retry() fetches this segment from the server again and re-renders it */}
      &lt;button
        onClick={() =&gt; retry()}
        className="mt-6 rounded-full bg-brand-500 px-5 py-2 text-white hover:bg-brand-700"
      &gt;
        Try again
      &lt;/button&gt;
      {/* In production, the digest matches the full error in your server logs */}
      {error?.digest &amp;&amp; &lt;p className="mt-4 text-xs text-zinc-400"&gt;Error code: {error.digest}&lt;/p&gt;}
    &lt;/main&gt;
  );
}
// --- components/SectionErrorBoundary.js: protect one section of a page
// 'use client';
// import { catchError } from 'next/error';
// function SectionError(props, { error, retry }) {
//   return &lt;p&gt;{props.message} &lt;button onClick={() =&gt; retry()}&gt;Try again&lt;/button&gt;&lt;/p&gt;;
// }
// export default catchError(SectionError);
</code></pre>

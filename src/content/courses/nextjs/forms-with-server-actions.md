---
publishDate: 2026-10-25T13:35
title: Building Forms with Server Actions
slug: forms-with-server-actions
metadescription: Build Book Nook's add a review form with a Server Action. Read FormData, save, refresh the cache, redirect, and show messages with useActionState.
updateDate: 2026-10-25T13:35
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'forms', 'server-actions', 'useactionstate']
course: nextjs
---

## What you will build

Readers want to share what they thought of a book. In this lesson you will add a **"Write a review"** page to Book Nook:

```text
/books/dune            the book page, with its reviews and a "Write a review" link
/books/dune/review     a form: name, rating, review text
```

When the reader submits the form, a Server Action checks the data, saves the review, refreshes the cached reviews, and sends the reader back to the book page, where the new review is already visible. Then you will upgrade the form with `useActionState` so it can show a message and a "Saving..." button.

You should know what a Server Action is from [Server Functions and Server Actions](/courses/nextjs/server-actions). We tested every file in this lesson in a production build of Book Nook, including submitting the form.

## Step 1: a place to keep reviews

Reviews need storage. In a finished app they live in the database from [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database). To keep the focus on forms, we start with an array in memory, behind `async` functions so you can swap in the database later without touching the pages. Reviews now get their own file, `lib/reviews.js`. If you still have the pretend `getReviews` from [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming) at the bottom of `lib/books.js`, delete it and change any `import { getReviews } from '@/lib/books'` to `'@/lib/reviews'`:

```javascript
// lib/reviews.js
import { cacheLife, cacheTag } from 'next/cache';

const reviews = [
  { id: 1, bookId: 'dune', name: 'Asha', rating: 5, text: 'The best science fiction I have read.' },
];

export async function getReviews(bookId) {
  'use cache';
  cacheLife('days');
  cacheTag(`reviews-${bookId}`);
  return reviews.filter((review) => review.bookId === bookId);
}

export async function addReview({ bookId, name, rating, text }) {
  const review = { id: Date.now(), bookId, name, rating, text }; // a simple unique id for a demo
  reviews.push(review);
  return review;
}
```

`getReviews` is cached with the tag `reviews-dune` (for Dune), so the book page stays static. After a new review is saved, we will clear exactly that tag. (An in-memory array is emptied whenever the server restarts, which is fine for learning.)

## Step 2: the form page

Create the review page. It is a Server Component with a plain HTML form:

```jsx
// app/books/[id]/review/page.js
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books';
import { createReview } from '@/app/actions';

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

export default async function ReviewPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  const createReviewForBook = createReview.bind(null, book.id);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">Review {book.title}</h1>

      <form action={createReviewForBook} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          Your name
          <input name="name" required className="rounded border p-2" />
        </label>

        <label className="flex flex-col gap-1">
          Rating
          <select name="rating" defaultValue="5" className="rounded border p-2">
            <option value="5">5: loved it</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1: not for me</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Your review
          <textarea name="text" rows={5} required className="rounded border p-2" />
        </label>

        <button type="submit" className="rounded bg-black px-4 py-2 text-white">
          Post review
        </button>
      </form>
    </main>
  );
}
```

The important details:

- Every field has a **`name`**. That name is how the Server Action finds the value. A field without `name` is not sent at all.
- `createReview.bind(null, book.id)` passes the book id as the first argument, as you learned in the last lesson. The alternative, a hidden field like `<input type="hidden" name="bookId" value={book.id} />`, also works, but the value then sits in the HTML for anyone to change. Either way, you will check it on the server.
- `required` gives quick feedback in the browser, but it is only a convenience. Anyone can skip it, so the server checks again.

## Step 3: the Server Action

Add `createReview` to the actions file from the previous lesson:

```javascript
// app/actions.js
'use server';

import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { getBook } from '@/lib/books';
import { addReview } from '@/lib/reviews';

export async function createReview(bookId, formData) {
  // 1. Read the fields by their "name"
  const name = String(formData.get('name') ?? '').trim();
  const rating = Number(formData.get('rating'));
  const text = String(formData.get('text') ?? '').trim();

  // 2. Check them on the server (the browser checks can be skipped)
  if (!name || !text || !(rating >= 1 && rating <= 5)) {
    throw new Error('Invalid review');
  }
  const book = await getBook(bookId);
  if (!book) {
    throw new Error('Unknown book');
  }

  // 3. Save
  await addReview({ bookId: book.id, name, rating, text });

  // 4. Clear the cached reviews for this book, so the next read is fresh
  updateTag(`reviews-${book.id}`);

  // 5. Send the reader back to the book page (this stops the function)
  redirect(`/books/${book.id}`);
}
```

Let's walk through it.

**Reading `FormData`.** When a form calls an action, the action receives a **`FormData`** object: the browser's standard container for form fields. `formData.get('name')` returns the value of the field with `name="name"`, or `null` if there is none. Values always arrive as **strings**, so `Number(...)` turns the rating into a number. `String(... ?? '').trim()` turns `null` into an empty string and removes extra spaces.

> **Tip:** With many fields, `Object.fromEntries(formData)` gives you one plain object. It also contains some extra keys starting with `$ACTION_` that Next.js uses internally, so pick out the fields you need rather than saving the whole object.

**Refreshing the cache.** `updateTag('reviews-dune')` expires the cached reviews for Dune, so the book page has to fetch them again. Because it is called inside a Server Action, the reader sees the new review immediately. (See [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation).)

**Redirecting.** `redirect('/books/dune')` sends the browser to the book page. This pattern, "save, then redirect", means a refresh of the page will not submit the form a second time. `redirect` works by throwing a special signal, so **nothing after it runs**. That is why `updateTag` comes first.

## Step 4: link to the form and show the reviews

On the book page, list the reviews and add a link to the new page:

```jsx
// app/books/[id]/page.js (inside the page's JSX)
import Link from 'next/link';
import { getReviews } from '@/lib/reviews';

// ...after loading the book:
const reviews = await getReviews(book.id);

<section className="mt-8">
  <h2 className="text-xl font-semibold">Reviews</h2>
  <ul className="mt-2 flex flex-col gap-2">
    {reviews.map((review) => (
      <li key={review.id}>
        <strong>{review.name}</strong> ({review.rating}/5): {review.text}
      </li>
    ))}
  </ul>
  <Link href={`/books/${book.id}/review`} className="mt-4 inline-block underline">
    Write a review
  </Link>
</section>
```

Try it: `npm run build`, then `npm run start`. Open `/books/dune`, click "Write a review", fill in the form, and submit. You land back on `/books/dune` with your review in the list, even though the page is static: `updateTag` cleared the cached reviews, and the page was rebuilt with the new data.

It even works with JavaScript turned off in the browser, because the form is a real HTML form rendered on the server (progressive enhancement).

## Step 5: show messages with useActionState

Throwing an error for a bad submission is rough: the reader sees an error page. It is friendlier to stay on the form and show a message. For that, the form needs to remember the action's result, which means **state**, which means a Client Component.

React 19 has a hook made for this, **`useActionState`**. You give it your action and a starting state; it gives you back three things:

```javascript
const [state, formAction, pending] = useActionState(action, initialState);
```

- `state`: whatever your action returned last time (or `initialState` at first).
- `formAction`: a wrapped version of your action to put in `<form action={...}>`.
- `pending`: `true` while the action is running.

First, change the action so it **returns** a message instead of throwing. With `useActionState`, the action also receives the **previous state** as an extra argument, placed **before** `formData`:

```javascript
// app/actions.js
export async function createReview(bookId, prevState, formData) {
  const name = String(formData.get('name') ?? '').trim();
  const rating = Number(formData.get('rating'));
  const text = String(formData.get('text') ?? '').trim();

  if (!name || !text || !(rating >= 1 && rating <= 5)) {
    return { message: 'Please fill in your name, a rating from 1 to 5 and your review.' };
  }

  const book = await getBook(bookId);
  if (!book) {
    return { message: 'That book does not exist.' };
  }

  await addReview({ bookId: book.id, name, rating, text });
  updateTag(`reviews-${book.id}`);
  redirect(`/books/${book.id}`);
}
```

The order of arguments is: values from `bind` first (`bookId`), then the previous state, then `formData`.

Now move the form into a Client Component:

```jsx
// components/ReviewForm.js
'use client';

import { useActionState } from 'react';
import { createReview } from '@/app/actions';

const initialState = { message: '' };

export default function ReviewForm({ bookId }) {
  const createReviewForBook = createReview.bind(null, bookId);
  const [state, formAction, pending] = useActionState(createReviewForBook, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        Your name
        <input name="name" className="rounded border p-2" />
      </label>

      <label className="flex flex-col gap-1">
        Rating
        <select name="rating" defaultValue="5" className="rounded border p-2">
          <option value="5">5: loved it</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1: not for me</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        Your review
        <textarea name="text" rows={5} className="rounded border p-2" />
      </label>

      {state.message && (
        <p aria-live="polite" className="text-red-600">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Post review'}
      </button>
    </form>
  );
}
```

And use it in the review page instead of the inline form:

```jsx
// app/books/[id]/review/page.js (the returned JSX)
import ReviewForm from '@/components/ReviewForm';

return (
  <main className="mx-auto max-w-xl p-8">
    <h1 className="text-2xl font-bold">Review {book.title}</h1>
    <ReviewForm bookId={book.id} />
  </main>
);
```

This version of the form has no `required` attributes, so you can test the server check directly. We submitted the empty form; the page stayed put and showed:

```text
Please fill in your name, a rating from 1 to 5 and your review.
```

With the fields filled in, the action saved the review and redirected to `/books/dune`, which listed the new review. `aria-live="polite"` makes screen readers announce the message when it appears.

> **Good to know:** After a form action finishes, React resets the form's fields. So when you return an error, the reader's text is cleared. In [Validating Forms and Showing Errors](/courses/nextjs/form-validation) you will return the submitted values too and put them back, and show an error next to each field.

## Common mistakes

### A field without a name

`formData.get('rating')` returns `null` and your check fails, even though the reader picked a value. Make sure every `<input>`, `<select>` and `<textarea>` has a `name` that matches what the action reads.

### Wrong argument order with useActionState

If you forget the `prevState` parameter, the action reads the state object as if it were the form data:

```text
TypeError: formData.get is not a function
```

With `useActionState` the order is: bound values, then `prevState`, then `formData`.

### Calling redirect inside try/catch

`redirect()` works by throwing a special signal. If you wrap it in `try { ... } catch { ... }`, your `catch` swallows it and the redirect never happens. Call `redirect` after the `try/catch` block.

### Clearing the cache after redirect

```javascript
redirect(`/books/${book.id}`);
updateTag(`reviews-${book.id}`); // never runs
```

Put `updateTag` (or `revalidatePath`) **before** `redirect`, or the book page shows the old reviews.

### Trusting the browser's checks

`required`, `min` and `maxLength` help honest users, but a direct POST request skips them. Always check the values again inside the action, as `createReview` does.

## Quick recap

- A form's `action` can be a Server Action; it receives a `FormData` with every named field as a string.
- Use `.bind(null, value)` (or a hidden field) to pass extra data like the book id, and check it on the server.
- The usual flow: read fields, validate, save, `updateTag` the affected data, then `redirect`.
- Forms rendered by Server Components work even before JavaScript loads.
- `useActionState(action, initialState)` returns `[state, formAction, pending]`, so a Client Component form can show messages and a pending button.
- With `useActionState`, the action's arguments are: bound values, `prevState`, `formData`.

<code id="code-content" class="language-jsx">
// app/actions.js: the review action (works with useActionState)
'use server';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { getBook } from '@/lib/books';
import { addReview } from '@/lib/reviews';
export async function createReview(bookId, prevState, formData) {
  // Read fields by their name attribute; values arrive as strings
  const name = String(formData.get('name') ?? '').trim();
  const rating = Number(formData.get('rating'));
  const text = String(formData.get('text') ?? '').trim();
  // Validate on the server: browser checks can be skipped
  if (!name || !text || !(rating &gt;= 1 &amp;&amp; rating &lt;= 5)) {
    return { message: 'Please fill in your name, a rating from 1 to 5 and your review.' };
  }
  const book = await getBook(bookId);
  if (!book) {
    return { message: 'That book does not exist.' };
  }
  await addReview({ bookId: book.id, name, rating, text });
  updateTag(`reviews-${book.id}`); // refresh the cached reviews first...
  redirect(`/books/${book.id}`); // ...then leave (nothing after this runs)
}
// --- next file: components/ReviewForm.js
// 'use client';
// import { useActionState } from 'react';
// import { createReview } from '@/app/actions';
// export default function ReviewForm({ bookId }) {
//   const [state, formAction, pending] = useActionState(
//     createReview.bind(null, bookId),
//     { message: '' },
//   );
//   return (
//     &lt;form action={formAction}&gt;
//       &lt;input name="name" /&gt;
//       &lt;select name="rating" defaultValue="5"&gt;...&lt;/select&gt;
//       &lt;textarea name="text" /&gt;
//       {state.message &amp;&amp; &lt;p aria-live="polite"&gt;{state.message}&lt;/p&gt;}
//       &lt;button disabled={pending}&gt;{pending ? 'Saving...' : 'Post review'}&lt;/button&gt;
//     &lt;/form&gt;
//   );
// }
</code></pre>

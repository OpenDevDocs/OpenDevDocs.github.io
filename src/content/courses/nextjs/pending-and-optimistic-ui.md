---
publishDate: 2026-10-25T13:37
title: Pending States and Optimistic Updates
slug: pending-and-optimistic-ui
metadescription: Show loading feedback while Server Actions run with useFormStatus, isPending and useTransition, and update the UI instantly with useOptimistic.
updateDate: 2026-10-25T13:37
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'react-hooks', 'server-actions', 'forms']
course: nextjs
---

## What you will learn

A Server Action takes time: the request travels to the server, the data is saved, and the answer comes back. On a slow phone network that can take seconds. If nothing on the screen changes, people click the button again (and again), or think the site is broken.

React gives you four tools to fix this. You will use all of them in Book Nook:

| Tool | Comes from | Use it for |
| --- | --- | --- |
| `useFormStatus` | `react-dom` | A reusable submit button that knows its form is sending |
| `isPending` from `useActionState` | `react` | The whole form knows its action is running |
| `useTransition` | `react` | Buttons that call an action without a form |
| `useOptimistic` | `react` | Show the result **before** the server answers |

The first three are **pending states**: "please wait, we are working on it". The last one is an **optimistic update**: "we are so sure this will work that we show it already".

Think of ordering at a café. A pending state is the barista saying "coming right up!" so you know they heard you. An optimistic update is the barista putting an empty cup with your name on the counter straight away, before the coffee is made.

This lesson builds on [Validating Forms and Showing Errors](/courses/nextjs/form-validation), where you made the **Add a book** form.

## Make the network slow (so you can see it)

On your own computer, actions finish in a few milliseconds, so pending states flash by too fast to see. While you practise, add a fake delay at the start of your Server Actions:

```javascript
// app/actions.js (inside an action)
await new Promise((resolve) => setTimeout(resolve, 1500)); // remove before going live
```

You can also use the **Network** tab in your browser's developer tools and pick a throttling preset such as **Slow 4G**.

## Tool 1: useFormStatus for a reusable submit button

`useFormStatus` tells a component about the `<form>` it sits inside. The most useful field is `pending`, which is `true` while that form's action runs.

```jsx
// components/SubmitButton.js
'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children, pendingText = 'Saving...' }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? pendingText : children}
    </button>
  );
}
```

Note the import: `useFormStatus` comes from `react-dom`, not `react`.

The big rule: **`useFormStatus` only works in a component rendered inside the `<form>`**. It does not look at forms in the same component, only at a parent form. That is why the button is its own component. Now you can drop it into any form, including one in a Server Component:

```jsx
// components/AddBookForm.js
import SubmitButton from '@/components/SubmitButton';

// ...inside the form
<SubmitButton pendingText="Adding book...">Add book</SubmitButton>
```

`useFormStatus` also returns `data` (the `FormData` being sent), `method` and `action`. For example, `data?.get('title')` lets the button say "Adding The Hobbit...".

## Tool 2: isPending from useActionState

When a form already uses `useActionState`, you get a pending flag for free as the third item:

```jsx
// components/AddBookForm.js
const [state, formAction, isPending] = useActionState(createBook, initialState);
```

`isPending` belongs to the **action**, not to one button, so it is handy for changing the whole form. A neat trick is a `<fieldset>`: when it is `disabled`, every input and button inside it is disabled too.

```jsx
// components/AddBookForm.js
<form action={formAction}>
  <fieldset disabled={isPending} className="flex flex-col gap-4 disabled:opacity-60">
    {/* all the inputs from the last lesson */}
    <SubmitButton pendingText="Adding book...">Add book</SubmitButton>
  </fieldset>
</form>
```

So which one should you use?

- Use `isPending` when the component that owns the form needs to know (to grey out the form, show a spinner next to the title, and so on).
- Use `useFormStatus` when a small child component needs to know, and you want to reuse it in many forms.

They are not rivals. Using both, like above, is perfectly normal.

## Tool 3: useTransition for buttons without a form

Some actions are not forms. A **Remove** button next to a review is just a button with an `onClick`. For that, use `useTransition`.

A **transition** is React's name for an update that may take a while and should not freeze the page. `useTransition` gives you two things: `isPending`, and a `startTransition` function to wrap the slow work in.

In [Building Forms with Server Actions](/courses/nextjs/forms-with-server-actions) you stored reviews in `lib/reviews.js` with `getReviews` and `addReview`. Add a helper to remove one:

```javascript
// lib/reviews.js
export async function removeReview(id) {
  const index = reviews.findIndex((review) => review.id === id);
  if (index !== -1) reviews.splice(index, 1);
}
```

Then a Server Action next to `createReview` in `app/actions.js`. It takes `bookId` and `reviewId` as normal arguments:

```javascript
// app/actions.js
import { removeReview } from '@/lib/reviews';

export async function deleteReview(bookId, reviewId) {
  await removeReview(reviewId);
  updateTag(`reviews-${bookId}`);
}
```

`updateTag` throws away the cached reviews for that book, and Next.js sends the fresh page back in the same response ([Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)). For now anyone can delete any review; [Protecting Pages, Actions and APIs](/courses/nextjs/authorization) fixes that.

Now the button:

```jsx
// components/DeleteReviewButton.js
'use client';

import { useTransition } from 'react';
import { deleteReview } from '@/app/actions';

export default function DeleteReviewButton({ bookId, reviewId }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await deleteReview(bookId, reviewId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="ml-2 text-sm text-red-600 disabled:opacity-50"
    >
      {isPending ? 'Removing...' : 'Remove'}
    </button>
  );
}
```

`isPending` stays `true` for the whole trip: the action running **and** the fresh page arriving. So the button says "Removing..." until the review really disappears.

## Tool 4: useOptimistic for instant results

Pending text is honest, but waiting still feels slow. For actions that almost always succeed (posting a review, liking a book, adding to a list), you can show the result right away. That is an **optimistic update**.

`useOptimistic` takes the real data and a small "update" function:

```jsx
const [optimisticReviews, addOptimisticReview] = useOptimistic(
  reviews,                                        // the real list from the server
  (current, newReview) => [...current, newReview] // how to add a guess to it
);
```

- `optimisticReviews` is what you render. Normally it equals `reviews`.
- While an action runs, calling `addOptimisticReview(review)` makes `optimisticReviews` include your guess.
- When the action finishes, the guess is thrown away and `optimisticReviews` goes back to the real `reviews`, which by then come fresh from the server.

If the action fails, the guess also disappears, so the list never stays wrong.

The review form from the forms lesson lives on its own page and redirects back. For an instant feel, put a quick review form right under the list on the book page. First, an action that saves and refreshes, but does not redirect:

```javascript
// app/actions.js
export async function postReview(bookId, formData) {
  const name = String(formData.get('name') ?? '').trim() || 'Anonymous';
  const rating = Number(formData.get('rating'));
  const text = String(formData.get('text') ?? '').trim();
  if (!text || !(rating >= 1 && rating <= 5)) return;

  const book = await getBook(bookId);
  if (!book) return;

  await addReview({ bookId: book.id, name, rating, text });
  updateTag(`reviews-${book.id}`);
}
```

Then the component that shows the list and the form:

```jsx
// components/Reviews.js
'use client';

import { useOptimistic } from 'react';
import { postReview } from '@/app/actions';
import DeleteReviewButton from '@/components/DeleteReviewButton';

export default function Reviews({ bookId, reviews }) {
  const [optimisticReviews, addOptimisticReview] = useOptimistic(
    reviews,
    (current, newReview) => [...current, newReview]
  );

  async function formAction(formData) {
    // 1. Show the review straight away, marked as "sending"
    addOptimisticReview({
      id: `temp-${Date.now()}`,
      name: formData.get('name') || 'Anonymous',
      rating: Number(formData.get('rating')),
      text: formData.get('text'),
      sending: true,
    });
    // 2. Really save it on the server
    await postReview(bookId, formData);
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">Reviews</h2>
      <ul className="my-4 space-y-2">
        {optimisticReviews.map((review) => (
          <li key={review.id} className={review.sending ? 'opacity-50' : ''}>
            <strong>{review.name}</strong> ({review.rating}/5): {review.text}
            {review.sending ? ' (sending...)' : <DeleteReviewButton bookId={bookId} reviewId={review.id} />}
          </li>
        ))}
      </ul>

      <form action={formAction} className="flex flex-col gap-2">
        <input name="name" placeholder="Your name" className="rounded border px-2 py-1" />
        <select name="rating" defaultValue="5" className="rounded border px-2 py-1">
          <option value="5">5: loved it</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1: not for me</option>
        </select>
        <textarea name="text" required placeholder="What did you think?" className="rounded border px-2 py-1" />
        <button type="submit" className="self-start rounded bg-black px-4 py-2 text-white">
          Post review
        </button>
      </form>
    </section>
  );
}
```

A few details worth noticing:

- `formAction` is a normal async function passed to `action`. React runs it inside a transition for you, which is why `addOptimisticReview` is allowed there.
- The guess gets a temporary id, because the real id only exists after saving.
- The guess is drawn faded with "(sending...)". Being honest that it is not saved yet is good manners, and it hides the **Remove** button, which could not work on a temporary id.
- The form clears itself after the action, because React resets forms whose `action` is a function.

Finally, on the book page, replace the plain review list from the forms lesson with the new component. The page already loads the reviews with the cached `getReviews(book.id)`:

```jsx
// app/books/[id]/page.js (inside the page's JSX)
import Reviews from '@/components/Reviews';

// ...after loading the book and its reviews:
<Reviews bookId={book.id} reviews={reviews} />
```

`reviews` comes from a Server Component and goes into a Client Component as a prop, so it must be plain data (it is: objects with strings and numbers).

Post a review now. It appears at once, faded, then turns solid when the server confirms it.

## When not to be optimistic

Optimistic updates are a promise to the user. Only make promises you can keep:

- **Good fits:** likes, reviews, adding to a wishlist, ticking a to-do. They almost never fail, and a failure is harmless.
- **Bad fits:** payments, placing an order, deleting an account. If these fail after you said "done", the user is misled. Use an honest pending state instead.

If a failure is possible, return an error from the action (as in the last lesson) and show it. The optimistic guess will already have disappeared by then.

## Common mistakes

### useFormStatus always says false

You called `useFormStatus` in the same component that renders the `<form>`. It only reports on a **parent** form. Move the button into its own component and render it inside the form.

### Optimistic update outside an action

```text
An optimistic state update occurred outside a transition or action. To fix, move the update to an action, or wrap with startTransition.
```

You called the optimistic setter from a plain `onClick` or after the action had finished. Call it inside a form action, or inside `startTransition(async () => { ... })`.

### Calling an action from onClick without a transition

If you call `formAction` from `useActionState` directly in an event handler, React warns:

```text
An async function with useActionState was called outside of a transition. This is likely not what you intended (for example, isPending will not update correctly). Either call the returned function inside startTransition, or pass it to an `action` or `formAction` prop.
```

Pass it to a form's `action` prop, or wrap the call in `startTransition`.

### The optimistic item disappears and never comes back

The guess vanished when the action ended, but the real data never updated. The server did not send fresh data: call `updateTag`, `revalidatePath` or `refresh` in the action so the page re-renders with the saved item.

## Quick recap

- Pending states say "working on it"; optimistic updates show the result before the server confirms it.
- `useFormStatus` (from `react-dom`) gives `pending` to a child of a `<form>`. Great for a reusable `SubmitButton`.
- `isPending` from `useActionState` lets the form's own component react, for example with `<fieldset disabled>`.
- `useTransition` gives `isPending` and `startTransition` for actions called from buttons and other events.
- `useOptimistic(realData, updateFn)` shows a guess while an action runs, then falls back to the real data.
- Refresh the data in the action (`updateTag` and friends) so the real result replaces the guess.
- Be optimistic only for actions that rarely fail and are harmless if they do.

<code id="code-content" class="language-jsx">
// components/Reviews.js: an optimistic review list with a pending Remove button
'use client';
import { useOptimistic, useTransition } from 'react';
import { postReview, deleteReview } from '@/app/actions';
export default function Reviews({ bookId, reviews }) {
  // optimisticReviews = real reviews, plus any guesses while an action runs
  const [optimisticReviews, addOptimisticReview] = useOptimistic(
    reviews,
    (current, newReview) =&gt; [...current, newReview]
  );
  async function formAction(formData) {
    // Show the new review at once (React runs form actions in a transition)
    addOptimisticReview({
      id: `temp-${Date.now()}`,
      name: formData.get('name') || 'Anonymous',
      rating: Number(formData.get('rating')),
      text: formData.get('text'),
      sending: true,
    });
    // Save it for real; the action calls updateTag so fresh reviews come back
    await postReview(bookId, formData);
  }
  return (
    &lt;section&gt;
      &lt;h2&gt;Reviews&lt;/h2&gt;
      &lt;ul&gt;
        {optimisticReviews.map((review) =&gt; (
          &lt;li key={review.id} style={{ opacity: review.sending ? 0.5 : 1 }}&gt;
            &lt;strong&gt;{review.name}&lt;/strong&gt; ({review.rating}/5): {review.text}
            {review.sending ? ' (sending...)' : &lt;RemoveButton bookId={bookId} reviewId={review.id} /&gt;}
          &lt;/li&gt;
        ))}
      &lt;/ul&gt;
      &lt;form action={formAction}&gt;
        &lt;input name="name" placeholder="Your name" /&gt;
        &lt;select name="rating" defaultValue="5"&gt;{/* options 5 to 1 */}&lt;/select&gt;
        &lt;textarea name="text" required placeholder="What did you think?" /&gt;
        &lt;button type="submit"&gt;Post review&lt;/button&gt;
      &lt;/form&gt;
    &lt;/section&gt;
  );
}
// A button outside a form: useTransition gives it a pending state
function RemoveButton({ bookId, reviewId }) {
  const [isPending, startTransition] = useTransition();
  return (
    &lt;button
      type="button"
      disabled={isPending}
      onClick={() =&gt; startTransition(async () =&gt; { await deleteReview(bookId, reviewId); })}
    &gt;
      {isPending ? 'Removing...' : 'Remove'}
    &lt;/button&gt;
  );
}
// --- components/SubmitButton.js: useFormStatus must live in a child of the form
// import { useFormStatus } from 'react-dom';
// const { pending } = useFormStatus();
</code></pre>

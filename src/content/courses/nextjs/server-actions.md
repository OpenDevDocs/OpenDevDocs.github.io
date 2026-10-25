---
publishDate: 2026-10-25T13:34
title: Server Functions and Server Actions
slug: server-actions
metadescription: Write Server Functions with use server, call them from forms, buttons and event handlers, refresh cached data afterwards, and keep them secure.
updateDate: 2026-10-25T13:34
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'server-actions', 'use-server', 'mutations']
course: nextjs
---

## What you will learn

So far Book Nook only **reads** data: it shows books and reviews. A real shop also **changes** data: a visitor adds a book to their cart, an admin changes a price, a reader posts a review. Changing data is often called a **mutation**.

In a classic website you would build an API endpoint, then write `fetch('/api/cart', { method: 'POST' })` in the browser. Next.js (with React) offers a shorter path:

- A **Server Function** is an `async` function that always runs on the server, but that you can call from the browser as if it were a normal function. React and Next.js send the network request for you.
- When a Server Function is used to handle a form or a mutation, it is called a **Server Action**. Same thing, used in a specific way. You will hear both names.

Think of a restaurant. You do not walk into the kitchen to cook your meal; you hand your order to the waiter, who takes it to the kitchen and brings back the result. A Server Action is that waiter: your page hands it some data, it carries the order to the server, and it returns with the answer.

In this lesson you will write Server Actions with `'use server'`, call them from a form, a button and an event handler, refresh cached data after a change, and learn the security rule that matters most. The next lesson, [Building Forms with Server Actions](/courses/nextjs/forms-with-server-actions), builds a complete review form.

## Step 1: write your first Server Action

Create `app/actions.js`. The `'use server'` line at the very top marks **every exported function** in the file as a Server Function:

```javascript
// app/actions.js
'use server';

import { cookies } from 'next/headers';
import { getBook } from '@/lib/books';

export async function addToCart(bookId) {
  // Never trust input from the browser: check the book really exists
  const book = await getBook(bookId);
  if (!book) {
    throw new Error('Unknown book');
  }

  const cookieStore = await cookies();
  const cart = cookieStore.get('cart')?.value.split(',').filter(Boolean) ?? [];
  cart.push(book.id);
  cookieStore.set('cart', cart.join(','));

  return cart.length;
}
```

The cart is stored as a comma-separated list of ids in a cookie called `cart`, like `dune,the-hobbit`. That keeps the example small; [Reading Cookies and Headers](/courses/nextjs/cookies-and-headers) covers cookies in depth.

Rules for Server Functions:

- They must be `async`. They run over the network, so they always return a Promise.
- Their arguments and return values must be **serializable** (strings, numbers, plain objects, arrays, `FormData` and so on), because they travel between browser and server.
- They are defined on the server only. Their code never reaches the browser; the browser only gets a reference it can call.

## Step 2: call it from a form

The simplest way to call an action is a `<form>`. React lets you pass a function to the form's `action` prop. Here it is in the book page, a Server Component:

```jsx
// app/books/[id]/page.js (inside BookPage)
import { addToCart } from '@/app/actions';

// ...after loading the book:
const addThisBook = addToCart.bind(null, book.id);

return (
  <main className="mx-auto max-w-2xl p-8">
    <h1 className="text-3xl font-bold">{book.title}</h1>
    <form action={addThisBook}>
      <button type="submit" className="mt-4 rounded bg-black px-4 py-2 text-white">
        Add to cart
      </button>
    </form>
  </main>
);
```

`addToCart.bind(null, book.id)` makes a new function with the first argument already filled in. `bind` is plain JavaScript; the `null` is a value for `this`, which we do not use. When the form is submitted, React calls `addThisBook`, which calls `addToCart('dune')` on the server.

Two nice things happen for free:

- **It works without JavaScript.** Because this form is rendered by a Server Component, it is a real HTML form. If the page's JavaScript has not loaded yet (or is turned off), the browser still submits it. This is called **progressive enhancement**.
- **The page updates by itself.** Setting a cookie inside a Server Action makes Next.js re-render the current page on the server and send the new version back in the same response.

## Step 3: several buttons in one form

A button can call a different action with the `formAction` prop. On the cart page, each row can have its own "Remove" button:

```javascript
// app/actions.js (add below addToCart)
export async function removeFromCart(bookId) {
  const cookieStore = await cookies();
  const cart = cookieStore.get('cart')?.value.split(',').filter(Boolean) ?? [];
  const index = cart.indexOf(String(bookId));
  if (index !== -1) {
    cart.splice(index, 1);
  }
  cookieStore.set('cart', cart.join(','));
}
```

```jsx
// app/cart/page.js (inside CartItems, which reads the cookie behind Suspense)
import { removeFromCart } from '@/app/actions';

<form>
  {books.map((book) => (
    <div key={book.id} className="flex justify-between">
      <span>{book.title}</span>
      <button formAction={removeFromCart.bind(null, book.id)}>Remove</button>
    </div>
  ))}
</form>
```

## Step 4: call it from an event handler

Sometimes you want more control: show "Adding..." while it works, then display the new count. That needs state, so it belongs in a Client Component. You **can** import a Server Action into a Client Component, as long as it comes from a `'use server'` file:

```jsx
// components/AddToCartButton.js
'use client';

import { useState, useTransition } from 'react';
import { addToCart } from '@/app/actions';

export default function AddToCartButton({ bookId }) {
  const [count, setCount] = useState(null);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      onClick={() => {
        startTransition(async () => {
          const newCount = await addToCart(bookId); // runs on the server
          setCount(newCount);
        });
      }}
    >
      {isPending ? 'Adding...' : 'Add to cart'}
      {count !== null && ` (${count} in cart)`}
    </button>
  );
}
```

- `await addToCart(bookId)` looks like a normal function call. Behind the scenes it is a `POST` request to your page, and the return value (`cart.length`) comes back as the result.
- `useTransition` gives you `isPending` while the action runs, and tells React this update can happen in the background. When you call an action outside a form, wrap it in `startTransition` like this.

Use it in the Server Component page: `<AddToCartButton bookId={book.id} />`. You will learn more about pending and instant feedback in [Pending States and Optimistic Updates](/courses/nextjs/pending-and-optimistic-ui).

## Step 5: inline actions in a Server Component

You can also write an action right inside a Server Component, by putting `'use server'` at the top of the function body. This is handy for small, one-page actions:

```jsx
// app/admin/books/[id]/page.js
import { Suspense } from 'react';
import { updateTag } from 'next/cache';
import { db } from '@/lib/db';

async function PriceForm({ params }) {
  const { id } = await params;

  async function updatePrice(formData) {
    'use server';
    // (check that the user is an admin: see the authorization lesson)
    const price = Number(formData.get('price'));
    await db.query('UPDATE books SET price = $1 WHERE id = $2', [price, id]);
    updateTag(`book-${id}`);
    updateTag('books');
  }

  return (
    <form action={updatePrice}>
      <input name="price" type="number" step="0.01" />
      <button type="submit">Save price</button>
    </form>
  );
}

export default function EditPricePage({ params }) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Edit price</h1>
      <Suspense fallback={<p>Loading form...</p>}>
        <PriceForm params={params} />
      </Suspense>
    </main>
  );
}
```

(The form sits behind `<Suspense>` because it needs `params`, which this admin route does not prerender. You learned why in [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering).)

When a form calls an action directly, the action receives the form's **`FormData`**, and `formData.get('price')` reads the input with `name="price"`. The `id` variable from the page is captured by the inline function; Next.js encrypts captured values before they are sent to the browser.

You **cannot** write an inline `'use server'` function inside a Client Component. Put it in a `'use server'` file and import it, as in Step 4.

## Step 6: refresh cached data after a change

Book Nook caches book data with `'use cache'`. After an action changes the database, the cache still holds the old data until you say otherwise. Inside a Server Action you have these tools (all from `next/cache`, explained in [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)):

| You want | Call |
| --- | --- |
| The user to see their change immediately | `updateTag('book-dune')` |
| Other visitors to get fresh data soon, in the background | `revalidateTag('books', 'max')` |
| A whole page path refreshed | `revalidatePath('/books')` |
| Only the current page redrawn, nothing cached changed | `refresh()` |

`updateTag`, `revalidatePath` and `refresh` make Next.js re-render the current page in the **same** response as the action, so the user sees the result after one round trip. That is why the `updatePrice` action above calls `updateTag`: the admin sees the new price straight away.

To send the user somewhere else afterwards, call `redirect()` from `next/navigation`. It stops the function, so call `updateTag` (or the others) **before** it:

```javascript
updateTag('books');
redirect('/admin/books'); // nothing after this line runs
```

## How it works behind the scenes

- At build time, the `'use server'` functions are replaced in the browser code by an **action ID**, a hidden reference. The function body stays on the server.
- Calling the action sends a `POST` request with that ID and the arguments.
- Next.js runs the function on the server and answers with the return value, plus the updated page if you refreshed anything.
- A browser runs actions **one at a time**: if you trigger three quickly, the second waits for the first. Do not use Server Actions for parallel data loading; read data in Server Components instead.

## Security: every action is a public endpoint

This is the most important part of the lesson. A Server Action looks like a private function in your code, but it is really a **public URL that accepts POST requests**. Anyone can call it with any arguments, using tools like `curl`, without ever seeing your form. Hiding the "Save price" button from normal visitors does not protect the action.

Next.js helps a little: it checks that the request comes from your own site (a protection against **CSRF**, cross-site request forgery), limits request bodies to 1 MB by default, and removes unused actions from the build. But your own checks are up to you. In **every** action:

1. **Check who is calling.** Read the session from cookies inside the action and stop if the user is not allowed. You will build this in [Adding Login with Sessions and Cookies](/courses/nextjs/authentication) and [Protecting Pages, Actions and APIs](/courses/nextjs/authorization).
2. **Validate the input.** Treat every argument and form field as untrusted. `addToCart` checks that the book exists; a price must be a positive number; text must have a sensible length. [Validating Forms and Showing Errors](/courses/nextjs/form-validation) shows how.
3. **Return only what the UI needs.** The return value is sent to the browser. Return a count or a message, not a whole database row with private fields.

```javascript
// app/admin/actions.js
'use server';

import { updateTag } from 'next/cache';
import { getCurrentUser } from '@/lib/dal'; // built in the authentication lesson
import { db } from '@/lib/db';

export async function updatePrice(bookId, formData) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new Error('Not allowed');
  }

  const price = Number(formData.get('price'));
  if (!Number.isFinite(price) || price <= 0 || price > 1000) {
    return { message: 'Please enter a price between 0 and 1000.' };
  }

  await db.query('UPDATE books SET price = $1 WHERE id = $2', [price, bookId]);
  updateTag(`book-${bookId}`);
  updateTag('books');
  return { message: 'Price saved.' };
}
```

[Keeping Secrets and Data Safe](/courses/nextjs/data-security) goes further.

## Common mistakes

### Forgetting async

```text
Error: Server Actions must be async functions.
```

Every exported function in a `'use server'` file must be `async`, even if it does not await anything.

### Writing 'use server' inside a Client Component

```text
Error: It is not allowed to define inline "use server" annotated Server Actions in Client Components.
    To use Server Actions in a Client Component, you can either export them from a separate file with "use server" at the top, or pass them down through props from a Server Component.
```

Move the function into a file like `app/actions.js` with `'use server'` on the first line, and import it.

### Exporting helpers from a 'use server' file

Every export of a `'use server'` file becomes a callable endpoint. Keep plain helpers (formatting, database code) in `lib/` files, and export only real actions from the actions file.

### Relying on the UI for security

"Only admins can see this button" is not a check. Anyone can send the POST request directly. Check the user and validate the input inside the action itself.

## Quick recap

- A Server Function is an `async` function marked with `'use server'` that runs on the server but can be called from the browser. Used for mutations and forms, it is a Server Action.
- Put `'use server'` at the top of a file (every export becomes an action) or at the top of a function inside a Server Component.
- Call actions with `<form action={...}>`, `<button formAction={...}>`, or from a Client Component event handler inside `startTransition`.
- Use `.bind(null, value)` to pass extra arguments such as a book id.
- After a change, call `updateTag`, `revalidateTag(tag, 'max')`, `revalidatePath` or `refresh`, and only then `redirect`.
- Every action is a public POST endpoint: check the user, validate input, and return only what the UI needs.

<code id="code-content" class="language-javascript">
// app/actions.js: Book Nook's cart actions ('use server' makes every export an action)
'use server';
import { cookies } from 'next/headers';
import { getBook } from '@/lib/books';
// --- Small helper (not exported, so it is not a public endpoint)
async function readCart() {
  const cookieStore = await cookies();
  const ids = cookieStore.get('cart')?.value.split(',').filter(Boolean) ?? [];
  return { cookieStore, ids };
}
// --- Add a book: validate the id, update the cookie, return only a number
export async function addToCart(bookId) {
  const book = await getBook(String(bookId)); // never trust browser input
  if (!book) {
    throw new Error('Unknown book');
  }
  const { cookieStore, ids } = await readCart();
  ids.push(book.id);
  cookieStore.set('cart', ids.join(',')); // setting a cookie re-renders the page
  return ids.length;
}
// --- Remove one copy of a book
export async function removeFromCart(bookId) {
  const { cookieStore, ids } = await readCart();
  const index = ids.indexOf(String(bookId));
  if (index !== -1) {
    ids.splice(index, 1);
  }
  cookieStore.set('cart', ids.join(','));
}
// --- Usage in a Server Component (works even before JavaScript loads):
// &lt;form action={addToCart.bind(null, book.id)}&gt;
//   &lt;button type="submit"&gt;Add to cart&lt;/button&gt;
// &lt;/form&gt;
// --- Usage in a Client Component:
// startTransition(async () =&gt; setCount(await addToCart(bookId)));
</code></pre>

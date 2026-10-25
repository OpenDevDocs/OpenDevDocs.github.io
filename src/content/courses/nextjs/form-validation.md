---
publishDate: 2026-10-25T13:36
title: Validating Forms and Showing Errors
slug: form-validation
metadescription: Validate Next.js form data on the server with Zod 4, return field errors through useActionState, keep what the user typed, and add HTML checks first.
updateDate: 2026-10-25T13:36
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'forms', 'validation', 'zod']
course: nextjs
---

## What you will build

In [Building Forms with Server Actions](/courses/nextjs/forms-with-server-actions) you sent a form to a Server Action and showed a message with `useActionState`. That form trusted whatever the user typed. Real forms cannot do that.

In this lesson you will build an **Add a book** form for Book Nook at `/books/new` that:

- checks every field on the server with a schema library called **Zod**,
- shows a clear error message under each wrong field,
- keeps what the user typed, so they only fix the wrong part,
- uses plain HTML checks (`required`, `min`, `type="number"`) as a quick first layer in the browser.

Think of a busy post office. The sign on the door says "parcels must be taped shut" (that is HTML validation: friendly, but anyone can ignore it). The clerk behind the counter still checks every parcel before it goes into the van (that is server validation: the check that really counts).

Here are the files you will touch:

```text
book-nook/
├── app/
│   ├── actions.js             gets a createBook Server Action
│   └── books/
│       └── new/
│           └── page.js        the page at /books/new
├── components/
│   └── AddBookForm.js         the form (a Client Component)
└── lib/
    ├── book-schema.js         the Zod schema: what a valid book looks like
    └── books.js               gets a new addBook() helper
```

## Why the server must check, every time

A Server Action is a function on your server, but the browser calls it with a normal HTTP `POST` request. Anyone can send that request with any data: a broken browser extension, an old cached page, or a person with a terminal and bad intentions. They can skip your page completely.

So the rule is simple:

- **Browser checks** are for comfort. They give fast feedback without a round trip.
- **Server checks** are for safety. They are the only checks you can trust.

You always need the server checks. The browser checks are a nice extra.

## Step 1: install Zod

**Zod** is a library that lets you describe what valid data looks like, then checks real data against that description. The description is called a **schema**. Next.js's own docs use Zod in their form examples, and other libraries like Valibot work the same way.

```bash
npm install zod
```

At the time of writing the current version is Zod 4 (`4.6.x`). Zod 4 changed a few APIs compared to Zod 3, and this lesson uses the Zod 4 style. If you copy older tutorials you will see `error.flatten()` and `message:` options; those are the old style.

## Step 2: describe a valid book

Create a schema for the fields of a new book:

```javascript
// lib/book-schema.js
import * as z from 'zod';

export const bookSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: 'Please enter a title.' })
    .max(100, { error: 'Keep the title under 100 characters.' }),
  author: z
    .string()
    .trim()
    .min(2, { error: 'The author name needs at least 2 letters.' }),
  price: z.coerce
    .number({ error: 'Price must be a number.' })
    .positive({ error: 'Price must be more than 0.' })
    .max(500, { error: 'Price must be 500 or less.' }),
  genre: z.enum(['fantasy', 'classic', 'science-fiction'], {
    error: 'Pick a genre from the list.',
  }),
  description: z
    .string()
    .trim()
    .max(500, { error: 'Keep the description under 500 characters.' }),
});
```

Read it like a checklist:

- `z.object({...})` says "an object with these fields".
- `z.string().trim().min(1)` says "a string, with spaces cut off both ends, at least 1 character long". The `trim()` matters: without it, a title of three spaces would pass.
- `{ error: '...' }` is the message the user will see when that rule fails.
- `z.coerce.number()` first turns the value into a number. Form fields always arrive as **strings**, even from `<input type="number">`, so `"14.50"` must become `14.5` before Zod can check it.
- `z.enum([...])` only accepts one of the listed words.

The schema lives in `lib/` on purpose. You will reuse it for the API in [Building APIs with Route Handlers](/courses/nextjs/route-handlers).

## Step 3: a helper to save the book

Add an `addBook()` function to the bottom of your data layer, next to `getBooks()` and friends from [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database). It makes an id from the title (`"The Hobbit"` becomes `"the-hobbit"`), returns `null` if that book already exists, and otherwise inserts a row into the `books` table:

```javascript
// lib/books.js
export async function addBook({ title, author, price, genre, description }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const existing = await db.query('SELECT id FROM books WHERE id = $1', [id]);
  if (existing.length > 0) {
    return null;
  }

  const rows = await db.query(
    `INSERT INTO books (id, title, author, price, genre, cover, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, title, author, price, genre, '/covers/placeholder.jpg', description]
  );
  return rows[0];
}
```

The `$1` to `$7` placeholders keep user input out of the SQL text, exactly as in the database lesson. `RETURNING *` gives back the new row, so the action knows the new id.

## Step 4: validate inside the Server Action

Now the Server Action. Add it to `app/actions.js`, next to `createReview` from [Building Forms with Server Actions](/courses/nextjs/forms-with-server-actions); the file already starts with `'use server'`, so only the imports are new. Because the form will use `useActionState`, the action receives the **previous state** first and the `FormData` second.

```javascript
// app/actions.js (new imports and the createBook action)
import * as z from 'zod';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { bookSchema } from '@/lib/book-schema';
import { addBook } from '@/lib/books';

export async function createBook(prevState, formData) {
  // 1. Pick out exactly the fields we expect
  const values = {
    title: formData.get('title'),
    author: formData.get('author'),
    price: formData.get('price'),
    genre: formData.get('genre'),
    description: formData.get('description'),
  };

  // 2. Check them against the schema
  const result = bookSchema.safeParse(values);

  // 3. Something is wrong: send the errors (and the typed values) back
  if (!result.success) {
    return {
      errors: z.flattenError(result.error).fieldErrors,
      values,
    };
  }

  // 4. Everything is fine: save, refresh the cached book lists, then go to the new book
  const book = await addBook(result.data);
  if (!book) {
    return { message: 'A book with this title is already in the shop.', values };
  }
  updateTag('books');
  redirect(`/books/${book.id}`);
}
```

(If `updateTag` or `redirect` are already imported at the top of your `app/actions.js`, do not import them twice.)

A few important details:

- `safeParse` never throws. It returns `{ success: true, data }` or `{ success: false, error }`. Its sibling `parse` throws an error instead, which would show the error page rather than a friendly message.
- `result.data` is the **cleaned** data: trimmed strings and a real number for `price`. Always save `result.data`, never the raw `values`.
- `z.flattenError(result.error).fieldErrors` turns Zod's detailed error into a simple object with one array of messages per field.
- We read each field by name instead of using `Object.fromEntries(formData)`. That way an attacker cannot sneak in extra fields like `isFeatured: true`.
- `updateTag('books')` clears every cached result tagged `books` (see [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)), so `/books` lists the new book straight away. It comes **before** `redirect`, because nothing after `redirect` runs.

When the title is blank and the price is `abc`, the action returns something like this:

```json
{
  "errors": {
    "title": ["Please enter a title."],
    "price": ["Price must be a number."]
  },
  "values": {
    "title": "",
    "author": "Ursula K. Le Guin",
    "price": "abc",
    "genre": "fantasy",
    "description": ""
  }
}
```

Two kinds of errors are useful:

- **Field errors** (`errors.title`) belong next to one input.
- **Form errors** (`message`) are about the whole form, like "this book already exists".

## Step 5: show the errors with useActionState

The form needs to read the returned state, so it must be a Client Component:

```jsx
// components/AddBookForm.js
'use client';

import { useActionState } from 'react';
import { createBook } from '@/app/actions';

const initialState = { errors: {}, values: {} };

export default function AddBookForm() {
  const [state, formAction, isPending] = useActionState(createBook, initialState);
  const errors = state.errors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      {state.message && (
        <p role="alert" className="text-red-600">{state.message}</p>
      )}

      <div>
        <label htmlFor="title" className="block font-medium">Title</label>
        <input
          id="title"
          name="title"
          defaultValue={values.title}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby="title-error"
          className="w-full rounded border px-2 py-1"
        />
        {errors.title && (
          <p id="title-error" className="text-sm text-red-600">{errors.title[0]}</p>
        )}
      </div>

      {/* author, price, genre and description follow the same pattern */}

      <button type="submit" disabled={isPending} className="rounded bg-black px-4 py-2 text-white">
        {isPending ? 'Saving...' : 'Add book'}
      </button>
    </form>
  );
}
```

How it flows:

1. The user presses **Add book**. React calls `createBook(state, formData)` on the server.
2. The action returns `{ errors, values }`.
3. That object becomes the new `state`, and the component re-renders with the messages.

`errors.title[0]` shows the first message for that field. A field can fail several rules at once (a password, for example), so the value is an array. `aria-invalid` and `aria-describedby` tell screen readers that the field is wrong and which text explains why. `role="alert"` makes them read the form error out loud.

`isPending` is `true` while the action runs. Here it stops double submits. The next lesson, [Pending States and Optimistic Updates](/courses/nextjs/pending-and-optimistic-ui), looks at pending UI in depth.

Finally, the page itself stays a Server Component:

```jsx
// app/books/new/page.js
import AddBookForm from '@/components/AddBookForm';

export default function NewBookPage() {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Add a book</h1>
      <AddBookForm />
    </main>
  );
}
```

## Step 6: keep what the user typed

Try the form without the `defaultValue` props. Fill in four fields correctly, get one wrong, and press the button. Every field is suddenly empty. Annoying!

That is a React 19 feature: when a form's `action` is a function, React **resets** the form after the action finishes, just like a classic HTML form does after it submits. It is great after a successful save, and bad after an error.

The fix is the `values` object you already return. Each input uses it as its `defaultValue`:

```jsx
// components/AddBookForm.js
<input id="author" name="author" defaultValue={values.author} />

<input id="price" name="price" type="number" step="0.01" defaultValue={values.price} />

<select key={values.genre ?? ''} id="genre" name="genre" defaultValue={values.genre ?? ''}>
  <option value="" disabled>Choose a genre</option>
  <option value="fantasy">Fantasy</option>
  <option value="classic">Classic</option>
  <option value="science-fiction">Science fiction</option>
</select>

<textarea id="description" name="description" defaultValue={values.description} rows={3} />
```

After the action, React resets the form to the **new** default values, which are exactly what the user typed. Never send a password back this way. Let the user type it again.

The `<select>` needs one extra trick: a `key`. In our tests with React 19.3, a `<select>` whose `defaultValue` changed after the first render still jumped back to "Choose a genre" when the form reset. Giving it `key={values.genre ?? ''}` makes React build a fresh `<select>` whenever the returned genre changes, and a fresh one remembers its default properly. Inputs and textareas do not need this.

Why `defaultValue` and not `value`? `value` makes a **controlled input**: React owns the text, and you need `useState` and an `onChange` for every field. `defaultValue` makes an **uncontrolled input**: the browser owns the text, and React only sets the starting value. Uncontrolled inputs are simpler and still work before JavaScript has loaded.

## Step 7: HTML validation as the first layer

The browser can catch the obvious mistakes instantly, with no trip to the server. Add HTML attributes that match your schema:

```jsx
// components/AddBookForm.js
<input id="title" name="title" required maxLength={100} defaultValue={values.title} />

<input id="author" name="author" required minLength={2} defaultValue={values.author} />

<input
  id="price"
  name="price"
  type="number"
  step="0.01"
  min="0.01"
  max="500"
  required
  defaultValue={values.price}
/>

<select key={values.genre ?? ''} id="genre" name="genre" required defaultValue={values.genre ?? ''}>
  {/* options */}
</select>
```

Now an empty title never reaches the server: the browser shows its own bubble, something like:

```text
Please fill out this field.
```

The exact words depend on the browser and its language. You can read more about these attributes on [MDN's client-side form validation page](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation).

HTML checks cannot do everything. They cannot tell that a title with only spaces is empty, and they cannot know a book already exists. That is the server's job.

### Testing the server checks

Because the browser now blocks bad input, how do you see your Zod messages? Add `noValidate` to the form for a moment:

```jsx
// components/AddBookForm.js
<form action={formAction} noValidate>
```

`noValidate` turns off the browser checks, so every submit goes to the server. Submit an empty form and you should see all your Zod messages:

```text
Please enter a title.
The author name needs at least 2 letters.
Price must be more than 0.
Pick a genre from the list.
```

Remove `noValidate` when you are done. This is also a good reminder of why server checks matter: turning off browser checks takes one attribute.

## Common mistakes

### Forgetting the prevState parameter

```text
TypeError: formData.get is not a function
```

With `useActionState`, the action is called as `createBook(prevState, formData)`. If you write `createBook(formData)`, your `formData` variable actually holds the previous state, which has no `get` method. Add `prevState` as the first parameter.

### Using the Zod 3 style with Zod 4

Old tutorials use `result.error.flatten().fieldErrors` and `{ message: '...' }`. In Zod 4 those still work but are deprecated. Use `z.flattenError(result.error).fieldErrors` and `{ error: '...' }` instead, and import Zod with `import * as z from 'zod'`.

### Price passes as a string, or fails as one

```text
Invalid input: expected number, received string
```

Form values are always strings. Use `z.coerce.number()` so Zod converts `"9.99"` to `9.99` before checking it. Watch out: an empty string becomes `0`, which is why the schema also says `.positive()`.

### The form clears after an error

You did not return the typed values, or you used `value` instead of `defaultValue`. Return `values` from the action and set `defaultValue={values.field}` on each input (never on a password). If only the `<select>` forgets its choice, add `key={values.genre ?? ''}` to it.

### Saving raw form data

If you call `addBook(values)` instead of `addBook(result.data)`, you save untrimmed strings and a price that is still text. Always save the data Zod gives back.

## Quick recap

- Browser checks are for comfort; server checks are for safety. Always validate in the Server Action.
- Describe valid data once with a Zod schema in `lib/`, and check it with `schema.safeParse(values)`.
- Use Zod 4 style: `{ error: '...' }` messages and `z.flattenError(error).fieldErrors`.
- Return `{ errors, values }` from the action; `useActionState` gives it back to the form as `state`.
- Show `errors.field[0]` under each input, with `aria-invalid` and `aria-describedby` for screen readers.
- React resets forms after an action, so set `defaultValue` from the returned `values` to keep what the user typed.
- Add `required`, `min`, `maxLength` and friends as a quick first layer, and use `noValidate` to test the server path.

<code id="code-content" class="language-javascript">
// app/actions.js: the createBook action, which validates a new book and returns errors to the form
'use server';
import * as z from 'zod';
import { updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { addBook } from '@/lib/books';
// --- The schema (normally in lib/book-schema.js so the API can reuse it)
const bookSchema = z.object({
  title: z.string().trim().min(1, { error: 'Please enter a title.' }).max(100, { error: 'Keep the title under 100 characters.' }),
  author: z.string().trim().min(2, { error: 'The author name needs at least 2 letters.' }),
  price: z.coerce.number({ error: 'Price must be a number.' }).positive({ error: 'Price must be more than 0.' }).max(500, { error: 'Price must be 500 or less.' }),
  genre: z.enum(['fantasy', 'classic', 'science-fiction'], { error: 'Pick a genre from the list.' }),
  description: z.string().trim().max(500, { error: 'Keep the description under 500 characters.' }),
});
// --- useActionState calls this with (previous state, form data)
export async function createBook(prevState, formData) {
  // Read only the fields we expect (form values are always strings)
  const values = {
    title: formData.get('title'),
    author: formData.get('author'),
    price: formData.get('price'),
    genre: formData.get('genre'),
    description: formData.get('description'),
  };
  // safeParse never throws: it tells us success or failure
  const result = bookSchema.safeParse(values);
  if (!result.success) {
    // One array of messages per field, plus the typed values for defaultValue
    return { errors: z.flattenError(result.error).fieldErrors, values };
  }
  // Save the cleaned data (trimmed strings, real number), never the raw values
  const book = await addBook(result.data);
  if (!book) {
    return { message: 'A book with this title is already in the shop.', values };
  }
  updateTag('books'); // refresh cached book lists before leaving
  redirect(`/books/${book.id}`);
}
// --- components/AddBookForm.js (Client Component) uses it like this:
// const [state, formAction, isPending] = useActionState(createBook, { errors: {}, values: {} });
// &lt;input name="title" required defaultValue={state.values?.title} /&gt;
// {state.errors?.title &amp;&amp; &lt;p&gt;{state.errors.title[0]}&lt;/p&gt;}
</code></pre>

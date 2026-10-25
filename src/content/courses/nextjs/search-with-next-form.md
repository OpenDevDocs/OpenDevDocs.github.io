---
publishDate: 2026-10-25T13:38
title: Search Forms with the Form Component
slug: search-with-next-form
metadescription: Build a book search for /books with the next/form Form component, which puts the query in the URL and navigates on the client with prefetching.
updateDate: 2026-10-25T13:38
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'forms', 'search', 'next-form']
course: nextjs
---

## What you will build

Book Nook needs a search box. Type "dune", press **Search**, and the `/books` page shows only matching books. The address bar changes to `/books?q=dune`, so people can bookmark the results, share the link, or press the back button to return to the full list.

You will build it with `<Form>` from `next/form`, a small component made exactly for this job.

```text
book-nook/
├── app/
│   └── books/
│       └── page.js          reads ?q= and shows the results
└── components/
    ├── SearchForm.js        the <Form> with the search box
    └── SearchButton.js      a button that says "Searching..."
```

You already know how to read `?q=dune` from [Reading Search Params from the URL](/courses/nextjs/search-params). This lesson is about the other half: the form that **writes** it.

## A search form is a GET form

So far your forms sent data to a Server Action, which changes something on the server. A search does not change anything. It only asks a question, and the question belongs in the URL.

Plain HTML has done this forever. A form with `method="get"` turns its fields into **search params** (the part after `?`):

```html
<!-- plain HTML -->
<form action="/books" method="get">
  <input name="q" />
  <button type="submit">Search</button>
</form>
```

Typing `dune` and pressing the button loads `/books?q=dune`. The input's `name` (`q`) becomes the key.

This works, but it is a **full page reload**: the browser throws away the page, downloads everything again, and loses any state on the page (like an open menu or a playing audio sample). In a Next.js app you usually want a smooth client-side navigation instead, just like `<Link>`.

## The Form component

`<Form>` from `next/form` is a normal `<form>` with Next.js powers. When its `action` is a **string** (a path), it:

- puts the field values into the URL as search params, like a GET form,
- navigates on the **client**, like `<Link>`, so shared layouts stay put and state is kept,
- **prefetches** the target route's shared UI (its layouts and `loading.js`) as soon as the form scrolls into view, so the navigation starts fast,
- still works before JavaScript loads, because underneath it is a real form. This is called **progressive enhancement**.

Here is the same search box with `<Form>`:

```jsx
// components/SearchForm.js
import Form from 'next/form';
import SearchButton from '@/components/SearchButton';

export default function SearchForm({ defaultQuery = '' }) {
  return (
    <Form action="/books" className="mb-6 flex gap-2">
      <label htmlFor="q" className="sr-only">Search books</label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultQuery}
        placeholder="Title or author"
        className="rounded border px-2 py-1"
      />
      <SearchButton />
    </Form>
  );
}
```

Notice what is **not** there: no `"use client"`, no `useState`, no `onSubmit`, no `router.push`. `SearchForm` is a Server Component. Next.js does the client-side work inside `<Form>`.

`className="sr-only"` is a Tailwind class that hides the label visually but keeps it for screen readers. Every input needs a label, even a search box with a placeholder.

## Show that the search is running

The search button can show "Searching..." while the new page loads. You met `useFormStatus` in [Pending States and Optimistic Updates](/courses/nextjs/pending-and-optimistic-ui), and it works with `<Form>` too:

```jsx
// components/SearchButton.js
'use client';

import { useFormStatus } from 'react-dom';

export default function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="rounded bg-black px-4 py-2 text-white">
      {pending ? 'Searching...' : 'Search'}
    </button>
  );
}
```

It must be a separate Client Component placed inside the form, because `useFormStatus` reads the status of its **parent** form.

## The results page

Now `/books` reads `q` and picks the books. In Book Nook the data layer already has `searchBooks(query)`:

```javascript
// lib/books.js
export async function searchBooks(query) {
  const q = query.toLowerCase();
  return books.filter((book) => book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q));
}
```

The page:

```jsx
// app/books/page.js
import { Suspense } from 'react';
import Link from 'next/link';
import { getBooks, searchBooks } from '@/lib/books';
import SearchForm from '@/components/SearchForm';

async function BookResults({ searchParams }) {
  const { q } = await searchParams;
  const query = typeof q === 'string' ? q.trim() : '';
  const books = query ? await searchBooks(query) : await getBooks();

  if (books.length === 0) {
    return <p>No books match "{query}".</p>;
  }

  return (
    <>
      {query && <p className="mb-2">{books.length} result(s) for "{query}"</p>}
      <ul className="space-y-1">
        {books.map((book) => (
          <li key={book.id}>
            <Link href={`/books/${book.id}`} className="underline">{book.title}</Link> by {book.author}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function BooksPage({ searchParams }) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Books</h1>
      <SearchForm />
      <Suspense fallback={<p>Loading books...</p>}>
        <BookResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

Why it is built this way:

- `searchParams` is a **Promise** in Next.js 16, so you `await` it.
- `typeof q === 'string'` protects you from odd URLs. `/books?q=a&q=b` gives an **array**, and `/books` gives `undefined`. Anything in the URL is user input, so never assume its shape.
- Reading `searchParams` depends on the request, so with Cache Components it must sit inside `<Suspense>`. The heading and the search box are outside the boundary, so they are part of the instant **static shell**, and only the results stream in. You learned this pattern in [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering).

Try it:

1. Run `npm run dev` and open `http://localhost:3000/books`.
2. Type `dune` and press **Search**.

```text
Books
[ dune            ] [Search]
1 result(s) for "dune"
Dune by Frank Herbert
```

The URL is now `/books?q=dune`. Press the browser's back button and you are back on the full list.

## Keep the query in the box

After a search, the box should still show what you searched for, especially when someone opens a shared link like `/books?q=dune`. The input's starting text comes from `defaultValue`, so let the page pass the current query in as `defaultQuery`.

The form sits outside the Suspense boundary, so it cannot `await` the search params itself without making the whole page wait. One neat solution is to put a second, tiny component inside its own boundary:

```jsx
// app/books/page.js
async function SearchFormWithQuery({ searchParams }) {
  const { q } = await searchParams;
  return <SearchForm defaultQuery={typeof q === 'string' ? q : ''} />;
}

export default function BooksPage({ searchParams }) {
  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Books</h1>
      <Suspense fallback={<SearchForm />}>
        <SearchFormWithQuery searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p>Loading books...</p>}>
        <BookResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

The fallback is an empty `SearchForm`, so the box is visible instantly and gets filled in a moment later.

If you only ever search from the same page, you can also write `action=""`: an empty string tells `<Form>` to stay on the current route and just update the search params.

## A search box on every page

A shop usually has its search box in the header. Since `action="/books"` is an absolute path, the same `SearchForm` works from any page. Your `Header` from [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating) is a Client Component (it uses `usePathname`). That is fine: `SearchForm` uses nothing server-only, so a Client Component can import it. Add it at the end of the nav:

```jsx
// components/Header.js (only the changed parts)
import SearchForm from '@/components/SearchForm';

// ...inside <nav>, after the links:
<div className="ml-auto">
  <SearchForm />
</div>
```

Searching from `/about` navigates to `/books?q=...` without a full reload, and the header stays on screen during the trip.

## Useful props

When `action` is a string, `<Form>` accepts three extra props:

| Prop | Default | What it does |
| --- | --- | --- |
| `replace` | `false` | `true` replaces the current history entry instead of adding one, so the back button skips old searches |
| `scroll` | `true` | `false` keeps the scroll position instead of jumping to the top |
| `prefetch` | `true` | `false` turns off prefetching of the target route |

For a "live" filter that updates as you type, `replace` is handy so the back button does not walk through every letter:

```jsx
// components/SearchForm.js
<Form action="/books" replace scroll={false}>
```

## String action or function action?

`<Form>` can also take a **function** (a Server Action) as `action`, like the forms in [Building Forms with Server Actions](/courses/nextjs/forms-with-server-actions). Then it behaves like a normal React form: it runs the action and does not put anything in the URL, and `replace`, `scroll` and `prefetch` are ignored.

A simple rule of thumb:

- **Reading** (search, filter, sort, paginate): string action. The answer belongs in the URL.
- **Writing** (add, edit, delete, log in): function action. The change happens on the server.

## Things Form does not support

`<Form>` sets the method for you, so do not pass `method`, `encType` or `target`. If you need them, use a plain `<form>`.

Also, an `<input type="file">` in a string-action `<Form>` sends only the file name, just like a plain GET form in the browser. Uploading files needs a Server Action.

## Common mistakes

### The URL changes but nothing happens

The input has no `name`. Without `name="q"`, the browser has no key to put in the URL, and you get `/books?` with nothing in it. Every field you want in the URL needs a `name`.

### The page shows "No books match "undefined""

You used `q` without checking it. On `/books` there is no `q`, so it is `undefined`. Check `typeof q === 'string'` first and fall back to an empty string.

### A build error about uncached data

```text
Error: Route "/books": Next.js encountered uncached or runtime data during prerendering.
`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.
```

With Cache Components, reading `searchParams` must happen inside a `<Suspense>` boundary (or under a `loading.js`). Move the `await searchParams` into a child component and wrap it, as in `BookResults` above.

### Adding "use client" and useRouter for a simple search

You do not need `useState`, `onSubmit` and `router.push()` for a search box. `<Form action="/books">` does the navigation, the prefetching and the no-JavaScript fallback for you.

## Quick recap

- Searches are questions, so their input belongs in the URL as search params, like `/books?q=dune`.
- `<Form>` from `next/form` with a string `action` builds that URL from the fields' `name`s and navigates on the client.
- It prefetches the target route's shared UI when visible, and still works without JavaScript.
- Read the query with `await searchParams` inside `<Suspense>`, and treat it as untrusted input.
- `useFormStatus` in a child button shows "Searching..." during the navigation.
- `replace`, `scroll` and `prefetch` tune history, scrolling and prefetching.
- Use a string action for reading, and a Server Action for writing.

<code id="code-content" class="language-jsx">
// app/books/page.js: a /books page with a next/form search box (?q=...)
import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { getBooks, searchBooks } from '@/lib/books';
import SearchButton from '@/components/SearchButton'; // 'use client' + useFormStatus
// The results read ?q= from the URL, so they live inside Suspense
async function BookResults({ searchParams }) {
  const { q } = await searchParams;
  // URL values are user input: could be missing, a string, or an array
  const query = typeof q === 'string' ? q.trim() : '';
  const books = query ? await searchBooks(query) : await getBooks();
  if (books.length === 0) {
    return &lt;p&gt;No books match "{query}".&lt;/p&gt;;
  }
  return (
    &lt;ul&gt;
      {books.map((book) =&gt; (
        &lt;li key={book.id}&gt;
          &lt;Link href={`/books/${book.id}`}&gt;{book.title}&lt;/Link&gt; by {book.author}
        &lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
export default function BooksPage({ searchParams }) {
  return (
    &lt;main&gt;
      &lt;h1&gt;Books&lt;/h1&gt;
      {/* String action: builds /books?q=... and navigates on the client */}
      &lt;Form action="/books"&gt;
        &lt;label htmlFor="q"&gt;Search books&lt;/label&gt;
        &lt;input id="q" name="q" type="search" placeholder="Title or author" /&gt;
        &lt;SearchButton /&gt;
      &lt;/Form&gt;
      &lt;Suspense fallback={&lt;p&gt;Loading books...&lt;/p&gt;}&gt;
        &lt;BookResults searchParams={searchParams} /&gt;
      &lt;/Suspense&gt;
    &lt;/main&gt;
  );
}
</code></pre>

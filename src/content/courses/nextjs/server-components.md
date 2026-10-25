---
publishDate: 2026-10-25T13:13
title: Server Components Explained
slug: server-components
metadescription: Understand React Server Components in Next.js 16. They are the default, run only on the server, can await data directly and send no component JavaScript.
updateDate: 2026-10-25T13:13
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'server-components', 'react', 'rendering']
course: nextjs
---

## What you will learn

Every component you have written for Book Nook so far has been a **Server Component**, even though you never asked for one. In this lesson you will find out what that means:

- Where a Server Component runs, and what reaches the browser.
- The three superpowers of Server Components: loading data directly, keeping secrets, and sending less JavaScript.
- What a Server Component cannot do, and the errors you see if you try.
- How to tell when you need something else.

## The restaurant picture

Think of a restaurant. The **kitchen** is the server: it has the fridge, the recipes and the sharp knives. The **table** is the visitor's browser.

A Server Component is a dish cooked completely in the kitchen. The guest receives the finished plate. They never see the recipe, the fridge or the knives. All they get is the result.

In code terms: a Server Component runs **only on the server**. Its code, the data it reads and any secrets it uses stay there. The browser receives only what the component produced.

## Every component is a Server Component by default

In the `app` folder, every page, layout and component is a Server Component unless you say otherwise. You do not add anything special. This is Book Nook's books page from [Reading Search Params from the URL](/courses/nextjs/search-params), simplified:

```jsx
// app/books/page.js
import { getBooks } from '@/lib/books';
import BookCard from '@/components/BookCard';

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <main>
      <h1>Books</h1>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </main>
  );
}
```

And a small component that shows one book:

```jsx
// components/BookCard.js
import Link from 'next/link';

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function BookCard({ book }) {
  return (
    <article>
      <h2>
        <Link href={`/books/${book.id}`}>{book.title}</Link>
      </h2>
      <p>{book.author}</p>
      <p>{price.format(book.price)}</p>
    </article>
  );
}
```

Both are Server Components. Neither file has anything special at the top. Server is the default; the other kind, Client Components, are the opt-in. You will meet them in [Client Components and the use client Directive](/courses/nextjs/client-components).

## Superpower 1: await data right inside the component

Look at `BooksPage` again. It is an `async` function, and it simply `await`s `getBooks()`. In a classic React app you could not do that. You would need `useState`, `useEffect`, a loading flag and an API to call from the browser:

```jsx
// The old way, in a browser-only React app (for comparison)
function BooksPage() {
  const [books, setBooks] = useState([]);
  useEffect(() => {
    fetch('/api/books')
      .then((res) => res.json())
      .then(setBooks);
  }, []);
  // ...
}
```

A Server Component is already on the server, right next to your data. It can read a database, a file or a private API directly, while it renders. No extra API route, no loading state juggling. That is why `lib/books.js` has `async` functions: when Book Nook moves to a real database in [Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database), the pages will not change at all.

Data fetching gets its own lesson: [Fetching Data in Server Components](/courses/nextjs/fetching-data).

## Superpower 2: secrets stay secret

Because the code never reaches the browser, a Server Component can safely use things that must stay private, like a database password or an API key from an environment variable:

```jsx
// app/books/page.js (an idea of what is coming later)
const res = await fetch('https://api.example.com/stock', {
  headers: { Authorization: `Bearer ${process.env.STOCK_API_KEY}` },
});
```

Visitors can open DevTools and read every line of JavaScript the browser downloads. This line is not among them. You will learn the details in [Environment Variables](/courses/nextjs/environment-variables) and [Keeping Secrets and Data Safe](/courses/nextjs/data-security).

## Superpower 3: less JavaScript for the browser

`BookCard` uses `Intl.NumberFormat` to format prices. If it used a big date or formatting library instead, that library would also stay on the server. The browser downloads **none** of the code of a Server Component. It only gets the result.

Less JavaScript means pages load faster, especially on slow phones and networks.

## Where does it run, and when?

Add a `console.log` to the page and see where the message shows up:

```jsx
// app/books/page.js
export default async function BooksPage() {
  console.log('Rendering the books page');
  const books = await getBooks();
  // ...
}
```

Run `npm run dev`, open `/books`, and look at the **terminal** where the dev server runs:

```text
Rendering the books page
 GET /books 200 in 312ms (next.js: 250ms, application-code: 62ms)
```

(Your timings will be different.)

The message is printed by the server. In development, React may also show a copy in the browser console, marked as coming from the server, to help you debug. But the code itself ran on the server.

Now run a production build:

```bash
npm run build
```

You will see the same message printed **during the build**. Pages that do not depend on the request are rendered once, at build time, and the result is saved and reused for every visitor. This is called **prerendering**. Pages that depend on the request (like reading the query string) render when the request arrives. You will learn the rules in [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering).

## What actually reaches the browser?

When a visitor opens a page, the server sends two things:

1. **HTML**, so the browser can show the page immediately.
2. The **RSC Payload** (React Server Component Payload), a compact description of the rendered component tree. React in the browser uses it to update the page smoothly when you navigate, without reloading.

You can peek at the HTML with **View Page Source** in your browser. You will see the book titles and prices as plain HTML, but no trace of `getBooks` or `BookCard`'s code.

## What a Server Component cannot do

The kitchen cannot react to what happens at the table. A Server Component runs once to produce its result, and then it is done. So it cannot:

- Hold **state** with `useState` or `useReducer`.
- Run **effects** with `useEffect`.
- Respond to **events** like `onClick` or `onChange`.
- Use **browser-only APIs** like `window`, `document` or `localStorage`.
- Read **React context** with `useContext`.

Next.js catches these mistakes early. Import `useState` in a Server Component and the build fails:

```text
Error: You're importing a module that depends on `useState` into a React Server Component module. This API is only available in Client Components. To fix, mark the file (or its parent) with the `"use client"` directive.
```

Put an `onClick` on a button in a Server Component, and rendering fails:

```text
Error: Event handlers cannot be passed to Client Component props.
  {onClick: function onClick, children: ...}
            ^^^^^^^^^^^^^^^^
If you need interactivity, consider converting part of this to a Client Component.
```

Both errors point to the same fix: interactive parts belong in Client Components.

## Server or Client: a quick guide

| You need to... | Use |
| --- | --- |
| Load data from a database or API | Server Component |
| Use a secret key or token | Server Component |
| Show content that does not change while the visitor looks at it | Server Component |
| React to clicks, typing or other events | Client Component |
| Keep values in state (`useState`), run `useEffect` | Client Component |
| Use `window`, `localStorage` or other browser APIs | Client Component |

Most of a typical page is content, so most components stay on the server. Only small interactive islands need to be Client Components. A Server Component can render a Client Component inside it, like a static page with one "Add to cart" button. How the two kinds fit together is the topic of [Mixing Server and Client Components](/courses/nextjs/server-client-boundary).

## Common mistakes

### Reaching for useEffect to load data

If you come from plain React, you might write `useEffect` plus `fetch` to load the books. In a Server Component you get an error, and you do not need it anyway. Make the component `async` and `await` the data directly.

### Expecting console.log in the browser

Your log shows up in the terminal (and, in development, maybe as a server-labelled copy in the browser). If you see nothing in the terminal, check that you are looking at the window running `npm run dev`.

### Using window or document

```text
ReferenceError: window is not defined
```

There is no browser window on the server. Code that needs `window` belongs in a Client Component, inside `useEffect` or an event handler.

### Adding an onClick to a Server Component

You get "Event handlers cannot be passed to Client Component props". Move the interactive element into its own Client Component file and use it from the Server Component.

## Quick recap

- In the `app` folder, every component is a Server Component unless you opt out.
- Server Components run only on the server, at build time or when a request arrives.
- They can be `async` and `await` data directly, with no `useEffect` or API route.
- Their code and secrets never reach the browser, so pages ship less JavaScript.
- The browser receives HTML plus the RSC Payload, not the component code.
- They cannot use state, effects, event handlers, browser APIs or context. Those need Client Components.

<code id="code-content" class="language-jsx">
// app/books/page.js: a Server Component (the default, nothing to add at the top)
import { getBooks } from '@/lib/books';
import BookCard from '@/components/BookCard';
// async is allowed: the component waits for its data on the server
export default async function BooksPage() {
  console.log('Rendering the books page'); // shows in the terminal, not the browser
  const books = await getBooks(); // no useEffect, no API route needed
  return (
    &lt;main&gt;
      &lt;h1&gt;Books&lt;/h1&gt;
      {books.map((book) =&gt; (
        &lt;BookCard key={book.id} book={book} /&gt;
      ))}
    &lt;/main&gt;
  );
}
// --- next file: components/BookCard.js (also a Server Component)
// import Link from 'next/link';
// const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// export default function BookCard({ book }) {
//   return (
//     &lt;article&gt;
//       &lt;h2&gt;&lt;Link href={`/books/${book.id}`}&gt;{book.title}&lt;/Link&gt;&lt;/h2&gt;
//       &lt;p&gt;{book.author}&lt;/p&gt;
//       &lt;p&gt;{price.format(book.price)}&lt;/p&gt;
//     &lt;/article&gt;
//   );
// }
// Not allowed here: useState, useEffect, onClick, window, useContext
</code></pre>

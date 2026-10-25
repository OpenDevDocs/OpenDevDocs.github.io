---
publishDate: 2026-10-25T13:15
title: Mixing Server and Client Components
slug: server-client-boundary
metadescription: Combine Server and Client Components in Next.js. Pass serializable props, nest server content with children, and guard modules with server-only.
updateDate: 2026-10-25T13:15
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'server-components', 'client-components', 'server-only']
course: nextjs
---

## What you will learn

You now know both kinds of component: [Server Components Explained](/courses/nextjs/server-components) and [Client Components and the use client Directive](/courses/nextjs/client-components). Real pages mix them. The line where server code hands over to client code is called the **boundary**, and a few simple rules decide what may cross it.

In this lesson you will learn:

- The two rules of the boundary: code crosses through imports, data crosses through props.
- Which values you can pass as props to a Client Component, and which you cannot.
- The **children pattern**, which lets a Client Component show server-rendered content.
- How the `server-only` and `client-only` packages stop code from ending up on the wrong side.

## The two rules

Picture the server and the browser as two countries with a border between them. Everything that crosses goes through customs.

1. **Code crosses through imports.** When a Client Component file imports another file, that file is packed up and shipped to the browser too.
2. **Data crosses through props.** When a Server Component renders a Client Component, the props are packed into a parcel (the RSC Payload) and sent along. Only things that can be packed safely are allowed.

Let us look at each rule with Book Nook.

## Rule 1: imports pull code to the client

Remember from the last lesson: `'use client'` marks the entry to the client side, and **every module that file imports** becomes client code as well.

That is why the direction of imports matters:

```text
Allowed: Server Component imports a Client Component
  app/books/[id]/page.js (server)
    └── imports components/AddToCartButton.js ('use client')

Surprising: Client Component imports a "server" component
  components/Tabs.js ('use client')
    └── imports components/BookDetails.js   becomes client code!
```

In the second case, `BookDetails.js` has no `'use client'` line, but it is now part of the browser bundle, because a client file imported it. If it awaited `getBook()` or read a secret, that would break (or leak). So a Client Component **cannot import** a Server Component and keep it on the server. The children pattern below shows the right way.

## Rule 2: props must be serializable

To send props across the border, React turns them into text and back again. This is called **serialization**. Think of packing a parcel: a book or a photo fits in a box, but you cannot post a living person, or a phone call.

Here is what can and cannot cross from a Server Component to a Client Component:

| Can be passed | Cannot be passed |
| --- | --- |
| Strings, numbers, booleans, `null`, `undefined`, bigints | Normal functions, including event handlers |
| Plain objects and arrays made of these | Class instances (objects made with `new MyClass()`) |
| `Date`, `Map`, `Set` | Symbols you created with `Symbol('x')` |
| Promises (the client can read them with `use()`) | |
| JSX, like `<p>Hello</p>` or another component's output | |
| Server Functions marked with `'use server'` | |

Book Nook's book page passes a plain object, which is fine:

```jsx
// app/books/[id]/page.js
<AddToCartButton book={book} />
```

### What happens if you pass a function

Say you write the sorting code in the page and hand it to a Client Component button:

```jsx
// app/books/page.js (this does not work)
import SortButton from '@/components/SortButton';

export default function BooksPage() {
  function sortByPrice() {
    console.log('sorting');
  }
  return <SortButton onSort={sortByPrice} />;
}
```

Rendering fails:

```text
Error: Event handlers cannot be passed to Client Component props.
  {onSort: function onSort}
           ^^^^^^^^^^^^^^^
If you need interactivity, consider converting part of this to a Client Component.
```

A function is code that lives on the server. It cannot be put in a parcel. The fix is to move the function **into** the Client Component, so it is written on the client side in the first place:

```jsx
// components/SortButton.js
'use client';

export default function SortButton() {
  function sortByPrice() {
    console.log('sorting');
  }
  return <button onClick={sortByPrice}>Sort by price</button>;
}
```

The one exception is a **Server Function**: a function marked with `'use server'` that the browser can call over the network. Those can be passed as props. They have their own lesson: [Server Functions and Server Actions](/courses/nextjs/server-actions).

### Props are public

Everything you pass to a Client Component ends up in the page sent to the browser. Anyone can find it with **View Page Source** or the Network tab, even if your component never displays it.

Imagine Book Nook's database later stores what the shop paid the supplier for each book. If you pass the whole database row, that price leaks:

```jsx
// Risky: every field of the row is sent to the browser
<AddToCartButton book={bookRowFromDatabase} />

// Better: pass only what the button needs
<AddToCartButton book={{ id: book.id, title: book.title, price: book.price }} />
```

For today's `lib/books.js` every field is public, so passing `book` is fine. Keep the habit for later; [Keeping Secrets and Data Safe](/courses/nextjs/data-security) goes deeper.

## The children pattern: server content inside a client box

Sometimes you want an interactive wrapper around content that should stay on the server. Book Nook's book page has a long "More in this genre" list. Let us put it in a section that the visitor can open and close.

The open and closed state needs `useState`, so the wrapper must be a Client Component. Give it a `children` prop:

```jsx
// components/ShowMore.js
'use client';

import { useState } from 'react';

export default function ShowMore({ label, children }) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'} {label}
      </button>
      {open && children}
    </section>
  );
}
```

Now write the content as a normal async Server Component:

```jsx
// components/MoreInGenre.js
import Link from 'next/link';
import { getBooks } from '@/lib/books';

export default async function MoreInGenre({ book }) {
  const books = await getBooks();
  const others = books.filter((b) => b.genre === book.genre && b.id !== book.id);

  if (others.length === 0) {
    return <p>No other books in this genre yet.</p>;
  }

  return (
    <ul>
      {others.map((b) => (
        <li key={b.id}>
          <Link href={`/books/${b.id}`}>{b.title}</Link>
        </li>
      ))}
    </ul>
  );
}
```

Finally, put them together **in the Server Component page**:

```jsx
// app/books/[id]/page.js
import ShowMore from '@/components/ShowMore';
import MoreInGenre from '@/components/MoreInGenre';

// ...inside the returned JSX, after the book details:
<ShowMore label="more in this genre">
  <MoreInGenre book={book} />
</ShowMore>
```

Why does this work when importing `MoreInGenre` into `ShowMore` would not? Because the **page** imports and renders `MoreInGenre`, not `ShowMore`. The server renders `MoreInGenre` to its finished output, and passes that output to `ShowMore` as `children`. JSX output is on the "can be passed" list. `ShowMore` never sees the code of `MoreInGenre`, only the result. It just decides whether to show it.

Think of `ShowMore` as a gift box with a lid. The server puts a finished present inside. The box can open and close, but it does not need to know how the present was made.

`children` is not special here. Any prop can carry JSX, so you can make several "slots":

```jsx
<ShowMore label="reviews" footer={<p>Reviews are moderated.</p>}>
  <Reviews bookId={book.id} />
</ShowMore>
```

> **Note:** `MoreInGenre` is rendered on the server even while the section is closed. Its output is sent with the page and simply not shown until the visitor clicks. That is great for small content. For something heavy, look at [Lazy Loading with next/dynamic](/courses/nextjs/lazy-loading).

## Guard your modules with server-only

`lib/books.js` will one day talk to a real database with a password. It must **never** be imported by a Client Component. Right now nothing stops a teammate from doing that by mistake.

Add one line at the top of the file:

```javascript
// lib/books.js
import 'server-only';

const books = [
  // ...the same books as before
];

export async function getBooks() {
  return books;
}
// ...getBook and searchBooks as before
```

Now try importing it into a Client Component:

```jsx
// components/BadExample.js
'use client';

import { getBooks } from '@/lib/books';
```

The build stops with a clear message and shows you the chain of imports that caused it:

```text
./lib/books.js:1:1
Error: 'server-only' cannot be imported from a Client Component module

It should only be used from a Server Component.
```

The opposite package, `client-only`, marks a file that must only run in the browser, for example a helper that uses `window`:

```javascript
// lib/analytics.js
import 'client-only';

export function trackClick(name) {
  window.dispatchEvent(new CustomEvent('book-nook-click', { detail: name }));
}
```

Importing it from a Server Component then fails at build time.

Next.js understands both imports on its own, so installing them is optional. If your editor or linter complains that the package is missing, install it:

```bash
npm install server-only
```

## Common mistakes

### Importing a Server Component into a Client Component

The imported component silently becomes client code. If it is `async` or uses server-only code, you get errors. Pass it as `children` (or another prop) from a Server Component instead.

### Passing a function as a prop

```text
Error: Event handlers cannot be passed to Client Component props.
```

Write the function inside the Client Component. If it must run on the server, make it a Server Function with `'use server'`.

### Passing class instances

An object made from a class, like `new Book('Dune')`, cannot cross:

```text
Error: Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported.
```

Pass a plain object like `{ id, title, price }` instead.

### Sending more data than needed

Every prop is visible in the browser. Pass only the fields the Client Component uses.

## Quick recap

- Code crosses the boundary through **imports**: anything a Client Component imports becomes client code.
- Data crosses through **props**, which must be serializable: plain values, plain objects and arrays, `Date`, `Map`, `Set`, Promises, JSX and Server Functions.
- Normal functions and class instances cannot be passed. Move event handlers into the Client Component.
- Props are public, so pass only what the component needs.
- Use the **children pattern** to put server-rendered content inside an interactive Client Component.
- `import 'server-only'` stops a module from reaching the browser; `import 'client-only'` does the opposite.

<code id="code-content" class="language-jsx">
// app/books/[id]/page.js: server and client components working together
import { notFound } from 'next/navigation';
import { getBook } from '@/lib/books'; // lib/books.js starts with: import 'server-only';
import AddToCartButton from '@/components/AddToCartButton'; // 'use client'
import ShowMore from '@/components/ShowMore'; // 'use client'
import MoreInGenre from '@/components/MoreInGenre'; // a Server Component
export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) {
    notFound();
  }
  return (
    &lt;main&gt;
      &lt;h1&gt;{book.title}&lt;/h1&gt;
      &lt;p&gt;by {book.author}&lt;/p&gt;
      {/* Data crosses as props: only serializable values, only what is needed */}
      &lt;AddToCartButton book={{ id: book.id, title: book.title, price: book.price }} /&gt;
      {/* Children pattern: the server renders MoreInGenre, ShowMore only shows or hides it */}
      &lt;ShowMore label="more in this genre"&gt;
        &lt;MoreInGenre book={book} /&gt;
      &lt;/ShowMore&gt;
    &lt;/main&gt;
  );
}
// --- next file: components/ShowMore.js
// 'use client';
// import { useState } from 'react';
// export default function ShowMore({ label, children }) {
//   const [open, setOpen] = useState(false);
//   return (
//     &lt;section&gt;
//       &lt;button onClick={() =&gt; setOpen(!open)}&gt;{open ? 'Hide' : 'Show'} {label}&lt;/button&gt;
//       {open &amp;&amp; children}
//     &lt;/section&gt;
//   );
// }
</code></pre>

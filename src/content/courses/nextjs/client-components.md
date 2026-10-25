---
publishDate: 2026-10-25T13:14
title: Client Components and the use client Directive
slug: client-components
metadescription: Add interactivity to Next.js with Client Components. Learn the use client directive, hydration, browser APIs and how to keep client code small.
updateDate: 2026-10-25T13:14
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'client-components', 'use-client', 'react']
course: nextjs
---

## What you will build

In [Server Components Explained](/courses/nextjs/server-components) you learned that every component in Book Nook runs on the server by default. That is great for showing books, but a shop also needs things that **react** to the visitor: buttons, counters, menus.

In this lesson you will add two interactive pieces to the book page:

- An **Add to cart** button that counts how many copies you added.
- A **Copy link** button that copies the page address to the clipboard.

You will learn:

- How the `'use client'` directive turns a file into a Client Component.
- How a Client Component renders on the server first and then comes alive in the browser (**hydration**).
- How to use browser-only APIs safely.
- Why you should keep `'use client'` files small.

## Step 1: write your first Client Component

Create a new file for the button:

```jsx
// components/AddToCartButton.js
'use client';

import { useState } from 'react';

export default function AddToCartButton({ book }) {
  const [quantity, setQuantity] = useState(0);

  return (
    <div>
      <button onClick={() => setQuantity(quantity + 1)}>Add to cart</button>
      {quantity > 0 && (
        <p>
          {quantity} x {book.title} added
        </p>
      )}
    </div>
  );
}
```

The first line, `'use client'`, is a **directive**: a special string that gives an instruction to the tools that build your app. It says "this file, and everything it imports, must also run in the browser". Because of it, the component may use `useState` and `onClick`.

Rules for the directive:

- It must be the **very first line** of the file, above every `import`. Comments above it are fine, code is not.
- It is a plain string in quotes, `'use client'` or `"use client"`, not a function call.
- It applies to the whole file. You cannot put it inside a single function.

## Step 2: use it from a Server Component

The book page stays a Server Component. It loads the book on the server and simply renders the button:

```jsx
// app/books/[id]/page.js
import { notFound } from 'next/navigation';
import { getBook } from '@/lib/books';
import AddToCartButton from '@/components/AddToCartButton';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    notFound();
  }

  return (
    <main>
      <h1>{book.title}</h1>
      <p>by {book.author}</p>
      <p>{book.description}</p>
      <AddToCartButton book={book} />
    </main>
  );
}
```

Open `/books/dune` and click the button a few times. The count goes up. The page did most of its work on the server, and only the button runs in the browser. This is the usual shape of a Next.js page: a Server Component with a few Client Components inside it, like islands.

The count only lives inside this one button for now. In [State, Context and Providers in Next.js](/courses/nextjs/state-context-and-providers) you will connect it to a real cart that the whole site can see.

## How a Client Component actually runs

Here is a surprise for many people: a Client Component **also runs on the server**. The name means "this one runs in the client too", not "only in the client".

When someone opens `/books/dune` directly:

1. **On the server**, Next.js renders the whole page to HTML, including the button. The visitor sees the button immediately, with `quantity` at its starting value `0`.
2. **The browser downloads** the JavaScript for `AddToCartButton` (and only for Client Components; Server Component code is never sent).
3. **React hydrates** the page. **Hydration** means React walks over the HTML that is already on screen and attaches the event handlers and state to it. Think of a shop window display: the dummy is already standing there (the HTML), and hydration is the moment the real shop assistant steps in and starts helping customers.

After hydration, clicks work. When you later navigate to another page with a `Link`, Client Components on the new page render directly in the browser.

You can watch this. Add a log to the component:

```jsx
// components/AddToCartButton.js
export default function AddToCartButton({ book }) {
  console.log('Rendering the add to cart button');
  // ...
}
```

Load the page directly and the message appears in **both places**: in the terminal (the server render) and in the browser console (the browser render). Compare that with the log in [Server Components Explained](/courses/nextjs/server-components), which only ran on the server.

## Step 3: use a browser API safely

Browser-only features like `window`, `document`, `localStorage` or `navigator.clipboard` do not exist on the server. Because a Client Component also renders on the server, using them while rendering breaks the build:

```jsx
// components/ScreenWidth.js (do not do this)
'use client';

export default function ScreenWidth() {
  const width = window.innerWidth; // runs on the server too
  return <p>Your screen is {width}px wide</p>;
}
```

```text
ReferenceError: window is not defined
```

The safe places for browser APIs are **event handlers** and **`useEffect`**, because both only ever run in the browser. Here is the Copy link button, which touches the clipboard only when you click:

```jsx
// components/CopyLinkButton.js
'use client';

import { useState } from 'react';

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    // Event handlers only run in the browser, so window and navigator are safe here
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <button onClick={handleClick}>
      {copied ? 'Link copied!' : 'Copy link'}
    </button>
  );
}
```

Add `<CopyLinkButton />` under the add to cart button in the book page, and try it.

## Step 4: keep 'use client' at the edges

`'use client'` marks a **boundary**. The file with the directive, and **every module it imports**, become part of the JavaScript sent to the browser. Files further down do not need the directive again.

So where you put the directive matters. Compare two ways to build the book page:

```text
Good: only the buttons are client code

BookPage (server)
├── <h1>, author, description (server)
├── AddToCartButton (client)
└── CopyLinkButton (client)


Wasteful: the whole page became client code

BookPage ('use client')
├── <h1>, author, description (now sent as JavaScript)
├── AddToCartButton
└── CopyLinkButton
```

In the second version, the page can no longer be `async`, so it cannot `await getBook()` on the server, and everything it renders is shipped to the browser. Push `'use client'` as far down the tree as you can: make the small interactive piece a Client Component, not the page around it.

> **Note:** A `page.js` file can be a Client Component. It then reads `params` and `searchParams` with React's `use()` function instead of `await`. You rarely need this. Keeping pages on the server and adding small Client Components is almost always better.

## When do you need 'use client'?

Add the directive when a component needs any of these:

- State: `useState`, `useReducer`.
- Effects: `useEffect`, `useLayoutEffect`.
- Event handlers: `onClick`, `onChange`, `onSubmit` with your own function.
- Browser APIs: `window`, `document`, `localStorage`, `navigator`.
- React context with `useContext` (see [State, Context and Providers in Next.js](/courses/nextjs/state-context-and-providers)).
- Hooks from `next/navigation` such as `useRouter`, `usePathname` and `useSearchParams`.
- Custom hooks or third-party components that use any of the above.

If a component only shows data, leave it as a Server Component.

## Common mistakes

### Forgetting the directive

```text
Error: You're importing a module that depends on `useState` into a React Server Component module. This API is only available in Client Components. To fix, mark the file (or its parent) with the `"use client"` directive.
```

Add `'use client';` as the first line of the file that uses the hook.

### Putting the directive below the imports

```jsx
import { useState } from 'react';
'use client'; // too late
```

```text
Error: The "use client" directive must be placed before other expressions. Move it to the top of the file to resolve this issue.
```

A directive only counts at the very top of the file. Move it to line 1.

### Using window while rendering

`ReferenceError: window is not defined` means you used a browser API during render, which also happens on the server. Move that code into an event handler or a `useEffect`.

### Rendering different things on the server and in the browser

If a Client Component shows `new Date().toLocaleTimeString()` or `Math.random()` while rendering, the server HTML and the browser render will not match, and React reports:

```text
Hydration failed because the server rendered text didn't match the client. As a result this tree will be regenerated on the client.
```

Render the same thing in both places. Compute values that differ (the current time, random numbers, anything from `localStorage`) inside `useEffect` or an event handler.

### Marking everything as a Client Component

It works, but you lose the benefits of Server Components: direct data loading, secrets and smaller downloads. Only the interactive leaves need `'use client'`.

## Quick recap

- `'use client'` at the very top of a file makes it a Client Component, and makes everything it imports client code too.
- Client Components can use state, effects, event handlers and browser APIs.
- They render on the server to HTML first, then hydrate in the browser, where they become interactive.
- Use browser APIs only in event handlers and `useEffect`, never while rendering.
- Keep Client Components small and use them inside Server Components, so most of the page stays on the server.

<code id="code-content" class="language-jsx">
// components/AddToCartButton.js: a Client Component used inside the server-rendered book page
'use client'; // must be the first line: this file also runs in the browser
import { useState } from 'react';
export default function AddToCartButton({ book }) {
  // State only works in Client Components
  const [quantity, setQuantity] = useState(0);
  return (
    &lt;div&gt;
      {/* onClick only works in Client Components */}
      &lt;button onClick={() =&gt; setQuantity(quantity + 1)}&gt;Add to cart&lt;/button&gt;
      {quantity &gt; 0 &amp;&amp; (
        &lt;p&gt;
          {quantity} x {book.title} added
        &lt;/p&gt;
      )}
    &lt;/div&gt;
  );
}
// --- next file: components/CopyLinkButton.js
// 'use client';
// import { useState } from 'react';
// export default function CopyLinkButton() {
//   const [copied, setCopied] = useState(false);
//   async function handleClick() {
//     // Browser APIs are safe inside event handlers
//     await navigator.clipboard.writeText(window.location.href);
//     setCopied(true);
//   }
//   return &lt;button onClick={handleClick}&gt;{copied ? 'Link copied!' : 'Copy link'}&lt;/button&gt;;
// }
// --- in app/books/[id]/page.js (a Server Component)
// &lt;AddToCartButton book={book} /&gt;
// &lt;CopyLinkButton /&gt;
</code></pre>

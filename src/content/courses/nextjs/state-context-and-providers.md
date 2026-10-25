---
publishDate: 2026-10-25T13:16
title: State, Context and Providers in Next.js
slug: state-context-and-providers
metadescription: Share state across a Next.js app with React context. Build a CartProvider for Book Nook, wrap it in the root layout and use it from any Client Component.
updateDate: 2026-10-25T13:16
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'react-context', 'state', 'providers']
course: nextjs
---

## What you will build

So far, the **Add to cart** button from [Client Components and the use client Directive](/courses/nextjs/client-components) keeps its own little counter. Nobody else on the site knows about it. A real shop needs one cart that everything can see:

- The header shows **Cart (3)** on every page.
- Every **Add to cart** button adds to the same cart.
- The `/cart` page lists what is inside and the total price.

You will build this with **React context** and a **provider** component, and learn where a provider belongs in a Next.js app.

## The problem: sharing state far away

The header lives in the root layout. The button lives deep inside the book page. They have no parent in common except the root layout itself:

```text
RootLayout
├── Header
│   └── CartCount          needs the number of items
└── BookPage (children)
    └── AddToCartButton    needs to add items
```

You could keep the cart in the root layout and pass it down through props, level by level. But a layout cannot hold state (it is a Server Component), and passing props through every level is tiring. This is called **prop drilling**.

**Context** solves it. Think of a radio station. The **provider** is the transmitter: it broadcasts a value. Any component underneath can tune in with `useContext` and receive it directly, no matter how deep it is. Nobody in between has to pass anything along.

## Why a provider must be a Client Component

Context is all about values that change while the visitor uses the page, and Server Components run once and are done. So context only works in Client Components. Try to create one in a Server Component file and the build stops:

```text
Error: You're importing a module that depends on `createContext` into a React Server Component module. This API is only available in Client Components. To fix, mark the file (or its parent) with the `"use client"` directive.
```

The solution is a small Client Component whose only job is to hold the state and provide it. The rest of your app can stay on the server.

## Step 1: create the CartProvider

```jsx
// components/CartProvider.js
'use client';

import { createContext, useContext, useState } from 'react';

// 1. The context itself. null means "no provider above me".
const CartContext = createContext(null);

// 2. The provider: holds the cart state and shares it with its children
export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  function addToCart(book) {
    setItems((current) => {
      const existing = current.find((item) => item.id === book.id);
      if (existing) {
        // Already in the cart: add one more copy
        return current.map((item) =>
          item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // New book: add it with quantity 1
      return [...current, { ...book, quantity: 1 }];
    });
  }

  function removeFromCart(id) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext value={{ items, count, total, addToCart, removeFromCart }}>
      {children}
    </CartContext>
  );
}

// 3. A small hook so components do not need to import the context directly
export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return cart;
}
```

Let us walk through it:

- `createContext(null)` creates the "radio frequency". The `null` is the value a component gets if there is **no** provider above it.
- `CartProvider` keeps the list of `items` in state, plus two functions that change it. It also works out `count` and `total` from the items, so they are always correct.
- `<CartContext value={...}>` broadcasts an object with everything the rest of the app needs. In React 19 you render the context itself as the provider. Older code writes `<CartContext.Provider value={...}>`, which still works.
- `useCart()` is a **custom hook**: a function whose name starts with `use` and that calls other hooks. It reads the context and gives a clear error if someone forgets the provider.
- The update functions use `setItems((current) => ...)`, the "updater" form, so quick double clicks never work with an out-of-date list.

## Step 2: wrap the app in the root layout

The provider must sit **above** every component that uses the cart. Both the header and every page are inside the root layout, so that is the place. Here is Book Nook's full root layout:

```jsx
// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import CartProvider from "@/components/CartProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Book Nook",
  description: "A small online bookshop with hand-picked books.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <Header />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
```

Two important details:

- The layout is still a **Server Component**. It imports a Client Component and renders it, which is always allowed.
- `Header` and `{children}` are passed **into** `CartProvider` as children. Remember the children pattern from [Mixing Server and Client Components](/courses/nextjs/server-client-boundary): they are rendered by the server and handed to the provider as finished output. So wrapping your whole app in a Client Component provider does **not** turn your pages into Client Components. They stay on the server.

Put providers as deep as you can. Here it wraps the contents of `<body>`, not the `<html>` tag. That leaves the document shell alone, which makes it easier for Next.js to prerender the static parts.

## Step 3: show the count in the header

The header itself has no state, so it stays a Server Component. Only the little cart link needs the context, so give it its own Client Component:

```jsx
// components/CartCount.js
'use client';

import Link from 'next/link';
import { useCart } from './CartProvider';

export default function CartCount() {
  const { count } = useCart();
  return <Link href="/cart">Cart ({count})</Link>;
}
```

```jsx
// components/Header.js
import Link from 'next/link';
import CartCount from './CartCount';

export default function Header() {
  return (
    <header>
      <Link href="/">Book Nook</Link>
      <nav>
        <Link href="/books">Books</Link>
        <Link href="/about">About</Link>
        <CartCount />
      </nav>
    </header>
  );
}
```

## Step 4: add to the cart from the book page

Replace the local counter in the button with the shared cart:

```jsx
// components/AddToCartButton.js
'use client';

import { useCart } from './CartProvider';

export default function AddToCartButton({ book }) {
  const { addToCart } = useCart();
  return <button onClick={() => addToCart(book)}>Add to cart</button>;
}
```

The book page does not change. It still renders `<AddToCartButton book={{ id: book.id, title: book.title, price: book.price }} />`, passing only what the cart needs.

## Step 5: the cart page

The page itself can stay a Server Component (so it can export `metadata`, for example). The list reads the context, so it goes in a Client Component:

```jsx
// components/CartContents.js
'use client';

import { useCart } from './CartProvider';

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function CartContents() {
  const { items, total, removeFromCart } = useCart();

  if (items.length === 0) {
    return <p>Your cart is empty.</p>;
  }

  return (
    <>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.title} x {item.quantity}
            <button onClick={() => removeFromCart(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <p>Total: {price.format(total)}</p>
    </>
  );
}
```

```jsx
// app/cart/page.js
import CartContents from '@/components/CartContents';

export const metadata = { title: 'Your cart' };

export default function CartPage() {
  return (
    <main>
      <h1>Your cart</h1>
      <CartContents />
    </main>
  );
}
```

## Try it

Run `npm run dev` and:

1. Open `/books/dune` and click **Add to cart** twice. The header says **Cart (2)**.
2. Click a link to `/books/the-hobbit` and add it. **Cart (3)**.
3. Click **Cart (3)**. You see both books and the total.

The cart survives every click on a `Link` because the root layout, and the provider inside it, is never thrown away during navigation (you saw this in [Templates and the Root Layout in Depth](/courses/nextjs/templates-and-root-layout)).

Now press the browser's reload button. The cart is empty again. Context lives in the browser's memory, and a full reload starts the JavaScript from scratch. Keeping the cart across reloads means storing it somewhere more permanent: in a cookie ([Reading Cookies and Headers](/courses/nextjs/cookies-and-headers)) or in a database ([Building a Data Layer and Talking to a Database](/courses/nextjs/data-layer-and-database)).

## Where should state live?

Context is one tool among several. Pick the simplest one that works:

| Kind of state | Example in Book Nook | Where to keep it |
| --- | --- | --- |
| Used by one component | Is the "show more" section open? | `useState` in that component |
| Should be in the URL, shareable, survives reload | Selected genre filter | Search params ([Reading Search Params from the URL](/courses/nextjs/search-params)) |
| Shared by many components on the client | The cart, a light or dark theme | Context in a provider |
| Must be saved for later or seen by the server | Orders, user accounts | A database, reached from the server |

A common beginner mistake is to put everything into context. Every component that reads a context re-renders when its value changes, so keep each context focused on one job. Book Nook has one provider for the cart; a theme would get its own `ThemeProvider`.

## Common mistakes

### Using the hook outside the provider

If a component calls `useCart()` but is not inside `<CartProvider>`, you get the error from our own hook:

```text
Error: useCart must be used inside <CartProvider>
```

Check that the provider wraps `{children}` in `app/layout.js`. This is exactly why `useCart` throws: without the check, you would get a confusing `Cannot destructure property 'count' of ... as it is null` error instead.

### Creating context in a Server Component file

You see "You're importing a module that depends on `createContext` into a React Server Component module". Put `'use client'` at the top of the provider file.

### Reading context in a Server Component

`useContext` does not work in Server Components, because they cannot hold changing values. Move the part that needs the cart into a small Client Component, like `CartCount`.

### Expecting the cart to survive a reload

Context lives in memory in the browser tab. A reload or a new tab starts empty. Store data that must last in a cookie or a database.

## Quick recap

- Context shares a value with every component below a provider, without passing props through each level.
- Context only works in Client Components, so the provider file starts with `'use client'`.
- Wrap `{children}` with the provider in the root layout. The layout and the pages stay Server Components.
- A custom hook like `useCart()` makes the context easy to use and gives a clear error when the provider is missing.
- In React 19 you write `<CartContext value={...}>`; `<CartContext.Provider>` is the older form.
- Context survives client-side navigation but not a full page reload.

<code id="code-content" class="language-jsx">
// components/CartProvider.js: one shared cart for all of Book Nook
'use client'; // context and state only work in Client Components
import { createContext, useContext, useState } from 'react';
const CartContext = createContext(null); // null = no provider above
export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  function addToCart(book) {
    setItems((current) =&gt; {
      const existing = current.find((item) =&gt; item.id === book.id);
      if (existing) {
        return current.map((item) =&gt;
          item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...book, quantity: 1 }];
    });
  }
  function removeFromCart(id) {
    setItems((current) =&gt; current.filter((item) =&gt; item.id !== id));
  }
  const count = items.reduce((sum, item) =&gt; sum + item.quantity, 0);
  const total = items.reduce((sum, item) =&gt; sum + item.price * item.quantity, 0);
  // React 19: render the context itself as the provider
  return (
    &lt;CartContext value={{ items, count, total, addToCart, removeFromCart }}&gt;
      {children}
    &lt;/CartContext&gt;
  );
}
export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error('useCart must be used inside &lt;CartProvider&gt;');
  }
  return cart;
}
// --- app/layout.js: wrap the header and every page
// &lt;body className="min-h-full flex flex-col"&gt;
//   &lt;CartProvider&gt;
//     &lt;Header /&gt;
//     {children}
//   &lt;/CartProvider&gt;
// &lt;/body&gt;
// --- any Client Component can now use the cart
// const { count, addToCart } = useCart();
</code></pre>

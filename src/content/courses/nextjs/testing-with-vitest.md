---
publishDate: 2026-10-25T13:55
title: Unit Testing with Vitest
slug: testing-with-vitest
metadescription: Set up Vitest, React Testing Library and jsdom in a Next.js 16 JavaScript project, then unit test cart helpers and Client Components.
updateDate: 2026-10-25T13:55
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'testing', 'vitest', 'react-testing-library']
course: nextjs
---

## What you will build

So far you have checked Book Nook by clicking around in the browser. That works, but it gets slow, and it is easy to forget a page. **Automated tests** are small programs that check your code for you, in seconds, every time you change something.

In this lesson you will add **unit tests** to Book Nook. A unit test checks one small piece (a "unit") on its own: one function, or one component. You will:

1. Install **Vitest**, a fast test runner, plus **React Testing Library** and **jsdom**.
2. Test the plain cart helpers in `lib/cart.js`.
3. Test the `AddToCartButton` Client Component together with the `CartProvider` context.
4. Learn what unit tests cannot do in Next.js, and what to use instead.

Think of a car factory. Unit tests check each part on the workbench: does the wheel spin, does the light turn on? Later, in [End-to-End Testing with Playwright](/courses/nextjs/testing-with-playwright), you will take the whole car for a test drive.

## The tools in one sentence each

- **Vitest** finds your test files, runs them, and reports what passed or failed. It is built on Vite, so it starts fast.
- **React Testing Library** renders a component and lets you find things the way a user would: "the button called Add to cart", not "the third div".
- **jsdom** is a pretend browser that runs inside Node.js. It gives your components a `document` and `window` without opening a real browser.

## Step 1: install the packages

In your Book Nook folder, run:

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/user-event
```

`-D` saves them as dev dependencies, because tests are only needed while you build the app. `@testing-library/user-event` is optional, but it simulates real clicks and typing better than anything else, so we use it.

At the time of writing this installs Vitest 5 and `@vitejs/plugin-react` 6. If your numbers are higher, the steps should still work.

## Step 2: add a Vitest config

Create `vitest.config.mjs` in the project root, next to `package.json`:

```javascript
// vitest.config.mjs
import { fileURLToPath } from 'node:url';
import { defineConfig, configDefaults } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

// Next.js lets .js files contain JSX. Vite does not, so this small plugin
// tells Vite to read our own .js files (not node_modules) as JSX.
function jsxInJsFiles() {
  return {
    name: 'jsx-in-js-files',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.js') || id.includes('node_modules')) {
        return null;
      }
      return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
    },
  };
}

export default defineConfig({
  plugins: [jsxInJsFiles(), react()],
  resolve: {
    // The same "@/..." shortcut that jsconfig.json gives Next.js
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Playwright tests will live in e2e/. Vitest must not try to run them.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
```

This is a little longer than the example in the Next.js docs, and every extra line solves a real problem in our project:

- **`environment: 'jsdom'`** gives tests a fake browser. This line is the same as in the docs.
- **`jsxInJsFiles()`**: the Next.js docs show a JavaScript project with `.jsx` files. Our project was made by `create-next-app`, which uses `.js` for components such as `components/CartProvider.js`. Next.js happily reads JSX in `.js` files, but Vite treats `.js` as plain JavaScript and stops with `Unexpected JSX expression`. This tiny plugin tells Vite to read your own `.js` files as JSX.
- **`resolve.alias`**: Book Nook imports with `@/components/...`. Next.js learns that shortcut from `jsconfig.json`, but Vitest does not read that file, so we tell it here. `fileURLToPath` turns the config file's own location into a normal folder path that works on Windows, macOS and Linux.
- **`exclude`**: in the next lesson you will put Playwright tests in an `e2e` folder. Their file names end in `.spec.js`, which Vitest would try to run too. We keep Vitest's default excludes and add `e2e/**`.

> **Good to know:** We named the file `.mjs` because `package.json` has no `"type": "module"`, and the config uses `import`. The `.mjs` ending tells Node.js "this file uses modern imports".

## Step 3: add a test script

Open `package.json` and add a `test` script:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest"
  }
}
```

`npm test` starts Vitest in **watch mode**: it runs the tests, then waits, and reruns them every time you save a file. Press `q` to quit. For a single run (handy in CI), use `npx vitest run`.

## Step 4: test plain functions first

The easiest code to test is a **pure function**: it takes inputs, returns an output, and does nothing else.

In [State, Context and Providers in Next.js](/courses/nextjs/state-context-and-providers) you wrote the cart logic (add a book, remove it, count, total) inside `CartProvider`. That works, but logic hidden inside a component is hard to test on its own. So first, a small refactor: move the logic into plain functions in `lib/cart.js`, with no React at all. We also add `formatPrice`, which turns `14.5` into `$14.50` for every price on the site.

```javascript
// lib/cart.js
export function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

export function addItem(items, book) {
  const existing = items.find((item) => item.id === book.id);
  if (existing) {
    return items.map((item) => (item.id === book.id ? { ...item, quantity: item.quantity + 1 } : item));
  }
  return [...items, { id: book.id, title: book.title, price: book.price, quantity: 1 }];
}

export function removeItem(items, id) {
  return items.filter((item) => item.id !== id);
}

export function cartTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function cartCount(items) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
```

Then let the provider use them. Its outside stays exactly the same (`items`, `count`, `total`, `addToCart`, `removeFromCart`), so no other component has to change:

```jsx
// components/CartProvider.js
'use client';

import { createContext, useContext, useState } from 'react';
import { addItem, removeItem, cartCount, cartTotal } from '@/lib/cart';

const CartContext = createContext(null);

export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  function addToCart(book) {
    setItems((current) => addItem(current, book));
  }

  function removeFromCart(id) {
    setItems((current) => removeItem(current, id));
  }

  const count = cartCount(items);
  const total = cartTotal(items);

  return (
    <CartContext value={{ items, count, total, addToCart, removeFromCart }}>
      {children}
    </CartContext>
  );
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return cart;
}
```

Create a `__tests__` folder in the project root and add a test file. Any file ending in `.test.js` or `.spec.js` is picked up automatically:

```javascript
// __tests__/cart.test.js
import { describe, expect, test } from 'vitest';
import { addItem, removeItem, cartTotal, cartCount, formatPrice } from '@/lib/cart';

const hobbit = { id: 'the-hobbit', title: 'The Hobbit', price: 12.99 };
const dune = { id: 'dune', title: 'Dune', price: 14.5 };

describe('cart helpers', () => {
  test('addItem puts a new book in the cart with quantity 1', () => {
    const items = addItem([], hobbit);
    expect(items).toEqual([{ id: 'the-hobbit', title: 'The Hobbit', price: 12.99, quantity: 1 }]);
  });

  test('addItem raises the quantity when the book is already there', () => {
    const items = addItem(addItem([], hobbit), hobbit);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  test('removeItem takes a book out', () => {
    const items = removeItem(addItem(addItem([], hobbit), dune), 'the-hobbit');
    expect(items.map((item) => item.id)).toEqual(['dune']);
  });

  test('cartTotal and cartCount add everything up', () => {
    const items = addItem(addItem(addItem([], hobbit), hobbit), dune);
    expect(cartCount(items)).toBe(3);
    expect(cartTotal(items)).toBeCloseTo(40.48);
  });

  test('formatPrice always shows two decimals', () => {
    expect(formatPrice(14.5)).toBe('$14.50');
  });
});
```

The shape of every test is the same:

- `describe` groups related tests under one name.
- `test` (you may also see `it`, which is the same thing) describes one behaviour in plain words.
- `expect(value)` plus a **matcher** like `toBe`, `toEqual` or `toHaveLength` states what should be true.

Why `toBeCloseTo` for the total? Computers store decimal numbers slightly inaccurately, so `12.99 + 12.99 + 14.5` may come out as `40.480000000000004`. `toBeCloseTo` allows for that tiny difference.

## Step 5: test a Client Component

Now the fun part. `AddToCartButton` uses the cart context, so we render it inside `CartProvider`, exactly as the real layout does. We also render `CartCount`, the little "Cart (0)" link from the header, to check that the click really updates shared state.

Here are the components being tested. The button is the one from the state lesson, with one small upgrade: it changes its label after the first click, so the shopper gets feedback.

```jsx
// components/AddToCartButton.js
'use client';

import { useState } from 'react';
import { useCart } from './CartProvider';

export default function AddToCartButton({ book }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  function handleClick() {
    addToCart(book);
    setAdded(true);
  }

  return (
    <button type="button" onClick={handleClick}>
      {added ? 'Added! Add another' : 'Add to cart'}
    </button>
  );
}
```

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

Test files that contain JSX should end in `.jsx`, so Vite knows to expect it:

```jsx
// __tests__/AddToCartButton.test.jsx
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartProvider from '@/components/CartProvider';
import AddToCartButton from '@/components/AddToCartButton';
import CartCount from '@/components/CartCount';

afterEach(cleanup);

const dune = { id: 'dune', title: 'Dune', author: 'Frank Herbert', price: 14.5 };

function renderWithCart(ui) {
  return render(<CartProvider>{ui}</CartProvider>);
}

test('the button says "Add to cart" at first', () => {
  renderWithCart(<AddToCartButton book={dune} />);
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDefined();
});

test('clicking the button adds the book and updates the cart count', async () => {
  const user = userEvent.setup();
  renderWithCart(
    <>
      <CartCount />
      <AddToCartButton book={dune} />
    </>
  );

  expect(screen.getByRole('link', { name: 'Cart (0)' })).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(screen.getByRole('link', { name: 'Cart (1)' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Added! Add another' })).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Added! Add another' }));
  expect(screen.getByRole('link', { name: 'Cart (2)' })).toBeDefined();
});
```

Let us read it slowly:

- `render(...)` draws the component into jsdom's fake page.
- `screen.getByRole('button', { name: 'Add to cart' })` finds the button the way a screen reader would: by its **role** (button, link, heading) and its visible name. If it is not there, the test fails straight away with a helpful message.
- `userEvent.setup()` creates a pretend user, and `await user.click(...)` clicks like a real person (mouse down, mouse up, focus, and so on).
- `afterEach(cleanup)` removes the rendered component after each test, so tests never see each other's leftovers.
- `renderWithCart` is a tiny helper you will reuse in every test that needs the cart.

Notice that we never look at `useState` or the context value directly. We check what the **user can see**. That makes tests survive refactors: you can rewrite `CartProvider` completely, and as long as the button and the count behave the same, the tests stay green.

## Step 6: run the tests

```bash
npx vitest run --reporter=verbose
```

```text
 RUN  v5.0.5 /Users/asha/book-nook

 ✓ __tests__/cart.test.js > cart helpers > addItem puts a new book in the cart with quantity 1 3ms
 ✓ __tests__/cart.test.js > cart helpers > addItem raises the quantity when the book is already there 1ms
 ✓ __tests__/cart.test.js > cart helpers > removeItem takes a book out 0ms
 ✓ __tests__/cart.test.js > cart helpers > cartTotal and cartCount add everything up 0ms
 ✓ __tests__/cart.test.js > cart helpers > formatPrice always shows two decimals 0ms
 ✓ __tests__/AddToCartButton.test.jsx > the button says "Add to cart" at first 171ms
 ✓ __tests__/AddToCartButton.test.jsx > clicking the button adds the book and updates the cart count 126ms

 Test Files  2 passed (2)
      Tests  7 passed (7)
```

Now break something on purpose: change `quantity + 1` to `quantity + 2` in `lib/cart.js` and save while `npm test` is running. The quantity test fails at once and shows `expected 3 to be 2`. Undo the change and it turns green again. That instant feedback is why people love tests.

## What about Server Components?

Look at Book Nook's home page:

```jsx
// app/page.js
import { getBooks } from '@/lib/books';

export default async function HomePage() {
  const books = await getBooks();
  // ...
}
```

It is an **async Server Component**. The Next.js docs say it plainly: Vitest does not support async Server Components yet, and the recommended way to test them is with end-to-end tests. There are two more reasons it would not work in Book Nook anyway:

- `lib/books.js` starts with `import 'server-only'`, which deliberately throws when loaded outside a Server Component.
- Its functions use `'use cache'` and `cacheTag`, which only work inside the Next.js server.

So split the work like this:

| What | How to test it |
| --- | --- |
| Pure helpers (`lib/cart.js`, formatting, validation) | Vitest unit tests |
| Client Components (`AddToCartButton`, `CartView`, forms) | Vitest + React Testing Library |
| Synchronous Server Components with no server-only imports | Vitest can render them |
| Async Server Components, Server Actions, caching, auth | Playwright end-to-end tests |

A useful trick: keep logic out of Server Components. If a page needs to sort or filter books, put that logic in a plain function in `lib/` and unit test the function. The page stays thin, and the important part is tested.

## Common mistakes

### JSX in a .js file

```text
Error: Transform failed with 1 error:
[PARSE_ERROR] Unexpected JSX expression
 components/CartProvider.js:24:5
Help: JSX syntax is disabled and should be enabled via the parser options
  Plugin: vite:oxc
```

Vite reads `.js` files as plain JavaScript. Add the `jsxInJsFiles()` plugin from Step 2, and name your own test files `.test.jsx`.

### Importing a server-only module

```text
Error: This module cannot be imported from a Client Component module. It should only be used from a Server Component.
 ❯ Object.<anonymous> node_modules/server-only/index.js:1:7
```

Your test imported something that (directly or deeply) imports `lib/books.js`, `lib/session.js` or another `server-only` file. Test that page with Playwright instead, or move the logic you care about into a plain helper. If you never installed the `server-only` package (Next.js understands that import without it), Vitest fails one step earlier with `Failed to resolve import "server-only"`. The cause and the fix are the same.

### `Failed to resolve import "@/components/..."`

Vitest does not read `jsconfig.json`. Add the `resolve.alias` block from Step 2.

### Tests that leak into each other

If a second test finds two buttons instead of one, the first test's render is still on the page. Add `afterEach(cleanup)` at the top of the file.

### Vitest runs your Playwright files

If `npm test` suddenly shows errors from `@playwright/test` or from files in `e2e/`, Vitest is trying to run your Playwright tests. Keep the `exclude` line in the config.

## Quick recap

- Unit tests check one small piece at a time, and run in seconds.
- Install `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom` (and `@testing-library/user-event` for clicks).
- `vitest.config.mjs` sets `environment: 'jsdom'`, the `@` alias, an `e2e/**` exclude, and a tiny plugin so `.js` components with JSX work.
- Test pure functions with `expect(...).toBe(...)`, and components with `render`, `screen.getByRole` and `userEvent`.
- Wrap components in the providers they need, like `CartProvider`.
- Async Server Components, Server Actions and caching are best covered by end-to-end tests, next up in [End-to-End Testing with Playwright](/courses/nextjs/testing-with-playwright).

<code id="code-content" class="language-jsx">
// __tests__/AddToCartButton.test.jsx: run with "npm test"
import { afterEach, expect, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartProvider from '@/components/CartProvider';
import AddToCartButton from '@/components/AddToCartButton';
import CartCount from '@/components/CartCount';
// Remove anything rendered by the previous test
afterEach(cleanup);
const dune = { id: 'dune', title: 'Dune', author: 'Frank Herbert', price: 14.5 };
// The button needs the cart context, just like in the real layout
function renderWithCart(ui) {
  return render(&lt;CartProvider&gt;{ui}&lt;/CartProvider&gt;);
}
test('the button says "Add to cart" at first', () =&gt; {
  renderWithCart(&lt;AddToCartButton book={dune} /&gt;);
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDefined();
});
test('clicking the button adds the book and updates the cart count', async () =&gt; {
  const user = userEvent.setup();
  renderWithCart(
    &lt;&gt;
      &lt;CartCount /&gt;
      &lt;AddToCartButton book={dune} /&gt;
    &lt;/&gt;
  );
  expect(screen.getByRole('link', { name: 'Cart (0)' })).toBeDefined();
  // Click like a real user, then check what the user would see
  await user.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(screen.getByRole('link', { name: 'Cart (1)' })).toBeDefined();
  expect(screen.getByRole('button', { name: 'Added! Add another' })).toBeDefined();
});
// --- vitest.config.mjs (summary)
// plugins: [jsxInJsFiles(), react()]   lets .js components contain JSX
// resolve.alias: { '@': project root }  same shortcut as jsconfig.json
// test.environment: 'jsdom'            a pretend browser inside Node.js
// test.exclude: [..., 'e2e/**']        leave Playwright files alone
</code></pre>

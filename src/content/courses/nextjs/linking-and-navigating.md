---
publishDate: 2026-10-25T13:07
title: Linking and Navigating Between Pages
slug: linking-and-navigating
metadescription: "Use the Next.js Link component for fast page changes, learn how prefetching works, navigate in code with useRouter, and highlight active links with usePathname."
updateDate: 2026-10-25T13:07
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'link', 'navigation', 'userouter']
course: nextjs
---

## What you will learn

Book Nook has pages, a root layout and a books layout. But its menu uses plain `<a>` tags, and every click reloads the whole page. In this lesson you will make navigation fast and smooth:

- swap `<a>` for the Next.js **`<Link>`** component
- understand **client-side navigation** and **prefetching**
- move the menu into its own `components/Header.js`
- highlight the current page with **`usePathname`**
- navigate from code, like a "Continue shopping" button, with **`useRouter`**

You need the layouts from [Pages and Layouts](/courses/nextjs/pages-and-layouts).

## Why not a plain a tag?

Click **Books** in your current menu and watch the browser's reload button: it flickers. A plain `<a href="/books">` makes the browser throw the whole page away and load a new one from scratch. That means:

- the header, footer and fonts are downloaded and drawn again
- anything typed into a layout (a search box, say) is lost
- the screen may flash white for a moment

ESLint already warns you about it. Run `npm run lint` and you see:

```text
error  Do not use an `<a>` element to navigate to `/books/`. Use `<Link />` from `next/link` instead. See: https://nextjs.org/docs/messages/no-html-link-for-pages  @next/next/no-html-link-for-pages
```

## Step 1: use Link

`<Link>` is a React component from `next/link`. It still renders a normal `<a>` tag in the HTML (so it works for search engines, right-click "open in new tab", and screen readers), but it adds two powers:

1. **Client-side navigation.** When you click, Next.js swaps only the part of the page that changed, without a full reload. Layouts stay on screen and keep their state.
2. **Prefetching.** Next.js loads linked pages in the background before you click, so the click feels instant.

Using it is almost the same as `<a>`:

```jsx
import Link from 'next/link';

<Link href="/books">Books</Link>
```

You can pass the usual `<a>` attributes too, like `className`. They are passed down to the real `<a>` tag:

```jsx
<Link href="/books" className="font-bold underline">
  Books
</Link>
```

## Step 2: move the menu into a Header component

The menu will grow, so let us give it its own file. Create a `components` folder at the top of the project (next to `app`, not inside it) and add `Header.js`:

```jsx
// components/Header.js
import Link from 'next/link';

export default function Header() {
  return (
    <header className="border-b px-6 py-4">
      <nav className="flex gap-6">
        <Link href="/" className="font-bold">Book Nook</Link>
        <Link href="/books">Books</Link>
        <Link href="/about">About</Link>
        <Link href="/cart">Cart</Link>
      </nav>
    </header>
  );
}
```

Now use it in the root layout. Thanks to the `@/` alias you set up with create-next-app, the import works from anywhere:

```jsx
// app/layout.js (only the changed parts)
import Header from "@/components/Header";

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 p-8">{children}</main>
        <footer className="border-t px-6 py-4 text-sm text-zinc-500">
          Book Nook: a small shop for big stories.
        </footer>
      </body>
    </html>
  );
}
```

Click around. The pages change without the white flash, and the header never redraws. Do the same in `app/books/layout.js`: import `Link` and replace the two `<a>` tags in the side menu.

## How client-side navigation works

Here is what happens when you click a `<Link>`:

1. Next.js stops the browser's normal full page load.
2. It asks the server only for what is new: the page for the new URL (often it already has it, thanks to prefetching).
3. It swaps that page into the layout. The layouts around it stay untouched.
4. It updates the address bar and the browser history, so the **Back** button still works.
5. It scrolls to the top of the new page.

It is like changing the photo in a picture frame instead of buying a new frame every time.

## Prefetching

**Prefetching** means loading a page in the background **before** the user clicks on it. Next.js prefetches a `<Link>` automatically when it scrolls into view on the screen (or when you hover over it). By the time you click, the page is often already in the browser.

Two things to know:

- **Prefetching only happens in production** (`npm run build` and `npm start`). In development (`npm run dev`) it is turned off, so pages can feel slower there than they really are.
- Book Nook has `partialPrefetching: true` in `next.config.mjs`. With it, each link prefetches the page's **App Shell**: its static parts and cached content. Anything that has to be made fresh for each visitor streams in after the click.

You can control prefetching per link with the `prefetch` prop:

```jsx
// Default: Next.js decides (with Partial Prefetching, the App Shell is prefetched)
<Link href="/books">Books</Link>

// Prefetch the full page, including content that depends on the URL
<Link href="/books" prefetch={true}>Books</Link>

// Never prefetch, for example in a very long list of links
<Link href="/books" prefetch={false}>Books</Link>
```

For almost every link, leave the default. You will see how prefetching and caching work together in [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering).

## Other useful Link props

```jsx
// Replace the current history entry instead of adding one.
// The Back button then skips this page.
<Link href="/login" replace>Sign in</Link>

// Do not scroll to the top after navigating
<Link href="/books" scroll={false}>Books</Link>

// Build a link with a query string: /books?sort=price
<Link href={{ pathname: '/books', query: { sort: 'price' } }}>
  Cheapest first
</Link>
```

Links can also be built from data with a template string, which you will do for every book in [Dynamic Routes and params](/courses/nextjs/dynamic-routes):

```jsx
<Link href={`/books/${book.id}`}>{book.title}</Link>
```

### Links to other websites

For links that leave your site, use a normal `<a>`. There is nothing to prefetch, and `<Link>` is meant for pages in your own app:

```jsx
<a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">
  Built with Next.js
</a>
```

## Step 3: highlight the active link

It is nice when the menu shows where you are. To do that, the header must know the current URL. Next.js gives you a hook for it: **`usePathname`** from `next/navigation`. It returns the **pathname**, the part of the URL after the domain, like `/books/bestsellers`.

There is one catch. Hooks like `usePathname` only work in **Client Components**, components that also run in the browser. You make a file a Client Component by putting `'use client'` at the very top. (You will learn all about this in [Client Components and the use client Directive](/courses/nextjs/client-components).)

Update `components/Header.js`:

```jsx
// components/Header.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/books', label: 'Books' },
  { href: '/about', label: 'About' },
  { href: '/cart', label: 'Cart' },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b px-6 py-4">
      <nav className="flex gap-6">
        <Link href="/" className="font-bold">Book Nook</Link>
        {links.map((link) => {
          // "/books" should also be active on "/books/bestsellers"
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? 'font-semibold underline' : 'text-zinc-600'}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
```

How it works:

- `'use client'` makes this a Client Component, so it can use the hook.
- `usePathname()` gives the current path, for example `/books/bestsellers`.
- `pathname.startsWith(link.href)` is `true` for `/books` and anything below it, so **Books** stays highlighted on every books page.
- The links are stored in an array and turned into `<Link>` elements with `map`, so adding a menu item later is one line.

When you click a link, the header re-renders with the new pathname, and the underline moves. The rest of the layout stays put.

## Step 4: wrap the header in Suspense

There is one more step, and it matters for Book Nook because **Cache Components** is turned on.

With Cache Components, Next.js tries to prepare as much of every page as possible **ahead of time**. But the pathname of a page like `/books/dune` is only known when a real visitor asks for it. So Next.js wants you to mark the part that reads it with React's **`<Suspense>`** component: a wrapper that shows a stand-in (the `fallback`) until its contents are ready.

Right now all your pages have fixed URLs, so nothing breaks yet. But in the very next lesson you add your first dynamic page, and without `<Suspense>` both the dev overlay and `npm run build` stop with:

```text
Error: Route "/books/[id]": Next.js encountered URL data `usePathname()` in a Client Component outside of `<Suspense>`.

This blocks prerendering because the value is only available at runtime.
```

So add it now. In `app/layout.js`:

```jsx
// app/layout.js (only the changed parts)
import { Suspense } from "react";
import Header from "@/components/Header";

// ...inside <body>, replace <Header /> with:
<Suspense fallback={<header className="border-b px-6 py-4 font-bold">Book Nook</header>}>
  <Header />
</Suspense>
```

The `fallback` is a plain header with just the shop name. On pages that are prepared ahead of time, visitors never see it. On dynamic pages, it shows for a split second while the real header arrives. You will learn much more about `<Suspense>` in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming).

## Step 5: navigate from code with useRouter

Sometimes you need to change pages from code instead of a link, for example after a button click. The **`useRouter`** hook from `next/navigation` gives you a `router` object for that. Like `usePathname`, it only works in a Client Component.

Let us add "Continue shopping" and "Go back" buttons to the cart. Create `components/CartActions.js`:

```jsx
// components/CartActions.js
'use client';

import { useRouter } from 'next/navigation';

export default function CartActions() {
  const router = useRouter();

  return (
    <div className="mt-6 flex gap-4">
      <button
        type="button"
        onClick={() => router.push('/books')}
        className="rounded bg-black px-4 py-2 text-white"
      >
        Continue shopping
      </button>
      <button
        type="button"
        onClick={() => router.back()}
        className="rounded border px-4 py-2"
      >
        Go back
      </button>
    </div>
  );
}
```

And use it in the cart page:

```jsx
// app/cart/page.js
import CartActions from '@/components/CartActions';

export default function CartPage() {
  return (
    <section>
      <h1 className="text-3xl font-bold">Your cart</h1>
      <p className="mt-4">Your cart is empty.</p>
      <CartActions />
    </section>
  );
}
```

The cart page stays a Server Component. Only the small part with buttons is a Client Component. That is a good habit: keep `'use client'` for the pieces that really need the browser.

Here are the `router` methods you will use most:

| Method | What it does |
| --- | --- |
| `router.push('/books')` | Go to a page and add it to the history (like clicking a link). |
| `router.replace('/login')` | Go to a page without adding a history entry. |
| `router.back()` | Go back one page, like the browser's Back button. |
| `router.forward()` | Go forward one page. |
| `router.refresh()` | Ask the server for fresh data for the current page, keeping state. |
| `router.prefetch('/cart')` | Prefetch a page by hand. |

**Prefer `<Link>` whenever you can.** Links are real `<a>` tags, so they work with right-click, middle-click, keyboard navigation and search engines. Use `useRouter` only when there is no link to click, like after a form is saved.

## Common mistakes

### Importing useRouter from next/router

Old tutorials (and the Pages Router) use `next/router`. In the App Router you must import from `next/navigation`. With the wrong import, the page crashes with:

```text
Error: NextRouter was not mounted. https://nextjs.org/docs/messages/next-router-not-mounted
```

Change the import to `import { useRouter } from 'next/navigation';`.

### Using usePathname without 'use client'

If you call `usePathname` (or `useRouter`) in a Server Component, the build stops:

```text
Error: You're importing a module that depends on `usePathname` into a React Server Component module. This API is only available in Client Components. To fix, mark the file (or its parent) with the `"use client"` directive.
```

Add `'use client';` as the very first line of the file.

### Forgetting Suspense around the header

Without the `<Suspense>` from Step 4, the first dynamic route you add fails with "encountered URL data `usePathname()` in a Client Component outside of `<Suspense>`". Wrap the component that calls `usePathname` in `<Suspense>`.

### Putting an a tag inside Link

Very old Next.js code wrote `<Link href="/books"><a>Books</a></Link>`. Today `<Link>` already renders the `<a>`, so this creates a link inside a link, and React reports `<a> cannot be a descendant of <a>`. Put the text directly inside `<Link>`.

### Thinking prefetching is broken in development

In `npm run dev`, clicks may wait for the server because prefetching is off. Run `npm run build` and `npm start` to see the real, instant navigation.

## Quick recap

- Use `<Link href="...">` from `next/link` for pages in your app, and plain `<a>` for other websites.
- Link gives **client-side navigation** (only the page swaps, layouts stay) and **prefetching** (pages load before you click, in production).
- With `partialPrefetching` on, links prefetch each page's App Shell. Use `prefetch={false}` to turn it off, or `prefetch={true}` for the full page.
- `usePathname()` from `next/navigation` returns the current path. Use it in a Client Component (`'use client'`) to highlight active links.
- With Cache Components, wrap a component that reads the URL, like the header, in `<Suspense>`.
- `useRouter()` from `next/navigation` gives `push`, `replace`, `back`, `forward`, `refresh` and `prefetch`. Prefer `<Link>` when there is something to click.

<code id="code-content" class="language-jsx">
// components/Header.js: the Book Nook header with active links
'use client'; // needed for the usePathname hook
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [
  { href: '/books', label: 'Books' },
  { href: '/about', label: 'About' },
  { href: '/cart', label: 'Cart' },
];
export default function Header() {
  const pathname = usePathname(); // for example "/books/bestsellers"
  return (
    &lt;header className="border-b px-6 py-4"&gt;
      &lt;nav className="flex gap-6"&gt;
        &lt;Link href="/" className="font-bold"&gt;Book Nook&lt;/Link&gt;
        {links.map((link) =&gt; {
          // "/books" stays active on every page below it
          const isActive = pathname.startsWith(link.href);
          return (
            &lt;Link
              key={link.href}
              href={link.href}
              className={isActive ? 'font-semibold underline' : 'text-zinc-600'}
            &gt;
              {link.label}
            &lt;/Link&gt;
          );
        })}
      &lt;/nav&gt;
    &lt;/header&gt;
  );
}
// --- in app/layout.js: wrap the header in Suspense (Cache Components needs it)
// import { Suspense } from "react";
// import Header from "@/components/Header";
// &lt;Suspense fallback={&lt;header className="border-b px-6 py-4 font-bold"&gt;Book Nook&lt;/header&gt;}&gt;
//   &lt;Header /&gt;
// &lt;/Suspense&gt;
// --- components/CartActions.js: navigate from code
// const router = useRouter(); // from 'next/navigation'
// router.push('/books');  router.back();
</code></pre>

---
publishDate: 2026-10-25T13:05
title: How File-Based Routing Works
slug: file-based-routing
metadescription: "Learn how folders and page.js files in the Next.js app folder become URLs, build the first Book Nook pages, and see which files are and are not routes."
updateDate: 2026-10-25T13:05
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'routing', 'app-router', 'pages']
course: nextjs
---

## What you will learn

Every website is a collection of addresses: `/`, `/books`, `/about`, `/cart`. Each address is called a **route**. In many tools you write a list of routes in code. In Next.js you do not. You make **folders and files**, and Next.js turns them into routes for you. This is called **file-based routing**.

In this lesson you will:

- learn the two simple rules that turn folders into URLs
- add the first real pages to Book Nook: `/books`, `/about` and `/cart`
- nest folders to make deeper URLs like `/books/bestsellers`
- see which files become routes and which stay private
- get a first look at special folder names you will learn later

You need the Book Nook project from [Creating Your First Next.js App](/courses/nextjs/create-your-first-app), with the dev server running (`npm run dev`).

## The two rules

Think of the `app` folder as a building, and the URL as directions to a room. Each folder is a door you walk through. A `page.js` file is the sign on the room that says "open to visitors".

1. **Folders make URL segments.** A **segment** is one piece of a URL between slashes. In `/books/bestsellers`, the segments are `books` and `bestsellers`. The folder `app/books` makes the `books` segment.
2. **A `page.js` file makes the route public.** A folder without a `page.js` is just a corridor. You can walk through it, but there is nothing to see there.

Here is how it looks:

```text
app/
├── page.js                  →  /
├── about/
│   └── page.js              →  /about
├── books/
│   ├── page.js              →  /books
│   └── bestsellers/
│       └── page.js          →  /books/bestsellers
└── cart/
    └── page.js              →  /cart
```

The `app` folder itself is the root, `/`. That is why `app/page.js` is your home page. There is no `index.js` in the App Router: the file is always called `page.js`.

## Step 1: add an About page

Create a new folder `app/about`, and inside it a file called `page.js`:

```jsx
// app/about/page.js
export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">About Book Nook</h1>
      <p className="mt-4">
        Book Nook is a small, independent bookshop. We pick every book by hand
        and ship it with care.
      </p>
    </main>
  );
}
```

Save, and open `http://localhost:3000/about`. Your page is there. You did not register the route anywhere, import anything, or restart the server. The folder and file were enough.

The terminal confirms it:

```text
○ Compiling /about ...
 GET /about 200 in 1621ms (next.js: 1455ms, application-code: 166ms)
```

A few things to notice:

- The file must `export default` a React component. That is how Next.js finds the page.
- The **component name does not matter**. `AboutPage`, `Page` or `About` all work. Pick a name that helps you read the code.
- The **folder name** decides the URL. Rename `about` to `about-us`, and the page moves to `/about-us`.

## Step 2: add the books and cart pages

Make two more folders, each with its own `page.js`:

```jsx
// app/books/page.js
export default function BooksPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">All books</h1>
      <ul className="mt-4 list-disc pl-6">
        <li>The Hobbit</li>
        <li>Pride and Prejudice</li>
        <li>Dune</li>
        <li>The Little Prince</li>
      </ul>
    </main>
  );
}
```

```jsx
// app/cart/page.js
export default function CartPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <p className="mt-4">Your cart is empty.</p>
    </main>
  );
}
```

Visit `/books` and `/cart` to see them. For now the list of books is typed by hand. In [Dynamic Routes and params](/courses/nextjs/dynamic-routes) you will load it from a data file instead.

## Step 3: nest folders for deeper URLs

To make `/books/bestsellers`, put a `bestsellers` folder **inside** `books`:

```jsx
// app/books/bestsellers/page.js
export default function BestsellersPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Bestsellers</h1>
      <ol className="mt-4 list-decimal pl-6">
        <li>Dune</li>
        <li>The Hobbit</li>
      </ol>
    </main>
  );
}
```

Each level of folders adds one segment to the URL. You can nest as deep as you like:

| File | URL |
| --- | --- |
| `app/page.js` | `/` |
| `app/books/page.js` | `/books` |
| `app/books/bestsellers/page.js` | `/books/bestsellers` |
| `app/books/bestsellers/this-week/page.js` | `/books/bestsellers/this-week` |

`/books` and `/books/bestsellers` are separate pages. Each one has its own `page.js`, and neither one needs the other to exist.

## Folders without a page.js

What happens if a folder has no `page.js`? Let us try. Create an empty folder `app/staff` and visit `/staff`. You get the built-in **404 page**:

```text
404
This page could not be found.
```

**404** is the web's code for "not found". The folder exists, but because it has no `page.js`, it is not a public route. The same happens for any address you never created, like `/unicorns`. You will design your own friendly 404 page in [Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects).

A folder without a page can still be useful. It can hold other folders. For example, you could have `app/account/orders/page.js` (`/account/orders`) without any `app/account/page.js`. Then `/account/orders` works, and `/account` shows the 404 page.

## Other files in app are safe

Only special file names, like `page.js`, create routes. Any other file inside `app` is ignored by the router. That means you can keep helper files right next to the page that uses them:

```text
app/books/
├── page.js            →  /books (a route)
├── book-list.js       not a route, just a component file
└── prices.js          not a route, just a helper file
```

Visiting `/books/book-list` shows the 404 page, not your component. Keeping files close to where they are used is called **colocation**.

```javascript
// app/books/prices.js
export function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}
```

```jsx
// app/books/page.js
import { formatPrice } from './prices';

export default function BooksPage() {
  return <p>Paperbacks from {formatPrice(8.75)}</p>;
}
```

In Book Nook, most shared code will live **outside** `app`, in `components/` and `lib/` folders, as you saw in [Understanding the Project Files](/courses/nextjs/project-structure). Both styles are fine. Pick one and be consistent.

## page.js and route.js

There is one more file that makes a route public: `route.js`. Instead of a web page, it returns raw data, like JSON for an API. Book Nook will have one at `/api/books`:

```text
app/api/books/route.js   →  /api/books (returns JSON, not a page)
```

A folder can have a `page.js` **or** a `route.js`, but not both, because one URL cannot be a page and an API at the same time. You will build route handlers in [Building APIs with Route Handlers](/courses/nextjs/route-handlers).

## A peek at special folder names

Some folder names have extra powers. You do not need them yet, but it helps to recognise them:

| Folder name | Example | What it does | Lesson |
| --- | --- | --- | --- |
| `[name]` | `app/books/[id]` | A **dynamic** segment: one page for many URLs, like `/books/dune` and `/books/the-hobbit`. | [Dynamic Routes and params](/courses/nextjs/dynamic-routes) |
| `(name)` | `app/(shop)/cart` | A **route group**: organises folders without adding to the URL. | [Route Groups and Private Folders](/courses/nextjs/route-groups-and-private-folders) |
| `_name` | `app/_components` | A **private folder**: never a route, even with a `page.js` inside. | [Route Groups and Private Folders](/courses/nextjs/route-groups-and-private-folders) |
| `@name` | `app/@modal` | A **slot** for showing two pages side by side. | [Parallel Routes and Intercepting Routes](/courses/nextjs/parallel-and-intercepting-routes) |

## How Next.js decides what to show

When someone visits `/books/bestsellers`, Next.js walks the `app` folder like this:

1. Start at `app`.
2. Look for a folder called `books`. Found it, go inside.
3. Look for a folder called `bestsellers`. Found it, go inside.
4. Is there a `page.js` here? Yes, so render it.

If any step fails (no such folder, or no `page.js` at the end), the visitor gets the 404 page. It is like following signs in a building: if a door is missing, you are lost.

There is one more step you will learn next: on the way down, Next.js also collects any `layout.js` files it passes. They wrap the page in shared UI like a header and footer. That is the topic of [Pages and Layouts](/courses/nextjs/pages-and-layouts).

## Good habits for folder names

The folder name is exactly what appears in the URL, so:

- Use **lowercase** letters: `bestsellers`, not `Bestsellers`.
- Use **dashes** between words: `new-arrivals`, not `new_arrivals` or `newArrivals`. Dashes are the web's usual style and read well in links.
- Keep names **short and meaningful**. Visitors and search engines both read URLs.

```text
app/books/new-arrivals/page.js    →  /books/new-arrivals    good
app/books/NewArrivals/page.js     →  /books/NewArrivals     avoid
```

## Common mistakes

### Naming the file after the route

Coming from older tutorials, you might create `app/about.js` or `app/about/about.js`. Neither works. In the App Router the folder is named after the route and the file is always `page.js`:

```text
app/about.js            wrong: not a route
app/about/about.js      wrong: not a route
app/about/index.js      wrong: not a route
app/about/page.js       right: shows at /about
```

### Forgetting export default

If the page has no default export, you see this in the terminal and the error overlay:

```text
⨯ Error: The default export is not a React Component in "/about/page"
```

Make sure the file has `export default function SomeName() { ... }`.

### Putting the folder in the wrong place

`app/bestsellers/page.js` gives you `/bestsellers`, not `/books/bestsellers`. If a page appears at an unexpected address, check how deep its folder sits inside `app`.

### Expecting a folder alone to be a page

An empty `app/staff` folder shows the 404 page. Add a `page.js` to make it public.

## Quick recap

- Each **folder** inside `app` is one URL segment. Nesting folders makes deeper URLs.
- A **`page.js`** file (with a default export) makes that folder a public route. `app/page.js` is `/`.
- Folders without `page.js`, and any other files in `app`, are not routes. You can safely colocate helpers next to pages.
- `route.js` makes an API route instead of a page. A folder cannot have both.
- Special folder names like `[id]`, `(group)`, `_private` and `@slot` add extra powers, covered in later lessons.
- Use lowercase, dash-separated folder names, because they become your URLs.

<code id="code-content" class="language-jsx">
// app/books/page.js: the /books page (folder "books" + file "page.js")
// Folder map so far:
// app/page.js                     -&gt; /
// app/about/page.js               -&gt; /about
// app/books/page.js               -&gt; /books
// app/books/bestsellers/page.js   -&gt; /books/bestsellers
// app/cart/page.js                -&gt; /cart
// The page must be the default export. The function name is up to you.
export default function BooksPage() {
  return (
    &lt;main className="mx-auto max-w-2xl p-8"&gt;
      &lt;h1 className="text-3xl font-bold"&gt;All books&lt;/h1&gt;
      &lt;ul className="mt-4 list-disc pl-6"&gt;
        &lt;li&gt;The Hobbit&lt;/li&gt;
        &lt;li&gt;Pride and Prejudice&lt;/li&gt;
        &lt;li&gt;Dune&lt;/li&gt;
        &lt;li&gt;The Little Prince&lt;/li&gt;
      &lt;/ul&gt;
    &lt;/main&gt;
  );
}
// --- next file: app/books/bestsellers/page.js (shows at /books/bestsellers)
// export default function BestsellersPage() {
//   return &lt;h1 className="text-3xl font-bold"&gt;Bestsellers&lt;/h1&gt;;
// }
</code></pre>

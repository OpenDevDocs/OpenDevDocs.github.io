---
publishDate: 2026-10-25T13:10
title: Route Groups and Private Folders
slug: route-groups-and-private-folders
metadescription: Organize the Next.js app folder with route groups like (auth) that never appear in the URL, and private _folders that are never turned into routes.
updateDate: 2026-10-25T13:10
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'routing', 'route-groups', 'project-structure']
course: nextjs
---

## The problem: folders are URLs

In [How File-Based Routing Works](/courses/nextjs/file-based-routing) you learned the main rule of the `app` folder: **every folder becomes part of the URL**. `app/books/page.js` is `/books`, and `app/books/[id]/page.js` is `/books/dune`.

That rule is simple, but it causes two small problems as Book Nook grows:

1. Sometimes you want to **group** a few pages together, for example to give them their own layout, without adding a new word to their URLs.
2. Sometimes you want to keep **helper files** (small components, utility functions) right next to the page that uses them, and be sure they never become pages.

Next.js has a folder naming trick for each problem:

| Folder name | Name | What it does |
| --- | --- | --- |
| `(auth)` | **Route group** | Groups routes. The name in brackets is left out of the URL. |
| `_lib` | **Private folder** | Hides the folder and everything inside it from routing. |

Think of route groups like the coloured tabs in a ring binder. They help you organise the pages, but nobody reading a page ever sees the tab. Private folders are like the "staff only" back room of the bookshop: things are stored there, but customers can never walk in.

## Route groups: folders that are not in the URL

To make a route group, wrap a folder name in round brackets:

```text
app/
├── layout.js
├── page.js                    /
├── books/
│   └── page.js                /books
└── (auth)/
    └── login/
        └── page.js            /login   (not /auth/login)
```

The URL of `app/(auth)/login/page.js` is just `/login`. The `(auth)` part is only for you.

### Why bother? Give a group its own layout

The real power of a group is that it can have its **own `layout.js`**, which wraps only the pages inside it. Book Nook's login page should look different from the shop: a small, centred card with no distractions. Later in the course you may also add a sign-up page, and it should look the same.

Create the group, its layout and the login page:

```jsx
// app/(auth)/layout.js
export default function AuthLayout({ children }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-sm rounded-lg border p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
```

```jsx
// app/(auth)/login/page.js
export default function LoginPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Log in to Book Nook</h1>
      <p>The real form arrives in a later lesson.</p>
    </>
  );
}
```

The classes are Tailwind CSS utilities, covered in [Styling with Tailwind CSS](/courses/nextjs/tailwind-css). Visit `http://localhost:3000/login` and you see the card. Visit `/auth/login` and you get a 404, because the group name is not part of the URL.

The nesting looks like this:

```text
RootLayout (app/layout.js)          used by every page
└── AuthLayout (app/(auth)/layout.js)   only used by pages in (auth)
    └── LoginPage
```

The root layout still wraps everything, so the site header from the root layout still shows on `/login`. The group layout simply adds its own wrapper inside it. If you later add `app/(auth)/signup/page.js`, it gets the same card for free.

> **Note:** If a later lesson writes the login page path as `app/login/page.js`, use `app/(auth)/login/page.js` in your project instead. The URL is `/login` either way, so every link keeps working.

### Groups for organising

A group does not need a layout. You can use groups purely to tidy up a big `app` folder:

```text
app/
├── (marketing)/
│   ├── about/page.js          /about
│   └── contact/page.js        /contact
├── (auth)/
│   ├── layout.js
│   └── login/page.js          /login
└── books/
    ├── page.js                /books
    └── [id]/page.js           /books/dune
```

Anyone opening the project can now see at a glance which pages are "marketing" pages and which are "auth" pages.

### Pages that skip a shared layout

Groups also let you give a layout to **some** pages and keep it away from others. Imagine Book Nook wanted a sidebar of genres on the shop pages, but not on the about page. Put the shop pages in a `(shop)` group with a `layout.js` that renders the sidebar:

```text
app/
├── layout.js                  header, used everywhere
├── (shop)/
│   ├── layout.js              genre sidebar, shop pages only
│   ├── books/page.js          /books
│   └── cart/page.js           /cart
└── about/
    └── page.js                /about (no sidebar)
```

The URLs do not change at all. Only the layouts do. Book Nook does not need this yet, so the rest of the course keeps `app/books` and `app/cart` at the top level.

Groups can even hold **separate root layouts** with their own `<html>` and `<body>` tags, for example a shop and an admin area that look completely different. That is covered in [Templates and the Root Layout in Depth](/courses/nextjs/templates-and-root-layout).

### One more trick: a loading screen for just one page

Special files like `loading.js` apply to a folder **and everything below it**. Sometimes that is too much. If `app/books/loading.js` existed, it would also show for `/books/dune`. To limit it to the list page, move the list page and its loading file into a group:

```text
app/books/
├── (list)/
│   ├── page.js                /books
│   └── loading.js             only for /books
└── [id]/
    └── page.js                /books/dune (not affected)
```

You will meet `loading.js` properly in [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming).

## Private folders: files that are never routes

Inside `app`, a folder only becomes a public page when it contains a `page.js` (or a `route.js` for APIs). So you can already keep other files next to your pages. This is called **colocation**: keeping files close to the place that uses them.

```text
app/books/
├── page.js            /books (a route)
└── BookFilters.js     not a route, just a file sitting here
```

This works, but it is fragile. If someone later adds a file called `page.js`, `layout.js` or `loading.js` inside a helper folder, Next.js treats it as a special file. A **private folder** removes that risk. Start the folder name with an underscore, and Next.js ignores that folder and all of its subfolders when it builds routes:

```text
app/books/
├── page.js
├── _lib/
│   └── filters.js     never a route, whatever you put here
└── _components/
    └── GenreBadge.js  never a route
```

### Use a private folder in Book Nook

The filtering logic from [Reading Search Params from the URL](/courses/nextjs/search-params) only matters to the books page, so move it into a private `_lib` folder right next to it:

```javascript
// app/books/_lib/filters.js
// Returns only the books in one genre. No genre means "all books".
export function filterByGenre(books, genre) {
  if (!genre) {
    return books;
  }
  return books.filter((book) => book.genre === genre);
}
```

Then use it in the page:

```jsx
// app/books/page.js
import { getBooks } from '@/lib/books';
import { filterByGenre } from './_lib/filters';

async function BookList({ searchParams }) {
  const { genre } = await searchParams;
  const books = await getBooks();
  const shown = filterByGenre(books, genre);
  // ...render the list as before
}
```

Try visiting `http://localhost:3000/books/_lib/filters`. You get the 404 page. The folder is invisible to the router.

### Where should shared code live?

Book Nook already has a `components/` folder and a `lib/` folder at the project root, **outside** `app`. Those names mean nothing special to Next.js; they are just a tidy habit. A simple rule of thumb:

- Code used by **many** routes (the header, `BookCard`, `lib/books.js`) goes in the root `components/` and `lib/` folders.
- Code used by **one** route goes in a private folder next to that route, like `app/books/_lib/filters.js`.

Next.js does not force either style. Pick one and be consistent.

> **Tip:** Need a real URL that starts with an underscore, like `/_news`? Name the folder `%5Fnews`. `%5F` is the URL-encoded form of `_`, so Next.js treats it as a normal route.

## Common mistakes

### Two groups that resolve to the same URL

Route groups disappear from the URL, so these two files both claim `/about`:

```text
app/(marketing)/about/page.js
app/(shop)/about/page.js
```

The build stops with:

```text
Error: You cannot have two parallel pages that resolve to the same path. Please check /(marketing)/about and /(shop).
```

Every URL must come from exactly one `page.js`. Rename or move one of them.

### Putting the group name in links

`<Link href="/(auth)/login">` or `<Link href="/auth/login">` both lead to a 404. Groups are never part of the URL. Link to `/login`.

### Expecting a page inside a private folder to work

`app/_drafts/page.js` is never a route, because the underscore hides the whole folder. If you want a page, remove the underscore.

### Square or curly brackets instead of round ones

`[auth]` is a **dynamic segment** (it captures part of the URL into `params`), not a group. Only round brackets `(auth)` make a route group.

## Quick recap

- Folders in `app` normally become URL segments.
- A **route group** is a folder in round brackets, like `(auth)`. It is left out of the URL.
- Use groups to organise routes, to give a set of pages its own `layout.js`, or to limit special files like `loading.js` to some pages.
- Two pages in different groups must not resolve to the same URL.
- A **private folder** starts with an underscore, like `_lib`. Next.js never turns it, or anything inside it, into a route.
- Keep shared code in root `components/` and `lib/` folders, and code for one route in a private folder next to it.

<code id="code-content" class="language-jsx">
// app/(auth)/layout.js: a route group layout. "(auth)" never appears in the URL.
// Folder layout for this lesson:
//   app/(auth)/layout.js        wraps every page in the (auth) group
//   app/(auth)/login/page.js    URL: /login
//   app/books/_lib/filters.js   private folder: never a route
export default function AuthLayout({ children }) {
  return (
    &lt;main className="flex flex-1 items-center justify-center p-8"&gt;
      {/* A small centred card for login and sign-up pages */}
      &lt;div className="w-full max-w-sm rounded-lg border p-6 shadow-sm"&gt;
        {children}
      &lt;/div&gt;
    &lt;/main&gt;
  );
}
// --- next file: app/(auth)/login/page.js
// export default function LoginPage() {
//   return &lt;h1&gt;Log in to Book Nook&lt;/h1&gt;;
// }
// --- next file: app/books/_lib/filters.js
// export function filterByGenre(books, genre) {
//   if (!genre) return books;
//   return books.filter((book) =&gt; book.genre === genre);
// }
</code></pre>

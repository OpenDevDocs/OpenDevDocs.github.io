---
publishDate: 2026-10-25T13:00
title: "What is Next.js? React for Real Websites"
slug: what-is-nextjs
metadescription: "Learn what Next.js is, what it adds on top of React, how a Next.js page reaches the browser, and what you will build in this beginner course."
updateDate: 2026-10-25T13:00
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'react', 'introduction', 'app-router']
course: nextjs
---

## What you will learn

This lesson is the map before the journey. You will not write a full app yet. Instead you will learn:

- what React does on its own, and what it leaves for you to figure out
- what Next.js adds on top of React, and why people call it a **framework**
- how a Next.js page travels from your code to a visitor's browser
- the difference between the App Router and the Pages Router
- what Book Nook is, the small online bookshop you will build in this course

You only need to know basic HTML, CSS and JavaScript, and a little React (components, props and JSX). If you have written a component like the one below, you are ready:

```jsx
// A tiny React component
function Greeting({ name }) {
  return <h1>Hello, {name}!</h1>;
}
```

## React on its own

**React** is a JavaScript library for building user interfaces out of components. A **component** is a function that returns some UI, like the `Greeting` above. React is very good at one job: turning your data into HTML on the screen, and updating that HTML when the data changes.

But a real website needs much more than that. With plain React, you have to answer a lot of questions yourself:

- **Pages and URLs.** How does `/books` show the book list and `/cart` show the cart? React has no built-in answer. You need an extra routing library.
- **The first load.** A plain React app often sends an almost empty HTML file, then a big JavaScript file that builds the page in the browser. Visitors stare at a blank screen for a moment, and search engines may see nothing useful.
- **Data.** Where do you load your books from? Who keeps your database password safe, if all your code runs in the visitor's browser?
- **Tooling.** Something has to turn your JSX into normal JavaScript, bundle your files, shrink images and load fonts quickly.

Here is roughly what the browser receives from a plain, browser-only React app:

```html
<!-- What a browser-only React app often sends first -->
<!DOCTYPE html>
<html>
  <body>
    <div id="root"></div>
    <script src="/assets/index-3f2a.js"></script>
  </body>
</html>
```

The `<div id="root">` is empty. Nothing appears until the JavaScript has downloaded and run.

## What Next.js adds

**Next.js** is a **framework** built on top of React. A framework is a ready-made structure with rules and tools, so you can focus on your own app instead of the plumbing. You still write React components, but Next.js answers all the questions above for you.

Think of it like cooking. React gives you excellent ingredients and recipes. Next.js gives you the whole kitchen: the oven, the fridge, the shelves with labels, and a waiter who brings the food to the table.

Here is what comes in the box:

| Feature | What it means for you |
| --- | --- |
| File-based routing | Make a folder `app/books` with a `page.js` file inside, and you have a `/books` page. No router setup. |
| Server rendering | Pages are turned into HTML on the server, so visitors see content right away. |
| Server Components | Components can run only on the server, read files or a database, and send the result as HTML. |
| Data fetching and caching | Load data with plain `async`/`await`, and keep results fast with built-in caching. |
| Server Functions | Handle forms and button clicks with functions that run safely on the server. |
| Route Handlers | Build your own API endpoints, like `/api/books`, in the same project. |
| Images and fonts | `next/image` and `next/font` resize images and load fonts the fast way. |
| Turbopack | A very fast bundler that turns your code into files the browser can run. It is the default in Next.js 16. |

A **bundler** is a tool that collects all your files, converts JSX and modern JavaScript into code browsers understand, and packs it into a few small files.

## A first look at Next.js code

You will create a real project in [Creating Your First Next.js App](/courses/nextjs/create-your-first-app). For now, just look at how simple a page is. This file is the whole home page of a site:

```jsx
// app/page.js
export default function Home() {
  return (
    <main>
      <h1>Welcome to Book Nook</h1>
      <p>A small shop for big stories.</p>
    </main>
  );
}
```

That is a normal React component. The only Next.js part is **where the file lives**. Because it is called `page.js` and sits directly in the `app` folder, Next.js shows it at the address `/`.

Want an "about" page? Make a folder and another `page.js`:

```text
app/
├── page.js          shows at /
└── about/
    └── page.js      shows at /about
```

Folders become parts of the URL. You will learn the full rules in [How File-Based Routing Works](/courses/nextjs/file-based-routing).

Next.js can also load data right inside a component, because this component runs on the server:

```jsx
// app/books/page.js
import { getBooks } from '@/lib/books';

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <ul>
      {books.map((book) => (
        <li key={book.id}>{book.title}</li>
      ))}
    </ul>
  );
}
```

Notice the `async` and `await`. In plain browser React, a component cannot be `async`. In Next.js, a **Server Component** can. Do not worry about the details yet: [Server Components Explained](/courses/nextjs/server-components) covers them fully.

## How a page reaches the browser

Here is the journey when someone visits `https://booknook.example/books`:

1. The browser asks the server for `/books`.
2. Next.js finds `app/books/page.js` and runs the component on the server.
3. The server sends back **real HTML** with the book titles already inside it, so the page shows up immediately.
4. The browser then downloads a small amount of JavaScript for the parts of the page that need to be interactive, like an "Add to cart" button.
5. React attaches itself to that HTML and makes the buttons work. This step is called **hydration**: the "dry" HTML gets "watered" with JavaScript so it comes alive.

So instead of an empty `<div id="root">`, the browser gets something like this:

```html
<!-- What Next.js sends: the content is already there -->
<html lang="en">
  <body>
    <ul>
      <li>The Hobbit</li>
      <li>Pride and Prejudice</li>
      <li>Dune</li>
      <li>The Little Prince</li>
    </ul>
    <script src="/_next/static/chunks/..." async></script>
  </body>
</html>
```

This is good for three reasons:

- **Speed.** Visitors see content sooner, even on slow phones.
- **Search engines.** Google and friends can read your content without running JavaScript.
- **Safety.** Code that talks to your database stays on the server. Passwords and secret keys never reach the visitor.

Some pages can even be built **ahead of time**, when you build the site, and then served instantly to everyone. Next.js decides this for you, and you can control it. That is a big topic you will meet later in [Static and Dynamic Rendering](/courses/nextjs/static-and-dynamic-rendering).

## App Router and Pages Router

Next.js has two ways to organise pages:

- The **App Router** uses the `app` folder. It is the modern way, it supports Server Components, and it is what this whole course teaches.
- The **Pages Router** uses a `pages` folder. It is the older way. It still works, and you will find it in many existing projects and older tutorials.

```text
app/about/page.js      App Router: the course way
pages/about.js         Pages Router: the older way
```

If you ever need to read an older project, the lesson [Reading Older Projects: The Pages Router](/courses/nextjs/pages-router-basics) will help you.

## Which versions this course uses

Next.js changes quickly, and many tutorials online are out of date. This course is written for:

- **Next.js 16.4**
- **React 19.3**
- **Node.js 20.9 or newer**

A few things changed in Next.js 16 that trip up people who learned from older guides. You will meet each of them in its own lesson, but here is a quick heads-up:

```text
Old way (Next.js 13 to 15)          Next.js 16 way
-------------------------------     ----------------------------------
middleware.js                       proxy.js
const { id } = params               const { id } = await params
next lint                           eslint (run directly)
webpack by default                  Turbopack by default
```

The course project also switches on **Cache Components**, the new caching model of Next.js 16. You will learn what that means in [Caching with Cache Components and use cache](/courses/nextjs/use-cache).

## When to choose Next.js

Next.js is a great choice when you want:

- a website that loads fast and shows up well in search results, like a shop, a blog or a company site
- a web app with logins, forms and a database, without building a separate backend
- one project for both your pages and your API

It may be more than you need for a tiny widget inside another site, or for a page that has no server at all. Even then, Next.js can export plain HTML files, as you will see in [Static Exports for Any Web Host](/courses/nextjs/static-exports).

## What you will build: Book Nook

Throughout the course you will build **Book Nook**, a small online bookshop. Every lesson adds a piece. By the end it will have these pages:

```text
/               home page
/books          list of all books
/books/dune     one book's details (one page per book)
/cart           the shopping cart
/about          about the shop
/login          sign in
/admin          a protected page for the shop owner
/api/books      a small API that returns the books as JSON
```

Along the way you will learn routing, Server and Client Components, styling with Tailwind CSS, loading data, caching, forms, login and security, SEO, testing and deployment. The last lesson, [Final Project: The Book Nook Store](/courses/nextjs/final-project-book-nook), puts it all together.

## Common mistakes

### Thinking Next.js replaces React

Next.js does not replace React. Every page and component you write is still React. If you know React, that knowledge carries straight over. Next.js adds the structure around it.

### Following an old tutorial

If a tutorial tells you to create `pages/index.js`, use `getServerSideProps`, or write `middleware.js`, it is teaching an older version. Code like this will fail in a Next.js 16 project that uses the `app` folder:

```jsx
// Old Pages Router code: does not work inside the app folder
export async function getServerSideProps() {
  return { props: {} };
}
```

When in doubt, check the date of the tutorial and compare it with the official docs at [nextjs.org](https://nextjs.org/docs).

### Thinking all your code runs in the browser

In Next.js, components run on the **server** by default. That means things like `window`, `localStorage` and `onClick` handlers need a little extra step (a Client Component). You will learn exactly when and how in [Client Components and the use client Directive](/courses/nextjs/client-components).

### Thinking you must use Vercel

Vercel makes Next.js, and hosting there is easy, but you do not have to use it. You can run Next.js on your own server, in Docker, or as plain static files. See [Self-Hosting with Node.js and Docker](/courses/nextjs/self-hosting).

## Quick recap

- React builds user interfaces from components. Next.js is a framework that adds routing, server rendering, data loading, caching and tooling on top of React.
- Pages are files: `app/page.js` is `/`, and `app/about/page.js` is `/about`.
- Components run on the server by default, so the browser gets real HTML right away, and hydration makes it interactive.
- This course uses the App Router (`app` folder), Next.js 16.4, React 19.3 and Node.js 20.9 or newer.
- Next.js 16 changed some things: `proxy.js` instead of `middleware.js`, `await params`, Turbopack by default.
- You will build Book Nook, a small online bookshop, one lesson at a time.

<code id="code-content" class="language-jsx">
// app/page.js: a complete Next.js page is just a React component in the right place
// Because this file is app/page.js, Next.js shows it at the address "/"
export default function Home() {
  return (
    &lt;main&gt;
      &lt;h1&gt;Welcome to Book Nook&lt;/h1&gt;
      &lt;p&gt;A small shop for big stories.&lt;/p&gt;
    &lt;/main&gt;
  );
}
// --- next file: app/about/page.js (shows at "/about")
// export default function About() {
//   return &lt;h1&gt;About Book Nook&lt;/h1&gt;;
// }
// --- next file: app/books/page.js (a Server Component can be async and load data)
// import { getBooks } from '@/lib/books';
// export default async function BooksPage() {
//   const books = await getBooks();
//   return &lt;ul&gt;{books.map((book) =&gt; &lt;li key={book.id}&gt;{book.title}&lt;/li&gt;)}&lt;/ul&gt;;
// }
</code></pre>

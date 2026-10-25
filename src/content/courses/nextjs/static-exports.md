---
publishDate: 2026-10-25T14:00
title: Static Exports for Any Web Host
slug: static-exports
metadescription: Turn a Next.js 16 app into plain HTML, CSS and JS with output export, learn what stops working, and publish it to GitHub Pages with basePath.
updateDate: 2026-10-25T14:00
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'static-export', 'github-pages', 'hosting']
course: nextjs
---

## A website with no server at all

Everything Book Nook does so far needs a running Node.js server: reading cookies, saving reviews, logging in, refreshing cached data. But many websites do not need any of that. A portfolio, a documentation site, a small catalogue or a landing page only shows the same content to everyone.

For those, Next.js can do a **static export**: during `next build` it renders every page to plain HTML, CSS and JavaScript files and puts them in a folder called `out`. You can then upload that folder to **any** web host that serves files: GitHub Pages, an S3 bucket, a cheap shared host, or an nginx server. No Node.js required.

Think of it like printing a magazine. A server-rendered app is a journalist who writes a fresh answer for every reader. A static export prints all the pages once, and then anyone can hand out copies. You lose the journalist's ability to answer personal questions, but copies are cheap, fast and work everywhere.

In this lesson you will:

1. Turn on `output: 'export'` and see what comes out.
2. Learn which features stop working, and why.
3. Handle the Cache Components problem in our course project.
4. Publish a "Book Nook catalogue" to GitHub Pages with `basePath`.

## Step 1: what changes in a static export

Server Components still work. They simply run **once, during the build**, instead of on every request. So this page:

```jsx
// app/books/page.js
import Link from 'next/link';
import { getBooks } from '@/lib/books';

export default async function BooksPage() {
  const books = await getBooks(); // runs during next build
  return (
    <section>
      <h1 className="text-3xl font-bold">All books</h1>
      <ul className="mt-4 space-y-2">
        {books.map((book) => (
          <li key={book.id}>
            <Link href={`/books/${book.id}`} className="underline">{book.title}</Link> by {book.author}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

becomes a file `out/books.html` with the four books already written into the HTML. If a price changes later, the site does not know until you build and upload again.

Client Components work normally in the browser. Book Nook's `CartProvider` and `AddToCartButton` keep working, because their state lives in the browser anyway. Links between pages still feel instant, because Next.js also writes small data files for client-side navigation.

## Step 2: what does not work

Anything that needs a server **at request time** is not supported. The Next.js docs list these for the App Router:

- Dynamic routes with `dynamicParams: true`, or dynamic routes without `generateStaticParams()`.
- Route Handlers that read the `Request`.
- `cookies()` (so no login sessions).
- `rewrites`, `redirects` and `headers` in `next.config.mjs`.
- `proxy.js`.
- Incremental Static Regeneration (pages that refresh themselves).
- Image optimization with the default loader.
- Draft Mode.
- Server Actions (so no review form, no admin price form).
- Intercepting routes.

In Book Nook terms: the catalogue pages, about page and cart can be exported. Search with `searchParams`, reviews, login and the admin area cannot. If you try to use one of these features while `output: 'export'` is on, `next dev` shows an error, so you find out early.

## Step 3: the Cache Components problem

Here is something the docs do not spell out, which we found by building our course project. Book Nook was created with Cache Components on, and its `next.config.mjs` has `cacheComponents: true` and `partialPrefetching: true`. Add `output: 'export'` to that config and run `npm run build`. Pages are generated, and then the build stops:

```text
✓ Generating static pages using 8 workers (11/11) in 9.2s
  Finalizing page optimization ...

> Build error occurred
Error: Invariant: PPR cannot be enabled in export mode
```

Removing only `partialPrefetching` is not enough; the error stays. With Cache Components on, every page uses **Partial Prerendering** (PPR), which needs a server to stream in the dynamic parts, and an export has no server. In Next.js 16.4, a static export needs both flags **off**.

And once `cacheComponents` is off, `'use cache'` is no longer allowed either:

```text
Error: To use "use cache", please enable the feature flag `cacheComponents` in your Next.js config.
    Read more: https://nextjs.org/docs/app/api-reference/directives/use-cache#usage
./lib/books.js:19:3
```

So the honest answer is: a static export is a **different flavour** of the project. The cleanest way to try it is a copy of Book Nook (or a new `create-next-app` project answering **No** to Cache Components) with:

- A `next.config.mjs` without `cacheComponents` and `partialPrefetching`.
- A `lib/books.js` without `'use cache'`, `cacheLife` and `cacheTag`. Caching is pointless anyway: everything is read exactly once, at build time.

The data can still come from your Postgres database. `next build` runs on your computer (or in CI), where `DATABASE_URL` is set, and the results are frozen into HTML. Or use the simple array version of `lib/books.js` from [Dynamic Routes and params](/courses/nextjs/dynamic-routes):

```javascript
// lib/books.js (static catalogue version: no 'use cache')
import 'server-only';
import { db } from './db';

export async function getBooks() {
  return db.query('SELECT * FROM books ORDER BY title');
}

export async function getBook(id) {
  const rows = await db.query('SELECT * FROM books WHERE id = $1', [id]);
  return rows[0] ?? null;
}
```

## Step 4: turn on the export

Here is the config for the static catalogue:

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',

  // GitHub Pages serves the site at /book-nook, not at /
  basePath: '/book-nook',

  // There is no server to resize images, so serve them as they are
  images: { unoptimized: true },

  turbopack: {
    rules: {
      "*.css": {
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

Three new settings:

- **`output: 'export'`** tells `next build` to write a static site into `out/`.
- **`basePath`** is a prefix for every URL. On GitHub Pages, a project site lives at `https://your-username.github.io/book-nook/`, so all paths must start with `/book-nook`. `<Link href="/books">` becomes `/book-nook/books` automatically. You only need it when the site does not live at the root of a domain; leave it out for `https://booknook.example.com`.
- **`images: { unoptimized: true }`** turns off image optimization for every `<Image>`. The default image optimizer resizes images on request, and there is no server to do that. Do not skip it: without it the build still succeeds, but the images point at an optimizer that does not exist. Your images still get `width`, `height` and lazy loading; they are just served as they are. (Another option is a custom `loader` that points at an image service. See [Optimizing Images with next/image](/courses/nextjs/optimizing-images).)

The book page needs `generateStaticParams`, so the build knows every id (see [Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params)):

```jsx
// app/books/[id]/page.js
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books';

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  if (!book) notFound();

  return (
    <section>
      <h1 className="text-3xl font-bold">{book.title}</h1>
      <p className="text-zinc-600">by {book.author}</p>
      <p className="mt-4">{book.description}</p>
    </section>
  );
}
```

A book that is added to the database after the build has no page until you build again. Visitors who type an unknown id get the `404.html` page.

### A static JSON file from a Route Handler

Route Handlers can be exported too, if they only answer `GET` and do not read the request. You must mark them static. This is allowed again, because Cache Components is off:

```javascript
// app/books.json/route.js
import { getBooks } from '@/lib/books';

export const dynamic = 'force-static';

export async function GET() {
  const books = await getBooks();
  return Response.json(books);
}
```

The folder name `books.json` becomes the file name, so the export contains `out/books.json`. Without the `dynamic` line, the build stops with ``Error: export const dynamic = "force-static"/export const revalidate not configured on route "/books.json" with "output: export".`` (In a Cache Components project you would see the opposite error: `Route segment config "dynamic" is not compatible with nextConfig.cacheComponents`.)

## Step 5: build and look inside

```bash
npm run build
```

```text
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ○ /books
├ ○ /books.json
└   /books/[id]
  ├ ● /books/the-hobbit
  ├ ● /books/pride-and-prejudice
  ├ ● /books/dune
  └ ● /books/the-little-prince


○  (Static)  prerendered as static content
●  (SSG)     prerendered as static HTML (uses generateStaticParams)
```

This is the route table of a project **without** Cache Components, so you see the `●` (SSG) symbol for pages made from `generateStaticParams`. Every route is `○` or `●`: nothing is left for a server. The `out` folder looks like this:

```text
out/
├── index.html
├── about.html
├── books.html
├── books.json
├── books/
│   ├── dune.html
│   ├── pride-and-prejudice.html
│   ├── the-hobbit.html
│   └── the-little-prince.html
├── 404.html
├── _next/            JavaScript, CSS and fonts
└── ...               public/ files and small .txt data files for navigation
```

Open `out/index.html` in an editor and you will see every link and script starts with `/book-nook/`, thanks to `basePath`.

To preview it, serve the folder with any static file server. Because of `basePath`, the files must appear under `/book-nook`, so the simplest check is to temporarily remove `basePath`, rebuild, and run:

```bash
npx serve out
```

Do not double-click `index.html` to open it from disk: the absolute paths like `/_next/...` only work through a web server.

## Step 6: publish to GitHub Pages

GitHub Pages hosts static files for free from a repository. The modern way is a **GitHub Actions workflow**: a small YAML file that tells GitHub to build your site on every push and publish the `out` folder.

First, one extra file. GitHub Pages runs a tool called Jekyll by default, which ignores folders starting with `_`, like `_next`. An empty file named `.nojekyll` turns that off. Put it in `public/`, so it is copied into `out`:

```bash
# macOS and Linux
touch public/.nojekyll
```

On Windows, create an empty file named `.nojekyll` in the `public` folder from VS Code.

Then add the workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - uses: actions/upload-pages-artifact@v5
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

What it does: on every push to `main`, it checks out your code, installs Node.js and your packages, runs `next build` (which writes `out/`), uploads `out` as the site, and publishes it. If your `lib/books.js` reads Postgres, add `DATABASE_URL` under your repository's **Settings**, **Secrets and variables**, **Actions**. If it uses the array version, delete the `env` lines.

Finally, in the repository go to **Settings**, then **Pages**, and set **Source** to **GitHub Actions**. Push, wait for the green tick in the **Actions** tab, and your catalogue is live at `https://your-username.github.io/book-nook/`. The action versions shown were current when this was written; GitHub's own Pages docs list the latest ones. The Next.js team also keeps a GitHub Pages template you can compare with.

## Hosting on other servers

The `out` folder works on any host that serves files. On nginx, for example, you can make `/books/dune` find `books/dune.html`:

```text
# nginx: part of a server block
root /var/www/book-nook/out;

location / {
  try_files $uri $uri.html $uri/ =404;
}

error_page 404 /404.html;
```

If you prefer `books/dune/index.html` style folders (some hosts need that), add `trailingSlash: true` to `next.config.mjs`. Links then end in `/`, like `/books/dune/`.

## Common mistakes

### Leaving Cache Components on

```text
Error: Invariant: PPR cannot be enabled in export mode
```

Remove `cacheComponents` and `partialPrefetching` from the config, and remove `'use cache'`, `cacheLife` and `cacheTag` from your code.

### The site has no styles on GitHub Pages

The HTML loads but CSS and JavaScript return 404. Either `basePath` does not match the repository name (it is case-sensitive), or `_next` is being hidden by Jekyll because `.nojekyll` is missing.

### Images are broken

Two different causes, and the build does not warn you about either:

- **You forgot `images: { unoptimized: true }`.** In our test with Next.js 16.4, the export still built, but every `<Image>` of a JPG or PNG pointed at `/_next/image?url=...`, the address of the image optimizer. A static host has no optimizer, so those images 404. (SVG files are served as they are, so they hide the problem.)
- **The path is missing `basePath`.** With `unoptimized`, `<Image src="/covers/dune.jpg">` is written exactly as `src="/covers/dune.jpg"`, without `/book-nook` in front. As the `basePath` docs say, add the prefix yourself: `src="/book-nook/covers/dune.jpg"`. A small helper or an environment variable keeps that in one place.

### Expecting new data without a rebuild

A static export is frozen at build time. After you change data, run the build again (with the workflow above, just push a commit, or click **Re-run** on the last workflow run).

### Using a server feature by accident

A Server Action, `cookies()` or `proxy.js` makes `next dev` complain and the export fail. Move that feature to a server-hosted version of the app ([Deploying to Vercel](/courses/nextjs/deploying-to-vercel) or [Self-Hosting with Node.js and Docker](/courses/nextjs/self-hosting)), or replace it with client-side code.

## Quick recap

- `output: 'export'` makes `next build` write a plain static site to `out/` that any file host can serve.
- Server Components run once at build time; Client Components work as usual in the browser.
- Server Actions, cookies, `proxy.js`, rewrites, redirects, ISR and default image optimization are not available.
- In Next.js 16.4, a static export needs `cacheComponents` and `partialPrefetching` turned off, and no `'use cache'` in the code.
- Dynamic routes need `generateStaticParams`; static Route Handlers need `export const dynamic = 'force-static'`.
- For GitHub Pages, set `basePath` to the repository name, use `images: { unoptimized: true }`, add `public/.nojekyll`, and deploy `out` with a GitHub Actions workflow.

<code id="code-content" class="language-javascript">
// next.config.mjs: a static export for GitHub Pages
// (Cache Components and Partial Prefetching must be OFF for output: 'export')
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Write plain HTML, CSS and JS into the "out" folder during next build
  output: 'export',
  // The site lives at https://your-username.github.io/book-nook/
  basePath: '/book-nook',
  // No server means no image optimizer: serve images as they are
  images: { unoptimized: true },
  // Optional: write books/dune/index.html instead of books/dune.html
  // trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};
export default nextConfig;
// --- next file: app/books.json/route.js (exported as out/books.json)
// import { getBooks } from '@/lib/books';
// export const dynamic = 'force-static';
// export async function GET() {
//   return Response.json(await getBooks());
// }
// --- next file: app/books/[id]/page.js needs generateStaticParams
// export async function generateStaticParams() {
//   const books = await getBooks();
//   return books.map((book) =&gt; ({ id: book.id }));
// }
</code></pre>

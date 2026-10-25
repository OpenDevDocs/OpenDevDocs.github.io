---
publishDate: 2026-10-25T13:57
title: Building for Production
slug: building-for-production
metadescription: Run next build, read the route table and its symbols with Cache Components, fix prerender errors, start the app with next start and analyze bundles.
updateDate: 2026-10-25T13:57
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'build', 'production', 'bundle-analyzer']
course: nextjs
---

## Development mode is not the real thing

Every time you ran `npm run dev`, Next.js gave you a **development build**: fast to start, full of helpful checks, with Fast Refresh and the error overlay. It is like a kitchen during cooking practice: pots everywhere, the chef tasting every spoonful.

Visitors need the restaurant on opening night: everything prepared, plated and fast. That is a **production build**. In this lesson you will:

1. Run `next build` on Book Nook and read what it prints.
2. Understand the route symbols `○`, `◐` and `ƒ` in a Cache Components project.
3. Fix a build error that only appears when prerendering.
4. Run the finished build with `next start`.
5. Look inside your JavaScript bundles with the Bundle Analyzer.

## The app we will build

The output below comes from a real build of Book Nook with Next.js 16.4.3. The app has these files (you made most of them in earlier lessons):

```text
book-nook/
├── app/
│   ├── layout.js
│   ├── page.js                  /
│   ├── about/page.js            /about
│   ├── api/books/route.js       /api/books
│   └── books/
│       ├── page.js              /books
│       └── [id]/
│           ├── loading.js
│           └── page.js          /books/the-hobbit, /books/dune, ...
├── lib/books.js
└── next.config.mjs              cacheComponents: true, partialPrefetching: true
```

To keep the first route table easy to read, this build uses the simple array version of `lib/books.js` from [Dynamic Routes and params](/courses/nextjs/dynamic-routes), with no database and no `'use cache'`. You will see what caching adds to the table a little later.

The book page uses `generateStaticParams` (from [Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params)) so Next.js knows the four book ids at build time:

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

And a tiny Route Handler returns the books as JSON (see [Building APIs with Route Handlers](/courses/nextjs/route-handlers)):

```javascript
// app/api/books/route.js
import { getBooks } from '@/lib/books';

export async function GET() {
  const books = await getBooks();
  return Response.json(books);
}
```

## Step 1: run the build

Stop the dev server if it is running (Ctrl + C), then:

```bash
npm run build
```

This runs `next build`. Here is the real output:

```text
▲ Next.js 16.4.3 (Turbopack)
✓ Running next.config.mjs took 158ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 15.6s
  Running TypeScript ...
  Finished TypeScript in 129ms ...
  Collecting page data using 9 workers ...
✓ Generating static pages using 9 workers (12/12) in 1698ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ○ /api/books
├ ○ /books
└   /books/[id]
  ├ ◐ /books/[id]
  ├ ○ /books/the-hobbit
  ├ ○ /books/pride-and-prejudice
  └ ◐ [+2 more paths]


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
```

What happened, step by step:

1. **Setup:** Next.js read `next.config.mjs` and any `.env` files. It confirms that Cache Components and Partial Prefetching are on.
2. **Compile:** **Turbopack**, the default bundler since Next.js 16, turned your JSX into optimized JavaScript and CSS. It also removed code nothing uses (this is called **tree-shaking**) and minified everything.
3. **TypeScript check:** even in a JavaScript project this step runs, and finishes almost instantly.
4. **Generate static pages:** Next.js rendered every page it could ahead of time and saved the HTML. This is **prerendering**.
5. **Route table:** a summary of how each route will be served.

There is no lint step. Since Next.js 16, `next build` no longer runs ESLint. Run `npm run lint` yourself (or in CI) before you build.

## Step 2: read the route table

With Cache Components on, every page uses **Partial Prerendering**, and the symbol tells you how much HTML the build could produce:

| Symbol | Name | What it means |
| --- | --- | --- |
| `○` | Static | The whole page was prerendered to HTML. Visitors get a ready-made file. |
| `◐` | Partial Prerender | A static HTML **shell** was prerendered, and the rest streams in on each request. |
| `ƒ` | Dynamic | Nothing useful could be prerendered. The route is rendered on each request. |

Now read Book Nook's table with that in mind:

- `/`, `/about` and `/books` are `○`: they only read data that is ready at build time.
- `/api/books` is `○` too. A `GET` handler that does not read the request is prerendered into a static response.
- `/books/[id]` with no symbol is a **group row**. The indented rows under it are its outputs.
- `/books/the-hobbit` and `/books/pride-and-prejudice` are `○`: they were in `generateStaticParams`, so they are complete HTML files.
- The indented `◐ /books/[id]` row is the **fallback** for ids that were not known at build time. Its shell is the `loading.js` UI, and the real page streams in when someone asks for it.
- `[+2 more paths]` means the table was shortened. The other two books were built as well.

If you see `●` (SSG) in a tutorial, that comes from projects without Cache Components, where it marks pages made from `generateStaticParams`. In our project you will see `○`, `◐` and `ƒ`.

### The Revalidate and Expire columns

When a route uses `'use cache'`, two extra columns appear. In the [Final Project: The Book Nook Store](/courses/nextjs/final-project-book-nook), `getBooks()` is cached with `cacheLife('hours')` and `getBook(id)` with `cacheLife('days')`, and the build prints:

```text
Route (app)                       Revalidate  Expire
┌ ○ /                                     1h      1d
├ ○ /_not-found
├ ○ /about
├ ◐ /admin
├ ○ /api/books                            1h      1d
├ ◐ /books
├   /books/[id]
│ ├ ◐ /books/[id]
│ ├ ○ /books/dune                         1d      1w
│ ├ ○ /books/pride-and-prejudice          1d      1w
│ └ ◐ [+2 more paths]
...
```

**Revalidate** is how long a prerendered page is served before Next.js refreshes it in the background, and **Expire** is the longest it may be kept at all. They come from the `cacheLife` profiles: `'hours'` gives `1h` and `1d`, `'days'` gives `1d` and `1w`. Without a `cacheLife` call, the `default` profile gives `15m` and `1y`. [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation) shows how to choose. Notice that `/admin` and `/books` are `◐`: they read cookies and `searchParams` inside a `<Suspense>` boundary, so only their shell is static.

## Step 3: when the build fails while prerendering

The build is stricter than `next dev`. With Cache Components, it checks that every page can produce a static shell. If you read request data outside `<Suspense>`, it stops. For example, imagine a `/books` page that reads `searchParams` at the top level, with no boundary:

```jsx
// app/books/page.js (broken on purpose)
export default async function BooksPage({ searchParams }) {
  const { q = '' } = await searchParams;
  // ...
}
```

The build fails with an error like this:

```text
Error: Route "/books": Next.js encountered uncached or runtime data during prerendering.

`fetch(...)`, `cookies()`, `headers()`, `params`, `searchParams`, or `connection()` accessed outside of `<Suspense>` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] For uncached data (`fetch`, database calls): cache the access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route
```

The message lists the three fixes you already know from [Partial Prerendering: Static Shells with Dynamic Parts](/courses/nextjs/partial-prerendering): **stream** it behind `<Suspense>` (usually the best), **cache** it with `'use cache'`, or **block** with `export const instant = false`.

If the stack trace only points at `body` and `html`, ask for more detail, and only build the route you are fixing:

```bash
npx next build --debug-prerender --debug-build-paths="app/books/page.js"
```

`--debug-prerender` keeps the server code readable and adds source maps, so the error points to your own line. `--debug-build-paths` builds just the matching routes, which is much faster in a big app. Never deploy a build made with `--debug-prerender`.

> **Good to know:** `next dev` shows the same validation errors in the overlay and terminal while you work, and reruns them as you edit. Fixing them in development saves you a failed build later.

## Step 4: what is inside .next

The build writes everything to the `.next` folder:

```text
.next/
├── BUILD_ID            a unique id for this build
├── server/             server code and prerendered HTML
├── static/             JavaScript, CSS and fonts for the browser (file names contain a hash)
├── cache/              build caches that make the next build faster
└── ...                 manifests that describe routes, prerenders and more
```

The development server writes to `.next/dev` instead, so `next dev` and `next build` no longer overwrite each other. Never edit anything in `.next`, and never commit it to Git (the `.gitignore` from `create-next-app` already ignores it).

## Step 5: run the production server

```bash
npm run start
```

This runs `next start`, which serves the build you just made:

```text
▲ Next.js 16.4.3
- Local:         http://localhost:3000
- Network:       http://192.168.56.1:3000
✓ Ready in 530ms
```

Open `http://localhost:3000/books/dune`. It feels instant, because the HTML was made during the build. You can see this in the response headers. In a second terminal:

```bash
curl -I http://localhost:3000/books/dune
```

```text
HTTP/1.1 200 OK
x-nextjs-cache: HIT
x-nextjs-prerender: 1
x-nextjs-stale-time: 300
X-Powered-By: Next.js
Cache-Control: s-maxage=31536000
```

`x-nextjs-cache: HIT` means the page came straight from the prerendered cache.

Some things to remember about `next start`:

- It never rebuilds. After you change code, run `npm run build` again, then `npm run start`.
- Change the port with `npm run start -- -p 4000` (or set the `PORT` environment variable).
- Environment variables that start with `NEXT_PUBLIC_` are baked into the browser JavaScript **during the build**. Changing them later needs a new build. Server-only variables are read when the server runs. See [Environment Variables](/courses/nextjs/environment-variables).
- Server logs (`console.log` in Server Components and Actions) now appear in this terminal, as you saw in [Debugging Next.js Apps](/courses/nextjs/debugging).

## Step 6: look inside your bundles

Every Client Component adds JavaScript that visitors must download. The **Bundle Analyzer**, built into Next.js since version 16.1 for Turbopack, shows exactly what is in that JavaScript and why.

```bash
npx next analyze
```

This analyzes a production build (it does not replace `next build`) and opens an interactive page in your browser, on port 4000 by default. In it you can:

- Filter by route, and switch between **client** and **server** code.
- See every module as a rectangle. Bigger rectangle, bigger file.
- Click a module to see its **import chain**: which of your files pulled it in.

To save the results instead of opening a server (for example, to compare before and after a change), use `--output`:

```bash
npx next analyze --output
```

```text
✓ Analyze completed in 4.8s. Results written to C:\Users\asha\book-nook\.next\diagnostics\analyze.
To explore the analyze results interactively, run `next analyze` without `--output`.
```

Copy that folder somewhere safe before you rebuild if you want to compare later.

When you find something big in the client bundle, the usual fixes are:

- **Move work to the server.** If a Client Component only uses a heavy library to produce HTML (formatting, Markdown, syntax highlighting), do it in a Server Component and send the result.
- **Load it later** with `next/dynamic`, as in [Lazy Loading with next/dynamic](/courses/nextjs/lazy-loading).
- **Push `'use client'` down** to the smallest component that really needs it, as in [Mixing Server and Client Components](/courses/nextjs/server-client-boundary).

> **Good to know:** The older `@next/bundle-analyzer` plugin only works with webpack builds (`next build --webpack`). With the default Turbopack, use `next analyze`.

## A short pre-launch checklist

Before you ship, run through this list:

1. `npm run lint` passes.
2. Your tests pass ([Unit Testing with Vitest](/courses/nextjs/testing-with-vitest) and [End-to-End Testing with Playwright](/courses/nextjs/testing-with-playwright)).
3. `npm run build` finishes with no errors, and the route table looks the way you expect: pages you think are static really show `○` or `◐`.
4. `npm run start` works, and you clicked through the main pages.
5. Every environment variable the app needs is set on the server you deploy to.

## Common mistakes

### Running `next start` before building

```text
Error: Could not find a production build in the '.next' directory. Try building your app with 'next build' before starting the production server. https://nextjs.org/docs/messages/production-start-no-build-id
```

Run `npm run build` first. Watch out: the server still prints `Ready` before this error appears, so read the whole terminal.

### Expecting code changes to appear in `next start`

The production server serves a frozen snapshot. Stop it, rebuild, start again.

### Deploying a `--debug-prerender` build

That flag turns off minification and adds source maps, so the app is bigger and slower. Use it only to find an error, then build normally.

### Thinking `ƒ` means something is broken

`ƒ` only means the build could not prerender any HTML for that route, so it renders on each request. That is right for a page that is truly personal. If you expected a shell, look for request data (`cookies()`, `searchParams`) read outside `<Suspense>` and move it inside a boundary.

## Quick recap

- `npm run build` runs `next build`: it compiles with Turbopack, prerenders pages, and prints a route table. It no longer runs ESLint.
- With Cache Components, `○` is fully static, `◐` is a static shell plus streamed parts, and `ƒ` renders on each request.
- `Revalidate` and `Expire` columns appear for routes that use `'use cache'`.
- Fix prerender errors by streaming, caching or blocking, and use `--debug-prerender` and `--debug-build-paths` to find them.
- `npm run start` serves the build; rebuild after every change.
- `npx next analyze` shows what is inside your bundles and why.

<code id="code-content" class="language-bash">
# The production workflow for Book Nook
# 1. Check the code
npm run lint
npm test
# 2. Build: compile with Turbopack, prerender pages, print the route table
npm run build
# 3. Hunt down a prerender error in one route, with readable stack traces
#    (never deploy this build)
npx next build --debug-prerender --debug-build-paths="app/books/page.js"
# 4. Serve the finished build (default port 3000)
npm run start
# ...or on another port
npm run start -- -p 4000
# 5. Check that a page came from the prerendered cache
curl -I http://localhost:3000/books/dune
# 6. Explore the bundles in your browser (port 4000)
npx next analyze
# ...or save the analysis to .next/diagnostics/analyze
npx next analyze --output
</code></pre>

---
publishDate: 2026-10-25T13:51
title: Writing Pages with MDX
slug: mdx
metadescription: Write Book Nook pages and news posts in MDX with @next/mdx, the required mdx-components.js file, pageExtensions and Turbopack-friendly remark plugins.
updateDate: 2026-10-25T13:51
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'mdx', 'markdown', 'content']
course: nextjs
---

## Why write pages in MDX

Some pages are mostly words: an About page, shipping information, a news post about the summer sale. Writing those in JSX is clumsy. Every paragraph needs a `<p>`, every bold word a `<strong>`, and one missing `</p>` breaks the page.

**Markdown** is a simple way to write formatted text with plain characters:

```markdown
We are a **tiny** bookshop. Read the [Next.js docs](https://nextjs.org).
```

becomes

```html
<p>We are a <strong>tiny</strong> bookshop. Read the <a href="https://nextjs.org">Next.js docs</a>.</p>
```

**MDX** is Markdown that can also contain JSX. You write normal Markdown, and when you need something interactive or data-driven, you drop a React component right into the text. It is like a word processor document where some paragraphs are live widgets.

In this lesson you will:

- set up `@next/mdx` with the required `mdx-components.js` file
- turn the Book Nook About page into `page.mdx`
- import MDX files as components to build a small news section
- style the output and add Markdown plugins that work with Turbopack

## Step 1: install the packages

In the Book Nook folder, run:

```bash
npm install @next/mdx @mdx-js/loader @mdx-js/react @types/mdx
```

- `@next/mdx` connects MDX to Next.js.
- `@mdx-js/loader` and `@mdx-js/react` do the actual compiling of MDX into React components.
- `@types/mdx` gives editors type information about `.mdx` imports (useful even in a JavaScript project, because VS Code uses it for suggestions).

## Step 2: update next.config.mjs

Here is Book Nook's config so far: what create-next-app made, plus the `condition` that keeps Tailwind away from CSS Modules (from [Global CSS and CSS Modules](/courses/nextjs/global-css-and-css-modules)):

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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

Wrap it with the MDX plugin and add `pageExtensions`:

```javascript
// next.config.mjs
import createMDX from '@next/mdx';

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Let page.mdx files act as pages, next to the usual ones
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
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

const withMDX = createMDX({
  // Markdown plugins go here (Step 7)
});

export default withMDX(nextConfig);
```

Two changes:

- **`pageExtensions`** is the list of file endings Next.js treats as routes. By default it does not include `mdx`, so `app/about/page.mdx` would be ignored. Keep `js` and `jsx` in the list, or your existing pages stop working!
- **`createMDX()`** returns a function, `withMDX`, that adds MDX support to your config. Your own settings (Cache Components, the Tailwind rule and its `condition`) are kept, and CSS Modules keep working.

Restart `npm run dev` after changing `next.config.mjs`. The config is only read at start-up.

## Step 3: create mdx-components.js (required)

Create `mdx-components.js` in the **project root**, next to `app` and `package.json` (not inside `app`):

```jsx
// mdx-components.js
const components = {};

export function useMDXComponents() {
  return components;
}
```

This file is **required**. `@next/mdx` with the App Router does not work without it. It must export a function named `useMDXComponents` that takes no arguments and returns an object. For now the object is empty; in Step 6 you will use it to style every MDX page at once.

If you forget it, the error is confusing, so remember what it looks like:

```text
TypeError: b.default.createContext is not a function
      at module evaluation (content\welcome.mdx.tsx:2:1)
  > 2 | import {useMDXComponents as _provideComponents} from "next-mdx-import-source-file";
```

The words `useMDXComponents` and `next-mdx-import-source-file` are the clue: Next.js could not find your `mdx-components.js`.

## Step 4: an About page written in MDX

Delete `app/about/page.js` (a folder cannot have two `page` files) and create `app/about/page.mdx`:

```mdx
import BookCount from '@/components/BookCount'

export const metadata = {
  title: 'About us',
}

# About Book Nook

Book Nook started as a **single shelf** in a corner cafe. Today we ship
hand-picked books to readers everywhere.

## What we believe

- Every reader deserves a good recommendation.
- Small shops can still be quick and friendly.
- A book is a gift, so we wrap it like one.

Browse the **Books** page, or come and say hello.

<BookCount />
```

Visit `/about`. The Markdown became headings, a list and bold text, and the tab title is **About us | Book Nook**. Three things in this file are not plain Markdown:

- `import BookCount from ...` brings in a component, just like in a `.js` file.
- `export const metadata = ...` works exactly as in a normal page, because `page.mdx` *is* a normal page. See [Page Titles, Descriptions and Metadata](/courses/nextjs/metadata).
- `<BookCount />` renders the component in the middle of the text.

`BookCount` can even be an `async` Server Component that reads data, because MDX pages are Server Components by default:

```jsx
// components/BookCount.js
import { getBooks } from '@/lib/books';

export default async function BookCount() {
  const books = await getBooks();
  return <p className="mt-4 font-semibold">We currently stock {books.length} books.</p>;
}
```

The page shows "We currently stock 4 books." and the number updates when you add books. Interactive Client Components (with `'use client'`) work in MDX too.

> **Note:** MDX is stricter than plain Markdown in a few places, because it is also JSX. A `<` or `{` in normal text is read as the start of JSX or an expression. Write `&lt;` or put the character in backticks, like `` `{` ``.

## Step 5: import MDX files as components

A `page.mdx` is great for one page. For a news section with many posts, it is tidier to keep the posts in their own folder and have one page that shows any of them. An imported `.mdx` file is simply a React component.

Put posts in a `content` folder at the project root:

```text
book-nook/
├── app/
├── content/
│   ├── welcome.mdx
│   └── summer-sale.mdx
└── mdx-components.js
```

```mdx
export const metadata = {
  title: 'Summer sale',
  date: '2026-07-01',
}

# Summer sale

Every **classic** is half price this week. Perfect for the beach.
```

That is `content/summer-sale.mdx`. Now one dynamic route shows any post:

```jsx
// app/news/[slug]/page.js
import { notFound } from 'next/navigation';

const posts = ['welcome', 'summer-sale'];

export function generateStaticParams() {
  return posts.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  if (!posts.includes(slug)) return {};
  const { metadata } = await import(`@/content/${slug}.mdx`);
  return { title: metadata?.title ?? slug };
}

export default async function NewsPost({ params }) {
  const { slug } = await params;
  if (!posts.includes(slug)) notFound();

  const { default: Post } = await import(`@/content/${slug}.mdx`);

  return (
    <article className="p-8">
      <Post />
    </article>
  );
}
```

- `await import(...)` loads the MDX file. Its **default export** is the content as a component (here called `Post`), and any other exports, like `metadata`, come along too.
- Keep the `.mdx` extension in the import path. The `@/content/` start is fixed text, so the bundler knows which folder to include.
- `generateStaticParams` prerenders every post at build time. The build output shows `○ /news/welcome` and `○ /news/summer-sale`.
- The `posts.includes(slug)` check turns unknown slugs like `/news/nope` into the not-found page instead of a crash.

Older tutorials (and the MDX guide) add `export const dynamicParams = false` here. **Do not** do that in Book Nook: with Cache Components on, it fails the build with "Route segment config "dynamicParams" is not compatible with `nextConfig.cacheComponents`". The `includes` check does the same job.

To import one file into a normal page, you do not even need `await`:

```jsx
// app/page.js
import Welcome from '@/content/welcome.mdx';

export default function HomePage() {
  return (
    <main className="p-8">
      <Welcome />
    </main>
  );
}
```

> **Good to know:** `@next/mdx` does not read YAML **frontmatter** (the `---` block at the top of many Markdown files). Use `export const metadata = { ... }` as shown, or add a plugin like `remark-frontmatter` if you have existing files to support.

## Step 6: style every MDX page

Markdown produces plain HTML elements: `h1`, `h2`, `p`, `ul`, `a`. Tailwind removes the browser's default styles from those elements, so your About page looks rather flat. You have two good options.

### Option A: map elements to your own components

This is what `mdx-components.js` is for. Every key replaces an HTML element in **all** MDX content:

```jsx
// mdx-components.js
import Link from 'next/link';

const components = {
  h1: ({ children }) => <h1 className="mb-4 text-3xl font-bold text-amber-900">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-8 mb-2 text-2xl font-semibold">{children}</h2>,
  p: ({ children }) => <p className="mb-4 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-6">{children}</ul>,
  a: ({ href, children }) => (
    <Link href={href} className="text-amber-800 underline">
      {children}
    </Link>
  ),
};

export function useMDXComponents() {
  return components;
}
```

Now every `# Heading` uses your style, and every Markdown link uses `next/link` for fast client-side navigation.

To change styles for a single file only, pass a `components` prop when you render an imported MDX file. These override the global ones:

```jsx
// app/news/[slug]/page.js (inside the returned JSX)
<Post components={{ h1: ({ children }) => <h1 className="text-5xl">{children}</h1> }} />
```

### Option B: Tailwind's typography plugin

The `@tailwindcss/typography` plugin adds a `prose` class that styles all the HTML inside it nicely. Install it:

```bash
npm install @tailwindcss/typography
```

Turn it on in your CSS:

```css
/* app/globals.css */
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

Then wrap the MDX pages in a layout with `prose`:

```jsx
// app/about/layout.js
export default function AboutLayout({ children }) {
  return <article className="prose prose-stone mx-auto p-8">{children}</article>;
}
```

A `layout.js` next to a `page.mdx` works just like for any other page. See [Styling with Tailwind CSS](/courses/nextjs/tailwind-css) for more about Tailwind.

## Step 7: Markdown plugins with Turbopack

MDX can be extended with **remark** plugins (which change the Markdown) and **rehype** plugins (which change the resulting HTML). A popular one is `remark-gfm`, which adds GitHub-style tables, task lists and strikethrough.

```bash
npm install remark-gfm
```

Turbopack, the default bundler in Next.js 16, is written in Rust, and it cannot receive JavaScript functions from your config. So with Turbopack you name plugins as **strings**, not imports:

```javascript
// next.config.mjs
const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [],
  },
});
```

A plugin with options is written as a pair of the name and an options object, for example `['remark-toc', { heading: 'Contents' }]`. Options must be plain data (strings, numbers, booleans, objects). A plugin that needs a function in its options cannot be used with Turbopack yet.

Now this works in any MDX file:

```mdx
| Book | Price |
| ---- | ----- |
| Dune | 14.50 |

- [x] Order wrapping paper
- [ ] Restock The Hobbit
```

## Common mistakes

### The .mdx page gives a 404

Check `pageExtensions` in `next.config.mjs` includes `'mdx'`, and restart the dev server after editing the config.

### Every other page suddenly 404s

You wrote `pageExtensions: ['md', 'mdx']`. That replaces the default list, so `.js` pages stop being routes. Keep `'js'` and `'jsx'` in it.

### "createContext is not a function" when rendering MDX

`mdx-components.js` is missing or in the wrong folder. It belongs in the project root (or in `src/` if you use a `src` folder), not inside `app`, and must export `useMDXComponents`.

### Passing a plugin as an import

```javascript
import remarkGfm from 'remark-gfm';
// remarkPlugins: [remarkGfm]   does not work with Turbopack
```

Use the plugin's package name as a string: `remarkPlugins: ['remark-gfm']`.

### Curly braces or angle brackets break the page

MDX reads `{` and `<` as code. Escape them or put them in backticks.

## Quick recap

- MDX is Markdown that can contain JSX components and `import`/`export` lines.
- Install `@next/mdx @mdx-js/loader @mdx-js/react @types/mdx`, wrap the config with `createMDX()`, and add `'mdx'` to `pageExtensions` (keeping `'js'` and `'jsx'`).
- `mdx-components.js` in the project root is required and exports `useMDXComponents()`. Use it to style elements globally.
- `app/about/page.mdx` is a real page: it can export `metadata` and render Server Components.
- Imported `.mdx` files are components. Use `await import()` with `generateStaticParams` for a folder of posts, and skip `dynamicParams` when Cache Components is on.
- With Turbopack, list remark and rehype plugins as strings with serializable options.

<code id="code-content" class="language-javascript">
// next.config.mjs: Book Nook with MDX support (restart the dev server after editing)
import createMDX from '@next/mdx';
/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // page.mdx files become routes; keep js and jsx so normal pages still work
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
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
const withMDX = createMDX({
  options: {
    // Turbopack needs plugin names as strings, not imported functions
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [],
  },
});
export default withMDX(nextConfig);
// --- next file: mdx-components.js (required, in the project root)
// import Link from 'next/link';
// const components = {
//   h1: ({ children }) =&gt; &lt;h1 className="mb-4 text-3xl font-bold"&gt;{children}&lt;/h1&gt;,
//   a: ({ href, children }) =&gt; &lt;Link href={href} className="underline"&gt;{children}&lt;/Link&gt;,
// };
// export function useMDXComponents() {
//   return components;
// }
</code></pre>

---
publishDate: 2026-10-25T13:03
title: Understanding the Project Files
slug: project-structure
metadescription: "A tour of every file and folder create-next-app makes: package.json, next.config.mjs, jsconfig.json, the app folder, public, and the special files."
updateDate: 2026-10-25T13:03
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'project-structure', 'configuration', 'app-router']
course: nextjs
---

## A tour of your new project

In [Creating Your First Next.js App](/courses/nextjs/create-your-first-app) you made the Book Nook project with one command. That command created quite a few files. In this lesson you will open each one, see what is inside, and learn which ones you will edit often and which ones you can mostly ignore.

Think of a new house. Some rooms you use every day (the kitchen, the living room). Some you rarely visit (the fuse box, the attic). It helps to know where everything is, even the rooms you seldom enter.

Here is the whole project, as it looks right after `create-next-app` and one run of `npm run dev`:

```text
book-nook/
├── .next/               built files made by Next.js (never edit)
├── app/                 your pages and layouts: the App Router
│   ├── favicon.ico      the little icon in the browser tab
│   ├── globals.css      styles for the whole site
│   ├── layout.js        the root layout: wraps every page
│   └── page.js          the home page at /
├── node_modules/        installed packages (never edit)
├── public/              images and files served as they are
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── .gitignore           files Git should not save
├── eslint.config.mjs    rules for spotting code mistakes
├── jsconfig.json        JavaScript settings, like the @/ shortcut
├── next.config.mjs      Next.js settings
├── package-lock.json    exact versions of every installed package
├── package.json         the project's ID card and scripts
└── README.md            a short readme
```

If Git is installed, there is also a hidden `.git` folder where Git keeps its history. VS Code hides it from the Explorer, and you never need to open it.

## package.json: the project's ID card

Open `package.json`. This is the real file `create-next-app` made:

```json
{
  "name": "book-nook",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "16.4.3",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@tailwindcss/turbopack": "^4",
    "eslint": "^9",
    "eslint-config-next": "16.4.3",
    "tailwindcss": "^4"
  }
}
```

Line by line:

- `"name"` and `"version"`: the project's name and version number.
- `"private": true`: stops you from publishing the project to the npm website by accident.
- `"scripts"`: short names for commands. `npm run dev` runs `next dev`, and so on. You will learn all four in [The Dev Server, Fast Refresh and Error Overlay](/courses/nextjs/dev-server-and-fast-refresh).
- `"dependencies"`: packages your app needs to run. `next` is the framework, `react` builds components, and `react-dom` puts them on a web page.
- `"devDependencies"`: packages you need only while building: Tailwind CSS for styling, its Turbopack plugin, and ESLint for checking code.

The `^` in `"^4"` means "version 4 or any newer 4.x". The exact versions that were installed are written in `package-lock.json`. That file is long and you never edit it by hand. npm keeps it up to date, and it makes sure everyone who installs the project gets the same versions.

## next.config.mjs: Next.js settings

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

This file changes how Next.js behaves. The `.mjs` ending means it uses modern `import` and `export` syntax. The first line is a comment that gives VS Code autocomplete for the options.

- `cacheComponents: true` switches on **Cache Components**, the caching model of Next.js 16. You chose it with the `--cache-components` flag. You will learn what it does in [Caching with Cache Components and use cache](/courses/nextjs/use-cache).
- `partialPrefetching: true` makes links load the next page's static parts in the background, so clicks feel instant. More on that in [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating).
- `turbopack.rules` tells **Turbopack** (the bundler) to send every `.css` file through the Tailwind CSS plugin. That is how Tailwind is wired up in this project. There is no separate PostCSS config file.

> **Note:** When you change `next.config.mjs`, stop the dev server and start it again. Next.js reads this file only when it starts.

## jsconfig.json: the @/ shortcut

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

This sets up an **import alias**: a shortcut for a folder path. `@/` means "the project's root folder". So from any file, however deep, you can write:

```jsx
// app/books/[id]/page.js
import { getBook } from '@/lib/books';
```

instead of counting dots:

```jsx
// app/books/[id]/page.js
import { getBook } from '../../../lib/books';
```

VS Code also reads this file, so "Go to Definition" and autocomplete understand `@/` too. (A TypeScript project would have a `tsconfig.json` instead. You will meet it in [Using TypeScript with Next.js](/courses/nextjs/typescript).)

## eslint.config.mjs: catching mistakes

```javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

**ESLint** reads your code and warns about mistakes and bad habits, like using a plain `<img>` where `next/image` would be faster. `nextVitals` is the rule set made by the Next.js team. The `globalIgnores` list tells ESLint to skip folders full of generated code. Run it with:

```bash
npm run lint
```

## .gitignore: what Git should skip

This file lists files that should not be saved in Git. The important lines are:

```text
# dependencies
/node_modules

# next.js
/.next/
/out/

# env files (can opt-in for committing if needed)
.env*
```

- `node_modules` can be rebuilt any time with `npm install`, so there is no point saving it.
- `.next` and `out` are built output.
- `.env` files hold secrets like passwords. They must never be shared. See [Environment Variables](/courses/nextjs/environment-variables).

## The app folder: where your pages live

The `app` folder is the heart of the project. It is the **App Router**: every folder inside it can become a URL, and special file names tell Next.js what each file is for. Right now it has four files.

### app/layout.js: the root layout

```jsx
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

The **root layout** wraps every page of your site. It is the only place with the `<html>` and `<body>` tags, and every Next.js app must have one.

- The two font imports load the **Geist** fonts with `next/font` (see [Loading Fonts with next/font](/courses/nextjs/optimizing-fonts)).
- `import "./globals.css"` loads the site-wide styles.
- `metadata` sets the page title and description that appear in the browser tab and in search results (see [Page Titles, Descriptions and Metadata](/courses/nextjs/metadata)).
- `{children}` is the slot where the current page goes. On `/`, `children` is the component from `app/page.js`.

You will change this file in [Pages and Layouts](/courses/nextjs/pages-and-layouts).

### app/page.js: the home page

This file is the page at `/`. It is a normal React component, exported with `export default`. You already replaced its contents with your own Book Nook welcome in the previous lesson.

### app/globals.css: site-wide styles

```css
/* app/globals.css */
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

The first line, `@import "tailwindcss";`, switches on Tailwind CSS. The rest sets a light and a dark colour scheme and connects the Geist fonts to Tailwind's `font-sans` and `font-mono` classes. [Global CSS and CSS Modules](/courses/nextjs/global-css-and-css-modules) and [Styling with Tailwind CSS](/courses/nextjs/tailwind-css) explain it all.

### app/favicon.ico: the tab icon

A file called `favicon.ico` inside `app` automatically becomes the small icon in the browser tab. No code needed. Replace it with your own icon whenever you like. Next.js has a few more files that work like this, covered in [Sitemaps, robots.txt and App Icons](/courses/nextjs/sitemap-robots-and-icons).

## The public folder: files served as they are

Anything in `public` is served from the root of your site, exactly as it is. The file `public/next.svg` is available at `http://localhost:3000/next.svg`, and you can use it like this:

```jsx
// Any page or component
<img src="/next.svg" alt="Next.js logo" />
```

Notice that the URL has no `public` in it. Later, Book Nook will keep its book covers in `public/covers`, so `public/covers/dune.jpg` becomes `/covers/dune.jpg`. Learn more in [The public Folder and Third-Party Scripts](/courses/nextjs/public-folder-and-scripts).

The five SVG files are only used by the starter home page. Once you have replaced that page, you can delete them.

## Folders you never edit

- **`node_modules`** holds every installed package and its own packages. It is huge (hundreds of megabytes) and npm manages it. If it ever gets broken, delete it and run `npm install` again.
- **`.next`** is where Next.js writes its compiled output. The dev server writes to `.next/dev`, and `npm run build` writes the production build to the rest of `.next`. You can safely delete `.next` any time. Next.js rebuilds it.

> **Note:** If you use an AI coding assistant, `next dev` may also create an `AGENTS.md` file that points the assistant to the docs for your exact Next.js version. It does not affect your app.

## Special file names inside app

Inside `app`, some file names have special jobs. You have met `page.js` and `layout.js`. Here are the others you will use in this course:

| File | What it does | Lesson |
| --- | --- | --- |
| `page.js` | The UI for a URL. Makes the route public. | [Pages and Layouts](/courses/nextjs/pages-and-layouts) |
| `layout.js` | Shared UI that wraps pages, like a header and footer. | [Pages and Layouts](/courses/nextjs/pages-and-layouts) |
| `loading.js` | Shown while a page is loading. | [Loading UI, Suspense and Streaming](/courses/nextjs/loading-ui-and-streaming) |
| `error.js` | Shown when something breaks. | [Handling Errors with error.js](/courses/nextjs/error-handling) |
| `global-error.js` | Shown when even the root layout breaks. | [Handling Errors with error.js](/courses/nextjs/error-handling) |
| `not-found.js` | Shown for pages that do not exist. | [Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects) |
| `template.js` | Like a layout, but re-created on every visit. | [Templates and the Root Layout in Depth](/courses/nextjs/templates-and-root-layout) |
| `route.js` | An API endpoint instead of a page. | [Building APIs with Route Handlers](/courses/nextjs/route-handlers) |
| `default.js` | A fallback for parallel routes. | [Parallel Routes and Intercepting Routes](/courses/nextjs/parallel-and-intercepting-routes) |

Folder names can be special too: `[id]` for dynamic routes, `(shop)` for route groups and `_components` for private folders. You will meet them in the Routing section.

The good news: any other file in `app` is ignored by the router. A file called `app/books/helpers.js` does not create a page. Only `page.js` and `route.js` make a URL public.

## Files and folders you will add

As Book Nook grows, you will add a few things at the top level of the project:

```text
book-nook/
├── app/            pages and layouts (already there)
├── components/     shared React components, like Header.js and BookCard.js
├── lib/            plain JavaScript helpers, like books.js for book data
├── public/covers/  book cover images
├── .env.local      secret settings (never committed)
└── proxy.js        code that runs before requests (later in the course)
```

The names `components` and `lib` are not special to Next.js. They are just a common, tidy way to organise code: `app` for routing, and everything else beside it. Thanks to the `@/` alias, any page can import them with `@/components/Header` or `@/lib/books`.

You will create `components/Header.js` in [Linking and Navigating Between Pages](/courses/nextjs/linking-and-navigating) and `lib/books.js` in [Dynamic Routes and params](/courses/nextjs/dynamic-routes).

## Common mistakes

### Putting pages outside the app folder

A file like `books/page.js` at the project root does nothing. Pages must be inside `app`:

```text
book-nook/books/page.js        wrong: not a route
book-nook/app/books/page.js    right: shows at /books
```

### Deleting the root layout

If you delete `app/layout.js`, Next.js cannot render anything, because every page needs `<html>` and `<body>` from a root layout. In development Next.js may create a basic one for you, but keep your own and edit it instead.

### Editing files in .next or node_modules

Changes there are overwritten or lost the next time Next.js builds or npm installs. Always change your own files in `app`, `components`, `lib` and `public`.

### Forgetting to restart after changing next.config.mjs

Pages update instantly when you save, but `next.config.mjs` does not. If a config change seems to have no effect, stop the dev server with **Ctrl + C** and run `npm run dev` again.

## Quick recap

- `package.json` lists your packages and scripts. `package-lock.json` pins exact versions. Never edit `node_modules`.
- `next.config.mjs` holds Next.js settings. This project has `cacheComponents` and `partialPrefetching` turned on, and Tailwind wired in through Turbopack.
- `jsconfig.json` sets up the `@/` import alias for the project root.
- `eslint.config.mjs` configures ESLint. Run it with `npm run lint`.
- `app` is the App Router: `layout.js` wraps every page, `page.js` is the home page, `globals.css` styles the site, and `favicon.ico` is the tab icon.
- `public` files are served from `/`, without `public` in the URL.
- Special file names (`page`, `layout`, `loading`, `error`, `not-found`, `route` and more) have jobs. Other files in `app` are ignored by the router.
- You will add `components/` and `lib/` next to `app` as Book Nook grows.

<code id="code-content" class="language-javascript">
// next.config.mjs: the Book Nook config, exactly as create-next-app made it
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true, // Cache Components: the Next.js 16 caching model
  partialPrefetching: true, // links prefetch the static parts of the next page
  turbopack: {
    rules: {
      // Send every CSS file through the Tailwind CSS plugin
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};
export default nextConfig;
// --- jsconfig.json: "@/" means the project root
// {
//   "compilerOptions": {
//     "paths": { "@/*": ["./*"] }
//   }
// }
// --- So any file can write: import { getBook } from '@/lib/books';
// --- Restart "npm run dev" after changing next.config.mjs
</code></pre>

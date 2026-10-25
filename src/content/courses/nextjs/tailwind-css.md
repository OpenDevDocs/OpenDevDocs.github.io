---
publishDate: 2026-10-25T13:18
title: Styling with Tailwind CSS
slug: tailwind-css
metadescription: "Style Book Nook with Tailwind CSS v4 in Next.js 16: how create-next-app wires it up, utility classes, responsive design, theme variables and dark mode."
updateDate: 2026-10-25T13:18
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'tailwind', 'css', 'dark-mode']
course: nextjs
---

## What you will learn

In [Global CSS and CSS Modules](/courses/nextjs/global-css-and-css-modules) you wrote CSS in separate files and gave elements class names. Tailwind CSS takes a different road. Instead of writing your own CSS rules, you put many small ready-made classes straight on your elements:

```jsx
<p className="mt-2 text-lg font-semibold text-orange-700">$12.99</p>
```

Each class does one small job. `mt-2` adds a little top margin, `text-lg` makes the text a bit larger, `font-semibold` makes it bolder, and `text-orange-700` colours it. These one-job classes are called **utility classes**.

Think of it like cooking with a spice rack. Plain CSS means mixing your own spice blend for every dish. Tailwind gives you a rack of labelled jars, and you pick a pinch from each one right where you need it.

In this lesson you will:

- see exactly how `create-next-app` already set up Tailwind for Book Nook
- style a book card with utility classes
- make the layout responsive and add hover effects
- add your own brand colours and fonts as **theme variables**
- support dark mode, both automatic and with a toggle button

## Step 1: see what create-next-app set up

When you created Book Nook in [Creating Your First Next.js App](/courses/nextjs/create-your-first-app), you passed `--tailwind`. That installed **Tailwind CSS version 4** and wired it up in three places. There is nothing to install now. Let us just look.

**1. package.json** has two Tailwind packages under `devDependencies`:

```json
{
  "devDependencies": {
    "@tailwindcss/turbopack": "^4",
    "eslint": "^9",
    "eslint-config-next": "16.4.3",
    "tailwindcss": "^4"
  }
}
```

- `tailwindcss` is Tailwind itself.
- `@tailwindcss/turbopack` is a **loader**: a small plugin that lets Turbopack (the tool Next.js uses to build your app) run your CSS files through Tailwind.

**2. next.config.mjs** tells Turbopack to use that loader for every `.css` file:

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
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

The `turbopack.rules` block says: "for files matching `*.css`, run the `@tailwindcss/turbopack` loader, and treat the result as CSS".

**3. app/globals.css** starts with one line that pulls Tailwind in:

```css
/* app/globals.css */
@import "tailwindcss";
```

And `app/layout.js` imports `globals.css`, so the styles reach every page:

```jsx
// app/layout.js
import "./globals.css";
```

That is the whole setup. Notice what is **missing**: there is no `tailwind.config.js` file and no `postcss.config.mjs` file. In Tailwind v4 you configure everything inside your CSS file, and Tailwind finds the class names you use by scanning your project files on its own.

> **Good to know:** If you ever add Tailwind to an existing Next.js project by hand, the official Next.js docs show a different setup with the `@tailwindcss/postcss` package and a `postcss.config.mjs` file. Both ways work. Pick one per project. Book Nook uses the loader that `create-next-app` gave it.

> **Tip:** Install the **Tailwind CSS IntelliSense** extension in VS Code. It autocompletes class names and shows the real CSS when you hover over a class.

## Step 2: your first utility classes

Here is a plain book card component. Create `components/BookCard.js`:

```jsx
// components/BookCard.js
import Link from 'next/link';

export default function BookCard({ book }) {
  return (
    <Link href={`/books/${book.id}`} className="block rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="text-lg font-semibold text-zinc-900">{book.title}</h2>
      <p className="text-sm text-zinc-600">{book.author}</p>
      <p className="mt-2 font-semibold text-orange-700">${book.price.toFixed(2)}</p>
    </Link>
  );
}
```

Read the classes left to right like a sentence:

| Class | What it does |
| --- | --- |
| `block` | `display: block`, so the whole link is one clickable box |
| `rounded-lg` | rounded corners |
| `bg-white` | white background |
| `p-4` | padding of `1rem` on all sides (each step of 1 is `0.25rem`) |
| `shadow-sm` | a soft shadow |
| `ring-1 ring-zinc-200` | a thin light-grey outline |
| `text-lg`, `text-sm` | font sizes |
| `text-zinc-600` | grey text (colours go from `50`, very light, to `950`, very dark) |
| `mt-2` | margin-top of `0.5rem` |

Now show the cards in a grid on the books page:

```jsx
// app/books/page.js
import BookCard from '@/components/BookCard';
import { getBooks } from '@/lib/books';

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-bold">All books</h1>
      <div className="mt-6 grid gap-6">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </main>
  );
}
```

`mx-auto max-w-5xl` centres the content and stops it from getting too wide. `grid gap-6` makes a CSS grid with space between the items. Save the files and the dev server updates the page right away.

## Step 3: hover effects and other states

To style an element only in a certain **state**, put the state name and a colon in front of a class. These prefixes are called **variants**.

```jsx
// components/BookCard.js
<Link
  href={`/books/${book.id}`}
  className="group block rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200 transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange-500"
>
  <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-orange-700">{book.title}</h2>
```

- `hover:shadow-md` gives a bigger shadow only while the mouse is over the card.
- `focus-visible:ring-2` draws a thicker outline when a keyboard user tabs to the card. Always style focus states, so people who do not use a mouse can see where they are.
- `transition` makes the change smooth instead of instant.
- `group` on the parent plus `group-hover:` on a child means "change this child when the **parent** is hovered". Here the title turns orange when you hover anywhere on the card.

## Step 4: make it responsive

Tailwind is **mobile first**. A class with no prefix applies on every screen size. A class with a breakpoint prefix like `sm:` applies from that width **and up**.

| Prefix | Applies from |
| --- | --- |
| `sm:` | 40rem (640px) |
| `md:` | 48rem (768px) |
| `lg:` | 64rem (1024px) |
| `xl:` | 80rem (1280px) |
| `2xl:` | 96rem (1536px) |

Update the grid so phones get one column, tablets two and laptops four:

```jsx
// app/books/page.js
<div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
```

Read it as: "one column by default, two columns from 640px, four columns from 1024px". Make your browser window narrow and wide to watch the grid change.

## Step 5: arbitrary values

Sometimes you need a value that is not on Tailwind's scale. Put it in square brackets. You have already seen this in the starter page that `create-next-app` made:

```jsx
// app/page.js (from create-next-app)
<code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
```

- `text-[0.9em]` sets the font size to exactly `0.9em`.
- `bg-black/[.06]` is black at 6% opacity. The `/` after a colour sets its opacity, so `bg-orange-500/50` is orange at 50%.

Use arbitrary values sparingly. If you keep typing the same one, turn it into a theme variable instead (next step).

## Step 6: add your own theme variables

A **theme variable** is a special CSS variable that Tailwind turns into utility classes. You define them inside an `@theme` block in `globals.css`.

Book Nook needs a warm brand colour. Add this to `app/globals.css`, below the `@import` line:

```css
/* app/globals.css */
@theme {
  --color-brand-50: #fdf6ec;
  --color-brand-500: #c2410c;
  --color-brand-700: #9a3412;
}
```

Because the names start with `--color-`, Tailwind creates a full set of colour classes for each one: `bg-brand-500`, `text-brand-700`, `border-brand-50`, `ring-brand-500`, `hover:bg-brand-700` and so on. Use them in the card:

```jsx
// components/BookCard.js
<p className="mt-2 font-semibold text-brand-500">${book.price.toFixed(2)}</p>
```

The prefix of the variable name decides which classes you get:

| Variable name starts with | Example | Classes you can use |
| --- | --- | --- |
| `--color-` | `--color-brand-500` | `bg-brand-500`, `text-brand-500` |
| `--font-` | `--font-display` | `font-display` |
| `--breakpoint-` | `--breakpoint-3xl: 120rem` | `3xl:grid-cols-6` |

Now look at what `create-next-app` already wrote further down in `globals.css`:

```css
/* app/globals.css (from create-next-app) */
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
```

This creates the classes `bg-background`, `text-foreground`, `font-sans` and `font-mono`. The word `inline` matters here: use `@theme inline` whenever the value is itself a `var(...)` pointing at another variable. It tells Tailwind to put that `var(...)` straight into each class, so the class always reads the current value of `--background`. That is what makes the dark mode trick in the next step work. The `--font-geist-*` variables come from `next/font`, which you will meet in [Loading Fonts with next/font](/courses/nextjs/optimizing-fonts).

## Step 7: dark mode

### Automatic dark mode

Any class with the `dark:` variant applies when dark mode is on. By default, "on" means the visitor's operating system is set to dark:

```jsx
// components/BookCard.js
<Link className="block rounded-lg bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
  <p className="text-sm text-zinc-600 dark:text-zinc-400">{book.author}</p>
```

The starter `globals.css` does the same for its page colours with a media query:

```css
/* app/globals.css (from create-next-app) */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

Switch your operating system between light and dark (or use the "Rendering" panel in Chrome DevTools to fake it) and Book Nook follows along.

### Dark mode with a toggle button

Many sites let the visitor choose. To do that, tell Tailwind that `dark:` should follow a `dark` class on the page instead of the system setting. Add one line under the `@import`:

```css
/* app/globals.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

This reads: "the `dark` variant matches any element that has the `dark` class or sits inside one". Then replace the media query with a `.dark` rule, so the page colours follow the class too:

```css
/* app/globals.css */
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}
```

Now a small Client Component can switch the class on the `<html>` element. It needs `'use client'` because it reacts to clicks (see [Client Components and the use client Directive](/courses/nextjs/client-components)):

```jsx
// components/ThemeToggle.js
'use client';

export default function ThemeToggle() {
  function toggle() {
    document.documentElement.classList.toggle('dark');
  }

  return (
    <button
      onClick={toggle}
      className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      Toggle theme
    </button>
  );
}
```

Put `<ThemeToggle />` in your `Header` component and click it. Every `dark:` class and the page background switch together.

This simple version forgets the choice when you reload. To remember it, you would save the choice in `localStorage` and add the class again before the page paints, with a tiny script. You will learn how to add scripts like that in [The public Folder and Third-Party Scripts](/courses/nextjs/public-folder-and-scripts).

## Step 8: classes that change with data

You often pick classes based on a value, for example a badge colour per genre. Tailwind finds class names by reading your files as plain text, **before** your code runs. So every class must appear in your code as a complete word.

```jsx
// components/GenreBadge.js
const colours = {
  fantasy: 'bg-purple-100 text-purple-800',
  classic: 'bg-amber-100 text-amber-800',
  'science-fiction': 'bg-sky-100 text-sky-800',
};

export default function GenreBadge({ genre }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colours[genre] ?? 'bg-zinc-100 text-zinc-800'}`}>
      {genre}
    </span>
  );
}
```

Each full class name (`bg-purple-100`, `text-sky-800` and so on) is written out in the file, so Tailwind sees it and generates its CSS.

## Common mistakes

### Building class names from pieces

```jsx
// This does NOT work
<span className={`bg-${colour}-100`}>
```

Tailwind never runs your code, so it never sees `bg-purple-100`. It only sees the text `bg-${colour}-100`, which is not a class. The badge shows no colour at all and there is no error. Write full class names in a lookup object, as in Step 8.

### Following a Tailwind v3 tutorial

Older tutorials tell you to edit `tailwind.config.js`, add a `content` list, or start your CSS with three `@tailwind` lines. That is Tailwind v3. Book Nook uses v4: one `@import "tailwindcss";` line, and theme changes go in an `@theme` block in your CSS. If a tutorial mentions `tailwind.config.js`, look for a newer one on tailwindcss.com.

### Putting brand colours in :root instead of @theme

```css
/* app/globals.css */
:root {
  --color-brand-500: #c2410c; /* no bg-brand-500 class is created */
}
```

A normal CSS variable is just a variable. Tailwind only creates classes from variables inside `@theme` (or `@theme inline`). Move it into the `@theme` block.

### dark: classes ignore your toggle button

If clicking the toggle changes nothing, you probably forgot the `@custom-variant dark (&:where(.dark, .dark *));` line. Without it, `dark:` still follows the operating system, no matter which class is on `<html>`.

### Styles not showing at all

Check that `app/layout.js` still has `import "./globals.css";` and that `globals.css` still starts with `@import "tailwindcss";`. If you deleted the `turbopack.rules` block from `next.config.mjs`, put it back as shown in Step 1 and restart the dev server.

## Quick recap

- `create-next-app --tailwind` installs Tailwind v4 with the `@tailwindcss/turbopack` loader, registered under `turbopack.rules` in `next.config.mjs`.
- `app/globals.css` starts with `@import "tailwindcss";` and is imported once in `app/layout.js`. There is no `tailwind.config.js`.
- Utility classes do one job each: `p-4`, `text-lg`, `bg-white`, `rounded-lg`.
- Variants add conditions: `hover:`, `focus-visible:`, `group-hover:`, `dark:`, and breakpoints like `sm:` and `lg:` (mobile first).
- Square brackets give one-off values: `text-[0.9em]`. A `/` sets colour opacity: `bg-black/[.06]`.
- Add your own colours, fonts and breakpoints as theme variables in an `@theme` block. Use `@theme inline` when the value is a `var(...)`.
- For a dark mode toggle, add `@custom-variant dark (&:where(.dark, .dark *));` and toggle the `dark` class on `<html>`.
- Always write complete class names. Never glue them together from pieces.

<code id="code-content" class="language-css">
/* app/globals.css: Book Nook's Tailwind v4 setup with brand colours and a toggleable dark mode */
@import "tailwindcss";
/* dark: classes follow a "dark" class on html (or any parent) instead of the OS setting */
@custom-variant dark (&amp;:where(.dark, .dark *));
/* Plain CSS variables for the page colours (light mode) */
:root {
  --background: #ffffff;
  --foreground: #171717;
}
/* The same variables when the "dark" class is on html */
.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}
/* inline: these values are var(...) references, so classes read them directly */
@theme inline {
  --color-background: var(--background); /* bg-background, text-background */
  --color-foreground: var(--foreground); /* text-foreground */
  --font-sans: var(--font-geist-sans);   /* font-sans (from next/font) */
  --font-mono: var(--font-geist-mono);   /* font-mono (from next/font) */
}
/* Book Nook brand colours: creates bg-brand-500, text-brand-700, ring-brand-500 and more */
@theme {
  --color-brand-50: #fdf6ec;
  --color-brand-500: #c2410c;
  --color-brand-700: #9a3412;
}
body {
  background: var(--background);
  color: var(--foreground);
}
</code></pre>

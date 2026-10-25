---
publishDate: 2026-10-25T13:17
title: Global CSS and CSS Modules
slug: global-css-and-css-modules
metadescription: Style a Next.js app with a global stylesheet in the root layout and CSS Modules for component styles, including the config fix CSS Modules need in Book Nook.
updateDate: 2026-10-25T13:17
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'css', 'css-modules', 'styling']
course: nextjs
---

## What you will learn

Book Nook works, but it looks plain. Next.js gives you several ways to add CSS. In this lesson you will learn the two that are built on plain CSS files:

- **Global CSS**: one stylesheet whose rules apply to every page.
- **CSS Modules**: stylesheets whose class names only apply to the component that imports them.

You will style Book Nook's base page with global CSS, and give the `BookCard` component its own CSS Module. Along the way you will fix one setting in Book Nook's config that CSS Modules need.

Think of a bookshop. Global CSS is the loudspeaker announcement: "all staff wear blue". Everybody hears it. A CSS Module is a label stuck on one shelf: it only affects that shelf, and another shelf can use the same word on its own label without any confusion.

## Global CSS: the file you already have

`create-next-app` made a global stylesheet for you. Here it is, exactly as generated:

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

What each part does:

- `@import "tailwindcss";` loads Tailwind CSS, including a small **reset** that removes the browser's default margins and heading sizes. Tailwind is covered in [Styling with Tailwind CSS](/courses/nextjs/tailwind-css).
- `:root { ... }` defines **CSS variables** (custom properties) for the page colours.
- `@theme inline { ... }` is Tailwind syntax that turns those variables into Tailwind colours and fonts.
- The `@media (prefers-color-scheme: dark)` block swaps the colours when the visitor's computer is in dark mode.
- `body { ... }` uses the variables for the page background and text colour.

The file is loaded by one line at the top of the root layout:

```jsx
// app/layout.js
import "./globals.css";
```

Because the root layout wraps every page, these rules apply everywhere. This is the right place for truly global styles: colours, fonts, and base rules for plain HTML elements.

## Step 1: add Book Nook's base styles

Add a few rules at the end of `app/globals.css`. Notice they use plain element names, which is fine in a global file:

```css
/* app/globals.css (add at the end) */
@layer base {
  main {
    width: 100%;
    max-width: 64rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  a {
    color: #2563eb;
  }

  a:hover {
    text-decoration: underline;
  }
}
```

Why wrap them in `@layer base { ... }`? Tailwind puts its own reset in a **cascade layer** called `base`, and its utility classes (like `p-8`) in a later layer. Rules in a later layer win. By putting your base rules in the `base` layer too, a Tailwind class such as `p-8` on a `<main>` can still override your default padding. Without the layer, your plain `main { padding: ... }` rule would beat every Tailwind class on every `<main>`.

Save, and the dev server updates every page at once with **Fast Refresh** (see [The Dev Server, Fast Refresh and Error Overlay](/courses/nextjs/dev-server-and-fast-refresh)). Every `<main>` is now centred, every `<h1>` is big again, and every link is blue.

That power is also the danger of global CSS: a rule like `h1 { ... }` hits **every** heading on the site. Keep the global file small and use it only for things that really are site-wide.

> **Note:** You can import a global stylesheet from any file in the `app` folder, not only the root layout. But once loaded, its rules stay on the page as the visitor navigates, and they can clash with other pages. Import global CSS in the root layout only. Stylesheets from npm packages work the same way, for example `import 'some-package/dist/styles.css';` in the root layout.

## CSS Modules: styles that stay in their box

A **CSS Module** is a CSS file whose name ends in `.module.css`. When you import it, Next.js renames every class inside it to a unique name. So `.card` in `BookCard.module.css` and `.card` in `CartItem.module.css` never clash, even though they share a name.

## Step 2: one setting to fix first

Book Nook was created with Tailwind wired in through a Turbopack rule in `next.config.mjs`:

```javascript
// next.config.mjs (the part you have now)
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
```

This rule sends **every** file ending in `.css` through the Tailwind loader, and then treats the result as a plain `.css` file. `BookCard.module.css` also ends in `.css`, so it is treated as a plain global file too. The class names are not made unique, and in your component `styles.card` is `undefined`, so your styles silently do nothing.

The fix is one line: tell the rule to skip files ending in `.module.css`, so Next.js handles them as CSS Modules with its built-in support. Keep the rest of your config (such as the `redirects` from [Not Found Pages and Redirects](/courses/nextjs/not-found-and-redirects)) as it is:

```javascript
// next.config.mjs
  turbopack: {
    rules: {
      "*.css": {
        // Leave CSS Modules to Next.js's built-in support
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
```

`condition` limits where a Turbopack rule runs, and `{ not: { path: "*.module.css" } }` means "every file except CSS Modules". The dev server restarts by itself when you save `next.config.mjs`. Tailwind still processes `globals.css` exactly as before. The only trade-off: Tailwind-only syntax such as `@apply` will not work inside `.module.css` files, which is fine, because CSS Modules are for plain CSS.

## Step 3: give BookCard its own styles

Create the CSS Module next to the component. Inside, you use only **class** selectors:

```css
/* components/BookCard.module.css */
.card {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 16px;
}

.title {
  font-size: 1.125rem;
  font-weight: 600;
}

.price {
  font-weight: 600;
  color: #6b7280;
}

.card:hover .title {
  text-decoration: underline;
}
```

Now import it in the component. The import gives you an object, usually called `styles`, with one property for each class:

```jsx
// components/BookCard.js
import Link from 'next/link';
import styles from './BookCard.module.css';

const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function BookCard({ book }) {
  return (
    <article className={styles.card}>
      <h2 className={styles.title}>
        <Link href={`/books/${book.id}`}>{book.title}</Link>
      </h2>
      <p>{book.author}</p>
      <p className={styles.price}>{price.format(book.price)}</p>
    </article>
  );
}
```

`styles.card` is a string holding the unique class name. Open `/books`, right-click a card and choose **Inspect**. In a production build (`npm run build` then `npm start`) you will see something like:

```html
<article class="MXPWUq_card">
  <h2 class="MXPWUq_title">...</h2>
  <p class="MXPWUq_price">$12.99</p>
</article>
```

The exact letters will differ, and they may look different in development. What matters is that they are unique to this file. If another component also has a `.card` class in its own module, it gets a different name, so the two never fight.

CSS Modules work in both Server and Client Components. `BookCard` is a Server Component, and its CSS is still loaded for the page.

## Step 4: more than one class

`className` is just a string, so you can combine classes with a template literal:

```jsx
// components/BookCard.js
export default function BookCard({ book, featured = false }) {
  return (
    <article className={featured ? `${styles.card} ${styles.featured}` : styles.card}>
      {/* ... */}
    </article>
  );
}
```

```css
/* components/BookCard.module.css */
.featured {
  border-color: #2563eb;
  background: #eff6ff;
}
```

You can also mix a module class with a global or Tailwind class:

```jsx
<article className={`${styles.card} shadow-sm`}>
```

## Step 5: share styles with composes

If several modules need the same rule, put it in one module and **compose** it into others. `composes` is a CSS Modules feature that says "this class also includes that class":

```css
/* components/shared.module.css */
.muted {
  color: #6b7280;
}
```

```css
/* components/BookCard.module.css */
.price {
  composes: muted from './shared.module.css';
  font-weight: 600;
}
```

Now `styles.price` contains **two** class names, the price class and the shared muted class, and the element gets both.

## Naming tips

- Write class names in camelCase, like `.coverImage`, so you can use `styles.coverImage`.
- A name with a dash, like `.cover-image`, still works, but you must write `styles['cover-image']`.
- Name the file after the component: `BookCard.js` and `BookCard.module.css`, side by side.

## Which one should I use?

| Use | For |
| --- | --- |
| Global CSS in `app/globals.css` | Resets, colours, fonts, base rules for HTML elements |
| CSS Modules | Styles that belong to one component and are written in plain CSS |
| Tailwind CSS | Most everyday styling, with utility classes right in your JSX |

The Next.js team recommends Tailwind for most styling, global CSS only for truly global rules, and CSS Modules when you want scoped, plain CSS. You can mix all three in one project, as Book Nook does.

One more tip: in a production build, Next.js merges your CSS files, and the **order of imports** decides which rule wins when two rules clash. Import `globals.css` first in the root layout, and check the final look with `npm run build`, because CSS order can differ slightly in development.

## Common mistakes

### styles.card is undefined

The element has no `class` at all. Check three things: the file name really ends in `.module.css`, the class name in the CSS matches exactly (`styles.card` needs `.card`), and `next.config.mjs` has the `condition` from Step 2.

### Using element selectors in a CSS Module

```css
/* components/BookCard.module.css */
h1 {
  color: red;
}
```

```text
Error: Transforming CSS failed
Selector "h1" is not pure. Pure selectors must contain at least one local class or id.
```

A CSS Module must only style its own classes. Write `.title h1` (a class plus an element is fine) or put element rules in `globals.css`.

### Putting component styles in globals.css

A rule like `.card { ... }` in the global file affects every element with that class on the whole site, including ones you add months later. Move component styles into a module.

### Importing the module without a name

`import './BookCard.module.css';` loads the file but gives you no `styles` object, so you cannot use the class names. Write `import styles from './BookCard.module.css';`.

## Quick recap

- Global CSS lives in `app/globals.css` and is imported once in the root layout. Its rules apply to every page.
- Keep global CSS for site-wide rules: colours, fonts, resets and base element styles.
- A CSS Module is a `.module.css` file. Importing it gives a `styles` object of unique class names.
- In Book Nook, add `condition: { not: { path: "*.module.css" } }` to the Tailwind rule in `next.config.mjs`, or CSS Modules are treated as plain global CSS.
- CSS Modules only allow selectors that include a class (or id). Combine classes with template literals and share them with `composes`.
- Use Tailwind for most styling, CSS Modules for scoped plain CSS, and global CSS for the basics.

<code id="code-content" class="language-jsx">
// components/BookCard.js: a component with its own CSS Module
import Link from 'next/link';
import styles from './BookCard.module.css'; // an object of unique class names
const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export default function BookCard({ book, featured = false }) {
  // Combine two module classes with a template literal
  const cardClass = featured ? `${styles.card} ${styles.featured}` : styles.card;
  return (
    &lt;article className={cardClass}&gt;
      &lt;h2 className={styles.title}&gt;
        &lt;Link href={`/books/${book.id}`}&gt;{book.title}&lt;/Link&gt;
      &lt;/h2&gt;
      &lt;p&gt;{book.author}&lt;/p&gt;
      &lt;p className={styles.price}&gt;{price.format(book.price)}&lt;/p&gt;
    &lt;/article&gt;
  );
}
// --- components/BookCard.module.css
// .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; }
// .featured { border-color: #2563eb; background: #eff6ff; }
// .title { font-size: 1.125rem; font-weight: 600; }
// .price { composes: muted from './shared.module.css'; font-weight: 600; }
// .card:hover .title { text-decoration: underline; }
// --- next.config.mjs: let Next.js handle CSS Modules itself
// "*.css": {
//   condition: { not: { path: "*.module.css" } },
//   loaders: ["@tailwindcss/turbopack"],
//   as: "*.css",
// },
</code></pre>

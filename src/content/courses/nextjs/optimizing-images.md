---
publishDate: 2026-10-25T13:19
title: Optimizing Images with next/image
slug: optimizing-images
metadescription: "Show book covers fast with the Next.js Image component: local and remote images, remotePatterns, width and height, fill, sizes, preload and blur placeholders."
updateDate: 2026-10-25T13:19
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'images', 'performance']
course: nextjs
---

## What you will learn

Every book in Book Nook has a cover picture. Pictures are usually the heaviest thing on a web page. If you add them with a plain `<img>` tag, three things often go wrong:

- A phone downloads the same huge 2000-pixel image as a big desktop screen.
- The text jumps down when an image finishes loading, because the browser did not know how tall it would be. This jumping is called **layout shift**.
- Images far down the page download straight away, even if the visitor never scrolls there.

Next.js has a built-in `<Image>` component, imported from `next/image`, that fixes all three for you. It is like a smart picture framer: you hand over one big photo, and it cuts a correctly sized copy for every wall it hangs on, reserves the space on the wall before the photo arrives, and only fetches photos for rooms people actually walk into.

In this lesson you will:

- show local cover images from the `public` folder
- import an image file so Next.js measures it for you
- allow images from another website with `remotePatterns`
- make covers fill a responsive card with `fill` and `sizes`
- load the most important image first with `preload`
- show a blurry preview while an image loads

## Step 1: put the covers in the public folder

Book Nook's books (from `lib/books.js`) have a `cover` field like `'/covers/the-hobbit.jpg'`. That path points into the `public` folder, which Next.js serves from the root of your site. Create the folder and add one JPG per book. Any pictures will do while you practise, as long as the names match:

```text
book-nook/
└── public/
    └── covers/
        ├── the-hobbit.jpg
        ├── pride-and-prejudice.jpg
        ├── dune.jpg
        └── the-little-prince.jpg
```

The file `public/covers/dune.jpg` is now available at `http://localhost:3000/covers/dune.jpg`. Notice there is no `public` in the address. You will learn more about this folder in [The public Folder and Third-Party Scripts](/courses/nextjs/public-folder-and-scripts).

## Step 2: your first Image

On the book detail page, show the cover with `<Image>`:

```jsx
// app/books/[id]/page.js
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getBook } from '@/lib/books';

export default async function BookPage({ params }) {
  const { id } = await params;
  const book = await getBook(id);

  if (!book) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Image
        src={book.cover}
        alt={`Cover of ${book.title}`}
        width={400}
        height={600}
        className="rounded-lg shadow"
      />
      <h1 className="mt-6 text-3xl font-bold">{book.title}</h1>
    </main>
  );
}
```

Four props are doing the work here:

- `src` is the image path. A string starting with `/` means "from the `public` folder".
- `alt` describes the image for screen readers and for when the image cannot load. It is required. Describe what the picture shows; if an image is only decoration, use `alt=""`.
- `width` and `height` are the image's real size in pixels, or at least its **shape** (400 by 600 is the shape of a book cover). Next.js uses them to reserve the right amount of space before the image arrives, so nothing jumps.

`width` and `height` do **not** fix how big the image looks on screen. CSS does that. If you make the image smaller with a class like `w-48`, also keep its shape with `h-auto`:

```jsx
// app/books/[id]/page.js
<Image src={book.cover} alt={`Cover of ${book.title}`} width={400} height={600} className="h-auto w-48" />
```

Open a book page and look at the image in DevTools. Instead of `/covers/dune.jpg`, the `src` now looks something like this:

```text
/_next/image?url=%2Fcovers%2Fdune.jpg&w=828&q=75
```

That address is Next.js's **image optimizer**. It resizes the cover to the width the browser asked for (`w=828`), compresses it (`q=75` means quality 75), converts it to a modern format such as WebP when the browser supports it, and caches the result. The `<img>` tag also gets a `srcset`, a list of sizes the browser can choose from, and `loading="lazy"`, so covers lower on the page wait until the visitor scrolls near them.

## Step 3: import an image to skip width and height

If an image file lives in your project and does not change, you can **import** it like a module. Next.js then reads its size during the build, so you can leave out `width` and `height`:

```jsx
// app/about/page.js
import Image from 'next/image';
import shopPhoto from '@/public/shop-front.jpg';

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">About Book Nook</h1>
      <Image src={shopPhoto} alt="The front window of the Book Nook shop" placeholder="blur" className="mt-6 rounded-lg" />
    </main>
  );
}
```

`shopPhoto` is not a string. It is an object holding the path, the width, the height and a tiny blurred version of the picture. That is why `placeholder="blur"` works here with no extra setup (more in Step 7).

You cannot import the covers this way, because the cover path comes from data at run time, not from a fixed `import` line. Using `width` and `height` (or `fill`, below) is the right choice for them.

## Step 4: images from another website

Bookshops often get cover images from a publisher or a cover service instead of storing them. For example, the Open Library project serves covers at addresses like:

```text
https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg
```

Try it straight away:

```jsx
// app/books/[id]/page.js
<Image
  src="https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg"
  alt="Cover of The Hobbit"
  width={400}
  height={600}
/>
```

The page crashes with this error:

```text
Error: Invalid src prop (https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg) on `next/image`, hostname "covers.openlibrary.org" is not configured under images in your `next.config.js`
See more info: https://nextjs.org/docs/messages/next-image-unconfigured-host
```

This is a safety feature. Without it, anyone could use your image optimizer to resize pictures from any website on the internet, using your server's time and money. You have to list the remote addresses you trust. Add an `images` block to `next.config.mjs`, next to the settings that are already there:

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
  images: {
    remotePatterns: [new URL('https://covers.openlibrary.org/b/**')],
  },
};

export default nextConfig;
```

`remotePatterns` is a list of allowed addresses. `**` at the end means "anything below this path". Restart the dev server (changes to `next.config.mjs` need a restart) and the cover appears.

You can also write a pattern as an object, which lets you be more exact:

```javascript
// next.config.mjs
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'covers.openlibrary.org',
      port: '',
      pathname: '/b/**',
      search: '',
    },
  ],
},
```

`search: ''` means "no query string allowed". Be as specific as you can: a pattern like `hostname: '**'` would allow every website and undo the safety feature.

Because Next.js cannot look at remote files while it builds, remote images always need `width` and `height` (or `fill`).

## Step 5: fill a box with fill and sizes

On the books list page, the cards change width with the screen (one column on phones, four on laptops). You do not know the exact pixel size of the cover. For this, use `fill` instead of `width` and `height`. The image then stretches to fill its **parent element**:

```jsx
// components/BookCard.js
import Image from 'next/image';
import Link from 'next/link';

export default function BookCard({ book }) {
  return (
    <Link href={`/books/${book.id}`} className="block rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="relative aspect-[2/3] overflow-hidden rounded">
        <Image
          src={book.cover}
          alt={`Cover of ${book.title}`}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <h2 className="mt-3 text-lg font-semibold">{book.title}</h2>
      <p className="text-sm text-zinc-600">{book.author}</p>
    </Link>
  );
}
```

Three rules make `fill` work:

1. The parent must be positioned. `relative` (from Tailwind) sets `position: relative`. The image itself uses `position: absolute` to cover the parent.
2. The parent needs a size. `aspect-[2/3]` gives the box the shape of a book cover, and its width comes from the grid.
3. `object-cover` decides how the picture fits: it fills the box and crops any extra. Use `object-contain` instead if the whole picture must stay visible.

The `sizes` prop tells the browser **how wide the image will be on screen**, before any CSS has loaded. Read it from left to right, and the browser uses the first match:

- `(min-width: 1024px) 25vw`: on screens 1024px and wider, the image is about a quarter of the screen width (four columns).
- `(min-width: 640px) 50vw`: from 640px, about half (two columns).
- `100vw`: otherwise, the full screen width (one column).

With that information the browser picks the smallest file from the `srcset` that still looks sharp. Without `sizes`, a `fill` image is treated as if it were as wide as the whole screen, so a small card on a laptop downloads a huge file.

## Step 6: load the most important image first

All images are lazy by default. That is great for covers in a long list, but bad for the **one big image at the top of the page**, such as the cover on a book detail page. The browser should start fetching that one straight away, because it is usually the largest thing the visitor sees first. (Web performance tools call this the **Largest Contentful Paint**, or LCP, element.)

Add `preload` to that image only:

```jsx
// app/books/[id]/page.js
<Image
  src={book.cover}
  alt={`Cover of ${book.title}`}
  width={400}
  height={600}
  preload
  className="rounded-lg shadow"
/>
```

`preload` adds a `<link rel="preload">` tag to the page's `<head>`, so the download starts before the browser even reaches the `<img>` tag. The docs suggest two lighter options too: `loading="eager"` (do not wait, but no head tag) and `fetchPriority="high"` (fetch this before other images). Any of the three is fine for a single hero image. Do not preload many images, or none of them is really "first".

> **Good to know:** In Next.js 15 and earlier, this prop was called `priority`. Since Next.js 16 `priority` is **deprecated** in favour of `preload`. The starter `app/page.js` from `create-next-app` still uses `priority` on the Next.js logo; it works, but use `preload` in new code. Do not use both on one image: that throws an error.

## Step 7: blurry placeholders

While a big image loads, you can show a blurry preview in its place. For imported images (Step 3), Next.js makes the tiny preview for you, so this is all you need:

```jsx
// app/about/page.js
<Image src={shopPhoto} alt="The front window of the Book Nook shop" placeholder="blur" />
```

For string paths and remote images, Next.js cannot make the preview during the build. You give it one yourself with `blurDataURL`, a very small image (10 pixels or less) written as a **data URL** (an image encoded as text). A simple trick is a one-colour preview:

```jsx
// components/BookCard.js
const warmGrey =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWO4dvkiAAT9AnsxpHwUAAAAAElFTkSuQmCC';

<Image
  src={book.cover}
  alt={`Cover of ${book.title}`}
  fill
  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
  placeholder="blur"
  blurDataURL={warmGrey}
  className="object-cover"
/>
```

Keep `blurDataURL` tiny. A large one makes the page heavier, which defeats the purpose. If you want a real blurred copy of each cover, a library such as Plaiceholder can generate them on the server.

## Step 8: quality

The `quality` prop (1 to 100) trades file size for sharpness. The default is 75, which is a good balance for photos. Since Next.js 16, only qualities listed in `images.qualities` are allowed, and that list defaults to `[75]`. If you want a sharper version for one hero image, allow the value first:

```javascript
// next.config.mjs
images: {
  remotePatterns: [new URL('https://covers.openlibrary.org/b/**')],
  qualities: [75, 90],
},
```

```jsx
<Image src={book.cover} alt={`Cover of ${book.title}`} width={400} height={600} quality={90} />
```

A value that is not in the list is changed to the closest allowed one, and the dev server prints a warning.

## Common mistakes

### Forgetting width and height

```text
Error: Image with src "/covers/dune.jpg" is missing required "width" property.
```

A string `src` needs `width` and `height` so Next.js can reserve space. Add both, or use `fill` inside a positioned parent, or import the file statically.

### A remote host that is not allowed

```text
Error: Invalid src prop (https://example.com/cover.jpg) on `next/image`, hostname "example.com" is not configured under images in your `next.config.js`
```

Add a matching entry to `images.remotePatterns` in `next.config.mjs`, then restart the dev server. Check the protocol (`https`), the exact hostname and the path.

### fill with no positioned parent

The image covers the whole page, or disappears, and the browser console warns that the image has "fill" and a parent element with an invalid "position". Give the parent `relative` (or `absolute` or `fixed`) and a height, for example with `aspect-[2/3]`.

### Missing sizes on fill images

Nothing breaks, but every small card downloads a full-screen-width image. Always add `sizes` to `fill` images and to images whose width changes with CSS.

### Preloading every image

Adding `preload` to every card in a list makes them all compete, and the page gets slower. Preload only the one main image that is visible without scrolling.

## Quick recap

- Import `Image` from `next/image`. It resizes, compresses, converts and lazy-loads images for you.
- Files in `public/` are served from `/`, so `public/covers/dune.jpg` becomes `src="/covers/dune.jpg"`.
- String and remote images need `width` and `height` (the real size or at least the shape). CSS controls the size on screen.
- Statically imported images get their size and a blur preview automatically.
- Remote images must match `images.remotePatterns` in `next.config.mjs`. Be specific.
- Use `fill` with a `relative` parent of known shape, plus `object-cover` and a `sizes` string, for responsive cards.
- Use `preload` (not the deprecated `priority`) for the single most important image at the top of a page.
- `placeholder="blur"` shows a blurred preview. Remote and string images need a small `blurDataURL`.

<code id="code-content" class="language-jsx">
// components/BookCard.js: a responsive book card with an optimized cover image
import Image from 'next/image';
import Link from 'next/link';
// A 1x1 pixel image as text, used as a blurred preview while the cover loads
const warmGrey =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWO4dvkiAAT9AnsxpHwUAAAAAElFTkSuQmCC';
export default function BookCard({ book }) {
  return (
    &lt;Link href={`/books/${book.id}`} className="block rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200"&gt;
      {/* fill needs a positioned parent with a size: relative + the shape of a book cover */}
      &lt;div className="relative aspect-[2/3] overflow-hidden rounded"&gt;
        &lt;Image
          src={book.cover} // for example "/covers/dune.jpg" from the public folder
          alt={`Cover of ${book.title}`}
          fill // stretch to fill the parent div
          // How wide the image is on screen: 4 columns, 2 columns, or 1 column
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          placeholder="blur"
          blurDataURL={warmGrey}
          className="object-cover" // fill the box and crop the rest
        /&gt;
      &lt;/div&gt;
      &lt;h2 className="mt-3 text-lg font-semibold"&gt;{book.title}&lt;/h2&gt;
      &lt;p className="text-sm text-zinc-600"&gt;{book.author}&lt;/p&gt;
    &lt;/Link&gt;
  );
}
// --- next.config.mjs: allow remote covers (add next to your existing settings)
// images: {
//   remotePatterns: [new URL('https://covers.openlibrary.org/b/**')],
// },
// --- app/books/[id]/page.js: the main cover loads first
// &lt;Image src={book.cover} alt={`Cover of ${book.title}`} width={400} height={600} preload /&gt;
</code></pre>

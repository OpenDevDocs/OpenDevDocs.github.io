---
publishDate: 2026-10-25T13:47
title: Sitemaps, robots.txt and App Icons
slug: sitemap-robots-and-icons
metadescription: Generate sitemap.xml and robots.txt from code, add favicon, icon and apple-icon files, and create a web app manifest for Book Nook in Next.js 16.
updateDate: 2026-10-25T13:47
author: ['bishal-biswas']
level: 2
tags: ['nextjs', 'sitemap', 'robots', 'favicon']
course: nextjs
---

## The files every real website has

A finished website has a few small files that visitors rarely look at, but search engines and browsers do:

- **`sitemap.xml`**: a list of every page you want search engines to find. Think of it as the table of contents you hand to Google.
- **`robots.txt`**: polite instructions for search engine **crawlers** (the programs that read websites for search engines), such as "please do not crawl the admin area".
- **Icons**: the little picture in the browser tab (the **favicon**), and the bigger one a phone uses when someone adds your site to the home screen.
- **`manifest.webmanifest`**: a short description of your site as an installable app: its name, colours and icons.

In Next.js you create all of these with **special file names** in the `app` folder, the same idea you used for `opengraph-image` in [Open Graph Images and Social Cards](/courses/nextjs/og-images). Some are plain files, and some are code that generates the file. Next.js serves them at the right URL and adds the right tags to `<head>`.

By the end of this lesson Book Nook will have:

```text
app/
├── favicon.ico      browser tab icon (already there)
├── icon.png         a sharper tab icon
├── apple-icon.js    a generated home screen icon
├── manifest.js      the web app manifest
├── robots.js        rules for crawlers
└── sitemap.js       the list of pages, including every book
```

## Step 1: a sitemap that lists every book

You could write `app/sitemap.xml` by hand, but Book Nook gets new books all the time. It is better to build the list from the data. Create `app/sitemap.js`:

```javascript
// app/sitemap.js
import { getBooks } from '@/lib/books';

const baseUrl = 'https://booknook.example.com';

export default async function sitemap() {
  const books = await getBooks();

  const bookUrls = books.map((book) => ({
    url: `${baseUrl}/books/${book.id}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/books`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, changeFrequency: 'yearly', priority: 0.5 },
    ...bookUrls,
  ];
}
```

The default export returns an **array of objects**, one per page:

- `url` is the full address of the page. It must be absolute (starting with `https://`). That is the sitemap rule, so `metadataBase` does not help here.
- `changeFrequency` is a hint about how often the page changes: `'always'`, `'hourly'`, `'daily'`, `'weekly'`, `'monthly'`, `'yearly'` or `'never'`.
- `priority` is a number from 0 to 1 that says which pages matter most to you, relative to each other.
- `lastModified` (optional) is when the page last changed.

Visit `http://localhost:3000/sitemap.xml`. Next.js turned your array into proper XML:

```html
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://booknook.example.com</loc>
<changefreq>weekly</changefreq>
<priority>1</priority>
</url>
<url>
<loc>https://booknook.example.com/books</loc>
<changefreq>weekly</changefreq>
<priority>0.9</priority>
</url>
<url>
<loc>https://booknook.example.com/books/the-hobbit</loc>
<changefreq>monthly</changefreq>
<priority>0.8</priority>
</url>
```

Add a new book to the database and it appears in the sitemap without touching this file. Because `getBooks()` is cached with `'use cache'`, the new book shows up when that cache refreshes (see [Cache Lifetimes, Tags and Revalidation](/courses/nextjs/cache-life-and-revalidation)).

> **Tip:** Keep the domain in one place. A small `lib/site.js` that exports `export const siteUrl = 'https://booknook.example.com';` can be imported by the sitemap, the robots file and `metadataBase` in the root layout.

### A sitemap is a special Route Handler

`sitemap.js` behaves like a [Route Handler](/courses/nextjs/route-handlers) that Next.js writes for you. It is built **once at build time** and cached, unless it uses request data. In the build output it shows as static:

```text
├ ○ /robots.txt
└ ○ /sitemap.xml
```

Be careful with `lastModified: new Date()`. The current time is different on every request, so with Cache Components on, that one line turns the sitemap into a dynamic route (`ƒ /sitemap.xml`) that is rebuilt on every visit. Better: add an `updated_at` column to the `books` table (set it whenever a book changes) and use that:

```javascript
// app/sitemap.js (inside books.map)
lastModified: book.updated_at, // a date stored with the book
```

### Very large sites

A single sitemap may list at most 50,000 URLs (Google's limit). If Book Nook ever grows that big, you can put a `sitemap.js` in subfolders (for example `app/books/sitemap.js` served at `/books/sitemap.xml`), or split one list with `generateSitemaps`. In Next.js 16 the `id` it passes in is a Promise, so you `await` it. You will not need this for a small shop; the [generateSitemaps reference](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps) has the details.

## Step 2: robots.txt

`robots.txt` tells crawlers which parts of the site to skip. Book Nook's cart, admin area and API are of no use in search results. Create `app/robots.js`:

```javascript
// app/robots.js
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/cart', '/api/'],
    },
    sitemap: 'https://booknook.example.com/sitemap.xml',
  };
}
```

- `userAgent: '*'` means "these rules are for every crawler".
- `allow` and `disallow` take a path or an array of paths.
- `sitemap` tells crawlers where your sitemap lives.

Open `/robots.txt`:

```text
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /cart
Disallow: /api/

Sitemap: https://booknook.example.com/sitemap.xml
```

You can give different crawlers different rules by passing an array of rule objects:

```javascript
// app/robots.js
export default function robots() {
  return {
    rules: [
      { userAgent: 'Googlebot', allow: '/', disallow: '/admin' },
      { userAgent: ['Applebot', 'Bingbot'], disallow: '/' },
    ],
    sitemap: 'https://booknook.example.com/sitemap.xml',
  };
}
```

If your rules never change, a plain `app/robots.txt` file with the text above works just as well.

> **Important:** `robots.txt` is a polite request, not a lock. Bad bots can ignore it, and anyone can read it. Your `/admin` page must still be protected by real checks, as you did in [Protecting Pages, Actions and APIs](/courses/nextjs/authorization).

Both `sitemap` and `robots` files must be in the **root** of the `app` folder (the sitemap can also be nested, as above).

## Step 3: the favicon

create-next-app already put a `favicon.ico` in `app/`. That is why your tab shows the Next.js triangle. Replace it with your own `.ico` file of the same name, and Next.js adds:

```html
<link rel="icon" href="/favicon.ico?favicon.117ezoe8m31dk.ico" sizes="48x48" type="image/x-icon"/>
```

Two rules:

- `favicon.ico` only works in the top level of `app/`. Not in a subfolder, and not generated with code.
- It must be a real `.ico` file. Renaming a `.png` to `.ico` is not the same thing. Many free online tools convert a PNG to ICO.

## Step 4: icon and apple-icon

Modern browsers and phones prefer sharper icons in other formats. Add them with two more special names:

| File name | Allowed types | Used for |
| --- | --- | --- |
| `icon` | `.ico`, `.jpg`, `.jpeg`, `.png`, `.svg` | Browser tabs and bookmarks |
| `apple-icon` | `.jpg`, `.jpeg`, `.png` | iPhone and iPad home screen (180 by 180 is the usual size) |

Drop a 32 by 32 `icon.png` into `app/` and Next.js reads its size and type:

```html
<link rel="icon" href="/icon.png?..." type="image/png" sizes="32x32" />
```

An `icon.svg` gets `sizes="any"`, because an SVG looks sharp at any size. You can have several icons by adding numbers: `icon1.png`, `icon2.png`. Unlike `favicon.ico`, `icon` and `apple-icon` files can also go in subfolders, to give one part of the site a different icon.

### Generating an icon with code

Do not have a designer? You can draw an icon with the same `ImageResponse` you used for OG images. Create `app/apple-icon.js`:

```jsx
// app/apple-icon.js
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#7c2d12',
          color: '#fffbeb',
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        B
      </div>
    ),
    { ...size }
  );
}
```

`size` and `contentType` fill in the tag, just like before. The page source now has:

```html
<link rel="apple-touch-icon" href="/apple-icon?39f443c96ef53f4e" type="image/png" sizes="180x180"/>
```

The icon is drawn once at build time and cached. The same works for `icon.js`. Only `favicon.ico` cannot be generated.

## Step 5: the web app manifest

The **web app manifest** is a small JSON file that lets phones and desktop browsers install your site like an app, with its own name, icon and colours. Create `app/manifest.js`:

```javascript
// app/manifest.js
export default function manifest() {
  return {
    name: 'Book Nook',
    short_name: 'Book Nook',
    description: 'A small online bookshop.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffbeb',
    theme_color: '#7c2d12',
    icons: [
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
```

Next.js serves it at `/manifest.webmanifest` and adds this tag to every page:

```html
<link rel="manifest" href="/manifest.webmanifest"/>
```

- `name` is shown when installing. `short_name` is used under the home screen icon, where space is tight.
- `start_url` is the page that opens when someone launches the installed app.
- `display: 'standalone'` hides the browser's address bar, so it feels like an app.
- `theme_color` should match the `themeColor` you set in the `viewport` export in [Page Titles, Descriptions and Metadata](/courses/nextjs/metadata).

A static `app/manifest.json` file works too, if you prefer plain JSON. The manifest must be in the root of `app`.

## Step 6: check everything

Run a production build:

```bash
npm run build
```

The route list shows every metadata file Next.js created:

```text
├ ○ /apple-icon
├ ○ /manifest.webmanifest
├ ○ /robots.txt
└ ○ /sitemap.xml
```

The circle means each one is prerendered as a static file. Then run `npm start` and visit `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` and `/apple-icon` to see the results. After deploying, you can submit your sitemap address in Google Search Console so Google finds your books faster.

## Common mistakes

### Relative URLs in the sitemap

```javascript
{ url: '/books/dune' }
```

Search engines need full addresses. Always build URLs from your domain: `` `${baseUrl}/books/${book.id}` ``.

### Putting robots.js or manifest.js in a subfolder

`app/seo/robots.js` does not create `/robots.txt`. The robots, manifest and favicon files only work in the root of `app`.

### The old icon is still showing

Browsers cache favicons very aggressively. After replacing the file, open the site in a private window or clear the cache before deciding it did not work.

### Thinking robots.txt hides private pages

`Disallow: /admin` only asks well-behaved crawlers to stay away. It also tells everyone that `/admin` exists. Protect private pages with authentication.

### A sitemap that turned dynamic

The build shows `ƒ /sitemap.xml` instead of `○`. Something in it changes per request, often `new Date()`. Use dates stored with your data instead.

## Quick recap

- `app/sitemap.js` returns an array of `{ url, lastModified, changeFrequency, priority }` and becomes `/sitemap.xml`. Use full URLs.
- `app/robots.js` returns `{ rules, sitemap }` and becomes `/robots.txt`. It is a request, not security.
- `favicon.ico` lives only in the root of `app`. `icon` and `apple-icon` can be image files or generated with `ImageResponse`.
- `app/manifest.js` becomes `/manifest.webmanifest`, and Next.js adds the `<link rel="manifest">` tag for you.
- These files are special Route Handlers, built once and cached unless they use request data.
- Avoid `new Date()` in the sitemap, or it becomes dynamic.

<code id="code-content" class="language-javascript">
// app/sitemap.js: every Book Nook page, built from the data
import { getBooks } from '@/lib/books';
const baseUrl = 'https://booknook.example.com'; // sitemap URLs must be absolute
export default async function sitemap() {
  const books = await getBooks();
  // One entry per book, so new books appear automatically
  const bookUrls = books.map((book) =&gt; ({
    url: `${baseUrl}/books/${book.id}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/books`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, changeFrequency: 'yearly', priority: 0.5 },
    ...bookUrls,
  ];
}
// --- next file: app/robots.js
// export default function robots() {
//   return {
//     rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/cart', '/api/'] },
//     sitemap: 'https://booknook.example.com/sitemap.xml',
//   };
// }
// --- next file: app/manifest.js
// export default function manifest() {
//   return {
//     name: 'Book Nook', short_name: 'Book Nook', start_url: '/', display: 'standalone',
//     background_color: '#fffbeb', theme_color: '#7c2d12',
//     icons: [{ src: '/apple-icon', sizes: '180x180', type: 'image/png' }],
//   };
// }
</code></pre>

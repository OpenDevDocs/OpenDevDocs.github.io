---
publishDate: 2026-10-25T13:50
title: Building a Multi-Language Site
slug: internationalization
metadescription: Serve Book Nook in English and Spanish with an app/[lang] folder, JSON dictionaries, locale detection in proxy.js and generateStaticParams for every locale.
updateDate: 2026-10-25T13:50
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'i18n', 'proxy', 'localization']
course: nextjs
---

## The goal: Book Nook in two languages

Book Nook has customers in Spain and Mexico, and they would like to shop in Spanish. By the end of this lesson:

- `/en/books/dune` shows the page in English, and `/es/books/dune` in Spanish.
- Visiting `/` or `/books/dune` (with no language) sends each visitor to the language their browser prefers.
- Every language version is prerendered at build time.

First, three words you will see everywhere:

- A **locale** is a code for a language, and sometimes a region: `en` (English), `es` (Spanish), `en-US` (English as used in the United States).
- **Internationalization**, shortened to **i18n** (an "i", 18 letters, an "n"), is preparing your app to support many locales: routes, detection, formats.
- **Localization** is the actual translated content for each locale.

Next.js does not include a translation library. The App Router gives you the building blocks (dynamic routes, proxy, Server Components) and this lesson puts them together the way the [official i18n guide](https://nextjs.org/docs/app/guides/internationalization) recommends. You need [Dynamic Routes and params](/courses/nextjs/dynamic-routes) and [Running Code Before Requests with Proxy](/courses/nextjs/proxy).

## Step 1: put every route under app/[lang]

The language becomes the first part of every URL. That means a dynamic segment called `[lang]` at the very top of `app`, with **everything** inside it, including the root layout:

```text
Before                           After
app/                             app/
├── layout.js                    └── [lang]/
├── page.js                          ├── layout.js       root layout now
├── globals.css                      ├── page.js
└── books/                           ├── globals.css
    ├── page.js                      ├── dictionaries.js
    └── [id]/                        ├── dictionaries/
        └── page.js                  │   ├── en.json
                                     │   └── es.json
                                     └── books/
                                         ├── page.js
                                         └── [id]/
                                             └── page.js
```

Move your folders into `app/[lang]` and **delete** the old `app/layout.js`. The layout in `app/[lang]` becomes the root layout: it is the top-most layout, so it must render `<html>` and `<body>`. A segment like `lang` that appears above the root layout is called a **root parameter**.

Everything your old root layout did moves with it: the fonts, the `globals.css` import and the `<Header />` inside its `<Suspense>`. The example below is trimmed to the parts that change for languages.

## Step 2: write the dictionaries

A **dictionary** is an object that maps a key to the text in one language. Keep one JSON file per locale:

```json
{
  "home": {
    "title": "Welcome to Book Nook",
    "intro": "Hand-picked stories for every reader."
  },
  "book": {
    "by": "by",
    "price": "Price",
    "addToCart": "Add to cart"
  }
}
```

Save that as `app/[lang]/dictionaries/en.json`, and the Spanish version as `app/[lang]/dictionaries/es.json`:

```json
{
  "home": {
    "title": "Bienvenido a Book Nook",
    "intro": "Historias elegidas a mano para cada lector."
  },
  "book": {
    "by": "de",
    "price": "Precio",
    "addToCart": "Añadir al carrito"
  }
}
```

Both files must have the **same keys**. Only the values change.

## Step 3: a helper to load the right dictionary

Create `app/[lang]/dictionaries.js`:

```javascript
// app/[lang]/dictionaries.js
import 'server-only';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  es: () => import('./dictionaries/es.json').then((module) => module.default),
};

export const locales = Object.keys(dictionaries); // ['en', 'es']

export const hasLocale = (locale) => locale in dictionaries;

export const getDictionary = async (locale) => dictionaries[locale]();
```

- Each locale maps to a function that **imports** its JSON file only when asked. A Spanish visitor never loads the English file.
- `hasLocale` checks whether a string from the URL is a language you support. Without it, a visit to `/de` would crash when it tries to load a German dictionary that does not exist.
- `import 'server-only'` makes the build fail if a Client Component ever imports this file. The dictionaries are only read in Server Components, so your translations never add to the browser's JavaScript. (You met `server-only` in [Keeping Secrets and Data Safe](/courses/nextjs/data-security).)

## Step 4: the root layout

```jsx
// app/[lang]/layout.js
import { notFound } from 'next/navigation';
import { hasLocale, locales } from './dictionaries';
import './globals.css';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children, params }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
```

Three important lines:

- `generateStaticParams` returns `[{ lang: 'en' }, { lang: 'es' }]`, so Next.js prerenders both language versions of every page. With Cache Components on, a root parameter **must** have at least one value here, or the build fails. (See [Pre-rendering Dynamic Routes with generateStaticParams](/courses/nextjs/generate-static-params).)
- `<html lang={lang}>` tells browsers, screen readers and search engines which language the page is in. A screen reader uses it to pick the right voice.
- `notFound()` turns `/de` or `/xyz` into a proper 404 page.

## Step 5: translate the pages

Any page under `[lang]` receives `lang` in its `params`. Load the dictionary and use it:

```jsx
// app/[lang]/page.js
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDictionary, hasLocale } from './dictionaries';

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.home.title };
}

export default async function HomePage({ params }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">{dict.home.title}</h1>
      <p>{dict.home.intro}</p>
      <Link href={`/${lang}/books`}>Books</Link>
    </main>
  );
}
```

Notice the link: `/${lang}/books`, not `/books`. Every internal link must keep the language, or the visitor drops out of their locale (the proxy in Step 7 would send them back, but that costs an extra redirect).

The book page has two dynamic segments now, `lang` and `id`, and both arrive in `params`:

```jsx
// app/[lang]/books/[id]/page.js
import { notFound } from 'next/navigation';
import { getBook, getBooks } from '@/lib/books';
import { getDictionary, hasLocale } from '../../dictionaries';

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ id: book.id }));
}

export default async function BookPage({ params }) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();

  const [dict, book] = await Promise.all([getDictionary(lang), getBook(id)]);
  if (!book) notFound();

  const price = new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'USD',
  }).format(book.price);

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">{book.title}</h1>
      <p>{dict.book.by} {book.author}</p>
      <p>{dict.book.price}: {price}</p>
      <button>{dict.book.addToCart}</button>
    </main>
  );
}
```

- This `generateStaticParams` returns only `id`. Next.js combines it with the `lang` values from the layout, so it prerenders `/en/books/dune`, `/es/books/dune` and every other pair.
- `Promise.all` loads the dictionary and the book at the same time instead of one after the other.
- **`Intl.NumberFormat`** is built into JavaScript and formats numbers the way each locale expects. The same price becomes `$14.50` in English and `14,50 US$` in Spanish. `Intl.DateTimeFormat` does the same for dates.

The Spanish page renders:

```text
Dune
de Frank Herbert
Precio: 14,50 US$
Añadir al carrito
```

The book titles and descriptions themselves still come from the database in English. In a real shop you would add translated columns to the `books` table (for example `title_es`) and pick one with `lang` in the data layer.

## Step 6: install the locale matching helpers

When someone visits `/` with no language in the URL, which one should they get? Browsers send an **`Accept-Language`** header listing the user's preferred languages, for example:

```http
Accept-Language: es-ES,es;q=0.9,en;q=0.8
```

That reads: "Spanish from Spain first, then any Spanish, then English". The `q` numbers are preferences from 0 to 1. Parsing this by hand is fiddly, so use two small, popular libraries, as the official guide does:

```bash
npm install negotiator @formatjs/intl-localematcher
```

- `negotiator` turns the header into a sorted list: `['es-ES', 'es', 'en']`.
- `@formatjs/intl-localematcher` picks the best match from the locales you support, with a default if nothing matches.

## Step 7: redirect from proxy.js

You built a proxy in [Running Code Before Requests with Proxy](/courses/nextjs/proxy). This one checks whether the URL already starts with a locale and, if not, redirects:

```javascript
// proxy.js
import { NextResponse } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

const locales = ['en', 'es'];
const defaultLocale = 'en';

function getLocale(request) {
  const headers = { 'accept-language': request.headers.get('accept-language') ?? '' };
  const languages = new Negotiator({ headers }).languages();
  return match(languages, locales, defaultLocale);
}

export function proxy(request) {
  const { pathname } = request.nextUrl;

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  if (pathnameHasLocale) return;

  // e.g. /books/dune becomes /es/books/dune
  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip API routes, Next.js internals and any path with a dot (files like /covers/dune.jpg)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

- If the path already has a locale, the function returns nothing and the request continues as normal.
- Otherwise it works out the best locale and answers with a redirect to the same path with the locale in front.
- The `matcher` keeps the proxy away from files. Without the `.*\\..*` part, a request for `/covers/dune.jpg` would be redirected to `/es/covers/dune.jpg`, which does not exist. In a JavaScript string `\\.` means a real dot, so keep both backslashes.

`proxy.js` lives in the project root, next to `app`, not inside it.

Test it from a terminal while `npm run dev` runs (Windows users: run it in Git Bash, or drop the header part in PowerShell):

```bash
curl -I -H "Accept-Language: es-ES,es;q=0.9" http://localhost:3000/books/dune
```

```text
HTTP/1.1 307 Temporary Redirect
location: http://localhost:3000/es/books/dune
```

A visitor whose browser asks for French gets `/en/...`, because French is not supported and `en` is the default. A **307** is a temporary redirect, which is right here: the same URL may send a different visitor somewhere else.

## Step 8: a language switcher

Visitors should be able to change language themselves. The switcher needs the current path, which only the browser knows, so it is a Client Component:

```jsx
// components/LanguageSwitcher.js
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const names = { en: 'English', es: 'Español' };

export default function LanguageSwitcher() {
  const pathname = usePathname(); // e.g. "/es/books/dune"

  return (
    <nav className="flex gap-3">
      {Object.entries(names).map(([locale, name]) => {
        const segments = pathname.split('/'); // ['', 'es', 'books', 'dune']
        segments[1] = locale;                  // swap the language part
        return (
          <Link key={locale} href={segments.join('/')}>
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
```

Put `<LanguageSwitcher />` in the root layout's `<body>`, and every page gets an "English | Español" bar that keeps the visitor on the same book.

## Step 9: tell search engines about the other languages

Search engines should know that `/en/books/dune` and `/es/books/dune` are the same page in two languages. Add `alternates` to the metadata (with `metadataBase` set as in [Open Graph Images and Social Cards](/courses/nextjs/og-images)):

```jsx
// app/[lang]/books/[id]/page.js
export async function generateMetadata({ params }) {
  const { id } = await params;
  const book = await getBook(id);
  return {
    title: book?.title,
    alternates: {
      languages: {
        en: `/en/books/${id}`,
        es: `/es/books/${id}`,
      },
    },
  };
}
```

Next.js turns this into `<link rel="alternate" hreflang="es" href="...">` tags. Sitemaps support the same `alternates.languages` field (see [Sitemaps, robots.txt and App Icons](/courses/nextjs/sitemap-robots-and-icons)).

## Going further: next/root-params

Passing `lang` from page to component to helper gets tiring in a big app. Because `lang` is a root parameter, Next.js 16 can give it to any Server Component directly:

```javascript
// app/[lang]/dictionaries.js
import { lang } from 'next/root-params';
import { notFound } from 'next/navigation';

export const getDictionary = async () => {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return dictionaries[locale]();
};
```

The export name comes from your folder name: `[lang]` gives `lang`, `[locale]` would give `locale`. It works in Server Components and server helpers, but not in Client Components, Server Actions or Route Handlers. When you outgrow hand-made dictionaries (plurals, many languages, translators who do not touch code), libraries like `next-intl` build on these same ideas.

## Common mistakes

### Keeping the old app/layout.js

If `app/layout.js` still exists, it stays the root layout and `app/[lang]/layout.js` becomes a nested layout that renders a second `<html>` inside the first. Delete the old one, so the layout in `[lang]` is the top.

### Links without the locale

`<Link href="/books">` sends the visitor through the proxy again. Build links with the current `lang`: `` href={`/${lang}/books`} ``.

### Images and files get redirected

A matcher like `'/((?!_next).*)'` also catches `/covers/dune.jpg`, and the proxy redirects it to `/en/covers/dune.jpg`, a 404. Exclude paths that contain a dot, as in Step 7.

### Unknown locales crash

Visiting `/de` throws an error inside `getDictionary`, because `dictionaries['de']` is undefined. Always check with `hasLocale` and call `notFound()` in the layout and pages.

### A missing key shows nothing

You added `dict.book.wishlist` to the page and the English file, but forgot `es.json`. The Spanish page shows a blank. Keep both files in sync, or fall back with `dict.book.wishlist ?? 'Wishlist'`.

## Quick recap

- Put every route, including the root layout, inside `app/[lang]`. Delete the old `app/layout.js`.
- Keep translations in `dictionaries/en.json` and `dictionaries/es.json`, loaded by a `server-only` helper with `getDictionary(lang)` and `hasLocale(lang)`.
- `generateStaticParams` in the `[lang]` layout returns every locale, so all languages are prerendered. Cache Components requires at least one value.
- Set `<html lang={lang}>` and keep `lang` in every internal link.
- `proxy.js` reads `Accept-Language` with `negotiator` and `@formatjs/intl-localematcher`, and redirects paths with no locale. Its matcher skips files.
- Use `Intl.NumberFormat` and `Intl.DateTimeFormat` for prices and dates, and `alternates.languages` to link the language versions for search engines.

<code id="code-content" class="language-javascript">
// proxy.js: send visitors without a locale in the URL to their best language
import { NextResponse } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
const locales = ['en', 'es'];
const defaultLocale = 'en';
// Read the Accept-Language header and pick the best supported locale
function getLocale(request) {
  const headers = { 'accept-language': request.headers.get('accept-language') ?? '' };
  const languages = new Negotiator({ headers }).languages();
  return match(languages, locales, defaultLocale);
}
export function proxy(request) {
  const { pathname } = request.nextUrl;
  const pathnameHasLocale = locales.some(
    (locale) =&gt; pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
  if (pathnameHasLocale) return; // already /en/... or /es/...
  // /books/dune becomes /es/books/dune for a Spanish browser
  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}
export const config = {
  // Skip the API, Next.js internals and files such as /covers/dune.jpg
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
// --- next file: app/[lang]/dictionaries.js
// import 'server-only';
// const dictionaries = {
//   en: () =&gt; import('./dictionaries/en.json').then((module) =&gt; module.default),
//   es: () =&gt; import('./dictionaries/es.json').then((module) =&gt; module.default),
// };
// export const locales = Object.keys(dictionaries);
// export const hasLocale = (locale) =&gt; locale in dictionaries;
// export const getDictionary = async (locale) =&gt; dictionaries[locale]();
</code></pre>

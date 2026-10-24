---
publishDate: 2026-05-18T09:51
title: Next.js App Router with Server Components
slug: nextjs-app-router
metadescription: Learn file based routing, layouts, loading and error files, and how the App Router puts Server Components to work.
updateDate: 2026-09-05T09:51
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'rsc', 'routing']
course: react
---

## Routing by folders

In the App Router, the file system **is** the routing table.

```bash
app/
  layout.jsx          ->  wraps everything
  page.jsx            ->  /
  about/
    page.jsx          ->  /about
  products/
    page.jsx          ->  /products
    [id]/
      page.jsx        ->  /products/:id
  (marketing)/
    pricing/
      page.jsx        ->  /pricing
```

Four rules cover most of it:

- **`page.jsx`** makes a route publicly reachable. A folder without one is not a route.
- **`[id]`** is a dynamic segment.
- **`(name)`** in brackets groups folders without adding a URL segment.
- **`layout.jsx`** wraps that folder and everything below it.

## Server Components by default

Every component in `app/` is a Server Component unless you say otherwise.

```javascript
export default async function ProductsPage() {
  const products = await db.products.findMany();
  return (
    <ul>
      {products.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

Async, direct database access, no loading state, and none of this code ships to the browser. This is the default, not the special case.

## Layouts

```javascript
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

```javascript
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <DashboardNav />
      <main>{children}</main>
    </div>
  );
}
```

Layouts nest, and crucially they **do not re-render on navigation**. Moving between `/dashboard/settings` and `/dashboard/billing` keeps the nav mounted, so its scroll position and open menus survive.

The root layout must include `<html>` and `<body>`, and it is the only one that does.

## The special files

Each folder can have several conventional files.

```bash
app/products/
  layout.jsx      shared shell
  page.jsx        the route
  loading.jsx     shown while the page loads
  error.jsx       shown when it throws
  not-found.jsx   shown for a 404
```

`loading.jsx` is the neat one. Creating it automatically wraps the page in a Suspense boundary:

```javascript
export default function Loading() {
  return <ProductListSkeleton />;
}
```

No `<Suspense>` to write. The file's existence is the boundary.

`error.jsx` must be a Client Component, because it needs state to offer a retry:

```javascript
'use client';
export default function Error({ error, reset }) {
  return (
    <div role="alert">
      <p>Something went wrong loading products.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

## Dynamic segments

```javascript
export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await db.products.findUnique({ where: { id } });
  if (!product) notFound();
  return <h1>{product.name}</h1>;
}
```

Note that `params` is a **promise** and must be awaited. This changed in Next.js 15 and catches people upgrading.

Search parameters work the same way:

```javascript
export default async function Page({ searchParams }) {
  const { category, page } = await searchParams;
  return <ProductList category={category} page={Number(page ?? 1)} />;
}
```

`notFound()` throws, which renders the nearest `not-found.jsx`.

## Metadata

```javascript
export const metadata = {
  title: 'Products',
  description: 'Browse our full range'
};
export default function ProductsPage() {
  return <h1>Products</h1>;
}
```

For dynamic pages, generate it:

```javascript
export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await db.products.findUnique({ where: { id } });
  return {
    title: product.name,
    description: product.summary,
    openGraph: { images: [product.image] }
  };
}
```

This runs on the server, so social scrapers and crawlers see the real values.

## Navigation

```javascript
import Link from 'next/link';
function Nav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/products">Products</Link>
    </nav>
  );
}
```

`next/link` prefetches the route when the link enters the viewport, so navigation is usually instant.

For the active state and programmatic navigation you need a Client Component:

```javascript
'use client';
import { usePathname, useRouter } from 'next/navigation';
export function NavLink({ href, children }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link href={href} className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined}>
      {children}
    </Link>
  );
}
```

Note the import is `next/navigation`, not the older `next/router` from the Pages Router.

## Parallel data loading

Sequential awaits create a waterfall:

```javascript
export default async function Page({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  const reviews = await getReviews(id);
  const related = await getRelated(id);
}
```

Three round trips in a row. If they are independent, start them together:

```javascript
export default async function Page({ params }) {
  const { id } = await params;
  const [product, reviews, related] = await Promise.all([
    getProduct(id),
    getReviews(id),
    getRelated(id)
  ]);
}
```

Or stream them separately so each appears as it lands:

```javascript
export default async function Page({ params }) {
  const { id } = await params;
  return (
    <div>
      <Suspense fallback={<ProductSkeleton />}>
        <Product id={id} />
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews id={id} />
      </Suspense>
    </div>
  );
}
```

## App Router or Pages Router?

The Pages Router is the older system using `pages/` and `getServerSideProps`. It still works and is still supported, but it does not have Server Components, layouts or streaming.

New projects use the App Router. If you meet `getStaticProps` or `getServerSideProps` in a tutorial, it is the older system.

## Quick recap

- Folders are routes, and `page.jsx` makes one public.
- Everything is a Server Component unless marked `'use client'`.
- Layouts nest and survive navigation, keeping their state.
- `loading.jsx` creates a Suspense boundary automatically.
- `error.jsx` must be a Client Component and gets a `reset` function.
- `params` and `searchParams` are promises, so await them.
- `generateMetadata` runs on the server, so crawlers see real values.
- Use `Promise.all` or separate Suspense boundaries to avoid waterfalls.

<code id="code-content" class="language-javascript">
// ---------- app/layout.jsx : the root layout ----------
// Only the root layout includes &lt;html&gt; and &lt;body&gt;.
// Layouts do NOT re-render on navigation, so nav state survives.
export default function RootLayout({ children }) {
  return (
    &lt;html lang="en"&gt;
      &lt;body&gt;
        &lt;Header /&gt;
        {children}
        &lt;Footer /&gt;
      &lt;/body&gt;
    &lt;/html&gt;
  );
}
// ---------- app/products/page.jsx : a Server Component ----------
// Async, queries the database directly, ships no JavaScript
import { Suspense } from 'react';
export const metadata = { title: 'Products' };
export default async function ProductsPage({ searchParams }) {
  // params and searchParams are PROMISES in Next.js 15 and later
  const { category } = await searchParams;
  const products = await db.products.findMany({ where: { category } });
  return &lt;ul&gt;{products.map((p) =&gt; &lt;li key={p.id}&gt;{p.name}&lt;/li&gt;)}&lt;/ul&gt;;
}
// ---------- app/products/loading.jsx ----------
// Just creating this file wraps the page in a Suspense boundary
// export default function Loading() { return &lt;ProductListSkeleton /&gt;; }
// ---------- app/products/error.jsx ----------
// Must be a client component, because reset needs interactivity
// 'use client';
// export default function Error({ error, reset }) {
//   return (
//     &lt;div role="alert"&gt;
//       &lt;p&gt;Something went wrong.&lt;/p&gt;
//       &lt;button onClick={reset}&gt;Try again&lt;/button&gt;
//     &lt;/div&gt;
//   );
// }
// ---------- app/products/[id]/page.jsx ----------
import { notFound } from 'next/navigation';
export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  // Runs on the SERVER, so crawlers and social scrapers see real values
  return { title: product.name, description: product.summary };
}
export default async function ProductPage({ params }) {
  const { id } = await params;
  // WATERFALL: three awaits in a row is three round trips.
  //   const product = await getProduct(id);
  //   const reviews = await getReviews(id);
  // Start independent requests together instead:
  const [product, reviews] = await Promise.all([
    getProduct(id),
    getReviews(id)
  ]);
  if (!product) notFound();      // renders the nearest not-found.jsx
  return (
    &lt;div&gt;
      &lt;h1&gt;{product.name}&lt;/h1&gt;
      {/* Or stream each section so it appears as its data lands */}
      &lt;Suspense fallback={&lt;p&gt;Loading related...&lt;/p&gt;}&gt;
        &lt;RelatedProducts id={id} /&gt;
      &lt;/Suspense&gt;
    &lt;/div&gt;
  );
}
// ---------- NavLink.jsx : needs the client for usePathname ----------
// 'use client';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';   NOT next/router
// export function NavLink({ href, children }) {
//   const isActive = usePathname() === href;
//   return &lt;Link href={href} aria-current={isActive ? 'page' : undefined}&gt;
//     {children}
//   &lt;/Link&gt;;
// }
</code></pre>

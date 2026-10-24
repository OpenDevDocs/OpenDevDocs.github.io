---
publishDate: 2026-05-18T09:52
title: 'Next.js Rendering Strategies: SSG, ISR and PPR'
slug: nextjs-rendering-strategies
metadescription: Choose when each page is built, from fully static at build time to fresh on every request, and mix both on one page.
updateDate: 2026-09-05T09:52
author: ['bishal-biswas']
level: 3
tags: ['nextjs', 'ssr', 'performance']
course: react
---

## The question every page answers

**When is this HTML produced?**

- **At build time**: static generation. Fastest possible, but the content is frozen until you rebuild.
- **On every request**: server rendering. Always fresh, but slower and it costs server time.
- **At build time, then refreshed periodically**: incremental static regeneration.
- **Both on one page**: partial prerendering.

Different pages want different answers, and a marketing page and a dashboard should not be treated the same way.

## Static generation

The default when a page has no dynamic data.

```javascript
export default async function AboutPage() {
  return <h1>About us</h1>;
}
```

Built once, served from a CDN as a plain file. Nothing faster exists.

Static pages with data still work, as long as the data is fetched in a cacheable way:

```javascript
export default async function BlogPage() {
  const posts = await fetch('https://api.example.com/posts', {
    cache: 'force-cache'
  }).then((r) => r.json());
  return <ul>{posts.map((p) => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

### Static dynamic routes

For `/products/[id]`, list the ids you want prebuilt.

```javascript
export async function generateStaticParams() {
  const products = await db.products.findMany({ select: { id: true } });
  return products.map((p) => ({ id: p.id }));
}
export default async function ProductPage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);
  return <h1>{product.name}</h1>;
}
```

Every product page is built ahead of time. Ids not in the list are rendered on first request and then cached.

## Dynamic rendering

A page becomes dynamic automatically when it uses request specific data.

```javascript
import { cookies, headers } from 'next/headers';
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session');
  const user = await getUser(session.value);
  return <h1>Welcome back, {user.name}</h1>;
}
```

Reading `cookies()`, `headers()` or `searchParams` means the output depends on who is asking, so it cannot be static.

To force it:

```javascript
export const dynamic = 'force-dynamic';
```

Or opt a single fetch out of caching:

```javascript
const data = await fetch(url, { cache: 'no-store' });
```

## Incremental static regeneration

The middle ground, and often the best answer.

```javascript
export const revalidate = 3600;
export default async function ProductsPage() {
  const products = await db.products.findMany();
  return <ProductList products={products} />;
}
```

The page is static, and after an hour the next visitor triggers a rebuild in the background. They still get the cached version instantly, and the following visitor gets the fresh one.

You get static performance with data that is never more than an hour stale.

### On demand revalidation

Even better, rebuild only when something actually changes.

```javascript
'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
export async function updateProduct(id, data) {
  await db.products.update({ where: { id }, data });
  revalidatePath(`/products/${id}`);
  revalidateTag('products');
}
```

Tag your fetches and invalidate by tag:

```javascript
const products = await fetch('https://api.example.com/products', {
  next: { tags: ['products'] }
});
```

Now the page is fully static until an editor changes something, at which point it updates within seconds. This is usually what content sites want.

## Partial prerendering

The newest option. One page, both strategies.

```javascript
import { Suspense } from 'react';
export const experimental_ppr = true;
export default function ProductPage({ params }) {
  return (
    <div>
      <Header />
      <ProductDetails params={params} />
      <Suspense fallback={<CartSkeleton />}>
        <UserCart />
      </Suspense>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <PersonalisedRecommendations />
      </Suspense>
    </div>
  );
}
```

The static shell, meaning the header and product details, is prerendered and served instantly from the CDN. The dynamic parts inside Suspense boundaries stream in per request.

Previously a page was static **or** dynamic. One personalised widget forced the whole page to render on every request. PPR removes that all or nothing choice.

Check the Next.js documentation for its current stability, as it has been moving.

## Choosing

| Page | Strategy |
| --- | --- |
| Marketing, about, docs | Static |
| Blog, product catalogue | ISR with on demand revalidation |
| Dashboard, account, cart | Dynamic |
| Product page with a cart widget | PPR |
| Search results | Dynamic |

The rule of thumb: **static unless it genuinely cannot be**, then ISR, then dynamic as a last resort.

## Checking what you got

```bash
npm run build
```

The build output marks every route:

```bash
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server rendered on demand
◐  (Partial)  prerendered with dynamic holes
```

Always look at this. It is easy to make a page dynamic by accident, most often by reading `cookies()` in a shared component, and the symbols tell you immediately.

## The caching gotcha

Next.js caching has changed several times across versions, and defaults have flipped. Do not trust a blog post from two years ago.

Check the version you are on and read its documentation. When behaviour surprises you, the build output and `revalidate` settings are the first things to look at.

## Quick recap

- Static generation builds at build time and is the fastest.
- `generateStaticParams` prebuilds dynamic routes.
- Reading cookies, headers or search params forces dynamic rendering.
- ISR keeps static speed with periodically refreshed data.
- On demand revalidation rebuilds only when the content changes.
- PPR serves a static shell with dynamic holes streamed in.
- Prefer static, then ISR, and use dynamic only when required.
- Read the build output to confirm what each route actually became.

<code id="code-content" class="language-javascript">
// ---------- STATIC: built once, served from a CDN ----------
export default async function AboutPage() {
  return &lt;h1&gt;About us&lt;/h1&gt;;
}
// ---------- STATIC dynamic routes: prebuild the known ids ----------
export async function generateStaticParams() {
  const products = await db.products.findMany({ select: { id: true } });
  return products.map((p) =&gt; ({ id: p.id }));
}
// ---------- ISR: static speed, data refreshed in the background -------
// The page is served instantly from cache. After an hour the next
// visitor triggers a rebuild, and the one after that gets fresh data.
export const revalidate = 3600;
export default async function ProductsPage() {
  const products = await fetch('https://api.example.com/products', {
    next: { tags: ['products'], revalidate: 3600 }   // tag it for later
  }).then((r) =&gt; r.json());
  return &lt;ul&gt;{products.map((p) =&gt; &lt;li key={p.id}&gt;{p.name}&lt;/li&gt;)}&lt;/ul&gt;;
}
// ---------- ON DEMAND: rebuild only when something actually changes ---
// 'use server';
// import { revalidatePath, revalidateTag } from 'next/cache';
// export async function updateProduct(id, data) {
//   await db.products.update({ where: { id }, data });
//   revalidateTag('products');            every page using that tag
//   revalidatePath('/products/' + id);    one specific route
// }
// ---------- DYNAMIC: forced by request specific data ----------
import { cookies } from 'next/headers';
export async function DashboardPage() {
  // Reading cookies, headers or searchParams makes the page dynamic,
  // because the output depends on who is asking
  const session = (await cookies()).get('session');
  const user = await getUser(session.value);
  return &lt;h1&gt;Welcome back, {user.name}&lt;/h1&gt;;
}
// Or force it explicitly:
//   export const dynamic = 'force-dynamic';
//   await fetch(url, { cache: 'no-store' });
// ---------- PPR: a static shell with dynamic holes ----------
import { Suspense } from 'react';
export const experimental_ppr = true;
export function ProductPage({ params }) {
  return (
    &lt;div&gt;
      {/* Prerendered, served instantly from the CDN */}
      &lt;Header /&gt;
      &lt;ProductDetails params={params} /&gt;
      {/* Streamed in per request, without making the whole page dynamic */}
      &lt;Suspense fallback={&lt;p&gt;Loading your cart...&lt;/p&gt;}&gt;
        &lt;UserCart /&gt;
      &lt;/Suspense&gt;
    &lt;/div&gt;
  );
}
// ALWAYS CHECK `npm run build` OUTPUT. It is easy to make a page dynamic
// by accident, usually by reading cookies() in a shared component.
//   circle  (Static)   prerendered
//   f       (Dynamic)  rendered per request
//   half    (Partial)  static shell with dynamic holes
</code></pre>

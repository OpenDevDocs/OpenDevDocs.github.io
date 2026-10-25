---
publishDate: 2026-05-28T10:21
title: Caching, Revalidation and Data Freshness
slug: caching-and-revalidation
metadescription: Understand every layer that caches your data, and decide deliberately how stale each piece is allowed to be.
updateDate: 2026-09-05T10:21
author: ['bishal-biswas']
level: 4
tags: ['caching', 'performance', 'architecture']
course: react
---

## The layers

Data passes through several caches, and a bug in any of them looks like "the app is showing old data".

1. **The browser HTTP cache**, driven by response headers.
2. **A service worker**, if you have one.
3. **A CDN**, between your server and the user.
4. **Framework caches**, such as Next.js route and data caches.
5. **The client cache**, such as TanStack Query.
6. **Component state**, holding a value after fetching.

When something is stale, work down the list. It is usually not the one you were thinking of.

## The central question

**How stale is this allowed to be?**

- A published article? Hours is fine.
- A product price? Minutes.
- Stock levels? Seconds.
- A chat message? Never.
- The user's own profile after they edit it? Never.

Answer it per resource, not once for the application. Treating everything the same means either stale prices or a hammered database.

## HTTP caching

```javascript
return Response.json(data, {
  headers: {
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
  }
});
```

- **`max-age=3600`** means fresh for an hour, served with no request.
- **`stale-while-revalidate=86400`** means for a day after that, serve the stale copy immediately and refresh in the background.

That combination gives instant responses and data that is never badly out of date.

For anything user specific:

```javascript
'Cache-Control': 'private, no-cache'
```

`private` stops a CDN caching it. **Getting this wrong serves one user's data to another**, which is the worst caching bug there is. Any response that depends on who is asking must be `private`.

### ETags

```javascript
const etag = `"${hash(data)}"`;
if (request.headers.get('if-none-match') === etag) {
  return new Response(null, { status: 304 });
}
return Response.json(data, { headers: { ETag: etag } });
```

A 304 sends no body at all, so unchanged data costs almost nothing.

## Client caching

```javascript
useQuery({
  queryKey: ['products', category],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000
});
```

**`staleTime`** is the one to think about. It defaults to `0`, meaning every mount refetches. That is safe and chatty.

Set it per resource:

```javascript
staleTime: Infinity
staleTime: 60 * 60 * 1000
staleTime: 30 * 1000
staleTime: 0
```

## Invalidating after a mutation

The most common freshness bug is forgetting this.

```javascript
const mutation = useMutation({
  mutationFn: updateProduct,
  onSuccess: (updated) => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.setQueryData(['product', updated.id], updated);
  }
});
```

Two complementary moves: **invalidate** the list so it refetches, and **set** the detail directly since you already have the new data.

Invalidation is prefix based, so `['products']` also invalidates `['products', 'books', 1]`. Design your keys hierarchically and this becomes easy:

```javascript
['products']
['products', category]
['products', category, page]
['product', id]
```

## Server side revalidation

```javascript
'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
export async function publishArticle(id) {
  await db.articles.update({ where: { id }, data: { published: true } });
  revalidateTag('articles');
  revalidatePath(`/articles/${id}`);
  revalidatePath('/');
}
```

Tag your fetches and invalidate by tag:

```javascript
const articles = await fetch('/api/articles', {
  next: { tags: ['articles'] }
});
```

The trap is forgetting a page. Publishing an article should refresh the article, the index, the sitemap and probably the home page. Missing one leaves a page that never updates, and nobody notices for weeks.

## Cache keys must include everything

```javascript
useQuery({
  queryKey: ['products'],
  queryFn: () => fetchProducts(category, page, sortBy)
});
useQuery({
  queryKey: ['products', category, page, sortBy],
  queryFn: () => fetchProducts(category, page, sortBy)
});
```

The first serves the wrong page's data when anything changes. Every input to the request belongs in the key.

The same applies to per user data:

```javascript
queryKey: ['cart']
queryKey: ['cart', userId]
```

Without the user id, signing in as someone else shows the previous user's cart. This is a real bug that reaches production regularly.

## Clear on sign out

```javascript
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  queryClient.clear();
  setUser(null);
}
```

Otherwise the next user on that machine sees cached private data.

## Immutable assets

```javascript
'Cache-Control': 'public, max-age=31536000, immutable'
```

A whole year, for files with a content hash in the name like `app.a3f9c2.js`. The hash changes when the content does, so the URL changes and the old cache entry is simply never requested again. Bundlers do this by default.

Never do it for HTML. That is how you strand users on an old version forever.

## Debugging stale data

1. **Hard refresh.** If that fixes it, the browser or a service worker.
2. **Check in an incognito window.** Also points at client caching.
3. **Look at the response headers** in the Network tab.
4. **Check for a CDN header** such as `x-cache: HIT`.
5. **Open the query DevTools** to see the cache state and staleness.
6. **Check your keys** include every input.

## Quick recap

- Several layers cache your data, and any of them can be the culprit.
- Decide how stale each resource may be, per resource.
- `stale-while-revalidate` gives instant responses with background refresh.
- Mark user specific responses `private`, or a CDN will leak them.
- Set `staleTime` deliberately, since the default is zero.
- Invalidate lists and set details after a mutation.
- Every input to a request belongs in the cache key, including the user id.
- Clear the cache on sign out.

<code id="code-content" class="language-javascript">
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// THE CENTRAL QUESTION, answered PER RESOURCE, not once for the app:
// how stale is this allowed to be?
function useProducts(category, page, sortBy) {
  return useQuery({
    // EVERY input to the request belongs in the key. Leaving one out
    // serves the wrong page's data when it changes.
    queryKey: ['products', category, page, sortBy],
    queryFn: () =&gt; fetchProducts(category, page, sortBy),
    staleTime: 5 * 60 * 1000        // default is 0, which refetches a lot
  });
}
// PER USER DATA MUST INCLUDE THE USER ID, or signing in as someone else
// shows the previous user's cart. This reaches production regularly.
function useCart(userId) {
  return useQuery({
    queryKey: ['cart', userId],
    queryFn: () =&gt; fetchCart(userId),
    staleTime: 0                    // never stale, it is their own data
  });
}
// After a mutation: INVALIDATE the list, and SET the detail directly
// since you already have the new data
function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: (updated) =&gt; {
      // Prefix based, so this also invalidates ['products', 'books', 1]
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.setQueryData(['product', updated.id], updated);
    }
  });
}
// CLEAR ON SIGN OUT, or the next user on that machine sees private data
async function logout(queryClient) {
  await fetch('/api/logout', { method: 'POST' });
  queryClient.clear();
}
// ---------- HTTP headers ----------
// Public and cacheable: instant response, refreshed in the background
//   Cache-Control: public, max-age=3600, stale-while-revalidate=86400
// User specific: `private` stops a CDN caching it. Getting this wrong
// serves one user's data to another, the worst caching bug there is.
//   Cache-Control: private, no-cache
// Hashed assets: a whole year is safe, because the URL changes when the
// content does. NEVER do this for HTML.
//   Cache-Control: public, max-age=31536000, immutable
// ---------- Server side revalidation ----------
// The trap is forgetting a page. Publishing should refresh the article,
// the index, the sitemap AND the home page.
// 'use server';
// export async function publishArticle(id) {
//   await db.articles.update({ where: { id }, data: { published: true } });
//   revalidateTag('articles');
//   revalidatePath('/articles/' + id);
//   revalidatePath('/');
// }
// DEBUGGING STALE DATA, in order: hard refresh, incognito, response
// headers, CDN x-cache header, query DevTools, then your cache keys.
</code></pre>

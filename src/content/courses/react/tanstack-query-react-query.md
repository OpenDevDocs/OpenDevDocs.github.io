---
publishDate: 2026-05-20T09:57
title: TanStack Query for Server State
slug: tanstack-query-react-query
metadescription: Cache, deduplicate, refetch and invalidate server data with the library that removed most data fetching boilerplate.
updateDate: 2026-09-05T09:57
author: ['bishal-biswas']
level: 3
tags: ['data', 'caching', 'tanstack-query']
course: react
---

## Server state is different

Client state is yours. You set it, you own it, it is always correct.

Server state is a **copy** of something you do not control. It can be out of date the moment it arrives. Someone else may have changed it. It needs caching, refetching and invalidating.

Treating them the same is why hand rolled fetching gets so complicated. TanStack Query, formerly React Query, exists specifically for the second kind.

## Setup

```bash
npm install @tanstack/react-query
```

```javascript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2
    }
  }
});
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shop />
    </QueryClientProvider>
  );
}
```

## Queries

```javascript
import { useQuery } from '@tanstack/react-query';
function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to load products');
      return response.json();
    }
  });
  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <ul>{data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

Compare that with the manual version from the fetching topic. The same lines, but you also get caching, deduplication, retries and background refetching.

Note `queryFn` must **throw** on failure. Returning a failed response means the query looks successful.

## Query keys

The key identifies the cached data. Everything hangs off it.

```javascript
useQuery({ queryKey: ['products'] });
useQuery({ queryKey: ['products', productId] });
useQuery({ queryKey: ['products', { category, page }] });
```

Anything in the key that changes triggers a refetch, so **every value the query depends on must be in it**.

```javascript
useQuery({
  queryKey: ['products'],
  queryFn: () => fetchProducts(category)
});
useQuery({
  queryKey: ['products', category],
  queryFn: () => fetchProducts(category)
});
```

The first serves stale data when the category changes. This is the most common mistake with the library.

## What you get for free

**Deduplication.** Three components asking for `['products']` produce one request.

**Caching.** Navigate away and back and the data is instantly there, then refreshed in the background.

**Refetch on focus.** Return to the tab and the data quietly updates.

**Retries** with exponential backoff.

**Garbage collection** of unused cache entries.

## staleTime and gcTime

The two settings worth understanding.

```javascript
useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000
});
```

**`staleTime`** is how long data is considered fresh. While fresh, it is served from cache with no request at all. The default is `0`, meaning always stale, which is why people see more requests than they expect.

**`gcTime`** is how long unused data stays in memory after the last component using it unmounts.

Tune `staleTime` to how often the data really changes. A product catalogue might use five minutes. A live price feed uses zero.

## Mutations

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
function AddProduct() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (product) =>
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      }).then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
  return (
    <button
      onClick={() => mutation.mutate({ name: 'New product' })}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Adding...' : 'Add'}
    </button>
  );
}
```

`invalidateQueries` marks matching queries stale, so any mounted component refetches. That is how the list updates itself after an add.

## Optimistic updates

```javascript
const mutation = useMutation({
  mutationFn: toggleTodo,
  onMutate: async (todoId) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previous = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], (old) =>
      old.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t))
    );
    return { previous };
  },
  onError: (error, todoId, context) => {
    queryClient.setQueryData(['todos'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  }
});
```

Four steps: cancel in flight refetches, snapshot the old data, apply the change, and restore the snapshot if it fails. `onSettled` refetches either way so the cache matches the server.

More ceremony than `useOptimistic`, and more control.

## Dependent queries

```javascript
const { data: user } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId)
});
const { data: posts } = useQuery({
  queryKey: ['posts', user?.id],
  queryFn: () => fetchPosts(user.id),
  enabled: Boolean(user?.id)
});
```

`enabled` holds the second query until the first has produced an id.

## Pagination and infinite lists

```javascript
const { data } = useQuery({
  queryKey: ['products', page],
  queryFn: () => fetchProducts(page),
  placeholderData: (previous) => previous
});
```

`placeholderData` keeps the previous page visible while the next loads, instead of flashing a spinner.

```javascript
import { useInfiniteQuery } from '@tanstack/react-query';
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['products'],
  queryFn: ({ pageParam }) => fetchProducts(pageParam),
  initialPageParam: 1,
  getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined
});
```

## With Suspense

```javascript
import { useSuspenseQuery } from '@tanstack/react-query';
function ProductList() {
  const { data } = useSuspenseQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });
  return <ul>{data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

No `isLoading` and no `error` check. The nearest Suspense boundary handles loading and the error boundary handles failure. `data` is guaranteed to exist.

## Do you still need it?

With a framework, Server Components and loaders cover much of this. The data is fetched on the server and revalidated after mutations, so you may not need a client cache at all.

TanStack Query still earns its place when:

- You are building a client rendered app, such as a Vite dashboard.
- The same data appears across many routes and should be cached in the browser.
- You need polling, offline support or optimistic updates with fine control.
- The app is highly interactive, with data changing constantly.

For a mostly static content site with a framework, you probably do not need it.

## Quick recap

- Server state needs caching and revalidation, which client state does not.
- `queryKey` identifies cached data, so include every dependency.
- `queryFn` must throw on failure.
- `staleTime` controls freshness, `gcTime` controls memory.
- You get deduplication, retries and refetch on focus for free.
- Mutations invalidate query keys to refresh the interface.
- `enabled` gates dependent queries, `placeholderData` avoids page flashes.
- With Server Components you may not need it at all.

<code id="code-content" class="language-javascript">
import {
  useQuery, useMutation, useQueryClient, useSuspenseQuery
} from '@tanstack/react-query';
function ProductList({ category }) {
  const { data, isLoading, isFetching, error } = useQuery({
    // EVERY dependency must be in the key, or you serve stale data when
    // the category changes. This is the commonest mistake.
    queryKey: ['products', category],
    queryFn: async () =&gt; {
      const response = await fetch('/api/products?category=' + category);
      // queryFn must THROW on failure, or the query looks successful
      if (!response.ok) throw new Error('Failed to load products');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,      // fresh for 5 minutes, no refetch
    gcTime: 10 * 60 * 1000         // kept in memory 10 minutes after unmount
  });
  if (isLoading) return &lt;p&gt;Loading...&lt;/p&gt;;
  if (error) return &lt;p&gt;{error.message}&lt;/p&gt;;
  // isFetching is true on a background refetch, so dim rather than blank
  return (
    &lt;ul style={{ opacity: isFetching ? 0.6 : 1 }}&gt;
      {data.map((p) =&gt; &lt;li key={p.id}&gt;{p.name}&lt;/li&gt;)}
    &lt;/ul&gt;
  );
}
function AddProduct() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (product) =&gt;
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      }).then((r) =&gt; {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      }),
    // Invalidating marks the list stale, so it refetches by itself
    onSuccess: () =&gt; queryClient.invalidateQueries({ queryKey: ['products'] })
  });
  return (
    &lt;button onClick={() =&gt; mutation.mutate({ name: 'New' })}
            disabled={mutation.isPending}&gt;
      {mutation.isPending ? 'Adding...' : 'Add'}
    &lt;/button&gt;
  );
}
// OPTIMISTIC UPDATE: cancel, snapshot, apply, roll back on error
function useToggleTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleTodo,
    onMutate: async (todoId) =&gt; {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previous = queryClient.getQueryData(['todos']);
      queryClient.setQueryData(['todos'], (old) =&gt;
        old.map((t) =&gt; (t.id === todoId ? { ...t, done: !t.done } : t))
      );
      return { previous };
    },
    onError: (error, id, context) =&gt;
      queryClient.setQueryData(['todos'], context.previous),
    onSettled: () =&gt; queryClient.invalidateQueries({ queryKey: ['todos'] })
  });
}
// DEPENDENT queries: hold the second until the first has an id
function UserPosts({ userId }) {
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () =&gt; fetchUser(userId)
  });
  const { data: posts } = useQuery({
    queryKey: ['posts', user?.id],
    queryFn: () =&gt; fetchPosts(user.id),
    enabled: Boolean(user?.id)
  });
  return &lt;p&gt;{posts?.length ?? 0} posts&lt;/p&gt;;
}
// WITH SUSPENSE: no isLoading, no error check, data always exists
function SuspenseList() {
  const { data } = useSuspenseQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });
  return &lt;ul&gt;{data.map((p) =&gt; &lt;li key={p.id}&gt;{p.name}&lt;/li&gt;)}&lt;/ul&gt;;
}
</code></pre>

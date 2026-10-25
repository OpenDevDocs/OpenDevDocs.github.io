---
publishDate: 2026-05-13T09:37
title: Loading, Error and Empty States
slug: loading-and-error-states
metadescription: Handle the four states every data driven component has, and design loading and empty screens that do not feel broken.
updateDate: 2026-09-05T09:37
author: ['bishal-biswas']
level: 2
tags: ['data', 'ux', 'patterns']
course: react
---

## Four states, not one

Every component that loads data has four possible states, and beginners usually build only one.

1. **Loading**: the request is in flight.
2. **Error**: it failed.
3. **Empty**: it succeeded but there is nothing to show.
4. **Success**: there is data.

Skip the empty state and users see a blank area and assume the app is broken. Skip the error state and they see a spinner forever.

```javascript
function ProductList({ category }) {
  const { data, isLoading, error } = useProducts(category);
  if (isLoading) return <ProductListSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (data.length === 0) return <EmptyState category={category} />;
  return (
    <ul>
      {data.map((p) => <ProductCard key={p.id} product={p} />)}
    </ul>
  );
}
```

Early returns in that order. Handle the exceptional cases first, and the success case stays clean.

## Loading states

### Skeletons beat spinners

```javascript
function ProductListSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading products">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="skeleton-card" />
      ))}
    </ul>
  );
}
```

A skeleton shaped like the real content tells the user what is coming and stops the layout jumping when the data arrives. A centred spinner tells them nothing and usually causes a shift.

Note `aria-busy` and the label, so screen readers announce the wait rather than reading an empty region.

### Do not flash for fast requests

If the data arrives in 80ms, showing a spinner for 80ms is worse than showing nothing. The flash reads as a glitch.

```javascript
function useDelayedLoading(isLoading, delay = 200) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShow(false);
      return;
    }
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [isLoading, delay]);
  return show;
}
```

Only show the indicator if loading is still happening after 200ms.

### Keep old data while refetching

```javascript
function SearchResults({ query }) {
  const { data, isFetching } = useSearch(query);
  return (
    <div style={{ opacity: isFetching ? 0.6 : 1 }}>
      {data.map((r) => <Result key={r.id} result={r} />)}
    </div>
  );
}
```

Distinguish "loading for the first time" from "refetching". On a refetch, dim the existing results rather than replacing them. This is the same principle as `isPending` in transitions.

## Error states

### Say something useful

```javascript
function ErrorMessage({ error, onRetry }) {
  return (
    <div role="alert" className="error">
      <p>We could not load this right now.</p>
      <button onClick={onRetry}>Try again</button>
    </div>
  );
}
```

Three things matter:

- **Plain language.** "Request failed with status 500" means nothing to a user.
- **A way forward.** A retry button, or a link somewhere useful.
- **`role="alert"`**, so screen readers announce it.

### Do not leak internals

```javascript
<p>{error.message}</p>
<p>We could not load this right now.</p>
```

Raw error messages can expose stack traces, internal URLs or database details. Log the real error and show a friendly one.

```javascript
function ErrorMessage({ error }) {
  useEffect(() => {
    console.error(error);
    reportToMonitoring(error);
  }, [error]);
  return <p role="alert">Something went wrong.</p>;
}
```

### Distinguish error types

```javascript
function ErrorMessage({ error, onRetry }) {
  if (error.status === 404) {
    return <p>We could not find that.</p>;
  }
  if (error.status === 403) {
    return <p>You do not have permission to view this.</p>;
  }
  if (!navigator.onLine) {
    return <p>You appear to be offline. Check your connection.</p>;
  }
  return (
    <div role="alert">
      <p>Something went wrong.</p>
      <button onClick={onRetry}>Try again</button>
    </div>
  );
}
```

A 404 is not retryable, so offering a retry button is misleading. Match the message to the cause.

## Empty states

The most neglected of the four, and often the most valuable.

```javascript
function EmptyState({ category, onClear }) {
  return (
    <div className="empty">
      <h3>No products in {category}</h3>
      <p>Try a different category or clear your filters.</p>
      <button onClick={onClear}>Clear filters</button>
    </div>
  );
}
```

Distinguish two very different empties:

**Nothing yet**, for a new user. This is an opportunity to explain the feature and offer a first action.

```javascript
function NoTodos() {
  return (
    <div className="empty">
      <h3>No todos yet</h3>
      <p>Add your first task to get started.</p>
      <button onClick={onAdd}>Add a task</button>
    </div>
  );
}
```

**Nothing matching**, after a search or filter. Here the user had expectations, so help them adjust.

```javascript
function NoResults({ query, onClear }) {
  return (
    <div className="empty">
      <h3>No results for "{query}"</h3>
      <p>Check the spelling, or try a broader search.</p>
      <button onClick={onClear}>Clear search</button>
    </div>
  );
}
```

Same blank screen, completely different message.

## Extracting the pattern

Once you have written this five times, wrap it.

```javascript
function AsyncBoundary({ isLoading, error, isEmpty, skeleton, empty, onRetry, children }) {
  if (isLoading) return skeleton ?? <Spinner />;
  if (error) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (isEmpty) return empty ?? <p>Nothing to show.</p>;
  return children;
}
function ProductList({ category }) {
  const { data, isLoading, error, refetch } = useProducts(category);
  return (
    <AsyncBoundary
      isLoading={isLoading}
      error={error}
      isEmpty={data?.length === 0}
      skeleton={<ProductListSkeleton />}
      empty={<EmptyState category={category} />}
      onRetry={refetch}
    >
      <ul>{data?.map((p) => <ProductCard key={p.id} product={p} />)}</ul>
    </AsyncBoundary>
  );
}
```

Consistent handling everywhere, and impossible to forget a state.

Note the caveat: `children` is evaluated even while loading, so use optional chaining inside it or accept a render function instead.

## With Suspense

Suspense and error boundaries move loading and error handling up the tree, but **the empty state stays with you**. React has no idea whether an empty array means anything.

```javascript
function ProductList({ productsPromise }) {
  const products = use(productsPromise);
  if (products.length === 0) return <EmptyState />;
  return <ul>{products.map((p) => <ProductCard key={p.id} product={p} />)}</ul>;
}
```

## Quick recap

- Every data component has loading, error, empty and success states.
- Handle them with early returns, in that order.
- Skeletons shaped like the content beat spinners.
- Delay the loading indicator so fast requests do not flash.
- Dim existing content on a refetch rather than replacing it.
- Show plain language errors, log the real one, and offer a way forward.
- Distinguish "nothing yet" from "nothing matching".
- Suspense handles loading and errors, but never the empty state.

<code id="code-content" class="language-javascript">
import { useState, useEffect } from 'react';
// Every data component has FOUR states. Handle them with early returns,
// exceptional cases first, so the success case stays clean.
export default function ProductList({ category }) {
  const { data, isLoading, isFetching, error, refetch } = useProducts(category);
  if (isLoading) return &lt;ProductListSkeleton /&gt;;
  if (error) return &lt;ErrorMessage error={error} onRetry={refetch} /&gt;;
  if (data.length === 0) return &lt;EmptyState category={category} /&gt;;
  return (
    // Dim on a REFETCH rather than replacing content the user is reading
    &lt;ul style={{ opacity: isFetching ? 0.6 : 1 }}&gt;
      {data.map((p) =&gt; &lt;li key={p.id}&gt;{p.name}&lt;/li&gt;)}
    &lt;/ul&gt;
  );
}
// A skeleton shaped like the real content stops the layout jumping,
// and aria-busy tells screen readers what is happening
function ProductListSkeleton() {
  return (
    &lt;ul aria-busy="true" aria-label="Loading products"&gt;
      {Array.from({ length: 6 }, (_, i) =&gt; (
        &lt;li key={i} className="skeleton-card" /&gt;
      ))}
    &lt;/ul&gt;
  );
}
// Do not flash a spinner for an 80ms request. Only show it if loading
// is still happening after a short delay.
function useDelayedLoading(isLoading, delay = 200) {
  const [show, setShow] = useState(false);
  useEffect(() =&gt; {
    if (!isLoading) { setShow(false); return; }
    const id = setTimeout(() =&gt; setShow(true), delay);
    return () =&gt; clearTimeout(id);
  }, [isLoading, delay]);
  return show;
}
// Plain language, a way forward, and role="alert" so it is announced.
// Log the real error, never show it: raw messages leak internals.
function ErrorMessage({ error, onRetry }) {
  useEffect(() =&gt; { console.error(error); }, [error]);
  if (error.status === 404) return &lt;p&gt;We could not find that.&lt;/p&gt;;
  if (error.status === 403) return &lt;p&gt;You do not have permission.&lt;/p&gt;;
  if (!navigator.onLine) return &lt;p&gt;You appear to be offline.&lt;/p&gt;;
  return (
    &lt;div role="alert"&gt;
      &lt;p&gt;We could not load this right now.&lt;/p&gt;
      &lt;button onClick={onRetry}&gt;Try again&lt;/button&gt;
    &lt;/div&gt;
  );
}
// "Nothing yet" and "nothing matching" are completely different messages
function EmptyState({ category, query, onClear }) {
  if (query) {
    return (
      &lt;div className="empty"&gt;
        &lt;h3&gt;No results for "{query}"&lt;/h3&gt;
        &lt;p&gt;Check the spelling, or try a broader search.&lt;/p&gt;
        &lt;button onClick={onClear}&gt;Clear search&lt;/button&gt;
      &lt;/div&gt;
    );
  }
  return (
    &lt;div className="empty"&gt;
      &lt;h3&gt;Nothing in {category} yet&lt;/h3&gt;
      &lt;p&gt;Add your first item to get started.&lt;/p&gt;
    &lt;/div&gt;
  );
}
// Suspense moves loading and errors up the tree, but the EMPTY state
// always stays with you. React cannot know an empty array means anything.
</code></pre>

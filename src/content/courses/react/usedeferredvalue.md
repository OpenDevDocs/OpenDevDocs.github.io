---
publishDate: 2026-05-22T10:03
title: useDeferredValue
slug: usedeferredvalue
metadescription: Let an expensive part of the interface lag behind slightly so the responsive part stays instant.
updateDate: 2026-09-05T10:03
author: ['bishal-biswas']
level: 3
tags: ['hooks', 'performance', 'concurrency']
course: react
---

## What it does

`useDeferredValue` gives you a copy of a value that updates **later**.

```javascript
import { useDeferredValue } from 'react';
const deferredQuery = useDeferredValue(query);
```

When `query` changes, React first renders with the **old** `deferredQuery`, quickly. Then it renders again with the new one at low priority, and can interrupt that second render if something more urgent arrives.

## The typical use

```javascript
function Search({ items }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = items.filter((i) =>
    i.name.toLowerCase().includes(deferredQuery.toLowerCase())
  );
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ResultList results={results} />
    </div>
  );
}
```

The input uses `query`, so typing is instant. The list uses `deferredQuery`, so it lags by a render and can be interrupted by the next keystroke.

Without this, every keystroke blocks on filtering the whole list, and the input visibly stutters.

## Showing staleness

```javascript
function Search({ items }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  const results = items.filter((i) => i.name.includes(deferredQuery));
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <ResultList results={results} />
      </div>
    </div>
  );
}
```

Comparing the two values tells you whether what is on screen is up to date. Dimming is honest and much better than a spinner, because the old results are still useful while the new ones prepare.

## An initial value

```javascript
const deferredQuery = useDeferredValue(query, '');
```

The second argument is what to use on the very first render. Without it, the first render uses the current value, which may be expensive. With it, React renders the cheap version first and then the real one.

## It needs memoization to help

This is the part people miss.

```javascript
function Search({ items }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = items.filter((i) => i.name.includes(deferredQuery));
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>{results.map((r) => <ExpensiveRow key={r.id} item={r} />)}</ul>
    </div>
  );
}
```

The urgent render still runs `items.filter` and re-renders every row, because nothing tells React those are unchanged.

With `memo`, the rows are skipped during the urgent render:

```javascript
const ExpensiveRow = memo(function ExpensiveRow({ item }) {
  return <li>{item.name}</li>;
});
```

Or extract the whole expensive part:

```javascript
const ResultList = memo(function ResultList({ query, items }) {
  const results = items.filter((i) => i.name.includes(query));
  return <ul>{results.map((r) => <li key={r.id}>{r.name}</li>)}</ul>;
});
function Search({ items }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ResultList query={deferredQuery} items={items} />
    </div>
  );
}
```

With the React Compiler enabled this happens automatically. Without it, the `memo` is required for `useDeferredValue` to do anything.

## With Suspense

```javascript
function SearchResults({ query }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  return (
    <div style={{ opacity: isStale ? 0.6 : 1 }}>
      <Suspense fallback={<Skeleton />}>
        <Results query={deferredQuery} />
      </Suspense>
    </div>
  );
}
```

If `Results` suspends when the query changes, React keeps showing the previous results rather than falling back to the skeleton. Only the very first load shows the skeleton.

## Not a debounce

They look similar and work differently.

**Debounce** waits a fixed time. Type for two seconds without pausing and nothing happens at all. On a fast machine, the delay is pure waste.

**`useDeferredValue`** has no timer. It renders as soon as React has capacity, so a fast machine feels immediate and a slow one degrades gracefully. It also cancels interrupted work rather than queuing it.

Debouncing is still right when the work has a **cost outside rendering**, such as a network request. Do not fire an API call on every keystroke just because rendering is cheap.

Both together is a reasonable combination: debounce the request, defer the render.

## `useDeferredValue` or `useTransition`?

They solve the same problem from opposite ends.

**`useTransition`** wraps the update. Use it when you control the `setState` call, and you want `isPending`.

**`useDeferredValue`** wraps the value. Use it when the value arrives as a prop, or when you would otherwise need two pieces of state.

```javascript
const [query, setQuery] = useState('');
const [filter, setFilter] = useState('');
const [isPending, startTransition] = useTransition();
```

```javascript
const [query, setQuery] = useState('');
const deferredQuery = useDeferredValue(query);
```

The second is less code for the same result, which is why it is often the better choice for derived rendering.

## Quick recap

- `useDeferredValue` returns a copy that updates at low priority.
- Keep the input on the live value and the expensive part on the deferred one.
- Compare the two to detect staleness and dim the content.
- A second argument sets the value for the first render.
- It needs `memo` to help, unless the compiler is enabled.
- With Suspense it keeps old content instead of showing the fallback.
- It is not a debounce, and debouncing is still right for network calls.
- Use it when the value comes to you, and `useTransition` when you set it.

<code id="code-content" class="language-javascript">
import { useState, useDeferredValue, memo, Suspense } from 'react';
// The expensive part MUST be memoised, or the urgent render re-does all
// the work anyway and deferring achieves nothing. The React Compiler
// does this for you when it is enabled.
const ResultList = memo(function ResultList({ query, items }) {
  const results = items.filter((i) =&gt;
    i.name.toLowerCase().includes(query.toLowerCase())
  );
  if (results.length === 0) return &lt;p&gt;No matches for "{query}"&lt;/p&gt;;
  return &lt;ul&gt;{results.map((r) =&gt; &lt;li key={r.id}&gt;{r.name}&lt;/li&gt;)}&lt;/ul&gt;;
});
export default function Search({ items }) {
  const [query, setQuery] = useState('');
  // The deferred copy updates LATER, at low priority, and React can
  // interrupt that render when the next keystroke arrives.
  const deferredQuery = useDeferredValue(query);
  // Comparing the two tells you whether the screen is up to date
  const isStale = query !== deferredQuery;
  return (
    &lt;div&gt;
      {/* The input uses the LIVE value, so typing is always instant */}
      &lt;input
        value={query}
        onChange={(e) =&gt; setQuery(e.target.value)}
        placeholder="Search..."
      /&gt;
      {/* Dim the stale results. Honest, and far better than replacing
          useful content with a spinner. */}
      &lt;div style={{ opacity: isStale ? 0.6 : 1, transition: 'opacity .2s' }}&gt;
        &lt;ResultList query={deferredQuery} items={items} /&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
}
// With Suspense, React keeps the PREVIOUS results on screen instead of
// falling back to the skeleton. Only the first load shows it.
function SuspenseSearch({ query }) {
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  return (
    &lt;div style={{ opacity: isStale ? 0.6 : 1 }}&gt;
      &lt;Suspense fallback={&lt;p&gt;Loading...&lt;/p&gt;}&gt;
        &lt;AsyncResults query={deferredQuery} /&gt;
      &lt;/Suspense&gt;
    &lt;/div&gt;
  );
}
// NOT A DEBOUNCE.
//   debounce            waits a fixed time, so a fast machine still waits
//   useDeferredValue    renders as soon as React has capacity, and
//                       cancels interrupted work instead of queuing it
// Debouncing is still right when the work costs something OUTSIDE
// rendering, such as a network request. A sensible combination is to
// debounce the request and defer the render.
// useTransition wraps the UPDATE, useDeferredValue wraps the VALUE:
//   const [q, setQ] = useState('');
//   const [f, setF] = useState('');
//   const [isPending, startTransition] = useTransition();   two states
// versus
//   const [q, setQ] = useState('');
//   const deferred = useDeferredValue(q);                   one state
</code></pre>

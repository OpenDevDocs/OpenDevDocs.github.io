---
publishDate: 2026-05-11T09:30
title: useTransition and Pending UI
slug: usetransition-and-pending-ui
metadescription: Keep interfaces responsive by marking updates as non urgent, and show pending state without janky spinners.
updateDate: 2026-09-05T09:30
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'performance', 'concurrency']
course: react
---

## Urgent and non urgent updates

Some updates must happen immediately. Typing in a field, toggling a checkbox, opening a menu. If those lag, the app feels broken.

Others can wait a moment. Filtering ten thousand rows, switching a heavy tab, rendering a chart.

React cannot tell them apart on its own. `useTransition` is how you say which is which.

```javascript
import { useTransition } from 'react';
const [isPending, startTransition] = useTransition();
```

## The problem it solves

```javascript
function SlowSearch({ items }) {
  const [query, setQuery] = useState('');
  const results = items.filter((i) => i.name.includes(query));
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {results.map((i) => <SlowRow key={i.id} item={i} />)}
      </ul>
    </div>
  );
}
```

With enough rows, every keystroke blocks while React re-renders the whole list. The input stops keeping up with typing, which users notice immediately.

## The fix

```javascript
function FastSearch({ items }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [isPending, startTransition] = useTransition();
  function handleChange(event) {
    setQuery(event.target.value);
    startTransition(() => {
      setFilter(event.target.value);
    });
  }
  const results = items.filter((i) => i.name.includes(filter));
  return (
    <div>
      <input value={query} onChange={handleChange} />
      <ul style={{ opacity: isPending ? 0.6 : 1 }}>
        {results.map((i) => <SlowRow key={i.id} item={i} />)}
      </ul>
    </div>
  );
}
```

Two pieces of state. `query` drives the input and updates urgently. `filter` drives the list and updates in a transition.

React can now **interrupt** the list render when the next keystroke arrives, so the input never blocks.

## What "interruptible" really means

Without a transition, React renders the whole tree in one uninterruptible pass. The browser cannot respond to anything until it finishes.

Inside a transition, React can pause the work, handle the urgent update, and resume. If the transition becomes stale, it is thrown away entirely.

This is what "concurrent rendering" means in practice.

## Showing pending state well

`isPending` is true while the transition is in flight. How you show that matters.

### Dim the stale content

```javascript
<div style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.2s' }}>
  <ResultList results={results} />
</div>
```

The old results stay visible while the new ones prepare. This usually feels better than a spinner, because the user still has something to read.

### A subtle indicator

```javascript
<div>
  <input value={query} onChange={handleChange} />
  {isPending && <span className="spinner-small" />}
</div>
```

### Disable the trigger

```javascript
<button onClick={handleClick} disabled={isPending}>
  {isPending ? 'Saving...' : 'Save'}
</button>
```

> **Avoid replacing content with a spinner.** Removing what the user was reading and showing a spinner is worse than showing slightly stale data. That is the whole reason `isPending` exists rather than just unmounting.

## Transitions with async work

React 19 lets the transition function be async, which makes it work for data too.

```javascript
function TabPanel() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();
  function selectTab(next) {
    startTransition(async () => {
      const data = await loadTabData(next);
      setTab(next);
      setData(data);
    });
  }
  return (
    <div>
      <button onClick={() => selectTab('profile')} disabled={isPending}>
        Profile
      </button>
      <Panel tab={tab} />
    </div>
  );
}
```

The old tab stays on screen until the new one is ready, so there is no flash of empty state.

## useDeferredValue as an alternative

```javascript
import { useDeferredValue } from 'react';
function Search({ items }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = items.filter((i) => i.name.includes(deferredQuery));
  const isStale = query !== deferredQuery;
  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul style={{ opacity: isStale ? 0.6 : 1 }}>
        {results.map((i) => <li key={i.id}>{i.name}</li>)}
      </ul>
    </div>
  );
}
```

Same result with one piece of state instead of two. React keeps the deferred value behind while urgent work happens.

**Use `useTransition`** when you control the update, as in a click handler.

**Use `useDeferredValue`** when a value arrives as a prop, or when you want to defer rendering derived from state you do not set yourself.

## Do not reach for it too early

Transitions solve **slow rendering**. They do not solve:

- A slow network. Use Suspense or a data library.
- A genuinely expensive calculation. Use `useMemo` or move it off the main thread.
- Rendering ten thousand rows. Use virtualisation.

Measure first. If your list is fast, a transition adds complexity for nothing.

## Standalone startTransition

```javascript
import { startTransition } from 'react';
startTransition(() => {
  setSomething(value);
});
```

You can import `startTransition` directly when you do not need `isPending`. Handy outside components, such as in a store subscription.

## Quick recap

- `useTransition` marks updates as non urgent so React can interrupt them.
- Keep input state urgent and put the expensive consequence in the transition.
- `isPending` tells you to show a subtle indicator.
- Dim stale content rather than replacing it with a spinner.
- React 19 transitions accept async functions.
- `useDeferredValue` does the same job with one piece of state.
- Transitions fix slow rendering, not slow networks or heavy computation.

<code id="code-content" class="language-javascript">
import { useState, useTransition, useDeferredValue } from 'react';
// TWO pieces of state: one urgent for the input, one deferred for the
// expensive list. React can interrupt the list when the next keystroke
// arrives, so typing never blocks.
function FastSearch({ items }) {
  const [query, setQuery] = useState('');       // urgent
  const [filter, setFilter] = useState('');     // non urgent
  const [isPending, startTransition] = useTransition();
  function handleChange(event) {
    const next = event.target.value;
    setQuery(next);                             // instant
    startTransition(() =&gt; setFilter(next));     // interruptible
  }
  const results = items.filter((i) =&gt; i.name.includes(filter));
  return (
    &lt;div&gt;
      &lt;input value={query} onChange={handleChange} /&gt;
      {/* Dim the stale results rather than replacing them with a
          spinner. Slightly old data beats an empty screen. */}
      &lt;ul style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity .2s' }}&gt;
        {results.map((i) =&gt; &lt;li key={i.id}&gt;{i.name}&lt;/li&gt;)}
      &lt;/ul&gt;
    &lt;/div&gt;
  );
}
// useDeferredValue does the same job with ONE piece of state
function SearchDeferred({ items }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;
  const results = items.filter((i) =&gt; i.name.includes(deferredQuery));
  return (
    &lt;div&gt;
      &lt;input value={query} onChange={(e) =&gt; setQuery(e.target.value)} /&gt;
      &lt;ul style={{ opacity: isStale ? 0.6 : 1 }}&gt;
        {results.map((i) =&gt; &lt;li key={i.id}&gt;{i.name}&lt;/li&gt;)}
      &lt;/ul&gt;
    &lt;/div&gt;
  );
}
// React 19: an async transition keeps the OLD tab on screen until the
// new one is ready, so there is no flash of empty state
export default function TabPanel() {
  const [tab, setTab] = useState('home');
  const [data, setData] = useState(null);
  const [isPending, startTransition] = useTransition();
  function selectTab(next) {
    startTransition(async () =&gt; {
      const loaded = await loadTabData(next);
      setTab(next);
      setData(loaded);
    });
  }
  return (
    &lt;div&gt;
      &lt;button onClick={() =&gt; selectTab('home')} disabled={isPending}&gt;Home&lt;/button&gt;
      &lt;button onClick={() =&gt; selectTab('profile')} disabled={isPending}&gt;
        {isPending ? 'Loading...' : 'Profile'}
      &lt;/button&gt;
      &lt;section style={{ opacity: isPending ? 0.6 : 1 }}&gt;
        &lt;h2&gt;{tab}&lt;/h2&gt;
      &lt;/section&gt;
    &lt;/div&gt;
  );
}
// Use useTransition when YOU trigger the update, and useDeferredValue
// when the value arrives from elsewhere.
// Transitions fix slow RENDERING. They do not speed up the network,
// heavy computation, or rendering ten thousand rows.
</code></pre>

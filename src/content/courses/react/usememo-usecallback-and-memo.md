---
publishDate: 2026-05-21T09:59
title: memo, useMemo and useCallback in the Compiler Era
slug: usememo-usecallback-and-memo
metadescription: Understand what the three memoization tools actually do, when they help, and why most manual use is now unnecessary.
updateDate: 2026-09-05T09:59
author: ['bishal-biswas']
level: 3
tags: ['performance', 'hooks', 'memoization']
course: react
---

## Why they exist

When a component re-renders, everything inside it is recreated: objects, arrays and functions are all new references.

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const config = { theme: 'dark' };
  function handleClick() {}
  return <Child config={config} onClick={handleClick} />;
}
```

Every render gives `Child` a brand new `config` and `handleClick`, even though nothing about them changed.

For a normal component that is harmless. It matters when `Child` compares props to decide whether to re-render, or when those values feed a dependency array.

## `memo`

Skips re-rendering when props are shallowly equal.

```javascript
import { memo } from 'react';
const ExpensiveList = memo(function ExpensiveList({ items, onSelect }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i.id} onClick={() => onSelect(i.id)}>{i.name}</li>
      ))}
    </ul>
  );
});
```

Now `ExpensiveList` re-renders only when `items` or `onSelect` actually differ.

**Shallow** is the key word. It compares with `Object.is`, so a new object with identical contents still counts as different. Which is exactly why `memo` alone usually does nothing:

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const items = [{ id: 1 }];
  return <ExpensiveList items={items} onSelect={handleSelect} />;
}
```

`items` is new every render, so `memo` never skips anything. You have added a comparison and gained nothing.

## `useMemo`

Caches a **value** between renders.

```javascript
const visible = useMemo(
  () => products.filter((p) => p.category === filter),
  [products, filter]
);
```

Two uses:

**Skipping expensive work.**

```javascript
const sorted = useMemo(
  () => hugeArray.toSorted((a, b) => a.value - b.value),
  [hugeArray]
);
```

**Keeping a reference stable**, so a memoised child or a dependency array sees no change.

```javascript
const config = useMemo(() => ({ theme, locale }), [theme, locale]);
return <MemoisedChild config={config} />;
```

## `useCallback`

The same thing for functions.

```javascript
const handleSelect = useCallback((id) => {
  setSelected(id);
}, []);
```

`useCallback(fn, deps)` is exactly `useMemo(() => fn, deps)`, with nicer syntax.

## They only work together

This is the part people miss. All three are needed, or none of them help.

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const filtered = items.filter((i) => i.active);
  const handleSelect = (id) => setSelected(id);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <MemoisedList items={filtered} onSelect={handleSelect} />
    </>
  );
}
```

`filtered` and `handleSelect` are new every render, so `MemoisedList` re-renders anyway. The `memo` is pure overhead.

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const filtered = useMemo(() => items.filter((i) => i.active), [items]);
  const handleSelect = useCallback((id) => setSelected(id), []);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <MemoisedList items={filtered} onSelect={handleSelect} />
    </>
  );
}
```

Now clicking the counter does not re-render the list. Three tools, one outcome, and missing any one of them makes the other two pointless.

That fragility is exactly why the compiler is such an improvement.

## The compiler changes the default

With the React Compiler enabled, all of that is inserted for you:

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const filtered = items.filter((i) => i.active);
  const handleSelect = (id) => setSelected(id);
  return (
    <>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <List items={filtered} onSelect={handleSelect} />
    </>
  );
}
```

No `memo`, no `useMemo`, no `useCallback`, and the same behaviour. **This is the default you should write in a new project.**

## When you still need them by hand

**When the compiler is not enabled.** Plenty of projects are not on it yet.

**When the compiler skips the component.** The linter tells you which.

**For a value in an effect dependency array you care about.**

```javascript
const options = useMemo(() => ({ userId, includeArchived }), [userId, includeArchived]);
useEffect(() => {
  subscribe(options);
}, [options]);
```

Being explicit here is clearer than relying on the compiler.

**For a genuinely expensive calculation.** The compiler memoizes by render, not by cost. If something takes 200ms, measure it and consider whether it belongs on the main thread at all.

**For a library boundary**, where a third party component compares props and you cannot see how.

## Do not memoize everything

```javascript
const doubled = useMemo(() => count * 2, [count]);
const name = useMemo(() => `${first} ${last}`, [first, last]);
const handleClick = useCallback(() => setOpen(true), []);
```

Each one costs a comparison, an entry in the hook list, and memory. For trivial values that costs more than it saves.

Multiplying a number is faster than checking whether you need to multiply a number.

## Measure first

```javascript
console.time('filter');
const result = items.filter(expensivePredicate);
console.timeEnd('filter');
```

The React DevTools Profiler shows which components re-render and how long each takes. If a component takes 0.3ms, memoizing it is not the win you are looking for.

Common real causes of slowness, in rough order:

1. Too much JavaScript downloaded.
2. Unoptimised images.
3. Waterfalling requests.
4. Bad algorithms.
5. Rendering thousands of DOM nodes.
6. Missing memoization.

That last one is genuinely last.

## Quick recap

- `memo` skips re-renders on shallowly equal props.
- `useMemo` caches a value, `useCallback` caches a function.
- All three must be used together, or none of them help.
- The compiler does all of this automatically, so write plain code.
- Keep manual memoization for effect dependencies and genuinely expensive work.
- Memoizing trivial values costs more than it saves.
- Profile before optimising, because memoization is rarely the bottleneck.

<code id="code-content" class="language-javascript">
import { memo, useMemo, useCallback, useState } from 'react';
// THE FRAGILE PART: all three must line up, or none of them help.
const MemoisedList = memo(function List({ items, onSelect }) {
  console.log('List rendered');
  return &lt;ul&gt;{items.map((i) =&gt; &lt;li key={i.id}&gt;{i.name}&lt;/li&gt;)}&lt;/ul&gt;;
});
// BROKEN: memo compares with Object.is, and both props are NEW objects
// every render, so the list re-renders anyway. The memo is pure overhead.
function BrokenParent({ items }) {
  const [count, setCount] = useState(0);
  const filtered = items.filter((i) =&gt; i.active);      // new array
  const handleSelect = (id) =&gt; console.log(id);        // new function
  return (
    &lt;&gt;
      &lt;button onClick={() =&gt; setCount(count + 1)}&gt;{count}&lt;/button&gt;
      &lt;MemoisedList items={filtered} onSelect={handleSelect} /&gt;
    &lt;/&gt;
  );
}
// WORKING: stable references, so clicking the counter leaves the list alone
function WorkingParent({ items }) {
  const [count, setCount] = useState(0);
  const filtered = useMemo(() =&gt; items.filter((i) =&gt; i.active), [items]);
  const handleSelect = useCallback((id) =&gt; console.log(id), []);
  return (
    &lt;&gt;
      &lt;button onClick={() =&gt; setCount(count + 1)}&gt;{count}&lt;/button&gt;
      &lt;MemoisedList items={filtered} onSelect={handleSelect} /&gt;
    &lt;/&gt;
  );
}
// WITH THE REACT COMPILER: write this, get the same result. No memo,
// no useMemo, no useCallback, and no dependency arrays to get wrong.
// This is what you should write in a new project.
function CompilerParent({ items }) {
  const [count, setCount] = useState(0);
  const filtered = items.filter((i) =&gt; i.active);
  const handleSelect = (id) =&gt; console.log(id);
  return (
    &lt;&gt;
      &lt;button onClick={() =&gt; setCount(count + 1)}&gt;{count}&lt;/button&gt;
      &lt;List items={filtered} onSelect={handleSelect} /&gt;
    &lt;/&gt;
  );
}
// STILL WORTH DOING BY HAND: a value an effect depends on. Being
// explicit here is clearer than trusting the compiler.
function Subscriber({ userId, includeArchived }) {
  const options = useMemo(
    () =&gt; ({ userId, includeArchived }),
    [userId, includeArchived]
  );
  useEffect(() =&gt; subscribe(options), [options]);
  return null;
}
// NOT WORTH IT: each of these costs a comparison and a hook slot for
// work that is cheaper than the check itself.
//   const doubled = useMemo(() =&gt; count * 2, [count]);
//   const name = useMemo(() =&gt; first + ' ' + last, [first, last]);
// MEASURE FIRST. In rough order, apps are slow because of: too much
// JavaScript, unoptimised images, request waterfalls, bad algorithms,
// too many DOM nodes, and only then missing memoization.
</code></pre>

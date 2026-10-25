---
publishDate: 2026-05-20T09:58
title: 'React Compiler: Automatic Memoization'
slug: react-compiler
metadescription: The compiler adds memoization for you at build time, so most useMemo, useCallback and memo calls become unnecessary.
updateDate: 2026-09-05T09:58
author: ['bishal-biswas']
level: 3
tags: ['performance', 'compiler', 'react-19']
course: react
---

## What it does

The React Compiler analyses your components at build time and inserts memoization automatically.

```javascript
function ProductList({ products, filter }) {
  const visible = products.filter((p) => p.category === filter);
  const total = visible.reduce((sum, p) => sum + p.price, 0);
  function handleSelect(id) {
    console.log(id);
  }
  return (
    <div>
      <p>{total}</p>
      <List items={visible} onSelect={handleSelect} />
    </div>
  );
}
```

Written by hand with full optimisation, that becomes:

```javascript
function ProductList({ products, filter }) {
  const visible = useMemo(
    () => products.filter((p) => p.category === filter),
    [products, filter]
  );
  const total = useMemo(
    () => visible.reduce((sum, p) => sum + p.price, 0),
    [visible]
  );
  const handleSelect = useCallback((id) => {
    console.log(id);
  }, []);
  return (
    <div>
      <p>{total}</p>
      <List items={visible} onSelect={handleSelect} />
    </div>
  );
}
```

The compiler produces the second from the first. You write the readable version and get the optimised one.

It reached **1.0 in October 2025** and is stable.

## Installing

```bash
npm install --save-dev babel-plugin-react-compiler
```

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]]
      }
    })
  ]
});
```

In Next.js:

```javascript
const nextConfig = {
  experimental: {
    reactCompiler: true
  }
};
```

Check the current documentation, since the configuration has moved between versions.

## What it needs from you

The compiler only optimises components it can prove are safe. That means following the rules of React:

**Components must be pure.**

```javascript
let renderCount = 0;
function Broken() {
  renderCount++;
  return <p>{renderCount}</p>;
}
```

**Do not mutate props or state.**

```javascript
function Broken({ items }) {
  items.push({ id: 1 });
  return <List items={items} />;
}
function Fine({ items }) {
  const withExtra = [...items, { id: 1 }];
  return <List items={withExtra} />;
}
```

**Follow the rules of hooks.**

When the compiler cannot prove a component is safe, it **skips it** and leaves your code as written. Nothing breaks. You simply get no optimisation there.

## The linter tells you

```bash
npm install --save-dev eslint-plugin-react-hooks
```

The plugin includes compiler rules that flag components being skipped, and why.

```javascript
// [ReactCompiler] Cannot infer... mutating `items` which is a prop
```

Treat these as a list of components to fix. Each one is a real rule violation, so fixing it usually removes a latent bug as well.

## What you can stop writing

Once the compiler is on, most manual memoization is redundant.

```javascript
const total = useMemo(() => items.reduce((s, i) => s + i.price, 0), [items]);
const handleClick = useCallback(() => doThing(id), [id]);
export default memo(MyComponent);
```

```javascript
const total = items.reduce((s, i) => s + i.price, 0);
function handleClick() {
  doThing(id);
}
export default MyComponent;
```

Less noise, no dependency arrays to keep in sync, and fewer bugs from a stale dependency.

You do not have to remove existing ones immediately. They keep working. Clean them up as you touch the files.

## What it does not replace

**`useMemo` for referential stability that something else depends on.** If a value goes into a dependency array of an effect you control, be explicit.

**Genuinely expensive work.** The compiler memoizes based on rendering, not on cost. A calculation taking 200ms may still need attention, or to move off the main thread.

**Algorithmic problems.** Nothing fixes an O(n squared) loop except a better algorithm.

**Virtualisation.** Ten thousand DOM nodes are ten thousand DOM nodes.

**`useEffect` dependencies.** The compiler does not change how effects work. That list is still yours.

## Checking it worked

React DevTools marks compiled components with a badge. If a component you expected to be optimised has none, the linter will tell you why.

The Profiler is the real test. Compare before and after on the interaction you care about, rather than assuming.

## Should you enable it?

**Yes, for a new project.** It costs one config line and removes a whole category of manual work.

**Yes, for an existing project**, but expect some cleanup. Run the linter first and see how many components are skipped. Those are components breaking the rules of React, which is worth knowing regardless.

**The honest caveat:** most applications are not slow because of missing memoization. They are slow because of large bundles, unoptimised images, waterfalling requests and bad algorithms. The compiler is a genuine improvement to code quality. It is not a performance fix on its own.

## Quick recap

- The compiler inserts memoization at build time from plain code.
- It reached 1.0 in October 2025 and is stable.
- It only optimises components it can prove are pure.
- Components it cannot verify are skipped, and nothing breaks.
- The ESLint plugin tells you which components are skipped and why.
- Most `useMemo`, `useCallback` and `memo` calls become unnecessary.
- It does not fix effect dependencies, algorithms or bundle size.
- Enable it, but do not expect it to make a slow app fast.

<code id="code-content" class="language-javascript">
// WITH THE COMPILER, you write this readable version...
function ProductList({ products, filter, onSelect }) {
  const visible = products.filter((p) =&gt; p.category === filter);
  const total = visible.reduce((sum, p) =&gt; sum + p.price, 0);
  function handleSelect(id) {
    onSelect(id);
  }
  return (
    &lt;div&gt;
      &lt;p&gt;Total: Rs {total}&lt;/p&gt;
      &lt;List items={visible} onSelect={handleSelect} /&gt;
    &lt;/div&gt;
  );
}
// ...and the compiler produces the equivalent of this at build time:
// const visible = useMemo(
//   () =&gt; products.filter((p) =&gt; p.category === filter),
//   [products, filter]
// );
// const total = useMemo(() =&gt; visible.reduce(...), [visible]);
// const handleSelect = useCallback((id) =&gt; onSelect(id), [onSelect]);
// IT ONLY OPTIMISES WHAT IT CAN PROVE IS SAFE.
// This gets SKIPPED, because it mutates a prop:
function Broken({ items }) {
  items.push({ id: 1 });               // mutation, compiler bails out
  return &lt;List items={items} /&gt;;
}
// This is optimised, because it creates a new array:
function Fixed({ items }) {
  const withExtra = [...items, { id: 1 }];
  return &lt;List items={withExtra} /&gt;;
}
// This gets skipped too, because the component is not pure:
let renderCount = 0;
function AlsoBroken() {
  renderCount++;                       // side effect during render
  return &lt;p&gt;{renderCount}&lt;/p&gt;;
}
// When it cannot verify a component it leaves your code alone. Nothing
// breaks, you just get no optimisation there. The ESLint plugin lists
// every skipped component and the reason.
// WHAT YOU CAN STOP WRITING once it is enabled:
//   const total = useMemo(() =&gt; expensive(items), [items]);
//   const onClick = useCallback(() =&gt; doThing(id), [id]);
//   export default memo(MyComponent);
// WHAT IT DOES NOT DO:
// - fix useEffect dependency arrays, those are still yours
// - speed up a genuinely expensive calculation, only skip repeats
// - fix an O(n squared) algorithm
// - virtualise a ten thousand row list
// - shrink your bundle or optimise your images
// Enable it. It removes real busywork and a class of stale dependency
// bugs. But most slow apps are slow for other reasons entirely.
</code></pre>

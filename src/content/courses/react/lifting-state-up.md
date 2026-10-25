---
publishDate: 2026-05-15T09:42
title: Lifting State Up
slug: lifting-state-up
metadescription: Share state between sibling components by moving it to their nearest common parent, and know when to stop.
updateDate: 2026-09-05T09:42
author: ['bishal-biswas']
level: 2
tags: ['state', 'patterns']
course: react
---

## The problem

Two siblings need the same value.

```javascript
function SearchInput() {
  const [query, setQuery] = useState('');
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
function ResultCount() {
  return <p>? results</p>;
}
function Page() {
  return (
    <div>
      <SearchInput />
      <ResultCount />
    </div>
  );
}
```

`ResultCount` cannot see `query`. State only flows **down**, and these two are siblings.

## The fix

Move the state up to their nearest common parent, then pass it down.

```javascript
function SearchInput({ query, onQueryChange }) {
  return <input value={query} onChange={(e) => onQueryChange(e.target.value)} />;
}
function ResultCount({ count }) {
  return <p>{count} results</p>;
}
function Page({ items }) {
  const [query, setQuery] = useState('');
  const results = items.filter((i) => i.name.includes(query));
  return (
    <div>
      <SearchInput query={query} onQueryChange={setQuery} />
      <ResultCount count={results.length} />
      <ul>{results.map((i) => <li key={i.id}>{i.name}</li>)}</ul>
    </div>
  );
}
```

The state lives in `Page`. The children became **controlled**: they receive a value and report changes back, without owning anything.

Notice `results` is calculated during render rather than stored. That is the "do not store what you can calculate" rule from earlier.

## The pattern

Three steps, every time:

1. Find the nearest parent that contains all the components needing the value.
2. Move the `useState` there.
3. Pass the value down as a prop and a setter down as a callback.

## Controlled and uncontrolled components

A component that owns its state is **uncontrolled**. One that receives it is **controlled**.

```javascript
function Accordion() {
  const [isOpen, setIsOpen] = useState(false);
  return <div onClick={() => setIsOpen(!isOpen)}>...</div>;
}
function Accordion({ isOpen, onToggle }) {
  return <div onClick={onToggle}>...</div>;
}
```

Uncontrolled is simpler to use. Controlled is more flexible, because the parent can coordinate several of them.

You can support both:

```javascript
function Accordion({ isOpen: controlledOpen, onToggle, defaultOpen = false }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  function handleToggle() {
    if (!isControlled) setUncontrolledOpen(!isOpen);
    onToggle?.(!isOpen);
  }
  return (
    <div>
      <button onClick={handleToggle}>{isOpen ? 'Close' : 'Open'}</button>
      {isOpen && <div>Content</div>}
    </div>
  );
}
```

Simple cases just work, and a parent can take control when it needs to. This is how most component libraries handle it.

## A worked example

An accordion where only one panel is open at a time.

```javascript
function AccordionGroup({ items }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div>
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          item={item}
          isOpen={openId === item.id}
          onToggle={() => setOpenId(openId === item.id ? null : item.id)}
        />
      ))}
    </div>
  );
}
function AccordionItem({ item, isOpen, onToggle }) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={isOpen}>{item.title}</button>
      {isOpen && <div>{item.content}</div>}
    </div>
  );
}
```

One `openId` at the top makes "only one open" impossible to get wrong. If each item owned its own boolean, you would have to coordinate them, and they could all be open at once.

**Storing one id rather than many booleans** is the trick worth remembering.

## Do not lift too far

Lifting solves a problem, and it creates one. Every intermediate component now passes props it does not use.

```javascript
function App() {
  const [tooltipText, setTooltipText] = useState('');
  return <Layout tooltipText={tooltipText} setTooltipText={setTooltipText} />;
}
```

If a piece of state is only used deep in one branch, it does not belong at the root. Lift only as far as the **nearest** common parent, no further.

When the distance is genuinely large, use Context or composition instead, which is the next topic.

## When not to lift

**If only one component uses it, leave it there.**

```javascript
function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return <Header isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />;
}
function App() {
  return <Header />;
}
```

**If it can be calculated, do not store it at all.**

```javascript
const [total, setTotal] = useState(0);
const total = items.reduce((sum, i) => sum + i.price, 0);
```

**If it belongs in the URL, put it there.**

```javascript
const [category, setCategory] = useState('all');
const [searchParams, setSearchParams] = useSearchParams();
```

Filters, sorting, pagination and the current tab all belong in the URL, so they survive a refresh and can be shared.

**If it is server data, use a data library.** Caching, revalidation and staleness are not solved by lifting.

## Quick recap

- State flows down, so siblings share by lifting to a common parent.
- Pass the value down and a callback back up.
- A component receiving state is controlled, one owning it is uncontrolled.
- Supporting both makes a component flexible without complicating simple use.
- Store one id rather than many booleans for "only one active" behaviour.
- Lift only to the nearest common parent, never higher.
- Do not lift what only one component uses, what you can calculate, or what belongs in the URL.

<code id="code-content" class="language-javascript">
import { useState } from 'react';
// Siblings cannot see each other's state, so it moves to their nearest
// common parent and comes back down as props.
function SearchInput({ query, onQueryChange }) {   // controlled
  return &lt;input value={query} onChange={(e) =&gt; onQueryChange(e.target.value)} /&gt;;
}
function ResultCount({ count }) {
  return &lt;p&gt;{count} results&lt;/p&gt;;
}
export default function SearchPage({ items }) {
  const [query, setQuery] = useState('');
  // Derived, not stored. Never keep what you can calculate.
  const results = items.filter((i) =&gt; i.name.includes(query));
  return (
    &lt;div&gt;
      &lt;SearchInput query={query} onQueryChange={setQuery} /&gt;
      &lt;ResultCount count={results.length} /&gt;
      &lt;ul&gt;{results.map((i) =&gt; &lt;li key={i.id}&gt;{i.name}&lt;/li&gt;)}&lt;/ul&gt;
    &lt;/div&gt;
  );
}
// ONE id at the top makes "only one open at a time" impossible to get
// wrong. Separate booleans per item would need coordinating.
function AccordionGroup({ items }) {
  const [openId, setOpenId] = useState(null);
  return (
    &lt;div&gt;
      {items.map((item) =&gt; (
        &lt;AccordionItem
          key={item.id}
          item={item}
          isOpen={openId === item.id}
          onToggle={() =&gt; setOpenId(openId === item.id ? null : item.id)}
        /&gt;
      ))}
    &lt;/div&gt;
  );
}
function AccordionItem({ item, isOpen, onToggle }) {
  return (
    &lt;div&gt;
      &lt;button onClick={onToggle} aria-expanded={isOpen}&gt;{item.title}&lt;/button&gt;
      {isOpen &amp;&amp; &lt;div&gt;{item.content}&lt;/div&gt;}
    &lt;/div&gt;
  );
}
// Support BOTH controlled and uncontrolled, which is how component
// libraries do it. Simple cases just work, parents can take over.
function Accordion({ isOpen: controlledOpen, onToggle, defaultOpen = false }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
  function handleToggle() {
    if (!isControlled) setUncontrolledOpen(!isOpen);
    onToggle?.(!isOpen);
  }
  return (
    &lt;div&gt;
      &lt;button onClick={handleToggle}&gt;{isOpen ? 'Close' : 'Open'}&lt;/button&gt;
      {isOpen &amp;&amp; &lt;div&gt;Content&lt;/div&gt;}
    &lt;/div&gt;
  );
}
// DO NOT LIFT:
// - what only one component uses, leave it local
// - what you can calculate, derive it during render
// - filters, sorting, pagination and tabs, those belong in the URL:
//     const [searchParams, setSearchParams] = useSearchParams();
// - server data, which needs caching and revalidation, not lifting
</code></pre>

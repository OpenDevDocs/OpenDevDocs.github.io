---
publishDate: 2026-05-07T09:20
title: You Might Not Need an Effect
slug: you-might-not-need-an-effect
metadescription: Most useEffect calls in real codebases should not exist. Learn the patterns to remove and what to write instead.
updateDate: 2026-09-05T09:20
author: ['bishal-biswas']
level: 2
tags: ['hooks', 'effects', 'patterns']
course: react
---

## The most overused hook

New React developers reach for `useEffect` constantly. Most of those effects are unnecessary, and each one adds an extra render, a chance of stale data, and a dependency array to get wrong.

Two questions tell you whether you need one:

1. Am I talking to something **outside** React? If yes, use an effect.
2. Am I responding to a **user action**? If yes, put it in the event handler.

If neither, calculate it during render.

## 1. Do not store what you can calculate

```javascript
function Broken({ firstName, lastName }) {
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
  }, [firstName, lastName]);
  return <p>{fullName}</p>;
}
function Fixed({ firstName, lastName }) {
  const fullName = `${firstName} ${lastName}`;
  return <p>{fullName}</p>;
}
```

The broken version renders twice: once with the empty string, once with the real value. The user may see a flash of nothing, and the two values can disagree.

This applies to anything derived:

```javascript
function Broken({ items }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.reduce((sum, i) => sum + i.price, 0));
  }, [items]);
}
function Fixed({ items }) {
  const total = items.reduce((sum, i) => sum + i.price, 0);
  return <p>Total: {total}</p>;
}
```

> **Rule:** if you can work it out from props and state, it is not state.

## 2. Do not mirror props into state

```javascript
function Broken({ user }) {
  const [name, setName] = useState(user.name);
  useEffect(() => {
    setName(user.name);
  }, [user.name]);
}
function Fixed({ user }) {
  return <p>{user.name}</p>;
}
```

If you need an editable copy that resets when the user changes, use a key instead:

```javascript
function EditForm({ user }) {
  const [draft, setDraft] = useState(user.name);
  return <input value={draft} onChange={(e) => setDraft(e.target.value)} />;
}
function Parent({ user }) {
  return <EditForm key={user.id} user={user} />;
}
```

Changing the key remounts the component, which resets state cleanly with no effect at all.

## 3. Filtering and sorting

```javascript
function Broken({ products, search }) {
  const [filtered, setFiltered] = useState([]);
  useEffect(() => {
    setFiltered(products.filter((p) => p.name.includes(search)));
  }, [products, search]);
}
function Fixed({ products, search }) {
  const filtered = products.filter((p) => p.name.includes(search));
  return <ul>{filtered.map((p) => <li key={p.id}>{p.name}</li>)}</ul>;
}
```

If the calculation is genuinely expensive, wrap it in `useMemo`, not an effect:

```javascript
const filtered = useMemo(
  () => products.filter((p) => p.name.includes(search)),
  [products, search]
);
```

And with the React Compiler enabled, you often do not even need that.

## 4. Handling a user event

```javascript
function Broken() {
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (submitted) {
      sendAnalytics('form_submitted');
      showToast('Saved!');
    }
  }, [submitted]);
  return <button onClick={() => setSubmitted(true)}>Submit</button>;
}
function Fixed() {
  function handleSubmit() {
    sendAnalytics('form_submitted');
    showToast('Saved!');
  }
  return <button onClick={handleSubmit}>Submit</button>;
}
```

The click **caused** this. Put it in the handler. Routing it through state and an effect adds indirection and makes the flow harder to follow.

The distinction is causation:

- Something happened **because the user did it** goes in the handler.
- Something must be true **because the component is on screen** goes in an effect.

## 5. Resetting state when a prop changes

```javascript
function Broken({ productId }) {
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    setQuantity(1);
  }, [productId]);
}
function Fixed({ productId }) {
  return <ProductForm key={productId} productId={productId} />;
}
```

The key trick again. It is almost always cleaner than an effect.

## 6. Notifying a parent

```javascript
function Broken({ onChange }) {
  const [value, setValue] = useState('');
  useEffect(() => {
    onChange(value);
  }, [value, onChange]);
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}
function Fixed({ onChange }) {
  const [value, setValue] = useState('');
  function handleChange(event) {
    setValue(event.target.value);
    onChange(event.target.value);
  }
  return <input value={value} onChange={handleChange} />;
}
```

The broken version updates the parent one render late, so the parent always sees the previous value briefly.

Often the better answer is to lift the state up entirely and hold no local copy.

## 7. Fetching on mount

```javascript
function Broken({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
}
```

This one is not wrong, and it is a genuine external system. But doing it by hand means writing race condition guards, loading state, error state, retries and caching in every component.

In practice you should use a library:

```javascript
import { useQuery } from '@tanstack/react-query';
function Fixed({ userId }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId)
  });
  if (isLoading) return <Spinner />;
  if (error) return <p>{error.message}</p>;
  return <p>{user.name}</p>;
}
```

Or let a framework load the data before the component renders at all.

## When you genuinely need an effect

```javascript
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]);
useEffect(() => {
  document.title = title;
}, [title]);
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
useEffect(() => {
  const chart = new Chart(ref.current, config);
  return () => chart.destroy();
}, []);
```

Every one of these touches something outside React. That is the test.

## A checklist

Before writing `useEffect`, ask:

1. Can I calculate this during render? Then do that.
2. Did a user action cause it? Then put it in the handler.
3. Am I copying props into state? Use the prop, or a key.
4. Am I fetching data? Consider a library.
5. Am I talking to a browser API, a timer, or a non React library? **Now** use an effect.

## Quick recap

- Most effects in real code should not exist.
- Never store a value you can calculate during render.
- Do not mirror props into state, and use a key to reset instead.
- Put event driven logic in the event handler.
- Notify parents from the handler, not from an effect one render later.
- Use a data library rather than hand rolling fetch effects.
- Keep effects for external systems only.

<code id="code-content" class="language-javascript">
import { useState, useMemo } from 'react';
// 1. DERIVED VALUES: calculate during render, never store in state.
//    The effect version renders twice and the two values can disagree.
function Cart({ items, search }) {
  const total = items.reduce((sum, i) =&gt; sum + i.price, 0);        // derived
  const count = items.length;                                     // derived
  const visible = items.filter((i) =&gt; i.name.includes(search));    // derived
  // Only reach for useMemo if this is genuinely expensive, and with the
  // React Compiler enabled you often will not need even that.
  const expensive = useMemo(
    () =&gt; items.map((i) =&gt; heavyTransform(i)),
    [items]
  );
  return &lt;p&gt;{count} items, total {total}, {visible.length} shown&lt;/p&gt;;
}
// 2. USER ACTIONS belong in the handler, not in state plus an effect.
//    The click CAUSED this, so say so directly.
function SubmitButton({ onSave }) {
  function handleSubmit() {
    sendAnalytics('form_submitted');
    showToast('Saved!');
    onSave();
  }
  return &lt;button onClick={handleSubmit}&gt;Submit&lt;/button&gt;;
}
// 3. RESETTING STATE when a prop changes: use a key, not an effect.
//    Changing the key remounts the child, which clears its state.
function ProductForm({ productId }) {
  const [quantity, setQuantity] = useState(1);
  return &lt;input value={quantity} onChange={(e) =&gt; setQuantity(e.target.value)} /&gt;;
}
function ProductPage({ productId }) {
  return &lt;ProductForm key={productId} productId={productId} /&gt;;
}
// 4. NOTIFYING A PARENT: do it in the handler, or the parent is always
//    one render behind.
function SearchInput({ onChange }) {
  const [value, setValue] = useState('');
  function handleChange(event) {
    setValue(event.target.value);
    onChange(event.target.value);      // same tick, not one render later
  }
  return &lt;input value={value} onChange={handleChange} /&gt;;
}
// WHEN YOU GENUINELY NEED AN EFFECT: something outside React.
// import { useEffect } from 'react';
// useEffect(() =&gt; {                       a chat connection
//   const c = createConnection(roomId);
//   c.connect();
//   return () =&gt; c.disconnect();
// }, [roomId]);
// useEffect(() =&gt; { document.title = title; }, [title]);   a browser API
// useEffect(() =&gt; {                       a non React library
//   const chart = new Chart(ref.current, config);
//   return () =&gt; chart.destroy();
// }, []);
// The test: does it touch something outside React? If not, you do not
// need an effect.
</code></pre>

---
publishDate: 2026-05-05T09:13
title: State and the useState Hook
slug: state-and-usestate-hook
metadescription: Give components memory with useState, update state correctly, and avoid the batching and mutation traps that catch everyone.
updateDate: 2026-09-05T09:13
author: ['bishal-biswas']
level: 1
tags: ['state', 'hooks', 'basics']
course: react
---

## Why a plain variable does not work

```javascript
function Counter() {
  let count = 0;
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => { count = count + 1; }}>Add</button>
    </div>
  );
}
```

Click and nothing happens. Two reasons:

1. React does not know the variable changed, so it never re-renders.
2. Even if it did re-render, the function would run again and reset `count` to `0`.

State solves both. It survives re-renders, and changing it triggers one.

## useState

```javascript
import { useState } from 'react';
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>Add</button>
    </div>
  );
}
```

`useState` returns an array of two things, and you destructure it:

- The **current value**.
- A **setter function** that updates it and schedules a re-render.

The argument is the initial value, used only on the very first render.

The naming convention is `[thing, setThing]`. Nothing enforces it, but every React developer expects it.

## State is per component instance

```javascript
function App() {
  return (
    <div>
      <Counter />
      <Counter />
    </div>
  );
}
```

Two counters, two completely separate values. Clicking one does not affect the other. State belongs to the instance, not the function.

## Any type works

```javascript
const [name, setName] = useState('');
const [age, setAge] = useState(0);
const [isOpen, setIsOpen] = useState(false);
const [items, setItems] = useState([]);
const [user, setUser] = useState(null);
const [form, setForm] = useState({ email: '', password: '' });
```

Give it a sensible initial value of the right type. Starting an array as `null` means your first render crashes on `.map`.

## Updates are not immediate

```javascript
function Counter() {
  const [count, setCount] = useState(0);
  function handleClick() {
    setCount(count + 1);
    console.log(count);
  }
  return <button onClick={handleClick}>{count}</button>;
}
```

That logs `0`, not `1`.

`count` is a `const` captured by this render. Calling the setter does not change it. React schedules a re-render, and on the **next** render `count` is `1`.

This is the single most confusing thing about state at first. State updates are a request for the next render, not an assignment.

## Batching

```javascript
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}
```

Count goes up by **one**, not three. All three calls use the same captured `count`, so all three say "set it to 1".

React also batches them into a single re-render, which is good for performance.

## The updater function

Pass a function to base the new value on the previous one.

```javascript
function handleClick() {
  setCount((previous) => previous + 1);
  setCount((previous) => previous + 1);
  setCount((previous) => previous + 1);
}
```

Now it goes up by three. Each call receives the result of the one before it.

> **Rule:** if the new value depends on the old value, use the updater function. It is always safe, and it is required inside asynchronous code where your captured value may be stale.

```javascript
async function handleSave() {
  await saveToServer();
  setCount((previous) => previous + 1);
}
```

## Never mutate state

This causes more React bugs than anything else.

```javascript
const [items, setItems] = useState(['a', 'b']);
function addBad() {
  items.push('c');
  setItems(items);
}
function addGood() {
  setItems([...items, 'c']);
}
```

The bad version does nothing visible. React compares the old value to the new one with `Object.is`. You passed the same array reference, so React concludes nothing changed and skips the render.

Always create a new array or object.

### Arrays

```javascript
setItems([...items, newItem]);
setItems([newItem, ...items]);
setItems(items.filter((item) => item.id !== id));
setItems(items.map((item) => (item.id === id ? { ...item, done: true } : item)));
setItems(items.toSorted((a, b) => a.price - b.price));
```

### Objects

```javascript
const [user, setUser] = useState({ name: 'Asha', age: 28 });
setUser({ ...user, age: 29 });
setUser((previous) => ({ ...previous, age: previous.age + 1 }));
```

Note the round brackets around the object in the updater. Without them, JavaScript reads `{` as a function body.

### Nested objects

```javascript
const [state, setState] = useState({
  user: { name: 'Asha', address: { city: 'Pune' } }
});
setState({
  ...state,
  user: {
    ...state.user,
    address: { ...state.user.address, city: 'Delhi' }
  }
});
```

Spread has to be applied at every level, because it is a shallow copy. If you find yourself writing this often, either flatten your state or reach for `useReducer`.

## Expensive initial values

```javascript
const [data, setData] = useState(loadHugeThing());
const [dataLazy, setDataLazy] = useState(() => loadHugeThing());
```

The first calls `loadHugeThing()` on **every** render and throws the result away after the first. The second passes a function, which React calls only once. Use the lazy form for anything costly, such as reading from localStorage.

## Setting state during render

```javascript
function Broken({ value }) {
  const [copy, setCopy] = useState(value);
  setCopy(value);
  return <p>{copy}</p>;
}
```

That is an infinite loop: render, set state, render, set state. React will throw "Too many re-renders".

If a value can be calculated from props or other state, do not put it in state at all:

```javascript
function Fine({ firstName, lastName }) {
  const fullName = `${firstName} ${lastName}`;
  return <p>{fullName}</p>;
}
```

**Do not store derived values in state.** It is the most common cause of two pieces of state disagreeing with each other.

## Quick recap

- `useState` gives a component memory that survives re-renders.
- It returns the current value and a setter, destructured as `[x, setX]`.
- The setter schedules a re-render, it does not change your variable now.
- Multiple plain setter calls in one handler use the same stale value.
- Use `setX(prev => ...)` whenever the new value depends on the old one.
- Never mutate. Always pass a new array or object.
- Pass a function to `useState` for expensive initial values.
- Never store something you can calculate.

<code id="code-content" class="language-javascript">
import { useState } from 'react';
export default function TodoApp() {
  const [text, setText] = useState('');
  const [todos, setTodos] = useState([]);
  const [filter, setFilter] = useState('all');
  // DERIVED, not state. Never store what you can calculate, or the two
  // pieces of state will eventually disagree.
  const visible = todos.filter((t) =&gt;
    filter === 'all' ? true : filter === 'done' ? t.done : !t.done
  );
  const remaining = todos.filter((t) =&gt; !t.done).length;
  function handleAdd() {
    if (!text.trim()) return;
    // Never mutate: todos.push(...) would leave the reference identical,
    // so React would compare old and new, see no change, and skip rendering
    setTodos([...todos, { id: crypto.randomUUID(), text: text, done: false }]);
    setText('');
  }
  function handleToggle(id) {
    // map to a new array, spreading the one item that changes
    setTodos(todos.map((t) =&gt; (t.id === id ? { ...t, done: !t.done } : t)));
  }
  function handleDelete(id) {
    setTodos(todos.filter((t) =&gt; t.id !== id));
  }
  function handleClearDone() {
    // The updater form is always safe, and required in async code
    setTodos((previous) =&gt; previous.filter((t) =&gt; !t.done));
  }
  return (
    &lt;div&gt;
      &lt;input value={text} onChange={(e) =&gt; setText(e.target.value)} /&gt;
      &lt;button onClick={handleAdd}&gt;Add&lt;/button&gt;
      &lt;p&gt;{remaining} remaining&lt;/p&gt;
      &lt;ul&gt;
        {visible.map((todo) =&gt; (
          &lt;li key={todo.id}&gt;
            &lt;input
              type="checkbox"
              checked={todo.done}
              onChange={() =&gt; handleToggle(todo.id)}
            /&gt;
            {todo.text}
            &lt;button onClick={() =&gt; handleDelete(todo.id)}&gt;Delete&lt;/button&gt;
          &lt;/li&gt;
        ))}
      &lt;/ul&gt;
      &lt;button onClick={handleClearDone}&gt;Clear completed&lt;/button&gt;
    &lt;/div&gt;
  );
}
// Two traps worth remembering:
// 1. setCount(count + 1) three times adds ONE, because all three use the
//    same captured value. setCount(p =&gt; p + 1) three times adds three.
// 2. useState(loadHugeThing()) runs on every render. Pass a function
//    instead, useState(() =&gt; loadHugeThing()), and it runs once.
</code></pre>

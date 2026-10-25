---
publishDate: 2026-05-05T09:12
title: Lists and Keys
slug: lists-and-keys
metadescription: Render arrays of data with map, and understand why keys matter and what goes wrong when you use the array index.
updateDate: 2026-09-05T09:12
author: ['bishal-biswas']
level: 1
tags: ['lists', 'keys', 'basics']
course: react
---

## Rendering an array

Turn data into elements with `map`.

```javascript
function FruitList() {
  const fruits = ['Apple', 'Banana', 'Mango'];
  return (
    <ul>
      {fruits.map((fruit) => (
        <li key={fruit}>{fruit}</li>
      ))}
    </ul>
  );
}
```

React renders an array of elements one after another. That is all a list is.

With objects, which is the normal case:

```javascript
function UserList({ users }) {
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          {user.name} ({user.email})
        </li>
      ))}
    </ul>
  );
}
```

## `map`, not `forEach`

```javascript
{users.forEach((user) => <li>{user.name}</li>)}
{users.map((user) => <li key={user.id}>{user.name}</li>)}
```

`forEach` returns `undefined`, so nothing renders. `map` returns a new array, which is what you want.

## Watch the arrow body

```javascript
{users.map((user) => {
  <li key={user.id}>{user.name}</li>
})}
{users.map((user) => {
  return <li key={user.id}>{user.name}</li>;
})}
{users.map((user) => (
  <li key={user.id}>{user.name}</li>
))}
```

The first renders nothing. Braces after the arrow mean a function body, so you need `return`. Round brackets mean "return this expression", which is why the third form is the common one.

## Why keys exist

Every item in a list needs a `key` prop. Without one React warns in the console.

A key is how React matches items between renders. When your list changes, React compares the new keys to the old ones and works out what was added, removed or moved.

Without stable keys, React can only guess by position, and that is where bugs come from.

## What makes a good key

```javascript
<li key={user.id}>
<li key={product.sku}>
<li key={fruit}>
<li key={index}>
<li key={Math.random()}>
```

A key must be:

- **Unique** among its siblings, not globally.
- **Stable**, meaning the same item gets the same key every time.

A database id is ideal. A unique string value works. `Math.random()` is the worst possible choice: it changes every render, so React destroys and rebuilds every item, every time.

## The index problem

```javascript
{users.map((user, index) => (
  <li key={index}>{user.name}</li>
))}
```

React accepts this and it often appears to work. Here is where it breaks.

Say you render three items with an input next to each:

```javascript
function TodoList({ todos, onDelete }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>
          <input type="checkbox" />
          {todo.text}
          <button onClick={() => onDelete(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

Tick the checkbox on the **third** item, then delete the **first**.

The second item slides up into index 0, the third into index 1. React sees keys `0` and `1` still present and thinks nothing moved. So the checkbox state, which lives in the DOM rather than in your data, stays attached to position 1. The wrong item now appears ticked.

Use the item's own id and the problem disappears:

```javascript
<li key={todo.id}>
```

### When the index is fine

If **all** of these hold, the index is acceptable:

- The list never reorders.
- Items are never inserted or removed except at the end.
- The items have no state of their own.

A static list of navigation links qualifies. Anything the user can change does not.

## No natural id?

Generate one when you create the item, not when you render it.

```javascript
function addTodo(text) {
  return { id: crypto.randomUUID(), text, done: false };
}
```

`crypto.randomUUID()` is built into browsers and Node. The id becomes part of your data, so it is stable across renders.

Do not generate ids during render. That is the `Math.random()` mistake in a different costume.

## Where the key goes

The key belongs on the **outermost** element returned by the map, not somewhere inside it.

```javascript
{users.map((user) => (
  <li>
    <div key={user.id}>{user.name}</div>
  </li>
))}
{users.map((user) => (
  <li key={user.id}>
    <div>{user.name}</div>
  </li>
))}
```

If you extract the item into its own component, the key goes on the component where it is used, not on the root element inside it:

```javascript
{users.map((user) => (
  <UserRow key={user.id} user={user} />
))}
```

The key is a hint to React, not a normal prop. `UserRow` cannot read `props.key`. Pass it again under a different name if you need the value inside.

## Fragments in a list

```javascript
import { Fragment } from 'react';
{items.map((item) => (
  <Fragment key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.definition}</dd>
  </Fragment>
))}
```

The `<>` shorthand takes no props, so use the long form when you need a key.

## Filtering and sorting first

```javascript
function ProductList({ products, search }) {
  const visible = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .toSorted((a, b) => a.price - b.price);
  if (visible.length === 0) {
    return <p>No products found.</p>;
  }
  return (
    <ul>
      {visible.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

Note `toSorted` rather than `sort`. `sort` mutates, and mutating props is exactly what you must not do. `toSorted` returns a new array.

## Keys to reset a component

A less known but very useful trick. Changing a component's key destroys it and builds a fresh one.

```javascript
function ProfileEditor({ userId }) {
  return <EditForm key={userId} userId={userId} />;
}
```

When `userId` changes, `EditForm` is unmounted and remounted, so all its internal state resets. Without the key, the form would keep the previous user's half typed values.

## Quick recap

- `map` turns data into elements, `forEach` renders nothing.
- Braces after an arrow need an explicit `return`.
- Keys let React match items between renders.
- Use a stable unique id, never `Math.random()`.
- The index breaks as soon as items reorder or get removed.
- Generate ids when creating data, not while rendering.
- The key goes on the outermost element of the map.
- Changing a key deliberately resets a component.

<code id="code-content" class="language-javascript">
import { Fragment } from 'react';
// map turns data into elements. forEach would render nothing.
function UserList({ users }) {
  return (
    &lt;ul&gt;
      {users.map((user) =&gt; (
        &lt;li key={user.id}&gt;{user.name}&lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
// Watch the arrow body: braces need an explicit return
// {users.map((u) =&gt; { &lt;li&gt;{u.name}&lt;/li&gt; })}          renders nothing
// {users.map((u) =&gt; { return &lt;li&gt;{u.name}&lt;/li&gt;; })}  works
// {users.map((u) =&gt; ( &lt;li&gt;{u.name}&lt;/li&gt; ))}          the usual form
// WHY index keys break: tick the checkbox on item 3, delete item 1.
// Items shift up, React sees keys 0 and 1 still there and assumes
// nothing moved, so the tick stays attached to the wrong row.
function BrokenTodos({ todos, onDelete }) {
  return (
    &lt;ul&gt;
      {todos.map((todo, index) =&gt; (
        &lt;li key={index}&gt;
          &lt;input type="checkbox" /&gt;
          {todo.text}
        &lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
// Use the item's own stable id instead
function Todos({ todos, onDelete }) {
  return (
    &lt;ul&gt;
      {todos.map((todo) =&gt; (
        &lt;li key={todo.id}&gt;
          &lt;input type="checkbox" /&gt;
          {todo.text}
          &lt;button onClick={() =&gt; onDelete(todo.id)}&gt;Delete&lt;/button&gt;
        &lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
// No natural id? Create one with the data, never during render
function makeTodo(text) {
  return { id: crypto.randomUUID(), text: text, done: false };
}
// Filter and sort before mapping. Use toSorted, because sort mutates.
function ProductList({ products, search }) {
  const visible = products
    .filter((p) =&gt; p.name.toLowerCase().includes(search.toLowerCase()))
    .toSorted((a, b) =&gt; a.price - b.price);
  if (visible.length === 0) return &lt;p&gt;No products found.&lt;/p&gt;;
  return &lt;ul&gt;{visible.map((p) =&gt; &lt;li key={p.id}&gt;{p.name}&lt;/li&gt;)}&lt;/ul&gt;;
}
// Two elements per item need the long Fragment form, since &lt;&gt; takes no props
function Glossary({ items }) {
  return (
    &lt;dl&gt;
      {items.map((item) =&gt; (
        &lt;Fragment key={item.id}&gt;
          &lt;dt&gt;{item.term}&lt;/dt&gt;
          &lt;dd&gt;{item.definition}&lt;/dd&gt;
        &lt;/Fragment&gt;
      ))}
    &lt;/dl&gt;
  );
}
// Changing a key on purpose resets a component and clears its state
function ProfileEditor({ userId }) {
  return &lt;EditForm key={userId} userId={userId} /&gt;;
}
</code></pre>

---
publishDate: 2026-05-04T09:11
title: Conditional Rendering
slug: conditional-rendering
metadescription: Show and hide parts of your interface with if, the ternary operator and logical AND, and avoid the classic stray zero bug.
updateDate: 2026-09-05T09:11
author: ['bishal-biswas']
level: 1
tags: ['jsx', 'basics']
course: react
---

## Nothing special to learn

React has no `v-if` or `*ngIf`. You use ordinary JavaScript, because JSX is ordinary JavaScript.

## `if` with an early return

The clearest option when the whole output differs.

```javascript
function Greeting({ isLoggedIn, name }) {
  if (!isLoggedIn) {
    return <p>Please log in.</p>;
  }
  return <h1>Welcome back, {name}!</h1>;
}
```

Chain them for several states:

```javascript
function UserProfile({ isLoading, error, user }) {
  if (isLoading) return <Spinner />;
  if (error) return <p className="error">{error.message}</p>;
  if (!user) return <p>No user found.</p>;
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

Loading, error, empty, then the real thing. This shape covers most data driven components, and handling all four states is what separates a robust component from a demo.

## The ternary

For a choice inside the markup.

```javascript
function Status({ isOnline }) {
  return (
    <div>
      <span>{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  );
}
```

It works for whole elements too:

```javascript
function Auth({ user }) {
  return (
    <div>
      {user ? <Dashboard user={user} /> : <LoginForm />}
    </div>
  );
}
```

And for attribute values, which is very common with class names:

```javascript
function Tab({ isActive, label }) {
  return (
    <button className={isActive ? 'tab tab-active' : 'tab'}>
      {label}
    </button>
  );
}
```

> **Do not nest ternaries.** Two levels is already hard to read. Move the logic above the return, or use early returns.

```javascript
function Bad({ status }) {
  return <p>{status === 'a' ? 'A' : status === 'b' ? 'B' : status === 'c' ? 'C' : 'D'}</p>;
}
function Good({ status }) {
  const labels = { a: 'A', b: 'B', c: 'C' };
  return <p>{labels[status] ?? 'D'}</p>;
}
```

A lookup object is often the cleanest answer to a multi way choice.

## Logical AND

For "show this only when true, otherwise nothing".

```javascript
function Notifications({ count }) {
  return (
    <div>
      <h2>Inbox</h2>
      {count > 0 && <span className="badge">{count}</span>}
    </div>
  );
}
```

If the left side is falsy, the whole expression is that falsy value, and React renders nothing for `false`, `null` or `undefined`.

## The stray zero

This is the most common React rendering bug, and it deserves its own section.

```javascript
function Cart({ items }) {
  return (
    <div>
      {items.length && <p>You have {items.length} items</p>}
    </div>
  );
}
```

With an empty cart, `items.length` is `0`. `0 && anything` is `0`. And React **does** render `0`, because it is a number, not a boolean.

Your page shows a bare `0` and nobody can work out where it came from.

Three fixes:

```javascript
{items.length > 0 && <p>You have {items.length} items</p>}
{Boolean(items.length) && <p>...</p>}
{items.length ? <p>...</p> : null}
```

The first is the clearest. Always compare explicitly rather than relying on a number being truthy.

The same trap catches empty strings, since `'' && x` is `''`, though an empty string renders as nothing so you rarely notice.

## Hiding versus not rendering

```javascript
function Panel({ isOpen, children }) {
  return <div style={{ display: isOpen ? 'block' : 'none' }}>{children}</div>;
}
function PanelUnmounted({ isOpen, children }) {
  return isOpen ? <div>{children}</div> : null;
}
```

These are genuinely different:

- **Hiding with CSS** keeps the component mounted. Its state survives, its effects keep running, and it stays in the DOM.
- **Not rendering** unmounts it. State is destroyed and rebuilt from scratch next time.

For a tab whose scroll position should persist, hide it. For a modal that should reset each time, unmount it.

React 19.2 added `<Activity>`, which gives you a third option: keep the state but stop the work. That has its own topic later.

## Rendering a list conditionally

```javascript
function ProductList({ products, isLoading }) {
  if (isLoading) return <Spinner />;
  if (products.length === 0) {
    return <p>No products match your search.</p>;
  }
  return (
    <ul>
      {products.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

Always handle the empty case. An empty list with no message looks broken.

## Extracting the condition

When the logic grows, pull it out of the JSX.

```javascript
function Order({ order }) {
  const canCancel = order.status === 'pending' && !order.isPaid && order.items.length > 0;
  return (
    <div>
      <h2>Order #{order.id}</h2>
      {canCancel && <button>Cancel order</button>}
    </div>
  );
}
```

The named variable explains what the condition means, which the raw expression does not.

## Quick recap

- Conditional rendering is plain JavaScript, with no special syntax.
- Early returns are clearest when the whole output differs.
- The ternary chooses between two things inline. Never nest them.
- A lookup object beats a chain of ternaries for multi way choices.
- `&&` shows something or nothing, but always compare explicitly.
- `0` renders, which is the classic stray zero bug.
- Hiding with CSS keeps state, not rendering destroys it.
- Always handle the empty list case.

<code id="code-content" class="language-javascript">
// Early returns handle loading, error and empty before the real case
function UserProfile({ isLoading, error, user }) {
  if (isLoading) return &lt;p&gt;Loading...&lt;/p&gt;;
  if (error) return &lt;p className="error"&gt;{error.message}&lt;/p&gt;;
  if (!user) return &lt;p&gt;No user found.&lt;/p&gt;;
  return (
    &lt;div&gt;
      &lt;h2&gt;{user.name}&lt;/h2&gt;
      &lt;p&gt;{user.email}&lt;/p&gt;
    &lt;/div&gt;
  );
}
// The ternary picks between two things, inline
function Status({ isOnline }) {
  return &lt;span&gt;{isOnline ? 'Online' : 'Offline'}&lt;/span&gt;;
}
// It works for class names too
function Tab({ isActive, label }) {
  return &lt;button className={isActive ? 'tab tab-active' : 'tab'}&gt;{label}&lt;/button&gt;;
}
// A lookup object beats a chain of nested ternaries
function StatusLabel({ status }) {
  const labels = { pending: 'Pending', paid: 'Paid', shipped: 'Shipped' };
  return &lt;p&gt;{labels[status] ?? 'Unknown'}&lt;/p&gt;;
}
// &amp;&amp; shows something or nothing at all
function Inbox({ count }) {
  return (
    &lt;div&gt;
      &lt;h2&gt;Inbox&lt;/h2&gt;
      {/* THE CLASSIC BUG: when count is 0, this renders a bare 0 on the
          page, because 0 is falsy but React still renders numbers */}
      {/* {count &amp;&amp; &lt;span className="badge"&gt;{count}&lt;/span&gt;} */}
      {/* Always compare explicitly */}
      {count &gt; 0 &amp;&amp; &lt;span className="badge"&gt;{count}&lt;/span&gt;}
    &lt;/div&gt;
  );
}
// Name a complicated condition so it explains itself
function Order({ order }) {
  const canCancel =
    order.status === 'pending' &amp;&amp; !order.isPaid &amp;&amp; order.items.length &gt; 0;
  return (
    &lt;div&gt;
      &lt;h2&gt;Order #{order.id}&lt;/h2&gt;
      {canCancel &amp;&amp; &lt;button&gt;Cancel order&lt;/button&gt;}
    &lt;/div&gt;
  );
}
// Hiding keeps the component mounted and its state alive.
// Not rendering unmounts it and destroys the state.
function Panel({ isOpen, children }) {
  return &lt;div style={{ display: isOpen ? 'block' : 'none' }}&gt;{children}&lt;/div&gt;;
}
function Modal({ isOpen, children }) {
  return isOpen ? &lt;div className="modal"&gt;{children}&lt;/div&gt; : null;
}
// Always handle the empty list, or the page just looks broken
function ProductList({ products }) {
  if (products.length === 0) return &lt;p&gt;No products match your search.&lt;/p&gt;;
  return &lt;ul&gt;{products.map((p) =&gt; &lt;li key={p.id}&gt;{p.name}&lt;/li&gt;)}&lt;/ul&gt;;
}
</code></pre>

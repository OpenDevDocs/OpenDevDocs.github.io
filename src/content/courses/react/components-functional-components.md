---
publishDate: 2026-05-04T09:09
title: Function Components
slug: components-functional-components
metadescription: Write, name, compose and export React components, and learn the rules that keep them predictable.
updateDate: 2026-09-05T09:09
author: ['bishal-biswas']
level: 1
tags: ['components', 'basics']
course: react
---

## A component is a function

```javascript
function Welcome() {
  return <h1>Hello!</h1>;
}
```

That is the whole idea. A function that returns markup.

You use it like a tag:

```javascript
function App() {
  return (
    <div>
      <Welcome />
      <Welcome />
    </div>
  );
}
```

Two rules the compiler actually enforces:

1. **The name must start with a capital letter.** `<Welcome />` is your component. `<welcome />` is treated as an unknown HTML tag and renders nothing useful.
2. **It must return markup**, or `null`.

## Two ways to write one

```javascript
function Welcome() {
  return <h1>Hello</h1>;
}
const Welcome = () => {
  return <h1>Hello</h1>;
};
const WelcomeShort = () => <h1>Hello</h1>;
```

All three work. Declarations are hoisted, so they can be used before the line that defines them, which some people prefer. Pick one style and stay consistent.

## Exporting

```javascript
export default function Button({ label }) {
  return <button>{label}</button>;
}
```

```javascript
import Button from './Button.jsx';
```

The usual convention is one component per file, default exported, with the file named after the component.

Named exports are also fine and are easier to autocomplete:

```javascript
export function Button({ label }) {
  return <button>{label}</button>;
}
```

```javascript
import { Button } from './Button.jsx';
```

Just do not mix them up. A default export imported with braces gives you `undefined`, and React then throws about an invalid element type.

## Composition

Components nest, and that is how a whole application gets built.

```javascript
function Avatar() {
  return <img src="/avatar.png" alt="" />;
}
function UserName() {
  return <span>Asha</span>;
}
function UserBadge() {
  return (
    <div className="badge">
      <Avatar />
      <UserName />
    </div>
  );
}
function Header() {
  return (
    <header>
      <h1>My App</h1>
      <UserBadge />
    </header>
  );
}
```

Each piece is small, readable and testable on its own.

## Do not define a component inside another

```javascript
function Parent() {
  function Child() {
    return <p>Hello</p>;
  }
  return <Child />;
}
```

This looks harmless and causes real bugs. Every time `Parent` renders, `Child` is a **brand new function**. React sees a different component type, throws away the old DOM, and rebuilds it. Any state inside `Child` is lost, inputs lose focus, and animations restart.

Define components at the top level of the file:

```javascript
function Child() {
  return <p>Hello</p>;
}
function Parent() {
  return <Child />;
}
```

## Keep components pure

Given the same props, a component should return the same result and change nothing outside itself.

```javascript
let counter = 0;
function Impure() {
  counter++;
  return <p>{counter}</p>;
}
```

That breaks in ways that are hard to trace, because React may call your function more than once, and StrictMode does so deliberately in development.

```javascript
function Pure({ count }) {
  return <p>{count}</p>;
}
```

Do not mutate props either:

```javascript
function Bad({ user }) {
  user.name = user.name.toUpperCase();
  return <p>{user.name}</p>;
}
function Good({ user }) {
  return <p>{user.name.toUpperCase()}</p>;
}
```

Props are read only. Treat them as someone else's data, because they are.

## Splitting components up

There is no rule about size, but these are good signals to split:

- The component does two clearly different jobs.
- You are about to copy and paste part of it.
- You cannot see the whole thing on one screen.
- A part of it would be easier to test alone.

```javascript
function ProductPage({ product }) {
  return (
    <div>
      <ProductImages images={product.images} />
      <ProductDetails product={product} />
      <ProductReviews reviews={product.reviews} />
    </div>
  );
}
```

That top level component now reads like a table of contents.

Do not overdo it. A component wrapping a single `<p>` adds a file and a layer for nothing.

## Returning early

```javascript
function UserProfile({ user, isLoading }) {
  if (isLoading) {
    return <Spinner />;
  }
  if (!user) {
    return <p>No user found</p>;
  }
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

Handle the exceptional cases first and leave early. The main case stays unindented and easy to read.

> One caveat that will matter soon: early returns must come **after** all your hooks, because hooks cannot be called conditionally.

## Quick recap

- A component is a function returning markup, with a capitalised name.
- One component per file, default exported, is the common convention.
- Components compose, which is how whole pages get built.
- Never define a component inside another, or state gets destroyed on every render.
- Keep components pure and never mutate props.
- Split when a component does two jobs, not by line count.
- Return early for loading and error states.

<code id="code-content" class="language-javascript">
// A component is a function that returns markup.
// The capital letter is required, not a style choice.
function Avatar({ src, alt }) {
  return &lt;img className="avatar" src={src} alt={alt} /&gt;;
}
function UserName({ name }) {
  return &lt;span className="name"&gt;{name}&lt;/span&gt;;
}
// Components compose. This is how a whole page gets built.
function UserBadge({ user }) {
  return (
    &lt;div className="badge"&gt;
      &lt;Avatar src={user.avatar} alt={user.name} /&gt;
      &lt;UserName name={user.name} /&gt;
    &lt;/div&gt;
  );
}
// Return early for the exceptional cases, so the main case stays flat.
// (Early returns must come after all hooks, which matters shortly.)
function UserProfile({ user, isLoading }) {
  if (isLoading) return &lt;p&gt;Loading...&lt;/p&gt;;
  if (!user) return &lt;p&gt;No user found&lt;/p&gt;;
  return (
    &lt;div&gt;
      &lt;UserBadge user={user} /&gt;
      &lt;p&gt;{user.email}&lt;/p&gt;
    &lt;/div&gt;
  );
}
// NEVER define a component inside another. Child would be a brand new
// function on every render, so React throws away the DOM and rebuilds it,
// losing state, focus and animations every time.
function BrokenParent() {
  function Child() { return &lt;input /&gt;; }   // recreated every render
  return &lt;Child /&gt;;
}
// Define it at the top level instead
function Child() { return &lt;input /&gt;; }
function WorkingParent() {
  return &lt;Child /&gt;;
}
// Keep components pure: same props in, same markup out, nothing outside
// changed. Never mutate props, they belong to the caller.
function Bad({ user }) {
  user.name = user.name.toUpperCase();     // mutating someone else's data
  return &lt;p&gt;{user.name}&lt;/p&gt;;
}
function Good({ user }) {
  return &lt;p&gt;{user.name.toUpperCase()}&lt;/p&gt;; // derive, do not mutate
}
export default UserProfile;
</code></pre>

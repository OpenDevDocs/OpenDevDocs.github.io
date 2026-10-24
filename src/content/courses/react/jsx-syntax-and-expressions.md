---
publishDate: 2026-05-03T09:06
title: JSX Syntax and Expressions
slug: jsx-syntax-and-expressions
metadescription: Learn the markup syntax React uses, the rules that differ from HTML, and how to put JavaScript values inside it.
updateDate: 2026-09-05T09:06
author: ['bishal-biswas']
level: 1
tags: ['jsx', 'basics']
course: react
---

## What JSX is

JSX lets you write markup inside JavaScript.

```javascript
const element = <h1>Hello, world!</h1>;
```

That is not a string and not HTML. It is syntax that gets compiled into a function call:

```javascript
const element = _jsx('h1', { children: 'Hello, world!' });
```

You never write that yourself, but knowing it explains a lot. JSX is just a nicer way to describe an object tree, which is why you can put it in variables, return it from functions, and store it in arrays.

## JSX is optional

```javascript
import { createElement } from 'react';
const withJsx = <h1 className="title">Hello</h1>;
const withoutJsx = createElement('h1', { className: 'title' }, 'Hello');
```

Both produce the same thing. Nobody writes the second version for real work.

## Embedding values

Curly braces drop a JavaScript value into the markup.

```javascript
function Greeting() {
  const name = 'Asha';
  const age = 28;
  return <p>{name} is {age} years old</p>;
}
```

**Any expression** works, not just variables:

```javascript
function Summary() {
  const price = 250;
  const quantity = 3;
  const user = { name: 'Ravi' };
  return (
    <div>
      <p>Total: {price * quantity}</p>
      <p>Name: {user.name.toUpperCase()}</p>
      <p>Status: {age >= 18 ? 'Adult' : 'Minor'}</p>
      <p>Today: {new Date().getFullYear()}</p>
    </div>
  );
}
```

An **expression** produces a value. A **statement** does something. Only expressions fit inside braces, so `if` and `for` do not work there. Use a ternary, or move the logic above the `return`.

```javascript
function Status({ isOnline }) {
  return <p>{if (isOnline) 'Online'}</p>;
}
function StatusFixed({ isOnline }) {
  return <p>{isOnline ? 'Online' : 'Offline'}</p>;
}
function StatusClear({ isOnline }) {
  const label = isOnline ? 'Online' : 'Offline';
  return <p>{label}</p>;
}
```

## The rules that differ from HTML

### 1. One root element

```javascript
function Broken() {
  return (
    <h1>Title</h1>
    <p>Text</p>
  );
}
function Fixed() {
  return (
    <div>
      <h1>Title</h1>
      <p>Text</p>
    </div>
  );
}
```

If you do not want a wrapper element in the output, use a fragment:

```javascript
function Fragment() {
  return (
    <>
      <h1>Title</h1>
      <p>Text</p>
    </>
  );
}
```

### 2. Every tag must close

```javascript
<img src="photo.jpg" alt="A photo" />
<br />
<input type="text" />
```

HTML forgives an unclosed `<br>`. JSX does not.

### 3. `className`, not `class`

```javascript
<div className="card">Content</div>
```

`class` is a reserved word in JavaScript, so React uses `className`. Similarly `for` on a label becomes `htmlFor`.

### 4. Attributes are camelCase

```javascript
<button onClick={handleClick} tabIndex={0} autoFocus>
  Click
</button>
<input onChange={handleChange} readOnly maxLength={10} />
```

`onclick` becomes `onClick`, `tabindex` becomes `tabIndex`, `maxlength` becomes `maxLength`.

The exceptions are `data-` and `aria-` attributes, which keep their dashes:

```javascript
<div data-testid="card" aria-label="Product card" />
```

### 5. Inline styles are objects

```javascript
<div style="color: red; font-size: 16px">Text</div>
<div style={{ color: 'red', fontSize: 16 }}>Text</div>
```

Two braces: the outer pair enters JavaScript, the inner pair is the object. Property names are camelCase, and numbers get `px` added automatically.

## Attribute values

```javascript
<input type="text" />
<input type={inputType} />
<input disabled />
<input disabled={true} />
<input disabled={isDisabled} />
```

Quotes for a literal string, braces for a JavaScript value. A boolean attribute with no value means `true`.

## Comments

```javascript
function Example() {
  return (
    <div>
      {/* This is a comment inside JSX */}
      <p>Visible</p>
    </div>
  );
}
```

An HTML comment does not work inside JSX. Wrap a JavaScript comment in braces.

## What React will and will not render

```javascript
function Renders() {
  return (
    <div>
      {'text'}
      {42}
      {['a', 'b']}
      {true}
      {null}
      {undefined}
      {0}
    </div>
  );
}
```

Strings, numbers and arrays render. Booleans, `null` and `undefined` render **nothing**, which is exactly why conditional rendering works.

But note `{0}` renders `0`. That is the classic stray zero bug:

```javascript
function Cart({ items }) {
  return <div>{items.length && <p>You have items</p>}</div>;
}
function CartFixed({ items }) {
  return <div>{items.length > 0 && <p>You have items</p>}</div>;
}
```

An object cannot be rendered:

```javascript
function Broken({ user }) {
  return <p>{user}</p>;
}
function Fine({ user }) {
  return <p>{user.name}</p>;
}
```

That first one throws *Objects are not valid as a React child*, one of the errors you will meet most.

## Whitespace and multiple lines

```javascript
function Layout() {
  return (
    <div>
      <p>Line one</p>
    </div>
  );
}
```

The brackets after `return` are important. Without them, JavaScript's automatic semicolon insertion turns `return` on its own line into `return undefined`, and your component renders nothing.

## JSX is an expression

Because JSX produces a value, you can treat it like any other data:

```javascript
const heading = <h1>Title</h1>;
const items = [<li key="a">A</li>, <li key="b">B</li>];
function pick(isBig) {
  return isBig ? <h1>Big</h1> : <p>Small</p>;
}
```

This is the whole reason `map` works for lists, which is the next major thing you will learn.

## Quick recap

- JSX compiles to function calls, so it is a value like any other.
- Braces embed any JavaScript **expression**, but not statements.
- One root element, or a fragment. Every tag closes.
- `className` not `class`, and attributes are camelCase.
- Inline styles are objects with camelCase keys.
- Booleans, `null` and `undefined` render nothing, but `0` renders.
- Never render a raw object, or React throws.

<code id="code-content" class="language-javascript">
export default function ProductCard({ product, user }) {
  const total = product.price * product.quantity;
  // Work out anything complicated ABOVE the return, not inside the braces
  const label = product.inStock ? 'In stock' : 'Sold out';
  return (
    // Brackets after return, or JavaScript inserts a semicolon and you
    // silently return undefined
    &lt;div className="card" style={{ padding: 16, borderRadius: 8 }}&gt;
      {/* Comments inside JSX go in braces like this */}
      &lt;h2&gt;{product.name}&lt;/h2&gt;
      {/* Any expression works inside braces */}
      &lt;p&gt;Unit price: Rs {product.price}&lt;/p&gt;
      &lt;p&gt;Total: Rs {total}&lt;/p&gt;
      &lt;p&gt;Name in caps: {product.name.toUpperCase()}&lt;/p&gt;
      &lt;p&gt;Status: {label}&lt;/p&gt;
      {/* Booleans, null and undefined render nothing, which is how
          conditional rendering works */}
      {product.isNew &amp;&amp; &lt;span className="badge"&gt;New&lt;/span&gt;}
      {/* But 0 DOES render. Always compare explicitly */}
      {product.quantity &gt; 0 &amp;&amp; &lt;p&gt;{product.quantity} in your basket&lt;/p&gt;}
      {/* Attributes are camelCase, and data-/aria- keep their dashes */}
      &lt;button
        onClick={() =&gt; console.log('added')}
        disabled={!product.inStock}
        tabIndex={0}
        data-testid="add-button"
        aria-label={'Add ' + product.name + ' to basket'}
      &gt;
        Add to basket
      &lt;/button&gt;
      {/* Every tag closes, even ones HTML lets you leave open */}
      &lt;img src={product.image} alt={product.name} /&gt;
      &lt;br /&gt;
      {/* Never render a raw object. This would throw:
          &lt;p&gt;{user}&lt;/p&gt;   Objects are not valid as a React child */}
      &lt;p&gt;Sold by {user.name}&lt;/p&gt;
    &lt;/div&gt;
  );
}
</code></pre>

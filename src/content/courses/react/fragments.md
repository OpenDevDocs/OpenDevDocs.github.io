---
publishDate: 2026-05-03T09:08
title: Fragments
slug: fragments
metadescription: Return several elements from a component without adding a pointless wrapper div to the page.
updateDate: 2026-09-05T09:08
author: ['bishal-biswas']
level: 1
tags: ['jsx', 'basics']
course: react
---

## The problem

A component must return one element.

```javascript
function UserInfo() {
  return (
    <h2>Asha</h2>
    <p>Developer</p>
  );
}
```

That is a syntax error: *Adjacent JSX elements must be wrapped in an enclosing tag.*

The obvious fix is a `<div>`:

```javascript
function UserInfo() {
  return (
    <div>
      <h2>Asha</h2>
      <p>Developer</p>
    </div>
  );
}
```

That works, but it puts a real `<div>` into the page that serves no purpose. Do this in fifty components and your HTML fills with meaningless nesting.

Worse, it can break layouts.

## Fragments

A fragment groups elements without producing any DOM node.

```javascript
import { Fragment } from 'react';
function UserInfo() {
  return (
    <Fragment>
      <h2>Asha</h2>
      <p>Developer</p>
    </Fragment>
  );
}
```

There is a shorthand, which is what you will normally see:

```javascript
function UserInfo() {
  return (
    <>
      <h2>Asha</h2>
      <p>Developer</p>
    </>
  );
}
```

The rendered HTML is exactly:

```html
<h2>Asha</h2>
<p>Developer</p>
```

No wrapper at all.

## Where it really matters

### Tables

```javascript
function Row() {
  return (
    <div>
      <td>Asha</td>
      <td>28</td>
    </div>
  );
}
```

A `<div>` is not valid inside a `<tr>`, and browsers will move it out of the table, producing a mangled layout. A fragment is the only correct option:

```javascript
function Row() {
  return (
    <>
      <td>Asha</td>
      <td>28</td>
    </>
  );
}
function Table() {
  return (
    <table>
      <tbody>
        <tr>
          <Row />
        </tr>
      </tbody>
    </table>
  );
}
```

The same applies to `<li>` inside `<ul>`, and `<option>` inside `<select>`.

### Flexbox and grid

```javascript
function Layout() {
  return (
    <div className="flex gap-4">
      <Sidebar />
      <Main />
    </div>
  );
}
function Sidebar() {
  return (
    <div>
      <nav>Nav</nav>
      <aside>Aside</aside>
    </div>
  );
}
```

Flex and grid only lay out **direct** children. That extra `<div>` becomes the single flex item, and `nav` and `aside` are no longer participating in the layout. Swap it for a fragment and both become real flex items.

This is one of the most common causes of "my CSS works in isolation but breaks inside the component".

## Fragments with keys

The shorthand cannot take attributes. When you map over data and need to return two elements per item, you need a key, and that means the long form:

```javascript
import { Fragment } from 'react';
function DefinitionList({ items }) {
  return (
    <dl>
      {items.map((item) => (
        <Fragment key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.definition}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

`<>` accepts no props at all, so `<key={item.id}>` is not valid syntax. This is the one situation where you must import `Fragment`.

## When a wrapper is right

Do not treat fragments as always correct. Use a real element when it means something:

```javascript
function Card({ title, body }) {
  return (
    <article className="card">
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}
```

Here the `<article>` carries meaning for screen readers and gives you something to style. Use a fragment when the wrapper would exist only to satisfy the one root rule.

## Fragments in the DevTools

React DevTools shows fragments in the component tree, but the browser's Elements panel shows nothing for them, because there is nothing to show. If you are hunting for a wrapper that does not exist, that is why.

## Quick recap

- A component returns one element, and a fragment groups without adding DOM.
- `<>` and `</>` is the shorthand for `<Fragment>`.
- Essential inside tables, lists and selects where a `div` is invalid.
- Prevents extra elements from breaking flex and grid layouts.
- Use the long `<Fragment key={...}>` form when mapping, since `<>` takes no props.
- Prefer a semantic wrapper when the element genuinely means something.

<code id="code-content" class="language-javascript">
import { Fragment } from 'react';
// A component must return ONE element. A fragment groups without
// adding anything to the page.
function UserInfo() {
  return (
    &lt;&gt;
      &lt;h2&gt;Asha&lt;/h2&gt;
      &lt;p&gt;Developer&lt;/p&gt;
    &lt;/&gt;
  );
}
// Output is exactly:  &lt;h2&gt;Asha&lt;/h2&gt;&lt;p&gt;Developer&lt;/p&gt;   with no wrapper
// Essential inside a table, where a &lt;div&gt; is invalid and browsers
// would move it outside the table entirely
function Row() {
  return (
    &lt;&gt;
      &lt;td&gt;Asha&lt;/td&gt;
      &lt;td&gt;28&lt;/td&gt;
    &lt;/&gt;
  );
}
function Table() {
  return (
    &lt;table&gt;
      &lt;tbody&gt;
        &lt;tr&gt;&lt;Row /&gt;&lt;/tr&gt;
      &lt;/tbody&gt;
    &lt;/table&gt;
  );
}
// Also fixes flex and grid, which only lay out DIRECT children.
// A wrapper div here would become the single flex item and both
// children would drop out of the layout.
function Layout() {
  return (
    &lt;div className="flex gap-4"&gt;
      &lt;Panels /&gt;
    &lt;/div&gt;
  );
}
function Panels() {
  return (
    &lt;&gt;
      &lt;nav&gt;Nav&lt;/nav&gt;
      &lt;aside&gt;Aside&lt;/aside&gt;
    &lt;/&gt;
  );
}
// When mapping, you need a key, and &lt;&gt; accepts no props at all.
// This is the one time you must import Fragment.
function DefinitionList({ items }) {
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
// But use a real element when it actually means something
function Card({ title, body }) {
  return (
    &lt;article className="card"&gt;
      &lt;h2&gt;{title}&lt;/h2&gt;
      &lt;p&gt;{body}&lt;/p&gt;
    &lt;/article&gt;
  );
}
</code></pre>

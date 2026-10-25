---
publishDate: 2026-05-03T09:07
title: Rendering Elements with createRoot
slug: rendering-elements
metadescription: See how a React element becomes real DOM, what the virtual DOM actually does, and why re-rendering is not as expensive as it sounds.
updateDate: 2026-09-05T09:07
author: ['bishal-biswas']
level: 1
tags: ['rendering', 'basics']
course: react
---

## An element is a plain object

When you write JSX, you get a small object describing what you want.

```javascript
const element = <h1 className="title">Hello</h1>;
console.log(element);
```

Roughly:

```javascript
const shape = {
  type: 'h1',
  props: { className: 'title', children: 'Hello' }
};
```

It is a **description**, not a DOM node. Nothing is on the page yet. React reads the description and creates the real nodes.

Elements are also immutable. You never change one after creating it. To show something different, you describe a new one.

## Getting it onto the page

```javascript
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<h1>Hello</h1>);
```

`createRoot` claims one DOM node and hands you a root. `render` puts your tree inside it.

You call `createRoot` once per app. After that, React updates the page for you whenever state changes, and you never call `render` again.

## Rendering more than once

```javascript
const root = createRoot(document.getElementById('root'));
root.render(<h1>First</h1>);
root.render(<h1>Second</h1>);
```

This works, and React updates only what differs. But in a real app you would use state instead, and let React decide when to re-render.

## The virtual DOM

React keeps a lightweight copy of the tree in memory. When something changes:

1. React builds a new tree from your components.
2. It compares the new tree with the previous one. This is **diffing**.
3. It works out the minimum set of real DOM changes.
4. It applies just those changes.

```javascript
function Counter({ count }) {
  return (
    <div>
      <h1>My Counter</h1>
      <p>Count: {count}</p>
      <button>Add</button>
    </div>
  );
}
```

When `count` goes from `0` to `1`, only the text inside the `<p>` is touched. The heading and button are left alone.

This matters because touching the real DOM is slow. Comparing plain objects in memory is fast.

> **A useful correction:** the virtual DOM is not magically faster than hand written DOM code. Careful manual updates can beat it. What it gives you is that you write simple, declarative code and still get reasonable performance without thinking about it.

## Re-rendering is not repainting

This confuses almost everyone at first.

When React "re-renders" a component, it **calls your function again** to get a fresh description. That is all. If the result is the same as last time, nothing on the page changes.

```javascript
function Greeting({ name }) {
  console.log('Greeting rendered');
  return <p>Hello {name}</p>;
}
```

Seeing that log does not mean the DOM was touched. It means your function ran.

So a re-render is usually cheap. It becomes expensive when a component does heavy work on every call, or when a huge subtree re-renders needlessly. Those are solvable, and the performance topics later in the course cover how.

## Rendering nothing

```javascript
function Maybe({ show }) {
  if (!show) {
    return null;
  }
  return <p>Visible</p>;
}
```

Returning `null` is valid and renders nothing.

## Rendering a list

```javascript
const items = ['a', 'b', 'c'];
function List() {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
```

An array of elements renders each one in order. The `key` is what lets React match items between renders, and it has a topic of its own shortly.

## Rendering into more than one root

Occasionally you want React to control two separate parts of an existing page.

```javascript
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('widget-a')).render(<WidgetA />);
createRoot(document.getElementById('widget-b')).render(<WidgetB />);
```

This is how React gets added to a site that was not built with it. The two roots are completely independent and share no state.

## Cleaning up

```javascript
const root = createRoot(container);
root.render(<App />);
root.unmount();
```

`unmount` removes the tree and runs cleanup. You need it when embedding React inside another framework's page, and almost never otherwise.

## Server rendering

```javascript
import { hydrateRoot } from 'react-dom/client';
hydrateRoot(document.getElementById('root'), <App />);
```

When HTML came from a server, use `hydrateRoot` rather than `createRoot`. It attaches to the existing markup instead of replacing it. Frameworks do this for you.

## Quick recap

- A React element is a plain object describing what you want, not a DOM node.
- `createRoot` is called once, and `render` puts your tree in the page.
- React diffs the new description against the old one and applies minimal changes.
- Re-rendering means your function runs again, not that the page repaints.
- Returning `null` renders nothing.
- Multiple roots let you add React to an existing page piece by piece.
- Server rendered HTML uses `hydrateRoot`.

<code id="code-content" class="language-javascript">
import { createRoot } from 'react-dom/client';
// A JSX element is just a description, a plain object. Nothing is on the
// page yet, and it can never be changed after it is created.
const element = &lt;h1 className="title"&gt;Hello&lt;/h1&gt;;
console.log(element.type);          // 'h1'
console.log(element.props);         // { className: 'title', children: 'Hello' }
// createRoot claims one DOM node. You call it once per app.
const root = createRoot(document.getElementById('root'));
root.render(&lt;h1&gt;Hello&lt;/h1&gt;);
// Rendering again updates only what actually differs
root.render(&lt;h1&gt;Hello again&lt;/h1&gt;);  // only the text node changes
// A component that renders nothing
function Maybe({ show }) {
  if (!show) return null;           // valid, renders nothing at all
  return &lt;p&gt;Now you see me&lt;/p&gt;;
}
// Re-rendering means React calls your function again, not that the
// browser repaints. If the description matches, the DOM is untouched.
function Greeting({ name }) {
  console.log('Greeting ran');      // this logs on every render
  return &lt;p&gt;Hello {name}&lt;/p&gt;;       // but the DOM only changes if name did
}
// An array of elements renders in order. key lets React match items
// between renders, and gets a topic of its own shortly.
function List({ items }) {
  return (
    &lt;ul&gt;
      {items.map((item) =&gt; (
        &lt;li key={item.id}&gt;{item.label}&lt;/li&gt;
      ))}
    &lt;/ul&gt;
  );
}
// Several independent roots, which is how React gets added to a page
// that was not built with it. They share no state.
// createRoot(document.getElementById('widget-a')).render(&lt;WidgetA /&gt;);
// createRoot(document.getElementById('widget-b')).render(&lt;WidgetB /&gt;);
// When the HTML came from a server, attach instead of replace:
// import { hydrateRoot } from 'react-dom/client';
// hydrateRoot(document.getElementById('root'), &lt;App /&gt;);
</code></pre>

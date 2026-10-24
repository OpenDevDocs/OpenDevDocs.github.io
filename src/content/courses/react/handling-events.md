---
publishDate: 2026-05-05T09:14
title: Handling Events
slug: handling-events
metadescription: Respond to clicks, typing and form submissions in React, pass arguments to handlers, and understand the synthetic event.
updateDate: 2026-09-05T09:14
author: ['bishal-biswas']
level: 1
tags: ['events', 'basics']
course: react
---

## Attaching a handler

```javascript
function Button() {
  function handleClick() {
    console.log('Clicked');
  }
  return <button onClick={handleClick}>Click me</button>;
}
```

Two differences from HTML:

- The attribute is camelCase, so `onClick` rather than `onclick`.
- The value is a **function**, not a string of code.

## Pass the function, do not call it

```javascript
<button onClick={handleClick}>Right</button>
<button onClick={handleClick()}>Wrong</button>
```

The second calls the function **during render** and passes whatever it returned, usually `undefined`. If the handler sets state, you get an infinite loop and React throws "Too many re-renders".

This is one of the most common beginner mistakes.

## Passing arguments

You need brackets to pass an argument, so wrap it in an arrow function.

```javascript
function TodoList({ todos, onDelete }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          {todo.text}
          <button onClick={() => onDelete(todo.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

`() => onDelete(todo.id)` is a new function that, when called, calls `onDelete` with the id. The arrow is what delays the call.

## Inline or named?

```javascript
<button onClick={() => setCount(count + 1)}>Add</button>
```

```javascript
function handleClick() {
  setCount(count + 1);
  logAnalytics('increment');
  showToast('Added');
}
<button onClick={handleClick}>Add</button>
```

Inline is fine for one short line. Pull it out once the logic grows, because a multi line arrow inside JSX is hard to read.

## The event object

Every handler receives an event.

```javascript
function Form() {
  function handleClick(event) {
    console.log(event.type);
    console.log(event.target);
    console.log(event.currentTarget);
  }
  return <button onClick={handleClick}>Click</button>;
}
```

- `event.target` is what was actually clicked, which may be a child element.
- `event.currentTarget` is the element the handler is attached to.

With an argument as well, the event comes second:

```javascript
<button onClick={(event) => handleDelete(event, todo.id)}>Delete</button>
```

## Synthetic events

React wraps the browser's native event in a **SyntheticEvent**. It has the same API but behaves identically across browsers.

React also does not attach a listener to every element. It attaches one per event type at the root and works out which component should handle it. You do not need to think about this, but it explains why React apps stay fast with thousands of handlers.

If you need the real browser event:

```javascript
function handleClick(event) {
  console.log(event.nativeEvent);
}
```

## Preventing the default

```javascript
function LoginForm() {
  function handleSubmit(event) {
    event.preventDefault();
    console.log('Submitting');
  }
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" />
      <button type="submit">Log in</button>
    </form>
  );
}
```

Without `preventDefault`, the browser reloads the page and your handler's work is thrown away. This is the number one reason a form handler "does nothing".

Note the handler goes on the `<form>` with `onSubmit`, not on the button with `onClick`. That way it also fires when the user presses Enter in a field.

## Stopping propagation

Events bubble up through parents.

```javascript
function Modal({ onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

Clicking the overlay closes the modal. Without `stopPropagation`, clicking inside the modal would bubble up to the overlay and close it too.

Use it sparingly, because it can silently break other code listening higher up.

## The events you will use

```javascript
<button onClick={handleClick} />
<div onDoubleClick={handleDoubleClick} />
<div onMouseEnter={handleEnter} onMouseLeave={handleLeave} />
<input onChange={handleChange} />
<input onFocus={handleFocus} onBlur={handleBlur} />
<form onSubmit={handleSubmit} />
<input onKeyDown={handleKeyDown} />
```

### `onChange` is really `onInput`

In plain HTML, `change` fires when a field loses focus. In React, `onChange` fires on **every keystroke**, which is what you almost always want.

```javascript
function SearchBox() {
  const [query, setQuery] = useState('');
  return (
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search..."
    />
  );
}
```

### Keyboard events

```javascript
function SearchInput({ onSearch }) {
  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      onSearch(event.target.value);
    }
    if (event.key === 'Escape') {
      event.target.blur();
    }
  }
  return <input onKeyDown={handleKeyDown} />;
}
```

`event.key` gives you the readable name: `'Enter'`, `'Escape'`, `'ArrowDown'`, `'a'`. The old `keyCode` is deprecated.

Modifier keys are booleans:

```javascript
if (event.ctrlKey && event.key === 's') {
  event.preventDefault();
  save();
}
```

## Reading a form without state

```javascript
function ContactForm() {
  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    console.log(data);
  }
  return (
    <form onSubmit={handleSubmit}>
      <input name="email" />
      <input name="message" />
      <button type="submit">Send</button>
    </form>
  );
}
```

Not every input needs state. `FormData` reads the values on submit, which is simpler when you do not need to react to each keystroke.

## Handlers and re-renders

```javascript
<button onClick={() => setCount(count + 1)}>Add</button>
```

A new arrow function is created on every render. This is **fine**. Creating a function is extremely cheap, and it is not something to optimise away by default.

It only matters when the handler is passed to a memoised child, and the React Compiler now handles most of that automatically. There is a whole topic on this later.

## Quick recap

- Handlers are camelCase props taking a function.
- Pass `handleClick`, never `handleClick()`.
- Wrap in an arrow to pass arguments.
- `event.preventDefault()` stops a form reloading the page.
- Put `onSubmit` on the form, so Enter works too.
- React's `onChange` fires on every keystroke.
- Use `event.key` for keyboard checks.
- Creating handler functions inline is cheap, so do not optimise prematurely.

<code id="code-content" class="language-javascript">
import { useState } from 'react';
export default function ContactForm({ onDelete, todos }) {
  const [query, setQuery] = useState('');
  // Pull a handler out once it does more than one thing
  function handleSubmit(event) {
    event.preventDefault();          // without this the page reloads and
                                     // your handler's work is thrown away
    const data = Object.fromEntries(new FormData(event.target));
    console.log('Submitted:', data);
  }
  function handleKeyDown(event) {
    if (event.key === 'Enter') console.log('Searching for', query);
    if (event.key === 'Escape') setQuery('');
    if (event.ctrlKey &amp;&amp; event.key === 's') {
      event.preventDefault();
      console.log('Save shortcut');
    }
  }
  return (
    &lt;div&gt;
      {/* onSubmit goes on the form, not the button, so Enter works too */}
      &lt;form onSubmit={handleSubmit}&gt;
        &lt;input name="email" type="email" /&gt;
        &lt;input name="message" /&gt;
        &lt;button type="submit"&gt;Send&lt;/button&gt;
      &lt;/form&gt;
      {/* React's onChange fires on every keystroke, unlike plain HTML */}
      &lt;input
        value={query}
        onChange={(event) =&gt; setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
      /&gt;
      &lt;ul&gt;
        {todos.map((todo) =&gt; (
          &lt;li key={todo.id}&gt;
            {todo.text}
            {/* An arrow is what delays the call. Writing
                onClick={onDelete(todo.id)} would run it during render */}
            &lt;button onClick={() =&gt; onDelete(todo.id)}&gt;Delete&lt;/button&gt;
          &lt;/li&gt;
        ))}
      &lt;/ul&gt;
    &lt;/div&gt;
  );
}
// Stopping propagation: clicking the overlay closes, clicking inside does not
function Modal({ onClose, children }) {
  return (
    &lt;div className="overlay" onClick={onClose}&gt;
      &lt;div className="modal" onClick={(event) =&gt; event.stopPropagation()}&gt;
        {children}
      &lt;/div&gt;
    &lt;/div&gt;
  );
}
</code></pre>

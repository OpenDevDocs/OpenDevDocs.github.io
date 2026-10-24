---
publishDate: 2026-03-10T09:16
title: Event Listeners and Handlers
slug: event-listeners-and-handlers
metadescription: Make pages react to clicks, typing and form submissions with addEventListener, the event object, bubbling and delegation.
updateDate: 2026-09-05T09:16
author: ['bishal-biswas']
level: 1
tags: ['basics', 'dom', 'events']
course: javascript
---

## What is an event?

An event is something that happens on the page. A click, a key press, a form submission, the page finishing loading. Your job is to say "when that happens, run this function".

## `addEventListener`

```javascript
const button = document.querySelector('#myButton');
button.addEventListener('click', function () {
  console.log('Button was clicked');
});
```

Three parts: the element, the event name, and the function to run.

The function is called a **handler** or a **callback**. It does not run immediately, it waits for the event.

### You can add more than one

```javascript
button.addEventListener('click', function () {
  console.log('First handler');
});
button.addEventListener('click', function () {
  console.log('Second handler');
});
```

Both run, in the order they were added. This is why `addEventListener` is better than the old `onclick` property, which only holds one function:

```javascript
button.onclick = function () { console.log('A'); };
button.onclick = function () { console.log('B'); };
```

Only `B` survives there.

## Common events

```javascript
element.addEventListener('click', handler);
element.addEventListener('dblclick', handler);
element.addEventListener('mouseenter', handler);
element.addEventListener('mouseleave', handler);
input.addEventListener('input', handler);
input.addEventListener('change', handler);
input.addEventListener('focus', handler);
input.addEventListener('blur', handler);
form.addEventListener('submit', handler);
document.addEventListener('keydown', handler);
window.addEventListener('resize', handler);
window.addEventListener('scroll', handler);
```

`input` fires on every keystroke, while `change` fires only when the field loses focus. Use `input` for live search and `change` for validation.

## The event object

Your handler automatically receives an object describing what happened.

```javascript
button.addEventListener('click', function (event) {
  console.log(event.type);
  console.log(event.target);
  console.log(event.clientX, event.clientY);
});
```

Most people call the parameter `event` or just `e`.

For keyboard events:

```javascript
document.addEventListener('keydown', function (event) {
  console.log(event.key);
  if (event.key === 'Escape') {
    console.log('Escape was pressed');
  }
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    console.log('Save shortcut');
  }
});
```

For input events:

```javascript
const search = document.querySelector('#search');
search.addEventListener('input', function (event) {
  console.log('Typing:', event.target.value);
});
```

## `preventDefault`

Some elements have built in behaviour. A form reloads the page when submitted, a link navigates away. `preventDefault()` stops that.

```javascript
const form = document.querySelector('#myForm');
form.addEventListener('submit', function (event) {
  event.preventDefault();
  const name = document.querySelector('#name').value;
  console.log('Submitted name:', name);
});
```

Without `preventDefault`, the page reloads and your JavaScript never gets to do anything. This is the most common reason a form handler "does not work".

## Bubbling

When you click a button inside a div, the click fires on the button, then the div, then the body, then the document. The event travels **up** the tree. This is called bubbling.

```javascript
document.querySelector('#outer').addEventListener('click', function () {
  console.log('Outer div');
});
document.querySelector('#inner').addEventListener('click', function () {
  console.log('Inner button');
});
```

Clicking the button prints `Inner button` then `Outer div`.

To stop it:

```javascript
button.addEventListener('click', function (event) {
  event.stopPropagation();
  console.log('This does not reach the parent');
});
```

Use `stopPropagation` sparingly. It can break other code that legitimately listens higher up.

## Event delegation

Bubbling is not a nuisance, it is a feature. Instead of adding a listener to every item, add one to the parent.

```javascript
const list = document.querySelector('#todoList');
list.addEventListener('click', function (event) {
  if (event.target.matches('.delete-btn')) {
    event.target.closest('li').remove();
  }
});
```

This has two big advantages:

- **One listener** instead of a hundred, so less memory.
- **It works for new items** added later, which individual listeners would miss.

`event.target` is what was actually clicked. `event.currentTarget` is the element the listener sits on.

## Removing a listener

You need a named function, because the reference must match.

```javascript
function handleClick() {
  console.log('Clicked');
}
button.addEventListener('click', handleClick);
button.removeEventListener('click', handleClick);
```

For a listener that should fire only once, there is a shortcut:

```javascript
button.addEventListener('click', function () {
  console.log('This runs only the first time');
}, { once: true });
```

## Quick recap

- `addEventListener(type, handler)` connects an event to a function.
- You can attach several handlers to the same event.
- The event object carries details like `target`, `key` and mouse position.
- `preventDefault()` stops built in behaviour such as a form reloading the page.
- Events bubble up the tree, which makes event delegation possible.
- Delegation means one listener on a parent instead of many on children.
- Use `{ once: true }` for a handler that should fire a single time.

<code id="code-content" class="language-javascript">
// The basic pattern: element, event name, handler
const button = document.querySelector('#myButton');
button?.addEventListener('click', function (event) {
  console.log('Clicked!', event.type);
  console.log('Element clicked:', event.target.tagName);
});
// Stop a form from reloading the page
const form = document.querySelector('#myForm');
form?.addEventListener('submit', function (event) {
  event.preventDefault();                       // essential
  const name = document.querySelector('#name').value.trim();
  if (!name) {
    console.log('Please enter a name');
    return;
  }
  console.log('Submitted:', name);
});
// Live typing with the input event
const search = document.querySelector('#search');
search?.addEventListener('input', function (event) {
  console.log('Searching for:', event.target.value);
});
// Keyboard shortcuts
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') console.log('Escape pressed');
  if (event.ctrlKey &amp;&amp; event.key === 's') {
    event.preventDefault();
    console.log('Save shortcut');
  }
});
// Event delegation: one listener handles every item, even new ones
const list = document.querySelector('#todoList');
list?.addEventListener('click', function (event) {
  if (event.target.matches('.delete-btn')) {
    event.target.closest('li')?.remove();
    console.log('Item deleted');
  }
});
// Fire a handler only once
button?.addEventListener('click', function () {
  console.log('Welcome, this shows only the first time');
}, { once: true });
</code></pre>

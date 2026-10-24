---
publishDate: 2026-03-09T09:14
title: Document Object Model (DOM) - Introduction
slug: document-object-model-dom-introduction
metadescription: Understand what the DOM is, how the browser turns HTML into a tree of objects, and how JavaScript uses it to change a page.
updateDate: 2026-09-05T09:14
author: ['bishal-biswas']
level: 1
tags: ['basics', 'dom', 'browser']
course: javascript
---

## What is the DOM?

When a browser loads your HTML, it does not keep the text of the file around. It builds a **model** of the page in memory: a tree of objects, one for each tag.

That model is the **Document Object Model**, or DOM. JavaScript can read it and change it, and the browser instantly redraws the page to match.

- **D** for Document, the page.
- **O** for Object, because every tag becomes a JavaScript object.
- **M** for Model, a live representation you can work with.

## The page as a tree

Take this HTML:

```html
<html>
  <head>
    <title>My Page</title>
  </head>
  <body>
    <h1 id="heading">Hello</h1>
    <p class="text">Welcome to my site</p>
  </body>
</html>
```

The browser turns it into a tree:

```javascript
// html
//  ├── head
//  │    └── title  -> "My Page"
//  └── body
//       ├── h1     -> "Hello"
//       └── p      -> "Welcome to my site"
```

Every box in that tree is called a **node**, and the ones that came from tags are called **elements**.

Family words describe the relationships:

- `body` is the **parent** of `h1` and `p`.
- `h1` and `p` are **children** of `body`.
- `h1` and `p` are **siblings** of each other.

## The `document` object

`document` is your entry point into the tree. It is provided by the browser, so it is always there.

```javascript
console.log(document);
console.log(document.title);
console.log(document.body);
console.log(document.documentElement);
console.log(document.URL);
```

Try these in your browser console on any page. Change the title and watch the browser tab update:

```javascript
document.title = 'Changed from JavaScript';
```

## The DOM is not your HTML file

This is the idea that makes everything click.

Your `.html` file is just the starting instructions. Once the page loads, the DOM takes over as the source of truth. When you change the DOM, the page changes. Your file on disk stays exactly the same, which is why a refresh brings everything back.

```javascript
document.body.style.backgroundColor = 'lightblue';
```

Run that in the console and the page turns blue immediately. Refresh and it is white again.

## What you can do with the DOM

Four things, and the rest of this section of the course covers each one:

1. **Find** elements on the page.
2. **Read** their content, attributes and styles.
3. **Change** any of that, or create and remove elements entirely.
4. **React** to what the user does, using events.

## A first taste

```javascript
const heading = document.getElementById('heading');
console.log(heading.textContent);
heading.textContent = 'Hello from JavaScript';
heading.style.color = 'purple';
```

Three lines: find it, read it, change it. That is the whole pattern.

## Timing matters

JavaScript cannot find an element that has not loaded yet.

```html
<head>
  <script>
    const heading = document.getElementById('heading');
    console.log(heading);
  </script>
</head>
<body>
  <h1 id="heading">Hello</h1>
</body>
```

That logs `null`, because the script ran before the `h1` existed.

Two fixes:

**Use `defer`** on your script tag, which is the simplest and best option:

```html
<script src="script.js" defer></script>
```

**Or wait for the event:**

```javascript
document.addEventListener('DOMContentLoaded', function () {
  const heading = document.getElementById('heading');
  console.log(heading.textContent);
});
```

## Nodes versus elements

Not every node is an element. Text and comments are nodes too, and this shows up when you inspect children.

```javascript
const body = document.body;
console.log(body.childNodes);
console.log(body.children);
```

`childNodes` includes text nodes, which means every line break and indent in your HTML shows up as whitespace. `children` gives you only real elements, and it is almost always the one you want.

## Quick recap

- The DOM is a live tree of objects the browser builds from your HTML.
- `document` is the entry point, and it is always available in the browser.
- Changing the DOM changes the page instantly, but never your source file.
- Scripts must run after the elements exist, so use `defer`.
- Use `children` rather than `childNodes` to skip whitespace text nodes.

<code id="code-content" class="language-javascript">
// The document object is your entry point into the page
console.log('Page title:', document.title);
console.log('Page URL  :', document.URL);
// Changing the DOM changes what you see, right away
document.title = 'Changed from JavaScript';
// Finding an element, reading it, then changing it
const heading = document.getElementById('heading');
if (heading) {
  console.log('Current text:', heading.textContent);
  heading.textContent = 'Hello from JavaScript';
  heading.style.color = 'purple';
}
// Walking the family tree
const body = document.body;
console.log('Children count:', body.children.length);
console.log('First child   :', body.children[0]?.tagName);
console.log('Parent of body:', body.parentElement.tagName); // HTML
// children skips text nodes, childNodes does not
console.log('childNodes:', body.childNodes.length);
console.log('children  :', body.children.length);
// Run code only once the page is ready
document.addEventListener('DOMContentLoaded', function () {
  console.log('The page is fully loaded and safe to work with');
});
</code></pre>

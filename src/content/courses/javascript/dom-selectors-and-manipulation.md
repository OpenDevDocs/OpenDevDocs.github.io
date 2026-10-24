---
publishDate: 2026-03-09T09:15
title: DOM Selectors and Manipulation
slug: dom-selectors-and-manipulation
metadescription: Find elements on a page and change their text, styles, classes and structure using the modern DOM methods.
updateDate: 2026-09-05T09:15
author: ['bishal-biswas']
level: 1
tags: ['basics', 'dom', 'browser']
course: javascript
---

## Finding elements

There are two methods you actually need.

### `querySelector`

Finds the **first** match for any CSS selector.

```javascript
const title = document.querySelector('#title');
const firstCard = document.querySelector('.card');
const firstButton = document.querySelector('button');
const nested = document.querySelector('.card h2');
const submit = document.querySelector('button[type="submit"]');
```

If nothing matches, you get `null`.

### `querySelectorAll`

Finds **all** matches and returns a NodeList, which you can loop over.

```javascript
const cards = document.querySelectorAll('.card');
console.log(cards.length);
cards.forEach(function (card) {
  console.log(card.textContent);
});
```

A NodeList is not quite an array. It has `forEach` but not `map` or `filter`. Convert it when you need those:

```javascript
const cards = [...document.querySelectorAll('.card')];
const texts = cards.map(function (card) {
  return card.textContent;
});
```

### The older methods

You will see these in existing code:

```javascript
document.getElementById('title');
document.getElementsByClassName('card');
document.getElementsByTagName('p');
```

`getElementById` is still perfectly good and slightly faster. The other two return **live** collections that update themselves as the page changes, which causes surprises inside loops. Prefer `querySelector` and `querySelectorAll`.

## Always check the result

```javascript
const button = document.querySelector('#save');
if (button) {
  button.textContent = 'Save changes';
}
```

Skipping this check gives you `Cannot read properties of null`, which is the single most common error in browser JavaScript.

## Changing content

### `textContent`

Sets plain text. Anything that looks like a tag stays visible as text.

```javascript
const heading = document.querySelector('#title');
heading.textContent = 'New heading';
```

### `innerHTML`

Parses the string as HTML.

```javascript
const box = document.querySelector('#box');
box.innerHTML = '<strong>Bold text</strong>';
```

> **Security warning:** Never put text that came from a user into `innerHTML`. Someone could inject a script tag and run their own code on your page. This attack is called XSS. Use `textContent` for anything you did not write yourself.

```javascript
const userInput = '<img src=x onerror="alert(1)">';
box.textContent = userInput;
```

That displays the text harmlessly.

## Changing attributes

```javascript
const link = document.querySelector('a');
console.log(link.getAttribute('href'));
link.setAttribute('href', 'https://example.com');
link.setAttribute('target', '_blank');
console.log(link.hasAttribute('target'));
link.removeAttribute('target');
```

Common attributes also have direct properties, which are shorter:

```javascript
const img = document.querySelector('img');
img.src = '/photo.jpg';
img.alt = 'A photo';
const input = document.querySelector('input');
input.value = 'Hello';
input.disabled = true;
```

### Data attributes

Custom attributes starting with `data-` are the tidy way to attach your own information to an element.

```html
<button data-product-id="42" data-price="299">Buy</button>
```

```javascript
const button = document.querySelector('button');
console.log(button.dataset.productId);
console.log(button.dataset.price);
```

Note that `data-product-id` becomes `dataset.productId` in camelCase.

## Changing styles

### Inline styles

```javascript
const box = document.querySelector('#box');
box.style.color = 'white';
box.style.backgroundColor = 'purple';
box.style.paddingTop = '20px';
```

CSS property names with dashes become camelCase, so `background-color` is `backgroundColor`.

### Classes are usually better

Keep your styling in CSS and just toggle classes from JavaScript.

```javascript
const box = document.querySelector('#box');
box.classList.add('active');
box.classList.remove('hidden');
box.classList.toggle('open');
console.log(box.classList.contains('active'));
box.classList.replace('old', 'new');
```

`toggle` is perfect for menus and dark mode switches.

## Creating and adding elements

```javascript
const item = document.createElement('li');
item.textContent = 'New item';
item.classList.add('list-item');
const list = document.querySelector('#list');
list.append(item);
```

Your options for placing it:

```javascript
list.append(item);
list.prepend(item);
list.before(item);
list.after(item);
```

`append` puts it at the end inside, `prepend` at the start inside, and `before`/`after` place it outside as a sibling.

## Removing elements

```javascript
const item = document.querySelector('.list-item');
item.remove();
const list = document.querySelector('#list');
list.innerHTML = '';
```

## Building a list efficiently

Adding elements one at a time makes the browser redraw repeatedly. Build the string first, then set it once.

```javascript
const fruits = ['apple', 'banana', 'mango'];
const list = document.querySelector('#list');
list.innerHTML = fruits.map(function (fruit) {
  return '<li>' + fruit + '</li>';
}).join('');
```

Only do this with data you control. For user data, create elements and use `textContent`.

## Quick recap

- `querySelector` and `querySelectorAll` accept any CSS selector.
- Always check for `null` before using what you found.
- `textContent` is safe, `innerHTML` is not safe for user input.
- `dataset` reads `data-` attributes, converted to camelCase.
- Toggle classes with `classList` instead of setting styles one by one.
- `createElement` plus `append` builds new content, `remove()` deletes it.

<code id="code-content" class="language-javascript">
// Finding elements with any CSS selector
const title = document.querySelector('#title');
const cards = document.querySelectorAll('.card');
console.log('Cards found:', cards.length);
// Always check before using the result
if (title) {
  title.textContent = 'Updated heading';
}
// textContent is safe, innerHTML is not for user input
const box = document.querySelector('#box');
if (box) {
  box.textContent = '&lt;script&gt;alert(1)&lt;/script&gt;'; // shown as plain text
}
// Attributes and data attributes
const button = document.querySelector('button');
if (button) {
  button.setAttribute('title', 'Click to buy');
  button.disabled = false;
  console.log('Product id:', button.dataset.productId);
}
// Prefer classes over inline styles
if (box) {
  box.classList.add('active');
  box.classList.toggle('open');
  console.log('Is active?', box.classList.contains('active'));
}
// Creating and adding an element
const list = document.querySelector('#list');
if (list) {
  const item = document.createElement('li');
  item.textContent = 'New item';
  item.classList.add('list-item');
  list.append(item);
}
// Building a whole list in one go
const fruits = ['apple', 'banana', 'mango'];
if (list) {
  list.innerHTML = fruits.map(function (f) {
    return '&lt;li&gt;' + f + '&lt;/li&gt;';
  }).join('');
}
// Removing
document.querySelector('.list-item')?.remove();
</code></pre>

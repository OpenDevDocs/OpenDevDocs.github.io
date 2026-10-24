---
publishDate: 2026-03-01T09:00
title: What is JavaScript? History and Setup
slug: what-is-javascript-history-setup
metadescription: A beginner friendly introduction to JavaScript, where it came from, what it can do, and how to run your very first script.
updateDate: 2026-09-05T09:00
author: ['bishal-biswas']
level: 1
tags: ['basics', 'setup']
course: javascript
---

## What is JavaScript?

JavaScript is a programming language that runs inside your web browser. HTML gives a page its structure, CSS makes it look good, and JavaScript makes it *do* things.

Think of a web page as a house:

- **HTML** is the walls, doors, and rooms.
- **CSS** is the paint, furniture, and decoration.
- **JavaScript** is the electricity, the light switches, and the doorbell.

Without JavaScript a page just sits there. With it, buttons respond, forms check your input, menus slide open, and new content loads without a refresh.

## A very short history

JavaScript was created in 1995 by Brendan Eich while he was working at Netscape. The story goes that the first version was built in about ten days.

A few dates worth remembering:

- **1995**: JavaScript is created.
- **1997**: The language is standardised under the name **ECMAScript**, so every browser behaves the same way.
- **2009**: Node.js arrives and JavaScript starts running outside the browser, on servers.
- **2015**: **ES6** (also called ES2015) lands. This is the big one, and it added `let`, `const`, arrow functions, classes, and much more.
- **Every year since**: a new small update, named after the year (ES2016, ES2017, and so on).

When someone says "modern JavaScript", they usually mean ES6 and everything after it. That is what this course teaches.

> **Note:** JavaScript and Java are two completely different languages. The similar name was a marketing decision in the 1990s. They are about as related as a car and a carpet.

## Where JavaScript runs

You do not need to install anything to get started. Every browser already has a JavaScript engine built in:

- Chrome and Edge use **V8**
- Firefox uses **SpiderMonkey**
- Safari uses **JavaScriptCore**

Outside the browser, **Node.js** lets you run the same language on a server, build command line tools, and write build scripts.

## Your first line of JavaScript

The fastest way to try JavaScript is the browser console.

1. Open any web page.
2. Press `F12`, or right click and choose **Inspect**.
3. Click the **Console** tab.
4. Type the line below and press Enter.

```javascript
console.log('Hello, world!');
```

You should see `Hello, world!` printed straight back at you. `console.log()` is how you ask JavaScript to show a value, and you will use it constantly while learning.

Try a little arithmetic too. The console evaluates whatever you type:

```javascript
console.log(2 + 3);
console.log('Java' + 'Script');
console.log(10 / 4);
```

## Adding JavaScript to a page

The console is great for experiments, but real code lives in a file. There are three ways to attach JavaScript to a page, and only one of them is a good habit.

### 1. Inline (avoid this)

```html
<button onclick="alert('Clicked!')">Click me</button>
```

This works, but it mixes behaviour into your HTML and gets messy fast.

### 2. Internal script

```html
<script>
  console.log('This runs when the page loads');
</script>
```

Fine for a quick test or a tiny page.

### 3. External file (do this)

Create a file called `script.js`, then link it from your HTML:

```html
<script src="script.js" defer></script>
```

Keeping JavaScript in its own file means you can reuse it, and the browser can cache it.

## Why `defer` matters

Put your `<script>` tag in the `<head>` and add `defer`. That word tells the browser two useful things:

- Download the script in the background while the HTML keeps loading.
- Run it only after the whole page is ready.

Without `defer`, a script in the `<head>` may run before the elements it needs even exist, and your code will fail with a confusing error.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>My First Script</title>
    <script src="script.js" defer></script>
  </head>
  <body>
    <h1 id="title">Hello</h1>
  </body>
</html>
```

## What you need installed

Very little:

- **A browser.** You already have one.
- **A code editor.** VS Code is free and the most common choice.
- **Node.js** (optional for now). Install it later when you want to run JavaScript outside the browser.

That is it. No compiler, no setup wizard, no project configuration.

## Quick recap

- JavaScript adds behaviour to web pages, and it also runs on servers through Node.js.
- ECMAScript is the official standard, and ES6 in 2015 shaped the modern language.
- `console.log()` prints values and is your first debugging tool.
- Keep your code in an external `.js` file and load it with `defer`.

In the next topic you will start storing information using variables.

<code id="code-content" class="language-javascript">
// Your very first JavaScript file: script.js
// 1. Printing to the console
console.log('Hello, world!');
// 2. JavaScript can do maths
console.log(2 + 3);
console.log(10 / 4);
// 3. It can join text together
console.log('Java' + 'Script');
// 4. It can react to the page
const title = document.getElementById('title');
console.log('The heading says:', title.textContent);
// 5. And it can react to the user
document.addEventListener('click', function () {
  console.log('You clicked somewhere on the page!');
});
</code></pre>

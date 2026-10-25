---
publishDate: 2026-10-25T08:05
title: Node.js vs Browser JavaScript
slug: nodejs-vs-browser-javascript
metadescription: See what stays the same and what changes when JavaScript runs in Node instead of a browser, from globals and the DOM to files, modules and security.
updateDate: 2026-10-25T08:05
author: ['bishal-biswas']
level: 1
tags: ['basics', 'browser', 'globals']
course: nodejs
---

## Same language, different home

The JavaScript you write in Node is the same JavaScript you write for the browser. Variables, functions, arrays, classes, promises and `async`/`await` all work the same way.

What changes is the **environment** around your code: which objects exist, what your code is allowed to touch, and how it starts and stops.

Think of a chef. The cooking skills are the same in a home kitchen and in a food truck. But the food truck has a generator instead of a wall socket, and no dining room. The chef has to know what each place offers.

## What stays the same

All of the core language works identically, because Node and Chrome share the **V8** engine. Many web APIs also exist in Node, so code like this runs in both places:

```javascript
console.log('Hello, Asha');

setTimeout(() => console.log('One second later'), 1000);

const url = new URL('https://example.com/books?page=2');
console.log(url.searchParams.get('page')); // prints: 2

console.log(JSON.stringify({ title: 'Dune' })); // prints: {"title":"Dune"}

console.log(crypto.randomUUID()); // prints a random id, different every time
```

Other browser-style APIs available in Node include `fetch`, `AbortController`, `TextEncoder`, `structuredClone`, `WebSocket` and `navigator`.

## The global object: `window` vs `globalThis`

In a browser, the **global object** (the object that holds all the built-in globals) is `window`. Node has no window, because there is no browser window. Its global object is called `global`.

Modern JavaScript has one name that works everywhere: `globalThis`.

```javascript
console.log(typeof window);          // prints: undefined
console.log(globalThis === global);  // prints: true
```

> **Tip:** If you write code that should run in both places, use `globalThis` rather than `window` or `global`.

## No page, so no DOM

The **DOM** (Document Object Model) is the browser's live model of a web page. Node does not display a page, so none of the page-related objects exist:

- `document`, `window`, `alert`, `prompt`
- `localStorage` and `sessionStorage` (not available by default in Node 24)
- events like `click` and `scroll`

Using one gives a `ReferenceError`:

```javascript
alert('Hi');
```

```text
ReferenceError: alert is not defined
```

Your program's output goes to the **terminal** instead, the text window where you started it. `console.log` is your main way of showing information.

## What Node adds

In return, Node gives you powers no web page has. Two globals you will use constantly:

- **`process`**: information about the running program, such as its arguments, environment variables and the current folder.
- **`Buffer`**: a container for raw binary data, like the bytes of an image.

And a set of **built-in modules** you import with the `node:` prefix:

```javascript
// node-only.mjs
import os from 'node:os';
import path from 'node:path';

console.log(process.platform);               // e.g. win32, darwin or linux
console.log(process.cwd());                  // the folder you ran the command from
console.log(os.cpus().length > 0);           // prints: true
console.log(path.join('notes', 'todo.txt')); // notes/todo.txt (notes\todo.txt on Windows)
```

Here are the built-in modules you will meet early in this course:

| Module | What it does |
| --- | --- |
| `node:fs/promises` | Read and write files and folders |
| `node:path` | Build file paths that work on every operating system |
| `node:os` | Information about the computer |
| `node:http` | Create web servers |
| `node:child_process` | Run other programs |

## Files and security

A web page runs inside a **sandbox**: a locked room that cannot see your files, so a random website cannot read your documents.

A Node program runs with **your** permissions. If you can open a file, so can your script. If you can delete it, so can your script.

```javascript
// write-note.mjs
import { writeFile, readFile } from 'node:fs/promises';

await writeFile('note.txt', 'Buy milk');
console.log(await readFile('note.txt', 'utf8')); // prints: Buy milk
```

This is what makes Node useful, and it is also why you should only run scripts and install packages you trust. Node has an optional way to restrict this, covered in [the Permission Model lesson](/courses/nodejs/permission-model).

## Modules work a little differently

Both browsers and Node support **ES modules** (`import` and `export`). The differences are in the details:

- In the browser you load modules with `<script type="module">` and import them by URL.
- Node also supports an older module system called **CommonJS** (`require`), which you will see in a lot of existing code.
- In Node you can import an installed package by its bare name, like `import express from 'express'`, and Node finds it in the `node_modules` folder.

[CommonJS vs ES Modules](/courses/nodejs/commonjs-vs-es-modules) explains both systems properly.

## You choose the version

When you build a website, your visitors use many different browsers and versions. You cannot control which features they have.

With Node, **you** choose the version. If your server runs Node 24, every Node 24 feature is available, every time. You will see how to pick and switch versions in [Installing Node.js LTS and Version Managers](/courses/nodejs/installing-nodejs-and-version-managers).

## Small differences that surprise people

### Timers return objects

In a browser, `setTimeout` returns a number. In Node it returns a `Timeout` object with extra methods:

```javascript
const timer = setTimeout(() => {}, 1000);
console.log(typeof timer);            // browser: number, Node: object
console.log(timer.constructor.name);  // Node prints: Timeout
clearTimeout(timer);                  // works the same in both
```

You can still pass it to `clearTimeout`, so most code never notices.

### Programs end on their own

A web page keeps running until you close the tab. A Node program ends as soon as it has nothing left to do: no code left to run, no timers waiting and no servers listening.

```javascript
console.log('Start');
setTimeout(() => console.log('Done'), 500);
// Node waits 500 ms for the timer, then exits by itself
```

## Common mistakes

### Reaching for `window` in shared code

```javascript
// Wrong: crashes in Node
window.appName = 'Notes';
```

```javascript
// Right: works in both Node and the browser
globalThis.appName = 'Notes';
```

### Checking where your code runs

Sometimes a library needs to behave differently in each place. Check for the thing you need, not for a brand name:

```javascript
if (typeof document !== 'undefined') {
  console.log('Running in a browser');
} else if (typeof process !== 'undefined' && process.versions?.node) {
  console.log('Running in Node', process.version);
}
```

```text
Running in Node v24.12.0
```

### Expecting `prompt()` to ask the user

There is no pop-up box in a terminal. To take input, pass **command-line arguments** (covered in [Command-line Arguments with util.parseArgs](/courses/nodejs/parsing-command-line-arguments)) or read from the keyboard with the `node:readline` module.

## Quick recap

- The **language** is identical. The **environment** is different.
- Node has no DOM: no `document`, `window` or `alert`.
- Use `globalThis` when code must run in both places.
- Node adds `process`, `Buffer` and built-in modules like `fs`, `path` and `os`.
- Node scripts can read and write your files, so only run code you trust.
- Many web APIs, such as `fetch`, `URL` and `setTimeout`, work in both.
- You control which Node version your code runs on.

<code id="code-content" class="language-javascript">
// node-vs-browser.mjs: which world am I in?
import os from 'node:os';
import path from 'node:path';
import { writeFile, readFile, rm } from 'node:fs/promises';
// --- Shared with the browser: the language and many web APIs
const url = new URL('https://example.com/books?page=2');
console.log('Page from URL:', url.searchParams.get('page'));
console.log('Random id:', crypto.randomUUID());
console.log('Copy:', structuredClone({ title: 'Dune', tags: ['sci-fi'] }));
// --- One global name that works everywhere
console.log('globalThis === global?', globalThis === global);
// --- Browser-only things do not exist here
for (const name of ['window', 'document', 'alert']) {
  console.log(`typeof ${name}:`, typeof globalThis[name]);
}
// --- Node-only powers
console.log('Platform:', process.platform, '| Cores:', os.cpus().length);
console.log('Current folder:', process.cwd());
const file = path.join(os.tmpdir(), 'node-vs-browser-note.txt');
await writeFile(file, 'Buy milk');
console.log('Read back from disk:', await readFile(file, 'utf8'));
await rm(file); // tidy up
// --- Timers return objects in Node
const timer = setTimeout(() =&gt; console.log('Timer fired, now the program can exit'), 200);
console.log('Timer type:', typeof timer, timer.constructor.name);
</code></pre>

---
publishDate: 2026-10-25T08:00
title: What is Node.js? Runtime, V8 and the Ecosystem
slug: what-is-nodejs
metadescription: Learn what Node.js is, how the V8 engine and libuv work together to run JavaScript outside the browser, and what people build with it.
updateDate: 2026-10-25T08:00
author: ['bishal-biswas']
level: 1
tags: ['basics', 'runtime', 'v8']
course: nodejs
---

## What is Node.js?

**Node.js** is a program that runs JavaScript on your computer, outside a web browser.

For most of its life, JavaScript lived only inside browsers. It could change a web page, react to clicks and not much else. Node takes that same language and lets it read files, talk to databases, run web servers and build command-line tools.

Think of JavaScript as a recipe. A recipe needs a kitchen to be cooked in. The browser is one kitchen. Node is a second kitchen, built for a different kind of cooking.

## What "runtime" means

You will hear Node called a **JavaScript runtime**. A runtime is everything a language needs to actually run: something that understands the code, plus the tools the code can use while it runs.

A runtime has two main parts:

- An **engine**, which reads your JavaScript and executes it.
- A set of **APIs** (ready-made functions), which give your code abilities such as reading a file or opening a network connection.

The browser is a runtime too. Its APIs include `document`, `window` and `alert`. Node's APIs are different: `fs` for files, `http` for servers, `process` for information about the running program.

## The V8 engine

Node does not understand JavaScript by itself. It uses **V8**, the JavaScript engine made by Google for the Chrome browser.

V8 takes your JavaScript and turns it into machine code that your processor can run very quickly. It also handles memory for you, cleaning up values you no longer use.

Because Node and Chrome share the same engine, modern JavaScript features (arrow functions, classes, `async`/`await`, optional chaining) work in Node just as they do in Chrome.

> **Note:** Each Node version ships with a specific V8 version. Node 24 uses V8 13.6. Node 26 uses V8 14.6, which is why some newer language features, such as the **Temporal** date API, are switched on in Node 26 but not in Node 24.

## libuv: the part that waits for you

The second key piece inside Node is **libuv**, a library written in C. It deals with the slow outside world: files, network sockets, timers and so on.

Here is the problem it solves. Reading a file or waiting for a database is slow compared with running code. If your program stopped and waited every time, it would spend most of its life doing nothing.

Picture a restaurant with one waiter. A bad waiter takes an order, walks to the kitchen and stands there until the food is ready. A good waiter hands the order to the kitchen, then goes to serve other tables, and comes back when the food is ready.

Node is the good waiter. Your JavaScript is the waiter, and libuv is the kitchen that does the slow work in the background. This style is called **non-blocking I/O**. **I/O** means input and output: anything that talks to the world outside your program.

You will see this in action in [the Event Loop lesson](/courses/nodejs/the-event-loop). For now, the key idea is this: Node runs your JavaScript on **one main thread**, but it never sits idle waiting for slow work.

## Seeing the pieces yourself

Node can tell you which versions of its parts it is using. Save this as `versions.js`:

```javascript
// versions.js
console.log('Node:', process.version);
console.log('V8:', process.versions.v8);
console.log('libuv:', process.versions.uv);
```

Run it from a terminal (you will learn exactly how in [Your First Node.js Program](/courses/nodejs/your-first-nodejs-program)):

```bash
node versions.js
```

You will see something like this. Your numbers may differ slightly:

```text
Node: v24.12.0
V8: 13.6.233.17-node.37
libuv: 1.51.0
```

`process` is a global object Node gives every program. You did not import it. It is simply there, a bit like `window` in the browser.

## A tiny taste of what Node can do

Here is something no browser page can do: read a file straight from your disk.

```javascript
// read-me.mjs
import { readFile } from 'node:fs/promises';

// import.meta.filename is the full path of this very file
const code = await readFile(import.meta.filename, 'utf8');
const firstLine = code.split('\n')[0];
console.log('My first line is:', firstLine);
```

```text
My first line is: // read-me.mjs
```

The `node:` prefix tells Node you want one of its **built-in modules**, the APIs that come with Node. You do not install them. They ship with Node itself.

## The ecosystem: npm

Node comes with **npm**, the Node Package Manager. A **package** is a bundle of code someone else wrote and shared, such as a date formatter or a web framework.

The **npm registry** is a huge online library of these packages, with millions to choose from. When you need something, there is usually a package for it, and you install it with one command:

```bash
npm install express
```

You will learn npm properly in [npm, npx and node --run](/courses/nodejs/npm-npx-and-node-run).

> **Tip:** Node's own built-in modules have grown a lot. Things that once needed a package, such as `fetch`, a test runner, watch mode and reading `.env` files, are now built in. Check the built-ins before reaching for a package.

## What people build with Node

- **Web servers and APIs.** The back end that answers requests from websites and mobile apps.
- **Command-line tools.** Programs you run in a terminal, like `npm` itself.
- **Build tools.** Vite, webpack, ESLint and Prettier are all Node programs.
- **Desktop apps.** Electron, which powers apps like VS Code, is built on Node.
- **Scripts and automation.** Renaming a thousand files, resizing images, backing up a database.

## What Node is not good at

Node shines when a program spends most of its time **waiting**: for files, networks or databases.

It is weaker at long, heavy calculations, such as video encoding, on the main thread. While your JavaScript crunches numbers, the single main thread cannot serve anyone else. Node has tools for this, which you will meet in [the Worker Threads lesson](/courses/nodejs/worker-threads).

## Common misunderstandings

### "Node is a programming language"

It is not. The language is JavaScript. Node is the program that runs it, the same way Chrome is not a language.

### "Node is a framework"

It is not that either. A **framework** (like Express or React) is a library that gives your code a structure. Node sits one level lower: it is what frameworks like Express run on.

### "I can use `document` in Node"

You cannot. There is no web page, so there is no `document` or `window`:

```javascript
console.log(document.title);
```

```text
ReferenceError: document is not defined
```

The next lesson, [Node.js vs Browser JavaScript](/courses/nodejs/nodejs-vs-browser-javascript), covers every difference like this.

## A short history

- **2009:** Ryan Dahl releases Node.js, combining V8 with a non-blocking I/O layer.
- **2010:** npm arrives and quickly becomes the standard way to share Node code.
- **2015 onwards:** Node joins a foundation (today the **OpenJS Foundation**) and settles into a regular release schedule, which you will learn about in [Release Lines: Current, LTS and Maintenance](/courses/nodejs/nodejs-release-lines).
- **Today:** Node is free, open source and maintained by a large community of volunteers and companies.

## Quick recap

- Node.js is a **runtime**: it runs JavaScript outside the browser.
- It uses Google's **V8** engine to execute your code quickly.
- It uses **libuv** to handle slow I/O in the background, so one main thread can serve many tasks.
- Built-in modules (imported with the `node:` prefix) give you files, networking, processes and more.
- **npm** gives you access to millions of shared packages.
- Node is great for servers, tools and scripts, and less suited to heavy number crunching on the main thread.

<code id="code-content" class="language-javascript">
// what-is-node.mjs: a quick tour of the runtime you are using
import os from 'node:os';
import { readFile } from 'node:fs/promises';
// --- The pieces inside Node
console.log('Node version:', process.version);
console.log('V8 engine:   ', process.versions.v8);
console.log('libuv:       ', process.versions.uv);
// --- Where it is running (no browser has these)
console.log('Platform:    ', process.platform, process.arch);
console.log('CPU cores:   ', os.cpus().length);
console.log('Home folder: ', os.homedir());
// --- Read this very file from disk
const code = await readFile(import.meta.filename, 'utf8');
console.log(`This script is ${code.split('\n').length} lines long.`);
// --- Non-blocking in action: the timer does not freeze the program
setTimeout(() =&gt; console.log('3. Timer finished (libuv waited for us)'), 100);
console.log('1. Timer started');
console.log('2. Still running other code while we wait');
// --- No browser globals here
console.log('typeof document:', typeof document);
console.log('typeof window:  ', typeof window);
</code></pre>

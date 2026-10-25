---
publishDate: 2026-10-25T12:14
title: Preload Scripts Explained
slug: preload-scripts
metadescription: Learn what an Electron preload script is, why web pages cannot use Node.js directly, what a sandboxed preload can and cannot do, and how to debug one.
updateDate: 2026-10-25T12:14
author: ['bishal-biswas']
level: 1
tags: ['preload', 'security', 'processes']
course: electronjs
---

## The problem preload scripts solve

Your app has two kinds of code:

- **Main process code** (`main.js`): runs in Node.js. It can read files, open windows, show menus and talk to the operating system.
- **Renderer code** (`renderer.js`, loaded by `index.html`): runs inside a window, like a normal web page. It can change the page, but it **cannot** touch files or the operating system.

You met this split in [How Electron Works: Main and Renderer Processes](/courses/electronjs/main-and-renderer-processes). Sooner or later your page will want something only the main process can do: "save this note", "what version is the app?", "open the file picker".

A **preload script** is a small file that sits between the two. It is the first piece of the bridge that lets your page ask for those things safely. You already wrote one in [Your First Electron App](/courses/electronjs/your-first-electron-app) to show version numbers. This lesson looks at what a preload really is and what it can and cannot do.

## An analogy: the hotel front desk

Imagine a hotel.

- The **guests** are your web page. They can do whatever they like inside their room (the window), but they are not allowed into the back office.
- The **back office** is the main process. It has the keys, the safe and the phone lines to the outside world (files, the operating system).
- The **front desk** is the preload script. It stands between the two. It can see the guests and talk to them, and it has a direct phone line to the back office.

Guests do not get keys to the back office. Instead, they go to the front desk and ask for specific things: "a towel, please", "a wake-up call at seven". The desk decides what is allowed and phones the back office.

The next few lessons build this whole hotel. This lesson is about the front desk itself.

## Why the page cannot just use Node.js

Open your app, open DevTools (**Ctrl + Shift + I** on Windows and Linux, **Cmd + Option + I** on macOS), go to the **Console** tab and type:

```javascript
require('node:fs')
```

```text
Uncaught ReferenceError: require is not defined
```

That is on purpose. Your window displays HTML and runs JavaScript, and web content is a common target for attacks. Maybe a note contains a sneaky `<img onerror="...">`, maybe an npm package you use has been hijacked, maybe you show some content from the internet. If any of that code could call `require('node:fs')`, it could read the user's passwords or delete their files.

So Electron keeps web pages in a **sandbox**: a locked room with no access to Node.js or the operating system. Three settings (all on by default) make this happen:

- `nodeIntegration: false`: no `require`, no `process`, no Node.js in the page.
- `contextIsolation: true`: the preload and the page have separate JavaScript worlds (next lesson).
- `sandbox: true`: the renderer process itself is locked down by the operating system.

Keep all three as they are. This course never turns them off, and [Electron Security Checklist](/courses/electronjs/security-checklist) explains the risks in more depth.

## What a preload script is

A preload script is a JavaScript file that Electron runs **inside the window's renderer process, before your page's own scripts run**. It is special in two ways:

1. It can use a small part of Electron's API, mainly `contextBridge` and `ipcRenderer`, which are its "phone line" to the main process.
2. It has access to the page's DOM (the HTML elements), like normal page code.

You attach it to a window with the `preload` option:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');
}
```

`path.join(__dirname, 'preload.js')` builds a full, absolute path to the file. `__dirname` is the folder that `main.js` lives in. The path **must** be absolute. A plain `'preload.js'` is ignored with this message in the terminal:

```text
preload script must have absolute path.
```

## Step 1: a first preload script

Create `preload.js` next to `main.js`:

```javascript
// preload.js
console.log('Hello from the preload script!');

window.addEventListener('DOMContentLoaded', () => {
  const versions = document.getElementById('versions');
  versions.textContent =
    `Electron ${process.versions.electron}, ` +
    `Chromium ${process.versions.chrome}, ` +
    `Node ${process.versions.node}`;
});
```

And add a place for it in `index.html`:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>Preload demo</title>
  </head>
  <body>
    <h1>Hello!</h1>
    <p id="versions">Loading versions...</p>
    <script src="renderer.js"></script>
  </body>
</html>
```

Run `npm start`. The page shows a line like:

```text
Electron 45.0.0, Chromium 156.0.8078.48, Node 24.22.0
```

(Your exact numbers will differ.)

What happened:

1. The main process created the window and told it to use `preload.js`.
2. Electron started the renderer process and ran `preload.js` **first**.
3. The preload registered a `DOMContentLoaded` listener, because the HTML has not been parsed yet when the preload starts.
4. The page loaded. When the HTML was ready, the listener filled in the paragraph.

Notice that the preload used `process.versions`, which the page itself cannot see. The preload lives in a slightly more powerful place than the page.

### Where did the console.log go?

Look at your terminal: no "Hello from the preload script!". Now look at the window's DevTools Console: there it is.

The preload runs in the **renderer process**, so its `console.log` output goes to the window's DevTools, not to the terminal. Only `main.js` logs to the terminal. Remembering this saves a lot of confused debugging.

## What a sandboxed preload can use

Because the renderer is sandboxed, the preload does **not** get full Node.js. Here is what it does have:

| Available | Not available |
| --- | --- |
| `require('electron')` with `contextBridge`, `ipcRenderer`, `webFrame`, `webUtils` | `require('node:fs')`, `require('node:path')` and other Node modules |
| `process` (for example `process.platform`, `process.versions`) | Your own files: `require('./helpers.js')` |
| The page's DOM: `document`, `window`, events | npm packages |
| Normal Web APIs: `fetch`, `URL`, `TextEncoder`, `setTimeout`, `EventTarget` | `Buffer`, `setImmediate`, `clearImmediate` (removed in Electron 45) |

Try `require('node:fs')` in the preload and the window's console shows:

```text
Unable to load preload script: C:\Users\asha\my-app\preload.js
Error: module not found: fs
```

That is not a bug. Anything that needs Node.js belongs in the main process. The preload's job is to **ask** the main process, through `ipcRenderer`, and to hand the answer to the page.

> **Note:** Since Electron 45, sandboxed preloads also lost a few small helpers that older tutorials use: `Buffer`, `setImmediate`, and `require('events')`, `require('timers')` and `require('url')`. Use the Web equivalents instead: `Uint8Array` and `TextEncoder` instead of `Buffer`, `setTimeout` or `queueMicrotask` instead of `setImmediate`, the global `URL` instead of `require('url')`.

If your preload grows big and you want to split it into several files, use a bundler. [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge) sets one up for you.

## When and how often a preload runs

- It runs **once per page load** in that window. Reload the window (Ctrl + R or Cmd + R) and the preload runs again.
- It runs **before** any of the page's scripts. So anything the preload sets up is ready by the time `renderer.js` starts.
- Each window has its own copy. Two windows with the same preload each run it separately, and they do not share variables.
- Different windows can use different preload files. A Settings window might only need settings functions.

## A preload variable the page cannot see

Here is a little experiment that leads straight into the next lesson. Add this line to `preload.js`:

```javascript
// preload.js
window.greeting = 'Hello from the preload';
```

Now in `renderer.js`:

```javascript
// renderer.js
console.log(window.greeting);
```

```text
undefined
```

The preload and the page share the same HTML, but **not** the same JavaScript variables. They live in separate worlds. This is called **context isolation**, and it is one of Electron's most important safety features. To hand something from the preload to the page, you need `contextBridge`, which is exactly what [Context Isolation and contextBridge](/courses/electronjs/context-isolation-and-contextbridge) covers next.

## Common mistakes

### Using a relative path for `preload`

`preload: 'preload.js'` does nothing except print "preload script must have absolute path." in the terminal. Always use `path.join(__dirname, 'preload.js')`.

### Requiring Node modules in the preload

`require('node:fs')` and `require('./utils.js')` fail in a sandboxed preload with "module not found". Move that work into `main.js` and call it through IPC.

### Looking for preload logs in the terminal

Preload output appears in the window's DevTools Console. Open DevTools to see it, including the "Unable to load preload script" error if the file has a mistake.

### Touching the DOM too early

`document.getElementById('versions')` at the top of the preload returns `null`, because the page has not been parsed yet. Wait for `DOMContentLoaded`.

## Quick recap

- Web pages in Electron cannot use Node.js. That is a deliberate safety feature.
- A preload script runs in the renderer process before the page's scripts and acts as the "front desk" between the page and the main process.
- Attach it with `webPreferences.preload` and an absolute path built with `path.join(__dirname, 'preload.js')`.
- A sandboxed preload can use `contextBridge`, `ipcRenderer`, `process`, the DOM and Web APIs, but not Node modules, local files, npm packages or `Buffer`.
- Preload `console.log` output shows up in the window's DevTools, not the terminal.
- It runs once per page load, in each window separately.
- The page cannot see the preload's variables; `contextBridge` is how you share them.

<code id="code-content" class="language-javascript">
// main.js: a window with a preload script (preload.js is shown in comments)
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
// --- The window: preload must be an absolute path
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // These are already the defaults. Never turn them off:
      // contextIsolation: true, sandbox: true, nodeIntegration: false
    },
  });
  win.loadFile('index.html');
}
// --- preload.js (runs in the window, before the page's scripts):
//   console.log('Hello from the preload!');   // shows in DevTools, not the terminal
//   window.addEventListener('DOMContentLoaded', () =&gt; {
//     document.getElementById('versions').textContent =
//       `Electron ${process.versions.electron}, Node ${process.versions.node}`;
//   });
//   require('node:fs');   // fails: "module not found: fs" (ask main via IPC instead)
// --- Standard lifecycle
app.whenReady().then(() =&gt; {
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

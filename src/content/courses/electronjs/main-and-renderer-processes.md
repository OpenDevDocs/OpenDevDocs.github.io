---
publishDate: 2026-10-25T12:01
title: 'How Electron Works: Main and Renderer Processes'
slug: main-and-renderer-processes
metadescription: Understand Electron's main process, renderer processes and preload scripts, what each one can do, where its logs appear, and why they are kept apart.
updateDate: 2026-10-25T12:01
author: ['bishal-biswas']
level: 1
tags: ['architecture', 'processes', 'preload']
course: electronjs
---

## Why this lesson matters

Almost every beginner question about Electron comes back to one idea: **your code runs in more than one place**. Some code runs in the "main" part of the app, and some runs inside each window. Each part has different powers. Once you know which is which, error messages like `require is not defined` stop being mysterious.

Think of an Electron app as a restaurant.

- The **kitchen** has the knives, the stove and the keys to the storeroom. Only staff go in there. That is the **main process**.
- Each **dining table** is where guests see and enjoy the food. Guests cannot walk into the kitchen. Each table is a **renderer process**, one per window.
- The **waiter** carries orders from the table to the kitchen and brings food back. That is **IPC**, the messages between processes.
- The waiter's **order pad** lists exactly what guests are allowed to ask for. That is the **preload script**.

Keep that picture in mind. The rest of this lesson fills in the details.

## What a process is

A **process** is a running program with its own private memory. When you open Chrome and see several entries for it in Task Manager (Windows) or Activity Monitor (macOS), each entry is a process. If one process crashes, the others can keep going.

Electron uses the same design as Chrome. A running Electron app is a small family of processes:

```text
Your Electron app
├── Main process (exactly one)          runs main.js with Node.js
├── Renderer process for window 1       shows index.html
├── Renderer process for window 2       shows settings.html
└── A few helper processes              GPU, networking, and so on
```

You write code for the first two kinds. The helpers are Chromium's business.

## The main process

The **main process** is the boss of your app. It starts first, and when it stops, the app stops.

- It runs the file named in your `package.json` `"main"` field, usually `main.js`.
- It runs on **Node.js**, so it can use `require`, read files, and use npm packages.
- It is the only place that can create windows, build menus, show native dialogs, add a tray icon and talk to most of the operating system.
- It has **no web page**. There is no `document`, no `window` object and no HTML.

```javascript
// main.js (main process)
const { app, BrowserWindow } = require('electron');
const os = require('os');

console.log('Main process running on', os.platform());

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadFile('index.html');
});
```

There is only ever **one** main process per app.

## Renderer processes

Each window shows a web page, and each web page runs in its own **renderer process**. "Renderer" means "the thing that draws": it turns your HTML and CSS into pixels.

- Renderer code is the normal JavaScript you put in a `<script>` tag.
- It has the full web platform: `document`, `window`, `fetch`, `localStorage`, the canvas, and so on.
- By default it has **no Node.js**. `require`, `process` and the `fs` module do not exist there.

```javascript
// renderer.js (renderer process)
document.querySelector('h1').textContent = 'Hello from the renderer!';

console.log(typeof document); // "object"
console.log(typeof require);  // "undefined"
```

Why no Node.js? Because a web page can contain mistakes, or load content from the internet. If a page could call `require('fs')`, a single bad script could read or delete the user's files. Keeping renderers in a web-only box is one of Electron's most important safety features.

Two settings, both on by default, make this box:

- **Context isolation** keeps your page's JavaScript separate from Electron's internal code.
- **The sandbox** limits what the renderer process can do on the operating system, just like a tab in Chrome.

You will leave both turned on for the whole course.

## The preload script: the bridge

So the main process has the power, and the renderer has the page. How does a button in the page ask for something only the main process can do, like opening a file?

The answer is a **preload script**. It is a small file that Electron runs **inside the renderer process, just before your web page loads**. It is special in two ways:

1. It can use `require('electron')` to reach a few Electron helpers, such as `contextBridge` and `ipcRenderer`.
2. It can safely hand a small set of functions to your web page using `contextBridge`.

You tell a window to use a preload script when you create it:

```javascript
// main.js
const path = require('path');

const win = new BrowserWindow({
  width: 800,
  height: 600,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

`__dirname` is the folder that `main.js` is in, and `path.join` glues folder and file names together using the right slash for each operating system.

Here is a preload that shares some version numbers with the page:

```javascript
// preload.js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});
```

`exposeInMainWorld('versions', {...})` creates a `window.versions` object in your page. The page can call those three functions, and nothing else:

```javascript
// renderer.js
const info = `Chrome ${versions.chrome()}, Node ${versions.node()}, Electron ${versions.electron()}`;
document.getElementById('info').textContent = info;
```

> **Note:** Preload scripts in a sandboxed renderer (the default) can only `require` Electron itself, not other Node modules like `fs`. They also do not have Node's `Buffer` or `setImmediate`. They do have a limited `process` object, which is why `process.versions` works above.

You will study preloads properly in [Preload Scripts Explained](/courses/electronjs/preload-scripts) and [Context Isolation and contextBridge](/courses/electronjs/context-isolation-and-contextbridge).

## IPC: how the processes talk

**IPC** (inter-process communication) means sending messages between processes. In Electron the main process listens with `ipcMain`, and the preload sends with `ipcRenderer`. Here is a tiny preview so you can see the shape. You will build it step by step later.

```javascript
// main.js: the kitchen answers a question
const { ipcMain } = require('electron');

ipcMain.handle('get-username', () => require('os').userInfo().username);
```

```javascript
// preload.js: the order pad offers one safe function
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getUsername: () => ipcRenderer.invoke('get-username'),
});
```

```javascript
// renderer.js: the guest places an order
window.api.getUsername().then((name) => {
  document.querySelector('h1').textContent = `Hello, ${name}!`;
});
```

`invoke` returns a Promise, so the page uses `.then(...)` to wait for the answer.

The page never touches `os` or `ipcRenderer` directly. It only sees `window.api.getUsername`. That is exactly how it should be. The full story is in [IPC Part 1: Sending Messages to the Main Process](/courses/electronjs/ipc-send-to-main) and [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle).

## Who can do what

| Feature | Main process | Preload script | Renderer (your page) |
| --- | --- | --- | --- |
| Runs which file? | `main.js` | `preload.js` | `renderer.js` and other page scripts |
| How many? | Exactly one | One per window that sets it | One per window |
| `document` and the DOM | No | Yes (in the same window) | Yes |
| `require` | Any module | Only `electron` | No |
| Files with `fs` | Yes | No | No |
| Create windows, menus, dialogs | Yes | No | No |
| `contextBridge`, `ipcRenderer` | No | Yes | No |
| `ipcMain` | Yes | No | No |
| Where `console.log` shows up | Your terminal | The window's DevTools | The window's DevTools |

That last row trips up a lot of people, so look at it again.

## Where your logs appear

Put a `console.log` in each file and run your app:

```javascript
// main.js
console.log('Hello from main');
```

```javascript
// preload.js
console.log('Hello from preload');
```

```javascript
// renderer.js
console.log('Hello from renderer');
```

- `Hello from main` appears in the **terminal** where you typed `npm start`.
- `Hello from preload` and `Hello from renderer` appear in the window's **DevTools console**, the same developer tools you know from Chrome. Open them with **Ctrl + Shift + I** on Windows and Linux, or **Cmd + Option + I** on macOS.

The preload logs to DevTools because it runs inside the renderer process. [Debugging with DevTools and VS Code](/courses/electronjs/debugging-electron-apps) covers this in detail.

## Why split things up at all?

It can feel like extra work. Here is what you get in return:

- **Safety.** Web pages cannot reach the file system unless you deliberately give them a small, named function.
- **Stability.** If a page crashes or freezes, the main process and other windows keep running. You can even reload the broken window.
- **Speed.** Heavy page work does not block the main process, so menus and other windows stay responsive.

> **Warning:** The opposite is also true. If you run slow, blocking code in the main process (like reading a huge file synchronously), **every** window can freeze, because they all depend on it. Keep the main process light. For heavy background jobs, Electron has [utility processes](/courses/electronjs/utility-process).

## Common mistakes

### Using `require` in the page

```text
Uncaught ReferenceError: require is not defined
```

You wrote `require(...)` in `renderer.js` or an inline script. Renderers have no Node.js. Move the Node work to the main process and reach it through a preload function.

### Using `document` in `main.js`

```text
ReferenceError: document is not defined
```

The main process has no web page. If you want to change what the window shows, send a message to the renderer, or change the HTML file it loads.

### Looking for logs in the wrong place

If your `console.log` "does nothing", check the other place. Main process logs go to the terminal. Preload and renderer logs go to DevTools.

### Exposing everything through the preload

It is tempting to write `contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer)` so the page can send any message. That gives the page far too much power. Always expose small functions with clear names, like `getUsername`. [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api) explains why.

## Quick recap

- A running Electron app has one **main process** and one **renderer process** per window.
- The main process runs `main.js` with full Node.js and controls windows, menus and the operating system. It has no DOM.
- Renderers show your web pages. They have the DOM but no Node.js, for safety.
- A **preload script** runs in the renderer before the page loads and uses `contextBridge` to share a few safe functions.
- **IPC** messages carry requests between the processes.
- Main process logs appear in the terminal. Preload and renderer logs appear in DevTools.

<code id="code-content" class="language-javascript">
// main.js: one app, three places your code runs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
// --- MAIN PROCESS: Node.js, windows, the operating system. Logs go to the terminal.
console.log('[main] running on', os.platform());
// Answer a question from the window (the "kitchen" serving an order)
ipcMain.handle('get-username', () =&gt; os.userInfo().username);
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // The preload runs inside the renderer, just before index.html loads
      preload: path.join(__dirname, 'preload.js'),
      // contextIsolation and sandbox are on by default. Leave them on.
    },
  });
  win.loadFile('index.html'); // RENDERER PROCESS: shows this page
}
app.whenReady().then(() =&gt; {
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// --- preload.js (runs in the renderer, logs go to DevTools)
// const { contextBridge, ipcRenderer } = require('electron');
// contextBridge.exposeInMainWorld('api', {
//   getUsername: () =&gt; ipcRenderer.invoke('get-username'),
//   chromeVersion: () =&gt; process.versions.chrome,
// });
// --- renderer.js (your page: DOM yes, require no, logs go to DevTools)
// window.api.getUsername().then((name) =&gt; {
//   document.querySelector('h1').textContent = `Hello, ${name}!`;
// });
</code></pre>

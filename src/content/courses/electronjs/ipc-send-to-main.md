---
publishDate: 2026-10-25T12:16
title: 'IPC Part 1: Sending Messages to the Main Process'
slug: ipc-send-to-main
metadescription: Send one-way messages from a web page to Electron's main process with ipcRenderer.send and ipcMain.on, wired safely through a preload script.
updateDate: 2026-10-25T12:16
author: ['bishal-biswas']
level: 1
tags: ['ipc', 'ipcrenderer', 'ipcmain']
course: electronjs
---

## What IPC means

Your app runs as several **processes**: one main process and one renderer process per window. A process is a running program with its own private memory. One process cannot simply read another's variables.

So how does a button click in a window make the main process do something? The processes send each other **messages**. This is called **IPC**, short for **inter-process communication**.

In the hotel from [Preload Scripts Explained](/courses/electronjs/preload-scripts), IPC is the internal phone line between the front desk (the preload) and the back office (the main process). Each kind of request has its own extension number, called a **channel**. Ring extension `set-title`, say what you want, and the back office does it.

This lesson covers the simplest kind of message: **one-way**, from a window to the main process. The page says "please do this" and moves on without waiting for an answer. Think of dropping a note in the back office's mailbox.

## The three pieces

Every IPC feature touches three files. Keep this picture in mind:

```text
renderer.js            preload.js                         main.js
(the page)             (the front desk)                   (the back office)

button click  ---->  electronAPI.setTitle(title)  ---->  ipcMain.on('set-title', ...)
                     ipcRenderer.send('set-title', title)    win.setTitle(title)
```

- **main.js** listens on a channel with `ipcMain.on(channel, listener)`.
- **preload.js** sends on that channel with `ipcRenderer.send(channel, ...args)`, wrapped in a small named function exposed with `contextBridge`.
- **renderer.js** calls that named function when something happens on the page.

You will build exactly this: a text box that changes the window's title.

## Step 1: listen in the main process

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

ipcMain.on('set-title', (event, title) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.setTitle(title);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');
}
```

Let's read the listener carefully:

- `'set-title'` is the **channel name**. It is just a string you choose. Both sides must spell it exactly the same.
- The listener always receives an **`event` object first**, then whatever arguments the page sent (here, `title`).
- `event.sender` is the `webContents` (the web page) that sent the message.
- `BrowserWindow.fromWebContents(event.sender)` finds the window that page lives in. This way, if you have several windows, you change the title of the one that asked.

Notice that `ipcMain.on` is at the **top level** of `main.js`, not inside `createWindow()`. You register a listener once for the whole app, and it hears messages from every window.

## Step 2: send from the preload

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title),
});
```

The page gets `window.electronAPI.setTitle(title)`. It never sees `ipcRenderer` or the channel name. If you are unsure why, revisit [Context Isolation and contextBridge](/courses/electronjs/context-isolation-and-contextbridge).

## Step 3: call it from the page

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>IPC demo</title>
  </head>
  <body>
    <label>
      New title:
      <input id="title-input" />
    </label>
    <button id="set-button">Set title</button>
    <script src="renderer.js"></script>
  </body>
</html>
```

```javascript
// renderer.js
const input = document.getElementById('title-input');
const button = document.getElementById('set-button');

button.addEventListener('click', () => {
  window.electronAPI.setTitle(input.value);
});
```

Run `npm start`, type "My Notes" and click **Set title**. The window's title bar changes to "My Notes". (On macOS, look at the title at the top of the window.)

### What happened, step by step

1. You clicked the button. `renderer.js` called `window.electronAPI.setTitle('My Notes')`.
2. That function lives in the preload. It called `ipcRenderer.send('set-title', 'My Notes')`.
3. Electron copied the string and delivered it to the main process on the `set-title` channel.
4. `ipcMain.on('set-title', ...)` ran with `event` and `'My Notes'`.
5. The main process found the right window and called `win.setTitle('My Notes')`.

`send` does not wait for anything and does not return anything. The page carried on the moment the message left.

## A second example: logging to the terminal

Remember that `console.log` in the page only shows up in DevTools? Sometimes you want page events in your terminal, or in a log file. That is a perfect one-way message.

```javascript
// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title),
  log: (level, message) => ipcRenderer.send('log', level, message),
});
```

```javascript
// main.js
ipcMain.on('log', (event, level, message) => {
  const url = event.senderFrame?.url ?? 'unknown page';
  console.log(`[${level}] ${message}  (from ${url})`);
});
```

```javascript
// renderer.js
window.electronAPI.log('info', 'Page loaded');
```

```text
[info] Page loaded  (from file:///C:/Users/asha/my-app/index.html)
```

Two things to notice:

- You can send **several arguments**. They arrive in the same order after `event`.
- `event.senderFrame` describes the exact frame (page) that sent the message, including its `url`. It can be `null` if the page has already gone away, so the `?.` operator guards against that. You will use `senderFrame` for security checks in [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api).

## What you can send

Arguments are copied with the **structured clone algorithm**, the same copying rules as the browser's `postMessage`. In practice:

- **Works:** strings, numbers, booleans, `null`, `undefined`, arrays, plain objects, `Date`, `Map`, `Set`, typed arrays such as `Uint8Array`.
- **Does not work:** functions, DOM elements (like a `<div>`), class instances (they arrive as plain objects without their methods), Promises.

Try to send a function and the preload throws:

```text
Error: An object could not be cloned.
```

The rule of thumb: **send plain data**. Instead of sending a DOM element, send the values you need from it, like `input.value`.

## When to use one-way messages

Use `send` and `on` when the page needs to **tell** the main process something and does not need a reply:

- change the window title, minimise or close the window
- write a log line
- tell the main process "the user clicked Save" when the main process will do the rest
- open a Settings window (see [Working with Multiple Windows](/courses/electronjs/multiple-windows))

If the page needs an **answer** ("what is in this file?", "did saving work?"), use `invoke` and `handle` instead. That is the next lesson, [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle).

> **Warning:** You may find old tutorials that use `ipcRenderer.sendSync`. It freezes the whole page until the main process answers. Avoid it. `invoke` does the same job without freezing anything.

## Naming your channels

As your app grows you will have dozens of channels. A simple naming habit keeps them readable:

```text
window:set-title
window:minimize
log:write
notes:save
settings:open
```

The part before the colon groups related channels. Electron does not care about the format; it is only for you.

## Common mistakes

### Registering the listener inside `createWindow()`

```javascript
function createWindow() {
  // ...
  ipcMain.on('set-title', handler); // runs again for every new window!
}
```

Each new window adds another copy of the listener, so one click runs the handler twice, then three times. Register `ipcMain.on` once, at the top level of `main.js`.

### A typo in the channel name

If the preload sends `'set-titel'` and the main process listens on `'set-title'`, **nothing happens**: no error, no warning. When a message seems to vanish, compare the two strings character by character. Keeping channel names in one place helps.

### Expecting a return value from `send`

```javascript
const result = ipcRenderer.send('set-title', 'Hi');
console.log(result); // undefined
```

`send` is one-way. For an answer, use `invoke` (next lesson).

### Forgetting the `event` parameter

```javascript
ipcMain.on('set-title', (title) => { ... }); // title is actually the event object!
```

The first parameter is always `event`. Your data starts at the second.

## Quick recap

- IPC (inter-process communication) is how the page and the main process talk, using named **channels**.
- One-way messages: `ipcRenderer.send(channel, ...args)` in the preload, `ipcMain.on(channel, (event, ...args) => {})` in main.
- Wrap `send` in a small named function exposed with `contextBridge`; the page never touches `ipcRenderer`.
- `event.sender` is the sending page; `BrowserWindow.fromWebContents(event.sender)` finds its window. `event.senderFrame.url` tells you which page sent it.
- Arguments are copied with structured clone: send plain data, never functions or DOM elements.
- Register `ipcMain.on` once at the top level, and double-check channel names, since typos fail silently.
- Use `send` for "do this"; use `invoke` when you need an answer.

<code id="code-content" class="language-javascript">
// main.js: one-way messages from the page to the main process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
// --- Listeners are registered once, at the top level
ipcMain.on('set-title', (event, title) =&gt; {
  const win = BrowserWindow.fromWebContents(event.sender); // the window that asked
  if (win &amp;&amp; typeof title === 'string') win.setTitle(title);
});
ipcMain.on('log', (event, level, message) =&gt; {
  const url = event.senderFrame?.url ?? 'unknown page';
  console.log(`[${level}] ${message}  (from ${url})`);
});
// --- preload.js:
//   const { contextBridge, ipcRenderer } = require('electron');
//   contextBridge.exposeInMainWorld('electronAPI', {
//     setTitle: (title) =&gt; ipcRenderer.send('set-title', title),
//     log: (level, message) =&gt; ipcRenderer.send('log', level, message),
//   });
// --- renderer.js:
//   button.addEventListener('click', () =&gt; window.electronAPI.setTitle(input.value));
//   window.electronAPI.log('info', 'Page loaded');
// --- The window
function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}
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

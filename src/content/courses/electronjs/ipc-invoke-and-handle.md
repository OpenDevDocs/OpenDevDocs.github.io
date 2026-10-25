---
publishDate: 2026-10-25T12:17
title: 'IPC Part 2: Asking Questions with invoke and handle'
slug: ipc-invoke-and-handle
metadescription: Ask Electron's main process a question and await the answer with ipcRenderer.invoke and ipcMain.handle, including async work and error handling.
updateDate: 2026-10-25T12:17
author: ['bishal-biswas']
level: 1
tags: ['ipc', 'invoke', 'async']
course: electronjs
---

## From notes to phone calls

In [IPC Part 1: Sending Messages to the Main Process](/courses/electronjs/ipc-send-to-main) the page sent one-way messages. That is like dropping a note in the back office's mailbox: you do not wait around for a reply.

Very often, though, the page needs an **answer**:

- "What is the app's version?"
- "Load the user's note from disk."
- "Did saving work?"

For that you make a **phone call** instead: you ask, you wait, and you get a reply. In Electron the phone call is `ipcRenderer.invoke` on the page side and `ipcMain.handle` on the main side. It is the IPC pattern you will use most.

## The shape of invoke and handle

```text
renderer.js                 preload.js                               main.js

await getInfo()  ---->  ipcRenderer.invoke('app:get-info')  ---->  ipcMain.handle('app:get-info', ...)
      ^                                                                    |
      |_____________________ the handler's return value ___________________|
```

- `ipcMain.handle(channel, handler)` in main says "when someone calls this channel, run this function and send back what it returns".
- `ipcRenderer.invoke(channel, ...args)` in the preload sends the request and returns a **Promise**, which resolves with the handler's return value.

A **Promise** is JavaScript's "I owe you": an object that will hold a value later. You wait for it with `await` inside an `async` function. Because of this, the page never freezes while the main process works.

## Step 1: a simple question

Start with the plain app from [Your First Electron App](/courses/electronjs/your-first-electron-app). In `main.js`, register a handler:

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

ipcMain.handle('app:get-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
  };
});
```

The handler simply **returns** a value. Electron takes care of sending it back.

`app.getName()` and `app.getVersion()` read the `productName` (or `name`) and `version` from your `package.json`.

Expose it in the preload:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
});
```

And use it in the page:

```html
<!-- index.html (inside body) -->
<p id="info">Loading...</p>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
async function showInfo() {
  const info = await window.electronAPI.getAppInfo();
  document.getElementById('info').textContent =
    `${info.name} ${info.version} running on ${info.platform}`;
}

showInfo();
```

Run `npm start`:

```text
my-electron-app 1.0.0 running on win32
```

On macOS the platform says `darwin` and on Linux `linux`.

## Step 2: async work in the handler

Handlers can be `async`. Electron waits for the Promise to finish before replying. This is perfect for file work, which is slow and should never block.

Here is a tiny one-note notepad. The note is saved in the app's private data folder (see [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data)).

```javascript
// main.js
const { readFile, writeFile } = require('node:fs/promises');

const notePath = () => path.join(app.getPath('userData'), 'note.txt');

ipcMain.handle('note:load', async () => {
  try {
    return await readFile(notePath(), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return ''; // no note yet: start empty
    throw error;
  }
});

ipcMain.handle('note:save', async (event, text) => {
  if (typeof text !== 'string') {
    throw new Error('The note must be text.');
  }
  await writeFile(notePath(), text, 'utf8');
  return { savedAt: new Date().toLocaleTimeString() };
});
```

- `ENOENT` is Node's error code for "file not found". On the first run there is no note, so we return an empty string instead of failing.
- Like `ipcMain.on`, the handler's first parameter is always `event`. The page's arguments come after it.
- `note:save` checks that it really got a string. The main process should never trust its input blindly. More on that in [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api).

Add the two functions to the preload:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  loadNote: () => ipcRenderer.invoke('note:load'),
  saveNote: (text) => ipcRenderer.invoke('note:save', text),
});
```

And build the page:

```html
<!-- index.html (inside body) -->
<p id="info">Loading...</p>
<textarea id="note" rows="10" cols="50"></textarea>
<br />
<button id="save">Save</button>
<span id="status"></span>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
const note = document.getElementById('note');
const status = document.getElementById('status');

async function start() {
  const info = await window.electronAPI.getAppInfo();
  document.getElementById('info').textContent = `${info.name} ${info.version}`;
  note.value = await window.electronAPI.loadNote();
}

document.getElementById('save').addEventListener('click', async () => {
  status.textContent = 'Saving...';
  const result = await window.electronAPI.saveNote(note.value);
  status.textContent = `Saved at ${result.savedAt}`;
});

start();
```

Type something, click **Save**, quit the app and start it again. Your note is still there. The page never touched the file system: it only asked the main process, politely, through one narrow door.

## When things go wrong

If a handler **throws** an error (or its Promise rejects), the Promise in the page **rejects** too. Catch it with `try ... catch`:

```javascript
// renderer.js
document.getElementById('save').addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.saveNote(note.value);
    status.textContent = `Saved at ${result.savedAt}`;
  } catch (error) {
    status.textContent = 'Could not save your note.';
    console.error(error.message);
  }
});
```

To see this happen, make the handler throw on purpose, for example `throw new Error('Disk is full')`. The page's console shows:

```text
Error invoking remote method 'note:save': Error: Disk is full
```

And your terminal shows the main process side:

```text
Error occurred in handler for 'note:save': Error: Disk is full
    at ...main.js:31:11
```

Notice that only the **message** crosses over. The page gets a new `Error` with Electron's prefix added, not the original error object, and no extra properties like `error.code`.

### Returning results instead of throwing

For errors you expect (file not found, invalid input), many apps return a small result object instead of throwing. The page then gets clear data and no prefix to strip off:

```javascript
// main.js
ipcMain.handle('note:save', async (event, text) => {
  if (typeof text !== 'string') return { ok: false, error: 'The note must be text.' };
  try {
    await writeFile(notePath(), text, 'utf8');
    return { ok: true, savedAt: new Date().toLocaleTimeString() };
  } catch {
    return { ok: false, error: 'Could not write the file.' };
  }
});
```

```javascript
// renderer.js
const result = await window.electronAPI.saveNote(note.value);
status.textContent = result.ok ? `Saved at ${result.savedAt}` : result.error;
```

Either style is fine. Pick one and use it consistently.

## Rules for handlers

### One handler per channel

Unlike `ipcMain.on`, a channel can have only **one** handler. Registering a second one throws:

```text
Error: Attempted to register a second handler for 'note:save'
```

If you really need to replace a handler, call `ipcMain.removeHandler('note:save')` first. Usually this error means you put `ipcMain.handle` inside `createWindow()`, which runs once per window. Register handlers once, at the top level.

### Register before the page asks

If the page invokes a channel that has no handler, the Promise rejects with:

```text
Error invoking remote method 'note:load': Error: No handler registered for 'note:load'
```

This happens when you misspell the channel name, or register the handler too late (for example, after a slow `await`). Register all handlers before you create your windows.

### Return plain data

The return value is copied with the same structured clone rules as arguments: plain objects, arrays, strings, numbers, `Date` and `Map` are fine; functions and class instances are not. Return just what the page needs.

## send or invoke?

| | `send` + `on` | `invoke` + `handle` |
| --- | --- | --- |
| Direction | Page to main | Page to main, answer comes back |
| Returns | Nothing | A Promise with the handler's return value |
| Errors reach the page? | No | Yes, the Promise rejects |
| Listeners per channel | Many | Exactly one handler |
| Good for | "Do this" | "Tell me" or "Do this and tell me how it went" |

When in doubt, use `invoke`. Even for actions, knowing that something finished (or failed) is usually useful.

> **Note:** Older code sometimes sends a message with `send` and then waits for a separate reply message on another channel. `invoke` replaces that whole dance with one call.

## Common mistakes

### Forgetting `await`

```javascript
const info = window.electronAPI.getAppInfo();
console.log(info.version); // undefined: info is a Promise, not the data
```

`invoke` always returns a Promise. Use `await` (inside an `async` function) or `.then()`.

### Forgetting `return` in the preload function

```javascript
// preload.js
loadNote: () => { ipcRenderer.invoke('note:load'); }, // returns undefined!
```

With curly braces, an arrow function needs an explicit `return`. Write `() => ipcRenderer.invoke('note:load')` without braces, or add `return`.

### Registering handlers inside `createWindow()`

The second window crashes the app with "Attempted to register a second handler". Move `ipcMain.handle` calls to the top level.

### Expecting the full error object

Only the message crosses the process boundary. If the page needs details such as an error code, return them as data instead of throwing.

## Quick recap

- `ipcRenderer.invoke(channel, ...args)` sends a request and returns a Promise; `ipcMain.handle(channel, handler)` answers it.
- Whatever the handler returns (or resolves to) becomes the page's answer. Handlers can be `async`.
- The handler's first parameter is `event`; the page's arguments follow.
- A thrown error rejects the page's Promise with the prefix "Error invoking remote method"; only the message crosses.
- Each channel has exactly one handler. Register handlers once, at the top level, before creating windows.
- Use `invoke` for questions and for actions where you want to know the result; use `send` for pure fire-and-forget messages.

<code id="code-content" class="language-javascript">
// main.js: answering questions from the page with ipcMain.handle
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { readFile, writeFile } = require('node:fs/promises');
const notePath = () =&gt; path.join(app.getPath('userData'), 'note.txt');
// --- A simple question: return a value
ipcMain.handle('app:get-info', () =&gt; ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
}));
// --- Async work: Electron waits for the Promise before replying
ipcMain.handle('note:load', async () =&gt; {
  try {
    return await readFile(notePath(), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return ''; // first run: no note yet
    throw error; // the page's Promise rejects
  }
});
// --- Expected problems come back as data instead of errors
ipcMain.handle('note:save', async (event, text) =&gt; {
  if (typeof text !== 'string') return { ok: false, error: 'The note must be text.' };
  try {
    await writeFile(notePath(), text, 'utf8');
    return { ok: true, savedAt: new Date().toLocaleTimeString() };
  } catch {
    return { ok: false, error: 'Could not write the file.' };
  }
});
// --- preload.js:
//   contextBridge.exposeInMainWorld('electronAPI', {
//     getAppInfo: () =&gt; ipcRenderer.invoke('app:get-info'),
//     loadNote: () =&gt; ipcRenderer.invoke('note:load'),
//     saveNote: (text) =&gt; ipcRenderer.invoke('note:save', text),
//   });
// --- renderer.js:
//   note.value = await window.electronAPI.loadNote();
//   const result = await window.electronAPI.saveNote(note.value);
// --- The window and the standard lifecycle
function createWindow() {
  const win = new BrowserWindow({
    width: 700,
    height: 500,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
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
</code></pre>

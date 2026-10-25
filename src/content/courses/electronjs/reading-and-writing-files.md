---
publishDate: 2026-10-25T12:30
title: Reading and Writing Files from Your App
slug: reading-and-writing-files
metadescription: "Read and write files in Electron safely: use node:fs/promises in main, pick files with native dialogs, handle errors, and never trust paths sent by the page."
updateDate: 2026-10-25T12:30
author: ['bishal-biswas']
level: 1
tags: ['files', 'fs', 'security']
course: electronjs
---

## Where file code lives

Reading and writing files is the moment your app becomes a real desktop app. A web page cannot save a note straight to your Documents folder. An Electron app can.

But there is a rule: **file code runs in the main process.** Your page (the renderer) is sandboxed, which means it has no access to Node's `fs` module. A sandboxed preload cannot load it either. That is on purpose. If an attacker ever managed to run code in your page, they still could not touch the disk.

Think of a bank. Customers (your page) never walk into the vault. They fill in a slip and hand it to the teller (main). The teller checks the slip, decides whether it makes sense, and only then goes to the vault (the disk). In this lesson you will build that teller.

You will make a tiny text editor with **Open**, **Save** and **Save As** buttons:

1. Main reads and writes files with `node:fs/promises`.
2. The user picks files with native dialogs.
3. The page only ever sends text, never file paths.

## Step 1: reading and writing in main

Node's `fs/promises` module gives you Promise-based file functions. The two you need most are `readFile` and `writeFile`. In CommonJS, which this course uses for `main.js`, you load it with `require`:

```javascript
// main.js
const fs = require('node:fs/promises');
const path = require('node:path');
const { app } = require('electron');

app.whenReady().then(async () => {
  const file = path.join(app.getPath('documents'), 'electron-test.txt');

  await fs.writeFile(file, 'Hello from Electron!', 'utf8');
  const text = await fs.readFile(file, 'utf8');

  console.log('Wrote and read back:', text);
  console.log('File is at:', file);
});
```

```text
Wrote and read back: Hello from Electron!
File is at: C:\Users\asha\Documents\electron-test.txt
```

- `app.getPath('documents')` returns the user's Documents folder on any operating system. [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data) explains all the special folders.
- `'utf8'` is the **encoding**: how the bytes on disk turn into text. Without it, `readFile` returns a `Buffer` (raw bytes) instead of a string.
- `writeFile` creates the file if it does not exist and **replaces** it completely if it does.

> **Note:** Node also has synchronous versions such as `fs.readFileSync()`. Avoid them in main. While they run, the main process is frozen: windows stop responding, menus do not open and IPC messages wait.

Delete that test code before moving on. Now you will connect files to a page.

## Step 2: the editor page

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>Tiny Editor</title>
  </head>
  <body>
    <button id="open">Open...</button>
    <button id="save">Save</button>
    <button id="save-as">Save As...</button>
    <span id="file-name">Untitled</span>
    <p id="message"></p>
    <textarea id="editor" rows="20" cols="80"></textarea>
    <script src="renderer.js"></script>
  </body>
</html>
```

## Step 3: the preload, a small and safe API

The preload exposes three functions. Look closely: **none of them accepts a path.**

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('files', {
  open: () => ipcRenderer.invoke('file:open'),
  save: (text) => ipcRenderer.invoke('file:save', text),
  saveAs: (text) => ipcRenderer.invoke('file:save-as', text),
});
```

The page can say "open a file" or "save this text". It cannot say "read `C:\Users\asha\secret.txt`". Main decides which file, based on what the **user** picked in a dialog.

## Step 4: open, save and save as in main

Main keeps track of the file that is currently open in a variable. It only ever gets a value from a dialog the user answered.

```javascript
// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB is plenty for a text editor
const filters = [
  { name: 'Text files', extensions: ['txt', 'md'] },
  { name: 'All files', extensions: ['*'] },
];
let currentFile = null; // set only from dialogs

ipcMain.handle('file:open', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (result.canceled) return { ok: false, canceled: true };

  const filePath = result.filePaths[0];
  try {
    const info = await fs.stat(filePath);
    if (info.size > MAX_SIZE) return { ok: false, message: 'That file is too big for this editor.' };

    const text = await fs.readFile(filePath, 'utf8');
    currentFile = filePath;
    return { ok: true, name: path.basename(filePath), text };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
});
```

What happens, step by step:

1. Show the open dialog (from [Native Dialogs](/courses/electronjs/native-dialogs)). If the user cancels, say so and stop.
2. `fs.stat()` checks the file size **before** reading, so nobody accidentally loads a 2 GB video into a text box.
3. Read the file as text and remember its path in `currentFile`.
4. Return a small object to the page: the file's **name** (not its full path) and its text.

Saving follows the same idea. If no file is open yet, "Save" behaves like "Save As":

```javascript
// main.js
async function askForSavePath(win) {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: currentFile ?? path.join(app.getPath('documents'), 'untitled.txt'),
    filters,
  });
  return result.canceled ? null : result.filePath;
}

async function saveText(event, text, forceDialog) {
  if (typeof text !== 'string') return { ok: false, message: 'Nothing to save.' };

  const win = BrowserWindow.fromWebContents(event.sender);
  let target = currentFile;
  if (forceDialog || !target) {
    target = await askForSavePath(win);
    if (!target) return { ok: false, canceled: true };
  }

  try {
    await fs.writeFile(target, text, 'utf8');
    currentFile = target;
    return { ok: true, name: path.basename(target) };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
}

ipcMain.handle('file:save', (event, text) => saveText(event, text, false));
ipcMain.handle('file:save-as', (event, text) => saveText(event, text, true));
```

## Step 5: friendly error messages

File operations fail for normal reasons: the file was deleted, it is on a USB stick that was unplugged, or the user does not have permission. Node errors have a `code` property that tells you why. Turn the common ones into words a person understands:

```javascript
// main.js
function friendlyError(error) {
  switch (error.code) {
    case 'ENOENT':
      return 'The file no longer exists.';
    case 'EACCES':
    case 'EPERM':
      return 'You do not have permission to use this file.';
    case 'EISDIR':
      return 'That is a folder, not a file.';
    case 'ENOSPC':
      return 'The disk is full.';
    default:
      return `Something went wrong: ${error.message}`;
  }
}
```

Returning `{ ok: false, message }` instead of throwing keeps the page simple: it just checks `ok`.

## Step 6: the renderer

```javascript
// renderer.js
const editor = document.getElementById('editor');
const fileName = document.getElementById('file-name');
const message = document.getElementById('message');

function report(result, successText) {
  if (result.canceled) return;
  message.textContent = result.ok ? successText : result.message;
  if (result.ok) fileName.textContent = result.name;
}

document.getElementById('open').addEventListener('click', async () => {
  const result = await window.files.open();
  if (result.ok) editor.value = result.text;
  report(result, 'Opened.');
});

document.getElementById('save').addEventListener('click', async () => {
  report(await window.files.save(editor.value), 'Saved.');
});

document.getElementById('save-as').addEventListener('click', async () => {
  report(await window.files.saveAs(editor.value), 'Saved as a new file.');
});
```

Run `npm start`. Type something, click **Save**, pick a name, and check the file in your file manager. Close the app, start it again, click **Open**, and your text is back.

## Never trust a path from the page

You may be tempted to write a "simpler" API like this:

```javascript
// main.js: DON'T DO THIS
ipcMain.handle('read-file', (event, filePath) => fs.readFile(filePath, 'utf8'));
ipcMain.handle('write-file', (event, filePath, text) => fs.writeFile(filePath, text));
```

It works, but it turns your app into an open door. Any script that runs in your page, for example through a bug that lets someone inject HTML, could now read private files such as browser data or SSH keys, or overwrite important files. The page is the least trusted part of your app.

Safe sources of paths are:

- A **dialog** the user answered, as in this lesson.
- A **dropped file** whose path the preload sent straight to main, as in [Drag and Drop Files](/courses/electronjs/drag-and-drop-files).
- A **folder your app owns**, such as its user data folder.

### Files inside your own folder

Sometimes the page really does need to name a file, for example "load the note called `shopping.txt`" from your app's notes folder. Then accept a **name**, not a path, and make sure it stays inside the folder:

```javascript
// main.js
function resolveInside(baseDir, name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  const full = path.resolve(baseDir, name);
  if (!full.startsWith(baseDir + path.sep)) return null; // blocks "../../secret.txt"
  return full;
}

const notesDir = path.join(app.getPath('userData'), 'notes');

ipcMain.handle('note:read', async (event, name) => {
  const filePath = resolveInside(notesDir, name);
  if (!filePath) return { ok: false, message: 'Invalid note name.' };
  try {
    return { ok: true, text: await fs.readFile(filePath, 'utf8') };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
});
```

`path.resolve()` turns tricks like `../../Windows/system.ini` into a real full path. If that path is not inside `notesDir`, it is rejected. This kind of attack is called **path traversal**, and this check stops it. [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api) covers more patterns like it.

## Files that ship with your app

You can read files that you include in your project, such as a welcome template, with `path.join(__dirname, 'templates', 'welcome.md')`. Treat them as **read-only**. When you package your app, they end up inside an archive called ASAR, or inside a protected folder such as Program Files, where writing fails. User files always go into the user's folders, never next to your code.

## Common mistakes

### Using `fs` in the renderer or preload

`require('fs')` fails in a sandboxed preload, and the page has no `require` at all. Do file work in main and call it through IPC.

### Forgetting the encoding

`await fs.readFile(file)` without `'utf8'` returns a `Buffer`. Your textarea then shows numbers or `[object Uint8Array]`. Pass `'utf8'` for text files.

### Ignoring a cancelled dialog

`result.filePaths[0]` is `undefined` after a cancel. Check `result.canceled` before touching the disk.

### Accepting any path from the page

A handler that reads or writes whatever path it is given is a security hole. Take paths only from dialogs, drops checked by main, or folders your app owns.

## Quick recap

- File access happens in main with `node:fs/promises`: `readFile(path, 'utf8')`, `writeFile(path, text, 'utf8')`, `stat(path)`.
- Avoid the `Sync` functions in main, because they freeze your app.
- The page asks through a small preload API (`open`, `save`, `saveAs`) and sends text, never paths.
- Main gets paths from native dialogs and remembers the current file itself.
- Check the size before reading, catch errors, and turn `error.code` values like `ENOENT` and `EACCES` into friendly messages.
- If the page must name a file, accept a name and keep it inside a known folder with `path.resolve()` plus a `startsWith()` check.
- Files shipped with your app are read-only. Save user data in the user's folders.

<code id="code-content" class="language-javascript">
// main.js: a tiny editor's file handling, with paths chosen only through dialogs
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const MAX_SIZE = 5 * 1024 * 1024;
const filters = [
  { name: 'Text files', extensions: ['txt', 'md'] },
  { name: 'All files', extensions: ['*'] },
];
let currentFile = null; // only ever set from a dialog the user answered
// --- 1. Turn Node error codes into friendly words
function friendlyError(error) {
  if (error.code === 'ENOENT') return 'The file no longer exists.';
  if (error.code === 'EACCES' || error.code === 'EPERM') return 'You do not have permission to use this file.';
  if (error.code === 'EISDIR') return 'That is a folder, not a file.';
  return `Something went wrong: ${error.message}`;
}
// --- 2. Open: dialog, size check, read as text
ipcMain.handle('file:open', async (event) =&gt; {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (result.canceled) return { ok: false, canceled: true };
  const filePath = result.filePaths[0];
  try {
    const info = await fs.stat(filePath);
    if (info.size &gt; MAX_SIZE) return { ok: false, message: 'That file is too big.' };
    const text = await fs.readFile(filePath, 'utf8');
    currentFile = filePath;
    return { ok: true, name: path.basename(filePath), text };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
});
// --- 3. Save and Save As: the page sends text, main decides where
async function saveText(event, text, forceDialog) {
  if (typeof text !== 'string') return { ok: false, message: 'Nothing to save.' };
  let target = currentFile;
  if (forceDialog || !target) {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      defaultPath: currentFile ?? path.join(app.getPath('documents'), 'untitled.txt'),
      filters,
    });
    if (result.canceled) return { ok: false, canceled: true };
    target = result.filePath;
  }
  try {
    await fs.writeFile(target, text, 'utf8');
    currentFile = target;
    return { ok: true, name: path.basename(target) };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  }
}
ipcMain.handle('file:save', (event, text) =&gt; saveText(event, text, false));
ipcMain.handle('file:save-as', (event, text) =&gt; saveText(event, text, true));
// --- 4. Window and lifecycle
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
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

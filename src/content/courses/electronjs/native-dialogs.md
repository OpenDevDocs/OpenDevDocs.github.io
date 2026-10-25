---
publishDate: 2026-10-25T12:24
title: 'Native Dialogs: Open, Save and Message Boxes'
slug: native-dialogs
metadescription: Show native open and save file dialogs and message boxes in Electron from the main process, call them from your page with IPC, and remember the last folder.
updateDate: 2026-10-25T12:24
author: ['bishal-biswas']
level: 1
tags: ['dialog', 'files', 'ipc']
course: electronjs
---

## What a native dialog is

A **dialog** is a small window that asks the user something: "Which file do you want to open?", "Where should I save this?", "Are you sure you want to delete this note?"

A **native** dialog is drawn by the operating system, not by your HTML. On Windows it looks like every other Windows file picker, on macOS it slides down from the top of your window, and on Linux it matches the desktop's own style. Users already know how to use them, which is why real desktop apps use them.

Think of it like a hotel reception desk. You do not walk into the storage room to find your luggage. You ask reception, they fetch it, and they hand you exactly what you asked for. The operating system's file picker is that reception desk: the user picks the file, and your app gets back only the path they chose.

Electron's `dialog` module gives you four kinds of dialog:

| Function | What it does |
| --- | --- |
| `dialog.showOpenDialog()` | Lets the user pick one or more files or folders |
| `dialog.showSaveDialog()` | Lets the user choose a name and place for a new file |
| `dialog.showMessageBox()` | Shows a message with buttons, such as OK and Cancel |
| `dialog.showErrorBox()` | Shows a simple error message with one OK button |

`dialog` lives in the **main process only**. Your page cannot call it directly, so every example here uses the same pattern from [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle): the page calls a preload function, the preload calls `ipcRenderer.invoke()`, and main answers with `ipcMain.handle()`.

## Step 1: an open dialog

Start with a plain app. In `main.js`, add a handler that shows the open dialog and returns the chosen path:

```javascript
// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');
}

ipcMain.handle('dialog:open-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Open a text file',
    properties: ['openFile'],
    filters: [
      { name: 'Text files', extensions: ['txt', 'md'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });

  if (result.canceled) return null;
  return result.filePaths[0];
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

`showOpenDialog()` returns a Promise. When it resolves you get an object with two fields:

- `canceled`: `true` if the user closed the dialog or pressed Cancel.
- `filePaths`: an array of the chosen paths. It is empty when the dialog was cancelled.

Always check `canceled` first. Users cancel dialogs all the time, and your code must not crash when they do.

Now expose a small function in the preload:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dialogs', {
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
});
```

Add a button and a place for the result to your page:

```html
<!-- index.html (inside <body>) -->
<button id="open">Open file...</button>
<p id="result">No file chosen yet.</p>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
document.getElementById('open').addEventListener('click', async () => {
  const filePath = await window.dialogs.openFile();
  document.getElementById('result').textContent = filePath ?? 'You cancelled.';
});
```

Run `npm start` and click the button. A real file picker opens. Choose a file and you see its full path:

```text
C:\Users\asha\Downloads\notes.txt
```

On macOS and Linux it looks like `/Users/asha/Downloads/notes.txt` or `/home/asha/Downloads/notes.txt`.

### Why pass the window?

The first argument, `win`, is the window the dialog belongs to. With it, the dialog is **modal**: it stays on top of that window and blocks clicks to it until the user answers. On macOS it also appears as a sheet that slides down from the window's title bar. If you leave the window out, the dialog floats on its own, which feels less polished.

### Filters

`filters` limits which files the user can pick. Each filter has a label and a list of extensions **without** the dot. `'*'` means "any extension". The first filter is selected by default. On Windows and Linux the user can switch filters from a dropdown in the dialog.

### More options in `properties`

The `properties` array switches features on:

| Property | Effect |
| --- | --- |
| `'openFile'` | Allow picking files |
| `'openDirectory'` | Allow picking folders |
| `'multiSelections'` | Allow picking more than one item |
| `'showHiddenFiles'` | Show hidden files (macOS and Windows only) |
| `'createDirectory'` | Show a "New Folder" button (macOS) |

For example, `properties: ['openFile', 'multiSelections']` lets the user pick several files, and `result.filePaths` contains all of them.

> **Note:** On Windows and Linux a dialog can pick files **or** folders, not both. If you pass both `openFile` and `openDirectory` there, you get a folder picker.

## The Downloads folder default

If you do not tell the dialog where to start, the latest Electron opens it in the user's **Downloads** folder (or their home folder if there is no Downloads folder). This changed in Electron 43. Before that, the operating system usually remembered the last folder the user visited. Now it does not.

Users find it annoying to navigate back to the same folder every time, so remember it yourself and pass it as `defaultPath`:

```javascript
// main.js
let lastFolder = app.getPath('documents'); // a friendly starting point

ipcMain.handle('dialog:open-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    defaultPath: lastFolder,
    properties: ['openFile'],
    filters: [{ name: 'Text files', extensions: ['txt', 'md'] }],
  });
  if (result.canceled) return null;

  lastFolder = path.dirname(result.filePaths[0]); // remember for next time
  return result.filePaths[0];
});
```

`path.dirname()` gives the folder part of a path. `app.getPath('documents')` is the user's Documents folder. You will learn about all these special folders in [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data), and how to keep `lastFolder` across restarts in [Saving User Settings](/courses/electronjs/saving-user-settings).

## Step 2: a save dialog

A save dialog lets the user type a file name and pick a folder. It looks similar, but it returns a single `filePath` (a string) instead of an array:

```javascript
// main.js
ipcMain.handle('dialog:save-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: 'Save your note',
    defaultPath: path.join(lastFolder, 'untitled.txt'),
    filters: [{ name: 'Text files', extensions: ['txt'] }],
    properties: ['showOverwriteConfirmation'],
  });

  if (result.canceled) return null;
  lastFolder = path.dirname(result.filePath);
  return result.filePath;
});
```

A few details:

- `defaultPath` can be a folder, or a full path including a suggested file name, as here.
- If the user cancels, `result.filePath` is an empty string and `canceled` is `true`.
- Windows and macOS warn the user if the file already exists. On Linux, the `showOverwriteConfirmation` property turns that warning on.

> **Warning:** A save dialog does **not** save anything. It only asks the user for a path. Writing the file is your job, using Node's `fs` module in main. That is the next big step, in [Reading and Writing Files from Your App](/courses/electronjs/reading-and-writing-files).

## Step 3: a message box

`showMessageBox()` asks a question with buttons. It resolves with the index of the button the user clicked:

```javascript
// main.js
ipcMain.handle('dialog:confirm-delete', async (event, noteTitle) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { response, checkboxChecked } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Delete note',
    message: `Delete "${String(noteTitle)}"?`,
    detail: 'You cannot undo this action.',
    checkboxLabel: 'Do not ask me again',
  });

  return { confirmed: response === 0, dontAskAgain: checkboxChecked };
});
```

What each option does:

- `type`: the icon. One of `'none'`, `'info'`, `'error'`, `'question'` or `'warning'`. On macOS, `warning` and `error` show the same icon.
- `buttons`: the button labels, in order. `response` is the index of the clicked button, so `0` means "Delete" here.
- `defaultId`: the button that is pre-selected, so pressing Enter picks it. Making "Cancel" the default is the safe choice for destructive actions.
- `cancelId`: the button chosen when the user presses Escape.
- `message` and `detail`: the main text and the smaller extra text.
- `checkboxLabel`: adds a checkbox. Its state comes back as `checkboxChecked`.

In the preload and page:

```javascript
// preload.js (add to the dialogs object)
confirmDelete: (title) => ipcRenderer.invoke('dialog:confirm-delete', title),
```

```javascript
// renderer.js
const answer = await window.dialogs.confirmDelete('Shopping list');
if (answer.confirmed) {
  console.log('Deleting...');
}
```

> **Tip:** On Windows, Electron may show some buttons as large "command links" in a modern style. Add `noLink: true` to the options if you prefer normal buttons.

## Step 4: an error box

`dialog.showErrorBox(title, content)` is the simplest dialog: a title, a message and an OK button. It does not return anything.

```javascript
// main.js
dialog.showErrorBox('Could not open file', 'The file is missing or you do not have permission to read it.');
```

It is special in one way: you can call it even **before** the app is ready, which makes it handy for reporting problems very early during startup. (On Linux, if you call it before ready, the message is printed to the terminal instead of shown in a window.)

## Sync versions, and why to avoid them

Each dialog also has a `Sync` version, such as `dialog.showOpenDialogSync()`. They return the answer directly instead of a Promise, but they **freeze the main process** while the dialog is open. Timers, IPC messages and other windows all stop until the user answers. Stick to the Promise versions with `await`.

## Common mistakes

### Calling `dialog` from the renderer

`dialog` does not exist in the page or in a sandboxed preload. You get an error such as `Cannot read properties of undefined`. Always show dialogs from main and reach them through IPC.

### Forgetting to check `canceled`

`result.filePaths[0]` is `undefined` when the user cancels. If you pass that to `fs.readFile()`, your app throws. Check `if (result.canceled) return null;` every time.

### Mixing up `filePaths` and `filePath`

The open dialog returns `filePaths` (an array). The save dialog returns `filePath` (a string). The extra `s` matters.

### Expecting the dialog to remember the folder

Since Electron 43 dialogs start in Downloads unless you pass `defaultPath`. Store the last folder yourself, as shown above.

## Quick recap

- The `dialog` module shows native dialogs. It works only in the main process, so the page reaches it through a preload function and `ipcRenderer.invoke()`.
- `showOpenDialog()` resolves with `{ canceled, filePaths }`. Use `properties` and `filters` to control what can be picked.
- `showSaveDialog()` resolves with `{ canceled, filePath }`. It picks a path; you still write the file yourself.
- `showMessageBox()` resolves with `{ response, checkboxChecked }`, where `response` is the button index.
- `showErrorBox()` is a simple error popup that even works before the app is ready.
- Pass the window as the first argument to make the dialog modal to it.
- Dialogs start in the Downloads folder by default. Remember the last folder and pass it as `defaultPath`.
- Prefer the Promise versions. The `Sync` versions freeze the main process.

<code id="code-content" class="language-javascript">
// main.js: open, save and message box dialogs, reached from the page through IPC
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
let lastFolder; // remembered between dialogs (dialogs default to Downloads otherwise)
const textFilters = [
  { name: 'Text files', extensions: ['txt', 'md'] },
  { name: 'All files', extensions: ['*'] },
];
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}
// --- 1. Open dialog: returns a path or null
ipcMain.handle('dialog:open-file', async (event) =&gt; {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Open a text file',
    defaultPath: lastFolder,
    properties: ['openFile'],
    filters: textFilters,
  });
  if (result.canceled) return null;
  lastFolder = path.dirname(result.filePaths[0]);
  return result.filePaths[0];
});
// --- 2. Save dialog: only picks a path, writing the file comes later
ipcMain.handle('dialog:save-file', async (event) =&gt; {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: 'Save your note',
    defaultPath: path.join(lastFolder, 'untitled.txt'),
    filters: textFilters,
    properties: ['showOverwriteConfirmation'],
  });
  if (result.canceled) return null;
  lastFolder = path.dirname(result.filePath);
  return result.filePath;
});
// --- 3. Message box: returns which button was clicked
ipcMain.handle('dialog:confirm-delete', async (event, noteTitle) =&gt; {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { response, checkboxChecked } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Delete', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Delete note',
    message: `Delete "${String(noteTitle)}"?`,
    detail: 'You cannot undo this action.',
    checkboxLabel: 'Do not ask me again',
  });
  return { confirmed: response === 0, dontAskAgain: checkboxChecked };
});
// --- 4. Lifecycle
app.whenReady().then(() =&gt; {
  lastFolder = app.getPath('documents');
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// preload.js: contextBridge.exposeInMainWorld('dialogs', { openFile: () =&gt; ipcRenderer.invoke('dialog:open-file'), ... })
</code></pre>

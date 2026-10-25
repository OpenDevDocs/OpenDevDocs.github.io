---
publishDate: 2026-10-25T12:29
title: Drag and Drop Files
slug: drag-and-drop-files
metadescription: Let users drop files into your Electron app, get their real paths with webUtils.getPathForFile, and drag files out to the desktop with webContents.startDrag.
updateDate: 2026-10-25T12:29
author: ['bishal-biswas']
level: 2
tags: ['drag-and-drop', 'files', 'webutils']
course: electronjs
---

## Two directions of drag and drop

Desktop users expect to drag files around. There are two directions, and Electron handles them differently:

- **Dragging in:** the user drags a photo from their desktop and drops it onto your app. Your app needs to know which file it was.
- **Dragging out:** the user drags something from your app (say, an exported note) and drops it onto their desktop, into a folder or into an email. The operating system needs a real file to copy.

Think of it like a post office. Dragging in is a letter dropped through your mail slot: you need to read the address on it. Dragging out is handing a parcel to a courier: you must give them a real parcel, not a drawing of one.

## First: stop the window from opening the file

Try this before writing any code: drag a text file from your desktop onto your Electron window. The window **navigates to the file**. Your whole app disappears and the file's content is shown instead. This is the browser's default behaviour for a dropped file, and it is almost never what you want.

You stop it by cancelling the `dragover` and `drop` events for the whole page:

```javascript
// renderer.js
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
```

`dragover` fires again and again while a file is dragged over the page. Calling `preventDefault()` there tells the browser engine "this page accepts drops". Calling it in `drop` stops the default "open the file" action.

> **Tip:** As a second safety net, block unexpected navigation in main with the `will-navigate` event, as shown in [Clipboard and Opening Links with shell](/courses/electronjs/clipboard-and-shell). Then a missed drop can never replace your app.

## Step 1: a drop zone in the page

Add a box that invites the user to drop files, and show what was dropped.

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <link rel="stylesheet" href="styles.css" />
    <title>Drop files</title>
  </head>
  <body>
    <div id="dropzone">Drop files here</div>
    <ul id="files"></ul>
    <div id="export" draggable="true">Drag me to your desktop: notes-summary.txt</div>
    <script src="renderer.js"></script>
  </body>
</html>
```

```css
/* styles.css */
#dropzone {
  border: 3px dashed #999;
  border-radius: 12px;
  padding: 3rem;
  text-align: center;
}

#dropzone.over {
  border-color: #2b7de9;
  background: #eaf2fd;
}

#export {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #f3f4f6;
  cursor: grab;
}
```

Now handle the drag events on the drop zone:

```javascript
// renderer.js
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());

const zone = document.getElementById('dropzone');

zone.addEventListener('dragenter', () => zone.classList.add('over'));
zone.addEventListener('dragleave', () => zone.classList.remove('over'));

zone.addEventListener('drop', (event) => {
  zone.classList.remove('over');
  const files = Array.from(event.dataTransfer.files);
  for (const file of files) {
    console.log(file.name, file.size, 'bytes', file.type);
  }
});
```

Drop a couple of files and open DevTools (Ctrl + Shift + I, or Cmd + Option + I on a Mac). You see each file's name, size and type:

```text
holiday.jpg 482113 bytes image/jpeg
notes.txt 213 bytes text/plain
```

`event.dataTransfer.files` is a list of web `File` objects. The page can already read their content with standard web methods such as `await file.text()`, which is fine for showing a small preview. But it does **not** know where the file lives on disk.

## Step 2: getting the real path with `webUtils`

For real desktop features, such as opening the file again later, watching it for changes, or reading a big file in main, you need its **path**: the full location on disk, like `C:\Users\asha\Pictures\holiday.jpg`.

Older Electron versions added a non-standard `file.path` property to every `File`. **It was removed in Electron 32.** If you see `file.path` in an old tutorial, it now gives `undefined`.

The replacement is `webUtils.getPathForFile(file)`. It is available in the preload, so you wrap it in a small function:

```javascript
// preload.js
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('dropApi', {
  // Takes an array of File objects, sends their paths straight to main
  addFiles: (files) => {
    const paths = files.map((file) => webUtils.getPathForFile(file)).filter((p) => p !== '');
    return ipcRenderer.invoke('files:dropped', paths);
  },
});
```

Notice what this function does **not** do: it does not hand the paths back to the page. The preload turns the `File` objects into paths and sends them directly to main. The page only gets back what main chooses to return. The Electron docs recommend this: avoid exposing full file paths to web content when you can.

`getPathForFile()` returns an empty string when a `File` is not backed by a real file on disk, for example a `File` created in JavaScript, or some items dragged from a web browser. The `filter()` drops those.

> **Warning:** Pass an **array** of files across the bridge, as `Array.from(event.dataTransfer.files)` does. A raw `FileList` (the type of `event.dataTransfer.files`) does not survive the trip through `contextBridge`, and your preload receives an empty list.

## Step 3: checking the files in main

Main receives a list of paths. Treat it like any input from a renderer: check it before using it.

```javascript
// main.js
const fs = require('node:fs/promises');

const droppedFiles = new Set(); // paths the user really dropped; other code may trust these

ipcMain.handle('files:dropped', async (event, paths) => {
  if (!Array.isArray(paths)) return [];

  const accepted = [];
  for (const filePath of paths.slice(0, 20)) { // at most 20 at once
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) continue;
    try {
      const info = await fs.stat(filePath);
      if (!info.isFile()) continue; // skip folders
      droppedFiles.add(filePath);
      accepted.push({ name: path.basename(filePath), size: info.size });
    } catch {
      // the file vanished or cannot be read: skip it
    }
  }
  return accepted;
});
```

- `fs.stat()` reads information about a path: whether it is a file or folder, its size, its dates.
- `path.basename()` gives just the file name, such as `holiday.jpg`.
- The `droppedFiles` set remembers which paths came from a real user action. Later features, like "open this file", can check that set instead of trusting any path the page sends.

Back in the page, show the result:

```javascript
// renderer.js (replace the drop handler)
zone.addEventListener('drop', async (event) => {
  zone.classList.remove('over');
  const accepted = await window.dropApi.addFiles(Array.from(event.dataTransfer.files));

  const list = document.getElementById('files');
  for (const file of accepted) {
    const item = document.createElement('li');
    item.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    list.append(item);
  }
});
```

Drop a few files and a folder. The files appear in the list. The folder is skipped.

> **Note:** The same `webUtils.getPathForFile()` works for files picked with an `<input type="file">` element. Still, for picking files a [native open dialog](/courses/electronjs/native-dialogs) is usually better, because main gets the path directly without trusting the page.

## Step 4: dragging a file out of your app

Now the other direction. The page shows "notes-summary.txt" and the user should be able to drag it onto their desktop.

The browser's own drag only knows about web data, not real files. Electron gives you `webContents.startDrag(item)` in main, which starts a **native** file drag. Its `item` argument has:

- `file`: the full path of the file to drag (or `files`, an array of paths, to drag several).
- `icon`: the image shown under the mouse while dragging, as a path or a `nativeImage`. On macOS it **must not be empty**, or the drag fails.

The flow:

1. The page's `dragstart` event fires on the draggable element.
2. The page cancels the web drag and asks the preload to start a native one.
3. Main finds the real file and calls `event.sender.startDrag()`.

The file has to exist **before** the drag starts. In this example, main writes it when the app starts, into a folder inside the system's temporary directory (`app.getPath('temp')`):

```javascript
// main.js
const exportDir = path.join(app.getPath('temp'), 'my-notes-exports');
const exportFiles = new Map(); // name the page may ask for -> real path

async function prepareExports() {
  await fs.mkdir(exportDir, { recursive: true });
  const filePath = path.join(exportDir, 'notes-summary.txt');
  await fs.writeFile(filePath, 'Shopping list\nHoliday ideas\nBook quotes\n', 'utf8');
  exportFiles.set('notes-summary.txt', filePath);
}

ipcMain.on('drag:start', (event, name) => {
  const filePath = exportFiles.get(name);
  if (!filePath) return; // only files main prepared itself
  event.sender.startDrag({
    file: filePath,
    icon: path.join(__dirname, 'drag-icon.png'),
  });
});
```

Call `await prepareExports()` inside `app.whenReady()` before creating the window. You also need a small `drag-icon.png` (32 by 32 pixels is plenty) in your project folder.

The page only sends a **name**, and main looks it up in a `Map` it filled itself. The page can never make main drag an arbitrary file from the disk.

```javascript
// preload.js (add to the exposed object)
startDrag: (name) => ipcRenderer.send('drag:start', name),
```

```javascript
// renderer.js
document.getElementById('export').addEventListener('dragstart', (event) => {
  event.preventDefault(); // cancel the web drag, Electron starts a native one
  window.dropApi.startDrag('notes-summary.txt');
});
```

Run the app and drag "Drag me to your desktop" onto your desktop or into a folder. A real `notes-summary.txt` file appears there, copied from the temp folder.

## Platform notes

- **macOS:** the drag icon is required and must be a real, non-empty image. Without one, the drag does not start.
- **All platforms:** where the file ends up is decided by the place the user drops it, just like dragging a file in File Explorer, Finder or your Linux file manager. Dropping onto other apps (an email draft, a chat window) works as long as that app accepts files.
- **Linux:** drag and drop between apps depends on the desktop environment. It works on the common ones, but test on the desktops your users have.

## Common mistakes

### The app disappears when a file is dropped

You forgot `preventDefault()` on `dragover` and `drop` for the whole document, so the window navigated to the file. Add both listeners, and a `will-navigate` guard in main.

### `file.path` is undefined

`File.path` was removed in Electron 32. Use `webUtils.getPathForFile(file)` in the preload.

### The preload gets no files

You passed `event.dataTransfer.files` directly. Convert it with `Array.from()` first, because a `FileList` does not cross `contextBridge`.

### Dragging out does nothing

Check that the file exists before the drag, that `icon` points to a real, non-empty image, and that the page called `event.preventDefault()` in `dragstart`.

## Quick recap

- Cancel `dragover` and `drop` on the document, or a dropped file replaces your app.
- `event.dataTransfer.files` gives web `File` objects with `name`, `size` and `type`. Convert it with `Array.from()`.
- `File.path` is gone. Use `webUtils.getPathForFile(file)` in the preload. It returns `''` for files not on disk.
- Send paths from the preload straight to main, and check them with `fs.stat()` before trusting them.
- `event.sender.startDrag({ file, icon })` starts a native drag out of your app. The file must already exist, and the icon must not be empty on macOS.
- Let the page refer to exportable files by name, and let main map names to real paths.

<code id="code-content" class="language-javascript">
// main.js: accept dropped files and drag a prepared file back out
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const droppedFiles = new Set(); // paths the user really dropped
const exportFiles = new Map(); // names the page may drag out -&gt; real paths
// --- 1. Dropped files: paths arrive from the preload (webUtils.getPathForFile)
ipcMain.handle('files:dropped', async (event, paths) =&gt; {
  if (!Array.isArray(paths)) return [];
  const accepted = [];
  for (const filePath of paths.slice(0, 20)) {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) continue;
    try {
      const info = await fs.stat(filePath);
      if (!info.isFile()) continue;
      droppedFiles.add(filePath);
      accepted.push({ name: path.basename(filePath), size: info.size });
    } catch {
      // missing or unreadable: skip
    }
  }
  return accepted;
});
// --- 2. Dragging out: the file must exist before the drag starts
async function prepareExports() {
  const dir = path.join(app.getPath('temp'), 'my-notes-exports');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'notes-summary.txt');
  await fs.writeFile(filePath, 'Shopping list\nHoliday ideas\nBook quotes\n', 'utf8');
  exportFiles.set('notes-summary.txt', filePath);
}
ipcMain.on('drag:start', (event, name) =&gt; {
  const filePath = exportFiles.get(name);
  if (!filePath) return;
  event.sender.startDrag({ file: filePath, icon: path.join(__dirname, 'drag-icon.png') });
});
// --- 3. Window and lifecycle
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.webContents.on('will-navigate', (event) =&gt; event.preventDefault()); // a missed drop never replaces the app
  win.loadFile('index.html');
}
app.whenReady().then(async () =&gt; {
  await prepareExports();
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// preload.js: addFiles(files) maps webUtils.getPathForFile over an ARRAY of File objects
</code></pre>

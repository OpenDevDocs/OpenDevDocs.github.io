---
publishDate: 2026-10-25T12:37
title: 'Project: A Markdown Notes App'
slug: project-markdown-notes-app
metadescription: Build a complete Markdown notes editor with Electron Forge and Vite. Open and save files, show a safe live preview, add menus and warn about unsaved changes.
updateDate: 2026-10-25T12:37
author: ['bishal-biswas']
level: 2
tags: ['project', 'markdown', 'forge']
course: electronjs
---

## What you are going to build

This lesson puts many earlier lessons together into one real app: a **Markdown notes editor**. **Markdown** is a simple way to format text with plain characters. You write `# Title` for a heading, `**bold**` for bold, and `- item` for a list, and a program turns it into nicely formatted HTML.

Your app will:

- Show a text editor on the left and a **live preview** on the right that updates as you type.
- Open and save `.md` files with native dialogs.
- Have a **File** menu with keyboard shortcuts: New, Open, Save and Save As.
- Show the file name in the title bar, with a `*` when there are unsaved changes.
- Ask "Do you want to save your changes?" if you try to close the window or open another file with unsaved work.
- Open links from your notes in the real web browser, not inside the app.

Think of the app as a small restaurant. The **main process** is the kitchen: it has the tools (the file system, dialogs, menus). The **renderer** is the dining room where the customer sits (the editor and preview). The **preload** is the serving hatch between them: orders go in, plates come out, and customers never walk into the kitchen.

You will use these lessons along the way: [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge), [Application Menus](/courses/electronjs/application-menus), [Native Dialogs: Open, Save and Message Boxes](/courses/electronjs/native-dialogs), [Reading and Writing Files from Your App](/courses/electronjs/reading-and-writing-files) and [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer).

## Step 1: create the project

```bash
npx create-electron-app@latest markdown-notes --template vite
cd markdown-notes
npm install marked dompurify
```

- `marked` is a Markdown **parser**: it reads Markdown text and produces an HTML string.
- `dompurify` is an HTML **sanitizer**: it cleans an HTML string by removing anything that could run code. You will see why this matters in Step 5.

Both are normal dependencies that run in the renderer. Vite bundles them into your page, so they work in the sandbox.

Run `npm start` once to check that the "Hello World!" window appears, then close it. You will now replace the template's files one by one:

```text
markdown-notes/
├── index.html        <- the page layout
└── src/
    ├── main.js       <- the kitchen: files, dialogs, menu, close prompt
    ├── preload.js    <- the serving hatch: window.notes API
    ├── renderer.js   <- the dining room: editor and preview
    └── index.css     <- styles
```

## Step 2: the page layout

Replace `index.html`:

```html
<!-- index.html -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'"
    />
    <title>Untitled.md - Markdown Notes</title>
  </head>
  <body>
    <main class="layout">
      <textarea id="editor" spellcheck="true" placeholder="# Start writing..."></textarea>
      <article id="preview" class="preview"></article>
    </main>
    <footer id="status">New file</footer>
    <script type="module" src="/src/renderer.js"></script>
  </body>
</html>
```

The `Content-Security-Policy` line is a list of rules about what the page may load. Here it says: scripts and everything else only from the app itself, images also from `https:` addresses and `data:` URLs, and styles from the app (including the inline styles Vite adds while developing). You will learn CSP properly in [Content Security Policy](/courses/electronjs/content-security-policy). For this app, its job is to make sure that even if something sneaky got into the preview, it could not load a script from the internet.

Now the styles. Replace `src/index.css`:

```css
/* src/index.css */
* { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

body { display: flex; flex-direction: column; }

.layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 0;
}

#editor {
  border: none;
  border-right: 1px solid #ddd;
  padding: 1rem;
  resize: none;
  font: 15px/1.6 ui-monospace, Consolas, 'Courier New', monospace;
  outline: none;
}

.preview { padding: 1rem 1.5rem; overflow: auto; line-height: 1.6; }
.preview img { max-width: 100%; }
.preview pre { background: #f4f4f4; padding: 0.75rem; overflow: auto; }

#status {
  padding: 0.3rem 1rem;
  font-size: 12px;
  background: #f0f0f0;
  border-top: 1px solid #ddd;
  color: #555;
}

@media (prefers-color-scheme: dark) {
  body, #editor { background: #1e1e1e; color: #ddd; }
  #editor { border-color: #333; }
  .preview pre { background: #2a2a2a; }
  #status { background: #252525; border-color: #333; color: #aaa; }
}
```

The last block follows the operating system's dark mode automatically, as you saw in [Dark Mode with nativeTheme](/courses/electronjs/dark-mode-with-nativetheme).

## Step 3: a live preview (renderer only)

Before touching files, get the editor and preview working. Replace `src/renderer.js`:

```javascript
// src/renderer.js (first version)
import './index.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const editor = document.querySelector('#editor');
const preview = document.querySelector('#preview');

function renderPreview() {
  const html = marked.parse(editor.value);
  preview.innerHTML = DOMPurify.sanitize(html);
}

editor.addEventListener('input', renderPreview);
renderPreview();
```

Run `npm start` and type:

```text
# My first note

Some **bold** text and a [link](https://www.electronjs.org).

- one
- two
```

The preview on the right shows a heading, bold text, a link and a list, updating with every key press.

## Step 4: why sanitizing matters

Look again at this line:

```javascript
preview.innerHTML = DOMPurify.sanitize(html);
```

Markdown allows raw HTML inside it. That means a Markdown file can contain this:

```text
Nice note!

<img src="x" onerror="alert('This code is running inside your app')">
```

Without sanitizing, `marked` passes that `<img>` tag straight through, `innerHTML` creates it, the image fails to load, and the `onerror` code runs. This is called **XSS** (cross-site scripting): someone else's code running inside your page.

You might think "I only open my own notes". But people download Markdown files, receive them by email, or clone them from GitHub. A notes app must treat every file as untrusted.

`DOMPurify.sanitize()` keeps the safe parts (headings, lists, links, images) and removes the dangerous parts (`onerror`, `<script>`, `javascript:` links). Your CSP is a second wall behind it: even if something slipped through, inline scripts are blocked. And because the window is sandboxed with context isolation, even a successful attack would only reach the small `window.notes` API, not Node.js. Three layers, each covering the others.

> **Warning:** Never write `preview.innerHTML = marked.parse(text)` without sanitizing. It is one of the most common security bugs in Markdown apps, Electron or not.

## Step 5: the main process

Now the kitchen. The main process will own the important state:

- `currentFile`: the full path of the open file, or `null` for a new, unsaved note.
- `isDirty`: whether there are unsaved changes. "Dirty" is the usual programming word for "changed since last save".

Replace `src/main.js` with the code below. It is long, so it is explained piece by piece afterwards.

```javascript
// src/main.js
import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import started from 'electron-squirrel-startup';

if (started) app.quit();

const isMac = process.platform === 'darwin';

let mainWindow = null;
let currentFile = null;
let isDirty = false;
let closeAfterSave = false;

// ---------- Window ----------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Links in the preview open in the user's browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => {
    const devServer = MAIN_WINDOW_VITE_DEV_SERVER_URL;
    if (devServer && event.url.startsWith(devServer)) return; // Vite reloads while developing
    event.preventDefault();
    openInBrowser(event.url);
  });

  // Ask before closing with unsaved changes
  mainWindow.on('close', (event) => {
    if (!isDirty) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      message: `Do you want to save the changes to ${displayName()}?`,
      detail: 'Your changes will be lost if you do not save them.',
    });
    if (choice === 0) {
      closeAfterSave = true;
      mainWindow.webContents.send('menu:save');
    } else if (choice === 1) {
      isDirty = false;
      mainWindow.close();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function openInBrowser(url) {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:' || protocol === 'http:') shell.openExternal(url);
  } catch {
    // not a valid URL: ignore it
  }
}

// ---------- File state helpers ----------

function displayName() {
  return currentFile ? path.basename(currentFile) : 'Untitled.md';
}

function startFolder() {
  return currentFile ? path.dirname(currentFile) : app.getPath('documents');
}

function setCurrentFile(filePath) {
  currentFile = filePath;
  if (isMac && mainWindow) mainWindow.setRepresentedFilename(filePath ?? '');
}

function setDirty(value) {
  isDirty = value;
  if (isMac && mainWindow) mainWindow.setDocumentEdited(value);
}

async function okToDiscard() {
  if (!isDirty) return true;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Discard Changes', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `${displayName()} has unsaved changes.`,
    detail: 'Do you want to discard them?',
  });
  return response === 0;
}

// ---------- Menu actions ----------

async function newFile() {
  if (!mainWindow || !(await okToDiscard())) return;
  setCurrentFile(null);
  setDirty(false);
  mainWindow.webContents.send('file:opened', { name: displayName(), content: '' });
}

async function openFile() {
  if (!mainWindow || !(await okToDiscard())) return;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown File',
    defaultPath: startFolder(),
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Text', extensions: ['txt'] },
    ],
  });
  if (canceled || filePaths.length === 0) return;

  try {
    const content = await readFile(filePaths[0], 'utf8');
    setCurrentFile(filePaths[0]);
    setDirty(false);
    mainWindow.webContents.send('file:opened', { name: displayName(), content });
  } catch (error) {
    dialog.showErrorBox('Could not open file', error.message);
  }
}

// ---------- Saving (asked for by the renderer) ----------

async function saveFile(event, request) {
  if (event.sender !== mainWindow?.webContents) return null; // only our window
  const content = request?.content;
  if (typeof content !== 'string') throw new Error('Content must be text.');

  let target = currentFile;
  if (request.saveAs || !target) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Markdown File',
      defaultPath: currentFile ?? path.join(startFolder(), 'Untitled.md'),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (canceled || !filePath) {
      closeAfterSave = false;
      return null;
    }
    target = filePath;
  }

  try {
    await writeFile(target, content, 'utf8');
  } catch (error) {
    closeAfterSave = false;
    dialog.showErrorBox('Could not save file', error.message);
    return null;
  }

  setCurrentFile(target);
  setDirty(false);
  if (closeAfterSave) setImmediate(() => mainWindow?.close());
  return { name: displayName() };
}

// ---------- Menu ----------

function buildMenu() {
  const send = (channel) => mainWindow?.webContents.send(channel);
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => newFile() },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- App lifecycle ----------

app.whenReady().then(() => {
  ipcMain.handle('file:save', saveFile);
  ipcMain.on('doc:dirty', (event, value) => {
    if (event.sender === mainWindow?.webContents) setDirty(Boolean(value));
  });

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
```

### How the pieces fit

**Opening a file** starts in the main process, because the menu lives there. `openFile()` checks for unsaved changes, shows the open dialog, reads the file with `fs/promises`, and sends `file:opened` with the name and text to the window.

**Saving a file** needs the text, which lives in the renderer. So the menu item sends `menu:save` to the window, the renderer answers by calling `window.notes.save(text)`, which invokes `file:save` in main. Main decides whether it needs a Save dialog (new file, or Save As), writes the file, and returns the new file name.

```text
Ctrl+S  ->  main: menu click  --menu:save-->  renderer
renderer  --invoke file:save { content }-->  main: dialog? write file
renderer  <-------------- { name: 'todo.md' } --------------  main
```

**Tracking changes**: the renderer tells main when the text changes with `doc:dirty`. Main remembers it in `isDirty`, so it can decide whether to show the close prompt.

**The close prompt** uses the window's `close` event. If there are unsaved changes, `event.preventDefault()` cancels the close, and a message box asks what to do:

- **Save**: set `closeAfterSave`, ask the renderer to save. When `saveFile` finishes successfully, it closes the window. If the user cancels the Save dialog, the window stays open.
- **Don't Save**: clear the dirty flag and close again. This time the `close` handler lets it through.
- **Cancel**: do nothing. The window stays open.

`showMessageBoxSync` is used here because the decision must be made inside the `close` event. Elsewhere, the async `showMessageBox` is used so the app never freezes.

**Where dialogs start**: since Electron 43, open and save dialogs start in the Downloads folder if you do not say otherwise. `startFolder()` uses the current file's folder, or the Documents folder for a new note.

**Platform touches**: on macOS, `setRepresentedFilename` shows the file's icon in the title bar and `setDocumentEdited` puts a dot in the close button when there are unsaved changes. On macOS, closing the last window does not quit the app, so the File menu uses the `close` role there and `quit` elsewhere. `CmdOrCtrl` means Cmd on macOS and Ctrl on Windows and Linux.

**Links**: clicking a link in the preview would normally navigate the whole window away from your editor. The `will-navigate` handler stops that and opens `http` and `https` links in the user's browser instead. While developing, Vite sometimes reloads the page, so navigation to the dev server address is allowed. `setWindowOpenHandler` does the same for links that try to open a new window.

**Checking the sender**: `saveFile` and `doc:dirty` check that the message came from `mainWindow`. It is a small habit that pays off when an app grows more windows. [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api) explains why.

## Step 6: the preload

The serving hatch exposes only what the page needs:

```javascript
// src/preload.js
import { contextBridge, ipcRenderer } from 'electron';

function subscribe(channel, callback) {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('notes', {
  save: (content) => ipcRenderer.invoke('file:save', { content, saveAs: false }),
  saveAs: (content) => ipcRenderer.invoke('file:save', { content, saveAs: true }),
  setDirty: (dirty) => ipcRenderer.send('doc:dirty', dirty),
  onFileOpened: (callback) => subscribe('file:opened', callback),
  onSaveRequest: (callback) => subscribe('menu:save', callback),
  onSaveAsRequest: (callback) => subscribe('menu:save-as', callback),
});
```

Notice what is **not** here: no "read any file" or "write any path" function. The page can only save its own text to a place the user picked in a dialog. That is a much smaller target than a general file API.

## Step 7: the finished renderer

Replace `src/renderer.js` with the full version:

```javascript
// src/renderer.js
import './index.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const editor = document.querySelector('#editor');
const preview = document.querySelector('#preview');
const status = document.querySelector('#status');

let fileName = 'Untitled.md';
let dirty = false;

function renderPreview() {
  preview.innerHTML = DOMPurify.sanitize(marked.parse(editor.value));
}

function updateTitle() {
  document.title = `${dirty ? '* ' : ''}${fileName} - Markdown Notes`;
}

function wordCount() {
  const words = editor.value.trim().split(/\s+/).filter(Boolean).length;
  return `${words} word${words === 1 ? '' : 's'}`;
}

function markDirty() {
  if (!dirty) {
    dirty = true;
    window.notes.setDirty(true);
    updateTitle();
  }
  status.textContent = `${wordCount()} - unsaved changes`;
}

async function save(saveAs = false) {
  const result = saveAs
    ? await window.notes.saveAs(editor.value)
    : await window.notes.save(editor.value);
  if (!result) return; // the user cancelled the dialog
  fileName = result.name;
  dirty = false; // main has already cleared its own flag
  updateTitle();
  status.textContent = `${wordCount()} - saved at ${new Date().toLocaleTimeString()}`;
}

editor.addEventListener('input', () => {
  renderPreview();
  markDirty();
});

window.notes.onFileOpened(({ name, content }) => {
  fileName = name;
  editor.value = content;
  dirty = false;
  renderPreview();
  updateTitle();
  status.textContent = `${wordCount()} - opened ${name}`;
  editor.focus();
});

window.notes.onSaveRequest(() => save(false));
window.notes.onSaveAsRequest(() => save(true));

renderPreview();
updateTitle();
editor.focus();
```

The window title comes from `document.title`: Electron's window follows the page's title automatically. When you type, `markDirty()` tells main once (not on every key press) and adds a `*` to the title.

## Step 8: try it out

```bash
npm start
```

Walk through this checklist:

1. Type some Markdown. The preview updates and the title shows `* Untitled.md - Markdown Notes`.
2. Press `Ctrl+S` (`Cmd+S` on macOS). A Save dialog opens in your Documents folder. Save as `first.md`. The `*` disappears.
3. Type more, then close the window. You are asked to save. Click **Cancel**: the window stays.
4. Press `Ctrl+O`, and choose **Cancel** in the "discard changes?" box. Nothing is lost.
5. Close again and click **Save**: the file is saved and the window closes.
6. Start the app again and open `first.md`. Your text is back.
7. Add `<img src="x" onerror="alert(1)">` to a note. No alert appears: DOMPurify removed the `onerror`.
8. Click a link in the preview. It opens in your normal browser.

## Ideas to extend it

You now have a real, useful app. Some ideas to keep going:

- **Recent files**: call `app.addRecentDocument(filePath)` after opening or saving, and add `{ role: 'recentDocuments' }` to the macOS File menu.
- **Remember the window size** with what you learned in [Remembering Window Size and Position](/courses/electronjs/remembering-window-state).
- **Drag and drop** a `.md` file onto the window, using `webUtils.getPathForFile` from [Drag and Drop Files](/courses/electronjs/drag-and-drop-files).
- **Faster preview for huge files**: only re-render after the user pauses typing for 200 milliseconds (a technique called **debouncing**).
- **Package it** as an installer with [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers).

## Common mistakes

### Saving loses the close prompt

If you forget `setDirty(false)` after a successful save, the app keeps asking "save changes?" even though everything is saved. Main's `isDirty` and the renderer's `dirty` must both be cleared.

### The window navigates away when clicking a link

Without the `will-navigate` handler, clicking a link replaces your editor with the web page, and your preload would even run inside that page. Always block navigation in an app that shows user content, and open links with `shell.openExternal`.

### Using innerHTML without sanitizing

`preview.innerHTML = marked.parse(text)` lets any opened file run code in your app. Always pass the HTML through `DOMPurify.sanitize()`.

### The app quits even when the user clicked Cancel

This happens if the `close` handler only calls `preventDefault()` in some branches. Call it first, as soon as you know there are unsaved changes, and then decide what to do.

## Quick recap

- The main process owns files, dialogs, the menu and the "unsaved changes" state. The renderer owns the editor and preview.
- Opening starts in main and sends the text to the window. Saving starts with a menu message, then the renderer invokes `file:save` with its text.
- `marked` turns Markdown into HTML; `DOMPurify.sanitize()` makes that HTML safe before it goes into `innerHTML`.
- A CSP, the sandbox and a tiny preload API add more layers of protection.
- The window's `close` event plus `event.preventDefault()` and a message box give you a proper "save changes?" prompt.
- `will-navigate` and `setWindowOpenHandler` keep links from taking over the window and send them to the browser.
- `CmdOrCtrl` accelerators, `setDocumentEdited` and the `close` versus `quit` role make the app feel native on every platform.

<code id="code-content" class="language-javascript">
// src/main.js: Markdown Notes (Forge Vite template; npm install marked dompurify)
import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import started from 'electron-squirrel-startup';
if (started) app.quit();
const isMac = process.platform === 'darwin';
let mainWindow = null;
let currentFile = null;
let isDirty = false;
let closeAfterSave = false;
// --- Window, link handling and the unsaved-changes prompt
function createWindow() {
  mainWindow = new BrowserWindow({ width: 1100, height: 720, webPreferences: { preload: path.join(__dirname, 'preload.cjs') } });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  mainWindow.webContents.setWindowOpenHandler(({ url }) =&gt; {
    openInBrowser(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) =&gt; {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL &amp;&amp; event.url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) return;
    event.preventDefault();
    openInBrowser(event.url);
  });
  mainWindow.on('close', (event) =&gt; {
    if (!isDirty) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning', buttons: ['Save', "Don't Save", 'Cancel'], defaultId: 0, cancelId: 2,
      message: `Do you want to save the changes to ${displayName()}?`,
    });
    if (choice === 0) { closeAfterSave = true; mainWindow.webContents.send('menu:save'); }
    else if (choice === 1) { isDirty = false; mainWindow.close(); }
  });
  mainWindow.on('closed', () =&gt; { mainWindow = null; });
}
function openInBrowser(url) {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:' || protocol === 'http:') shell.openExternal(url);
  } catch {}
}
// --- File state helpers
const displayName = () =&gt; (currentFile ? path.basename(currentFile) : 'Untitled.md');
const startFolder = () =&gt; (currentFile ? path.dirname(currentFile) : app.getPath('documents'));
function setCurrentFile(filePath) {
  currentFile = filePath;
  if (isMac &amp;&amp; mainWindow) mainWindow.setRepresentedFilename(filePath ?? '');
}
function setDirty(value) {
  isDirty = value;
  if (isMac &amp;&amp; mainWindow) mainWindow.setDocumentEdited(value);
}
async function okToDiscard() {
  if (!isDirty) return true;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning', buttons: ['Discard Changes', 'Cancel'], defaultId: 1, cancelId: 1,
    message: `${displayName()} has unsaved changes.`,
  });
  return response === 0;
}
// --- Menu actions that start in main
async function newFile() {
  if (!mainWindow || !(await okToDiscard())) return;
  setCurrentFile(null);
  setDirty(false);
  mainWindow.webContents.send('file:opened', { name: displayName(), content: '' });
}
async function openFile() {
  if (!mainWindow || !(await okToDiscard())) return;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    defaultPath: startFolder(), properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }, { name: 'Text', extensions: ['txt'] }],
  });
  if (canceled || filePaths.length === 0) return;
  try {
    const content = await readFile(filePaths[0], 'utf8');
    setCurrentFile(filePaths[0]);
    setDirty(false);
    mainWindow.webContents.send('file:opened', { name: displayName(), content });
  } catch (error) {
    dialog.showErrorBox('Could not open file', error.message);
  }
}
// --- Saving: the renderer sends its text, main picks the path and writes
async function saveFile(event, request) {
  if (event.sender !== mainWindow?.webContents) return null;
  if (typeof request?.content !== 'string') throw new Error('Content must be text.');
  let target = currentFile;
  if (request.saveAs || !target) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: currentFile ?? path.join(startFolder(), 'Untitled.md'),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (canceled || !filePath) { closeAfterSave = false; return null; }
    target = filePath;
  }
  try {
    await writeFile(target, request.content, 'utf8');
  } catch (error) {
    closeAfterSave = false;
    dialog.showErrorBox('Could not save file', error.message);
    return null;
  }
  setCurrentFile(target);
  setDirty(false);
  if (closeAfterSave) setImmediate(() =&gt; mainWindow?.close());
  return { name: displayName() };
}
// --- Menu with keyboard shortcuts
function buildMenu() {
  const send = (channel) =&gt; mainWindow?.webContents.send(channel);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: () =&gt; newFile() },
      { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () =&gt; openFile() },
      { type: 'separator' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () =&gt; send('menu:save') },
      { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () =&gt; send('menu:save-as') },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
}
// --- Lifecycle
app.whenReady().then(() =&gt; {
  ipcMain.handle('file:save', saveFile);
  ipcMain.on('doc:dirty', (event, value) =&gt; {
    if (event.sender === mainWindow?.webContents) setDirty(Boolean(value));
  });
  buildMenu();
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (!isMac) app.quit();
});
</code></pre>

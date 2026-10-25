---
publishDate: 2026-10-25T12:27
title: Clipboard and Opening Links with shell
slug: clipboard-and-shell
metadescription: Copy and paste in Electron with navigator.clipboard or the async main-process clipboard, and open links, files and folders safely with the shell module.
updateDate: 2026-10-25T12:27
author: ['bishal-biswas']
level: 2
tags: ['clipboard', 'shell', 'security']
course: electronjs
---

## Two small but important tools

This lesson covers two modules that handle everyday desktop jobs:

- The **clipboard** is the place where copied things wait until you paste them. Your app can put text there (a "Copy" button) and read what is there (a "Paste" button).
- The **`shell`** module asks the operating system to open something the way the user normally would: a web link in their browser, a PDF in their PDF reader, a folder in their file manager.

Think of the clipboard as a shared pinboard in an office. Anyone can pin a note to it, and anyone can read it. That is handy, but it also means you must be careful who you give access to. And think of `shell` as the office receptionist: you say "please get this to the right person", and you do not need to know who that is.

## The big change: clipboard is main-only and async

If you read older Electron tutorials, you will see code like this in a preload or even in a page:

```javascript
// OLD CODE: does not work in the latest Electron
const { clipboard } = require('electron');
clipboard.writeText('hello');
const text = clipboard.readText();
```

Two things changed:

1. **Since Electron 44, `clipboard` exists only in the main process.** It was removed from renderers and preloads, because giving web content direct access to the system clipboard was a security risk.
2. **Its methods now return Promises**, just like the web's `navigator.clipboard`. `clipboard.readText()` resolves to a string, and `clipboard.writeText(text)` resolves when the text is written. You must `await` them.

Several old helpers were also removed: `readHTML`, `writeHTML`, `readImage`, `writeImage`, `readRTF`, `availableFormats` and others. Their replacement is one general pair of methods, `clipboard.read()` and `clipboard.write()`, which you will see below.

So you now have two good options:

- **In the page:** use the standard web `navigator.clipboard` API for simple text.
- **In main:** use Electron's `clipboard` module, reached from the page through a small preload function and IPC.

## Option 1: `navigator.clipboard` in the page

For a simple "Copy" button, the web API is all you need. No preload, no IPC:

```html
<!-- index.html (inside <body>) -->
<p id="code">INVITE-4821</p>
<button id="copy">Copy code</button>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
document.getElementById('copy').addEventListener('click', async () => {
  const text = document.getElementById('code').textContent;
  try {
    await navigator.clipboard.writeText(text);
    document.getElementById('copy').textContent = 'Copied!';
  } catch (error) {
    console.error('Copy failed:', error.message);
  }
});
```

Run the app, click **Copy code**, then paste into any other program. You see `INVITE-4821`.

Reading works too, with `await navigator.clipboard.readText()`.

Two things to know:

- `navigator.clipboard` only works while your window is **focused**. If you test it from the DevTools console, focus is on DevTools, and you get `NotAllowedError: Document is not focused`. Trigger it from a button in the page instead.
- Electron approves permission requests for your pages by default, so clipboard access just works. If you add your own permission handler later (see [Sessions, Cookies and Permissions](/courses/electronjs/sessions-cookies-and-permissions)), allow `'clipboard-read'` and `'clipboard-sanitized-write'` for your own pages.

## Option 2: the main-process `clipboard` through IPC

Use main's `clipboard` when you need more than plain text in the page, when main itself copies something (for example a "Copy link address" item in a [context menu](/courses/electronjs/context-menus)), or when you want one place that controls clipboard access.

### Main

```javascript
// main.js
const { app, BrowserWindow, ipcMain, clipboard } = require('electron');

ipcMain.handle('clipboard:write-text', async (event, text) => {
  if (typeof text !== 'string' || text.length > 100_000) return false;
  await clipboard.writeText(text);
  return true;
});

ipcMain.handle('clipboard:read-text', async () => {
  return await clipboard.readText();
});
```

### Preload

Expose two small named functions. Never expose the whole `clipboard` or `ipcRenderer`.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clip', {
  copyText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  pasteText: () => ipcRenderer.invoke('clipboard:read-text'),
});
```

### Page

```javascript
// renderer.js
document.getElementById('paste').addEventListener('click', async () => {
  const text = await window.clip.pasteText();
  document.getElementById('note').value += text;
});
```

The page never touches the clipboard directly. It can only do the two things you allowed.

> **Warning:** Think before exposing "read the clipboard". People copy passwords and private messages. Only offer clipboard reading to your own trusted pages, and never to remote websites you load. [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api) explains why small, specific functions matter.

### Rich content: HTML and images

The new `clipboard.write()` takes an array of `ClipboardItem` objects. Each item maps **MIME types** (standard names for kinds of data, such as `text/plain` or `image/png`) to the data. Giving both plain text and HTML lets the paste target pick the best one: a word processor takes the bold HTML, a plain text editor takes the text.

```javascript
// main.js
const { clipboard, ClipboardItem } = require('electron');

await clipboard.write([
  new ClipboardItem({
    'text/plain': 'Buy milk',
    'text/html': '<b>Buy milk</b>',
  }),
]);
```

Reading gives you an array of items. Each item has a `types` list and a `getType(type)` method that resolves to a `Blob` (a chunk of data):

```javascript
// main.js
const items = await clipboard.read();
const htmlItem = items.find((item) => item.types.includes('text/html'));
if (htmlItem) {
  const blob = await htmlItem.getType('text/html');
  console.log(await blob.text()); // <b>Buy milk</b>
}
```

To check what is on the clipboard without reading it, use `await clipboard.has('text/html')`, which resolves to `true` or `false`.

To copy an image, turn a `nativeImage` into PNG bytes and wrap them in a `Blob`:

```javascript
// main.js
const image = nativeImage.createFromPath(path.join(__dirname, 'logo.png'));
await clipboard.write([
  new ClipboardItem({ 'image/png': new Blob([image.toPNG()], { type: 'image/png' }) }),
]);
```

> **Note:** Linux has a second clipboard, the **selection** clipboard, which holds whatever text you last highlighted (you paste it with a middle-click). Electron reaches it through `clipboard.selection`, which has the same methods. On Windows and macOS `clipboard.selection` is `undefined`.

## Opening things with `shell`

The `shell` module asks the desktop to open things in their default app. You call it from main, and the page asks for it through IPC, just like the clipboard.

| Function | What it does |
| --- | --- |
| `shell.openExternal(url)` | Opens a URL in the default app: `https:` in the browser, `mailto:` in the mail app. Returns a Promise. |
| `shell.openPath(path)` | Opens a file or folder in its default app. Resolves to an error message, or `''` on success. |
| `shell.showItemInFolder(path)` | Opens the file manager with the file selected. |
| `shell.trashItem(path)` | Moves a file to the Recycle Bin or Trash. Returns a Promise. |

### Opening a web link safely

`shell.openExternal()` is powerful: given a strange URL, it can launch other programs on the user's computer. So **always check the URL** before opening it. The built-in `URL` class makes this easy:

```javascript
// main.js
const { shell } = require('electron');

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

function openSafely(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false; // not a valid URL at all
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  shell.openExternal(parsed.href);
  return true;
}

ipcMain.handle('shell:open-link', (event, url) => openSafely(String(url)));
```

```javascript
// preload.js (add to your exposed object)
openLink: (url) => ipcRenderer.invoke('shell:open-link', url),
```

### Links inside your page

What about a normal `<a href="https://electronjs.org">` in your HTML? By default, clicking it loads the website **inside your app window**, replacing your app. And a link with `target="_blank"` tries to open a new Electron window. Neither is what users expect.

Catch both in main and send them to the browser instead:

```javascript
// main.js (inside createWindow, after creating win)
// Links with target="_blank" or window.open()
win.webContents.setWindowOpenHandler(({ url }) => {
  openSafely(url);
  return { action: 'deny' }; // do not create an Electron window
});

// Normal links that would navigate away from your app
win.webContents.on('will-navigate', (event) => {
  if (event.url.startsWith('file://')) return; // your own pages are fine
  event.preventDefault();
  openSafely(event.url);
});
```

`setWindowOpenHandler()` decides what happens to new windows. Returning `{ action: 'deny' }` blocks the Electron window, and you open the link in the browser yourself. The `will-navigate` event fires when the page is about to load a different address. `event.url` is that address, and `event.preventDefault()` cancels it. [Loading Remote Content Safely](/courses/electronjs/loading-remote-content-safely) goes deeper into navigation rules.

### Files and folders

When your app saves a file, it is friendly to offer "Show in folder":

```javascript
// main.js
ipcMain.handle('shell:show-in-folder', (event, filePath) => {
  if (!knownFiles.has(filePath)) return false; // only files our app created or opened
  shell.showItemInFolder(filePath);
  return true;
});
```

`knownFiles` here is a `Set` of paths your app got from a dialog or saved itself. Never let the page open any path it likes: `shell.openPath()` on a program file **runs that program**. You will build this kind of check properly in [Reading and Writing Files from Your App](/courses/electronjs/reading-and-writing-files).

`shell.openPath()` is a little unusual: it does not reject on failure. It resolves to an error message string, or an empty string when everything worked:

```javascript
// main.js
const error = await shell.openPath(filePath);
if (error) console.log('Could not open:', error);
```

## Common mistakes

### Using `clipboard` in the preload or page

`require('electron').clipboard` is `undefined` outside main in the latest Electron. Use `navigator.clipboard` in the page, or a preload function that calls main through IPC.

### Forgetting `await`

`clipboard.readText()` now returns a Promise. Without `await`, you get `[object Promise]` instead of your text.

### Calling removed helpers

`clipboard.readHTML()`, `clipboard.writeImage()` and friends are gone. Use `clipboard.read()` and `clipboard.write()` with `ClipboardItem` and the right MIME type.

### Opening any URL the page sends

`shell.openExternal(url)` with an unchecked URL lets a compromised page launch other programs. Parse it with `new URL()` and allow only the protocols you need.

## Quick recap

- Since Electron 44, `clipboard` is **main-process only** and its read and write methods return **Promises**.
- In the page, `navigator.clipboard.writeText()` and `readText()` work for simple text while the window is focused.
- For more, call main's `clipboard` through a small preload function and `ipcRenderer.invoke()`.
- `clipboard.write([new ClipboardItem({ 'text/plain': ..., 'text/html': ... })])` writes rich content. `clipboard.read()` returns items with `types` and `getType()`.
- `shell.openExternal()` opens URLs in the default app. Always validate the protocol first.
- Use `setWindowOpenHandler()` and `will-navigate` to send page links to the browser instead of loading them in your app.
- `shell.openPath()`, `showItemInFolder()` and `trashItem()` work with files, but only for paths your app trusts.

<code id="code-content" class="language-javascript">
// main.js: async clipboard and safe link opening, reached from the page through IPC
const { app, BrowserWindow, ipcMain, clipboard, ClipboardItem, shell } = require('electron');
const path = require('node:path');
// --- 1. Only open URLs with protocols we trust
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);
function openSafely(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return false;
  shell.openExternal(parsed.href);
  return true;
}
// --- 2. Links in the page open in the browser, never inside the app
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.webContents.setWindowOpenHandler(({ url }) =&gt; {
    openSafely(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) =&gt; {
    if (event.url.startsWith('file://')) return;
    event.preventDefault();
    openSafely(event.url);
  });
  win.loadFile('index.html');
}
// --- 3. Clipboard handlers (clipboard is main-only and Promise-based)
ipcMain.handle('clipboard:write-text', async (event, text) =&gt; {
  if (typeof text !== 'string' || text.length &gt; 100_000) return false;
  await clipboard.writeText(text);
  return true;
});
ipcMain.handle('clipboard:read-text', async () =&gt; await clipboard.readText());
ipcMain.handle('clipboard:copy-app-link', async () =&gt; {
  // plain text for editors, HTML for word processors, both in one write
  await clipboard.write([new ClipboardItem({
    'text/plain': 'https://example.com/my-notes',
    'text/html': '&lt;a href="https://example.com/my-notes"&gt;My Notes&lt;/a&gt;',
  })]);
  return true;
});
ipcMain.handle('shell:open-link', (event, url) =&gt; openSafely(String(url)));
// --- 4. Lifecycle
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

---
publishDate: 2026-10-25T12:19
title: Designing a Safe IPC API
slug: designing-a-safe-ipc-api
metadescription: "Design Electron IPC that cannot be abused: small named functions, argument validation in the main process, sender checks with senderFrame, and safe file paths."
updateDate: 2026-10-25T12:19
author: ['bishal-biswas']
level: 2
tags: ['ipc', 'security', 'validation']
course: electronjs
---

## Why IPC needs designing

You now know all three IPC directions: [send](/courses/electronjs/ipc-send-to-main), [invoke](/courses/electronjs/ipc-invoke-and-handle) and [main to window](/courses/electronjs/ipc-main-to-renderer). Every `ipcMain.handle` and `ipcMain.on` you write is a **door into the main process**, and the main process has full power over the user's computer: it can read and delete files, run programs and open websites.

So the most important question about your IPC is not "does it work?" but "**what is the worst thing someone could do with it?**"

Think of a bank. Customers (your page) cannot walk into the vault (the main process). They go to a teller window (your IPC handler). A good teller only does a short list of specific transactions, checks who is asking, and checks that the amounts make sense. A bad teller says "tell me what you want me to do in the vault and I'll do it."

This lesson turns you into a good teller.

## Assume the page could turn against you

Design your IPC as if a stranger might control your page one day. That sounds paranoid, but it happens in ordinary ways:

- **XSS (cross-site scripting):** a note, file name or chat message containing HTML gets inserted with `innerHTML`, and a hidden script runs.
- **A bad dependency:** a front-end npm package you use is hijacked and ships malicious code in an update.
- **Remote content:** the window loads a web page, an ad or an embedded frame you do not fully control.
- **A browser bug:** in the worst case, an attacker breaks the renderer process itself and can send **any** IPC message directly, skipping your preload entirely.

That last point is key. The preload is a convenience layer. **The main process is the real security guard**, so every check that matters lives there.

## Rule 1: expose small, named functions

You saw this in [Context Isolation and contextBridge](/courses/electronjs/context-isolation-and-contextbridge), but it is the foundation of everything else.

```javascript
// preload.js: DON'T DO THIS
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
});
```

This "run any channel" helper gives every script in the page every door in your main process at once, including channels you add next year and forget about. The `on` helper also leaks the `event` object.

```javascript
// preload.js: DO THIS
contextBridge.exposeInMainWorld('electronAPI', {
  listNotes: () => ipcRenderer.invoke('notes:list'),
  loadNote: (name) => ipcRenderer.invoke('notes:load', name),
  saveNote: (name, text) => ipcRenderer.invoke('notes:save', name, text),
  openLink: (url) => ipcRenderer.invoke('link:open', url),
});
```

Each function maps to exactly one channel. The page cannot choose the channel. If you open your app's DevTools and type `window.electronAPI`, the whole list of things the page can do fits on one screen. That is a good sign.

## Rule 2: make each handler do one specific thing

Small preload functions are not enough if the handlers behind them are too powerful:

```javascript
// main.js: DANGEROUS HANDLERS
ipcMain.handle('fs:read-file', (event, filePath) => readFile(filePath, 'utf8'));
ipcMain.handle('shell:run', (event, command) => exec(command));
ipcMain.handle('open-url', (event, url) => shell.openExternal(url));
```

- `fs:read-file` lets the page read **any** file: SSH keys, browser cookies, other apps' data.
- `shell:run` lets it run **any** program.
- `open-url` with any URL can launch other apps through special links like `file:` or custom protocols.

Ask "what does the page actually need?" It does not need "read any file". It needs "load note number 3". Design handlers around **your app's actions**, not around Node's abilities.

## Rule 3: validate every argument in the main process

Arguments come from the page, so treat them like data typed into a web form by a stranger. Check:

- the **type** (`typeof name === 'string'`)
- the **size** (a 2 GB "note" should not reach your disk)
- the **format** (only the characters you expect)
- the **allowed values** (only `'light'`, `'dark'` or `'system'`)

A few tiny helpers keep handlers readable:

```javascript
// main.js
function assertString(value, label, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`Invalid ${label}`);
  }
}

const NOTE_NAME = /^[a-z0-9-]{1,40}$/; // letters, digits and dashes only

function assertNoteName(name) {
  if (typeof name !== 'string' || !NOTE_NAME.test(name)) {
    throw new Error('Invalid note name');
  }
}
```

### Never build a path straight from page input

This is the classic mistake:

```javascript
// main.js: DANGEROUS
ipcMain.handle('notes:load', (event, name) => {
  return readFile(path.join(notesDir, name), 'utf8');
});
```

It looks like it can only read notes. But if the page sends `'../../../.ssh/id_rsa'`, `path.join` happily climbs out of your notes folder. This is called **path traversal**.

The fix is to accept only a **name** in a strict format and build the path yourself:

```javascript
// main.js: SAFE
const notesDir = () => path.join(app.getPath('userData'), 'notes');

ipcMain.handle('notes:load', async (event, name) => {
  assertNoteName(name); // no dots, no slashes, nothing surprising
  return readFile(path.join(notesDir(), `${name}.md`), 'utf8');
});
```

The regular expression only allows lowercase letters, digits and dashes, so `..` and `/` can never get in. When the user really needs to pick an arbitrary file, let the **main process** show the open dialog itself (see [Native Dialogs: Open, Save and Message Boxes](/courses/electronjs/native-dialogs)). Then the path comes from the user's own choice, not from the page.

### Check URLs before opening them

```javascript
// main.js
ipcMain.handle('link:open', async (event, url) => {
  assertString(url, 'url', 2000);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid url');
  }
  if (parsed.protocol !== 'https:') throw new Error('Only https links can be opened');
  await shell.openExternal(parsed.href);
});
```

Only `https:` links reach the user's browser. Everything else is refused.

### Use allow-lists for settings

```javascript
// main.js
const THEMES = ['light', 'dark', 'system'];

ipcMain.handle('settings:set-theme', (event, theme) => {
  if (!THEMES.includes(theme)) throw new Error('Unknown theme');
  settings.theme = theme;
});
```

An **allow-list** names exactly what is permitted and rejects everything else. It is much safer than a block-list that tries to name everything bad.

## Rule 4: check who is calling

Every IPC event tells you which page sent it. `event.senderFrame` describes the exact frame, with its `url` and `origin`. If your window ever ends up showing something other than your own page (a bad redirect, an embedded frame, a navigation you did not expect), you do not want that page using your handlers.

```javascript
// main.js
const { pathToFileURL } = require('node:url');

const APP_PAGE = pathToFileURL(path.join(__dirname, 'index.html'));

function isTrustedSender(event) {
  const frame = event.senderFrame;
  if (!frame) return false;               // the page already navigated away or closed
  if (frame.parent !== null) return false; // a frame inside the page, not the page itself
  const url = new URL(frame.url);
  return url.protocol === 'file:' && url.pathname === APP_PAGE.pathname;
}
```

- `pathToFileURL` turns your file path into the same `file:///...` form that Chromium uses, so the comparison works on Windows, macOS and Linux.
- Comparing only `protocol` and `pathname` ignores `#section` or `?query` parts your page might add.
- `frame.parent !== null` means the message came from an `<iframe>`, not your top-level page.

If your page is served by a development server (as in [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge)), compare the origin instead, for example `url.origin === 'http://localhost:5173'`.

> **Warning:** Read `event.senderFrame` **straight away**, before any `await`. If the page navigates while your handler is waiting, `senderFrame` can turn into `null`.

### Check it everywhere with a small wrapper

Adding the check to every handler by hand is easy to forget. Wrap `ipcMain.handle` once:

```javascript
// main.js
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Blocked ${channel} from an untrusted sender`);
    }
    return handler(...args);
  });
}

handle('notes:load', async (name) => {
  assertNoteName(name);
  return readFile(path.join(notesDir(), `${name}.md`), 'utf8');
});
```

Now every channel registered with `handle(...)` is checked, and the handlers themselves stay short.

### Scope handlers to one window

Sometimes only one window should be allowed to do something. A Settings window may change settings; the main window may not. Each `webContents` has its own `ipc` object for exactly this:

```javascript
// main.js
settingsWindow.webContents.ipc.handle('settings:set-theme', (event, theme) => {
  if (!THEMES.includes(theme)) throw new Error('Unknown theme');
  settings.theme = theme;
});
```

Handlers registered on `win.webContents.ipc` only hear messages from that window. Messages from other windows never reach them.

## Rule 5: send back only what is needed

Data flows the other way too. Do not return whole objects "just in case":

```javascript
// main.js: TOO MUCH
ipcMain.handle('settings:get', () => settings); // includes the API token and file paths!

// main.js: JUST ENOUGH
ipcMain.handle('settings:get', () => ({ theme: settings.theme, fontSize: settings.fontSize }));
```

The same goes for errors. Return friendly messages like "Could not save the note", not full stack traces with folder names. Secrets such as API tokens should stay in the main process; see [Keeping Secrets Safe with safeStorage](/courses/electronjs/safestorage-secrets).

## Putting it together

Here is how one complete, safe feature looks across the three files:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveNote: (name, text) => ipcRenderer.invoke('notes:save', name, text),
});
```

```javascript
// main.js
handle('notes:save', async (name, text) => {
  assertNoteName(name);
  assertString(text, 'note text', 1_000_000); // about 1 MB is plenty for a note
  await mkdir(notesDir(), { recursive: true });
  await writeFile(path.join(notesDir(), `${name}.md`), text, 'utf8');
  return { ok: true };
});
```

```javascript
// renderer.js
await window.electronAPI.saveNote('shopping-list', 'Milk\nBread');
```

The page can save a note with a sensible name and a sensible size into one folder. It cannot choose the folder, the file type, the channel or anything else.

## A checklist for every new channel

Before you add an IPC channel, run through this list:

1. Does the preload expose **one named function** for it, on a fixed channel?
2. Does the handler do **one app-level action**, not a general Node ability?
3. Does it **validate every argument** (type, size, format, allowed values)?
4. Does it build **file paths itself** from safe names, never from raw page input?
5. Does it **check the sender** (with the wrapper or `webContents.ipc`)?
6. Does it **return only what the page needs**?

[Electron Security Checklist](/courses/electronjs/security-checklist) covers the rest of the app, and [Loading Remote Content Safely](/courses/electronjs/loading-remote-content-safely) explains how to keep your windows from showing pages you did not plan for.

## Common mistakes

### Validating only in the preload

Checks in the preload are skipped if the renderer itself is compromised. Put every important check in the main process.

### Trusting a path because "my page would never send that"

Your page might not, but a script injected into it would. Accept names or IDs, never full paths.

### Reading `senderFrame` after an `await`

By then the page may have navigated and `senderFrame` may be `null`. Check the sender first, then do the slow work.

### One "utility" channel that does many things

`ipcMain.handle('do', (event, action, ...args) => ...)` with a big `switch` is a generic helper in disguise. Split it into separate, specific channels.

## Quick recap

- Every IPC handler is a door into a process with full access to the computer. Design it assuming the page could be hostile.
- Expose small named functions on fixed channels; never a generic "run any channel" helper.
- Make handlers do app-level actions ("save note"), not raw abilities ("write any file").
- Validate type, size, format and allowed values of every argument **in the main process**.
- Build file paths yourself from strict names to stop path traversal; only open `https:` links.
- Check `event.senderFrame` (read it immediately) or scope handlers with `win.webContents.ipc`.
- Return only the data the page needs, never secrets or internal details.

<code id="code-content" class="language-javascript">
// main.js: a small, safe IPC API for a notes app
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const notesDir = () =&gt; path.join(app.getPath('userData'), 'notes');
// --- Who is allowed to call us: only our own top-level page
const APP_PAGE = pathToFileURL(path.join(__dirname, 'index.html'));
function isTrustedSender(event) {
  const frame = event.senderFrame; // read it before any await
  if (!frame || frame.parent !== null) return false;
  const url = new URL(frame.url);
  return url.protocol === 'file:' &amp;&amp; url.pathname === APP_PAGE.pathname;
}
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) =&gt; {
    if (!isTrustedSender(event)) throw new Error(`Blocked ${channel} from an untrusted sender`);
    return handler(...args);
  });
}
// --- Validation helpers
const NOTE_NAME = /^[a-z0-9-]{1,40}$/;
function assertNoteName(name) {
  if (typeof name !== 'string' || !NOTE_NAME.test(name)) throw new Error('Invalid note name');
}
function assertString(value, label, maxLength) {
  if (typeof value !== 'string' || value.length &gt; maxLength) throw new Error(`Invalid ${label}`);
}
// --- One app-level action per channel
handle('notes:load', async (name) =&gt; {
  assertNoteName(name);
  return readFile(path.join(notesDir(), `${name}.md`), 'utf8');
});
handle('notes:save', async (name, text) =&gt; {
  assertNoteName(name);
  assertString(text, 'note text', 1_000_000);
  await mkdir(notesDir(), { recursive: true });
  await writeFile(path.join(notesDir(), `${name}.md`), text, 'utf8');
  return { ok: true };
});
handle('link:open', async (url) =&gt; {
  assertString(url, 'url', 2000);
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid url'); }
  if (parsed.protocol !== 'https:') throw new Error('Only https links can be opened');
  await shell.openExternal(parsed.href);
});
// --- preload.js exposes exactly these, each on a fixed channel:
//   loadNote: (name) =&gt; ipcRenderer.invoke('notes:load', name),
//   saveNote: (name, text) =&gt; ipcRenderer.invoke('notes:save', name, text),
//   openLink: (url) =&gt; ipcRenderer.invoke('link:open', url),
// --- The window and the standard lifecycle
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
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

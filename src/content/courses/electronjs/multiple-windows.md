---
publishDate: 2026-10-25T12:11
title: Working with Multiple Windows
slug: multiple-windows
metadescription: Open a second window in Electron, stop duplicate windows, make child and modal windows, and keep track of every window your app has open.
updateDate: 2026-10-25T12:11
author: ['bishal-biswas']
level: 2
tags: ['browserwindow', 'windows', 'modal']
course: electronjs
---

## Why apps need more than one window

So far your app has had a single window. Real desktop apps often have more: a Settings window, an About box, a second document, a small floating tool palette.

In Electron, every window is a separate `BrowserWindow`. Each one loads its own page and runs in its own renderer process. Your main process is the only part that can create, find and close them.

Think of the main process as a hotel receptionist with a board of room keys. Guests (windows) come and go, but only the receptionist hands out rooms, knows which rooms are taken, and can send someone to a room. If a guest asks for a room they already have, a good receptionist says "you already have room 12" instead of giving them a second one.

This lesson builds on [Creating Windows with BrowserWindow](/courses/electronjs/browserwindow-basics) and [Window Options: Size, Position, Title and Icon](/courses/electronjs/window-options). You will start from the plain app you made in [Your First Electron App](/courses/electronjs/your-first-electron-app).

## Step 1: one function per kind of window

The easiest way to keep things tidy is to write one small function for each kind of window. Here is the main window you already know, wrapped in a function:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}
```

Two things are new here:

- `let mainWindow = null;` stores the window in a variable **outside** the function, so other code can reach it later.
- The `closed` event fires after the window is gone. Setting the variable back to `null` means "this room is empty again". If you keep the old value, later code might try to use a window that no longer exists.

## Step 2: add a Settings window

Create a second page called `settings.html` next to `index.html`:

```html
<!-- settings.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>Settings</title>
  </head>
  <body>
    <h1>Settings</h1>
    <p>Your settings will live here.</p>
  </body>
</html>
```

Now add a function that opens it. Notice how it checks whether a Settings window is already open:

```javascript
// main.js
let settingsWindow = null;

function openSettingsWindow() {
  // Already open? Bring it to the front instead of making a second one.
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 420,
    height: 360,
    title: 'Settings',
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  settingsWindow.loadFile('settings.html');

  // Show it only once the page has painted, so there is no white flash.
  settingsWindow.once('ready-to-show', () => settingsWindow.show());

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}
```

This is the **single instance per window** pattern. Without it, every click on "Settings" would open yet another Settings window, and users would end up with a pile of identical windows.

`show: false` plus the `ready-to-show` event is a small polish trick. The window is created hidden, the page loads, and only then does it appear. The user never sees an empty white rectangle.

> **Note:** Every window needs its own `webPreferences`. Options from the main window are not copied to new windows. If a page needs your preload script, give that window the `preload` option too.

## Step 3: open the second window from a link

You have not learned how a page talks to the main process yet. That comes in [IPC Part 1: Sending Messages to the Main Process](/courses/electronjs/ipc-send-to-main). Until then, there is a neat trick that needs no IPC at all: a normal link with `target="_blank"`.

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>My App</title>
  </head>
  <body>
    <h1>Main window</h1>
    <a href="settings.html" target="_blank">Open settings</a>
    <a href="about.html" target="_blank">About this app</a>
    <a href="https://www.electronjs.org" target="_blank">Electron website</a>
  </body>
</html>
```

When a page tries to open a new window (with `target="_blank"` or `window.open()`), Electron first asks your **window open handler**. You set it with `webContents.setWindowOpenHandler`. The handler gets the URL and must answer `{ action: 'allow' }` or `{ action: 'deny' }`.

The clever part: you can **deny** the default window and open your own, with your own options and your own tracking:

```javascript
// main.js
const { app, BrowserWindow, shell } = require('electron');

function createMainWindow() {
  // ...same as before...

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.endsWith('/settings.html')) {
      openSettingsWindow();
    } else if (url.endsWith('/about.html')) {
      openAboutWindow();
    } else if (url.startsWith('https://')) {
      shell.openExternal(url); // open real websites in the user's browser
    }
    return { action: 'deny' }; // never let the page create windows by itself
  });
}
```

- `url` is the full address the page asked for. For local files it looks like `file:///C:/Users/asha/my-app/settings.html` on Windows or `file:///Users/asha/my-app/settings.html` on macOS, so checking the ending is enough here.
- `shell.openExternal(url)` hands a web link to the user's default browser. Websites should open there, not inside your app.
- Returning `{ action: 'deny' }` every time means the page can never pop up a window you did not plan for.

Run `npm start` and click "Open settings". A second window appears. Click the link again: the existing window comes to the front instead of a new one opening.

## Child windows and modal windows

Some windows belong to another window. Electron has two options for that.

### Child windows with `parent`

```javascript
const palette = new BrowserWindow({
  parent: mainWindow,
  width: 200,
  height: 400,
});
```

A **child window** always stays on top of its parent. When the parent closes, the child closes with it. This is good for tool palettes and inspectors.

### Modal windows with `modal: true`

A **modal window** is a child that also blocks its parent. The user must deal with it (and close it) before they can click the parent again. Classic examples are an About box or an "Are you sure?" panel.

Create `about.html` (a copy of `settings.html` with different text is fine), then add:

```javascript
// main.js
function openAboutWindow() {
  const about = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 360,
    height: 240,
    resizable: false,
    minimizable: false,
    show: false,
  });

  about.removeMenu(); // no menu bar inside the small box (Windows and Linux)
  about.loadFile('about.html');
  about.once('ready-to-show', () => about.show());
}
```

`modal` only works together with `parent`. Without a parent, there is nothing to block.

How a modal looks depends on the system:

- **Windows:** a normal-looking window that stays in front of its parent. The parent ignores clicks until the modal closes.
- **macOS:** a **sheet** that slides down from the parent's title bar and is attached to it.
- **Linux:** the look depends on the desktop environment and window manager.

> **Tip:** For simple questions like "Save changes?", you usually do not need a modal window at all. Native message boxes are quicker. See [Native Dialogs: Open, Save and Message Boxes](/courses/electronjs/native-dialogs).

## Finding windows later

The main process often needs to find "the right window". `BrowserWindow` has a few helpers for that:

```javascript
// Every window that is currently open
const all = BrowserWindow.getAllWindows();
console.log(`${all.length} windows open`);

// The window the user is working in right now (or null)
const focused = BrowserWindow.getFocusedWindow();

// The window that owns a particular web page
// (very useful in IPC handlers, as you will see soon)
const owner = BrowserWindow.fromWebContents(someWebContents);
```

You can also give each window an `id`. Every `BrowserWindow` has a number in `win.id`, and `BrowserWindow.fromId(id)` gives the window back.

Storing windows in your own variables (like `mainWindow` and `settingsWindow`) is still the clearest choice for windows that have a fixed role. Use `getAllWindows()` when you want to do something to every window, such as telling them all that the theme changed.

## How multiple windows affect quitting

Remember the lifecycle block from [The App Lifecycle: ready, window-all-closed and activate](/courses/electronjs/app-lifecycle):

```javascript
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

The name says it all: this only runs when the **last** window closes. With a main window and a Settings window open, closing Settings does nothing special. The app quits (on Windows and Linux) only when the main window closes too.

On macOS the app keeps running with no windows. When the user clicks the Dock icon, `activate` fires, and you create the main window again:

```javascript
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
```

## Windows cannot see each other

Each window is its own web page in its own process. A variable in `index.html`'s script does not exist in `settings.html`, just like two browser tabs cannot read each other's variables.

When windows need to share information (for example, "the user changed the theme in Settings, update the main window"), the message goes through the main process. You will build exactly that in [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer). For a direct line between two windows, see [MessagePorts for Direct Communication](/courses/electronjs/message-ports).

## Common mistakes

### Opening a new window on every click

If `openSettingsWindow()` does not check `if (settingsWindow)`, users get duplicate windows. Always keep a reference and reuse it.

### Using a window after it closed

```text
TypeError: Object has been destroyed
```

This error means your code called a method on a window that was already closed. It often happens in a timer or callback that runs later. Reset your variables to `null` in the `closed` event, and check before using them:

```javascript
if (settingsWindow && !settingsWindow.isDestroyed()) {
  settingsWindow.setTitle('Settings (saved)');
}
```

### Forgetting the preload in the second window

Your main window works, but the same code in the Settings window says something is `undefined`. The second window was created without `webPreferences.preload`. Each window gets only the options you give it.

### Expecting `modal` to work without `parent`

`modal: true` on its own just makes a normal window. Always pair it with `parent: someWindow`.

## Quick recap

- Every window is a separate `BrowserWindow` with its own page and renderer process.
- Write one function per kind of window and keep a reference to each one.
- Set the reference to `null` in the `closed` event, and reuse an open window with `focus()` instead of creating a duplicate.
- `show: false` plus `ready-to-show` avoids a white flash.
- `setWindowOpenHandler` decides what happens when a page opens a window. Deny by default, open your own windows, and send websites to `shell.openExternal`.
- `parent` makes a child window that closes with its parent; adding `modal: true` also blocks the parent.
- `BrowserWindow.getAllWindows()`, `getFocusedWindow()` and `fromWebContents()` help you find windows later.
- Windows cannot share variables. They talk through the main process.

<code id="code-content" class="language-javascript">
// main.js: a main window, a single Settings window and a modal About box
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
// --- References to the windows we have open (null means "not open")
let mainWindow = null;
let settingsWindow = null;
const preload = path.join(__dirname, 'preload.js');
// --- The main window
function createMainWindow() {
  mainWindow = new BrowserWindow({ width: 900, height: 600, webPreferences: { preload } });
  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () =&gt; { mainWindow = null; });
  // Links with target="_blank" and window.open() end up here
  mainWindow.webContents.setWindowOpenHandler(({ url }) =&gt; {
    if (url.endsWith('/settings.html')) openSettingsWindow();
    else if (url.endsWith('/about.html')) openAboutWindow();
    else if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}
// --- Settings: only ever one of these
function openSettingsWindow() {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 420, height: 360, title: 'Settings', resizable: false, show: false,
    webPreferences: { preload },
  });
  settingsWindow.loadFile('settings.html');
  settingsWindow.once('ready-to-show', () =&gt; settingsWindow.show());
  settingsWindow.on('closed', () =&gt; { settingsWindow = null; });
}
// --- About: a modal child that blocks the main window
function openAboutWindow() {
  const about = new BrowserWindow({
    parent: mainWindow, modal: true, width: 360, height: 240,
    resizable: false, minimizable: false, show: false,
  });
  about.removeMenu();
  about.loadFile('about.html');
  about.once('ready-to-show', () =&gt; about.show());
}
// --- Standard lifecycle
app.whenReady().then(() =&gt; {
  createMainWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

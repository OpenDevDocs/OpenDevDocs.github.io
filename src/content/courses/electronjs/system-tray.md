---
publishDate: 2026-10-25T12:26
title: System Tray Icons
slug: system-tray
metadescription: Add a system tray icon to your Electron app with a tooltip and menu, toggle the window on click, hide to the tray on close and update the tray from your page.
updateDate: 2026-10-25T12:26
author: ['bishal-biswas']
level: 2
tags: ['tray', 'menu', 'ipc']
course: electronjs
---

## What a tray icon is

Many desktop apps keep a small icon near the clock: chat apps, cloud sync tools, music players. That area has different names on each operating system:

- **Windows:** the notification area, at the right end of the taskbar. Extra icons often hide behind a small up arrow.
- **macOS:** the menu bar extras, at the top right of the screen. Apple calls them status items.
- **Linux:** the system tray or status area. Where it appears depends on the desktop (GNOME, KDE, Xfce and so on).

Electron calls all of them a **tray**, and gives you the `Tray` class to put an icon there.

Think of a tray icon like a hotel's front desk bell. The staff may be in the back room (your window is hidden), but the bell is always on the counter. One tap and someone appears. A tray icon lets your app keep running quietly and be called back instantly.

In this lesson you will:

1. Show a tray icon with a tooltip and a menu.
2. Toggle the window by clicking the icon.
3. Hide the window to the tray instead of quitting.
4. Let the page update the tray, and the tray talk to the page.

## Step 1: an icon with a menu

You need a small image for the icon. Put a PNG file called `tray-icon.png` (16 by 16 or 32 by 32 pixels works well) in your project folder, next to `main.js`.

```javascript
// main.js
const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

let tray; // keep a reference at the top level!
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile('index.html');
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('My Notes');

  const menu = Menu.buildFromTemplate([
    { label: 'Show My Notes', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});
```

Run `npm start`. Your icon appears in the tray area. Hover it to see "My Notes". Right-click it (on macOS, just click it) to open the menu.

Line by line:

- `nativeImage.createFromPath()` loads an image file into Electron's image object. Using `path.join(__dirname, ...)` makes the path work no matter which folder you start the app from.
- `new Tray(icon)` creates the icon. Like windows and menus, you can only create it after the app is ready.
- `setToolTip()` sets the text shown on hover.
- `setContextMenu()` attaches a normal Electron menu, built exactly like the ones in [Application Menus](/courses/electronjs/application-menus).

> **Warning:** Store the tray in a variable **outside** the function, as `let tray` does here. If you write `const tray = new Tray(icon)` inside `createTray()`, nothing refers to it after the function ends. JavaScript's garbage collector may clean it up, and your icon vanishes after a few seconds or minutes.

## Icons that look right on every system

Tray icons are tiny, and each platform has its own expectations:

- **Windows:** use an `.ico` file if you can, because it holds several sizes in one file. A 16 by 16 or 32 by 32 PNG also works.
- **macOS:** use a 16 by 16 PNG plus a 32 by 32 version named with `@2x` (for example `trayTemplate.png` and `trayTemplate@2x.png`). Electron picks the sharper one for Retina screens automatically.
- **Linux:** a small PNG is the safest choice.

On macOS, menu bar icons should be **template images**: black shapes on a transparent background. macOS then recolours them to white in dark mode and highlights them when clicked. Name the file so it ends with `Template` (like `trayTemplate.png`), or mark it in code:

```javascript
// main.js
const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
if (process.platform === 'darwin') icon.setTemplateImage(true);
```

A coloured icon on macOS works too, but looks out of place next to the system's own icons.

## Step 2: click to show or hide the window

On Windows, users expect a left-click on the tray icon to bring the app up. The `click` event lets you do that:

```javascript
// main.js (inside createTray, after creating the tray)
tray.on('click', () => {
  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});
```

Now a click toggles the window: hidden or in the background means "show", visible and focused means "hide".

Platform behaviour differs here:

- **Windows:** left-click fires `click`, right-click opens the context menu.
- **macOS:** when the tray has a context menu, a click opens that menu. If you want click-to-toggle on macOS, do not set a context menu, and instead listen to `right-click` and call `tray.popUpContextMenu(menu)` yourself.
- **Linux:** many desktops only show the context menu, and `click` may fire only on some of them. Always put the important actions (Show, Quit) in the context menu so Linux users can reach them.

## Step 3: hide to the tray instead of quitting

Apps with a tray icon often keep running when you close the window. The window hides, and the tray icon stays. To quit, the user picks **Quit** from the tray menu.

There is a catch: `app.quit()` also tries to close every window. If your `close` handler always hides the window, the app can never quit. The fix is a simple flag:

```javascript
// main.js
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

function createWindow() {
  mainWindow = new BrowserWindow({ /* ...same options as before... */ });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault(); // stop the window from closing
      mainWindow.hide();      // just hide it
    }
  });

  mainWindow.loadFile('index.html');
}
```

How it works:

1. The user clicks the window's close button. `isQuitting` is `false`, so the window only hides.
2. The user picks **Quit** from the tray menu. `app.quit()` emits `before-quit` first, which sets `isQuitting` to `true`. Now the window is allowed to close, and the app exits.

Because the window never really closes, the usual `window-all-closed` event does not fire. That is what you want here.

> **Tip:** Tell users the app is still running, at least the first time. A [desktop notification](/courses/electronjs/desktop-notifications) such as "My Notes is still running in the tray" avoids confusion.

## Step 4: the page and the tray talking

The page and the tray live in different processes, so they talk through IPC, as you learned in [IPC Part 1](/courses/electronjs/ipc-send-to-main) and [IPC Part 3](/courses/electronjs/ipc-main-to-renderer).

### From the page to the tray: an unread count

Suppose the page knows how many unread notes there are, and you want the tray tooltip to show it.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trayApi', {
  setUnreadCount: (count) => ipcRenderer.send('tray:set-unread', count),
  onNewNote: (callback) => ipcRenderer.on('tray:new-note', () => callback()),
});
```

```javascript
// main.js
ipcMain.on('tray:set-unread', (event, count) => {
  if (!Number.isInteger(count) || count < 0) return;
  tray.setToolTip(count > 0 ? `My Notes (${count} unread)` : 'My Notes');
  if (process.platform === 'darwin') {
    tray.setTitle(count > 0 ? String(count) : ''); // text next to the icon in the menu bar
  }
});
```

`tray.setTitle()` is macOS only. It shows short text right next to the icon in the menu bar.

### From the tray to the page: a "New note" item

Add an item to the tray menu that sends a message to the window:

```javascript
// main.js (in the tray menu template)
{
  label: 'New Note',
  click: () => {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('tray:new-note');
  },
},
```

```html
<!-- index.html (inside <body>) -->
<input id="new-note" placeholder="Write a new note" />
<ul id="notes"></ul>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
const unread = 3; // in a real app this comes from your data
window.trayApi.setUnreadCount(unread);

window.trayApi.onNewNote(() => {
  const input = document.getElementById('new-note');
  input.value = '';
  input.focus(); // jump straight into the "new note" text box
});
```

Pick **New Note** from the tray menu and the window appears with the cursor ready in the text box.

## Changing the menu later

If an item changes, such as a "Pause syncing" checkbox, build a new menu and call `tray.setContextMenu()` again. On Linux this is required: changes to an existing menu object are not picked up until you set it again.

```javascript
// main.js
let paused = false;

function updateTrayMenu() {
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show My Notes', click: () => mainWindow.show() },
      {
        label: 'Pause syncing',
        type: 'checkbox',
        checked: paused,
        click: (item) => {
          paused = item.checked;
          updateTrayMenu();
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
}
```

## A menu-bar-only app on macOS

Some Mac apps live only in the menu bar, with no Dock icon. You can hide the Dock icon with `app.dock?.hide()` (the `?.` is there because `app.dock` only exists on macOS). Only do this if your tray menu gives users a way to open the window and to quit.

## Common mistakes

### The icon disappears after a while

The `Tray` object was stored in a local variable and got garbage collected. Keep it in a top-level `let tray`.

### The app will not quit

Your `close` handler always calls `preventDefault()`. Add the `isQuitting` flag set in `before-quit`.

### The icon is blank or missing

The path is wrong, or the image is too large or empty. Use `path.join(__dirname, 'file.png')` and check the file really exists. On macOS, a template image must have a transparent background and dark shapes, or it shows as a solid block.

### Two tray icons

If `createTray()` runs twice, for example from the macOS `activate` event, you get two icons. Create the tray once, in `app.whenReady()`, and only create windows in `activate`.

## Quick recap

- `new Tray(image)` puts an icon in the Windows notification area, the macOS menu bar or the Linux system tray. Create it after ready.
- Keep the tray in a top-level variable so it is not garbage collected.
- `setToolTip()` sets hover text. `setContextMenu()` attaches a menu built with `Menu.buildFromTemplate()`.
- Use template images (names ending in `Template`) on macOS so the icon adapts to light and dark menu bars.
- `tray.on('click')` can toggle the window on Windows. On Linux, put every important action in the menu.
- To hide to the tray, call `preventDefault()` in the window's `close` event unless an `isQuitting` flag was set in `before-quit`.
- The page updates the tray with `ipcRenderer.send()`, and the tray reaches the page with `webContents.send()`.

<code id="code-content" class="language-javascript">
// main.js: a tray icon that toggles the window, hides on close and talks to the page
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('node:path');
let tray; // top level, so it is never garbage collected
let mainWindow;
let isQuitting = false;
// --- 1. A window that hides instead of closing (unless we are quitting)
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  mainWindow.on('close', (event) =&gt; {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.loadFile('index.html');
}
function showWindow() {
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
// --- 2. The tray icon, its tooltip and its menu
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'));
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('My Notes');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show My Notes', click: showWindow },
    { label: 'New Note', click: () =&gt; { showWindow(); mainWindow.webContents.send('tray:new-note'); } },
    { type: 'separator' },
    { label: 'Quit', click: () =&gt; app.quit() },
  ]));
  tray.on('click', () =&gt; {
    if (mainWindow.isVisible() &amp;&amp; mainWindow.isFocused()) mainWindow.hide();
    else showWindow();
  });
}
// --- 3. The page reports an unread count, the tray shows it
ipcMain.on('tray:set-unread', (event, count) =&gt; {
  if (!Number.isInteger(count) || count &lt; 0) return;
  tray.setToolTip(count &gt; 0 ? `My Notes (${count} unread)` : 'My Notes');
  if (process.platform === 'darwin') tray.setTitle(count &gt; 0 ? String(count) : '');
});
// --- 4. Lifecycle: create the tray once, let Quit really quit
app.on('before-quit', () =&gt; {
  isQuitting = true;
});
app.whenReady().then(() =&gt; {
  createWindow();
  createTray();
  app.on('activate', () =&gt; showWindow());
});
</code></pre>

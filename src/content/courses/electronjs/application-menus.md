---
publishDate: 2026-10-25T12:21
title: Application Menus
slug: application-menus
metadescription: Build a native application menu in Electron with Menu.buildFromTemplate, built-in roles, the macOS app menu, keyboard accelerators and clicks that reach your page.
updateDate: 2026-10-25T12:21
author: ['bishal-biswas']
level: 1
tags: ['menu', 'native', 'accelerators']
course: electronjs
---

## The menu bar

Almost every desktop app has a menu bar with **File**, **Edit**, **View** and friends. Users expect it: it is where they look for features, and where they learn keyboard shortcuts.

Where the menu bar lives depends on the system:

- **Windows and Linux:** inside each window, just below the title bar.
- **macOS:** at the very top of the screen, shared by the whole app. It changes when the user switches to a different app.

The main process owns the menu. You describe it as a list of plain JavaScript objects, and Electron turns that list into a real, native menu drawn by the operating system.

Think of it like a restaurant menu card. You write down the dishes and their prices (the template). The printer (Electron) prints a proper card in the house style of each restaurant (each operating system). When a guest points at a dish, the kitchen (your `click` function) cooks it.

## The default menu

Run the app from [Your First Electron App](/courses/electronjs/your-first-electron-app) and look at the menu. You already have one, with standard items such as **File**, **Edit**, **View** and **Window**. Electron adds this default menu when your app does not set its own.

It is fine for experiments, but it has items your users do not need (like **Toggle Developer Tools**) and none of your app's own features. Time to make your own.

## Step 1: a first menu from a template

```javascript
// main.js
const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

const template = [
  {
    label: 'File',
    submenu: [
      { label: 'Say hello', click: () => console.log('Hello from the menu!') },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
];

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  createWindow();
});
```

- The **template** is an array. Each object in it is a top-level menu.
- `label` is the text the user sees.
- `submenu` is another array: the items inside that menu.
- `click` is a function the main process runs when the item is chosen. Here it prints to your terminal.
- `{ type: 'separator' }` draws a thin line between groups of items.
- `{ role: 'quit' }` is a ready-made item. More on roles next.
- `Menu.buildFromTemplate(template)` turns the array into a `Menu` object, and `Menu.setApplicationMenu(menu)` installs it.

Run `npm start`, open **File** and click **Say hello**. The message appears in the terminal, because `click` runs in the main process.

## Step 2: roles give you native items for free

A **role** is a built-in behaviour that Electron and the operating system already know how to do. You write `{ role: 'copy' }` and you get a Copy item with the right label, the right shortcut on each system, and the right action, all without a `click` function.

Some useful roles:

| Role | What it does |
| --- | --- |
| `undo`, `redo`, `cut`, `copy`, `paste`, `selectAll` | Normal text editing in the focused page |
| `reload`, `forceReload` | Reload the page |
| `toggleDevTools` | Open or close DevTools |
| `resetZoom`, `zoomIn`, `zoomOut` | Page zoom |
| `togglefullscreen` | Enter or leave full screen |
| `minimize`, `close` | Minimise or close the current window |
| `quit` | Quit the app (labelled "Exit" on Windows) |
| `about` | Show an About panel |

There are also roles for **whole menus**: `fileMenu`, `editMenu`, `viewMenu`, `windowMenu` and, on macOS, `appMenu`. Each builds a complete standard menu that already matches the platform.

```javascript
// main.js
const template = [
  { role: 'fileMenu' },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' },
];
```

That four-line template rebuilds a sensible default menu. Then you add your own items next to the roles.

> **Warning:** On macOS, keyboard shortcuts for copy, paste, undo and select all only work in your page's text fields if your menu contains those items (the easiest way is `{ role: 'editMenu' }`). Leave the Edit menu out and Cmd + C stops working. Always include it, even if you hide nothing else.

## Step 3: the macOS app menu

On macOS, the **first** menu is special. It is the **app menu**, titled with your app's name, and it holds **About**, **Services**, **Hide**, **Quit** and similar items. Whatever `label` you give the first menu, macOS shows the app name there instead.

So on macOS you add an extra first menu with `role: 'appMenu'`. On Windows and Linux there is no such menu, so you leave it out. The usual pattern uses the spread operator (`...`) to include it only on macOS:

```javascript
// main.js
const isMac = process.platform === 'darwin';

const template = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  {
    label: 'File',
    submenu: [
      { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => newNote() },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { role: 'windowMenu' },
];
```

- `isMac ? [{ role: 'appMenu' }] : []` gives a one-item array on macOS and an empty array elsewhere. Spreading an empty array adds nothing.
- On macOS, Quit lives in the app menu, so the File menu ends with **Close Window** instead. On Windows and Linux, File ends with **Exit** (`quit`).

> **Note:** While you develop, macOS shows **Electron** as the app menu's title, because your app is really running inside the Electron program. Once you package it, the menu shows your own app name. See [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers).

## Step 4: keyboard shortcuts with accelerators

An **accelerator** is a keyboard shortcut attached to a menu item. Electron shows it next to the label and runs the item's `click` when the user presses it while your app is focused.

```javascript
{ label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => newNote() }
```

Accelerators are strings of keys joined with `+`:

- `CmdOrCtrl` means **Cmd** on macOS and **Ctrl** on Windows and Linux. Use it for almost every shortcut, so each system gets its normal key.
- Other modifiers: `Shift`, `Alt` (Option on macOS), and `Cmd` or `Ctrl` if you really want one specific key.
- Then one key: a letter, a number, `F1` to `F24`, `Enter`, `Delete`, `Plus` and so on.

Examples: `'CmdOrCtrl+S'`, `'CmdOrCtrl+Shift+S'`, `'F11'`.

Menu accelerators only work while your app is the active app. For shortcuts that work everywhere, or inside the page only, see [Keyboard Shortcuts and Accelerators](/courses/electronjs/keyboard-shortcuts).

### Alt-key mnemonics on Windows and Linux

On Windows and Linux, put `&` before a letter in a top-level label, like `'&File'`. The letter is underlined, and **Alt + F** opens that menu. To show a real `&`, write `&&`. macOS ignores this.

## Step 5: menu clicks that reach your page

Most menu items need to change something in the page: "New Note" should clear the editor, "Word Wrap" should toggle wrapping. The menu runs in the main process and the editor lives in a renderer, so this is a main-to-renderer message, exactly as in [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer).

First, a helper that sends to whichever window the user is working in:

```javascript
// main.js
function sendToFocused(channel, ...args) {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.webContents.send(channel, ...args);
}
```

Then menu items that use it, including a **checkbox** item:

```javascript
// main.js
{
  label: 'File',
  submenu: [
    { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => sendToFocused('menu:new-note') },
    { type: 'separator' },
    isMac ? { role: 'close' } : { role: 'quit' },
  ],
},
{
  label: 'View',
  submenu: [
    {
      id: 'word-wrap',
      label: 'Word Wrap',
      type: 'checkbox',
      checked: true,
      accelerator: 'Alt+Z',
      click: (menuItem) => sendToFocused('menu:word-wrap', menuItem.checked),
    },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ],
},
```

A `checkbox` item ticks and unticks itself when clicked. By the time `click` runs, `menuItem.checked` already holds the new value.

The preload exposes listeners (passing only the data, never the event):

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onNewNote: (callback) => ipcRenderer.on('menu:new-note', () => callback()),
  onWordWrap: (callback) => ipcRenderer.on('menu:word-wrap', (_event, on) => callback(on)),
});
```

And the page reacts:

```javascript
// renderer.js
const editor = document.getElementById('editor'); // a <textarea>

window.electronAPI.onNewNote(() => {
  editor.value = '';
  editor.focus();
});

window.electronAPI.onWordWrap((on) => {
  editor.style.whiteSpace = on ? 'pre-wrap' : 'pre';
});
```

Press **Ctrl + N** (or **Cmd + N**): the editor empties. Toggle **View, Word Wrap** and long lines wrap or scroll.

## Changing the menu while the app runs

Give an item an `id`, and you can find it later and change it:

```javascript
// main.js
const menu = Menu.getApplicationMenu();
const wrapItem = menu.getMenuItemById('word-wrap');
wrapItem.checked = false;   // untick it
wrapItem.enabled = false;   // grey it out
```

You can change properties such as `checked`, `enabled`, `visible` and `label` on existing items. To add or remove items, build a new menu from an updated template and call `Menu.setApplicationMenu()` again.

## Hiding or removing the menu bar

On **Windows and Linux**:

- `Menu.setApplicationMenu(null)` removes the menu bar from every window. (Electron's default menu does not come back.)
- `autoHideMenuBar: true` in a window's options hides the bar until the user presses **Alt**.
- `win.removeMenu()` removes the bar from one window only, which is handy for small dialogs.

On **macOS**, the app menu bar always exists at the top of the screen. Passing `null` only removes the default items, which also removes standard shortcuts like Cmd + Q and Cmd + C. Keep at least `appMenu` and `editMenu` on macOS.

For menus that pop up when the user right-clicks, see the next lesson, [Right-Click Context Menus](/courses/electronjs/context-menus).

## Common mistakes

### Copy and paste stop working on macOS

Your custom menu has no Edit menu. Add `{ role: 'editMenu' }`.

### Labels with a `click` that never runs

If an item has a `role`, Electron uses the role and **ignores** `click`. Pick one: a role for built-in behaviour, or a `click` for your own.

### Expecting `click` to run in the page

`click` runs in the main process. `console.log` there prints to the terminal, and `document` does not exist. Send a message to the page with `webContents.send`.

### Hard-coding `Ctrl` in accelerators

`'Ctrl+S'` feels wrong to Mac users, who expect Cmd + S. Use `'CmdOrCtrl+S'`.

## Quick recap

- Describe the menu as a template array, turn it into a menu with `Menu.buildFromTemplate()`, and install it with `Menu.setApplicationMenu()` after the app is ready.
- Items have a `label`, an optional `click`, `accelerator`, `type` (`separator`, `checkbox`, `radio`), `submenu` and `id`.
- **Roles** (`copy`, `paste`, `quit`, `editMenu`, `viewMenu` and more) give you correct native items with no code.
- On macOS add `{ role: 'appMenu' }` first and always include an Edit menu, or copy and paste shortcuts break.
- Use `CmdOrCtrl` in accelerators so each system gets its normal modifier key.
- `click` runs in the main process; use `webContents.send` to tell the page.
- Find items later with `getMenuItemById()` and change `checked`, `enabled`, `visible` or `label`.

<code id="code-content" class="language-javascript">
// main.js: a cross-platform application menu that talks to the page
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const isMac = process.platform === 'darwin';
// --- Send a menu command to the window the user is working in
function sendToFocused(channel, ...args) {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.webContents.send(channel, ...args);
}
// --- The template: plain objects, roles for built-in behaviour
const template = [
  ...(isMac ? [{ role: 'appMenu' }] : []), // macOS: About, Hide, Quit...
  {
    label: '&amp;File', // Alt + F opens it on Windows and Linux
    submenu: [
      { label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () =&gt; sendToFocused('menu:new-note') },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  },
  { role: 'editMenu' }, // keeps Cmd/Ctrl + C, V, Z working
  {
    label: '&amp;View',
    submenu: [
      { id: 'word-wrap', label: 'Word Wrap', type: 'checkbox', checked: true, accelerator: 'Alt+Z',
        click: (menuItem) =&gt; sendToFocused('menu:word-wrap', menuItem.checked) },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
  { role: 'windowMenu' },
  { role: 'help', submenu: [{ label: 'Learn More', click: () =&gt; shell.openExternal('https://www.electronjs.org') }] },
];
// --- The window
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}
// --- Install the menu once the app is ready
app.whenReady().then(() =&gt; {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (!isMac) app.quit();
});
</code></pre>

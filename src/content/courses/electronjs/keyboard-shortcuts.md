---
publishDate: 2026-10-25T12:23
title: Keyboard Shortcuts and Accelerators
slug: keyboard-shortcuts
metadescription: Add keyboard shortcuts to an Electron app with menu accelerators, before-input-event for window-only keys, and globalShortcut for keys that work anywhere.
updateDate: 2026-10-25T12:23
author: ['bishal-biswas']
level: 2
tags: ['keyboard', 'shortcuts', 'globalshortcut']
course: electronjs
---

## Three kinds of shortcut

Desktop users love keyboard shortcuts. Ctrl + S to save, Ctrl + F to find, Ctrl + Shift + Space to pop open a quick-note window from anywhere. Electron gives you three main-process ways to add them, and the difference is **when** the shortcut works:

- **Menu accelerators**: shortcuts attached to menu items. They work while your app is the active app.
- **Window shortcuts with `before-input-event`**: keys your main process catches for one window, before the page sees them. They work while that window has focus.
- **Global shortcuts with `globalShortcut`**: keys that work everywhere, even when your app is in the background or minimised.

Think of it like sounds in a house. A conversation in the kitchen (a window shortcut) is only heard in the kitchen. The house intercom (a menu accelerator) is heard in every room of your house. A car horn outside (a global shortcut) is heard by the whole street, so you should use it rarely and politely.

You also have a simpler option you already know from web pages: a `keydown` listener in `renderer.js`. This lesson covers all four, one by one.

## How Electron writes a shortcut

Electron describes a key combination as a string called an **accelerator**. It is a list of modifier keys and one normal key, joined with `+`:

```text
CommandOrControl+S
CommandOrControl+Shift+Z
Alt+F4
F11
CommandOrControl+Shift+Space
```

The modifiers you will use most:

| Modifier | Meaning |
| --- | --- |
| `CommandOrControl` (or `CmdOrCtrl`) | Cmd on macOS, Ctrl on Windows and Linux |
| `Control` (or `Ctrl`) | The Ctrl key on every platform |
| `Command` (or `Cmd`) | The Cmd key, macOS only |
| `Alt` | Alt, which is the Option key on a Mac |
| `Shift` | Shift |
| `Super` (or `Meta`) | The Windows key on Windows and Linux, Cmd on macOS |

Normal keys include letters `A` to `Z`, numbers `0` to `9`, `F1` to `F24`, `Space`, `Tab`, `Enter`, `Escape`, `Backspace`, `Delete`, `Up`, `Down`, `Left`, `Right`, `Home`, `End`, `PageUp`, `PageDown`, and `Plus` for the plus sign (because `+` is the separator).

> **Tip:** Use `CommandOrControl` for almost everything. Mac users expect Cmd + S to save, Windows and Linux users expect Ctrl + S. One string covers both.

## Way 1: accelerators on menu items

You already met the `accelerator` option in [Application Menus](/courses/electronjs/application-menus). Add it to any menu item and two things happen: the shortcut appears next to the label in the menu, and pressing it runs the item's `click` function.

The menu lives in main, but saving usually happens in the page. So the `click` function sends a message to the window, as in [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer).

```javascript
// main.js (part of your menu template)
const isMac = process.platform === 'darwin';

const template = [
  ...(isMac ? [{ role: 'appMenu' }] : []),
  {
    label: 'File',
    submenu: [
      {
        label: 'Save',
        accelerator: 'CommandOrControl+S',
        click: (menuItem, window) => window?.webContents.send('shortcut', 'save'),
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  },
  { role: 'editMenu' },
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
```

The second argument of `click` is the focused window, or `undefined` if there is none, so `window?.webContents` safely does nothing when no window is open.

The preload hands the page a small listener function:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shortcuts', {
  onShortcut: (callback) => ipcRenderer.on('shortcut', (_event, name) => callback(name)),
});
```

```html
<!-- index.html (inside <body>) -->
<input id="search" placeholder="Search notes" />
<p id="status">Press a shortcut</p>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
window.shortcuts.onShortcut((name) => {
  document.getElementById('status').textContent = `Shortcut used: ${name}`;
});
```

Press Ctrl + S (Cmd + S on a Mac) and the page shows "Shortcut used: save".

> **Note:** Menu accelerators only work while a menu exists. If you call `Menu.setApplicationMenu(null)` to remove the menu bar, the shortcuts disappear with it. On Windows and Linux you can hide the bar but keep the menu with the window option `autoHideMenuBar: true`.

### Showing a shortcut without registering it

Sometimes the page already handles a key and you only want the menu to **show** the hint. On Windows and Linux, add `registerAccelerator: false` to the item. The label still says "Ctrl+F", but pressing it does not trigger the menu item.

## Way 2: keys handled only in the page

If a shortcut only matters to the page, and the page has focus, a plain web `keydown` listener is the simplest tool. No IPC needed:

```javascript
// renderer.js
document.addEventListener('keydown', (event) => {
  const mod = event.ctrlKey || event.metaKey; // Ctrl, or Cmd on a Mac
  if (mod && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.getElementById('search').focus();
  }
});
```

This is fine for things like "Escape closes the dialog" or "Ctrl + K opens search". Use the main-process ways when the shortcut needs to do something only main can do, such as showing a native dialog, or when the page might not be listening.

## Way 3: window shortcuts with `before-input-event`

Every `webContents` emits **`before-input-event`** in main just before a key reaches the page. You get an `input` object describing the key, and you can call `event.preventDefault()` to swallow it so the page and the menu never see it.

The `input` object has these useful fields:

- `input.type`: `'keyDown'` or `'keyUp'`
- `input.key`: the character, such as `'k'` or `'K'` (with Shift), like `KeyboardEvent.key`
- `input.code`: the physical key, such as `'KeyK'`, like `KeyboardEvent.code`
- `input.control`, `input.meta`, `input.alt`, `input.shift`: which modifiers are held
- `input.isAutoRepeat`: `true` when the key is being held down

Here main opens a command palette on Ctrl + K (Cmd + K on macOS), and lets Escape leave full screen:

```javascript
// main.js (inside createWindow, after creating win)
win.webContents.on('before-input-event', (event, input) => {
  if (input.type !== 'keyDown') return;

  const mod = process.platform === 'darwin' ? input.meta : input.control;

  if (mod && input.key.toLowerCase() === 'k' && !input.isAutoRepeat) {
    event.preventDefault();
    win.webContents.send('shortcut', 'palette');
  }

  if (input.key === 'Escape' && win.isFullScreen()) {
    event.preventDefault();
    win.setFullScreen(false);
  }
});
```

Because this is attached to one window's `webContents`, it only works while that window has focus. A second window in your app would need its own listener.

> **Tip:** If you only want to stop **menu** shortcuts for a while (for example while the user is recording a new shortcut in your settings page), call `win.webContents.setIgnoreMenuShortcuts(true)` and later `false`. The page still gets its keys.

## Way 4: global shortcuts with `globalShortcut`

A **global shortcut** works even when your app is not focused. A typical use is "press Ctrl + Shift + Space anywhere to show my app". It is powerful, so follow three rules:

1. Register it **after** the app is ready.
2. Check the return value. If another app already owns that key combination, registering quietly fails and returns `false`. The operating system does not let apps fight over keys.
3. Unregister your shortcuts when the app is quitting, in the `will-quit` event.

```javascript
// main.js
const { app, BrowserWindow, globalShortcut } = require('electron');

app.whenReady().then(() => {
  const win = createWindow();

  const ok = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('shortcut', 'quick-note');
  });

  if (!ok) {
    console.log('Could not register the global shortcut. Another app may be using it.');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

Run the app, click into another program such as your browser, and press Ctrl + Shift + Space (Cmd + Shift + Space on a Mac). Your window jumps to the front.

On macOS the app keeps running after its last window closes, so `win` may be gone when the shortcut fires. The complete example at the end of this lesson checks `win.isDestroyed()` and creates a new window when needed.

To remove a single shortcut, use `globalShortcut.unregister('CommandOrControl+Shift+Space')`. To check whether your app currently owns one, use `globalShortcut.isRegistered(...)`.

> **Warning:** Never register everyday keys like `CommandOrControl+C` or `CommandOrControl+V` globally. Your app would steal copy and paste from every other program on the computer. Pick unusual combinations with two modifiers, and ideally let users change them in your settings.

### Platform notes

- **macOS:** global media keys such as "Media Play/Pause" only register if the user has trusted your app in System Settings, Privacy and Security, Accessibility.
- **Windows:** some combinations are reserved by Windows itself, such as most shortcuts that use the Windows key. Registering them returns `false`.
- **Linux:** global shortcuts depend on the desktop environment, and some setups (especially Wayland sessions) limit them. Always handle a `false` return value gracefully.

## Which one should I use?

| You want... | Use |
| --- | --- |
| A shortcut shown in the menu bar, such as Save or Find | A menu `accelerator` |
| A key that only the page cares about | A `keydown` listener in `renderer.js` |
| Main to catch or block a key in one window | `before-input-event` |
| A key that works when your app is in the background | `globalShortcut`, used sparingly |

## Common mistakes

### Registering a global shortcut too early

`globalShortcut.register()` must run after `app.whenReady()`. Put it inside the `then()` callback, never at the top of `main.js`.

### Forgetting to unregister

Always call `globalShortcut.unregisterAll()` in `will-quit`. It keeps your shortcuts from lingering while the app shuts down and is the documented, tidy way to finish.

### Hard-coding Ctrl

`Control+S` means Ctrl on every platform, including the Mac, where users expect Cmd. Use `CommandOrControl+S` in accelerators, and check `input.meta` on macOS in `before-input-event`.

### Reacting to held-down keys

A held key fires `keyDown` again and again. If your shortcut toggles something, check `!input.isAutoRepeat` in main or `!event.repeat` in the page, or it will flicker on and off.

## Quick recap

- An **accelerator** is a string such as `CommandOrControl+Shift+S`. `CommandOrControl` gives Cmd on macOS and Ctrl elsewhere.
- Menu items with `accelerator` show the shortcut and run `click` while your app is active. Send a message to the page with `webContents.send()`.
- A `keydown` listener in the renderer is enough for page-only shortcuts.
- `webContents.on('before-input-event')` lets main catch or block keys for one window. `event.preventDefault()` stops the page and the menu from seeing them.
- `globalShortcut.register()` works system-wide. Register after ready, check the `true`/`false` result, and call `unregisterAll()` in `will-quit`.
- Do not steal common shortcuts like copy and paste globally.

<code id="code-content" class="language-javascript">
// main.js: menu accelerators, window-only keys and a global shortcut
const { app, BrowserWindow, Menu, globalShortcut } = require('electron');
const path = require('node:path');
const isMac = process.platform === 'darwin';
let mainWindow;
// --- 1. Menu accelerators: shown in the menu, work while the app is active
function buildMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Save',
          accelerator: 'CommandOrControl+S',
          click: (menuItem, window) =&gt; window?.webContents.send('shortcut', 'save'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
// --- 2. before-input-event: keys for this window only, seen before the page
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.webContents.on('before-input-event', (event, input) =&gt; {
    if (input.type !== 'keyDown') return;
    const mod = isMac ? input.meta : input.control;
    if (mod &amp;&amp; input.key.toLowerCase() === 'k' &amp;&amp; !input.isAutoRepeat) {
      event.preventDefault();
      win.webContents.send('shortcut', 'palette');
    }
    if (input.key === 'Escape' &amp;&amp; win.isFullScreen()) {
      event.preventDefault();
      win.setFullScreen(false);
    }
  });
  win.loadFile('index.html');
  return win;
}
// --- 3. A global shortcut: works even when the app is in the background
app.whenReady().then(() =&gt; {
  buildMenu();
  mainWindow = createWindow();
  const ok = globalShortcut.register('CommandOrControl+Shift+Space', () =&gt; {
    if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('shortcut', 'quick-note');
  });
  if (!ok) console.log('Global shortcut is taken by another app.');
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});
// --- 4. Clean up global shortcuts when quitting
app.on('will-quit', () =&gt; {
  globalShortcut.unregisterAll();
});
app.on('window-all-closed', () =&gt; {
  if (!isMac) app.quit();
});
// preload.js exposes: onShortcut: (cb) =&gt; ipcRenderer.on('shortcut', (_e, name) =&gt; cb(name))
</code></pre>

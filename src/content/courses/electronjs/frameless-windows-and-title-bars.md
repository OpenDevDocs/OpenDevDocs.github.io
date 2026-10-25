---
publishDate: 2026-10-25T12:12
title: Frameless Windows and Custom Title Bars
slug: frameless-windows-and-title-bars
metadescription: Hide the standard title bar, keep native window buttons with titleBarOverlay, make your own draggable title bar with CSS, and handle Windows, macOS and Linux.
updateDate: 2026-10-25T12:12
author: ['bishal-biswas']
level: 2
tags: ['browserwindow', 'title-bar', 'css']
course: electronjs
---

## What a frame is

Every normal window has a **frame**: the border, the title bar with the window's name, and the buttons to minimise, maximise and close. The operating system draws it, not your web page.

Many modern apps (VS Code, Slack, Discord, Spotify) replace that plain bar with their own design. They put tabs, a search box or the app logo right at the top. Electron lets you do the same.

Think of the frame like the wooden frame around a painting. The museum (the operating system) supplies a standard frame. You can ask for no frame and paint the edges yourself, but then you also have to paint the hook to hang it by (a place to drag the window) and keep the light switch (the close button) where people can reach it.

This lesson builds on [Window Options: Size, Position, Title and Icon](/courses/electronjs/window-options).

## Three ways to change the title bar

| Option | What you get | Window buttons |
| --- | --- | --- |
| `titleBarStyle: 'hidden'` | Title bar hidden, your page fills the whole window | macOS keeps its traffic lights. Windows and Linux need `titleBarOverlay` to keep buttons. |
| `titleBarStyle: 'hidden'` + `titleBarOverlay` | Your page fills the window, the system draws real buttons on top | Native buttons on every system |
| `frame: false` | No frame at all | None. You build them yourself. |

For most apps, the **second option is the best choice**. You get your own design and the system's real buttons, which already behave correctly (snap layouts on Windows, right-to-left layouts, accessibility).

## Step 1: hide the title bar

Start from your plain app and change the window options:

```javascript
// main.js
const win = new BrowserWindow({
  width: 900,
  height: 600,
  titleBarStyle: 'hidden',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

Run `npm start` and look at what happens on each system:

- **macOS:** the grey title bar disappears and your page starts at the very top. The red, yellow and green **traffic light** buttons stay in the top-left corner, floating over your page.
- **Windows and Linux:** the title bar disappears, and so do the minimise, maximise and close buttons.

There is now also no way to drag the window. You will fix both problems next.

> **Tip:** On macOS you can use `titleBarStyle: 'hiddenInset'` to push the traffic lights a little further in, or `trafficLightPosition: { x: 16, y: 16 }` to place them exactly. Both are macOS only and are ignored elsewhere.

## Step 2: bring back native buttons with `titleBarOverlay`

`titleBarOverlay` asks the system to draw its own window buttons on top of your page, in a strip called the **Window Controls Overlay**.

```javascript
// main.js
const win = new BrowserWindow({
  width: 900,
  height: 600,
  titleBarStyle: 'hidden',
  titleBarOverlay: {
    color: '#1e1e2e',      // background behind the buttons
    symbolColor: '#cdd6f4', // colour of the button icons
    height: 40,            // height of the title bar area in pixels
  },
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

- `color` and `symbolColor` only apply on **Windows and Linux**. macOS always draws its traffic lights in the normal colours.
- `height` sets how tall the button strip is. Make your own title bar the same height so everything lines up.
- `titleBarOverlay: true` also works. It uses the system's default colours.

Now Windows and Linux show real minimise, maximise and close buttons in the top-right corner, and macOS shows its traffic lights top-left. Your page sits behind them.

> **Note:** On Linux the buttons follow the user's desktop settings. On GNOME, for example, often only the close button shows, and on some setups the buttons sit on the left. The next step shows how to leave room for them wherever they are.

### Changing the overlay colours later

If your app switches between light and dark themes, update the button colours to match:

```javascript
win.setTitleBarOverlay({ color: '#ffffff', symbolColor: '#000000' });
```

`setTitleBarOverlay` works on Windows and Linux, on a window that was created with `titleBarOverlay`. [Dark Mode with nativeTheme](/courses/electronjs/dark-mode-with-nativetheme) shows how to know when the theme changes.

## Step 3: draw your own title bar and make it draggable

Now add a title bar to your page. Put this at the top of `index.html`'s `<body>`:

```html
<!-- index.html -->
<header class="titlebar">
  <span class="app-name">My Notes</span>
  <input class="search" type="search" placeholder="Search notes" />
</header>
<main class="content">
  <p>Your app goes here.</p>
</main>
```

And this CSS (in a `<style>` tag or your stylesheet):

```css
/* styles.css */
body {
  margin: 0;
  font-family: system-ui, sans-serif;
}

.titlebar {
  position: fixed;
  top: 0;
  /* Stay out of the way of the window buttons, wherever they are */
  left: env(titlebar-area-x, 0);
  width: env(titlebar-area-width, 100%);
  height: env(titlebar-area-height, 40px);

  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  box-sizing: border-box;
  background: #1e1e2e;
  color: #cdd6f4;

  -webkit-app-region: drag; /* this area moves the window */
  user-select: none;
}

.titlebar input,
.titlebar button {
  -webkit-app-region: no-drag; /* but these must still be clickable */
}

.content {
  padding: calc(env(titlebar-area-height, 40px) + 16px) 16px 16px;
}
```

Two important ideas are hiding in that CSS.

### `-webkit-app-region: drag` and `no-drag`

`-webkit-app-region: drag` is a special CSS property that Electron understands. It says "treat this element like a real title bar". The user can press on it and drag the window around, and on most systems double-clicking it maximises the window, just like a normal title bar.

The catch: a drag region **swallows mouse clicks**. Buttons, links and text inputs inside it stop working. That is why every interactive element inside the title bar gets `-webkit-app-region: no-drag`. Think of `no-drag` as cutting a hole in the drag area so clicks can reach what is underneath.

`user-select: none` stops the title text from being highlighted when the user drags.

### The `env(titlebar-area-*)` variables

When `titleBarOverlay` is on, Chromium tells your CSS exactly where the free space is, through four environment variables:

| Variable | Meaning |
| --- | --- |
| `env(titlebar-area-x)` | Where the free area starts (after macOS traffic lights or left-side Linux buttons) |
| `env(titlebar-area-width)` | How wide the free area is (before the Windows buttons) |
| `env(titlebar-area-y)` | The top of the area |
| `env(titlebar-area-height)` | The height you set in `titleBarOverlay` |

The second value in `env(titlebar-area-x, 0)` is a fallback for when the overlay is not active. Using these variables means your title bar never slides under the window buttons on any system.

Run `npm start` again. You should see your dark title bar with the app name and a search box. Drag the bar to move the window. Click into the search box and type. The native window buttons sit neatly at one end.

## Fully frameless: `frame: false`

Sometimes you want no frame at all: a small widget, a splash screen, or a window with a completely custom shape.

```javascript
// main.js
const splash = new BrowserWindow({
  width: 400,
  height: 300,
  frame: false,
  resizable: false,
});
```

Now nothing is drawn by the system: no title bar, no buttons. You must give the user a way to drag and close the window yourself. Use the same `-webkit-app-region: drag` CSS for dragging.

Two related options you may meet:

- `transparent: true` makes the window background see-through, so you can draw rounded or odd shapes with CSS. On Windows it only works on frameless windows.
- `roundedCorners: false` turns off the rounded corners that frameless windows get on macOS and Windows 11.

### Building your own window buttons

A page cannot minimise or close its own window, because only the main process controls windows. So custom buttons need a message from the page to the main process. You will learn this properly in [IPC Part 1: Sending Messages to the Main Process](/courses/electronjs/ipc-send-to-main). Here is the whole thing so you can see the shape of it:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window-control', 'minimize'),
  toggleMaximize: () => ipcRenderer.send('window-control', 'toggle-maximize'),
  close: () => ipcRenderer.send('window-control', 'close'),
});
```

```javascript
// main.js
const { ipcMain, BrowserWindow } = require('electron');

ipcMain.on('window-control', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  if (action === 'minimize') win.minimize();
  else if (action === 'toggle-maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});
```

```html
<!-- index.html, inside the .titlebar header -->
<div class="window-buttons">
  <button id="min" aria-label="Minimise">&#8211;</button>
  <button id="max" aria-label="Maximise">&#9633;</button>
  <button id="close" aria-label="Close">&#10005;</button>
</div>
```

```javascript
// renderer.js
document.getElementById('min').addEventListener('click', () => window.windowControls.minimize());
document.getElementById('max').addEventListener('click', () => window.windowControls.toggleMaximize());
document.getElementById('close').addEventListener('click', () => window.windowControls.close());
```

It works, but you now own every detail the system used to handle: hover colours, the Windows 11 snap layout menu, keyboard focus and screen readers. That is why `titleBarOverlay` is usually the better choice.

## Platform cheat sheet

- **Windows:** `titleBarStyle: 'hidden'` removes the buttons unless you add `titleBarOverlay`. Frameless windows can still be resized from the edges. Keyboard users can always close a window with Alt + F4.
- **macOS:** `titleBarStyle: 'hidden'` keeps the traffic lights. Leave about 70 to 80 pixels free on the left, or use `env(titlebar-area-x)` with `titleBarOverlay`. Cmd + W and Cmd + Q still work.
- **Linux:** behaviour depends on the desktop environment. With `titleBarOverlay`, the buttons follow the user's own layout, so always use the `env()` variables rather than guessing.

## Common mistakes

### No way to close the window

You set `titleBarStyle: 'hidden'` on Windows and forgot `titleBarOverlay`. The buttons vanished. Add `titleBarOverlay`, or build your own buttons.

### Buttons and inputs in the title bar do nothing

The whole header has `-webkit-app-region: drag`, so clicks never reach its children. Add `-webkit-app-region: no-drag` to every button, link and input inside it.

### The title bar slides under the window buttons

You gave the bar `left: 0; width: 100%`. Use `env(titlebar-area-x, 0)` and `env(titlebar-area-width, 100%)` so the system tells you where the free space is.

### The window cannot be moved at all

A frameless or hidden-title-bar window has no drag area until you add one. Make sure at least one visible element has `-webkit-app-region: drag`.

## Quick recap

- The frame is the system-drawn border, title bar and buttons around a window.
- `titleBarStyle: 'hidden'` hides the title bar. macOS keeps its traffic lights; Windows and Linux lose their buttons.
- Add `titleBarOverlay` (with `color`, `symbolColor`, `height`) to get native buttons drawn over your page. Change colours later with `win.setTitleBarOverlay()`.
- `frame: false` removes everything. You must add dragging and buttons yourself.
- CSS `-webkit-app-region: drag` makes an element move the window; `no-drag` keeps buttons and inputs clickable.
- Position your title bar with the `env(titlebar-area-x / width / height)` variables so it fits every system.
- Custom window buttons need IPC, because only the main process controls windows.

<code id="code-content" class="language-javascript">
// main.js: a custom title bar with native window buttons on every system
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
// --- The window: our page fills it, the system draws the buttons on top
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    titleBarStyle: 'hidden',          // hide the standard title bar
    titleBarOverlay: {                // keep real buttons (Windows, Linux) / traffic lights (macOS)
      color: '#1e1e2e',               // Windows and Linux only
      symbolColor: '#cdd6f4',         // Windows and Linux only
      height: 40,                     // match your CSS title bar height
    },
    trafficLightPosition: { x: 14, y: 12 }, // macOS only, ignored elsewhere
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
  // In index.html the header uses:
  //   left: env(titlebar-area-x, 0); width: env(titlebar-area-width, 100%);
  //   -webkit-app-region: drag;   (buttons and inputs inside get no-drag)
}
// --- Optional: support for fully custom buttons (see IPC Part 1)
ipcMain.on('window-control', (event, action) =&gt; {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (action === 'minimize') win.minimize();
  else if (action === 'toggle-maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});
// --- Standard lifecycle
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

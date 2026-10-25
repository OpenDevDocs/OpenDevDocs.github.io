---
publishDate: 2026-10-25T12:09
title: 'Window Options: Size, Position, Title and Icon'
slug: window-options
metadescription: Set a BrowserWindow's size, minimum size, position, title and icon, fit it to the user's screen, and change these options later from your code.
updateDate: 2026-10-25T12:09
author: ['bishal-biswas']
level: 1
tags: ['browserwindow', 'window-options', 'icons']
course: electronjs
---

## Ordering a window to measure

When you create a `BrowserWindow`, you pass an **options object** that describes the window you want. It is like ordering a custom picture frame: you say how big it should be, where it should hang, what the label on it says, and which little badge goes in the corner. Electron builds exactly that.

```javascript
// main.js
const win = new BrowserWindow({
  width: 1000,
  height: 700,
  title: 'Notes',
});
```

You met the basics in [Creating Windows with BrowserWindow](/courses/electronjs/browserwindow-basics). This lesson goes through the options you will use most: **size**, **position**, **title** and **icon**, plus a few handy extras. At the end, you will see how to change them while the app is running.

## Size

### width and height

```javascript
// main.js
const win = new BrowserWindow({
  width: 1000,  // pixels, default 800
  height: 700,  // pixels, default 600
});
```

If you leave them out, you get an 800 by 600 window.

By default, these numbers are the size of the **whole window**, including the title bar and borders. So the page inside is a little smaller. If you would rather set the size of the **page area** itself, add `useContentSize: true`:

```javascript
// main.js
const win = new BrowserWindow({
  width: 1000,
  height: 700,
  useContentSize: true, // 1000 x 700 is now the page area
});
```

This is useful when your page has a fixed design size, like a 1000 by 700 game board.

> **Note:** On screens with scaling turned on (for example 125% or 150% in Windows display settings), Electron works in scaled pixels, and the final size can differ from your numbers by a pixel or two. That is normal.

### Minimum and maximum size

Users can resize your window by dragging its edges. To stop them making it so small that your layout breaks, set a minimum:

```javascript
// main.js
const win = new BrowserWindow({
  width: 1000,
  height: 700,
  minWidth: 600,
  minHeight: 400,
  maxWidth: 1600,  // optional: no limit by default
  maxHeight: 1200,
});
```

Now the window cannot be dragged smaller than 600 by 400. Even your own code cannot shrink it below the minimum: `win.setSize(200, 100)` gives you a 600 by 400 window.

### Not resizable at all

Some windows, like a small "About" box, should keep one size:

```javascript
// main.js
const win = new BrowserWindow({
  width: 400,
  height: 300,
  resizable: false,
});
```

### Fitting the user's screen

A 1400-pixel-wide window is fine on a big monitor but spills off a small laptop. The `screen` module tells you how much room there is:

```javascript
// main.js
const { app, BrowserWindow, screen } = require('electron');

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.round(width * 0.8),   // 80% of the available width
    height: Math.round(height * 0.8), // 80% of the available height
  });

  win.loadFile('index.html');
});
```

- `screen.getPrimaryDisplay()` returns information about the main monitor.
- `workAreaSize` is the usable area: the screen minus the taskbar (Windows), the menu bar and Dock (macOS), or panels (Linux).
- `Math.round` turns the result into whole numbers.

The `screen` module only works after the app is ready. If you use it at the top of `main.js` you get:

```text
Error: The 'screen' module can't be used before the app 'ready' event
```

## Position

### Centered (the default)

If you do not say where the window should go, Electron centres it on the screen. You can also ask for that explicitly with `center: true`.

### x and y

To place the window at an exact spot, give both `x` (pixels from the left edge of the screen) and `y` (pixels from the top):

```javascript
// main.js
const win = new BrowserWindow({
  width: 800,
  height: 600,
  x: 50,
  y: 60,
});
```

You must give **both**. If you give only `x`, Electron ignores it and centres the window.

> **Tip:** Hard-coded positions can put a window off-screen, for example when a user unplugs their second monitor. Usually it is better to let Electron centre the window, or to remember where the user last put it. [Remembering Window Size and Position](/courses/electronjs/remembering-window-state) shows how to do that safely.

## Title

The `title` option sets the text in the title bar (and in the taskbar or window list):

```javascript
// main.js
const win = new BrowserWindow({
  title: 'Notes',
});
```

The default is `"Electron"`. But there is a catch: **the page's `<title>` tag wins**. As soon as the page loads, Electron copies its `<title>` into the window title.

```html
<!-- index.html -->
<title>Notes: Shopping list</title>
```

So you have two choices:

1. **Let the page decide.** Put the title in `index.html`. This is the simplest option, and the renderer can change it later with `document.title = '...'`.
2. **Let `main.js` decide.** Keep the `title` option, and stop the page from changing it by cancelling the `page-title-updated` event:

```javascript
// main.js
win.on('page-title-updated', (event) => {
  event.preventDefault(); // keep the title we set in main.js
});
```

You can change the title at any time with `win.setTitle('New title')`, and read it with `win.getTitle()`.

> **Note:** On macOS, the bold app name in the menu bar is **not** the window title. It comes from your app's name, which you set when you package the app.

## Icon

The window icon appears in the title bar and taskbar on Windows, and in the taskbar or window list on Linux. You set it with `icon`, using a full path to an image file:

```javascript
// main.js
const path = require('path');

const win = new BrowserWindow({
  width: 800,
  height: 600,
  icon: path.join(__dirname, 'images', 'icon.png'),
});
```

Each operating system handles icons a little differently:

| System | What the `icon` option does | Best format |
| --- | --- | --- |
| **Windows** | Sets the title bar and taskbar icon | `.ico` (it holds several sizes in one file); `.png` also works |
| **Linux** | Sets the window icon used by the taskbar or window list | `.png` |
| **macOS** | Nothing visible. Mac windows do not have their own icons | Use `.icns` for the packaged app |

### The Dock icon on macOS

On macOS, the icon in the Dock belongs to the **app**, not the window. While you develop, it shows Electron's default icon. You can change it from code with `app.dock`:

```javascript
// main.js
if (process.platform === 'darwin') {
  app.dock.setIcon(path.join(__dirname, 'images', 'icon.png'));
}
```

`app.dock` only exists on macOS (on other systems it is `undefined`), which is why we check `process.platform` first.

### Icons in the finished app

The `icon` option only affects the running window. The icon of your installed program (the one on the desktop, in the Start menu or in the Applications folder) is set when you **package** the app. You will do that in [App Icons, Names and Metadata](/courses/electronjs/app-icons-and-metadata).

### Checking that your icon loads

If the path in the `icon` option is wrong, Electron does **not** complain. You just get the default icon, and you might not notice. To check, load the image yourself with `nativeImage`:

```javascript
// main.js
const { nativeImage } = require('electron');

const icon = nativeImage.createFromPath(path.join(__dirname, 'images', 'icon.png'));
if (icon.isEmpty()) {
  console.warn('Icon not found! Check the path.');
}

const win = new BrowserWindow({ icon });
```

`nativeImage` is Electron's image type. `createFromPath` loads a file, and `isEmpty()` returns `true` if nothing could be loaded. The `icon` option accepts either a path or a `nativeImage`.

## Handy extras

A few more options you will use from time to time:

| Option | What it does | Notes |
| --- | --- | --- |
| `backgroundColor: '#1e1e1e'` | Colour shown before the page draws | Default is white |
| `show: false` | Create the window hidden | Show it later with `win.show()` |
| `autoHideMenuBar: true` | Hide the menu bar until the user presses Alt | Windows and Linux |
| `alwaysOnTop: true` | Keep the window above all others | Not supported on Wayland (Linux) |
| `fullscreen: true` | Start in full screen | |
| `minimizable`, `maximizable`, `closable`, `movable` | Turn those abilities on or off | Not implemented on Linux |
| `frame: false` | Remove the title bar and borders | See [Frameless Windows and Custom Title Bars](/courses/electronjs/frameless-windows-and-title-bars) |

## Changing options later

Most options have a matching method, so you can change them while the app runs:

```javascript
// main.js
win.setSize(1200, 800);              // width, height
win.setPosition(100, 100);           // x, y
win.setBounds({ x: 100, y: 100, width: 1200, height: 800 }); // all at once
win.center();                        // back to the middle
win.setMinimumSize(600, 400);
win.setResizable(false);
win.setAlwaysOnTop(true);
win.setTitle('Notes: Saved');
win.setIcon(path.join(__dirname, 'images', 'icon-unsaved.png')); // Windows and Linux
```

And to read the current values:

```javascript
// main.js
console.log(win.getSize());     // [ 1200, 800 ]
console.log(win.getPosition()); // [ 100, 100 ]
console.log(win.getBounds());   // { x: 100, y: 100, width: 1200, height: 800 }
```

Unlike the `icon` option, `win.setIcon()` **does** throw an error if the file cannot be loaded:

```text
Error: Failed to load image from path '/Users/asha/my-app/images/icon-unsaved.png'
```

## Common mistakes

### Only setting x (or only y)

Electron needs both. With only one, it ignores your position and centres the window.

### A window that does not fit on a laptop

A fixed `width: 1600` looks great on your monitor and terrible on a 13-inch laptop. Use `screen.getPrimaryDisplay().workAreaSize` to size the window, and set a sensible `minWidth` and `minHeight`.

### A title that keeps changing back

You set `title` in `main.js`, but the page's `<title>` replaced it. Either change the HTML `<title>`, or cancel `page-title-updated`.

### A relative icon path

`icon: 'icon.png'` depends on which folder the app was started from. Always build the path with `path.join(__dirname, ...)`. And remember: a wrong path in the `icon` option fails silently.

## Quick recap

- `width` and `height` (default 800 by 600) set the window size. `useContentSize: true` makes them the page size.
- `minWidth`, `minHeight`, `maxWidth`, `maxHeight` and `resizable` control resizing.
- `screen.getPrimaryDisplay().workAreaSize` (after ready) tells you how much room the screen has.
- Windows are centred by default. Give both `x` and `y` to place them exactly.
- The page's `<title>` overrides the `title` option, unless you cancel `page-title-updated`.
- The `icon` option works on Windows (`.ico`) and Linux (`.png`). macOS uses the app's icon; set the Dock icon with `app.dock.setIcon()` in development.
- A wrong `icon` path fails silently. Check it with `nativeImage.createFromPath(...).isEmpty()`.
- Change options later with methods like `setSize`, `setPosition`, `setBounds`, `setTitle` and `setIcon`.

<code id="code-content" class="language-javascript">
// main.js: a window sized to the screen, with a fixed title and a checked icon
const { app, BrowserWindow, screen, nativeImage } = require('electron');
const path = require('path');
function createWindow() {
  // --- Size: 80% of the usable screen area (the screen module needs "ready")
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  // --- Icon: load it ourselves so a wrong path does not fail silently
  const iconPath = path.join(__dirname, 'images', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) console.warn('Icon not found at', iconPath);
  const win = new BrowserWindow({
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.8),
    minWidth: 600, // the layout breaks below this
    minHeight: 400,
    center: true, // the default, written out for clarity
    title: 'Notes', // the page's title tag would normally replace this...
    icon, // Windows and Linux window icon
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true, // Windows and Linux: press Alt to show the menu
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  // ...so keep our title instead
  win.on('page-title-updated', (event) =&gt; event.preventDefault());
  // macOS: the Dock icon belongs to the app, not the window
  if (process.platform === 'darwin' &amp;&amp; !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
  win.loadFile('index.html');
  console.log('Window bounds:', win.getBounds());
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

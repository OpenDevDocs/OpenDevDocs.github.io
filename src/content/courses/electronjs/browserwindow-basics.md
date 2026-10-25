---
publishDate: 2026-10-25T12:08
title: Creating Windows with BrowserWindow
slug: browserwindow-basics
metadescription: Learn how BrowserWindow creates and controls app windows, show them without a white flash, react to window events and safely keep a window reference.
updateDate: 2026-10-25T12:08
author: ['bishal-biswas']
level: 1
tags: ['browserwindow', 'windows', 'events']
course: electronjs
---

## Windows are the heart of your app

Almost everything your users see lives in a window. In Electron, every window is a **`BrowserWindow`**: a real operating-system window with a Chromium page inside it.

Think of a picture frame. The **frame** is the `BrowserWindow`: it has a size, a position, a title bar and close buttons. The **picture** inside is the web page, which Electron calls the **web contents**. You can move and resize the frame without touching the picture, and you can swap the picture without replacing the frame.

In this lesson you will create windows, show them nicely, control them from code, and react when the user moves, focuses or closes them.

## Creating a window

You already know the basic shape from [Your First Electron App](/courses/electronjs/your-first-electron-app):

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile('index.html');
  return win;
}

app.whenReady().then(createWindow);
```

- `new BrowserWindow({...})` creates the window. The object you pass is the **options**: size, title, icon and much more. [Window Options: Size, Position, Title and Icon](/courses/electronjs/window-options) covers them in detail.
- `webPreferences` holds the options for the **page** inside the window, like which preload script to run.
- `win.loadFile('index.html')` puts a page inside the frame.
- Remember: windows can only be created after the app is ready. See [The App Lifecycle](/courses/electronjs/app-lifecycle).

### The frame and the picture: win and win.webContents

The object you get back, `win`, controls the **frame**. Its `webContents` property controls the **page**:

```javascript
// main.js
win.setTitle('Hello');                 // the frame: change the title bar
win.maximize();                        // the frame: fill the screen

win.webContents.openDevTools();        // the page: open its DevTools
win.webContents.reload();              // the page: reload it
```

When you are not sure where a method lives, ask yourself: "Is this about the window, or about the web page inside it?"

## Loading a page is asynchronous

`loadFile()` (and its cousin `loadURL()`) return a **Promise**. It is fulfilled when the page has finished loading, and rejected if loading fails. You can wait for it:

```javascript
// main.js
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 800, height: 600 });

  try {
    await win.loadFile('index.html');
    console.log('Page loaded!');
  } catch (error) {
    console.error('Could not load the page:', error.message);
  }
});
```

If you misspell the file name, you will see an error containing `ERR_FILE_NOT_FOUND` instead of a mystery blank window. More on loading in [Loading Pages, Styles and Images](/courses/electronjs/loading-pages-and-assets).

## Showing the window without a white flash

When a window opens, it appears straight away, but the page takes a moment to draw. For a split second the user may see an empty white rectangle. On a dark-themed app that flash is very noticeable.

There are two simple fixes, and you can use both together.

### Fix 1: wait for ready-to-show

Create the window hidden, and show it when the page has drawn its first frame:

```javascript
// main.js
const win = new BrowserWindow({
  width: 800,
  height: 600,
  show: false, // create it hidden
});

win.once('ready-to-show', () => {
  win.show();
});

win.loadFile('index.html');
```

- `show: false` creates the window without displaying it.
- The `ready-to-show` event fires once the page has been drawn, so showing it then gives a clean appearance.
- `once` (instead of `on`) means "listen for this event only one time". We only need to show the window the first time, so `once` keeps things tidy.

### Fix 2: set a background colour

Give the window the same background colour as your page:

```javascript
// main.js
const win = new BrowserWindow({
  width: 800,
  height: 600,
  backgroundColor: '#1e1e1e',
});
```

Now, even before the page draws, the window is dark instead of white. The default background is white (`#FFF`).

> **Tip:** For a page that loads very slowly (for example, one that fetches data first), a `backgroundColor` is often nicer than `ready-to-show`. The user sees the window immediately in the right colour, instead of waiting with nothing on screen.

## Controlling a window from code

Your `win` object has methods for everything a user can do with a window, and more:

| Method | What it does |
| --- | --- |
| `win.show()` / `win.hide()` | Show or hide the window |
| `win.focus()` | Bring it to the front and give it keyboard focus |
| `win.minimize()` | Minimize to the taskbar or Dock |
| `win.maximize()` / `win.unmaximize()` | Fill the screen, or go back |
| `win.restore()` | Restore from minimized |
| `win.setFullScreen(true)` | Go full screen |
| `win.center()` | Move to the middle of the screen |
| `win.close()` | Close, as if the user clicked the close button |
| `win.destroy()` | Close immediately, skipping the `close` event |

And methods that ask questions:

| Method | Returns |
| --- | --- |
| `win.isVisible()` | `true` if shown |
| `win.isFocused()` | `true` if it has keyboard focus |
| `win.isMaximized()` / `win.isMinimized()` | `true` or `false` |
| `win.getTitle()` | The current title text |
| `win.isDestroyed()` | `true` if the window has been closed and is gone |

Try a few in `main.js`:

```javascript
// main.js
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 800, height: 600 });
  await win.loadFile('index.html');

  console.log('Title:', win.getTitle());
  console.log('Maximized?', win.isMaximized());

  setTimeout(() => win.maximize(), 2000); // after 2 seconds, fill the screen
});
```

## Listening to window events

Windows emit events when things happen to them. Listen with `win.on(...)`:

| Event | Fires when |
| --- | --- |
| `ready-to-show` | The page has drawn and the window can be shown |
| `focus` / `blur` | The window gains or loses keyboard focus |
| `show` / `hide` | The window is shown or hidden |
| `maximize` / `unmaximize` | The window is maximized or goes back |
| `minimize` / `restore` | The window is minimized or restored |
| `resize` / `move` | The window is being resized or moved |
| `close` | The window is **about to** close (can be cancelled) |
| `closed` | The window **has** closed |

Here is a window that puts its focus state in the title bar:

```javascript
// main.js
win.on('focus', () => win.setTitle('My App (active)'));
win.on('blur', () => win.setTitle('My App (in the background)'));
```

Click another app, then click back. The title changes each time.

> **Note:** The page's `<title>` tag also sets the window title, and it wins whenever the page loads or changes its title. Set titles from code after the page has loaded, or see [Window Options](/courses/electronjs/window-options) for how to stop the page from changing it.

## Asking before closing

The `close` event fires **before** the window closes. Calling `event.preventDefault()` cancels the close. This is how apps ask "Do you want to close without saving?":

```javascript
// main.js
const { dialog } = require('electron');

let hasUnsavedChanges = true; // in a real app, the page would tell main this

win.on('close', (event) => {
  if (!hasUnsavedChanges) return; // nothing to lose: let it close

  const choice = dialog.showMessageBoxSync(win, {
    type: 'question',
    buttons: ['Close anyway', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: 'You have unsaved changes. Close anyway?',
  });

  if (choice === 1) {
    event.preventDefault(); // the user picked "Cancel": keep the window open
  }
});
```

`dialog.showMessageBoxSync` shows a native message box and returns the **index** of the button the user clicked: `0` for "Close anyway", `1` for "Cancel". You will learn all about dialogs in [Native Dialogs: Open, Save and Message Boxes](/courses/electronjs/native-dialogs).

## Keeping a reference to your window

Often other parts of `main.js` need to reach the main window, for example a menu item that sends it a message. Store the window in a variable outside the function:

```javascript
// main.js
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({ width: 800, height: 600 });
  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null; // the window is gone: forget it
  });
}
```

Setting it back to `null` in `closed` matters. Once a window is closed, its object is **destroyed**, and calling any method on it throws an error:

```text
TypeError: Object has been destroyed
```

When you are not sure, check first:

```javascript
// main.js
if (mainWindow && !mainWindow.isDestroyed()) {
  mainWindow.focus();
}
```

## Finding windows

Electron also has **static** methods, called on `BrowserWindow` itself rather than on one window:

```javascript
// main.js
BrowserWindow.getAllWindows();     // an array of every open window
BrowserWindow.getFocusedWindow();  // the window with focus, or null
BrowserWindow.fromId(1);           // the window with this id, or null
```

Every window also has a numeric `win.id`, unique while the app runs. And `BrowserWindow.fromWebContents(webContents)` finds the window that holds a given page, which you will use with IPC to work out which window sent a message.

You can open as many windows as you like by calling `createWindow()` again. [Working with Multiple Windows](/courses/electronjs/multiple-windows) shows how to manage them well.

## Common mistakes

### "Object has been destroyed"

You called a method on a window after it closed. Set your variable to `null` in the `closed` event, and check `!win.isDestroyed()` before using a window that might be gone.

### The window never appears

You created it with `show: false` but forgot to call `win.show()` (or the `ready-to-show` listener was added with a typo in the event name). Check both.

### A window that will not close (and an app that will not quit)

If your `close` handler always calls `event.preventDefault()`, the user cannot close the window, and `app.quit()` cannot close it either. Only prevent the close when you really need to, and let it through otherwise.

### Setting the title too early

`win.setTitle('My App')` before `loadFile()` gets overwritten by the page's `<title>`. Set the title in the HTML, or after the page has loaded.

## Quick recap

- `new BrowserWindow(options)` creates a window, after the app is ready.
- `win` controls the frame. `win.webContents` controls the page inside it.
- `loadFile()` and `loadURL()` return Promises. Catch them to see loading errors.
- Avoid a white flash with `show: false` plus `ready-to-show`, and with `backgroundColor`.
- Control windows with methods like `show`, `focus`, `maximize`, `minimize`, `center` and `close`.
- Listen to `focus`, `blur`, `resize`, `close` and `closed`. `event.preventDefault()` in `close` cancels it.
- Keep a reference in a variable, set it to `null` on `closed`, and check `isDestroyed()`.
- `BrowserWindow.getAllWindows()`, `getFocusedWindow()` and `fromId()` find windows.

<code id="code-content" class="language-javascript">
// main.js: create, show, watch and safely close a window
const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
let mainWindow = null; // a reference other code can use
let hasUnsavedChanges = false; // pretend the page reports this
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    show: false, // hidden until the page has drawn
    backgroundColor: '#1e1e1e', // no white flash on a dark page
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  // --- Show it cleanly, once the first frame is ready
  mainWindow.once('ready-to-show', () =&gt; mainWindow.show());
  // --- React to the user
  mainWindow.on('focus', () =&gt; console.log('focused'));
  mainWindow.on('blur', () =&gt; console.log('in the background'));
  mainWindow.on('maximize', () =&gt; console.log('maximized'));
  // --- Ask before closing if there is unsaved work
  mainWindow.on('close', (event) =&gt; {
    if (!hasUnsavedChanges) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Close anyway', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'You have unsaved changes. Close anyway?',
    });
    if (choice === 1) event.preventDefault();
  });
  // --- Forget the window once it is gone
  mainWindow.on('closed', () =&gt; { mainWindow = null; });
  mainWindow.loadFile('index.html').catch((error) =&gt; {
    console.error('Could not load the page:', error.message);
  });
}
app.whenReady().then(() =&gt; {
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow &amp;&amp; !mainWindow.isDestroyed()) mainWindow.focus();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

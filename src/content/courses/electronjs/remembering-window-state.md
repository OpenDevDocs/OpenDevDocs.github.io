---
publishDate: 2026-10-25T12:13
title: Remembering Window Size and Position
slug: remembering-window-state
metadescription: Save your Electron window's size, position and maximised state to a JSON file and restore it safely, even when a monitor has been unplugged.
updateDate: 2026-10-25T12:13
author: ['bishal-biswas']
level: 2
tags: ['browserwindow', 'screen', 'user-data']
course: electronjs
---

## Why this matters

Open your app, make the window bigger, drag it to the right side of the screen, and quit. Start it again. The window jumps back to 800 by 600 in the middle of the screen.

Users notice this. Good desktop apps open exactly where you left them. In this lesson you will add that feature with nothing but Node's built-in `fs` module and Electron's `screen` module. No extra packages.

Think of it like a bookmark. When you close a book you leave a bookmark at your page. When you open it again, you go straight to the bookmark. But if someone tore that page out (an unplugged monitor), you sensibly start from somewhere you can actually read.

This lesson assumes you know the window options from [Window Options: Size, Position, Title and Icon](/courses/electronjs/window-options).

## The plan

1. When the window closes, write its size, position and maximised state to a small JSON file.
2. When the app starts, read that file.
3. Check the saved position is still on a screen that exists.
4. Create the window with those values.

## Where to save the file

Every Electron app gets a private folder for its own data, called **userData**. You get its path with `app.getPath('userData')`:

| System | Typical userData folder |
| --- | --- |
| Windows | `C:\Users\<you>\AppData\Roaming\<app name>` |
| macOS | `~/Library/Application Support/<app name>` |
| Linux | `~/.config/<app name>` |

The app name comes from `productName` or `name` in your `package.json`. Never save into your project folder or next to the app's own files: once the app is installed, that folder can be read-only. [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data) covers all the folders in detail.

> **Note:** `app.getPath()` works best after the app is ready. Call it inside your functions, not at the very top of `main.js`.

## Step 1: read and write the state file

Add these helpers to `main.js`:

```javascript
// main.js
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STATE = { width: 1000, height: 700, isMaximized: false };

function stateFilePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readState() {
  try {
    const saved = JSON.parse(fs.readFileSync(stateFilePath(), 'utf8'));
    return { ...DEFAULT_STATE, ...saved };
  } catch {
    // No file yet (first run) or the file is broken: use the defaults.
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  const file = stateFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write to a temporary file first, then rename it over the real one.
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, file);
}
```

Line by line:

- `readFileSync` reads the file, and `JSON.parse` turns the text into an object.
- The `try ... catch` matters. On the very first run there is no file, so `readFileSync` throws. A half-written or hand-edited file makes `JSON.parse` throw. Either way you fall back to the defaults instead of crashing.
- `{ ...DEFAULT_STATE, ...saved }` starts from the defaults and lets saved values replace them. If an older version of your app saved fewer fields, the missing ones still get sensible values.
- In `writeState`, writing to a `.tmp` file and then renaming it is a small safety trick. Renaming is close to instant, so if the computer loses power halfway through writing, the real file is still the old, complete version.

Why the synchronous (`Sync`) versions? You will save while the window is closing and the app may be about to quit. A synchronous write finishes before the next line runs, so the data is safely on disk before the process exits. The file is tiny, so the short pause is not noticeable.

## Step 2: save when the window closes

Electron gives you a few useful pieces of information about a window:

- `win.getNormalBounds()` returns `{ x, y, width, height }` for the window's **normal** size, even if it is currently maximised, minimised or full screen. That is what you want to remember.
- `win.isMaximized()` and `win.isFullScreen()` tell you the current mode.

```javascript
// main.js
function saveWindowState(win) {
  if (win.isDestroyed()) return;
  writeState({
    ...win.getNormalBounds(),
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  });
}
```

Why not `getBounds()`? If the user maximises the window and quits, `getBounds()` returns the size of the whole screen. Next time the window would open huge but not actually maximised. Saving the normal bounds plus an `isMaximized` flag restores both: the maximised window now, and the right size when the user un-maximises it later.

Now hook it to the window's `close` event. `close` fires just **before** the window is destroyed, while you can still ask it questions. (By `closed`, it is too late.)

```javascript
win.on('close', () => saveWindowState(win));
```

### Also save while the user works

If the app crashes or the computer shuts down, `close` never fires. To be safe, also save shortly after the user stops moving or resizing:

```javascript
let saveTimer;
const saveSoon = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveWindowState(win), 500);
};

win.on('resize', saveSoon);
win.on('move', saveSoon);
win.on('close', () => {
  clearTimeout(saveTimer);
  saveWindowState(win);
});
```

`resize` and `move` fire many times per second during a drag. This pattern, called **debouncing**, waits until things have been quiet for half a second and then saves once.

## Step 3: handle a monitor that is gone

Here is a real bug many apps ship with. A user works with a laptop and a second monitor, drags your window onto the second monitor, and quits. The next day they open your app without the monitor attached. Your app happily restores the window at `x: 2400`, which is now off the edge of the only screen. The app is "running" but invisible.

Electron's `screen` module knows about every connected display:

```javascript
const displays = screen.getAllDisplays();
// Each display has:
//   bounds   - the whole screen, e.g. { x: 0, y: 0, width: 1920, height: 1080 }
//   workArea - the usable part, without the taskbar, Dock or menu bar
```

Coordinates are shared across monitors. A second monitor to the right of a 1920-pixel-wide main screen starts at `x: 1920`. A monitor on the left can have negative `x` values.

Write a function that checks whether enough of the saved window would be visible on **some** display:

```javascript
// main.js
function isVisibleOnSomeDisplay(bounds) {
  return screen.getAllDisplays().some(({ workArea }) => {
    const overlapWidth =
      Math.min(bounds.x + bounds.width, workArea.x + workArea.width) - Math.max(bounds.x, workArea.x);
    const overlapHeight =
      Math.min(bounds.y + bounds.height, workArea.y + workArea.height) - Math.max(bounds.y, workArea.y);
    // Require a decent piece of the window, so the user can grab it.
    return overlapWidth >= 100 && overlapHeight >= 50;
  });
}
```

The maths works out how much the window and the display's work area overlap, side to side and top to bottom. If at least 100 by 50 pixels of the window would be on screen, the user can see it and drag it back.

Now combine everything into one function that turns the saved state into safe window options:

```javascript
// main.js
function safeBounds(state) {
  const isNumber = (n) => typeof n === 'number' && Number.isFinite(n);
  const { workArea } = screen.getPrimaryDisplay();

  // Never bigger than the main screen.
  const width = Math.min(isNumber(state.width) ? state.width : DEFAULT_STATE.width, workArea.width);
  const height = Math.min(isNumber(state.height) ? state.height : DEFAULT_STATE.height, workArea.height);

  const bounds = { width, height };
  if (isNumber(state.x) && isNumber(state.y)) {
    const candidate = { x: state.x, y: state.y, width, height };
    if (isVisibleOnSomeDisplay(candidate)) {
      bounds.x = state.x;
      bounds.y = state.y;
    }
  }
  // No x and y means Electron centres the window.
  return bounds;
}
```

If the saved position is no good, you just leave out `x` and `y`. Electron then centres the window, which is exactly the friendly fallback you want. The `isNumber` checks protect you from a damaged file with text or `null` where numbers should be.

> **Warning:** The `screen` module can only be used after the app's `ready` event. Calling `screen.getAllDisplays()` at the top of `main.js` throws an error. Inside `createWindow()`, which runs after `whenReady()`, it is fine.

## Step 4: create the window from the saved state

```javascript
// main.js
function createWindow() {
  const state = readState();

  const win = new BrowserWindow({
    ...safeBounds(state),
    minWidth: 400,
    minHeight: 300,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (state.isMaximized) win.maximize();
  if (state.isFullScreen) win.setFullScreen(true);

  win.once('ready-to-show', () => win.show());
  win.loadFile('index.html');

  // ...the save code from Step 2 goes here...
}
```

`show: false` keeps the window hidden while you maximise it, so the user does not see it jump from normal size to maximised.

Try it:

1. Run `npm start`.
2. Resize the window and move it somewhere unusual. Quit.
3. Run `npm start` again. The window comes back in the same place.
4. Maximise it and quit. Start again: it opens maximised. Un-maximise it and it returns to your earlier size.

Want to see the file? Open your userData folder. You will find `window-state.json`:

```json
{
  "x": 312,
  "y": 140,
  "width": 1180,
  "height": 760,
  "isMaximized": false,
  "isFullScreen": false
}
```

To test the missing-monitor case without a second screen, edit the file, set `"x": 50000`, and start the app. It should open centred instead of off-screen.

## What about the built-in option?

Recent Electron versions include an **experimental** option that does much of this for you: give the window a unique `name` and set `windowStatePersistence: true`. Because it is still experimental and may change, this course uses the hand-written version, which you fully understand and control. Writing it yourself also teaches you `userData`, safe file writing and the `screen` module, all of which you will use again.

## Several windows

If your app has more than one window type (see [Working with Multiple Windows](/courses/electronjs/multiple-windows)), give each one its own key in the JSON file:

```json
{
  "main": { "x": 312, "y": 140, "width": 1180, "height": 760, "isMaximized": false },
  "settings": { "x": 500, "y": 200, "width": 420, "height": 360, "isMaximized": false }
}
```

Read the whole file once, look up the entry for the window you are creating, and update only that entry when saving.

## Common mistakes

### Saving `getBounds()` instead of `getNormalBounds()`

A maximised window then reopens as a giant normal window. Save the normal bounds and a separate `isMaximized` flag.

### Saving in the `closed` event

```text
TypeError: Object has been destroyed
```

By the time `closed` fires, the window is gone and you cannot read its size. Use `close`.

### Trusting the saved position blindly

Monitors get unplugged, resolutions change, and laptops move between desks. Always check the position against `screen.getAllDisplays()` before using it.

### Crashing on a broken file

If `JSON.parse` is not inside `try ... catch`, one bad file stops your app from ever starting. Always fall back to defaults.

## Quick recap

- Save window state to a JSON file in `app.getPath('userData')`, the app's private data folder.
- Use `getNormalBounds()` for the size and position, plus `isMaximized()` and `isFullScreen()` flags.
- Save in the `close` event (not `closed`) and, debounced, on `resize` and `move`.
- Write to a temporary file and rename it, so a crash never leaves a half-written file.
- Wrap reading in `try ... catch` and validate every number.
- Use `screen.getAllDisplays()` and each display's `workArea` to make sure the window will be visible. If not, leave out `x` and `y` so Electron centres it.
- `screen` only works after the app is ready.

<code id="code-content" class="language-javascript">
// main.js: remember the window's size, position and maximised state
const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const DEFAULT_STATE = { width: 1000, height: 700, isMaximized: false };
const stateFilePath = () =&gt; path.join(app.getPath('userData'), 'window-state.json');
// --- Reading and writing the JSON file
function readState() {
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(stateFilePath(), 'utf8')) };
  } catch {
    return { ...DEFAULT_STATE }; // first run or broken file
  }
}
function writeState(state) {
  const file = stateFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2));
  fs.renameSync(`${file}.tmp`, file); // swap in the finished file
}
// --- Make sure the saved position is on a screen that still exists
function isVisibleOnSomeDisplay(b) {
  return screen.getAllDisplays().some(({ workArea: a }) =&gt; {
    const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
    const h = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
    return w &gt;= 100 &amp;&amp; h &gt;= 50;
  });
}
function safeBounds(state) {
  const isNumber = (n) =&gt; typeof n === 'number' &amp;&amp; Number.isFinite(n);
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(isNumber(state.width) ? state.width : DEFAULT_STATE.width, workArea.width);
  const height = Math.min(isNumber(state.height) ? state.height : DEFAULT_STATE.height, workArea.height);
  const bounds = { width, height };
  if (isNumber(state.x) &amp;&amp; isNumber(state.y) &amp;&amp; isVisibleOnSomeDisplay({ x: state.x, y: state.y, width, height })) {
    bounds.x = state.x;
    bounds.y = state.y;
  }
  return bounds; // no x/y means "centre the window"
}
// --- The window
function createWindow() {
  const state = readState();
  const win = new BrowserWindow({
    ...safeBounds(state),
    minWidth: 400, minHeight: 300, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  if (state.isMaximized) win.maximize();
  if (state.isFullScreen) win.setFullScreen(true);
  win.once('ready-to-show', () =&gt; win.show());
  win.loadFile('index.html');
  const save = () =&gt; {
    if (win.isDestroyed()) return;
    writeState({ ...win.getNormalBounds(), isMaximized: win.isMaximized(), isFullScreen: win.isFullScreen() });
  };
  let timer;
  const saveSoon = () =&gt; { clearTimeout(timer); timer = setTimeout(save, 500); };
  win.on('resize', saveSoon);
  win.on('move', saveSoon);
  win.on('close', () =&gt; { clearTimeout(timer); save(); }); // close, not closed
}
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

---
publishDate: 2026-10-25T12:07
title: 'The App Lifecycle: ready, window-all-closed and activate'
slug: app-lifecycle
metadescription: Follow an Electron app from start to quit with ready, whenReady, window-all-closed, activate, before-quit and will-quit, on Windows, macOS and Linux.
updateDate: 2026-10-25T12:07
author: ['bishal-biswas']
level: 1
tags: ['app', 'lifecycle', 'events']
course: electronjs
---

## Every app has a day

An Electron app starts, opens windows, waits for the user, and eventually quits. Electron tells you about each step with **events**: named signals that say "this just happened". Your code listens for them with `app.on('event-name', ...)`.

Picture a small shop:

- In the morning the shopkeeper unlocks the door. Until then, nobody can come in. That is the **ready** event: until it fires, you cannot open windows.
- During the day, customers come and go. Those are your windows.
- When the last customer leaves, a shop in most towns closes for the day. That is **window-all-closed** on Windows and Linux.
- But some shopkeepers (macOS apps) stay inside with the lights on after the last customer leaves. If someone knocks, they open up again. That knock is **activate**.
- At closing time there is a routine: announce closing (**before-quit**), lock up (**will-quit**), go home (**quit**).

In [Your First Electron App](/courses/electronjs/your-first-electron-app) you copied a block of lifecycle code. In this lesson you will understand every line of it.

## The standard lifecycle block

Here it is again:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

Three events do all the work: **ready**, **activate** and **window-all-closed**. Let us take them one at a time.

## ready: Electron has finished starting up

When you run `npm start`, Electron loads `main.js` and runs the top-level code straight away. At that moment Electron itself is still starting: Chromium is not set up yet, so you cannot create windows.

Try it:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');

console.log('Ready yet?', app.isReady());
new BrowserWindow({ width: 800, height: 600 });
```

```text
Ready yet? false
Error: Cannot create BrowserWindow before app is ready
```

When start-up is done, Electron emits the **ready** event. There are two ways to wait for it.

### app.whenReady() (recommended)

```javascript
// main.js
app.whenReady().then(() => {
  console.log('Ready yet?', app.isReady()); // true
  createWindow();
});
```

`app.whenReady()` returns a **Promise** that is fulfilled once Electron is ready. If Electron is already ready when you call it, the Promise is fulfilled straight away, so your code still runs. That makes it the safest choice. You can also use it with `async` and `await`:

```javascript
// main.js
async function start() {
  await app.whenReady();
  createWindow();
}

start();
```

### app.on('ready')

```javascript
// main.js
app.on('ready', () => {
  createWindow();
});
```

This works too, and you will see it in older code. The difference: if you register the listener **after** the event already fired, it never runs. `whenReady()` does not have that problem.

> **Note:** A few settings must be made **before** ready, in the top-level code of `main.js`. For example, registering custom URL schemes ([Custom Protocols with protocol.handle](/courses/electronjs/custom-protocols)) and asking for a single-instance lock ([Single Instance Lock and Deep Links](/courses/electronjs/single-instance-and-deep-links)). Most other things belong after ready.

## window-all-closed: the last window just closed

When the user closes your last window, Electron emits **window-all-closed**. What happens next depends on whether you listen for it.

- **If you do not listen for it**, Electron quits the app automatically.
- **If you do listen for it**, Electron does nothing on its own. You decide.

That is why the standard block listens and then decides by operating system:

```javascript
// main.js
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- On **Windows** (`'win32'`) and **Linux** (`'linux'`), users expect an app to quit when its last window closes. So we call `app.quit()`.
- On **macOS** (`'darwin'`), apps usually keep running. The app stays in the Dock and its menu stays in the menu bar, until the user quits with **Cmd + Q** or the app menu's **Quit** item. So we do nothing.

> **Tip:** Some apps should keep running on every system, for example an app that lives in the system tray. Then you listen for `window-all-closed` and simply do not quit. You will build one in [System Tray Icons](/courses/electronjs/system-tray).

## activate: someone knocked (macOS)

On macOS, after the last window closes, the app is still running with no windows. If the user clicks its Dock icon, nothing would happen, which feels broken. The **activate** event fixes this.

```javascript
// main.js
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
```

- `activate` fires when the app is activated: for example, when the user clicks the Dock icon, or launches the app again while it is already running.
- `BrowserWindow.getAllWindows()` returns an array of all open windows. If it is empty, we create a new one.
- The check matters: `activate` also fires when windows are already open, for example when the user clicks the Dock icon while a window is hidden behind other apps. Without the check you would get an extra window every time.

`activate` is a **macOS-only** event. On Windows and Linux it never fires, so this code is harmless there.

Why put it inside `whenReady().then(...)`? Because creating a window needs Electron to be ready. Registering the listener there guarantees that.

## Quitting: before-quit, will-quit and quit

When the app quits, Electron emits three more events, in this order:

| Event | When | Can you cancel? |
| --- | --- | --- |
| `before-quit` | Quitting has started, before windows are closed | Yes, with `event.preventDefault()` |
| `will-quit` | All windows are closed, the app is about to exit | Yes, with `event.preventDefault()` |
| `quit` | The app is exiting | No |

Here is a little logger so you can watch them:

```javascript
// main.js
app.on('before-quit', () => console.log('before-quit'));
app.on('will-quit', () => console.log('will-quit'));
app.on('quit', (event, exitCode) => console.log('quit with code', exitCode));
```

### Two ways the app ends

**1. The user closes the last window** (on Windows or Linux, with the standard block):

```text
window-all-closed
before-quit
will-quit
quit with code 0
```

The window closes first, then `window-all-closed` runs, our code calls `app.quit()`, and the quit events follow.

**2. Something calls `app.quit()` while windows are open** (for example **Cmd + Q** on macOS, or a **Quit** menu item):

```text
before-quit
will-quit
quit with code 0
```

Notice **no** `window-all-closed` here. When the app is quitting on purpose, Electron closes the windows itself and skips that event. This is why "save before closing" code should not live in `window-all-closed`.

### Doing something before quitting

`before-quit` is a good place for quick clean-up, like writing a small settings file:

```javascript
// main.js
const fs = require('fs');
const path = require('path');

app.on('before-quit', () => {
  const file = path.join(app.getPath('userData'), 'last-run.txt');
  fs.writeFileSync(file, new Date().toISOString());
});
```

`app.getPath('userData')` is a folder Electron gives your app for its own files. You will learn about it in [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data).

Keep this code short and **synchronous** (the `Sync` version of a function). If you start slow `async` work here, the app may finish quitting before it completes.

> **Warning:** On Windows, `before-quit`, `will-quit` and `quit` are not emitted when the app is closed because the computer is shutting down, restarting or the user is logging out. Do not rely on them as the only place you save important work. Save as you go.

### app.quit() and app.exit()

- `app.quit()` asks politely. It emits `before-quit`, closes every window (pages can still run their `beforeunload` handlers), emits `will-quit`, then quits.
- `app.exit(code)` leaves immediately. Windows are closed without asking, and `before-quit` and `will-quit` are **not** emitted. Use it only when something has gone badly wrong.

## The whole timeline

Putting it together, here is a full run on Windows: start the app, then close its window.

```text
main.js top-level code runs
ready
(window opens; the user works; the user closes the window)
window-all-closed
before-quit
will-quit
quit
```

And on macOS: start the app, close the window, click the Dock icon, then press Cmd + Q.

```text
main.js top-level code runs
ready
(window closes: window-all-closed fires, but we do not quit)
activate            <- Dock icon clicked: no windows, so we create one
before-quit         <- Cmd + Q
will-quit
quit
```

## Common mistakes

### Creating windows at the top of main.js

```text
Error: Cannot create BrowserWindow before app is ready
```

Move `new BrowserWindow(...)` into a function and call it from `app.whenReady().then(...)`.

### Quitting on macOS in window-all-closed

If you call `app.quit()` without the `process.platform !== 'darwin'` check, your app quits on macOS when the last window closes. It works, but it feels wrong to Mac users. Keep the check.

### Forgetting the getAllWindows() check in activate

Without `if (BrowserWindow.getAllWindows().length === 0)`, clicking the Dock icon can open a second, third or fourth window. Always check first.

### Slow async work in before-quit

```javascript
// main.js: don't do this
app.on('before-quit', async () => {
  await saveEverythingToTheCloud(); // the app may exit before this finishes
});
```

Electron does not wait for your Promise. Save data as the user works, and keep `before-quit` short and synchronous.

## Quick recap

- **ready** fires when Electron has started. Use `app.whenReady().then(...)` and create windows only after it.
- `app.isReady()` tells you if ready has already happened.
- **window-all-closed** fires when the last window closes. Listening for it means the app does not quit by itself; quit unless `process.platform === 'darwin'`.
- **activate** (macOS only) fires when the Dock icon is clicked. Create a window if `BrowserWindow.getAllWindows().length === 0`.
- Quitting emits **before-quit**, **will-quit** and **quit**, in that order. `app.quit()` skips `window-all-closed`.
- `app.exit()` exits at once, without `before-quit` or `will-quit`.

<code id="code-content" class="language-javascript">
// main.js: watch every lifecycle event in your terminal
const { app, BrowserWindow } = require('electron');
console.log('1. main.js runs. Ready yet?', app.isReady()); // false
function createWindow() {
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadFile('index.html');
  win.on('closed', () =&gt; console.log('   a window closed'));
}
// --- Start: Electron has finished starting up
app.whenReady().then(() =&gt; {
  console.log('2. ready. Ready yet?', app.isReady()); // true
  createWindow();
  // macOS: Dock icon clicked. Only make a window if none are open.
  app.on('activate', (event, hasVisibleWindows) =&gt; {
    console.log('   activate (macOS), visible windows:', hasVisibleWindows);
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
// --- The last window closed (not emitted when app.quit() closes them)
app.on('window-all-closed', () =&gt; {
  console.log('3. window-all-closed');
  if (process.platform !== 'darwin') app.quit(); // macOS apps stay open
});
// --- Quitting, in this order
app.on('before-quit', () =&gt; console.log('4. before-quit (can be cancelled)'));
app.on('will-quit', () =&gt; console.log('5. will-quit (all windows closed)'));
app.on('quit', (event, exitCode) =&gt; console.log('6. quit with code', exitCode));
</code></pre>

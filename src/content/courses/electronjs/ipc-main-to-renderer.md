---
publishDate: 2026-10-25T12:18
title: 'IPC Part 3: Sending Messages to a Window'
slug: ipc-main-to-renderer
metadescription: Push messages from Electron's main process to a window with webContents.send, listen safely in the preload, and clean up listeners when you are done.
updateDate: 2026-10-25T12:18
author: ['bishal-biswas']
level: 2
tags: ['ipc', 'webcontents', 'events']
course: electronjs
---

## When the main process has news

So far the page has always started the conversation: it sent a message ([IPC Part 1](/courses/electronjs/ipc-send-to-main)) or asked a question ([IPC Part 2](/courses/electronjs/ipc-invoke-and-handle)).

Sometimes the main process has news the page did not ask for:

- The user picked **View, Zoom In** from the app menu.
- A long download is 40% done, then 50%, then 60%.
- The system switched to dark mode.
- A second window changed a setting, and this window should update.

For that, the main process **pushes** a message to a window. In the hotel picture from earlier lessons, this is the back office phoning the front desk, and the front desk passing a note to the guest: "Your taxi is here."

## The shape of main-to-renderer messages

```text
main.js                              preload.js                                   renderer.js

win.webContents.send(           ipcRenderer.on('backup:progress',           window.electronAPI
  'backup:progress', 40)  ---->   (event, percent) => callback(percent))  ---->  .onBackupProgress(cb)
```

- **main.js** calls `webContents.send(channel, ...args)` on the window it wants to reach.
- **preload.js** listens with `ipcRenderer.on(channel, listener)` and passes **only the data** to a callback the page gave it.
- **renderer.js** registers that callback through a function like `onBackupProgress(callback)`.

`webContents` is the part of a `BrowserWindow` that holds the web page. Every window has one at `win.webContents`.

## Step 1: a ticking clock from the main process

Start with something that runs on its own. The main process sends the current time to the window once a second.

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');

  const timer = setInterval(() => {
    win.webContents.send('clock:tick', new Date().toLocaleTimeString());
  }, 1000);

  win.on('closed', () => clearInterval(timer));
}
```

Stopping the timer when the window closes is important. Otherwise the timer keeps trying to talk to a window that no longer exists, and you get "Object has been destroyed" errors.

Now the preload:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onClockTick: (callback) => {
    ipcRenderer.on('clock:tick', (_event, time) => callback(time));
  },
});
```

Read that wrapper carefully, because it is the heart of this lesson:

- The page passes in its own function, `callback`.
- The preload registers its **own** listener with `ipcRenderer.on`.
- When a message arrives, the preload's listener calls `callback(time)` with **only the data**. The `event` object stays behind in the preload. (`_event` starts with an underscore as a hint that it is deliberately unused.)

Finally the page:

```html
<!-- index.html (inside body) -->
<h1 id="clock">--:--:--</h1>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
window.electronAPI.onClockTick((time) => {
  document.getElementById('clock').textContent = time;
});
```

Run `npm start`. The heading updates every second with the time, sent by the main process.

### Why not pass the event to the page?

It is tempting to write `ipcRenderer.on('clock:tick', callback)` and hand the page everything. Don't. The first argument would be the `event` object, and `event.sender` is the `ipcRenderer` itself. You would be giving the page the full phone line again, which undoes the protection from [Context Isolation and contextBridge](/courses/electronjs/context-isolation-and-contextbridge). Always wrap the callback and pass only the data.

## Step 2: replying to the window that asked

A common pattern mixes directions: the page starts a job, and the main process reports progress back to **that same window**.

Here is a pretend backup that takes a few seconds:

```javascript
// main.js
const { ipcMain } = require('electron');

ipcMain.on('backup:start', (event) => {
  const contents = event.sender; // the page that asked
  let percent = 0;

  const timer = setInterval(() => {
    if (contents.isDestroyed()) {
      clearInterval(timer); // the window closed mid-backup
      return;
    }
    percent += 10;
    contents.send('backup:progress', percent);

    if (percent >= 100) {
      clearInterval(timer);
      contents.send('backup:done', { files: 128 });
    }
  }, 300);
});
```

`event.sender` is the `webContents` of the page that sent `backup:start`. Sending to it means the progress goes back to the right window, even if several windows are open. `contents.isDestroyed()` checks whether the page is still there before each send.

> **Tip:** For a message that answers an `ipcMain.on` message, `event.reply(channel, ...args)` is a shortcut that sends to the exact frame that asked. `event.sender.send(...)` works too, as above.

The preload exposes a starter and two listeners:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startBackup: () => ipcRenderer.send('backup:start'),

  onBackupProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    ipcRenderer.on('backup:progress', listener);
    return () => ipcRenderer.removeListener('backup:progress', listener);
  },

  onBackupDone: (callback) => {
    const listener = (_event, summary) => callback(summary);
    ipcRenderer.on('backup:done', listener);
    return () => ipcRenderer.removeListener('backup:done', listener);
  },
});
```

Notice that each `on...` function now **returns a function**. Calling that returned function removes the listener again. This is called an **unsubscribe** function. You will see why it matters in a moment.

```html
<!-- index.html (inside body) -->
<button id="backup">Start backup</button>
<progress id="bar" max="100" value="0"></progress>
<p id="result"></p>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
const bar = document.getElementById('bar');
const result = document.getElementById('result');

const stopProgress = window.electronAPI.onBackupProgress((percent) => {
  bar.value = percent;
});

const stopDone = window.electronAPI.onBackupDone((summary) => {
  result.textContent = `Backup finished: ${summary.files} files.`;
});

document.getElementById('backup').addEventListener('click', () => {
  result.textContent = '';
  bar.value = 0;
  window.electronAPI.startBackup();
});
```

Click **Start backup**. The progress bar fills up in steps of 10, and then the message appears.

## Cleaning up listeners

Every call to `onBackupProgress` adds **another** listener. In a simple page that runs once, that is fine. But in apps where parts of the page come and go (React and Vue components, tabs, dialogs), the same code can run many times. Each run adds a listener, and none are removed. Soon one message triggers the callback five times, and Node prints a warning about a possible memory leak.

The unsubscribe function fixes this:

```javascript
// renderer.js
const stopProgress = window.electronAPI.onBackupProgress(updateBar);

// later, when this part of the page goes away:
stopProgress();
```

In React, for example, you call it in the cleanup of a `useEffect`. [Using React or Vue with Electron](/courses/electronjs/using-react-or-vue) shows this.

> **Warning:** Avoid `ipcRenderer.removeAllListeners(channel)` in preload functions you expose. It also removes listeners that other parts of your app added. Removing exactly your own listener, as above, is safer.

## Timing: is anyone listening yet?

Messages are not stored. If the main process sends before the page has registered its listener, the message is simply lost.

This goes wrong most often right after creating a window:

```javascript
// main.js: TOO EARLY
win.loadFile('index.html');
win.webContents.send('settings:loaded', settings); // page is not ready yet: lost
```

Wait until the page has finished loading:

```javascript
// main.js
win.loadFile('index.html');
win.webContents.once('did-finish-load', () => {
  win.webContents.send('settings:loaded', settings);
});
```

`did-finish-load` fires after the page and its scripts have loaded, so `renderer.js` has registered its listeners by then.

Often, though, the cleaner fix is to flip the direction: let the page **ask** for its starting data with `invoke` when it is ready, and use `send` only for later updates.

## Sending to every window

Some news is for everyone, such as a theme change. Loop over all windows:

```javascript
// main.js
function broadcast(channel, ...args) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args);
  }
}

broadcast('theme:changed', 'dark');
```

This is also how one window talks to another: window A sends a message to main, and main sends it on to window B (or to everyone). See [Working with Multiple Windows](/courses/electronjs/multiple-windows) for keeping track of windows, and [MessagePorts for Direct Communication](/courses/electronjs/message-ports) for a direct line between windows.

## Common mistakes

### Passing the raw event to the page

`onTick: (callback) => ipcRenderer.on('clock:tick', callback)` leaks `event.sender` (the `ipcRenderer`) to the page. Wrap it: `(_event, data) => callback(data)`.

### Sending before the page is ready

Messages sent straight after `loadFile` are lost. Wait for `did-finish-load`, or let the page ask with `invoke`.

### Forgetting to stop timers

A `setInterval` that keeps sending after its window closed throws "Object has been destroyed". Clear timers in the window's `closed` event, or check `isDestroyed()` before sending.

### Piling up listeners

Calling an `on...` function every time a component appears, without unsubscribing, makes callbacks run several times. Return an unsubscribe function from the preload and call it.

## Quick recap

- The main process pushes messages with `win.webContents.send(channel, ...args)`.
- The preload listens with `ipcRenderer.on(channel, listener)` and calls the page's callback with **only the data**, never the `event`.
- Return an unsubscribe function from each `on...` helper, built with `ipcRenderer.removeListener`.
- `event.sender` (or `event.reply`) sends progress back to the window that started a job.
- Messages are not queued: wait for `did-finish-load`, or let the page ask for initial data with `invoke`.
- Stop timers when windows close and check `isDestroyed()` before sending.
- Loop over `BrowserWindow.getAllWindows()` to broadcast to every window.

<code id="code-content" class="language-javascript">
// main.js: pushing messages from the main process to windows
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
// --- A job started by the page; progress goes back to the window that asked
ipcMain.on('backup:start', (event) =&gt; {
  const contents = event.sender;
  let percent = 0;
  const timer = setInterval(() =&gt; {
    if (contents.isDestroyed()) return clearInterval(timer); // window closed mid-job
    percent += 10;
    contents.send('backup:progress', percent);
    if (percent &gt;= 100) {
      clearInterval(timer);
      contents.send('backup:done', { files: 128 });
    }
  }, 300);
});
// --- Send to every open window
function broadcast(channel, ...args) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args);
}
// --- preload.js: hand the page the data only, and return an unsubscribe function
//   onBackupProgress: (callback) =&gt; {
//     const listener = (_event, percent) =&gt; callback(percent);
//     ipcRenderer.on('backup:progress', listener);
//     return () =&gt; ipcRenderer.removeListener('backup:progress', listener);
//   },
// --- The window: a clock ticking from the main process
function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
  // Wait until the page is ready before the first message
  win.webContents.once('did-finish-load', () =&gt; broadcast('app:ready', app.getVersion()));
  const timer = setInterval(() =&gt; {
    win.webContents.send('clock:tick', new Date().toLocaleTimeString());
  }, 1000);
  win.on('closed', () =&gt; clearInterval(timer)); // stop talking to a closed window
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

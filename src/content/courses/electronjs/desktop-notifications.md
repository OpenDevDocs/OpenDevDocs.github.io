---
publishDate: 2026-10-25T12:25
title: Desktop Notifications
slug: desktop-notifications
metadescription: Show desktop notifications in Electron with the web Notification API or the main-process Notification class, handle clicks, and fix Windows and macOS quirks.
updateDate: 2026-10-25T12:25
author: ['bishal-biswas']
level: 1
tags: ['notifications', 'ipc', 'cross-platform']
course: electronjs
---

## What a desktop notification is

A **desktop notification** is the little card that slides in at the corner of the screen to say "Download finished" or "New message from Ravi". It appears even when your app is hidden behind other windows, and it stays in the system's notification list (Notification Center on macOS, the notification panel on Windows, the message tray on most Linux desktops) so the user can read it later.

Think of it like a note slipped under someone's door. They might be busy in another room, but when they walk past, the note is waiting for them. Use notifications for things the user would want to know even when they are not looking at your app.

Electron gives you **two** ways to show one:

1. The **web `Notification` API** in the renderer. It is the same API web pages use, and it needs no IPC.
2. Electron's **`Notification` class** in the main process. It has more options and works even when no window is open.

Both end up as the same native notification. You will build each one, then look at the platform quirks.

## Way 1: the web Notification API in the page

If the event happens in your page, such as "the timer reached zero", you can show a notification right from `renderer.js`:

```html
<!-- index.html (inside <body>) -->
<button id="notify">Remind me</button>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
document.getElementById('notify').addEventListener('click', () => {
  const notification = new Notification('Time for a break', {
    body: 'You have been working for 25 minutes.',
  });

  notification.onclick = () => {
    console.log('The user clicked the notification');
  };
});
```

Run `npm start` and click the button. A native notification appears.

In a normal browser, a page must ask for permission first. In Electron, the permission is **granted by default** for your own pages, so the notification simply shows. If you later add your own permission rules with a permission handler, remember to allow notifications. You will meet permission handlers in [Sessions, Cookies and Permissions](/courses/electronjs/sessions-cookies-and-permissions).

The web API is perfect for simple cases. Its limits: it only works while a window with your page is open, and it offers fewer native options.

## Way 2: Electron's Notification class in main

The main process has its own `Notification` class. It is useful when:

- The event happens in main, such as a file finishing saving or a background check finishing.
- No window is open, for example when your app lives in the system tray.
- You want extra options, such as a silent notification or a custom icon.

Here is the smallest version:

```javascript
// main.js
const { app, Notification } = require('electron');

app.whenReady().then(() => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'Hello from main',
      body: 'This notification came from the main process.',
    });
    notification.show();
  }
});
```

Two important differences from the web API:

- You pass **one options object**, with `title` inside it.
- Creating the object does **not** show it. You must call `notification.show()`.

`Notification.isSupported()` returns `true` if the current system can show notifications. It is a cheap check and avoids errors on unusual Linux setups.

### Useful options

| Option | What it does |
| --- | --- |
| `title` | The bold first line |
| `body` | The main text |
| `silent` | `true` to show it without the system sound |
| `icon` | A path to a local image file, or a `nativeImage` |
| `subtitle` | A second heading line (macOS only) |
| `urgency` | `'low'`, `'normal'` or `'critical'` (Windows and Linux) |
| `timeoutType` | `'default'` or `'never'` to keep it on screen (Windows and Linux) |

There are also advanced options for reply boxes (`hasReply`) and action buttons (`actions`). Support for those differs between platforms, so check the official notification docs before relying on them.

### Events

The main-process notification is an event emitter, so you can react to what happens to it:

```javascript
// main.js
notification.on('click', () => {
  console.log('Clicked!');
});

notification.on('close', () => {
  console.log('The user dismissed it');
});

notification.on('failed', (event, error) => {
  console.log('The system could not show the notification:', error);
});
```

The `failed` event exists on macOS and Windows. It is your best friend when a notification "just does not appear".

## Wiring it up: the page asks main to notify

Often the page decides **when** to notify, but you want the main-process features. Use the familiar preload plus `invoke` pattern from [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle).

### The preload

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notifier', {
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  onClicked: (callback) => ipcRenderer.on('notification-clicked', (_event, title) => callback(title)),
});
```

### The main process

When the user clicks the notification, it would be friendly to bring the window back to the front and tell the page which notification was clicked:

```javascript
// main.js
const shown = new Set(); // keep notifications alive until they are closed

ipcMain.handle('notify', (event, { title, body }) => {
  if (typeof title !== 'string' || typeof body !== 'string') return false;
  if (!Notification.isSupported()) return false;

  const win = BrowserWindow.fromWebContents(event.sender);
  const notification = new Notification({
    title: title.slice(0, 100),
    body: body.slice(0, 300),
  });

  notification.on('click', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      win.webContents.send('notification-clicked', title);
    }
  });
  notification.on('close', () => shown.delete(notification));

  shown.add(notification);
  notification.show();
  return true;
});
```

Why the `shown` set? JavaScript cleans up objects that nothing refers to any more (this is called **garbage collection**). If your notification object is cleaned up, its `click` handler can no longer run. Keeping it in a set until it closes avoids that.

The `slice()` calls keep the text a sensible length, and the type checks make sure the page cannot send something strange. Main should never blindly trust what the renderer sends.

### The page

```javascript
// renderer.js
document.getElementById('notify').addEventListener('click', async () => {
  await window.notifier.notify('Export finished', 'Your notes were saved as PDF.');
});

window.notifier.onClicked((title) => {
  document.body.append(`You clicked: ${title}`);
});
```

Click the button, then click the notification. Your window comes forward and the page shows which one was clicked.

## Platform notes

### Windows: the AppUserModelID

Windows links every notification to an **AppUserModelID** (AUMID), a unique ID string for your app, such as `com.example.mynotes`. Windows uses it to show your app's name on the notification and to group notifications together. It expects a Start Menu shortcut with the same ID, which your installer normally creates.

Set the ID early in `main.js`, before you show any notification:

```javascript
// main.js
if (process.platform === 'win32') {
  app.setAppUserModelId('com.example.mynotes');
}
```

During development, you are running the plain `electron.exe`, which has no Start Menu shortcut of its own. If notifications do not show while developing, the Electron docs suggest pinning `node_modules\electron\dist\electron.exe` to the Start Menu and calling `app.setAppUserModelId(process.execPath)` in development. When you package the app, use the same ID that your installer gives your shortcut; [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers) covers this.

Also remember that Windows has a **Do Not Disturb** mode (called Focus Assist on older versions). When it is on, notifications go silently into the notification panel.

### macOS: signing and permission

Since Electron 42, macOS notifications use Apple's modern `UNNotification` system. Two consequences:

- The first time your app shows a notification, macOS asks the user whether to allow notifications from it. If they say no, nothing appears until they change it in System Settings, Notifications.
- The modern system requires the app to be **code-signed**. If it is not, the notification is not displayed and the main-process notification emits `failed`. Listen for `failed` while developing so you know what is going on. [Code Signing and Notarization](/courses/electronjs/code-signing-and-notarization) explains signing.

### Linux

Linux notifications go to the desktop's notification service, which almost every desktop (GNOME, KDE, Xfce and others) provides. Appearance and how long they stay on screen depend on the desktop. `urgency: 'critical'` usually keeps a notification visible until the user dismisses it.

## Common mistakes

### Forgetting `show()`

`new Notification({...})` in main only creates the object. Nothing appears until you call `.show()`. The web API in the renderer is different: it shows immediately.

### Using the wrong constructor shape

The web API takes `new Notification(title, { body })`. The main-process class takes `new Notification({ title, body })`. Mixing them up gives you a notification with no title, or one titled `[object Object]`.

### Clicks that do nothing

If the notification object is garbage collected, its `click` handler is gone. Keep a reference, as with the `shown` set above.

### Notifying too often

Every notification interrupts the user. Show them for things that matter, combine several updates into one, and consider a setting to turn them off.

## Quick recap

- A notification is a native card that appears even when your app is in the background.
- In the renderer, `new Notification(title, { body })` shows one immediately. Electron grants the permission by default.
- In main, `new Notification({ title, body })` creates one and `.show()` displays it. Check `Notification.isSupported()` first.
- Main-process notifications emit `click`, `close` and (on macOS and Windows) `failed`.
- Let the page ask main to notify through a preload function and `ipcRenderer.invoke()`, and check the data in main.
- Keep a reference to notifications whose events you need.
- On Windows, set an AppUserModelID with `app.setAppUserModelId()`. On macOS, notifications need permission from the user and a code-signed app.

<code id="code-content" class="language-javascript">
// main.js: notifications requested by the page, shown by the main process
const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('node:path');
// --- 1. Windows links notifications to an AppUserModelID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.example.mynotes');
}
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}
// --- 2. Keep shown notifications alive so their click handlers still work
const shown = new Set();
ipcMain.handle('notify', (event, { title, body }) =&gt; {
  if (typeof title !== 'string' || typeof body !== 'string') return false;
  if (!Notification.isSupported()) return false;
  const win = BrowserWindow.fromWebContents(event.sender);
  const notification = new Notification({
    title: title.slice(0, 100),
    body: body.slice(0, 300),
  });
  // --- 3. Clicking brings the window back and tells the page
  notification.on('click', () =&gt; {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send('notification-clicked', title);
  });
  notification.on('close', () =&gt; shown.delete(notification));
  notification.on('failed', (e, error) =&gt; {
    console.log('Notification failed:', error); // for example an unsigned app on macOS
    shown.delete(notification);
  });
  shown.add(notification);
  notification.show();
  return true;
});
// --- 4. Lifecycle
app.whenReady().then(() =&gt; {
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// preload.js: notify: (title, body) =&gt; ipcRenderer.invoke('notify', { title, body })
// renderer.js (web API, no IPC): new Notification('Time for a break', { body: '25 minutes done' })
</code></pre>

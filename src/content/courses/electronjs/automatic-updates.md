---
publishDate: 2026-10-25T12:52
title: Automatic Updates
slug: automatic-updates
metadescription: Keep your Electron app up to date automatically with update-electron-app, the free update.electronjs.org service and the built-in autoUpdater events.
updateDate: 2026-10-25T12:52
author: ['bishal-biswas']
level: 3
tags: ['auto-update', 'autoupdater', 'releases']
course: electronjs
---

## Why apps update themselves

You fixed a bug and released version 1.0.1. How do your users get it? If they have to visit your website, notice there is a new version, download it and reinstall, most of them never will. They keep the bug, and you keep getting the same bug reports.

An **auto-updater** fixes that. Your app quietly asks a server "is there anything newer than the version I am?". If there is, it downloads the update in the background and installs it the next time the app restarts. Users always have the latest version without lifting a finger.

Think of a magazine subscription. You do not go to the shop every month to check whether a new issue is out. It simply arrives in your letterbox, and you read it when you are ready.

## How Electron's updater works

Electron has a built-in **`autoUpdater`** module in the main process. It is built on **Squirrel**, the same installer framework you met in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers):

- **Windows:** Squirrel.Windows. It updates apps that were installed with the Squirrel `Setup.exe` from `MakerSquirrel`.
- **macOS:** Squirrel.Mac. It downloads the `.zip` of your app made by `MakerZIP`. **The app must be signed**, as in [Code Signing and Notarization](/courses/electronjs/code-signing-and-notarization), or updates fail.
- **Linux:** not supported. Linux users normally update apps through their package manager, Snap or Flatpak, which handle updates themselves.

The flow goes like this:

1. Your app tells `autoUpdater` the **feed URL**: the address of an update server.
2. It calls `checkForUpdates()`. The server looks at the app's current version and answers either "you are up to date" or "here is a newer version".
3. If there is a newer version, `autoUpdater` downloads it automatically in the background.
4. When the download finishes, it fires `update-downloaded`. The update is installed the next time the app quits and restarts. You can also restart right away with `quitAndInstall()`.

## The update server: update.electronjs.org

You need a server that answers "is there a newer version?". You could build your own, but if your app is **open source on a public GitHub repository**, there is a free one run by the Electron team: **update.electronjs.org**.

It reads your **GitHub Releases**. When you publish a new release with the right files attached, every installed copy of your app finds it. The requirements are:

- The repository is **public** on GitHub.
- Each release is a published GitHub release (not a draft), tagged with a version that follows semver, like `v1.0.1`.
- The release has the update files attached: for Windows the `.nupkg` and `RELEASES` files from `MakerSquirrel`, for macOS the `.zip` from `MakerZIP`.
- The macOS build is signed.

The next lesson, [Publishing Releases to GitHub and App Stores](/courses/electronjs/publishing-releases), uploads exactly these files with one command.

## The easy way: update-electron-app

The Electron team also publishes a small library, **`update-electron-app`**, that wires everything up for you. Install it as a normal dependency, because your packaged app needs it at run time:

```bash
npm install update-electron-app
```

Then add two lines to the Forge template's `src/main.js`:

```javascript
// src/main.js
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { updateElectronApp } from 'update-electron-app';

if (started) {
  app.quit();
}

updateElectronApp();

// ...createWindow and the rest of the template stay the same
```

That is all. `updateElectronApp()`:

- finds your GitHub repository from the `repository` field in `package.json`,
- does nothing when the app is not packaged, so `npm start` is unaffected,
- does nothing on Linux,
- checks for updates when the app starts and then every 10 minutes,
- shows a dialog with **Restart** and **Later** buttons once an update has downloaded.

Make sure `package.json` has a `repository` field:

```json
{
  "name": "todo-buddy",
  "productName": "Todo Buddy",
  "version": "1.0.0",
  "repository": "https://github.com/asha-rao/todo-buddy"
}
```

### Options

You can be explicit about the repository and change the timing:

```javascript
// src/main.js
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';

updateElectronApp({
  updateSource: {
    type: UpdateSourceType.ElectronPublicUpdateService,
    repo: 'asha-rao/todo-buddy',
  },
  updateInterval: '1 hour', // the minimum allowed is 5 minutes
  logger: console,          // print what the updater is doing
  notifyUser: true,         // show the Restart / Later dialog
});
```

With `logger: console`, the packaged app writes lines like `checking-for-update` and `update-not-available` to its log, which helps a lot when an update does not arrive.

If you host your update files yourself, on a plain static file host such as Amazon S3, use `UpdateSourceType.StaticStorage` with a `baseUrl` instead. On macOS that needs a `RELEASES.json` file, which `MakerZIP` creates when you set its `macUpdateManifestBaseUrl` option.

## The flexible way: autoUpdater events

`update-electron-app` is perfect for many apps. Sometimes you want more control: a **Check for Updates** menu item, a progress message inside your window, or your own "update ready" banner instead of a dialog. Then use `autoUpdater` directly.

### Step 1: set the feed URL

```javascript
// src/main.js
import { app, autoUpdater } from 'electron';

function setUpUpdates() {
  if (!app.isPackaged) return;                 // no updates during development
  if (process.platform === 'linux') return;    // not supported on Linux

  const repo = 'asha-rao/todo-buddy';
  const url = `https://update.electronjs.org/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`;
  autoUpdater.setFeedURL({ url });
}
```

The URL tells the server your repository, your platform and CPU (like `win32-x64` or `darwin-arm64`) and your current version, so it can work out whether anything newer exists.

### Step 2: listen to the events

`autoUpdater` tells you what it is doing through events:

```javascript
// src/main.js
autoUpdater.on('checking-for-update', () => console.log('Checking for updates...'));
autoUpdater.on('update-available', () => console.log('Update found, downloading...'));
autoUpdater.on('update-not-available', () => console.log('You are up to date.'));
autoUpdater.on('error', (error) => console.error('Update error:', error.message));

autoUpdater.on('update-downloaded', (_event, releaseNotes, releaseName) => {
  console.log('Downloaded', releaseName);
});
```

| Event | When it fires |
| --- | --- |
| `checking-for-update` | A check has started. |
| `update-available` | A newer version exists. The download starts automatically. |
| `update-not-available` | The app is already on the latest version. |
| `update-downloaded` | The new version is downloaded and ready to install. |
| `error` | Something failed: no internet, a bad feed URL, an unsigned Mac app. |
| `before-quit-for-update` | `quitAndInstall()` was called and the app is about to close. |

`update-downloaded` gives you the release notes and name. On Windows, only `releaseName` is filled in.

### Step 3: check, then offer a restart

```javascript
// src/main.js
import { dialog } from 'electron';

autoUpdater.on('update-downloaded', async (_event, _notes, releaseName) => {
  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    message: `${releaseName || 'A new version'} is ready`,
    detail: 'Restart the app to finish updating. Your work is saved.',
  });
  if (response === 0) autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();
  setUpUpdates();
  setTimeout(() => autoUpdater.checkForUpdates(), 10_000);            // first check after 10 seconds
  setInterval(() => autoUpdater.checkForUpdates(), 60 * 60 * 1000);   // then every hour
});
```

- **`checkForUpdates()`** starts a check. Waiting a few seconds after startup keeps launch fast, as in [Performance: Faster Startup and Less Memory](/courses/electronjs/performance-tips).
- **`quitAndInstall()`** closes all windows, quits and installs. Only call it after `update-downloaded`.
- If the user picks **Later**, nothing is lost. A downloaded update is applied automatically the next time the app starts.

> **Warning:** `quitAndInstall()` closes windows without the usual `before-quit` event firing first. If your app saves data on quit, also listen for `autoUpdater`'s `before-quit-for-update` event and save there too.

### Sending progress to the window

To show update status in your page, forward the events through IPC, just like in [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer):

```javascript
// src/main.js
function sendStatus(text) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('update:status', text);
}

autoUpdater.on('update-available', () => sendStatus('Downloading an update...'));
autoUpdater.on('update-downloaded', () => sendStatus('Update ready. It installs when you restart.'));
```

```javascript
// src/preload.js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('updates', {
  onStatus: (callback) => ipcRenderer.on('update:status', (_event, text) => callback(text)),
});
```

## Testing updates

You cannot test updates with `npm start`, because a development build is not installed and is not packaged. The real test looks like this:

1. Set `"version": "1.0.0"`, then make and publish a release.
2. Install **that** release on a test machine with its installer.
3. Change something visible, set `"version": "1.0.1"`, then make and publish again.
4. Start the installed 1.0.0 app and wait. You should get the "ready" dialog, and after restarting, see your change.

If nothing happens, add `logger: console` (or `console.log` calls in your event handlers) and read the log. Common causes are an unsigned Mac build, a draft release, missing `.nupkg` or `RELEASES` files, or a version number that did not go up.

## An alternative: electron-builder and electron-updater

**electron-builder** is a different packaging tool from Electron Forge, popular in many projects. It comes with its own updater, **`electron-updater`**. It can update Linux AppImage builds, works with plain file servers and S3 out of the box, and reports download progress.

It is a separate toolchain with its own configuration and its own update files, so it does not mix with Forge's makers and publishers. If you started with Forge, stay with `autoUpdater` and `update-electron-app`. Consider electron-builder only if you need something Forge's approach cannot do, like auto-updating on Linux.

## Common mistakes

### Testing updates in development

`update-electron-app` skips everything when `app.isPackaged` is false, and Squirrel needs an installed app. Package, install and test the real thing.

### An unsigned macOS app

Squirrel.Mac refuses to install updates for unsigned apps. You will see an `error` event. Sign and notarize your Mac builds.

### Forgetting to bump the version

The server compares version numbers. If version 1.0.1 is still labelled `1.0.0` in `package.json`, nobody gets the update.

### Calling `checkForUpdates()` too often

Each call can start a new download. Check at startup and then every hour or so, not every few seconds.

## Quick recap

- Electron's `autoUpdater` uses Squirrel on Windows and macOS. Linux apps update through their package managers.
- macOS updates require a signed app. Windows updates require a Squirrel install.
- update.electronjs.org is a free update server for public GitHub repositories, fed by your GitHub Releases.
- `updateElectronApp()` from `update-electron-app` sets everything up in one call, skips development builds, and shows a Restart dialog.
- For full control, call `autoUpdater.setFeedURL({ url })`, listen to `checking-for-update`, `update-available`, `update-not-available`, `update-downloaded` and `error`, then call `quitAndInstall()`.
- Downloaded updates install on the next restart even if the user picks Later.
- Test with real installed builds and increasing version numbers.
- electron-builder's `electron-updater` is an alternative toolchain, including Linux AppImage updates.

<code id="code-content" class="language-javascript">
// src/main.js: automatic updates with autoUpdater and update.electronjs.org
import { app, BrowserWindow, Menu, autoUpdater, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
if (started) app.quit(); // Squirrel install and uninstall runs on Windows
const REPO = 'asha-rao/todo-buddy'; // a public GitHub repository
const canUpdate = app.isPackaged &amp;&amp; process.platform !== 'linux';
// --- Tell every window what the updater is doing
function sendStatus(text) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('update:status', text);
}
// --- Feed URL and events
function setUpUpdates() {
  if (!canUpdate) return;
  const url = `https://update.electronjs.org/${REPO}/${process.platform}-${process.arch}/${app.getVersion()}`;
  autoUpdater.setFeedURL({ url });
  autoUpdater.on('checking-for-update', () =&gt; sendStatus('Checking for updates...'));
  autoUpdater.on('update-available', () =&gt; sendStatus('Downloading an update...'));
  autoUpdater.on('update-not-available', () =&gt; sendStatus('You have the latest version.'));
  autoUpdater.on('error', (error) =&gt; sendStatus(`Update failed: ${error.message}`));
  autoUpdater.on('update-downloaded', async (_event, _notes, releaseName) =&gt; {
    sendStatus('Update ready. It installs when you restart.');
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      message: `${releaseName || 'A new version'} is ready`,
      detail: 'Restart the app to finish updating.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  setTimeout(() =&gt; autoUpdater.checkForUpdates(), 10_000); // after startup
  setInterval(() =&gt; autoUpdater.checkForUpdates(), 60 * 60 * 1000); // every hour
}
// --- A "Check for Updates" menu item
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : [{ role: 'fileMenu' }]),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Help',
      submenu: [{ label: 'Check for Updates', enabled: canUpdate, click: () =&gt; autoUpdater.checkForUpdates() }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
// --- The template's window code
const createWindow = () =&gt; {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
};
app.whenReady().then(() =&gt; {
  buildMenu();
  createWindow();
  setUpUpdates();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

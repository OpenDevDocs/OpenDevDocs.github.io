---
publishDate: 2026-10-25T12:31
title: 'App Paths: Where to Store User Data'
slug: app-paths-and-user-data
metadescription: Learn where an Electron app should store its data with app.getPath('userData'), what each special folder means on Windows, macOS and Linux, and what to avoid.
updateDate: 2026-10-25T12:31
author: ['bishal-biswas']
level: 1
tags: ['app-paths', 'user-data', 'cross-platform']
course: electronjs
---

## The question every app must answer

Your app needs to save things: notes, settings, a small database, a log file. The first question is not "how do I write a file?" (you learned that in [Reading and Writing Files from Your App](/courses/electronjs/reading-and-writing-files)) but **"where should this file go?"**

Every operating system has rules about that, and they are different on Windows, macOS and Linux. Luckily, Electron knows all of them. You ask `app.getPath('userData')`, and Electron answers with the right folder for the current system.

Think of it like staying in a hotel. You do not write on the walls of your room (that is the app's own folder). You put your things in your own locker (the user data folder), and you can ask reception (`app.getPath`) where your locker is, in any hotel in the world.

## Step 1: ask Electron where things are

Add this to `main.js` and run your app:

```javascript
// main.js
const { app } = require('electron');

app.whenReady().then(() => {
  console.log('userData :', app.getPath('userData'));
  console.log('documents:', app.getPath('documents'));
  console.log('temp     :', app.getPath('temp'));
});
```

On Windows, for an app named "My Notes", you see something like:

```text
userData : C:\Users\asha\AppData\Roaming\My Notes
documents: C:\Users\asha\Documents
temp     : C:\Users\asha\AppData\Local\Temp
```

On macOS:

```text
userData : /Users/asha/Library/Application Support/My Notes
documents: /Users/asha/Documents
temp     : /var/folders/xy/abc123/T/
```

On Linux:

```text
userData : /home/asha/.config/My Notes
documents: /home/asha/Documents
temp     : /tmp
```

Same code, three correct answers. That is why you should never type a path like `C:\Users\...` into your code.

## The special folders

`app.getPath(name)` accepts these names. The ones you will use most are at the top:

| Name | What it is | Use it for |
| --- | --- | --- |
| `userData` | Your app's own private folder | Settings, notes, databases, caches you manage |
| `documents` | The user's Documents folder | A sensible default in save dialogs |
| `downloads` | The user's Downloads folder | Files the user downloads through your app |
| `desktop` | The user's desktop | Rarely: only if the user asks |
| `pictures`, `music`, `videos` | The user's media folders | Default folders for media apps |
| `temp` | The system's temporary folder | Short-lived files; the system may delete them |
| `home` | The user's home folder | Rarely needed directly |
| `appData` | The folder that holds all apps' data folders | Rarely needed; `userData` sits inside it |
| `logs` | Your app's log folder | Log files |
| `sessionData` | Where Chromium stores cookies and caches | Defaults to the same folder as `userData` |
| `exe` | The path of the running app's executable | Advanced uses only |

If a name is not valid, or the folder cannot be found, `getPath()` throws an error.

## Where `userData` lives on each system

| System | Base folder (`appData`) | Your `userData` |
| --- | --- | --- |
| Windows | `%APPDATA%`, usually `C:\Users\<you>\AppData\Roaming` | `...\Roaming\My Notes` |
| macOS | `~/Library/Application Support` | `~/Library/Application Support/My Notes` |
| Linux | `$XDG_CONFIG_HOME`, or `~/.config` if that is not set | `~/.config/My Notes` |

`~` means the user's home folder. `%APPDATA%` and `$XDG_CONFIG_HOME` are **environment variables**: named settings the operating system provides to every program.

On macOS, the `Library` folder is hidden in Finder by default. Press Cmd + Shift + G in Finder and type the path to get there. On Linux, folders starting with a dot, like `.config`, are hidden; press Ctrl + H in most file managers to show them.

## Where the folder name comes from

The last part of the path, "My Notes", is your **app name**. Electron takes it from `package.json`:

```json
{
  "name": "my-notes",
  "productName": "My Notes",
  "version": "1.0.0",
  "main": "main.js"
}
```

If `productName` exists, Electron uses it. Otherwise it uses `name`. You can check with `app.getName()`.

> **Warning:** Choose your app's name early and keep it. If you rename `productName` later, `userData` points to a **new, empty** folder, and your users' existing data seems to vanish. (It is still in the old folder, but your app no longer looks there.)

> **Note:** On Windows, the name must not contain characters that are not allowed in folder names, such as `<`, `>`, `:`, `"`, `/`, `\`, `|`, `?` or `*`. Otherwise Electron cannot create the folder and your app may crash at startup.

## What is already inside `userData`

Open the folder after running your app once and you will find things you did not create: folders with names like `Cache`, `Local Storage` or `GPUCache`. That is Chromium, the browser engine inside Electron, storing its own data there, because `sessionData` defaults to the same folder.

So be a good neighbour:

- Put your own files in clearly named files or a subfolder, such as `userData/notes/` or `userData/settings.json`.
- Never delete the whole `userData` folder from code to "reset" your app. Delete only your own files.

Create your subfolder before writing to it. `recursive: true` means "create any missing parent folders too, and do not complain if it already exists":

```javascript
// main.js
const fs = require('node:fs/promises');
const path = require('node:path');

const notesDir = path.join(app.getPath('userData'), 'notes');
await fs.mkdir(notesDir, { recursive: true }); // inside an async function
```

Always build paths with `path.join()`. It uses `\` on Windows and `/` on macOS and Linux for you.

## Where **not** to save

### Not next to your code

`__dirname` (the folder of the current file) and `app.getAppPath()` (your app's root folder) are for **reading** files you ship, like templates or images. Do not write there:

- During development it seems to work, which makes this mistake sneaky.
- After packaging, your code is inside an **ASAR** archive (a single read-only file that holds your app's code), or in a protected folder such as `C:\Program Files` or `/Applications`. Writing fails, or every update wipes the data.

You will learn more about ASAR in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers).

> **Note:** If you ever switch `main.js` to ES modules (`"type": "module"` in `package.json`, or a `.mjs` file), `__dirname` does not exist. Use `import.meta.dirname` instead, which gives the same folder.

### Not in `temp` for anything important

The temporary folder is for files you can lose, such as a file prepared for a [drag-out](/courses/electronjs/drag-and-drop-files). The operating system or cleanup tools may empty it at any time.

### Not in Documents without asking

Documents belongs to the user. Save there only when the user chooses it in a save dialog. Your app's internal files go in `userData`.

## Showing the data folder to the user

A "Show data folder" button is handy for support ("please send me your settings file"). The page asks main, and main opens the folder with [`shell`](/courses/electronjs/clipboard-and-shell):

```javascript
// main.js
const { app, ipcMain, shell } = require('electron');

ipcMain.handle('paths:get', () => ({
  userData: app.getPath('userData'),
  logs: app.getPath('logs'),
}));

ipcMain.handle('paths:open-user-data', async () => {
  const error = await shell.openPath(app.getPath('userData'));
  return error === '';
});
```

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appPaths', {
  get: () => ipcRenderer.invoke('paths:get'),
  openUserData: () => ipcRenderer.invoke('paths:open-user-data'),
});
```

```javascript
// renderer.js
const paths = await window.appPaths.get();
document.getElementById('where').textContent = `Your data is stored in ${paths.userData}`;

document.getElementById('show-folder').addEventListener('click', () => {
  window.appPaths.openUserData();
});
```

Main returns the paths only for display. The page cannot use them to read anything, because no handler accepts a path.

> **Tip:** `renderer.js` is a classic script, so top-level `await` is not allowed there. Wrap the code in `async function start() { ... }` and call `start()`, or use `.then()`.

## Logs

`app.getPath('logs')` gives you a folder for log files. On macOS it is `~/Library/Logs/<App Name>`. On Windows and Linux it is a `logs` folder inside `userData`. The folder is created for you the first time you ask for it.

## Changing a path with `setPath`

You can move any of these folders with `app.setPath(name, newPath)`. A common use is keeping development data separate from your real app data, so testing never damages your own notes:

```javascript
// main.js (near the top, before anything uses userData)
const { app } = require('electron');
const path = require('node:path');

if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'My Notes (development)'));
}
```

`app.isPackaged` is `false` while you run with `npm start`, and `true` in the installed app.

Call `setPath()` early, before the app is ready. Chromium decides where to keep cookies and caches (`sessionData`) during startup, so changing `userData` later is too late for those.

## Common mistakes

### Writing files next to `main.js`

It works on your machine and breaks after packaging. Use `app.getPath('userData')`.

### Hard-coding paths

`'C:\\Users\\asha\\AppData\\Roaming\\My Notes'` only works for Asha on Windows. Always ask `app.getPath()` and join with `path.join()`.

### Renaming the app after release

A new `productName` means a new `userData` folder. If you must rename, copy the old folder's files on first start of the new version.

### Forgetting to create subfolders

`fs.writeFile()` fails with `ENOENT` if the folder does not exist. Call `fs.mkdir(dir, { recursive: true })` first.

## Quick recap

- `app.getPath(name)` returns the right folder on Windows, macOS and Linux. Never hard-code paths.
- `userData` is your app's private folder: `%APPDATA%\<App Name>` on Windows, `~/Library/Application Support/<App Name>` on macOS, `~/.config/<App Name>` on Linux.
- The folder name comes from `productName` (or `name`) in `package.json`. Do not change it after release.
- Chromium also stores data in `userData`, so keep your files clearly named or in a subfolder.
- `__dirname` and `app.getAppPath()` are read-only places for files you ship.
- `temp` is for files you can lose. Documents is for files the user chooses to save there.
- `app.setPath()` moves a folder; call it early, for example to separate development data.

<code id="code-content" class="language-javascript">
// main.js: finding the right folders and showing them to the user
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
// --- 1. Keep development data apart from the real app's data (do this early)
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), `${app.getName()} (development)`));
}
// --- 2. Our own subfolder inside userData, created on startup
const notesDir = () =&gt; path.join(app.getPath('userData'), 'notes');
async function prepareFolders() {
  await fs.mkdir(notesDir(), { recursive: true });
  console.log('userData :', app.getPath('userData'));
  console.log('notes    :', notesDir());
  console.log('documents:', app.getPath('documents'));
  console.log('logs     :', app.getPath('logs'));
  console.log('temp     :', app.getPath('temp'));
}
// --- 3. The page may see the paths (for display) and ask to open the folder
ipcMain.handle('paths:get', () =&gt; ({
  userData: app.getPath('userData'),
  notes: notesDir(),
  logs: app.getPath('logs'),
}));
ipcMain.handle('paths:open-user-data', async () =&gt; {
  const error = await shell.openPath(app.getPath('userData'));
  return error === '';
});
// --- 4. Window and lifecycle
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html'); // __dirname is fine for READING files we ship
}
app.whenReady().then(async () =&gt; {
  await prepareFolders();
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

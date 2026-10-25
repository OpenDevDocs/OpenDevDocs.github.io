---
publishDate: 2026-10-25T12:43
title: Single Instance Lock and Deep Links
slug: single-instance-and-deep-links
metadescription: Keep your Electron app to one running copy with requestSingleInstanceLock, and open it from myapp:// links on Windows, macOS and Linux safely.
updateDate: 2026-10-25T12:43
author: ['bishal-biswas']
level: 3
tags: ['single-instance', 'deep-links', 'protocols']
course: electronjs
---

## Two problems, one solution

Try this with any Electron app from earlier lessons: start it, then start it again. You now have two copies running, each with its own window, each reading and writing the same settings file and database. That leads to lost changes and strange bugs.

Most desktop apps behave differently. If you open Slack or VS Code a second time, the existing window simply comes to the front. That is called a **single instance** app.

The second problem is **deep links**. A deep link is a URL with your own scheme, such as `notesapp://open?id=42`, that opens your app at a specific place. You click it in a browser, an email or a chat message, and the operating system starts your app (or wakes up the running one) and hands it the URL. Zoom meeting links and Spotify links work this way.

These two topics belong together because, on Windows and Linux, a deep link arrives by **starting a second copy** of your app with the URL as an argument. The single instance lock is what passes that URL to the copy that is already running.

Think of your app as a shop with one receptionist. When a second visitor arrives (a second launch), they do not open a new shop next door. They hand their note (the command-line arguments, including any link) to the receptionist and leave.

> **Note:** This lesson is about URLs the **operating system** sends to your app from outside. It is different from [Custom Protocols with protocol.handle](/courses/electronjs/custom-protocols), where a scheme is used **inside** your app to load files.

## Step 1: the single instance lock

Call `app.requestSingleInstanceLock()` at the very top of `main.js`, before creating any windows:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit(); // another copy is running; it has already been told about us
} else {
  let mainWindow = null;

  app.on('second-instance', (event, argv, workingDirectory) => {
    // Someone tried to start a second copy: show our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: { preload: path.join(__dirname, 'preload.js') },
    });
    mainWindow.loadFile('index.html');
  });
}
```

How it works:

- The first copy asks for the lock, gets it (`true`), and carries on normally.
- A second copy asks for the lock and gets `false`. Before returning, Electron has already sent the second copy's command-line arguments to the first copy. The second copy then quits.
- The first copy receives the `second-instance` event with those arguments and brings its window to the front.

Start your app, minimise it, then start it again from the terminal or the Start menu. Instead of a second window, the first one is restored.

`mainWindow.restore()` un-minimises the window and `focus()` brings it to the front. On Windows, the operating system may only flash the taskbar button instead of jumping to the front, to stop apps from stealing focus. That is expected.

> **Tip:** On macOS, double-clicking an app in Finder never starts a second copy: the system just activates the running one. But launching from the terminal does start a second copy, so you still need the lock.

### Passing extra data

`requestSingleInstanceLock` can carry a small JSON-friendly object to the first copy. It arrives as the fourth argument of `second-instance`:

```javascript
// main.js
const gotTheLock = app.requestSingleInstanceLock({ startedAt: Date.now() });

app.on('second-instance', (event, argv, workingDirectory, additionalData) => {
  console.log(additionalData); // { startedAt: 1793000000000 }
});
```

This is more reliable than `argv` for your own data, because Chromium may add extra switches to `argv` and does not promise to keep the order the same. For example, the `argv` received by the first copy can look like this:

```text
[
  'C:\\...\\electron.exe',
  '--allow-file-access-from-files',
  'C:\\projects\\notes\\main.js',
  'notesapp://open?id=42'
]
```

So never read "the third argument". Search the array for what you need, as you will do for links below.

## Step 2: register your URL scheme

Pick a scheme that is unlikely to clash with other apps, usually your app's name: `notesapp`. Then tell the operating system that your app handles it:

```javascript
// main.js
const PROTOCOL = 'notesapp';

if (process.defaultApp) {
  // Running with "electron ." during development
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // Running as a packaged app
  app.setAsDefaultProtocolClient(PROTOCOL);
}
```

Why the two branches? When you run `npm start`, the program that is running is Electron itself, not your app. `process.defaultApp` is `true` in that case. To open your project, the OS must run `electron.exe path\to\your\project`, so you pass the Electron path (`process.execPath`) and your project path as arguments. A packaged app is a normal program, so no extra arguments are needed.

What `setAsDefaultProtocolClient` does on each platform:

- **Windows**: writes registry entries that point `notesapp://` at your program. It works at run time.
- **macOS**: only works for schemes declared in your app's `Info.plist`, which you set at build time (Step 5). In development it is limited.
- **Linux**: desktop environments find URL handlers through `.desktop` files. Packaged apps declare the scheme in their installer (Step 5).

## Step 3: receive links on Windows and Linux

On Windows and Linux, a deep link starts your program with the URL as a command-line argument. There are two cases:

1. **The app was not running.** The link is in `process.argv` of the copy that starts.
2. **The app was already running.** A second copy starts with the link, fails to get the lock, and the link arrives in `argv` of the `second-instance` event.

A small helper finds the link in either array:

```javascript
// main.js
function findDeepLink(argv) {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
}
```

And you use it in both places:

```javascript
// main.js
app.on('second-instance', (event, argv) => {
  showWindow();
  const url = findDeepLink(argv);
  if (url) handleDeepLink(url);
});

app.whenReady().then(() => {
  createWindow();
  const url = findDeepLink(process.argv); // cold start (Windows and Linux)
  if (url) handleDeepLink(url);
});
```

## Step 4: receive links on macOS

macOS does not use command-line arguments for links. It always delivers them to the **running** app through the `open-url` event, both when the link starts the app and when it is already running:

```javascript
// main.js: register this early, outside whenReady
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});
```

Register the listener at the top level, not inside `whenReady`. When a link launches your app, macOS may send `open-url` **before** the app is ready. A listener added later would miss it. That also means `handleDeepLink` must cope with the window not existing yet, which the next section handles.

## Handling the link safely

A deep link is **input from the outside world**. Anyone can write a web page with `<a href="notesapp://...">` and trick a user into clicking it. Treat it exactly like untrusted IPC input:

- Parse it with `new URL()`.
- Only accept actions you know about.
- Validate every parameter.
- Never pass any part of it to `shell.openExternal`, a file path, or a command.

```javascript
// main.js
let mainWindow = null;
let pendingLink = null;

function handleDeepLink(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return; // not a valid URL
  }
  if (url.protocol !== `${PROTOCOL}:`) return;

  // notesapp://open?id=42  ->  host 'open', id '42'
  if (url.host === 'open') {
    const id = Number(url.searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) return;
    sendToWindow({ action: 'open-note', id });
  } else if (url.host === 'new') {
    const title = (url.searchParams.get('title') ?? '').slice(0, 200);
    sendToWindow({ action: 'new-note', title });
  }
  // anything else is ignored
}

function sendToWindow(message) {
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingLink = message; // deliver it once the page is ready
    return;
  }
  showWindow();
  mainWindow.webContents.send('deep-link', message);
}
```

With a standard-looking URL such as `notesapp://open?id=42`, the part after `://` up to the next `/` or `?` is the **host** (`open`), and `searchParams` gives you the `?key=value` pairs.

When the window finishes loading, deliver anything that was waiting:

```javascript
// main.js (inside createWindow)
mainWindow.webContents.on('did-finish-load', () => {
  if (pendingLink) {
    mainWindow.webContents.send('deep-link', pendingLink);
    pendingLink = null;
  }
});
```

The preload exposes a listener, as in [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer):

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('links', {
  onDeepLink: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('deep-link', listener);
    return () => ipcRenderer.removeListener('deep-link', listener);
  },
});
```

```javascript
// renderer.js
window.links.onDeepLink((message) => {
  if (message.action === 'open-note') {
    document.querySelector('#status').textContent = `Opening note ${message.id}`;
  } else if (message.action === 'new-note') {
    document.querySelector('#status').textContent = `New note: ${message.title}`;
  }
});
```

Notice the renderer never sees the raw URL, only a cleaned-up message with known fields.

## Testing your links

Start your app with `npm start` once, so it registers the scheme. Then trigger a link from a terminal:

```powershell
# Windows (PowerShell)
Start-Process "notesapp://open?id=42"
```

```bash
# macOS
open "notesapp://open?id=42"

# Linux
xdg-open "notesapp://open?id=42"
```

You can also put `<a href="notesapp://open?id=42">Open note</a>` on a web page and click it. Browsers usually ask "Open notesapp?" first. That prompt is a good thing.

Your window should come to the front and show "Opening note 42". Try it with the app closed, too. Remember that on macOS and Linux, links in development often only work after packaging (next step).

## Step 5: declare the scheme when packaging

For installed apps, the scheme should be declared in the package itself, so it works from the first launch:

```javascript
// forge.config.mjs (the relevant parts)
const config = {
  packagerConfig: {
    asar: true,
    protocols: [
      {
        name: 'Notes App Link',
        schemes: ['notesapp'],
      },
    ],
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({ options: { mimeType: ['x-scheme-handler/notesapp'] } }),
    new MakerRpm({ options: { mimeType: ['x-scheme-handler/notesapp'] } }),
  ],
  // ...plugins
};
```

- `packagerConfig.protocols` writes the `CFBundleURLTypes` entry into the macOS app's `Info.plist`. Without it, macOS will not send your app any links.
- `mimeType: ['x-scheme-handler/notesapp']` adds the scheme to the `.desktop` file that the Linux `.deb` and `.rpm` installers create. Linux desktops read that file to find URL handlers.
- On Windows, calling `app.setAsDefaultProtocolClient` when the app starts is enough.

See [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers) for building the installers.

## Common mistakes

### Requesting the lock too late

If you call `requestSingleInstanceLock()` after creating a window, the second copy shows a window for a moment before quitting. Call it first, and only create windows in the branch where you got the lock.

### Not quitting when the lock fails

`requestSingleInstanceLock()` only tells you who is first. You must call `app.quit()` yourself when it returns `false`, otherwise both copies keep running.

### Registering open-url inside whenReady

On macOS, a link that launches the app can arrive before `ready`. Add the `open-url` listener at the top level of `main.js`, and queue the link until the window exists.

### Trusting the link

`notesapp://open?path=C:\Windows\...` must never become a file operation, and the URL must never reach `shell.openExternal`. Allow-list hosts and validate every parameter.

## Quick recap

- `app.requestSingleInstanceLock()` returns `true` for the first copy; other copies should call `app.quit()`.
- The first copy gets `second-instance` with the other copy's `argv`, working directory and `additionalData`. Restore and focus the window there.
- Register a URL scheme with `app.setAsDefaultProtocolClient`, passing `process.execPath` and your project path when `process.defaultApp` is true.
- Windows and Linux deliver links in `argv`: `process.argv` on a cold start, the `second-instance` argv otherwise. Search the array; do not rely on positions.
- macOS delivers links with the `open-url` event. Register it before `ready` and queue links until the window has loaded.
- Validate deep links like any untrusted input, and send the renderer a cleaned-up message, not the raw URL.
- Declare the scheme when packaging: `packagerConfig.protocols` for macOS and `mimeType: ['x-scheme-handler/...']` for Linux installers.

<code id="code-content" class="language-javascript">
// main.js: one running copy, plus notesapp:// deep links on every platform
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const PROTOCOL = 'notesapp';
let mainWindow = null;
let pendingLink = null;
// --- 1. Only the first copy keeps running
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // --- 2. Register the scheme (dev runs through electron.exe, so pass the project path)
  if (process.defaultApp) {
    if (process.argv.length &gt;= 2) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
  // --- 3. macOS: links arrive through open-url, possibly before ready
  app.on('open-url', (event, url) =&gt; {
    event.preventDefault();
    handleDeepLink(url);
  });
  // --- 4. Windows/Linux: a second launch hands its argv to us
  app.on('second-instance', (event, argv) =&gt; {
    showWindow();
    const url = findDeepLink(argv);
    if (url) handleDeepLink(url);
  });
  app.whenReady().then(() =&gt; {
    createWindow();
    const url = findDeepLink(process.argv); // cold start on Windows/Linux
    if (url) handleDeepLink(url);
    app.on('activate', () =&gt; {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () =&gt; {
    if (process.platform !== 'darwin') app.quit();
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({ width: 800, height: 600, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  mainWindow.loadFile('index.html');
  mainWindow.webContents.on('did-finish-load', () =&gt; {
    if (pendingLink) {
      mainWindow.webContents.send('deep-link', pendingLink);
      pendingLink = null;
    }
  });
  mainWindow.on('closed', () =&gt; { mainWindow = null; });
}
function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}
const findDeepLink = (argv) =&gt; argv.find((arg) =&gt; arg.startsWith(`${PROTOCOL}://`));
// --- 5. Treat every link as untrusted input: parse, allow-list, validate
function handleDeepLink(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return; }
  if (url.protocol !== `${PROTOCOL}:`) return;
  if (url.host === 'open') {
    const id = Number(url.searchParams.get('id'));
    if (Number.isInteger(id) &amp;&amp; id &gt; 0) sendToWindow({ action: 'open-note', id });
  } else if (url.host === 'new') {
    sendToWindow({ action: 'new-note', title: (url.searchParams.get('title') ?? '').slice(0, 200) });
  }
}
function sendToWindow(message) {
  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingLink = message;
    return;
  }
  showWindow();
  mainWindow.webContents.send('deep-link', message);
}
</code></pre>

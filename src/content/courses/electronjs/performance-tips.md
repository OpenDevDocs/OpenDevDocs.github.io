---
publishDate: 2026-10-25T12:47
title: 'Performance: Faster Startup and Less Memory'
slug: performance-tips
metadescription: Make your Electron app start faster and use less memory with lazy loading, ready-to-show, async APIs, bundling and app.getAppMetrics.
updateDate: 2026-10-25T12:47
author: ['bishal-biswas']
level: 3
tags: ['performance', 'startup', 'memory']
course: electronjs
---

## Why Electron apps feel slow (and how to avoid it)

Electron apps have a reputation for being slow and heavy. Part of that is real: every app ships a whole browser engine. But most of the slowness people notice comes from **choices in the app's own code**: loading too much at startup, blocking the main process, or keeping windows alive that nobody is looking at.

Think of opening a small shop in the morning. You could unpack every box in the storeroom before unlocking the door, and customers wait outside for an hour. Or you could unlock the door, put out the items people ask for first, and unpack the rest when you have a quiet moment. Fast apps work like the second shop.

This lesson covers the habits that matter most, in order:

1. Measure before you change anything.
2. Do less work before the first window appears.
3. Never block the main process.
4. Bundle your code.
5. Watch and reduce memory.

## Step 1: measure first

Guessing about performance is almost always wrong. Add a few timestamps so you can see where the time goes.

In the main process, `performance.now()` counts milliseconds since the process started. That makes it perfect for startup timing:

```javascript
// main.js
console.log('main.js starts at', Math.round(performance.now()), 'ms');

const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  console.log('app ready at', Math.round(performance.now()), 'ms');

  const win = new BrowserWindow({ show: false });
  win.once('ready-to-show', () => {
    console.log('ready-to-show at', Math.round(performance.now()), 'ms');
    win.show();
  });
  win.loadFile('index.html');
});
```

```text
main.js starts at 66 ms
app ready at 118 ms
ready-to-show at 219 ms
```

Your numbers depend on your computer, but this tiny app shows a window in about a fifth of a second. If your real app takes three seconds, the gaps between these lines tell you where to look:

- **Before "main.js starts"**: Electron itself loading. You cannot change much here.
- **Between "starts" and "ready"**: your top-level `require` calls and any code that runs before `whenReady`.
- **Between "ready" and "ready-to-show"**: window creation, plus loading and running your page.

For the renderer, open DevTools (as in [Debugging with DevTools and VS Code](/courses/electronjs/debugging-electron-apps)), go to the **Performance** tab and record a page reload. It shows exactly which scripts and styles took the longest.

> **Tip:** Always measure a **packaged** build too, not only `npm start`. Development mode often loads files differently, for example from a Vite dev server.

## Step 2: do less before the first window

### Load modules lazily

Every `require` at the top of `main.js` runs before anything else. If you require a big library that is only used in one menu item, every user pays for it at every startup.

```javascript
// main.js (slow: loads everything at startup)
const { app, BrowserWindow, ipcMain } = require('electron');
const { marked } = require('marked');           // only needed when exporting
const archiver = require('archiver');            // only needed for backups
```

Move the heavy ones to where they are used. This is called **lazy loading**:

```javascript
// main.js (fast: load heavy modules only when needed)
const { app, BrowserWindow, ipcMain } = require('electron');

ipcMain.handle('export:html', (_event, markdown) => {
  const { marked } = require('marked'); // loaded the first time someone exports
  return marked.parse(markdown);
});
```

Node caches modules, so the second call to `require('marked')` is instant. The first export takes a few extra milliseconds, but startup is faster for everyone.

### Postpone work that can wait

Checking for updates, cleaning old log files, warming caches: none of these need to happen before the window appears. Start them a little later:

```javascript
// main.js
app.whenReady().then(() => {
  createWindow();

  // Non-urgent jobs a few seconds after startup
  setTimeout(() => {
    cleanOldLogs();
    checkForUpdates();
  }, 5000);
});
```

### Show the window only when it is ready

By default, a window appears immediately and then the page paints into it. Users see a flash of white or an empty frame. Two options fix this:

```javascript
// main.js
const win = new BrowserWindow({
  show: false,                 // create the window hidden
  backgroundColor: '#1e1e1e',  // the colour shown before the page paints
  webPreferences: { preload: path.join(__dirname, 'preload.js') },
});

win.once('ready-to-show', () => win.show());
win.loadFile('index.html');
```

- **`show: false`** creates the window without showing it.
- **`ready-to-show`** fires once the page has painted for the first time. Showing the window then means it appears complete, with no flash.
- **`backgroundColor`** should match your page's background. If anything is visible before painting, it is the right colour. This matters most for dark themes, where a white flash is very noticeable.

This does not make the app technically faster, but it makes it **feel** faster, which is what users notice.

## Step 3: never block the main process

The main process handles windows, menus and all IPC on one thread. Anything slow there freezes the whole app.

### Avoid `*Sync` functions in the main process

Node offers synchronous versions of many functions, like `fs.readFileSync`. "Synchronous" means the code stops and waits until the work is done. For a small settings file at startup, that is acceptable. For anything that might be large or slow, use the Promise versions from `node:fs/promises`:

```javascript
// main.js (blocks: nothing else can happen while the file is read)
const fs = require('node:fs');
ipcMain.handle('file:open', (_event, filePath) => fs.readFileSync(filePath, 'utf8'));
```

```javascript
// main.js (does not block: other work continues while the disk is busy)
const fs = require('node:fs/promises');
ipcMain.handle('file:open', (_event, filePath) => fs.readFile(filePath, 'utf8'));
```

The same goes for `child_process.execSync`, `crypto.pbkdf2Sync` and similar functions. And remember to validate `filePath` as in [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api).

### Avoid synchronous IPC

`ipcRenderer.sendSync` sends a message and freezes the **renderer** until main answers. If main is busy, your page is stuck too. There is almost never a good reason to use it. Use `invoke` and `handle` instead, which you learned in [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle):

```javascript
// preload.js (avoid)
getSettings: () => ipcRenderer.sendSync('settings:get'),

// preload.js (prefer)
getSettings: () => ipcRenderer.invoke('settings:get'),
```

### Move heavy work out

Long calculations, big file processing and image work belong in a utility process or a Web Worker, never in the main process. [Background Work with utilityProcess](/courses/electronjs/utility-process) shows how.

## Step 4: bundle your code

When Node runs `require('./a')`, it has to find the file on disk, read it, and compile it. An app with a thousand small files in `node_modules` does that a thousand times at startup. Reading from inside an ASAR archive helps, but each file still costs time.

A **bundler** combines your code and its dependencies into a few large files ahead of time. It also removes code you never use, which is called **tree shaking**. Fewer, smaller files load faster.

The Electron Forge Vite template does this for you. When you package, it builds `.vite/build/main.cjs`, `.vite/build/preload.cjs` and your renderer files, and the packaged app contains only those. If you started with the plain setup, moving to the template from [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge) is one of the biggest startup wins available.

## Step 5: understand and reduce memory

### See what each process uses

Electron runs several processes: one main process, one GPU process, some utility processes, and one renderer process per page. `app.getAppMetrics()` lists them all:

```javascript
// main.js
function printMemory() {
  for (const proc of app.getAppMetrics()) {
    const mb = Math.round(proc.memory.workingSetSize / 1024); // reported in kilobytes
    console.log(proc.type.padEnd(8), String(proc.pid).padEnd(6), (proc.name || '').padEnd(16), `${mb} MB`);
  }
}
```

```text
Browser  10952                   81 MB
GPU      10412                   92 MB
Utility  16388  Network Service  44 MB
Tab      13956                   64 MB
```

- **Browser** is your main process.
- **GPU** draws everything on screen.
- **Utility** processes do jobs like networking. Your own utility processes appear here too, with the `serviceName` you gave them.
- **Tab** is a renderer: one per window or view.

`workingSetSize` is the memory currently in physical RAM. Some of it is shared between processes, so adding the numbers together overstates the real total a little. It is still a great way to spot something growing that should not.

### Every window is a whole process

Each `BrowserWindow` and each `WebContentsView` gets its own renderer process, usually costing tens of megabytes even for a simple page. So:

- **Close windows you do not need** instead of hiding them. Hidden windows still use their full memory.
- **Reuse** one settings window instead of creating a new one every time.
- **Close the pages of views you remove** with `view.webContents.close()`, as in [Embedding Web Content with WebContentsView](/courses/electronjs/webcontentsview).

### Find leaks in the renderer

A **memory leak** is memory your code keeps holding even though it no longer needs it, so usage only goes up. Common causes are event listeners that are never removed, ever-growing arrays and caches, and IPC listeners added again every time a component mounts.

To find them, open DevTools, go to the **Memory** tab, take a heap snapshot, use the app for a while, take another snapshot, and compare. Objects that keep piling up are your suspects.

One Electron-specific leak: adding `ipcRenderer.on` listeners repeatedly. If your preload function adds a listener every time the page calls it, give the page a way to remove it:

```javascript
// preload.js
onProgress: (callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on('progress', listener);
  return () => ipcRenderer.removeListener('progress', listener); // call this to clean up
},
```

### Let background windows rest

By default, Chromium slows down timers and animations in windows that are hidden or minimized. This is called **background throttling**, and it saves CPU and battery. Some tutorials tell you to set `backgroundThrottling: false`. Only do that if you really need full-speed timers in a hidden window, such as an audio app.

## A word on V8 snapshots

V8 is the JavaScript engine inside Electron. A **V8 snapshot** is a saved picture of memory after some of your code has already run. Starting from a snapshot skips that work on every launch. Large apps use this to shave off noticeable startup time.

It is an advanced technique. It needs special build steps, places limits on what your startup code may do, and is tied to the `LoadBrowserProcessSpecificV8Snapshot` fuse you will meet in [Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity). Do everything else in this lesson first. Most apps never need a custom snapshot.

## Common mistakes

### Optimizing without measuring

It is easy to spend a day on something that saves two milliseconds. Add timestamps first, find the biggest gap, and fix that.

### Requiring everything at the top of `main.js`

Top-level `require` calls run before your window can appear. Keep the top of `main.js` small and load rarely used modules on demand.

### Reading big files with `readFileSync` in an IPC handler

It works fine with a small test file and freezes the app with a real one. Use `node:fs/promises` in the main process.

### Hiding windows instead of closing them

A hidden window keeps its renderer process and all its memory. Close it and create it again when needed, unless reopening must be instant.

## Quick recap

- Measure first: `performance.now()` in main, the DevTools Performance and Memory tabs in renderers.
- Load heavy modules lazily and postpone non-urgent work until after the window appears.
- Use `show: false`, `ready-to-show` and a matching `backgroundColor` to avoid flashes.
- Never block the main process: avoid `*Sync` functions and `ipcRenderer.sendSync`. Use `invoke`/`handle` and `fs/promises`.
- Bundle your code. The Forge Vite template does it for you.
- `app.getAppMetrics()` shows the memory of every process. Each window or view is a whole renderer process.
- Close unused windows and views, and remove IPC listeners you no longer need.
- V8 snapshots exist for big apps, but try everything else first.

<code id="code-content" class="language-javascript">
// main.js: a fast-starting app with timing and memory reports
const startedAt = performance.now();
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises'); // async file APIs never block main
const ms = () =&gt; `${Math.round(performance.now() - startedAt)} ms`;
// --- Heavy work is loaded lazily, the first time it is needed
ipcMain.handle('export:html', (_event, markdown) =&gt; {
  const { marked } = require('marked');
  return marked.parse(String(markdown));
});
ipcMain.handle('file:read', async (_event, name) =&gt; {
  const safeName = path.basename(String(name)); // stay inside userData
  return fs.readFile(path.join(app.getPath('userData'), safeName), 'utf8');
});
// --- Memory report for every Electron process
function printMemory() {
  for (const proc of app.getAppMetrics()) {
    const mb = Math.round(proc.memory.workingSetSize / 1024);
    console.log(proc.type.padEnd(8), String(proc.pid).padEnd(6), (proc.name || '').padEnd(16), `${mb} MB`);
  }
}
// --- Create the window hidden, show it once painted
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    backgroundColor: '#1e1e1e', // match the page background
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.once('ready-to-show', () =&gt; {
    win.show();
    console.log('Window visible after', ms());
  });
  win.loadFile('index.html');
}
app.whenReady().then(() =&gt; {
  console.log('App ready after', ms());
  createWindow();
  // Non-urgent work waits until the user can already see the app
  setTimeout(printMemory, 5000);
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

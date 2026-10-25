---
publishDate: 2026-10-25T12:15
title: Context Isolation and contextBridge
slug: context-isolation-and-contextbridge
metadescription: Understand context isolation in Electron, why the preload and page live in separate worlds, and how to share safe functions with contextBridge.
updateDate: 2026-10-25T12:15
author: ['bishal-biswas']
level: 1
tags: ['preload', 'contextbridge', 'security']
course: electronjs
---

## Where we left off

At the end of [Preload Scripts Explained](/courses/electronjs/preload-scripts) you tried this:

```javascript
// preload.js
window.greeting = 'Hello from the preload';
```

```javascript
// renderer.js
console.log(window.greeting); // undefined
```

The preload and the page share the same HTML page and the same `window`, yet the page could not see the variable. This lesson explains why, and shows the right way to share things: `contextBridge`.

## Two worlds, one page

Electron runs your preload and your page's scripts in two separate **JavaScript worlds** (also called **contexts**):

- The **main world** is where your page's own scripts run: `renderer.js` and anything else loaded by `index.html`.
- The **isolated world** is where your preload runs.

Both worlds see the **same DOM**. If the preload changes a paragraph's text, the page sees the new text. But each world has its **own JavaScript globals**: its own `window` properties, its own variables, even its own copies of built-ins like `Array` and `JSON`.

Keeping the two apart is called **context isolation**. It is controlled by the `contextIsolation` option, which is `true` by default. Leave it on.

Back to the hotel from the last lesson. The front desk (preload) and the guests (page) are in the same lobby (the DOM) and can both see the noticeboard. But there is a glass screen across the desk. Guests cannot reach over and grab the desk's phone or its keys. They can only use what the clerk places in the little opening in the glass. That opening is `contextBridge`.

## Why isolation matters

Your preload holds powerful things. Most importantly, it has `ipcRenderer`, the phone line to the main process, which can read files and run programs.

Now imagine the page could reach into the preload's world. Any script in the page could do this:

```javascript
// What an attacker's script could do WITHOUT context isolation
someStolenIpcRenderer.invoke('delete-file', 'C:/Users/asha/Documents/thesis.docx');
```

"But my page only runs my own code," you might think. Not quite:

- A note or a chat message that contains HTML could run a script if you ever insert it with `innerHTML` (this is called **XSS**, cross-site scripting).
- An npm package used by your front end could be hijacked in an update.
- You might later show content from the internet.

There is a sneakier problem too. Without isolation, the page could **replace built-in functions** that the preload relies on. For example, the page could overwrite `Array.prototype.includes` so that a safety check like `allowed.includes(channel)` always returns `true`. With context isolation, the preload has its own untouched copies of every built-in, so the page cannot trick it this way.

## Step 1: expose a small API with contextBridge

`contextBridge.exposeInMainWorld(name, api)` copies `api` into the page's world as `window[name]`.

```javascript
// preload.js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
  sayHello: (name) => `Hello, ${name}, from the preload!`,
});
```

```javascript
// renderer.js
console.log(window.electronAPI.platform);
console.log(window.electronAPI.versions.electron);
console.log(window.electronAPI.sayHello('Asha'));
```

Open DevTools (Ctrl + Shift + I, or Cmd + Option + I on macOS) and look at the Console:

```text
win32
45.0.0
Hello, Asha, from the preload!
```

On macOS you will see `darwin`, and on Linux `linux`.

The name `electronAPI` is your choice. Pick something short and clear. Some apps use one name per feature, for example `window.notes` and `window.settings`, and your first app used `window.versions`. The next few lessons use `electronAPI`.

Type `window.electronAPI` in the Console and press Enter. You can see exactly what the page has been given, and nothing more.

## Step 2: expose a function that asks the main process

Plain values are nice, but the real power comes from functions. The page calls the function, and the function's body runs **in the preload's world**, where it can use `ipcRenderer`:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
});
```

```javascript
// main.js (inside or before app.whenReady)
const { app, ipcMain } = require('electron');

ipcMain.handle('app:get-version', () => app.getVersion());
```

```javascript
// renderer.js
const version = await window.electronAPI.getAppVersion();
document.getElementById('version').textContent = `Version ${version}`;
```

> **Note:** `await` at the top level of `renderer.js` only works if the script is loaded as a module: `<script type="module" src="renderer.js"></script>`. Otherwise, put the code inside an `async` function.

This is the pattern you will use for almost everything in Electron. Do not worry about `invoke` and `handle` yet. [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle) explains them fully. For now, notice the shape:

1. The page calls a friendly named function: `getAppVersion()`.
2. The preload turns that into a message on a specific channel.
3. The main process answers.

The page never sees `ipcRenderer`. It only gets the one door you opened for it.

## What can cross the bridge

When something crosses `contextBridge`, Electron makes a **copy** of it for the other world. Most everyday values copy perfectly:

| Type | What happens |
| --- | --- |
| Strings, numbers, booleans, `null`, `undefined` | Copied as is |
| Arrays and plain objects | Copied, including nested ones |
| `Date`, `Map`, `Set`, `Error` | Copied as the same type |
| Promises | Work as expected: the page can `await` them |
| Functions | Not copied. The page gets a stand-in that calls your original function in the preload's world |
| Class instances | Copied as plain objects. Their methods are **lost** |

That last row surprises people. If the preload returns `new Pet()` with a `speak()` method, the page gets `{ name: 'Rex' }` with no `speak`. Stick to plain data.

### The exposed object is frozen

The page cannot change what you exposed. This silently does nothing:

```javascript
// renderer.js
window.electronAPI.getAppVersion = () => 'hacked';
console.log(Object.isFrozen(window.electronAPI)); // true
```

That is a feature: a stray script cannot replace your functions with fakes.

### Functions can go both ways

The page can pass its own function **into** an exposed function. The preload can then call it later. This is how you will receive events from the main process in [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer):

```javascript
// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, theme) => callback(theme)),
});
```

## What you must NOT expose

The bridge is only safe if what you put on it is safe.

### Never expose `ipcRenderer` itself

```javascript
// preload.js: DON'T DO THIS
contextBridge.exposeInMainWorld('ipc', ipcRenderer);
```

Electron actually blocks this: the page receives an empty object with none of the methods. But people then try the next mistake.

### Never expose a "send anything" helper

```javascript
// preload.js: DON'T DO THIS EITHER
contextBridge.exposeInMainWorld('ipc', {
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
});
```

This hands the page a master key. Any script in the page can now call every channel your main process listens on, with any arguments. You have rebuilt the exact hole that context isolation was meant to close.

### Do this instead

```javascript
// preload.js: one small, named function per action
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  saveNote: (text) => ipcRenderer.invoke('notes:save', text),
});
```

Each function does one thing, on one fixed channel. The page cannot pick the channel. [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api) takes this further.

## Checking that isolation is on

`contextIsolation` is `true` by default, so you do not need to write it. If someone turns it off, `contextBridge` refuses to work and the window's console shows:

```text
contextBridge API can only be used when contextIsolation is enabled
```

If you see that message, find the `contextIsolation: false` in your window options and remove it. Do not "fix" it by attaching things to `window` directly.

## Common mistakes

### Assigning to `window` in the preload

`window.myApi = {...}` in the preload only sets it in the isolated world. The page still sees `undefined`. Use `contextBridge.exposeInMainWorld`.

### Exposing the same name twice

```text
Cannot bind an API on top of an existing property on the window object
```

Each name can be exposed only once. Put all your functions in one object, or use different names such as `notes` and `settings`.

### Returning class instances

If your preload returns objects with methods, the methods vanish on the way across. Return plain objects and arrays.

### Building a generic bridge

A `send(channel, data)` or `invoke(channel, data)` helper on the bridge undoes all your security. Expose one named function per action.

## Quick recap

- The preload runs in an **isolated world**; the page runs in the **main world**. They share the DOM but not JavaScript variables.
- Context isolation stops page scripts from stealing `ipcRenderer` or tampering with built-ins the preload depends on. It is on by default: keep it.
- `contextBridge.exposeInMainWorld('electronAPI', {...})` gives the page `window.electronAPI`.
- Values are copied across. Plain data, `Date`, `Map`, `Error` and Promises work; class instances lose their methods; functions become callable stand-ins.
- The exposed object is frozen, so page scripts cannot replace your functions.
- Never expose `ipcRenderer` or a generic `send`/`invoke` helper. Expose small named functions on fixed channels.

<code id="code-content" class="language-javascript">
// preload.js: share a small, safe API with the page through contextBridge
const { contextBridge, ipcRenderer } = require('electron');
// --- Everything in this object appears in the page as window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Plain values are copied into the page's world
  platform: process.platform,
  versions: { electron: process.versions.electron, node: process.versions.node },
  // Functions run here, in the preload's world, when the page calls them
  sayHello: (name) =&gt; `Hello, ${name}, from the preload!`,
  // One named function per action, each on a fixed channel
  getAppVersion: () =&gt; ipcRenderer.invoke('app:get-version'),
  // The page passes a callback; we hand it the data only, never the event
  onThemeChanged: (callback) =&gt;
    ipcRenderer.on('theme-changed', (_event, theme) =&gt; callback(theme)),
});
// --- Never do these:
// contextBridge.exposeInMainWorld('ipc', ipcRenderer);                          // arrives empty anyway
// contextBridge.exposeInMainWorld('ipc', { send: (ch, ...a) =&gt; ipcRenderer.send(ch, ...a) }); // master key
// window.myApi = {};                                                            // invisible to the page
// --- In main.js:
//   ipcMain.handle('app:get-version', () =&gt; app.getVersion());
// --- In renderer.js:
//   console.log(window.electronAPI.platform);            // 'win32', 'darwin' or 'linux'
//   const version = await window.electronAPI.getAppVersion();
</code></pre>

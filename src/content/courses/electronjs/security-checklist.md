---
publishDate: 2026-10-25T12:38
title: Electron Security Checklist
slug: security-checklist
metadescription: A beginner-friendly walk through Electron's security checklist, from context isolation and sandboxing to IPC sender checks, navigation limits and fuses.
updateDate: 2026-10-25T12:38
author: ['bishal-biswas']
level: 2
tags: ['security', 'checklist', 'best-practices']
course: electronjs
---

## Why Electron apps need extra care

A normal website lives inside the browser's walls. If a page has a bug, the worst case is usually that one website misbehaves. An Electron app is different: the same JavaScript that draws your buttons sits next to a main process that can read files, run programs and change system settings.

That power is the whole point of Electron, but it means one mistake can let a stranger's code reach the user's computer. The most common way that happens is **XSS** (cross-site scripting): untrusted text, such as a note, a chat message or a web page, ends up running as code in your window.

Think of your app as a house. The main process is the room with the safe and the tools. The renderer is the living room where guests (web content, user files, third-party libraries) hang out. Security is about good doors and locks between those rooms, so a misbehaving guest cannot wander into the tool room.

This lesson walks through the checklist the Electron team recommends, in plain language. The good news: the latest Electron turns many of these protections on by default. Your job is mostly to **not turn them off**, and to add a few small handlers.

## 1. Keep context isolation on

**Context isolation** keeps your preload script and Electron's internals in a separate JavaScript world from the web page. The page cannot touch the preload's variables, only what you deliberately share with `contextBridge`. You learned this in [Context Isolation and contextBridge](/courses/electronjs/context-isolation-and-contextbridge).

It is on by default. Never write this:

```javascript
// main.js: don't do this
new BrowserWindow({
  webPreferences: {
    contextIsolation: false, // page can now tamper with your preload
  },
});
```

## 2. Keep the sandbox on

The **sandbox** is a Chromium feature that limits what a renderer process can do at the operating system level. A sandboxed renderer cannot open files or start programs, even if an attacker takes it over. Preloads in sandboxed windows can only `require('electron')`, which is why the course uses small preload APIs.

It is on by default. Do not set `sandbox: false` unless you have a very specific reason, and never for a window that shows remote or user content.

## 3. Never enable Node.js in renderers

```javascript
// main.js: don't do this
new BrowserWindow({
  webPreferences: {
    nodeIntegration: true, // any XSS becomes "run any program"
  },
});
```

With `nodeIntegration: true`, the page itself can call `require('child_process')`. One injected `<img onerror=...>` could then delete files. The default is `false`. Keep it that way, and also leave `nodeIntegrationInWorker` and `nodeIntegrationInSubFrames` off.

## 4. Expose small, specific APIs

Your preload is the only door between page and main. Make it a narrow door:

```javascript
// preload.js: don't do this
contextBridge.exposeInMainWorld('electron', { ipcRenderer }); // the page can call ANY channel

// preload.js: do this
contextBridge.exposeInMainWorld('notes', {
  save: (text) => ipcRenderer.invoke('notes:save', text),
});
```

Avoid "generic" functions like `readFile(anyPath)` or `run(command)`. Each function should do one job, as explained in [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api).

## 5. Validate every IPC message

The main process should treat every IPC message as a request from a stranger. Check two things:

- **Who sent it.** `event.senderFrame` describes the frame that sent the message, including its `url`. Make sure it is your own page.
- **What it contains.** Check types, lengths and allowed values.

```javascript
// main.js
const { pathToFileURL } = require('node:url');

const APP_PAGE = pathToFileURL(path.join(__dirname, 'index.html')).href;

function isFromAppPage(event) {
  const url = event.senderFrame?.url;
  return typeof url === 'string' && url.split(/[?#]/)[0] === APP_PAGE;
}

ipcMain.handle('notes:save', (event, text) => {
  if (!isFromAppPage(event)) throw new Error('Unknown sender');
  if (typeof text !== 'string' || text.length > 100_000) throw new Error('Bad input');
  // ...save it
});
```

`senderFrame` can be `null` if the frame has already gone away, hence the `?.`. If you load your app from a dev server or a custom protocol, compare against that address instead.

## 6. Use a Content Security Policy

A **Content Security Policy** (CSP) is a list of rules telling the page where scripts, styles and images may come from. A strict one blocks most XSS even when your other defences fail:

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
```

When a page has no CSP, Electron prints an "Insecure Content-Security-Policy" warning in DevTools while you develop. The next lesson, [Content Security Policy](/courses/electronjs/content-security-policy), covers it in depth.

## 7. Do not weaken web security

Some `webPreferences` options exist for special cases and quietly remove browser protections. Leave them at their defaults:

```javascript
// main.js: don't do any of these
webPreferences: {
  webSecurity: false, // turns off the same-origin policy
  allowRunningInsecureContent: true, // lets https pages load http scripts
  experimentalFeatures: true, // enables unfinished Chromium features
  enableBlinkFeatures: '...', // same, one feature at a time
}
```

## 8. Load only secure, trusted content

Prefer local files bundled with your app. When you must load from the network, use `https://`, never `http://`. Plain HTTP can be changed by anyone between the user and the server (for example on public Wi-Fi), and in Electron that changed code runs with your app's privileges.

Loading local files through a **custom protocol** instead of `file://` is even better, because `file://` pages can read other local files. See [Custom Protocols with protocol.handle](/courses/electronjs/custom-protocols).

## 9. Limit navigation

If something tricks your window into navigating to another site, that site now runs in your window, with your preload. Stop navigation you do not expect with the `will-navigate` event:

```javascript
// main.js
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event) => {
    const url = new URL(event.url);
    if (url.origin !== 'https://app.example.com') {
      event.preventDefault();
    }
  });
});
```

The `web-contents-created` event fires for every window, view and webview your app creates, so this one handler protects them all. `event.url` is the address the page wants to go to, and `event.preventDefault()` cancels it. Local-only apps can simply block all navigation.

## 10. Limit new windows

Links with `target="_blank"` and calls to `window.open()` create new windows. Decide what happens with `setWindowOpenHandler`. Usually the answer is "open it in the user's real browser instead":

```javascript
// main.js
const { shell } = require('electron');

app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
});
```

## 11. Only open trusted URLs with shell.openExternal

`shell.openExternal(url)` asks the operating system to open a URL with whatever app handles it. That is great for `https:` links. It is dangerous for other schemes: `file:` URLs can launch programs, and some systems have protocol handlers that do surprising things.

```javascript
// main.js
function isSafeExternalUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}
```

Never pass a URL from a page or a file to `shell.openExternal` without a check like this.

## 12. Handle permission requests

Web pages can ask for the camera, microphone, location, notifications and more. In Chrome, the user sees a prompt. In Electron, **every request is granted automatically** unless you add a handler. Decide yourself:

```javascript
// main.js
const { session } = require('electron');

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['notifications', 'clipboard-sanitized-write'];
    callback(allowed.includes(permission));
  });
});
```

[Sessions, Cookies and Permissions](/courses/electronjs/sessions-cookies-and-permissions) explains the request and check handlers in detail.

## 13. Avoid the webview tag

The `<webview>` tag embeds another page inside yours. It is off by default (`webviewTag: false`). For embedding web content, prefer `WebContentsView`, controlled from the main process, as shown in [Embedding Web Content with WebContentsView](/courses/electronjs/webcontentsview). If you really need `<webview>`, use the `will-attach-webview` event to strip any preload and force safe settings.

## 14. Lock the package with fuses

**Fuses** are on/off switches baked into the Electron binary when you package your app. They can permanently disable features an attacker might abuse, such as running your app as plain Node.js (`RunAsNode`) or loading code from outside your app's ASAR archive. The Forge template already includes a `FusesPlugin` with sensible settings in `forge.config.mjs`:

```javascript
// forge.config.mjs (from the template)
new FusesPlugin({
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
}),
```

[Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity) explains each one.

## 15. Keep Electron up to date

Every Electron release includes the latest Chromium security fixes. A browser engine that is a year old has dozens of publicly known holes. Update Electron regularly, read the breaking changes when you do, and ship updates to your users with [Automatic Updates](/courses/electronjs/automatic-updates). Do the same for your npm dependencies: `npm audit` lists packages with known problems.

## A quick self-check

Before you ship, open your project and answer these questions:

```text
[ ] No window sets contextIsolation: false, sandbox: false or nodeIntegration: true
[ ] Preloads expose named functions, never ipcRenderer itself
[ ] Every ipcMain handler validates its sender and its arguments
[ ] Every page has a Content Security Policy
[ ] No webSecurity: false or allowRunningInsecureContent: true
[ ] Remote content is loaded over https only
[ ] will-navigate and setWindowOpenHandler are handled for all web contents
[ ] shell.openExternal only receives checked http(s)/mailto URLs
[ ] A permission request handler is set
[ ] Fuses are configured and Electron is a current version
```

## Common mistakes

### Turning protections off to "make it work"

Many old tutorials and Stack Overflow answers say "set `nodeIntegration: true` and `contextIsolation: false`". They were written before the safe defaults existed. If code needs Node in the page, move that code to main and call it through a preload function instead.

### Trusting the renderer because "it is my own code"

Your renderer also runs third-party npm packages, Markdown from files, and text typed by users. Any of those can carry an attack. Validate in main as if the renderer were hostile.

### Forgetting new windows and views

Security settings and handlers you add to your main window do not automatically cover pop-ups. Use `app.on('web-contents-created', ...)` so every web contents gets the same rules.

## Quick recap

- The latest Electron is secure by default: context isolation, sandbox and no Node in renderers. Do not turn them off.
- Expose small, specific preload functions, and validate both the sender and the arguments of every IPC message.
- Add a Content Security Policy to every page and never weaken `webSecurity`.
- Block unexpected navigation with `will-navigate` and new windows with `setWindowOpenHandler`.
- Only pass checked `https:` (or `http:`/`mailto:`) URLs to `shell.openExternal`.
- Set a permission request handler, since Electron grants everything by default.
- Package with fuses and keep Electron and your dependencies up to date.

<code id="code-content" class="language-javascript">
// main.js: a secure baseline for a plain Electron app
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const APP_PAGE = pathToFileURL(path.join(__dirname, 'index.html')).href;
// --- Helpers: trusted senders and safe external links
function isFromAppPage(event) {
  const url = event.senderFrame?.url;
  return typeof url === 'string' &amp;&amp; url.split(/[?#]/)[0] === APP_PAGE;
}
function isSafeExternalUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}
// --- Every window and view: no surprise navigation, no surprise pop-ups
app.on('web-contents-created', (event, contents) =&gt; {
  contents.on('will-navigate', (event) =&gt; event.preventDefault());
  contents.setWindowOpenHandler(({ url }) =&gt; {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
});
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // contextIsolation: true, sandbox: true and nodeIntegration: false are the defaults
    },
  });
  win.loadFile('index.html'); // index.html has a strict Content-Security-Policy meta tag
}
app.whenReady().then(() =&gt; {
  // --- Grant only the permissions this app really needs
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) =&gt; {
    callback(['notifications', 'clipboard-sanitized-write'].includes(permission));
  });
  // --- Validate sender and arguments on every IPC handler
  ipcMain.handle('notes:save', (event, text) =&gt; {
    if (!isFromAppPage(event)) throw new Error('Unknown sender');
    if (typeof text !== 'string' || text.length &gt; 100_000) throw new Error('Bad input');
    return true; // ...save it
  });
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

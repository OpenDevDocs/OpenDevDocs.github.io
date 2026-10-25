---
publishDate: 2026-10-25T12:41
title: Custom Protocols with protocol.handle
slug: custom-protocols
metadescription: Serve your app's files from your own app:// scheme with protocol.handle and net.fetch, register privileged schemes and block path traversal attacks.
updateDate: 2026-10-25T12:41
author: ['bishal-biswas']
level: 3
tags: ['protocol', 'security', 'net-fetch']
course: electronjs
---

## What is a protocol, and why make your own?

The start of every URL, before the `://`, is its **scheme** (often called the **protocol**). `https:` means "fetch this from a web server". `file:` means "read this from the disk". `mailto:` means "start an email".

Electron lets you invent your own scheme, such as `app://`, and decide in JavaScript what every request to it returns. Then your window can load `app://bundle/index.html`, and your code in the main process answers with the right file.

Why bother, when `win.loadFile('index.html')` already works? Because `file://` was designed for opening single documents, not for running apps, and it has some awkward and risky behaviour:

- **Every `file://` page can read every other `file://` URL** the browser allows, so an XSS bug can be used to probe the user's disk.
- **Absolute paths break.** In a `file://` page, `<img src="/logo.png">` points to the root of the drive (`C:\logo.png` or `/logo.png`), not your app folder.
- **There is no real origin.** `file://` pages have an "opaque" origin, so features that depend on an origin (some storage APIs, CORS, service workers) behave oddly or not at all.

A custom scheme fixes all three. It is like giving your app its own private postal service: letters addressed to `app://` go only to your sorting office (the handler), which only delivers from your own warehouse (your app folder).

## The two steps

Making a custom protocol always has two parts:

1. **Before the app is ready**: register the scheme as **privileged**, so Chromium treats it like a real web scheme. This uses `protocol.registerSchemesAsPrivileged`.
2. **After the app is ready**: attach a **handler** that answers requests. This uses `protocol.handle`.

## Step 1: register the scheme

```javascript
// main.js
const { app, protocol } = require('electron');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);
```

This line must run at the top level of `main.js`, **before** `app.whenReady()` resolves. It can only be called once, so list all your schemes in the one array.

What the privileges mean:

| Privilege | Effect |
| --- | --- |
| `standard` | URLs follow normal web rules (`app://host/path`), relative links like `./style.css` work, and the page gets a real origin with storage such as `localStorage` |
| `secure` | The scheme is treated like `https:`, so features that need a secure context work |
| `supportFetchAPI` | The page can use `fetch('app://...')` |
| `corsEnabled` | Allows CORS requests to this scheme from other origins (leave off unless needed) |
| `stream` | Needed for streaming `<video>` and `<audio>` from the scheme |
| `bypassCSP` | Ignores the page's Content Security Policy for this scheme. Avoid it. |

`standard` is the one that matters most. Without it, `app:` behaves like `file:` and relative URLs do not resolve.

## Step 2: handle requests

Now the handler. `protocol.handle(scheme, handler)` calls your function for every request to that scheme. The function receives a standard web `Request` and must return a `Response` (or a Promise of one). These are the same `Request` and `Response` classes you know from `fetch` in the browser.

The simplest useful handler serves files from a folder by using Electron's `net.fetch` to read a `file://` URL:

```javascript
// main.js
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, 'public'); // your HTML, CSS, JS and images live here

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.join(ROOT, decodeURIComponent(pathname));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadURL('app://bundle/index.html');
});
```

Step by step:

- `new URL(request.url)` splits `app://bundle/css/site.css` into parts. `pathname` is `/css/site.css`.
- `decodeURIComponent` turns `%20` back into a space, so file names with spaces work.
- `path.join(ROOT, ...)` builds the real file path on disk.
- `pathToFileURL(...)` converts that path into a correct `file://` URL on every platform (Windows paths with drive letters and backslashes included).
- `net.fetch` reads it and returns a `Response`, with the right content type for `.html`, `.css`, `.js` and so on.

`bundle` in `app://bundle/` is the **host** part of the URL. With a standard scheme, a host is required. The name is up to you: it just becomes part of the page's origin, `app://bundle`.

Move your `index.html`, `style.css` and `renderer.js` into a `public` folder and run the app. The page loads from `app://bundle/index.html`, and relative links inside it (`<link href="style.css">`) load through your handler too.

## Step 3: stop path traversal

The handler above has a serious bug. Look at what happens with this URL:

```text
app://bundle/..%2f..%2fmain.js
```

`%2f` is an encoded `/`. After decoding, `pathname` contains `/../../main.js`, `path.join` happily walks up out of `public`, and your handler serves a file you never meant to share. With enough `../`, a malicious page could read any file the user can read. This attack is called **path traversal**.

You might think "the browser cleans up `..` in URLs". It does for plain `/../`, but not for encoded slashes like `%2f`, which only become slashes after your `decodeURIComponent`. Never rely on the URL being clean.

The fix: after building the path, check that it is still inside `ROOT`.

```javascript
// main.js
function resolveInsideRoot(root, urlPath) {
  const filePath = path.join(root, decodeURIComponent(urlPath));
  const relative = path.relative(root, filePath);
  const isInside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  return isInside ? filePath : null;
}
```

`path.relative(root, filePath)` describes how to get from `root` to `filePath`:

```text
root:     /app/public
file:     /app/public/css/site.css   ->  relative: css/site.css      (inside)
file:     /app/main.js               ->  relative: ../main.js        (outside!)
file:     D:\other\secret.txt        ->  relative: D:\other\...      (other drive, absolute)
```

If it starts with `..` or is an absolute path (which happens on Windows when the file is on a different drive), the request is trying to escape. An empty `relative` means the request was for the folder itself, which you also refuse.

## Step 4: a complete, careful handler

Put it together, and also handle missing files: `net.fetch` rejects its Promise when a file does not exist, so catch that and return a proper `404`:

```javascript
// main.js
protocol.handle('app', async (request) => {
  const { host, pathname } = new URL(request.url);
  if (host !== 'bundle') {
    return new Response('Not found', { status: 404 });
  }

  const filePath = resolveInsideRoot(ROOT, pathname === '/' ? '/index.html' : pathname);
  if (!filePath) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    return await net.fetch(pathToFileURL(filePath).toString());
  } catch {
    return new Response('Not found', { status: 404 });
  }
});
```

Test it from the DevTools console of your window:

```javascript
// DevTools console
(await fetch('app://bundle/index.html')).status; // 200
(await fetch('app://bundle/..%2f..%2fmain.js')).status; // 403
(await fetch('app://bundle/missing.png')).status; // 404
```

```text
200
403
404
```

## Responses do not have to be files

Because a handler returns any `Response`, you can also create content on the fly, like a tiny local web server with no network involved:

```javascript
// main.js (inside the handler, before the file logic)
if (pathname === '/api/info') {
  return new Response(JSON.stringify({ version: app.getVersion() }), {
    headers: { 'content-type': 'application/json' },
  });
}
```

```javascript
// renderer.js
const info = await (await fetch('app://bundle/api/info')).json();
console.log(info.version);
```

That said, for talking to the main process, IPC through your preload is still the clearer choice. Use dynamic responses for things that naturally look like files, such as thumbnails generated on demand.

You can also add headers to the responses you return, for example a Content Security Policy:

```javascript
// main.js
const response = await net.fetch(pathToFileURL(filePath).toString());
const headers = new Headers(response.headers);
headers.set('Content-Security-Policy', "default-src 'self'");
return new Response(response.body, { status: response.status, headers });
```

With a custom scheme, `'self'` in a CSP means "my `app://bundle` origin", which is exactly what you want. See [Content Security Policy](/courses/electronjs/content-security-policy).

## Using it with Forge and Vite

In a Forge Vite project, the built renderer files end up in `.vite/renderer/main_window/`. Point `ROOT` there in production and keep the dev server during development:

```javascript
// src/main.js (Forge Vite)
const ROOT = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
} else {
  mainWindow.loadURL('app://bundle/index.html');
}
```

Vite builds with relative asset paths (`./assets/...`), which resolve correctly under your standard scheme.

## Sessions and old APIs

`protocol.handle` registers the handler on the default session. If a window uses a different session (a `partition`), register the handler on that session's own protocol object: `session.fromPartition('persist:notes').protocol.handle('app', handler)`.

You may find older examples using `protocol.registerFileProtocol`, `registerBufferProtocol` or `interceptFileProtocol`. Those callback-based APIs are deprecated. `protocol.handle` with `Request`/`Response` replaces all of them.

## Common mistakes

### Registering the scheme after ready

`protocol.registerSchemesAsPrivileged` must run before the `ready` event. If you call it inside `whenReady`, it has no effect, and your scheme behaves like a non-standard one: relative URLs fail and storage is disabled.

### Forgetting standard: true

Without it, `app://bundle/index.html` may load, but `<link href="style.css">` and `<script src="renderer.js">` fail, because a non-standard scheme cannot resolve relative URLs.

### Trusting the path

Joining the URL path straight onto your folder allows path traversal. Always check the result with `path.relative` before reading anything.

### Building file URLs by hand

`'file://' + filePath` breaks on Windows (backslashes, drive letters) and on names with spaces or `#`. Use `pathToFileURL(filePath).toString()`.

## Quick recap

- A custom scheme like `app://` gives your pages a real origin and avoids `file://` problems.
- Call `protocol.registerSchemesAsPrivileged` before `ready`, usually with `standard`, `secure` and `supportFetchAPI`.
- Call `protocol.handle('app', handler)` after `ready`. The handler gets a `Request` and returns a `Response`.
- Serve files with `net.fetch(pathToFileURL(filePath).toString())`.
- Block path traversal: resolve the path, then reject it if `path.relative` starts with `..` or is absolute.
- Return `403` and `404` responses yourself, and add headers such as a CSP if you like.
- `protocol.handle` replaces the deprecated `registerFileProtocol` family.

<code id="code-content" class="language-javascript">
// main.js: serve the app from app://bundle/ with a safe protocol.handle handler
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
// --- 1. Before ready: make app: a standard, secure scheme
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
const ROOT = path.join(__dirname, 'public');
// --- 2. Map a URL path to a file, refusing anything outside ROOT
function resolveInsideRoot(root, urlPath) {
  const filePath = path.join(root, decodeURIComponent(urlPath));
  const relative = path.relative(root, filePath);
  const isInside = relative &amp;&amp; !relative.startsWith('..') &amp;&amp; !path.isAbsolute(relative);
  return isInside ? filePath : null;
}
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadURL('app://bundle/index.html');
}
app.whenReady().then(() =&gt; {
  // --- 3. After ready: answer every app:// request
  protocol.handle('app', async (request) =&gt; {
    const { host, pathname } = new URL(request.url);
    if (host !== 'bundle') return new Response('Not found', { status: 404 });
    const filePath = resolveInsideRoot(ROOT, pathname === '/' ? '/index.html' : pathname);
    if (!filePath) return new Response('Forbidden', { status: 403 });
    try {
      return await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('Not found', { status: 404 });
    }
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

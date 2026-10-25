---
publishDate: 2026-10-25T12:39
title: Content Security Policy
slug: content-security-policy
metadescription: Learn what a Content Security Policy is, add one with a meta tag or response headers in Electron, read violation messages and handle the Vite dev server.
updateDate: 2026-10-25T12:39
author: ['bishal-biswas']
level: 2
tags: ['security', 'csp', 'headers']
course: electronjs
---

## A guest list for your page

A **Content Security Policy** (CSP) is a set of rules that tells the browser engine which sources a page may load scripts, styles, images, fonts and network requests from. Anything not on the list is blocked.

Think of it as a guest list at the door of a party. You do not have to inspect every guest's intentions. If a name is not on the list, they do not get in, however convincing they are.

Why does this matter so much in Electron? Imagine an attacker manages to sneak some HTML into your page, for example through a note, a chat message or a file name shown with `innerHTML`. Without a CSP, that HTML could include a script, and the script would run with everything your preload exposes. With a strict CSP, the browser refuses to run it. CSP is your second wall: it protects you even when your first wall (careful code) has a gap.

## Step 1: see the warning

Open any app from earlier lessons that has no CSP, and look at the DevTools console. While you develop (the app is not packaged), Electron can print a warning like this:

```text
Electron Security Warning (Insecure Content-Security-Policy) This renderer process
has either no Content Security Policy set or a policy with "unsafe-eval" enabled.
This exposes users of this app to unnecessary security risks.
```

The warning is only shown during development, not to your users. But the risk is there either way, so let's fix it.

## Step 2: add a CSP with a meta tag

The simplest way is a `<meta>` tag in the `<head>` of your HTML:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>My App</title>
  </head>
  <body>
    <h1>Hello</h1>
    <script src="renderer.js"></script>
  </body>
</html>
```

Reload the window. The warning disappears and your app works exactly as before.

### Reading a policy

A policy is a list of **directives** separated by semicolons. Each directive names a kind of resource and lists allowed **sources**:

```text
default-src 'self'; script-src 'self'
└── directive ──┘  └ source ┘
```

The most useful directives:

| Directive | Controls |
| --- | --- |
| `default-src` | The fallback for any type you do not list |
| `script-src` | JavaScript files and inline scripts |
| `style-src` | CSS files, `<style>` tags and `style=""` attributes |
| `img-src` | Images |
| `font-src` | Web fonts |
| `connect-src` | `fetch`, `XMLHttpRequest` and WebSocket connections |
| `media-src` | `<audio>` and `<video>` |
| `frame-src` | Pages inside `<iframe>` |
| `object-src` | Old plugins (`<object>`, `<embed>`); set to `'none'` |
| `base-uri` | What a `<base>` tag may point to |

And the most common sources:

| Source | Means |
| --- | --- |
| `'self'` | The same origin as the page (your app's own files) |
| `'none'` | Nothing at all |
| `https://api.example.com` | That exact site |
| `https:` | Any HTTPS address |
| `data:` | `data:` URLs, for example small inline images |
| `'unsafe-inline'` | Inline `<script>`, `<style>` and `onclick=""` attributes |
| `'unsafe-eval'` | `eval()` and `new Function()` |

The single quotes around keywords like `'self'` are required. Without them, `self` would be read as a website called "self".

> **Warning:** `'unsafe-inline'` in `script-src` switches off most of the protection CSP gives you, because injected HTML is exactly "inline script". Avoid it for scripts. For `style-src` it is much less risky, and sometimes needed.

## Step 3: watch CSP block something

Add an inline script to your page to see the guest list in action:

```html
<!-- index.html (body) -->
<script>
  document.title = 'Inline script ran';
</script>
```

Reload and look at the console:

```text
Executing inline script violates the following Content Security Policy directive
'script-src 'self''. Either the 'unsafe-inline' keyword, a hash ('sha256-...'),
or a nonce ('nonce-...') is required to enable inline execution. The action has
been blocked.
```

The title does not change. This is exactly what would happen to an attacker's injected script. The message tells you which directive blocked it, which is your best tool when your own code is blocked by mistake.

The same applies to inline event attributes:

```html
<!-- index.html: blocked by script-src 'self' -->
<button onclick="save()">Save</button>
```

Move that code into `renderer.js` instead:

```javascript
// renderer.js
document.querySelector('#save').addEventListener('click', save);
```

That is a good habit anyway: HTML for structure, JavaScript files for behaviour.

### Hashes for the rare inline script

If you truly need one fixed inline script, notice the `'sha256-...'` in the error message. That is a **hash**, a fingerprint of the script's exact text. Adding it to `script-src` allows that one script and nothing else:

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'sha256-COPY_FROM_THE_ERROR'" />
```

Change one character in the script and the hash no longer matches. Most apps never need this: an external `.js` file is simpler.

## Step 4: a realistic policy

Here is a good starting point for a typical local app that also calls one web API and shows images from the web:

```html
<!-- index.html -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self';
           style-src 'self' 'unsafe-inline';
           img-src 'self' data: https:;
           connect-src 'self' https://api.example.com;
           object-src 'none';
           base-uri 'self'"
/>
```

Line breaks inside the `content` attribute are fine. Read it aloud: "By default, only my own files. Scripts only from my files. Styles from my files, plus inline styles. Images from my files, `data:` URLs or any HTTPS site. Network requests to my files and my API. No plugins. No changing the base URL."

Start strict and loosen one directive at a time when the console shows a violation you understand.

## Step 5: set CSP from the main process

The meta tag only protects pages that include it. If you load several pages, or pages you do not write yourself, you can add the policy as an HTTP **response header** from the main process instead. A header is extra information that travels with each response, before the page's HTML.

Electron's `session.webRequest.onHeadersReceived` lets you change response headers before the page sees them:

```javascript
// main.js
const { app, BrowserWindow, session } = require('electron');

const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [POLICY],
      },
    });
  });

  // ...create your windows here
});
```

- `details.responseHeaders` holds the headers the server (or file) sent.
- You must pass them on with `...details.responseHeaders`, otherwise you would delete them all.
- Header values are arrays of strings, hence `[POLICY]`.
- Set it up before you create windows, so the first page is already covered.

This works for pages loaded with `loadFile` (`file://`) as well as `https://` pages and custom protocols.

> **Note:** A session can only have one `onHeadersReceived` listener. Calling it again replaces the previous one. If you need several header changes, make them all in the same function.

### Meta tag or header?

| | Meta tag | Header from main |
| --- | --- | --- |
| Where | In each HTML file | Once, in `main.js` |
| Covers | Only that page | Every page in the session |
| Easy to see while editing HTML | Yes | No |
| Supports every directive | Most (`frame-ancestors`, for example, is ignored) | All |

You can use both. When a page has two policies, the browser enforces both, so a resource must pass each one. Many apps keep a meta tag as documentation and add the header as a safety net.

## CSP with the Vite dev server

In a Forge Vite project (see [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge)), development and the packaged app load your page differently:

- **During `npm start`**, the window loads from the Vite dev server at a `http://localhost:...` address. Vite injects CSS through `<style>` tags created by JavaScript, and keeps a WebSocket open for instant reloads. Framework plugins can add more: the React plugin, for example, adds a small inline script for Fast Refresh.
- **In the packaged app**, the page loads plain built files from disk, with no inline helpers.

A strict policy that is perfect for the packaged app can therefore break hot reloading. If you see CSP errors only during `npm start`, use a slightly looser policy while developing, and the strict one in production:

```javascript
// src/main.js (Forge Vite)
import { app, session } from 'electron';

const isDev = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);

const PROD_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'";
const DEV_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws://localhost:*";

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? DEV_POLICY : PROD_POLICY],
      },
    });
  });
  // ...createWindow()
});
```

`MAIN_WINDOW_VITE_DEV_SERVER_URL` is only set during development, so it is a handy switch. Keep any meta tag in `index.html` compatible with the dev policy (or leave it out and rely on the header), because both policies apply at the same time.

> **Tip:** Test the packaged build (`npm run package`, then run the app in `out/`) before each release. That is the only way to be sure the production policy does not block something.

## Common mistakes

### Forgetting the quotes

`default-src self` does not mean "my own files". It means "a website called self". Always write `'self'`, `'none'`, `'unsafe-inline'` with single quotes.

### Adding 'unsafe-inline' or 'unsafe-eval' to scripts to silence an error

These make the console quiet by removing the protection. Find the inline script or `eval` the message points to and move it to a file instead. If a library needs `eval`, look for a version or setting that does not.

### Dropping the other headers

```javascript
callback({ responseHeaders: { 'Content-Security-Policy': [POLICY] } }); // other headers lost
```

Without `...details.responseHeaders`, every other header (content type, caching, cookies) is thrown away. Always spread the original headers first.

### Blocking your own API calls

If `fetch` to your server fails with a "violates the following Content Security Policy directive: connect-src" message, add that exact origin to `connect-src`. Do not switch to `connect-src *`.

## Quick recap

- A CSP is a guest list for scripts, styles, images and connections. Anything not listed is blocked.
- Add it with `<meta http-equiv="Content-Security-Policy" ...>` or as a header with `session.defaultSession.webRequest.onHeadersReceived`.
- Start from `default-src 'self'; script-src 'self'` and loosen one directive at a time.
- Inline scripts and `onclick=""` attributes are blocked by a strict policy. Move code into `.js` files.
- Read the console's violation message: it names the directive that blocked the resource.
- The Vite dev server may need a looser development policy. Use the strict one in the packaged app and test the packaged build.

<code id="code-content" class="language-javascript">
// main.js: apply a Content Security Policy header to every page in the default session
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
// --- 1. Build the policy from readable pieces
const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.example.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
  // --- 3. Violations show up as console messages: log them while developing
  win.webContents.on('console-message', (event) =&gt; {
    if (event.message.includes('Content Security Policy')) console.warn('[CSP]', event.message);
  });
}
app.whenReady().then(() =&gt; {
  // --- 2. Add the header before any window loads (keep the original headers!)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) =&gt; {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [POLICY],
      },
    });
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

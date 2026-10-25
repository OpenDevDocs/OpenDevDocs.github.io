---
publishDate: 2026-10-25T12:40
title: Loading Remote Content Safely
slug: loading-remote-content-safely
metadescription: Show third-party websites in Electron without risking your app. Skip the preload, lock navigation, block pop-ups, deny permissions and use separate partitions.
updateDate: 2026-10-25T12:40
author: ['bishal-biswas']
level: 3
tags: ['security', 'remote-content', 'navigation']
course: electronjs
---

## Your code versus someone else's code

Up to now, every page in your windows was written by you and shipped inside your app. Sometimes an app also needs to show pages it does not control:

- A help window that shows your online documentation.
- A "Sign in with ..." page from another company.
- A dashboard that wraps a web app, such as a team chat or a mail client.
- A small built-in browser.

That is **remote content**: code from the internet that runs inside your app. You must assume it can be hostile, even if it comes from a site you trust today. Sites get hacked, ad networks serve bad scripts, and a link can lead anywhere.

The everyday picture: your app is a hotel. Your own pages are staff with keys to the back office. Remote pages are guests. Guests get a comfortable room, but no key to the back office, no access to the other guests' rooms, and if they wander toward the staff-only door, someone politely turns them around.

This lesson shows how to give remote content a room without keys. It builds on [Electron Security Checklist](/courses/electronjs/security-checklist).

## The plan

For any window or view that shows remote content:

1. **No preload**, or a tiny one that exposes nothing powerful.
2. **Sandbox and context isolation on**, Node.js off (the defaults).
3. **Its own session partition**, so its cookies and storage are separate from your app's.
4. **HTTPS only.**
5. **Navigation locked** to an allow-list of sites.
6. **Pop-ups denied**, with links opened in the user's real browser.
7. **Permissions denied** unless you have a reason to allow one.

Let's build a help window step by step.

## Step 1: a window with no preload

```javascript
// main.js
const { app, BrowserWindow } = require('electron');

function openHelpWindow() {
  const help = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Help',
    webPreferences: {
      // no preload: this page gets no window.api at all
      partition: 'help', // a separate, in-memory session (see Step 2)
    },
  });
  help.loadURL('https://www.electronjs.org/docs/latest/');
  return help;
}

app.whenReady().then(openHelpWindow);
```

The most important line is the one that is **not** there. Without a preload, the remote page has nothing from your app to call. It is just a web page in a sandboxed renderer, like a tab in Chrome.

> **Warning:** Never reuse your main window's preload for remote content. Every function it exposes (`saveFile`, `readSettings`, ...) becomes available to that website and anything injected into it.

If you truly need to give a remote page one ability (for example, telling your app that sign-in finished), write a separate, tiny preload for it and validate that IPC message in main, including checking `event.senderFrame.url` belongs to the expected site.

## Step 2: keep its data separate with a partition

Every window uses a **session**: the place where cookies, local storage, cache and permission decisions are kept. By default all windows share `session.defaultSession`.

The `partition` option gives a window its own session:

- `partition: 'help'` creates an **in-memory** session. Everything is forgotten when the app quits. Good for one-off content.
- `partition: 'persist:help'` creates a session saved on disk, so logins survive restarts. The `persist:` prefix is what makes it permanent.

Separate partitions mean the remote site cannot read your app's local storage or cookies, and its cookies do not leak into your other windows. Two windows with the same partition name share the same session. You will explore sessions in [Sessions, Cookies and Permissions](/courses/electronjs/sessions-cookies-and-permissions).

## Step 3: lock navigation to an allow-list

Without a lock, a link on the help site could take the window to any site on the internet, and the user might never notice, because Electron windows usually have no address bar. You control this with three `webContents` events:

- `will-navigate`: the page itself wants to go somewhere else (link click, `location.href = ...`).
- `will-redirect`: a server answered with a redirect to another address.
- `will-frame-navigate`: like `will-navigate`, but also fires for `<iframe>` frames inside the page.

Each event object has the target address in `event.url`, and `event.preventDefault()` cancels the navigation.

```javascript
// main.js
const { shell } = require('electron');

const ALLOWED_ORIGINS = new Set(['https://www.electronjs.org']);

function isAllowed(url) {
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

function lockNavigation(contents) {
  const guard = (event) => {
    if (isAllowed(event.url)) return;
    event.preventDefault();
    if (event.url.startsWith('https://')) shell.openExternal(event.url);
  };
  contents.on('will-navigate', guard);
  contents.on('will-redirect', guard);
}
```

An **origin** is the scheme, host and port of a URL, such as `https://www.electronjs.org`. Comparing origins is much safer than checking `url.includes('electronjs.org')`, which would happily accept `https://electronjs.org.evil.example`.

Links to other sites are not lost: they open in the user's own browser, which has an address bar and its own protections.

> **Note:** `will-navigate` is not fired for navigations you start yourself with `loadURL`, or for in-page jumps like `#section`. It is exactly the "page wants to leave" signal you need.

## Step 4: deny pop-ups

`window.open()` and `target="_blank"` links create new windows. A new window opened from remote content would not have your navigation lock, so deny them and use the browser instead:

```javascript
// main.js
function blockPopups(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}
```

The handler receives details about the request, including `url` and `disposition` (for example `foreground-tab` for a normal `target="_blank"` link). Returning `{ action: 'deny' }` stops Electron from creating the window.

## Step 5: deny permissions

A website can ask for the camera, microphone, location, notifications, screen capture and more. Electron grants these automatically unless you say otherwise. For a help page, the answer to everything is no:

```javascript
// main.js
const { session } = require('electron');

function denyAllPermissions(ses) {
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });
  ses.setPermissionCheckHandler(() => false);
}

app.whenReady().then(() => {
  denyAllPermissions(session.fromPartition('help'));
});
```

The **request handler** answers when a page actively asks ("may I use the microphone?"). The **check handler** answers when a page quietly asks "do I already have permission?". Set both. Because the handlers belong to the session, they cover every window using the `help` partition.

## Step 6: apply the rules everywhere

Windows are not the only thing that can show web content. Views and `<webview>` tags have their own `webContents`. The `web-contents-created` app event fires for every one of them, which makes it the right place for rules that must never be forgotten:

```javascript
// main.js
app.on('web-contents-created', (event, contents) => {
  blockPopups(contents);
  lockNavigation(contents);

  // If anything tries to use <webview>, strip its preload and force safe settings
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    if (!isAllowed(params.src)) event.preventDefault();
  });
});
```

Note that this also applies the lock to your **own** windows. That is usually what you want: your local app pages should not navigate to the internet either. If your own pages need to navigate between local files, add their origin to your allow-check.

## Step 7: HTTPS only, and no certificate shortcuts

Only load remote content over `https://`. Plain `http://` traffic can be read and changed by anyone between the user and the server.

You may come across code that "fixes" certificate errors like this:

```javascript
// main.js: don't do this
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true); // trust every certificate, even fake ones
});
```

A certificate error is the browser telling you it cannot prove who the server is. Accepting all of them removes the "S" from HTTPS. Leave the default behaviour, which rejects them.

## Showing remote content inside your own window

Sometimes you want the remote page as part of your window, for example a toolbar you wrote above an embedded site. Use a `WebContentsView` for the remote part and apply the same rules to its `webContents`: no preload, its own partition, the navigation lock and the window-open handler. [Embedding Web Content with WebContentsView](/courses/electronjs/webcontentsview) shows how to size and position the view.

An `<iframe>` inside your own page is also possible, but then the remote site shares your page's renderer process, so a strict CSP `frame-src` list (see [Content Security Policy](/courses/electronjs/content-security-policy)) and the `will-frame-navigate` event matter even more. For anything beyond a small trusted widget, prefer a separate view.

## Common mistakes

### Giving the remote window your app's preload

This is the most serious mistake on this page. It turns "a website" into "a website that can call your app's main process". Use no preload, or a separate minimal one.

### Checking URLs with includes or startsWith on the host

`url.startsWith('https://example.com')` also matches `https://example.com.attacker.net`. Parse the URL and compare `new URL(url).origin` against an exact list.

### Locking only will-navigate

A page can still escape through a server redirect or a pop-up. Handle `will-redirect` and `setWindowOpenHandler` too.

### Sharing the default session

If the remote page uses `session.defaultSession`, it shares cookies and storage with your app pages and inherits your permission handler. Give it its own `partition`.

## Quick recap

- Treat every remote page as untrusted, even from sites you like.
- Load it without a preload, with the default sandbox and context isolation, over HTTPS only.
- Use a separate `partition` so its cookies and storage stay apart from your app's.
- Lock navigation with `will-navigate` and `will-redirect`, comparing exact origins.
- Deny pop-ups with `setWindowOpenHandler` and open outside links with `shell.openExternal`.
- Deny permissions with `setPermissionRequestHandler` and `setPermissionCheckHandler` on that session.
- Apply rules to all web contents with `app.on('web-contents-created', ...)`, and never accept bad certificates.

<code id="code-content" class="language-javascript">
// main.js: show a third-party site in a locked-down help window
const { app, BrowserWindow, session, shell } = require('electron');
const ALLOWED_ORIGINS = new Set(['https://www.electronjs.org']);
const HELP_PARTITION = 'help'; // in-memory; use 'persist:help' to keep logins
// --- 1. Exact origin checks, never string matching on the host
function isAllowed(url) {
  try {
    return ALLOWED_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}
function openOutside(url) {
  if (url.startsWith('https://')) shell.openExternal(url);
}
// --- 2. Rules for every webContents: navigation lock, no pop-ups, safe webviews
app.on('web-contents-created', (event, contents) =&gt; {
  const guard = (event) =&gt; {
    if (isAllowed(event.url)) return;
    event.preventDefault();
    openOutside(event.url);
  };
  contents.on('will-navigate', guard);
  contents.on('will-redirect', guard);
  contents.setWindowOpenHandler(({ url }) =&gt; {
    openOutside(url);
    return { action: 'deny' };
  });
  contents.on('will-attach-webview', (event, webPreferences, params) =&gt; {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    if (!isAllowed(params.src)) event.preventDefault();
  });
});
// --- 3. A window with no preload and its own session
function openHelpWindow() {
  const help = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Help',
    webPreferences: { partition: HELP_PARTITION }, // no preload on purpose
  });
  help.loadURL('https://www.electronjs.org/docs/latest/');
}
app.whenReady().then(() =&gt; {
  // --- 4. Deny every permission in the help session
  const helpSession = session.fromPartition(HELP_PARTITION);
  helpSession.setPermissionRequestHandler((webContents, permission, callback) =&gt; callback(false));
  helpSession.setPermissionCheckHandler(() =&gt; false);
  openHelpWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) openHelpWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

---
publishDate: 2026-10-25T12:42
title: Sessions, Cookies and Permissions
slug: sessions-cookies-and-permissions
metadescription: Use Electron sessions and partitions to separate storage, read and write cookies, control camera and screen permissions, and clear user data on sign-out.
updateDate: 2026-10-25T12:42
author: ['bishal-biswas']
level: 3
tags: ['session', 'cookies', 'permissions']
course: electronjs
---

## What a session is

When you browse the web in Chrome, the browser remembers things for you: you stay logged in (cookies), sites keep data (local storage, IndexedDB), pages load faster (the cache), and the browser remembers that you allowed a site to use your microphone (permissions). All of that together is a browser **profile**.

In Electron, the same idea is called a **session**. Every window's web contents uses one session, and the session holds:

- **Cookies**: small named values a site stores, often used to keep you logged in.
- **Storage**: `localStorage`, IndexedDB, Cache Storage, service workers.
- **The HTTP cache**: saved copies of downloaded files.
- **Permission handlers**: your code that decides "may this page use the camera?".
- **Network hooks** such as `webRequest`, and protocol handlers.

Think of sessions as separate wallets. Each wallet has its own cards, receipts and membership passes. Two windows with the same wallet share everything in it. A window with a different wallet cannot see what is in yours.

By default every window uses the same wallet: `session.defaultSession`.

## Step 1: separate sessions with partitions

You choose a window's session with the `partition` web preference:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const work = new BrowserWindow({ webPreferences: { partition: 'persist:work' } });
  const personal = new BrowserWindow({ webPreferences: { partition: 'persist:personal' } });
  const guest = new BrowserWindow({ webPreferences: { partition: 'guest' } });

  work.loadURL('https://mail.example.com');
  personal.loadURL('https://mail.example.com');
  guest.loadURL('https://mail.example.com');
});
```

These three windows show the same site, but each has its own cookies. You could be signed in as two different people at once. That is how multi-account apps (mail, chat, social) work.

The name rules:

| Partition | Kind | What happens on quit |
| --- | --- | --- |
| (none) | `session.defaultSession` | Saved on disk |
| `'persist:work'` | Persistent | Saved on disk in its own folder |
| `'guest'` | In-memory | Forgotten when the app quits |

The `persist:` prefix is the only difference between "saved" and "forgotten". In-memory sessions are perfect for a private "guest mode" or for remote content you do not want to remember.

### Getting a session object

To configure a session in code (cookies, permissions, clearing data), get its object with `session.fromPartition`, using the same string:

```javascript
// main.js
const { session } = require('electron');

app.whenReady().then(() => {
  const workSession = session.fromPartition('persist:work');
  console.log(workSession.isPersistent()); // true
  console.log(workSession.getStoragePath()); // where its data lives on disk

  const guestSession = session.fromPartition('guest');
  console.log(guestSession.isPersistent()); // false
  console.log(guestSession.getStoragePath()); // null: nothing on disk
});
```

```text
true
C:\Users\asha\AppData\Roaming\my-app\Partitions\work
false
null
```

Persistent partitions live in a `Partitions` folder inside `userData` (see [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data)).

> **Note:** Sessions can only be used after the app is ready. Calling `session.fromPartition` the same way twice returns the same session object, so you can call it wherever you need it.

You can also get the session of an existing window with `win.webContents.session`.

## Step 2: work with cookies

Each session has a `cookies` object. All its methods return Promises.

### Reading cookies

```javascript
// main.js
const ses = session.fromPartition('persist:work');

const all = await ses.cookies.get({});
const forSite = await ses.cookies.get({ url: 'https://mail.example.com' });
const one = await ses.cookies.get({ url: 'https://mail.example.com', name: 'theme' });

console.log(forSite);
```

```text
[
  {
    name: 'theme',
    value: 'dark',
    domain: 'mail.example.com',
    hostOnly: true,
    path: '/',
    secure: true,
    httpOnly: false,
    session: false,
    expirationDate: 1792933972,
    sameSite: 'lax'
  }
]
```

The object you pass is a **filter**. `{}` matches every cookie in the session. Add `url`, `name` or `domain` to narrow it down.

### Setting a cookie

```javascript
// main.js
await ses.cookies.set({
  url: 'https://mail.example.com',
  name: 'theme',
  value: 'dark',
  secure: true,
  httpOnly: false,
  expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
});
```

- `url` is required. It decides which site the cookie belongs to.
- `expirationDate` is in **seconds** since 1970, not milliseconds. Leave it out to make a **session cookie** that disappears when the app quits.
- `httpOnly: true` hides the cookie from the page's JavaScript (`document.cookie`). Use it for login tokens.

### Removing and saving

```javascript
// main.js
await ses.cookies.remove('https://mail.example.com', 'theme');
await ses.cookies.flushStore(); // write any pending cookie changes to disk now
```

Electron writes cookies to disk on its own schedule. `flushStore()` is useful right before something important, such as quitting after a sign-in.

### Watching for changes

```javascript
// main.js
ses.cookies.on('changed', (event, cookie, cause, removed) => {
  console.log(`${cookie.name} ${removed ? 'removed' : 'set'} (${cause})`);
});
```

This is handy for noticing when a site signs the user in or out, for example by watching for its login cookie.

## Step 3: control permissions

Web pages can ask for powerful features: camera, microphone, location, notifications, screen capture, USB devices and more. In Chrome, a prompt asks the user. **In Electron, every request is approved automatically** unless you set a handler. You decide with two session methods:

- `setPermissionRequestHandler`: called when a page actively **asks** for a permission (for example `getUserMedia()` for the camera).
- `setPermissionCheckHandler`: called when a page or Chromium quietly **checks** whether it already has one (for example `navigator.permissions.query()`).

### The request handler

```javascript
// main.js
const { app, session, dialog, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    const origin = new URL(details.requestingUrl).origin;

    if (permission === 'notifications') {
      return callback(true); // always fine for this app
    }

    if (permission === 'media' || permission === 'display-capture') {
      const win = BrowserWindow.fromWebContents(webContents);
      const what = permission === 'media' ? 'your camera or microphone' : 'your screen';
      const { response } = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Allow', 'Deny'],
        defaultId: 1,
        cancelId: 1,
        message: `${origin} wants to use ${what}.`,
      });
      return callback(response === 0);
    }

    callback(false); // everything else: no
  });
});
```

The handler gets:

- `webContents`: which page is asking.
- `permission`: a string such as `'media'`, `'display-capture'`, `'geolocation'`, `'notifications'`, `'clipboard-read'`, `'fullscreen'` or `'openExternal'`.
- `callback`: call it exactly once with `true` (allow) or `false` (deny). You can call it later, after asking the user.
- `details`: extra information, such as `requestingUrl`, and for `media` requests, `mediaTypes` (`['video']`, `['audio']` or both).

Always check **who** is asking, not just **what**. A permission you happily give your own page should not automatically go to an embedded third-party site.

> **Note:** Since Electron 45, screen sharing requests (`navigator.mediaDevices.getDisplayMedia()` and desktop capture through `getUserMedia`) are reported as the `display-capture` permission. Before that, they arrived as `media` with an empty `mediaTypes` list. If your handler only allows `media`, screen sharing stops working until you also allow `display-capture`.

### The check handler

```javascript
// main.js
ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
  if (permission === 'notifications') return true;
  if (permission === 'media') return requestingOrigin === 'https://meet.example.com';
  return false;
});
```

The check handler must answer **immediately** with `true` or `false`; it cannot wait for a dialog. Keep its answers consistent with your request handler, otherwise a page may think it has a permission that a request then refuses (or the other way round).

### Try it

Open DevTools in a window using that session and run:

```javascript
// DevTools console
await Notification.requestPermission(); // 'granted'
(await navigator.permissions.query({ name: 'geolocation' })).state; // 'denied'
```

```text
'granted'
'denied'
```

Permission handlers belong to a session, so different partitions can have different rules: generous for your own app pages, strict for remote content (see [Loading Remote Content Safely](/courses/electronjs/loading-remote-content-safely)).

## Step 4: clear data on sign-out

When a user signs out, or clicks "Clear browsing data" in your app, wipe the session's stored data:

```javascript
// main.js
async function signOut(partition) {
  const ses = session.fromPartition(partition);
  await ses.clearStorageData(); // cookies, localStorage, IndexedDB, service workers, ...
  await ses.clearCache(); // the HTTP cache
}
```

`clearStorageData` can be more targeted. Pass `storages` to choose what to remove, and `origin` to limit it to one site:

```javascript
// main.js
await ses.clearStorageData({
  origin: 'https://mail.example.com',
  storages: ['cookies', 'localstorage'],
});
```

The allowed `storages` values are `cookies`, `filesystem`, `indexdb`, `localstorage`, `shadercache`, `serviceworkers` and `cachestorage`. Note the spelling `indexdb`, without "ed". `origin` must look like `scheme://host:port`, the same as `window.location.origin`.

After clearing, reload any open windows that use the session so they start fresh.

## Putting it together: an account switcher

Here is how the pieces combine in a multi-account app. Each account gets its own persistent partition, the same permission rules, and a sign-out that wipes only that account:

```javascript
// main.js
const accounts = new Map(); // id -> BrowserWindow

function setupSession(partition) {
  const ses = session.fromPartition(partition);
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'notifications');
  });
  ses.setPermissionCheckHandler((webContents, permission) => permission === 'notifications');
  return ses;
}

function openAccount(id) {
  const partition = `persist:account-${id}`;
  setupSession(partition);
  const win = new BrowserWindow({ width: 1000, height: 700, webPreferences: { partition } });
  win.loadURL('https://mail.example.com');
  accounts.set(id, win);
}

async function signOutAccount(id) {
  const ses = session.fromPartition(`persist:account-${id}`);
  await ses.clearStorageData();
  await ses.clearCache();
  accounts.get(id)?.close();
  accounts.delete(id);
}
```

Account IDs end up in folder names, so keep them simple (letters, digits, dashes).

## Common mistakes

### Forgetting the persist: prefix

`partition: 'work'` looks persistent but is in-memory: users are logged out every time the app restarts. Use `'persist:work'` when data should survive.

### Setting handlers on the wrong session

`session.defaultSession.setPermissionRequestHandler(...)` does nothing for windows using `partition: 'persist:work'`. Set handlers on every session you use, or loop over your partitions at startup.

### Leaving permissions on the default "allow everything"

If you never set a request handler, any page in your app, including embedded sites, can turn on the camera or read the user's location without asking. Always set one, even if it only says `callback(false)`.

### Using milliseconds for expirationDate

`expirationDate: Date.now() + 86400000` sets a date thousands of years in the future, because the value is read as seconds. Divide by 1000.

## Quick recap

- A session holds cookies, storage, cache and permission rules. Windows share `session.defaultSession` unless you choose a `partition`.
- `'persist:name'` partitions are saved on disk; names without `persist:` are in-memory and forgotten on quit.
- Get a session with `session.fromPartition(name)` or `win.webContents.session`.
- Use `ses.cookies.get`, `set`, `remove` and `flushStore`; `expirationDate` is in seconds.
- Electron allows all permissions unless you set `setPermissionRequestHandler` and `setPermissionCheckHandler`.
- Screen capture is reported as `display-capture` since Electron 45, separate from `media`.
- Clear user data with `clearStorageData()` (optionally by `origin` and `storages`) and `clearCache()`.

<code id="code-content" class="language-javascript">
// main.js: separate sessions per account, cookies, permissions and sign-out
const { app, BrowserWindow, session } = require('electron');
const accounts = new Map();
// --- 1. One persistent partition per account, with strict permission rules
function setupSession(partition) {
  const ses = session.fromPartition(partition);
  ses.setPermissionRequestHandler((webContents, permission, callback, details) =&gt; {
    const origin = new URL(details.requestingUrl).origin;
    if (permission === 'notifications') return callback(true);
    // Since Electron 45, screen sharing arrives as 'display-capture', not 'media'
    if (permission === 'media' || permission === 'display-capture') {
      return callback(origin === 'https://meet.example.com');
    }
    callback(false);
  });
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) =&gt; {
    if (permission === 'notifications') return true;
    return permission === 'media' &amp;&amp; requestingOrigin === 'https://meet.example.com';
  });
  return ses;
}
// --- 2. Cookies: read, write (expirationDate in seconds) and watch
async function rememberTheme(ses, theme) {
  await ses.cookies.set({
    url: 'https://mail.example.com',
    name: 'theme',
    value: theme,
    secure: true,
    expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  });
  const cookies = await ses.cookies.get({ url: 'https://mail.example.com' });
  console.log(cookies.map((c) =&gt; `${c.name}=${c.value}`).join('; '));
}
function openAccount(id) {
  const partition = `persist:account-${id}`;
  const ses = setupSession(partition);
  ses.cookies.on('changed', (event, cookie, cause, removed) =&gt; {
    console.log(`[${id}] ${cookie.name} ${removed ? 'removed' : 'set'} (${cause})`);
  });
  const win = new BrowserWindow({ width: 1000, height: 700, webPreferences: { partition } });
  win.loadURL('https://mail.example.com');
  accounts.set(id, win);
  rememberTheme(ses, 'dark');
}
// --- 3. Sign-out wipes only that account's data
async function signOutAccount(id) {
  const ses = session.fromPartition(`persist:account-${id}`);
  await ses.clearStorageData();
  await ses.clearCache();
  accounts.get(id)?.close();
  accounts.delete(id);
}
app.whenReady().then(() =&gt; {
  openAccount('work');
  openAccount('personal');
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) openAccount('work');
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

---
publishDate: 2026-10-25T12:32
title: Saving User Settings
slug: saving-user-settings
metadescription: "Build a small Electron settings store: a JSON file in userData with defaults, validation, safe atomic writes and IPC so your page can change settings."
updateDate: 2026-10-25T12:32
author: ['bishal-biswas']
level: 2
tags: ['settings', 'json', 'user-data']
course: electronjs
---

## What settings are, and where they go

**Settings** (or preferences) are the small choices a user makes and expects your app to remember: light or dark theme, font size, whether notifications are on, the last folder they opened. They are small, but losing them is very annoying. Imagine choosing dark mode every single time you start an app.

In this lesson you will build a tiny **settings store**: a module in the main process that keeps settings in memory, saves them to a JSON file, and lets your page read and change them through IPC.

Think of it like a printed form with your own notes on it. The printed form holds the **defaults** (font size 16, theme "system"). You only write down the things you changed. When you read the form, your notes win, and anything you did not change shows the printed default.

### Why a file in `userData`?

You learned in [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data) that `app.getPath('userData')` is your app's private folder. A `settings.json` file there is the classic choice.

You may wonder: why not `localStorage` in the page? It does work for page-only things, but it has two problems for settings:

- `localStorage` lives in the renderer. Main cannot read it, and main needs settings **before** any window exists, for example to set the theme or decide whether to show a tray icon.
- It is tied to the page's address. Load the page from a different place, and your settings seem to vanish.

A JSON file read by main avoids both problems.

## The plan

You will build three pieces:

1. `settings.js`: a module in main with defaults, validation, loading and saving.
2. IPC handlers in `main.js`, plus a small preload API.
3. A settings form in the page.

Your folder will look like this:

```text
my-app/
  package.json
  main.js
  settings.js
  preload.js
  index.html
  styles.css
  renderer.js
```

## Step 1: defaults and validation

Create `settings.js` next to `main.js`. Start with the defaults and one check per setting:

```javascript
// settings.js
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  theme: 'system',
  fontSize: 16,
  notifications: true,
  lastFolder: null,
});

const VALIDATORS = {
  theme: (value) => ['system', 'light', 'dark'].includes(value),
  fontSize: (value) => Number.isInteger(value) && value >= 10 && value <= 32,
  notifications: (value) => typeof value === 'boolean',
  lastFolder: (value) => value === null || typeof value === 'string',
};

function isValid(key, value) {
  return Object.hasOwn(VALIDATORS, key) && VALIDATORS[key](value);
}
```

- `Object.freeze()` makes the defaults read-only, so no code can change them by accident.
- Each **validator** is a small function that answers "is this a sensible value?". A font size of `"huge"` or `5000` is rejected.
- `Object.hasOwn(VALIDATORS, key)` makes sure the key is one you defined. It also blocks sneaky keys like `__proto__`, which could otherwise mess with JavaScript objects.

Validation matters twice: when values come from the page, and when values come from the file. Users (or other programs) sometimes edit settings files by hand.

## Step 2: loading, with a safety net

Add the loading code to `settings.js`:

```javascript
// settings.js (continued)
let current = { ...DEFAULTS };

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function load() {
  const file = settingsFile();
  let saved = {};

  try {
    saved = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // The file exists but is broken: keep a copy for debugging, then start fresh
      console.warn('Settings file could not be read, using defaults:', error.message);
      await fs.rename(file, `${file}.broken`).catch(() => {});
    }
  }

  current = { ...DEFAULTS };
  for (const [key, value] of Object.entries(saved ?? {})) {
    if (isValid(key, value)) current[key] = value;
  }
  return getAll();
}

function getAll() {
  return { ...current };
}

function get(key) {
  return current[key];
}
```

Three situations are handled:

| Situation | What happens |
| --- | --- |
| First run, no file yet | `readFile` fails with `ENOENT` ("no such file"). That is normal, so you quietly use the defaults. |
| The file is fine | Its values are checked one by one and placed on top of the defaults. |
| The file is broken (bad JSON) | It is renamed to `settings.json.broken` and the app starts with defaults instead of crashing. |

The **merge** with defaults is important for updates too. When version 2 of your app adds a new setting, old settings files do not have it. Starting from `{ ...DEFAULTS }` means the new setting simply gets its default value.

`getAll()` returns a **copy** (`{ ...current }`), so other code cannot change your settings by accident without going through validation.

## Step 3: saving safely with an atomic write

The obvious way to save is `fs.writeFile('settings.json', data)`. But what if the computer loses power, or the app crashes, halfway through that write? You could be left with half a file, which is broken JSON, and the user's settings are gone.

The fix is an **atomic write**. "Atomic" means it either happens completely or not at all:

1. Write the new content to a **temporary file**, `settings.json.tmp`.
2. **Rename** the temporary file to `settings.json`.

Renaming a file on the same disk is a single, instant step for the operating system. It replaces the old file in one go. So at any moment, `settings.json` is either the complete old version or the complete new version, never half of each.

```javascript
// settings.js (continued)
let writing = Promise.resolve(); // the chain of pending writes

async function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, file); // replaces the old file in one step
}

function save() {
  const data = JSON.stringify(current, null, 2);
  writing = writing
    .then(() => writeAtomic(settingsFile(), data))
    .catch((error) => console.error('Could not save settings:', error.message));
  return writing;
}

function set(key, value) {
  if (!isValid(key, value)) return false;
  current[key] = value;
  save();
  return true;
}

function flush() {
  return writing; // resolves when every pending write has finished
}

module.exports = { load, get, getAll, set, flush, DEFAULTS };
```

Why the `writing` chain? If the user changes two settings very quickly, two saves start almost together. Both would write to the same `.tmp` file at the same time and could mix up the content. Chaining each write onto the previous one with `.then()` makes them run one after another, in order. The last change always wins.

`JSON.stringify(current, null, 2)` turns the object into nicely indented text, which is easy to read if you ever open the file.

## Step 4: using the store in main

Now connect it in `main.js`. Load settings **before** creating the window, so the theme is right from the first frame:

```javascript
// main.js
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('node:path');
const settings = require('./settings');

// Only these keys may be read or changed by the page
const PAGE_KEYS = ['theme', 'fontSize', 'notifications'];

function pageSettings() {
  const all = settings.getAll();
  return Object.fromEntries(PAGE_KEYS.map((key) => [key, all[key]]));
}

ipcMain.handle('settings:get', () => pageSettings());

ipcMain.handle('settings:set', (event, key, value) => {
  if (!PAGE_KEYS.includes(key)) return { ok: false, settings: pageSettings() };

  const ok = settings.set(key, value);
  if (ok && key === 'theme') nativeTheme.themeSource = value;
  if (ok) {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('settings:changed', pageSettings());
    }
  }
  return { ok, settings: pageSettings() };
});

app.whenReady().then(async () => {
  await settings.load();
  nativeTheme.themeSource = settings.get('theme');
  createWindow();
});
```

A few design choices:

- `PAGE_KEYS` is an **allow list**. `lastFolder` is not on it, because only main should set it, from dialogs (see [Native Dialogs](/courses/electronjs/native-dialogs)). The page cannot read or change it.
- After a successful change, every open window gets `settings:changed`, so a second window updates too.
- The theme is applied with `nativeTheme.themeSource`, exactly as in [Dark Mode with nativeTheme](/courses/electronjs/dark-mode-with-nativetheme).

Main code can use the store directly. For example, after an open dialog:

```javascript
// main.js (inside a dialog handler)
settings.set('lastFolder', path.dirname(result.filePaths[0]));
```

### Do not lose the last change on quit

Saving takes a few milliseconds. If the user changes a setting and quits immediately, the app might exit before the write finishes. Make the app wait for pending writes:

```javascript
// main.js
let settingsFlushed = false;

app.on('will-quit', (event) => {
  if (settingsFlushed) return;
  event.preventDefault(); // pause quitting
  settings.flush().finally(() => {
    settingsFlushed = true;
    app.quit(); // quit again, this time for real
  });
});
```

## Step 5: the preload and the page

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
  getAll: () => ipcRenderer.invoke('settings:get'),
  set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  onChanged: (callback) => ipcRenderer.on('settings:changed', (_event, all) => callback(all)),
});
```

```html
<!-- index.html (inside <body>) -->
<h1>Settings</h1>
<label>Theme
  <select id="theme">
    <option value="system">System</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
</label>
<label>Font size <input id="fontSize" type="number" min="10" max="32" /></label>
<label><input id="notifications" type="checkbox" /> Show notifications</label>
<p id="status"></p>
<script src="renderer.js"></script>
```

```javascript
// renderer.js
const theme = document.getElementById('theme');
const fontSize = document.getElementById('fontSize');
const notifications = document.getElementById('notifications');
const status = document.getElementById('status');

function show(all) {
  theme.value = all.theme;
  fontSize.value = all.fontSize;
  notifications.checked = all.notifications;
  document.documentElement.style.setProperty('--font-size', `${all.fontSize}px`);
}

async function change(key, value) {
  const result = await window.settings.set(key, value);
  status.textContent = result.ok ? 'Saved.' : 'That value is not allowed.';
  show(result.settings);
}

theme.addEventListener('change', () => change('theme', theme.value));
fontSize.addEventListener('change', () => change('fontSize', Number(fontSize.value)));
notifications.addEventListener('change', () => change('notifications', notifications.checked));

window.settings.getAll().then(show);
window.settings.onChanged(show);
```

```css
/* styles.css */
:root {
  --font-size: 16px;
}

body {
  font-size: var(--font-size);
}
```

Run the app. Choose "Dark", set the font size to 20 and untick notifications. Quit the app completely, then start it again: everything is exactly as you left it. Try typing `99` as the font size: the page says "That value is not allowed." and the field jumps back.

Open the `userData` folder and look at `settings.json`:

```json
{
  "theme": "dark",
  "fontSize": 20,
  "notifications": false,
  "lastFolder": null
}
```

Now break it on purpose: delete the last `}` and save the file. Start the app. It starts with the defaults instead of crashing, and you find your broken file renamed to `settings.json.broken`.

## A ready-made option: `electron-store`

What you just built is a small version of a very popular npm package called **`electron-store`**. It saves settings as JSON in `userData` too, and adds extras such as schema validation, migrations between app versions and change listeners. Many real apps use it.

Writing your own first means you understand what such a package does for you, and for a handful of settings, the few dozen lines here are often all you need. If you do try `electron-store`, check its README for how to import it and use it from the main process.

## What not to put in settings

- **Passwords, tokens and API keys.** A JSON file is plain text that anyone with access to the computer can read. Encrypt secrets with [safeStorage](/courses/electronjs/safestorage-secrets) instead.
- **Large or growing data**, such as all of the user's notes. Use separate files or [a local database](/courses/electronjs/local-database-with-sqlite).
- **Window size and position.** You can store them here, but they change constantly while the user drags the window. [Remembering Window Size and Position](/courses/electronjs/remembering-window-state) shows how to handle that well.

## Common mistakes

### Writing the file directly

`fs.writeFile('settings.json', ...)` can leave a half-written file if the app crashes during the write. Write to a temporary file and `rename()` it.

### Crashing on a broken file

`JSON.parse()` throws on invalid JSON. Catch it, keep a copy of the bad file, and fall back to the defaults so the app always starts.

### Trusting keys and values from the page

Accept only keys from an allow list and check every value. Otherwise a page bug could store `fontSize: "abc"` and break your layout on every start.

### Loading settings too late

If you create the window before `await settings.load()`, the first frame uses the defaults and then flickers into the user's theme. Load first, then create windows.

## Quick recap

- Keep settings in a JSON file in `app.getPath('userData')`, read and written by main.
- Start from frozen `DEFAULTS` and lay the saved values on top, so new settings get defaults automatically.
- Validate every value with a small function per key, both from the file and from the page.
- Handle a missing file (`ENOENT`) quietly, and a broken file by renaming it and using defaults.
- Save atomically: write `settings.json.tmp`, then `rename()` it over `settings.json`. Chain writes so they never overlap.
- Wait for pending writes in `will-quit` so the last change is not lost.
- Expose only allowed keys to the page through `invoke`, and broadcast changes with `webContents.send()`.
- `electron-store` is a popular package that does the same job with extra features.

<code id="code-content" class="language-javascript">
// settings.js: a tiny settings store (require it from main.js)
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
// --- 1. Defaults and one validator per key
const DEFAULTS = Object.freeze({ theme: 'system', fontSize: 16, notifications: true, lastFolder: null });
const VALIDATORS = {
  theme: (v) =&gt; ['system', 'light', 'dark'].includes(v),
  fontSize: (v) =&gt; Number.isInteger(v) &amp;&amp; v &gt;= 10 &amp;&amp; v &lt;= 32,
  notifications: (v) =&gt; typeof v === 'boolean',
  lastFolder: (v) =&gt; v === null || typeof v === 'string',
};
const isValid = (key, value) =&gt; Object.hasOwn(VALIDATORS, key) &amp;&amp; VALIDATORS[key](value);
const settingsFile = () =&gt; path.join(app.getPath('userData'), 'settings.json');
let current = { ...DEFAULTS };
let writing = Promise.resolve();
// --- 2. Load: missing file means defaults, broken file is set aside
async function load() {
  const file = settingsFile();
  let saved = {};
  try {
    saved = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Settings unreadable, using defaults:', error.message);
      await fs.rename(file, `${file}.broken`).catch(() =&gt; {});
    }
  }
  current = { ...DEFAULTS };
  for (const [key, value] of Object.entries(saved ?? {})) {
    if (isValid(key, value)) current[key] = value;
  }
  return { ...current };
}
// --- 3. Atomic save: write a temp file, then rename it over the real one
async function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, file);
}
function save() {
  const data = JSON.stringify(current, null, 2);
  writing = writing
    .then(() =&gt; writeAtomic(settingsFile(), data))
    .catch((error) =&gt; console.error('Could not save settings:', error.message));
  return writing;
}
// --- 4. The public API used by main.js
function set(key, value) {
  if (!isValid(key, value)) return false;
  current[key] = value;
  save();
  return true;
}
const get = (key) =&gt; current[key];
const getAll = () =&gt; ({ ...current });
const flush = () =&gt; writing; // await this in will-quit
module.exports = { load, get, getAll, set, flush, DEFAULTS };
// main.js: await settings.load() before createWindow(); expose PAGE_KEYS only via ipcMain.handle
</code></pre>

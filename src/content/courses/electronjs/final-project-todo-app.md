---
publishDate: 2026-10-25T12:55
title: 'Final Project: A Desktop Todo App'
slug: final-project-todo-app
metadescription: Build Todo Buddy, a complete desktop todo app with IPC, saved data, menus, a tray icon, reminders and dark mode, then package it with Electron Forge.
updateDate: 2026-10-25T12:55
author: ['bishal-biswas']
level: 2
tags: ['project', 'todo-app', 'electron-forge']
course: electronjs
---

## What you will build

This is the last lesson of the course, and it brings almost everything together. You will build **Todo Buddy**, a small but complete desktop app:

- A window with a todo list. Each todo can have an optional **due time**.
- Todos are saved as JSON in the user data folder, so they survive restarts.
- The window **remembers its size and position**.
- A safe **preload API** and `invoke`/`handle` IPC between the page and the main process.
- An **application menu** with keyboard shortcuts.
- A **tray icon** to show or hide the window and add a todo quickly.
- A **desktop notification** when a todo's due time arrives.
- **Dark mode** that follows the system, or can be forced light or dark from the menu.
- Finally, **packaging** it into a real installer with Electron Forge.

Think of it as a graduation project. Each feature is something you already learned in an earlier lesson. The new skill here is fitting the pieces together into one tidy app. Links to the original lessons are in each section if you want a refresher.

The project is plain JavaScript with no bundler, exactly like the early lessons, so every line you write is the line that runs.

## The plan

Before writing code, decide which process does what. This is the most important design step in any Electron app.

| Job | Where it lives | Why |
| --- | --- | --- |
| Holding the list of todos and saving it | Main process | Only main can touch the disk. One copy of the data avoids conflicts. |
| Showing the list and the form | Renderer (`renderer.js`) | It is a web page. |
| Connecting the two | Preload (`preload.js`) | Exposes a small, named API with `contextBridge`. |
| Menu, tray, notifications, theme, window state | Main process | They are operating system features. |
| Checking and cleaning input | `todo-utils.js`, used by main | Plain functions are easy to unit test. |

The page never changes data directly. It **asks** main ("add this todo", "toggle that one"), main updates its list, saves it, and sends back the full new list. The page just draws whatever list it is given. One source of truth, no confusion.

## Step 1: create the project

```bash
mkdir todo-buddy
cd todo-buddy
npm init -y
npm install --save-dev electron
npm install electron-squirrel-startup
```

`electron-squirrel-startup` is only needed later for the Windows installer, but installing it now means `main.js` will not change when you package. It is a normal dependency, not a dev dependency, because the packaged app needs it.

Your folder will end up looking like this:

```text
todo-buddy/
├── index.html
├── main.js
├── package.json
├── preload.js
├── renderer.js
├── store.js
├── styles.css
├── todo-utils.js
└── test/
    └── todo-utils.test.js
```

Edit `package.json` so the top looks like this (npm already added the `dependencies` and `devDependencies` sections, leave them as they are):

```json
{
  "name": "todo-buddy",
  "productName": "Todo Buddy",
  "version": "1.0.0",
  "description": "A friendly desktop todo list",
  "main": "main.js",
  "author": "Your Name",
  "license": "MIT",
  "scripts": {
    "start": "electron .",
    "test": "node --test test/*.test.js"
  }
}
```

`productName` gives the app its friendly name and the name of its user data folder, as explained in [App Icons, Names and Metadata](/courses/electronjs/app-icons-and-metadata).

## Step 2: the helpers and their tests

Start with the part that has nothing to do with Electron: checking input. These functions come from [Testing Electron Apps](/courses/electronjs/testing-electron-apps), plus one more for due times.

```javascript
// todo-utils.js
function cleanText(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed.length === 0) throw new Error('A todo needs some text');
  return trimmed.slice(0, 200);
}

function cleanDue(value) {
  if (!value) return ''; // no due time is fine
  const text = String(value);
  if (Number.isNaN(new Date(text).getTime())) throw new Error('That due time is not a valid date');
  return text;
}

function isDue(todo, now = new Date()) {
  return Boolean(todo.due) && !todo.done && new Date(todo.due) <= now;
}

module.exports = { cleanText, cleanDue, isDue };
```

- **`cleanText`** trims spaces, refuses empty todos and caps the length at 200 characters.
- **`cleanDue`** accepts an empty value (no due time) or anything `Date` can understand. The page's `<input type="datetime-local">` gives values like `2026-10-25T14:30`, which `new Date()` reads as local time.
- **`isDue`** answers "should this todo remind me now?".

Now the tests:

```javascript
// test/todo-utils.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanText, cleanDue, isDue } = require('../todo-utils.js');

test('cleanText trims and rejects empty text', () => {
  assert.equal(cleanText('  buy milk  '), 'buy milk');
  assert.throws(() => cleanText('   '), /needs some text/);
});

test('cleanDue accepts empty or valid dates only', () => {
  assert.equal(cleanDue(''), '');
  assert.equal(cleanDue('2026-10-25T14:30'), '2026-10-25T14:30');
  assert.throws(() => cleanDue('next tuesday'), /not a valid date/);
});

test('isDue is true only for unfinished todos whose time has passed', () => {
  const now = new Date('2026-10-25T12:00');
  assert.equal(isDue({ due: '2026-10-25T11:59', done: false }, now), true);
  assert.equal(isDue({ due: '2026-10-25T12:30', done: false }, now), false);
  assert.equal(isDue({ due: '2026-10-25T11:59', done: true }, now), false);
});
```

```bash
npm test
```

```text
> todo-buddy@1.0.0 test
> node --test test/*.test.js

✔ cleanText trims and rejects empty text (0.9761ms)
✔ cleanDue accepts empty or valid dates only (0.5386ms)
✔ isDue is true only for unfinished todos whose time has passed (0.1655ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 67.4665
```

Starting with tested helpers means the rest of the app is built on parts you already trust.

## Step 3: saving JSON safely

The main process needs to read and write two small files in the user data folder from [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data):

- `todos.json` for the list,
- `settings.json` for the theme and window position.

```javascript
// store.js
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function fileIn(name) {
  return path.join(app.getPath('userData'), name);
}

// Read a JSON file from the user data folder, or return the fallback
function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileIn(name), 'utf8'));
  } catch {
    return fallback; // the file does not exist yet, or is damaged
  }
}

// Write to a temporary file first, then rename it over the real one.
// If the app crashes halfway, the old file is still complete.
function writeJson(name, data) {
  const target = fileIn(name);
  const temp = `${target}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, target);
}

module.exports = { readJson, writeJson };
```

Two details make this safer than a plain `writeFileSync`:

- **`readJson` never crashes.** On the very first run the file does not exist, and if it is ever damaged, the app starts with the fallback value instead of refusing to open.
- **`writeJson` writes to a temporary file, then renames it.** A rename replaces the file in one step. If the computer loses power in the middle of writing, you are left with either the old complete file or the new complete file, never half of one.

These files are tiny, so the synchronous `fs` functions are fine here. For large files you would use `node:fs/promises`, as [Performance: Faster Startup and Less Memory](/courses/electronjs/performance-tips) explains.

## Step 4: the preload API

The page gets exactly seven functions and nothing else. This follows [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api):

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoApi', {
  list: () => ipcRenderer.invoke('todos:list'),
  add: (text, due) => ipcRenderer.invoke('todos:add', { text, due }),
  toggle: (id) => ipcRenderer.invoke('todos:toggle', id),
  remove: (id) => ipcRenderer.invoke('todos:remove', id),
  clearDone: () => ipcRenderer.invoke('todos:clear-done'),
  onChanged: (callback) => ipcRenderer.on('todos:changed', (_event, todos) => callback(todos)),
  onFocusNew: (callback) => ipcRenderer.on('todos:focus-new', () => callback()),
});
```

- The first five use `invoke`, so the page can `await` the answer. Each one resolves with the **whole updated list**.
- `onChanged` lets main push a new list when something changes outside the page: the menu, the tray or a reminder.
- `onFocusNew` lets main ask the page to focus the input box, for the **New Todo** shortcut.
- Both listeners pass only the data to your callback, never the IPC `event` object.

## Step 5: the page

### The HTML

```html
<!-- index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self'"
    />
    <title>Todo Buddy</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header>
      <h1>Todo Buddy</h1>
      <p id="summary">Nothing to do yet</p>
    </header>

    <form id="new-todo">
      <input id="text" placeholder="What needs doing?" maxlength="200" autocomplete="off" />
      <div class="row">
        <label>Due <input id="due" type="datetime-local" /></label>
        <button type="submit">Add</button>
      </div>
      <p id="error" role="alert"></p>
    </form>

    <ul id="list"></ul>

    <footer>
      <button id="clear" type="button">Clear completed</button>
    </footer>

    <script src="renderer.js"></script>
  </body>
</html>
```

The Content Security Policy only allows scripts and styles from the app's own files, as in [Content Security Policy](/courses/electronjs/content-security-policy). That is why the CSS lives in its own file rather than in a `<style>` tag.

### The styles and dark mode

```css
/* styles.css */
:root {
  color-scheme: light dark;
  --bg: #f6f8fa;
  --card: #ffffff;
  --text: #1f2328;
  --muted: #656d76;
  --border: #d0d7de;
  --accent: #2563eb;
  --danger: #cf222e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1f2328;
    --card: #2d333b;
    --text: #e6edf3;
    --muted: #9198a1;
    --border: #444c56;
    --accent: #4c8dff;
    --danger: #ff7b72;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 20px;
  font: 15px/1.4 system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}

h1 {
  margin: 0;
  font-size: 22px;
}

#summary {
  margin: 4px 0 16px;
  color: var(--muted);
}

form {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

input,
button {
  font: inherit;
  color: inherit;
}

input {
  padding: 8px 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}

button {
  padding: 8px 14px;
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: white;
  cursor: pointer;
}

#error {
  margin: 0;
  min-height: 1.4em;
  color: var(--danger);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
}

li .text {
  flex: 1;
  overflow-wrap: anywhere;
}

li.done .text {
  text-decoration: line-through;
  color: var(--muted);
}

li .due {
  font-size: 12px;
  color: var(--muted);
}

li.overdue .due {
  color: var(--danger);
  font-weight: 600;
}

li .delete {
  padding: 2px 8px;
  background: transparent;
  color: var(--muted);
}

footer {
  margin-top: 12px;
  text-align: right;
}

#clear {
  background: transparent;
  color: var(--accent);
}
```

The colours are **CSS variables**. The `@media (prefers-color-scheme: dark)` block swaps them for dark ones. Electron connects that media query to `nativeTheme.themeSource`, which you met in [Dark Mode with nativeTheme](/courses/electronjs/dark-mode-with-nativetheme). When main sets the theme to `'dark'`, the page switches instantly, with no IPC needed.

### The renderer script

```javascript
// renderer.js
const form = document.getElementById('new-todo');
const textInput = document.getElementById('text');
const dueInput = document.getElementById('due');
const errorEl = document.getElementById('error');
const listEl = document.getElementById('list');
const summaryEl = document.getElementById('summary');

// Errors from ipcMain.handle arrive wrapped: "Error invoking remote method ...: Error: message"
function showError(error) {
  errorEl.textContent = error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : '';
}

function formatDue(due) {
  return new Date(due).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function render(todos) {
  listEl.replaceChildren();
  const now = new Date();

  for (const todo of todos) {
    const item = document.createElement('li');
    if (todo.done) item.classList.add('done');
    if (todo.due && !todo.done && new Date(todo.due) <= now) item.classList.add('overdue');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.addEventListener('change', () => run(window.todoApi.toggle(todo.id)));

    const text = document.createElement('span');
    text.className = 'text';
    text.textContent = todo.text; // textContent, never innerHTML, for user text

    const remove = document.createElement('button');
    remove.className = 'delete';
    remove.textContent = '✕';
    remove.title = 'Delete';
    remove.addEventListener('click', () => run(window.todoApi.remove(todo.id)));

    item.append(checkbox, text);
    if (todo.due) {
      const due = document.createElement('span');
      due.className = 'due';
      due.textContent = formatDue(todo.due);
      item.append(due);
    }
    item.append(remove);
    listEl.append(item);
  }

  const left = todos.filter((todo) => !todo.done).length;
  summaryEl.textContent = todos.length === 0 ? 'Nothing to do yet' : `${left} of ${todos.length} left`;
}

// Every API call returns the full, updated list
async function run(promise) {
  try {
    render(await promise);
    showError(null);
  } catch (error) {
    showError(error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await run(window.todoApi.add(textInput.value, dueInput.value));
  if (!errorEl.textContent) {
    form.reset();
    textInput.focus();
  }
});

document.getElementById('clear').addEventListener('click', () => run(window.todoApi.clearDone()));

window.todoApi.onChanged(render); // changes made from the menu, tray or reminders
window.todoApi.onFocusNew(() => textInput.focus());

run(window.todoApi.list());
textInput.focus();
```

The important ideas:

- **`render(todos)`** rebuilds the whole list from data. It is simple and always correct, and for a todo list it is plenty fast.
- **`textContent`, never `innerHTML`.** If someone types `<img src=x onerror=alert(1)>` as a todo, it shows up as plain text. Nothing runs.
- **`run(promise)`** handles every API call the same way: draw the new list, or show the error message.
- **Errors from main** arrive with a long prefix, like `Error invoking remote method 'todos:add': Error: A todo needs some text`. `showError` cuts the prefix off so the user only sees "A todo needs some text".

## Step 6: the main process

Here is the whole `main.js`. Read through it once, then the sections below explain each part.

```javascript
// main.js
const { app, BrowserWindow, ipcMain, Menu, Tray, Notification, nativeTheme, nativeImage, screen } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const { readJson, writeJson } = require('./store.js');
const { cleanText, cleanDue, isDue } = require('./todo-utils.js');

const TRAY_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAj0lEQVR42u2Xyw3AIAxDWaaTdfwO0ao3Dv04jq0ggSWueU8IoqS1FSDbfpzMKYFKZNTwkIQLDkm44b8Scws4QHdgCTW4T7nAk4RNAIHbBN6SFvh6TAw8JIAUjMJhAaQwA0/dQA9g4RKBDJx6hEo49Q2VcLoPqOCpRmQTiHZDFrwGkvK5cPyxfIjFZIjVbJpc66xjwg8SDowAAAAASUVORK5CYII=';

let win = null;
let tray = null;
let quitting = false;
let todos = [];
let settings = { theme: 'system', window: null };

// --- Saving and loading -------------------------------------------------

function saveTodos() {
  writeJson('todos.json', todos);
}

function saveSettings() {
  writeJson('settings.json', settings);
}

function todosChanged() {
  saveTodos();
  win?.webContents.send('todos:changed', todos);
  updateTray();
}

// --- The window -----------------------------------------------------------

function savedBounds() {
  const bounds = { width: 460, height: 640 };
  const saved = settings.window;
  if (!saved) return bounds;

  bounds.width = saved.width;
  bounds.height = saved.height;
  // Only reuse the position if it is still on a connected screen
  const onScreen = screen.getAllDisplays().some(({ workArea: area }) =>
    saved.x >= area.x && saved.y >= area.y &&
    saved.x + 100 <= area.x + area.width && saved.y + 50 <= area.y + area.height);
  if (onScreen) {
    bounds.x = saved.x;
    bounds.y = saved.y;
  }
  return bounds;
}

function saveWindowState() {
  if (!win) return;
  settings.window = { ...win.getNormalBounds(), maximized: win.isMaximized() };
  saveSettings();
}

function backgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#1f2328' : '#f6f8fa';
}

function createWindow() {
  win = new BrowserWindow({
    ...savedBounds(),
    minWidth: 360,
    minHeight: 420,
    show: false,
    title: 'Todo Buddy',
    backgroundColor: backgroundColor(),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });

  if (settings.window?.maximized) win.maximize();
  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());

  win.on('show', updateTray);
  win.on('hide', updateTray);

  // Closing hides the window to the tray, so due-time reminders keep working.
  // Linux desktops do not always show tray icons, so there we really close.
  win.on('close', (event) => {
    saveWindowState();
    if (!quitting && process.platform !== 'linux') {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleWindow() {
  if (win?.isVisible()) win.hide();
  else showWindow();
}

function newTodo() {
  showWindow();
  win.webContents.send('todos:focus-new');
}

function clearCompleted() {
  todos = todos.filter((todo) => !todo.done);
  todosChanged();
}

// --- Theme ----------------------------------------------------------------

function setTheme(theme) {
  settings.theme = theme;
  nativeTheme.themeSource = theme; // the page's CSS follows automatically
  saveSettings();
}

nativeTheme.on('updated', () => {
  win?.setBackgroundColor(backgroundColor());
});

// --- Application menu -------------------------------------------------------

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const themeItem = (label, value) => ({
    label,
    type: 'radio',
    checked: settings.theme === value,
    click: () => setTheme(value),
  });

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Todo', accelerator: 'CmdOrCtrl+N', click: newTodo },
        { label: 'Clear Completed', accelerator: 'CmdOrCtrl+Shift+K', click: clearCompleted },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Theme',
          submenu: [themeItem('Follow System', 'system'), themeItem('Light', 'light'), themeItem('Dark', 'dark')],
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- Tray icon --------------------------------------------------------------

function createTray() {
  const icon = nativeImage.createFromDataURL(TRAY_ICON).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.on('click', toggleWindow); // Windows and Linux; on macOS a click opens the menu
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const left = todos.filter((todo) => !todo.done).length;
  tray.setToolTip(`Todo Buddy: ${left} left`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: win?.isVisible() ? 'Hide Todo Buddy' : 'Show Todo Buddy', click: toggleWindow },
      { label: 'New Todo', click: newTodo },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
}

// --- Due-time notifications -----------------------------------------------

function checkDueTodos() {
  const due = todos.filter((todo) => isDue(todo) && !todo.notified);
  if (due.length === 0) return;

  for (const todo of due) {
    todo.notified = true;
    if (Notification.isSupported()) {
      const notification = new Notification({ title: 'Todo due', body: todo.text });
      notification.on('click', showWindow);
      notification.show();
    }
  }
  todosChanged();
}

// --- IPC: the API behind window.todoApi ------------------------------------

function findTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) throw new Error('That todo no longer exists');
  return todo;
}

ipcMain.handle('todos:list', () => todos);

ipcMain.handle('todos:add', (_event, input) => {
  todos.push({
    id: crypto.randomUUID(),
    text: cleanText(input?.text),
    due: cleanDue(input?.due),
    done: false,
    notified: false,
  });
  todosChanged();
  return todos;
});

ipcMain.handle('todos:toggle', (_event, id) => {
  const todo = findTodo(id);
  todo.done = !todo.done;
  todosChanged();
  return todos;
});

ipcMain.handle('todos:remove', (_event, id) => {
  findTodo(id);
  todos = todos.filter((todo) => todo.id !== id);
  todosChanged();
  return todos;
});

ipcMain.handle('todos:clear-done', () => {
  clearCompleted();
  return todos;
});

// --- Start up -----------------------------------------------------------------

function start() {
  todos = readJson('todos.json', []);
  settings = { ...settings, ...readJson('settings.json', {}) };
  nativeTheme.themeSource = settings.theme;

  // Windows needs an app ID for notifications while developing.
  // Installed Squirrel apps get the right ID automatically.
  if (process.platform === 'win32' && !app.isPackaged) app.setAppUserModelId(process.execPath);

  buildMenu();
  createWindow();
  createTray();

  checkDueTodos();
  setInterval(checkDueTodos, 30 * 1000); // look for due todos every 30 seconds
}

if (require('electron-squirrel-startup') || !app.requestSingleInstanceLock()) {
  // Windows installer events, or the app is already running: stop here
  app.quit();
} else {
  app.on('second-instance', showWindow); // someone started the app again
  app.whenReady().then(() => {
    start();
    app.on('activate', showWindow); // macOS: Dock icon clicked
  });
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
```

### Starting up

Look at the bottom of the file first. Two checks run before anything else:

- **`electron-squirrel-startup`** returns `true` while the Windows installer is running the app to create shortcuts. The app quits straight away in that case, as in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers).
- **`app.requestSingleInstanceLock()`** returns `false` if Todo Buddy is already running. A second copy would show a second tray icon and fight over `todos.json`, so it quits. The first copy gets a `second-instance` event and shows its window instead. This comes from [Single Instance Lock and Deep Links](/courses/electronjs/single-instance-and-deep-links).

Then `start()` loads the saved data, applies the theme, and builds the menu, window and tray.

### The data and IPC

`todos` is an array in the main process: the one true copy. Each IPC handler from [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle) changes it and then calls `todosChanged()`, which:

1. saves `todos.json`,
2. sends the new list to the window with `webContents.send`,
3. refreshes the tray tooltip ("Todo Buddy: 3 left").

Every handler checks its input. `cleanText` and `cleanDue` validate new todos, and `findTodo` refuses IDs that do not exist. If a check throws, `invoke` rejects in the page and the message is shown under the form. Electron also prints the error in your terminal, starting with `Error occurred in handler for 'todos:add'`. That is expected.

`crypto.randomUUID()` creates a unique ID for each todo, so two todos with the same text never get mixed up.

### Remembering the window

`savedBounds()` reads the last size and position from `settings.json`. It only reuses the position if it is still on a connected screen, because the user may have unplugged the monitor the window was on. `saveWindowState()` stores `getNormalBounds()`, the size the window would have when not maximized, plus whether it **was** maximized. This is the approach from [Remembering Window Size and Position](/courses/electronjs/remembering-window-state).

The window is created with `show: false` and shown on `ready-to-show`, with a `backgroundColor` that matches the theme, so it never flashes white.

### Closing to the tray

A todo app that reminds you about due times has to keep running when its window is closed. So, on Windows and macOS, the `close` handler cancels the close with `event.preventDefault()` and **hides** the window instead. The app keeps running in the tray (and on macOS, in the Dock).

To really quit, use **File > Exit** (Windows), **Todo Buddy > Quit** (macOS, or Cmd + Q), or **Quit** in the tray menu. They all call `app.quit()`, which fires `before-quit`, which sets `quitting = true`, so the next `close` is allowed through.

On **Linux**, some desktops (GNOME by default) do not show tray icons at all. Hiding the window there could leave the app running with no way back, so on Linux closing the window really closes it and quits.

### The menu and shortcuts

`buildMenu()` follows [Application Menus](/courses/electronjs/application-menus) and [Keyboard Shortcuts and Accelerators](/courses/electronjs/keyboard-shortcuts):

- **File:** New Todo (`CmdOrCtrl+N`), Clear Completed (`CmdOrCtrl+Shift+K`), and Quit (Exit on Windows). On macOS the File menu gets **Close** instead, because Quit lives in the app menu.
- **Edit:** the built-in `editMenu` role, so copy, paste and undo work in the text box.
- **View:** a **Theme** submenu with three radio items, plus reload, DevTools and zoom.
- **Window:** the built-in `windowMenu` role.

`CmdOrCtrl` means Cmd on macOS and Ctrl on Windows and Linux.

### The tray icon

The tray icon is a small blue check-mark image stored directly in the code as a **data URL**, a picture written out as text. That way the project needs no image files. `nativeImage.createFromDataURL` turns it into an image, and `resize` makes it 16 by 16 pixels, a good size for tray areas.

The tray menu is rebuilt by `updateTray()` whenever something changes, so its first item always says **Show** or **Hide** correctly. On Windows and Linux, clicking the icon toggles the window. On macOS, clicking opens the menu. See [System Tray Icons](/courses/electronjs/system-tray) for more on these differences.

### Reminders

`checkDueTodos()` runs once at startup and then every 30 seconds. It finds todos that are due, unfinished and not yet announced, shows a notification for each, and marks them `notified: true` so they never nag twice. Clicking a notification opens the window. A 30-second check is simple and accurate enough for a todo list. This builds on [Desktop Notifications](/courses/electronjs/desktop-notifications).

On Windows, notifications need an **AppUserModelID**. During development, `app.setAppUserModelId(process.execPath)` provides one. Installed Squirrel apps get the correct ID automatically.

## Step 7: run it

```bash
npm start
```

Try everything:

1. Add "Buy milk" with a due time one or two minutes from now. Add "Write report" with no due time.
2. Tick "Write report", then press `Ctrl + Shift + K` (`Cmd + Shift + K` on a Mac). It disappears.
3. Wait for the due time. Within 30 seconds a "Todo due: Buy milk" notification appears, and the due time in the list turns red.
4. Choose **View > Theme > Dark**. The window switches. Choose **Follow System** to go back.
5. Resize and move the window, close it, then click the tray icon. It comes back in the same place.
6. Run `npm start` again in a second terminal. No second copy opens; the first one shows its window.
7. Quit from the tray menu, start again, and your todos are still there.

To see the saved data, open the user data folder. On Windows it is `%APPDATA%\Todo Buddy`, on macOS `~/Library/Application Support/Todo Buddy`, and on Linux `~/.config/Todo Buddy`. You will find `todos.json` and `settings.json` there:

```json
[
  {
    "id": "fc2b9bfa-9e0d-4a81-b4a6-0c2b384c3874",
    "text": "Buy milk",
    "due": "2026-10-25T14:30",
    "done": false,
    "notified": true
  }
]
```

## Step 8: package it with Electron Forge

The app works. Now turn it into an installer. Your project does not use Forge yet, so import it:

```bash
npx create-electron-app@latest import
```

Run this inside the `todo-buddy` folder. Forge installs its own packages, adds a Forge configuration file, and changes your scripts so that `npm start` runs through Forge and you gain `npm run package` and `npm run make`. Your own files are not changed. Electron Forge needs Node.js 22.17 or newer.

> **Note:** The old command `electron-forge import` was removed in Forge 8. `npx create-electron-app@latest import` is its replacement.

Check that the app still starts the same way:

```bash
npm start
```

Then make an installer for your platform:

```bash
npm run make
```

On Windows you get `out/make/squirrel.windows/x64/Todo Buddy-1.0.0 Setup.exe`. On macOS and Linux you get whatever the `makers` list in the new Forge configuration file builds for that platform, typically a `.zip` on macOS and `.deb` or `.rpm` packages on Linux. Install it, find **Todo Buddy** in your Start menu, Applications folder or app launcher, and run it like any other app. Your data lives in the same user data folder as during development, because the app name is the same.

Because this project has no bundler, the packaged app contains your files as they are, plus `electron-squirrel-startup` from `dependencies`. Development-only packages like Electron itself are left out automatically.

### Polishing the package

You have all the tools for the finishing touches:

- **An icon:** add `assets/icon.ico`, `assets/icon.icns` and `assets/icon.png`, then set `icon: './assets/icon'` in `packagerConfig`. See [App Icons, Names and Metadata](/courses/electronjs/app-icons-and-metadata).
- **Fuses:** add the `FusesPlugin` block from [Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity) to lock down the packaged app.
- **Signing:** set up `windowsSign`, `osxSign` and `osxNotarize` from [Code Signing and Notarization](/courses/electronjs/code-signing-and-notarization) before sharing it widely.
- **Updates and releases:** add `update-electron-app` from [Automatic Updates](/courses/electronjs/automatic-updates) and the GitHub publisher from [Publishing Releases to GitHub and App Stores](/courses/electronjs/publishing-releases).

## Ideas to take it further

Want to keep going? Each of these uses something from the course:

- **Drag and drop** a text file onto the window to import todos, one per line ([Drag and Drop Files](/courses/electronjs/drag-and-drop-files)).
- **Export** the list with a Save dialog ([Native Dialogs: Open, Save and Message Boxes](/courses/electronjs/native-dialogs)).
- **Right-click** a todo to edit or duplicate it ([Right-Click Context Menus](/courses/electronjs/context-menus)).
- Move storage to **SQLite** when the list grows large ([A Local Database with SQLite](/courses/electronjs/local-database-with-sqlite)).
- Add **Playwright** end-to-end tests for adding and completing todos ([Testing Electron Apps](/courses/electronjs/testing-electron-apps)).

## Common mistakes

### Changing data in the renderer

If the page kept its own array and only sometimes told main, the two copies would drift apart, and the tray count or saved file would be wrong. Keep the data in main. Let the page ask, and draw what comes back.

### Forgetting the quitting flag

If the `close` handler always calls `preventDefault()`, the app can never quit: Quit hides the window and nothing else happens. The `before-quit` flag is what lets a real quit through.

### Losing the tray icon on Linux

Hiding the window to the tray on a desktop with no tray area leaves an invisible app. That is why this project only hides on Windows and macOS.

### Expecting reminders while the app is quit

Notifications come from the running app. If the user quits Todo Buddy, no reminders arrive until it starts again. Overdue todos are announced at the next start.

## Quick recap

- Plan first: data and OS features in main, drawing in the renderer, a small API in the preload.
- Main keeps the one true list, saves it as JSON in `userData`, and sends the full list back after every change.
- Plain helper modules (`todo-utils.js`) keep validation simple and testable with `node --test`.
- Write files safely: temporary file first, then rename.
- `show: false`, `ready-to-show`, a themed `backgroundColor` and saved bounds make the window feel native.
- Hiding on `close` plus a `before-quit` flag gives a proper tray app on Windows and macOS.
- A single instance lock prevents two copies fighting over the same data.
- `nativeTheme.themeSource` drives `prefers-color-scheme` in your CSS.
- `npx create-electron-app@latest import` adds Forge to a plain project. `npm run make` builds the installer.

Congratulations on finishing the Electron course. You can now build, secure, test, package, sign, update and publish real desktop apps with web technologies.

<code id="code-content" class="language-javascript">
// main.js: Todo Buddy, a tray todo app with reminders, menus, dark mode and saved data
const { app, BrowserWindow, ipcMain, Menu, Tray, Notification, nativeTheme, nativeImage, screen } = require('electron');
const path = require('node:path');
const crypto = require('node:crypto');
const { readJson, writeJson } = require('./store.js');
const { cleanText, cleanDue, isDue } = require('./todo-utils.js');
const TRAY_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAj0lEQVR42u2Xyw3AIAxDWaaTdfwO0ao3Dv04jq0ggSWueU8IoqS1FSDbfpzMKYFKZNTwkIQLDkm44b8Scws4QHdgCTW4T7nAk4RNAIHbBN6SFvh6TAw8JIAUjMJhAaQwA0/dQA9g4RKBDJx6hEo49Q2VcLoPqOCpRmQTiHZDFrwGkvK5cPyxfIjFZIjVbJpc66xjwg8SDowAAAAASUVORK5CYII=';
let win = null;
let tray = null;
let quitting = false;
let todos = [];
let settings = { theme: 'system', window: null };
// --- Saving and loading -------------------------------------------------
function saveTodos() {
  writeJson('todos.json', todos);
}
function saveSettings() {
  writeJson('settings.json', settings);
}
function todosChanged() {
  saveTodos();
  win?.webContents.send('todos:changed', todos);
  updateTray();
}
// --- The window -----------------------------------------------------------
function savedBounds() {
  const bounds = { width: 460, height: 640 };
  const saved = settings.window;
  if (!saved) return bounds;
  bounds.width = saved.width;
  bounds.height = saved.height;
  // Only reuse the position if it is still on a connected screen
  const onScreen = screen.getAllDisplays().some(({ workArea: area }) =&gt;
    saved.x &gt;= area.x &amp;&amp; saved.y &gt;= area.y &amp;&amp;
    saved.x + 100 &lt;= area.x + area.width &amp;&amp; saved.y + 50 &lt;= area.y + area.height);
  if (onScreen) {
    bounds.x = saved.x;
    bounds.y = saved.y;
  }
  return bounds;
}
function saveWindowState() {
  if (!win) return;
  settings.window = { ...win.getNormalBounds(), maximized: win.isMaximized() };
  saveSettings();
}
function backgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#1f2328' : '#f6f8fa';
}
function createWindow() {
  win = new BrowserWindow({
    ...savedBounds(),
    minWidth: 360,
    minHeight: 420,
    show: false,
    title: 'Todo Buddy',
    backgroundColor: backgroundColor(),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  if (settings.window?.maximized) win.maximize();
  win.loadFile('index.html');
  win.once('ready-to-show', () =&gt; win.show());
  win.on('show', updateTray);
  win.on('hide', updateTray);
  // Closing hides the window to the tray, so due-time reminders keep working.
  // Linux desktops do not always show tray icons, so there we really close.
  win.on('close', (event) =&gt; {
    saveWindowState();
    if (!quitting &amp;&amp; process.platform !== 'linux') {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () =&gt; {
    win = null;
  });
}
function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function toggleWindow() {
  if (win?.isVisible()) win.hide();
  else showWindow();
}
function newTodo() {
  showWindow();
  win.webContents.send('todos:focus-new');
}
function clearCompleted() {
  todos = todos.filter((todo) =&gt; !todo.done);
  todosChanged();
}
// --- Theme ----------------------------------------------------------------
function setTheme(theme) {
  settings.theme = theme;
  nativeTheme.themeSource = theme; // the page's CSS follows automatically
  saveSettings();
}
nativeTheme.on('updated', () =&gt; {
  win?.setBackgroundColor(backgroundColor());
});
// --- Application menu -------------------------------------------------------
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const themeItem = (label, value) =&gt; ({
    label,
    type: 'radio',
    checked: settings.theme === value,
    click: () =&gt; setTheme(value),
  });
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Todo', accelerator: 'CmdOrCtrl+N', click: newTodo },
        { label: 'Clear Completed', accelerator: 'CmdOrCtrl+Shift+K', click: clearCompleted },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        {
          label: 'Theme',
          submenu: [themeItem('Follow System', 'system'), themeItem('Light', 'light'), themeItem('Dark', 'dark')],
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
// --- Tray icon --------------------------------------------------------------
function createTray() {
  const icon = nativeImage.createFromDataURL(TRAY_ICON).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.on('click', toggleWindow); // Windows and Linux; on macOS a click opens the menu
  updateTray();
}
function updateTray() {
  if (!tray) return;
  const left = todos.filter((todo) =&gt; !todo.done).length;
  tray.setToolTip(`Todo Buddy: ${left} left`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: win?.isVisible() ? 'Hide Todo Buddy' : 'Show Todo Buddy', click: toggleWindow },
      { label: 'New Todo', click: newTodo },
      { type: 'separator' },
      { label: 'Quit', click: () =&gt; app.quit() },
    ]),
  );
}
// --- Due-time notifications -----------------------------------------------
function checkDueTodos() {
  const due = todos.filter((todo) =&gt; isDue(todo) &amp;&amp; !todo.notified);
  if (due.length === 0) return;
  for (const todo of due) {
    todo.notified = true;
    if (Notification.isSupported()) {
      const notification = new Notification({ title: 'Todo due', body: todo.text });
      notification.on('click', showWindow);
      notification.show();
    }
  }
  todosChanged();
}
// --- IPC: the API behind window.todoApi ------------------------------------
function findTodo(id) {
  const todo = todos.find((item) =&gt; item.id === id);
  if (!todo) throw new Error('That todo no longer exists');
  return todo;
}
ipcMain.handle('todos:list', () =&gt; todos);
ipcMain.handle('todos:add', (_event, input) =&gt; {
  todos.push({
    id: crypto.randomUUID(),
    text: cleanText(input?.text),
    due: cleanDue(input?.due),
    done: false,
    notified: false,
  });
  todosChanged();
  return todos;
});
ipcMain.handle('todos:toggle', (_event, id) =&gt; {
  const todo = findTodo(id);
  todo.done = !todo.done;
  todosChanged();
  return todos;
});
ipcMain.handle('todos:remove', (_event, id) =&gt; {
  findTodo(id);
  todos = todos.filter((todo) =&gt; todo.id !== id);
  todosChanged();
  return todos;
});
ipcMain.handle('todos:clear-done', () =&gt; {
  clearCompleted();
  return todos;
});
// --- Start up -----------------------------------------------------------------
function start() {
  todos = readJson('todos.json', []);
  settings = { ...settings, ...readJson('settings.json', {}) };
  nativeTheme.themeSource = settings.theme;
  // Windows needs an app ID for notifications while developing.
  // Installed Squirrel apps get the right ID automatically.
  if (process.platform === 'win32' &amp;&amp; !app.isPackaged) app.setAppUserModelId(process.execPath);
  buildMenu();
  createWindow();
  createTray();
  checkDueTodos();
  setInterval(checkDueTodos, 30 * 1000); // look for due todos every 30 seconds
}
if (require('electron-squirrel-startup') || !app.requestSingleInstanceLock()) {
  // Windows installer events, or the app is already running: stop here
  app.quit();
} else {
  app.on('second-instance', showWindow); // someone started the app again
  app.whenReady().then(() =&gt; {
    start();
    app.on('activate', showWindow); // macOS: Dock icon clicked
  });
  app.on('before-quit', () =&gt; {
    quitting = true;
  });
  app.on('window-all-closed', () =&gt; {
    if (process.platform !== 'darwin') app.quit();
  });
}
</code></pre>

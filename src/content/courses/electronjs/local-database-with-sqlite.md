---
publishDate: 2026-10-25T12:33
title: A Local Database with SQLite
slug: local-database-with-sqlite
metadescription: Store app data in a real SQLite database with better-sqlite3 in Electron's main process, using prepared statements and small, safe IPC functions.
updateDate: 2026-10-25T12:33
author: ['bishal-biswas']
level: 2
tags: ['sqlite', 'database', 'better-sqlite3']
course: electronjs
---

## When a JSON file is not enough

In [Saving User Settings](/courses/electronjs/saving-user-settings) you kept a handful of settings in one JSON file. That works well for ten values. It works badly for ten thousand notes, orders or log entries, because every change means reading the whole file, changing it in memory and writing the whole thing back.

A **database** is a program that stores data in an organised way and lets you ask questions like "give me the 20 newest notes" without loading everything. **SQLite** is a small database that lives in a single file on disk. There is no server to install and nothing for your users to set up. Firefox, Chrome, Android and many desktop apps use it.

Think of the difference like this. A JSON file is one long notebook: to change page 300 you copy out the whole notebook. SQLite is a filing cabinet with labelled drawers: you open one drawer, change one card and close it again.

In this lesson you will:

1. Install `better-sqlite3`, a popular SQLite library for Node.
2. Learn what a native module is, and when one needs a "rebuild" step in Electron.
3. Keep the database file in the `userData` folder.
4. Write small IPC functions to list, add and delete notes.
5. Use **prepared statements** so user input can never break your queries.

## Where the database code runs

Your renderer (the web page) is sandboxed and has no Node.js access. That is a good thing, and you will not change it. All database code goes in the **main process**, and the page asks for data through IPC, exactly like the file code in [Reading and Writing Files from Your App](/courses/electronjs/reading-and-writing-files).

```text
renderer.js  --notes.add('Buy milk')-->  preload.js  --invoke-->  main.js  -->  notes.db
renderer.js  <--------- [{ id: 1, text: 'Buy milk' }] ----------  main.js  <--  notes.db
```

## Step 1: install better-sqlite3

Start from the plain project you have used in earlier lessons (a `package.json` with `"main": "main.js"` and `"start": "electron ."`). In the project folder run:

```bash
npm install better-sqlite3
```

Notice it is a normal dependency, not a dev dependency, because your app needs it at run time.

### What is a native module?

Most npm packages are plain JavaScript. `better-sqlite3` is different: part of it is written in C and C++ and compiled into a `.node` file. A package like this is called a **native module**.

Older native modules were compiled for one exact version of Node.js. Electron contains its own copy of Node.js, built in its own way, so a module compiled for the Node.js on your computer would not load inside Electron. You had to compile it again for Electron.

Newer native modules, including recent versions of `better-sqlite3`, are built on **Node-API**: a stable interface that stays the same across Node.js and Electron versions. They also ship **prebuilt binaries** (ready-compiled `.node` files for each operating system), so `npm install` simply downloads the right one and it loads in Electron straight away. With the latest `better-sqlite3` you can skip ahead to Step 2.

### When you do need a rebuild

Some native modules are still compiled for one Node.js version. If you use one of those (or an old version of `better-sqlite3`), starting the app shows an error like this:

```text
Error: The module '.../node_modules/some-module/build/Release/some_module.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION ... This version of Node.js requires
NODE_MODULE_VERSION ... Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

`NODE_MODULE_VERSION` is a number that identifies the "shape" of a Node.js build. The two numbers do not match, so the module is refused. The fix is to compile the module again, this time for Electron. In a plain project, the official tool does this for you:

```bash
npx @electron/rebuild
```

It looks at the Electron version in your `package.json` and rebuilds the native modules in `node_modules` to match. Run it again whenever you install or update such a module, or update Electron.

> **Note:** If you used [Electron Forge](/courses/electronjs/starting-with-electron-forge), you rarely need this command. Forge rebuilds native modules automatically when you run `npm start`, `npm run package` or `npm run make`. Forge projects also come with `@electron-forge/plugin-auto-unpack-natives`, which keeps `.node` files outside the ASAR archive (the single packed file that holds your app's code), because the operating system cannot load a native library from inside it. The Vite template needs a little extra setup for native modules. [Native Node Modules](/courses/electronjs/native-node-modules) covers both in detail.

If a rebuild fails on your computer, you may be missing C++ build tools: install "Desktop development with C++" from Visual Studio Build Tools on Windows, run `xcode-select --install` on macOS, or install `build-essential` and Python on Linux.

## Step 2: decide where the file lives

Never put the database next to your code. When your app is packaged, that folder may be read-only or packed inside the ASAR archive. Instead, use the `userData` folder you met in [App Paths: Where to Store User Data](/courses/electronjs/app-paths-and-user-data):

```javascript
// main.js (just to check the path)
const { app } = require('electron');
const path = require('node:path');

app.whenReady().then(() => {
  console.log(path.join(app.getPath('userData'), 'notes.db'));
});
```

```text
Windows: C:\Users\asha\AppData\Roaming\my-notes\notes.db
macOS:   /Users/asha/Library/Application Support/my-notes/notes.db
Linux:   /home/asha/.config/my-notes/notes.db
```

`app.getPath('userData')` only works after the app is ready, so you will open the database inside `whenReady`.

## Step 3: a small database module

Keeping database code in its own file makes `main.js` easier to read. Create `db.js`:

```javascript
// db.js
const Database = require('better-sqlite3');

let db;
let statements;

function openDatabase(filePath) {
  db = new Database(filePath);
  db.pragma('journal_mode = WAL'); // faster, safer writes

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  statements = {
    list: db.prepare('SELECT id, text, created_at AS createdAt FROM notes ORDER BY id DESC'),
    add: db.prepare('INSERT INTO notes (text, created_at) VALUES (?, ?)'),
    remove: db.prepare('DELETE FROM notes WHERE id = ?'),
  };
}

function listNotes() {
  return statements.list.all();
}

function addNote(text) {
  const info = statements.add.run(text, Date.now());
  return { id: Number(info.lastInsertRowid), text, createdAt: Date.now() };
}

function deleteNote(id) {
  return statements.remove.run(id).changes === 1;
}

function closeDatabase() {
  db?.close();
}

module.exports = { openDatabase, listNotes, addNote, deleteNote, closeDatabase };
```

A few new words here:

- **SQL** (Structured Query Language) is the language you use to talk to the database. `SELECT` reads rows, `INSERT` adds a row, `DELETE` removes rows.
- A **table** is like a spreadsheet: columns (`id`, `text`, `created_at`) and rows (one per note).
- `CREATE TABLE IF NOT EXISTS` makes the table the first time and does nothing on later runs.
- `INTEGER PRIMARY KEY AUTOINCREMENT` gives every note a unique number automatically.
- `pragma('journal_mode = WAL')` switches on write-ahead logging, a mode that makes writes faster and less likely to corrupt the file if the app crashes. You will see extra `notes.db-wal` and `notes.db-shm` files next to the database. That is normal.

### Prepared statements

`db.prepare(sql)` turns an SQL string into a **prepared statement**: a query that is checked and compiled once, then run many times with different values. The `?` marks are **placeholders**. You pass the real values when you run it:

```javascript
statements.add.run('Buy milk', Date.now());
```

The methods you will use most:

| Method | Use it for | Returns |
| --- | --- | --- |
| `.all(...values)` | `SELECT` many rows | an array of objects |
| `.get(...values)` | `SELECT` one row | one object, or `undefined` |
| `.run(...values)` | `INSERT`, `UPDATE`, `DELETE` | `{ changes, lastInsertRowid }` |

Placeholders are not just tidy, they are a security feature. Compare these two:

```javascript
// Don't do this: user text becomes part of the SQL itself
db.exec(`DELETE FROM notes WHERE text = '${userText}'`);

// Do this: user text is only ever treated as a value
db.prepare('DELETE FROM notes WHERE text = ?').run(userText);
```

If `userText` were `x' OR '1'='1`, the first line would delete every note. This trick is called **SQL injection**. With a placeholder, the database never reads the value as SQL, so the trick does nothing.

> **Tip:** `better-sqlite3` is **synchronous**: `.all()` returns the rows directly, with no `await`. SQLite is very fast for small queries, so this is fine for typical desktop apps. If you ever run a query that takes seconds, move it to a background process, as shown in [Background Work with utilityProcess](/courses/electronjs/utility-process), so the main process stays responsive.

## Step 4: IPC handlers in main.js

Now open the database when the app is ready and expose three small handlers. Each one checks its input, because the main process should never trust data from a renderer.

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const db = require('./db');

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  db.openDatabase(path.join(app.getPath('userData'), 'notes.db'));

  ipcMain.handle('notes:list', () => db.listNotes());

  ipcMain.handle('notes:add', (event, text) => {
    if (typeof text !== 'string' || text.trim() === '' || text.length > 1000) {
      throw new Error('A note must be 1 to 1000 characters long.');
    }
    return db.addNote(text.trim());
  });

  ipcMain.handle('notes:delete', (event, id) => {
    if (!Number.isInteger(id)) throw new Error('Invalid note id.');
    return db.deleteNote(id);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  db.closeDatabase();
});
```

`will-quit` fires once, just before the app exits, which makes it a good place to close the database cleanly.

## Step 5: the preload bridge

The preload exposes three named functions and nothing else. As always, you do not hand `ipcRenderer` itself to the page.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notes', {
  list: () => ipcRenderer.invoke('notes:list'),
  add: (text) => ipcRenderer.invoke('notes:add', text),
  remove: (id) => ipcRenderer.invoke('notes:delete', id),
});
```

## Step 6: the page

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'" />
    <title>SQLite Notes</title>
  </head>
  <body>
    <h1>Notes</h1>
    <form id="note-form">
      <input id="note-text" placeholder="Write a note" autocomplete="off" />
      <button>Add</button>
    </form>
    <ul id="note-list"></ul>
    <script src="renderer.js"></script>
  </body>
</html>
```

```javascript
// renderer.js
const form = document.querySelector('#note-form');
const input = document.querySelector('#note-text');
const list = document.querySelector('#note-list');

async function refresh() {
  const notes = await window.notes.list();
  list.replaceChildren(
    ...notes.map((note) => {
      const li = document.createElement('li');
      li.textContent = `${note.text} `;
      const button = document.createElement('button');
      button.textContent = 'Delete';
      button.addEventListener('click', async () => {
        await window.notes.remove(note.id);
        refresh();
      });
      li.append(button);
      return li;
    }),
  );
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await window.notes.add(input.value);
    input.value = '';
    refresh();
  } catch (error) {
    alert(error.message);
  }
});

refresh();
```

Run it:

```bash
npm start
```

Add a few notes, quit the app completely, and start it again. Your notes are still there, because they live in `notes.db` inside `userData`. Using `textContent` (not `innerHTML`) means a note containing `<script>` is shown as plain text and never runs.

## Doing many writes at once

Each `.run()` is its own small save to disk. If you insert hundreds of rows in a loop, wrap them in a **transaction**: a group of changes that is saved all together, or not at all.

```javascript
// db.js (an extra function)
function importNotes(texts) {
  const insertMany = db.transaction((items) => {
    for (const text of items) statements.add.run(text, Date.now());
  });
  insertMany(texts); // one disk write for the whole batch
}
```

If any insert throws, none of them are saved. That keeps your data consistent, and it is also much faster.

## Changing the table later

Your first version of the table will not be your last. Say version 2 of your app adds a `pinned` column. SQLite has a built-in number called `user_version` you can use to track which changes have run:

```javascript
// db.js (inside openDatabase, after CREATE TABLE)
const version = db.pragma('user_version', { simple: true });
if (version < 1) {
  db.exec('ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  db.pragma('user_version = 1');
}
```

This kind of upgrade step is called a **migration**. Each one runs once, on each user's computer, the first time they open the new version.

## What about Node's built-in SQLite?

Node.js now ships a built-in `node:sqlite` module, and it does load in the main process of the latest Electron with no rebuild step:

```javascript
// main.js (alternative)
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(app.getPath('userData'), 'notes.db'));
```

Its API looks similar (`prepare`, `all`, `get`, `run`), but it is newer and still changing, so this course uses `better-sqlite3`, which has been stable for years. If you want to avoid native modules entirely, `node:sqlite` is worth trying.

## Common mistakes

### Rebuilding with the wrong tool

The `NODE_MODULE_VERSION` error means a native module was built for a different Node.js. Update the package first (recent `better-sqlite3` versions do not need a rebuild at all). If it still appears, run `npx @electron/rebuild` (or use Forge, which does it for you). Running plain `npm rebuild` builds for your system Node.js, not Electron, so it does not help.

### Importing better-sqlite3 in the renderer or preload

The renderer and sandboxed preload cannot load Node modules. You will see `require is not defined` or `module not found`. Keep all database code in the main process and use IPC.

### Building SQL with template strings

Putting user input inside the SQL text with `${...}` invites SQL injection and also breaks on simple input like `It's raining` (the apostrophe ends the string). Always use `?` placeholders.

### Storing the database inside the app folder

It may work while developing, then fail after packaging because the app folder is read-only or inside ASAR. Always use `app.getPath('userData')`.

## Quick recap

- SQLite is a full database stored in one file. It suits data that grows beyond a few settings.
- `better-sqlite3` is a native module. Recent versions use Node-API with prebuilt binaries and load in Electron as they are; older-style modules need `npx @electron/rebuild`, which Forge runs for you.
- Forge's `plugin-auto-unpack-natives` keeps `.node` files outside the ASAR archive.
- Keep the database in `app.getPath('userData')` and open it after `app.whenReady()`.
- Use prepared statements with `?` placeholders: `.all()`, `.get()` and `.run()`.
- Expose small, validated IPC functions such as list, add and delete. Never expose the database itself.
- Use transactions for batches, `user_version` for migrations, and close the database in `will-quit`.

<code id="code-content" class="language-javascript">
// main.js: a notes app backed by SQLite (run "npm install better-sqlite3" first)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const Database = require('better-sqlite3');
let db;
let sql;
// --- 1. Open the database in userData and create the table once
function openDatabase() {
  db = new Database(path.join(app.getPath('userData'), 'notes.db'));
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at INTEGER NOT NULL)');
  // --- 2. Prepared statements: compiled once, values passed with ? placeholders
  sql = {
    list: db.prepare('SELECT id, text, created_at AS createdAt FROM notes ORDER BY id DESC'),
    add: db.prepare('INSERT INTO notes (text, created_at) VALUES (?, ?)'),
    remove: db.prepare('DELETE FROM notes WHERE id = ?'),
  };
}
function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}
app.whenReady().then(() =&gt; {
  openDatabase();
  // --- 3. Small IPC functions that validate every input
  ipcMain.handle('notes:list', () =&gt; sql.list.all());
  ipcMain.handle('notes:add', (event, text) =&gt; {
    if (typeof text !== 'string' || text.trim() === '' || text.length &gt; 1000) {
      throw new Error('A note must be 1 to 1000 characters long.');
    }
    const info = sql.add.run(text.trim(), Date.now());
    return { id: Number(info.lastInsertRowid), text: text.trim() };
  });
  ipcMain.handle('notes:delete', (event, id) =&gt; {
    if (!Number.isInteger(id)) throw new Error('Invalid note id.');
    return sql.remove.run(id).changes === 1;
  });
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
// --- 4. Standard lifecycle, plus closing the database cleanly
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () =&gt; {
  db?.close();
});
// preload.js exposes: notes.list(), notes.add(text), notes.remove(id) via ipcRenderer.invoke
</code></pre>

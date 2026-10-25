---
publishDate: 2026-10-25T12:04
title: Understanding package.json and the Project Files
slug: project-files-and-package-json
metadescription: Walk through every file in a plain Electron project, learn what each package.json field does, and see how Electron reads your app's name and version.
updateDate: 2026-10-25T12:04
author: ['bishal-biswas']
level: 1
tags: ['package-json', 'npm', 'project-structure']
course: electronjs
---

## A tour of your project

In [Your First Electron App](/courses/electronjs/your-first-electron-app) you created a handful of files and npm created a few more. Here is the whole folder:

```text
my-first-app/
├── node_modules/        downloaded packages (npm made this)
├── package.json         the project's ID card
├── package-lock.json    exact versions of every package (npm made this)
├── main.js              main process
├── preload.js           preload script (runs in the window, before the page)
├── index.html           the page shown in the window
└── renderer.js          the page's JavaScript
```

Think of `package.json` as the label on a parcel. It says what is inside, who sent it, which version it is, and how to open it. Electron and npm both read that label before they do anything else, so it is worth knowing every line.

## package.json, line by line

Here is the file from the last lesson, with one extra field (`productName`) and one extra script added:

```json
{
  "name": "my-first-app",
  "productName": "My First App",
  "version": "1.0.0",
  "description": "My first Electron app",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "debug": "electron --inspect=9229 ."
  },
  "keywords": [],
  "author": "Asha",
  "license": "ISC",
  "type": "commonjs",
  "devDependencies": {
    "electron": "^45.0.0"
  }
}
```

### name

The project's short ID. It must be **lowercase**, with no spaces. Use dashes instead: `my-first-app`, not `My First App`. npm uses it, and Electron uses it as the app's name when nothing better is given.

### productName

The **human-friendly** name of your app, with capitals and spaces allowed. When it is present, Electron prefers it over `name`. Packaging tools like Electron Forge also use it for the app's file name and the name people see in menus. It is optional, but most apps set it.

### version

The app's version, written as three numbers: `MAJOR.MINOR.PATCH`. This style is called **semantic versioning** (semver):

- Bump **PATCH** (`1.0.0` to `1.0.1`) for bug fixes.
- Bump **MINOR** (`1.0.1` to `1.1.0`) for new features that do not break anything.
- Bump **MAJOR** (`1.1.0` to `2.0.0`) for big changes that might break things for users.

Auto-updates, installers and the "About" box all read this number, so keep it up to date.

### description, author and license

Plain information about your app. `description` is one sentence about what it does. `author` is you (or your company). `license` says how others may use your code; `ISC` and `MIT` are common open-source choices. Packaging tools read `description` and `author` when they build installers, so fill them in early.

### main

The most important line for Electron. It names the file to run in the **main process**. When you run `electron .`, Electron opens `package.json`, reads `"main"`, and runs that file. If this points to a file that does not exist, the app cannot start.

### scripts

Shortcuts for commands you run often. Each key is a name, and each value is the command it runs.

```bash
npm start
npm run debug
```

- `npm start` runs the `"start"` script. `start` is special, so you can skip the word `run`.
- `npm run debug` runs the `"debug"` script. Any other script needs `run`. This one starts Electron with a debugger port open, which you will use in [Debugging with DevTools and VS Code](/courses/electronjs/debugging-electron-apps).

Inside scripts, npm can find commands in `node_modules/.bin`, which is why plain `electron` works there without `npx`.

### keywords

A list of search words. It only matters if you publish the package to npm, so you can leave it empty.

### type

This tells Node.js which module style your `.js` files use:

- `"commonjs"` means `require(...)` and `module.exports`. This course uses CommonJS for the plain (no bundler) lessons, just like Electron's official tutorial.
- `"module"` means modern `import` and `export` syntax (ES modules). Electron's main process supports it. If you switch, note that `__dirname` does not exist in ES modules; use `import.meta.dirname` instead.

> **Note:** Sandboxed preload scripts (the default) must stay CommonJS, whatever `type` says. Later, when you use Electron Forge with Vite, a bundler handles this for you.

### devDependencies and dependencies

Both list packages your project uses, but they mean different things in an Electron app:

- **devDependencies** are tools you need only while building: Electron itself, Electron Forge, test tools, bundlers.
- **dependencies** are packages your app's code needs **at run time**, inside the finished app. For example, a Markdown library that `main.js` requires.

When you package your app, tools copy `dependencies` into it and leave `devDependencies` out. Electron must stay in `devDependencies`: the packaging tool adds the Electron runtime in its own special way.

Install each kind like this:

```bash
npm install --save-dev electron
npm install marked
```

The first adds to `devDependencies`, the second (no flag) adds to `dependencies`.

### What does `^45.0.0` mean?

The caret (`^`) means "this version, or any newer version with the same first number". So `^45.0.0` allows `45.0.1` or `45.2.0`, but not `46.0.0`. That way you get bug fixes automatically, but not big breaking changes. To move to a new major version of Electron on purpose, run:

```bash
npm install --save-dev electron@latest
```

## package-lock.json

npm writes this file for you. It records the **exact** version of every package it installed, including the packages your packages depend on. When someone else runs `npm install` on your project, they get exactly the same versions you had.

- **Do** keep it and share it (commit it to Git).
- **Do not** edit it by hand.

## node_modules

This folder holds the downloaded packages. It can be large, and you never edit it.

- **Do not** share it or commit it to Git. Anyone can recreate it by running `npm install`, which reads `package.json` and `package-lock.json`.
- If it gets into a strange state, delete the folder and run `npm install` again.

If you use Git, create a `.gitignore` file so Git skips the folders you do not want to track:

```text
node_modules/
out/
```

`out/` is where Electron Forge will put packaged apps later.

## The four code files

Each of your own files runs in a specific place. You met this idea in [How Electron Works: Main and Renderer Processes](/courses/electronjs/main-and-renderer-processes):

| File | Runs in | Can use |
| --- | --- | --- |
| `main.js` | Main process | Node.js, all of Electron's main-process APIs, no DOM |
| `preload.js` | The window, before the page | `require('electron')` for `contextBridge` and `ipcRenderer`, plus the DOM |
| `index.html` | The window | HTML and CSS, loads `renderer.js` |
| `renderer.js` | The window | The DOM and Web APIs, plus whatever the preload shared. No Node.js. |

The file names are just conventions. Electron only cares about the `"main"` field, the `preload` path you give to `BrowserWindow`, and the HTML file you load. Sticking to these names makes your project easy for others (and future you) to read.

## Reading package.json from your app

Electron reads some `package.json` values for you. Try this in `main.js`:

```javascript
// main.js
const { app } = require('electron');

console.log('Name:', app.getName());
console.log('Version:', app.getVersion());
console.log('Packaged?', app.isPackaged);
console.log('App folder:', app.getAppPath());
```

```bash
npm start
```

```text
Name: My First App
Version: 1.0.0
Packaged? false
App folder: /Users/asha/my-first-app
```

- `app.getName()` returns `productName` when it exists, otherwise `name`.
- `app.getVersion()` returns `version`.
- `app.isPackaged` is `false` while you develop with `npm start`, and `true` inside a packaged app. It is handy for "development only" code, like opening DevTools automatically.
- `app.getAppPath()` is the folder that holds your app's `package.json`.

## Growing the project

As your app grows, you will add more files. A tidy layout for the plain lessons in this course looks like this:

```text
my-first-app/
├── package.json
├── main.js
├── preload.js
├── index.html
├── renderer.js
├── styles/
│   └── style.css
└── images/
    └── logo.png
```

You will add styles and images in [Loading Pages, Styles and Images](/courses/electronjs/loading-pages-and-assets). Bigger apps often move the code into a `src/` folder, which is what Electron Forge does. You will see that layout in the next lesson.

## Common mistakes

### A trailing comma or a comment in package.json

JSON is strict. Every key and string needs double quotes, there are no comments, and the last item in a list or object must not have a comma after it:

```json
{
  "name": "my-first-app",
  "main": "main.js",
}
```

That last comma breaks the file, and npm stops with an `EJSONPARSE` error. Remove the comma after `"main.js"`.

### Electron in "dependencies"

If you ran `npm install electron` without `--save-dev`, Electron lands in `dependencies`. Packaging tools expect it in `devDependencies`, and some refuse to package your app until you move it. Fix it with:

```bash
npm install --save-dev electron
```

That moves it to the right place.

### Editing files inside node_modules

Changes there are lost the next time anyone runs `npm install`. If a package needs changing, change your own code instead, or use a different package.

### Forgetting to bump the version

If you ship two builds that both say `1.0.0`, auto-update tools cannot tell them apart. Change `version` every time you release.

## Quick recap

- `package.json` is the project's label. Electron reads `"main"` to find the main process file.
- `name` is the short lowercase ID. `productName` is the friendly name and wins when present.
- `version` uses semver: `MAJOR.MINOR.PATCH`.
- `scripts` are shortcuts: `npm start`, or `npm run <name>` for anything else.
- `"type": "commonjs"` means `require`. ES modules (`"module"`) use `import.meta.dirname` instead of `__dirname`.
- Electron goes in `devDependencies`. Packages your running app needs go in `dependencies`.
- Keep `package-lock.json`. Never edit or commit `node_modules`.
- `app.getName()`, `app.getVersion()` and `app.isPackaged` read your app's details at run time.

<code id="code-content" class="language-javascript">
// main.js: an app that reads its own details from package.json
const { app, BrowserWindow } = require('electron');
const path = require('path');
// --- These come from package.json ("productName" or "name", and "version")
console.log('App name:   ', app.getName());
console.log('App version:', app.getVersion());
console.log('App folder: ', app.getAppPath());
console.log('Packaged?   ', app.isPackaged); // false while you use "npm start"
// --- Electron's own versions (its built-in Node is not the one in your terminal)
console.log('Electron', process.versions.electron, '| Node', process.versions.node, '| Chrome', process.versions.chrome);
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // the "preload" path in BrowserWindow
    },
  });
  win.loadFile('index.html'); // the page this window shows
  // Development-only helper: open DevTools when not packaged
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}
app.whenReady().then(() =&gt; {
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

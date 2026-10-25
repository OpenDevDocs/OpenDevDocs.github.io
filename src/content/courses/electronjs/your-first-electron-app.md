---
publishDate: 2026-10-25T12:03
title: Your First Electron App
slug: your-first-electron-app
metadescription: Build your first Electron desktop app from an empty folder with package.json, main.js, a preload script, index.html and renderer.js, then run it.
updateDate: 2026-10-25T12:03
author: ['bishal-biswas']
level: 1
tags: ['hello-world', 'browserwindow', 'preload']
course: electronjs
---

## What you are about to build

In this lesson you will build a real desktop app from an empty folder. It opens a window that says hello and shows which versions of Chrome, Node.js and Electron it is running on. It is small, but it has every part a real Electron app has:

```text
my-first-app/
├── package.json    the project's ID card
├── main.js         the main process: starts the app and opens the window
├── preload.js      the bridge: runs in the window before the page loads
├── index.html      the page shown inside the window
└── renderer.js     the page's own JavaScript
```

Building an app is a bit like setting up a puppet show. `main.js` builds the stage and opens the curtain (the window). `index.html` is the scenery. `renderer.js` makes things move on stage. And `preload.js` is the small hatch in the back wall that passes props from backstage to the performers.

You need Node.js and VS Code installed. If `node --version` does not print a version yet, go back to [Setting Up Your Computer for Electron](/courses/electronjs/setting-up-your-computer).

## Step 1: create the project

Open a terminal and run:

```bash
mkdir my-first-app
cd my-first-app
npm init -y
```

- `mkdir` makes a folder, and `cd` moves into it.
- `npm init -y` creates a `package.json` file with default answers.

npm prints the file it wrote:

```text
Wrote to /Users/asha/my-first-app/package.json:

{
  "name": "my-first-app",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs"
}
```

Now open the folder in VS Code with **File > Open Folder**, or type `code .` in the terminal.

## Step 2: install Electron

```bash
npm install --save-dev electron
```

This downloads Electron into a new `node_modules` folder and adds it to `package.json` under `devDependencies`. A **dev dependency** is something you need while building the app. Electron goes there because, when you package your app later, the packaging tool bundles Electron itself in a special way.

## Step 3: tell npm how to start the app

Open `package.json` and change three things:

1. Set `"main"` to `"main.js"`. This tells Electron which file to run first.
2. Replace the `"test"` script with a `"start"` script that runs `electron .`. The dot means "the app in this folder".
3. Fill in `"description"` and `"author"`. Packaging tools will ask for them later, so it is a good habit.

```json
{
  "name": "my-first-app",
  "version": "1.0.0",
  "description": "My first Electron app",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
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

Your Electron version number may be newer. That is fine. You will look at every line of this file in [Understanding package.json and the Project Files](/courses/electronjs/project-files-and-package-json).

## Step 4: write the main process

Create `main.js` in the project folder:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
});
```

Here is what each part does:

- `require('electron')` loads Electron's tools. We take two: `app` controls the whole application, and `BrowserWindow` creates windows.
- `createWindow` makes a window 800 pixels wide and 600 tall, then loads `index.html` into it.
- `app.whenReady()` returns a **Promise**, a value that says "I will let you know when something has finished". Electron needs a moment to start up, and you cannot open windows before it is ready. `.then(...)` runs our code at the right moment.

## Step 5: write the page

Create `index.html`:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'"
    />
    <title>My First App</title>
  </head>
  <body>
    <h1>Hello from Electron!</h1>
    <p>This is a web page running in a desktop window.</p>
  </body>
</html>
```

This is a normal web page, with one extra line: the **Content Security Policy** (CSP). A CSP is a rule list that tells Chromium where the page may load things from. `default-src 'self'` means "only from my own app files". It blocks scripts from strangers on the internet, which keeps your app safe. Without it, Electron prints a security warning in the developer tools. You will learn more in [Content Security Policy](/courses/electronjs/content-security-policy).

## Step 6: run it

Back in the terminal:

```bash
npm start
```

```text
> my-first-app@1.0.0 start
> electron .
```

The very first time, Electron downloads its main program, so give it a moment. Then a window opens with your heading inside it. Congratulations: that is a real desktop app!

Look around the window:

- The window title is **My First App**, taken from the page's `<title>` tag.
- On **Windows and Linux**, the window has a menu bar with **File**, **Edit**, **View** and **Window**. Electron adds this default menu for you.
- On **macOS**, the menu appears in the top bar of the screen, under the name **Electron**, and an Electron icon appears in the Dock. You will give the app its own name and icon when you package it.

To stop the app, close the window or press **Ctrl + C** in the terminal.

## Step 7: quit and reopen properly on every system

Desktop apps follow slightly different rules on each operating system:

- On **Windows and Linux**, closing the last window usually quits the app.
- On **macOS**, apps usually keep running after the last window closes, and clicking the Dock icon opens a new window.

Update the bottom of `main.js` to follow both rules:

```javascript
// main.js
app.whenReady().then(() => {
  createWindow();

  // macOS: clicking the Dock icon with no windows open makes a new one
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Windows and Linux: quit when every window has been closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

`process.platform` is a string naming the operating system: `'win32'` for Windows (even 64-bit), `'darwin'` for macOS and `'linux'` for Linux. You will copy this block into almost every app you build. [The App Lifecycle: ready, window-all-closed and activate](/courses/electronjs/app-lifecycle) explains it fully.

## Step 8: add a preload script

Now let us show some information that only Electron knows: its version numbers. Your web page cannot read these directly, because pages run without Node.js for safety (see [How Electron Works: Main and Renderer Processes](/courses/electronjs/main-and-renderer-processes)). Instead, a **preload script** will hand them over.

Create `preload.js`:

```javascript
// preload.js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});
```

`contextBridge.exposeInMainWorld('versions', ...)` puts an object called `versions` on the page's `window`, with three small functions. The page can call them, but it cannot reach anything else in the preload.

Now tell the window to use the preload. In `main.js`, add `path` at the top and a `webPreferences` option to the window:

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile('index.html');
}
```

- `path` is a built-in Node module for working with file paths.
- `__dirname` is the full path of the folder `main.js` lives in.
- `path.join` joins them with the right slash for the operating system (`\` on Windows, `/` elsewhere). The preload path must be a full (absolute) path, which is why we build it this way.

## Step 9: add the renderer script

Create `renderer.js`. This is the page's own JavaScript:

```javascript
// renderer.js
const info = document.getElementById('info');

info.textContent =
  `This app is using Chrome ${versions.chrome()}, ` +
  `Node.js ${versions.node()} and Electron ${versions.electron()}.`;
```

Then add a paragraph for it and load the script at the end of the `<body>` in `index.html`:

```html
<!-- index.html -->
<body>
  <h1>Hello from Electron!</h1>
  <p>This is a web page running in a desktop window.</p>
  <p id="info"></p>
  <script src="renderer.js"></script>
</body>
```

The script goes in its own file, not inside a `<script>` tag with code in it. Our CSP (`script-src 'self'`) only allows script **files** from the app, which is a good, safe habit.

## Step 10: run it again

Close the old window (or press Ctrl + C in the terminal), then:

```bash
npm start
```

The window now shows something like:

```text
Hello from Electron!
This is a web page running in a desktop window.
This app is using Chrome 156.0.8078.48, Node.js 24.22.0 and Electron 45.0.0.
```

Your numbers depend on your Electron version. Notice the Node.js number is probably different from what `node --version` printed in your terminal. That is Electron's own built-in Node.

## How the pieces fit together

Here is the order things happen when you type `npm start`:

1. npm runs `electron .`.
2. Electron reads `package.json`, sees `"main": "main.js"`, and runs it in the **main process**.
3. `app.whenReady()` resolves, and `createWindow` opens a window.
4. The window starts a **renderer process**, runs `preload.js`, then loads `index.html`.
5. The page loads `renderer.js`, which calls `versions.chrome()` and friends, and fills in the paragraph.

> **Tip:** After you change `index.html` or `renderer.js`, click in the window and press **Ctrl + R** (Windows and Linux) or **Cmd + R** (macOS) to reload the page. After you change `main.js` or `preload.js`, stop the app and run `npm start` again.

## Common mistakes

### The wrong "main" in package.json

If you forget to change `"main"` from `"index.js"`, Electron cannot find your app and shows an error box saying it was unable to find the app at your folder. Set `"main": "main.js"`, save, and try again.

### Opening a window too early

```text
Error: Cannot create BrowserWindow before app is ready
```

You called `new BrowserWindow(...)` at the top of `main.js`. Create windows inside `app.whenReady().then(...)`, as in Step 4.

### Putting code inside a script tag

If you write `<script>console.log('hi')</script>` directly in `index.html`, nothing happens, and the DevTools console shows:

```text
Executing inline script violates the following Content Security Policy directive 'script-src 'self''.
```

Your CSP is doing its job. Move the code into `renderer.js`.

### Calling `require` in renderer.js

```text
Uncaught ReferenceError: require is not defined
```

Web pages do not get Node.js. Put Node and Electron work in `main.js`, and share it with the page through `preload.js`, as you did with `versions`.

## Quick recap

- An Electron app needs `package.json` with `"main": "main.js"` and a `"start": "electron ."` script.
- Install Electron per project with `npm install --save-dev electron`, and run your app with `npm start`.
- `main.js` waits for `app.whenReady()`, then creates a `BrowserWindow` and calls `loadFile('index.html')`.
- The lifecycle block quits on Windows and Linux when all windows close, and reopens a window on macOS from the Dock.
- `preload.js` uses `contextBridge.exposeInMainWorld` to give the page a few safe functions.
- `renderer.js` is normal page JavaScript, loaded with `<script src="renderer.js">`.
- Reload the page with Ctrl + R (Cmd + R). Restart the app after changing `main.js` or `preload.js`.

<code id="code-content" class="language-javascript">
// main.js: the complete main process for your first app ("npm start" to run)
const { app, BrowserWindow } = require('electron');
const path = require('path');
// --- Create the window and load the page
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Runs inside the window before index.html, and shares "versions" with the page
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html'); // index.html loads renderer.js with a script tag
}
// --- Start when Electron is ready
app.whenReady().then(() =&gt; {
  createWindow();
  // macOS: re-create a window when the Dock icon is clicked and none are open
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
// --- Windows and Linux: quit when every window is closed
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
// --- preload.js
// const { contextBridge } = require('electron');
// contextBridge.exposeInMainWorld('versions', {
//   node: () =&gt; process.versions.node,
//   chrome: () =&gt; process.versions.chrome,
//   electron: () =&gt; process.versions.electron,
// });
// --- renderer.js
// document.getElementById('info').textContent =
//   `Chrome ${versions.chrome()}, Node.js ${versions.node()}, Electron ${versions.electron()}`;
</code></pre>

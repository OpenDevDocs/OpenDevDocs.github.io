---
publishDate: 2026-10-25T12:06
title: Debugging with DevTools and VS Code
slug: debugging-electron-apps
metadescription: Open Chrome DevTools in an Electron window, learn where main and renderer logs appear, and debug the main process with breakpoints in VS Code.
updateDate: 2026-10-25T12:06
author: ['bishal-biswas']
level: 1
tags: ['debugging', 'devtools', 'vs-code']
course: electronjs
---

## Two places to look

Every app has bugs. The trick is knowing where to look. In Electron there are always **two** places, because your code runs in two kinds of process (see [How Electron Works: Main and Renderer Processes](/courses/electronjs/main-and-renderer-processes)):

- **The renderer** (your web page and its preload): debug it with **Chrome DevTools**, right inside the window.
- **The main process** (`main.js`): read its logs in the **terminal**, and step through it with **VS Code's debugger**.

It is like a car with two sets of gauges. The dashboard in front of the driver (DevTools) shows what the passenger sees: the page, its styles, its scripts. The mechanic's diagnostic port under the bonnet (the main-process debugger) shows the engine. A noise can come from either, so you need both.

This lesson uses the plain app from [Your First Electron App](/courses/electronjs/your-first-electron-app). Forge tips are included where things differ.

## Opening DevTools

DevTools are the same developer tools you know from Google Chrome. There are three ways to open them.

### 1. The menu

Electron's default menu has a **View** menu with **Toggle Developer Tools**. On Windows and Linux the menu is at the top of the window. On macOS it is in the menu bar at the top of the screen.

### 2. The keyboard

- **Windows and Linux:** Ctrl + Shift + I
- **macOS:** Cmd + Option + I

Click inside the window first, so the shortcut goes to your app.

### 3. From code

You can open DevTools automatically when the window is created:

```javascript
// main.js
win.webContents.openDevTools();
```

`win.webContents` is the object that controls the **web contents** of a window: the page inside it. You will use it a lot.

You can choose where DevTools appear with the `mode` option:

```javascript
// main.js
win.webContents.openDevTools({ mode: 'detach' });
```

| Mode | Where DevTools appear |
| --- | --- |
| `'right'` | Docked on the right of the page |
| `'bottom'` | Docked under the page |
| `'left'` | Docked on the left |
| `'undocked'` | In a separate window, which you can dock back |
| `'detach'` | In a separate window that cannot be docked |

A separate window is often nicer for small app windows, because docked DevTools squeeze your page.

Users should never see DevTools pop up in your finished app. Only open them during development:

```javascript
// main.js
const { app } = require('electron');

if (!app.isPackaged) {
  win.webContents.openDevTools({ mode: 'detach' });
}
```

`app.isPackaged` is `false` while you run `npm start`, and `true` in a packaged app.

## A quick tour of DevTools

You will mostly use these panels:

- **Elements**: the live HTML and CSS of your page. Click an element to see and edit its styles.
- **Console**: messages from `console.log`, errors, and a prompt where you can type JavaScript that runs in the page.
- **Sources**: your page's scripts. Set breakpoints here (more below).
- **Network**: every file and request the page loads. Useful when an image or stylesheet does not show up.
- **Application**: storage such as `localStorage` and cookies.

Try the Console now. Type this and press Enter:

```javascript
versions.electron()
```

It prints the Electron version, using the function your preload shared. The Console is a great place to test your preload's API by hand.

## Where does console.log go?

This is the most important table in the lesson:

| Code in | `console.log` appears in |
| --- | --- |
| `main.js` (main process) | The **terminal** where you ran `npm start` |
| `preload.js` | The window's **DevTools Console** |
| `renderer.js` | The window's **DevTools Console** |

Try it. Add one line to each file:

```javascript
// main.js
console.log('Hello from main');
```

```javascript
// preload.js
console.log('Hello from preload');
```

```javascript
// renderer.js
console.log('Hello from renderer');
```

Run `npm start` and open DevTools. The terminal shows:

```text
> my-first-app@1.0.0 start
> electron .

Hello from main
```

And the DevTools Console shows:

```text
Hello from preload
Hello from renderer
```

The preload logs to DevTools because it runs inside the window's renderer process, just before the page.

> **Note:** In an Electron Forge project, main-process logs appear in the **App** tab of Forge's terminal dashboard, not in DevTools.

### Seeing renderer logs in the terminal

Sometimes you want everything in one place, for example when DevTools are closed. The `console-message` event on `webContents` fires every time the page logs something. You can forward those messages to the terminal:

```javascript
// main.js
win.webContents.on('console-message', (event) => {
  console.log(`[renderer ${event.level}] ${event.message}`);
});
```

```text
Hello from main
[renderer info] Hello from preload
[renderer info] Hello from renderer
```

`event.level` is `'info'`, `'warning'`, `'error'` or `'debug'`, so you can also forward only errors if the terminal gets noisy.

## Reloading after changes

- Changed `index.html`, CSS or `renderer.js`? Click the window and press **Ctrl + R** (Windows, Linux) or **Cmd + R** (macOS), or use **View > Reload**. This reloads the page and also re-runs the preload.
- Changed `main.js`? Reloading the page does **not** re-run the main process. Stop the app with Ctrl + C and run `npm start` again. In Forge, press **r** (or type `rs` and Enter).

## Breakpoints in the renderer

`console.log` is great, but sometimes you want to **pause** the code and look around. A **breakpoint** is a marker that says "stop here".

1. Open DevTools and go to the **Sources** panel.
2. Press **Ctrl + P** (Cmd + P on macOS) and type `renderer.js` to open it.
3. Click the line number where you want to stop. A blue marker appears.
4. Press Ctrl + R (Cmd + R) to reload. The page pauses on that line.
5. Hover over variables to see their values. Use the buttons at the top right to **resume**, **step over** a line, or **step into** a function.

You can also write a breakpoint straight into your code with the `debugger` statement:

```javascript
// renderer.js
const info = document.getElementById('info');
debugger; // pauses here when DevTools are open
info.textContent = `Electron ${versions.electron()}`;
```

`debugger` only pauses when DevTools are open. Remember to remove it when you are done.

## Debugging the main process

DevTools in the window cannot see `main.js`. The main process is a Node.js program, so you debug it the Node.js way.

### Option 1: the inspect flag

Node.js (and Electron) can open a **debugging port**, a door that a debugger can connect to. Add a script to `package.json`:

```json
{
  "scripts": {
    "start": "electron .",
    "debug": "electron --inspect=9229 ."
  }
}
```

```bash
npm run debug
```

```text
Debugger listening on ws://127.0.0.1:9229/1b484858-d10d-43be-8692-f988f86078db
For help, see: https://nodejs.org/learn/getting-started/debugging
```

Now open Google Chrome (or Edge), go to `chrome://inspect` (`edge://inspect` in Edge), and your app appears under **Remote Target**. Click **inspect** to get DevTools for the main process, with its own Console and Sources panels.

Use `--inspect-brk=9229` instead to pause on the very first line, which helps when the bug happens during startup.

### Option 2: VS Code (recommended)

VS Code can start your app and attach its debugger in one click. Create a folder called `.vscode` in your project, and inside it a file called `launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std"
    }
  ]
}
```

Here is what the important lines mean:

- `"type": "node"` and `"request": "launch"`: start a Node-style program and debug it.
- `"runtimeExecutable"`: run your project's own Electron instead of `node`. On Windows the file is `electron.cmd`, so the `"windows"` section overrides the path there.
- `"args": ["."]`: the same `.` you pass in `electron .`, meaning "the app in this folder".
- `"outputCapture": "std"`: show the main process's `console.log` output in VS Code's **Debug Console**.

Now debug:

1. Open `main.js` and click just left of a line number, for example inside `createWindow`. A red dot appears: that is a breakpoint.
2. Open the **Run and Debug** view (the play icon with a bug in the side bar, or **Ctrl + Shift + D**, **Cmd + Shift + D** on macOS).
3. Choose **Debug Main Process** at the top and press the green play button, or press **F5**.

Your app starts and pauses at the red dot. VS Code shows the values of your variables on the left, and you can step through the code line by line with the toolbar at the top.

### VS Code with Electron Forge

In a Forge project, `npm start` runs Forge, which builds your code before starting Electron. Forge ships helper scripts for VS Code, so use this configuration instead:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process (Forge)",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-forge-vscode-nix",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-forge-vscode-win.cmd"
      },
      "console": "integratedTerminal"
    }
  ]
}
```

Vite turns `src/main.js` into `.vite/build/main.cjs` before it runs. If a breakpoint you set in `src/main.js` never pauses, ask Vite for **source maps**, small files that link the built code back to your source lines. Add `build: { sourcemap: true }` inside `defineConfig({ ... })` in `vite.main.config.mjs`, then start debugging again.

> **Note:** Forge's template turns off the `--inspect` flags in **packaged** apps using a fuse, so strangers cannot attach a debugger to your shipped app. Debugging is for development, so this does not affect you while you build.

## When something crashes

A few signs to recognise:

- **An error in `main.js` at startup**: Electron shows an error box that starts with "A JavaScript error occurred in the main process", followed by the error and its stack trace. The terminal usually shows it too. Read the first line and the file name, just like a Node.js error.
- **A broken preload**: the page loads, but your `window.versions` (or similar) is `undefined`. The DevTools Console shows `Unable to load preload script` and the reason. You can also catch it in `main.js`:

```javascript
// main.js
win.webContents.on('preload-error', (event, preloadPath, error) => {
  console.error('Preload failed:', preloadPath, error.message);
});
```

- **A blank white window**: open DevTools and check the Console for red errors, and the Network panel for files that failed to load.

## Common mistakes

### Looking for logs in the wrong place

If a `console.log` in `main.js` "does not work", look in the terminal, not DevTools. If one in `renderer.js` "does not work", open DevTools.

### Pressing Ctrl + R after editing main.js

Reloading only reloads the page. The main process keeps running the old code. Restart the app.

### The DevTools shortcut stops working

When you replace Electron's default menu with your own (see [Application Menus](/courses/electronjs/application-menus)), the default shortcuts go with it. Include a **View** menu with the `toggleDevTools` role, or call `openDevTools()` from code during development.

### Shipping with DevTools open

If you call `openDevTools()` without checking `app.isPackaged`, your users get DevTools too. Always wrap it in `if (!app.isPackaged)`.

## Quick recap

- Open DevTools with **View > Toggle Developer Tools**, **Ctrl + Shift + I** (Cmd + Option + I on macOS), or `win.webContents.openDevTools()`.
- Main process logs go to the **terminal**. Preload and renderer logs go to **DevTools**.
- Forward page logs to the terminal with the `console-message` event.
- Ctrl + R (Cmd + R) reloads the page, not the main process.
- Use the **Sources** panel or `debugger;` to pause renderer code.
- Debug the main process with `electron --inspect=9229 .` and `chrome://inspect`, or with a VS Code `launch.json`.
- Only open DevTools when `!app.isPackaged`.

<code id="code-content" class="language-javascript">
// main.js: a debugging-friendly setup for development
const { app, BrowserWindow } = require('electron');
const path = require('path');
console.log('[main] starting'); // main process logs: the terminal (or VS Code Debug Console)
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  // --- Copy every page and preload log into the terminal too
  win.webContents.on('console-message', (event) =&gt; {
    console.log(`[renderer ${event.level}] ${event.message}`);
  });
  // --- Tell us loudly if the preload breaks
  win.webContents.on('preload-error', (event, preloadPath, error) =&gt; {
    console.error('[main] preload failed:', preloadPath, error.message);
  });
  win.loadFile('index.html');
  // --- DevTools in their own window, only while developing
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}
app.whenReady().then(() =&gt; {
  createWindow(); // set a VS Code breakpoint here, then press F5
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// package.json script for Chrome's debugger: "debug": "electron --inspect=9229 ."
</code></pre>

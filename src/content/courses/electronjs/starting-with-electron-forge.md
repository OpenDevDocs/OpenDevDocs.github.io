---
publishDate: 2026-10-25T12:05
title: Starting a Project with Electron Forge
slug: starting-with-electron-forge
metadescription: Create an Electron app with Electron Forge and Vite, tour the generated files, run it, restart it, and learn what start, package and make do.
updateDate: 2026-10-25T12:05
author: ['bishal-biswas']
level: 1
tags: ['electron-forge', 'vite', 'tooling']
course: electronjs
---

## Why use Electron Forge?

In [Your First Electron App](/courses/electronjs/your-first-electron-app) you built everything by hand. That is the best way to learn. But a real app needs more: a fast build step, installers for Windows, macOS and Linux, code signing and publishing. Setting all of that up yourself takes days.

**Electron Forge** is the official all-in-one tool from the Electron team that does it for you. It can:

- **Create** a new project with sensible settings (this lesson).
- **Start** your app while you develop, with fast rebuilds.
- **Package** your app into a program you can run without the terminal.
- **Make** installers for each operating system.
- **Release** your app to places like GitHub Releases.

Think of it like buying flat-pack furniture with the tools included. You could cut your own wood and buy your own screws, but the kit comes with every part labelled and an instruction sheet. You still build it yourself; you just skip the boring parts.

> **Note:** In this course, the lessons about windows, IPC, menus and other core features use the **plain** project from the previous lessons, so you can see exactly what Electron does. Lessons about React or Vue, TypeScript, packaging, signing and updates use **Forge**. Both styles use the same Electron APIs.

## Before you start

Electron Forge 8 needs **Node.js 22.17 or newer**. Check with:

```bash
node --version
```

If your version is older, update it first, as shown in [Setting Up Your Computer for Electron](/courses/electronjs/setting-up-your-computer).

## Step 1: create the project

In a terminal, go to the folder where you keep your projects (not inside another app) and run:

```bash
npx create-electron-app@latest my-forge-app --template vite
```

Let us read that command:

- `npx` runs a package without installing it permanently.
- `create-electron-app@latest` is Forge's project creator, at its newest version.
- `my-forge-app` is the name of the new folder.
- `--template vite` picks the **Vite** template. **Vite** is a fast **bundler**: a tool that takes all your source files and combines them into a few files Electron can load quickly. It also reloads the page instantly when you save a change.

Forge creates the folder, writes the files and installs everything. This can take a minute or two. When it finishes, move into the folder:

```bash
cd my-forge-app
```

> **Tip:** Want TypeScript? Add `--typescript`: `npx create-electron-app@latest my-forge-app --template vite --typescript`. You will learn about this in [TypeScript in Electron](/courses/electronjs/typescript-with-electron).

## Step 2: run it

```bash
npm start
```

Forge builds your code and opens a window that says **Hello World!** with a heart emoji. The **DevTools** panel opens next to the page too, because the template asks for it. You will see how to turn that off below.

Forge 8 shows a small dashboard in the terminal while the app runs:

- Your app's own output, including `console.log` from the main process, appears in the **App** tab. Switch tabs with the arrow keys or Tab; the bottom line lists the keys.
- Press **r** to restart the app after changing main-process code.
- If your terminal shows plain text instead of the dashboard, type **`rs`** and press **Enter** to restart.
- Press **Ctrl + C** to stop everything.

## Step 3: tour the files

Open the folder in VS Code. You will see:

```text
my-forge-app/
├── node_modules/
├── src/
│   ├── main.js              main process
│   ├── preload.js           preload script
│   ├── renderer.js          the page's JavaScript
│   └── index.css            the page's styles
├── index.html               the page (at the project root, for Vite)
├── forge.config.mjs         Forge settings
├── vite.main.config.mjs     Vite settings for main.js
├── vite.preload.config.mjs  Vite settings for preload.js
├── vite.renderer.config.mjs Vite settings for the page
├── package.json
├── package-lock.json
├── .gitignore
├── .oxlintrc.json           code checker settings
└── .oxfmtrc.json            code formatter settings
```

The same four pieces you built by hand are here: a main process, a preload, a page and its script. They have just moved into `src/`, and Vite now builds them.

### package.json

```json
{
  "name": "my-forge-app",
  "productName": "my-forge-app",
  "version": "1.0.0",
  "main": ".vite/build/main.cjs",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "release": "electron-forge release",
    "lint": "oxlint && oxfmt --check",
    "lint:fix": "oxlint --fix && oxfmt --write"
  }
}
```

(Some fields are left out here to save space.)

Notice `"main"`. It does not point to `src/main.js`. It points to `.vite/build/main.cjs`, the **built** file Vite creates from your source. You always edit files in `src/`; Vite writes the `.vite` folder for you. The `.cjs` ending means "CommonJS", the module style Electron loads for the main process and preloads.

The scripts:

| Command | What it does |
| --- | --- |
| `npm start` | Builds your code and runs the app for development |
| `npm run package` | Creates a runnable app in the `out/` folder, without an installer |
| `npm run make` | Packages the app and builds installers or archives in `out/make/` |
| `npm run release` | Makes the app and uploads it to a publisher like GitHub Releases |
| `npm run lint` | Checks your code for mistakes and formatting with oxlint and oxfmt |
| `npm run lint:fix` | Fixes what it safely can |

> **Note:** Older Forge versions called the release step `publish`. It was renamed to `release`; `publish` still works for now but is deprecated.

### src/main.js

```javascript
// src/main.js
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.webContents.openDevTools();
};
```

Below that, the file has the same `whenReady`, `activate` and `window-all-closed` code you wrote by hand. The new parts:

- **`import` instead of `require`.** Vite understands modern `import` syntax and turns it into CommonJS when it builds. That is also why `__dirname` still works here.
- **`electron-squirrel-startup`.** On Windows, Forge's default installer (Squirrel) briefly runs your app during install and uninstall to create or remove shortcuts. This package detects that, and the app quits straight away instead of opening a window.
- **`preload.cjs`.** Vite builds `src/preload.js` into `.vite/build/preload.cjs`, next to `main.cjs`. So the path must end in `.cjs`.
- **`MAIN_WINDOW_VITE_DEV_SERVER_URL`.** During `npm start`, Vite serves your page from a small local web server so it can reload changes instantly. Forge fills this value with that server's address (a `http://localhost` URL). In a packaged app it is empty, so the window loads the built `index.html` file instead. `MAIN_WINDOW_VITE_NAME` is the renderer's name from `forge.config.mjs` (`main_window`).
- **`openDevTools()`.** Opens DevTools every time. Handy while learning, annoying later.

### index.html and src/renderer.js

```html
<!-- index.html -->
<body>
  <h1>💖 Hello World!</h1>
  <p>Welcome to your Electron application.</p>
  <script type="module" src="/src/renderer.js"></script>
</body>
```

```javascript
// src/renderer.js
import './index.css';

console.log('👋 This message is being logged by the renderer process, included via Vite');
```

The page loads `renderer.js` as a module, and the renderer imports its CSS with `import './index.css'`. Vite handles that import and adds the styles to the page. Change a word in `index.html` or `index.css` and save: the window updates almost instantly, without a restart.

### src/preload.js

The preload starts empty, apart from a comment. You add your `contextBridge` code here, exactly as in the plain project.

### forge.config.mjs

This file tells Forge how to build and package your app. The main parts:

```javascript
// forge.config.mjs (shortened)
const config = {
  packagerConfig: {
    asar: true,
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({ /* which files Vite builds */ }),
    new FusesPlugin({ /* security switches baked into the app */ }),
  ],
};

export default config;
```

- **`packagerConfig`** controls packaging. `asar: true` bundles your app's files into a single archive file called an **ASAR**, which loads faster and is tidier.
- **`makers`** decide which installers `npm run make` builds: Squirrel for Windows, a ZIP for macOS, and `.rpm` and `.deb` packages for Linux. Forge only runs the makers that fit the system you are on.
- **`VitePlugin`** lists what Vite builds: `src/main.js` (target `main`), `src/preload.js` (target `preload`) and the renderer called `main_window`.
- **`FusesPlugin`** flips **fuses**: on/off switches built into the Electron program itself, which turn off risky features in the packaged app.

You do not need to change any of this yet. [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers) and [Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity) explain each part.

## Step 4: make your first change

Let us repeat the versions trick from the plain app, Forge style.

```javascript
// src/preload.js
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});
```

```javascript
// src/renderer.js
import './index.css';

const p = document.createElement('p');
p.textContent = `Chrome ${versions.chrome()}, Node ${versions.node()}, Electron ${versions.electron()}`;
document.body.append(p);
```

Save both files. Renderer changes usually show up straight away. The preload only runs when a page loads, so if the versions do not appear, restart the app with **r** in the Forge terminal (or `rs` and Enter). The versions then appear under the heading.

> **Tip:** Want the app to restart by itself whenever main-process code changes? Add `hotRestart: true` to the `VitePlugin` options in `forge.config.mjs`: `new VitePlugin({ hotRestart: true, build: [...], renderer: [...] })`.

Now stop DevTools opening every time. In `src/main.js`, wrap the call so it only happens during development:

```javascript
// src/main.js
if (!app.isPackaged) {
  mainWindow.webContents.openDevTools();
}
```

Or delete the line and open DevTools yourself when you need it, with **Ctrl + Shift + I** (Windows and Linux) or **Cmd + Option + I** (macOS).

## Step 5: try packaging

You can already turn your app into a real program:

```bash
npm run make
```

Forge builds the app, packages it, and runs the makers for your system. When it finishes, look inside the `out/` folder:

- `out/my-forge-app-<platform>-<arch>/` holds the packaged app you can run directly.
- `out/make/` holds the installers or archives.

Double-click the packaged app and it runs without a terminal. That is the thing you will eventually give to users. Signing, icons and auto-updates come in the **Packaging and Shipping** section of this course.

> **Note:** On Linux, the `.deb` and `.rpm` makers rely on system tools to build those packages. If `make` complains about a missing tool, install it with your package manager, or remove that maker from `forge.config.mjs` for now.

## Bringing an existing project into Forge

Already have a plain Electron project, like the one from the earlier lessons? Run this inside its folder:

```bash
npx create-electron-app@latest import
```

It adds Forge's packages, scripts and a config file to your project. (Older guides mention `electron-forge import` or `electron-forge init`. Those commands were removed in Forge 8.)

## Common mistakes

### Node.js is too old

If `npx create-electron-app` or `npm start` fails with errors about unsupported features or your Node version, run `node --version`. Forge 8 needs 22.17 or newer.

### Editing files in `.vite` or `out`

Those folders are **generated**. Vite and Forge overwrite them on every build, so your changes vanish. Always edit `src/`, `index.html` and the config files.

### Pointing the preload at `preload.js`

```text
Unable to load preload script: /Users/asha/my-forge-app/.vite/build/preload.js
```

This message appears in DevTools when the preload path is wrong. In a Forge Vite project, the built preload is `preload.cjs`, so keep `path.join(__dirname, 'preload.cjs')`.

### Running `electron .` instead of `npm start`

`"main"` points to `.vite/build/main.cjs`, which only exists after Vite builds it, and the dev server address is only set by Forge. Always use `npm start` (which runs `electron-forge start`) in a Forge project.

## Quick recap

- Electron Forge creates, runs, packages, makes installers for and releases Electron apps.
- Create a project with `npx create-electron-app@latest my-app --template vite` (add `--typescript` for TypeScript). Forge 8 needs Node.js 22.17+.
- Source lives in `src/`. Vite builds it into `.vite/`, and `"main"` points to `.vite/build/main.cjs`.
- The preload path is `preload.cjs`. The page loads from `MAIN_WINDOW_VITE_DEV_SERVER_URL` in development and from a built file when packaged.
- `npm start` runs the app. Press **r** (or type `rs` and Enter) to restart it.
- `npm run package`, `npm run make` and `npm run release` package, build installers and publish.
- Import an existing project with `npx create-electron-app@latest import`.

<code id="code-content" class="language-javascript">
// src/main.js: Forge + Vite template, with DevTools only in development
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
// --- Windows installer (Squirrel) runs the app briefly to make shortcuts: quit then
if (started) {
  app.quit();
}
const createWindow = () =&gt; {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Vite builds src/preload.js into .vite/build/preload.cjs
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  // --- Development: Vite's dev server. Packaged app: the built index.html file.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  // --- Open DevTools only while developing
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};
app.whenReady().then(() =&gt; {
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
</code></pre>

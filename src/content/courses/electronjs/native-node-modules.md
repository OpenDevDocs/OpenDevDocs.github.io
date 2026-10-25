---
publishDate: 2026-10-25T12:46
title: Native Node Modules
slug: native-node-modules
metadescription: Learn what native Node modules are, why they must match Electron's ABI, and how to rebuild, package and unpack them with @electron/rebuild and Forge.
updateDate: 2026-10-25T12:46
author: ['bishal-biswas']
level: 3
tags: ['native-modules', 'electron-rebuild', 'packaging']
course: electronjs
---

## What is a native module?

Most npm packages are plain JavaScript. Node reads the `.js` files and runs them, and the same files work on Windows, macOS and Linux.

A **native module** (also called a native addon) is different. Part of it is written in C or C++ and **compiled** into a binary file that ends in `.node`. When you `require` it, Node loads that binary straight into memory, like a small program glued onto Node. People use native modules when they need raw speed or access to something JavaScript cannot reach on its own.

Some well-known examples:

- **`better-sqlite3`**: a fast SQLite database, which you used in [A Local Database with SQLite](/courses/electronjs/local-database-with-sqlite).
- **`sharp`**: image resizing and conversion.
- **`serialport`**: talking to USB and serial devices.
- **`node-pty`**: running a real terminal, like VS Code's built-in terminal.

You can spot one by looking for a `binding.gyp` file in the package folder, or a `.node` file somewhere inside it.

## Why Electron cares: the ABI

A compiled `.node` file is like a key cut for one exact lock. It fits the lock it was cut for, and no other.

The "lock" is called the **ABI** (Application Binary Interface). It is the low-level agreement about how compiled code talks to Node: how functions are called and how memory is laid out. Every Node version has an ABI number, called `NODE_MODULE_VERSION`.

Electron includes its own copy of Node, and its ABI number is **not the same** as the Node on your computer, even when the Node version looks similar. You can see this yourself:

```bash
node -p "process.versions.modules"
```

```text
137
```

Now ask Electron. Create a tiny `abi.js`:

```javascript
// abi.js
const { app } = require('electron');

app.whenReady().then(() => {
  console.log('Electron ABI:', process.versions.modules);
  console.log('Platform:', process.platform, process.arch);
  app.quit();
});
```

```bash
npx electron abi.js
```

```text
Electron ABI: 150
Platform: win32 x64
```

Your numbers may differ, but the point stays the same: two different locks. When you run `npm install`, npm builds or downloads native modules for **your system's Node**. Electron then refuses to load them and you see an error like this:

```text
Error: The module '...\node_modules\some-native-module\build\Release\addon.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 137. This version of Node.js requires
NODE_MODULE_VERSION 150. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

The message suggests `npm rebuild`, but that would rebuild for your system Node again. For Electron, you need a tool that builds against **Electron's** headers.

The key also has to match two more things:

- **The operating system.** A `.node` file built on Windows will not load on macOS or Linux.
- **The CPU architecture.** An `x64` build will not load on an `arm64` machine, such as an Apple Silicon Mac.

That is why apps with native modules are built separately on each platform, which you will set up in [Publishing Releases to GitHub and App Stores](/courses/electronjs/publishing-releases).

## Node-API: modules that do not care about the version

Some native modules are written against **Node-API** (sometimes written N-API). Node-API is a stable layer that keeps the same ABI across Node and Electron versions. A module built with Node-API once can load in many Node and Electron versions without a rebuild.

Many popular modules also ship **prebuilt binaries**: ready-made `.node` files for common systems, so nobody has to compile anything. Combined with Node-API, this often means the module "just works" in Electron. Recent versions of `better-sqlite3` are a good example: they use Node-API and ship prebuilt binaries, so they load in the latest Electron with no rebuild.

How do you know which kind you have? Check the module's README. Look for words like "Node-API", "N-API", "prebuilt" or "Electron". If it says nothing, assume you need to rebuild. Rebuilding a module that did not need it is harmless, just slower.

## Rebuilding for Electron with @electron/rebuild

The official tool is **`@electron/rebuild`**. It finds every native module in your `node_modules`, works out your Electron version, and rebuilds each module against Electron's ABI. If a matching prebuilt binary exists, it downloads that instead of compiling.

Install it as a development tool:

```bash
npm install --save-dev @electron/rebuild
```

Run it after installing or updating packages:

```bash
npx electron-rebuild
```

```text
✔ Rebuild Complete
```

The command is called `electron-rebuild` even though the package is `@electron/rebuild`. Some useful options:

```bash
npx electron-rebuild -f                    # force a rebuild even if it looks up to date
npx electron-rebuild -w better-sqlite3     # only rebuild this module
npx electron-rebuild --arch arm64          # build for another CPU architecture
```

To make it automatic in a plain project, add a `postinstall` script. npm runs it after every `npm install`:

```json
{
  "scripts": {
    "start": "electron .",
    "postinstall": "electron-rebuild"
  }
}
```

### When it has to compile

If no prebuilt binary matches, the module is compiled from C/C++ source with a tool called **node-gyp**. That needs a C++ compiler and Python on your machine:

- **Windows:** install "Visual Studio Build Tools" and tick the **Desktop development with C++** workload. Python from python.org or the Microsoft Store.
- **macOS:** run `xcode-select --install` to get the Xcode Command Line Tools.
- **Linux:** install `build-essential` (Debian and Ubuntu) or `gcc-c++` and `make` (Fedora), plus `python3`.

If you see long errors mentioning `gyp`, `MSBuild` or `make`, a missing compiler is the usual cause.

## Electron Forge does this for you

If your project uses Electron Forge, as in [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge), you do not need to run `electron-rebuild` yourself. Forge uses `@electron/rebuild` internally and rebuilds native modules:

- when you run `npm start`, and
- when you package or make your app. You can see the step in the terminal:

```text
❯ Packaging for x64 on win32
❯ Copying files
✔ Copying files
❯ Preparing native dependencies
✔ Preparing native dependencies
```

You can tune the rebuild with `rebuildConfig` in `forge.config.mjs`. The options are passed to `@electron/rebuild`:

```javascript
// forge.config.mjs
const config = {
  rebuildConfig: {
    onlyModules: ['better-sqlite3'], // skip other native modules
    force: true,                     // always rebuild, even if it looks up to date
  },
  // ...packagerConfig, makers, plugins
};
```

The default `rebuildConfig: {}` is fine for most apps.

## Native modules and the ASAR archive

When you package your app, Forge puts your code into a single archive file called **ASAR** (`app.asar`). It works like a zip file that Electron can read without unpacking. You will learn more in [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers).

`.node` files are a problem inside an archive. The operating system can only load a binary from a real file on disk. Electron works around this by copying the binary to a temporary folder each time, which is slow, can be blocked by antivirus software, and breaks code signing on macOS.

The fix is to keep native binaries **outside** the archive, in a folder next to it called `app.asar.unpacked`. Forge has a plugin that does this automatically. The template already lists it in `devDependencies`. Add it to your plugins:

```javascript
// forge.config.mjs
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config = {
  // ...
  plugins: [
    new AutoUnpackNativesPlugin({}),
    // ...VitePlugin and FusesPlugin stay as they are
  ],
};
```

Your code does not change. `require('better-sqlite3')` still works, and Electron loads the binary from `app.asar.unpacked` for you.

## One extra step with the Vite template

The Forge Vite template **bundles** your main process code: Vite copies everything your `src/main.js` imports into one file, `.vite/build/main.cjs`. When packaging, the Vite plugin then keeps **only** the `.vite` folder. Your `node_modules` folder is left out entirely, because everything is already inside the bundle.

A native module cannot be bundled, because a `.node` binary is not JavaScript. You need two changes.

First, tell Vite to leave the module out of the bundle. It becomes an **external**, meaning a normal `require` at run time:

```javascript
// vite.main.config.mjs
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
});
```

Second, tell the packager to copy that module from `node_modules` too. Setting your own `ignore` function in `packagerConfig` replaces the one the Vite plugin adds:

```javascript
// forge.config.mjs
// Folders to copy into the app. Everything else is ignored.
const keep = ['/.vite', '/node_modules/better-sqlite3'];

const config = {
  packagerConfig: {
    asar: true,
    ignore: (file) => {
      if (!file || file === '/node_modules') return false;
      return !keep.some((dir) => file === dir || file.startsWith(`${dir}/`));
    },
  },
  // ...
};
```

The `ignore` function is called for every file path in your project, such as `/src/main.js` or `/node_modules/better-sqlite3/package.json`. It returns `true` to leave a file out. Here, everything is left out except the `.vite` build output and the folders in `keep`.

If the native module itself depends on other packages at run time, add their folders to `keep` as well. Look at the `dependencies` in the module's own `package.json` to find them. After packaging, you can check what made it in:

```bash
npx @electron/asar list out/my-app-win32-x64/resources/app.asar
```

## Where native modules can run

Native modules need Node.js, so they only work where Node is available:

- **The main process:** yes.
- **A utility process:** yes, and it is often the best place. If the native code crashes, only the utility process dies, not your whole app. See [Background Work with utilityProcess](/courses/electronjs/utility-process).
- **Renderers and sandboxed preloads:** no. A sandboxed preload can only `require('electron')`. Use IPC to ask the main process instead.

## Common mistakes

### Running `npm rebuild` instead of `electron-rebuild`

`npm rebuild` builds for your system Node, which is the wrong lock. Use `npx electron-rebuild`, or let Forge handle it.

### Upgrading Electron and forgetting to rebuild

A new Electron version often has a new ABI number. After upgrading, rebuild native modules again, or run your Forge `start` command, which does it for you.

### Packaging on one system for another

You cannot build a Windows app with native modules on a Mac and expect the `.node` file to work. Build on each operating system, usually with a CI (continuous integration) service that has Windows, macOS and Linux machines.

### The module works in development but is missing after packaging

With the Vite template, this is almost always the bundling step. Add the module to `external` in `vite.main.config.mjs` and to the `keep` list in your `ignore` function, then package again.

## Quick recap

- A native module contains compiled C/C++ code in a `.node` file.
- It must match the ABI (`NODE_MODULE_VERSION`), the operating system and the CPU architecture.
- Electron's ABI differs from your system Node's, so modules installed by npm may fail to load.
- Node-API modules and prebuilt binaries often work without rebuilding. Check the README.
- `npx electron-rebuild` (from `@electron/rebuild`) rebuilds modules for Electron. A `postinstall` script makes it automatic.
- Electron Forge rebuilds automatically on start and package. Tune it with `rebuildConfig`.
- `AutoUnpackNativesPlugin` keeps `.node` files outside `app.asar`, in `app.asar.unpacked`.
- With the Vite template, mark the module as `external` and keep its folder with a custom `ignore` function.
- Run native code in the main process or, better, a utility process. Never in a sandboxed renderer.

<code id="code-content" class="language-javascript">
// main.js: load a native module safely and explain ABI problems to the user
const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
// --- 1. What is Electron's ABI on this machine?
console.log('Electron ABI (NODE_MODULE_VERSION):', process.versions.modules);
console.log('Node-API version:', process.versions.napi);
console.log('Platform and CPU:', process.platform, process.arch);
// --- 2. Try to load the native module
let Database = null;
try {
  Database = require('better-sqlite3');
} catch (error) {
  console.error('Could not load better-sqlite3:', error.message);
}
// --- 3. Use it if it loaded, otherwise explain how to fix it
function openDatabase() {
  const file = path.join(app.getPath('userData'), 'notes.db');
  const db = new Database(file);
  db.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT)');
  db.prepare('INSERT INTO notes (text) VALUES (?)').run(`Opened at ${new Date().toLocaleString()}`);
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM notes').get();
  console.log(`Database at ${file} has ${count} notes`);
  return db;
}
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}
app.whenReady().then(async () =&gt; {
  if (Database) {
    const db = openDatabase();
    app.on('will-quit', () =&gt; db.close());
  } else {
    await dialog.showMessageBox({
      type: 'error',
      message: 'A native module could not be loaded',
      detail: 'Run "npx electron-rebuild" in the project folder, then start the app again.',
    });
  }
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

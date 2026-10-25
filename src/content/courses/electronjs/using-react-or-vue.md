---
publishDate: 2026-10-25T12:35
title: Using React or Vue with Electron
slug: using-react-or-vue
metadescription: Add React or Vue to an Electron Forge Vite project, render components in the renderer, and call your preload API safely from components and hooks.
updateDate: 2026-10-25T12:35
author: ['bishal-biswas']
level: 2
tags: ['react', 'vue', 'vite']
course: electronjs
---

## Electron does not care which UI library you use

So far your pages have been plain HTML with a bit of JavaScript. As an app grows, keeping the screen in sync with your data by hand (`createElement`, `textContent`, `replaceChildren`) gets tiring. That is the problem **UI libraries** such as **React** and **Vue** solve: you describe what the screen should look like for the current data, and the library updates the page for you when the data changes.

Here is the good news. To Electron, a React or Vue app is just a web page. It runs in the **renderer process**, inside the same sandbox as before. Your `main.js` and `preload.js` do not change at all.

Think of Electron as a picture frame. You can put a pencil sketch (plain HTML), an oil painting (React) or a watercolour (Vue) inside it. The frame, the wall hook and the glass are the same.

```text
main.js     (Node.js, windows, menus, files)      <- unchanged
preload.js  (contextBridge: window.api)           <- unchanged
renderer    (React or Vue components)             <- this is what changes
```

In this lesson you will use the **Vite template** of Electron Forge. **Vite** is a build tool: it turns modern files like `.jsx` and `.vue` into plain JavaScript the browser understands, and reloads the page instantly while you develop. You met Forge in [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge).

## Step 1: create a Forge Vite project

```bash
npx create-electron-app@latest react-demo --template vite
cd react-demo
npm start
```

You should see the "Hello World!" window with DevTools open. Close it, and look at the files that matter for this lesson:

```text
react-demo/
├── index.html                <- the page, loads /src/renderer.js
├── forge.config.mjs
├── vite.main.config.mjs      <- build settings for main.js
├── vite.preload.config.mjs   <- build settings for preload.js
├── vite.renderer.config.mjs  <- build settings for the page (React/Vue go here)
└── src/
    ├── main.js
    ├── preload.js
    ├── renderer.js
    └── index.css
```

> **Note:** Forge 8 needs Node.js 22.17 or newer. If `create-electron-app` complains, update Node first.

## Step 2: add React

Install React itself, plus Vite's React plugin as a development tool:

```bash
npm install react react-dom
npm install --save-dev @vitejs/plugin-react
```

- `react` is the library that manages components and state.
- `react-dom` connects React to a web page's DOM (Document Object Model: the tree of elements in the page).
- `@vitejs/plugin-react` teaches Vite about JSX and gives you **Fast Refresh**, which updates a component in place when you save, without losing what you typed.

Tell Vite to use the plugin for the renderer. Replace `vite.renderer.config.mjs` with:

```javascript
// vite.renderer.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
});
```

Only the renderer config changes. The main and preload configs stay empty, because React does not run there.

### Rename the renderer entry

React components are usually written in **JSX**, a syntax that lets you write HTML-like tags inside JavaScript. Files that contain JSX end in `.jsx`.

1. Rename `src/renderer.js` to `src/renderer.jsx`.
2. Update `index.html` so it loads the new file and has an empty element for React to fill:

```html
<!-- index.html -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>React in Electron</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer.jsx"></script>
  </body>
</html>
```

### Mount your first component

```javascript
// src/renderer.jsx
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```javascript
// src/App.jsx
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <h1>Hello from React</h1>
      <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>
    </main>
  );
}
```

Run `npm start`. You should see the heading and a working counter. Change the heading text and save: the window updates without a restart and the counter keeps its value. That is Fast Refresh.

## Step 3: talk to the main process from React

A React component cannot use Node.js or Electron directly, for the same reason a plain page cannot: the renderer is sandboxed. You still go through the preload and IPC, exactly as you learned in [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle).

Let's show the app version and react to the system's dark mode.

### The main process

Add two things to `src/main.js`: a handler that answers a question, and a message sent when the theme changes.

```javascript
// src/main.js (additions)
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';

// inside app.whenReady().then(() => { ... }), before createWindow():
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: process.platform,
}));

nativeTheme.on('updated', () => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors);
  }
});

ipcMain.handle('theme:isDark', () => nativeTheme.shouldUseDarkColors);
```

### The preload

In a Forge Vite project the preload uses `import` syntax. Vite bundles it into `preload.cjs` for you.

```javascript
// src/preload.js
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  isDarkMode: () => ipcRenderer.invoke('theme:isDark'),
  onThemeChanged: (callback) => {
    const listener = (_event, isDark) => callback(isDark);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },
});
```

Notice that `onThemeChanged` **returns a function** that removes the listener. This matters a lot in React, as you will see next.

### Using the API in a component

React's `useEffect` hook runs code after a component appears on screen. If you return a function from it, React calls that function when the component goes away. This is called **cleanup**.

```javascript
// src/App.jsx
import { useEffect, useState } from 'react';

export default function App() {
  const [info, setInfo] = useState(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    window.api.getAppInfo().then(setInfo);
    window.api.isDarkMode().then(setDark);
  }, []);

  useEffect(() => {
    const unsubscribe = window.api.onThemeChanged(setDark);
    return unsubscribe; // cleanup: stop listening when the component unmounts
  }, []);

  return (
    <main className={dark ? 'dark' : 'light'}>
      <h1>React in Electron</h1>
      {info ? (
        <p>
          App {info.version} on Electron {info.electron} ({info.platform})
        </p>
      ) : (
        <p>Loading...</p>
      )}
      <p>The system is in {dark ? 'dark' : 'light'} mode.</p>
    </main>
  );
}
```

```css
/* src/index.css (add) */
main.light { background: #fff; color: #222; }
main.dark { background: #1e1e1e; color: #eee; }
main { min-height: 100vh; padding: 1rem; font-family: system-ui, sans-serif; }
```

Now switch your operating system between light and dark mode (Windows: Settings, Personalisation, Colours. macOS: System Settings, Appearance. Many Linux desktops have a similar setting). The page follows along.

> **Tip:** In development, `<StrictMode>` deliberately runs each effect twice (mount, cleanup, mount again) to catch missing cleanups. Without the returned `unsubscribe`, you would register two listeners and every theme change would fire twice. With cleanup, it just works.

## Reloading during development

With the Vite template, two kinds of reload happen:

- Changes to renderer files (`.jsx`, `.css`, `.vue`) update the window instantly.
- Changes to `src/main.js` need the main process to restart. In the terminal running `npm start`, type `rs` and press Enter. (You can also set `hotRestart: true` in the Vite plugin options in `forge.config.mjs` to restart automatically.)

Preload changes are rebuilt and the window reloads by itself to pick them up. If it ever looks stale, press `Ctrl+R` (`Cmd+R` on macOS) in the window.

## The Vue version

If you prefer Vue, the steps are almost the same. Start from a fresh Forge Vite project:

```bash
npx create-electron-app@latest vue-demo --template vite
cd vue-demo
npm install vue
npm install --save-dev @vitejs/plugin-vue
```

```javascript
// vite.renderer.config.mjs
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [vue()],
});
```

Vue components usually live in **single-file components** (`.vue` files) with a template, a script and styles together:

```html
<!-- src/App.vue -->
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

const info = ref(null);
const dark = ref(false);
let unsubscribe;

onMounted(async () => {
  info.value = await window.api.getAppInfo();
  dark.value = await window.api.isDarkMode();
  unsubscribe = window.api.onThemeChanged((isDark) => (dark.value = isDark));
});

onUnmounted(() => unsubscribe?.());
</script>

<template>
  <main :class="dark ? 'dark' : 'light'">
    <h1>Vue in Electron</h1>
    <p v-if="info">App {{ info.version }} on Electron {{ info.electron }}</p>
    <p v-else>Loading...</p>
  </main>
</template>
```

Keep the file name `src/renderer.js` (Vue does not need JSX) and mount the app:

```javascript
// src/renderer.js
import './index.css';
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

And give it a place to mount in `index.html`:

```html
<!-- index.html (body) -->
<body>
  <div id="app"></div>
  <script type="module" src="/src/renderer.js"></script>
</body>
```

Use the same `src/main.js` and `src/preload.js` from the React section. That is the whole point: the Electron side does not change.

## Packaging works the same way

When you run `npm run make`, Vite builds your React or Vue code into plain HTML, CSS and JavaScript in `.vite/renderer/main_window/`, and Forge packages that. The `MAIN_WINDOW_VITE_DEV_SERVER_URL` check in `main.js` loads the dev server while developing and the built files in the packaged app. Nothing extra is needed. [Packaging and Making Installers with Forge](/courses/electronjs/packaging-and-installers) covers making installers.

## Common mistakes

### Forgetting to update the script tag

If you rename `renderer.js` to `renderer.jsx` but `index.html` still says `/src/renderer.js`, you will get a blank window and a 404 error in DevTools. The `src` in the script tag must match the file name.

### Importing Node or Electron modules in components

```javascript
import fs from 'node:fs'; // in a component: fails
import { ipcRenderer } from 'electron'; // in a component: fails
```

Components run in the sandboxed renderer. Put that code in `main.js`, and reach it through a function you expose in `preload.js`.

### Opening the dev server in a normal browser

While `npm start` runs, Vite serves the page at a `localhost` address, and you might open it in Chrome to use its tools. It will load, but `window.api` is `undefined` there, because there is no preload in a normal browser. Debug inside the Electron window instead, as shown in [Debugging with DevTools and VS Code](/courses/electronjs/debugging-electron-apps).

### Listeners that never get removed

Every `ipcRenderer.on` inside a component must be undone when the component goes away. Return an unsubscribe function from your preload and call it in `useEffect` cleanup (React) or `onUnmounted` (Vue).

## Quick recap

- React and Vue run in the renderer, so `main.js` and `preload.js` stay the same.
- Scaffold with `npx create-electron-app@latest my-app --template vite`.
- For React: install `react`, `react-dom` and `@vitejs/plugin-react`, add `react()` to `vite.renderer.config.mjs`, and use a `.jsx` entry.
- For Vue: install `vue` and `@vitejs/plugin-vue`, add `vue()` to the renderer config, and mount with `createApp(App).mount('#app')`.
- Components call Electron only through the preload API, such as `window.api.getAppInfo()`.
- Preload subscription functions should return an unsubscribe function for cleanup.
- Renderer changes reload instantly; type `rs` to restart the main process.

<code id="code-content" class="language-javascript">
// src/main.js: Forge Vite main process serving a React (or Vue) renderer
import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
if (started) app.quit();
const createWindow = () =&gt; {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  // --- Dev server while developing, built files when packaged
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};
app.whenReady().then(() =&gt; {
  // --- Questions the components can ask through window.api
  ipcMain.handle('app:info', () =&gt; ({
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: process.platform,
  }));
  ipcMain.handle('theme:isDark', () =&gt; nativeTheme.shouldUseDarkColors);
  // --- Push theme changes to every window
  nativeTheme.on('updated', () =&gt; {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors);
    }
  });
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// src/preload.js exposes getAppInfo(), isDarkMode() and onThemeChanged(cb) returning an unsubscribe function
// vite.renderer.config.mjs: plugins: [react()] for React, or plugins: [vue()] for Vue
</code></pre>

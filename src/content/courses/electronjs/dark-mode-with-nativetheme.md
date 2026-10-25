---
publishDate: 2026-10-25T12:28
title: Dark Mode with nativeTheme
slug: dark-mode-with-nativetheme
metadescription: "Support dark mode in Electron: follow the system with prefers-color-scheme, let users pick light, dark or system with nativeTheme, and react to theme changes."
updateDate: 2026-10-25T12:28
author: ['bishal-biswas']
level: 2
tags: ['dark-mode', 'nativetheme', 'css']
course: electronjs
---

## Light, dark and "follow the system"

Windows, macOS and most Linux desktops let users choose a light or dark appearance. Good desktop apps respect that choice, and the best ones also offer their own switch with three options:

- **System**: follow whatever the operating system uses (the default).
- **Light**: always light.
- **Dark**: always dark.

Think of it like the lights in a smart house. Normally they follow the sunset on their own (System). But there is also a switch on the wall, so you can force them on or off whenever you like (Light or Dark). Electron gives you both the automatic behaviour and the switch.

The two tools you need:

- The CSS **`prefers-color-scheme`** media query, which lets your stylesheet react to light or dark.
- Electron's **`nativeTheme`** module in the main process, which tells you the current mode and lets you override it.

## Step 1: dark mode with only CSS

Electron already tells your page whether the system is in dark mode, through the same CSS feature browsers use. If your styles respond to it, you get dark mode for free.

Use **CSS variables** (custom properties that hold values like colours) so you only change the colours in one place:

```css
/* styles.css */
:root {
  --bg: #ffffff;
  --text: #1f2328;
  --card: #f3f4f6;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181d;
    --text: #e6e6e6;
    --card: #242832;
  }
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, sans-serif;
}

.card {
  background: var(--card);
  padding: 1rem;
  border-radius: 8px;
}
```

`color-scheme: light dark` tells the browser engine that your page supports both modes, so built-in parts such as scrollbars, text boxes and checkboxes also switch colours.

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <link rel="stylesheet" href="styles.css" />
    <title>Theme demo</title>
  </head>
  <body>
    <div class="card">
      <h1>Hello, theme!</h1>
      <label>
        Theme:
        <select id="theme">
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <p id="current"></p>
    </div>
    <script src="renderer.js"></script>
  </body>
</html>
```

The stylesheet is a separate file because the Content Security Policy above blocks inline `<style>` tags. That is a good habit; see [Content Security Policy](/courses/electronjs/content-security-policy).

Run `npm start`, then switch your operating system between light and dark:

- **Windows:** Settings, Personalisation, Colours, "Choose your mode".
- **macOS:** System Settings, Appearance.
- **Linux (GNOME):** Settings, Appearance, Style.

Your app changes colour straight away, with no JavaScript at all.

## Step 2: meet `nativeTheme`

`nativeTheme` lives in the main process. Its two most important properties are:

| Property | What it is |
| --- | --- |
| `nativeTheme.shouldUseDarkColors` | Read-only. `true` if your app is currently showing dark. |
| `nativeTheme.themeSource` | Read and write. `'system'`, `'light'` or `'dark'`. Default `'system'`. |

Setting `themeSource` is the switch on the wall. When you set it to `'dark'`:

- `prefers-color-scheme` in every window matches `dark`, so your CSS from Step 1 switches.
- `shouldUseDarkColors` becomes `true`.
- Native parts follow too: on macOS the menus and window frames turn dark, and on Windows and Linux the menus and DevTools that Electron draws turn dark.

Setting it back to `'system'` removes your override and follows the operating system again.

Try it quickly in `main.js`:

```javascript
// main.js (inside app.whenReady().then(...), just to experiment)
const { nativeTheme } = require('electron'); // at the top of the file

console.log('Dark right now?', nativeTheme.shouldUseDarkColors);
nativeTheme.themeSource = 'dark';
console.log('After forcing dark:', nativeTheme.shouldUseDarkColors);
```

```text
Dark right now? false
After forcing dark: true
```

The window turns dark even though your system is light.

## Step 3: let the user choose

The `<select>` in the page should control `themeSource`. The page cannot touch `nativeTheme` itself, so you build the usual bridge: page, preload, `invoke`, main. If this pattern is new, revisit [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle).

### Main

```javascript
// main.js
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');

const THEME_CHOICES = ['system', 'light', 'dark'];

function themeInfo() {
  return { source: nativeTheme.themeSource, dark: nativeTheme.shouldUseDarkColors };
}

ipcMain.handle('theme:get', () => themeInfo());

ipcMain.handle('theme:set', (event, choice) => {
  if (!THEME_CHOICES.includes(choice)) return themeInfo(); // ignore bad values
  nativeTheme.themeSource = choice;
  return themeInfo();
});
```

The check against `THEME_CHOICES` matters: the page should only be able to send one of three known words.

### Preload

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('theme', {
  get: () => ipcRenderer.invoke('theme:get'),
  set: (choice) => ipcRenderer.invoke('theme:set', choice),
  onUpdated: (callback) => ipcRenderer.on('theme:updated', (_event, info) => callback(info)),
});
```

### Renderer

```javascript
// renderer.js
const select = document.getElementById('theme');
const current = document.getElementById('current');

function show(info) {
  select.value = info.source;
  current.textContent = `Showing ${info.dark ? 'dark' : 'light'} colours (setting: ${info.source})`;
}

window.theme.get().then(show);

select.addEventListener('change', async () => {
  show(await window.theme.set(select.value));
});
```

Run the app and change the dropdown. "Dark" and "Light" force the look. "System" goes back to following the operating system.

## Step 4: react when the system changes

Your CSS already follows system changes automatically. But your JavaScript does not know: the "Showing light colours" text in the page goes stale when the user switches the system to dark.

`nativeTheme` emits an **`updated`** event whenever `shouldUseDarkColors` (or the high-contrast settings) changes, whether the user changed the system or your code changed `themeSource`. Forward it to every window:

```javascript
// main.js
nativeTheme.on('updated', () => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('theme:updated', themeInfo());
  }
});
```

```javascript
// renderer.js
window.theme.onUpdated(show);
```

Now leave the dropdown on "System" and switch your operating system's appearance. The text updates along with the colours.

> **Tip:** For page-only logic, the web API works too: `window.matchMedia('(prefers-color-scheme: dark)')` has a `change` event. Use `nativeTheme` when main needs to know, for example to pick a tray icon or a window background colour.

## Step 5: no white flash on startup

When a window opens, there is a brief moment before your CSS loads. Electron fills it with the window's background colour, which is white by default. In dark mode that is a bright flash.

Set `backgroundColor` to match the current theme when you create the window:

```javascript
// main.js
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16181d' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');
}
```

Use the same colours as `--bg` in your CSS so the switch is invisible.

## Remembering the choice

Right now the choice resets every time the app restarts, because `themeSource` always starts as `'system'`. To keep it, save the choice to a file and set `nativeTheme.themeSource` from that file when the app starts, **before** you create the first window. You will build exactly that in [Saving User Settings](/courses/electronjs/saving-user-settings).

## Platform notes

- **macOS** reports the system appearance reliably, and with `themeSource` the native window frame and menus follow your choice too.
- **Windows** reports the "app mode" from Settings. `nativeTheme.shouldUseDarkColorsForSystemIntegratedUI` tells you the separate "Windows mode", which affects the taskbar and Start menu, if you ever need it.
- **Linux** detection depends on the desktop environment and its theme settings. On some setups the system preference is not detected, which is one more reason to offer the manual Light and Dark options.
- **High contrast:** `nativeTheme.shouldUseHighContrastColors` (Windows and macOS) tells you if the user needs a high-contrast look. Respect it by keeping strong colour contrast in both themes.

## Common mistakes

### Trying to use `nativeTheme` in the page

`nativeTheme` only exists in main. The page uses CSS `prefers-color-scheme` and asks main through IPC for anything else.

### Reading the setting from `shouldUseDarkColors`

`shouldUseDarkColors` tells you what is **showing**, not what the user **picked**. If the user chose "System" and the system is dark, it is `true`, but the setting is still `'system'`. Use `themeSource` for the dropdown and `shouldUseDarkColors` for colours.

### Hard-coded colours

`color: black` in one rule and `background: white` in another will look broken in dark mode. Put every colour in a CSS variable and override the variables in the dark media query.

### Forgetting the `updated` event

CSS follows system changes on its own, but JavaScript state, tray icons and window backgrounds do not. Listen to `nativeTheme.on('updated')` and forward the change to your windows.

## Quick recap

- Your page follows the system automatically if your CSS uses `@media (prefers-color-scheme: dark)`. Add `color-scheme: light dark` for built-in controls.
- `nativeTheme.shouldUseDarkColors` tells main whether dark colours are showing.
- `nativeTheme.themeSource = 'system' | 'light' | 'dark'` overrides the mode for CSS and native UI. The default is `'system'`.
- Let the page change the theme through a preload function and `ipcMain.handle()`, and accept only the three known values.
- `nativeTheme.on('updated')` fires when the appearance changes. Forward it with `webContents.send()`.
- Set the window's `backgroundColor` from the theme to avoid a white flash.
- Save the user's choice and apply it before creating windows, as the settings lesson shows.

<code id="code-content" class="language-javascript">
// main.js: a light / dark / system switch with nativeTheme
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('node:path');
const THEME_CHOICES = ['system', 'light', 'dark'];
const COLORS = { dark: '#16181d', light: '#ffffff' }; // same as --bg in styles.css
function themeInfo() {
  return { source: nativeTheme.themeSource, dark: nativeTheme.shouldUseDarkColors };
}
// --- 1. Create windows with a background that matches the theme (no white flash)
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    backgroundColor: nativeTheme.shouldUseDarkColors ? COLORS.dark : COLORS.light,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}
// --- 2. The page reads and changes the theme through IPC
ipcMain.handle('theme:get', () =&gt; themeInfo());
ipcMain.handle('theme:set', (event, choice) =&gt; {
  if (!THEME_CHOICES.includes(choice)) return themeInfo();
  nativeTheme.themeSource = choice; // CSS prefers-color-scheme follows this
  return themeInfo();
});
// --- 3. Tell every window when the appearance changes (system or our switch)
nativeTheme.on('updated', () =&gt; {
  for (const win of BrowserWindow.getAllWindows()) {
    win.setBackgroundColor(nativeTheme.shouldUseDarkColors ? COLORS.dark : COLORS.light);
    win.webContents.send('theme:updated', themeInfo());
  }
});
// --- 4. Lifecycle
app.whenReady().then(() =&gt; {
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// preload.js: get / set via ipcRenderer.invoke, onUpdated(cb) via ipcRenderer.on('theme:updated')
</code></pre>

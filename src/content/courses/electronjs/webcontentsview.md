---
publishDate: 2026-10-25T12:45
title: Embedding Web Content with WebContentsView
slug: webcontentsview
metadescription: Show several web pages inside one Electron window with WebContentsView, position them with setBounds, resize them, and build a simple tabbed browser.
updateDate: 2026-10-25T12:45
author: ['bishal-biswas']
level: 3
tags: ['webcontentsview', 'tabs', 'windows']
course: electronjs
---

## What a WebContentsView is

So far, every window you made showed **one** web page. A `BrowserWindow` loads `index.html`, and that page fills the whole window.

Some apps need more than that. A browser shows a tab bar plus the website below it. A chat app might show your own sidebar next to an embedded help page. An email app might show a message from the internet next to your own trusted interface.

A **WebContentsView** is a rectangle inside a window that shows its own, separate web page. You decide where the rectangle goes and how big it is. Each view has its own `webContents`, which is Electron's name for "a loaded web page plus everything it is doing": its history, its title, its JavaScript and its renderer process.

Think of a window as a corkboard. Your `index.html` is the poster pinned to the whole board. A `WebContentsView` is a photo you pin on top of it, at an exact spot. You can pin many photos, move them, hide them and take them down.

> **Note:** Older tutorials use `BrowserView`. It is **deprecated**, which means it still works for now but will be removed. `WebContentsView` replaces it, and this lesson shows how to move over at the end.

## Why not just use an iframe?

An `<iframe>` also shows one page inside another. For your own pages, an iframe is often fine. For pages from the internet, a `WebContentsView` is better:

- Each view gets its **own renderer process**, so a heavy or crashing website cannot freeze your interface.
- The main process controls it fully: navigation, new windows, permissions, zoom and so on.
- Many websites refuse to load inside iframes (with headers like `X-Frame-Options`), but they load normally in a view.

## Step 1: one view inside a window

Start from a plain project like the one in [Your First Electron App](/courses/electronjs/your-first-electron-app). This `main.js` shows a coloured bar from your own HTML at the top and a website below it:

```javascript
// main.js
const { app, BrowserWindow, WebContentsView } = require('electron');

const BAR_HEIGHT = 60;

function createWindow() {
  const win = new BrowserWindow({ width: 1000, height: 700 });
  win.loadURL('data:text/html,<body style="margin:0;background:%232563eb;color:white;font:20px sans-serif;padding:16px">My toolbar</body>');

  const view = new WebContentsView();
  win.contentView.addChildView(view);

  const [width, height] = win.getContentSize();
  view.setBounds({ x: 0, y: BAR_HEIGHT, width, height: height - BAR_HEIGHT });

  view.webContents.loadURL('https://www.electronjs.org');
}

app.whenReady().then(createWindow);
```

```bash
npm start
```

You should see a blue bar with "My toolbar" and the Electron website underneath. Here is what each line does:

- **`new WebContentsView()`** creates an empty view. With no options, it uses the safe defaults: sandboxed, context isolation on, no Node.js.
- **`win.contentView`** is the window's root view, the corkboard itself. Every window has one.
- **`addChildView(view)`** pins your view onto it. Views added later sit on top of earlier ones.
- **`setBounds({ x, y, width, height })`** places the view. The numbers are pixels measured from the **top-left corner of the window's content area**, not the screen. The content area is the part inside the title bar and borders.
- **`win.getContentSize()`** returns `[width, height]` of that content area.
- **`view.webContents.loadURL(...)`** loads a page into the view, just like a window.

## Step 2: keep the view the right size

Drag the corner of the window to make it bigger. The website stays the same size and leaves an empty gap. A view does **not** resize itself. You must update its bounds whenever the window changes size.

Move the sizing code into a function and call it from the window's `resize` event:

```javascript
// main.js (inside createWindow)
function layout() {
  const [width, height] = win.getContentSize();
  view.setBounds({ x: 0, y: BAR_HEIGHT, width, height: Math.max(0, height - BAR_HEIGHT) });
}

layout();
for (const event of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
  win.on(event, layout);
}
```

`resize` fires while the user drags the edges. Listening to maximize and full-screen too costs nothing and covers systems where those changes do not send a `resize`. `Math.max(0, ...)` stops a negative height if the window gets very small.

## Step 3: hide, show and remove views

A few more methods let you manage views:

```javascript
view.setVisible(false);                // hide it but keep the page loaded
view.setVisible(true);                 // show it again
win.contentView.addChildView(view);    // adding an existing child moves it to the top
win.contentView.removeChildView(view); // unpin it from the window
view.webContents.close();              // destroy the page and free its memory
```

> **Warning:** Removing a view, or even closing the window, does **not** destroy the view's page. Its `webContents` keeps running in the background until you call `view.webContents.close()`. Forgetting this is a common memory leak in tabbed apps.

## Step 4: a simple tabbed browser

Now put it together. You will build a tiny browser with:

- a tab bar and an address bar, drawn by your own trusted `index.html`,
- one `WebContentsView` per tab, below the bar,
- IPC (inter-process communication) between the bar and the main process.

The project has four files: `main.js`, `preload.js`, `index.html` and `renderer.js`.

### The preload: a small, named API

The tab bar needs to ask main to open, switch, close and navigate tabs, and to hear when tabs change. Following [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api), expose only small named functions:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browser', {
  newTab: (url) => ipcRenderer.send('tab:new', url),
  switchTab: (id) => ipcRenderer.send('tab:switch', id),
  closeTab: (id) => ipcRenderer.send('tab:close', id),
  navigate: (url) => ipcRenderer.send('tab:navigate', url),
  goBack: () => ipcRenderer.send('tab:back'),
  onTabsChanged: (callback) =>
    ipcRenderer.on('tabs:changed', (_event, state) => callback(state)),
});
```

This preload is only given to **your** window. The website views get no preload at all, so pages from the internet cannot reach these functions.

### The tab bar page

```html
<!-- index.html -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" />
    <title>Tiny Browser</title>
    <style>
      body { margin: 0; font: 14px system-ui, sans-serif; background: #e5e7eb; }
      #tabs { display: flex; gap: 4px; padding: 6px 6px 0; height: 34px; }
      .tab { display: flex; align-items: center; gap: 6px; max-width: 200px; padding: 0 10px;
             background: #d1d5db; border-radius: 8px 8px 0 0; cursor: pointer; }
      .tab.active { background: white; }
      .tab span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .tab button, #new { border: 0; background: none; cursor: pointer; font-size: 14px; }
      form { display: flex; gap: 6px; padding: 6px; background: white; height: 28px; }
      input { flex: 1; padding: 0 8px; }
    </style>
  </head>
  <body>
    <div id="tabs"><button id="new" title="New tab">+</button></div>
    <form id="address">
      <button type="button" id="back">&larr;</button>
      <input id="url" placeholder="Type a web address and press Enter" />
    </form>
    <script src="renderer.js"></script>
  </body>
</html>
```

The bar is 80 pixels tall in total (34 for tabs, plus padding and the 40-pixel address row). Main will place the views just below it.

### The tab bar script

```javascript
// renderer.js
const tabsEl = document.getElementById('tabs');
const newButton = document.getElementById('new');
const urlInput = document.getElementById('url');

newButton.addEventListener('click', () => window.browser.newTab('https://www.electronjs.org'));
document.getElementById('back').addEventListener('click', () => window.browser.goBack());
document.getElementById('address').addEventListener('submit', (event) => {
  event.preventDefault();
  window.browser.navigate(urlInput.value);
});

window.browser.onTabsChanged(({ tabs, activeId }) => {
  tabsEl.querySelectorAll('.tab').forEach((el) => el.remove());

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = tab.id === activeId ? 'tab active' : 'tab';

    const title = document.createElement('span');
    title.textContent = tab.title; // textContent, never innerHTML, for page titles
    const close = document.createElement('button');
    close.textContent = '×';

    el.addEventListener('click', () => window.browser.switchTab(tab.id));
    close.addEventListener('click', (event) => {
      event.stopPropagation(); // do not also switch to the tab we are closing
      window.browser.closeTab(tab.id);
    });

    el.append(title, close);
    tabsEl.insertBefore(el, newButton);
    if (tab.id === activeId) urlInput.value = tab.url;
  }
});
```

Page titles come from websites, so they are untrusted. Using `textContent` means a title like `<img onerror=...>` is shown as plain text instead of running.

### The main process

```javascript
// main.js
const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const path = require('node:path');

const BAR_HEIGHT = 80;
let win;
let activeId = null;
let nextId = 1;
const tabs = []; // { id, view }

function layout() {
  const [width, height] = win.getContentSize();
  for (const { view } of tabs) {
    view.setBounds({ x: 0, y: BAR_HEIGHT, width, height: Math.max(0, height - BAR_HEIGHT) });
  }
}

function sendTabs() {
  if (!win) return;
  win.webContents.send('tabs:changed', {
    activeId,
    tabs: tabs.map(({ id, view }) => ({
      id,
      title: view.webContents.getTitle() || 'New tab',
      url: view.webContents.getURL(),
    })),
  });
}

function toWebUrl(input) {
  try {
    const url = new URL(String(input).includes('://') ? input : `https://${input}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function createTab(url) {
  const view = new WebContentsView(); // safe defaults, no preload
  const id = nextId++;
  tabs.push({ id, view });
  win.contentView.addChildView(view);

  // Links that open a new window become a new tab instead
  view.webContents.setWindowOpenHandler(({ url: target }) => {
    const safe = toWebUrl(target);
    if (safe) createTab(safe);
    return { action: 'deny' };
  });
  view.webContents.on('page-title-updated', sendTabs);
  view.webContents.on('did-navigate', sendTabs);

  view.webContents.loadURL(url);
  switchTab(id);
}

function switchTab(id) {
  activeId = id;
  for (const tab of tabs) tab.view.setVisible(tab.id === id);
  layout();
  sendTabs();
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;
  const [tab] = tabs.splice(index, 1);
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();

  const next = tabs[index] ?? tabs[index - 1];
  if (activeId === id && next) switchTab(next.id);
  else {
    if (!next) activeId = null;
    sendTabs();
  }
}

function activeTab() {
  return tabs.find((tab) => tab.id === activeId);
}

// Only accept messages from our own tab bar
function fromBar(handler) {
  return (event, ...args) => {
    if (event.sender === win?.webContents) handler(...args);
  };
}

ipcMain.on('tab:new', fromBar((url) => {
  const safe = toWebUrl(url);
  if (safe) createTab(safe);
}));
ipcMain.on('tab:switch', fromBar((id) => switchTab(Number(id))));
ipcMain.on('tab:close', fromBar((id) => closeTab(Number(id))));
ipcMain.on('tab:navigate', fromBar((url) => {
  const safe = toWebUrl(url);
  if (safe) activeTab()?.view.webContents.loadURL(safe);
}));
ipcMain.on('tab:back', fromBar(() => {
  const history = activeTab()?.view.webContents.navigationHistory;
  if (history?.canGoBack()) history.goBack();
}));

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
  win.webContents.once('did-finish-load', () => createTab('https://www.electronjs.org'));

  for (const event of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) {
    win.on(event, layout);
  }

  win.on('closed', () => {
    for (const { view } of tabs) view.webContents.close();
    tabs.length = 0;
    win = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

Run `npm start`. You get one tab with the Electron website. Click **+** for another tab, type an address like `github.com` and press Enter, click between tabs, and use **×** to close them.

Some details worth noticing:

- **One view per tab.** Switching tabs only calls `setVisible`. Hidden pages stay loaded, so switching back is instant and keeps your scroll position.
- **`toWebUrl`** turns user input into a full URL and refuses anything that is not `http` or `https`. That blocks addresses like `file:///` or `javascript:` from being loaded into a view.
- **`setWindowOpenHandler`** catches `target="_blank"` links and `window.open` calls. Returning `{ action: 'deny' }` stops Electron from opening a new, unmanaged window. You could instead call `shell.openExternal(url)` to send links to the user's normal browser, as in [Loading Remote Content Safely](/courses/electronjs/loading-remote-content-safely).
- **`navigationHistory`** is the modern home of back and forward. `canGoBack()` and `goBack()` live there.
- **`fromBar`** checks `event.sender` so that only the tab bar can control tabs.
- **On `closed`**, every view's page is closed by hand, because closing the window does not do it for you.

## Building a window from views only

A `BrowserWindow` always comes with one built-in page, which is why you could call `win.loadFile`. Electron also has `BaseWindow`, a window with **no** built-in page. Every piece of content is a view you add yourself. That is handy when your layout is made entirely of views, such as a sidebar view plus a content view. The ideas in this lesson (`contentView`, `addChildView`, `setBounds`, `resize`) work exactly the same way.

## Moving from BrowserView

If you find old code that uses `BrowserView`, here is how the pieces map:

| Old `BrowserView` code | New `WebContentsView` code |
| --- | --- |
| `new BrowserView(options)` | `new WebContentsView(options)` |
| `win.setBrowserView(view)` or `win.addBrowserView(view)` | `win.contentView.addChildView(view)` |
| `win.removeBrowserView(view)` | `win.contentView.removeChildView(view)` |
| `win.setTopBrowserView(view)` | `win.contentView.addChildView(view)` again |
| `view.setAutoResize(...)` | Listen for the window's `resize` event and call `setBounds` |
| `view.webContents` | `view.webContents` (unchanged) |

## Common mistakes

### The view does not appear

Usually the view was created but never given bounds, so its size is zero. Call `setBounds` right after `addChildView`, and check that the height is not negative.

### The view ignores window resizing

Views never resize themselves. Recalculate bounds in a `resize` listener, as in Step 2.

### Measuring from the screen instead of the window

`setBounds` uses coordinates inside the window's content area. If you pass values from `win.getBounds()` (which are screen positions and include the title bar), the view lands in the wrong place. Use `win.getContentSize()` for the width and height.

### Giving a website your preload

If you pass your app's preload in a view's `webPreferences`, every website loaded in that view can call your API. Keep views for remote content preload-free, and keep `sandbox` and `contextIsolation` at their defaults.

## Quick recap

- A `WebContentsView` is a separate web page placed inside a window. `BrowserView` is deprecated.
- Add it with `win.contentView.addChildView(view)` and place it with `view.setBounds({ x, y, width, height })`.
- Bounds are measured from the top-left of the window's content area. Use `win.getContentSize()`.
- Views do not resize themselves. Update them on `resize`, `maximize` and full-screen events.
- `setVisible` hides and shows a view, `removeChildView` unpins it, and `webContents.close()` frees it.
- Closing a window does not close its views' pages. Close them yourself.
- For tabs: one view per tab, a trusted tab bar with a small preload API, `setWindowOpenHandler` for new windows, and URL checks before loading.

<code id="code-content" class="language-javascript">
// main.js: a tiny tabbed browser built from WebContentsViews
const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const path = require('node:path');
const BAR_HEIGHT = 80; // height of the tab bar drawn by index.html
let win;
let activeId = null;
let nextId = 1;
const tabs = []; // { id, view }
// --- Layout: views never resize themselves
function layout() {
  const [width, height] = win.getContentSize();
  for (const { view } of tabs) {
    view.setBounds({ x: 0, y: BAR_HEIGHT, width, height: Math.max(0, height - BAR_HEIGHT) });
  }
}
function sendTabs() {
  if (!win) return;
  win.webContents.send('tabs:changed', {
    activeId,
    tabs: tabs.map(({ id, view }) =&gt; ({ id, title: view.webContents.getTitle() || 'New tab', url: view.webContents.getURL() })),
  });
}
function toWebUrl(input) {
  try {
    const url = new URL(String(input).includes('://') ? input : `https://${input}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}
// --- Tabs: one WebContentsView each
function createTab(url) {
  const view = new WebContentsView(); // sandboxed, no preload
  const id = nextId++;
  tabs.push({ id, view });
  win.contentView.addChildView(view);
  view.webContents.setWindowOpenHandler(({ url: target }) =&gt; {
    const safe = toWebUrl(target);
    if (safe) createTab(safe);
    return { action: 'deny' };
  });
  view.webContents.on('page-title-updated', sendTabs);
  view.webContents.on('did-navigate', sendTabs);
  view.webContents.loadURL(url);
  switchTab(id);
}
function switchTab(id) {
  activeId = id;
  for (const tab of tabs) tab.view.setVisible(tab.id === id);
  layout();
  sendTabs();
}
function closeTab(id) {
  const index = tabs.findIndex((tab) =&gt; tab.id === id);
  if (index === -1) return;
  const [tab] = tabs.splice(index, 1);
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close(); // free the page, removing it is not enough
  const next = tabs[index] ?? tabs[index - 1];
  if (activeId === id &amp;&amp; next) switchTab(next.id);
  else {
    if (!next) activeId = null;
    sendTabs();
  }
}
// --- IPC from the trusted tab bar only
const activeTab = () =&gt; tabs.find((tab) =&gt; tab.id === activeId);
const fromBar = (handler) =&gt; (event, ...args) =&gt; {
  if (event.sender === win?.webContents) handler(...args);
};
ipcMain.on('tab:new', fromBar((url) =&gt; { const safe = toWebUrl(url); if (safe) createTab(safe); }));
ipcMain.on('tab:switch', fromBar((id) =&gt; switchTab(Number(id))));
ipcMain.on('tab:close', fromBar((id) =&gt; closeTab(Number(id))));
ipcMain.on('tab:navigate', fromBar((url) =&gt; { const safe = toWebUrl(url); if (safe) activeTab()?.view.webContents.loadURL(safe); }));
ipcMain.on('tab:back', fromBar(() =&gt; {
  const history = activeTab()?.view.webContents.navigationHistory;
  if (history?.canGoBack()) history.goBack();
}));
// --- Window and lifecycle
function createWindow() {
  win = new BrowserWindow({ width: 1100, height: 750, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.loadFile('index.html');
  win.webContents.once('did-finish-load', () =&gt; createTab('https://www.electronjs.org'));
  for (const event of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(event, layout);
  win.on('closed', () =&gt; {
    for (const { view } of tabs) view.webContents.close();
    tabs.length = 0;
    win = null;
  });
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

---
publishDate: 2026-10-25T12:22
title: Right-Click Context Menus
slug: context-menus
metadescription: "Add native right-click menus to your Electron app: copy and paste for text, link and spelling options, and custom menus for your own page elements."
updateDate: 2026-10-25T12:22
author: ['bishal-biswas']
level: 2
tags: ['context-menu', 'menu', 'ipc']
course: electronjs
---

## What a context menu is

A **context menu** is the small menu that pops up when you right-click. It is called "context" because its items depend on what you clicked: right-click selected text and you see Copy, right-click a link and you see Open Link, right-click a text box and you see Paste.

Think of it like asking a shop assistant for help. If you are holding a shirt, they offer a fitting room. If you are holding a receipt, they offer a refund. Same question, different answers, because they look at what is in your hand first.

Here is a surprise for many beginners: **a new Electron app has no right-click menu at all.** Right-click anywhere in your window and nothing happens. A normal browser gives you a menu for free, but Electron leaves the choice to you.

In this lesson you will build two kinds of context menu:

1. A general menu for the whole page (text, links, spelling), built entirely in the main process.
2. A custom menu for your own elements, such as "Rename" and "Delete" on a note in a list, which needs a little IPC.

You should already know how to build a menu from a template. If not, read [Application Menus](/courses/electronjs/application-menus) first, because context menus use exactly the same `Menu.buildFromTemplate()` function.

## Step 1: a menu for the whole page

When the user right-clicks inside a window, the window's `webContents` emits a **`context-menu`** event in the main process. (`webContents` is the object that controls the web page inside a window.) You listen for that event, build a menu, and call `popup()` to show it at the mouse position.

Start from your plain app (`main.js`, `preload.js`, `index.html`, `renderer.js`) and change `main.js`:

```javascript
// main.js
const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
    ]);
    menu.popup({ window: win, frame: params.frame });
  });

  win.loadFile('index.html');
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

Run `npm start`, type something into a text box on your page, select it and right-click. You get a real, native menu: it looks like a Windows menu on Windows, a macOS menu on a Mac, and a GTK menu on most Linux desktops.

A few things to notice:

- Each item uses a **`role`**. A role is a ready-made action that Electron already knows how to do, so `role: 'copy'` copies the selection without you writing any code.
- `popup()` shows the menu at the mouse pointer by default. `window: win` says which window it belongs to.
- `frame: params.frame` passes along the exact frame (the page, or an iframe inside it) that was clicked. It is optional, but it lets some operating system features, such as Writing Tools on macOS, work properly.

> **Note:** On macOS, Control + click also counts as a right-click. On Windows, pressing the Menu key or Shift + F10 on the keyboard opens the context menu too, and the same `context-menu` event fires.

## Step 2: make the menu depend on what was clicked

Showing Cut and Paste on a plain paragraph is confusing, because you cannot paste into a paragraph. The second argument, `params`, describes what was under the mouse. These are the fields you will use most:

| Field | What it tells you |
| --- | --- |
| `params.isEditable` | `true` if the user clicked inside a text box or other editable area |
| `params.selectionText` | The selected text, or an empty string |
| `params.linkURL` | The link address if a link was clicked, or an empty string |
| `params.mediaType` | `'image'`, `'video'`, `'none'` and so on |
| `params.editFlags` | What is possible right now: `canCut`, `canCopy`, `canPaste`, `canUndo`... |
| `params.misspelledWord` | The misspelled word under the mouse, if any |
| `params.dictionarySuggestions` | Spelling suggestions for that word |

Now build the template step by step, adding only the items that make sense:

```javascript
// main.js (inside createWindow)
const { Menu, shell } = require('electron'); // put this at the top of the file

win.webContents.on('context-menu', (event, params) => {
  const template = [];

  if (params.linkURL) {
    template.push({
      label: 'Open Link in Browser',
      click: () => shell.openExternal(params.linkURL),
    });
    template.push({ type: 'separator' });
  }

  if (params.isEditable) {
    template.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'selectAll' },
    );
  } else if (params.selectionText) {
    template.push({ role: 'copy' });
  }

  if (template.length === 0) return; // nothing useful to show
  Menu.buildFromTemplate(template).popup({ window: win, frame: params.frame });
});
```

Try it out:

- Right-click plain text with nothing selected: no menu appears, which is what native apps do too.
- Select some text and right-click: only **Copy**.
- Right-click in an empty text box: Undo, Cut and Copy are greyed out, Paste is active if your clipboard holds text.

`shell.openExternal()` opens the link in the user's normal web browser. You will learn more about `shell`, and why you should check URLs before opening them, in [Clipboard and Opening Links with shell](/courses/electronjs/clipboard-and-shell).

> **Tip:** A role always wins over `click`. If you give an item both `role: 'copy'` and a `click` function, your function is ignored. Use a plain `label` plus `click` when you want custom behaviour.

## Step 3: spelling suggestions

Electron has a built-in spell checker for text boxes, and it is on by default. Misspelled words get a red wavy underline, but the user has no way to fix them until your context menu offers suggestions.

Add this at the very start of the template-building code, before the link section:

```javascript
// main.js (inside the context-menu handler, at the start)
if (params.misspelledWord) {
  for (const suggestion of params.dictionarySuggestions) {
    template.push({
      label: suggestion,
      click: () => win.webContents.replaceMisspelling(suggestion),
    });
  }
  template.push({
    label: 'Add to Dictionary',
    click: () =>
      win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
  });
  template.push({ type: 'separator' });
}
```

Type "helo wrold" into a text box, right-click "wrold", and pick "world". `replaceMisspelling()` swaps the word in the page for you, and "Add to Dictionary" stops the word being marked as wrong in future.

## Step 4: a custom menu for your own elements

The general menu is great for text and links, but your app has its own things too. Imagine a list of notes. Right-clicking a note should offer **Rename** and **Delete** for that note.

The page knows which note was clicked. The main process knows how to show native menus. So they need to talk, using the IPC (inter-process communication) patterns you learned in [IPC Part 1](/courses/electronjs/ipc-send-to-main) and [IPC Part 3](/courses/electronjs/ipc-main-to-renderer):

1. The renderer catches the `contextmenu` event on a note and calls a preload function with the note's id.
2. The preload sends that id to main.
3. Main builds and shows the menu.
4. When the user picks an item, main sends the chosen command back to the window.

### The page

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>Notes</title>
  </head>
  <body>
    <h1>My notes</h1>
    <ul id="notes">
      <li data-id="1">Shopping list</li>
      <li data-id="2">Holiday ideas</li>
      <li data-id="3">Book quotes</li>
    </ul>
    <p>Type here to test the general menu:</p>
    <textarea rows="4" cols="40"></textarea>
    <script src="renderer.js"></script>
  </body>
</html>
```

### The preload

Expose two small functions: one to ask for the menu, one to hear the answer. As always, do not hand the whole `ipcRenderer` to the page.

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notesMenu', {
  show: (noteId) => ipcRenderer.send('note-menu:show', noteId),
  onCommand: (callback) =>
    ipcRenderer.on('note-menu:command', (_event, command, noteId) => callback(command, noteId)),
});
```

### The renderer

```javascript
// renderer.js
const list = document.getElementById('notes');

list.addEventListener('contextmenu', (event) => {
  const item = event.target.closest('li');
  if (!item) return;
  event.preventDefault(); // we will show our own menu instead
  window.notesMenu.show(Number(item.dataset.id));
});

window.notesMenu.onCommand((command, noteId) => {
  const item = list.querySelector(`li[data-id="${noteId}"]`);
  if (!item) return;
  if (command === 'rename') {
    item.textContent = item.textContent + ' (renamed)';
  } else if (command === 'delete') {
    item.remove();
  }
});
```

Calling `event.preventDefault()` in the page matters. It tells Electron "the page handled this right-click", so the general `context-menu` event from Step 1 does **not** fire for that click. Without it, two menus would fight over the same right-click.

### The main process

```javascript
// main.js (add ipcMain to the require at the top)
ipcMain.on('note-menu:show', (event, noteId) => {
  if (!Number.isInteger(noteId)) return; // never trust input from a page

  const win = BrowserWindow.fromWebContents(event.sender);
  const menu = Menu.buildFromTemplate([
    {
      label: 'Rename',
      click: () => event.sender.send('note-menu:command', 'rename', noteId),
    },
    { type: 'separator' },
    {
      label: 'Delete',
      click: () => event.sender.send('note-menu:command', 'delete', noteId),
    },
  ]);
  menu.popup({ window: win });
});
```

`event.sender` is the `webContents` of the window that sent the message, so the answer always goes back to the right window, even if your app has several. `BrowserWindow.fromWebContents()` finds the window that owns it.

Run the app and right-click "Holiday ideas". Pick **Delete** and the note disappears. Right-click inside the text box and you still get the general text menu from Step 2.

> **Tip:** Want a checkbox in a context menu, such as "Pinned"? Use `type: 'checkbox'` and `checked: true`, exactly as in application menus.

## A ready-made option

If you want a full browser-style context menu quickly, the popular npm package `electron-context-menu` builds one for you with many options. Writing your own, as you did here, keeps you in full control and teaches you how it works, which is why this course does it by hand.

## Common mistakes

### Expecting a menu to appear by default

Electron windows have no right-click menu until you add one. If users report that they "cannot paste", this is almost always the reason. Add at least the Step 2 menu to every window with text boxes.

### Two menus on one right-click

If the page shows a custom menu but forgets `event.preventDefault()`, the general `context-menu` handler in main also runs. Always call `preventDefault()` in the page when you show your own menu.

### Trusting the data the page sends

The note id comes from the renderer, which runs web code. Check it in main (`Number.isInteger(noteId)`) before you use it, especially if the menu later deletes files or database rows. [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api) goes deeper.

### Adding `click` to a role item

`{ role: 'paste', click: () => ... }` never calls your function, because the role takes over. Pick one: a role for standard actions, or `label` plus `click` for your own.

## Quick recap

- Electron shows no right-click menu by default. You build one with `Menu.buildFromTemplate()` and show it with `menu.popup()`.
- Listen to `webContents.on('context-menu', (event, params) => ...)` in main for a general page menu.
- `params` tells you what was clicked: `isEditable`, `selectionText`, `linkURL`, `editFlags`, `misspelledWord` and more.
- Roles such as `cut`, `copy` and `paste` do the work for you. A role overrides `click`.
- Spelling fixes use `params.dictionarySuggestions` with `webContents.replaceMisspelling()`.
- For custom menus on your own elements, the renderer calls a preload function, main shows the menu, and sends the chosen command back with `event.sender.send()`.
- Call `event.preventDefault()` in the page's `contextmenu` handler so only one menu appears.

<code id="code-content" class="language-javascript">
// main.js: a smart page menu plus a custom menu for notes
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('node:path');
// --- 1. The general menu, built from what was right-clicked
function buildPageMenu(win, params) {
  const template = [];
  if (params.misspelledWord) {
    for (const word of params.dictionarySuggestions) {
      template.push({ label: word, click: () =&gt; win.webContents.replaceMisspelling(word) });
    }
    template.push({
      label: 'Add to Dictionary',
      click: () =&gt; win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    });
    template.push({ type: 'separator' });
  }
  if (params.linkURL.startsWith('https://') || params.linkURL.startsWith('http://')) {
    template.push({ label: 'Open Link in Browser', click: () =&gt; shell.openExternal(params.linkURL) });
    template.push({ type: 'separator' });
  }
  if (params.isEditable) {
    template.push(
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'selectAll' },
    );
  } else if (params.selectionText) {
    template.push({ role: 'copy' });
  }
  return template;
}
// --- 2. The window listens for right-clicks the page did not handle
function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.webContents.on('context-menu', (event, params) =&gt; {
    const template = buildPageMenu(win, params);
    if (template.length === 0) return;
    Menu.buildFromTemplate(template).popup({ window: win, frame: params.frame });
  });
  win.loadFile('index.html');
}
// --- 3. A custom menu for a note, asked for by the page through the preload
ipcMain.on('note-menu:show', (event, noteId) =&gt; {
  if (!Number.isInteger(noteId)) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Rename', click: () =&gt; event.sender.send('note-menu:command', 'rename', noteId) },
    { type: 'separator' },
    { label: 'Delete', click: () =&gt; event.sender.send('note-menu:command', 'delete', noteId) },
  ]);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
});
// --- 4. The usual lifecycle
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

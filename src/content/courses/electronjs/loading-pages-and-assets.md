---
publishDate: 2026-10-25T12:10
title: Loading Pages, Styles and Images
slug: loading-pages-and-assets
metadescription: Load HTML pages into Electron windows with loadFile and loadURL, add CSS, images and fonts with correct paths, and keep them working under a CSP.
updateDate: 2026-10-25T12:10
author: ['bishal-biswas']
level: 1
tags: ['loadfile', 'css', 'assets']
course: electronjs
---

## From plain page to real app screen

So far your app shows one plain HTML page. Real apps have styles, a logo, maybe a custom font and more than one page. Good news: in Electron, these work almost exactly like a website. There are just a few rules about **paths** and **security** to learn.

Paths are like giving directions. "Two doors down from here" (a **relative** path) works as long as you know where "here" is. "Number 1, Main Street" (an **absolute** path) works from anywhere, but only if that street really exists. Most problems with missing images and styles come from mixing these up.

## loadFile and loadURL

A window can show a page in two ways.

### loadFile: a page inside your app

```javascript
// main.js
win.loadFile('index.html');
```

`loadFile` loads an HTML file from your project. A relative path like `'index.html'` is looked up from your **app's folder** (the one with `package.json`), so it works no matter where the terminal was when you started the app. You can also pass a full path:

```javascript
// main.js
win.loadFile(path.join(__dirname, 'index.html'));
```

Both load the same file. Behind the scenes, Electron turns it into a `file://` URL, so inside the page, `location.href` looks like this:

```text
file:///C:/Users/asha/my-first-app/index.html
```

On macOS and Linux it starts with `file:///Users/...` or `file:///home/...` instead.

### loadURL: a page from a web address

```javascript
// main.js
win.loadURL('https://www.electronjs.org');
```

`loadURL` loads any URL, usually a website. It is handy for things like a help page, but be careful: a remote site running inside your app is a security risk if it gets any extra powers. Never give remote pages a preload with powerful functions. Read [Loading Remote Content Safely](/courses/electronjs/loading-remote-content-safely) before you ship an app that does this.

For your own app's screens, prefer `loadFile`. Your pages then work offline and load instantly.

## Organising your files

Here is a tidy layout for a plain project with styles and images:

```text
my-first-app/
├── package.json
├── main.js
├── preload.js
├── index.html
├── settings.html
├── renderer.js
├── styles/
│   └── style.css
├── images/
│   ├── logo.svg
│   └── background.png
└── fonts/
    └── Inter.woff2
```

Keep pages at the top, and group styles, images and fonts in their own folders.

## Adding a stylesheet

Create `styles/style.css`:

```css
/* styles/style.css */
body {
  font-family: system-ui, sans-serif;
  margin: 0;
  padding: 2rem;
  background: #1e1e1e;
  color: #f0f0f0;
}

h1 {
  color: #7cc4ff;
}
```

`system-ui` uses the operating system's own interface font: Segoe UI on Windows, San Francisco on macOS, and your desktop's font on Linux. It makes your app feel at home everywhere.

Link it in the `<head>` of `index.html`:

```html
<!-- index.html -->
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'self'; script-src 'self'"
  />
  <title>My First App</title>
  <link rel="stylesheet" href="styles/style.css" />
</head>
```

The `href` is **relative to the HTML file**. Because `index.html` is in the project folder, `styles/style.css` means "the `styles` folder next to me". Reload the window (Ctrl + R, or Cmd + R on macOS) and your page turns dark.

> **Tip:** Set the window's `backgroundColor` to the same colour as your CSS `background` (here `#1e1e1e`). Then the window never flashes white while the page loads. See [Creating Windows with BrowserWindow](/courses/electronjs/browserwindow-basics).

## Adding images

Images work the same way:

```html
<!-- index.html -->
<body>
  <img src="images/logo.svg" alt="App logo" width="64" height="64" />
  <h1>Hello from Electron!</h1>
</body>
```

And in CSS, paths are relative to the **CSS file**, not the HTML file:

```css
/* styles/style.css */
body {
  background-image: url('../images/background.png');
  background-size: cover;
}
```

`../` means "go up one folder". From `styles/style.css`, `../images/background.png` goes up to the project folder, then into `images`.

SVG, PNG, JPEG, GIF and WebP all work, because Chromium supports them.

## Adding a custom font

Download a font file (`.woff2` is the best format for the web), put it in `fonts/`, and declare it in your CSS:

```css
/* styles/style.css */
@font-face {
  font-family: 'Inter';
  src: url('../fonts/Inter.woff2') format('woff2');
}

body {
  font-family: 'Inter', system-ui, sans-serif;
}
```

Because the font file is inside your app, it works offline. That is better than loading fonts from a website.

## The Content Security Policy and your assets

Your page has a **Content Security Policy** (CSP) from [Your First Electron App](/courses/electronjs/your-first-electron-app):

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'"
/>
```

`default-src 'self'` means "load everything only from my own app files". So stylesheets, images and fonts from your folders work. But a few things are blocked, and the DevTools Console tells you about each one.

### Inline styles are blocked

A `<style>` block or a `style="..."` attribute in your HTML is ignored, and the Console shows:

```text
Applying inline style violates the following Content Security Policy directive 'default-src 'self''.
```

Fix: move the styles into your `.css` file and use classes.

### Images from the internet are blocked

An `<img src="https://...">` does not load:

```text
Loading the image 'https://example.com/photo.png' violates the following Content Security Policy directive: "default-src 'self'".
```

If your app really needs online images, allow just that kind of file from just that site, using the `img-src` rule:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; img-src 'self' https://images.example.com"
/>
```

Each rule (like `img-src`) covers one kind of file. Rules you do not list fall back to `default-src`. Allow as little as you can. [Content Security Policy](/courses/electronjs/content-security-policy) covers every rule in detail.

## More than one page

Need a settings screen? Create `settings.html` next to `index.html` and load it:

```javascript
// main.js
win.loadFile('settings.html');
```

Normal links between pages also work inside the same window:

```html
<!-- index.html -->
<a href="settings.html">Settings</a>
```

### Passing information to a page

`loadFile` accepts an options object with `query` and `hash`, which are added to the page's URL:

```javascript
// main.js
win.loadFile('index.html', { query: { page: 'settings' }, hash: 'top' });
```

The page's URL becomes `index.html?page=settings#top`. The page can read it with `URLSearchParams`:

```javascript
// renderer.js
const params = new URLSearchParams(location.search);
console.log(params.get('page')); // "settings"
console.log(location.hash);      // "#top"
```

This is a simple way to open one HTML file in different modes, for example one window per document. For anything more than a few small values, use IPC (see [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle)).

## When a page fails to load

`loadFile` and `loadURL` return a Promise that is **rejected** if the page cannot load. Catch it so problems are easy to spot:

```javascript
// main.js
win.loadFile('setings.html').catch((error) => {
  console.error('Could not load page:', error.code);
});
```

```text
Could not load page: ERR_FILE_NOT_FOUND
```

Electron also prints a warning in the terminal:

```text
electron: Failed to load URL: file:///C:/Users/asha/my-first-app/setings.html with error: ERR_FILE_NOT_FOUND
```

The fix here is a typo: `setings` should be `settings`.

You can also watch every load of a window with two `webContents` events:

```javascript
// main.js
win.webContents.on('did-finish-load', () => {
  console.log('Page loaded:', win.webContents.getURL());
});

win.webContents.on('did-fail-load', (event, errorCode, errorDescription, url) => {
  console.error('Failed to load', url, errorDescription);
});
```

These fire for every page load in that window, including when the user clicks a link or reloads.

## A note for Electron Forge projects

In a Forge project with Vite (see [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge)), the page is served by Vite during development, so a few things differ:

- CSS is usually imported from JavaScript: `import './index.css';` in `src/renderer.js`. Vite adds it to the page for you.
- The main process loads `MAIN_WINDOW_VITE_DEV_SERVER_URL` with `loadURL` in development, and the built `index.html` with `loadFile` when packaged.

Relative paths and the CSP work the same way as in this lesson.

## Common mistakes

### Starting a path with a slash

```html
<!-- index.html: don't do this -->
<img src="/images/logo.svg" alt="Logo" />
```

On a website, `/images/logo.svg` means "from the site's root". But your page is a `file://` URL, so the root is the root of the **disk**: `file:///C:/images/logo.svg` on Windows, or `file:///images/logo.svg` on macOS and Linux. The image is not there, so nothing shows. Use `images/logo.svg` with no leading slash.

### Making CSS paths relative to the HTML file

In `styles/style.css`, `url('images/bg.png')` looks for `styles/images/bg.png`. CSS paths start from the CSS file's own folder, so write `url('../images/bg.png')`.

### Using inline styles and wondering why they are ignored

With the safe CSP, `<style>` blocks and `style="..."` attributes are blocked. Move them into your stylesheet.

### Wrong letter case in a file name

`Logo.SVG` and `logo.svg` are the same file on Windows and usually on macOS, but **different** files on Linux. If an image works on your computer but not on a friend's Linux machine, check the capital letters.

## Quick recap

- `win.loadFile('index.html')` loads a page from your app folder. `win.loadURL(url)` loads a web address; be careful with remote content.
- Pages from `loadFile` have `file://` URLs.
- Link CSS with `<link rel="stylesheet" href="styles/style.css">` and images with `<img src="images/logo.svg">`.
- HTML paths are relative to the HTML file. CSS paths are relative to the CSS file. Never start a path with `/`.
- Keep fonts and images inside your app so they work offline.
- The CSP `default-src 'self'` allows your own files but blocks inline styles and remote images. Loosen it rule by rule, like `img-src`.
- `loadFile` takes `query` and `hash` options. Read them in the page with `URLSearchParams`.
- Catch the Promise from `loadFile`, or use `did-fail-load`, to see loading errors like `ERR_FILE_NOT_FOUND`.

<code id="code-content" class="language-javascript">
// main.js: load pages safely and report problems
const { app, BrowserWindow } = require('electron');
const path = require('path');
// index.html head (paths are relative to the HTML file, no leading slash):
//   &lt;meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'"&gt;
//   &lt;link rel="stylesheet" href="styles/style.css"&gt;
// index.html body:
//   &lt;img src="images/logo.svg" alt="App logo"&gt;
//   &lt;script src="renderer.js"&gt;&lt;/script&gt;
// styles/style.css (paths are relative to the CSS file):
//   body { background-image: url('../images/background.png'); }
function createWindow(page = 'home') {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    backgroundColor: '#1e1e1e', // matches the CSS background: no white flash
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  // --- Log every successful or failed load in this window
  win.webContents.on('did-finish-load', () =&gt; {
    console.log('Loaded:', win.webContents.getURL());
  });
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, url) =&gt; {
    console.error('Failed:', url, errorDescription);
  });
  // --- Same HTML file, different mode: the page reads ?page=... with URLSearchParams
  win.loadFile('index.html', { query: { page } }).catch((error) =&gt; {
    console.error('Could not load index.html:', error.code); // e.g. ERR_FILE_NOT_FOUND
  });
  return win;
}
app.whenReady().then(() =&gt; {
  createWindow('home');
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow('home');
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// renderer.js: const page = new URLSearchParams(location.search).get('page');
</code></pre>

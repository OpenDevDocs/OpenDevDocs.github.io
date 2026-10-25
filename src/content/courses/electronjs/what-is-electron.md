---
publishDate: 2026-10-25T12:00
title: What is Electron? Desktop Apps with Web Technologies
slug: what-is-electron
metadescription: Learn what Electron is, how it mixes Chromium and Node.js to build desktop apps with HTML, CSS and JavaScript, and when to pick it over other tools.
updateDate: 2026-10-25T12:00
author: ['bishal-biswas']
level: 1
tags: ['introduction', 'desktop-apps', 'chromium']
course: electronjs
---

## Desktop apps with skills you already have

You already know how to build a web page with HTML, CSS and JavaScript. **Electron** lets you take those same skills and build a **desktop app**: a program people install on Windows, macOS or Linux, with its own window, its own icon in the taskbar or Dock, and access to files on the computer.

Think of a normal website as a food stall at a market. It can only use what the market (the browser) gives it: a table, some light, a little storage. An Electron app is a food truck. It brings its own kitchen, so it can park anywhere and cook whatever it likes. The kitchen is heavy, but you never have to ask anyone for permission to use the stove.

In this lesson you will learn what Electron is made of, which famous apps use it, what it is good and bad at, and what the alternatives are. You will not write a full app yet. That starts in [Your First Electron App](/courses/electronjs/your-first-electron-app).

## What Electron is made of

Electron is two well-known projects glued together, plus a set of desktop features on top.

- **Chromium** is the open-source browser engine behind Google Chrome. It draws your HTML and CSS, runs your page's JavaScript, and gives you modern web features like `fetch`, CSS grid and the canvas. Every Electron app ships with its own copy of Chromium.
- **Node.js** is JavaScript that runs outside a browser. It can read and write files, start other programs and talk to the operating system. Every Electron app also ships with its own copy of Node.js.
- **Electron's own APIs** add the desktop parts: windows, menus, dialogs, notifications, a tray icon, the clipboard, auto-updates and more.

An **API** (application programming interface) is just a set of ready-made functions you can call. For example, Electron's `BrowserWindow` API is the set of functions for opening and controlling windows.

Because Electron bundles its own Chromium and Node.js, your app does not depend on whichever browser the user has installed. It looks and behaves the same on every computer.

## What an Electron app looks like in code

Here is the heart of a tiny Electron app, so you can see the shape of things. You do not need to run it yet.

```javascript
// main.js
const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadFile('index.html');
});
```

Read it like a sentence:

1. Load two things from Electron: `app` (your application as a whole) and `BrowserWindow` (a window).
2. Wait until Electron is ready.
3. Open an 800 by 600 window.
4. Show the web page `index.html` inside it.

The `index.html` is an ordinary web page:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>My App</title>
  </head>
  <body>
    <h1>Hello from a desktop window!</h1>
  </body>
</html>
```

That is the big idea: **a JavaScript file that controls the app, and web pages that make up the screens**. The next lesson, [How Electron Works: Main and Renderer Processes](/courses/electronjs/main-and-renderer-processes), explains how those two parts run and talk to each other.

## Apps you may already use

Many popular desktop apps are built with Electron. At the time of writing, these include:

- **Visual Studio Code**, the code editor this course uses.
- **Slack** and **Discord**, for team and community chat.
- **GitHub Desktop**, a visual tool for Git.
- **Obsidian**, a note-taking app.
- **Postman**, a tool for testing web APIs.
- The **Figma** desktop app, for design work.

Companies sometimes change how they build their apps, so this list can go out of date. The point is that Electron is not a toy. Large teams trust it for apps that millions of people open every day.

## What you can do that a website cannot

A web page in a normal browser is kept in a safe little box. It cannot quietly read your files or add an item to your computer's menu bar. An Electron app can, because it has Node.js and Electron's APIs behind it. With Electron you can:

- Open, read and save files anywhere the user allows, using native **Open** and **Save** dialogs.
- Add real application menus and keyboard shortcuts.
- Show system notifications, even when the window is hidden.
- Put an icon in the system tray (Windows and Linux) or the menu bar (macOS).
- Work fully offline, with all your files stored inside the app.
- Store data in a local database on the user's computer.
- Package your app as a proper installer and update it automatically.

You will build every one of these in this course.

## The good parts

### One codebase, three operating systems

You write your app once. Electron runs it on Windows, macOS and Linux. Without Electron, you might need a different language and toolkit for each system: Swift for macOS, C# for Windows, and something else again for Linux.

### You use web skills and libraries

Your screens are HTML and CSS. You can use React, Vue, Svelte or plain JavaScript. You can also use almost any package from **npm**, the huge public library of JavaScript packages.

### The same engine everywhere

Because Chromium comes inside your app, a CSS feature that works on your computer works on your user's computer. You never have to test five different browsers.

### A mature project with good tooling

Electron has been around for over a decade and is maintained under the OpenJS Foundation. Tools like **Electron Forge** (which you will meet in [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge)) handle building installers, signing and publishing for you. New Electron versions come out regularly, following the Chrome release schedule, so you get security fixes and new web features.

## The trade-offs

Electron is not perfect. It is better to know the costs up front.

### Bigger downloads

Every Electron app carries its own copy of Chromium and Node.js. That makes even a "hello world" app much bigger than a native app that uses the operating system's own tools. For most apps today this is fine, but it matters if your users have slow internet or very little disk space.

### More memory

Chromium is designed to be fast, not small. Each window runs its own web page process, and each of those uses memory. An Electron app usually uses more memory than an equally simple native app. Careful coding helps a lot, and [Performance: Faster Startup and Less Memory](/courses/electronjs/performance-tips) shows you how.

### Security is your job

Because your app can touch the file system, a security mistake can do real damage. If you load a web page from the internet and give it full Node.js powers, that page could delete files. Electron's defaults are safe, and this course keeps them on. You will learn the rules in the [Electron Security Checklist](/courses/electronjs/security-checklist).

### It does not look 100% native

Native apps get their buttons and menus from the operating system. Electron apps draw most of their interface with HTML and CSS. Menus, dialogs and notifications are real native ones, but the rest is up to your design. Most users do not mind, as long as the app feels fast and familiar.

> **Note:** "Native" means built with the operating system's own tools and languages, such as Swift on macOS or C# with WinUI on Windows.

## Alternatives, briefly

Electron is one option among several. Here is a quick map:

| Option | How it works | Good when |
| --- | --- | --- |
| **Electron** | Ships its own Chromium and Node.js | You want web skills, npm packages and the same look everywhere |
| **Tauri** | Uses the operating system's built-in web view, with a backend written in Rust | You want smaller apps and are happy to learn some Rust |
| **Native toolkits** | Swift/SwiftUI on macOS, C# with WinUI on Windows, GTK or Qt on Linux | You need the very best performance or deep system integration |
| **Progressive Web Apps (PWAs)** | A website that can be "installed" from the browser | Your app does not need deep file or system access |

A **web view** is a small browser engine that the operating system provides for apps to use. Tauri's apps are smaller because they borrow that engine instead of bringing their own. The catch is that the engine differs between Windows, macOS and Linux, so your page may render slightly differently on each.

None of these is "the best". Electron is a strong choice when you already know the web, want one codebase, and value having the same engine on every system.

## Is Electron right for your idea?

Electron is a great fit for:

- Productivity tools: editors, note apps, to-do lists, dashboards.
- Chat and collaboration apps.
- Developer tools.
- Internal company tools, where speed of building matters most.
- Turning an existing web app into a desktop app.

Think twice for:

- Tiny utilities where download size matters more than anything.
- Heavy 3D games (a game engine is usually better).
- Apps that must run on very old or very low-memory computers.

## What you will build in this course

Here is the path ahead:

1. **Getting Started**: set up your computer, build your first app, meet Electron Forge and learn to debug.
2. **Windows and the App**: control windows, their size and position, and the app's life from start to quit.
3. **Talking Between Processes**: preload scripts and IPC, the safe way for your web page to ask for desktop powers.
4. **Native Desktop Features**: menus, dialogs, notifications, tray icons, the clipboard and drag and drop.
5. **Files, Data and Settings**: saving files, settings and a local database.
6. **Building Real Apps**: React or Vue, TypeScript, and a Markdown notes app project.
7. **Security**, **Advanced Topics** and **Packaging and Shipping**: making your app safe, fast, signed and auto-updating.

## Common mistakes

### Thinking Electron is just a browser for websites

You can load a website in an Electron window, but that is rarely the point. Electron apps usually ship their own HTML files inside the app. Loading random websites with desktop powers is risky, which is why [Loading Remote Content Safely](/courses/electronjs/loading-remote-content-safely) has its own lesson.

### Expecting a tiny download

Because Chromium and Node.js travel with every app, your installer will be much larger than a few hundred kilobytes. That is normal for Electron. Do not spend your first week fighting it.

### Turning off the safety settings "to make things easier"

Old tutorials online tell you to set `nodeIntegration: true` so web pages can use `require`. Please do not. Modern Electron keeps web pages and Node.js apart on purpose, and this course shows you the safe way to connect them with a **preload script**.

## Quick recap

- Electron builds desktop apps for Windows, macOS and Linux from HTML, CSS and JavaScript.
- It bundles **Chromium** (to draw your pages) and **Node.js** (to reach the computer), plus desktop APIs like windows, menus and dialogs.
- VS Code, Slack, Discord, GitHub Desktop and many other apps are built with it.
- Pros: one codebase, web skills, npm packages, the same engine everywhere, mature tools.
- Cons: bigger downloads, more memory, and security is your responsibility.
- Alternatives include Tauri, native toolkits and PWAs. Each fits different needs.
- A tiny Electron app is a `main.js` that opens a window and an `index.html` shown inside it.

<code id="code-content" class="language-javascript">
// main.js: the smallest useful Electron app, explained line by line
// Electron gives you "app" (the whole program) and "BrowserWindow" (a window)
const { app, BrowserWindow } = require('electron');
// --- A function that opens one window
function createWindow() {
  const win = new BrowserWindow({
    width: 800,  // pixels wide
    height: 600, // pixels tall
  });
  // The window shows an ordinary web page from your project folder
  win.loadFile('index.html');
}
// --- Electron needs a moment to start Chromium and Node.js
app.whenReady().then(() =&gt; {
  createWindow();
  // macOS: clicking the Dock icon with no windows open should open one again
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
// --- Windows and Linux: quit when the last window closes
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
// Chromium draws index.html, Node.js powers this file,
// and Electron's APIs (app, BrowserWindow, menus, dialogs...) join them together.
</code></pre>

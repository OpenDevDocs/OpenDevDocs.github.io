---
publishDate: 2026-10-25T12:48
title: Testing Electron Apps
slug: testing-electron-apps
metadescription: Test your Electron app with fast unit tests using node --test or Vitest, and end-to-end tests that launch the real app with Playwright.
updateDate: 2026-10-25T12:48
author: ['bishal-biswas']
level: 3
tags: ['testing', 'playwright', 'unit-tests']
course: electronjs
---

## Why write tests at all?

Every time you change your app, something you did not touch might break. You could click through every screen by hand after each change, but that gets boring fast, and boring checks get skipped.

A **test** is a small program that uses your app and checks the result for you. Once written, it runs in seconds, as often as you like, and never forgets a step.

Think of a pilot's pre-flight checklist. The pilot knows how to fly, but still goes through the same list before every take-off, because missing one item is expensive. Tests are your app's checklist.

There are two kinds you will write for Electron:

- **Unit tests** check one small piece of logic on its own, like "does this function reject an empty todo?". They do not start Electron at all, so they run in milliseconds.
- **End-to-end tests** (E2E) start your **real app**, click buttons in the real window and check what appears. They are slower, but they prove the whole thing works together: main process, preload, IPC and page.

A healthy project has many unit tests and a handful of end-to-end tests for the most important flows.

## Part 1: unit tests

### Step 1: move logic into plain modules

Code that is tangled up with Electron is hard to test. Code in a plain module, with no `require('electron')`, is easy. So the first step is to pull your logic out of `main.js` and `renderer.js` into small files.

Here is a module with two helpers for a todo app:

```javascript
// todo-utils.js
function cleanText(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed.length === 0) throw new Error('A todo needs some text');
  return trimmed.slice(0, 200);
}

function isDue(todo, now = new Date()) {
  return Boolean(todo.due) && !todo.done && new Date(todo.due) <= now;
}

module.exports = { cleanText, isDue };
```

Your `main.js` can now `require('./todo-utils.js')` and use these functions in its IPC handlers, and your tests can use them too.

Notice the `now = new Date()` parameter. Passing the current time in, instead of reading the clock inside the function, lets a test pretend it is any time it likes. Making code testable often means small choices like this.

### Step 2: write tests with the built-in test runner

Node.js has a test runner built in, so you do not need to install anything. Create `test/unit/todo-utils.test.js`:

```javascript
// test/unit/todo-utils.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanText, isDue } = require('../../todo-utils.js');

test('cleanText trims spaces', () => {
  assert.equal(cleanText('  buy milk  '), 'buy milk');
});

test('cleanText rejects empty text', () => {
  assert.throws(() => cleanText('   '), /needs some text/);
});

test('isDue is true only for unfinished todos whose time has passed', () => {
  const now = new Date('2026-10-25T12:00');
  assert.equal(isDue({ due: '2026-10-25T11:59', done: false }, now), true);
  assert.equal(isDue({ due: '2026-10-25T12:30', done: false }, now), false);
  assert.equal(isDue({ due: '2026-10-25T11:59', done: true }, now), false);
  assert.equal(isDue({ due: '', done: false }, now), false);
});
```

- **`test(name, fn)`** defines one test. If the function throws, the test fails.
- **`assert.equal(actual, expected)`** throws if the two values differ. The `strict` version compares with `===`.
- **`assert.throws(fn, pattern)`** checks that the function throws an error matching the pattern.

Add a script to `package.json`:

```json
{
  "scripts": {
    "start": "electron .",
    "test:unit": "node --test test/unit/*.test.js"
  }
}
```

```bash
npm run test:unit
```

```text
✔ cleanText trims spaces (0.9175ms)
✔ cleanText rejects empty text (0.2879ms)
✔ isDue is true only for unfinished todos whose time has passed (0.4939ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 68.2181
```

Three tests in well under a second. Break `cleanText` on purpose (remove the `.trim()`) and run it again to watch a test fail and explain why.

### Vitest, if you use Vite

If your project uses the Electron Forge Vite template or a React or Vue setup, **Vitest** is a popular alternative. It shares Vite's configuration and has a friendly watch mode that reruns tests as you save.

```bash
npm install --save-dev vitest
```

The test looks almost the same. Only the imports change:

```javascript
// src/todo-utils.test.js
import { test, expect } from 'vitest';
import { cleanText } from './todo-utils.js';

test('cleanText trims spaces', () => {
  expect(cleanText('  buy milk  ')).toBe('buy milk');
});
```

```bash
npx vitest run
```

Pick whichever runner fits your project. The important part is keeping logic in small, plain modules.

## Part 2: end-to-end tests with Playwright

**Playwright** is a testing tool from Microsoft that controls browsers, and it has built-in support for Electron. It can start your app, reach into the main process, find elements in your windows and click them like a user.

> **Note:** You may find old tutorials using a tool called Spectron. It has been dead for years and does not work with modern Electron. Use Playwright (or WebdriverIO, mentioned below).

### Step 1: a small app to test

Here is a tiny counter app. The window shows a number and a button that adds one.

```html
<!-- index.html -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'" />
    <title>Counter</title>
  </head>
  <body>
    <h1>Count: <span data-testid="count">0</span></h1>
    <button>Add one</button>
    <script src="renderer.js"></script>
  </body>
</html>
```

```javascript
// renderer.js
const countEl = document.querySelector('[data-testid="count"]');
document.querySelector('button').addEventListener('click', () => {
  countEl.textContent = String(Number(countEl.textContent) + 1);
});
```

The `data-testid` attribute is a label just for tests. It does not change how the page looks, and it keeps your tests working even if you later change the text or styling.

The `main.js` is a normal plain app with one addition: when the `TEST_USER_DATA` environment variable is set, it stores its data in that folder instead of the real one. That way tests never touch your actual settings.

```javascript
// main.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');

if (process.env.TEST_USER_DATA) {
  app.setPath('userData', process.env.TEST_USER_DATA);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

### Step 2: install Playwright's test runner

```bash
npm install --save-dev @playwright/test
```

You do **not** need to run `npx playwright install`. That command downloads browsers, and for Electron tests Playwright uses the Electron already in your `node_modules`.

Tell Playwright where your end-to-end tests live, so it does not mix them up with your unit tests. Create `playwright.config.js` in the project root:

```javascript
// playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
});
```

### Step 3: write the first end-to-end test

```javascript
// test/e2e/app.spec.js
const { test, expect, _electron: electron } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

let electronApp;
let window;

test.beforeEach(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'counter-test-'));
  electronApp = await electron.launch({
    args: ['.'],
    env: { ...process.env, TEST_USER_DATA: userData },
  });
  window = await electronApp.firstWindow();
});

test.afterEach(async () => {
  await electronApp.close();
});

test('opens the main window with the right title', async () => {
  await expect(window).toHaveTitle('Counter');
});

test('the button adds one', async () => {
  await window.getByRole('button', { name: 'Add one' }).click();
  await window.getByRole('button', { name: 'Add one' }).click();
  await expect(window.getByTestId('count')).toHaveText('2');
});

test('the main process reports it is not packaged', async () => {
  const isPackaged = await electronApp.evaluate(({ app }) => app.isPackaged);
  expect(isPackaged).toBe(false);
});
```

Here is what is new:

- **`_electron`** is Playwright's Electron launcher. The underscore means Playwright still marks it as experimental, but it is the standard way to test Electron apps. Renaming it to `electron` on import just makes the code nicer to read.
- **`electron.launch({ args: ['.'] })`** starts Electron with `.` as its argument, exactly like `electron .` does in your `start` script. The `env` option passes environment variables to the app.
- **`electronApp.firstWindow()`** waits for the first window to open and returns a `Page` object, the same object Playwright uses for browser tabs. Everything Playwright can do in a browser, like `getByRole`, `click` and `screenshot`, works here.
- **`electronApp.evaluate(fn)`** runs a function **inside your main process**. Its first parameter is the Electron module, so `({ app })` gives you `app`. Whatever the function returns comes back to the test.
- **`beforeEach` and `afterEach`** start a fresh app with an empty data folder before every test and close it afterwards, so tests never affect each other.
- **`expect(...).toHaveText(...)`** keeps checking for a short while until the text matches. You do not need manual waits or `sleep` calls.

Add a script and run it:

```json
{
  "scripts": {
    "start": "electron .",
    "test:unit": "node --test test/unit/*.test.js",
    "test:e2e": "playwright test"
  }
}
```

```bash
npm run test:e2e
```

```text
Running 3 tests using 1 worker

  ok 1 test\e2e\app.spec.js:23:1 › opens the main window with the right title (497ms)
  ok 2 test\e2e\app.spec.js:27:1 › the button adds one (520ms)
  ok 3 test\e2e\app.spec.js:33:1 › the main process reports it is not packaged (453ms)

  3 passed (1.9s)
```

This output is from Windows. On macOS and Linux the paths use forward slashes, and in a colourful terminal you see ticks instead of `ok`.

You will see the app windows flash open and closed while the tests run. That is normal.

### Faking native dialogs

Native dialogs, like the file picker, are drawn by the operating system. Playwright cannot click them, and a test that opens one would hang. Instead, replace the dialog function in the main process with a fake that returns a fixed answer:

```javascript
// test/e2e/open-file.spec.js (inside a test)
await electronApp.evaluate(({ dialog }, filePaths) => {
  dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths });
}, ['/tmp/notes.txt']);

// Now clicking "Open" in your app gets /tmp/notes.txt without any dialog appearing
```

The second argument of `evaluate` is passed into the function, so the test controls which file is "picked". The fake stays in place until the app closes.

### Testing a packaged app

You can also point Playwright at a packaged app with `executablePath`, for example the `.exe` inside your `out` folder. There is a catch: the Electron Forge template turns off the `EnableNodeCliInspectArguments` fuse for security, and Playwright needs it to connect. With that fuse off, the launch just times out.

Most teams run end-to-end tests against the unpackaged app (`args: ['.']`) and keep the packaged build locked down. You will learn what each fuse does in [Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity).

### WebdriverIO, the other option

**WebdriverIO** has an Electron service that does a similar job, with its own style of writing tests. If your team already uses WebdriverIO for websites, it is a fine choice. This course uses Playwright because it needs very little setup.

## Running tests in CI

**CI** (continuous integration) means a server runs your tests automatically every time you push code, for example with GitHub Actions. You will build a full release workflow in [Publishing Releases to GitHub and App Stores](/courses/electronjs/publishing-releases).

There is one catch on **Linux**: CI machines usually have no screen, and Electron needs a display to open windows. The fix is **Xvfb** (X virtual framebuffer), a fake screen that exists only in memory. The `xvfb-run` command starts one, runs your command inside it, and cleans up:

```bash
xvfb-run --auto-servernum npm run test:e2e
```

Windows and macOS CI machines have a display already, so they do not need this. A GitHub Actions workflow that tests on all three looks like this:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
      - run: npm run test:unit
      - name: End-to-end tests (Linux needs a virtual screen)
        if: runner.os == 'Linux'
        run: xvfb-run --auto-servernum npm run test:e2e
      - name: End-to-end tests
        if: runner.os != 'Linux'
        run: npm run test:e2e
```

## Common mistakes

### Testing logic only through the UI

If the only way to test `cleanText` is to launch the app and type into a box, your tests will be slow and fragile. Move logic into plain modules and unit test it. Save end-to-end tests for "does the whole flow work?".

### Tests that share data

If one test adds a todo and the next test expects an empty list, the order of tests suddenly matters. Give each test a fresh data folder, as with `TEST_USER_DATA` above.

### Waiting with fixed delays

Code like `await new Promise((r) => setTimeout(r, 2000))` makes tests slow and still flaky on a busy machine. Use Playwright's `expect(...)` checks, which wait automatically until the condition is true.

### Forgetting the virtual display on Linux CI

Without a display, Electron cannot open a window and the launch fails or times out. Wrap the end-to-end command in `xvfb-run` on Linux.

## Quick recap

- Unit tests check small pieces of logic without Electron. End-to-end tests launch the real app.
- Keep logic in plain modules with no `require('electron')` so it is easy to test.
- `node --test` with `node:assert/strict` needs no installation. Vitest is a good fit for Vite projects.
- Playwright's `_electron.launch({ args: ['.'] })` starts your app. `firstWindow()` gives you the window as a `Page`.
- `electronApp.evaluate(({ app }) => ...)` runs code inside the main process, which is also how you fake dialogs.
- Use `data-testid` attributes and a separate data folder per test.
- Packaged apps with the `EnableNodeCliInspectArguments` fuse off cannot be driven by Playwright.
- On Linux CI, run end-to-end tests inside `xvfb-run`.

<code id="code-content" class="language-javascript">
// test/e2e/app.spec.js: end-to-end tests for the Counter app with Playwright
const { test, expect, _electron: electron } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
let electronApp;
let window;
// --- A fresh app with its own empty data folder for every test
test.beforeEach(async () =&gt; {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'counter-test-'));
  electronApp = await electron.launch({
    args: ['.'], // same as "electron ." in your start script
    env: { ...process.env, TEST_USER_DATA: userData },
  });
  window = await electronApp.firstWindow();
});
test.afterEach(async () =&gt; {
  await electronApp.close();
});
// --- Check the window like a user would
test('opens the main window with the right title', async () =&gt; {
  await expect(window).toHaveTitle('Counter');
});
test('the button adds one', async () =&gt; {
  const button = window.getByRole('button', { name: 'Add one' });
  await button.click();
  await button.click();
  await expect(window.getByTestId('count')).toHaveText('2');
});
// --- Reach into the main process
test('the main process reports it is not packaged', async () =&gt; {
  const isPackaged = await electronApp.evaluate(({ app }) =&gt; app.isPackaged);
  expect(isPackaged).toBe(false);
});
test('uses the test data folder, not the real one', async () =&gt; {
  const userData = await electronApp.evaluate(({ app }) =&gt; app.getPath('userData'));
  expect(userData).toContain('counter-test-');
});
// --- Fake a native dialog so nothing blocks the test
test('a faked open dialog returns our file', async () =&gt; {
  await electronApp.evaluate(({ dialog }, filePaths) =&gt; {
    dialog.showOpenDialog = () =&gt; Promise.resolve({ canceled: false, filePaths });
  }, ['/tmp/notes.txt']);
  const result = await electronApp.evaluate(({ dialog }) =&gt; dialog.showOpenDialog({}));
  expect(result.filePaths).toEqual(['/tmp/notes.txt']);
});
</code></pre>

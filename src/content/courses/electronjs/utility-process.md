---
publishDate: 2026-10-25T12:44
title: Background Work with utilityProcess
slug: utility-process
metadescription: Move slow, heavy work out of Electron's main process with utilityProcess.fork, talk to it with messages, and connect it straight to a window.
updateDate: 2026-10-25T12:44
author: ['bishal-biswas']
level: 3
tags: ['utility-process', 'performance', 'message-ports']
course: electronjs
---

## Why the main process must stay free

The main process is the boss of your app. It creates windows, answers IPC (inter-process communication) calls, builds menus, shows dialogs and talks to the operating system. It does all of that on **one thread**, one job at a time.

So what happens if you give it a job that takes ten seconds, like hashing a big file or crunching a large data set? Everything else waits. Menus stop opening, `invoke` calls from your windows hang, and on some systems you cannot even drag the window. Users see a "Not Responding" label and assume your app crashed.

Think of a small restaurant. The host at the door (the main process) greets guests, hands out menus and takes orders. If the host walks into the kitchen to slow-cook a stew, nobody greets the next guest. The fix is a kitchen with its own cook: a **utility process**. The host passes the order through a hatch, keeps greeting guests, and the cook passes the dish back when it is ready.

A **utility process** is a separate operating system process that runs plain Node.js code. Electron starts it for you with `utilityProcess.fork()`, and you talk to it with messages.

## Seeing the problem first

Here is a handler that does slow work directly in the main process. It adds up every number from 1 to `n`, which takes a few seconds when `n` is large:

```javascript
// main.js (the slow way, do not ship this)
const { ipcMain } = require('electron');

ipcMain.handle('sum:run', (_event, n) => {
  let total = 0;
  for (let i = 1; i <= n; i++) total += i;
  return total;
});
```

If your page calls this with `n = 5_000_000_000`, try clicking a menu while it runs. Nothing happens until the loop ends. The loop itself is fine. **Where** it runs is the problem.

## Step 1: write the worker script

Create a project folder with the usual plain setup from [Your First Electron App](/courses/electronjs/your-first-electron-app): a `package.json` with `"main": "main.js"`, and Electron installed with `npm install --save-dev electron`. Then add a file called `worker.js`:

```javascript
// worker.js (runs inside the utility process)
process.parentPort.on('message', (event) => {
  const { id, n } = event.data;

  let total = 0;
  for (let i = 1; i <= n; i++) total += i;

  process.parentPort.postMessage({ id, total });
});
```

This is ordinary Node.js code. You can `require('node:fs')`, use npm packages, and so on. Two new things:

- **`process.parentPort`** is the hatch between the worker and the main process. It only exists inside a utility process.
- Messages arrive as an **event object**. Your data is in `event.data`. (There is also `event.ports`, which you will use later.)

The `id` travels with every job so the main process can match each answer to the question that asked for it.

## Step 2: start it from the main process

```javascript
// main.js
const { app, BrowserWindow, utilityProcess } = require('electron');
const path = require('node:path');

let worker;

function startWorker() {
  worker = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], {
    serviceName: 'Sum Worker',
  });

  worker.on('spawn', () => console.log('Worker started, pid', worker.pid));
  worker.on('message', (message) => console.log('Worker answered:', message));
  worker.on('exit', (code) => console.log('Worker exited with code', code));
}

app.whenReady().then(() => {
  startWorker();
  worker.postMessage({ id: 1, n: 1_000_000 });
});
```

```bash
npm start
```

```text
Worker started, pid 10964
Worker answered: { id: 1, total: 500000500000 }
```

What each piece does:

- **`utilityProcess.fork(modulePath, args, options)`** starts a new process running `worker.js`. You can only call it **after** the app is ready, so it lives inside `app.whenReady()`.
- **`serviceName`** is the friendly name for this process. You will see it later in `app.getAppMetrics()`.
- **`worker.postMessage(data)`** sends data down the hatch.
- **`worker.on('message', ...)`** receives what the worker posts back. Here, unlike in the worker, you get the data directly, not an event object.
- **`worker.pid`** is the process ID, a number the operating system uses to identify the process. It is `undefined` until the `spawn` event fires.

> **Note:** Messages are copied with the **structured clone** algorithm, the same one `postMessage` uses in browsers. Plain objects, arrays, strings, numbers, dates and typed arrays work. Functions and class instances with methods do not survive the trip.

## Step 3: turn messages into a Promise

Calling `postMessage` and listening for `message` separately gets messy fast. A small helper turns each job into a Promise you can `await`, which fits nicely with `ipcMain.handle`:

```javascript
// main.js (helper)
let nextId = 1;
const pending = new Map(); // id -> resolve function

function runInWorker(n) {
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    worker.postMessage({ id, n });
  });
}

// inside startWorker(), replace the 'message' listener with:
worker.on('message', ({ id, total }) => {
  pending.get(id)?.(total);
  pending.delete(id);
});
```

Now the slow handler from the start becomes fast to answer, because the main process only forwards the job:

```javascript
// main.js
ipcMain.handle('sum:run', (_event, n) => runInWorker(Number(n)));
```

The renderer still calls `window.api.sum(n)` through the preload exactly as you learned in [IPC Part 2: Asking Questions with invoke and handle](/courses/electronjs/ipc-invoke-and-handle). The difference is that menus, dialogs and other IPC calls keep working while the sum is being calculated.

## Step 4: connect a window straight to the worker

Every result above still passes through the main process: renderer to main, main to worker, worker to main, main to renderer. For lots of small messages, or big chunks of data, you can cut out the middle step with a **MessageChannel**, which you met in [MessagePorts for Direct Communication](/courses/electronjs/message-ports).

A `MessageChannelMain` gives you two connected ports. Hand one to the worker and the other to the window, and they talk directly.

```javascript
// main.js
const { MessageChannelMain } = require('electron');

function connectWindowToWorker(win) {
  const { port1, port2 } = new MessageChannelMain();
  worker.postMessage({ type: 'port' }, [port1]);              // to the worker
  win.webContents.postMessage('worker-port', null, [port2]); // to the window
}
```

The second argument of `worker.postMessage` and the third of `webContents.postMessage` is the **transfer list**: ports listed there are moved, not copied, so only the receiver can use them afterwards.

The worker picks up its port from `event.ports` and listens on it:

```javascript
// worker.js
function sumTo(n) {
  let total = 0;
  for (let i = 1; i <= n; i++) total += i;
  return total;
}

process.parentPort.on('message', (event) => {
  // A new port from the main process: answer jobs that arrive on it
  if (event.data.type === 'port') {
    const port = event.ports[0];
    port.on('message', ({ data }) => {
      port.postMessage({ id: data.id, total: sumTo(data.n) });
    });
    port.start(); // messages wait in a queue until you call start()
    return;
  }

  // A normal job from the main process, as in Step 3
  const { id, n } = event.data;
  process.parentPort.postMessage({ id, total: sumTo(n) });
});
```

The preload receives the other port. A port object cannot be handed through `contextBridge`, so the preload **keeps** it and exposes one small, safe function instead:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

let port;
let nextId = 1;
const pending = new Map();

ipcRenderer.on('worker-port', (event) => {
  port = event.ports[0];
  port.onmessage = ({ data }) => {
    pending.get(data.id)?.(data.total);
    pending.delete(data.id);
  };
});

contextBridge.exposeInMainWorld('api', {
  sum: (n) =>
    new Promise((resolve, reject) => {
      if (!port) return reject(new Error('Worker is not connected yet'));
      const id = nextId++;
      pending.set(id, resolve);
      port.postMessage({ id, n: Number(n) });
    }),
});
```

Inside the page, `await window.api.sum(1000000)` now goes straight to the worker and back. The main process is not involved at all after the setup.

## Stopping, crashing and restarting

A worker is a real process, so it can stop for many reasons. Listen for `exit` and decide what to do:

```javascript
// main.js
let quitting = false;
app.on('before-quit', () => {
  quitting = true;
});

// inside startWorker():
worker.on('exit', (code) => {
  console.log('Worker stopped with code', code);
  if (code !== 0 && !quitting) {
    setTimeout(startWorker, 1000); // try again after a short pause
  }
});
```

Any job that was running when the worker crashed never gets an answer. In a real app, you would also reject the Promises still waiting in `pending` so the page can show an error.

To stop a worker yourself, call `worker.kill()`. It returns `true` if the request worked.

How the worker is stopped depends on the system:

- On **macOS and Linux**, `kill()` sends the `SIGTERM` signal. A signal is a short "please stop" message from the operating system. Your worker can catch it, finish writing a file, and exit.
- On **Windows** there are no signals, so the process is simply ended.

Catch the signal and always exit yourself:

```javascript
// worker.js
process.on('SIGTERM', () => {
  // close files, save progress...
  process.exit(0);
});
```

> **Warning:** In the current Electron, a worker that ignores `SIGTERM` is still force-stopped after about two seconds. From Electron 46, `kill()` only sends `SIGTERM`. A worker that catches the signal and never calls `process.exit()` would then keep running. Always exit in your handler.

Utility processes are also stopped when your app quits, so you do not need to clean them up by hand at the end.

## Seeing worker logs

By default, the worker shares your terminal for `console.log`. On some systems, especially Windows, that output may not show up. Ask for the output as a stream with `stdio: 'pipe'` and forward it yourself:

```javascript
// main.js
worker = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], {
  serviceName: 'Sum Worker',
  stdio: 'pipe',
});
worker.stdout.on('data', (chunk) => process.stdout.write(`[worker] ${chunk}`));
worker.stderr.on('data', (chunk) => process.stderr.write(`[worker] ${chunk}`));
```

```text
[worker] worker ready
```

## Which background tool should you use?

There are four ways to run work "somewhere else". Here is how they compare:

| Tool | Where it runs | Has Node.js? | Good for |
| --- | --- | --- | --- |
| Web Worker | A thread inside a renderer | No | Number crunching on data the page already has, like resizing an image |
| `worker_threads` | A thread inside the main process | Yes | Short CPU-heavy JavaScript jobs with no risky native code |
| `utilityProcess` | Its own process | Yes | Long or risky work, native modules, network jobs, anything that might crash |
| `child_process` | Its own process | Only for real executables | Running another program, like `git` or `ffmpeg` |

Some guidelines:

- If the work is pure JavaScript on data from the page, a **Web Worker** in the renderer is simplest and needs no IPC at all.
- If a crash must never take down your app, use a **utility process**. A crash in a `worker_thread` can bring down the whole main process with it.
- The old trick of `child_process.fork()` with the `ELECTRON_RUN_AS_NODE` environment variable depends on the `RunAsNode` fuse, which the Forge template turns off for security. `utilityProcess` is the supported replacement. See [Electron Fuses and ASAR Integrity](/courses/electronjs/fuses-and-asar-integrity).

## Using a worker in an Electron Forge project

With the Forge Vite template from [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge), your worker must be built too. Add it as an extra `build` entry in `forge.config.mjs` next to `src/main.js`:

```javascript
// forge.config.mjs (inside the VitePlugin build list)
{
  entry: 'src/worker.js',
  config: 'vite.main.config.mjs',
  target: 'main',
},
```

Vite then writes `worker.cjs` next to `main.cjs`, so the fork call becomes `utilityProcess.fork(path.join(__dirname, 'worker.cjs'))`.

## Common mistakes

### Calling fork before the app is ready

`utilityProcess.fork` only works after the `ready` event. Put it inside `app.whenReady().then(...)`, or in a function you call from there.

### Reading `event` instead of `event.data` in the worker

In the worker, `process.parentPort` gives you an event object. Reading `event.id` gives `undefined`. Use `event.data.id`. In the main process, `worker.on('message')` gives you the data directly.

### Forgetting `port.start()`

A `MessagePortMain` in the main process or worker queues every message until you call `port.start()`. If messages "disappear", this is usually why. In the preload, setting `port.onmessage` starts the port for you.

### Wrong path to the worker file

If the path is wrong, there is no error thrown. The worker starts, fails to load the file and exits with code `1`. Always build the path with `path.join(__dirname, ...)` and log the `exit` code while developing.

## Quick recap

- The main process runs one job at a time. Slow work there freezes menus, dialogs and IPC.
- `utilityProcess.fork(path)` starts a separate Node.js process, after the app is ready.
- Main sends with `worker.postMessage(data)` and listens with `worker.on('message')`.
- The worker listens with `process.parentPort.on('message')`, reads `event.data`, and answers with `process.parentPort.postMessage()`.
- Give each job an `id` and wrap it in a Promise so `ipcMain.handle` can simply return it.
- `MessageChannelMain` connects a window directly to the worker. Keep the port in the preload and expose a small function.
- Listen for `exit`, handle `SIGTERM` in the worker, and always call `process.exit()`.
- Prefer a utility process over `worker_threads` when a crash must not take the app down.

<code id="code-content" class="language-javascript">
// main.js: a utility process that sums numbers without freezing the app
const { app, BrowserWindow, ipcMain, utilityProcess, MessageChannelMain } = require('electron');
const path = require('node:path');
// --- The worker and a Promise-based helper
let worker;
let nextId = 1;
let quitting = false;
const pending = new Map();
app.on('before-quit', () =&gt; {
  quitting = true;
});
function startWorker() {
  worker = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], {
    serviceName: 'Sum Worker',
    stdio: 'pipe',
  });
  worker.stdout.on('data', (chunk) =&gt; process.stdout.write(`[worker] ${chunk}`));
  worker.on('message', ({ id, total }) =&gt; {
    pending.get(id)?.(total);
    pending.delete(id);
  });
  worker.on('exit', (code) =&gt; {
    console.log('Worker exited with code', code);
    if (code !== 0 &amp;&amp; !quitting) setTimeout(startWorker, 1000);
  });
}
function runInWorker(n) {
  return new Promise((resolve) =&gt; {
    const id = nextId++;
    pending.set(id, resolve);
    worker.postMessage({ id, n });
  });
}
// --- Option A: go through main with invoke/handle
ipcMain.handle('sum:run', (_event, n) =&gt; runInWorker(Number(n)));
// --- Option B: give the window a direct line to the worker
function connectWindowToWorker(win) {
  const { port1, port2 } = new MessageChannelMain();
  worker.postMessage({ type: 'port' }, [port1]);
  win.webContents.postMessage('worker-port', null, [port2]);
}
// --- Windows and lifecycle
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
  win.webContents.once('did-finish-load', () =&gt; connectWindowToWorker(win));
}
app.whenReady().then(() =&gt; {
  startWorker(); // fork only works after ready
  createWindow();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

---
publishDate: 2026-10-25T12:20
title: MessagePorts for Direct Communication
slug: message-ports
metadescription: Use MessageChannelMain and MessagePorts in Electron to give two windows, or a window and the main process, their own private two-way channel.
updateDate: 2026-10-25T12:20
author: ['bishal-biswas']
level: 3
tags: ['ipc', 'messageport', 'multiple-windows']
course: electronjs
---

## Beyond channels

With normal IPC, every message goes through the main process on a named channel. If window A wants to tell window B something, A sends it to main and main forwards it to B, as you did in [IPC Part 3: Sending Messages to a Window](/courses/electronjs/ipc-main-to-renderer). That works, but:

- the main process has to relay every single message, which adds work and code;
- all windows share one global list of channel names;
- there is no built-in way to say "this conversation belongs to these two parties only".

**MessagePorts** solve this. They give two parties their own private, two-way line.

Think of two tin cans joined by a string. Whoever holds one can talks, and whoever holds the other can hears it, and the other way round. Nobody else is on the line. The main process is like a shop that makes the tin-can phones and hands one can to each person. After that, the shop is not involved in the conversation.

You should be comfortable with the three IPC lessons and [Working with Multiple Windows](/courses/electronjs/multiple-windows) before reading this one.

## The building blocks

A **MessageChannel** is a pair of connected **ports**, called `port1` and `port2`. Whatever you `postMessage` into one comes out of the other as a `message` event.

MessagePorts are a standard web feature: web pages use them to talk to iframes and web workers. Electron adds two things:

| Where | Create a channel with | Ports are | Receive messages with |
| --- | --- | --- | --- |
| Renderer (preload or page) | `new MessageChannel()` | DOM `MessagePort` | `port.onmessage = (event) => ...` |
| Main process | `new MessageChannelMain()` | `MessagePortMain` | `port.on('message', (event) => ...)` plus `port.start()` |

In both cases the data is in `event.data`, and you send with `port.postMessage(data)`. Data is copied with the same structured clone rules as normal IPC: plain data is fine, functions are not.

### Moving a port to another process

A port is only useful once one end is somewhere else. You **transfer** a port by passing it in a list as the last argument:

- main to renderer: `win.webContents.postMessage(channel, message, [port])`
- renderer to main: `ipcRenderer.postMessage(channel, message, [port])`

The receiving side finds the ports in `event.ports`. Once a port is transferred, the sender cannot use it any more: it now belongs to the other side.

## Example 1: two windows chatting directly

You will open two windows, Alice and Bob. The main process creates one channel, gives `port1` to Alice and `port2` to Bob, and then steps back. The windows talk directly.

### The main process: make the channel and hand out the ends

```javascript
// main.js
const { app, BrowserWindow, MessageChannelMain } = require('electron');
const path = require('node:path');

function createChatWindow(title, x) {
  return new BrowserWindow({
    title,
    x,
    y: 120,
    width: 380,
    height: 480,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
}

app.whenReady().then(async () => {
  const alice = createChatWindow('Alice', 100);
  const bob = createChatWindow('Bob', 520);

  // Wait until both pages (and their preloads) are ready to receive a port.
  await Promise.all([alice.loadFile('chat.html'), bob.loadFile('chat.html')]);

  const { port1, port2 } = new MessageChannelMain();
  alice.webContents.postMessage('chat:connect', { me: 'Alice', peer: 'Bob' }, [port1]);
  bob.webContents.postMessage('chat:connect', { me: 'Bob', peer: 'Alice' }, [port2]);
});
```

- `loadFile` returns a Promise that resolves once the page has loaded. Waiting for both matters: a port sent before the preload is listening would be lost.
- `webContents.postMessage` takes a channel name, an ordinary message (here, who is who), and a list of ports to transfer.

### The preload: keep the port, expose small functions

Here is an important detail. A `MessagePort` **cannot cross `contextBridge`**. If you try to hand one to the page, the page receives a plain, useless object. So the port stays in the preload, and the preload exposes small functions that use it. That also fits the safe-API habits from [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api).

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

let port = null;
let messageCallback = () => {};
let connectedCallback = () => {};

ipcRenderer.on('chat:connect', (event, names) => {
  port = event.ports[0];
  port.onmessage = (messageEvent) => messageCallback(messageEvent.data);
  connectedCallback(names);
});

contextBridge.exposeInMainWorld('chat', {
  send: (text) => {
    if (port && typeof text === 'string') port.postMessage(text);
  },
  onMessage: (callback) => {
    messageCallback = callback;
  },
  onConnected: (callback) => {
    connectedCallback = callback;
  },
});
```

- `event.ports[0]` is the port the main process transferred.
- Setting `port.onmessage` starts the port automatically. (If you use `port.addEventListener('message', ...)` instead, you must also call `port.start()`.)
- Notice the preload never passes the port or the event to the page, only the text.

### The page

```html
<!-- chat.html -->
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'" />
    <title>Chat</title>
  </head>
  <body>
    <h2 id="heading">Connecting...</h2>
    <ul id="messages"></ul>
    <input id="text" placeholder="Say something" />
    <button id="send">Send</button>
    <script src="chat.js"></script>
  </body>
</html>
```

```javascript
// chat.js
const list = document.getElementById('messages');
const input = document.getElementById('text');
let peerName = 'Them';

function addLine(text) {
  const li = document.createElement('li');
  li.textContent = text; // textContent, never innerHTML, for safety
  list.append(li);
}

window.chat.onConnected(({ me, peer }) => {
  peerName = peer;
  document.getElementById('heading').textContent = `You are ${me}, chatting with ${peer}`;
});

window.chat.onMessage((text) => addLine(`${peerName}: ${text}`));

document.getElementById('send').addEventListener('click', () => {
  window.chat.send(input.value);
  addLine(`You: ${input.value}`);
  input.value = '';
});
```

Run `npm start`. Two windows open side by side. Type in Alice's window and click **Send**: the message appears in Bob's window. Reply from Bob, and it shows up in Alice's. The main process created the line, but it never sees the messages.

## Example 2: a private line between a page and the main process

Ports are also useful between one window and the main process. Imagine a page that streams many small requests to a calculation service in main. A dedicated port keeps that conversation separate from all your other channels, and the main process does not need to look up which window each message came from: the port only connects to one place.

This time the **renderer** creates the channel and transfers one end to main:

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

const { port1, port2 } = new MessageChannel();
ipcRenderer.postMessage('stats:connect', null, [port2]); // give main one end

let resultCallback = () => {};
port1.onmessage = (event) => resultCallback(event.data);

contextBridge.exposeInMainWorld('stats', {
  calculate: (numbers) => port1.postMessage(numbers),
  onResult: (callback) => {
    resultCallback = callback;
  },
});
```

```javascript
// main.js
const { ipcMain } = require('electron');

ipcMain.on('stats:connect', (event) => {
  const [port] = event.ports; // a MessagePortMain

  port.on('message', ({ data }) => {
    if (!Array.isArray(data) || !data.every((n) => typeof n === 'number')) return;
    const sum = data.reduce((total, n) => total + n, 0);
    port.postMessage({ count: data.length, sum, average: data.length ? sum / data.length : 0 });
  });

  port.on('close', () => console.log('A page closed its stats line'));
  port.start(); // main-process ports queue messages until you start them
});
```

```javascript
// renderer.js
window.stats.onResult((result) => {
  console.log(`count ${result.count}, sum ${result.sum}, average ${result.average}`);
});
window.stats.calculate([4, 8, 15, 16, 23, 42]);
```

```text
count 6, sum 108, average 18
```

Two main-process details to remember:

- A `MessagePortMain` **queues** incoming messages until you call `port.start()`. Forget it and nothing ever arrives.
- `port.on('close', ...)` fires when the other end goes away, for example when the window closes. Use it to clean up anything you set up for that connection.

The message handler still validates its data. A port is a private line, but the page on the other end is still a page, so the rules from [Designing a Safe IPC API](/courses/electronjs/designing-a-safe-ipc-api) apply here too.

## Closing a port

Either side can end the conversation with `port.close()`. The line is then disconnected, and a `MessagePortMain` on the other side gets its `close` event. The same happens automatically when a window holding one end closes. Close ports you no longer need, especially if you create a new channel for every task.

## When to use MessagePorts

Use plain IPC (`invoke`, `send`, `webContents.send`) for most things. It is simpler, and it is what the rest of this course uses. Reach for MessagePorts when:

- **two windows** need to talk a lot, without the main process relaying every message;
- you want a **private, per-connection** line, for example one per open document or per running task;
- you want to connect a window directly to a **background process**. A `utilityProcess` child accepts ports through `child.postMessage(message, [port])`; see [Background Work with utilityProcess](/courses/electronjs/utility-process).

> **Note:** Old tutorials use `ipcRenderer.sendTo()` to message another window directly. It was removed from Electron. A `MessageChannelMain` set up by the main process, as in Example 1, is the replacement.

## Common mistakes

### Trying to pass the port through contextBridge

The page receives a plain object, not a working port. Keep the port in the preload and expose functions such as `send` and `onMessage`.

### Forgetting `port.start()` in the main process

A `MessagePortMain` holds every message until `start()` is called. In the renderer, setting `onmessage` starts the port for you, but `addEventListener('message', ...)` needs `start()` too.

### Sending the port before the page is ready

If the window has not loaded yet, nobody is listening on `chat:connect` and the port is lost. `await win.loadFile(...)` (or wait for `did-finish-load`) before transferring.

### Using a port after transferring it

Once you pass a port in the transfer list, it belongs to the receiver. Keep using the **other** end.

## Quick recap

- A MessageChannel is a pair of connected ports; what goes into one comes out of the other.
- In main use `MessageChannelMain` (ports are `MessagePortMain`, use `.on('message')` and `.start()`); in renderers use the standard `MessageChannel`.
- Transfer ports with `webContents.postMessage(channel, msg, [port])` or `ipcRenderer.postMessage(channel, msg, [port])`; receive them in `event.ports`.
- Ports cannot cross `contextBridge`: keep them in the preload and expose small functions.
- The main process can connect two windows directly, then stay out of the conversation.
- Validate port messages like any other IPC input, close ports you no longer need, and listen for `close` in main.

<code id="code-content" class="language-javascript">
// main.js: connect two windows with a private MessageChannel
const { app, BrowserWindow, ipcMain, MessageChannelMain } = require('electron');
const path = require('node:path');
function createChatWindow(title, x) {
  return new BrowserWindow({
    title, x, y: 120, width: 380, height: 480,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
}
// --- Example 1: main builds the line, then stays out of the conversation
async function connectAliceAndBob() {
  const alice = createChatWindow('Alice', 100);
  const bob = createChatWindow('Bob', 520);
  await Promise.all([alice.loadFile('chat.html'), bob.loadFile('chat.html')]); // preloads listening
  const { port1, port2 } = new MessageChannelMain();
  alice.webContents.postMessage('chat:connect', { me: 'Alice', peer: 'Bob' }, [port1]);
  bob.webContents.postMessage('chat:connect', { me: 'Bob', peer: 'Alice' }, [port2]);
}
// --- Example 2: a page hands main one end of its own channel
ipcMain.on('stats:connect', (event) =&gt; {
  const [port] = event.ports; // MessagePortMain
  port.on('message', ({ data }) =&gt; {
    if (!Array.isArray(data) || !data.every((n) =&gt; typeof n === 'number')) return;
    const sum = data.reduce((total, n) =&gt; total + n, 0);
    port.postMessage({ count: data.length, sum, average: data.length ? sum / data.length : 0 });
  });
  port.on('close', () =&gt; console.log('A page closed its stats line'));
  port.start(); // main-process ports queue messages until started
});
// --- preload.js keeps the port (it cannot cross contextBridge):
//   ipcRenderer.on('chat:connect', (event, names) =&gt; {
//     port = event.ports[0];
//     port.onmessage = (e) =&gt; messageCallback(e.data);
//   });
//   contextBridge.exposeInMainWorld('chat', { send: (text) =&gt; port?.postMessage(text), onMessage: ... });
// --- Standard lifecycle
app.whenReady().then(() =&gt; {
  connectAliceAndBob();
  app.on('activate', () =&gt; {
    if (BrowserWindow.getAllWindows().length === 0) connectAliceAndBob();
  });
});
app.on('window-all-closed', () =&gt; {
  if (process.platform !== 'darwin') app.quit();
});
</code></pre>

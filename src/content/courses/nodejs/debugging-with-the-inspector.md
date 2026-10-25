---
publishDate: 2026-10-25T11:30
title: Debugging with the Inspector and Chrome DevTools
slug: debugging-with-the-inspector
metadescription: Pause Node.js code, inspect variables and step line by line with --inspect, --inspect-brk, Chrome DevTools, VS Code and the built-in node inspect debugger.
updateDate: 2026-10-25T11:30
author: ['bishal-biswas']
level: 2
tags: ['debugging', 'inspector', 'devtools']
course: nodejs
---

## Why use a debugger?

In [the Console and Debugging Basics lesson](/courses/nodejs/console-and-debugging-basics) you found bugs with `console.log`. That works, but it is like checking a cake by opening the oven every two minutes. You add a log, run, read, add another log, run again.

A **debugger** lets you freeze the program at any line and look around. You can see every variable, walk forward one line at a time and watch values change. It is like pausing a film to study one frame.

Node has a debugger built in, called the **inspector**. It speaks the same language as Chrome's developer tools, so you can debug Node code with the same DevTools you use for web pages.

## A bug to hunt

Here is a small script with a bug:

```javascript
// cart.js
const items = [
  { name: 'Notebook', qty: 2 },
  { name: 'Pen', qty: '3' }, // came from a form, so it is a string
];

function countItems(list) {
  let count = 0;
  for (const item of list) {
    count += item.qty;
  }
  return count;
}

console.log('Items in cart:', countItems(items));
```

```bash
node cart.js
```

```text
Items in cart: 23
```

We expected `5`. Let us find out why without adding a single `console.log`.

## Starting Node with the inspector

Add the `--inspect` flag:

```bash
node --inspect cart.js
```

```text
Debugger listening on ws://127.0.0.1:9229/65f6f692-7e95-48a0-b1fb-d2659f676e85
For help, see: https://nodejs.org/en/docs/inspector
```

Node opened a **debugging port**: a door on your own machine (`127.0.0.1`, port `9229`) that a debugger can connect through. The long code after the port is a random ID for this session.

There is a problem, though. This script finishes in a few milliseconds, long before you can connect. That is what the other flags are for:

| Flag | What it does |
| --- | --- |
| `--inspect` | Opens the port and keeps running |
| `--inspect-brk` | Opens the port and **pauses on the first line** until you press resume |
| `--inspect-wait` | Opens the port and waits for a debugger to attach, then runs without pausing |

For short scripts, use `--inspect-brk`:

```bash
node --inspect-brk cart.js
```

Use plain `--inspect` for servers, which keep running anyway, so you can attach whenever you like.

> **Tip:** Need a different port, for example to debug two programs at once? Use `--inspect=9230` or `--inspect-brk=9230`.

## Debugging in Chrome DevTools

With `node --inspect-brk cart.js` running:

1. Open Chrome (or Edge, Brave, any Chromium browser).
2. Type `chrome://inspect` in the address bar.
3. Under **Remote Target** you will see `cart.js`. Click **inspect**.

A DevTools window opens, paused on line 2 of your file.

> **Tip:** On the same page, **Open dedicated DevTools for Node** gives you a window that reconnects by itself every time you restart Node with `--inspect`.

### Setting a breakpoint

A **breakpoint** is a marker that says "pause when you reach this line".

In the **Sources** panel, click the line number `10` (the `count += item.qty;` line). A blue marker appears. Now press **Resume** (the play button, or `F8`). The program runs until it reaches line 10 and stops.

### Looking around

While paused, the right-hand side shows:

- **Scope**: every variable that exists right now, like `count` and `item`.
- **Watch**: expressions you type in yourself, such as `typeof item.qty`. They update at every pause.
- **Call Stack**: which function called which to get here.

You can also hover over any variable in the code to see its value, or type expressions into the **Console** tab, which runs them in the paused function's scope.

### Stepping

The buttons at the top of the right-hand side move you through the code:

| Button | Key | What it does |
| --- | --- | --- |
| Resume | `F8` | Run until the next breakpoint |
| Step over | `F10` | Run this line, stop on the next one |
| Step into | `F11` | Go inside the function called on this line |
| Step out | `Shift+F11` | Finish this function, stop in its caller |

Press Resume once more to reach line 10 for the second item. In Scope you now see `count` is `2` and `item.qty` is `'3'`, with quotes. It is a string. `2 + '3'` glues the two together into `'23'`. Bug found.

The fix is to convert the value first:

```javascript
count += Number(item.qty);
```

## The debugger statement

Clicking line numbers is fine, but you can also write a breakpoint into your code:

```javascript
for (const item of list) {
  debugger; // pause here when a debugger is attached
  count += item.qty;
}
```

When no debugger is connected, Node ignores the `debugger` statement completely. Still, remove it before you commit, so nobody else gets surprised.

## Logpoints and conditional breakpoints

Right-click a line number in DevTools for two more options:

- **Add conditional breakpoint**: only pause when an expression is true, for example `item.name === 'Pen'`. Great inside a loop of 10,000 items.
- **Add logpoint**: print a message, such as `'qty is', item.qty`, to the console without pausing and without editing your file. It is a `console.log` you never have to clean up.

## Debugging in VS Code

VS Code has the same debugger built in. The quickest way in:

1. Open the Command Palette (`Ctrl+Shift+P`, or `Cmd+Shift+P` on macOS).
2. Run **Debug: JavaScript Debug Terminal**.
3. In that terminal, run your program as normal: `node cart.js`.

VS Code attaches automatically. Click in the gutter left of a line number to set breakpoints, and use the same `F10`/`F11` keys to step.

For a repeatable setup, add a `.vscode/launch.json` file:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug cart",
      "program": "${workspaceFolder}/cart.js"
    }
  ]
}
```

Then press `F5` to start debugging.

## The built-in terminal debugger

No browser? Node ships a small text debugger. Start it with `node inspect` (no dashes):

```bash
node inspect cart.js
```

It pauses on the first line and gives you a `debug>` prompt. Here is a real session hunting the same bug:

```text
debug> Break on start in cart.js:2
debug> sb(10)
debug> c
break in cart.js:10
debug> exec item
{ name: 'Notebook', qty: 2 }
debug> c
break in cart.js:10
debug> exec count
2
debug> exec typeof item.qty
'string'
```

The most useful commands:

- `c` or `cont`: continue to the next breakpoint.
- `n` or `next`: step over. `s` or `step`: step into. `o` or `out`: step out.
- `sb(10)`: set a breakpoint on line 10.
- `exec expression`: print the value of an expression.
- `watch('count')`: show `count` every time the program pauses.
- `repl`: open a prompt to explore freely (press `Ctrl+C` to leave it).
- `.exit`: quit.

## Debugging other things

- **TypeScript**: if you run `.ts` files directly (see [the Running TypeScript Natively lesson](/courses/nodejs/running-typescript-natively)), `node --inspect-brk app.ts` works as normal. Node keeps line numbers the same when it strips types.
- **A process that is already running**: on Linux and macOS, sending the `SIGUSR1` signal (`kill -USR1 <pid>`) makes a running Node process open the inspector, so you can attach without restarting it.
- **From code**: the `node:inspector` module tells you whether the inspector is on. `inspector.url()` returns the WebSocket address, or `undefined` when it is off.

## Common mistakes

### Exposing the debugger to the network

```bash
node --inspect=0.0.0.0:9229 server.js # anyone who can reach port 9229 can run code
```

A connected debugger can run any code inside your process. Keep the default `127.0.0.1`, which only accepts connections from your own machine. Never open the inspector port on a public server.

### Using --inspect on a script that finishes instantly

```bash
node --inspect cart.js # done before you can attach
```

Use `--inspect-brk` instead, so Node waits on the first line for you.

### Port already in use

```text
Starting inspector on 127.0.0.1:9229 failed: address already in use
```

Another Node process is already being debugged on 9229, so your program runs with no debugger at all. Stop the other process, or pick another port with `--inspect=9230`.

## Quick recap

- The **inspector** lets you pause Node, inspect variables and step through code.
- `--inspect` opens a debugging port, `--inspect-brk` also pauses on the first line, `--inspect-wait` waits for you to attach.
- Open `chrome://inspect` and click **inspect** to use Chrome DevTools.
- Set **breakpoints** by clicking line numbers or with a `debugger;` statement.
- Step with `F10` (over), `F11` (into), `Shift+F11` (out) and resume with `F8`.
- VS Code's JavaScript Debug Terminal attaches automatically, and `node inspect` works with no browser at all.
- Keep the inspector on `127.0.0.1`. Never expose it publicly.

<code id="code-content" class="language-javascript">
// debug-me.mjs
// 1. Run normally:            node debug-me.mjs
// 2. Run under the debugger:  node --inspect-brk debug-me.mjs
//    then open chrome://inspect in Chrome and click "inspect"
import inspector from 'node:inspector';
// inspector.url() is the WebSocket address when --inspect is on, otherwise undefined
const url = inspector.url();
console.log(url ? `Inspector listening at ${url}` : 'Inspector is off (try --inspect-brk)');
const orders = [
  { customer: 'Asha', qty: 2, price: 4.5 },
  { customer: 'Ravi', qty: '3', price: 1.2 }, // from a form: qty is a string!
  { customer: 'Maya', qty: 1, price: 9.99 },
];
// Buggy version: += on a string glues text together
function countItemsBuggy(list) {
  let count = 0;
  for (const order of list) {
    debugger; // pauses here ONLY when a debugger is attached
    count += order.qty; // hover over count and order.qty in DevTools
  }
  return count;
}
// Fixed version: convert to a number first
function countItems(list) {
  let count = 0;
  for (const order of list) {
    count += Number(order.qty);
  }
  return count;
}
function totalPrice(list) {
  // Set a breakpoint on the next line in the Sources panel and step through
  return list.reduce((sum, o) =&gt; sum + Number(o.qty) * o.price, 0);
}
console.log('Buggy count:', countItemsBuggy(orders)); // 2 + '3' is '23', then '23' + 1 is '231'
console.log('Fixed count:', countItems(orders)); // 6
console.log('Total price:', totalPrice(orders).toFixed(2));
// Logpoints and conditional breakpoints need no code changes:
// right-click a line number in DevTools and choose "Add logpoint..."
console.table(orders.map((o) =&gt; ({ ...o, qtyType: typeof o.qty })));
</code></pre>

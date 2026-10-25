---
publishDate: 2026-10-25T09:30
title: Watch Mode with node --watch
slug: watch-mode
metadescription: Restart your script automatically every time you save with node --watch. Learn what it watches, --watch-path, --watch-preserve-output and how it replaces nodemon.
updateDate: 2026-10-25T09:30
author: ['bishal-biswas']
level: 1
tags: ['tooling', 'watch', 'workflow']
course: nodejs
---

## What is watch mode?

So far your routine has been: edit the code, save, switch to the terminal, press the up arrow, press Enter, look at the result. Again and again.

**Watch mode** removes the boring part. Node keeps an eye on your files and re-runs your script the moment you save.

Think of a smoke alarm. You do not stand in the kitchen checking for smoke every minute. The alarm watches for you and reacts when something changes. `node --watch` is a change alarm for your code.

## Your first watched script

Add `--watch` before the script name:

```bash
node --watch app.mjs
```

```javascript
// app.mjs
console.log('Hello, Asha!');
```

```text
Hello, Asha!
Completed running 'app.mjs'. Waiting for file changes before restarting...
```

The program finished, but Node did not exit. It is waiting. Now change the message to `'Hi, Asha!'` and save:

```text
Restarting 'app.mjs'
Hi, Asha!
Completed running 'app.mjs'. Waiting for file changes before restarting...
```

Node noticed the save and ran the script again. By default it also clears the terminal on each restart, so you only see the latest run.

Press **Ctrl+C** to stop watching.

## What gets watched

By default, Node watches your script **and every file it imports**, and the files those import, and so on.

```javascript
// greet.mjs
export const greeting = 'Hello';
```

```javascript
// app.mjs
import { greeting } from './greet.mjs';
console.log(`${greeting}, Asha!`);
```

```bash
node --watch app.mjs
```

Edit `greet.mjs` and save: `app.mjs` restarts too, because it imports `greet.mjs`. You do not need to list any files yourself.

### What is not watched

Files your code only **reads**, such as a `data.txt` loaded with `readFile`, are not part of the import chain. Changing them does not trigger a restart.

```javascript
// app.mjs
import { readFile } from 'node:fs/promises';
const text = await readFile('data.txt', 'utf8'); // editing data.txt will NOT restart
console.log(text);
```

To watch those as well, use `--watch-path`, below.

## Long-running programs

Watch mode really shines with programs that never finish on their own, such as a web server. Here is a tiny one. You will learn how it works in the http module lesson.

```javascript
// server.mjs
import http from 'node:http';

const message = 'Hello from version 1';

http.createServer((req, res) => res.end(message)).listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
```

```bash
node --watch server.mjs
```

Open `http://localhost:3000` and you see "Hello from version 1". Change it to "version 2" and save:

```text
Listening on http://localhost:3000
Restarting 'server.mjs'
Listening on http://localhost:3000
```

Node stopped the old server and started a new one. Refresh the browser and you see the new message.

## Choosing what to watch: --watch-path

`--watch-path` tells Node exactly which files or folders to watch. When you use it, Node watches **only** those paths, instead of following your imports.

```bash
node --watch-path=src --watch-path=data app.mjs
```

This restarts `app.mjs` whenever anything inside `src/` or `data/` changes. You can repeat the flag as many times as you like.

Note that `--watch-path` turns on watch mode by itself, so you do not need `--watch` as well.

## Keeping old output: --watch-preserve-output

Clearing the screen on each restart keeps things tidy, but sometimes you want to compare this run with the last one. Add `--watch-preserve-output`:

```bash
node --watch --watch-preserve-output app.mjs
```

Now every run stays on screen, one after another.

## Watch mode with .env files

`--watch` works together with `--env-file`, from the Environment Variables lesson:

```bash
node --watch --env-file=.env server.mjs
```

Node also restarts when you edit the `.env` file itself, so a new setting takes effect as soon as you save.

## Adding it to package.json

You will type this command many times a day, so give it a short name in `package.json`. Many projects call it `dev`:

```json
{
  "scripts": {
    "start": "node server.mjs",
    "dev": "node --watch --env-file=.env server.mjs"
  }
}
```

```bash
npm run dev
```

You can also use `node --run dev`, which you met in the npm, npx and node --run lesson.

Keep `start` without `--watch`. Watch mode is for development on your own machine, never for a live server.

## What about nodemon?

Before watch mode existed, everyone installed a package called **nodemon** to do this job. You will still see it in many tutorials and older projects:

```json
{
  "scripts": {
    "dev": "nodemon server.js"
  }
}
```

For most projects, `node --watch` now does the same job with nothing to install. nodemon still has extra options, such as running other commands on change, but you rarely need them while learning.

## When a restart fails

If your code has an error, Node prints it and keeps waiting:

```text
Restarting 'app.mjs'
TypeError: Cannot read properties of undefined (reading 'name')
    at ...

Failed running 'app.mjs'. Waiting for file changes before restarting...
```

Fix the code, save, and it runs again. You never have to restart watch mode by hand.

> **Note:** In our testing with Node 24.12, a **syntax error** (such as a missing bracket) in an ES module could leave plain `--watch` stuck on "Failed running", even after the fix was saved. If that happens, press Ctrl+C and start it again. Watching the folder with `node --watch-path=. app.mjs` did not have this problem.

## Common mistakes

### Putting --watch after the script name

```bash
node app.mjs --watch
```

This runs once and exits. Everything after the script name is an argument for your script, not for Node. Put Node's flags first:

```bash
node --watch app.mjs
```

### Expecting a data file to trigger a restart

If you edit `notes.json` and nothing happens, remember that only imported files are watched by default. Add `--watch-path` for data folders, or simply save your script again to force a restart.

### Using watch mode in production

```json
{
  "scripts": {
    "start": "node --watch server.mjs"
  }
}
```

A live server should not restart whenever a file on disk changes. Keep `--watch` in a `dev` script only.

## Quick recap

- `node --watch app.mjs` re-runs your script every time you save.
- It watches the script and every file it imports, and it clears the screen on each restart.
- Files you only read, such as data files, are not watched unless you add `--watch-path`.
- `--watch-path=folder` watches only the paths you list. `--watch-preserve-output` keeps old output on screen.
- It works with `--env-file`, and restarts when the `.env` file changes.
- Put it in a `dev` script in `package.json`. Never use it for a live server.

<code id="code-content" class="language-javascript">
// watch-demo.mjs
// Run it with:   node --watch watch-demo.mjs
// Then change TAX_RATE, the basket or the currency below and save.
// Node re-runs the file every time you save. Press Ctrl+C to stop.
const TAX_RATE = 0.18;   // try 0.05
const CURRENCY = 'INR';  // try 'GBP' or 'USD'
const basket = [
  { item: 'Notebook', price: 120, qty: 3 },
  { item: 'Pen', price: 25, qty: 10 },
  { item: 'Backpack', price: 1499, qty: 1 },
  // { item: 'Water bottle', price: 349, qty: 2 }, // uncomment me and save
];
// --- A timestamp so you can see each restart happen
const time = new Date().toLocaleTimeString('en-GB');
console.log(`Ran at ${time}\n`);
// --- Format money nicely for the chosen currency
const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: CURRENCY });
// --- Print each line of the basket
let subtotal = 0;
for (const { item, price, qty } of basket) {
  const lineTotal = price * qty;
  subtotal += lineTotal;
  console.log(`${item.padEnd(14)} ${String(qty).padStart(3)} x ${money.format(price).padStart(10)} = ${money.format(lineTotal)}`);
}
// --- Totals
const tax = subtotal * TAX_RATE;
console.log('-'.repeat(48));
console.log(`Subtotal: ${money.format(subtotal)}`);
console.log(`Tax (${TAX_RATE * 100}%): ${money.format(tax)}`);
console.log(`Total: ${money.format(subtotal + tax)}`);
// --- A friendly check that fails loudly but keeps watch mode running
if (basket.length === 0) {
  console.error('\nThe basket is empty. Add an item and save.');
  process.exitCode = 1; // watch mode reports "Failed running" and keeps waiting
}
</code></pre>

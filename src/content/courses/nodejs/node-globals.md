---
publishDate: 2026-10-25T08:55
title: "Globals: process, __dirname and import.meta"
slug: node-globals
metadescription: Meet the things Node gives every script for free, the process object, __dirname in CommonJS and import.meta.dirname in ES modules, and when to use each.
updateDate: 2026-10-25T08:55
author: ['bishal-biswas']
level: 1
tags: ['basics', 'process', 'globals', 'modules']
course: nodejs
---

## What is a global?

A **global** is something you can use in any file without importing it first.

Think of a hotel room. You bring your own clothes (your imports), but the bed, the lights and the phone are already there when you walk in. Node's globals are the furniture that comes with every script.

You already know some of them from the browser: `console`, `setTimeout`, `fetch`, `URL` and `JSON` all work in Node with no import.

```javascript
// globals.mjs
console.log(typeof setTimeout); // prints: function
console.log(typeof fetch);      // prints: function
console.log(typeof URL);        // prints: function
```

This lesson covers the globals that are special to Node: `process`, `__dirname` and its ES module partner `import.meta`.

## globalThis

`globalThis` is the object that holds every global. It has the same name in Node and in the browser, so it is the safe way to refer to "the global object".

```javascript
console.log(typeof globalThis.setTimeout); // prints: function
console.log(globalThis === global);        // prints: true
```

Older Node code uses the name `global`. It is the same object. Prefer `globalThis` in new code.

> **Tip:** Avoid adding your own values to `globalThis`. Shared globals make code hard to follow. Export and import values instead.

## The process object

`process` describes the running program: how it was started, where it is running and how it should stop. It is the global you will use most.

### Facts about the program

```javascript
// info.mjs
console.log(process.version);       // e.g. v24.12.0
console.log(process.versions.v8);   // the V8 engine version
console.log(process.platform);      // 'win32', 'linux' or 'darwin' (macOS)
console.log(process.arch);          // e.g. 'x64' or 'arm64'
console.log(process.pid);           // the process ID the operating system gave it
```

`process.platform` is handy when something must behave differently on Windows.

### Command-line arguments: process.argv

`process.argv` is an array of everything typed on the command line.

```javascript
// greet.mjs
console.log(process.argv);
```

```bash
node greet.mjs Asha --loud
```

```text
[
  '/usr/local/bin/node',
  '/home/asha/projects/greet.mjs',
  'Asha',
  '--loud'
]
```

The first two items are always the path to `node` and the path to your script. Your own arguments start at index 2, so `process.argv.slice(2)` gives you just those. The next lesson shows a much nicer way to read them with `util.parseArgs`.

### Environment variables: process.env

`process.env` is an object holding the **environment variables**: settings given to your program by the shell or the operating system.

```javascript
console.log(process.env.HOME); // e.g. /home/asha (on Windows, try USERPROFILE)
```

There is a whole lesson on this next door: Environment Variables and --env-file.

### The current working directory: process.cwd()

`process.cwd()` returns the **current working directory**: the folder your terminal was in when you ran `node`.

```javascript
console.log(process.cwd()); // e.g. /home/asha/projects
```

Remember that this is the terminal's folder, not the folder your script lives in. That difference causes a classic bug, covered below.

### Stopping the program: exitCode and exit()

When a program finishes, it hands the operating system an **exit code**. `0` means success. Anything else means something went wrong. Scripts and CI tools read this number.

The gentle way is to set `process.exitCode`. Node finishes all the work still waiting, then exits with that code:

```javascript
// check.mjs
process.exitCode = 1;
console.log('Still running');
setTimeout(() => console.log('Timer finished'), 10);
```

```text
Still running
Timer finished
```

The program then exits with code `1`.

`process.exit()` stops immediately, even if work is still waiting:

```javascript
setTimeout(() => console.log('You will never see this'), 100);
process.exit(2); // stops right now with code 2
```

> **Tip:** Prefer `process.exitCode = 1` over `process.exit(1)`. An instant exit can cut off log messages or a file that was halfway through being written.

### Memory and uptime

```javascript
const mb = process.memoryUsage().rss / 1024 / 1024;
console.log(`Using about ${Math.round(mb)} MB`); // e.g. Using about 52 MB
console.log(process.uptime()); // seconds since the program started
```

## Where is my file? CommonJS: __dirname and __filename

Often you need the folder your script lives in, for example to load a `data.json` that sits next to it.

In **CommonJS** files (`.cjs`, or `.js` without `"type": "module"`), Node gives every module two variables:

```javascript
// report.cjs
console.log(__dirname);  // prints: /home/asha/projects/reports
console.log(__filename); // prints: /home/asha/projects/reports/report.cjs
```

- `__dirname` is the folder containing the current file.
- `__filename` is the full path to the current file.

Strictly speaking these are not true globals. Node quietly wraps each CommonJS module in a function and passes them in. That detail explains the next section.

## Where is my file? ES modules: import.meta

In an **ES module** (`.mjs`, or `.js` with `"type": "module"`), `__dirname` does not exist:

```javascript
// report.mjs
console.log(__dirname);
```

```text
ReferenceError: __dirname is not defined in ES module scope
```

Instead, every ES module gets `import.meta`, an object with information about the current module.

```javascript
// report.mjs
console.log(import.meta.dirname);  // prints: /home/asha/projects/reports
console.log(import.meta.filename); // prints: /home/asha/projects/reports/report.mjs
console.log(import.meta.url);      // prints: file:///home/asha/projects/reports/report.mjs
```

- `import.meta.dirname` is the same as `__dirname`.
- `import.meta.filename` is the same as `__filename`.
- `import.meta.url` is the module's address written as a `file:` URL.

`import.meta.dirname` and `import.meta.filename` arrived in Node 20.11, so they work in every supported Node version today, including Node 24.

### Building a path with import.meta.url

`import.meta.url` works nicely with the `URL` class. You can point at a file next to your script in one line:

```javascript
const dataUrl = new URL('data.json', import.meta.url);
console.log(dataUrl.href); // prints: file:///home/asha/projects/reports/data.json
```

Functions in `node:fs` accept a `URL` object as well as a plain path string.

### The older way you will see in tutorials

Before `import.meta.dirname` existed, people rebuilt `__dirname` by hand. You will meet this in older code:

```javascript
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

It still works. In new code, just use `import.meta.dirname`.

## Common mistakes

### Using a relative path that depends on the terminal

```javascript
// reports/report.mjs
import { readFile } from 'node:fs/promises';
const text = await readFile('data.json', 'utf8');
```

A relative path like `'data.json'` is looked up from `process.cwd()`. Run it from inside `reports/` and it works. Run `node reports/report.mjs` from the project folder and it fails with `ENOENT` (file not found).

Fix it by building the path from the script's own folder:

```javascript
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(import.meta.dirname, 'data.json');
const text = await readFile(file, 'utf8');
```

Now it works from any folder. You will learn `path.join` properly in the path module lesson.

### Mixing up cwd and dirname

```text
process.cwd()         where you ran the command from (changes)
import.meta.dirname   where the file lives (never changes)
```

Use `cwd()` for paths the user types, such as `node tool.mjs ./my-notes.txt`. Use `import.meta.dirname` for files that ship with your code.

## Quick recap

- Globals such as `console`, `setTimeout`, `fetch` and `process` work without an import. `globalThis` holds them all.
- `process.argv` holds command-line arguments. Yours start at index 2.
- `process.env` holds environment variables, and `process.cwd()` is the terminal's current folder.
- Set `process.exitCode = 1` to report failure. `process.exit()` stops instantly.
- CommonJS has `__dirname` and `__filename`. ES modules use `import.meta.dirname` and `import.meta.filename` instead.
- Build paths to your own files from `import.meta.dirname`, not from the current working directory.

<code id="code-content" class="language-javascript">
// globals-tour.mjs  (run with: node globals-tour.mjs Asha)
import path from 'node:path';
// --- Browser-style globals work with no import
console.log('setTimeout is a', typeof setTimeout);
console.log('globalThis === global:', globalThis === global);
// --- Facts about the running program
console.log('Node version:', process.version);
console.log('Platform:', process.platform, process.arch);
console.log('Process ID:', process.pid);
// --- Your own arguments start at index 2
const args = process.argv.slice(2);
const name = args[0] ?? 'friend';
console.log(`Hello, ${name}!`);
// --- Two different "where am I?" answers
console.log('Terminal folder (cwd):', process.cwd());
console.log('Script folder:', import.meta.dirname);
console.log('Script file:', import.meta.filename);
console.log('Script URL:', import.meta.url);
// --- Building paths to files that live next to this script
const dataPath = path.join(import.meta.dirname, 'data.json');
const dataUrl = new URL('data.json', import.meta.url);
console.log('Path version:', dataPath);
console.log('URL version:', dataUrl.href);
// --- __dirname only exists in CommonJS
console.log('__dirname available here?', typeof __dirname !== 'undefined');
// --- Memory and uptime
const mb = process.memoryUsage().rss / 1024 / 1024;
console.log(`Memory: about ${Math.round(mb)} MB, uptime ${process.uptime().toFixed(2)}s`);
// --- Report failure gently: Node still finishes pending work
if (args.length === 0) {
  console.log('Tip: pass a name, e.g. node globals-tour.mjs Asha');
  process.exitCode = 1;
}
setTimeout(() =&gt; console.log('Pending timer still ran. Exit code:', process.exitCode ?? 0), 50);
</code></pre>

---
publishDate: 2026-10-25T08:15
title: Your First Node.js Program
slug: your-first-nodejs-program
metadescription: Create a project folder, write and run your first Node.js script, pass it input, use a built-in module and learn to read error messages.
updateDate: 2026-10-25T08:15
author: ['bishal-biswas']
level: 1
tags: ['basics', 'hello-world', 'terminal']
course: nodejs
---

## What you are about to do

You will write a small JavaScript file, then ask Node to run it. That is all a Node program is: a text file of JavaScript plus the `node` command.

Think of it like leaving a note of instructions for a house-sitter. You write the note (your `.js` file), hand it over (`node hello.js`), and they follow it from top to bottom.

You need Node installed. If `node --version` does not print a version yet, go back to [Installing Node.js LTS and Version Managers](/courses/nodejs/installing-nodejs-and-version-managers).

## Step 1: make a project folder

Every Node project lives in its own folder. Open a terminal and run:

```bash
mkdir hello-node
cd hello-node
```

- `mkdir` (make directory) creates a folder called `hello-node`.
- `cd` (change directory) moves your terminal into it.

Every command you type now runs **inside** that folder. That matters, because Node looks for your file in the current folder.

> **Tip:** Use a code editor rather than Notepad or TextEdit. **VS Code** is free, works on every operating system, and understands JavaScript. Open the folder with File, Open Folder.

## Step 2: write the program

Create a file called `hello.js` inside `hello-node` with one line:

```javascript
// hello.js
console.log('Hello, Node!');
```

Save the file. Forgetting to save is the most common reason a beginner's change "does nothing".

## Step 3: run it

Back in the terminal, type:

```bash
node hello.js
```

```text
Hello, Node!
```

That is your first Node program. Here is what happened:

1. The `node` command started.
2. It read `hello.js` from the current folder.
3. It ran the code from top to bottom, printing the message to the terminal.
4. With nothing left to do, it exited and gave you your prompt back.

> **Note:** You can leave off the `.js` ending: `node hello` also works, because Node tries adding `.js` for you. Writing the full name is clearer, so this course always does.

## Doing a little more

A Node file can hold any JavaScript you already know. Replace the contents of `hello.js` with this:

```javascript
// hello.js
const books = ['Dune', 'Emma', 'Beloved'];

function describe(list) {
  return `You have ${list.length} books. The first is ${list[0]}.`;
}

console.log(describe(books));
console.log('Upper case:', books.map((title) => title.toUpperCase()));
```

```bash
node hello.js
```

```text
You have 3 books. The first is Dune.
Upper case: [ 'DUNE', 'EMMA', 'BELOVED' ]
```

Notice how Node prints arrays with spaces inside the brackets. That is just Node's display style.

## Giving your program input

Programs are more useful when they can take input. When you run a command, any extra words after the file name are passed to your program. They are called **command-line arguments**.

Node puts them in an array called `process.argv`. The first two items are the path to `node` and the path to your file, so your own words start at index 2.

```javascript
// greet.js
const name = process.argv[2] ?? 'friend'; // ?? means "use 'friend' if nothing was given"
console.log(`Hello, ${name}!`);
```

```bash
node greet.js
node greet.js Ravi
```

```text
Hello, friend!
Hello, Ravi!
```

You will learn a much better way to handle arguments in [Command-line Arguments with util.parseArgs](/courses/nodejs/parsing-command-line-arguments).

## Using a built-in module

Node comes with **built-in modules**: ready-made toolboxes for files, the operating system, networking and more. You load one with `import`.

Create `about-me.mjs`:

```javascript
// about-me.mjs
import os from 'node:os';

console.log('Your username is', os.userInfo().username);
console.log('Your computer has', os.cpus().length, 'CPU cores');
```

```bash
node about-me.mjs
```

```text
Your username is asha
Your computer has 8 CPU cores
```

Two new things here:

- The **`node:`** prefix says "this is a built-in module, not something downloaded".
- The file ends in **`.mjs`**, not `.js`. The `m` stands for module. It tells Node this file uses the modern `import` syntax. You will learn the full story, and how to use `import` in `.js` files, in [CommonJS vs ES Modules](/courses/nodejs/commonjs-vs-es-modules).

## Writing a file

Now for something a web page could never do. This script creates a real file on your disk:

```javascript
// save-note.mjs
import { writeFile, readFile } from 'node:fs/promises';

await writeFile('note.txt', 'Buy milk and bread');
const text = await readFile('note.txt', 'utf8');

console.log('Saved and read back:', text);
```

```bash
node save-note.mjs
```

```text
Saved and read back: Buy milk and bread
```

Look in your `hello-node` folder: there is now a `note.txt` file. `await` waits for the slow disk work to finish before moving on. In `.mjs` files you can use `await` at the top level, outside any function. [Reading and Writing Files with fs/promises](/courses/nodejs/file-system-basics) covers files properly.

## Reading an error message

Mistakes are normal. What matters is reading the message Node gives you. Create `oops.js` with a deliberate typo:

```javascript
// oops.js
const name = 'Asha';
consol.log('Hello', name);
```

```bash
node oops.js
```

```text
/Users/asha/hello-node/oops.js:3
consol.log('Hello', name);
^

ReferenceError: consol is not defined
    at Object.<anonymous> (/Users/asha/hello-node/oops.js:3:1)
    ...more "at" lines...

Node.js v24.12.0
```

Read it from the top:

- **`oops.js:3`**: the file and the line number where things went wrong.
- The line of code itself, with a `^` pointing at the problem.
- **`ReferenceError: consol is not defined`**: the type of error and a plain description. `consol` should be `console`.
- The `at ...` lines are the **stack trace**, the trail of function calls that led here. For small scripts, the first one is usually all you need.

Fix the typo, save, and run it again.

## Stopping a program

Most scripts end on their own. Some, like a web server, keep running until you stop them. To stop any running program, press **Ctrl + C** in the terminal. This works on Windows, macOS and Linux.

## Common mistakes

### Running from the wrong folder

```bash
node hello.js
```

```text
Error: Cannot find module '/Users/asha/hello.js'
```

Node looked for `hello.js` in the current folder and did not find it. Check the path in the message, then `cd` into the right folder.

### Typing JavaScript straight into the terminal

```bash
console.log('hi')
```

The terminal speaks its own command language, not JavaScript, so this fails with a syntax error. Put the code in a file and run `node file.js`, or start the REPL, which is the next lesson.

### Running `node` with no file name

Typing just `node` does not run anything. It opens an interactive prompt that looks like `>`. Press Ctrl + C twice (or Ctrl + D) to leave it. [The REPL and Running Scripts](/courses/nodejs/repl-and-running-scripts) explains what this prompt is for.

## Quick recap

- A Node program is a JavaScript file you run with `node file.js`.
- Run commands from inside your project folder, or Node will not find the file.
- `console.log` prints to the terminal.
- `process.argv` holds command-line arguments, starting at index 2.
- Built-in modules are imported with the `node:` prefix, such as `node:os` and `node:fs/promises`.
- `.mjs` files use `import` and allow top-level `await`.
- Error messages tell you the file, the line and what went wrong. Read them from the top.
- Ctrl + C stops a running program.

<code id="code-content" class="language-javascript">
// first-program.mjs: run with "node first-program.mjs Asha"
import os from 'node:os';
import { writeFile, readFile } from 'node:fs/promises';
// --- 1. Plain JavaScript runs top to bottom
const books = ['Dune', 'Emma', 'Beloved'];
console.log(`You have ${books.length} books:`, books.join(', '));
// --- 2. Input from the command line (index 2 onwards is yours)
const name = process.argv[2] ?? 'friend';
const hour = new Date().getHours();
const greeting = hour &lt; 12 ? 'Good morning' : hour &lt; 18 ? 'Good afternoon' : 'Good evening';
console.log(`${greeting}, ${name}!`);
// --- 3. A built-in module tells us about the computer
console.log('Running on', os.platform(), 'with', os.cpus().length, 'CPU cores');
// --- 4. Write a real file, then read it back
const file = 'reading-list.txt';
await writeFile(file, books.map((title, i) =&gt; `${i + 1}. ${title}`).join('\n'));
console.log(`\nContents of ${file}:`);
console.log(await readFile(file, 'utf8'));
// --- 5. Errors tell you what went wrong and where
try {
  consol.log('typo!'); // deliberate mistake
} catch (error) {
  console.log(`\nCaught a ${error.name}: ${error.message}`);
}
console.log('Done. Node exits now because nothing is left to do.');
</code></pre>

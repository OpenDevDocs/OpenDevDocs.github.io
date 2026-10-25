---
publishDate: 2026-10-25T08:20
title: The REPL and Running Scripts
slug: repl-and-running-scripts
metadescription: Use the Node.js REPL to try code instantly, learn its dot commands and shortcuts, and run scripts with node, -e, -p, --check and --watch.
updateDate: 2026-10-25T08:20
author: ['bishal-biswas']
level: 1
tags: ['repl', 'cli', 'basics']
course: nodejs
---

## What is the REPL?

The **REPL** is an interactive prompt where you type JavaScript and see the result straight away. The name describes what it does, over and over:

- **Read** the line you type.
- **Evaluate** (run) it.
- **Print** the result.
- **Loop** back and wait for the next line.

It is like a calculator for JavaScript. You do not write a file or save anything. You just ask a question and get an answer. It is perfect for checking how a function behaves before you use it in a real script.

## Starting and leaving the REPL

Type `node` on its own and press Enter:

```bash
node
```

```text
Welcome to Node.js v24.12.0.
Type ".help" for more information.
>
```

The `>` is the prompt. It means Node is waiting for you.

To leave, use any one of these:

- Type `.exit` and press Enter.
- Press **Ctrl + D**.
- Press **Ctrl + C** twice. The first press clears the current line and reminds you how to exit.

## Trying things out

Type an expression and press Enter. The REPL prints its value:

```text
> 2 + 3
5
> 'asha'.toUpperCase()
'ASHA'
> [1, 2, 3].map(n => n * 2)
[ 2, 4, 6 ]
> Math.max(4, 9, 2)
9
```

You never needed `console.log`. The REPL prints every result automatically.

### Why does it print `undefined`?

Some lines do not produce a value. Declaring a variable is one of them, so the REPL prints `undefined`:

```text
> const name = 'Ravi'
undefined
> `Hello, ${name}`
'Hello, Ravi'
```

`console.log` also returns nothing. You see the logged text, then `undefined` as the return value:

```text
> console.log('hi')
hi
undefined
```

This is normal, not an error.

### Multi-line code

If a line is unfinished, such as a function with an open `{`, the REPL waits for more. The prompt changes to `|` until the code is complete:

```text
> function add(a, b) {
| return a + b
| }
undefined
> add(2, 3)
5
```

## Handy REPL features

### The last result: `_`

The underscore holds the result of the previous line:

```text
> 19.99 * 3
59.97
> _ + 4.99
64.96
```

Likewise, `_error` holds the last error that was thrown.

### History and completion

- Press the **Up** and **Down** arrows to scroll through lines you typed before, even from earlier sessions.
- Press **Tab** to complete names. Type `Math.` and press Tab twice to see everything on `Math`.

### Built-in modules are already loaded

In the REPL, Node's built-in modules are available by name without importing them:

```text
> os.platform()
'linux'
> path.join('notes', 'todo.txt')
'notes/todo.txt'
```

This only works in the REPL. In a script file you must import them.

### Top-level await

You can use `await` directly at the prompt:

```text
> await new Promise(resolve => setTimeout(() => resolve('done'), 500))
'done'
```

## Dot commands

Lines that start with a dot are commands for the REPL itself, not JavaScript. Type `.help` to see them all:

| Command | What it does |
| --- | --- |
| `.help` | List all dot commands |
| `.editor` | Open editor mode for pasting or typing several lines. Press Ctrl + D to run, Ctrl + C to cancel |
| `.break` | Escape from an unfinished multi-line input (`.clear` does the same) |
| `.save file.js` | Save everything you typed this session to a file |
| `.load file.js` | Run a file's code inside the current session |
| `.exit` | Leave the REPL |

`.save` is a nice way to turn an experiment into a starting script.

## Running scripts

The REPL is for quick experiments. Real programs live in files, and you run them by passing the file name to `node`:

```bash
node app.js
```

Anything after the file name is passed to your program in `process.argv`, as you saw in [Your First Node.js Program](/courses/nodejs/your-first-nodejs-program):

```bash
node app.js Asha --verbose
```

### Running a one-liner with `-e`

`-e` (short for `--eval`) runs a snippet of code without creating a file:

```bash
node -e "console.log('Hi from -e')"
```

```text
Hi from -e
```

### Printing a value with `-p`

`-p` (short for `--print`) runs an expression and prints the result, like the REPL does:

```bash
node -p "2 + 3"
node -p "process.versions.v8"
```

```text
5
13.6.233.17-node.37
```

> **Tip:** Wrap the code in double quotes and use single quotes inside it. That works in Bash, Zsh, PowerShell and the Windows Command Prompt.

### Checking syntax with `--check`

`--check` (or `-c`) reads a file and reports syntax errors **without running it**. Useful before running a script that changes files:

```bash
node --check app.js
```

If the file is fine, it prints nothing. If not, it shows where the problem is:

```text
app.js:1
console.log("x"
            ^^^

SyntaxError: missing ) after argument list
```

### Re-running on every save with `--watch`

`--watch` runs your script and restarts it every time you save the file:

```bash
node --watch app.js
```

Press Ctrl + C to stop watching. [Watch Mode with node --watch](/courses/nodejs/watch-mode) covers it in depth.

### Where options go

`node --version` (or `-v`) prints the version and `node --help` (or `-h`) lists every option. Options for Node itself go **before** the file name. Arguments for your program go **after** it:

```bash
node --watch app.js --verbose
#    ^ for Node   ^ for app.js
```

## Common mistakes

### Typing a terminal command inside the REPL

```text
> node app.js
Uncaught SyntaxError: Unexpected identifier 'app'
```

The REPL only understands JavaScript. Leave with `.exit` first, then run `node app.js` from your normal terminal prompt.

### Declaring the same `const` twice

```text
> const total = 10
undefined
> const total = 20
Uncaught SyntaxError: Identifier 'total' has already been declared
```

The REPL remembers every variable for the whole session, just like one long script. Pick a new name, use `let` and reassign it (`total = 20`), or restart the REPL.

## Quick recap

- The **REPL** (Read, Evaluate, Print, Loop) starts when you run `node` with no file.
- It prints each result automatically. `undefined` just means "no value".
- `_` is the last result, Up arrow is history, Tab completes names.
- Dot commands like `.help`, `.editor`, `.save` and `.exit` control the REPL.
- Leave with `.exit`, Ctrl + D or Ctrl + C twice.
- Run files with `node file.js`; use `-e` to run code, `-p` to print a value, `--check` for syntax and `--watch` to restart on save.
- Node options go before the file name, your program's arguments go after it.

<code id="code-content" class="language-javascript">
// my-repl.mjs: run "node my-repl.mjs" to inspect, or "node my-repl.mjs --repl" for a custom REPL
import repl from 'node:repl';
// --- How was this script started?
console.log('Node binary:      ', process.execPath);
console.log('Script file:      ', process.argv[1]);
console.log('Your arguments:   ', process.argv.slice(2));
console.log('Options for Node: ', process.execArgv); // e.g. [ '--watch' ]
// --- Some sample data to explore
const books = [
  { title: 'Dune', pages: 412 },
  { title: 'Emma', pages: 474 },
  { title: 'Beloved', pages: 324 },
];
if (!process.argv.includes('--repl')) {
  console.log('\nTip: add --repl to explore the books array interactively.');
} else {
  console.log('\nTry: books.length, books.map(b =&gt; b.title), .longest, .help, .exit');
  // Start our own REPL with a custom prompt
  const session = repl.start({ prompt: 'books&gt; ' });
  // Anything on context becomes a variable inside the REPL
  session.context.books = books;
  // A custom dot command: type .longest
  session.defineCommand('longest', {
    help: 'Show the book with the most pages',
    action() {
      const longest = books.reduce((a, b) =&gt; (b.pages &gt; a.pages ? b : a));
      console.log(`${longest.title} (${longest.pages} pages)`);
      this.displayPrompt();
    },
  });
}
</code></pre>

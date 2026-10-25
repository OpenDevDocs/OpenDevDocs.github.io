---
publishDate: 2026-10-25T09:35
title: "Beginner Project: A Command-line To-Do App"
slug: beginner-project-cli-todo-app
metadescription: Build a working to-do app for the terminal, step by step, using util.parseArgs, fs/promises, a JSON file for storage, the path module and exit codes.
updateDate: 2026-10-25T09:35
author: ['bishal-biswas']
level: 1
tags: ['project', 'cli', 'fs', 'json']
course: nodejs
---

## What you will build

Time to put the last few lessons together. You will build a to-do app that runs in the terminal, like a sticky note on the fridge that lives in your command line.

When it is finished, it will work like this:

```bash
node todo.mjs add Buy milk
node todo.mjs add "Call Ravi about the trip"
node todo.mjs list
node todo.mjs done 2
node todo.mjs remove 1
```

```text
  1. [ ] Buy milk
  2. [x] Call Ravi about the trip
  3. [ ] Water the plants

2 of 3 left to do
```

Your to-dos are saved in a file, so they are still there tomorrow.

Along the way you will use:

- **`util.parseArgs`** to read commands and options
- **`fs/promises`** to read and write a file
- **JSON** to turn your list into text and back
- the **`path`** module and `import.meta.dirname` to find the file
- **`process.exitCode`** to report errors properly

## Step 1: Plan before you code

A few minutes of planning saves a lot of confusion. Decide two things: the commands, and the shape of the data.

### The commands

```text
add <text>     add a new to-do
list           show the to-dos (add --pending to hide finished ones)
done <id>      mark a to-do as finished
remove <id>    delete a to-do
clear          delete all finished to-dos
--help         show instructions
```

The first word after the script name is the **command**. Anything after it is the command's input.

### The data

Each to-do is an object. The whole list is an array, saved as JSON in a file called `todos.json`:

```json
[
  {
    "id": 1,
    "text": "Buy milk",
    "done": false,
    "createdAt": "2026-10-25T09:35:00.000Z"
  }
]
```

The `id` is a number that never changes, so you can type `done 1` even after other to-dos are removed.

## Step 2: Set up the project

Make a folder and an empty file:

```bash
mkdir todo-app
cd todo-app
```

Create `todo.mjs` in that folder. The `.mjs` extension tells Node this is an ES module, so you can use `import` and top-level `await` without a `package.json`.

## Step 3: Read the command

Start with the input. This uses `parseArgs` from the Command-line Arguments lesson:

```javascript
// todo.mjs
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h' },
    pending: { type: 'boolean' },
  },
  allowPositionals: true, // allow plain words like "add" and "Buy milk"
});

const [command, ...rest] = positionals;
console.log({ command, rest, values });
```

Try it:

```bash
node todo.mjs add Buy milk --pending
```

```text
{
  command: 'add',
  rest: [ 'Buy', 'milk' ],
  values: [Object: null prototype] { pending: true }
}
```

Array destructuring splits the positionals neatly: the first word goes into `command`, the rest into `rest`. Later, `rest.join(' ')` turns `['Buy', 'milk']` back into `'Buy milk'`, so users do not even need quotes.

## Step 4: Load and save the list

Next, two functions for storage. They use `fs/promises` and JSON, exactly as in the Reading and Writing Files lesson.

First decide where the file lives. Building the path from `import.meta.dirname` means the app finds its file no matter which folder you run it from:

```javascript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = process.env.TODO_FILE
  ? path.resolve(process.env.TODO_FILE)
  : path.join(import.meta.dirname, 'todos.json');
```

As a bonus, the `TODO_FILE` environment variable lets you keep a separate list, for example `TODO_FILE=work.json node todo.mjs list`.

Now loading. On the very first run there is no file yet, so a missing file (`ENOENT`) simply means "an empty list":

```javascript
async function loadTodos() {
  let text;
  try {
    text = await readFile(DATA_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return []; // first run: no file yet
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${DATA_FILE} is not valid JSON. Fix or delete it.`);
  }
}
```

The second `try` catches a damaged file and replaces a confusing `SyntaxError` with a clear message.

Saving turns the array into nicely indented JSON. The `mkdir` line makes sure the folder exists, which matters if `TODO_FILE` points into a new folder:

```javascript
async function saveTodos(todos) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(todos, null, 2) + '\n');
}
```

## Step 5: Add and list

To add a to-do, it needs a new id. Take the biggest id so far and add one:

```javascript
function nextId(todos) {
  if (todos.length === 0) return 1;
  return Math.max(...todos.map((todo) => todo.id)) + 1;
}
```

Why not `todos.length + 1`? Because after you remove a to-do, the length shrinks and you could hand out an id that is already in use.

Listing prints a checkbox for each to-do, then a short summary:

```javascript
function printTodos(todos, onlyPending) {
  const shown = onlyPending ? todos.filter((todo) => !todo.done) : todos;
  if (shown.length === 0) {
    console.log('Nothing to do. Enjoy your day!');
    return;
  }
  for (const todo of shown) {
    const box = todo.done ? '[x]' : '[ ]';
    console.log(`${String(todo.id).padStart(3)}. ${box} ${todo.text}`);
  }
  const left = todos.filter((todo) => !todo.done).length;
  console.log(`\n${left} of ${todos.length} left to do`);
}
```

`padStart(3)` lines the numbers up neatly, even when you reach to-do number 10.

## Step 6: Done, remove and clear

`done` and `remove` both need to find a to-do by its id. The id arrives as a string, so convert it with `Number`, as you learned with `parseArgs`:

```javascript
function findTodo(todos, idText) {
  if (idText === undefined) {
    throw new Error('Please give an id, for example: node todo.mjs done 2');
  }
  const id = Number(idText);
  const todo = todos.find((t) => t.id === id);
  if (!todo) {
    throw new Error(`No to-do with id "${idText}". Run "node todo.mjs list" to see the ids.`);
  }
  return todo;
}
```

If someone types `done abc`, `Number('abc')` is `NaN`, which matches no id, so they get the friendly "No to-do" message.

Then each command is only a few lines:

```javascript
// done: flip the flag
todo.done = true;

// remove: cut it out of the array
todos.splice(todos.indexOf(todo), 1);

// clear: keep only the unfinished ones
const remaining = todos.filter((todo) => !todo.done);
```

After any change, call `saveTodos` so the file matches what is in memory.

## Step 7: Errors and exit codes

Notice that the helper functions **throw** errors instead of printing them. That keeps all the error handling in one place, at the very bottom of the file:

```javascript
try {
  await main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
```

Three good habits from earlier lessons meet here:

- `console.error` sends the message to **stderr**, not normal output.
- `process.exitCode = 1` tells the shell the command failed, so scripts that run your app can notice.
- Errors from `parseArgs`, such as an unknown option, land in the same `catch`, so users never see a scary stack trace.

## The complete code

Here is everything put together. The `main` function reads the command and uses a `switch` to run the right piece.

```javascript
// todo.mjs: a command-line to-do app
import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Where the to-dos are saved. Set TODO_FILE to use a different file.
const DATA_FILE = process.env.TODO_FILE
  ? path.resolve(process.env.TODO_FILE)
  : path.join(import.meta.dirname, 'todos.json');

const HELP = `Usage: node todo.mjs <command> [options]

Commands:
  add <text>     Add a new to-do
  list           Show your to-dos
  done <id>      Mark a to-do as finished
  remove <id>    Delete a to-do
  clear          Delete all finished to-dos

Options:
  --pending      With list: show only unfinished to-dos
  -h, --help     Show this help`;

// ---------- Storage ----------

async function loadTodos() {
  let text;
  try {
    text = await readFile(DATA_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return []; // first run: no file yet
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${DATA_FILE} is not valid JSON. Fix or delete it.`);
  }
}

async function saveTodos(todos) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(todos, null, 2) + '\n');
}

// ---------- Helpers ----------

function nextId(todos) {
  if (todos.length === 0) return 1;
  return Math.max(...todos.map((todo) => todo.id)) + 1;
}

function findTodo(todos, idText) {
  if (idText === undefined) {
    throw new Error('Please give an id, for example: node todo.mjs done 2');
  }
  const id = Number(idText);
  const todo = todos.find((t) => t.id === id);
  if (!todo) {
    throw new Error(`No to-do with id "${idText}". Run "node todo.mjs list" to see the ids.`);
  }
  return todo;
}

function printTodos(todos, onlyPending) {
  const shown = onlyPending ? todos.filter((todo) => !todo.done) : todos;
  if (shown.length === 0) {
    console.log('Nothing to do. Enjoy your day!');
    return;
  }
  for (const todo of shown) {
    const box = todo.done ? '[x]' : '[ ]';
    console.log(`${String(todo.id).padStart(3)}. ${box} ${todo.text}`);
  }
  const left = todos.filter((todo) => !todo.done).length;
  console.log(`\n${left} of ${todos.length} left to do`);
}

// ---------- Commands ----------

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', short: 'h' },
      pending: { type: 'boolean' },
    },
    allowPositionals: true,
  });

  const [command, ...rest] = positionals;

  if (values.help || command === undefined) {
    console.log(HELP);
    return;
  }

  const todos = await loadTodos();

  switch (command) {
    case 'add': {
      const text = rest.join(' ').trim();
      if (text === '') {
        throw new Error('Please describe the to-do, for example: node todo.mjs add "Buy milk"');
      }
      const todo = { id: nextId(todos), text, done: false, createdAt: new Date().toISOString() };
      todos.push(todo);
      await saveTodos(todos);
      console.log(`Added #${todo.id}: ${todo.text}`);
      break;
    }
    case 'list': {
      printTodos(todos, values.pending);
      break;
    }
    case 'done': {
      const todo = findTodo(todos, rest[0]);
      todo.done = true;
      await saveTodos(todos);
      console.log(`Nice work! Finished #${todo.id}: ${todo.text}`);
      break;
    }
    case 'remove': {
      const todo = findTodo(todos, rest[0]);
      todos.splice(todos.indexOf(todo), 1);
      await saveTodos(todos);
      console.log(`Removed #${todo.id}: ${todo.text}`);
      break;
    }
    case 'clear': {
      const remaining = todos.filter((todo) => !todo.done);
      await saveTodos(remaining);
      console.log(`Cleared ${todos.length - remaining.length} finished to-do(s)`);
      break;
    }
    default:
      throw new Error(`Unknown command "${command}". Run "node todo.mjs --help" to see the commands.`);
  }
}

// ---------- Start ----------

try {
  await main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
```

## Step 8: Try it out

Here is a real session with the finished app:

```bash
node todo.mjs add Buy milk
node todo.mjs add Call Ravi about the trip
node todo.mjs add "Water the plants"
node todo.mjs done 2
node todo.mjs list
```

```text
Added #1: Buy milk
Added #2: Call Ravi about the trip
Added #3: Water the plants
Nice work! Finished #2: Call Ravi about the trip
  1. [ ] Buy milk
  2. [x] Call Ravi about the trip
  3. [ ] Water the plants

2 of 3 left to do
```

Now test the unhappy paths too. A good program fails politely:

```bash
node todo.mjs done 42
node todo.mjs fly
```

```text
Error: No to-do with id "42". Run "node todo.mjs list" to see the ids.
Error: Unknown command "fly". Run "node todo.mjs --help" to see the commands.
```

Both exit with code `1`. On macOS or Linux you can check with `echo $?` straight after the command.

Open `todos.json` in your editor. It is plain, readable JSON, and you could even edit it by hand.

> **Tip:** To add a to-do that starts with a dash, put `--` first: `node todo.mjs add -- "-5 kg by summer"`. As you saw in the parseArgs lesson, everything after `--` is treated as plain text.

## Ideas to take it further

Try these on your own. Each one uses something you already know:

- Add an `edit <id> <text>` command that changes a to-do's text.
- Add a `--priority high` option to `add`, and show high-priority items first in `list`.
- Show how long ago each to-do was created, using the `createdAt` date.
- Add an `undo <id>` command that sets `done` back to `false`.
- Run `node --watch todo.mjs list` in a second terminal while you work, to see your edits to the code take effect straight away.

Later in the course, the Built-in Test Runner lesson shows how to write automated tests for code like this, and the Building and Publishing CLI Tools lesson shows how to turn it into a real `todo` command you can run from anywhere.

## Quick recap

- Plan the commands and the data shape first. It makes the code much easier to write.
- `parseArgs` with `allowPositionals` splits input into a command and its words.
- Build the data file path from `import.meta.dirname` so the app works from any folder.
- Treat `ENOENT` as an empty list, and save with `JSON.stringify(todos, null, 2)`.
- Use the biggest id plus one, never the array length, for new ids.
- Throw errors in helpers and handle them in one place with `console.error` and `process.exitCode = 1`.

<code id="code-content" class="language-javascript">
// todo.mjs (compact version). Try: node todo.mjs add Buy milk | list | list --pending | done 1 | remove 1 | clear
import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
// Saved next to this script, unless TODO_FILE points somewhere else
const DATA_FILE = process.env.TODO_FILE ? path.resolve(process.env.TODO_FILE) : path.join(import.meta.dirname, 'todos.json');
const HELP = 'Usage: node todo.mjs add &lt;text&gt; | list [--pending] | done &lt;id&gt; | remove &lt;id&gt; | clear';
async function loadTodos() {
  try {
    return JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return []; // first run: no file yet
    throw error;
  }
}
async function saveTodos(todos) {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(todos, null, 2) + '\n');
}
function findTodo(todos, idText) {
  const todo = todos.find((t) =&gt; t.id === Number(idText));
  if (!todo) throw new Error(`No to-do with id "${idText}". Run "node todo.mjs list".`);
  return todo;
}
async function main() {
  const { values, positionals } = parseArgs({
    options: { help: { type: 'boolean', short: 'h' }, pending: { type: 'boolean' } },
    allowPositionals: true,
  });
  const [command, ...rest] = positionals;
  if (values.help || !command) return console.log(HELP);
  const todos = await loadTodos();
  if (command === 'add') {
    const text = rest.join(' ').trim();
    if (!text) throw new Error('Please describe the to-do, e.g. node todo.mjs add "Buy milk"');
    const id = todos.length ? Math.max(...todos.map((t) =&gt; t.id)) + 1 : 1;
    todos.push({ id, text, done: false, createdAt: new Date().toISOString() });
    await saveTodos(todos);
    console.log(`Added #${id}: ${text}`);
  } else if (command === 'list') {
    const shown = values.pending ? todos.filter((t) =&gt; !t.done) : todos;
    if (shown.length === 0) return console.log('Nothing to do. Enjoy your day!');
    for (const t of shown) console.log(`${String(t.id).padStart(3)}. [${t.done ? 'x' : ' '}] ${t.text}`);
  } else if (command === 'done' || command === 'remove') {
    const todo = findTodo(todos, rest[0]);
    if (command === 'done') todo.done = true; else todos.splice(todos.indexOf(todo), 1);
    await saveTodos(todos);
    console.log(`${command === 'done' ? 'Finished' : 'Removed'} #${todo.id}: ${todo.text}`);
  } else if (command === 'clear') {
    const remaining = todos.filter((t) =&gt; !t.done);
    await saveTodos(remaining);
    console.log(`Cleared ${todos.length - remaining.length} finished to-do(s)`);
  } else {
    throw new Error(`Unknown command "${command}". ${HELP}`);
  }
}
try { await main(); } catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1; // tell the shell something went wrong
}
</code></pre>

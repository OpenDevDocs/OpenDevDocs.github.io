---
publishDate: 2026-10-25T09:45
title: Callbacks, Promises and async/await
slug: callbacks-promises-async-await
metadescription: The three ways to write asynchronous code in Node.js. Error-first callbacks, promises, util.promisify, async/await and running work in parallel.
updateDate: 2026-10-25T09:45
author: ['bishal-biswas']
level: 2
tags: ['async', 'promises', 'callbacks']
course: nodejs
---

## Three ways to say "tell me when it is done"

Imagine you order a parcel. There are three ways to find out when it arrives:

- You give the courier your phone number and they **call you back** (a callback).
- You get a **tracking number** you can check or attach plans to (a promise).
- You simply **wait at the door** and carry on once it lands, while the rest of the house goes about its day (async/await).

Node has all three styles because it grew over many years. Older APIs use callbacks. Modern APIs return promises. Most new code uses `async`/`await` on top of promises.

You need to read all three, because you will meet all three in real projects.

## Style 1: callbacks

A **callback** is a function you pass to another function, so it can call you back when the work is done.

Node's callbacks follow one rule, called **error-first**: the first argument is an error (or `null` if all went well), and the result comes after it.

```javascript
// callback.mjs
import { readFile } from 'node:fs';

readFile('notes.txt', 'utf8', (err, text) => {
  if (err) {
    console.error('Could not read the file:', err.code);
    return;
  }
  console.log('Notes:', text);
});
```

If `notes.txt` contains `Buy milk`, this prints:

```text
Notes: Buy milk
```

If the file does not exist, you get:

```text
Could not read the file: ENOENT
```

> **Note:** Always check `err` first and `return` early. If you forget the `return`, the code below runs too, with `text` set to `undefined`.

### Callback hell

Callbacks get messy when one step depends on the one before. Here we read a config file, then the file it names, then write a new file:

```javascript
// callback-hell.mjs
import { readFile, writeFile } from 'node:fs';

readFile('config.json', 'utf8', (err, json) => {
  if (err) return console.error(err.message);
  const config = JSON.parse(json);
  readFile(config.input, 'utf8', (err, text) => {
    if (err) return console.error(err.message);
    writeFile('notes-upper.txt', text.toUpperCase(), (err) => {
      if (err) return console.error(err.message);
      console.log('Done!');
    });
  });
});
```

Each step pushes the code further right. Every level needs its own error check. This shape is called **callback hell** or the "pyramid of doom". Promises were invented to fix it.

## Style 2: promises

A **promise** is an object that stands for a result you do not have yet. It starts **pending**, then becomes either **fulfilled** (with a value) or **rejected** (with an error). You attach `.then()` for success and `.catch()` for failure.

Node has promise versions of most of its modules. For files, import from `node:fs/promises`:

```javascript
// promise.mjs
import { readFile } from 'node:fs/promises';

readFile('notes.txt', 'utf8')
  .then((text) => console.log('Notes:', text))
  .catch((err) => console.error('Could not read the file:', err.code));
```

The output is the same as before. If you want a full refresher on promise states and chaining, see the Promises lesson in the JavaScript course.

### Promise versions of core modules

These modules give you promise-based functions directly:

| Module | What it does |
| --- | --- |
| `node:fs/promises` | Read and write files |
| `node:timers/promises` | `setTimeout` and friends that return promises |
| `node:dns/promises` | Look up domain names |
| `node:stream/promises` | `pipeline` and `finished` for streams |
| `node:readline/promises` | Ask questions in the terminal |

Prefer these whenever they exist.

## Turning a callback function into a promise

Sometimes you have a callback-style function, maybe from an older library. You have two ways to make it return a promise.

### util.promisify

`util.promisify` takes any function that uses an error-first callback as its **last** argument, and gives you back a function that returns a promise.

```javascript
// promisify.mjs
import { promisify } from 'node:util';

// An old-style function with an error-first callback
function findBook(id, callback) {
  setTimeout(() => {
    if (id === 1) callback(null, { id: 1, title: 'Clean Code' });
    else callback(new Error(`No book with id ${id}`));
  }, 100);
}

const findBookAsync = promisify(findBook);

const book = await findBookAsync(1);
console.log(book.title); // prints: Clean Code

try {
  await findBookAsync(2);
} catch (err) {
  console.log('Error:', err.message); // prints: Error: No book with id 2
}
```

### Wrapping by hand with new Promise

If the callback does not follow the error-first rule, wrap it yourself:

```javascript
// wrap.mjs
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

await wait(500);
console.log('Half a second later');
```

You call `resolve(value)` when it works and `reject(error)` when it fails.

> **Tip:** For a simple delay you do not need to write `wait` at all. `node:timers/promises` already has it: `import { setTimeout as sleep } from 'node:timers/promises'`.

## Style 3: async/await

`async` and `await` are a nicer way to write promise code. It looks like normal top-to-bottom code.

- Put `async` in front of a function. It now **always returns a promise**.
- Inside it, put `await` in front of a promise. The function **pauses** until the promise settles, then gives you the value.

Here is the callback hell example again:

```javascript
// async-await.mjs
import { readFile, writeFile } from 'node:fs/promises';

try {
  const config = JSON.parse(await readFile('config.json', 'utf8'));
  const text = await readFile(config.input, 'utf8');
  await writeFile('notes-upper.txt', text.toUpperCase());
  console.log('Done!');
} catch (err) {
  console.error('Something failed:', err.message);
}
```

Flat, readable, and one `try`/`catch` covers every step.

### await pauses the function, not Node

While one function waits, the event loop keeps running other callbacks, timers and requests. Only the code **after** the `await` in that function waits. This is why `await` does not block a server.

### Top-level await

In an ES module (a `.mjs` file, or `.js` with `"type": "module"`), you can use `await` at the top level, outside any function. All the examples above do this.

In a CommonJS file it is a syntax error:

```text
SyntaxError: await is only valid in async functions and the top level bodies of modules
```

In CommonJS, wrap your code in an `async function main() { ... }` and call it.

## One after another, or all at once?

Two `await`s in a row run **one after another**. If the jobs do not depend on each other, that wastes time.

```javascript
// parallel.mjs
import { setTimeout as sleep } from 'node:timers/promises';

async function getUser(id) {
  await sleep(500); // pretend this is a slow database call
  return { id, name: 'User ' + id };
}

console.time('one by one');
const a = await getUser(1);
const b = await getUser(2);
console.timeEnd('one by one');

console.time('together');
const [c, d] = await Promise.all([getUser(1), getUser(2)]);
console.timeEnd('together');
```

```text
one by one: 1.010s
together: 512.441ms
```

`Promise.all` starts both jobs at once and waits for both. You will learn more tools like this in [the Promise Combinators lesson](/courses/nodejs/promise-combinators-and-abortsignal).

## Common mistakes

### Forgetting await

```javascript
// Wrong
import { readFile } from 'node:fs/promises';

const text = readFile('notes.txt', 'utf8');
console.log(text); // prints: Promise { <pending> }
```

Without `await` you get the promise, not the text. Add `await`:

```javascript
// Right
const text = await readFile('notes.txt', 'utf8');
console.log(text); // prints: Buy milk
```

### Using await inside forEach

```javascript
// Wrong
// save(name) waits 100 ms, then logs "saved <name>"
const names = ['Asha', 'Ravi', 'Maya'];

names.forEach(async (name) => {
  await save(name);
});
console.log('All saved?');
```

```text
All saved?
saved Asha
saved Ravi
saved Maya
```

`forEach` does not wait for async callbacks. It fires them all and moves on. Use `for...of` to go one at a time, or `Promise.all` with `map` to go all at once:

```javascript
// Right: one at a time
for (const name of names) {
  await save(name);
}
console.log('All saved!');

// Right: all at once
await Promise.all(names.map((name) => save(name)));
console.log('All saved!');
```

### Returning a promise from try without await

```javascript
// Wrong: the catch never runs
async function loadNotes() {
  try {
    return readFile('missing.txt', 'utf8');
  } catch {
    return 'No notes yet';
  }
}
```

The promise is returned before it fails, so the error escapes the `try`. Write `return await` inside a `try` block:

```javascript
// Right
async function loadNotes() {
  try {
    return await readFile('missing.txt', 'utf8');
  } catch {
    return 'No notes yet';
  }
}
console.log(await loadNotes()); // prints: No notes yet
```

## Quick recap

- Node has three async styles: **callbacks**, **promises** and **async/await**.
- Node callbacks are **error-first**: `(err, result) => {}`. Check `err` and return early.
- Deep nesting of callbacks is called **callback hell**. Promises flatten it.
- Use promise modules like `node:fs/promises` and `node:timers/promises` where they exist.
- `util.promisify` turns an error-first callback function into a promise function.
- An `async` function always returns a promise. `await` pauses that function, not Node.
- Top-level `await` works in ES modules only.
- Use `Promise.all` for independent work, and never `await` inside `forEach`.

<code id="code-content" class="language-javascript">
// async-styles.mjs: the same job in three styles
import { promisify } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
// 1. An old-style function with an error-first callback
function findBook(id, callback) {
  setTimeout(() =&gt; {
    if (id &gt; 0) callback(null, { id, title: `Book ${id}` });
    else callback(new Error(`No book with id ${id}`));
  }, 100);
}
findBook(1, (err, book) =&gt; {
  if (err) return console.error('Callback error:', err.message);
  console.log('Callback style:', book.title);
});
// 2. Turn it into a promise-returning function
const findBookAsync = promisify(findBook);
findBookAsync(2)
  .then((book) =&gt; console.log('Promise style:', book.title))
  .catch((err) =&gt; console.error('Promise error:', err.message));
// 3. async/await reads top to bottom, and try/catch handles errors
async function main() {
  await sleep(300); // wait so the output above prints first
  try {
    const book = await findBookAsync(3);
    console.log('await style:', book.title);
    await findBookAsync(-1); // this one fails
  } catch (err) {
    console.error('Caught with try/catch:', err.message);
  }
  // ---
  // One after another: about 300 ms
  console.time('sequential');
  for (const id of [1, 2, 3]) {
    await findBookAsync(id);
  }
  console.timeEnd('sequential');
  // All at once: about 100 ms
  console.time('parallel');
  const books = await Promise.all([1, 2, 3].map((id) =&gt; findBookAsync(id)));
  console.timeEnd('parallel');
  console.log('Got:', books.map((b) =&gt; b.title).join(', '));
}
await main();
</code></pre>

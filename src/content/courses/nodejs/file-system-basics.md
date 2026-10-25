---
publishDate: 2026-10-25T09:20
title: Reading and Writing Files with fs/promises
slug: file-system-basics
metadescription: Read, write, append, copy, rename and delete files with node:fs/promises and async/await, save data as JSON, and handle errors like ENOENT safely.
updateDate: 2026-10-25T09:20
author: ['bishal-biswas']
level: 1
tags: ['fs', 'files', 'async', 'json']
course: nodejs
---

## Why files matter

A browser cannot freely read or write files on your computer. Node can, and that is one of the main reasons people use it.

Think of your program as a cook. Variables are what the cook remembers while working. When the shift ends, that memory is gone. Files are the recipe book on the shelf: they are still there tomorrow.

Saving notes, reading settings, writing logs, processing a spreadsheet export: all of these use the **file system**, through Node's built-in **`fs`** module.

## Importing fs/promises

`fs` comes in a few styles. The modern one is **`node:fs/promises`**, where every function returns a promise, so you can use `await`:

```javascript
import { readFile, writeFile } from 'node:fs/promises';
```

ES modules allow `await` at the top level of a file, so the examples below need no wrapper function.

> **Note:** Relative paths like `'notes.txt'` are found from the folder you ran `node` in (`process.cwd()`). For files that live next to your script, build the path with `path.join(import.meta.dirname, 'notes.txt')`, as shown in the path module lesson.

## Writing a file: writeFile

```javascript
// write.mjs
import { writeFile } from 'node:fs/promises';

await writeFile('notes.txt', 'Buy milk\n');
console.log('Saved!');
```

- If `notes.txt` does not exist, it is created.
- If it does exist, it is **replaced**. The old content is gone.

The `\n` is a **newline** character, so the next line of text starts on a fresh line.

## Reading a file: readFile

```javascript
// read.mjs
import { readFile } from 'node:fs/promises';

const text = await readFile('notes.txt', 'utf8');
console.log(text); // prints: Buy milk
```

The second argument, `'utf8'`, is the **encoding**: how the raw bytes on disk turn into readable text. UTF-8 is the standard for text files.

### What happens without 'utf8'

```javascript
const data = await readFile('notes.txt');
console.log(data);
```

```text
<Buffer 42 75 79 20 6d 69 6c 6b 0a>
```

Without an encoding you get a **Buffer**: a box of raw bytes. That is right for images and other binary files, but for text you almost always want `'utf8'`. Buffers get their own lesson later.

## Adding to a file: appendFile

`appendFile` adds to the end instead of replacing. It creates the file if needed:

```javascript
import { appendFile, readFile } from 'node:fs/promises';

await appendFile('notes.txt', 'Call Ravi\n');
await appendFile('notes.txt', 'Water the plants\n');

console.log(await readFile('notes.txt', 'utf8'));
```

```text
Buy milk
Call Ravi
Water the plants
```

This is perfect for simple logs.

## Handling errors

Files go missing, folders do not exist, and permissions get in the way. When that happens, the promise **rejects** and `await` throws an error. Catch it with `try/catch`:

```javascript
import { readFile } from 'node:fs/promises';

try {
  const text = await readFile('missing.txt', 'utf8');
  console.log(text);
} catch (error) {
  console.log(error.code); // prints: ENOENT
}
```

Every file system error has a `code`. The ones you will see most:

```text
ENOENT   no such file or directory
EEXIST   the file already exists
EACCES   permission denied
EISDIR   expected a file but found a folder
```

**ENOENT** stands for "Error NO ENTry". It is by far the most common.

### Treating "missing" as normal

Often a missing file is not really an error. On first run, your app has not saved anything yet. Handle that one case and re-throw anything else:

```javascript
async function loadNotes() {
  try {
    return await readFile('notes.txt', 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return ''; // no file yet: start empty
    throw error; // a real problem: let it surface
  }
}
```

## Do not check first, just try

You might be tempted to check whether a file exists before reading it. Do not. Between your check and your read, another program could delete the file. Just read it and handle `ENOENT`, as above.

The same idea works for writing. To create a file **only if it does not exist yet**, pass the `'wx'` flag (write, exclusive):

```javascript
import { writeFile } from 'node:fs/promises';

try {
  await writeFile('config.json', '{}', { flag: 'wx' });
  console.log('Created config.json');
} catch (error) {
  if (error.code === 'EEXIST') console.log('config.json already exists, leaving it alone');
  else throw error;
}
```

## Saving data as JSON

Files hold text, but your data lives in objects and arrays. **JSON** bridges the gap: `JSON.stringify` turns data into text, and `JSON.parse` turns it back.

```javascript
// books.mjs
import { readFile, writeFile } from 'node:fs/promises';

const books = [
  { title: 'Dune', pages: 412 },
  { title: 'Emma', pages: 474 },
];

// Save: object -> text -> file
await writeFile('books.json', JSON.stringify(books, null, 2));

// Load: file -> text -> object
const loaded = JSON.parse(await readFile('books.json', 'utf8'));
console.log(loaded[0].title); // prints: Dune
```

The `null, 2` arguments make `JSON.stringify` indent the output by two spaces, so the file is easy to read:

```json
[
  {
    "title": "Dune",
    "pages": 412
  },
  {
    "title": "Emma",
    "pages": 474
  }
]
```

You will use this pattern for storage in the to-do app project.

## File information: stat

`stat` tells you about a file without reading it:

```javascript
import { stat } from 'node:fs/promises';

const info = await stat('notes.txt');
console.log(info.size);          // size in bytes, e.g. 36
console.log(info.isFile());      // prints: true
console.log(info.isDirectory()); // prints: false
console.log(info.mtime);         // the date it was last modified
```

## Copying, renaming and deleting

```javascript
import { copyFile, rename, rm } from 'node:fs/promises';

await copyFile('notes.txt', 'notes-backup.txt'); // copy
await rename('notes-backup.txt', 'old-notes.txt'); // rename (or move)
await rm('old-notes.txt');                         // delete
```

- `rename` can also **move** a file: `rename('a.txt', 'archive/a.txt')`.
- `rm` throws `ENOENT` if the file is not there. Add `{ force: true }` to ignore that.

> **Note:** `rm` deletes for real. There is no recycle bin. Double-check the path before deleting anything.

## Sync and callback versions

You will see two older styles in tutorials:

```javascript
import { readFileSync, readFile } from 'node:fs';

const text = readFileSync('notes.txt', 'utf8'); // blocks until done

readFile('notes.txt', 'utf8', (error, text) => { // callback style
  if (error) throw error;
  console.log(text);
});
```

**Sync** functions block: the whole program waits, doing nothing else. That is fine in a small script that runs once, but bad in a server handling many users. Stick with `fs/promises` by default. The Event Loop lesson explains why blocking matters.

## Common mistakes

### Forgetting await

```javascript
const text = readFile('notes.txt', 'utf8');
console.log(text); // prints: Promise { <pending> }
```

`readFile` returns a promise, not the text. Add `await`:

```javascript
const text = await readFile('notes.txt', 'utf8');
```

### Using writeFile when you meant appendFile

```javascript
await writeFile('log.txt', 'Second entry\n'); // the first entry is gone!
```

`writeFile` replaces the whole file. Use `appendFile` to add to it.

### Writing into a folder that does not exist

```javascript
await writeFile('data/notes.txt', 'Hello'); // ENOENT if data/ is missing
```

`writeFile` creates files, not folders. The next lesson shows how to create folders with `mkdir`.

### Writing an object directly

```javascript
await writeFile('book.json', { title: 'Dune' }); // throws a TypeError
```

Turn it into text first with `JSON.stringify(book, null, 2)`.

## Quick recap

- Import from `node:fs/promises` and use `await`.
- `writeFile` creates or replaces, `appendFile` adds to the end, `readFile(path, 'utf8')` reads text.
- Errors have a `code`. `ENOENT` means not found, `EEXIST` means it already exists.
- Do not check whether a file exists first. Just try, and handle the error.
- Save data with `JSON.stringify(data, null, 2)` and load it with `JSON.parse`.
- `stat`, `copyFile`, `rename` and `rm` cover file info, copying, moving and deleting.

<code id="code-content" class="language-javascript">
// files-tour.mjs
import { readFile, writeFile, appendFile, stat, copyFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
// Keep demo files next to this script, whatever folder you run it from
const here = (name) =&gt; path.join(import.meta.dirname, name);
const notesFile = here('demo-notes.txt');
const booksFile = here('demo-books.json');
// --- Write (create or replace), then append
await writeFile(notesFile, 'Buy milk\n');
await appendFile(notesFile, 'Call Ravi\n');
await appendFile(notesFile, 'Water the plants\n');
console.log(await readFile(notesFile, 'utf8'));
// --- Without an encoding you get raw bytes
const bytes = await readFile(notesFile);
console.log('First bytes:', bytes.subarray(0, 8));
// --- Treat a missing file as "empty" and re-throw anything else
async function readOrEmpty(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}
console.log('Missing file gives:', JSON.stringify(await readOrEmpty(here('nope.txt'))));
// --- Create only if it does not exist yet
try {
  await writeFile(notesFile, 'overwrite?', { flag: 'wx' });
} catch (error) {
  console.log('wx flag stopped us:', error.code); // EEXIST
}
// --- JSON round trip
const books = [{ title: 'Dune', pages: 412 }, { title: 'Emma', pages: 474 }];
await writeFile(booksFile, JSON.stringify(books, null, 2));
const loaded = JSON.parse(await readFile(booksFile, 'utf8'));
console.log('Loaded', loaded.length, 'books. First:', loaded[0].title);
// --- File info
const info = await stat(notesFile);
console.log(`Notes file: ${info.size} bytes, isFile=${info.isFile()}`);
// --- Copy, rename, delete
await copyFile(notesFile, here('demo-backup.txt'));
await rename(here('demo-backup.txt'), here('demo-old.txt'));
await rm(here('demo-old.txt'));
// --- Tidy up the demo files (force: no error if already gone)
await rm(notesFile, { force: true });
await rm(booksFile, { force: true });
console.log('Cleaned up. Done!');
</code></pre>

---
publishDate: 2026-10-25T09:25
title: Working with Folders and Directories
slug: working-with-folders
metadescription: Create, list, copy, rename and delete folders with node:fs/promises. Covers mkdir recursive, readdir with file types, recursive listing, glob and temp folders.
updateDate: 2026-10-25T09:25
author: ['bishal-biswas']
level: 1
tags: ['fs', 'folders', 'files']
course: nodejs
---

## Folders, directories, same thing

A **directory** is what the operating system calls a folder. Node's function names use "dir", so you will see both words. They mean the same.

Think of a filing cabinet. Each drawer is a folder, each drawer can hold folders of its own, and the papers inside are files. In the last lesson you learned to read and write the papers. Now you will learn to manage the drawers.

Everything here comes from the same module:

```javascript
import { mkdir, readdir, rm, cp, rename } from 'node:fs/promises';
```

## Creating a folder: mkdir

```javascript
// make-folder.mjs
import { mkdir } from 'node:fs/promises';

await mkdir('notes');
console.log('Created notes/');
```

Run it twice and the second run fails with an `EEXIST` error ("file already exists"), because the folder is already there.

### recursive: true

Add `{ recursive: true }` and two good things happen:

```javascript
await mkdir('notes/2026/october', { recursive: true });
```

1. Any missing parent folders are created too (`notes`, then `2026`, then `october`).
2. If the folder already exists, there is no error.

Without it, creating `notes/2026/october` fails with `ENOENT` when `notes/2026` does not exist yet.

> **Tip:** Use `mkdir(folder, { recursive: true })` almost every time. It means "make sure this folder exists", which is usually what you want.

### The classic pattern: make the folder, then the file

In the last lesson you saw that `writeFile` cannot create folders. Combine the two:

```javascript
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join('data', 'reports', 'october.txt');

await mkdir(path.dirname(file), { recursive: true }); // make sure data/reports exists
await writeFile(file, 'Sales were up this month.');
```

`path.dirname(file)` gives `data/reports`, the folder part of the path.

## Listing a folder: readdir

`readdir` returns the names of everything inside a folder:

```javascript
import { readdir } from 'node:fs/promises';

const names = await readdir('notes');
console.log(names);
```

```text
[ '2026', 'ideas.md', 'todo.txt' ]
```

You get plain names, not full paths. Use `path.join('notes', name)` to build a full path for each one.

> **Note:** Do not rely on the order. It depends on the operating system. Call `.sort()` if you need a fixed order.

### Files or folders? withFileTypes

A name alone does not tell you if it is a file or a folder. Pass `withFileTypes: true` to get richer objects:

```javascript
const entries = await readdir('notes', { withFileTypes: true });

for (const entry of entries) {
  const kind = entry.isDirectory() ? 'folder' : 'file';
  console.log(`${entry.name} (${kind})`);
}
```

```text
2026 (folder)
ideas.md (file)
todo.txt (file)
```

Each **entry** (a `Dirent` object) has a `name`, a `parentPath` (the folder it is in), and methods such as `isFile()` and `isDirectory()`.

### Only some files

Filter with `path.extname` from the path module lesson:

```javascript
import path from 'node:path';

const names = await readdir('notes');
const textFiles = names.filter(name => path.extname(name) === '.txt');
console.log(textFiles); // prints: [ 'todo.txt' ]
```

### Every level: recursive

Add `recursive: true` to list sub-folders too:

```javascript
const all = await readdir('notes', { recursive: true });
console.log(all);
```

```text
[ '2026', 'ideas.md', 'todo.txt', '2026/october', '2026/october/trip.txt' ]
```

Names in sub-folders come back as relative paths, using `\` on Windows.

## Finding files by pattern: glob

A **glob** is a pattern for matching file paths. `*` matches any name, and `**` matches any number of folders. Node 24 includes a `glob` function in `fs/promises`:

```javascript
import { glob } from 'node:fs/promises';

for await (const file of glob('notes/**/*.txt')) {
  console.log(file);
}
```

```text
notes/todo.txt
notes/2026/october/trip.txt
```

`glob` gives you results one at a time, so you loop over it with `for await...of`. If you want an array instead, use `await Array.fromAsync(glob('notes/**/*.txt'))`.

## Copying a folder: cp

`cp` copies files and folders. For a folder, add `recursive: true` to copy everything inside it:

```javascript
import { cp } from 'node:fs/promises';

await cp('notes', 'notes-backup', { recursive: true });
```

Forget `recursive` and you get an `ERR_FS_EISDIR` error, because Node will not quietly skip the contents.

## Renaming or moving a folder: rename

The same `rename` you used for files works for folders:

```javascript
import { rename } from 'node:fs/promises';

await rename('notes-backup', 'archive'); // rename
await rename('archive', 'old/archive');  // move (old/ must exist)
```

## Deleting a folder: rm

```javascript
import { rm } from 'node:fs/promises';

await rm('archive', { recursive: true, force: true });
```

- `recursive: true` deletes the folder **and everything inside it**.
- `force: true` means "no error if it is already gone".

There is also an older `rmdir`, which only removes **empty** folders and fails with `ENOTEMPTY` otherwise. In new code, `rm` with `recursive` is the usual choice.

> **Note:** `rm` with `recursive: true` is the code version of deleting a folder and emptying the recycle bin in one go. Nothing is recoverable. Print the path and check it before you run this on anything real.

## Temporary folders

Sometimes you need a scratch folder that nobody else will use, for example in tests. `mkdtemp` creates one with a random, unique name:

```javascript
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'notes-'));
console.log(tempDir); // e.g. /tmp/notes-57OjVr

// ... use the folder ...

await rm(tempDir, { recursive: true, force: true }); // clean up afterwards
```

`os.tmpdir()` returns your system's temporary folder. `mkdtemp` adds six random characters after your prefix.

## Folder errors you will meet

```text
EEXIST         mkdir on a folder that exists (without recursive)
ENOENT         a parent folder is missing, or the folder is not there
ENOTEMPTY      rmdir on a folder that still has things in it
ENOTDIR        readdir on something that is a file, not a folder
ERR_FS_EISDIR  cp or rm on a folder without recursive: true
```

## Common mistakes

### Forgetting recursive when creating nested folders

```javascript
await mkdir('data/reports/2026'); // ENOENT if data/reports does not exist
```

Fix:

```javascript
await mkdir('data/reports/2026', { recursive: true });
```

### Using a name from readdir as if it were a path

```javascript
const names = await readdir('notes');
const text = await readFile(names[0], 'utf8'); // looks in the wrong folder!
```

`readdir` returns bare names. Join them to the folder first:

```javascript
const text = await readFile(path.join('notes', names[0]), 'utf8');
```

### Deleting with a path built from user input

```javascript
await rm(path.join(baseDir, userInput), { recursive: true }); // userInput = '..' ?
```

A value like `..` could point at the folder above, and `rm` would delete it. Check user input carefully, or keep only the base name with `path.basename(userInput)`.

## Quick recap

- `mkdir(folder, { recursive: true })` creates a folder and its parents, and does not fail if it exists.
- `readdir` lists names. Add `withFileTypes: true` to tell files from folders, and `recursive: true` to include sub-folders.
- `glob('notes/**/*.txt')` finds files by pattern. Loop over it with `for await`.
- `cp(src, dest, { recursive: true })` copies a folder, and `rename` renames or moves it.
- `rm(folder, { recursive: true, force: true })` deletes a folder and everything in it, permanently.
- `mkdtemp(path.join(os.tmpdir(), 'prefix-'))` gives you a unique scratch folder.

<code id="code-content" class="language-javascript">
// tidy-downloads.mjs
// Creates a fake "downloads" folder, sorts files into sub-folders by type, then cleans up.
import { mkdtemp, mkdir, writeFile, readdir, rename, cp, glob, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
// --- A private scratch folder with a unique name
const base = await mkdtemp(path.join(os.tmpdir(), 'downloads-'));
console.log('Working in', base);
// --- Fill it with some messy files
const files = ['holiday.jpg', 'notes.txt', 'Recipe.PDF', 'todo.txt', 'cat.png'];
for (const name of files) {
  await writeFile(path.join(base, name), `Pretend contents of ${name}`);
}
// --- Decide a folder for each extension
const folderFor = { '.jpg': 'images', '.png': 'images', '.txt': 'text', '.pdf': 'documents' };
// --- List files only (skip folders) and move each one
const entries = await readdir(base, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isFile()) continue;
  const ext = path.extname(entry.name).toLowerCase(); // '.PDF' -&gt; '.pdf'
  const folder = folderFor[ext] ?? 'other';
  const targetDir = path.join(base, folder);
  await mkdir(targetDir, { recursive: true }); // safe if it already exists
  await rename(path.join(base, entry.name), path.join(targetDir, entry.name));
  console.log(`Moved ${entry.name} -&gt; ${folder}/`);
}
// --- Show the result, every level
const tree = await readdir(base, { recursive: true });
console.log('Now contains:', tree.sort());
// --- Find files by pattern with glob
const textFiles = await Array.fromAsync(glob('**/*.txt', { cwd: base }));
console.log('Text files:', textFiles);
// --- Copy a whole folder
await cp(path.join(base, 'images'), path.join(base, 'images-backup'), { recursive: true });
console.log('Backup has:', await readdir(path.join(base, 'images-backup')));
// --- Delete everything we made (recursive + force)
await rm(base, { recursive: true, force: true });
console.log('Cleaned up', path.basename(base));
</code></pre>

---
publishDate: 2026-10-25T09:15
title: Paths and the path Module
slug: the-path-module
metadescription: Build file paths that work on Windows, macOS and Linux with node:path. Learn join, resolve, basename, extname, parse and relative with clear examples.
updateDate: 2026-10-25T09:15
author: ['bishal-biswas']
level: 1
tags: ['path', 'files', 'basics']
course: nodejs
---

## What is a path?

A **path** is the address of a file or folder on your computer, such as `/home/asha/notes/todo.txt`.

Think of a postal address. "Flat 4, Rose Building, MG Road, Pune" leads a letter to one exact door. A path does the same for a file: each part is a folder, and the last part is the file itself.

The trouble is that operating systems write addresses differently:

```text
Linux and macOS:  /home/asha/notes/todo.txt
Windows:          C:\Users\asha\notes\todo.txt
```

Linux and macOS use forward slashes `/`. Windows uses backslashes `\` and drive letters like `C:`. If you glue paths together with strings, your code may work on your laptop and break on someone else's.

The built-in **`node:path`** module builds and takes apart paths correctly for whatever system your code runs on.

```javascript
import path from 'node:path';
```

> **Note:** The examples below show Linux and macOS style output. On Windows you will see backslashes instead. That is the point: the same code gives the right answer on each system.

## Absolute and relative paths

Two words you will see a lot:

- An **absolute path** starts from the very top of the drive: `/home/asha/notes/todo.txt` or `C:\Users\asha\notes\todo.txt`. It means the same thing wherever you are.
- A **relative path** starts from "where you are now": `notes/todo.txt` or `../photos`. Its meaning depends on the current folder.

Inside a relative path, `.` means "this folder" and `..` means "the folder above".

```javascript
console.log(path.isAbsolute('/home/asha'));     // prints: true
console.log(path.isAbsolute('notes/todo.txt')); // prints: false
```

## Joining paths: path.join

`path.join` glues pieces together with the correct separator and tidies the result:

```javascript
console.log(path.join('notes', 'work', 'todo.txt'));
// prints: notes/work/todo.txt  (notes\work\todo.txt on Windows)
```

It also cleans up doubled slashes and `..` parts:

```javascript
console.log(path.join('notes/', '/work', '../home', 'list.txt'));
// prints: notes/home/list.txt
```

The most common use is building a path to a file next to your script, using `import.meta.dirname` from the Globals lesson:

```javascript
const dataFile = path.join(import.meta.dirname, 'data', 'notes.json');
console.log(dataFile);
// prints: /home/asha/projects/notes-app/data/notes.json
```

## Making a full path: path.resolve

`path.resolve` always returns an **absolute** path. It works through the pieces from right to left until it has built a full address. If none of them is absolute, it starts from the current working directory.

```javascript
// run from /home/asha/projects
console.log(path.resolve('notes', 'todo.txt'));
// prints: /home/asha/projects/notes/todo.txt
```

Use it to turn a path the user typed into a full one:

```javascript
const userPath = process.argv[2] ?? 'notes.txt';
console.log(path.resolve(userPath));
```

### join versus resolve

They look similar, but they treat a piece that starts with `/` differently:

```javascript
console.log(path.join('/home/asha', '/etc', 'hosts'));    // prints: /home/asha/etc/hosts
console.log(path.resolve('/home/asha', '/etc', 'hosts')); // prints: /etc/hosts
```

`join` just glues. `resolve` treats `/etc` as a fresh starting point, like typing `cd /etc` in a terminal.

A simple rule: use `join` to build a path from parts you control, and `resolve` when you need a guaranteed absolute path.

## Taking a path apart

### basename, dirname and extname

```javascript
const file = '/home/asha/notes/todo.txt';

console.log(path.basename(file));         // prints: todo.txt
console.log(path.basename(file, '.txt')); // prints: todo
console.log(path.dirname(file));          // prints: /home/asha/notes
console.log(path.extname(file));          // prints: .txt
```

- **basename** is the last part, the file name.
- **dirname** is everything before it, the folder.
- **extname** is the **extension**: the dot and the letters after it.

A few extension cases worth knowing:

```javascript
console.log(path.extname('photo.final.JPG')); // prints: .JPG (only the last dot counts)
console.log(path.extname('archive.tar.gz'));  // prints: .gz
console.log(path.extname('README'));          // prints an empty line: the result is ''
console.log(path.extname('.env'));            // also '': a dot file has no extension
```

> **Tip:** Extensions keep their case. Compare with `path.extname(file).toLowerCase() === '.jpg'` so `.JPG` and `.jpg` both match.

### path.parse and path.format

`path.parse` splits a path into all its parts at once:

```javascript
console.log(path.parse('/home/asha/notes/todo.txt'));
```

```text
{
  root: '/',
  dir: '/home/asha/notes',
  base: 'todo.txt',
  ext: '.txt',
  name: 'todo'
}
```

`path.format` does the opposite. That makes changing an extension easy:

```javascript
const parts = path.parse('/home/asha/notes/todo.txt');
const markdown = path.format({ dir: parts.dir, name: parts.name, ext: '.md' });
console.log(markdown); // prints: /home/asha/notes/todo.md
```

## The way from one place to another: path.relative

`path.relative(from, to)` tells you how to get from one folder to another:

```javascript
console.log(path.relative('/home/asha/projects/app', '/home/asha/notes/todo.txt'));
// prints: ../../notes/todo.txt
```

Go up two folders, then down into `notes`. This is handy for printing short, friendly paths in messages.

## Tidying a messy path: path.normalize

```javascript
console.log(path.normalize('/home/asha/./notes//work/../todo.txt'));
// prints: /home/asha/notes/todo.txt
```

It removes `.`, resolves `..` and squashes doubled slashes. `join` and `resolve` already do this for you, so you rarely call it directly.

## The separator: path.sep

```javascript
console.log(path.sep); // prints: /  (\ on Windows)
```

Use it when you need to split a path into folder names:

```javascript
const folders = 'notes/work/todo.txt'.split(path.sep);
```

### Forcing one style

`path.posix` always uses `/`, and `path.win32` always uses Windows rules, whatever system you are on:

```javascript
console.log(path.posix.join('notes', 'todo.txt')); // prints: notes/todo.txt
console.log(path.win32.join('notes', 'todo.txt')); // prints: notes\todo.txt
```

You need these rarely, for example when building URL paths, which always use `/`.

## Paths and file URLs

ES modules describe files as **file URLs**, like `import.meta.url`. The `node:url` module converts between the two forms:

```javascript
import { fileURLToPath, pathToFileURL } from 'node:url';

console.log(fileURLToPath('file:///home/asha/notes/todo.txt')); // prints: /home/asha/notes/todo.txt
console.log(pathToFileURL('/home/asha/notes/todo.txt').href);   // prints: file:///home/asha/notes/todo.txt
```

## Common mistakes

### Gluing paths with strings

```javascript
const file = import.meta.dirname + '/data/' + 'notes.json';
```

This mixes separators on Windows and breaks easily if a piece already ends in a slash. Use `join`:

```javascript
const file = path.join(import.meta.dirname, 'data', 'notes.json');
```

### Expecting path to check the disk

```javascript
console.log(path.join('no', 'such', 'file.txt')); // prints: no/such/file.txt
```

`path` only works with text. It never checks whether a file exists. You will check files with `fs` in the next lesson.

### Trusting user input inside a folder

```javascript
const name = '../../secret.txt'; // typed by a user
console.log(path.join('/srv/uploads', name)); // prints: /secret.txt
```

`..` can climb out of the folder you meant. If users choose file names, check the final path still starts with your folder, or use `path.basename(name)` to keep only the file name.

## Quick recap

- Paths look different on Windows and on Linux or macOS. `node:path` handles both.
- `path.join` glues pieces with the right separator. `path.resolve` always returns an absolute path.
- `basename`, `dirname` and `extname` give the file name, folder and extension.
- `path.parse` splits a path into parts, and `path.format` puts them back together.
- `path.relative` gives directions between two places, and `path.normalize` tidies messy paths.
- `path` only manipulates text. It never touches the disk.

<code id="code-content" class="language-javascript">
// path-tour.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// --- Build a path next to this script (works on every OS)
const dataFile = path.join(import.meta.dirname, 'data', 'notes.json');
console.log('Data file:', dataFile);
// --- join glues and tidies; resolve always gives an absolute path
console.log(path.join('notes/', '/work', '../home', 'list.txt'));
console.log(path.resolve('notes', 'todo.txt')); // starts from process.cwd()
console.log('join   :', path.join('/home/asha', '/etc', 'hosts'));
console.log('resolve:', path.resolve('/home/asha', '/etc', 'hosts'));
// --- Take a path apart
const file = path.join('/home', 'asha', 'notes', 'todo.txt');
console.log('basename:', path.basename(file));
console.log('no ext  :', path.basename(file, '.txt'));
console.log('dirname :', path.dirname(file));
console.log('extname :', path.extname(file));
console.log(path.parse(file));
// --- Change an extension with parse + format
const parts = path.parse(file);
console.log('As markdown:', path.format({ dir: parts.dir, name: parts.name, ext: '.md' }));
// --- Extension edge cases
for (const name of ['photo.final.JPG', 'archive.tar.gz', 'README', '.env']) {
  const ext = path.extname(name).toLowerCase();
  console.log(`${name.padEnd(16)} -&gt; ${JSON.stringify(ext)}`);
}
// --- Directions from one folder to another
console.log(path.relative('/home/asha/projects/app', '/home/asha/notes/todo.txt'));
// --- One style everywhere
console.log(path.posix.join('notes', 'todo.txt'), '|', path.win32.join('notes', 'todo.txt'));
console.log('This system uses', JSON.stringify(path.sep), 'as its separator');
// --- Paths and file URLs
console.log(fileURLToPath(import.meta.url) === import.meta.filename); // true
console.log(pathToFileURL(dataFile).href);
// --- Keep user input inside a folder
const uploads = path.resolve('uploads');
const unsafe = path.join(uploads, '../../secret.txt');
const safe = path.join(uploads, path.basename('../../secret.txt'));
console.log('Unsafe stays inside?', unsafe.startsWith(uploads + path.sep));
console.log('Safe stays inside?  ', safe.startsWith(uploads + path.sep));
</code></pre>

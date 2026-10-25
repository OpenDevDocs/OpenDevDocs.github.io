---
publishDate: 2026-10-25T08:40
title: package.json Explained
slug: package-json-explained
metadescription: Learn what package.json is, how to create one, and what each important field does, from name, version and type to scripts, dependencies, exports and engines.
updateDate: 2026-10-25T08:40
author: ['bishal-biswas']
level: 1
tags: ['npm', 'package-json', 'config']
course: nodejs
---

## What is package.json?

**`package.json`** is a small file in the top folder of every Node project. It describes the project: its name, which packages it needs, how to run it, and which Node versions it supports.

Think of it as the label on a moving box. Anyone, person or tool, can read the label and know what is inside and how to handle it, without unpacking everything.

npm reads it to install packages. Node reads it to decide how to load your files. Other developers read it to understand your project in seconds.

## Creating one

Inside your project folder, run:

```bash
npm init -y
```

The `-y` means "yes to all the default answers". Without it, npm asks you questions one by one. You get this file:

```json
{
  "name": "notes-app",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs"
}
```

The name comes from your folder name. Notice the last line: `npm init` sets `"type": "commonjs"`. This course uses ES modules, so change it straight away:

```bash
npm pkg set type=module
```

`npm pkg set` edits `package.json` for you, so you cannot accidentally break the JSON.

## It must be real JSON

`package.json` is **JSON**, not JavaScript. JSON is stricter:

- Keys and strings need **double quotes**.
- No comments.
- No trailing comma after the last item.

```json
{
  "name": "notes-app",
  "version": "1.0.0",
}
```

That trailing comma breaks every npm command:

```text
npm error code EJSONPARSE
npm error JSON.parse Note: package.json must be actual JSON, not just JavaScript.
```

## The identity fields

### name

The project's name. It must be lowercase, with no spaces. Use hyphens instead: `notes-app`, not `Notes App`.

Packages published to npm can also have a **scope**, a prefix that groups packages under a user or organisation: `@asha/notes-app`.

### version

The project's version in **MAJOR.MINOR.PATCH** form, such as `1.0.0`. It matters most when you publish a package. [Semantic Versioning and Lockfiles](/courses/nodejs/semver-and-lockfiles) explains the rules.

### description, keywords, author, license

Information for humans and for the npm website. `license` says how others may use your code, using a short code such as `MIT` or `ISC`.

### private

```json
{
  "private": true
}
```

`"private": true` stops npm from ever publishing the project to the public registry. Add it to every app that is not meant to be a shared package.

## How Node loads your code

### type

As you saw in [CommonJS vs ES Modules](/courses/nodejs/commonjs-vs-es-modules), `"type"` decides how Node treats `.js` files:

- `"type": "module"`: `.js` files are ES modules (`import`/`export`).
- `"type": "commonjs"`, or no `type`: `.js` files are CommonJS (`require`).

### main and exports

These say which file someone gets when they import your package by name.

`main` is the older, simpler field. It names a single entry file:

```json
{
  "main": "src/index.js"
}
```

`exports` is the modern field. It can list several entry points, and it **hides** every file you do not list:

```json
{
  "name": "notes-kit",
  "exports": {
    ".": "./src/index.js",
    "./format": "./src/format.js"
  }
}
```

With this, users can write:

```javascript
import { addNote } from 'notes-kit';           // loads src/index.js
import { formatNote } from 'notes-kit/format'; // loads src/format.js
```

But anything else is blocked:

```javascript
import 'notes-kit/src/internal.js';
```

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './src/internal.js' is not defined by "exports"
```

That protection lets package authors reorganise private files without breaking anyone. For an app you only run yourself, you do not need either field.

## scripts

**Scripts** are named shortcuts for commands you run often:

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --test"
  }
}
```

Run them with `npm run dev`, or the faster `node --run dev`. [npm, npx and node --run](/courses/nodejs/npm-npx-and-node-run) covers scripts in detail.

## Dependencies

A **dependency** is a package your project uses. When you install one, npm records it here.

### dependencies

Packages your app needs **to run**:

```bash
npm install express
```

```json
{
  "dependencies": {
    "express": "^5.1.0"
  }
}
```

### devDependencies

Packages you need only **while developing**, such as linters, formatters and build tools. Install them with `--save-dev` (or `-D`):

```bash
npm install --save-dev prettier
```

```json
{
  "devDependencies": {
    "prettier": "^3.6.2"
  }
}
```

When you deploy an app, you can skip devDependencies with `npm install --omit=dev`, which keeps the install smaller.

### What does `^5.1.0` mean?

The `^` (caret) means "version 5.1.0 or any later version that is still 5.x". It allows bug fixes and new features, but never a new major version that might break your code. The semver lesson covers all the symbols.

> **Note:** You will also see `peerDependencies` in packages that plug into something else, such as a React component library that expects your app to provide React. You rarely need to write them in an app.

## engines

`engines` declares which Node versions the project supports:

```json
{
  "engines": {
    "node": ">=24"
  }
}
```

npm warns when someone installs with a version outside this range. [Installing Node.js LTS and Version Managers](/courses/nodejs/installing-nodejs-and-version-managers) showed how to make it a hard error with `engine-strict=true`.

## Two fields you will meet later

- **`bin`** turns a file in your package into a terminal command. See [Building CLIs and Publishing to npm](/courses/nodejs/building-and-publishing-cli-tools).
- **`files`** lists which files are included when you publish a package.

## Reading package.json from your code

Sometimes a program wants its own name or version, for example to print it with `--version`. Import the file as JSON:

```javascript
// src/version.js
import pkg from '../package.json' with { type: 'json' };

console.log(`${pkg.name} v${pkg.version}`); // prints: notes-app v1.0.0
```

The `with { type: 'json' }` part is an **import attribute**. It tells Node to load the file as data, not code.

## Handy npm pkg commands

```bash
npm pkg get name version              # read fields
npm pkg set engines.node=">=24"       # add or change a field
npm pkg delete scripts.test           # remove a field
```

## Common mistakes

### Leaving `"type": "commonjs"` from npm init

If you write `import` in `.js` files, Node complains `Cannot use import statement outside a module`. Run `npm pkg set type=module`.

### Editing dependencies by hand and not installing

Typing a new package into `dependencies` does not download it. Run `npm install` afterwards, or better, add packages with `npm install <name>` so npm writes the entry for you.

## Quick recap

- `package.json` describes your project to npm, Node and other developers.
- Create it with `npm init -y`, then set `"type": "module"` for ES modules.
- It must be valid JSON: double quotes, no comments, no trailing commas.
- `name`, `version` and `private` identify the project; `type`, `main` and `exports` control how code loads.
- `scripts` are named commands; `dependencies` are needed to run, `devDependencies` only to develop.
- `engines` declares supported Node versions.
- `npm pkg get` and `npm pkg set` read and edit it safely.

<code id="code-content" class="language-javascript">
// package-json-demo.mjs: create, read and check a package.json
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const dir = path.join(os.tmpdir(), 'notes-app');
await mkdir(dir, { recursive: true });
// --- Build the file as a normal object, then save it as JSON
const pkg = {
  name: 'notes-app',
  version: '1.0.0',
  private: true,                       // never publish by accident
  type: 'module',                      // .js files are ES modules
  scripts: { start: 'node src/index.js', dev: 'node --watch src/index.js' },
  dependencies: { express: '^5.1.0' }, // needed to run
  devDependencies: { prettier: '^3.6.2' }, // needed only while developing
  engines: { node: '&gt;=24' },
};
const file = path.join(dir, 'package.json');
await writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
// --- Read it back, exactly as npm would
const loaded = JSON.parse(await readFile(file, 'utf8'));
console.log(`${loaded.name} v${loaded.version} (${loaded.type})`);
console.log('Scripts you can run:');
for (const [name, command] of Object.entries(loaded.scripts)) {
  console.log(`  node --run ${name.padEnd(6)} -&gt; ${command}`);
}
console.log('Runtime packages:', Object.keys(loaded.dependencies).join(', '));
console.log('Dev-only packages:', Object.keys(loaded.devDependencies).join(', '));
// --- A simple engines check for "&gt;=N" ranges
const wanted = Number(loaded.engines.node.replace('&gt;=', ''));
const current = Number(process.versions.node.split('.')[0]);
console.log(current &gt;= wanted
  ? `Node ${current} satisfies "${loaded.engines.node}"`
  : `Node ${current} is too old, "${loaded.engines.node}" is required`);
// --- Broken JSON is the most common package.json mistake
try {
  JSON.parse('{ "name": "notes-app", }');
} catch (error) {
  console.log('Trailing comma breaks it:', error.message);
}
</code></pre>

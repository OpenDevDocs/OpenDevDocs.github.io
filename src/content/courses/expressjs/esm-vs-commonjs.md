---
publishDate: 2026-10-25T09:05
title: ES Modules vs CommonJS in Express Apps
slug: esm-vs-commonjs
metadescription: Understand the two Node.js module systems, require and import, see the same Express app written both ways, and fix the common errors that appear when they get mixed up.
updateDate: 2026-10-25T09:05
author: ['bishal-biswas']
level: 1
tags: ['express', 'nodejs', 'es-modules', 'commonjs']
course: expressjs
---

## What you will learn

- What a **module** is and why Node.js has two module systems
- How **CommonJS** (`require`) and **ES modules** (`import`) look side by side
- How Node.js decides which system a file uses (`"type"`, `.mjs` and `.cjs`)
- How to replace `__dirname`, load JSON files and use top-level `await` in ES modules
- How to read and fix the most common module error messages

You will meet both styles all over the internet. Old Express tutorials almost always use `require`, while this course uses `import`. After this lesson you will be able to read both and translate between them.

## What is a module?

A **module** is simply a JavaScript file that shares some of its code with other files. Instead of one giant file, you split your app into small files, and each file **exports** what others may use and **imports** what it needs.

**Think of it like LEGO bags:** each bag (file) holds a few pieces (functions, values). You label which pieces you are handing out (export) and ask other bags for the pieces you need (import).

Node.js supports two systems for doing this:

| | CommonJS (CJS) | ES modules (ESM) |
| --- | --- | --- |
| Born | 2009, with Node.js itself | 2015, as part of the JavaScript language |
| Import with | `require('x')` | `import x from 'x'` |
| Export with | `module.exports = ...` | `export` / `export default` |
| Works in browsers | No | Yes |
| Top-level `await` | No | Yes |
| Used in this course | Only in this lesson | Everywhere |

**ES modules** are the official JavaScript standard, so they work in browsers *and* Node.js. **CommonJS** was Node's own invention before the standard existed. Both work in Node.js today, and lots of npm packages (including Express itself) are still written in CommonJS.

## The same Express app, both ways

Let's build the same tiny app twice: a `greet.js` helper and a `server.js` that uses it.

### CommonJS version

```js
// greet.js (CommonJS)
function greet(name) {
  return `Hello, ${name}!`;
}

module.exports = greet;
```

```js
// server.js (CommonJS)
const express = require('express');
const greet = require('./greet');

const app = express();

app.get('/', (req, res) => {
  res.send(greet('Express'));
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Running on http://localhost:3000');
});
```

For this version, `package.json` must **not** say `"type": "module"` (or it must say `"type": "commonjs"`).

### ES module version

```js
// greet.js (ES module)
export function greet(name) {
  return `Hello, ${name}!`;
}
```

```js
// server.js (ES module)
import express from 'express';
import { greet } from './greet.js';

const app = express();

app.get('/', (req, res) => {
  res.send(greet('Express'));
});

app.listen(3000, (error) => {
  if (error) throw error;
  console.log('Running on http://localhost:3000');
});
```

For this version, `package.json` contains `"type": "module"`.

### Spot the differences

| Task | CommonJS | ES modules |
| --- | --- | --- |
| Load a package | `const express = require('express')` | `import express from 'express'` |
| Load your own file | `require('./greet')` | `import ... from './greet.js'` (extension **required**) |
| Export one main thing | `module.exports = greet` | `export default greet` |
| Export several things | `module.exports = { a, b }` | `export const a = ...`, `export function b() {}` |
| Import several things | `const { a, b } = require('./x')` | `import { a, b } from './x.js'` |

> **Common mistake:** Leaving off `.js` in ES module imports. `import { greet } from './greet'` fails with `ERR_MODULE_NOT_FOUND`. In ES modules, relative imports must include the full file name: `'./greet.js'`. Package names like `'express'` never need an extension.

## Default exports and named exports

ES modules have two kinds of export. It's worth getting comfortable with both, because Express code uses both.

A **default export** is "the main thing" a file offers. Each file can have at most one. The importer chooses any name for it:

```js
// app.js
import express from 'express';

const app = express();
export default app;
```

```js
// server.js
import app from './app.js';        // you could call it "myApp", it would still work
```

**Named exports** are extra things, each with a fixed name. The importer uses curly braces and the same names:

```js
// utils/math.js
export const add = (a, b) => a + b;
export const double = (n) => n * 2;
```

```js
// somewhere-else.js
import { add, double } from './utils/math.js';
import { add as plus } from './utils/math.js'; // rename while importing
```

Express offers both styles at once. The default export is the `express` function, and helpers like `Router` and `json` are also available as named imports:

```js
// both lines work with Express 5
import express from 'express';
import { Router, json } from 'express';
```

## How Node.js decides which system to use

Node.js looks at each file and asks two questions, in this order:

```text
1. What is the file extension?
     .mjs  -> always an ES module
     .cjs  -> always CommonJS
     .js   -> go to question 2

2. What does the nearest package.json say?
     "type": "module"     -> ES module
     "type": "commonjs"   -> CommonJS
     no "type" field      -> CommonJS (the historical default)
```

> **Note:** Recent Node.js versions (22.7+ and 20.19+) add a safety net when there is **no** `"type"` field: if a `.js` file contains `import` or `export`, Node.js re-reads it as an ES module and prints a `MODULE_TYPELESS_PACKAGE_JSON` warning. Don't rely on it. Set `"type"` explicitly so Node.js never has to guess.

So the single line `"type": "module"` in `package.json` switches every `.js` file in your project to ES modules. That is why you added it when setting up the project.

> **Tip:** If you ever need one CommonJS file inside an ESM project (for example, a config file that a tool insists on loading with `require`), name it with `.cjs`. The reverse works too: a `.mjs` file is always ESM.

## Things that work differently in ES modules

### `__dirname` and `__filename`

CommonJS gives every file two handy variables: `__dirname` (the folder the file is in) and `__filename` (the file's full path). You will need them later to build file paths, for example for static files and templates.

These do **not** exist in ES modules. Use `import.meta` instead:

```js
// paths.js (ES module, Node.js 20.11 or newer)
import path from 'node:path';

console.log(import.meta.dirname);   // the folder this file is in
console.log(import.meta.filename);  // the full path of this file

const publicFolder = path.join(import.meta.dirname, 'public');
console.log(publicFolder);
```

On older Node.js versions you'll see this longer recipe, which does the same job:

```js
// paths.js (works on any Node.js version with ES modules)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

> **Note:** The `node:` prefix in `'node:path'` means "the built-in Node.js module called path", not a package from npm. It's optional, but it makes your code clearer, so this course always uses it.

### Loading JSON files

In CommonJS you could write `require('./data.json')`. In ES modules, you add an **import attribute** to say "this is JSON":

```js
// server.js (ES module)
import settings from './settings.json' with { type: 'json' };

console.log(settings.appName);
```

If you prefer, you can also read the file yourself:

```js
import { readFile } from 'node:fs/promises';

const settings = JSON.parse(await readFile(new URL('./settings.json', import.meta.url), 'utf8'));
```

### Top-level await

In ES modules you can use `await` directly at the top of a file, outside any function. That is handy for things like connecting to a database before starting the server:

```js
// server.js (ES module)
import app from './app.js';

const config = await loadConfig(); // imagine this reads settings from somewhere

app.listen(config.port, (error) => {
  if (error) throw error;
  console.log(`Running on port ${config.port}`);
});
```

In CommonJS this is a syntax error; you would have to wrap the code in an `async` function.

## Mixing the two systems

You will mostly mix them when an ES module project uses a CommonJS package from npm. That direction works smoothly:

- **ESM importing a CommonJS package**: works. `import express from 'express'` is exactly this, since Express is published as CommonJS. The package's `module.exports` becomes your default import.
- **CommonJS loading an ES module**: use `await import('./file.mjs')` inside an `async` function. Recent Node.js versions (22.12 and newer, and 20.19 and newer) can also `require()` most ES modules directly; the default export then appears as `.default`.

> **Tip:** The simplest rule: pick **one** system for your own files and stick to it. For new Express 5 projects, pick ES modules.

## Reading the error messages

These four errors cover almost every module problem you will hit:

| Error message | What it means | Fix |
| --- | --- | --- |
| `SyntaxError: Cannot use import statement outside a module` | You used `import` in a file Node.js treats as CommonJS | Set `"type": "module"` in `package.json` (not `"commonjs"`), or rename to `.mjs` |
| `ReferenceError: require is not defined in ES module scope` | You used `require` in an ES module | Change it to `import` |
| `ReferenceError: module is not defined in ES module scope` | You used `module.exports` in an ES module | Change it to `export` / `export default` |
| `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../greet'` | A relative import is missing its `.js`, or the path is wrong | Add the extension and check the spelling and folder |

## Converting an old tutorial to ESM

When you find an Express 4 tutorial written in CommonJS, translate it line by line:

```js
// old tutorial (CommonJS)
const express = require('express');
const path = require('path');
const router = express.Router();
const userRoutes = require('./routes/users');

module.exports = router;
```

```js
// the same code in ES modules
import express from 'express';
import path from 'node:path';
import userRoutes from './routes/users.js';

const router = express.Router();

export default router;
```

Notice the imports move to the top, local files gain `.js`, and `module.exports` becomes `export default`. Remember to check the *Express* code too: a few Express 4 patterns changed in Express 5, which you will learn about in the routing lessons.

## Key takeaways

- A **module** is a file that exports code for other files to import.
- **CommonJS** uses `require` and `module.exports`; **ES modules** use `import` and `export`. This course uses ES modules.
- `"type": "module"` in `package.json` makes `.js` files ES modules. `.mjs` is always ESM and `.cjs` is always CommonJS.
- In ES modules, relative imports need the `.js` extension, and `__dirname` becomes `import.meta.dirname` (Node.js 20.11+).
- ES modules can import CommonJS packages like Express with a normal default import.

## Practice

1. Create `utils/format.js` with two named exports, `upper(text)` and `shout(text)` (which adds `!`). Import and use both in `server.js`.
2. Change `upper` to the file's default export and update the import line to match.
3. Change `"type": "module"` to `"type": "commonjs"` in `package.json`, run the server, and read the error. Then change it back.
4. Translate this CommonJS line into ES module syntax: `const { Router } = require('express'); module.exports = Router();`

## What's next

Stopping and restarting the server after every change gets old fast. Let's make Node.js restart it for you. Continue with [The Dev Loop: node --watch and Nodemon](/courses/expressjs/dev-workflow-and-watch-mode).

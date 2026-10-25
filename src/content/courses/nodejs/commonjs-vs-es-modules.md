---
publishDate: 2026-10-25T08:30
title: CommonJS vs ES Modules
slug: commonjs-vs-es-modules
metadescription: Learn Node's two module systems, CommonJS with require and ES Modules with import, how Node picks between them and which one to use for new code.
updateDate: 2026-10-25T08:30
author: ['bishal-biswas']
level: 1
tags: ['modules', 'esm', 'commonjs']
course: nodejs
---

## What is a module?

A **module** is a JavaScript file that shares some of its code with other files.

Without modules, a growing program becomes one enormous file. With modules, you split it up: one file for maths helpers, one for talking to the database, one for the web server. Each file **exports** what others may use, and **imports** what it needs.

Think of a kitchen with labelled drawers. Cutlery goes in one, baking tools in another. When you need a whisk, you open the baking drawer instead of searching the whole kitchen.

## Two systems, one Node

Node has **two** module systems, for historical reasons:

- **CommonJS** (CJS): Node's original system from 2009. Uses `require()` and `module.exports`.
- **ES Modules** (ESM): the official JavaScript standard, also used by browsers. Uses `import` and `export`.

Both are fully supported in Node 24. New code should use ES Modules, but you will read plenty of CommonJS in older projects and tutorials, so you need to recognise both.

## CommonJS: `require` and `module.exports`

A CommonJS file puts what it wants to share on `module.exports`:

```javascript
// prices.cjs
function addTax(amount) {
  return amount * 1.2;
}

const currency = 'GBP';

module.exports = { addTax, currency };
```

Another file loads it with `require()`, which returns whatever `module.exports` was:

```javascript
// shop.cjs
const { addTax, currency } = require('./prices.cjs');
const fs = require('node:fs'); // built-in modules work the same way

console.log(addTax(10), currency); // prints: 12 GBP
```

```bash
node shop.cjs
```

You will also see a shorter form, which adds properties one at a time:

```javascript
exports.addTax = (amount) => amount * 1.2;
exports.currency = 'GBP';
```

## ES Modules: `import` and `export`

The same code as an ES module:

```javascript
// prices.mjs
export function addTax(amount) {
  return amount * 1.2;
}

export const currency = 'GBP';
```

```javascript
// shop.mjs
import { addTax, currency } from './prices.mjs';
import fs from 'node:fs';

console.log(addTax(10), currency); // prints: 12 GBP
```

These are called **named exports**: each one has a name, and you import it by that name inside `{ }`.

### Default exports

A module can also have one **default export**, its "main thing". You import it without braces and can give it any name you like:

```javascript
// greet.mjs
export default function greet(name) {
  return `Hello, ${name}!`;
}
```

```javascript
// app.mjs
import sayHello from './greet.mjs'; // any name works for a default import

console.log(sayHello('Maya')); // prints: Hello, Maya!
```

## How Node decides which system a file uses

This is the part that trips people up. Node looks at the **file extension** first:

| File | Treated as |
| --- | --- |
| `.mjs` | Always an ES module |
| `.cjs` | Always CommonJS |
| `.js` | Depends on the nearest `package.json` |

For `.js` files, Node finds the nearest `package.json` (in the same folder, or the closest parent folder) and reads its `"type"` field:

```json
{
  "name": "shop",
  "type": "module"
}
```

- `"type": "module"`: `.js` files are ES modules.
- `"type": "commonjs"`: `.js` files are CommonJS.
- No `"type"` at all: Node treats `.js` as CommonJS, unless the file contains `import` or `export`, in which case it runs it as an ES module. When this happens inside a project that has a `package.json`, Node prints a warning asking you to add `"type": "module"`, because guessing costs a little speed.

> **Tip:** For new projects, add `"type": "module"` to `package.json` and use plain `.js` files everywhere. You can set it from the terminal with `npm pkg set type=module`.

## The key differences

### File extensions are required in ESM

CommonJS lets you leave off the extension: `require('./prices')` finds `prices.js`. ES modules want the full file name:

```javascript
import { addTax } from './prices.js'; // the .js is required
```

Built-in modules (`node:fs`) and installed packages (`express`) do not need an extension.

### Top-level await only in ESM

ES modules can use `await` outside any function. CommonJS cannot:

```javascript
// config.mjs
import { readFile } from 'node:fs/promises';

const text = await readFile('settings.json', 'utf8'); // fine in ESM
console.log(JSON.parse(text));
```

### `__dirname` vs `import.meta`

CommonJS gives every file two handy variables: `__dirname` (the folder the file is in) and `__filename` (the file's full path). ES modules do not have them. Use `import.meta` instead:

```javascript
// where.mjs
console.log(import.meta.dirname);  // the folder, like __dirname
console.log(import.meta.filename); // the full path, like __filename
console.log(import.meta.url);      // the same path as a file:// URL
```

[Globals: process, __dirname and import.meta](/courses/nodejs/node-globals) goes deeper.

### Loading JSON

CommonJS can `require` a JSON file directly. ES modules use an **import attribute** that says "this is JSON":

```javascript
// CommonJS
const settings = require('./settings.json');
```

```javascript
// ES module
import settings from './settings.json' with { type: 'json' };
```

### Strict mode

ES modules always run in **strict mode**, a safer flavour of JavaScript that turns some silent mistakes into errors. For example, assigning to a variable you never declared:

```javascript
total = 5; // CommonJS: quietly creates a global. ESM: ReferenceError: total is not defined
```

### Summary table

| | CommonJS | ES Modules |
| --- | --- | --- |
| Share code | `module.exports = ...` | `export` / `export default` |
| Load code | `require('./file')` | `import ... from './file.js'` |
| Extension in path | Optional | Required |
| Top-level `await` | No | Yes |
| Current folder | `__dirname` | `import.meta.dirname` |
| Strict mode | Only if you opt in | Always |
| Used in browsers | No | Yes |

## Which should you use?

Use **ES Modules** for anything new. It is the JavaScript standard, it works in browsers too, and the whole ecosystem is moving towards it.

Use **CommonJS** when you are working in an existing CommonJS project. Converting a big project is a job of its own.

The two systems can load each other. The next lesson, [require(esm) and Module Interop](/courses/nodejs/require-esm-and-interop), shows exactly how.

## Common mistakes

### "Cannot use import statement outside a module"

```text
SyntaxError: Cannot use import statement outside a module
```

You used `import` in a `.js` file that Node treats as CommonJS. A common cause: `npm init -y` now writes `"type": "commonjs"` into `package.json`. Change it to `"module"`, or rename the file to `.mjs`.

### "require is not defined in ES module scope"

```text
ReferenceError: require is not defined in ES module scope, you can use import instead
```

You used `require` in an ES module. Switch to `import`:

```javascript
// Wrong (in an ES module)
const fs = require('node:fs');
```

```javascript
// Right
import fs from 'node:fs';
```

The same goes for `__dirname is not defined in ES module scope`: use `import.meta.dirname`.

### Forgetting the extension

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/asha/shop/prices' imported from /Users/asha/shop/app.js
Did you mean to import "./prices.js"?
```

Node even suggests the fix. Write `'./prices.js'`, not `'./prices'`.

## Quick recap

- A **module** is a file that shares code through exports and imports.
- **CommonJS** uses `require()` and `module.exports`. **ES Modules** use `import` and `export`.
- `.mjs` is always ESM, `.cjs` is always CommonJS, and `.js` follows `"type"` in the nearest `package.json`.
- ESM needs file extensions in relative imports, supports top-level `await`, runs in strict mode, and uses `import.meta.dirname` instead of `__dirname`.
- Use ES Modules for new code, with `"type": "module"` in `package.json`.

<code id="code-content" class="language-javascript">
// modules-demo.mjs: ES modules and CommonJS side by side
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
// --- Create a tiny CommonJS module and an ES module in a temp folder
const dir = path.join(os.tmpdir(), 'modules-demo');
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'prices.cjs'), [
  'const addTax = (amount) =&gt; amount * 1.2;',
  'module.exports = { addTax, currency: "GBP" };',
].join('\n'));
await writeFile(path.join(dir, 'greet.mjs'), [
  'export default function greet(name) { return `Hello, ${name}!`; }',
  'export const shout = (text) =&gt; text.toUpperCase();',
].join('\n'));
// --- ES module: default and named imports (import() wants a file URL for full paths)
const greetUrl = pathToFileURL(path.join(dir, 'greet.mjs')).href;
const { default: greet, shout } = await import(greetUrl); // top-level await: ESM only
console.log(greet('Maya'), shout('sale today'));
// --- CommonJS from ESM, way 1: import() gives module.exports as "default"
const pricesUrl = pathToFileURL(path.join(dir, 'prices.cjs')).href;
const prices = (await import(pricesUrl)).default;
console.log('With tax:', prices.addTax(10), prices.currency);
// --- CommonJS from ESM, way 2: build a require() function
const require = createRequire(import.meta.url);
const again = require(path.join(dir, 'prices.cjs'));
console.log('Same object both ways?', again === prices);
// --- ESM has import.meta instead of __dirname and __filename
console.log('This folder:', import.meta.dirname);
console.log('typeof __dirname here:', typeof __dirname);
// --- ESM is always strict mode
try {
  undeclaredTotal = 5;
} catch (error) {
  console.log('Strict mode says:', error.message);
}
</code></pre>

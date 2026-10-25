---
publishDate: 2026-10-25T08:35
title: require(esm) and Module Interop
slug: require-esm-and-interop
metadescription: Mix CommonJS and ES modules in Node.js. Import CommonJS from ESM, load ES modules with require(), and avoid the top-level await and named export traps.
updateDate: 2026-10-25T08:35
author: ['bishal-biswas']
level: 1
tags: ['modules', 'esm', 'commonjs', 'interop']
course: nodejs
---

## Why interop matters

In [CommonJS vs ES Modules](/courses/nodejs/commonjs-vs-es-modules) you met Node's two module systems. In real projects they meet each other all the time.

Your app might be written in ES modules but depend on an older package written in CommonJS. Or you might maintain an older CommonJS app and want to use a new package that only ships ES modules.

**Interop** (short for interoperability) means the two systems working together. Think of two people who speak different languages, with a translator between them. Node is the translator, and this lesson shows what it can and cannot translate.

There are two directions:

1. An **ES module loading CommonJS**. This has always worked.
2. A **CommonJS file loading an ES module**. This used to be painful, and `require(esm)` fixed it.

## Direction 1: ES modules importing CommonJS

Say you have this CommonJS file:

```javascript
// prices.cjs
function addTax(amount) {
  return amount * 1.2;
}
const currency = 'GBP';

module.exports = { addTax, currency };
```

An ES module can import it like any other module:

```javascript
// shop.mjs
import prices from './prices.cjs';            // the whole module.exports object
import { addTax, currency } from './prices.cjs'; // named imports also work here

console.log(prices.addTax(10)); // prints: 12
console.log(addTax(10), currency); // prints: 12 GBP
```

The rule to remember: **the default import is always `module.exports`**. Whatever the CommonJS file assigned to `module.exports` arrives as the default.

### When named imports fail

Named imports from CommonJS work only when Node can **spot the names by reading the code**, without running it. Node scans for simple patterns such as `exports.name = ...` or `module.exports = { name1, name2 }`.

If the object is built up step by step, Node cannot see the names in advance:

```javascript
// api.cjs
const api = {};
api.greet = (name) => `Hi, ${name}`;
module.exports = api;
```

```javascript
// app.mjs
import { greet } from './api.cjs';
```

```text
SyntaxError: Named export 'greet' not found. The requested module './api.cjs' is a CommonJS module, which may not support all module.exports as named exports.
CommonJS modules can always be imported via the default export, for example using:

import pkg from './api.cjs';
const { greet } = pkg;
```

The error message tells you the fix. Import the default, then pull the names out of it:

```javascript
// app.mjs
import api from './api.cjs';
const { greet } = api;

console.log(greet('Asha')); // prints: Hi, Asha
```

### Using `require` inside an ES module

Occasionally you really want `require` in an ES module, for example to load a file whose name you only know at runtime. Node's `createRequire` builds one for you:

```javascript
// loader.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url); // a require() that resolves from this file
const prices = require('./prices.cjs');

console.log(prices.currency); // prints: GBP
```

## Direction 2: CommonJS loading ES modules

### The old problem

For years, calling `require()` on an ES module threw an error. The only way to load ESM from CommonJS was dynamic `import()`, which returns a promise:

```javascript
// old-way.cjs
import('./slug.mjs').then((slugModule) => {
  console.log(slugModule.default('Hello World'));
});
```

That works, but it forces async code into places that were simple before. When popular packages started shipping **only** ES modules, many CommonJS projects were stuck.

### The fix: `require(esm)`

Modern Node lets `require()` load ES modules directly. This is known as **`require(esm)`**.

- It is switched on by default in Node 24 (and from Node 22.12 and 20.19).
- Since Node 22.13 it no longer prints an experimental warning.
- Node 24.15 removed its experimental label entirely.

Take this ES module:

```javascript
// slug.mjs
export default function slugify(text) {
  return text.toLowerCase().trim().replace(/\s+/g, '-');
}
export const version = '1.0.0';
```

A CommonJS file can now simply `require` it:

```javascript
// blog.cjs
const slugModule = require('./slug.mjs');

console.log(slugModule);
console.log(slugModule.default('Hello Node World'));
```

```text
[Module: null prototype] {
  __esModule: true,
  default: [Function: slugify],
  version: '1.0.0'
}
hello-node-world
```

### What you get back

`require(esm)` returns the module's **namespace object**: one object holding every export.

- Named exports appear under their names, like `version`.
- The default export appears under the key **`default`**.
- `__esModule: true` is a marker for build tools that convert between the two systems. You can ignore it.

Destructuring makes this tidy:

```javascript
const { default: slugify, version } = require('./slug.mjs');
console.log(slugify('My First Post'), version); // prints: my-first-post 1.0.0
```

### Choosing what `require` returns

If you write an ES module that CommonJS users will load, you can decide exactly what `require()` hands back. Export it under the special string name `'module.exports'`:

```javascript
// greet.mjs
export default function greet(name) {
  return `Hello, ${name}!`;
}
export { greet as 'module.exports' };
```

```javascript
// app.cjs
const greet = require('./greet.mjs'); // the function itself, no .default needed
console.log(greet('Maya')); // prints: Hello, Maya!
```

When you use `'module.exports'`, CommonJS users get only that value, so any other named exports are not visible to them.

## The one big limitation: top-level await

`require()` is **synchronous**: it must return the module straight away. An ES module that uses top-level `await` cannot finish straight away, so `require()` refuses it:

```javascript
// settings.mjs
const response = await fetch('https://example.com/settings.json');
export const settings = await response.json();
```

```javascript
// app.cjs
const { settings } = require('./settings.mjs');
```

```text
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await. Use import() instead. To see where the top-level await comes from, use --experimental-print-required-tla.
```

The fix is the one the message gives: use `import()` for that module.

```javascript
// app.cjs
import('./settings.mjs').then(({ settings }) => {
  console.log(settings);
});
```

This also applies if **anything the module imports** uses top-level await, not just the file itself.

## Checking support and usage

Code that must also run on older Node versions can check whether `require(esm)` is available:

```javascript
if (process.features.require_module) {
  console.log('require() can load ES modules here');
}
```

To find every place your app uses `require(esm)`, start Node with this flag:

```bash
node --trace-require-module=all app.cjs
```

## Packages with two entry points

Some packages ship both a CommonJS and an ES module version. Their `package.json` uses the **`exports`** field to say which file each system should get:

```json
{
  "name": "tiny-date",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.cjs"
    }
  }
}
```

`import 'tiny-date'` loads `index.mjs`, and `require('tiny-date')` loads `index.cjs`. You will see the `exports` field again in [package.json Explained](/courses/nodejs/package-json-explained). Thanks to `require(esm)`, many package authors now ship only an ES module version, since CommonJS users can load it too.

## Quick cheat sheet

| You are in... | You want to load... | Use |
| --- | --- | --- |
| ES module | CommonJS | `import x from './file.cjs'` (default is `module.exports`) |
| ES module | ES module | `import { x } from './file.js'` |
| CommonJS | CommonJS | `require('./file.cjs')` |
| CommonJS | ES module, no top-level await | `require('./file.mjs')` |
| CommonJS | ES module with top-level await | `await import('./file.mjs')` inside an async function |

## Common mistakes

### Forgetting `.default`

```javascript
const slugify = require('./slug.mjs');
slugify('Hello'); // TypeError: slugify is not a function
```

`require(esm)` gives you the namespace object, not the default export. Use `require('./slug.mjs').default`, destructure `{ default: slugify }`, or have the module export `'module.exports'`.

### Converting everything because of one module

If a single module uses top-level `await`, you do not need to rewrite your CommonJS app. Load that one module with `import()` and keep `require` everywhere else.

## Quick recap

- ES modules can import CommonJS. The default import is `module.exports`, and named imports work when Node can detect the names.
- `createRequire(import.meta.url)` gives an ES module its own `require`.
- **`require(esm)`** lets CommonJS load ES modules directly. It is on by default in Node 24.
- It returns the namespace object: the default export lives under `.default`.
- An ES module can export `'module.exports'` to control what `require` returns.
- Modules with top-level `await` cannot be required. Use `import()` for them.

<code id="code-content" class="language-javascript">
// interop-demo.mjs: both directions of CommonJS and ESM interop
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const dir = path.join(os.tmpdir(), 'interop-demo');
await mkdir(dir, { recursive: true });
const save = (name, lines) =&gt; writeFile(path.join(dir, name), lines.join('\n'));
// --- An ES module with a default and a named export
await save('slug.mjs', [
  'export default (text) =&gt; text.toLowerCase().trim().replace(/\\s+/g, "-");',
  'export const version = "1.0.0";',
]);
// --- An ES module that chooses what require() returns
await save('greet.mjs', [
  'const greet = (name) =&gt; `Hello, ${name}!`;',
  'export { greet as "module.exports" };',
]);
// --- An ES module with top-level await (cannot be required)
await save('slow.mjs', ['await new Promise((r) =&gt; setTimeout(r, 10));', 'export const ready = true;']);
// --- A CommonJS file that uses require(esm)
await save('blog.cjs', [
  'const { default: slugify, version } = require("./slug.mjs");',
  'const greet = require("./greet.mjs");',
  'module.exports = { slug: slugify("My First Post"), version, hello: greet("Maya") };',
]);
// Load the CommonJS file from here with a require() made for this module
const require = createRequire(import.meta.url);
console.log('require(esm) supported:', process.features.require_module);
console.log('From blog.cjs:', require(path.join(dir, 'blog.cjs')));
// --- Top-level await blocks require(), but import() still works
try {
  require(path.join(dir, 'slow.mjs'));
} catch (error) {
  console.log('require failed with', error.code);
}
const slow = await import(pathToFileURL(path.join(dir, 'slow.mjs')).href);
console.log('import() worked, ready =', slow.ready);
</code></pre>

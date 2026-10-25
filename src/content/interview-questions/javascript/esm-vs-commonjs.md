---
course: javascript
slug: esm-vs-commonjs
experienceLevel: mid
difficulty: hard
tags:
  - modules
  - nodejs
question: What are the differences between ES modules and CommonJS?
answer: |
  ES modules (`import`/`export`) are the standard JavaScript module system, statically analysable and loaded asynchronously, while CommonJS (`require`/`module.exports`) is Node.js's original system, which loads modules synchronously at runtime.

  Main differences:

  - **Syntax**: `import { x } from './a.js'` and `export const x` versus `const { x } = require('./a')` and `module.exports = { x }`.
  - **Static vs dynamic**: `import` declarations must be at the top level with string literal paths, so tools know the dependency graph before running code. That enables tree shaking. `require` can be called anywhere with any expression.
  - **Loading**: ESM is parsed and linked first, then evaluated, and supports top-level `await`. `require` is synchronous and runs the module immediately.
  - **Bindings**: ESM imports are **live, read-only bindings** to the exporter's variables. CommonJS gives you whatever value `module.exports` held, so destructured primitives are copies.
  - **Strict mode**: ESM is always strict.
  - **Module globals**: CommonJS has `require`, `module`, `exports`, `__filename` and `__dirname`. ESM uses `import.meta.url`, and Node.js 20.11+ adds `import.meta.dirname` and `import.meta.filename`.
  - **File resolution**: ESM in Node.js requires full relative paths with extensions (`./utils.js`); CommonJS resolves `./utils` automatically.

  How Node.js decides: `.mjs` is ESM, `.cjs` is CommonJS, and `.js` follows the nearest `package.json` `"type"` field (`"module"` or the default `"commonjs"`). Recent versions also detect ESM syntax in ambiguous `.js` files.

  Interop:

  - ESM can `import` CommonJS; `module.exports` becomes the default export, and named exports are detected on a best-effort basis.
  - CommonJS can load ESM with dynamic `import()`. Node.js 22.12+ and 20.19+ also allow `require()` of ESM modules that do not use top-level `await`.

  For new code, write ESM. Libraries that still need to support older consumers often publish both formats using the `"exports"` field in `package.json`.
codeExample: |
  // demo.mjs (run with: node demo.mjs)
  import { writeFileSync } from 'node:fs';
  import { createRequire } from 'node:module';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  import { pathToFileURL } from 'node:url';

  const dir = tmpdir();
  writeFileSync(join(dir, 'counter.cjs'),
    'let count = 0; module.exports = { count, inc() { count++; } };');
  writeFileSync(join(dir, 'counter.mjs'),
    'export let count = 0; export function inc() { count++; }');

  const require = createRequire(import.meta.url);   // require is not built into ESM
  const cjs = require(join(dir, 'counter.cjs'));    // synchronous, value snapshot
  cjs.inc();
  console.log('CommonJS count:', cjs.count);        // Output: CommonJS count: 0

  const esm = await import(pathToFileURL(join(dir, 'counter.mjs')).href); // async, top-level await
  esm.inc();
  console.log('ESM count:', esm.count);             // Output: ESM count: 1 (live binding)

  try { esm.count = 5; } catch (e) { console.log(e.constructor.name); } // Output: TypeError

  console.log(typeof __dirname, typeof import.meta.dirname); // Output: undefined string
popularity: 8.6
isPublished: true
---

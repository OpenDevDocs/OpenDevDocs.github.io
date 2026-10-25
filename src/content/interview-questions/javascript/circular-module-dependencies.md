---
course: javascript
slug: circular-module-dependencies
experienceLevel: senior
difficulty: hard
tags:
  - modules
  - esm
  - commonjs
question: What happens with circular module dependencies in CommonJS and ES modules, and how do you deal with them?
answer: |
  A cycle (A imports B, B imports A) is legal in both systems, but one module inevitably sees the other **before it has finished evaluating**. The two systems fail differently.

  **CommonJS** caches a module's `exports` object as soon as loading starts. When B calls `require('./a')` in the middle of A's execution, it gets A's **partially filled** `exports`: whatever A assigned before its own `require('./b')`. Nothing throws. You just read `undefined` later. If A replaces `module.exports = {...}` after the cycle, B keeps a reference to the stale original object.

  **ES modules** link first and evaluate afterwards. Imports are **live bindings** to the exporter's variables, not copies. Evaluation is depth-first, so the module reached second in the cycle runs first. If it touches an imported `let`, `const` or `class` binding at the top level before the exporter has run, it throws a `ReferenceError` (temporal dead zone). Hoisted function declarations are available. Accessing the binding later, inside a function called after loading, works fine.

  How to deal with them in a real codebase:

  - Detect cycles with tooling: `madge --circular`, ESLint's `import/no-cycle`, or bundler warnings (Rollup reports circular dependencies).
  - Break the cycle structurally: move the shared piece into a third module, invert the dependency by passing it as a parameter, or merge two modules that are really one.
  - Make top-level code free of cross-module work. Defer access into functions so evaluation order stops mattering.
  - Watch for **barrel files** (`index.js` re-exporting everything). They are the most common source of accidental cycles and also hurt tree-shaking and startup time.

  Symptoms to recognise: `undefined is not a function` on an import that clearly exists, `Cannot access 'X' before initialization`, or a class that is `undefined` when used with `extends`.
codeExample: |
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { pathToFileURL } = require('node:url');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cycle-'));
  const write = (name, src) => fs.writeFileSync(path.join(dir, name), src);

  // CommonJS: b sees a partially initialised exports object
  write('a.js', `exports.name = 'a';
  const b = require('./b.js');
  console.log('in a, b.name =', b.name);
  exports.ready = true;`);
  write('b.js', `const a = require('./a.js');
  console.log('in b, a has', Object.keys(a));
  exports.name = 'b';`);
  require(path.join(dir, 'a.js'));
  // Output: in b, a has [ 'name' ]
  // Output: in a, b.name = b

  // ESM: y evaluates first and hits x's temporal dead zone
  write('x.mjs', `import { y } from './y.mjs';
  export const x = 'x';
  console.log('x sees', y);`);
  write('y.mjs', `import { x } from './x.mjs';
  export const y = 'y';
  try { console.log(x); } catch (e) { console.log('y:', e.name); }`);
  import(pathToFileURL(path.join(dir, 'x.mjs')).href);
  // Output: y: ReferenceError
  // Output: x sees y
popularity: 7.4
isPublished: true
---

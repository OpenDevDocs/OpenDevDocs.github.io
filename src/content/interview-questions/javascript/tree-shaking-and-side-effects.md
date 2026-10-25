---
course: javascript
slug: tree-shaking-and-side-effects
experienceLevel: senior
difficulty: hard
tags:
  - bundlers
  - performance
  - modules
question: How does tree-shaking work, and why do side effects stop it from removing code?
answer: |
  **Tree-shaking** is dead-code elimination based on the **static structure** of ES modules. Because `import` and `export` are declarations that can't be computed at runtime, a bundler (Rollup, webpack, esbuild, Rolldown) can build a graph of which exports are actually used and drop the rest. It works at two levels:

  - **Unused exports** inside a module are removed if nothing else depends on them.
  - **Whole modules** can be skipped if none of their exports are used **and** evaluating them has no side effects.

  The catch is **side effects**. The bundler must preserve any code that might be observable: top-level function calls, writes to globals, polyfills, CSS imports, class definitions with static blocks or decorators. It can't prove that `const x = makeRegistry()` is harmless, so it keeps the call even when `x` is never used. That is why one innocent-looking top-level statement can pull a large dependency into the bundle.

  Tools to give the bundler the information it lacks:

  - `"sideEffects": false` in `package.json` declares that the package's modules can be dropped entirely when unused. Use an array, such as `["*.css", "./src/polyfills.js"]`, to list the files that do have effects. Getting this wrong silently removes needed code.
  - `/*#__PURE__*/` (or `/*@__PURE__*/`) annotations before a call mark it as free of side effects, so it can be removed if its result is unused.
  - Publish **ESM** builds. CommonJS `require` and `module.exports` are dynamic, and most bundlers can only shake them partially.

  Common blockers in real codebases: barrel files with eager re-exports and top-level work, libraries that ship only CommonJS, `import * as ns` used dynamically (`ns[key]`), and patching prototypes at import time. Verify results with a bundle analyser rather than assuming.
codeExample: |
  // npm install rollup  (uses Rollup's JS API with in-memory modules)
  const { rollup } = require('rollup');

  const files = {
    'entry.js': `import { add } from './math.js'; console.log(add(1, 2));`,
    'math.js': `
      export const add = (a, b) => a + b;
      export const mul = (a, b) => a * b;               // unused: removed
      export const pureTable = /*#__PURE__*/ build();   // unused + pure: removed
      export const registry = build();                  // unused, may have effects: kept
      function build() { globalThis.count = (globalThis.count || 0) + 1; return []; }`,
  };
  const virtual = {
    name: 'virtual',
    resolveId: (id) => id.replace('./', ''),
    load: (id) => files[id],
  };

  (async () => {
    const bundle = await rollup({ input: 'entry.js', plugins: [virtual] });
    const { output } = await bundle.generate({ format: 'es' });
    console.log(output[0].code);
  })();
  // Output:
  // const add = (a, b) => a + b;
  //     build();                  // unused, may have effects: kept
  //     function build() { globalThis.count = (globalThis.count || 0) + 1; return []; }
  //
  // console.log(add(1, 2));
popularity: 7.7
isPublished: true
---

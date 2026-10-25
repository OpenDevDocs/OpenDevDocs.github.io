---
course: javascript
slug: es-modules-import-export
experienceLevel: fresher
difficulty: medium
tags:
  - modules
  - es6
question: "How do ES modules work with `import` and `export`?"
answer: |
  ES modules (ESM) are JavaScript's built-in module system: each file has its own scope, shares values with `export`, and uses values from other files with `import`.

  **Exports** come in two kinds:

  - **Named exports:** `export const PI = 3.14;` or `export function add() {}`. A module can have many. They are imported with the same name in braces: `import { add, PI } from "./math.js";`, and can be renamed: `import { add as sum }`.
  - **Default export:** `export default class Cart {}`. Only one per module, imported without braces under any name: `import Cart from "./cart.js";`.

  You can also import everything as a namespace object (`import * as math from "./math.js"`), re-export from another file (`export { add } from "./math.js"`), and load a module on demand with **dynamic import**, `await import("./chart.js")`, which returns a promise and is used for code splitting.

  How modules behave:

  - Top-level variables are private to the module; nothing leaks into the global scope.
  - Module code always runs in **strict mode**, and top-level `this` is `undefined`.
  - A module is evaluated **once**, however many files import it, so all importers share the same instance.
  - Imports are **live bindings**, read-only views of the exported variable, not copies.
  - Static `import` statements are hoisted and must be at the top level, which lets bundlers do tree shaking.
  - Top-level `await` is allowed.

  To use ESM: in the browser, add `<script type="module">`. In Node.js, use the `.mjs` extension or set `"type": "module"` in `package.json`. Relative paths in Node.js need the file extension.

  The older Node.js system is **CommonJS** (`require` and `module.exports`). Modern Node.js can `require` most ES modules too, but new code should prefer ESM.
codeExample: |
  // math.js
  export const PI = 3.14159;
  export function area(radius) {
    return PI * radius ** 2;
  }
  export default function round(n) {
    return Math.round(n * 100) / 100;
  }

  // main.js (run with: node main.js, alongside "type": "module" in package.json)
  import round, { area, PI as pi } from "./math.js";
  import * as math from "./math.js";

  console.log(pi); // Output: 3.14159
  console.log(round(area(2))); // Output: 12.57
  console.log(typeof math.area, math.default === round); // Output: function true

  const { default: lazyRound } = await import("./math.js"); // dynamic import
  console.log(lazyRound(1.005)); // Output: 1
  console.log(this); // Output: undefined
popularity: 8.6
isPublished: true
---

---
course: javascript
slug: bundlers-and-transpilers
experienceLevel: mid
difficulty: medium
tags:
  - tooling
  - bundlers
  - build
question: What do bundlers and transpilers do, and how do Vite, webpack, esbuild and Babel differ?
answer: |
  A **transpiler** rewrites source code into a different flavour of JavaScript (TypeScript or JSX into plain JS, new syntax into older syntax), while a **bundler** follows your `import` graph and combines many modules and assets into a few optimised files for the browser.

  What a bundler typically does:

  - Resolves imports, including bare package names from `node_modules`.
  - **Tree shaking**: drops exports that are never imported (works best with ES modules and side-effect-free packages).
  - **Code splitting** at dynamic `import()` points, minification, content-hashed file names for long-term caching, CSS and asset handling, and source maps.

  The common tools:

  - **Babel**: a transpiler only. Plugin-based and very flexible, used with `@babel/preset-env` to target older browsers and for custom code transforms. Relatively slow because it is written in JavaScript.
  - **esbuild**: written in Go, extremely fast. Both a transpiler (TS, JSX) and a capable bundler. It strips TypeScript types without type checking.
  - **webpack**: the long-established, highly configurable bundler with a huge loader and plugin ecosystem (module federation, complex legacy setups). Slower and more configuration-heavy. Rspack is a Rust-based webpack-compatible alternative.
  - **Vite**: a dev server plus build tool. In development it serves native ES modules to the browser and transforms files on demand, so start-up and hot module replacement are fast regardless of app size. For production it bundles with Rollup, with the Rust-based Rolldown replacing Rollup and esbuild in newer versions.
  - **SWC** and `tsc` are other transpilers; `tsc` is the only one here that **type checks**.

  Practical points:

  1. Fast transpilers (esbuild, SWC, Babel) do not check types, so run `tsc --noEmit` separately in CI or the editor.
  2. Transpiling syntax is not the same as polyfilling APIs: `?.` can be rewritten, but `Array.prototype.toSorted` needs a polyfill such as core-js.
  3. Configure targets with a `browserslist` or `build.target` setting so you do not ship unnecessary down-levelled code to modern browsers.
codeExample: |
  // Uses esbuild's JavaScript API: npm install esbuild
  const esbuild = require('esbuild');

  const source = `
    type User = { name?: string };
    export const greet = (u: User) => \`Hi \${u.name ?? 'guest'}\`;
  `;

  // Transpile TypeScript: types are stripped, nothing is type checked
  const modern = esbuild.transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022' });
  console.log(modern.code.replace(/\s+/g, ' ').trim());
  // Output: const greet = (u) => `Hi ${u.name ?? "guest"}`; export { greet };

  // Down-level the same code for an old target: ?? is rewritten
  const legacy = esbuild.transformSync(source, { loader: 'ts', format: 'esm', target: 'es2019' });
  console.log(legacy.code.includes('??'), legacy.code.includes('!= null')); // Output: false true

  // Minify for production
  const min = esbuild.transformSync(source, { loader: 'ts', minify: true, format: 'esm' });
  console.log(min.code.trim());
  // Output: const t=e=>`Hi ${e.name??"guest"}`;export{t as greet};

  // A type error is NOT reported by a transpiler
  const wrong = esbuild.transformSync('const n: number = "oops";', { loader: 'ts' });
  console.log(wrong.code.trim()); // Output: const n = "oops";
popularity: 7.5
isPublished: true
---

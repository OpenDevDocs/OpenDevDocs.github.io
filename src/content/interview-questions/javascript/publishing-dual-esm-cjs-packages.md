---
course: javascript
slug: publishing-dual-esm-cjs-packages
experienceLevel: senior
difficulty: hard
tags:
  - modules
  - npm
  - node
question: How do you publish a package that works for both ESM and CommonJS consumers, and what is the dual package hazard?
answer: |
  The modern tool is the `exports` field in `package.json`. It defines the package's public entry points and uses **conditions** to pick a file per environment. Node checks conditions in the order you write them, so order matters:

  - `"types"` first, for TypeScript.
  - `"import"` for `import` and `import()`, and `"require"` for `require()`.
  - `"default"` last, as the fallback.
  - Bundler-specific conditions such as `"browser"` or `"module"` as needed.

  Once `exports` exists, **deep imports are blocked** unless you list them, which is a breaking change if consumers relied on internal paths. Also set `"type"` deliberately, because it decides whether `.js` files are ESM or CJS. Use explicit `.mjs` and `.cjs` extensions to avoid ambiguity.

  The **dual package hazard**: if you ship separate ESM and CJS builds, one application can load **both copies**, one through `import` and another through a dependency's `require`. Each copy has its own module state, so singletons, caches and registries split, and `instanceof` fails across them. Mitigations:

  - Make the ESM entry a thin wrapper that re-exports the CJS build, so there's one implementation.
  - Keep state in a shared place (for example `globalThis` keyed by a registered symbol).
  - Go **ESM-only** if your supported Node versions allow it.

  That last option became realistic recently. **`require(esm)`** is enabled by default in Node 22.12+ and 20.19+, so CommonJS code can `require()` an ES module synchronously, as long as its graph has **no top-level `await`** (otherwise it throws `ERR_REQUIRE_ASYNC_MODULE`). Node also added a `"module-sync"` condition for packages that want to serve ESM to both `import` and `require`. Check your consumers' minimum Node version and bundlers before dropping CJS.

  Validate the result with `publint` and `@arethetypeswrong/cli`, and test the packed tarball (`npm pack`) from both a CJS and an ESM consumer.
codeExample: |
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');

  // Build a tiny dual package in a temp folder
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dual-'));
  const pkg = path.join(root, 'node_modules', 'dual-demo');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({
    name: 'dual-demo',
    exports: { '.': { import: './index.mjs', require: './index.cjs' } },
  }));
  fs.writeFileSync(path.join(pkg, 'index.cjs'), 'exports.format = "cjs"; exports.Registry = class {};');
  fs.writeFileSync(path.join(pkg, 'index.mjs'), 'export const format = "esm"; export class Registry {}');
  fs.writeFileSync(path.join(root, 'esm-only.mjs'), 'export const answer = 42;');

  fs.writeFileSync(path.join(root, 'app.cjs'), `
    const viaRequire = require('dual-demo');
    import('dual-demo').then((viaImport) => {
      console.log(viaRequire.format, viaImport.format);
      console.log('same class?', viaRequire.Registry === viaImport.Registry);
      console.log('require(esm):', require('./esm-only.mjs').answer);
    });`);
  require(path.join(root, 'app.cjs'));
  // Output:
  // cjs esm
  // same class? false        <- the dual package hazard
  // require(esm): 42         <- Node 22.12+ / 20.19+, no top-level await allowed
popularity: 7.4
isPublished: true
---

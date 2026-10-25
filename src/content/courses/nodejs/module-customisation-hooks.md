---
publishDate: 2026-10-25T12:05
title: Module Customisation Hooks and Loaders
slug: module-customisation-hooks
metadescription: Change how Node.js finds and loads modules with module.registerHooks(). Write resolve and load hooks for aliases, text imports and code transforms.
updateDate: 2026-10-25T12:05
author: ['bishal-biswas']
level: 3
tags: ['modules', 'hooks', 'loaders', 'esm']
course: nodejs
---

## What are module hooks?

Every time your code says `import x from 'something'` or `require('something')`, Node does two jobs:

1. **Resolve**: work out *which file* `'something'` means, as a full URL like `file:///home/asha/app/node_modules/something/index.js`.
2. **Load**: read that file and decide what kind of code it is (an ES module, CommonJS, JSON and so on).

**Module customisation hooks** let you step into either job and change the answer.

Think of a library. You ask the desk for "the blue cookbook". The librarian looks up where it is shelved (resolve), then fetches it (load). A hook is like standing next to the librarian and saying "when someone asks for the blue cookbook, give them the new edition" or "when you fetch a recipe card, photocopy it onto A4 first".

This is how tools add features to Node itself: importing `.txt` or `.yaml` files, path aliases like `@app/utils`, running languages that compile to JavaScript, or measuring test coverage.

## The API: module.registerHooks()

In Node 24, the recommended API is **`registerHooks()`** from `node:module`. It was added in Node 22.15 and 23.5, and current Node 24 releases mark it as a **release candidate**, meaning it is close to stable.

```javascript
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    // decide which URL a specifier points to
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    // decide what source code a URL contains
    return nextLoad(url, context);
  },
});
```

Both hooks are **synchronous** (plain functions, no `async`) and run **in-thread**, on the same thread as your app. They apply to `import`, `import()` and `require()` alike.

Each hook receives a `next...` function. Calling it means "do whatever would normally happen". Hooks form a **chain**: if several are registered, each one can pass the job along to the next, and the last one in the chain is Node's built-in behaviour.

## A load hook: importing text files

Out of the box, Node cannot import a `.txt` file:

```javascript
// app.mjs
import letter from './letter.txt';
console.log(letter);
```

```text
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".txt"
```

A `load` hook can turn the text into a tiny JavaScript module on the fly:

```javascript
// hooks.mjs
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.txt')) {
      const text = readFileSync(new URL(url), 'utf8');
      return {
        format: 'module', // treat the result as an ES module
        source: `export default ${JSON.stringify(text)};`,
        shortCircuit: true, // we are done, do not call nextLoad
      };
    }
    return nextLoad(url, context); // every other file loads normally
  },
});
```

`load` returns an object with:

- `source`: the code (a string or buffer).
- `format`: what kind of code it is, such as `'module'`, `'commonjs'` or `'json'`.
- `shortCircuit: true`: needed when you return without calling `nextLoad`, to show that skipping the rest of the chain is deliberate.

## Registering hooks before your app

Hooks must be registered **before** the modules they affect are loaded. The simplest way is the `--import` flag, which runs a file before your entry point:

```bash
node --import ./hooks.mjs app.mjs
```

```text
Dear Asha,
Your order has shipped.
```

`--require ./hooks.mjs` works too. Either way, the hooks are active before the first line of `app.mjs` is even read.

To avoid typing the flag every time, put it in a `package.json` script:

```json
{
  "scripts": {
    "start": "node --import ./hooks.mjs app.mjs"
  }
}
```

## A resolve hook: path aliases

Deep relative imports like `../../../lib/greet.mjs` are hard to read. A `resolve` hook can map a prefix such as `@app/` to your `src` folder:

```javascript
// alias-hooks.mjs
import { registerHooks } from 'node:module';

const srcUrl = new URL('./src/', import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@app/')) {
      const url = new URL(specifier.slice('@app/'.length), srcUrl).href;
      return { url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
```

```javascript
// app.mjs
import { greet } from '@app/lib/greet.mjs'; // means ./src/lib/greet.mjs
console.log(greet('Ravi'));
```

```bash
node --import ./alias-hooks.mjs app.mjs
```

```text
Hello, Ravi
```

`resolve` receives:

- `specifier`: the exact text in the `import` or `require`.
- `context.parentURL`: the URL of the file doing the importing.
- `nextResolve`: Node's normal resolution (or the next hook).

It returns at least a `url`, and can also return a `format` hint.

> **Tip:** For simple aliases you may not need a hook at all. The `"imports"` field in `package.json` supports aliases starting with `#`, like `#lib/greet.mjs`, natively. Hooks are for when you need logic that field cannot express.

## Transforming code

A `load` hook can also call `nextLoad` first and then **change** the source. This is how compilers plug into Node. Here is a toy one that adds a log line to the top of every one of your own ES modules:

```javascript
// transform-hooks.mjs
import { registerHooks } from 'node:module';

registerHooks({
  load(url, context, nextLoad) {
    const result = nextLoad(url, context); // let Node read the file first
    if (url.startsWith('file:') && !url.includes('/node_modules/') && result.format === 'module') {
      const banner = `console.log('[loaded] ${url.split('/').pop()}');\n`;
      return { ...result, source: banner + String(result.source) };
    }
    return result;
  },
});
```

```text
[loaded] greet.mjs
[loaded] app.mjs
Hello, Maya
```

Notice the order: `greet.mjs` runs before `app.mjs`, because a module's imports are evaluated before the module itself.

> **Note:** `result.source` may be a `Buffer`, so convert it with `String()` before editing it.

## Removing hooks

`registerHooks()` returns an object with a `deregister()` method. After calling it, new imports go back to normal behaviour:

```javascript
const hooks = registerHooks({ /* ... */ });
// later
hooks.deregister();
```

Modules already loaded stay loaded. Node caches them.

## The older API: module.register()

You may meet older code that uses **`module.register()`** with hooks in a separate file:

```javascript
import { register } from 'node:module';
register('./async-hooks.mjs', import.meta.url); // the hooks run on a separate thread
```

That API runs **asynchronous** hooks on a **separate thread**. Having them on another thread caused many surprises: hooks could not share variables with your app, and some `require()` paths were not covered. The even older `--experimental-loader` flag used the same off-thread design.

- In Node 24, `module.register()` still works, but recent Node 24 docs mark it as deprecated.
- In **Node 26**, it is **runtime-deprecated**: using it prints a deprecation warning.

For new code, use `module.registerHooks()`. If you maintain a loader built on `register()`, plan to move it over: make the hooks synchronous (use `readFileSync` and friends instead of `await`) and register them with `registerHooks()`.

## Common mistakes

### Registering hooks after the import

```javascript
// app.mjs
import './hooks.mjs';
import letter from './letter.txt'; // still fails: ERR_UNKNOWN_FILE_EXTENSION
```

Static imports are all resolved and loaded *before* any of them run, so the hook is registered too late. Use `node --import ./hooks.mjs app.mjs`, or register first and then use a dynamic `await import('./letter.txt')`.

### Making the hook async

```javascript
registerHooks({
  async load(url, context, nextLoad) { /* ... */ }, // wrong: returns a promise
});
```

`registerHooks()` hooks must return a plain object, not a promise. An `async` hook makes Node fail with an `ERR_INVALID_RETURN_PROPERTY_VALUE` error, because the promise has no `source`. Use synchronous APIs like `readFileSync` inside them.

### Forgetting shortCircuit

If your hook returns its own result without calling `next...`, add `shortCircuit: true`. Without it, Node stops with an error:

```text
TypeError [ERR_INVALID_RETURN_PROPERTY_VALUE]: Expected true to be returned for the "shortCircuit" from the "load" hook but got undefined.
```

### Catching every file

```javascript
load(url, context, nextLoad) {
  return { format: 'module', source: transform(nextLoad(url, context).source) }; // for EVERYTHING
}
```

The hook can also receive built-in modules (`node:` URLs), JSON files and everything in `node_modules`. Check the URL (extension, `file:` scheme, folder) and pass everything else straight to `nextLoad`.

## Quick recap

- Node **resolves** a specifier to a URL, then **loads** that URL as source code. Hooks can change either step.
- Use `module.registerHooks({ resolve, load })`: synchronous, in-thread, and it covers both `import` and `require`.
- Call `nextResolve` / `nextLoad` for default behaviour, or return your own result with `shortCircuit: true`.
- Register hooks before your app with `node --import ./hooks.mjs app.mjs`.
- Classic uses: importing new file types, path aliases and transforming code.
- `module.register()` runs async hooks on another thread and is runtime-deprecated in Node 26. Prefer `registerHooks()`.

<code id="code-content" class="language-javascript">
// hooks-demo.mjs: run with  node hooks-demo.mjs
// Customises how Node finds (resolve) and reads (load) modules, all in one file.
import { registerHooks } from 'node:module';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
// Data for a made-up "virtual" module that exists only in memory
const virtualModules = {
  'virtual:shop-config': `export default { shop: 'Maya Books', currency: 'GBP' };`,
  'virtual:build-info': `export const builtAt = ${JSON.stringify(new Date().toISOString())};`,
};
const hooks = registerHooks({
  // resolve: turn a specifier (the text after "from") into a URL
  resolve(specifier, context, nextResolve) {
    if (specifier in virtualModules) {
      return { url: specifier, shortCircuit: true }; // keep the name as the URL
    }
    return nextResolve(specifier, context); // everything else: default behaviour
  },
  // load: turn a URL into source code and say what format it is
  load(url, context, nextLoad) {
    if (url in virtualModules) {
      return { format: 'module', source: virtualModules[url], shortCircuit: true };
    }
    if (url.endsWith('.txt')) {
      // Let Node read the file, then wrap the text as a default export
      const { source } = nextLoad(url, { ...context, format: 'module' });
      const text = String(source);
      return { format: 'module', source: `export default ${JSON.stringify(text)};`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
// --- Use the hooks. Imports must happen AFTER registerHooks, so use import() ---
const { default: config } = await import('virtual:shop-config');
const { builtAt } = await import('virtual:build-info');
console.log(`Shop: ${config.shop} (${config.currency}), built at ${builtAt}`);
// Write a .txt file, then import it like a module
const dir = mkdtempSync(join(tmpdir(), 'hooks-'));
const letterPath = join(dir, 'letter.txt');
writeFileSync(letterPath, 'Dear Asha,\nYour order has shipped.\n');
const { default: letter } = await import(pathToFileURL(letterPath).href);
console.log('Imported text file:\n' + letter.trim());
// Hooks can be removed again: a new .txt import now fails as normal
hooks.deregister();
const notePath = join(dir, 'note.txt');
writeFileSync(notePath, 'Call Ravi');
try {
  await import(pathToFileURL(notePath).href);
} catch (err) {
  console.log('After deregister:', err.code);
}
</code></pre>

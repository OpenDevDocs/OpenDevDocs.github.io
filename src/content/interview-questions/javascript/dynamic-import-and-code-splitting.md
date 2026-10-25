---
course: javascript
slug: dynamic-import-and-code-splitting
experienceLevel: mid
difficulty: medium
tags:
  - modules
  - performance
  - bundlers
question: "What is dynamic `import()` and how does it enable code splitting?"
answer: |
  Dynamic `import(specifier)` loads a module at runtime and returns a promise for its namespace object; because bundlers treat every `import()` call as a split point, the imported code goes into a separate chunk that is only downloaded when that line actually runs.

  How it works:

  - Unlike a static `import` declaration, `import()` is an expression: it can be used inside functions, conditions and event handlers, and the specifier can be computed.
  - The promise resolves to the **module namespace**: named exports are properties and the default export is under `.default`.
  - It works in ES modules, classic scripts and CommonJS files.
  - A module is evaluated only once. Later `import()` calls for the same specifier return the same cached module.

  Code splitting in practice:

  - **Route-based splitting**: each page is a separate chunk, loaded on navigation. React's `lazy(() => import('./Settings.js'))` with `Suspense` and router-level lazy routes are built on this.
  - **Interaction-based**: load a heavy editor, chart or PDF library only when the user opens that feature.
  - **Conditional features**: polyfills or locale data chosen at runtime.

  Pitfalls:

  - **Fully dynamic paths** (`import(userInput)`) cannot be analysed by bundlers. Keep a static prefix and extension, such as a template literal starting with `./locales/` and ending in `.js`, so the bundler can create chunks for the matching files.
  - **Waterfalls**: if chunk A imports chunk B only after it loads, users wait for two round trips. Preload chunks you know you will need (`<link rel="modulepreload">`, or prefetching on hover).
  - **Failure handling**: the network can fail or a deployment can remove old chunk files. Catch the rejection and show a retry or reload message.
  - **Too many tiny chunks** add request overhead; split along real user-facing boundaries.
  - Forgetting `.default` is a frequent bug when the module only has a default export.

  Use a bundle analyser to confirm the split actually shrank the initial bundle.
codeExample: |
  // lazy.mjs (run with: node lazy.mjs)
  let zlibPromise;
  const loadZlib = () => (zlibPromise ??= import('node:zlib')); // loaded at most once

  async function compressedSize(text) {
    const { gzipSync } = await loadZlib();   // named export from the namespace
    return gzipSync(text).length;
  }

  console.log('app started, zlib not loaded yet');
  console.log(await compressedSize('a'.repeat(1000)) < 1000); // Output: true
  console.log(await loadZlib() === await loadZlib());         // Output: true (same module)

  // Computed specifier: pick a "locale module" at runtime
  const lang = 'fr';
  const source = `export default { hello: '${lang === 'fr' ? 'bonjour' : 'hello'}' };`;
  const messages = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  console.log(messages.default.hello); // Output: bonjour (default export lives on .default)

  // Always handle load failures
  try {
    await import('./does-not-exist.js');
  } catch (err) {
    console.log(err.code); // Output: ERR_MODULE_NOT_FOUND
  }

  // Output (first line):
  // app started, zlib not loaded yet
popularity: 7.6
isPublished: true
---

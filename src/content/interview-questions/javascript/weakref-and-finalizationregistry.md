---
course: javascript
slug: weakref-and-finalizationregistry
experienceLevel: senior
difficulty: hard
tags:
  - memory
  - garbage-collection
question: "What are `WeakRef` and `FinalizationRegistry`, and why should you rarely use them?"
answer: |
  `WeakRef` (ES2021) holds a reference to an object **without keeping it alive**. `ref.deref()` returns the object, or `undefined` once the garbage collector has reclaimed it. `FinalizationRegistry` lets you register a callback that may run **some time after** a registered object is collected, receiving a "held value" you chose, such as an ID or a handle.

  How they differ from `WeakMap` and `WeakSet`: those hold values **keyed by** an object and never let you observe whether it was collected. `WeakRef` deliberately exposes that non-determinism.

  The spec gives very few guarantees, and that's why they're for advanced cases only:

  - Collection timing is up to the engine. An object may live much longer than you expect, or be collected sooner if you didn't keep a strong reference.
  - Finalisation callbacks **may never run**, for example if the process exits or the page closes. They run asynchronously, never during your synchronous code.
  - Within one synchronous job, a target that `deref()` returned stays alive (the engine keeps it until the job ends), so results are consistent inside a single turn.
  - Behaviour can differ between engines and versions, and between development and production heap sizes.

  Legitimate uses:

  - **Caches** of expensive, re-creatable objects where entries may disappear under memory pressure, such as decoded images or parsed documents keyed by URL. Pair `WeakRef` values with a `FinalizationRegistry` that removes the stale map entries.
  - **Safety nets** that release external resources (a WASM allocation, a native handle) if a user forgot to call `close()`. They are never the primary cleanup path.

  Never put program correctness on finalizers. Prefer explicit lifetimes: `dispose()` or `close()` methods, `try/finally`, and `using` declarations with `Symbol.dispose` (explicit resource management, shipping in recent engines; check current support).
codeExample: |
  const v8 = require('node:v8');
  const vm = require('node:vm');
  v8.setFlagsFromString('--expose-gc');     // demo only: force a collection
  const gc = vm.runInNewContext('gc');

  const registry = new FinalizationRegistry((key) => {
    cache.delete(key);                      // remove the dead entry
    console.log(`finalized ${key}`);
  });
  const cache = new Map();

  function cacheSet(key, value) {
    cache.set(key, new WeakRef(value));
    registry.register(value, key);
  }

  let image = { pixels: new Uint8Array(1_000_000) };
  cacheSet('hero.png', image);
  console.log(cache.get('hero.png').deref() === image); // Output: true

  image = null;                             // drop the only strong reference
  setTimeout(() => {                        // a new job, so deref() no longer pins it
    gc();
    console.log(cache.get('hero.png')?.deref());       // Output: undefined
  }, 0);
  // Output (later, timing not guaranteed): finalized hero.png
popularity: 6.6
isPublished: true
---

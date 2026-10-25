---
course: javascript
slug: proxy-and-reflect
experienceLevel: senior
difficulty: hard
tags:
  - metaprogramming
  - proxy
question: "How do `Proxy` and `Reflect` work together, and what are the pitfalls of using proxies in production code?"
answer: |
  A `Proxy` wraps a **target** object and intercepts its internal operations through **traps** in a handler: `get`, `set`, `has`, `deleteProperty`, `ownKeys`, `getOwnPropertyDescriptor`, `defineProperty`, `apply`, `construct` and a few more. Any trap you omit forwards to the target unchanged.

  `Reflect` exposes the default behaviour of each internal operation as a function with the same signature as the matching trap. Inside a trap you almost always forward with `Reflect.get(target, key, receiver)` rather than `target[key]`. The **receiver** matters: it is the object the operation started on, so getters and inherited setters see the proxy as `this`, not the raw target. `Reflect.set` and `Reflect.defineProperty` also return booleans instead of throwing, which is what a trap must return.

  Pitfalls seen in real systems:

  - **Invariants**: traps cannot lie about non-configurable or non-writable properties, or about non-extensible targets. Violations throw a `TypeError`.
  - **Internal slots**: built-ins such as `Map`, `Set`, `Date` and private class fields check the real object. `new Proxy(new Map(), {}).get('k')` throws because `this` is the proxy. You need to bind methods to the target.
  - **Identity**: `proxy !== target`, so `WeakMap` lookups, `===` checks and caches keyed by object identity can split.
  - **Performance**: every trapped operation is a function call, and proxies defeat many inline-cache optimisations. Keep them off hot loops.
  - **Debuggability**: stack traces and console output become harder to read.

  Good uses are validation at boundaries, observability (Vue 3 reactivity, MobX), mocks in tests, and lazy or remote objects. For plain data validation, a schema check at the boundary is usually simpler.
codeExample: |
  const user = {
    first: 'Ada', last: 'Lovelace',
    get full() { return `${this.first} ${this.last}`; },
  };

  const guarded = new Proxy(user, {
    get(target, key, receiver) {
      if (!(key in target)) throw new Error(`Unknown field: ${String(key)}`);
      return Reflect.get(target, key, receiver);   // receiver keeps `this` = proxy
    },
    set(target, key, value, receiver) {
      if (typeof value !== 'string') return false; // TypeError in strict code
      return Reflect.set(target, key, value, receiver);
    },
  });

  guarded.first = 'Augusta';
  console.log(guarded.full);                // Output: Augusta Lovelace
  try { guarded.age; } catch (e) { console.log(e.message); }
  // Output: Unknown field: age
  console.log(Reflect.set(guarded, 'last', 42)); // Output: false

  const m = new Proxy(new Map([['k', 1]]), {});
  try { m.get('k'); } catch (e) { console.log(e.constructor.name); }
  // Output: TypeError
popularity: 7.9
isPublished: true
---

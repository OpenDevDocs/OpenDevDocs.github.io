---
course: javascript
slug: prototype-pollution
experienceLevel: senior
difficulty: hard
tags:
  - security
  - prototypes
question: What is prototype pollution, and how do you prevent it?
answer: |
  **Prototype pollution** happens when attacker-controlled keys let code write to `Object.prototype` (or another shared prototype). Because almost every object inherits from it, one write changes the behaviour of the whole process.

  The typical vulnerable code is a recursive **merge**, **clone**, **set-by-path** (`set(obj, 'a.b.c', v)`) or query-string parser fed with untrusted JSON. A payload such as `{"__proto__": {"isAdmin": true}}` makes the function walk into `target['__proto__']`, which is `Object.prototype`, and assign `isAdmin` there. `constructor.prototype` paths reach the same object. After that, `({}).isAdmin` is `true` everywhere.

  The impact depends on what gadgets the application has:

  - Authorisation bypasses through checks like `if (user.isAdmin)`.
  - Denial of service by overriding `toString` or other methods every object relies on.
  - Remote code execution in Node when polluted options reach things like `child_process.spawn` (`shell`, `env`) or template engines that compile code.

  Prevention, layered:

  - Block dangerous keys (`__proto__`, `constructor`, `prototype`) in any code that copies keys from input, and only copy **own** properties (`Object.hasOwn`).
  - Use `Map` for dynamic key-value data, or create dictionaries with `Object.create(null)` so there is no prototype to reach.
  - Validate input against a schema (Zod, Ajv with `additionalProperties: false`) before it touches merge logic.
  - Read options defensively, for example with destructuring defaults or `Object.hasOwn(options, 'shell')`, so inherited values are ignored.
  - As hardening, `Object.freeze(Object.prototype)` at startup, or run Node with `--disable-proto=delete` to remove the `__proto__` accessor. Test both, because some libraries break.

  Keep dependencies patched: many CVEs in popular utility libraries (lodash, minimist and others) were exactly this bug.
codeExample: |
  function unsafeMerge(target, source) {
    for (const key in source) {
      if (typeof source[key] === 'object' && source[key] !== null) {
        target[key] ??= {};
        unsafeMerge(target[key], source[key]);   // walks into __proto__
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  const payload = JSON.parse('{"__proto__": {"isAdmin": true}}'); // own key "__proto__"
  unsafeMerge({}, payload);
  console.log({}.isAdmin);                       // Output: true  (every object!)
  delete Object.prototype.isAdmin;               // undo for the demo

  const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);
  function safeMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (BLOCKED.has(key)) continue;
      const value = source[key];
      target[key] = typeof value === 'object' && value !== null
        ? safeMerge(Object.hasOwn(target, key) ? target[key] : {}, value)
        : value;
    }
    return target;
  }
  safeMerge({}, payload);
  console.log({}.isAdmin);                       // Output: undefined
popularity: 8.0
isPublished: true
---

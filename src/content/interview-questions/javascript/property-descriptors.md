---
course: javascript
slug: property-descriptors
experienceLevel: senior
difficulty: medium
tags:
  - objects
  - metaprogramming
question: What are property descriptors, and how do freeze, seal and preventExtensions differ?
answer: |
  Every property has a **descriptor** that defines its behaviour. There are two kinds:

  - **Data descriptors**: `value`, `writable`, `enumerable`, `configurable`.
  - **Accessor descriptors**: `get`, `set`, `enumerable`, `configurable`.

  The attributes mean:

  - `writable`: whether assignment can change the value.
  - `enumerable`: whether the property shows up in `for...in`, `Object.keys`, spread and `JSON.stringify`.
  - `configurable`: whether the property can be deleted or have its descriptor changed. A non-configurable data property can still go from writable to non-writable, but never back.

  Properties created by assignment or object literals default to `true` for all three. Properties created with `Object.defineProperty` default to **`false`** for any attribute you omit, which is a common source of "why can't I change this?" bugs. Inspect them with `Object.getOwnPropertyDescriptor` or `Object.getOwnPropertyDescriptors`.

  Object-level integrity levels:

  - `Object.preventExtensions(o)`: no new properties. Existing ones can still be changed or deleted.
  - `Object.seal(o)`: no new properties and all existing properties become non-configurable. Values can still change.
  - `Object.freeze(o)`: sealed, and every data property becomes non-writable.

  All three are **shallow**. Nested objects stay mutable unless you freeze them recursively. Violations fail **silently in sloppy mode** and throw `TypeError` in strict mode, which includes modules and classes.

  Where this matters in practice: defining non-enumerable helper properties, read-only constants on shared config, library objects that consumers must not patch, and the descriptor copying needed when you clone objects with getters (`Object.assign` and spread invoke getters and copy their values, while `Object.defineProperties(target, Object.getOwnPropertyDescriptors(src))` keeps the accessors).
codeExample: |
  'use strict';
  const config = {};
  Object.defineProperty(config, 'apiUrl', { value: 'https://api.example.com' });
  console.log(Object.getOwnPropertyDescriptor(config, 'apiUrl'));
  // Output: {
  //   value: 'https://api.example.com',
  //   writable: false,
  //   enumerable: false,
  //   configurable: false
  // }
  console.log(Object.keys(config));                 // Output: []

  try { config.apiUrl = 'http://evil'; } catch (e) { console.log(e.constructor.name); }
  // Output: TypeError

  const sealed = Object.seal({ retries: 3 });
  sealed.retries = 5;                               // allowed: still writable
  try { delete sealed.retries; } catch (e) { console.log('seal blocks delete'); }
  // Output: seal blocks delete

  const frozen = Object.freeze({ limits: { max: 10 } });
  frozen.limits.max = 99;                           // shallow: nested object is mutable
  console.log(frozen.limits.max, Object.isFrozen(frozen.limits)); // Output: 99 false

  // Copying getters: spread evaluates them, descriptors keep them
  const src = { get now() { return 'computed'; } };
  const copy = Object.defineProperties({}, Object.getOwnPropertyDescriptors(src));
  console.log(typeof Object.getOwnPropertyDescriptor({ ...src }, 'now').get,
              typeof Object.getOwnPropertyDescriptor(copy, 'now').get);
  // Output: undefined function
popularity: 7.0
isPublished: true
---

---
course: javascript
slug: realms-and-instanceof-pitfalls
experienceLevel: senior
difficulty: hard
tags:
  - realms
  - prototypes
  - type-checking
question: "What is a realm in JavaScript, and why can `instanceof` give the wrong answer across realms?"
answer: |
  A **realm** is a complete JavaScript global environment: its own global object and its own set of **intrinsics** (`Object`, `Array`, `Error`, `Promise`, `Object.prototype` and so on). Each iframe, each Node `vm` context and each `ShadowRealm` (a TC39 proposal; check current status) has its own realm. Web Workers have their own realms too, but they can't share objects directly; data is structured-cloned between them.

  `x instanceof C` walks `x`'s prototype chain looking for `C.prototype`. An array created in an iframe inherits from **that iframe's** `Array.prototype`, which is a different object from the parent page's, so `iframeArray instanceof Array` is `false` even though it's a perfectly normal array. The same applies to errors, promises, dates and class instances.

  Where this bites in practice:

  - Code that receives objects from iframes, `window.open` popups, or Node's `vm` module.
  - Test environments such as Jest with jsdom, which runs tests in a separate `vm` context. Errors or arrays produced by Node built-ins can fail `instanceof` checks in the test code.
  - The **dual package hazard**, which isn't a realm issue but has the same symptom: two copies of a library mean two different classes, so `instanceof` fails.

  Robust alternatives:

  - `Array.isArray()`, which works across realms by design.
  - `Error.isError()` for errors, a recent addition (available in Node 24; check browser support), or a check on `Object.prototype.toString.call(x)` (`[object Error]`), noting that `Symbol.toStringTag` can spoof it.
  - **Brand checks** that use internal slots, such as `ArrayBuffer.isView`, or calling a built-in method that throws on the wrong type.
  - Duck typing on the members you actually need (`typeof value.then === 'function'` for thenables), which is what promise machinery does.
  - For your own classes, a `Symbol.for()` brand or a static `Symbol.hasInstance` that checks for it, since registered symbols are shared across realms.

  If objects only need to cross a boundary as data, serialise them (`structuredClone`, `postMessage`, JSON). The copies are created in the receiving realm, so they pass local checks.
codeExample: |
  const vm = require('node:vm');

  const otherRealm = vm.createContext({});
  const foreignArray = vm.runInContext('[1, 2, 3]', otherRealm);
  const foreignError = vm.runInContext('new TypeError("boom")', otherRealm);

  console.log(foreignArray instanceof Array, Array.isArray(foreignArray)); // Output: false true
  console.log(foreignError instanceof Error);                         // Output: false
  console.log(Object.prototype.toString.call(foreignError));          // Output: [object Error]
  console.log(typeof Error.isError === 'function' ? Error.isError(foreignError) : 'n/a');
  // Output: true   (Node 24+)

  // Registered symbols are shared across realms, so they make portable brands
  const BRAND = Symbol.for('acme.Money');
  class Money {
    constructor(cents) { this.cents = cents; this[BRAND] = true; }
    static [Symbol.hasInstance](value) { return value?.[BRAND] === true; }
  }
  const foreignMoney = vm.runInContext(
    '({ cents: 500, [Symbol.for("acme.Money")]: true })', otherRealm);
  console.log(foreignMoney instanceof Money);                         // Output: true

  // Copying data into this realm makes ordinary checks work again
  console.log(structuredClone(foreignArray) instanceof Array);        // Output: true
popularity: 6.5
isPublished: true
---

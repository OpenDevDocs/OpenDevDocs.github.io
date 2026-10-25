---
course: javascript
slug: freeze-seal-preventextensions
experienceLevel: mid
difficulty: medium
tags:
  - objects
  - immutability
question: "What is the difference between `Object.freeze`, `Object.seal` and `Object.preventExtensions`?"
answer: |
  They are three increasingly strict ways to lock down an object: `preventExtensions` blocks **adding** properties, `seal` also blocks **deleting** and reconfiguring them, and `freeze` additionally makes every data property **read-only**.

  - `Object.preventExtensions(obj)`: no new properties. Existing ones can still be changed or deleted.
  - `Object.seal(obj)`: no new properties and no deletions; every property becomes non-configurable. Values of existing properties can still be changed.
  - `Object.freeze(obj)`: sealed, and every data property becomes non-writable. Nothing about the object's own properties can change.

  The matching checks are `Object.isExtensible`, `Object.isSealed` and `Object.isFrozen`.

  Important details:

  - All three are **shallow**. A frozen object's nested objects and arrays are still mutable. For deep immutability, freeze recursively or use immutable update patterns.
  - Violations are silently ignored in sloppy mode but throw a `TypeError` in strict mode, which includes ES modules and class bodies. This is a common source of "it worked in one file but not the other" confusion.
  - They are irreversible: there is no unfreeze. Copy the object instead (`{ ...frozen }` gives a normal, mutable shallow copy).
  - Accessor properties keep working on a frozen object; a setter can still modify state stored elsewhere, for example in a closure.
  - Freezing an array blocks `push`, `pop` and index assignment, and `push` throws even in sloppy mode.
  - Private class fields are not affected by `freeze`.

  Practical uses: protecting configuration objects and constants from accidental mutation, making enum-like objects (`const Status = Object.freeze({ ACTIVE: 'active' })`), and catching accidental mutations of state during development. `const` only stops reassigning the variable; it does nothing to the object itself, which is why `freeze` exists.
codeExample: |
  'use strict';

  const tryIt = (label, fn) => {
    try { fn(); console.log(label, 'ok'); } catch (e) { console.log(label, e.constructor.name); }
  };

  const ext = Object.preventExtensions({ a: 1 });
  tryIt('preventExtensions add:', () => { ext.b = 2; });    // Output: preventExtensions add: TypeError
  tryIt('preventExtensions delete:', () => { delete ext.a; }); // Output: preventExtensions delete: ok

  const sealed = Object.seal({ a: 1 });
  tryIt('seal change:', () => { sealed.a = 99; });           // Output: seal change: ok
  tryIt('seal delete:', () => { delete sealed.a; });         // Output: seal delete: TypeError

  const frozen = Object.freeze({ a: 1, nested: { b: 1 } });
  tryIt('freeze change:', () => { frozen.a = 2; });          // Output: freeze change: TypeError
  tryIt('freeze nested:', () => { frozen.nested.b = 2; });   // Output: freeze nested: ok (shallow!)

  console.log(frozen.nested.b, Object.isFrozen(frozen), Object.isSealed(frozen)); // Output: 2 true true

  const list = Object.freeze([1, 2]);
  tryIt('frozen array push:', () => list.push(3));          // Output: frozen array push: TypeError
popularity: 7.5
isPublished: true
---

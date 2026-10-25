---
course: javascript
slug: comparing-objects-and-arrays
experienceLevel: mid
difficulty: medium
tags:
  - objects
  - arrays
  - equality
question: How do you compare two objects or arrays for equality in JavaScript?
answer: |
  `===` and `==` compare objects and arrays by **reference**, so two separately created objects with identical contents are never equal; to compare contents you need a shallow or deep equality check that walks the properties yourself or uses a library.

  The three levels:

  - **Reference equality** (`a === b`): true only if both variables point to the same object. It is the cheapest check and exactly what React, `useMemo` dependencies and `Set`/`Map` keys use.
  - **Shallow equality**: same set of own keys, and each value is `===` (or `Object.is`) equal. Fast, and enough for flat props or state objects. Nested objects are still compared by reference.
  - **Deep equality**: recursively compares nested objects and arrays. Needed for things like test assertions or comparing parsed config.

  Options for deep equality:

  - Node.js: `util.isDeepStrictEqual(a, b)` and `assert.deepStrictEqual`. Test frameworks provide `expect(a).toEqual(b)`.
  - Libraries such as Lodash's `isEqual` or `fast-deep-equal` in the browser.
  - Hand-written recursion for simple, known data shapes.

  Why `JSON.stringify(a) === JSON.stringify(b)` is a poor shortcut:

  - It depends on **key order**: `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` produce different strings.
  - It ignores `undefined` values and functions, turns `NaN` into `null`, loses `Map`/`Set` contents and `Date` types, and throws on circular references and `BigInt`.

  Other details:

  - `Object.is(NaN, NaN)` is `true` and `Object.is(0, -0)` is `false`; `===` gives the opposite for both.
  - Decide whether prototypes matter: is a class instance equal to a plain object with the same fields? `isDeepStrictEqual` says no.
  - Deep comparison is O(n) in the size of the data, so avoid it in hot paths like render loops. Immutable updates let you rely on fast reference checks instead.
codeExample: |
  const { isDeepStrictEqual } = require('node:util');

  const a = { id: 1, tags: ['x'] };
  const b = { id: 1, tags: ['x'] };
  console.log(a === b, a === a);                    // Output: false true
  console.log([1, 2] === [1, 2]);                   // Output: false

  function shallowEqual(x, y) {
    if (Object.is(x, y)) return true;
    if (typeof x !== 'object' || typeof y !== 'object' || !x || !y) return false;
    const kx = Object.keys(x), ky = Object.keys(y);
    return kx.length === ky.length && kx.every((k) => Object.hasOwn(y, k) && Object.is(x[k], y[k]));
  }

  console.log(shallowEqual({ n: 1 }, { n: 1 }));   // Output: true
  console.log(shallowEqual(a, b));                  // Output: false (tags arrays differ by reference)
  console.log(isDeepStrictEqual(a, b));             // Output: true

  const p = { a: 1, b: 2 }, q = { b: 2, a: 1 };
  console.log(JSON.stringify(p) === JSON.stringify(q)); // Output: false (key order)
  console.log(isDeepStrictEqual(p, q));             // Output: true
  console.log(JSON.stringify({ v: undefined }) === JSON.stringify({}));  // Output: true (wrongly equal)

  console.log(NaN === NaN, Object.is(NaN, NaN), Object.is(0, -0)); // Output: false true false
  console.log(isDeepStrictEqual(new Set([1]), new Set([1])));       // Output: true
popularity: 8.3
isPublished: true
---

---
course: javascript
slug: equality-algorithms
experienceLevel: senior
difficulty: medium
tags:
  - equality
  - type-coercion
question: "What are the equality algorithms in JavaScript, and where does each one show up (`==`, `===`, `Object.is`, SameValueZero)?"
answer: |
  The spec defines four comparison algorithms, and different built-ins quietly use different ones:

  - **IsLooselyEqual** (`==`) coerces types first: `null == undefined` is true, strings and booleans are converted to numbers, and objects are converted with ToPrimitive. Its rules are hard to remember, so most style guides ban it except for `x == null`, which checks for both `null` and `undefined`.
  - **IsStrictlyEqual** (`===`, `!==`): no coercion, but two IEEE 754 quirks: `NaN !== NaN`, and `+0 === -0`. Used by `indexOf`, `lastIndexOf` and `switch` cases.
  - **SameValue** (`Object.is`): like `===` except `Object.is(NaN, NaN)` is true and `Object.is(0, -0)` is false. Used by `Object.defineProperty` checks and React's state and dependency comparisons (`useState`, `useEffect`, `useMemo`).
  - **SameValueZero**: like SameValue but treats `+0` and `-0` as equal. Used by `includes`, `Map` and `Set` keys, and `TypedArray` `includes`.

  Practical consequences:

  - `[NaN].indexOf(NaN)` is `-1`, but `[NaN].includes(NaN)` is `true`. Use `includes` or `Number.isNaN` to detect NaN.
  - A `Map` treats `-0` and `0` as the same key, and `NaN` works as a key.
  - Object equality is always **identity**. Two structurally identical objects are never equal under any of these algorithms. For value comparison use a deep-equal utility (`node:util` `isDeepStrictEqual`, `assert.deepStrictEqual`), or compare stable keys.
  - `-0` appears from expressions such as `-1 * 0` or `Math.round(-0.4)` and survives `===` comparisons unnoticed. It matters in direction-sensitive math (`1 / -0` is `-Infinity`), and `JSON.stringify(-0)` is `"0"`.

  In code review, prefer `===` everywhere, `Object.is` when NaN or the sign of zero matters, and remember that Map, Set and `includes` behave differently from `indexOf`.
codeExample: |
  const { isDeepStrictEqual } = require('node:util');

  console.log(null == undefined, '1' == 1, 0 == '');   // Output: true true true
  console.log(NaN === NaN, 0 === -0);                  // Output: false true
  console.log(Object.is(NaN, NaN), Object.is(0, -0));  // Output: true false

  // indexOf uses ===, includes uses SameValueZero
  console.log([NaN].indexOf(NaN), [NaN].includes(NaN)); // Output: -1 true

  // Map/Set keys use SameValueZero
  const seen = new Map([[NaN, 'not a number'], [0, 'zero']]);
  console.log(seen.get(NaN), seen.get(-0));             // Output: not a number zero
  console.log(new Set([0, -0, NaN, NaN]).size);         // Output: 2

  // Objects compare by identity; use a deep-equality helper for values
  const a = { id: 1, tags: ['x'] };
  const b = { id: 1, tags: ['x'] };
  console.log(a === b, isDeepStrictEqual(a, b));        // Output: false true

  // -0 survives === unnoticed
  const velocity = Math.round(-0.4);
  console.log(velocity === 0, Object.is(velocity, -0), 1 / velocity); // Output: true true -Infinity
popularity: 7.6
isPublished: true
---

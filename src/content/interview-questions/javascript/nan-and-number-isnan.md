---
course: javascript
slug: nan-and-number-isnan
experienceLevel: fresher
difficulty: easy
tags:
  - numbers
  - data-types
question: "What is `NaN`, and how do you check for it?"
answer: |
  `NaN` ("Not a Number") is a special value of the `number` type that represents the result of an invalid or undefined numeric operation, and the reliable way to check for it is `Number.isNaN(value)`.

  You get `NaN` from things like:

  - Converting a non-numeric string: `Number("abc")`, `parseInt("hello")`.
  - Invalid maths: `0 / 0`, `Math.sqrt(-1)`, `Infinity - Infinity`.
  - Arithmetic involving `undefined`: `undefined + 1`.

  Its unusual properties:

  - `typeof NaN` is `"number"`.
  - `NaN` is **not equal to anything, including itself**: `NaN === NaN` is `false`. So `value === NaN` never works.
  - It is "contagious": any arithmetic with `NaN` produces `NaN`, so one bad input can silently spread through a calculation.
  - It is falsy.

  How to check:

  - **`Number.isNaN(value)`** returns `true` only if the value is actually `NaN`. Use this.
  - The older global **`isNaN(value)`** converts its argument to a number first, so `isNaN("hello")` and `isNaN(undefined)` are `true`. That answers "would this fail to convert to a number?", which is a different question.
  - `Object.is(value, NaN)` also works.
  - Array `includes` finds `NaN`, but `indexOf` does not, because `indexOf` uses `===`.

  In practice, validate user input after converting it: `const n = Number(input); if (Number.isNaN(n)) { ... }`. If you also want to reject `Infinity`, use `Number.isFinite(n)`, which is `false` for `NaN` and both infinities.
codeExample: |
  console.log(Number("abc")); // Output: NaN
  console.log(0 / 0, undefined + 1); // Output: NaN NaN
  console.log(typeof NaN); // Output: number

  const value = NaN;
  console.log(value === NaN); // Output: false
  console.log(Number.isNaN(value)); // Output: true
  console.log(Object.is(value, NaN)); // Output: true

  // Global isNaN converts first
  console.log(isNaN("hello"), Number.isNaN("hello")); // Output: true false

  console.log([NaN].includes(NaN), [NaN].indexOf(NaN)); // Output: true -1

  const input = "42px";
  const n = Number(input);
  console.log(Number.isFinite(n) ? n : "invalid number"); // Output: invalid number
  console.log(parseInt(input, 10)); // Output: 42
popularity: 8.0
isPublished: true
---

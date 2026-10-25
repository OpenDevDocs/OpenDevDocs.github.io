---
course: javascript
slug: double-vs-triple-equals
experienceLevel: fresher
difficulty: easy
tags:
  - operators
  - type-coercion
question: "What is the difference between `==` and `===` in JavaScript?"
answer: |
  `===` (strict equality) compares values without converting types, so different types are never equal; `==` (loose equality) first converts the operands to a common type and then compares.

  With `==`, the conversion rules are surprising:

  - `"5" == 5` is `true`, because the string is converted to a number.
  - `0 == ""` and `0 == "0"` are both `true`, but `"" == "0"` is `false`.
  - `false == "0"` is `true`, because the boolean becomes `0` and the string becomes `0`.
  - `null == undefined` is `true`, yet `null == 0` is `false`.

  For objects (including arrays and functions), both operators compare **references**, not contents. `[1] === [1]` is `false` because they are two different arrays.

  Edge cases shared by both: `NaN` is not equal to anything, including itself, so use `Number.isNaN`. And `+0 === -0` is `true`. If you need to distinguish those, `Object.is` treats `NaN` as equal to `NaN` and `+0` as different from `-0`.

  In practice, use `===` and `!==` everywhere. Most linters enforce this with the `eqeqeq` rule. The one widely accepted exception is `value == null`, which is a short way to check for both `null` and `undefined` at once.
codeExample: |
  console.log(5 == "5"); // Output: true
  console.log(5 === "5"); // Output: false

  console.log(0 == ""); // Output: true
  console.log(0 == "0"); // Output: true
  console.log("" == "0"); // Output: false

  console.log(null == undefined); // Output: true
  console.log(null == 0); // Output: false

  console.log([1, 2] === [1, 2]); // Output: false
  const arr = [1, 2];
  const sameArr = arr;
  console.log(arr === sameArr); // Output: true

  console.log(NaN === NaN); // Output: false
  console.log(Object.is(NaN, NaN)); // Output: true
popularity: 9.5
isPublished: true
---

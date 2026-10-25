---
course: javascript
slug: type-coercion-basics
experienceLevel: fresher
difficulty: medium
tags:
  - type-coercion
  - operators
question: What is type coercion in JavaScript?
answer: |
  Type coercion is the automatic conversion of a value from one type to another, such as a string to a number, which JavaScript performs when an operator or function receives a type it did not expect.

  There are two kinds:

  - **Explicit conversion**, which you write on purpose: `Number("42")`, `String(42)`, `Boolean(value)`, `parseInt("42px", 10)`.
  - **Implicit coercion**, which happens behind the scenes in operators and conditions.

  The rules that cause most surprises:

  - **`+` with a string concatenates.** If either operand is a string, the other is converted to a string: `"5" + 1` is `"51"`, and `1 + 2 + "3"` is `"33"` (evaluated left to right).
  - **Other arithmetic operators convert to numbers:** `"5" - 1` is `4`, `"6" * "2"` is `12`, and `"abc" - 1` is `NaN`.
  - **Unary `+` converts to a number:** `+"3"` is `3`, `+""` is `0`, `+true` is `1`.
  - **Conditions convert to booleans** using the truthy and falsy rules.
  - **Loose equality `==` coerces** before comparing, which is why `0 == ""` is `true`.
  - **Objects are converted to primitives** first, via `valueOf` or `toString`. That gives results like `[] + []` being `""` and `[1, 2] + ""` being `"1,2"`.

  Useful number conversions: `Number("")` is `0`, `Number(" 12 ")` is `12`, `Number(null)` is `0`, `Number(undefined)` is `NaN`, `Number("12px")` is `NaN` but `parseInt("12px", 10)` is `12`.

  In practice, convert explicitly at the boundaries, especially form input values, which are always strings. Then use `===` for comparisons. This avoids bugs like adding `"10" + 5` and getting `"105"`.
codeExample: |
  console.log("5" + 1); // Output: 51
  console.log("5" - 1); // Output: 4
  console.log(1 + 2 + "3"); // Output: 33
  console.log("3" + 1 + 2); // Output: 312
  console.log("6" * "2"); // Output: 12
  console.log(+"3" + 1); // Output: 4

  console.log(Number(""), Number(" 12 "), Number("12px")); // Output: 0 12 NaN
  console.log(parseInt("12px", 10)); // Output: 12

  console.log([1, 2] + ""); // Output: 1,2
  console.log(true + 1); // Output: 2

  // Form values are strings: convert before doing maths
  const qtyInput = "10";
  console.log(qtyInput + 5); // Output: 105
  console.log(Number(qtyInput) + 5); // Output: 15
popularity: 8.6
isPublished: true
---

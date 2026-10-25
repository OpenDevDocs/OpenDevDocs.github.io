---
course: javascript
slug: typeof-operator
experienceLevel: fresher
difficulty: easy
tags:
  - data-types
  - operators
question: "How does the `typeof` operator work, and what are its quirks?"
answer: |
  `typeof` returns a string naming the type of a value: `"string"`, `"number"`, `"bigint"`, `"boolean"`, `"undefined"`, `"symbol"`, `"function"` or `"object"`.

  It is an operator, not a function, so `typeof x` works without parentheses. It is useful for checking primitive types before using a value, for example making sure an argument is a `"string"` or a callback is a `"function"`.

  The quirks interviewers ask about:

  - `typeof null` is `"object"`. This is a bug from the first version of JavaScript that can never be fixed without breaking the web. Check for null with `value === null`.
  - `typeof []` is `"object"`, because arrays are objects. Use `Array.isArray(value)` to detect arrays.
  - `typeof function () {}` and `typeof class {}` are both `"function"`, even though functions are technically objects.
  - `typeof NaN` is `"number"`, since `NaN` is a special numeric value.
  - `typeof` an undeclared variable returns `"undefined"` instead of throwing. That makes `typeof window !== "undefined"` a safe environment check. However, using `typeof` on a `let` or `const` variable before its declaration still throws a `ReferenceError` because of the temporal dead zone.

  For anything more specific than "object", such as dates, maps or your own classes, use `instanceof` or a dedicated check like `Array.isArray`. A robust object check is `value !== null && typeof value === "object"`.
codeExample: |
  console.log(typeof "text"); // Output: string
  console.log(typeof 3.14); // Output: number
  console.log(typeof NaN); // Output: number
  console.log(typeof undefined); // Output: undefined
  console.log(typeof (() => {})); // Output: function
  console.log(typeof class {}); // Output: function

  // The quirks
  console.log(typeof null); // Output: object
  console.log(typeof [1, 2]); // Output: object
  console.log(Array.isArray([1, 2])); // Output: true

  // Safe on undeclared names
  console.log(typeof notDeclaredAnywhere); // Output: undefined

  const isObject = (v) => v !== null && typeof v === "object";
  console.log(isObject(null), isObject({})); // Output: false true
popularity: 8.7
isPublished: true
---

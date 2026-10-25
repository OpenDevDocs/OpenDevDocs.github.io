---
course: javascript
slug: primitive-data-types
experienceLevel: fresher
difficulty: easy
tags:
  - data-types
  - basics
question: What are the primitive data types in JavaScript?
answer: |
  JavaScript has seven primitive types: `string`, `number`, `bigint`, `boolean`, `undefined`, `null` and `symbol`. Everything else, including arrays and functions, is an **object**.

  - `string`: text, such as `"hello"`.
  - `number`: a 64-bit floating-point value. There is no separate integer type, so `5` and `5.0` are the same. Special values include `NaN` and `Infinity`.
  - `bigint`: integers of arbitrary size, written with an `n` suffix, such as `9007199254740993n`.
  - `boolean`: `true` or `false`.
  - `undefined`: the value of a variable that has been declared but not assigned.
  - `null`: an intentional "no value".
  - `symbol`: a unique identifier, often used as a non-clashing object key.

  Primitives are **immutable** and compared **by value**. Objects are compared **by reference**, so two different objects with the same contents are not equal.

  You can call methods on primitives, as in `"abc".toUpperCase()`, because JavaScript temporarily wraps the value in an object (`String`, `Number` and so on). You should not create these wrappers yourself with `new String("x")`, since the result is an object and behaves differently in comparisons.

  Pitfalls interviewers like: `typeof null` returns `"object"` (a historical bug), and you cannot mix `bigint` and `number` in arithmetic without an explicit conversion.
codeExample: |
  console.log(typeof "hi"); // Output: string
  console.log(typeof 42); // Output: number
  console.log(typeof 10n); // Output: bigint
  console.log(typeof true); // Output: boolean
  console.log(typeof undefined); // Output: undefined
  console.log(typeof null); // Output: object
  console.log(typeof Symbol("id")); // Output: symbol

  // Primitives compare by value, objects by reference
  console.log("abc" === "abc"); // Output: true
  console.log({ a: 1 } === { a: 1 }); // Output: false

  try {
    console.log(10n + 1);
  } catch (err) {
    console.log(err.message); // Output: Cannot mix BigInt and other types, use explicit conversions
  }
popularity: 9.0
isPublished: true
---

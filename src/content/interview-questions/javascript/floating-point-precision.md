---
course: javascript
slug: floating-point-precision
experienceLevel: fresher
difficulty: medium
tags:
  - numbers
question: "Why does `0.1 + 0.2` not equal `0.3` in JavaScript?"
answer: |
  Because JavaScript numbers are 64-bit binary floating-point values (IEEE 754 double precision), and decimals like `0.1` and `0.2` cannot be represented exactly in binary, so the stored values are tiny approximations whose sum is `0.30000000000000004`.

  It is the same reason 1/3 cannot be written exactly in decimal. This is not a JavaScript bug: Python, Java, C# `double` and most other languages behave the same way. JavaScript simply has only one regular number type, so everyone meets it.

  How to deal with it:

  - **Compare with a tolerance** instead of `===`: `Math.abs(a - b) < Number.EPSILON` works for values around 1; for larger numbers, scale the tolerance to the size of the values.
  - **Round for display** with `toFixed(2)` (returns a string) or `Intl.NumberFormat` for currency. Note that `toFixed` can still surprise you: `(1.005).toFixed(2)` is `"1.00"` because `1.005` is actually stored as slightly less than that.
  - **Use integers for money.** Store amounts in the smallest unit (pence or cents), do the arithmetic on integers, and convert only when displaying. Integers are exact up to `Number.MAX_SAFE_INTEGER` (2^53 - 1).
  - **Use `BigInt`** for whole numbers larger than that limit, such as large IDs. Note that `BigInt` has no fractions.
  - For heavy decimal work, such as financial calculations with rates, use a decimal library like `decimal.js` or `big.js`.

  Related: integers beyond 2^53 lose precision too, so `9007199254740993` is stored as `9007199254740992`. Check with `Number.isSafeInteger`.

  Interviewers mainly want to hear that you understand the cause, never use floats for exact money arithmetic, and know the integer-cents approach.
codeExample: |
  console.log(0.1 + 0.2); // Output: 0.30000000000000004
  console.log(0.1 + 0.2 === 0.3); // Output: false

  const nearlyEqual = (a, b) => Math.abs(a - b) < Number.EPSILON;
  console.log(nearlyEqual(0.1 + 0.2, 0.3)); // Output: true

  console.log((0.1 + 0.2).toFixed(2)); // Output: 0.30
  console.log((1.005).toFixed(2)); // Output: 1.00

  // Money: work in integer pence, format at the end
  const pricesInPence = [1999, 499, 1];
  const totalPence = pricesInPence.reduce((sum, p) => sum + p, 0);
  console.log(totalPence); // Output: 2499
  const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  console.log(gbp.format(totalPence / 100)); // Output: £24.99

  console.log(9007199254740993); // Output: 9007199254740992
  console.log(9007199254740993n + 1n); // Output: 9007199254740994n
popularity: 8.4
isPublished: true
---

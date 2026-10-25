---
course: javascript
slug: truthy-and-falsy-values
experienceLevel: fresher
difficulty: easy
tags:
  - type-coercion
  - basics
question: What are truthy and falsy values in JavaScript?
answer: |
  A falsy value is one that becomes `false` when converted to a boolean, and every other value is truthy. This conversion happens automatically in `if`, `while`, the ternary operator and the logical operators `&&`, `||` and `!`.

  There is a short, fixed list of falsy values:

  - `false`
  - `0`, `-0` and `0n` (BigInt zero)
  - `""` (the empty string)
  - `null`
  - `undefined`
  - `NaN`

  (Browsers also treat the legacy `document.all` as falsy, but you will not meet it in normal code.)

  Everything else is truthy, which includes values that people often expect to be falsy:

  - `"0"` and `"false"` (non-empty strings)
  - `[]` (an empty array) and `{}` (an empty object)
  - `-1` and `Infinity`

  You can see the conversion explicitly with `Boolean(value)` or the double-negation shorthand `!!value`.

  Where this matters in practice: `if (items.length)` is a common, valid way to check for a non-empty array. But `if (count)` is a bug when `0` is a legitimate value, and `name || "Anonymous"` replaces a valid empty string. In those cases compare explicitly (`count !== undefined`) or use the nullish coalescing operator `??`, which only falls back for `null` and `undefined`.
codeExample: |
  console.log(Boolean(0)); // Output: false
  console.log(Boolean("")); // Output: false
  console.log(Boolean(null)); // Output: false
  console.log(Boolean(NaN)); // Output: false

  // Common surprises: these are all truthy
  console.log(Boolean("0")); // Output: true
  console.log(Boolean("false")); // Output: true
  console.log(Boolean([])); // Output: true
  console.log(!!{}); // Output: true

  const items = [];
  if (!items.length) console.log("No items"); // Output: No items

  const count = 0; // a valid value that happens to be falsy
  console.log(count || 10); // Output: 10
  console.log(count ?? 10); // Output: 0
popularity: 9.0
isPublished: true
---

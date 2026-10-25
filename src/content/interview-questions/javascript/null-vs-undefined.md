---
course: javascript
slug: null-vs-undefined
experienceLevel: fresher
difficulty: easy
tags:
  - data-types
question: "What is the difference between `null` and `undefined`?"
answer: |
  `undefined` means a value has not been provided, while `null` is a value you assign deliberately to say "there is nothing here".

  JavaScript produces `undefined` on its own in several places:

  - a declared variable with no assignment, as in `let x;`
  - a missing object property or array element
  - a function parameter that was not passed
  - a function that has no `return` statement

  The language never sets a value to `null` by itself (apart from some APIs, such as `document.getElementById` when nothing matches, or `JSON.parse("null")`). It is the programmer's way of explicitly clearing or marking an empty value.

  Comparisons:

  - `null == undefined` is `true`; loose equality treats them as equal to each other and to nothing else.
  - `null === undefined` is `false`, because the types differ.
  - `typeof undefined` is `"undefined"`, but `typeof null` is `"object"`, a long-standing quirk.

  They also behave differently with numbers and defaults: `Number(null)` is `0`, while `Number(undefined)` is `NaN`. Default parameters only apply for `undefined`, not `null`. `JSON.stringify` drops properties whose value is `undefined` but keeps `null`.

  In practice, a check such as `value == null` (or `value ?? fallback`) is a concise way to catch both. Many teams prefer `undefined` for "not set" and reserve `null` for API responses or values that are intentionally empty.
codeExample: |
  let notAssigned;
  console.log(notAssigned); // Output: undefined
  console.log({}.missing); // Output: undefined

  const user = { middleName: null }; // deliberately empty
  console.log(user.middleName); // Output: null

  console.log(null == undefined); // Output: true
  console.log(null === undefined); // Output: false
  console.log(Number(null), Number(undefined)); // Output: 0 NaN

  function greet(name = "guest") {
    return `Hi, ${name}`;
  }
  console.log(greet(undefined)); // Output: Hi, guest
  console.log(greet(null)); // Output: Hi, null

  console.log(JSON.stringify({ a: undefined, b: null })); // Output: {"b":null}
popularity: 9.1
isPublished: true
---

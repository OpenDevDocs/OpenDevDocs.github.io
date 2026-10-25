---
course: javascript
slug: for-in-vs-for-of
experienceLevel: fresher
difficulty: easy
tags:
  - loops
  - iteration
question: "What is the difference between `for...in` and `for...of`?"
answer: |
  `for...in` loops over the **keys** (enumerable property names) of an object, while `for...of` loops over the **values** produced by an iterable such as an array, string, `Map` or `Set`.

  **`for...in`**

  - Gives property names as **strings**, even for arrays (`"0"`, `"1"`, ...).
  - Includes enumerable properties inherited through the prototype chain, not just the object's own ones.
  - Is meant for plain objects. For arrays it is a poor choice: you get string indexes, plus any extra properties someone added to the array or `Array.prototype`.

  **`for...of`**

  - Works with any **iterable**: arrays, strings (by character, including emoji), `Map`, `Set`, `NodeList`, generators and `arguments`.
  - Gives the actual values, in order.
  - Does **not** work on plain objects; `for (const x of {})` throws `TypeError: {} is not iterable`.

  Both support `break`, `continue` and `await` inside an `async` function, which `forEach` does not.

  For plain objects, the modern approach is to combine `for...of` with `Object.keys`, `Object.values` or `Object.entries`, which return only the object's own enumerable properties:

  ```js
  for (const [key, value] of Object.entries(user)) { ... }
  ```

  If you need the index while looping an array with `for...of`, use `array.entries()`, as in `for (const [i, item] of list.entries())`.

  Rule of thumb: `for...of` for arrays and other collections, `Object.entries` with `for...of` for objects, and `for...in` rarely.
codeExample: |
  const colours = ["red", "green"];
  colours.extra = "oops"; // a non-index property on the array

  for (const key in colours) console.log(key, typeof key);
  // Output: 0 string
  // Output: 1 string
  // Output: extra string

  for (const value of colours) console.log(value);
  // Output: red
  // Output: green

  const user = { name: "Ada", role: "admin" };
  for (const [key, value] of Object.entries(user)) {
    console.log(`${key}=${value}`);
  }
  // Output: name=Ada
  // Output: role=admin

  try {
    for (const x of user) console.log(x);
  } catch (err) {
    console.log(err.message); // Output: user is not iterable
  }
popularity: 8.8
isPublished: true
---

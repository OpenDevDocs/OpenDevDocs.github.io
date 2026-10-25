---
course: javascript
slug: copying-objects-shallow-copy
experienceLevel: fresher
difficulty: medium
tags:
  - objects
  - immutability
question: How do you copy an object in JavaScript, and what is the difference between a shallow and a deep copy?
answer: |
  A shallow copy creates a new top-level object but shares any nested objects with the original, while a deep copy recursively copies every level so nothing is shared.

  First, plain assignment is not a copy at all: `const b = a;` makes two variables point to the **same** object.

  **Shallow copy** options:

  - Spread: `const copy = { ...original };` (or `[...arr]` for arrays)
  - `Object.assign({}, original)`
  - For arrays: `arr.slice()`, `Array.from(arr)`

  These copy top-level properties. Nested objects and arrays are copied **by reference**, so changing `copy.address.city` also changes `original.address.city`.

  **Deep copy** options:

  - `structuredClone(original)` is the modern built-in, available in all current browsers and Node.js 17+. It handles nested objects, arrays, `Date`, `Map`, `Set`, typed arrays and even circular references.
  - `JSON.parse(JSON.stringify(original))` is the old trick. It loses `undefined`, functions and symbols, turns `Date` into strings, turns `NaN` and `Infinity` into `null`, and throws on circular references.
  - Libraries such as Lodash's `cloneDeep` for special cases.

  Limitations of `structuredClone`: it throws on functions and DOM nodes, and it does not preserve class instances' prototypes (you get plain objects back), or getters and setters.

  In practice, shallow copies with spread are enough for most state updates, as long as you also copy each nested level you change: `{ ...user, address: { ...user.address, city: "Paris" } }`. Reach for `structuredClone` when you genuinely need an independent copy of nested data.
codeExample: |
  const original = { name: "Ada", address: { city: "London" }, born: new Date(1815, 11, 10) };

  const shallow = { ...original };
  shallow.name = "Grace";
  shallow.address.city = "Paris"; // nested object is shared
  console.log(original.name, original.address.city); // Output: Ada Paris

  original.address.city = "London";
  const deep = structuredClone(original);
  deep.address.city = "Rome";
  console.log(original.address.city, deep.address.city); // Output: London Rome
  console.log(deep.born instanceof Date); // Output: true

  const viaJson = JSON.parse(JSON.stringify(original));
  console.log(typeof viaJson.born); // Output: string

  // Update one nested field immutably
  const moved = { ...original, address: { ...original.address, city: "Oslo" } };
  console.log(moved.address.city, original.address.city); // Output: Oslo London
popularity: 8.7
isPublished: true
---

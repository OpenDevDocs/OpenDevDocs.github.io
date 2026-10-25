---
course: javascript
slug: checking-if-value-is-array
experienceLevel: fresher
difficulty: easy
tags:
  - arrays
  - data-types
question: How do you check whether a value is an array?
answer: |
  Use `Array.isArray(value)`, which returns `true` for real arrays and `false` for everything else, including array-like objects.

  Why not the alternatives:

  - **`typeof value`** returns `"object"` for arrays, the same as for plain objects and `null`, so it cannot tell them apart.
  - **`value instanceof Array`** usually works, but fails for arrays created in another **realm**, such as an `iframe`, a different window, or a Node.js `vm` context, because each realm has its own `Array` constructor. It can also be fooled by an object whose prototype was set to `Array.prototype`.
  - **`value.constructor === Array`** has the same realm problem and crashes on `null` or `undefined`.
  - **`Object.prototype.toString.call(value) === "[object Array]"`** was the classic pre-ES5 workaround. It works, but `Array.isArray` is clearer.

  Related points:

  - **Array-like objects** such as `arguments`, a DOM `NodeList` or an `HTMLCollection` have a `length` and numeric keys but are not arrays, so `Array.isArray` returns `false`. Convert them with `Array.from(value)` or spread `[...value]` to use array methods.
  - **Typed arrays** like `Uint8Array` are not regular arrays either; `Array.isArray(new Uint8Array(2))` is `false`.
  - An empty array is truthy, so `if (arr)` does not check for emptiness. Combine the checks: `Array.isArray(value) && value.length > 0`.

  In practice, use `Array.isArray` when validating input, for example a function that accepts either one item or a list: `const list = Array.isArray(input) ? input : [input];`.
codeExample: |
  const values = [[1, 2], [], { length: 0 }, "abc", null, new Uint8Array(2)];

  for (const v of values) {
    console.log(Array.isArray(v));
  }
  // Output: true
  // Output: true
  // Output: false
  // Output: false
  // Output: false
  // Output: false

  console.log(typeof [], typeof {}); // Output: object object

  function toList(input) {
    return Array.isArray(input) ? input : [input];
  }
  console.log(toList("a"), toList(["a", "b"])); // Output: [ 'a' ] [ 'a', 'b' ]

  function args() {
    return [Array.isArray(arguments), Array.isArray(Array.from(arguments))];
  }
  console.log(args(1, 2)); // Output: [ false, true ]
popularity: 7.9
isPublished: true
---

---
course: javascript
slug: mutating-vs-non-mutating-array-methods
experienceLevel: fresher
difficulty: medium
tags:
  - arrays
  - immutability
question: Which array methods mutate the original array, and which return a new one?
answer: |
  Mutating methods change the array they are called on, while non-mutating methods leave it untouched and return a new array or value.

  **Mutating** (change the original):

  - `push`, `pop`, `shift`, `unshift`
  - `splice`
  - `sort`, `reverse`
  - `fill`, `copyWithin`

  **Non-mutating** (return something new):

  - `map`, `filter`, `reduce`, `slice`, `concat`, `flat`, `flatMap`
  - `find`, `findIndex`, `findLast`, `includes`, `indexOf`, `some`, `every`, `join`
  - The ES2023 "change array by copy" methods: `toSorted`, `toReversed`, `toSpliced` and `with(index, value)`, which are copying versions of `sort`, `reverse`, `splice` and index assignment.

  Why it matters: arrays are passed by reference, so mutating an array inside a function changes it for every other piece of code holding that reference. Frameworks such as React and state libraries like Redux rely on new references to detect changes; calling `state.items.push(x)` keeps the same reference, so the UI may not update. Use `[...items, x]` or `items.concat(x)` instead.

  Pitfalls interviewers like:

  - `sort` mutates **and** returns the same array, so `const sorted = arr.sort()` changes `arr` too. Use `toSorted()` or `[...arr].sort()`.
  - The default `sort` compares items as strings, so `[10, 9, 1].sort()` gives `[1, 10, 9]`. Pass a comparator: `(a, b) => a - b`.
  - Non-mutating methods produce **shallow** copies; objects inside the new array are still shared with the original.
codeExample: |
  const scores = [40, 100, 9];

  const sortedCopy = scores.toSorted((a, b) => a - b);
  console.log(sortedCopy, scores); // Output: [ 9, 40, 100 ] [ 40, 100, 9 ]

  const sameArray = scores.sort();
  console.log(scores); // Output: [ 100, 40, 9 ]
  console.log(sameArray === scores); // Output: true

  const items = ["a", "b"];
  const added = [...items, "c"]; // new array
  console.log(items, added); // Output: [ 'a', 'b' ] [ 'a', 'b', 'c' ]

  const replaced = items.with(0, "z"); // ES2023 copy-and-replace
  console.log(replaced, items); // Output: [ 'z', 'b' ] [ 'a', 'b' ]

  items.push("d"); // mutates
  console.log(items); // Output: [ 'a', 'b', 'd' ]
popularity: 8.2
isPublished: true
---

---
course: javascript
slug: slice-vs-splice
experienceLevel: fresher
difficulty: easy
tags:
  - arrays
question: "What is the difference between `slice` and `splice`?"
answer: |
  `slice` returns a shallow copy of part of an array without changing it, while `splice` modifies the original array in place by removing, replacing or inserting elements, and returns the removed elements.

  **`slice(start, end)`**

  - Copies from index `start` up to, but **not including**, `end`.
  - Both arguments are optional: `arr.slice()` copies the whole array.
  - Negative indexes count from the end: `arr.slice(-2)` gives the last two elements.
  - Also exists on strings: `"hello".slice(1, 3)` is `"el"`.

  **`splice(start, deleteCount, ...items)`**

  - Removes `deleteCount` elements starting at `start`, then inserts `items` at that position.
  - Returns an array of the **removed** elements (empty if nothing was removed), not the updated array.
  - With `deleteCount` of `0`, it only inserts. If `deleteCount` is omitted, it removes everything from `start` to the end.
  - Only exists on arrays.

  An easy way to remember: s**p**lice has an extra "p" because it changes the array in **p**lace.

  Common pitfalls:

  - Expecting `splice` to return the new array. It returns the removed items.
  - Confusing the second argument: in `slice` it is an end **index**, in `splice` it is a **count**.
  - Calling `splice` inside a forward `for` loop shifts the remaining indexes and skips elements. Loop backwards, or use `filter` to build a new array.

  If you want `splice` behaviour without mutation, ES2023 added `toSpliced`, which returns a new array.
codeExample: |
  const letters = ["a", "b", "c", "d", "e"];

  console.log(letters.slice(1, 3)); // Output: [ 'b', 'c' ]
  console.log(letters.slice(-2)); // Output: [ 'd', 'e' ]
  console.log(letters); // Output: [ 'a', 'b', 'c', 'd', 'e' ]

  const removed = letters.splice(1, 2, "X", "Y", "Z");
  console.log(removed); // Output: [ 'b', 'c' ]
  console.log(letters); // Output: [ 'a', 'X', 'Y', 'Z', 'd', 'e' ]

  letters.splice(1, 0, "inserted"); // delete nothing, just insert
  console.log(letters.length); // Output: 7

  const nums = [1, 2, 3];
  const copy = nums.toSpliced(0, 1); // non-mutating version
  console.log(copy, nums); // Output: [ 2, 3 ] [ 1, 2, 3 ]
popularity: 8.9
isPublished: true
---

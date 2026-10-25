---
course: javascript
slug: map-filter-reduce
experienceLevel: fresher
difficulty: easy
tags:
  - arrays
  - functional-programming
question: "Explain `map`, `filter` and `reduce` in JavaScript."
answer: |
  `map`, `filter` and `reduce` are array methods that take a callback and return a new result without changing the original array: `map` transforms every element, `filter` keeps the elements that pass a test, and `reduce` combines all elements into a single value.

  - **`map(callback)`** returns a new array of the **same length**, where each element is whatever the callback returns. Example: `prices.map(p => p * 1.2)`.
  - **`filter(callback)`** returns a new array with only the elements for which the callback returns a truthy value. The result can be shorter, or empty.
  - **`reduce(callback, initialValue)`** walks the array carrying an **accumulator**. The callback receives `(accumulator, element, index, array)` and returns the next accumulator. The final accumulator is the result, which can be a number, string, object or array.

  All three callbacks also receive the index and the array as extra arguments.

  Common pitfalls:

  - Forgetting to `return` inside a multi-line callback with braces, which gives `undefined` values in `map` or an empty result from `filter`.
  - Calling `reduce` on an empty array **without** an initial value throws a `TypeError`. Always pass an initial value; it also makes the accumulator type obvious.
  - `["1", "2", "3"].map(parseInt)` gives `[1, NaN, NaN]`, because `parseInt` receives the index as its radix. Use `map(Number)` or an arrow function.

  They chain nicely, as in `orders.filter(...).map(...).reduce(...)`, which reads like a description of the data flow. For very large arrays, each step creates an intermediate array, so a single loop can be faster, but readability usually wins.
codeExample: |
  const orders = [
    { item: "Book", price: 12, paid: true },
    { item: "Pen", price: 2, paid: false },
    { item: "Bag", price: 30, paid: true },
  ];

  const names = orders.map((o) => o.item);
  console.log(names); // Output: [ 'Book', 'Pen', 'Bag' ]

  const paid = orders.filter((o) => o.paid);
  console.log(paid.length); // Output: 2

  const revenue = paid.reduce((total, o) => total + o.price, 0);
  console.log(revenue); // Output: 42

  const byName = orders.reduce((acc, o) => ({ ...acc, [o.item]: o.price }), {});
  console.log(byName); // Output: { Book: 12, Pen: 2, Bag: 30 }

  console.log(["1", "2", "3"].map(parseInt)); // Output: [ 1, NaN, NaN ]
  console.log(["1", "2", "3"].map(Number)); // Output: [ 1, 2, 3 ]
popularity: 9.4
isPublished: true
---

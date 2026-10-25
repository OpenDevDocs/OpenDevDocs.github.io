---
course: javascript
slug: foreach-vs-map
experienceLevel: fresher
difficulty: easy
tags:
  - arrays
question: "What is the difference between `forEach` and `map`?"
answer: |
  `map` returns a new array built from the callback's return values, while `forEach` always returns `undefined` and is used only for side effects.

  Use **`map`** when you want to transform data: converting prices, extracting a field, building a list of UI elements. The original array is not modified, and the result has the same length.

  Use **`forEach`** when you want to *do* something for each element and do not need a result: logging, writing to the DOM, pushing to another collection, calling an API.

  Other points interviewers look for:

  - **Chaining:** `map` can be chained (`.map().filter()`), `forEach` cannot, because it returns `undefined`.
  - **Misuse:** using `map` just for side effects creates and throws away an array, and linters flag it. Using `forEach` plus `push` to build an array is a longer way of writing `map`.
  - **No early exit:** neither can be stopped with `break`. A `return` inside the callback only skips the current element. If you need to stop early, use a `for...of` loop, or `some`, `every` or `find`.
  - **Async callbacks:** `forEach` does not wait for `async` callbacks; it fires them all and returns immediately. For sequential work use `for...of` with `await`; for parallel work use `await Promise.all(items.map(async ...))`.
  - Both skip empty slots in sparse arrays.

  Performance differences are negligible in practice; choose based on intent.
codeExample: |
  const prices = [10, 20, 30];

  const withTax = prices.map((p) => p * 1.2);
  console.log(withTax); // Output: [ 12, 24, 36 ]

  const result = prices.forEach((p) => console.log(`Price: ${p}`));
  // Output: Price: 10
  // Output: Price: 20
  // Output: Price: 30
  console.log(result); // Output: undefined

  // No early exit with forEach: return only skips one element
  prices.forEach((p) => {
    if (p === 20) return;
    console.log(p);
  });
  // Output: 10
  // Output: 30

  // Use for...of when you need break
  for (const p of prices) {
    if (p > 15) break;
    console.log("under 15:", p); // Output: under 15: 10
  }
popularity: 9.1
isPublished: true
---

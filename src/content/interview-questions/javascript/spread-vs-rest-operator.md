---
course: javascript
slug: spread-vs-rest-operator
experienceLevel: fresher
difficulty: easy
tags:
  - es6
  - arrays
  - objects
question: "What is the difference between the spread and rest syntax (`...`)?"
answer: |
  Both use the same three dots, but **spread** expands an iterable or object into individual elements, while **rest** collects multiple elements into a single array or object. Which one you get depends on where the `...` appears.

  **Spread** appears where values are being used:

  - In array literals: `[...a, ...b]` merges arrays; `[...str]` splits a string into characters.
  - In function calls: `Math.max(...numbers)` passes each element as a separate argument.
  - In object literals: `{ ...defaults, ...options }` copies properties; later properties overwrite earlier ones.

  **Rest** appears where values are being received:

  - In function parameters: `function sum(...nums)` gathers all remaining arguments into a real array. It must be the last parameter.
  - In destructuring: `const [first, ...others] = list;` or `const { id, ...data } = obj;`.

  A simple way to remember it: spread "unpacks" on the right-hand side or in a call; rest "packs" on the left-hand side or in a parameter list.

  Pitfalls:

  - Spread makes a **shallow copy**. Nested objects and arrays are still shared, so changing `copy.address.city` also changes the original.
  - Array spread requires an iterable; `[...{ a: 1 }]` throws a `TypeError`. Object spread works on any value and simply ignores `null` and `undefined`.
  - Spreading a very large array into a function call can exceed the engine's argument limit.

  Rest parameters replace the old `arguments` object, which is not a real array and does not exist in arrow functions.
codeExample: |
  // Spread: expand
  const a = [1, 2];
  const b = [3, 4];
  console.log([...a, ...b]); // Output: [ 1, 2, 3, 4 ]
  console.log(Math.max(...b)); // Output: 4
  console.log([..."hey"]); // Output: [ 'h', 'e', 'y' ]

  const defaults = { theme: "light", size: "md" };
  const settings = { ...defaults, theme: "dark" };
  console.log(settings); // Output: { theme: 'dark', size: 'md' }

  // Rest: collect
  function sum(label, ...nums) {
    return `${label}: ${nums.reduce((t, n) => t + n, 0)}`;
  }
  console.log(sum("Total", 1, 2, 3)); // Output: Total: 6

  const { theme, ...others } = settings;
  console.log(theme, others); // Output: dark { size: 'md' }
popularity: 9.0
isPublished: true
---

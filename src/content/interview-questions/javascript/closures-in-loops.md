---
course: javascript
slug: closures-in-loops
experienceLevel: mid
difficulty: medium
tags:
  - closures
  - scope
  - var-let-const
question: "Why does a `for` loop with `var` and `setTimeout` print the same value every time, and how does `let` fix it?"
answer: |
  With `var` there is only **one** loop variable for the whole function, and every callback closes over that same variable, so by the time the callbacks run the loop has finished and they all see its final value; `let` creates a **new binding for each iteration**, so each callback captures its own copy.

  Step by step for `for (var i = 0; i < 3; i++) setTimeout(() => console.log(i))`:

  1. `var i` is function-scoped (or global), so a single `i` exists.
  2. The loop schedules three callbacks; each closure references that one `i`, not its value at the time.
  3. The loop ends with `i === 3`.
  4. The timers fire after the synchronous code finishes and print `3`, `3`, `3`.

  With `let i`, the specification creates a fresh copy of `i` for every iteration, initialised from the previous one before the increment. Each closure gets a different binding, so the output is `0`, `1`, `2`. This per-iteration behaviour also applies to `for...of` and `for...in` with `let` or `const`.

  Pre-ES2015 fixes you may still see in old code:

  - An IIFE that receives `i` as a parameter: `(function (j) { setTimeout(() => console.log(j)); })(i)`.
  - Passing the value as an extra argument: `setTimeout(console.log, 0, i)`.
  - Using `forEach`, whose callback gets a new parameter on every call.

  Pitfalls:

  - The same bug appears with event handlers attached in a loop, not just timers.
  - `const` works in `for...of` but not in a classic `for (const i = 0; ...; i++)`, because the increment reassigns it and throws a `TypeError`.
  - A `let` declared **outside** the loop and only updated inside it has the same problem as `var`: one shared binding.

  The underlying lesson is that closures capture variables (bindings), not values.
codeExample: |
  const withVar = [];
  for (var i = 0; i < 3; i++) {
    withVar.push(() => i);           // all closures share one i
  }
  console.log(withVar.map((f) => f())); // Output: [ 3, 3, 3 ]

  const withLet = [];
  for (let j = 0; j < 3; j++) {
    withLet.push(() => j);           // a new j per iteration
  }
  console.log(withLet.map((f) => f())); // Output: [ 0, 1, 2 ]

  // Old-school fix with an IIFE
  const withIife = [];
  for (var k = 0; k < 3; k++) {
    (function (copy) { withIife.push(() => copy); })(k);
  }
  console.log(withIife.map((f) => f())); // Output: [ 0, 1, 2 ]

  // Shared outer binding: same bug as var
  let shared = 0;
  const outer = [];
  while (shared < 3) { outer.push(() => shared); shared++; }
  console.log(outer.map((f) => f())); // Output: [ 3, 3, 3 ]

  for (var t = 0; t < 3; t++) setTimeout(() => process.stdout.write(`var:${t} `), 0);
  for (let u = 0; u < 3; u++) setTimeout(() => process.stdout.write(`let:${u} `), 0);
  // Output: var:3 var:3 var:3 let:0 let:1 let:2
popularity: 8.7
isPublished: true
---

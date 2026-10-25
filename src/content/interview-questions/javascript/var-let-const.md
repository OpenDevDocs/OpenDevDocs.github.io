---
course: javascript
slug: var-let-const
experienceLevel: fresher
difficulty: easy
tags:
  - variables
  - scope
question: "What is the difference between `var`, `let` and `const`?"
answer: |
  `var` is function-scoped and can be redeclared, while `let` and `const` are block-scoped; `const` additionally cannot be reassigned after initialisation.

  The main differences:

  - **Scope:** `var` belongs to the nearest function (or the global scope). `let` and `const` belong to the nearest `{ }` block, such as an `if` body or a loop.
  - **Hoisting:** all three are hoisted, but `var` is initialised to `undefined`, so reading it early gives `undefined`. `let` and `const` sit in the **temporal dead zone** until their declaration runs, and reading them early throws a `ReferenceError`.
  - **Redeclaration:** `var x` twice in the same scope is allowed; doing it with `let` or `const` is a `SyntaxError`.
  - **Global object:** a top-level `var` in a classic script becomes a property of `window`; `let` and `const` do not.

  A common pitfall: `const` does not make a value immutable. It only prevents rebinding the variable. A `const` array or object can still be changed with `push` or property assignment; use `Object.freeze` if you need shallow immutability.

  In practice, use `const` by default, `let` when you genuinely need to reassign (counters, accumulators), and avoid `var` in new code. The classic bug `var` causes is a loop where every callback sees the final value of `i`, because there is only one shared variable; `let` creates a fresh binding per iteration.
codeExample: |
  const list = [1, 2];
  list.push(3); // allowed: the array is mutated, not reassigned
  console.log(list); // Output: [ 1, 2, 3 ]

  try {
    list = []; // reassigning a const binding
  } catch (err) {
    console.log(err.name); // Output: TypeError
  }

  // One shared var vs a fresh let binding per iteration
  for (var i = 0; i < 3; i++) {
    setTimeout(() => console.log("var:", i));
  }
  for (let j = 0; j < 3; j++) {
    setTimeout(() => console.log("let:", j));
  }
  // Output: var: 3
  // Output: var: 3
  // Output: var: 3
  // Output: let: 0
  // Output: let: 1
  // Output: let: 2
popularity: 9.4
isPublished: true
---

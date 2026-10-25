---
course: javascript
slug: what-is-hoisting
experienceLevel: fresher
difficulty: medium
tags:
  - hoisting
  - scope
question: What is hoisting in JavaScript?
answer: |
  Hoisting is the behaviour where declarations are processed before any code in their scope runs, so the names exist from the start of the scope even though they are written further down.

  Nothing is physically moved. Before executing a scope, the engine registers every declaration in it, and what you can do with a name early depends on how it was declared:

  - **Function declarations** are hoisted with their body, so you can call them before the line where they appear.
  - **`var`** is hoisted and initialised to `undefined`. Reading it early gives `undefined`, not an error, and the assignment still happens on its own line.
  - **`let`, `const` and `class`** are hoisted but not initialised. From the start of the block until the declaration line they are in the **temporal dead zone (TDZ)**, and any access throws a `ReferenceError`.
  - **Function expressions and arrow functions** follow the rules of the variable that holds them. `var fn = () => {}` gives `undefined` early, so calling it throws `TypeError: fn is not a function`.

  The TDZ is why this fails even though an outer `x` exists: inside a block that declares `let x`, the inner `x` shadows the outer one for the whole block, including the lines before its declaration.

  In practice, hoisting of function declarations is handy for putting helper functions at the bottom of a file. For variables, declare them before use with `let` or `const`; the TDZ turns a silent `undefined` bug into a clear error.
codeExample: |
  console.log(sayHi()); // Output: Hi!
  function sayHi() {
    return "Hi!";
  }

  console.log(score); // Output: undefined
  var score = 10;

  try {
    console.log(total);
  } catch (err) {
    console.log(err.name); // Output: ReferenceError
  }
  let total = 5;

  try {
    greet();
  } catch (err) {
    console.log(err.message); // Output: greet is not a function
  }
  var greet = () => "Hello";
popularity: 9.2
isPublished: true
---

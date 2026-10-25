---
course: javascript
slug: function-declaration-vs-expression
experienceLevel: fresher
difficulty: easy
tags:
  - functions
  - hoisting
question: What is the difference between a function declaration and a function expression?
answer: |
  A function declaration is a statement that starts with the `function` keyword and is fully hoisted, while a function expression creates a function as a value inside an expression, usually assigned to a variable, and can only be called after that assignment runs.

  ```js
  function add(a, b) { return a + b; }          // declaration
  const subtract = function (a, b) { return a - b; }; // expression
  ```

  Key differences:

  - **Hoisting:** a declaration can be called before the line where it is written. An expression follows the rules of its variable: with `const` or `let`, calling early throws a `ReferenceError`; with `var`, it throws a `TypeError` because the variable is `undefined`.
  - **Name:** a declaration must have a name. An expression may be anonymous, or **named** (`const fact = function inner(n) {...}`), where the name `inner` is only visible inside the function and is useful for recursion and clearer stack traces.
  - **Usage as a value:** expressions are natural wherever a value is expected: callbacks, object methods, immediately invoked functions and conditional definitions.

  Arrow functions (`const square = (x) => x * x;`) are always expressions too, with extra differences around `this`.

  In practice, both styles are common. Declarations read well for top-level helpers and allow ordering a file "main logic first". `const` with an expression or arrow function prevents the function from being accidentally reassigned and makes the "define before use" order explicit. Pick one convention per codebase and stay consistent.
codeExample: |
  console.log(add(2, 3)); // Output: 5

  function add(a, b) {
    return a + b;
  }

  try {
    multiply(2, 3);
  } catch (err) {
    console.log(err.name); // Output: ReferenceError
  }

  const multiply = function (a, b) {
    return a * b;
  };
  console.log(multiply(2, 3)); // Output: 6

  // Named function expression: the name is only visible inside
  const factorial = function fact(n) {
    return n <= 1 ? 1 : n * fact(n - 1);
  };
  console.log(factorial(5)); // Output: 120
  console.log(typeof fact); // Output: undefined
popularity: 8.6
isPublished: true
---

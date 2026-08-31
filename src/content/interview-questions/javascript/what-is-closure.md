---
course: javascript
slug: what-is-closure
experienceLevel: fresher
difficulty: easy
tags:
  - closures
  - functions
  - scope
question: What is a closure in JavaScript?
answer: |
  A closure is a function that retains access to variables from its outer scope even after that outer function has finished executing.

  This allows the inner function to "remember" and work with data from the surrounding lexical environment.

  Example:

  ```js
  function outer() {
    const count = 0;

    return function inner() {
      console.log(count);
    };
  }

  const counter = outer();
  counter();
  ```

  Closures are commonly used for data encapsulation, private state, and callback patterns.
codeExample: |
  function outer() {
    let count = 0;

    return function inner() {
      count += 1;
      console.log(count);
    };
  }

  const counter = outer();
  counter();
  counter();
popularity: 9.2
isPublished: true
---

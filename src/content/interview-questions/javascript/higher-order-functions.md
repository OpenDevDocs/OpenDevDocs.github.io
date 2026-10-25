---
course: javascript
slug: higher-order-functions
experienceLevel: fresher
difficulty: easy
tags:
  - functions
  - functional-programming
question: What is a higher-order function?
answer: |
  A higher-order function is a function that takes another function as an argument, returns a function, or both.

  This is possible because functions in JavaScript are **first-class values**: they can be stored in variables, passed as arguments, returned from other functions and kept in arrays or objects.

  Examples you already use:

  - **Taking a function:** `map`, `filter`, `reduce`, `sort`, `forEach`, `setTimeout`, `addEventListener` and `Promise.prototype.then` all accept a callback.
  - **Returning a function:** `fn.bind(obj)` returns a new function; a factory like `makeMultiplier(2)` returns a function that doubles its input.

  Why they are useful:

  - **Reuse and abstraction:** the higher-order function handles the "how" (looping, timing, retrying) and the callback supplies the "what". `filter` knows how to loop; you only describe which items to keep.
  - **Configuration through closures:** a returned function remembers the arguments of its outer call, so you can create specialised functions such as `const isAdult = minAge(18)`.
  - **Wrapping behaviour:** utilities like `debounce`, `throttle`, `once` and `memoize` take a function and return an enhanced version. Logging, timing or permission checks can be added the same way.
  - **Composition:** small functions can be combined into pipelines.

  Pitfalls: passing the result of a call instead of the function (`setTimeout(fn(), 100)`), losing `this` when passing methods, and creating unreadable chains of anonymous functions. Name your callbacks when the logic is more than a line.

  In interviews, a good follow-up is to write a simple higher-order utility such as `once` or `debounce` yourself.
codeExample: |
  // Returns a function
  function makeMultiplier(factor) {
    return (n) => n * factor;
  }
  const double = makeMultiplier(2);
  console.log(double(5)); // Output: 10

  // Takes a function and returns an enhanced version
  function once(fn) {
    let called = false;
    let result;
    return (...args) => {
      if (!called) {
        called = true;
        result = fn(...args);
      }
      return result;
    };
  }
  const init = once(() => {
    console.log("Initialising...");
    return "ready";
  });
  console.log(init());
  // Output: Initialising...
  // Output: ready
  console.log(init()); // Output: ready

  // Built-in higher-order functions
  console.log([1, 2, 3].map(double).filter((n) => n > 2)); // Output: [ 4, 6 ]
popularity: 8.6
isPublished: true
---

---
course: javascript
slug: iife
experienceLevel: fresher
difficulty: easy
tags:
  - functions
  - scope
question: What is an IIFE (Immediately Invoked Function Expression)?
answer: |
  An IIFE is a function expression that is defined and called immediately, in one step, usually to create a private scope for the code inside it.

  ```js
  (function () {
    // runs once, right away
  })();
  ```

  The first pair of parentheses turns the function into an **expression**. Without them, a line starting with `function` is parsed as a declaration, and adding `()` after it is a `SyntaxError`. The final `()` calls it. Arrow functions work too: `(() => { ... })();`.

  Why it was popular:

  - **Avoiding global variables:** before `let`, `const` and modules, every top-level `var` in a script became a global. Wrapping code in an IIFE kept variables private and avoided clashes between scripts.
  - **The module pattern:** an IIFE can return an object that exposes some functions while keeping other data private through a closure.
  - **Capturing loop values** with `var`, before `let` gave each iteration its own binding.

  Where you still see it today:

  - **Async code at the top level** of a CommonJS script, where top-level `await` is not available: `(async () => { await main(); })();`.
  - Running a block of setup code once while keeping its temporary variables out of the outer scope.
  - Library bundles built in the IIFE format for plain `<script>` tags.

  In modern code, ES modules and block scope cover most of the original reasons. One pitfall: if the previous line has no semicolon, a line starting with `(` can be parsed as a function call on that line, so some style guides start IIFEs with a semicolon.
codeExample: |
  const counter = (function () {
    let count = 0; // private: not reachable from outside

    return {
      increment() {
        count++;
        return count;
      },
      reset() {
        count = 0;
      },
    };
  })();

  counter.increment();
  console.log(counter.increment()); // Output: 2
  console.log(counter.count); // Output: undefined

  const config = (() => {
    const env = "production"; // temporary variable stays inside
    return { env, debug: env !== "production" };
  })();
  console.log(config); // Output: { env: 'production', debug: false }

  (async () => {
    const value = await Promise.resolve(42);
    console.log(value); // Output: 42
  })();
popularity: 7.5
isPublished: true
---

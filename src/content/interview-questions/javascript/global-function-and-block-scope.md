---
course: javascript
slug: global-function-and-block-scope
experienceLevel: fresher
difficulty: easy
tags:
  - scope
  - variables
question: What is the difference between global, function and block scope?
answer: |
  Scope decides where a variable can be accessed: global variables are visible everywhere, function-scoped variables only inside their function, and block-scoped variables only inside the `{ }` block that declares them.

  - **Global scope:** variables declared outside any function or block. In a classic browser script, top-level `var` and function declarations also become properties of `window`. In ES modules and Node.js files, top-level declarations are scoped to the module instead, which avoids accidental globals.
  - **Function scope:** every function creates a scope. Anything declared inside it, with `var`, `let` or `const`, is invisible outside.
  - **Block scope:** `let`, `const` and `class` are limited to the nearest block, such as an `if` body, a loop or a bare `{ }`. `var` ignores blocks and leaks out to the enclosing function.

  JavaScript uses **lexical scope**: an inner scope can read variables from outer scopes, based on where the code is written, not where it is called. The engine looks up a name in the current scope, then the parent, and so on up to the global scope. This chain is what makes closures work.

  An inner variable with the same name **shadows** the outer one inside that scope.

  Common pitfalls: assigning to an undeclared name in sloppy mode silently creates a global (strict mode throws instead), and `var` inside a loop or `if` leaks into the whole function. Keep variables in the smallest scope that works; it reduces naming clashes and makes code easier to reason about.
codeExample: |
  const appName = "Shop"; // global (module-level in a module)

  function checkout() {
    const total = 100; // function scope
    if (total > 50) {
      let discount = 10; // block scope
      var note = "big order"; // var leaks to the function
      console.log(appName, total - discount); // Output: Shop 90
    }
    console.log(note); // Output: big order
    console.log(typeof discount); // Output: undefined
  }
  checkout();

  console.log(typeof total); // Output: undefined

  const level = "outer";
  {
    const level = "inner"; // shadows the outer variable
    console.log(level); // Output: inner
  }
  console.log(level); // Output: outer
popularity: 8.5
isPublished: true
---

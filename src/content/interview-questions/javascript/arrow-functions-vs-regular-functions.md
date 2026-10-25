---
course: javascript
slug: arrow-functions-vs-regular-functions
experienceLevel: fresher
difficulty: medium
tags:
  - functions
  - this
question: How are arrow functions different from regular functions?
answer: |
  Arrow functions are a shorter function syntax that, most importantly, do not have their own `this`; they use the `this` of the surrounding scope where they are defined.

  Differences that matter:

  - **`this`:** a regular function gets `this` from how it is called (`obj.method()` sets it to `obj`). An arrow function captures `this` lexically and it can never be changed, not even with `call`, `apply` or `bind`.
  - **No `arguments` object:** use rest parameters (`...args`) instead.
  - **Not constructors:** calling an arrow function with `new` throws a `TypeError`, and it has no `prototype` property.
  - **Concise syntax:** `x => x * 2` has an implicit return. To return an object literal, wrap it in parentheses: `() => ({ id: 1 })`.
  - **No hoisting as a declaration:** arrows are always expressions, so they follow the rules of the variable that holds them.

  When to use which:

  - Arrows are ideal for callbacks (`map`, `filter`, `setTimeout`, promise chains) and for functions inside methods that need the outer `this`, which removes the old `const self = this` trick.
  - Do **not** use an arrow as an object method or prototype method that relies on `this`; it will see the outer `this` (often `undefined` in modules) instead of the object.
  - Use regular functions or class methods when you need `new`, `arguments`, or a dynamic `this`, such as some DOM event handlers that read `this` as the element.
codeExample: |
  const timer = {
    seconds: 0,
    tick() {
      // Arrow callback: `this` is still `timer`
      [1, 2, 3].forEach(() => this.seconds++);
      return this.seconds;
    },
    name: "timer",
    regularMethod() {
      return this.name;
    },
    arrowMethod: () => this?.name, // `this` comes from the outer scope, not timer
  };

  console.log(timer.tick()); // Output: 3
  console.log(timer.regularMethod()); // Output: timer
  console.log(timer.arrowMethod()); // Output: undefined

  const double = (n) => n * 2; // implicit return
  const makeUser = (name) => ({ name }); // wrap object literals in ()
  console.log(double(4), makeUser("Ada")); // Output: 8 { name: 'Ada' }

  try {
    new double(1);
  } catch (err) {
    console.log(err.message); // Output: double is not a constructor
  }
popularity: 9.3
isPublished: true
---

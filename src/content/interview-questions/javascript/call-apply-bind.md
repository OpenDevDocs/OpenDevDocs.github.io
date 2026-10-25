---
course: javascript
slug: call-apply-bind
experienceLevel: mid
difficulty: easy
tags:
  - this
  - functions
question: "What is the difference between `call`, `apply` and `bind`?"
answer: |
  All three let you choose the value of `this` for a function: `call` and `apply` invoke the function immediately, while `bind` returns a **new** function with `this` (and optionally some leading arguments) fixed permanently.

  - `fn.call(thisArg, a, b)` calls `fn` with the arguments listed one by one.
  - `fn.apply(thisArg, [a, b])` calls `fn` with the arguments passed as an array or array-like object.
  - `fn.bind(thisArg, a)` returns a bound function. Whenever it is called later, `this` is `thisArg` and `a` is prepended to the arguments, which is a form of partial application.

  Typical uses:

  - Passing a method as a callback without losing `this`, for example `element.addEventListener('click', this.onClick.bind(this))`.
  - Borrowing a method from another object, such as `Array.prototype.join.call(arguments, '-')`.
  - Historically, `Math.max.apply(null, numbers)` spread an array into arguments. Spread syntax, `Math.max(...numbers)`, replaces that today.

  Rules worth knowing:

  1. A bound function cannot be re-bound. A later `bind`, `call` or `apply` cannot change its `this`; only extra arguments are added.
  2. Arrow functions have no own `this`, so these methods cannot change it. The `thisArg` is simply ignored.
  3. Calling a bound function with `new` ignores the bound `this` but keeps the bound arguments.
  4. In strict mode (modules and classes are always strict), passing `null` or `undefined` leaves `this` as that value. In sloppy mode it is replaced by `globalThis`.

  Pitfall: every `bind` call creates a new function, so `removeEventListener('click', this.onClick.bind(this))` removes nothing. Store the bound function in a variable or class field and pass the same reference to both calls.
codeExample: |
  const person = { name: 'Ada' };

  function greet(greeting, punctuation) {
    return `${greeting}, ${this.name}${punctuation}`;
  }

  console.log(greet.call(person, 'Hello', '!'));   // Output: Hello, Ada!
  console.log(greet.apply(person, ['Hi', '?']));   // Output: Hi, Ada?

  const greetAda = greet.bind(person, 'Hey');      // this and first argument fixed
  console.log(greetAda('.'));                      // Output: Hey, Ada.

  const rebound = greetAda.bind({ name: 'Bob' });  // cannot change this again
  console.log(rebound('!'));                       // Output: Hey, Ada!

  function joinArgs() {
    return Array.prototype.join.call(arguments, '-'); // borrow an array method
  }
  console.log(joinArgs('a', 'b', 'c'));            // Output: a-b-c

  const nums = [3, 9, 4];
  console.log(Math.max.apply(null, nums), Math.max(...nums)); // Output: 9 9
popularity: 8.8
isPublished: true
---

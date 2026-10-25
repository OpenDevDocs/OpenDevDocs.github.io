---
course: javascript
slug: what-is-this-keyword
experienceLevel: fresher
difficulty: medium
tags:
  - this
  - functions
question: "How does the `this` keyword work in JavaScript?"
answer: |
  `this` refers to the object a function is working with, and for regular functions it is decided by **how the function is called**, not where it is defined.

  The basic rules, from highest to lowest priority:

  1. **`new` binding:** `new User()` creates a fresh object and sets `this` to it inside the constructor.
  2. **Explicit binding:** `fn.call(obj, ...)`, `fn.apply(obj, [...])` and `fn.bind(obj)` set `this` to `obj`. `bind` returns a new function with `this` permanently fixed.
  3. **Method call:** `obj.method()` sets `this` to `obj`, the object before the dot.
  4. **Plain call:** `fn()` gives `this` as `undefined` in strict mode (which includes modules and classes), or the global object in sloppy scripts.

  **Arrow functions** ignore all of these rules. They have no `this` of their own and use the `this` of the scope where they were written.

  At the top level, `this` is `undefined` in ES modules, `module.exports` in CommonJS files, and `window` in classic browser scripts. In a DOM event handler written as a regular function, `this` is the element the listener is attached to.

  The classic bug is **losing `this`** when a method is passed as a callback:

  ```js
  setTimeout(user.greet, 100); // `this` is no longer user
  ```

  The method is detached from its object, so it becomes a plain call. Fix it with `user.greet.bind(user)`, a wrapper arrow `() => user.greet()`, or a class field arrow function. The same problem appears when passing class methods as event handlers in UI frameworks.
codeExample: |
  "use strict";

  const user = {
    name: "Ada",
    greet() {
      return `Hi, I am ${this?.name}`;
    },
  };

  console.log(user.greet()); // Output: Hi, I am Ada

  const detached = user.greet;
  console.log(detached()); // Output: Hi, I am undefined

  const bound = user.greet.bind(user);
  console.log(bound()); // Output: Hi, I am Ada

  const other = { name: "Grace" };
  console.log(user.greet.call(other)); // Output: Hi, I am Grace

  function Person(name) {
    this.name = name;
  }
  console.log(new Person("Linus").name); // Output: Linus
popularity: 9.3
isPublished: true
---

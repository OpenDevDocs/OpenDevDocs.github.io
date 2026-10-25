---
course: javascript
slug: losing-this-in-callbacks
experienceLevel: mid
difficulty: medium
tags:
  - this
  - functions
  - classes
question: "Why does `this` get lost when you pass a method as a callback, and how do you fix it?"
answer: |
  `this` is decided by **how a function is called**, not where it is defined, so when you pass a method as a callback (`setTimeout(obj.tick)`, `items.map(obj.format)`) it is later called as a plain function and `this` becomes `undefined` in strict code, or `globalThis` in sloppy code.

  Why it happens: `obj.tick` only reads a function value. The `obj.` part sets `this` only when the call happens right there, as in `obj.tick()`. Once the function is detached, the link to `obj` is gone. Class bodies are always strict, so the usual symptom is `TypeError: Cannot read properties of undefined`. DOM event listeners are a special case: a regular function listener gets the element as `this`, which is just as wrong when you expected your component.

  Fixes:

  1. **Arrow function wrapper** at the call site: `setTimeout(() => this.tick(), 1000)`. Arrow functions take `this` from the surrounding scope.
  2. **`bind`**: `setTimeout(this.tick.bind(this))`, or bind once in the constructor.
  3. **Class field arrow function**: `tick = () => { ... }`. Each instance gets its own pre-bound function. Convenient for event handlers, but the method is no longer on the prototype, so it costs memory per instance and cannot be called via `super` or easily stubbed on the prototype in tests.
  4. Use the `thisArg` parameter where an API offers it: `items.map(fn, thisArg)`.

  Pitfalls:

  - An arrow function used as an object-literal method does not get the object as `this`; it captures the outer `this`.
  - A regular `function` callback nested inside a method loses `this` again. Use an arrow callback there.
  - To remove an event listener later, keep a reference to the exact bound function you added.

  Rule of thumb: write regular methods on classes, and use arrow functions for callbacks.
codeExample: |
  'use strict';

  class Counter {
    count = 0;
    increment() { this.count += 1; return this.count; }
    incrementArrow = () => { this.count += 1; return this.count; };
  }

  const c = new Counter();
  const detached = c.increment;
  try {
    detached();
  } catch (err) {
    console.log(err.message); // Output: Cannot read properties of undefined (reading 'count')
  }

  console.log([0, 0].map(() => c.increment()));  // Output: [ 1, 2 ]
  console.log([0].map(c.increment.bind(c)));     // Output: [ 3 ]
  console.log([0].map(c.incrementArrow));        // Output: [ 4 ]

  const obj = {
    name: 'obj',
    regular() { return [0].map(function () { return this; }); },
    arrow() { return [0].map(() => this.name); },
  };
  console.log(obj.regular()); // Output: [ undefined ]
  console.log(obj.arrow());   // Output: [ 'obj' ]
popularity: 8.4
isPublished: true
---

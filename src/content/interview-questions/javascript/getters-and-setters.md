---
course: javascript
slug: getters-and-setters
experienceLevel: mid
difficulty: easy
tags:
  - objects
  - classes
question: What are getters and setters, and when should you use them?
answer: |
  Getters and setters are accessor properties: functions that run when a property is read (`get`) or assigned (`set`), so you can compute values, validate input or react to changes while callers keep using plain property syntax.

  Ways to define them:

  - In object literals and classes: `get fullName() {}` and `set fullName(value) {}`.
  - On existing objects with `Object.defineProperty(obj, 'x', { get, set })`.

  Behaviour to know:

  - Assigning to a getter-only property is silently ignored in sloppy mode and throws a `TypeError` in strict mode. Classes and ES modules are always strict.
  - A setter must store its data somewhere else, typically a private field such as `#celsius`. Writing `this.temp = v` inside the `temp` setter calls the setter again forever and ends in `RangeError: Maximum call stack size exceeded`.
  - Class accessors live on the prototype, so they are not own properties. `Object.keys(instance)` and `JSON.stringify(instance)` skip them; add a `toJSON()` method if they should be serialized.
  - Spread and `Object.assign` call the getter and copy the resulting **value**, not the accessor itself.

  Good uses:

  - Derived values, such as `area` computed from `width` and `height`.
  - Validation or normalisation on assignment.
  - Lazy values that are computed on first access and then cached.
  - Keeping a public API stable while the internal storage changes.

  Pitfalls: callers expect property access to be cheap and free of side effects, and debuggers or loggers may invoke getters too. If something is expensive, can fail in surprising ways or is asynchronous, expose it as a method instead.
codeExample: |
  'use strict';

  class Temperature {
    #celsius = 0;

    get fahrenheit() { return this.#celsius * 9 / 5 + 32; }

    set fahrenheit(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new TypeError('fahrenheit must be a number');
      }
      this.#celsius = (value - 32) * 5 / 9;
    }

    get celsius() { return this.#celsius; }
  }

  const t = new Temperature();
  t.fahrenheit = 212;
  console.log(t.celsius, t.fahrenheit);            // Output: 100 212

  try { t.celsius = 5; } catch (e) { console.log(e.constructor.name); } // Output: TypeError
  try { t.fahrenheit = 'hot'; } catch (e) { console.log(e.message); }
  // Output: fahrenheit must be a number

  console.log(Object.keys(t), JSON.stringify(t));  // Output: [] {}

  const point = { x: 3, y: 4, get length() { return Math.hypot(this.x, this.y); } };
  console.log(point.length, { ...point });         // Output: 5 { x: 3, y: 4, length: 5 }
popularity: 7.4
isPublished: true
---

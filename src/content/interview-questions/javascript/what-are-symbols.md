---
course: javascript
slug: what-are-symbols
experienceLevel: mid
difficulty: medium
tags:
  - symbols
  - primitives
  - objects
question: What are Symbols in JavaScript and what are they used for?
answer: |
  A Symbol is a primitive value that is guaranteed to be unique, created with `Symbol('description')`; its main use is as an object property key that cannot collide with any other key, including string keys and symbols created by other code.

  Key properties:

  - `Symbol('id') !== Symbol('id')`. The description is only a label for debugging.
  - `Symbol()` is called without `new`; `new Symbol()` throws a `TypeError`.
  - Symbol-keyed properties are skipped by `for...in`, `Object.keys`, `Object.entries` and `JSON.stringify`. They are still accessible through `Object.getOwnPropertySymbols` and `Reflect.ownKeys`, so they are hidden, not private. Use `#private` fields for real privacy.
  - `Symbol.for('app.key')` uses a **global registry**: the same string returns the same symbol everywhere, even across iframes and modules. `Symbol.keyFor(sym)` returns the registry key.
  - Symbols do not convert implicitly to strings: `'x' + sym` throws a `TypeError`. Use `sym.toString()` or `sym.description`.

  Typical uses:

  1. **Collision-free metadata** on objects you do not own, such as a library tagging objects without risking a clash with user properties.
  2. **Well-known symbols** that customise built-in behaviour: `Symbol.iterator` (make an object iterable), `Symbol.asyncIterator`, `Symbol.toPrimitive` (control conversion to number or string), `Symbol.toStringTag` (change `Object.prototype.toString` output) and `Symbol.hasInstance` (customise `instanceof`).
  3. **Enum-like constants** where each value must be unique and not confusable with a plain string.

  Pitfalls:

  - Symbols are lost in `JSON.stringify`, and spread or `Object.assign` copy enumerable symbol properties, which sometimes surprises people.
  - Registry symbols (`Symbol.for`) are shared globally, so they offer uniqueness only as good as your naming; namespace the key.
  - `typeof sym` is `'symbol'`, a separate primitive type alongside string, number, bigint, boolean, undefined and null.
codeExample: |
  const id = Symbol('id');
  const user = { name: 'Ada', [id]: 42 };

  console.log(Symbol('id') === Symbol('id'), typeof id); // Output: false symbol
  console.log(user[id], Object.keys(user), JSON.stringify(user)); // Output: 42 [ 'name' ] {"name":"Ada"}
  console.log(Object.getOwnPropertySymbols(user));       // Output: [ Symbol(id) ]

  console.log(Symbol.for('app.id') === Symbol.for('app.id'), Symbol.keyFor(Symbol.for('app.id')));
  // Output: true app.id

  try { console.log('id: ' + id); } catch (e) { console.log(e.constructor.name); } // Output: TypeError
  console.log(id.description); // Output: id

  class Money {
    constructor(amount, currency) { this.amount = amount; this.currency = currency; }
    [Symbol.toPrimitive](hint) {
      return hint === 'number' ? this.amount : `${this.amount} ${this.currency}`;
    }
    get [Symbol.toStringTag]() { return 'Money'; }
  }

  const price = new Money(9.99, 'EUR');
  console.log(+price, `${price}`);               // Output: 9.99 9.99 EUR
  console.log(Object.prototype.toString.call(price)); // Output: [object Money]
popularity: 7.3
isPublished: true
---

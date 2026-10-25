---
course: javascript
slug: well-known-symbols
experienceLevel: senior
difficulty: hard
tags:
  - symbols
  - metaprogramming
  - objects
question: What are well-known symbols, and how do they let you customise built-in language behaviour?
answer: |
  **Well-known symbols** are predefined `Symbol` values, stored as static properties of `Symbol`, that the language looks up on your objects at specific points. Defining a method under one of these keys plugs your object into a built-in protocol without colliding with ordinary string-keyed properties.

  The ones worth knowing:

  - `Symbol.iterator`: used by `for...of`, spread, destructuring, `Array.from`, `new Map(iterable)` and `Promise.all`. `Symbol.asyncIterator` is the async counterpart for `for await`.
  - `Symbol.toPrimitive`: controls conversion to a primitive, receiving the hint `'number'`, `'string'` or `'default'`.
  - `Symbol.toStringTag`: the name shown by `Object.prototype.toString.call(x)`, for example `[object Money]`.
  - `Symbol.hasInstance`: customises `instanceof`. It's useful for brand checks, and dangerous because it can make `instanceof` lie.
  - `Symbol.species`: which constructor derived methods such as `map` and `filter` use to create results for subclasses. It's widely considered a design mistake: it complicates engines and has enabled security bugs. Avoid relying on it.
  - `Symbol.isConcatSpreadable`: whether `concat` flattens an object.
  - `Symbol.match`, `matchAll`, `replace`, `search` and `split`: let objects act like regexes in string methods.
  - `Symbol.unscopables`: hides properties from `with` statements, kept for web compatibility.
  - `Symbol.dispose` and `Symbol.asyncDispose`: used by `using` and `await using` declarations (explicit resource management, newer; check current support).

  Well-known symbols are the same value across realms, unlike `Symbol()` values you create. `Symbol.for(key)` gives you a cross-realm registered symbol of your own. Node also uses registered symbols, such as `Symbol.for('nodejs.util.inspect.custom')` for custom `console.log` output.

  Use these protocols to make domain types feel native (iterable collections, value objects with sensible conversion), but keep overrides predictable. Surprising `toPrimitive` or `hasInstance` behaviour is hard to debug.
codeExample: |
  class Money {
    constructor(cents, currency) { this.cents = cents; this.currency = currency; }

    [Symbol.toPrimitive](hint) {
      if (hint === 'number') return this.cents / 100;
      return `${(this.cents / 100).toFixed(2)} ${this.currency}`;   // 'string' and 'default'
    }
    get [Symbol.toStringTag]() { return 'Money'; }
    [Symbol.for('nodejs.util.inspect.custom')]() { return `Money<${this}>`; }
  }

  class Wallet {
    #items = [new Money(1250, 'EUR'), new Money(399, 'EUR')];
    *[Symbol.iterator]() { yield* this.#items; }                  // iterable protocol
  }

  const price = new Money(1250, 'EUR');
  console.log(`${price}`);                                // Output: 12.50 EUR
  console.log(+price * 2);                                // Output: 25
  console.log(Object.prototype.toString.call(price));     // Output: [object Money]
  console.log(price);                                     // Output: Money<12.50 EUR>
  console.log([...new Wallet()].map(String));             // Output: [ '12.50 EUR', '3.99 EUR' ]

  const Even = { [Symbol.hasInstance]: (n) => n % 2 === 0 };
  console.log(4 instanceof Even, 3 instanceof Even);      // Output: true false
popularity: 6.8
isPublished: true
---

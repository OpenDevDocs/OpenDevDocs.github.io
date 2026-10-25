---
course: javascript
slug: object-to-primitive-conversion
experienceLevel: senior
difficulty: medium
tags:
  - type-coercion
  - objects
question: How does JavaScript convert objects to primitives, and why do Date and plus behave surprisingly?
answer: |
  Whenever an operation needs a primitive (arithmetic, template literals, `==` against a primitive, property keys, comparisons), the engine runs **ToPrimitive** on the object with a **hint**:

  - `'number'`: unary `+`, `-`, `*`, `<`, `Math` functions, `Number(obj)`.
  - `'string'`: template literals, `String(obj)`, using the object as a property key.
  - `'default'`: binary `+` and `==`, where either kind of result makes sense.

  The algorithm:

  1. If the object has a `[Symbol.toPrimitive]` method, call it with the hint. It must return a primitive, or a `TypeError` is thrown.
  2. Otherwise use **OrdinaryToPrimitive**. For the `'string'` hint, try `toString()` then `valueOf()`. For `'number'` and `'default'`, try `valueOf()` then `toString()`. The first one that returns a primitive wins.

  The surprises follow directly from this:

  - Plain objects inherit a `valueOf` that returns the object itself (not a primitive), so they fall through to `toString()`, which gives `"[object Object]"`. That's why `{} + 1` in an expression is `"[object Object]1"`.
  - Arrays use `join`: `[] + []` is `""` and `[1, 2] + 1` is `"1,21"`.
  - **Date** is the exception. Its `Symbol.toPrimitive` treats `'default'` as `'string'`, so `date + 1` concatenates while `date - 1` subtracts. Use `date.getTime()` explicitly.
  - Binary `+` concatenates if **either** primitive result is a string. Otherwise it adds numbers.
  - BigInt and Symbol add their own throws: `Symbol() + ''` is a `TypeError`, as is mixing BigInt with number.

  In a real codebase: implement `Symbol.toPrimitive` (or `valueOf`) only for true value objects such as money or durations, prefer explicit conversions (`Number(x)`, `String(x)`, `getTime()`), and enable lint rules such as `no-implicit-coercion` and TypeScript's `restrict-plus-operands`.
codeExample: |
  const temperature = {
    valueOf() { console.log('  valueOf called'); return 21; },
    toString() { console.log('  toString called'); return '21°C'; },
  };

  console.log(temperature * 2);       // hint 'number'
  // Output:   valueOf called
  // Output: 42
  console.log(`${temperature}`);      // hint 'string'
  // Output:   toString called
  // Output: 21°C
  console.log(temperature + '!');     // hint 'default' -> valueOf first
  // Output:   valueOf called
  // Output: 21!

  console.log([1, 2] + 1, [] + [], String({}));
  // Output: 1,21  [object Object]

  const date = new Date(0);
  console.log(typeof (date + 1), typeof (date - 1)); // Output: string number

  const tagged = {
    [Symbol.toPrimitive](hint) { return hint === 'number' ? 1 : `hint=${hint}`; },
  };
  console.log(+tagged, `${tagged}`, tagged + '');
  // Output: 1 hint=string hint=default
popularity: 6.9
isPublished: true
---

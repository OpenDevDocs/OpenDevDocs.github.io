---
publishDate: 2026-03-25T09:42
title: Symbols and Iterables
slug: symbols-and-iterables
metadescription: Use symbols as unique keys that never clash, and hook into JavaScript behaviour through the well known symbols.
updateDate: 2026-09-05T09:42
author: ['bishal-biswas']
level: 3
tags: ['symbols', 'iterators', 'es6']
course: javascript
---

## What is a symbol?

A symbol is a primitive whose only job is to be unique. Every symbol you create is different from every other one, forever.

```javascript
const a = Symbol('description');
const b = Symbol('description');
console.log(a === b);
console.log(typeof a);
console.log(a.toString());
console.log(a.description);
```

The text you pass is only a label for debugging. It does not affect identity.

Note there is no `new`. `new Symbol()` throws.

## Why do they exist?

To add a property to an object with no chance of clashing with an existing one, or with one added later by someone else.

```javascript
const user = { id: 1, name: 'Asha' };
const id = Symbol('id');
user[id] = 'internal-value';
console.log(user.id);
console.log(user[id]);
console.log(Object.keys(user));
console.log(JSON.stringify(user));
```

The string key `id` and the symbol key are two completely separate properties, and they coexist happily.

## Symbols are skipped by most iteration

```javascript
const meta = Symbol('meta');
const product = { name: 'Pen', price: 20, [meta]: { internal: true } };
console.log(Object.keys(product));
console.log(JSON.stringify(product));
for (const key in product) {
  console.log(key);
}
console.log(Object.getOwnPropertySymbols(product));
```

This makes symbols useful for metadata that should not leak into your API responses. They are **hidden by convention**, not truly private, since `getOwnPropertySymbols` can find them.

## The global symbol registry

`Symbol.for` looks up a symbol by key and creates it only if it does not already exist.

```javascript
const a = Symbol.for('app.id');
const b = Symbol.for('app.id');
console.log(a === b);
console.log(Symbol('app.id') === Symbol('app.id'));
console.log(Symbol.keyFor(a));
```

Use this when two separate parts of an application need to agree on the same symbol.

## Well known symbols

This is where symbols become genuinely useful. JavaScript uses certain built in symbols to decide how objects behave, and you can supply your own.

### `Symbol.iterator`

Makes an object work with `for...of` and spread.

```javascript
class Range {
  constructor(start, end, step = 1) {
    this.start = start;
    this.end = end;
    this.step = step;
  }
  *[Symbol.iterator]() {
    for (let i = this.start; i <= this.end; i += this.step) {
      yield i;
    }
  }
}
const range = new Range(1, 10, 3);
console.log([...range]);
for (const n of range) {
  console.log(n);
}
const [first, second] = range;
console.log(first, second);
```

One method and your class works with every iteration feature in the language.

### `Symbol.asyncIterator`

The same idea for `for await`.

```javascript
const ticker = {
  async *[Symbol.asyncIterator]() {
    for (let i = 1; i <= 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      yield i;
    }
  }
};
(async () => {
  for await (const tick of ticker) {
    console.log('Tick', tick);
  }
})();
```

### `Symbol.toPrimitive`

Controls how your object converts to a number or a string.

```javascript
class Money {
  constructor(amount, currency = 'INR') {
    this.amount = amount;
    this.currency = currency;
  }
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.amount;
    if (hint === 'string') return `${this.currency} ${this.amount}`;
    return `${this.currency} ${this.amount}`;
  }
}
const price = new Money(500);
console.log(+price);
console.log(`${price}`);
console.log(price + 100);
```

### `Symbol.toStringTag`

Changes what `Object.prototype.toString` reports.

```javascript
class Collection {
  get [Symbol.toStringTag]() {
    return 'Collection';
  }
}
console.log(Object.prototype.toString.call(new Collection()));
console.log(String(new Collection()));
```

### `Symbol.hasInstance`

Customises `instanceof`.

```javascript
class Even {
  static [Symbol.hasInstance](value) {
    return typeof value === 'number' && value % 2 === 0;
  }
}
console.log(4 instanceof Even);
console.log(5 instanceof Even);
```

Clever, though surprising to read. Use it sparingly.

## Built in iterables

```javascript
console.log([...'hello']);
console.log([...[1, 2, 3]]);
console.log([...new Set([1, 1, 2])]);
console.log([...new Map([['a', 1]])]);
console.log([...document.querySelectorAll('p')]);
```

All of these have `Symbol.iterator`. A plain object does not:

```javascript
const plain = { a: 1, b: 2 };
console.log(plain[Symbol.iterator]);
console.log([...Object.entries(plain)]);
```

That is why you use `Object.entries` on plain objects.

You can give one an iterator if you really want:

```javascript
const plain = {
  a: 1,
  b: 2,
  *[Symbol.iterator]() {
    yield* Object.entries(this);
  }
};
console.log([...plain]);
```

## When to reach for symbols

Honestly, not often in application code. They matter when you are:

- Writing a library and adding properties to objects you did not create.
- Making your own types work with `for...of`.
- Attaching metadata that should stay out of `JSON.stringify`.

For plain private data inside a class, `#private` fields are simpler and genuinely private.

## Quick recap

- Every symbol is unique, even two with the same description.
- Symbol keys never clash with string keys.
- They are skipped by `Object.keys`, `for...in` and `JSON.stringify`.
- `Symbol.for` shares symbols through a global registry.
- `Symbol.iterator` is what makes `for...of` and spread work.
- Other well known symbols hook into conversion, `instanceof` and `toString`.
- For simple privacy, prefer `#` fields over symbols.

<code id="code-content" class="language-javascript">
// Every symbol is unique, even with the same description
const a = Symbol('id');
const b = Symbol('id');
console.log(a === b, typeof a);          // false 'symbol'
// Symbol keys never clash with string keys
const user = { id: 1, name: 'Asha' };
const secretId = Symbol('id');
user[secretId] = 'internal-value';
console.log(user.id, user[secretId]);    // 1 internal-value
// And they stay out of normal iteration and JSON
console.log(Object.keys(user));          // ['id', 'name']
console.log(JSON.stringify(user));       // no symbol key
console.log(Object.getOwnPropertySymbols(user)); // findable if you look
// Symbol.for shares one symbol through a global registry
console.log(Symbol.for('app.id') === Symbol.for('app.id'));  // true
// Symbol.iterator makes your class work with for...of and spread
class Range {
  constructor(start, end, step = 1) {
    this.start = start; this.end = end; this.step = step;
  }
  *[Symbol.iterator]() {
    for (let i = this.start; i &lt;= this.end; i += this.step) yield i;
  }
}
const range = new Range(1, 10, 3);
console.log([...range]);                 // [1, 4, 7, 10]
const [first, second] = range;           // destructuring works too
console.log(first, second);
// Symbol.toPrimitive controls conversion to number and string
class Money {
  constructor(amount, currency = 'INR') {
    this.amount = amount; this.currency = currency;
  }
  [Symbol.toPrimitive](hint) {
    return hint === 'number' ? this.amount : this.currency + ' ' + this.amount;
  }
}
const price = new Money(500);
console.log(+price);                     // 500
console.log(`${price}`);                 // INR 500
// Symbol.toStringTag changes what the object reports itself as
class Collection {
  get [Symbol.toStringTag]() { return 'Collection'; }
}
console.log(Object.prototype.toString.call(new Collection()));
// Plain objects are not iterable, which is why Object.entries exists
const plain = { a: 1, b: 2 };
console.log(plain[Symbol.iterator]);     // undefined
console.log(Object.entries(plain));      // [['a',1],['b',2]]
</code></pre>

---
publishDate: 2026-03-02T09:03
title: Type Conversion and Coercion
slug: type-conversion-and-coercion
metadescription: Understand how JavaScript changes values from one type to another, both when you ask it to and when it does so on its own.
updateDate: 2026-09-05T09:03
author: ['bishal-biswas']
level: 1
tags: ['basics', 'types']
course: javascript
---

## Two ways types change

JavaScript is happy to turn one type into another. This happens in two ways:

- **Conversion** is when *you* ask for it. This is also called explicit conversion.
- **Coercion** is when *JavaScript* does it behind your back. This is also called implicit conversion.

Conversion is safe and predictable. Coercion is where the confusing bugs live.

## Converting to a number

### `Number()`

```javascript
console.log(Number('42'));
console.log(Number('3.14'));
console.log(Number(''));
console.log(Number('hello'));
console.log(Number(true));
console.log(Number(null));
console.log(Number(undefined));
```

Notice two results worth remembering: an empty string becomes `0`, and `undefined` becomes `NaN`.

### `parseInt()` and `parseFloat()`

These read a number from the *front* of a string and ignore whatever follows.

```javascript
console.log(parseInt('42px'));
console.log(parseFloat('3.14 metres'));
console.log(Number('42px'));
```

`parseInt` is perfect for reading CSS values like `'120px'`. Always pass the base as the second argument so there is no ambiguity:

```javascript
console.log(parseInt('42', 10));
```

### The unary plus shortcut

```javascript
console.log(+'42');
console.log(+true);
```

Short, but `Number()` reads more clearly, so prefer that.

## What is NaN?

`NaN` stands for "Not a Number". You get it when a numeric operation fails.

```javascript
console.log(Number('abc'));
console.log(0 / 0);
```

`NaN` has a strange property: it is not equal to anything, not even itself.

```javascript
console.log(NaN === NaN);
```

So to test for it, use `Number.isNaN()`:

```javascript
const result = Number('abc');
console.log(Number.isNaN(result));
```

## Converting to a string

```javascript
console.log(String(42));
console.log(String(true));
console.log(String(null));
console.log(String([1, 2, 3]));
console.log((42).toString());
```

`String()` works on anything. `.toString()` fails on `null` and `undefined`, so `String()` is the safer choice.

## Converting to a boolean

```javascript
console.log(Boolean(1));
console.log(Boolean(0));
console.log(Boolean('hello'));
console.log(Boolean(''));
console.log(Boolean([]));
```

Remember the six falsy values from the previous topic: `false`, `0`, `''`, `null`, `undefined`, `NaN`. Everything else, including an empty array, is truthy.

## Coercion: when JavaScript decides for you

### The `+` operator prefers strings

If either side of `+` is a string, JavaScript turns the other side into a string and joins them.

```javascript
console.log(5 + '5');
console.log('5' + 5);
console.log(5 + 5);
```

This is the single most common source of "why is my total wrong" bugs. Form inputs always give you strings:

```javascript
const input = '10';
console.log(input + 5);
console.log(Number(input) + 5);
```

### Every other maths operator prefers numbers

```javascript
console.log('10' - 5);
console.log('10' * 2);
console.log('10' / 2);
```

Only `+` behaves differently, because it has to serve double duty for addition and joining text.

### Comparison coerces too

```javascript
console.log('10' > 5);
console.log('apple' > 5);
```

The second one is `false` because `'apple'` becomes `NaN`, and every comparison with `NaN` is false.

## The classic surprises

```javascript
console.log([] + []);
console.log([] + {});
console.log(1 + '1');
console.log('5' - - '2');
```

You do not need to understand every one of these. You need to know that they exist, and that the way to avoid them is simple: **convert on purpose before you calculate**.

## The safe habit

```javascript
const quantityText = '3';
const priceText = '99.50';
const quantity = Number(quantityText);
const price = Number(priceText);
if (Number.isNaN(quantity) || Number.isNaN(price)) {
  console.log('Please enter valid numbers');
} else {
  console.log('Total:', quantity * price);
}
```

Convert first, check the result, then use it. Three lines that save hours of debugging.

## Quick recap

- Conversion is deliberate, coercion is automatic.
- `Number()`, `String()` and `Boolean()` are the explicit tools.
- `parseInt()` and `parseFloat()` read a number from the start of a string.
- `NaN` is never equal to itself, so test with `Number.isNaN()`.
- `+` joins text if either side is a string, every other maths operator converts to numbers.
- Convert input values yourself before doing maths on them.

<code id="code-content" class="language-javascript">
// Explicit conversion: you ask for it
console.log(Number('42'));        // 42
console.log(Number(''));          // 0
console.log(Number('hello'));     // NaN
console.log(String(42));          // '42'
console.log(Boolean(''));         // false
// Reading numbers out of text
console.log(parseInt('120px', 10));    // 120
console.log(parseFloat('3.14 m'));     // 3.14
// NaN is never equal to itself
const bad = Number('abc');
console.log(bad === NaN);              // false
console.log(Number.isNaN(bad));        // true, use this
// Coercion: JavaScript decides for you
console.log(5 + '5');   // '55'  string join
console.log('10' - 5);  // 5     number maths
console.log('10' * 2);  // 20    number maths
// The classic form input bug
const typedByUser = '10';
console.log(typedByUser + 5);          // '105'  wrong
console.log(Number(typedByUser) + 5);  // 15     right
// The safe habit: convert, check, then use
const quantity = Number('3');
const price = Number('99.50');
if (Number.isNaN(quantity) || Number.isNaN(price)) {
  console.log('Please enter valid numbers');
} else {
  console.log('Total:', quantity * price); // 298.5
}
</code></pre>

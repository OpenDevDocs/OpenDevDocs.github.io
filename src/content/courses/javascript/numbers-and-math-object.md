---
publishDate: 2026-03-07T09:11
title: Numbers and Math Object
slug: numbers-and-math-object
metadescription: Work with numbers safely in JavaScript. Rounding, formatting, random values, and why 0.1 plus 0.2 is not 0.3.
updateDate: 2026-09-05T09:11
author: ['bishal-biswas']
level: 1
tags: ['basics', 'numbers', 'math']
course: javascript
---

## One number type for everything

Many languages separate whole numbers from decimals. JavaScript has just `Number` for both.

```javascript
const whole = 42;
const decimal = 3.14;
const negative = -7;
const scientific = 1.5e6;
console.log(scientific);
```

You can also write numbers in other bases, and use underscores to make long ones readable:

```javascript
const million = 1_000_000;
const binary = 0b1010;
const hex = 0xff;
console.log(million, binary, hex);
```

## The famous floating point problem

```javascript
console.log(0.1 + 0.2);
console.log(0.1 + 0.2 === 0.3);
```

That prints `0.30000000000000004` and `false`. This is not a JavaScript bug. Computers store decimals in binary, and some values simply cannot be represented exactly, in the same way that one third cannot be written exactly in decimal.

### How to deal with it

**For display**, round it:

```javascript
console.log((0.1 + 0.2).toFixed(2));
```

**For comparison**, check that the difference is tiny:

```javascript
const a = 0.1 + 0.2;
console.log(Math.abs(a - 0.3) < Number.EPSILON);
```

**For money**, work in the smallest unit. Store paise or cents as whole numbers, and divide only when you show the value.

```javascript
const priceInPaise = 19999;
console.log('Rs ' + (priceInPaise / 100).toFixed(2));
```

## Rounding

```javascript
console.log(Math.round(4.5));
console.log(Math.round(4.4));
console.log(Math.ceil(4.1));
console.log(Math.floor(4.9));
console.log(Math.trunc(-4.9));
console.log(Math.floor(-4.9));
```

Watch the last two. `trunc` chops the decimal off, while `floor` always moves down, which for negatives means away from zero.

### `toFixed` returns a string

```javascript
const price = 19.999;
const rounded = price.toFixed(2);
console.log(rounded, typeof rounded);
console.log(Number(rounded) + 1);
```

This catches people out constantly. If you need to keep calculating, wrap it in `Number()`.

## Useful `Math` methods

```javascript
console.log(Math.abs(-7));
console.log(Math.max(3, 9, 1));
console.log(Math.min(3, 9, 1));
console.log(Math.pow(2, 10));
console.log(Math.sqrt(144));
console.log(Math.cbrt(27));
```

To use `Math.max` on an array, spread it:

```javascript
const scores = [45, 92, 78];
console.log(Math.max(...scores));
```

## Random numbers

`Math.random()` gives a decimal from 0 up to, but not including, 1.

```javascript
console.log(Math.random());
```

To get a whole number in a range:

```javascript
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
console.log(randomBetween(1, 6));
```

Picking a random array item is a common use:

```javascript
const colours = ['red', 'green', 'blue'];
const pick = colours[Math.floor(Math.random() * colours.length)];
console.log(pick);
```

## Checking numbers

```javascript
console.log(Number.isInteger(42));
console.log(Number.isInteger(4.2));
console.log(Number.isNaN(Number('abc')));
console.log(Number.isFinite(1 / 0));
```

Use the `Number.` versions rather than the older global `isNaN()` and `isFinite()`, which convert their argument first and give misleading answers.

## Special values

```javascript
console.log(1 / 0);
console.log(-1 / 0);
console.log(Number.MAX_SAFE_INTEGER);
console.log(Number.MIN_SAFE_INTEGER);
```

Beyond `MAX_SAFE_INTEGER`, whole numbers start losing precision. If you need bigger, use `BigInt`:

```javascript
const big = 9007199254740993n;
console.log(big + 1n);
```

## Formatting for humans

`toLocaleString` adds separators and currency symbols properly.

```javascript
const amount = 1234567.891;
console.log(amount.toLocaleString('en-IN'));
console.log(amount.toLocaleString('en-US'));
console.log(amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }));
```

Note that India groups digits differently from the US, and this handles it for you.

## Quick recap

- One `Number` type covers whole numbers and decimals.
- `0.1 + 0.2` is not exactly `0.3`, so round for display and compare with a tolerance.
- Store money as whole paise or cents.
- `round`, `ceil`, `floor` and `trunc` each round differently for negatives.
- `toFixed` returns a **string**, so convert back before doing maths.
- `Math.random()` plus `Math.floor` gives whole numbers in a range.
- `toLocaleString` formats numbers and currency for a region.

<code id="code-content" class="language-javascript">
// The floating point surprise
console.log(0.1 + 0.2);                 // 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);         // false
console.log((0.1 + 0.2).toFixed(2));    // '0.30' for display
console.log(Math.abs((0.1 + 0.2) - 0.3) &lt; Number.EPSILON); // true
// Money: store the smallest unit as a whole number
const priceInPaise = 19999;
console.log('Rs ' + (priceInPaise / 100).toFixed(2)); // Rs 199.99
// Rounding behaves differently for negatives
console.log(Math.round(4.5), Math.ceil(4.1), Math.floor(4.9));
console.log(Math.trunc(-4.9), Math.floor(-4.9));  // -4 and -5
// toFixed returns a string, so convert before more maths
const rounded = (19.999).toFixed(2);
console.log(typeof rounded, Number(rounded) + 1);
// Math helpers
const scores = [45, 92, 78];
console.log(Math.max(...scores), Math.min(...scores));
console.log(Math.sqrt(144), Math.pow(2, 10));
// Random whole number in a range
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
console.log('Dice roll:', randomBetween(1, 6));
// Checking values safely
console.log(Number.isInteger(42), Number.isNaN(Number('abc')));
// Formatting for humans
const amount = 1234567.891;
console.log(amount.toLocaleString('en-IN'));
console.log(amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }));
</code></pre>

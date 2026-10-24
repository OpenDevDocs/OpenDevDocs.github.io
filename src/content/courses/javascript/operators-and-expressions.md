---
publishDate: 2026-03-02T09:02
title: Operators and Expressions
slug: operators-and-expressions
metadescription: Learn the symbols JavaScript uses to do maths, compare values, and combine conditions, explained with simple examples.
updateDate: 2026-09-05T09:02
author: ['bishal-biswas']
level: 1
tags: ['basics', 'operators']
course: javascript
---

## Operators and expressions

An **operator** is a symbol that does something to values. An **expression** is any piece of code that produces a value.

```javascript
const total = 5 + 3;
```

Here `+` is the operator, and `5 + 3` is an expression that produces `8`.

## Arithmetic operators

```javascript
console.log(10 + 3);
console.log(10 - 3);
console.log(10 * 3);
console.log(10 / 3);
console.log(10 % 3);
console.log(10 ** 3);
```

Two of these deserve a closer look.

**Remainder (`%`)** gives you what is left over after division. It is the standard way to check if a number is even:

```javascript
const number = 14;
console.log(number % 2 === 0);
```

**Exponent (`**`)** raises a number to a power, so `2 ** 10` is `1024`.

### Increment and decrement

```javascript
let count = 5;
count++;
console.log(count);
count--;
console.log(count);
```

`count++` adds one, `count--` subtracts one. There is a subtle difference between putting the `++` before or after:

```javascript
let x = 5;
console.log(x++);
console.log(x);
let y = 5;
console.log(++y);
```

`x++` returns the old value then increases it. `++y` increases first, then returns the new value. When in doubt, put the increment on its own line.

## Assignment operators

```javascript
let total = 100;
total += 50;
total -= 20;
total *= 2;
total /= 4;
console.log(total);
```

`total += 50` is just a shorter way of writing `total = total + 50`.

## Comparison operators

These always produce `true` or `false`.

```javascript
console.log(5 > 3);
console.log(5 < 3);
console.log(5 >= 5);
console.log(5 <= 4);
```

### The important one: `===` versus `==`

```javascript
console.log(5 === 5);
console.log(5 === '5');
console.log(5 == '5');
```

- `===` checks **value and type**. It is called strict equality.
- `==` converts the types first, then compares. It is called loose equality.

Loose equality produces results that surprise people:

```javascript
console.log(0 == '');
console.log(null == undefined);
console.log('1' == 1);
```

> **Always use `===` and `!==`.** The loose versions hide bugs. There is almost never a good reason to reach for them.

```javascript
console.log(5 !== '5');
```

## Logical operators

These combine or flip boolean values.

### AND (`&&`)

True only when **both** sides are true.

```javascript
const age = 25;
const hasLicence = true;
console.log(age >= 18 && hasLicence);
```

### OR (`||`)

True when **at least one** side is true.

```javascript
const isWeekend = false;
const isHoliday = true;
console.log(isWeekend || isHoliday);
```

### NOT (`!`)

Flips a value.

```javascript
const isLoggedIn = false;
console.log(!isLoggedIn);
```

## Truthy and falsy

JavaScript treats non boolean values as true or false when you use them in a condition.

These six values are **falsy**:

- `false`
- `0`
- `''` (empty string)
- `null`
- `undefined`
- `NaN`

Everything else is **truthy**, including `'0'`, `'false'`, `[]` and `{}`.

```javascript
if ('hello') {
  console.log('Non empty strings are truthy');
}
if (0) {
  console.log('This never runs');
}
```

## Two handy modern operators

### Nullish coalescing (`??`)

Returns the right side only when the left is `null` or `undefined`.

```javascript
const userInput = 0;
console.log(userInput || 100);
console.log(userInput ?? 100);
```

`||` treats `0` as falsy and jumps to `100`, which is usually not what you want. `??` only steps in for `null` and `undefined`, so it keeps the `0`.

### Ternary operator

A compact `if` that produces a value.

```javascript
const age = 20;
const status = age >= 18 ? 'adult' : 'minor';
console.log(status);
```

Read it as: *condition* `?` *value if true* `:` *value if false*.

## Operator precedence

Multiplication happens before addition, just like in school maths.

```javascript
console.log(2 + 3 * 4);
console.log((2 + 3) * 4);
```

You do not need to memorise the full table. When an expression gets long, add brackets so the intent is obvious to whoever reads it next.

## Quick recap

- Arithmetic: `+ - * / % **`, and `%` is how you test for even numbers.
- Shorthand assignment: `+= -= *= /=`.
- Always compare with `===` and `!==`, never `==`.
- `&&`, `||` and `!` combine conditions.
- Six falsy values: `false`, `0`, `''`, `null`, `undefined`, `NaN`.
- `??` gives a default only for `null` and `undefined`.
- Brackets make precedence clear, so use them freely.

<code id="code-content" class="language-javascript">
// Arithmetic
const price = 250;
const quantity = 3;
console.log('Total:', price * quantity);
console.log('Is 14 even?', 14 % 2 === 0);
console.log('2 to the power 10:', 2 ** 10);
// Shorthand assignment
let balance = 1000;
balance -= 250;
balance += 100;
console.log('Balance:', balance);
// Strict vs loose equality
console.log(5 === 5);    // true
console.log(5 === '5');  // false, different types
console.log(5 == '5');   // true, avoid this
// Logical operators
const age = 25;
const hasLicence = true;
const canDrive = age &gt;= 18 &amp;&amp; hasLicence;
console.log('Can drive:', canDrive);
// Truthy and falsy
const values = [0, '', null, undefined, NaN, false, 'text', 42];
values.forEach(function (v) {
  console.log(JSON.stringify(v), 'is', v ? 'truthy' : 'falsy');
});
// Nullish coalescing keeps a valid zero
const userInput = 0;
console.log('With ||:', userInput || 100); // 100
console.log('With ??:', userInput ?? 100); // 0
// Ternary
const status = age &gt;= 18 ? 'adult' : 'minor';
console.log('Status:', status);
</code></pre>

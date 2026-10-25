---
publishDate: 2026-03-04T09:06
title: Functions - Declaration and Expression
slug: functions-declaration-and-expression
metadescription: Package your code into reusable blocks. Learn function declarations, expressions, parameters, return values and default values.
updateDate: 2026-09-05T09:06
author: ['bishal-biswas']
level: 1
tags: ['basics', 'functions']
course: javascript
---

## What is a function?

A function is a named block of code that you can run whenever you need it. Write the logic once, use it a hundred times.

```javascript
function greet() {
  console.log('Hello!');
}
greet();
greet();
```

Defining a function does not run it. You run it by **calling** it, which means writing its name followed by round brackets.

## Parameters and arguments

Functions become useful when you pass information in.

```javascript
function greet(name) {
  console.log('Hello, ' + name + '!');
}
greet('Priya');
greet('Rahul');
```

- `name` in the definition is a **parameter**, a placeholder.
- `'Priya'` at the call site is an **argument**, the real value.

Multiple parameters are separated by commas:

```javascript
function introduce(name, age, city) {
  console.log(name + ' is ' + age + ' and lives in ' + city);
}
introduce('Sana', 24, 'Delhi');
```

## Returning a value

`console.log` only prints. `return` hands a value back to whoever called the function.

```javascript
function add(a, b) {
  return a + b;
}
const total = add(5, 3);
console.log(total);
console.log(add(10, 20) * 2);
```

A function without a `return` gives back `undefined`:

```javascript
function sayHi() {
  console.log('Hi');
}
const result = sayHi();
console.log(result);
```

### `return` ends the function

Nothing after a `return` runs.

```javascript
function check(age) {
  if (age < 18) {
    return 'Too young';
  }
  return 'Welcome';
}
console.log(check(15));
console.log(check(30));
```

This is the guard clause pattern from the conditionals topic, and it is a very common way to write functions.

## Default parameter values

If an argument is missing, the parameter is `undefined`. You can give it a fallback instead.

```javascript
function greet(name = 'guest') {
  console.log('Hello, ' + name);
}
greet('Vikram');
greet();
```

Defaults are used only when the argument is `undefined`, so passing `null` or `0` still overrides them.

## Function declarations versus function expressions

### Declaration

```javascript
function multiply(a, b) {
  return a * b;
}
```

### Expression

```javascript
const multiply = function (a, b) {
  return a * b;
};
```

Both create a function that behaves the same when called. The difference is **when** they become available.

```javascript
console.log(declared(2, 3));
function declared(a, b) {
  return a * b;
}
```

That works, because declarations are hoisted, meaning JavaScript moves them to the top before running your code.

```javascript
console.log(expressed(2, 3));
const expressed = function (a, b) {
  return a * b;
};
```

That throws `ReferenceError`, because `expressed` does not exist yet on that line. You will look at hoisting properly in the next topic.

> **Practical advice:** Declarations are fine for top level helpers. Expressions make the order of your file matter, which many people find clearer. Pick one style and stay consistent.

## Functions as values

This is the idea that unlocks a lot of JavaScript. A function is just a value, so it can be stored, passed around, and returned.

```javascript
const shout = function (text) {
  return text.toUpperCase();
};
function apply(fn, value) {
  return fn(value);
}
console.log(apply(shout, 'hello'));
```

You will use this constantly with array methods and event listeners.

## Writing good functions

- **Do one thing.** A function called `saveUser` should save a user, not also send an email.
- **Name it with a verb.** `calculateTotal`, `formatDate`, `isValid`.
- **Keep the parameter list short.** More than three or four is a hint that an object would be tidier.
- **Return early** for invalid input instead of nesting the whole body in an `if`.

```javascript
function calculateDiscount(price, percentage = 10) {
  if (typeof price !== 'number' || price <= 0) {
    return 0;
  }
  return price * (percentage / 100);
}
console.log(calculateDiscount(1000));
console.log(calculateDiscount(1000, 25));
console.log(calculateDiscount('abc'));
```

## Quick recap

- Define a function once, call it as many times as you like.
- Parameters are placeholders, arguments are the real values.
- `return` hands a value back and immediately ends the function.
- Default parameters fill in for missing arguments.
- Declarations are hoisted, expressions are not.
- Functions are values, so you can pass them around like any other data.

<code id="code-content" class="language-javascript">
// A function declaration, hoisted so it can be called from anywhere
function add(a, b) {
  return a + b;
}
console.log('5 + 3 =', add(5, 3));
// A function expression, available only after this line
const multiply = function (a, b) {
  return a * b;
};
console.log('5 x 3 =', multiply(5, 3));
// Default parameter values
function greet(name = 'guest') {
  return 'Hello, ' + name;
}
console.log(greet('Vikram'));
console.log(greet());
// Guard clause: handle bad input first, then do the real work
function calculateDiscount(price, percentage = 10) {
  if (typeof price !== 'number' || price &lt;= 0) return 0;
  return price * (percentage / 100);
}
console.log(calculateDiscount(1000));      // 100
console.log(calculateDiscount(1000, 25));  // 250
console.log(calculateDiscount('abc'));     // 0
// Functions are values, so they can be passed to other functions
const shout = function (text) {
  return text.toUpperCase();
};
function apply(fn, value) {
  return fn(value);
}
console.log(apply(shout, 'hello there')); // HELLO THERE
</code></pre>

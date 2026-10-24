---
publishDate: 2026-03-01T09:01
title: Variables and Data Types
slug: variables-and-data-types
metadescription: Learn how to store information in JavaScript using let and const, and meet the basic data types every program is built from.
updateDate: 2026-09-05T09:01
author: ['bishal-biswas']
level: 1
tags: ['basics', 'variables']
course: javascript
---

## What is a variable?

A variable is a labelled box that holds a value. You put something in the box, give the box a name, and later you can look inside using that name.

```javascript
let userName = 'Aditi';
console.log(userName);
```

Here `userName` is the label and `'Aditi'` is the value inside.

## Three ways to declare a variable

JavaScript has three keywords for creating variables. In modern code you only need two of them.

### `let` for values that change

```javascript
let score = 0;
score = 10;
score = 25;
console.log(score);
```

### `const` for values that stay the same

```javascript
const birthYear = 1998;
```

If you try to reassign a `const`, JavaScript stops you:

```javascript
const birthYear = 1998;
birthYear = 2000;
```

That last line throws `TypeError: Assignment to constant variable`.

### `var` is the old way

`var` was the only option before 2015. It behaves in surprising ways that cause bugs, so treat it as something you read in old code but never write yourself.

> **Rule of thumb:** Start with `const`. Switch to `let` only when you know the value has to change. Never use `var`.

## Naming rules

A variable name:

- can contain letters, digits, `_` and `$`
- cannot start with a digit
- cannot be a reserved word like `class` or `return`
- is case sensitive, so `age` and `Age` are two different variables

The common style in JavaScript is **camelCase**, where the first word is lowercase and every word after it starts with a capital:

```javascript
let firstName = 'Ravi';
let totalItemCount = 12;
let isLoggedIn = true;
```

Pick names that describe the value. `n` tells the reader nothing, `numberOfStudents` tells them everything.

## The data types

Every value in JavaScript has a type. There are seven primitive types plus objects.

### String

Text, wrapped in quotes. Single, double, or backticks all work.

```javascript
const city = 'Kolkata';
const greeting = "Hello there";
const message = `Welcome to ${city}`;
console.log(message);
```

### Number

JavaScript has one number type for whole numbers and decimals alike.

```javascript
const age = 27;
const price = 149.99;
const negative = -5;
console.log(age + price);
```

### Boolean

Only two possible values: `true` or `false`. These drive every decision your program makes.

```javascript
const isRaining = false;
const hasAccount = true;
```

### Undefined

A variable that was declared but never given a value.

```javascript
let favouriteColour;
console.log(favouriteColour);
```

That prints `undefined`.

### Null

An empty value that *you* set on purpose. `undefined` means "nobody filled this in yet", while `null` means "this is deliberately empty".

```javascript
let selectedItem = null;
```

### BigInt and Symbol

Two specialist types you will rarely need early on. `BigInt` holds whole numbers larger than `Number` can handle, and `Symbol` creates unique identifiers.

```javascript
const huge = 9007199254740993n;
const id = Symbol('id');
```

### Object

Everything that is not a primitive is an object. Arrays, functions, and dates are all objects.

```javascript
const person = { name: 'Meera', age: 31 };
const colours = ['red', 'green', 'blue'];
```

## Checking a type

Use `typeof` when you want to know what you are holding.

```javascript
console.log(typeof 'hello');
console.log(typeof 42);
console.log(typeof true);
console.log(typeof undefined);
console.log(typeof { a: 1 });
```

One famous oddity: `typeof null` returns `'object'`. This is a bug from the very first version of JavaScript that was never fixed because too much code depends on it. Just remember it and move on.

## Primitives are copied, objects are shared

This trips up almost every beginner, so it is worth seeing early.

```javascript
let a = 10;
let b = a;
b = 20;
console.log(a);
```

`a` is still `10`, because the number was copied into `b`.

```javascript
const list1 = ['x'];
const list2 = list1;
list2.push('y');
console.log(list1);
```

Now `list1` is `['x', 'y']`. Both names point at the *same* array, so changing one changes the other.

## Quick recap

- `const` by default, `let` when the value must change, `var` never.
- Names use camelCase and should describe what they hold.
- Primitive types: string, number, boolean, undefined, null, BigInt, symbol.
- Everything else is an object.
- `typeof` tells you the type, and `typeof null` lying about being an object is a known quirk.

<code id="code-content" class="language-javascript">
// Declaring variables
const courseName = 'JavaScript Mastery';
let lessonsCompleted = 0;
// Updating a let variable
lessonsCompleted = 3;
console.log(courseName, lessonsCompleted);
// The primitive types
const title = 'Variables';        // string
const rating = 4.8;               // number
const isFree = true;              // boolean
let notFilledIn;                  // undefined
const clearedOn = null;           // null
console.log(typeof title, typeof rating, typeof isFree);
console.log(typeof notFilledIn, typeof clearedOn); // 'undefined', 'object'
// Objects and arrays
const student = { name: 'Meera', age: 31 };
const topics = ['variables', 'operators', 'loops'];
console.log(student.name, topics.length);
// Primitives copy, objects share
let a = 10;
let b = a;
b = 20;
console.log('a is still', a); // 10
const first = ['x'];
const second = first;
second.push('y');
console.log('first changed too:', first); // ['x', 'y']
</code></pre>

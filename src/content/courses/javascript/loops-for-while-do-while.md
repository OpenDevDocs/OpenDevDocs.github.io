---
publishDate: 2026-03-03T09:05
title: Loops (for, while, do-while)
slug: loops-for-while-do-while
metadescription: Repeat work without repeating yourself. Learn for, while, do-while, for-of and for-in with clear beginner examples.
updateDate: 2026-09-05T09:05
author: ['bishal-biswas']
level: 1
tags: ['basics', 'control-flow', 'loops']
course: javascript
---

## Why loops exist

Imagine printing the numbers 1 to 100. Writing a hundred `console.log` lines would be painful. A loop does the repeating for you.

## The `for` loop

The `for` loop is the workhorse. It packs three pieces into one line.

```javascript
for (let i = 1; i <= 5; i++) {
  console.log(i);
}
```

Those three pieces, separated by semicolons, are:

1. **Start**: `let i = 1` runs once, before anything else.
2. **Condition**: `i <= 5` is checked before every pass. When it becomes false, the loop stops.
3. **Step**: `i++` runs after every pass.

`i` is short for index, and starting at `0` is the convention when you work with arrays:

```javascript
const fruits = ['apple', 'banana', 'mango'];
for (let i = 0; i < fruits.length; i++) {
  console.log(i, fruits[i]);
}
```

### Counting backwards

```javascript
for (let i = 5; i >= 1; i--) {
  console.log(i);
}
```

### Skipping by two

```javascript
for (let i = 0; i <= 10; i += 2) {
  console.log(i);
}
```

## The `while` loop

Use `while` when you do not know in advance how many times you need to repeat.

```javascript
let count = 1;
while (count <= 5) {
  console.log(count);
  count++;
}
```

Everything a `for` loop does, a `while` loop can do too. The difference is style: `for` keeps the counter logic in one place, `while` spreads it out.

> **Warning:** If you forget `count++`, the condition never becomes false and the loop runs forever. This freezes the browser tab. Always make sure something inside the loop moves it towards the exit.

## The `do-while` loop

Nearly the same as `while`, except the body runs **once before** the condition is checked.

```javascript
let number = 100;
do {
  console.log('This runs at least once');
  number++;
} while (number < 5);
```

Even though `100 < 5` is false, the message still prints once. This is useful for menus and prompts where you always want to show something before deciding whether to repeat.

## `for...of` for values

Modern JavaScript has a much cleaner way to walk through an array.

```javascript
const colours = ['red', 'green', 'blue'];
for (const colour of colours) {
  console.log(colour);
}
```

No counter, no `length`, no `[i]`. It also works on strings:

```javascript
for (const letter of 'code') {
  console.log(letter);
}
```

If you also need the position, use `entries()`:

```javascript
const colours = ['red', 'green', 'blue'];
for (const [index, colour] of colours.entries()) {
  console.log(index, colour);
}
```

## `for...in` for object keys

`for...in` walks over the **keys** of an object.

```javascript
const person = { name: 'Arjun', age: 28, city: 'Pune' };
for (const key in person) {
  console.log(key, person[key]);
}
```

> **Do not use `for...in` on arrays.** It gives you the index as a *string*, and it can pick up unexpected extra properties. Use `for...of` for arrays and `for...in` for objects.

## `break` and `continue`

`break` leaves the loop immediately.

```javascript
const numbers = [3, 7, 12, 5, 20];
for (const n of numbers) {
  if (n > 10) {
    console.log('Found the first number over 10:', n);
    break;
  }
}
```

`continue` skips the rest of this pass and moves to the next one.

```javascript
for (let i = 1; i <= 10; i++) {
  if (i % 2 !== 0) {
    continue;
  }
  console.log(i);
}
```

## Nested loops

A loop inside a loop. The inner one completes fully for each pass of the outer one.

```javascript
for (let row = 1; row <= 3; row++) {
  for (let col = 1; col <= 3; col++) {
    console.log(row, col);
  }
}
```

That prints nine lines. Be careful with nesting: three levels deep means the work grows very fast.

## Which loop should you use?

- **`for...of`**: walking through an array or string. This is your default.
- **`for`**: when you need the index, or a custom step.
- **`while`**: when the number of repeats is unknown.
- **`do-while`**: when the body must run at least once.
- **`for...in`**: object keys only.

## Quick recap

- `for` bundles start, condition and step into one line.
- `while` repeats until a condition turns false, and `do-while` always runs once first.
- Always change something inside a `while` loop or it will never end.
- `for...of` reads values, `for...in` reads object keys.
- `break` exits the loop, `continue` skips to the next pass.

<code id="code-content" class="language-javascript">
// Classic for loop with an index
const fruits = ['apple', 'banana', 'mango'];
for (let i = 0; i &lt; fruits.length; i++) {
  console.log(i, fruits[i]);
}
// for...of is cleaner when you only need the value
for (const fruit of fruits) {
  console.log('I like', fruit);
}
// Need both? Use entries()
for (const [index, fruit] of fruits.entries()) {
  console.log(index + 1 + '.', fruit);
}
// while: repeat until a condition turns false
let stock = 5;
while (stock &gt; 0) {
  console.log('Items left:', stock);
  stock--;
}
// do-while always runs at least once
let attempts = 0;
do {
  attempts++;
  console.log('Attempt number', attempts);
} while (attempts &lt; 3);
// for...in walks object keys
const person = { name: 'Arjun', age: 28, city: 'Pune' };
for (const key in person) {
  console.log(key + ':', person[key]);
}
// break stops early, continue skips one pass
const numbers = [3, 7, 12, 5, 20];
for (const n of numbers) {
  if (n % 2 !== 0) continue;   // skip odd numbers
  if (n &gt; 15) break;           // stop once we pass 15
  console.log('Even number:', n);
}
</code></pre>

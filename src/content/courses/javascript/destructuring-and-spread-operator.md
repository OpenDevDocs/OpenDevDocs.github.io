---
publishDate: 2026-03-20T09:34
title: Destructuring and Spread Operator
slug: destructuring-and-spread-operator
metadescription: Pull values out of arrays and objects in one line, copy and merge with spread, and gather arguments with rest.
updateDate: 2026-09-05T09:34
author: ['bishal-biswas']
level: 2
tags: ['es6', 'syntax']
course: javascript
---

## Array destructuring

Unpack an array into separate variables.

```javascript
const colours = ['red', 'green', 'blue'];
const first = colours[0];
const second = colours[1];
const [a, b, c] = colours;
console.log(a, b, c);
```

Position decides which value you get.

### Skipping items

```javascript
const [, , third] = ['red', 'green', 'blue'];
console.log(third);
```

### Defaults

```javascript
const [x = 'default', y = 'default'] = ['only one'];
console.log(x, y);
```

### Swapping

```javascript
let a = 1;
let b = 2;
[a, b] = [b, a];
console.log(a, b);
```

No temporary variable needed.

### Rest in arrays

```javascript
const [winner, ...others] = ['Asha', 'Ben', 'Chitra', 'Dev'];
console.log(winner);
console.log(others);
```

The rest element must be last.

## Object destructuring

Here the **name** decides what you get, not the position.

```javascript
const user = { name: 'Asha', age: 28, city: 'Pune' };
const { name, age } = user;
console.log(name, age);
```

### Renaming

```javascript
const { name: userName, age: userAge } = user;
console.log(userName, userAge);
```

Useful when the incoming name would clash with something you already have.

### Defaults

```javascript
const { name, country = 'India' } = user;
console.log(name, country);
```

The default is used only when the property is `undefined`.

### Nested

```javascript
const person = {
  name: 'Asha',
  address: { city: 'Pune', pin: '411001' }
};
const { address: { city, pin } } = person;
console.log(city, pin);
```

Careful: this does **not** create an `address` variable. If you want both, ask for both:

```javascript
const { address, address: { city } } = person;
console.log(address, city);
```

### Rest in objects

```javascript
const user = { id: 1, name: 'Asha', password: 'secret', role: 'admin' };
const { password, ...safeUser } = user;
console.log(safeUser);
```

A very common way to strip a field before sending data on.

## Destructuring in parameters

This is where it really pays off.

```javascript
function createUserOld(options) {
  const name = options.name;
  const age = options.age || 18;
  console.log(name, age);
}
function createUser({ name, age = 18, city = 'Unknown' }) {
  console.log(name, age, city);
}
createUser({ name: 'Asha', age: 28 });
```

The parameter list now documents exactly what the function needs.

Give the whole parameter a default so calling with no arguments still works:

```javascript
function createUser({ name = 'guest', age = 18 } = {}) {
  console.log(name, age);
}
createUser();
```

Without `= {}`, calling `createUser()` throws.

## Destructuring in loops

```javascript
const users = [
  { name: 'Asha', age: 28 },
  { name: 'Ben', age: 35 }
];
for (const { name, age } of users) {
  console.log(name, age);
}
users.forEach(({ name }) => console.log(name));
const scores = { maths: 90, physics: 85 };
for (const [subject, mark] of Object.entries(scores)) {
  console.log(subject, mark);
}
```

## The spread operator

The same `...` used the other way round. Rest **gathers**, spread **unpacks**.

### Copying

```javascript
const original = [1, 2, 3];
const copy = [...original];
copy.push(4);
console.log(original, copy);
```

### Merging

```javascript
const a = [1, 2];
const b = [3, 4];
console.log([...a, ...b]);
console.log([0, ...a, 2.5, ...b]);
```

### Objects

```javascript
const defaults = { theme: 'light', fontSize: 14 };
const userPrefs = { theme: 'dark' };
const settings = { ...defaults, ...userPrefs };
console.log(settings);
```

Later values win, which makes this the standard way to apply overrides.

Updating one field without mutating:

```javascript
const user = { name: 'Asha', age: 28 };
const older = { ...user, age: 29 };
console.log(user.age, older.age);
```

### Spreading into function calls

```javascript
const numbers = [5, 2, 9, 1];
console.log(Math.max(...numbers));
function add(a, b, c) {
  return a + b + c;
}
console.log(add(...[1, 2, 3]));
```

### Strings and other iterables

```javascript
console.log([...'hello']);
console.log([...new Set([1, 1, 2, 3])]);
const buttons = [...document.querySelectorAll('button')];
```

That last one turns a NodeList into a real array so you can use `map` and `filter`.

## Shallow, not deep

```javascript
const original = { name: 'Asha', address: { city: 'Pune' } };
const copy = { ...original };
copy.address.city = 'Delhi';
console.log(original.address.city);
```

Spread copies one level. Nested objects are still shared. Use `structuredClone` for a full copy.

## Rest parameters

```javascript
function sum(...numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}
console.log(sum(1, 2, 3, 4));
function log(level, ...messages) {
  console.log(`[${level}]`, ...messages);
}
log('info', 'User', 'logged in');
```

Unlike the old `arguments` object, this is a real array. It must be the last parameter.

## Quick recap

- Array destructuring goes by position, object destructuring goes by name.
- Rename with `{ name: newName }` and set fallbacks with `=`.
- Destructured parameters make a function's inputs self documenting, and add `= {}` for safety.
- `...` gathers when it is a parameter and unpacks everywhere else.
- Later values win when merging objects, which is perfect for defaults.
- Spread is a shallow copy, so nested objects stay shared.

<code id="code-content" class="language-javascript">
// Array destructuring goes by position
const colours = ['red', 'green', 'blue'];
const [first, , third] = colours;
console.log(first, third);            // red blue
// Swap without a temporary variable
let a = 1, b = 2;
[a, b] = [b, a];
console.log(a, b);                    // 2 1
// Object destructuring goes by name, with renaming and defaults
const user = { name: 'Asha', age: 28, address: { city: 'Pune' } };
const { name, age: years, country = 'India' } = user;
console.log(name, years, country);    // Asha 28 India
// Nested destructuring
const { address: { city } } = user;
console.log(city);                    // Pune
// Rest strips a field out neatly
const account = { id: 1, name: 'Asha', password: 'secret' };
const { password, ...safe } = account;
console.log(safe);                    // { id: 1, name: 'Asha' }
// Destructured parameters document what a function needs
function createUser({ name = 'guest', age = 18 } = {}) {
  return name + ' (' + age + ')';
}
console.log(createUser({ name: 'Ben', age: 35 }));
console.log(createUser());            // = {} makes this safe
// Spread copies and merges. Later values win
const defaults = { theme: 'light', fontSize: 14 };
const prefs = { theme: 'dark' };
console.log({ ...defaults, ...prefs });   // theme: dark, fontSize: 14
// Update one field without mutating the original
const older = { ...user, age: 29 };
console.log(user.age, older.age);         // 28 29
// Spread into function calls and over any iterable
console.log(Math.max(...[5, 2, 9, 1]));   // 9
console.log([...'hello']);                // ['h','e','l','l','o']
console.log([...new Set([1, 1, 2, 3])]);  // [1, 2, 3]
// Rest parameters gather arguments into a real array
function sum(...numbers) {
  return numbers.reduce((total, n) =&gt; total + n, 0);
}
console.log(sum(1, 2, 3, 4));             // 10
// Remember: spread is shallow, nested objects are still shared
const copy = { ...user };
copy.address.city = 'Delhi';
console.log(user.address.city);           // Delhi, changed too
</code></pre>

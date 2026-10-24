---
publishDate: 2026-03-05T09:07
title: Scope and Hoisting
slug: scope-and-hoisting
metadescription: Find out where your variables are visible, why let and const behave better than var, and what hoisting really means.
updateDate: 2026-09-05T09:07
author: ['bishal-biswas']
level: 1
tags: ['basics', 'scope']
course: javascript
---

## What is scope?

Scope answers one question: **where can I use this variable?**

A variable is not available everywhere. It lives inside a region, and outside that region it does not exist.

## Global scope

A variable declared outside every function and block is global. Everything can see it.

```javascript
const siteName = 'Open Dev Docs';
function showName() {
  console.log(siteName);
}
showName();
console.log(siteName);
```

Globals sound convenient, but too many of them cause name clashes and make code hard to reason about. Keep them rare.

## Function scope

Variables declared inside a function only exist inside it.

```javascript
function calculate() {
  const result = 42;
  console.log(result);
}
calculate();
console.log(result);
```

That last line throws `ReferenceError: result is not defined`. The variable was created when the function ran and disappeared when it finished.

## Block scope

A block is anything inside curly braces: an `if`, a `for`, or even a bare `{ }`. With `let` and `const`, variables stay inside their block.

```javascript
if (true) {
  let message = 'inside the block';
  console.log(message);
}
console.log(message);
```

Again, `ReferenceError`. This is a good thing. It stops variables leaking into places where they do not belong.

### `var` ignores blocks

```javascript
if (true) {
  var leaked = 'I escaped';
}
console.log(leaked);
```

That prints `I escaped`. `var` only respects *function* boundaries, not blocks. This is one of the main reasons `var` causes bugs.

The classic example is a loop:

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, 100);
}
```

That prints `3`, `3`, `3`, because all three callbacks share one `i`. Change `var` to `let`:

```javascript
for (let i = 0; i < 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, 100);
}
```

Now it prints `0`, `1`, `2`, because `let` creates a fresh `i` for every pass.

## The scope chain

When JavaScript looks up a name, it checks the current scope, then the one outside it, and keeps going outwards until it reaches global.

```javascript
const level1 = 'outer';
function outer() {
  const level2 = 'middle';
  function inner() {
    const level3 = 'inner';
    console.log(level1, level2, level3);
  }
  inner();
}
outer();
```

`inner` can see all three, because lookup travels outwards. It never travels inwards, so `outer` cannot see `level3`.

### Shadowing

An inner variable with the same name hides the outer one.

```javascript
const name = 'outer name';
function show() {
  const name = 'inner name';
  console.log(name);
}
show();
console.log(name);
```

## Hoisting

Before running your code, JavaScript scans it and makes a note of every declaration. This is **hoisting**. It is why you can sometimes use things before the line that declares them.

### Function declarations are fully hoisted

```javascript
sayHello();
function sayHello() {
  console.log('Hello!');
}
```

This works. The whole function is available from the start.

### `var` is hoisted but starts as `undefined`

```javascript
console.log(count);
var count = 5;
console.log(count);
```

The first line prints `undefined` rather than throwing. The declaration moved up, the assignment did not. This half-working behaviour hides typos.

### `let` and `const` are hoisted but unusable first

```javascript
console.log(total);
let total = 100;
```

That throws `ReferenceError: Cannot access 'total' before initialization`. The gap between the top of the block and the declaration line is called the **temporal dead zone**.

This error is a feature. It tells you loudly that you used something too early, instead of quietly handing you `undefined`.

## Why `const` by default?

```javascript
const config = { theme: 'dark' };
config.theme = 'light';
console.log(config);
```

`const` stops you **reassigning the variable**, not changing the object inside it. So `config = {}` fails, but `config.theme = 'light'` is fine. That is usually exactly what you want.

## Quick recap

- Scope decides where a variable is visible.
- `let` and `const` are block scoped, `var` is function scoped and leaks.
- Lookup travels outwards through the scope chain, never inwards.
- Function declarations are fully hoisted, `var` hoists as `undefined`.
- `let` and `const` sit in the temporal dead zone until their declaration line.
- `const` prevents reassignment, not mutation of the object it points to.

<code id="code-content" class="language-javascript">
// Block scope: let and const stay inside their braces
if (true) {
  let blockScoped = 'only inside';
  var functionScoped = 'I leak out';
  console.log(blockScoped);
}
console.log(functionScoped);   // works, var ignores blocks
// console.log(blockScoped);   // ReferenceError
// The classic loop difference
for (var i = 0; i &lt; 3; i++) {
  setTimeout(function () { console.log('var i:', i); }, 10);
}
for (let j = 0; j &lt; 3; j++) {
  setTimeout(function () { console.log('let j:', j); }, 20);
}
// var prints 3, 3, 3   |   let prints 0, 1, 2
// The scope chain looks outwards, never inwards
const level1 = 'outer';
function outer() {
  const level2 = 'middle';
  function inner() {
    const level3 = 'inner';
    console.log(level1, level2, level3);
  }
  inner();
}
outer();
// Hoisting: declarations are available, values are not
sayHello();                    // works, functions hoist completely
function sayHello() { console.log('Hello!'); }
console.log(typeof notYet);    // 'undefined', var hoists as undefined
var notYet = 5;
// const blocks reassignment, not mutation
const config = { theme: 'dark' };
config.theme = 'light';        // allowed
console.log(config);
// config = {};                // TypeError
</code></pre>

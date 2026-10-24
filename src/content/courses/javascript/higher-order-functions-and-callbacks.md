---
publishDate: 2026-03-12T09:20
title: Higher-Order Functions and Callbacks
slug: higher-order-functions-and-callbacks
metadescription: Learn how functions can take and return other functions, and why this idea sits underneath almost every JavaScript library.
updateDate: 2026-09-05T09:20
author: ['bishal-biswas']
level: 2
tags: ['functions', 'callbacks']
course: javascript
---

## Functions are values

In JavaScript, a function is a value like any other. You can store it, pass it to another function, and return it.

```javascript
const greet = function () {
  console.log('Hello');
};
const sameFunction = greet;
sameFunction();
```

That single fact makes everything in this topic possible.

## What is a higher-order function?

A higher-order function is one that does at least one of these:

1. Takes a function as an argument.
2. Returns a function.

That is the whole definition. You have already used several without noticing.

## Callbacks

A **callback** is a function you hand to another function so it can be called later.

```javascript
function processUser(name, callback) {
  const upper = name.toUpperCase();
  callback(upper);
}
processUser('ravi', function (result) {
  console.log('Processed:', result);
});
```

Note carefully:

```javascript
button.addEventListener('click', handleClick);
button.addEventListener('click', handleClick());
```

The first passes the function. The second **calls** it immediately and passes whatever it returned, which is almost never what you want. Leaving off the brackets is the whole point.

## Callbacks you already use

```javascript
setTimeout(function () {
  console.log('One second later');
}, 1000);
button.addEventListener('click', function () {
  console.log('Clicked');
});
[1, 2, 3].forEach(function (n) {
  console.log(n);
});
```

## Writing your own

The value of a higher-order function is that the *how* is fixed and the *what* is left to the caller.

```javascript
function repeat(times, action) {
  for (let i = 0; i < times; i++) {
    action(i);
  }
}
repeat(3, function (i) {
  console.log('Pass number', i);
});
repeat(3, i => console.log('*'.repeat(i + 1)));
```

`repeat` knows how to loop. It does not care what happens on each pass.

## Returning a function

This is the second half of the definition, and it is where things get powerful.

```javascript
function multiplier(factor) {
  return function (number) {
    return number * factor;
  };
}
const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5));
console.log(triple(5));
```

`multiplier(2)` returns a brand new function that remembers `factor` is `2`. That remembering is called a **closure**, and it gets its own topic shortly.

With arrows this reads very compactly:

```javascript
const multiplier = factor => number => number * factor;
const tenTimes = multiplier(10);
console.log(tenTimes(7));
```

## A practical example: sorting

`sort` is a higher-order function. You give it a rule and it does the sorting.

```javascript
const people = [
  { name: 'Chitra', age: 35 },
  { name: 'Asha', age: 28 },
  { name: 'Ben', age: 42 }
];
people.sort((a, b) => a.age - b.age);
console.log(people.map(p => p.name));
people.sort((a, b) => a.name.localeCompare(b.name));
console.log(people.map(p => p.name));
```

You can even build the rule:

```javascript
function sortBy(key) {
  return (a, b) => (a[key] > b[key] ? 1 : -1);
}
people.sort(sortBy('name'));
console.log(people.map(p => p.name));
```

## Function composition

Combining small functions into bigger ones.

```javascript
const trim = str => str.trim();
const lower = str => str.toLowerCase();
const spacesToDashes = str => str.replaceAll(' ', '-');
function compose(...fns) {
  return function (value) {
    return fns.reduce((result, fn) => fn(result), value);
  };
}
const slugify = compose(trim, lower, spacesToDashes);
console.log(slugify('  Hello World Again  '));
```

Each piece is tiny and easy to test. `compose` glues them together.

## Callback hell

Callbacks have one weakness. Nest them and readability collapses.

```javascript
getUser(1, function (user) {
  getPosts(user.id, function (posts) {
    getComments(posts[0].id, function (comments) {
      console.log(comments);
    });
  });
});
```

This shape is known as callback hell or the pyramid of doom. Promises and `async/await` were created to fix exactly this, and they are coming up later in the course.

## Quick recap

- Functions are values, so they can be stored, passed and returned.
- A higher-order function takes a function, returns one, or both.
- A callback is a function passed in to be called later.
- Pass `handleClick`, not `handleClick()`, or it runs immediately.
- Returning a function lets you build configured, reusable helpers.
- Deeply nested callbacks become unreadable, which is what promises solve.

<code id="code-content" class="language-javascript">
// A higher-order function takes a function as an argument
function repeat(times, action) {
  for (let i = 0; i &lt; times; i++) action(i);
}
repeat(3, i =&gt; console.log('*'.repeat(i + 1)));
// ...or returns a new function
function multiplier(factor) {
  return function (number) {
    return number * factor;
  };
}
const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5), triple(5)); // 10 15
// Pass the function, do not call it
function handleClick() { console.log('clicked'); }
// button.addEventListener('click', handleClick);   correct
// button.addEventListener('click', handleClick()); runs immediately, wrong
// sort takes a rule and applies it
const people = [
  { name: 'Chitra', age: 35 },
  { name: 'Asha', age: 28 },
  { name: 'Ben', age: 42 }
];
console.log([...people].sort((a, b) =&gt; a.age - b.age).map(p =&gt; p.name));
// Build the rule itself with a higher-order function
function sortBy(key) {
  return (a, b) =&gt; (a[key] &gt; b[key] ? 1 : -1);
}
console.log([...people].sort(sortBy('name')).map(p =&gt; p.name));
// Composing small functions into one bigger one
const trim = s =&gt; s.trim();
const lower = s =&gt; s.toLowerCase();
const dashes = s =&gt; s.replaceAll(' ', '-');
const compose = (...fns) =&gt; value =&gt; fns.reduce((out, fn) =&gt; fn(out), value);
const slugify = compose(trim, lower, dashes);
console.log(slugify('  Hello World Again  ')); // hello-world-again
</code></pre>

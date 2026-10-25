---
publishDate: 2026-03-23T09:39
title: Functional Programming Concepts
slug: functional-programming-concepts
metadescription: Write code that is easier to test and reason about using pure functions, immutability and composition.
updateDate: 2026-09-05T09:39
author: ['bishal-biswas']
level: 3
tags: ['functional', 'patterns']
course: javascript
---

## The core idea

Functional programming is about building programs from small functions that take input and return output, without reaching out and changing things around them.

You do not have to write everything this way. Borrowing a few ideas already makes code noticeably easier to test and debug.

## Pure functions

A pure function has two properties:

1. The same input always gives the same output.
2. It changes nothing outside itself.

```javascript
function add(a, b) {
  return a + b;
}
let total = 0;
function addImpure(n) {
  total += n;
  return total;
}
console.log(add(2, 3), add(2, 3));
console.log(addImpure(3), addImpure(3));
```

`add` gives `5` every time. `addImpure` gives a different answer on each call, because it depends on hidden state.

More impure examples:

```javascript
function getRandom() {
  return Math.random();
}
function getNow() {
  return new Date();
}
function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}
```

None of these are wrong. Programs need randomness, time and storage. The goal is to keep them at the edges and leave the middle pure, because pure functions are trivial to test:

```javascript
console.log(add(2, 3) === 5);
```

No setup, no mocks, no cleanup.

## Immutability

Do not change data. Produce new data.

```javascript
const numbers = [1, 2, 3];
numbers.push(4);
const numbers2 = [1, 2, 3];
const withFour = [...numbers2, 4];
console.log(numbers2, withFour);
```

### Mutating versus non mutating array methods

```javascript
const list = [3, 1, 2];
list.push(4);
list.sort();
list.reverse();
list.splice(0, 1);
const safe = [3, 1, 2];
console.log(safe.concat(4));
console.log([...safe].sort());
console.log(safe.toSorted());
console.log(safe.toReversed());
console.log(safe.with(0, 99));
console.log(safe.slice(1));
console.log(safe);
```

Modern JavaScript added `toSorted`, `toReversed`, `toSpliced` and `with`, which are copying versions of the old mutating methods.

### Objects

```javascript
const user = { name: 'Asha', age: 28 };
const older = { ...user, age: 29 };
const withoutAge = (({ age, ...rest }) => rest)(user);
console.log(user, older, withoutAge);
```

Freeze an object if you want mutation to fail loudly:

```javascript
const config = Object.freeze({ apiUrl: 'https://api.example.com' });
config.apiUrl = 'changed';
console.log(config.apiUrl);
```

In strict mode that assignment throws. Note `freeze` is shallow, so nested objects stay mutable.

## First class and higher order functions

Already covered earlier in the course, but they are the backbone here.

```javascript
const numbers = [1, 2, 3, 4, 5, 6];
const result = numbers
  .filter(n => n % 2 === 0)
  .map(n => n * n)
  .reduce((sum, n) => sum + n, 0);
console.log(result);
```

No counters, no temporary variables, no mutation. Each step is a pure transformation.

## Composition

Build big functions out of small ones.

```javascript
const trim = s => s.trim();
const lower = s => s.toLowerCase();
const dashes = s => s.replaceAll(' ', '-');
const pipe = (...fns) => value => fns.reduce((out, fn) => fn(out), value);
const compose = (...fns) => value => fns.reduceRight((out, fn) => fn(out), value);
const slugify = pipe(trim, lower, dashes);
console.log(slugify('  Hello World  '));
```

`pipe` reads left to right, `compose` reads right to left. Most people find `pipe` easier.

## Avoid side effects in the middle

```javascript
function processOrders(orders) {
  const valid = orders.filter(o => o.total > 0);
  const withTax = valid.map(o => ({ ...o, tax: o.total * 0.18 }));
  const grandTotal = withTax.reduce((sum, o) => sum + o.total + o.tax, 0);
  return { orders: withTax, grandTotal };
}
const orders = [{ id: 1, total: 100 }, { id: 2, total: 0 }];
const result = processOrders(orders);
console.log(result.grandTotal);
console.log(orders);
```

The input is untouched. You can call this a hundred times and get the same answer, which makes bugs far easier to track down.

## Declarative over imperative

**Imperative** says how:

```javascript
const numbers = [1, 2, 3, 4, 5];
const doubled = [];
for (let i = 0; i < numbers.length; i++) {
  doubled.push(numbers[i] * 2);
}
```

**Declarative** says what:

```javascript
const doubled = numbers.map(n => n * 2);
```

Less room for an off by one error, and the intent is obvious at a glance.

## Where it does not fit

Being dogmatic hurts.

- **Performance.** Copying a large array on every update is wasteful. A mutating loop over a million items is genuinely faster.
- **The real world.** Network calls, DOM updates and logging are all side effects, and you cannot avoid them.
- **Readability.** A deeply curried, point free chain can be harder to read than a plain loop.

The practical approach: pure functions in your business logic, side effects pushed to the edges.

## Quick recap

- A pure function returns the same output for the same input and changes nothing outside.
- Prefer creating new data over mutating existing data.
- Use `toSorted`, `toReversed` and `with` instead of the mutating versions.
- `Object.freeze` blocks mutation, but only one level deep.
- Compose small functions with `pipe` for readable pipelines.
- Declarative code says what you want, not how to loop.
- Keep side effects at the edges rather than banning them.

<code id="code-content" class="language-javascript">
// Pure: same input, same output, nothing outside is touched
const add = (a, b) =&gt; a + b;
console.log(add(2, 3), add(2, 3));      // 5 5, always
// Impure: depends on and changes hidden state
let runningTotal = 0;
const addImpure = n =&gt; (runningTotal += n);
console.log(addImpure(3), addImpure(3)); // 3 6, different each time
// Immutability: create new data instead of changing old data
const numbers = [3, 1, 2];
console.log([...numbers, 4]);            // new array
console.log(numbers.toSorted());         // copying sort, ES2023
console.log(numbers.toReversed());       // copying reverse
console.log(numbers.with(0, 99));        // copy with one item replaced
console.log(numbers);                    // [3, 1, 2], untouched
// Objects: spread to update, destructure to remove
const user = { name: 'Asha', age: 28, password: 'secret' };
const older = { ...user, age: 29 };
const { password, ...safeUser } = user;
console.log(older.age, safeUser);
// Freeze makes mutation fail loudly (shallow only)
const config = Object.freeze({ apiUrl: 'https://api.example.com' });
config.apiUrl = 'changed';
console.log(config.apiUrl);              // unchanged
// Composition: build a pipeline from small pure functions
const pipe = (...fns) =&gt; value =&gt; fns.reduce((out, fn) =&gt; fn(out), value);
const trim = s =&gt; s.trim();
const lower = s =&gt; s.toLowerCase();
const dashes = s =&gt; s.replaceAll(' ', '-');
const slugify = pipe(trim, lower, dashes);
console.log(slugify('  Hello World Again  ')); // hello-world-again
// Declarative pipelines instead of manual loops
const orders = [{ id: 1, total: 100 }, { id: 2, total: 0 }];
function processOrders(list) {
  const withTax = list
    .filter(o =&gt; o.total &gt; 0)
    .map(o =&gt; ({ ...o, tax: o.total * 0.18 }));
  return {
    orders: withTax,
    grandTotal: withTax.reduce((sum, o) =&gt; sum + o.total + o.tax, 0)
  };
}
console.log(processOrders(orders).grandTotal);  // 118
console.log(orders);                            // input untouched
</code></pre>

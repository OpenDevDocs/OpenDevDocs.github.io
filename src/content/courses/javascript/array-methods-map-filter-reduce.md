---
publishDate: 2026-03-13T09:21
title: Array Methods (map, filter, reduce)
slug: array-methods-map-filter-reduce
metadescription: Transform, select and summarise arrays without writing loops. The three methods that change how you write JavaScript.
updateDate: 2026-09-05T09:21
author: ['bishal-biswas']
level: 2
tags: ['arrays', 'functional']
course: javascript
---

## Three questions

Nearly every array operation is one of these:

- **Change every item** into something else. That is `map`.
- **Keep only some items**. That is `filter`.
- **Boil the whole list down to one value**. That is `reduce`.

All three take a callback and none of them change the original array.

## `map`

Returns a new array of the same length, with every item transformed.

```javascript
const numbers = [1, 2, 3, 4];
const doubled = numbers.map(n => n * 2);
console.log(doubled);
console.log(numbers);
```

Pulling one field out of a list of objects is the most common use:

```javascript
const users = [
  { name: 'Asha', age: 28 },
  { name: 'Ben', age: 35 }
];
const names = users.map(user => user.name);
console.log(names);
```

Reshaping objects is the second most common:

```javascript
const summaries = users.map(user => ({
  label: `${user.name} (${user.age})`,
  isAdult: user.age >= 18
}));
console.log(summaries);
```

The callback also receives the index:

```javascript
const items = ['first', 'second', 'third'];
const numbered = items.map((item, index) => `${index + 1}. ${item}`);
console.log(numbered);
```

> **`map` versus `forEach`:** `map` builds and returns a new array. `forEach` returns `undefined` and exists only for side effects. If you are not using the result, use `forEach`.

## `filter`

Returns a new array containing only the items where the callback returned `true`.

```javascript
const numbers = [1, 2, 3, 4, 5, 6];
const evens = numbers.filter(n => n % 2 === 0);
console.log(evens);
```

```javascript
const products = [
  { name: 'Pen', price: 20, inStock: true },
  { name: 'Book', price: 250, inStock: false },
  { name: 'Bag', price: 800, inStock: true }
];
const available = products.filter(p => p.inStock);
const affordable = products.filter(p => p.price < 500);
console.log(available.length, affordable.length);
```

Combining conditions works exactly as you would expect:

```javascript
const cheapAndAvailable = products.filter(p => p.inStock && p.price < 500);
console.log(cheapAndAvailable);
```

A neat trick for removing empty values:

```javascript
const messy = ['a', '', 'b', null, 'c', undefined, 0];
console.log(messy.filter(Boolean));
```

## `reduce`

The most powerful and the most confusing at first. It walks the array and builds up a single result.

```javascript
const numbers = [1, 2, 3, 4];
const total = numbers.reduce((sum, n) => sum + n, 0);
console.log(total);
```

Two arguments to understand:

- The **callback** receives the running result so far, and the current item.
- The **second argument** to `reduce` is the starting value.

Trace it through:

```javascript
// start:      sum = 0
// item 1:     sum = 0 + 1 = 1
// item 2:     sum = 1 + 2 = 3
// item 3:     sum = 3 + 3 = 6
// item 4:     sum = 6 + 4 = 10
```

> **Always pass the starting value.** Without it, `reduce` uses the first item as the start, and it throws on an empty array.

### Reduce does more than sums

**Find a maximum:**

```javascript
const numbers = [12, 45, 7, 89, 23];
const max = numbers.reduce((best, n) => (n > best ? n : best), numbers[0]);
console.log(max);
```

**Count occurrences:**

```javascript
const votes = ['yes', 'no', 'yes', 'yes', 'no'];
const tally = votes.reduce((counts, vote) => {
  counts[vote] = (counts[vote] || 0) + 1;
  return counts;
}, {});
console.log(tally);
```

**Group items:**

```javascript
const people = [
  { name: 'Asha', city: 'Pune' },
  { name: 'Ben', city: 'Delhi' },
  { name: 'Chitra', city: 'Pune' }
];
const byCity = people.reduce((groups, person) => {
  const key = person.city;
  groups[key] = groups[key] || [];
  groups[key].push(person.name);
  return groups;
}, {});
console.log(byCity);
```

Modern JavaScript has `Object.groupBy` for that last one:

```javascript
console.log(Object.groupBy(people, person => person.city));
```

## Chaining

The real power comes from combining them.

```javascript
const orders = [
  { item: 'Pen', price: 20, quantity: 3, status: 'delivered' },
  { item: 'Book', price: 250, quantity: 1, status: 'cancelled' },
  { item: 'Bag', price: 800, quantity: 2, status: 'delivered' }
];
const revenue = orders
  .filter(order => order.status === 'delivered')
  .map(order => order.price * order.quantity)
  .reduce((sum, amount) => sum + amount, 0);
console.log(revenue);
```

Read it top to bottom: keep the delivered ones, work out each total, add them up. Compare that to a `for` loop with an `if` inside and a running counter. The chain says what you want, not how to get it.

> **Note on performance:** each step walks the array again. For a few thousand items this does not matter at all. For very large lists, a single loop is faster.

## The other useful ones

```javascript
const numbers = [1, 2, 3, 4, 5];
console.log(numbers.find(n => n > 3));
console.log(numbers.findIndex(n => n > 3));
console.log(numbers.some(n => n > 4));
console.log(numbers.every(n => n > 0));
console.log(numbers.flat());
console.log([[1, 2], [3, 4]].flatMap(pair => pair));
```

- `find` returns the first match itself, `filter` returns all matches in an array.
- `some` asks "is at least one true?", `every` asks "are they all true?".

## Quick recap

- `map` transforms every item and returns a new array of the same length.
- `filter` keeps items where the callback is true.
- `reduce` folds the array into one value, and always pass a starting value.
- None of them change the original array.
- Chain them to describe what you want instead of how to loop.
- `find`, `some` and `every` cover the common search questions.

<code id="code-content" class="language-javascript">
const orders = [
  { item: 'Pen',  price: 20,  quantity: 3, status: 'delivered' },
  { item: 'Book', price: 250, quantity: 1, status: 'cancelled' },
  { item: 'Bag',  price: 800, quantity: 2, status: 'delivered' }
];
// map: change every item into something else
console.log(orders.map(o =&gt; o.item));
// filter: keep only the ones you want
console.log(orders.filter(o =&gt; o.status === 'delivered').length);
// reduce: boil the list down to one value
const total = orders.reduce((sum, o) =&gt; sum + o.price * o.quantity, 0);
console.log('Total value:', total);
// Chaining reads top to bottom like a sentence
const revenue = orders
  .filter(o =&gt; o.status === 'delivered')
  .map(o =&gt; o.price * o.quantity)
  .reduce((sum, amount) =&gt; sum + amount, 0);
console.log('Delivered revenue:', revenue); // 1660
// reduce is not only for sums: counting
const votes = ['yes', 'no', 'yes', 'yes', 'no'];
const tally = votes.reduce((counts, vote) =&gt; {
  counts[vote] = (counts[vote] || 0) + 1;
  return counts;
}, {});
console.log(tally); // { yes: 3, no: 2 }
// reduce for grouping
const people = [
  { name: 'Asha', city: 'Pune' },
  { name: 'Ben', city: 'Delhi' },
  { name: 'Chitra', city: 'Pune' }
];
const byCity = people.reduce((groups, p) =&gt; {
  groups[p.city] = groups[p.city] || [];
  groups[p.city].push(p.name);
  return groups;
}, {});
console.log(byCity);
// Removing empty values in one step
console.log(['a', '', 'b', null, 'c'].filter(Boolean));
// The quick questions
const numbers = [1, 2, 3, 4, 5];
console.log(numbers.find(n =&gt; n &gt; 3));    // 4, the item itself
console.log(numbers.some(n =&gt; n &gt; 4));    // true
console.log(numbers.every(n =&gt; n &gt; 0));   // true
</code></pre>

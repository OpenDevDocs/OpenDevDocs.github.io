---
publishDate: 2026-03-05T09:08
title: Arrays - Basics and Methods
slug: arrays-basics-and-methods
metadescription: Store lists of values in arrays and learn the everyday methods for adding, removing, searching and copying items.
updateDate: 2026-09-05T09:08
author: ['bishal-biswas']
level: 1
tags: ['basics', 'arrays']
course: javascript
---

## What is an array?

An array is an ordered list of values stored under one name.

```javascript
const fruits = ['apple', 'banana', 'mango'];
console.log(fruits);
```

An array can hold anything, including a mix of types, though in practice you usually keep one kind of thing in each list.

```javascript
const mixed = [42, 'hello', true, null, { id: 1 }];
```

## Reading items by index

Positions start at **zero**, not one.

```javascript
const fruits = ['apple', 'banana', 'mango'];
console.log(fruits[0]);
console.log(fruits[2]);
console.log(fruits[5]);
```

Asking for a position that does not exist gives `undefined` rather than an error.

`length` tells you how many items there are:

```javascript
console.log(fruits.length);
console.log(fruits[fruits.length - 1]);
```

The last item is always at `length - 1`. Modern JavaScript has a nicer way:

```javascript
console.log(fruits.at(-1));
console.log(fruits.at(-2));
```

## Changing items

```javascript
const fruits = ['apple', 'banana', 'mango'];
fruits[1] = 'orange';
console.log(fruits);
```

Note that this works even though `fruits` is a `const`. You are changing what is *inside* the array, not replacing the array itself.

## Adding and removing

### At the end

```javascript
const items = ['pen'];
items.push('book');
items.push('bag', 'bottle');
console.log(items);
const removed = items.pop();
console.log(removed, items);
```

`push` adds to the end, `pop` removes from the end and returns it.

### At the start

```javascript
const queue = ['second'];
queue.unshift('first');
console.log(queue);
const front = queue.shift();
console.log(front, queue);
```

`unshift` adds to the front, `shift` removes from the front.

> **Memory tip:** `push` and `pop` work on the end. `shift` and `unshift` shift everything along, so they work on the start.

### Anywhere with `splice`

```javascript
const list = ['a', 'b', 'c', 'd'];
list.splice(1, 2);
console.log(list);
```

`splice(start, count)` removes `count` items beginning at `start`. Add a third argument to insert:

```javascript
const list = ['a', 'd'];
list.splice(1, 0, 'b', 'c');
console.log(list);
```

## Copying a section with `slice`

`slice` does **not** change the original. It returns a new array.

```javascript
const letters = ['a', 'b', 'c', 'd', 'e'];
console.log(letters.slice(1, 3));
console.log(letters.slice(2));
console.log(letters.slice(-2));
console.log(letters);
```

The end position is not included, so `slice(1, 3)` gives items 1 and 2.

> **`slice` versus `splice`:** `slice` copies and leaves the original alone. `splice` cuts into the original. The extra `p` in `splice` can remind you that it is the destructive one.

## Searching

```javascript
const names = ['Asha', 'Ben', 'Chitra'];
console.log(names.includes('Ben'));
console.log(names.indexOf('Chitra'));
console.log(names.indexOf('Zara'));
```

`includes` gives a boolean, `indexOf` gives the position or `-1` when it is missing.

For objects, use `find` and `findIndex`:

```javascript
const users = [
  { id: 1, name: 'Asha' },
  { id: 2, name: 'Ben' }
];
const found = users.find(function (user) {
  return user.id === 2;
});
console.log(found);
```

## Joining and splitting

```javascript
const words = ['Learn', 'JavaScript', 'today'];
console.log(words.join(' '));
console.log(words.join(', '));
const sentence = 'Learn JavaScript today';
console.log(sentence.split(' '));
```

## Combining arrays

```javascript
const a = [1, 2];
const b = [3, 4];
console.log(a.concat(b));
console.log([...a, ...b]);
```

The `...` is the spread operator, and it is the modern favourite. You will meet it properly later in the course.

## Sorting and reversing

Both change the original array.

```javascript
const names = ['Chitra', 'Asha', 'Ben'];
names.sort();
console.log(names);
names.reverse();
console.log(names);
```

Sorting numbers has a catch. By default `sort` compares items as text:

```javascript
const numbers = [10, 9, 100, 1];
numbers.sort();
console.log(numbers);
```

That gives `[1, 10, 100, 9]`, which is alphabetical order, not numeric. Pass a comparison function instead:

```javascript
const numbers = [10, 9, 100, 1];
numbers.sort(function (a, b) {
  return a - b;
});
console.log(numbers);
```

## Looping over an array

```javascript
const colours = ['red', 'green', 'blue'];
for (const colour of colours) {
  console.log(colour);
}
colours.forEach(function (colour, index) {
  console.log(index, colour);
});
```

`map`, `filter` and `reduce` are the really powerful ones, and they get a topic of their own later.

## Quick recap

- Indexes start at 0, and the last item is at `length - 1` or `at(-1)`.
- `push`/`pop` work at the end, `shift`/`unshift` at the start.
- `splice` changes the original, `slice` returns a copy.
- `includes` and `indexOf` search values, `find` searches objects.
- `sort` compares as text unless you pass `(a, b) => a - b`.
- `const` on an array stops reassignment, not changes to its contents.

<code id="code-content" class="language-javascript">
const fruits = ['apple', 'banana', 'mango'];
// Reading items
console.log(fruits[0]);        // apple
console.log(fruits.at(-1));    // mango, last item
console.log(fruits.length);    // 3
// Adding and removing
fruits.push('orange');         // add to the end
fruits.unshift('grape');       // add to the start
console.log(fruits);
fruits.pop();                  // remove from the end
fruits.shift();                // remove from the start
console.log(fruits);
// slice copies, splice cuts
const letters = ['a', 'b', 'c', 'd', 'e'];
console.log(letters.slice(1, 3));  // ['b','c'], original untouched
const copy = [...letters];
copy.splice(1, 2);                 // removes 'b' and 'c' from copy
console.log(copy, letters);
// Searching
console.log(fruits.includes('banana'));  // true
console.log(fruits.indexOf('mango'));    // position, or -1
const users = [{ id: 1, name: 'Asha' }, { id: 2, name: 'Ben' }];
console.log(users.find(function (u) { return u.id === 2; }));
// Joining and splitting
console.log(['Learn', 'JavaScript'].join(' '));
console.log('Learn JavaScript'.split(' '));
// Sorting numbers needs a compare function
const numbers = [10, 9, 100, 1];
console.log([...numbers].sort());                                  // 1,10,100,9
console.log([...numbers].sort(function (a, b) { return a - b; })); // 1,9,10,100
</code></pre>

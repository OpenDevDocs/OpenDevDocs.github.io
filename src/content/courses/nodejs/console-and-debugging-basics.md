---
publishDate: 2026-10-25T09:10
title: The Console and Debugging Basics
slug: console-and-debugging-basics
metadescription: Go beyond console.log with console.table, dir, group, time, count and trace, learn stdout versus stderr, read a stack trace and pause code with debugger.
updateDate: 2026-10-25T09:10
author: ['bishal-biswas']
level: 1
tags: ['console', 'debugging', 'basics']
course: nodejs
---

## Why the console matters

When your program misbehaves, you need to see what it is doing. The **console** is your window into the running code.

Think of a car dashboard. You cannot see the engine while driving, but the lights and gauges tell you the speed, the fuel level and when something is wrong. `console` is the dashboard you add to your own program.

Most people only use `console.log`. The console has many more tools, and a few of them will save you real time.

## console.log and friends

```javascript
console.log('Server started');     // general output
console.info('Loading 3 notes');   // same as log
console.debug('Cache size: 12');   // same as log in Node
console.warn('Disk almost full');  // a warning
console.error('Could not save');   // an error
```

They all print text. The difference is **where** the text goes, which matters more than it looks.

### stdout and stderr

Every program has two output channels:

- **stdout** (standard output) is for normal results. `log`, `info` and `debug` write here.
- **stderr** (standard error) is for problems. `warn` and `error` write here.

In the terminal both look the same. The difference shows when you save output to a file:

```bash
node app.mjs > results.txt
```

The `>` sends stdout to `results.txt`, but errors still appear on screen. So use `console.error` for errors, and they will never get lost inside your real output.

## Looking inside objects

`console.log` prints objects nicely, but it stops after a couple of levels of nesting:

```javascript
const order = {
  id: 7,
  customer: { name: 'Asha', address: { city: 'Pune', geo: { lat: 18.5, lng: 73.8 } } },
  items: ['tea', 'cake'],
};

console.log(order);
```

```text
{
  id: 7,
  customer: { name: 'Asha', address: { city: 'Pune', geo: [Object] } },
  items: [ 'tea', 'cake' ]
}
```

See the `[Object]`? The deepest part is hidden. Use `console.dir` with `depth: null` to show everything:

```javascript
console.dir(order, { depth: null });
```

```text
{
  id: 7,
  customer: {
    name: 'Asha',
    address: { city: 'Pune', geo: { lat: 18.5, lng: 73.8 } }
  },
  items: [ 'tea', 'cake' ]
}
```

### The labelled-variable trick

Wrap variables in curly braces to print their names alongside their values:

```javascript
const city = 'Pune';
const total = 240;
console.log({ city, total }); // prints: { city: 'Pune', total: 240 }
```

This is much clearer than a row of bare values when you are logging several things.

## console.table

An array of objects is hard to read as text. `console.table` draws it as a table:

```javascript
const books = [
  { title: 'Dune', author: 'Herbert', pages: 412 },
  { title: 'Emma', author: 'Austen', pages: 474 },
];

console.table(books);
```

```text
┌─────────┬────────┬───────────┬───────┐
│ (index) │ title  │ author    │ pages │
├─────────┼────────┼───────────┼───────┤
│ 0       │ 'Dune' │ 'Herbert' │ 412   │
│ 1       │ 'Emma' │ 'Austen'  │ 474   │
└─────────┴────────┴───────────┴───────┘
```

Pass a list of column names to show only some: `console.table(books, ['title', 'pages'])`.

## console.group

`console.group` indents everything after it until you call `console.groupEnd`. Use it to make nested steps easy to follow:

```javascript
console.group('Order 7');
console.log('Tea');
console.group('Extras');
console.log('Cake');
console.groupEnd();
console.groupEnd();
console.log('done');
```

```text
Order 7
  Tea
  Extras
    Cake
done
```

## Timing and counting

### console.time

Wondering how long something takes? Start a timer with a label, then end it with the same label:

```javascript
console.time('sum');
let total = 0;
for (let i = 0; i < 1_000_000; i++) total += i;
console.timeEnd('sum');
```

```text
sum: 3.244ms
```

Your number will differ. `console.timeLog('sum')` prints the time so far without stopping the timer.

### console.count

`console.count` prints how many times a line has run. Great for "is this function being called twice?":

```javascript
function save() {
  console.count('save');
}
save();
save();
```

```text
save: 1
save: 2
```

## console.assert

`console.assert` prints a message **only when a condition is false**:

```javascript
const books = ['Dune', 'Emma'];
console.assert(books.length === 3, 'Expected 3 books');
```

```text
Assertion failed: Expected 3 books
```

When the condition is true, it prints nothing. Unlike a test, it does not stop the program. You will meet real assertions in the testing lessons.

## console.trace

`console.trace` prints a message plus the **call stack**: the chain of functions that led to this line.

```javascript
function checkout() {
  applyDiscount();
}
function applyDiscount() {
  console.trace('Who called me?');
}
checkout();
```

```text
Trace: Who called me?
    at applyDiscount (file:///home/asha/shop/trace.mjs:5:11)
    at checkout (file:///home/asha/shop/trace.mjs:2:3)
    ...
```

## Reading a stack trace

When your program crashes, Node prints an error with a **stack trace**. Beginners often skip past it, but it tells you exactly where to look.

```javascript
// orders.mjs
const orders = [{ id: 1, customer: { name: 'Asha' } }, { id: 2 }];

function customerName(order) {
  return order.customer.name;
}

for (const order of orders) {
  console.log(customerName(order));
}
```

```text
Asha
file:///home/asha/shop/orders.mjs:4
  return order.customer.name;
                        ^

TypeError: Cannot read properties of undefined (reading 'name')
    at customerName (file:///home/asha/shop/orders.mjs:4:25)
    at file:///home/asha/shop/orders.mjs:8:15
    ...

Node.js v24.12.0
```

Read it top to bottom:

1. **The line that failed**: `orders.mjs:4`, with a `^` pointing at the spot.
2. **The error type and message**: we tried to read `name` from something that was `undefined`. So `order.customer` was `undefined`.
3. **The stack**: `customerName` was called from line 8. The order with `id: 2` has no customer.

Lines starting with `node:internal` are Node's own code. You can usually ignore them and focus on your own files.

## Pausing your code: debugger

Logging is quick, but sometimes you want to stop the program and look around. A **debugger** pauses your code at a line so you can inspect every variable.

Add the `debugger` keyword where you want to stop:

```javascript
function customerName(order) {
  debugger; // execution pauses here when a debugger is attached
  return order.customer.name;
}
```

Then start Node with the inspector turned on:

```bash
node --inspect-brk orders.mjs
```

`--inspect-brk` starts the inspector and pauses on the first line. Open Chrome, go to `chrome://inspect`, and click **inspect** under your script. You can then step through the code and hover over variables.

In VS Code it is even easier: open the file, click to the left of a line number to set a **breakpoint** (a red dot), and press F5.

> **Note:** Without a debugger attached, the `debugger` keyword does nothing. The Debugging with the Inspector lesson covers breakpoints, stepping and watching values in depth.

## Common mistakes

### Logging an object inside a string

```javascript
console.log('Order: ' + order); // prints: Order: [object Object]
```

Joining an object with a string turns it into the useless text `[object Object]`. Pass it as a separate argument:

```javascript
console.log('Order:', order);
```

## Quick recap

- `log`, `info` and `debug` write to stdout. `warn` and `error` write to stderr.
- `console.dir(obj, { depth: null })` shows deeply nested objects in full.
- `console.log({ a, b })` prints variable names with their values.
- `console.table` draws arrays of objects, and `console.group` indents related lines.
- `console.time`, `count`, `assert` and `trace` answer "how long?", "how often?", "is this true?" and "who called me?".
- Read stack traces top to bottom, and look for your own file names.
- Use `debugger` with `node --inspect-brk` to pause and inspect running code.

<code id="code-content" class="language-javascript">
// console-tour.mjs
const books = [
  { title: 'Dune', author: 'Herbert', pages: 412 },
  { title: 'Emma', author: 'Austen', pages: 474 },
  { title: 'Beloved', author: 'Morrison', pages: 324 },
];
const order = {
  id: 7,
  customer: { name: 'Asha', address: { city: 'Pune', geo: { lat: 18.5, lng: 73.8 } } },
};
// --- stdout versus stderr
console.log('Normal output goes to stdout');
console.error('Problems go to stderr');
// --- Nested objects: log hides deep levels, dir can show them all
console.log(order);
console.dir(order, { depth: null });
// --- Print variable names with their values
const total = books.reduce((sum, b) =&gt; sum + b.pages, 0);
console.log({ count: books.length, total });
// --- Tables for arrays of objects
console.table(books, ['title', 'pages']);
// --- Groups indent related lines
console.group('Checking books');
for (const book of books) {
  console.count('checked'); // how many times has this run?
  console.assert(book.pages &lt; 450, `${book.title} is a long read`);
}
console.groupEnd();
// --- Timing a piece of work
console.time('sort');
const sorted = books.toSorted((a, b) =&gt; a.pages - b.pages);
console.timeEnd('sort');
console.log(sorted.map(b =&gt; b.title).join(' &lt; '));
// --- Who called me?
function applyDiscount() {
  console.trace('applyDiscount was called');
}
function checkout() {
  applyDiscount();
}
checkout();
// --- The classic mistake, and the fix
console.log('Order: ' + order); // [object Object]
console.log('Order:', order.id, order.customer.name);
</code></pre>

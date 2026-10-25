---
publishDate: 2026-03-16T09:26
title: Closures
slug: closures
metadescription: Understand how a function remembers the variables around it, and use closures for private data, counters and factory functions.
updateDate: 2026-09-05T09:26
author: ['bishal-biswas']
level: 2
tags: ['functions', 'scope', 'closures']
course: javascript
---

## What is a closure?

A closure is a function that remembers the variables from where it was **created**, even after that outer function has finished.

```javascript
function outer() {
  const message = 'Hello from outer';
  function inner() {
    console.log(message);
  }
  return inner;
}
const myFunction = outer();
myFunction();
```

`outer` finished running before `myFunction()` was called. Normally its variables would be gone. But `inner` still needs `message`, so JavaScript keeps it alive. That is a closure.

## A counter that cannot be tampered with

```javascript
function createCounter() {
  let count = 0;
  return {
    increment() {
      count++;
      return count;
    },
    decrement() {
      count--;
      return count;
    },
    getCount() {
      return count;
    }
  };
}
const counter = createCounter();
console.log(counter.increment());
console.log(counter.increment());
console.log(counter.getCount());
console.log(counter.count);
```

`counter.count` is `undefined`. There is no way to reach `count` from outside, and no way to set it to a silly value. The only path in is through the three methods.

This is the module pattern, and it was how JavaScript did private data long before `#` fields existed.

## Each call gets its own box

```javascript
const counterA = createCounter();
const counterB = createCounter();
counterA.increment();
counterA.increment();
counterB.increment();
console.log(counterA.getCount());
console.log(counterB.getCount());
```

Every call to `createCounter` creates a fresh `count`. The two counters do not interfere.

## Function factories

```javascript
function multiplier(factor) {
  return function (number) {
    return number * factor;
  };
}
const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5), triple(5));
```

`double` remembers `factor` is `2`. `triple` remembers `3`. Same code, two different memories.

A practical version:

```javascript
function createGreeter(greeting) {
  return function (name) {
    return `${greeting}, ${name}!`;
  };
}
const hello = createGreeter('Hello');
const namaste = createGreeter('Namaste');
console.log(hello('Asha'));
console.log(namaste('Ravi'));
```

## The loop trap

```javascript
for (var i = 1; i <= 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, 100);
}
```

This prints `4`, `4`, `4`. With `var` there is only one `i`, shared by all three closures. By the time the timeouts run, the loop has finished and `i` is `4`.

```javascript
for (let i = 1; i <= 3; i++) {
  setTimeout(function () {
    console.log(i);
  }, 100);
}
```

Now it prints `1`, `2`, `3`. `let` creates a new `i` for every pass, so each closure captures a different one.

Before `let` existed, people wrapped the body in a function to force a new scope. You still see this in older code.

## Closures capture variables, not values

```javascript
function makeCounter() {
  let count = 0;
  const show = () => console.log(count);
  count = 10;
  return show;
}
makeCounter()();
```

That prints `10`, not `0`. The closure holds a live link to the variable, so it sees the latest value.

## Practical uses

### Once only

```javascript
function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
}
const initialise = once(() => {
  console.log('Setting up');
  return 'ready';
});
console.log(initialise());
console.log(initialise());
```

The setup message prints once. `called` lives in the closure.

### Debounce

Waits until the user stops typing before doing the work.

```javascript
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
const search = debounce((term) => {
  console.log('Searching for', term);
}, 500);
search('j');
search('ja');
search('java');
```

Only the last call runs. `timeoutId` is remembered between calls thanks to the closure.

### Memoising

Caching results so expensive work runs once per input.

```javascript
function memoise(fn) {
  const cache = new Map();
  return function (n) {
    if (cache.has(n)) {
      console.log('From cache:', n);
      return cache.get(n);
    }
    const result = fn(n);
    cache.set(n, result);
    return result;
  };
}
const slowSquare = memoise((n) => {
  console.log('Calculating', n);
  return n * n;
});
console.log(slowSquare(4));
console.log(slowSquare(4));
```

## Memory

Closures keep their captured variables alive. Usually that is tiny and irrelevant, but if a closure holds a large object and you keep the closure forever, that object cannot be cleaned up. Something to remember when you attach long lived handlers.

## Quick recap

- A closure is a function plus the variables it was created alongside.
- Each call to the outer function creates a separate set of those variables.
- Closures give you private data, which nothing outside can reach.
- Use `let` in loops so each pass captures its own variable.
- Closures capture the variable itself, so they see the latest value.
- `once`, `debounce` and memoisation are all built on closures.

<code id="code-content" class="language-javascript">
// A closure remembers the variables it was created with
function createCounter() {
  let count = 0;                       // private, unreachable from outside
  return {
    increment() { return ++count; },
    decrement() { return --count; },
    getCount() { return count; }
  };
}
const counter = createCounter();
counter.increment();
counter.increment();
console.log(counter.getCount());       // 2
console.log(counter.count);            // undefined, truly private
// Every call gets its own separate memory
const a = createCounter();
const b = createCounter();
a.increment();
console.log(a.getCount(), b.getCount()); // 1 0
// Function factories: same code, different remembered value
function multiplier(factor) {
  return number =&gt; number * factor;
}
const double = multiplier(2);
const triple = multiplier(3);
console.log(double(5), triple(5));     // 10 15
// The loop trap: var shares one variable, let makes a new one each pass
for (var i = 1; i &lt;= 3; i++) setTimeout(() =&gt; console.log('var:', i), 10);
for (let j = 1; j &lt;= 3; j++) setTimeout(() =&gt; console.log('let:', j), 20);
// var prints 4,4,4   |   let prints 1,2,3
// once: run something a single time
function once(fn) {
  let called = false, result;
  return function (...args) {
    if (!called) { called = true; result = fn(...args); }
    return result;
  };
}
const setup = once(() =&gt; { console.log('Setting up'); return 'ready'; });
console.log(setup(), setup());         // logs once, returns 'ready' twice
// debounce: wait until the user stops typing
function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() =&gt; fn(...args), delay);
  };
}
const search = debounce(term =&gt; console.log('Searching for', term), 500);
search('j'); search('ja'); search('java');   // only 'java' runs
</code></pre>

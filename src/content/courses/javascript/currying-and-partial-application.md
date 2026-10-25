---
publishDate: 2026-03-24T09:40
title: Currying and Partial Application
slug: currying-and-partial-application
metadescription: Turn one multi argument function into a chain of single argument functions, and pre fill arguments to build specialised helpers.
updateDate: 2026-09-05T09:40
author: ['bishal-biswas']
level: 3
tags: ['functional', 'functions']
course: javascript
---

## Currying

Currying turns a function that takes several arguments into a chain of functions that each take one.

```javascript
function add(a, b, c) {
  return a + b + c;
}
console.log(add(1, 2, 3));
function curriedAdd(a) {
  return function (b) {
    return function (c) {
      return a + b + c;
    };
  };
}
console.log(curriedAdd(1)(2)(3));
```

With arrows this is much tidier:

```javascript
const curriedAdd = a => b => c => a + b + c;
console.log(curriedAdd(1)(2)(3));
```

Each call returns a new function that remembers the arguments so far, thanks to closures.

## Why would you do that?

Because you can stop partway and keep the result.

```javascript
const add = a => b => c => a + b + c;
const add5 = add(5);
const add5and10 = add5(10);
console.log(add5and10(1));
console.log(add5and10(2));
console.log(add5(1)(1));
```

You have built specialised functions out of one general one.

## Partial application

Similar idea, but you fix some arguments and leave the rest for a single later call.

```javascript
function partial(fn, ...fixed) {
  return function (...rest) {
    return fn(...fixed, ...rest);
  };
}
function greet(greeting, punctuation, name) {
  return `${greeting}, ${name}${punctuation}`;
}
const hello = partial(greet, 'Hello', '!');
console.log(hello('Asha'));
console.log(hello('Ben'));
```

`bind` does partial application built in:

```javascript
const hi = greet.bind(null, 'Hi', '.');
console.log(hi('Chitra'));
```

The `null` is what `this` should be, which does not matter here.

> **The difference:** currying gives one argument at a time and returns a function each step. Partial application fixes some arguments and takes all the rest at once.

## A general curry helper

```javascript
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return function (...more) {
      return curried(...args, ...more);
    };
  };
}
function volume(l, w, h) {
  return l * w * h;
}
const curriedVolume = curry(volume);
console.log(curriedVolume(2)(3)(4));
console.log(curriedVolume(2, 3)(4));
console.log(curriedVolume(2)(3, 4));
console.log(curriedVolume(2, 3, 4));
```

`fn.length` is the number of declared parameters, so the helper knows when it has enough. Note it does not work with default parameters or rest parameters, which both make `length` unreliable.

## Practical uses

### Configured helpers

```javascript
const log = level => module => message =>
  console.log(`[${level}] [${module}] ${message}`);
const errorLog = log('ERROR');
const authError = errorLog('auth');
const dbError = errorLog('database');
authError('Invalid password');
dbError('Connection lost');
```

Each layer locks in one piece of context.

### Reusable formatters

```javascript
const formatCurrency = (locale, currency) => amount =>
  amount.toLocaleString(locale, { style: 'currency', currency });
const inRupees = formatCurrency('en-IN', 'INR');
const inDollars = formatCurrency('en-US', 'USD');
console.log(inRupees(1234.5));
console.log(inDollars(1234.5));
```

### Working well with `map`

```javascript
const multiply = a => b => a * b;
const numbers = [1, 2, 3, 4];
console.log(numbers.map(multiply(10)));
const prop = key => object => object[key];
const users = [{ name: 'Asha' }, { name: 'Ben' }];
console.log(users.map(prop('name')));
```

`multiply(10)` is already the exact function `map` wants, so there is no wrapper arrow.

### Filters you can combine

```javascript
const greaterThan = min => value => value > min;
const lessThan = max => value => value < max;
const numbers = [1, 5, 10, 15, 20];
console.log(numbers.filter(greaterThan(5)));
console.log(numbers.filter(lessThan(15)));
const and = (...predicates) => value => predicates.every(p => p(value));
console.log(numbers.filter(and(greaterThan(5), lessThan(20))));
```

## Argument order matters

Put the configuration first and the data last. That way the partially applied function is ready to hand to `map` or `filter`.

```javascript
const replaceGood = (find, replace) => text => text.replaceAll(find, replace);
const censor = replaceGood('bad', '***');
console.log(['a bad day', 'not bad'].map(censor));
const replaceBad = text => (find, replace) => text.replaceAll(find, replace);
```

The first version composes. The second does not.

## Do not overdo it

```javascript
const process = a => b => c => d => e => a + b + c + d + e;
console.log(process(1)(2)(3)(4)(5));
function processClear(a, b, c, d, e) {
  return a + b + c + d + e;
}
```

If nobody will ever call it partially, currying just makes it harder to read. Reach for it when you actually reuse the partial result.

## Quick recap

- Currying turns `f(a, b, c)` into `f(a)(b)(c)`, one argument at a time.
- Partial application fixes some arguments and takes the rest in one go.
- `bind` gives you partial application without any helper.
- Closures are what let each step remember the earlier arguments.
- Put configuration first and data last so the result works with `map` and `filter`.
- Only curry when you genuinely reuse the partially applied function.

<code id="code-content" class="language-javascript">
// Currying: one argument at a time, each call returns a function
const add = a =&gt; b =&gt; c =&gt; a + b + c;
console.log(add(1)(2)(3));            // 6
// The point is that you can stop partway and keep the result
const add5 = add(5);
const add5and10 = add5(10);
console.log(add5and10(1), add5and10(2));   // 16 17
// Partial application: fix some arguments, take the rest at once
function partial(fn, ...fixed) {
  return (...rest) =&gt; fn(...fixed, ...rest);
}
function greet(greeting, punctuation, name) {
  return greeting + ', ' + name + punctuation;
}
const hello = partial(greet, 'Hello', '!');
console.log(hello('Asha'), hello('Ben'));
// bind does partial application for free
const hi = greet.bind(null, 'Hi', '.');
console.log(hi('Chitra'));
// A general curry helper that accepts arguments in any grouping
function curry(fn) {
  return function curried(...args) {
    if (args.length &gt;= fn.length) return fn(...args);
    return (...more) =&gt; curried(...args, ...more);
  };
}
const volume = curry((l, w, h) =&gt; l * w * h);
console.log(volume(2)(3)(4), volume(2, 3)(4), volume(2, 3, 4)); // 24 24 24
// Curried functions slot straight into map and filter
const multiply = a =&gt; b =&gt; a * b;
console.log([1, 2, 3, 4].map(multiply(10)));   // [10,20,30,40]
const prop = key =&gt; object =&gt; object[key];
console.log([{ name: 'Asha' }, { name: 'Ben' }].map(prop('name')));
// Combinable filters
const greaterThan = min =&gt; value =&gt; value &gt; min;
const lessThan = max =&gt; value =&gt; value &lt; max;
const and = (...preds) =&gt; value =&gt; preds.every(p =&gt; p(value));
console.log([1, 5, 10, 15, 20].filter(and(greaterThan(5), lessThan(20))));
// Configuration first, data last, so partials stay useful
const formatCurrency = (locale, currency) =&gt; amount =&gt;
  amount.toLocaleString(locale, { style: 'currency', currency: currency });
const inRupees = formatCurrency('en-IN', 'INR');
console.log(inRupees(1234.5));
</code></pre>

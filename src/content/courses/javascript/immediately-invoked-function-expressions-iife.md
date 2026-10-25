---
publishDate: 2026-03-16T09:27
title: Immediately Invoked Function Expressions (IIFE)
slug: immediately-invoked-function-expressions-iife
metadescription: Learn the function that runs the moment it is defined, why it mattered before modules, and where it is still useful today.
updateDate: 2026-09-05T09:27
author: ['bishal-biswas']
level: 2
tags: ['functions', 'patterns']
course: javascript
---

## What is an IIFE?

An IIFE, pronounced "iffy", is a function that runs the instant it is created.

```javascript
(function () {
  console.log('This runs immediately');
})();
```

Normally you define a function and call it later. Here you do both in one step, and the function has no name to call again.

## The syntax, piece by piece

```javascript
function () {
  console.log('hello');
}
```

That alone is a syntax error. JavaScript sees `function` at the start of a statement and expects a declaration, which needs a name.

Wrapping it in brackets turns it into an **expression**:

```javascript
(function () {
  console.log('hello');
});
```

Now it is valid, but nothing happens. Add `()` on the end to call it:

```javascript
(function () {
  console.log('hello');
})();
```

With an arrow function it is shorter:

```javascript
(() => {
  console.log('hello from an arrow IIFE');
})();
```

You may also see the closing bracket placed differently. Both work:

```javascript
(function () {
  console.log('style one');
})();
(function () {
  console.log('style two');
}());
```

## Why they existed

Before ES6, JavaScript had no modules and no block scope. Everything at the top level of a script became global.

```javascript
var count = 0;
var name = 'my script';
```

Load two scripts that both use `count` and they overwrite each other silently. An IIFE gave you a private box:

```javascript
(function () {
  var count = 0;
  var name = 'my script';
  console.log(name, count);
})();
console.log(typeof count);
```

Nothing leaks out. `count` is `undefined` outside.

## The module pattern

Combine an IIFE with a closure and you get private state with a public interface.

```javascript
const CartModule = (function () {
  let items = [];
  function calculateTotal() {
    return items.reduce((sum, item) => sum + item.price, 0);
  }
  return {
    add(item) {
      items.push(item);
      return this;
    },
    remove(name) {
      items = items.filter(item => item.name !== name);
      return this;
    },
    getTotal() {
      return calculateTotal();
    },
    getCount() {
      return items.length;
    }
  };
})();
CartModule.add({ name: 'Pen', price: 20 });
CartModule.add({ name: 'Book', price: 250 });
console.log(CartModule.getCount());
console.log(CartModule.getTotal());
console.log(CartModule.items);
```

`items` and `calculateTotal` are completely hidden. This pattern powered jQuery plugins and most libraries for years.

## Passing arguments

```javascript
(function (name, version) {
  console.log(`${name} version ${version}`);
})('MyApp', '1.0');
```

A common older trick passed in globals to make them local, which was slightly faster and protected against them being reassigned:

```javascript
(function (window, document, undefined) {
  console.log(typeof window, typeof document);
})(window, document);
```

## Solving the loop problem

Before `let`, an IIFE was the fix for the closure loop trap.

```javascript
for (var i = 1; i <= 3; i++) {
  (function (captured) {
    setTimeout(function () {
      console.log(captured);
    }, 100);
  })(i);
}
```

Each pass calls the IIFE with the current `i`, creating a separate `captured` variable. Today you just write `let i` and the problem disappears.

## Do you still need IIFEs?

Mostly no. ES modules give you file level scope automatically, and blocks with `let` and `const` give you block scope.

```javascript
{
  const secret = 'block scoped';
  console.log(secret);
}
console.log(typeof secret);
```

But three uses remain.

### Async work at the top level

In a plain script you cannot use `await` outside an `async` function.

```javascript
(async function () {
  const response = await fetch('/api/data');
  const data = await response.json();
  console.log(data);
})();
```

Inside an ES module, top level `await` works and you do not need this. In a classic script, you do.

### Bundled library output

Build tools wrap your code in an IIFE so it cannot pollute the page it lands on. If you look at a minified library file, you will usually see one at the top.

### Setting up a value with logic

```javascript
const config = (function () {
  const env = 'production';
  if (env === 'production') {
    return { apiUrl: 'https://api.example.com', debug: false };
  }
  return { apiUrl: 'http://localhost:3000', debug: true };
})();
console.log(config.apiUrl);
```

## Why learn it?

You will meet IIFEs constantly in existing code, in tutorials written before 2016, and in bundler output. Recognising the shape means you can read that code without hesitating.

## Quick recap

- An IIFE is a function expression that calls itself right away.
- The wrapping brackets turn the declaration into an expression.
- Before modules, IIFEs were how you avoided polluting the global scope.
- The module pattern pairs an IIFE with a closure for private state.
- Modules and `let` have replaced most uses.
- They are still handy for top level `await` in classic scripts and in bundler output.

<code id="code-content" class="language-javascript">
// The basic shape: brackets make it an expression, () calls it at once
(function () {
  console.log('This runs immediately');
})();
// Arrow version
(() =&gt; console.log('Arrow IIFE'))();
// Passing arguments in
(function (name, version) {
  console.log(name + ' version ' + version);
})('MyApp', '1.0');
// The module pattern: private state, public methods
const CartModule = (function () {
  let items = [];                                  // private
  function calculateTotal() {                      // private
    return items.reduce((sum, item) =&gt; sum + item.price, 0);
  }
  return {                                         // public interface
    add(item) { items.push(item); return this; },
    remove(name) {
      items = items.filter(i =&gt; i.name !== name);
      return this;
    },
    getTotal() { return calculateTotal(); },
    getCount() { return items.length; }
  };
})();
CartModule.add({ name: 'Pen', price: 20 }).add({ name: 'Book', price: 250 });
console.log(CartModule.getCount(), CartModule.getTotal()); // 2 270
console.log(CartModule.items);                             // undefined, hidden
// The old fix for the loop closure trap, before `let` existed
for (var i = 1; i &lt;= 3; i++) {
  (function (captured) {
    setTimeout(function () { console.log('captured:', captured); }, 10);
  })(i);
}
// Still useful today: top level await in a classic script
(async function () {
  // const response = await fetch('/api/data');
  // console.log(await response.json());
  console.log('async IIFE ran');
})();
// Building a value with a bit of logic
const config = (function () {
  const env = 'production';
  return env === 'production'
    ? { apiUrl: 'https://api.example.com', debug: false }
    : { apiUrl: 'http://localhost:3000', debug: true };
})();
console.log(config.apiUrl);
</code></pre>

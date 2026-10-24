---
publishDate: 2026-03-12T09:19
title: Arrow Functions
slug: arrow-functions
metadescription: Write shorter functions with arrow syntax, and learn the one real difference that decides when you should not use them.
updateDate: 2026-09-05T09:19
author: ['bishal-biswas']
level: 2
tags: ['functions', 'es6']
course: javascript
---

## A shorter way to write functions

ES6 introduced a compact syntax for functions.

```javascript
const addOld = function (a, b) {
  return a + b;
};
const addNew = (a, b) => {
  return a + b;
};
console.log(addOld(2, 3), addNew(2, 3));
```

Drop the `function` keyword, put `=>` after the parameters. That is the whole idea.

## Making it shorter still

### Implicit return

If the body is a single expression, drop the braces and the `return`.

```javascript
const add = (a, b) => a + b;
const double = (n) => n * 2;
console.log(add(2, 3), double(5));
```

The value of the expression is returned automatically.

### One parameter needs no brackets

```javascript
const double = n => n * 2;
```

Many teams still keep the brackets for consistency. Either style is fine, just be consistent.

### No parameters need empty brackets

```javascript
const sayHi = () => console.log('Hi');
sayHi();
```

### Returning an object needs extra brackets

```javascript
const makeUser = (name) => ({ name: name, active: true });
console.log(makeUser('Asha'));
```

Without the round brackets, JavaScript reads `{` as the start of a function body rather than an object. This catches everyone once.

## Where arrows shine

Callbacks passed to array methods become much easier to read.

```javascript
const numbers = [1, 2, 3, 4, 5];
const doubledOld = numbers.map(function (n) {
  return n * 2;
});
const doubled = numbers.map(n => n * 2);
const evens = numbers.filter(n => n % 2 === 0);
const total = numbers.reduce((sum, n) => sum + n, 0);
console.log(doubled, evens, total);
```

Chains read almost like a sentence:

```javascript
const result = numbers
  .filter(n => n % 2 === 0)
  .map(n => n * 10)
  .reduce((sum, n) => sum + n, 0);
console.log(result);
```

## The real difference: `this`

This is not just shorter syntax. Arrow functions handle `this` differently, and that is the whole reason they exist.

A regular function gets its own `this`, decided by how it is called. An arrow function has no `this` of its own, so it uses the one from the surrounding code.

```javascript
const timer = {
  seconds: 0,
  startOld: function () {
    setInterval(function () {
      this.seconds++;
      console.log(this.seconds);
    }, 1000);
  }
};
```

That fails. Inside `setInterval`, the regular function gets its own `this`, which is not `timer`, so `this.seconds` is `undefined`.

```javascript
const timer = {
  seconds: 0,
  start: function () {
    setInterval(() => {
      this.seconds++;
      console.log(this.seconds);
    }, 1000);
  }
};
timer.start();
```

The arrow function keeps `this` from `start`, which is `timer`. This pattern is why arrows took over for callbacks.

## When not to use an arrow

### Object methods

```javascript
const person = {
  name: 'Ravi',
  greetBad: () => `Hi, I am ${this.name}`,
  greetGood() {
    return `Hi, I am ${this.name}`;
  }
};
console.log(person.greetBad());
console.log(person.greetGood());
```

The arrow version fails, because it takes `this` from outside the object, where there is no `name`. Use the method shorthand for object methods.

### Constructor functions

```javascript
const Person = (name) => {
  this.name = name;
};
```

That throws `TypeError: Person is not a constructor`. Arrows cannot be used with `new`.

### When you need `arguments`

```javascript
function oldStyle() {
  console.log(arguments.length);
}
oldStyle(1, 2, 3);
```

Arrows have no `arguments` object. Use rest parameters instead, which are clearer anyway:

```javascript
const newStyle = (...args) => console.log(args.length);
newStyle(1, 2, 3);
```

### DOM event handlers that need `this`

```javascript
button.addEventListener('click', function () {
  this.classList.toggle('active');
});
button.addEventListener('click', (event) => {
  event.currentTarget.classList.toggle('active');
});
```

Both work. The arrow version just uses `event.currentTarget` instead of `this`.

## A simple rule

- **Use an arrow** for callbacks, array methods, and short one line functions.
- **Use a regular function** for object methods, constructors, and anywhere you need a `this` of your own.

## Quick recap

- `(a, b) => a + b` is a function with an automatic return.
- A single expression body needs no braces or `return`.
- Return an object literal by wrapping it in round brackets.
- Arrows take `this` from the surrounding code instead of getting their own.
- Do not use arrows for object methods, constructors, or when you need `arguments`.

<code id="code-content" class="language-javascript">
// Three ways to write the same function
const addLong = function (a, b) { return a + b; };
const addBlock = (a, b) =&gt; { return a + b; };
const addShort = (a, b) =&gt; a + b;
console.log(addLong(2, 3), addBlock(2, 3), addShort(2, 3));
// One parameter, no brackets needed
const double = n =&gt; n * 2;
console.log(double(5));
// Returning an object needs round brackets around it
const makeUser = name =&gt; ({ name: name, active: true });
console.log(makeUser('Asha'));
// Where arrows really pay off: array method chains
const numbers = [1, 2, 3, 4, 5, 6];
const result = numbers
  .filter(n =&gt; n % 2 === 0)
  .map(n =&gt; n * 10)
  .reduce((sum, n) =&gt; sum + n, 0);
console.log('Result:', result); // 120
// Arrows keep `this` from the surrounding code
const timer = {
  seconds: 0,
  start() {
    setInterval(() =&gt; {
      this.seconds++;               // `this` is still `timer`
      if (this.seconds &lt;= 3) console.log('Tick', this.seconds);
    }, 1000);
  }
};
timer.start();
// But do NOT use an arrow as an object method
const person = {
  name: 'Ravi',
  greetBad: () =&gt; 'Hi, I am ' + this.name,   // `this` is not person
  greetGood() { return 'Hi, I am ' + this.name; }
};
console.log(person.greetGood());
// Arrows have no `arguments`, use rest parameters instead
const count = (...args) =&gt; args.length;
console.log(count(1, 2, 3)); // 3
</code></pre>

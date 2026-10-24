---
publishDate: 2026-03-15T09:25
title: this Keyword and Context
slug: this-keyword-and-context
metadescription: Work out what this refers to in any situation, and fix the classic bug where a method loses its context.
updateDate: 2026-09-05T09:25
author: ['bishal-biswas']
level: 2
tags: ['functions', 'this', 'oop']
course: javascript
---

## The one rule

`this` is not decided by **where** a function is written. It is decided by **how** the function is called.

Learn that sentence and most of the confusion disappears.

## The four cases

### 1. Method call: `this` is the object before the dot

```javascript
const person = {
  name: 'Asha',
  greet() {
    return `Hi, I am ${this.name}`;
  }
};
console.log(person.greet());
```

Called as `person.greet()`, so `this` is `person`.

### 2. Plain function call: `this` is undefined or the global object

```javascript
function show() {
  console.log(this);
}
show();
```

In a module or in strict mode, `this` is `undefined`. In a plain script it is `window`. Either way, it is not useful.

### 3. Constructor call: `this` is the new object

```javascript
function User(name) {
  this.name = name;
}
const asha = new User('Asha');
console.log(asha.name);
```

### 4. Explicit call: you choose

```javascript
function greet() {
  return `Hi, I am ${this.name}`;
}
const user = { name: 'Ben' };
console.log(greet.call(user));
console.log(greet.apply(user));
const bound = greet.bind(user);
console.log(bound());
```

## The classic bug

```javascript
const timer = {
  seconds: 0,
  start() {
    setInterval(function () {
      this.seconds++;
      console.log(this.seconds);
    }, 1000);
  }
};
timer.start();
```

This prints `NaN` forever. The inner function is called by `setInterval`, not on `timer`, so `this` is not `timer`.

Same thing with event handlers:

```javascript
const counter = {
  count: 0,
  handleClick() {
    this.count++;
    console.log(this.count);
  }
};
button.addEventListener('click', counter.handleClick);
```

`counter.handleClick` is passed as a plain function. When the click happens it is called without the dot, so `this` becomes the button.

## Three ways to fix it

### Arrow function

An arrow has no `this` of its own, so it uses the surrounding one.

```javascript
const timer = {
  seconds: 0,
  start() {
    setInterval(() => {
      this.seconds++;
      console.log(this.seconds);
    }, 1000);
  }
};
timer.start();
```

This is the modern default.

### `bind`

```javascript
button.addEventListener('click', counter.handleClick.bind(counter));
```

`bind` returns a new function permanently locked to that `this`.

### Wrap in an arrow

```javascript
button.addEventListener('click', () => counter.handleClick());
```

The call still has the dot, so `this` is correct.

## `call`, `apply` and `bind`

All three set `this`. The difference is small.

```javascript
function introduce(city, job) {
  return `${this.name} from ${city} works as a ${job}`;
}
const person = { name: 'Ravi' };
console.log(introduce.call(person, 'Pune', 'developer'));
console.log(introduce.apply(person, ['Pune', 'developer']));
const bound = introduce.bind(person, 'Pune');
console.log(bound('designer'));
```

- `call` takes arguments one by one.
- `apply` takes them in an array.
- `bind` does not call, it returns a new function you call later.

> **Memory tip:** `call` is for **c**ommas, `apply` is for an **a**rray, `bind` **b**inds for later.

## In classes

Class methods have the same behaviour.

```javascript
class Counter {
  count = 0;
  increment() {
    this.count++;
    return this.count;
  }
  incrementArrow = () => {
    this.count++;
    return this.count;
  };
}
const c = new Counter();
const loose = c.increment;
const safe = c.incrementArrow;
console.log(safe());
```

`loose()` throws, because the method lost its object. `safe()` works, because an arrow class field captures `this` at construction time. This is why you see arrow fields in React class components.

## `this` in event handlers

```javascript
button.addEventListener('click', function () {
  console.log(this);
});
button.addEventListener('click', function () {
  console.log(this === event.currentTarget);
});
button.addEventListener('click', (event) => {
  console.log(event.currentTarget);
});
```

With a regular function, `this` is the element the listener is attached to. With an arrow, use `event.currentTarget` instead.

## Working it out

Ask these in order:

1. Was it called with `new`? Then `this` is the new object.
2. Was it called with `call`, `apply` or `bind`? Then `this` is what you passed.
3. Was it called as `something.method()`? Then `this` is `something`.
4. Is it an arrow function? Then `this` comes from the surrounding code.
5. Otherwise `this` is `undefined` in modules and strict mode.

## Quick recap

- `this` depends on how a function is called, not where it is written.
- Method call means the object before the dot.
- Passing a method as a callback loses that object.
- Arrow functions take `this` from the surrounding scope, which fixes callbacks.
- `call` and `apply` invoke immediately, `bind` returns a locked function.
- Arrow class fields keep `this` even when the method is detached.

<code id="code-content" class="language-javascript">
// 1. Method call: `this` is the object before the dot
const person = {
  name: 'Asha',
  greet() { return 'Hi, I am ' + this.name; }
};
console.log(person.greet());
// 2. Detached, so the object is lost
const detached = person.greet;
// console.log(detached());   // this.name is undefined
// 3. bind locks `this` permanently
const bound = person.greet.bind(person);
console.log(bound());
// call passes arguments with commas, apply passes an array
function introduce(city, job) {
  return this.name + ' from ' + city + ' works as a ' + job;
}
const ravi = { name: 'Ravi' };
console.log(introduce.call(ravi, 'Pune', 'developer'));
console.log(introduce.apply(ravi, ['Pune', 'developer']));
// The classic callback bug, and the arrow fix
const timer = {
  seconds: 0,
  startBroken() {
    setInterval(function () { this.seconds++; }, 1000);   // wrong `this`
  },
  start() {
    const id = setInterval(() =&gt; {                        // arrow keeps `this`
      this.seconds++;
      console.log('Tick', this.seconds);
      if (this.seconds &gt;= 3) clearInterval(id);
    }, 1000);
  }
};
timer.start();
// In classes, an arrow field survives being detached
class Counter {
  count = 0;
  increment() { this.count++; return this.count; }        // needs the dot
  incrementSafe = () =&gt; { this.count++; return this.count; };
}
const c = new Counter();
const safe = c.incrementSafe;
console.log(safe(), safe());   // 1 2, works even detached
</code></pre>

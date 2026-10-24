---
publishDate: 2026-03-14T09:23
title: Prototypes and Prototypal Inheritance
slug: prototypes-and-prototypal-inheritance
metadescription: Understand the chain JavaScript follows when it looks for a property, and how objects inherit from other objects.
updateDate: 2026-09-05T09:23
author: ['bishal-biswas']
level: 2
tags: ['objects', 'oop', 'prototypes']
course: javascript
---

## Where do built in methods come from?

```javascript
const name = 'ravi';
console.log(name.toUpperCase());
const list = [3, 1, 2];
console.log(list.sort());
```

You never wrote `toUpperCase` or `sort`. So where do they live?

Every object has a hidden link to another object, called its **prototype**. When you ask for a property that the object does not have, JavaScript follows that link and looks there instead.

## The prototype chain

```javascript
const dog = { name: 'Bruno' };
console.log(dog.name);
console.log(dog.toString());
console.log(dog.notThere);
```

`dog` has no `toString`, yet it works. The lookup goes:

1. Look on `dog` itself. Not found.
2. Follow the link to `Object.prototype`. Found `toString`. Use it.

For `notThere`, the search reaches the end of the chain and returns `undefined`.

```javascript
console.log(Object.getPrototypeOf(dog) === Object.prototype);
console.log(Object.getPrototypeOf(Object.prototype));
```

The chain always ends at `null`. That is the top.

For arrays there is one more link:

```javascript
const list = [1, 2, 3];
console.log(Object.getPrototypeOf(list) === Array.prototype);
console.log(Object.getPrototypeOf(Array.prototype) === Object.prototype);
```

So `list` finds `sort` on `Array.prototype`, and `toString` further up on `Object.prototype`.

## Setting a prototype yourself

`Object.create` makes a new object with the prototype you choose.

```javascript
const animal = {
  eats: true,
  describe() {
    return `${this.name} eats: ${this.eats}`;
  }
};
const rabbit = Object.create(animal);
rabbit.name = 'Rabbit';
console.log(rabbit.eats);
console.log(rabbit.describe());
console.log(Object.hasOwn(rabbit, 'eats'));
```

`rabbit` has only `name` of its own. `eats` and `describe` come from `animal` through the chain.

## Own properties versus inherited

```javascript
const rabbit = Object.create({ eats: true });
rabbit.name = 'Rabbit';
console.log(Object.hasOwn(rabbit, 'name'));
console.log(Object.hasOwn(rabbit, 'eats'));
console.log('eats' in rabbit);
console.log(Object.keys(rabbit));
```

- `Object.hasOwn` checks the object itself only.
- `in` searches the whole chain.
- `Object.keys` lists own properties only.

This distinction matters when you loop:

```javascript
const rabbit = Object.create({ eats: true });
rabbit.name = 'Rabbit';
for (const key in rabbit) {
  console.log(key);
}
```

`for...in` walks inherited properties too. That is another reason to prefer `Object.keys` or `for...of`.

## Writing does not go up the chain

Reading follows the prototype. Writing always lands on the object itself.

```javascript
const animal = { eats: true };
const rabbit = Object.create(animal);
console.log(rabbit.eats);
rabbit.eats = false;
console.log(rabbit.eats);
console.log(animal.eats);
```

`rabbit` now has its **own** `eats` that shadows the inherited one. The prototype is untouched.

## `prototype` versus `__proto__`

Two similar names that confuse everyone.

- `Constructor.prototype` is a property **on a function**. It is the object that instances made with `new` will link to.
- The internal link on an **instance** points to that object. You read it with `Object.getPrototypeOf(obj)`.

```javascript
function User(name) {
  this.name = name;
}
User.prototype.greet = function () {
  return `Hi, ${this.name}`;
};
const asha = new User('Asha');
console.log(Object.getPrototypeOf(asha) === User.prototype);
console.log(asha.greet());
```

You may see `asha.__proto__` in older code and tutorials. It does the same job but is deprecated. Use `Object.getPrototypeOf` and `Object.setPrototypeOf`.

## Building a chain by hand

```javascript
const animal = {
  init(name) {
    this.name = name;
    return this;
  },
  speak() {
    return `${this.name} makes a sound`;
  }
};
const dog = Object.create(animal);
dog.speak = function () {
  return `${this.name} barks`;
};
const bruno = Object.create(dog).init('Bruno');
console.log(bruno.speak());
console.log(Object.getPrototypeOf(Object.getPrototypeOf(bruno)) === animal);
```

`bruno` finds `speak` on `dog` first, so the dog version wins. It finds `init` further up on `animal`. This is inheritance without a single class keyword.

## Do not extend built in prototypes

```javascript
Array.prototype.last = function () {
  return this[this.length - 1];
};
console.log([1, 2, 3].last());
```

Tempting, but a bad idea. If two libraries add `last` with different behaviour, one silently breaks the other. If JavaScript itself later adds `last`, your version overrides the standard one. Write a normal function instead:

```javascript
function last(array) {
  return array[array.length - 1];
}
console.log(last([1, 2, 3]));
```

## Performance

Long chains cost a little on lookup, because JavaScript walks each link. In practice, engines optimise this heavily and it is almost never worth worrying about. Keep chains shallow because it is easier to understand, not because of speed.

## Quick recap

- Every object links to a prototype, and lookups travel up that chain.
- The chain ends at `Object.prototype`, then `null`.
- `Object.create(proto)` makes an object with the prototype you choose.
- Reading follows the chain, writing always creates an own property.
- `Constructor.prototype` is on the function, `Object.getPrototypeOf` reads the link on an instance.
- Use `Object.hasOwn` for own properties and `in` when inherited ones count.
- Never add properties to built in prototypes.

<code id="code-content" class="language-javascript">
// Every object links to a prototype, and lookups travel up the chain
const dog = { name: 'Bruno' };
console.log(dog.toString());                                 // found on Object.prototype
console.log(Object.getPrototypeOf(dog) === Object.prototype); // true
console.log(Object.getPrototypeOf(Object.prototype));         // null, the top
// Arrays have one extra link
const list = [1, 2, 3];
console.log(Object.getPrototypeOf(list) === Array.prototype); // true
// Object.create picks the prototype yourself
const animal = {
  eats: true,
  describe() { return this.name + ' eats: ' + this.eats; }
};
const rabbit = Object.create(animal);
rabbit.name = 'Rabbit';
console.log(rabbit.describe());              // Rabbit eats: true
console.log(Object.hasOwn(rabbit, 'eats'));  // false, it is inherited
console.log('eats' in rabbit);               // true, `in` searches the chain
console.log(Object.keys(rabbit));            // ['name'], own properties only
// Reading follows the chain, writing lands on the object itself
rabbit.eats = false;
console.log(rabbit.eats, animal.eats);       // false true, the parent is untouched
// Constructor.prototype vs the link on an instance
function User(name) { this.name = name; }
User.prototype.greet = function () { return 'Hi, ' + this.name; };
const asha = new User('Asha');
console.log(Object.getPrototypeOf(asha) === User.prototype); // true
console.log(asha.greet());
// A chain built by hand: dog overrides speak, init comes from animal
const base = {
  init(name) { this.name = name; return this; },
  speak() { return this.name + ' makes a sound'; }
};
const dogProto = Object.create(base);
dogProto.speak = function () { return this.name + ' barks'; };
const bruno = Object.create(dogProto).init('Bruno');
console.log(bruno.speak());                  // Bruno barks
// Do NOT do this: extending built in prototypes breaks other code
// Array.prototype.last = function () { return this[this.length - 1]; };
function last(array) { return array[array.length - 1]; }
console.log(last([1, 2, 3]));                // 3
</code></pre>

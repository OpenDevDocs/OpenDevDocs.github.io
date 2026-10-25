---
course: javascript
slug: prototype-chain
experienceLevel: mid
difficulty: medium
tags:
  - prototypes
  - inheritance
  - objects
question: What is the prototype chain and how does property lookup work?
answer: |
  The prototype chain is how JavaScript implements inheritance: every object has an internal `[[Prototype]]` link to another object (or `null`), and when you read a property the object does not have itself, the engine follows those links until it finds the property or reaches `null` and returns `undefined`.

  How it fits together:

  - `Object.getPrototypeOf(obj)` reads the link and `Object.create(proto)` creates an object with a chosen prototype. `__proto__` is a legacy accessor; avoid it in new code.
  - Functions have a `prototype` property. `new Fn()` creates an object whose `[[Prototype]]` is `Fn.prototype`. Classes work the same way: methods live on `Class.prototype` and are shared by all instances.
  - A typical chain is `rex -> Dog.prototype -> Animal.prototype -> Object.prototype -> null`.
  - `instanceof` checks whether `Fn.prototype` appears anywhere in the object's chain.

  Reads and writes behave differently:

  - **Reads** walk the chain.
  - **Writes** create or update an **own** property on the object, shadowing the inherited one, unless the inherited property is a setter or is non-writable.
  - `Object.hasOwn(obj, key)` checks own properties only, while `key in obj` checks the whole chain. `for...in` also visits enumerable inherited keys; `Object.keys` returns own keys only.

  Pitfalls:

  - Mutable data placed on a prototype, such as an array, is shared by every instance.
  - Extending built-in prototypes (`Array.prototype.myHelper`) can clash with future standard methods.
  - Changing an existing object's prototype with `Object.setPrototypeOf` makes engines deoptimise property access.
  - `Object.create(null)` gives an object with no prototype at all. It is a safe dictionary, but it has no `toString` or `hasOwnProperty`.

  Engines cache lookups aggressively, so the chain's length rarely matters for performance in normal code.
codeExample: |
  const animal = {
    speak() { return `${this.name} makes a sound`; },
  };

  const dog = Object.create(animal);
  dog.name = 'Rex';
  console.log(dog.speak());                             // Output: Rex makes a sound
  console.log(Object.getPrototypeOf(dog) === animal);   // Output: true
  console.log(Object.hasOwn(dog, 'speak'), 'speak' in dog); // Output: false true

  dog.speak = () => 'Woof';                             // own property shadows the prototype
  console.log(dog.speak(), '|', animal.speak.call(dog)); // Output: Woof | Rex makes a sound

  class Animal { eat() { return 'eating'; } }
  class Dog extends Animal { bark() { return 'woof'; } }
  const rex = new Dog();

  const chain = [];
  for (let p = Object.getPrototypeOf(rex); p; p = Object.getPrototypeOf(p)) {
    chain.push(p.constructor.name);
  }
  console.log(chain.join(' -> '));    // Output: Dog -> Animal -> Object
  console.log(rex instanceof Animal, rex.eat()); // Output: true eating
popularity: 9.0
isPublished: true
---

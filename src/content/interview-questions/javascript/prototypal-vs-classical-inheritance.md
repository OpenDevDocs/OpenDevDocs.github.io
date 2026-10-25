---
course: javascript
slug: prototypal-vs-classical-inheritance
experienceLevel: mid
difficulty: medium
tags:
  - inheritance
  - prototypes
  - classes
question: How does prototypal inheritance differ from classical inheritance?
answer: |
  In classical inheritance (Java, C#), classes are fixed blueprints and objects are instances of a static class hierarchy; in JavaScript's prototypal inheritance, objects inherit directly from other **objects** through a live prototype link, and `class` syntax is built on top of that mechanism.

  Differences that matter in practice:

  - **Delegation, not copying.** An instance does not get its own copy of the methods. Each method call is looked up at runtime along the prototype chain, so a method added to `Animal.prototype` later is immediately available to every existing instance.
  - **Classes are functions.** `typeof class {}` is `'function'`, methods are placed on `Class.prototype`, and `extends` creates two links: `Child.prototype -> Parent.prototype` for instance methods and `Child -> Parent` for static methods.
  - **Objects can inherit from any object.** `Object.create(proto)` needs no class at all.
  - **Single chain only.** There is no multiple inheritance, but behaviour can be mixed in with `Object.assign` (mixins) or composition.

  What `class` adds beyond the older constructor-function pattern: calling without `new` throws, the body is strict mode, methods are non-enumerable, plus `super`, private `#fields`, static blocks and a temporal dead zone for the class name. It is often called syntactic sugar, but some of these behaviours are hard to reproduce by hand.

  What `new Fn()` does, a common follow-up:

  1. Create an object whose prototype is `Fn.prototype`.
  2. Run `Fn` with `this` bound to that object.
  3. Return it, unless the constructor explicitly returns a different object.

  Practical guidance: use `class` syntax for types with shared behaviour, since it is the idiomatic modern style. Keep hierarchies shallow; deep `extends` chains are as brittle in JavaScript as anywhere else. When behaviours vary independently, prefer composition (objects holding other objects or functions) over inheritance.
codeExample: |
  // Constructor-function style: what classes do under the hood
  function Animal(name) { this.name = name; }
  Animal.prototype.speak = function () { return `${this.name} makes a sound`; };

  function Dog(name) { Animal.call(this, name); }
  Object.setPrototypeOf(Dog.prototype, Animal.prototype);
  Dog.prototype.speak = function () { return `${this.name} barks`; };

  // Class style, extending the same constructor function
  class Cat extends Animal {
    speak() { return `${super.speak()} (meow)`; }
  }

  const d = new Dog('Rex');
  const c = new Cat('Tom');
  console.log(d.speak(), '|', c.speak()); // Output: Rex barks | Tom makes a sound (meow)
  console.log(typeof Cat, c instanceof Animal, d instanceof Animal); // Output: function true true

  // Delegation is live: add a method after the instances exist
  Animal.prototype.sleep = function () { return `${this.name} sleeps`; };
  console.log(d.sleep(), '|', c.sleep()); // Output: Rex sleeps | Tom sleeps

  // Object-to-object inheritance with no class at all
  const base = { greet() { return `hi from ${this.id}`; } };
  const child = Object.create(base, { id: { value: 'child' } });
  console.log(child.greet()); // Output: hi from child
popularity: 7.6
isPublished: true
---

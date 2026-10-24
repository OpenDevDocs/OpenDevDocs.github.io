---
publishDate: 2026-03-15T09:24
title: ES6 Classes
slug: es6-classes
metadescription: Write object blueprints with clean class syntax. Constructors, methods, getters, static members, private fields and inheritance.
updateDate: 2026-09-05T09:24
author: ['bishal-biswas']
level: 2
tags: ['oop', 'classes', 'es6']
course: javascript
---

## The same idea, better syntax

ES6 classes do exactly what constructor functions and prototypes do. They just read much better.

```javascript
class User {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  greet() {
    return `Hi, I am ${this.name}`;
  }
}
const asha = new User('Asha', 28);
console.log(asha.greet());
```

Compare that to the prototype version from the previous topics. Same behaviour, far less noise.

```javascript
console.log(typeof User);
console.log(Object.getPrototypeOf(asha) === User.prototype);
```

`typeof User` is `'function'`, because a class really is a function underneath. Methods land on `User.prototype` automatically, so they are shared, not copied.

## The `constructor`

Runs automatically when you use `new`. It is where you set up the instance.

```javascript
class Product {
  constructor(name, price) {
    if (price < 0) {
      throw new RangeError('Price cannot be negative');
    }
    this.name = name;
    this.price = price;
    this.createdAt = new Date();
  }
}
const pen = new Product('Pen', 20);
console.log(pen.name, pen.price);
```

A class without a constructor gets an empty one for free.

## Class fields

You can declare properties directly, outside the constructor.

```javascript
class Counter {
  count = 0;
  step = 1;
  increment() {
    this.count += this.step;
    return this.count;
  }
}
const c = new Counter();
console.log(c.increment(), c.increment());
```

## Private fields

A `#` prefix makes a field truly private. Nothing outside the class can touch it.

```javascript
class BankAccount {
  #balance = 0;
  constructor(owner) {
    this.owner = owner;
  }
  deposit(amount) {
    if (amount <= 0) {
      throw new RangeError('Deposit must be positive');
    }
    this.#balance += amount;
    return this.#balance;
  }
  getBalance() {
    return this.#balance;
  }
}
const account = new BankAccount('Asha');
account.deposit(1000);
console.log(account.getBalance());
console.log(account.balance);
```

Trying `account.#balance` from outside is a syntax error, not just a convention. Before this existed, people used a leading underscore like `_balance`, which was only a polite request.

## Getters and setters

These let a method look like a plain property.

```javascript
class Temperature {
  #celsius = 0;
  get celsius() {
    return this.#celsius;
  }
  set celsius(value) {
    if (typeof value !== 'number') {
      throw new TypeError('Temperature must be a number');
    }
    this.#celsius = value;
  }
  get fahrenheit() {
    return this.#celsius * 9 / 5 + 32;
  }
}
const temp = new Temperature();
temp.celsius = 25;
console.log(temp.celsius);
console.log(temp.fahrenheit);
```

Notice there are no brackets when you use them. `temp.fahrenheit` is calculated on the spot, but reads like stored data.

## Static members

`static` puts something on the class itself rather than on instances.

```javascript
class MathHelper {
  static PI = 3.14159;
  static square(n) {
    return n * n;
  }
  static circleArea(radius) {
    return MathHelper.PI * MathHelper.square(radius);
  }
}
console.log(MathHelper.square(5));
console.log(MathHelper.circleArea(3));
```

A common use is an alternative way to build an instance:

```javascript
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
  static fromJSON(json) {
    const data = JSON.parse(json);
    return new User(data.name, data.email);
  }
}
const user = User.fromJSON('{"name":"Ben","email":"ben@example.com"}');
console.log(user.name);
```

## Inheritance with `extends`

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} makes a sound`;
  }
  describe() {
    return `This is ${this.name}`;
  }
}
class Dog extends Animal {
  constructor(name, breed) {
    super(name);
    this.breed = breed;
  }
  speak() {
    return `${this.name} barks`;
  }
  fetch() {
    return `${this.name} fetches the ball`;
  }
}
const bruno = new Dog('Bruno', 'Labrador');
console.log(bruno.speak());
console.log(bruno.describe());
console.log(bruno.fetch());
console.log(bruno instanceof Animal);
```

Compare this to the `Object.create` and `constructor` repair dance from the prototypes topic. One keyword replaces all of it.

### `super` is required

```javascript
class Dog extends Animal {
  constructor(name, breed) {
    this.breed = breed;
    super(name);
  }
}
```

That throws. In a subclass you **must** call `super()` before touching `this`, because the parent constructor is what creates the object.

### Calling the parent method

```javascript
class Cat extends Animal {
  speak() {
    return super.speak() + ', specifically a meow';
  }
}
console.log(new Cat('Mia').speak());
```

## Extending built ins

```javascript
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
try {
  throw new ValidationError('Email is required', 'email');
} catch (error) {
  console.log(error.name, error.field, error instanceof Error);
}
```

This is the pattern from the error handling topic, and it is the most common real use of `extends`.

## Classes are not hoisted

```javascript
const u = new User('Asha');
class User {
  constructor(name) {
    this.name = name;
  }
}
```

That throws `ReferenceError`. Unlike function declarations, classes sit in the temporal dead zone. Define them before you use them.

## Prefer composition over deep inheritance

Long chains like `Vehicle -> Car -> SportsCar -> ElectricSportsCar` get rigid fast. A change near the top ripples everywhere. Often it is better to give an object the pieces it needs:

```javascript
class Engine {
  start() {
    return 'Engine started';
  }
}
class Car {
  constructor() {
    this.engine = new Engine();
  }
  start() {
    return this.engine.start();
  }
}
console.log(new Car().start());
```

Use inheritance when there is a genuine "is a" relationship. Use composition when it is "has a".

## Quick recap

- `class` is cleaner syntax over constructor functions and prototypes.
- The `constructor` runs on `new` and sets up the instance.
- `#field` is genuinely private, unlike the old underscore convention.
- Getters and setters make methods look like properties.
- `static` belongs to the class, not to instances.
- `extends` plus `super()` handles inheritance, and `super()` must come first.
- Classes are not hoisted, so declare them before use.
- Prefer composition over deep inheritance chains.

<code id="code-content" class="language-javascript">
class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name + ' makes a sound'; }
}
class Dog extends Animal {
  #tricks = [];                       // truly private field
  constructor(name, breed) {
    super(name);                      // must come before using `this`
    this.breed = breed;
  }
  speak() { return this.name + ' barks'; }
  learn(trick) {
    this.#tricks.push(trick);
    return this;                      // return this to allow chaining
  }
  get tricks() { return [...this.#tricks]; }   // getter, used without ()
  static create(name) { return new Dog(name, 'Unknown'); }
}
const bruno = new Dog('Bruno', 'Labrador');
console.log(bruno.speak());           // Bruno barks
console.log(bruno instanceof Animal); // true
bruno.learn('sit').learn('roll over');
console.log(bruno.tricks);            // ['sit', 'roll over']
console.log(bruno.breed);
// Private fields cannot be reached from outside
console.log(bruno.tricks.length);     // 2 via the getter
// Static members belong to the class itself
const stray = Dog.create('Rocky');
console.log(stray.name, stray.breed);
// Getters and setters that validate
class Temperature {
  #celsius = 0;
  get celsius() { return this.#celsius; }
  set celsius(value) {
    if (typeof value !== 'number') throw new TypeError('Must be a number');
    this.#celsius = value;
  }
  get fahrenheit() { return this.#celsius * 9 / 5 + 32; }
}
const temp = new Temperature();
temp.celsius = 25;
console.log(temp.celsius, temp.fahrenheit);  // 25 77
// Extending Error is the most common real use of extends
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
try {
  throw new ValidationError('Email is required', 'email');
} catch (e) {
  console.log(e.name, '|', e.field, '|', e instanceof Error);
}
</code></pre>

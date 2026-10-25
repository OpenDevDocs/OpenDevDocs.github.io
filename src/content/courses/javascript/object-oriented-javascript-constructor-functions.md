---
publishDate: 2026-03-13T09:22
title: Object-oriented JavaScript - Constructor Functions
slug: object-oriented-javascript-constructor-functions
metadescription: Build many similar objects from one blueprint using constructor functions and the new keyword, the foundation under ES6 classes.
updateDate: 2026-09-05T09:22
author: ['bishal-biswas']
level: 2
tags: ['objects', 'oop']
course: javascript
---

## The problem

Say you need three users. Writing them out by hand repeats everything:

```javascript
const user1 = {
  name: 'Asha',
  age: 28,
  greet() { return `Hi, I am ${this.name}`; }
};
const user2 = {
  name: 'Ben',
  age: 35,
  greet() { return `Hi, I am ${this.name}`; }
};
```

Change the greeting and you have to change it everywhere. You need a blueprint.

## A factory function

The simplest fix is a function that builds and returns an object.

```javascript
function createUser(name, age) {
  return {
    name: name,
    age: age,
    greet() {
      return `Hi, I am ${this.name}`;
    }
  };
}
const asha = createUser('Asha', 28);
const ben = createUser('Ben', 35);
console.log(asha.greet(), ben.greet());
```

This works well and is still a good pattern. One drawback: every object gets its own copy of `greet`, which wastes memory when you have thousands.

## Constructor functions

A constructor is a normal function used with `new`.

```javascript
function User(name, age) {
  this.name = name;
  this.age = age;
}
const asha = new User('Asha', 28);
console.log(asha.name, asha.age);
```

By convention, constructor names start with a **capital letter**. This is not enforced by the language, but every JavaScript developer expects it.

### What `new` actually does

Four steps, in order:

1. Creates a fresh empty object.
2. Sets `this` inside the function to that object.
3. Links the object to `User.prototype`.
4. Returns the object automatically.

```javascript
function User(name) {
  this.name = name;
}
const withNew = new User('Asha');
const withoutNew = User('Ben');
console.log(withNew);
console.log(withoutNew);
```

Forgetting `new` gives you `undefined`, because the function has no `return`. In older non strict code it would also quietly add `name` to the global object, which is worse.

## Adding methods the right way

Putting a method inside the constructor copies it into every instance:

```javascript
function User(name) {
  this.name = name;
  this.greet = function () {
    return `Hi, I am ${this.name}`;
  };
}
const a = new User('Asha');
const b = new User('Ben');
console.log(a.greet === b.greet);
```

That prints `false`. Two objects, two copies of the same function.

Put it on the **prototype** instead:

```javascript
function User(name) {
  this.name = name;
}
User.prototype.greet = function () {
  return `Hi, I am ${this.name}`;
};
const a = new User('Asha');
const b = new User('Ben');
console.log(a.greet === b.greet);
console.log(a.greet());
```

Now it prints `true`. One function, shared by every instance. The next topic covers prototypes in detail.

## A fuller example

```javascript
function BankAccount(owner, balance = 0) {
  this.owner = owner;
  this.balance = balance;
  this.transactions = [];
}
BankAccount.prototype.deposit = function (amount) {
  if (amount <= 0) {
    throw new RangeError('Deposit must be positive');
  }
  this.balance += amount;
  this.transactions.push({ type: 'deposit', amount });
  return this.balance;
};
BankAccount.prototype.withdraw = function (amount) {
  if (amount > this.balance) {
    throw new Error('Insufficient funds');
  }
  this.balance -= amount;
  this.transactions.push({ type: 'withdraw', amount });
  return this.balance;
};
BankAccount.prototype.getStatement = function () {
  return `${this.owner}: Rs ${this.balance} (${this.transactions.length} transactions)`;
};
const account = new BankAccount('Asha', 1000);
account.deposit(500);
account.withdraw(200);
console.log(account.getStatement());
```

## Checking types

```javascript
const account = new BankAccount('Asha');
console.log(account instanceof BankAccount);
console.log(account.constructor === BankAccount);
console.log(typeof account);
```

`typeof` only ever says `'object'`, so `instanceof` is the useful test.

## Inheritance the old way

Before ES6 classes, sharing behaviour looked like this:

```javascript
function Animal(name) {
  this.name = name;
}
Animal.prototype.speak = function () {
  return `${this.name} makes a sound`;
};
function Dog(name, breed) {
  Animal.call(this, name);
  this.breed = breed;
}
Dog.prototype = Object.create(Animal.prototype);
Dog.prototype.constructor = Dog;
Dog.prototype.speak = function () {
  return `${this.name} barks`;
};
const dog = new Dog('Bruno', 'Labrador');
console.log(dog.speak());
console.log(dog instanceof Animal);
```

Three fiddly lines just to set up the link, and it is easy to forget the `constructor` fix. ES6 classes replaced all of this with `extends`, and you will see that shortly.

## Why learn this at all?

Classes are simply nicer syntax over exactly this machinery. Understanding constructors and prototypes means:

- You can read the mountain of existing code written this way.
- Prototype behaviour stops being mysterious.
- You know what `class` is actually doing underneath.

## Quick recap

- A factory function returns an object, which is simple and works well.
- A constructor is a capitalised function used with `new`.
- `new` creates an object, binds `this`, links the prototype, and returns it.
- Forgetting `new` gives `undefined`.
- Put methods on `Constructor.prototype` so instances share one copy.
- `instanceof` checks the type, since `typeof` always says `'object'`.
- ES6 classes are friendlier syntax over this same mechanism.

<code id="code-content" class="language-javascript">
// A constructor function: capitalised, used with `new`
function BankAccount(owner, balance = 0) {
  this.owner = owner;
  this.balance = balance;
  this.transactions = [];
}
// Methods go on the prototype so every instance shares one copy
BankAccount.prototype.deposit = function (amount) {
  if (amount &lt;= 0) throw new RangeError('Deposit must be positive');
  this.balance += amount;
  this.transactions.push({ type: 'deposit', amount: amount });
  return this.balance;
};
BankAccount.prototype.withdraw = function (amount) {
  if (amount &gt; this.balance) throw new Error('Insufficient funds');
  this.balance -= amount;
  this.transactions.push({ type: 'withdraw', amount: amount });
  return this.balance;
};
BankAccount.prototype.getStatement = function () {
  return this.owner + ': Rs ' + this.balance +
    ' (' + this.transactions.length + ' transactions)';
};
const account = new BankAccount('Asha', 1000);
account.deposit(500);
account.withdraw(200);
console.log(account.getStatement()); // Asha: Rs 1300 (2 transactions)
// Prototype methods are shared, not copied
const second = new BankAccount('Ben');
console.log(account.deposit === second.deposit); // true
// Checking the type
console.log(account instanceof BankAccount);     // true
console.log(typeof account);                     // 'object', not helpful
// Forgetting `new` returns undefined
const broken = BankAccount('Chitra');
console.log(broken);                             // undefined
// Inheritance before ES6 classes
function Animal(name) { this.name = name; }
Animal.prototype.speak = function () { return this.name + ' makes a sound'; };
function Dog(name, breed) {
  Animal.call(this, name);          // run the parent constructor
  this.breed = breed;
}
Dog.prototype = Object.create(Animal.prototype);  // link the prototypes
Dog.prototype.constructor = Dog;                  // repair the constructor
Dog.prototype.speak = function () { return this.name + ' barks'; };
const dog = new Dog('Bruno', 'Labrador');
console.log(dog.speak(), dog instanceof Animal);  // Bruno barks true
</code></pre>

---
course: javascript
slug: classes-in-javascript
experienceLevel: fresher
difficulty: medium
tags:
  - classes
  - oop
question: How do classes work in JavaScript?
answer: |
  A class is a template for creating objects with shared methods; in JavaScript it is cleaner syntax over the language's prototype-based inheritance, not a separate object model.

  The main parts:

  - **`constructor`** runs when you call `new ClassName(...)` and sets up the instance.
  - **Methods** declared in the class body are stored once on the prototype and shared by every instance.
  - **Fields** such as `count = 0;` are created on each instance.
  - **Private members** start with `#`, as in `#balance`. They are truly private: accessing them from outside is a `SyntaxError`, not just a convention.
  - **`static`** members belong to the class itself, as in `User.fromJSON(...)`, not to instances.
  - **Getters and setters** (`get total()`) look like properties but run code.
  - **Inheritance** uses `extends`. In a subclass constructor you must call `super(...)` before using `this`, and `super.method()` calls the parent's version.

  Things that differ from functions and from other languages:

  - Classes must be called with `new`; calling `User()` directly throws a `TypeError`.
  - Class declarations are hoisted but stay in the temporal dead zone, so you cannot use a class before its declaration.
  - Class bodies always run in strict mode.
  - `typeof SomeClass` is `"function"`, and `instance instanceof SomeClass` checks the prototype chain.
  - Methods are not automatically bound. Passing `obj.method` as a callback loses `this`; use an arrow function field or `bind` if needed.

  Classes are a good fit for objects that combine state and behaviour, like a shopping cart or an API client. For simple data, a plain object is often enough, and many codebases prefer composition over deep inheritance chains.
codeExample: |
  class Account {
    #balance = 0; // private field
    static count = 0; // shared by the class
    constructor(owner) {
      this.owner = owner;
      Account.count++;
    }

    deposit(amount) {
      this.#balance += amount;
      return this; // allows chaining
    }
    get balance() {
      return this.#balance;
    }
  }

  class SavingsAccount extends Account {
    constructor(owner, rate) {
      super(owner); // must come before using this
      this.rate = rate;
    }
    addInterest() {
      return this.deposit(this.balance * this.rate);
    }
  }

  const acc = new SavingsAccount("Ada", 0.1).deposit(100).addInterest();
  console.log(acc.owner, acc.balance, Account.count); // Output: Ada 110 1
  console.log(acc instanceof Account, typeof Account); // Output: true function
popularity: 8.7
isPublished: true
---

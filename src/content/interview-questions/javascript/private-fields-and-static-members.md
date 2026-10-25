---
course: javascript
slug: private-fields-and-static-members
experienceLevel: mid
difficulty: medium
tags:
  - classes
  - encapsulation
question: How do private fields and static members work in JavaScript classes?
answer: |
  Private fields (`#name`) are class members that only code inside the class body can access, enforced by the language itself; static members belong to the class constructor rather than to each instance.

  Private members:

  - Declare them in the class body: `#balance = 0;`, `#validate() {}`, `get #secret() {}`. Referring to an undeclared `#x` is a **SyntaxError**.
  - They are truly private. `obj['#balance']` is just an unrelated string key, and the fields do not appear in `Object.keys`, `JSON.stringify` or spread. This differs from the `_underscore` convention and from TypeScript's `private`, which is only checked at compile time.
  - Privacy is per class, not per instance: a method can read `other.#balance` on another instance of the same class.
  - `#balance in obj` checks whether an object has the field without throwing (a "brand check").
  - Reading `#x` on an object that lacks it throws a `TypeError`. This bites when methods are called on a `Proxy` or on a plain copy of an instance.
  - Subclasses cannot access their parent's private fields.

  Static members:

  - `static currency = 'USD'` and `static create() {}` live on the class: `Account.currency`, `Account.create()`.
  - Inside a static method, `this` is the class it was called on, so `this.create()` works with subclasses too.
  - Subclasses inherit static members through the constructor's own prototype chain.
  - `static { ... }` blocks run once when the class is defined, for more complex setup.
  - `static #registry = new Map()` combines both: private class-level state.

  Common uses are factory methods (`User.fromJSON`), counters and caches, constants, and protecting invariants by hiding state behind validating methods.

  Pitfall: `structuredClone`, spread and `Object.assign` do not copy private fields, so a "cloned" instance is just a plain object without them.
codeExample: |
  class BankAccount {
    static #count = 0;
    static currency = 'USD';
    #balance = 0;

    constructor(owner) {
      this.owner = owner;
      BankAccount.#count += 1;
    }

    deposit(amount) {
      if (amount <= 0) throw new RangeError('amount must be positive');
      this.#balance += amount;
      return this;
    }

    get balance() { return this.#balance; }
    static get count() { return BankAccount.#count; }
    static isAccount(obj) { return #balance in obj; }
  }

  const acc = new BankAccount('Ada').deposit(50).deposit(25);
  new BankAccount('Bob');

  console.log(acc.balance, BankAccount.currency);    // Output: 75 USD
  console.log(BankAccount.count);                     // Output: 2
  console.log(BankAccount.isAccount(acc), BankAccount.isAccount({ ...acc })); // Output: true false
  console.log(Object.keys(acc), JSON.stringify(acc)); // Output: [ 'owner' ] {"owner":"Ada"}
  console.log(acc['#balance']);                       // Output: undefined
  // acc.#balance; // SyntaxError: Private field '#balance' must be declared in an enclosing class
popularity: 7.8
isPublished: true
---

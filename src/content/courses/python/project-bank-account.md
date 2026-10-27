---
publishDate: 2026-10-27T08:56
title: 'Project: Bank Account System'
slug: project-bank-account
metadescription: 'Build a small bank account system in Python using classes, inheritance, properties, data classes and custom exceptions, one step at a time.'
updateDate: 2026-10-27T08:56
author: ['bishal-biswas']
level: 2
tags: ['python', 'oop', 'project']
course: python
---

## What you will build

In this project you will build a tiny bank. It will not move real money, but it will behave like a real system:

- Customers can open an **account**, deposit money and withdraw money.
- You cannot withdraw more than you have.
- Every deposit and withdrawal is saved in a **history**.
- A **savings account** works like a normal account but can also earn interest.
- A **bank** object keeps all accounts and can transfer money between them.

This project pulls together the whole object-oriented section: [Classes and Objects](/courses/python/classes-and-objects), [Inheritance and super()](/courses/python/inheritance), [Special (Dunder) Methods](/courses/python/dunder-methods), [Properties and Encapsulation](/courses/python/properties-and-encapsulation), [Data Classes](/courses/python/dataclasses) and [Raising Errors and Custom Exceptions](/courses/python/raising-and-custom-exceptions).

Create a new folder for the project with a single file called `bank.py`. You will add to it step by step. The full program is in the `main.py` panel at the end.

## Step 1: plan the pieces

Before writing code, think about the "things" in the problem. Each thing usually becomes a class.

| Thing | Kind of class | Job |
| --- | --- | --- |
| `Transaction` | Data class | Remember one deposit or withdrawal |
| `Account` | Normal class | Hold a balance and change it safely |
| `SavingsAccount` | Child class of `Account` | Same as `Account`, plus interest |
| `Bank` | Normal class | Store accounts and transfer money |
| `BankError` and friends | Exception classes | Describe what went wrong |

> **Tip:** A simple rule: nouns in the problem ("account", "bank", "transaction") become classes, and verbs ("deposit", "withdraw", "transfer") become methods.

## Step 2: custom exceptions

Start with the errors. Making your own exception classes lets the code that uses your bank catch **bank problems** separately from other bugs.

```python
class BankError(Exception):
    """Base class for all bank problems."""


class InsufficientFundsError(BankError):
    """Raised when a withdrawal is bigger than the balance."""


class AccountNotFoundError(BankError):
    """Raised when an account number does not exist."""
```

Because both errors inherit from `BankError`, one `except BankError:` catches either of them.

## Step 3: a Transaction data class

Each history entry only stores data, so a [data class](/courses/python/dataclasses) is perfect. It is `frozen=True` because history should never be edited later.

```python
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class Transaction:
    kind: str
    amount: float
    balance_after: float
    when: datetime = field(default_factory=datetime.now)
```

`default_factory=datetime.now` means "call `datetime.now()` each time a transaction is created", so every entry gets its own timestamp. You will learn more about dates in [Working with Dates and Times](/courses/python/dates-and-times).

## Step 4: the Account class

Now the heart of the system. The balance is stored in `self._balance`. The underscore is a polite sign meaning "internal, do not touch". A read-only **property** called `balance` lets other code look at the balance but not change it directly. The only way to change it is through `deposit()` and `withdraw()`, which check the rules first.

```python
class Account:
    def __init__(self, number, owner, balance=0.0):
        self.number = number
        self.owner = owner
        self._balance = 0.0
        self.history = []
        if balance:
            self.deposit(balance)

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Deposit must be positive")
        self._balance += amount
        self.history.append(Transaction("deposit", amount, self._balance))

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("Withdrawal must be positive")
        if amount > self._balance:
            raise InsufficientFundsError(
                f"Cannot withdraw {amount:.2f}, balance is {self._balance:.2f}"
            )
        self._balance -= amount
        self.history.append(Transaction("withdraw", amount, self._balance))

    def __repr__(self):
        return f"{type(self).__name__}({self.number!r}, {self.owner!r}, balance={self._balance:.2f})"
```

Notice that the starting balance goes through `deposit()` too. That way it is checked and recorded in the history like any other deposit. `type(self).__name__` prints the real class name, which will matter once you add `SavingsAccount`.

Try it:

```python
acc = Account("AC1", "Ana", 100)
acc.deposit(50)
acc.withdraw(30)
print(acc)
print(acc.balance)
try:
    acc.withdraw(500)
except InsufficientFundsError as e:
    print("Error:", e)
```

Output:

```text
Account('AC1', 'Ana', balance=120.00)
120.0
Error: Cannot withdraw 500.00, balance is 120.00
```

Now check the history, and try to cheat by setting the balance directly:

```python
acc = Account("AC1", "Ana", 100)
acc.withdraw(30)
for t in acc.history:
    print(t.kind, t.amount, t.balance_after)
acc.balance = 1_000_000
```

Output:

```text
deposit 100 100.0
withdraw 30 70.0
Traceback (most recent call last):
  ...
AttributeError: property 'balance' of 'Account' object has no setter
```

The property did its job: nobody can give themselves a million by accident.

## Step 5: a SavingsAccount with interest

A savings account **is an** account, so it [inherits](/courses/python/inheritance) from `Account`. It calls `super().__init__()` to reuse the parent setup, then adds a `rate`.

```python
class SavingsAccount(Account):
    def __init__(self, number, owner, balance=0.0, rate=0.02):
        super().__init__(number, owner, balance)
        self.rate = rate

    def add_interest(self):
        interest = round(self._balance * self.rate, 2)
        if interest > 0:
            self.deposit(interest)
        return interest
```

```python
s = SavingsAccount("AC2", "Ben", 1000, rate=0.05)
print(s.add_interest())
print(s)
print(isinstance(s, SavingsAccount), len(s.history))
```

Output:

```text
50.0
SavingsAccount('AC2', 'Ben', balance=1050.00)
True 2
```

The interest went through `deposit()`, so it was recorded in the history too.

## Step 6: the Bank class

The bank stores accounts in a [dictionary](/courses/python/dictionaries) keyed by account number. It gives each new account the next number, and it turns a plain `KeyError` into a friendlier `AccountNotFoundError`. The `from None` part hides the original `KeyError` so the message stays clean.

```python
class Bank:
    def __init__(self, name):
        self.name = name
        self._accounts = {}
        self._next_number = 1001

    def open_account(self, owner, balance=0.0, savings=False):
        number = f"AC{self._next_number}"
        self._next_number += 1
        cls = SavingsAccount if savings else Account
        account = cls(number, owner, balance)
        self._accounts[number] = account
        return account

    def get(self, number):
        try:
            return self._accounts[number]
        except KeyError:
            raise AccountNotFoundError(f"No account {number!r}") from None

    def transfer(self, from_number, to_number, amount):
        source = self.get(from_number)
        target = self.get(to_number)
        source.withdraw(amount)
        target.deposit(amount)

    def total_deposits(self):
        return sum(acc.balance for acc in self._accounts.values())

    def __len__(self):
        return len(self._accounts)
```

Look at `cls = SavingsAccount if savings else Account`. Classes are values in Python, so you can store one in a variable and call it later.

## Step 7: run the whole thing

```python
bank = Bank("Py Bank")
ana = bank.open_account("Ana", 200)
ben = bank.open_account("Ben", 50, savings=True)
print(ana)
print(ben)
bank.transfer(ana.number, ben.number, 75)
print(ana.balance, ben.balance)
for bad in [("AC1001", "AC9999", 10), ("AC1002", "AC1001", 500)]:
    try:
        bank.transfer(*bad)
    except BankError as e:
        print(f"{type(e).__name__}: {e}")
print(len(bank), bank.total_deposits())
```

Output:

```text
Account('AC1001', 'Ana', balance=200.00)
SavingsAccount('AC1002', 'Ben', balance=50.00)
125.0 125.0
AccountNotFoundError: No account 'AC9999'
InsufficientFundsError: Cannot withdraw 500.00, balance is 125.00
2 250.0
```

Both bad transfers were stopped, and one `except BankError` handled both kinds of error. `bank.transfer(*bad)` uses `*` to unpack the tuple into three arguments, as you saw in [Function Arguments](/courses/python/function-arguments).

## Common mistakes

**1. Changing money before every check has passed.** An early version of `transfer()` looked like this:

```python
def transfer(self, from_number, to_number, amount):
    self.get(from_number).withdraw(amount)
    self.get(to_number).deposit(amount)
```

When the target account did not exist, the money had **already** left Ana's account before the error was raised. Her balance dropped from 125.00 to 115.00 and the 10.00 vanished. The fix is the version in Step 6: look up both accounts first, and only then move money. Real banks call this keeping an operation **atomic** (all or nothing).

**2. Letting outside code change `_balance`.** Python does not truly block `acc._balance = 999`. The underscore is a promise, not a lock. Always go through methods so the rules and history stay correct.

**3. Floating point surprises.** Floats cannot store some decimals exactly:

```python
>>> 0.1 + 0.2
0.30000000000000004
```

That is fine for a learning project. Real money software uses the `decimal` module or stores whole cents as integers. See the [decimal docs](https://docs.python.org/3/library/decimal.html) when you are ready.

## Ideas to extend it

- Add a `CheckingAccount` with an overdraft limit that overrides `withdraw()`.
- Add a `statement()` method that prints the history as a neat table using [f-strings](/courses/python/f-strings).
- Save the bank to a JSON file with `asdict()` and load it back, using what you learned in [Working with JSON and CSV Files](/courses/python/json-and-csv).
- Write tests for it after reading [Testing Your Code with pytest](/courses/python/testing-with-pytest).

## Quick recap

- Turn the nouns of a problem into classes and the verbs into methods.
- Protect important data with an underscore name and a read-only property.
- Use a data class for simple records like transactions.
- Use inheritance to add features (interest) without copying code.
- Custom exceptions with a shared base class make errors easy to catch.
- Check everything before changing anything.

Next, you will step into intermediate Python with [Iterators and Generators](/courses/python/iterators-and-generators).

<code id="code-content" class="language-python">
# main.py: a small bank account system (classes, inheritance, properties,
# data classes and custom exceptions working together)
from dataclasses import dataclass, field
from datetime import datetime
#
#
class BankError(Exception):
    """Base class for all bank problems."""
#
#
class InsufficientFundsError(BankError):
    pass
#
#
class AccountNotFoundError(BankError):
    pass
#
#
@dataclass(frozen=True)
class Transaction:
    kind: str
    amount: float
    balance_after: float
    when: datetime = field(default_factory=datetime.now)
#
#
class Account:
    def __init__(self, number, owner, balance=0.0):
        self.number, self.owner = number, owner
        self._balance = 0.0
        self.history = []
        if balance:
            self.deposit(balance)
#
    @property
    def balance(self):  # read-only from outside
        return self._balance
#
    def deposit(self, amount):
        if amount &lt;= 0:
            raise ValueError("Deposit must be positive")
        self._balance += amount
        self.history.append(Transaction("deposit", amount, self._balance))
#
    def withdraw(self, amount):
        if amount &lt;= 0:
            raise ValueError("Withdrawal must be positive")
        if amount &gt; self._balance:
            raise InsufficientFundsError(f"Cannot withdraw {amount:.2f}, balance is {self._balance:.2f}")
        self._balance -= amount
        self.history.append(Transaction("withdraw", amount, self._balance))
#
    def __repr__(self):
        return f"{type(self).__name__}({self.number!r}, {self.owner!r}, balance={self._balance:.2f})"
#
#
class SavingsAccount(Account):
    def __init__(self, number, owner, balance=0.0, rate=0.02):
        super().__init__(number, owner, balance)
        self.rate = rate
#
    def add_interest(self):
        interest = round(self._balance * self.rate, 2)
        if interest &gt; 0:
            self.deposit(interest)
        return interest
#
#
class Bank:
    def __init__(self, name):
        self.name = name
        self._accounts = {}
        self._next_number = 1001
#
    def open_account(self, owner, balance=0.0, savings=False):
        number = f"AC{self._next_number}"
        self._next_number += 1
        cls = SavingsAccount if savings else Account
        self._accounts[number] = cls(number, owner, balance)
        return self._accounts[number]
#
    def get(self, number):
        try:
            return self._accounts[number]
        except KeyError:
            raise AccountNotFoundError(f"No account {number!r}") from None
#
    def transfer(self, from_number, to_number, amount):
        source = self.get(from_number)  # look up BOTH accounts first,
        target = self.get(to_number)    # so a bad number changes nothing
        source.withdraw(amount)
        target.deposit(amount)
#
#
if __name__ == "__main__":
    bank = Bank("Py Bank")
    ana = bank.open_account("Ana", 200)
    ben = bank.open_account("Ben", 50, savings=True)
    bank.transfer(ana.number, ben.number, 75)
    print("Interest:", ben.add_interest())
    for bad in [("AC1001", "AC9999", 10), ("AC1002", "AC1001", 500)]:
        try:
            bank.transfer(*bad)
        except BankError as e:
            print(f"{type(e).__name__}: {e}")
    for acc in (ana, ben):
        print(acc)
        for t in acc.history:
            print(f"  {t.kind:&lt;8} {t.amount:&gt;8.2f} -&gt; {t.balance_after:.2f}")
</code></pre>

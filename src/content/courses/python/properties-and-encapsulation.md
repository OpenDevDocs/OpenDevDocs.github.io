---
publishDate: 2026-10-27T08:54
title: 'Properties and Encapsulation'
slug: properties-and-encapsulation
metadescription: 'Protect the data inside your Python objects: the underscore conventions, name mangling, and @property for validated, read-only and computed attributes.'
updateDate: 2026-10-27T08:54
author: ['bishal-biswas']
level: 2
tags: ['python', 'oop', 'classes', 'properties']
course: python
---

## The problem: anyone can change anything

In [Classes and Objects](/courses/python/classes-and-objects) you saw that you can change an attribute directly from outside the object. That is simple, but it can let bad data in:

```python
class Thermostat:
    def __init__(self, celsius):
        self.celsius = celsius

home = Thermostat(21)
home.celsius = -500
print(home.celsius)
```

Output:

```text
-500
```

Minus 500 degrees is colder than physics allows, yet the object accepted it without a word. The bug will only show up later, somewhere else, and be hard to trace.

**Encapsulation** is the idea of keeping an object's data safe inside it, and only letting the outside world change it through controlled doors. Think of a vending machine: you cannot reach in and grab a drink. You use the buttons and the coin slot, and the machine checks that you paid. The insides are protected, and the buttons are the **public interface**.

In this lesson you will learn how Python does encapsulation: with naming conventions and with **properties**.

## Python's naming conventions

Many languages have strict `private` keywords. Python does not. Instead, it relies on names and trust ("we are all adults here"):

| Name | Meaning | Enforced? |
| --- | --- | --- |
| `balance` | Public. Free to read and change from outside | No need |
| `_balance` | Internal. "Please do not touch this from outside the class" | No, just a polite agreement |
| `__balance` | Name mangled. Python renames it to avoid clashes in child classes | Partly |

Here are all three in action:

```python
class Account:
    def __init__(self, owner):
        self.owner = owner
        self._balance = 0
        self.__pin = "1234"

acc = Account("Mia")
print(acc.owner)
print(acc._balance)
try:
    print(acc.__pin)
except AttributeError as error:
    print("AttributeError:", error)
print(acc._Account__pin)
```

Output:

```text
Mia
0
AttributeError: 'Account' object has no attribute '__pin'
1234
```

- `_balance` works from outside, but the single underscore tells other programmers (and code editors) "this is internal".
- `__pin` seems hidden, but Python just renamed it to `_Account__pin`. This is called **name mangling**. Its real purpose is to stop a [child class](/courses/python/inheritance) from accidentally overwriting the parent's attribute, not to keep secrets.

> **Note:** A single underscore is the normal Python way to mark something as internal. Use double underscores rarely. And never rely on either to hide passwords or keys: anyone can still read them.

## Getters and setters, the long way

One way to protect data is to store it under an internal name and only allow changes through methods that check the value. These methods are called a **getter** (to read) and a **setter** (to change):

```python
class Thermostat:
    def __init__(self, celsius):
        self._celsius = celsius

    def get_celsius(self):
        return self._celsius

    def set_celsius(self, value):
        if not -30 <= value <= 60:
            raise ValueError("temperature must be between -30 and 60")
        self._celsius = value

home = Thermostat(21)
home.set_celsius(23)
print(home.get_celsius())
```

Output:

```text
23
```

This works, but it is clunky. Everyone has to write `home.set_celsius(23)` instead of the natural `home.celsius = 23`. And if you started with a plain attribute, switching to methods would break every piece of code that already used `home.celsius`.

## Properties: the Python way

A **property** gives you the safety of getters and setters while keeping the simple `obj.attribute` syntax. You write methods, but people use them like normal attributes.

You make one with the `@property` [decorator](/courses/python/decorators) for the getter, and `@name.setter` for the setter:

```python
class Thermostat:
    def __init__(self, celsius):
        self.celsius = celsius

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if not -30 <= value <= 60:
            raise ValueError("temperature must be between -30 and 60")
        self._celsius = value

home = Thermostat(21)
print(home.celsius)
home.celsius = 23
print(home.celsius)
try:
    home.celsius = -500
except ValueError as error:
    print("Rejected:", error)
print(home.celsius)
try:
    Thermostat(999)
except ValueError as error:
    print("Rejected at creation:", error)
```

Output:

```text
21
23
Rejected: temperature must be between -30 and 60
23
Rejected at creation: temperature must be between -30 and 60
```

What is going on:

1. `@property` turns the first `celsius` method into the **getter**. Reading `home.celsius` calls it, with no brackets.
2. `@celsius.setter` marks the second `celsius` method as the **setter**. Writing `home.celsius = 23` calls it with `value = 23`.
3. The real number is stored in `self._celsius` (with an underscore). The property is the door, `_celsius` is the room behind it.
4. In `__init__`, `self.celsius = celsius` goes through the setter too, so even a brand new thermostat is checked.

The bad value was [rejected with a ValueError](/courses/python/raising-and-custom-exceptions), and the old value of `23` stayed safe.

> **Tip:** Start with plain public attributes. If you later need validation, turn the attribute into a property. Code that uses `obj.celsius` keeps working without any change. This is why Python programmers rarely write `get_` and `set_` methods.

## Read-only properties

If you write a getter but **no** setter, the property is **read-only**. This is perfect for values that are **computed** from other data:

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def area(self):
        return self.width * self.height

box = Rectangle(3, 4)
print(box.area)
box.width = 10
print(box.area)
box.area = 50
```

Output:

```text
12
40
AttributeError: property 'area' of 'Rectangle' object has no setter
```

`area` is always up to date because it is calculated every time you read it. You cannot set it directly, which makes sense: what would an area of 50 mean for the width and height?

### A setter that updates other attributes

A property does not need its own stored value. Here `full_name` is built from two other attributes, and setting it splits the text back into them:

```python
class Person:
    def __init__(self, first, last):
        self.first = first
        self.last = last

    @property
    def full_name(self):
        return f"{self.first} {self.last}"

    @full_name.setter
    def full_name(self, value):
        self.first, self.last = value.split(" ", 1)

p = Person("Ada", "Lovelace")
print(p.full_name)
p.full_name = "Grace Hopper"
print(p.first)
print(p.last)
```

Output:

```text
Ada Lovelace
Grace
Hopper
```

`value.split(" ", 1)` splits at the first space only, and the two parts are [unpacked](/courses/python/tuples-and-unpacking) into `first` and `last`.

## Putting it together: a protected bank account

A bank balance is a classic case for encapsulation. Nobody should be able to type `account.balance = 1000000`. Money should only move through `deposit()` and `withdraw()`, which check the rules:

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self._balance = balance
        self._history = []

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("deposit must be positive")
        self._balance += amount
        self._history.append(f"+{amount}")

    def withdraw(self, amount):
        if amount > self._balance:
            raise ValueError("not enough money")
        self._balance -= amount
        self._history.append(f"-{amount}")

    @property
    def history(self):
        return tuple(self._history)

acc = BankAccount("Mia", 100)
acc.deposit(50)
acc.withdraw(30)
print(acc.balance)
print(acc.history)
try:
    acc.balance = 1_000_000
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
120
('+50', '-30')
AttributeError: property 'balance' of 'BankAccount' object has no setter
```

Notice that `history` returns a [tuple](/courses/python/tuples-and-unpacking), a copy that cannot be changed, instead of the internal list itself. Common mistake 4 below shows why. You will build a full version of this in [Project: Bank Account System](/courses/python/project-bank-account).

## Common mistakes

**1. The property and the stored value have the same name.**

```python
class Thermostat:
    def __init__(self, celsius):
        self.celsius = celsius

    @property
    def celsius(self):
        return self.celsius

    @celsius.setter
    def celsius(self, value):
        self.celsius = value

Thermostat(21)
```

```text
  [Previous line repeated 995 more times]
RecursionError: maximum recursion depth exceeded
```

Inside the setter, `self.celsius = value` calls the setter again, which calls it again, forever (see [Recursion](/courses/python/recursion)). Store the real value under a different name: `self._celsius`.

**2. Calling a property with brackets.**

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def area(self):
        return self.width * self.height

print(Rectangle(3, 4).area())
```

```text
TypeError: 'int' object is not callable
```

`box.area` already returns the number `12`, and then `()` tries to call `12`. Write `box.area` without brackets.

**3. The setter has a different name from the property.** If you write `@celsius.setter` above `def set_celsius(self, value):`, then setting `t.celsius = 25` fails with:

```text
AttributeError: property 'celsius' of 'Thermostat' object has no setter
```

The getter and the setter functions must both be named `celsius`.

**4. Returning an internal list, which lets outsiders change it.**

```python
class Team:
    def __init__(self):
        self._members = []

    @property
    def members(self):
        return self._members

team = Team()
team.members.append("Intruder")
print(team.members)
```

```text
['Intruder']
```

The property has no setter, but it handed out the real list, and lists are [mutable](/courses/python/mutability-and-copying). Return a copy instead: `return tuple(self._members)` or `return list(self._members)`.

## Quick recap

- **Encapsulation** means protecting an object's data and offering a clear public interface.
- `_name` means "internal, please do not touch". `__name` triggers name mangling. Neither is truly private.
- `@property` makes a method readable like an attribute. `@name.setter` runs when you assign to it.
- Store the real value under an underscore name like `self._celsius` to avoid endless recursion.
- A property with no setter is read-only. Great for computed values like `area`.
- Return copies of internal lists so outsiders cannot change them.

Next, you will see how Python can write `__init__`, `__repr__` and `__eq__` for you in [Data Classes](/courses/python/dataclasses).

<code id="code-content" class="language-python">
# main.py: a product with validated, read-only and computed properties
class Product:
    VAT_RATE = 0.2  # class attribute: 20 percent tax
#
    def __init__(self, name: str, price: float, stock: int = 0):
        self.name = name    # goes through the name setter
        self.price = price  # goes through the price setter
        self._stock = stock # internal, changed only by methods
#
    @property
    def name(self) -&gt; str:
        return self._name
#
    @name.setter
    def name(self, value: str) -&gt; None:
        if not value.strip():
            raise ValueError("name cannot be empty")
        self._name = value.strip()
#
    @property
    def price(self) -&gt; float:
        return self._price
#
    @price.setter
    def price(self, value: float) -&gt; None:
        if value &lt; 0:
            raise ValueError(f"price cannot be negative, got {value}")
        self._price = round(value, 2)
#
    @property
    def price_with_vat(self) -&gt; float:
        # Computed and read-only: no setter
        return round(self._price * (1 + Product.VAT_RATE), 2)
#
    @property
    def stock(self) -&gt; int:
        return self._stock  # read-only from outside
#
    def sell(self, quantity: int) -&gt; None:
        if quantity &gt; self._stock:
            raise ValueError(f"only {self._stock} {self._name} left")
        self._stock -= quantity
#
if __name__ == "__main__":
    lamp = Product("  Desk lamp ", 25, stock=3)
    print(f"{lamp.name}: {lamp.price} (with VAT {lamp.price_with_vat})")
    lamp.price = 30
    lamp.sell(2)
    print("New price:", lamp.price, "| stock left:", lamp.stock)
    for action in (lambda: setattr(lamp, "price", -5),
                   lambda: lamp.sell(5),
                   lambda: setattr(lamp, "stock", 100)):
        try:
            action()
        except (ValueError, AttributeError) as error:
            print(type(error).__name__ + ":", error)
</code></pre>

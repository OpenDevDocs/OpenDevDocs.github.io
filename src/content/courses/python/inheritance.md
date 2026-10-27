---
publishDate: 2026-10-27T08:52
title: 'Inheritance and super()'
slug: inheritance
metadescription: 'Learn how a Python class can inherit from another: reuse code, override methods, call the parent with super(), check types with isinstance and use mixins.'
updateDate: 2026-10-27T08:52
author: ['bishal-biswas']
level: 2
tags: ['python', 'oop', 'classes', 'inheritance']
course: python
---

## What is inheritance?

Imagine you are writing a game with dogs, cats and birds. Every animal has a name and can eat. Should you write the same `name` attribute and `eat()` method three times? That is a lot of copy and paste, and if you find a bug you must fix it in three places.

**Inheritance** lets one class take everything from another class and then add or change what it needs. It works like family traits: a child inherits features from a parent, but can still have their own personality.

Some words you will see:

| Term | Meaning | In our example |
| --- | --- | --- |
| **Parent class** (also base class or superclass) | The general class that is inherited from | `Animal` |
| **Child class** (also subclass or derived class) | The more specific class that inherits | `Dog`, `Cat` |
| **Override** | When the child replaces a parent method with its own version | `Dog.speak()` |

A good test: inheritance fits when you can say "a **Dog is an** Animal". If the sentence sounds wrong, inheritance is probably the wrong tool.

## Your first child class

You name the parent in brackets after the child's name:

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def eat(self):
        return f"{self.name} is eating."

    def speak(self):
        return f"{self.name} makes a sound."

class Dog(Animal):
    pass

rex = Dog("Rex")
print(rex.eat())
print(rex.speak())
```

Output:

```text
Rex is eating.
Rex makes a sound.
```

`Dog` has no code of its own (just `pass`), yet it has `__init__`, `eat()` and `speak()`. All of them come from `Animal`. When you ask for `rex.eat()`, Python looks in `Dog` first, does not find it, and then looks in the parent `Animal`.

## Adding and overriding methods

A child class becomes useful when it adds new methods or changes existing ones:

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def eat(self):
        return f"{self.name} is eating."

    def speak(self):
        return f"{self.name} makes a sound."

class Dog(Animal):
    def speak(self):
        return f"{self.name} says woof!"

    def fetch(self):
        return f"{self.name} fetches the ball."

class Cat(Animal):
    def speak(self):
        return f"{self.name} says meow."

for pet in [Dog("Rex"), Cat("Tom"), Animal("Generic")]:
    print(pet.speak())

print(Dog("Rex").fetch())
```

Output:

```text
Rex says woof!
Tom says meow.
Generic makes a sound.
Rex fetches the ball.
```

- `Dog` and `Cat` **override** `speak()`, so their own version wins.
- `Dog` **adds** `fetch()`, which cats and plain animals do not have.
- The [loop](/courses/python/for-loops-and-range) calls `speak()` on each pet without caring what kind it is. Each object answers in its own way. This idea, "same method name, different behavior", is called **polymorphism**. It means you can write one piece of code that works with many types.

## Calling the parent with super()

Often the child needs **extra** data. A dog has a breed, for example. So the child writes its own `__init__`. But the parent's `__init__` already knows how to store the name. How do you reuse it?

With `super()`. It gives you access to the parent class, so you can call its version of a method:

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)
        self.breed = breed

rex = Dog("Rex", "beagle")
print(rex.name, rex.breed)
```

Output:

```text
Rex beagle
```

Read `super().__init__(name)` as "let my parent set up the parts it knows about". Then the child sets up its own extra part, `self.breed`.

### What happens if you forget super()?

If the child defines `__init__` and does not call the parent's, the parent's set up never runs:

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, breed):
        self.breed = breed

rex = Dog("Rex", "beagle")
print(rex.breed)
print(rex.name)
```

Output:

```text
beagle
AttributeError: 'Dog' object has no attribute 'name'
```

The child's `__init__` replaced the parent's completely. That is why you almost always call `super().__init__(...)` as the first line of a child's `__init__`.

### Extending any method, not just __init__

`super()` works for every method. It is perfect when you want to **add to** the parent's behavior instead of replacing it:

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def describe(self):
        return f"{self.name} is an animal"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name)
        self.breed = breed

    def describe(self):
        basic = super().describe()
        return f"{basic}, a {self.breed} to be exact"

print(Dog("Rex", "beagle").describe())
```

Output:

```text
Rex is an animal, a beagle to be exact
```

## Checking types: isinstance and issubclass

`isinstance(obj, SomeClass)` is `True` if the object was made from that class **or any of its children**. `issubclass(Child, Parent)` checks classes:

```python
class Animal:
    pass

class Dog(Animal):
    pass

class Cat(Animal):
    pass

rex = Dog()
print(isinstance(rex, Dog))
print(isinstance(rex, Animal))
print(isinstance(rex, Cat))
print(issubclass(Dog, Animal))
print(issubclass(Animal, object))
print(Dog.__mro__)
```

Output:

```text
True
True
False
True
True
(<class '__main__.Dog'>, <class '__main__.Animal'>, <class 'object'>)
```

Two interesting facts here:

- Every class secretly inherits from `object`, the parent of everything in Python. That is where default behavior, like the plain `<__main__.Dog object at ...>` text, comes from.
- `__mro__` is the **method resolution order**: the list of classes Python searches, in order, when you call a method. `Dog`, then `Animal`, then `object`.

You already used inheritance without knowing it: in [Raising Errors and Custom Exceptions](/courses/python/raising-and-custom-exceptions) every custom error inherited from `Exception`, which is why `except` could catch it.

## A practical example: bank accounts

Here is a more realistic family of classes. A savings account **adds** interest. A student account **overrides** `withdraw()` to allow a small overdraft:

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("not enough money")
        self.balance -= amount
        return self.balance

class SavingsAccount(Account):
    def __init__(self, owner, balance=0, rate=0.02):
        super().__init__(owner, balance)
        self.rate = rate

    def add_interest(self):
        self.balance += self.balance * self.rate
        return self.balance

class StudentAccount(Account):
    overdraft = 50

    def withdraw(self, amount):
        if amount > self.balance + self.overdraft:
            raise ValueError("overdraft limit reached")
        self.balance -= amount
        return self.balance

s = SavingsAccount("Mia", 1000)
print(s.add_interest())
print(s.withdraw(200))

st = StudentAccount("Leo", 20)
print(st.withdraw(60))
try:
    st.withdraw(30)
except ValueError as error:
    print("Leo:", error)
```

Output:

```text
1020.0
820.0
-40
Leo: overdraft limit reached
```

You will build a full version of this in [Project: Bank Account System](/courses/python/project-bank-account).

## Multiple inheritance and mixins

A class can have more than one parent. A common, safe use is a **mixin**: a small class that adds one ability and is meant to be mixed into others:

```python
class Swimmer:
    def swim(self):
        return f"{self.name} swims"

class Flyer:
    def fly(self):
        return f"{self.name} flies"

class Duck(Swimmer, Flyer):
    def __init__(self, name):
        self.name = name

donald = Duck("Donald")
print(donald.swim())
print(donald.fly())
print([cls.__name__ for cls in Duck.__mro__])
```

Output:

```text
Donald swims
Donald flies
['Duck', 'Swimmer', 'Flyer', 'object']
```

Python searches parents from left to right, as the MRO shows.

> **Tip:** Keep inheritance shallow: one or two levels is usually plenty. Deep family trees are hard to follow. If something "has a" part rather than "is a" kind of thing (a car **has an** engine, it is not an engine), store the part as an attribute instead. This is called **composition**:

```python
class Engine:
    def start(self):
        return "Vroom"

class Car:
    def __init__(self):
        self.engine = Engine()

    def start(self):
        return self.engine.start()

print(Car().start())
```

```text
Vroom
```

## Common mistakes

**1. Forgetting the brackets after `super`.**

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, breed):
        super.__init__(name)
        self.breed = breed

Dog("Rex", "beagle")
```

```text
TypeError: descriptor '__init__' requires a 'super' object but received a 'str'
```

The message is confusing, but the fix is simple: `super().__init__(name)` with `()` after `super`.

**2. Not passing the arguments the parent needs.**

```python
class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    pass

Dog()
```

```text
TypeError: Animal.__init__() missing 1 required positional argument: 'name'
```

`Dog` uses `Animal.__init__`, which needs a name. Fix: `Dog("Rex")`.

**3. Using the parent before it is defined.**

```text
NameError: name 'Animal' is not defined
```

Python reads your file from top to bottom, so the parent class must be defined (or [imported](/courses/python/modules-and-imports)) above the child.

**4. Forgetting `super().__init__()` in the child.** As shown above, the parent's attributes are then missing, and you get an `AttributeError` later.

## Quick recap

- `class Child(Parent):` makes `Child` inherit every attribute and method of `Parent`.
- A child can **add** new methods and **override** existing ones.
- `super().method(...)` calls the parent's version. Call `super().__init__(...)` in a child's `__init__`.
- `isinstance()` and `issubclass()` check "is a" relationships. Every class inherits from `object`.
- **Polymorphism**: the same method name can behave differently for each class.
- Use inheritance for "is a". Use composition (an attribute) for "has a".

Next, you will make your objects work with `print()`, `==`, `+` and `len()` in [Special (Dunder) Methods](/courses/python/dunder-methods).

<code id="code-content" class="language-python">
# main.py: a small zoo showing inheritance, overriding and super()
class Animal:
    """The parent class with behavior every animal shares."""
    def __init__(self, name: str, sound: str = "..."):
        self.name = name
        self.sound = sound
#
    def speak(self) -&gt; str:
        return f"{self.name} says {self.sound}"
#
    def describe(self) -&gt; str:
        return f"{self.name} the {type(self).__name__.lower()}"
#
class Dog(Animal):
    def __init__(self, name: str, breed: str):
        super().__init__(name, sound="woof")  # reuse the parent set up
        self.breed = breed
#
    def describe(self) -&gt; str:
        # Extend the parent version instead of replacing it
        return f"{super().describe()} ({self.breed})"
#
    def fetch(self) -&gt; str:
        return f"{self.name} brings back the ball"
#
class Cat(Animal):
    def __init__(self, name: str):
        super().__init__(name, sound="meow")
#
    def speak(self) -&gt; str:
        # Override completely
        return f"{self.name} ignores you"
#
class Parrot(Animal):
    def __init__(self, name: str, phrase: str):
        super().__init__(name, sound=f"'{phrase}'")
#
if __name__ == "__main__":
    zoo = [Dog("Rex", "beagle"), Cat("Tom"), Parrot("Polly", "hello")]
    for animal in zoo:
        # Polymorphism: same call, different behavior
        print(animal.describe(), "|", animal.speak())
        if isinstance(animal, Dog):
            print("  ", animal.fetch())
    print([cls.__name__ for cls in Dog.__mro__])
</code></pre>

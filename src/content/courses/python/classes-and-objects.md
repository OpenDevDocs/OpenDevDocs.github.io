---
publishDate: 2026-10-27T08:50
title: 'Classes and Objects'
slug: classes-and-objects
metadescription: 'Learn object-oriented programming from zero: define a class, create objects, store data with __init__ and self, and add methods that work on that data.'
updateDate: 2026-10-27T08:50
author: ['bishal-biswas']
level: 2
tags: ['python', 'oop', 'classes']
course: python
---

## What is object-oriented programming?

So far you have kept data in variables, [lists](/courses/python/lists) and [dictionaries](/courses/python/dictionaries), and written [functions](/courses/python/functions) that work on that data. That works well, but in bigger programs the data and the functions drift apart. Which functions are allowed to change a "player" dictionary? Which keys must it have? It gets hard to keep track.

**Object-oriented programming** (often shortened to **OOP**) is a way of organizing code that keeps the data and the functions that use it **together** in one bundle, called an **object**.

Here is an everyday picture:

- A **class** is a blueprint, like the architect's plan for a house. It describes what every house of that type has (rooms, doors) and what it can do (open the door, turn on the lights).
- An **object** (also called an **instance**) is one real house built from that plan. You can build many houses from one plan, and each has its own paint color and its own people living in it.

## You have used objects all along

Everything in Python is an object. Every value has a class, which `type()` tells you:

```python
print(type(5))
print(type("hi"))
print(type([1, 2]))
words = ["b", "a"]
words.sort()
print(words)
```

Output:

```text
<class 'int'>
<class 'str'>
<class 'list'>
['a', 'b']
```

`words` is an object of class `list`. `.sort()` is a function that belongs to it. A function that belongs to an object is called a **method**. In this lesson you will learn to make your own classes, with their own methods.

## Defining a class

You create a class with the `class` keyword. Class names use **CapitalizedWords** (also called PascalCase), unlike variables and functions, which use `snake_case`.

```python
class Dog:
    pass

rex = Dog()
fido = Dog()
print(type(rex))
print(rex is fido)
print(isinstance(rex, Dog))
```

Output:

```text
<class '__main__.Dog'>
False
True
```

`Dog()` (the class name with brackets) builds a new object. `rex` and `fido` are two separate dogs made from the same blueprint, so `rex is fido` is `False`. `isinstance()` checks whether an object was made from a certain class. (`__main__` just means "defined in the file you ran".)

This dog is not very useful yet. It knows nothing about itself.

## Giving objects data with __init__ and self

Each dog should have a name and an age. You set this up in a special method called `__init__` (two underscores on each side, said "dunder init"). Python calls it automatically every time you create a new object. It is often called the **constructor**, because it builds the new object's starting state.

```python
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

rex = Dog("Rex", 3)
fido = Dog("Fido", 7)
print(rex.name, rex.age)
print(fido.name, fido.age)
```

Output:

```text
Rex 3
Fido 7
```

Let's unpack the new pieces:

- **`self`** is the object being built (or used). When you write `Dog("Rex", 3)`, Python creates an empty dog, then calls `__init__` with that dog as `self`, `"Rex"` as `name`, and `3` as `age`. You never pass `self` yourself. Python fills it in.
- **`self.name = name`** stores the value **on the object**. A variable stored on an object is called an **attribute**. `name` on the right is just the [parameter](/courses/python/function-arguments). `self.name` on the left is the dog's own name, which lives as long as the dog does.
- **`rex.name`** reads an attribute with a dot: "rex's name".

Think of `self` as the word "my". Inside the class, `self.name` means "my name". Each dog answers with its own.

## Adding methods

Methods are functions defined inside a class. Their first parameter is always `self`, so they can reach the object's data:

```python
class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def bark(self):
        return f"{self.name} says woof!"

    def human_years(self):
        return self.age * 7

rex = Dog("Rex", 3)
print(rex.bark())
print(rex.human_years())
print(Dog.bark(rex))
```

Output:

```text
Rex says woof!
21
Rex says woof!
```

The last line shows what Python really does. `rex.bark()` is a short form of `Dog.bark(rex)`: the object before the dot becomes `self`. You will always use the short form, but knowing this makes `self` much less mysterious.

## Each object has its own state

The data stored in an object's attributes is called its **state**. Methods can change it, and each object keeps its own:

```python
class Counter:
    def __init__(self):
        self.count = 0

    def click(self):
        self.count += 1

a = Counter()
b = Counter()
a.click()
a.click()
b.click()
print(a.count, b.count)

a.count = 100
print(a.count)
```

Output:

```text
2 1
100
```

Two counters, two separate counts. Notice you can also set an attribute directly from outside (`a.count = 100`). Sometimes that is fine, sometimes you want to protect it. You will learn how in [Properties and Encapsulation](/courses/python/properties-and-encapsulation).

## Class attributes: shared by every object

An attribute set **inside the class body** (not on `self`) is a **class attribute**. Every object shares the same one:

```python
class Dog:
    species = "Canis familiaris"

    def __init__(self, name):
        self.name = name

rex = Dog("Rex")
fido = Dog("Fido")
print(rex.species, fido.species)
print(Dog.species)
```

Output:

```text
Canis familiaris Canis familiaris
Canis familiaris
```

| Kind | Where you create it | Shared? | Example |
| --- | --- | --- | --- |
| Instance attribute | `self.x = ...` inside a method | No, one per object | `name`, `age` |
| Class attribute | Directly in the class body | Yes, one for the whole class | `species` |

> **Warning:** Do not use a list or dictionary as a class attribute when each object needs its own. See common mistake 4 below.

## A more realistic example

Here is a shopping cart. It bundles the data (owner and items) with the actions that make sense for a cart:

```python
class ShoppingCart:
    def __init__(self, owner):
        self.owner = owner
        self.items = []

    def add(self, product, price, quantity=1):
        self.items.append((product, price, quantity))

    def item_count(self):
        return sum(quantity for _, _, quantity in self.items)

    def total(self):
        return sum(price * quantity for _, price, quantity in self.items)

cart = ShoppingCart("Mia")
cart.add("apple", 0.5, 4)
cart.add("bread", 2.25)
print(cart.items)
print(cart.item_count(), "items")
print(f"{cart.owner} owes {cart.total():.2f}")
```

Output:

```text
[('apple', 0.5, 4), ('bread', 2.25, 1)]
5 items
Mia owes 4.25
```

Anyone using `ShoppingCart` does not need to know that items are stored as [tuples](/courses/python/tuples-and-unpacking). They just call `add()` and `total()`. Hiding the details behind simple methods like this is one of the main benefits of classes.

> **Tip:** Printing an object you made, like `print(rex)`, shows something unhelpful such as `<__main__.Dog object at 0x000001E441758590>` (the number changes every run). You will fix that with `__str__` and `__repr__` in [Special (Dunder) Methods](/courses/python/dunder-methods).

## Common mistakes

**1. Forgetting `self` in a method.**

```python
class Dog:
    def __init__(self, name):
        self.name = name

    def bark():
        return "woof"

Dog("Rex").bark()
```

```text
TypeError: Dog.bark() takes 0 positional arguments but 1 was given
```

Python always passes the object as the first argument. Fix: `def bark(self):`.

**2. Forgetting `self.` when storing data.**

```python
class Dog:
    def __init__(self, name):
        name = name

rex = Dog("Rex")
print(rex.name)
```

```text
AttributeError: 'Dog' object has no attribute 'name'
```

`name = name` only changes a local variable that disappears when `__init__` ends (see [Variable Scope](/courses/python/variable-scope)). Fix: `self.name = name`.

**3. Wrong number of arguments when creating an object, or a misspelled `__init__`.**

```text
TypeError: Dog.__init__() missing 1 required positional argument: 'name'
```

You wrote `Dog()` but `__init__` needs a name. If instead you see `TypeError: Dog() takes no arguments`, you probably spelled `__init__` with one underscore (`_init_`), so Python never found it.

**4. A shared list as a class attribute.**

```python
class Dog:
    tricks = []

    def __init__(self, name):
        self.name = name

    def learn(self, trick):
        self.tricks.append(trick)

rex = Dog("Rex")
fido = Dog("Fido")
rex.learn("sit")
print(fido.tricks)
```

```text
['sit']
```

Fido learned a trick he never practiced, because all dogs share one list. Fix: create it in `__init__` with `self.tricks = []`, so each dog gets its own.

**5. Forgetting the brackets when calling a method.** `print(rex.bark)` prints `<bound method Dog.bark of ...>` instead of the bark. Write `rex.bark()`.

## Quick recap

- A **class** is a blueprint. An **object** (instance) is one thing built from it.
- `class Dog:` defines a class, `Dog(...)` creates an object.
- `__init__(self, ...)` runs automatically to set up a new object.
- `self` is the object itself. `self.name = name` stores an **attribute**.
- **Methods** are functions in a class. `rex.bark()` means `Dog.bark(rex)`.
- Instance attributes belong to one object. Class attributes are shared by all.

Not every method needs `self`. In the next lesson you will meet [Instance, Class and Static Methods](/courses/python/instance-class-static-methods).

<code id="code-content" class="language-python">
# main.py: a simple class for a video game character
class Player:
    # Class attribute: shared by every player
    max_health = 100
#
    def __init__(self, name: str, level: int = 1):
        # Instance attributes: each player has their own
        self.name = name
        self.level = level
        self.health = Player.max_health
        self.inventory = []  # created here so it is not shared
#
    def take_damage(self, amount: int) -&gt; None:
        self.health = max(0, self.health - amount)
        print(f"{self.name} takes {amount} damage, health is {self.health}")
#
    def heal(self, amount: int) -&gt; None:
        self.health = min(Player.max_health, self.health + amount)
        print(f"{self.name} heals to {self.health}")
#
    def pick_up(self, item: str) -&gt; None:
        self.inventory.append(item)
#
    def is_alive(self) -&gt; bool:
        return self.health &gt; 0
#
    def describe(self) -&gt; str:
        items = ", ".join(self.inventory) or "nothing"
        return f"{self.name} (level {self.level}) carries {items}"
#
if __name__ == "__main__":
    hero = Player("Mia", level=3)
    sidekick = Player("Leo")
    hero.pick_up("sword")
    hero.pick_up("map")
    hero.take_damage(30)
    hero.heal(50)
    sidekick.take_damage(120)
    print(hero.describe())
    print(sidekick.describe())
    print("Is Leo alive?", sidekick.is_alive())
</code></pre>

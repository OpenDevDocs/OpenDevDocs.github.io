---
publishDate: 2026-10-27T08:51
title: 'Instance, Class and Static Methods'
slug: instance-class-static-methods
metadescription: 'Understand the three kinds of methods in a Python class: instance methods with self, @classmethod with cls for alternative constructors, and @staticmethod.'
updateDate: 2026-10-27T08:51
author: ['bishal-biswas']
level: 2
tags: ['python', 'oop', 'classes', 'methods']
course: python
---

## Three kinds of methods

In [Classes and Objects](/courses/python/classes-and-objects) every method you wrote had `self` as its first parameter. Those are **instance methods**, and they are by far the most common. But Python has two more kinds:

| Kind | First parameter | Can see | Typical use |
| --- | --- | --- | --- |
| Instance method | `self` (the object) | The object's data **and** the class | Most behavior: `cart.total()` |
| Class method | `cls` (the class) | The class, but no single object | Other ways to create objects, shared counters |
| Static method | nothing special | Neither | A helper function that belongs with the class |

Picture a pizza restaurant:

- An **instance method** is something you ask about one specific pizza: "what toppings are on **this** pizza?"
- A **class method** is something you ask the kitchen as a whole: "how many pizzas have you made today?" or "make me a Margherita".
- A **static method** is a fact on the menu that needs no pizza and no kitchen: "is 30 cm an allowed size?"

Let's build that restaurant.

## Instance methods: working with one object

This is what you already know. The method gets the object as `self`, so it can read and change that object's attributes:

```python
class Pizza:
    def __init__(self, size, toppings):
        self.size = size
        self.toppings = toppings

    def describe(self):
        return f"A {self.size} cm pizza with {', '.join(self.toppings)}"

order = Pizza(30, ["cheese", "tomato"])
print(order.describe())
```

Output:

```text
A 30 cm pizza with cheese, tomato
```

Use an instance method whenever the method needs data from a particular object. When in doubt, this is the right choice.

## Class methods: working with the class

A **class method** is marked with `@classmethod` on the line above it. That line is a **decorator**, a label that changes how the function behaves (you will build your own in [Decorators](/courses/python/decorators)). Instead of an object, a class method receives the **class itself**, and by convention the parameter is called `cls`.

### Example 1: a counter shared by the class

```python
class Pizza:
    count = 0

    def __init__(self, size, toppings):
        self.size = size
        self.toppings = toppings
        Pizza.count += 1

    @classmethod
    def how_many(cls):
        return f"{cls.count} pizzas made so far"

Pizza(30, ["cheese"])
Pizza(25, ["ham"])
print(Pizza.how_many())
```

Output:

```text
2 pizzas made so far
```

`count` is a **class attribute**, shared by all pizzas. `how_many` does not care about any single pizza, so it is a class method, and you call it on the class: `Pizza.how_many()`.

### Example 2: alternative constructors

The most popular use of class methods is to offer **other ways to create an object**. These are called **alternative constructors** or **factory methods**. `__init__` gives you one way to build a pizza. Class methods can give you more:

```python
class Pizza:
    def __init__(self, size, toppings):
        self.size = size
        self.toppings = toppings

    @classmethod
    def margherita(cls, size=30):
        return cls(size, ["cheese", "tomato", "basil"])

    @classmethod
    def from_string(cls, text):
        size_text, toppings_text = text.split(":")
        return cls(int(size_text), toppings_text.split(","))

    def describe(self):
        return f"{self.size} cm: {', '.join(self.toppings)}"

a = Pizza.margherita()
b = Pizza.from_string("25:ham,pineapple")
print(a.describe())
print(b.describe())
```

Output:

```text
30 cm: cheese, tomato, basil
25 cm: ham, pineapple
```

Inside the class method, `cls(...)` means "create a new object of this class". It calls `__init__` for you, exactly like writing `Pizza(...)`.

`from_string` is very handy for reading data from a file or from [user input](/courses/python/input-and-output). Python itself uses this pattern: for example, `dict.fromkeys()` and `datetime.fromisoformat()` (see [Working with Dates and Times](/courses/python/dates-and-times)) are class methods.

### Why `cls` instead of writing `Pizza`?

You could write `return Pizza(...)`. But `cls` is smarter when a class is **inherited**. If you make a `GlutenFreePizza` based on `Pizza`, the class methods automatically create the right type:

```python
class Pizza:
    def __init__(self, size, toppings):
        self.size = size
        self.toppings = toppings

    @classmethod
    def margherita(cls):
        return cls(30, ["cheese", "tomato"])

class GlutenFreePizza(Pizza):
    pass

p = GlutenFreePizza.margherita()
print(type(p).__name__)
```

Output:

```text
GlutenFreePizza
```

With a hard coded `Pizza(...)` you would get a plain `Pizza` instead. You will learn more about this in [Inheritance and super()](/courses/python/inheritance).

## Static methods: a helper that lives in the class

A **static method** is marked with `@staticmethod`. It gets **no automatic first argument**: no `self`, no `cls`. It is just a normal function that you put inside a class because it is related to it.

```python
class Pizza:
    def __init__(self, size, toppings):
        self.size = size
        self.toppings = toppings

    @staticmethod
    def is_valid_size(size):
        return 20 <= size <= 40

print(Pizza.is_valid_size(30))
print(Pizza.is_valid_size(55))
p = Pizza(30, ["cheese"])
print(p.is_valid_size(10))
```

Output:

```text
True
False
False
```

You can call a static method on the class or on an object, and it behaves the same. It cannot read `self.size` or `cls.count`, because it does not receive them.

> **Note:** Static methods are the least common of the three. If a helper does not need the class at all, a plain function in the same [module](/courses/python/modules-and-imports) is often just as good. Use a static method when grouping it with the class makes the code easier to find and read.

## All three together

Here is a temperature class that uses one of each. Watch which one needs what:

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def to_fahrenheit(self):
        return self.c_to_f(self.celsius)

    @classmethod
    def from_fahrenheit(cls, fahrenheit):
        return cls((fahrenheit - 32) * 5 / 9)

    @staticmethod
    def c_to_f(celsius):
        return celsius * 9 / 5 + 32

today = Temperature(25)
print(today.to_fahrenheit())
oven = Temperature.from_fahrenheit(392)
print(oven.celsius)
print(Temperature.c_to_f(100))
```

Output:

```text
77.0
200.0
212.0
```

- `to_fahrenheit` needs **this** temperature's value, so it is an instance method.
- `from_fahrenheit` creates a new `Temperature` from a different unit, so it is a class method.
- `c_to_f` is pure math that needs no object at all, so it is a static method.

## How to choose

Ask yourself these questions, in order:

1. **Does the method need data from one specific object?** Use an instance method (`self`).
2. **If not, does it need the class (to create objects or read class attributes)?** Use a class method (`cls`).
3. **Neither?** Use a static method, or a plain function outside the class.

## Common mistakes

**1. Calling an instance method on the class.**

```python
class Pizza:
    def __init__(self, size):
        self.size = size

    def describe(self):
        return f"{self.size} cm pizza"

print(Pizza.describe())
```

```text
TypeError: Pizza.describe() missing 1 required positional argument: 'self'
```

The class is the blueprint, not a pizza. Create an object first: `Pizza(30).describe()`.

**2. Using `self` inside a static method.**

```python
class Pizza:
    def __init__(self, size):
        self.size = size

    @staticmethod
    def describe():
        return f"{self.size} cm pizza"

print(Pizza(30).describe())
```

```text
NameError: name 'self' is not defined
```

Static methods do not receive the object. If you need `self`, remove `@staticmethod` and add `self` as the first parameter.

**3. Forgetting `cls` in a class method.**

```python
class Pizza:
    def __init__(self, size):
        self.size = size

    @classmethod
    def small():
        return Pizza(20)

Pizza.small()
```

```text
TypeError: Pizza.small() takes 0 positional arguments but 1 was given
```

Python always passes the class to a class method. Fix: `def small(cls): return cls(20)`.

**4. Changing a class attribute through `self`.**

```python
class Pizza:
    count = 0

    def __init__(self):
        self.count += 1

a = Pizza()
b = Pizza()
print(Pizza.count, a.count, b.count)
```

```text
0 1 1
```

`self.count += 1` reads the class value (`0`) but then creates a **new instance attribute** on each object. The class counter never changes. Write `Pizza.count += 1` (or `type(self).count += 1`) to update the shared value.

## Quick recap

- **Instance methods** take `self` and work with one object. They are the default.
- **Class methods** use `@classmethod`, take `cls`, and work with the class. Great for alternative constructors like `Pizza.from_string(...)`.
- **Static methods** use `@staticmethod` and take no automatic argument. They are helpers grouped with the class.
- Use `cls(...)` instead of the class name so subclasses get the right type.
- Update shared class attributes through the class, not through `self`.

Next, you will learn how one class can build on another in [Inheritance and super()](/courses/python/inheritance).

<code id="code-content" class="language-python">
# main.py: a pizza shop showing all three kinds of methods
class Pizza:
    made = 0  # class attribute shared by every pizza
    MIN_SIZE, MAX_SIZE = 20, 40
#
    def __init__(self, size: int, toppings: list[str]):
        if not Pizza.is_valid_size(size):
            raise ValueError(f"size must be {Pizza.MIN_SIZE} to {Pizza.MAX_SIZE} cm")
        self.size = size
        self.toppings = toppings
        Pizza.made += 1  # update the class attribute, not self
#
    # Instance method: needs this pizza's data
    def price(self) -&gt; float:
        return 5 + self.size * 0.2 + len(self.toppings) * 1.5
#
    def describe(self) -&gt; str:
        return f"{self.size} cm with {', '.join(self.toppings)}: {self.price():.2f}"
#
    # Class methods: alternative constructors and class level info
    @classmethod
    def margherita(cls, size: int = 30) -&gt; "Pizza":
        return cls(size, ["cheese", "tomato", "basil"])
#
    @classmethod
    def from_order(cls, text: str) -&gt; "Pizza":
        size_text, toppings_text = text.split(":")
        return cls(int(size_text), toppings_text.split(","))
#
    @classmethod
    def report(cls) -&gt; str:
        return f"{cls.made} pizza(s) made today"
#
    # Static method: a helper that needs no pizza and no class data
    @staticmethod
    def is_valid_size(size: int) -&gt; bool:
        return Pizza.MIN_SIZE &lt;= size &lt;= Pizza.MAX_SIZE
#
if __name__ == "__main__":
    orders = [Pizza.margherita(), Pizza.from_order("25:ham,pineapple")]
    for pizza in orders:
        print(pizza.describe())
    print("Is 50 cm allowed?", Pizza.is_valid_size(50))
    try:
        Pizza.from_order("50:cheese")
    except ValueError as error:
        print("Order rejected:", error)
    print(Pizza.report())
</code></pre>

---
publishDate: 2026-10-27T08:53
title: 'Special (Dunder) Methods'
slug: dunder-methods
metadescription: 'Make your classes feel built in with dunder methods: __str__ and __repr__ for printing, __eq__ and __lt__ for comparing, __add__, __len__ and __getitem__.'
updateDate: 2026-10-27T08:53
author: ['bishal-biswas']
level: 2
tags: ['python', 'oop', 'classes', 'dunder-methods']
course: python
---

## What are dunder methods?

You have already met one special method: `__init__`, which Python calls when you create an object. Python has many more methods like it. Their names start and end with two underscores, so people call them **dunder methods** (short for "**d**ouble **under**score"). You may also hear them called **magic methods**.

You almost never call them yourself. Instead, Python calls them for you when you use normal syntax like `print()`, `+`, `==` or `len()`. Look at this:

```python
print(3 + 4)
print((3).__add__(4))
print(len("hello"))
print("hello".__len__())
```

Output:

```text
7
7
5
5
```

When you write `3 + 4`, Python really runs `(3).__add__(4)`. When you write `len("hello")`, Python runs `"hello".__len__()`. Numbers and strings simply have these methods built in.

The great news: if **you** write these methods in your own [classes](/courses/python/classes-and-objects), your objects can work with `+`, `==`, `len()` and friends too. It is like teaching your class to speak Python's native language.

## Printing nicely: __str__ and __repr__

By default, printing an object you made shows something like `<__main__.Book object at 0x000001E441758590>`. Not helpful. Two dunder methods fix that:

- `__str__` returns a friendly text for **users**. `print()` and f-strings use it.
- `__repr__` returns a precise text for **developers**. The [REPL](/courses/python/python-repl), `repr()` and lists of objects use it. Ideally, it looks like the code that would create the object.

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __str__(self):
        return f"{self.title} by {self.author}"

    def __repr__(self):
        return f"Book({self.title!r}, {self.author!r})"

book = Book("Dune", "Frank Herbert")
print(book)
print(f"Reading: {book}")
print(repr(book))
print([book])
```

Output:

```text
Dune by Frank Herbert
Reading: Dune by Frank Herbert
Book('Dune', 'Frank Herbert')
[Book('Dune', 'Frank Herbert')]
```

Notice that printing a **list** of books uses `__repr__`, not `__str__`. The `!r` inside the f-string adds quotes around the strings.

> **Tip:** If you only write one of the two, write `__repr__`. When there is no `__str__`, Python falls back to `__repr__`, so both `print()` and debugging get something useful.

## Comparing objects: __eq__

What does `==` do for your own objects? By default, it checks whether they are the **same object** in memory, not whether they hold the same data:

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

a = Point(1, 2)
b = Point(1, 2)
print(a == b)
```

Output:

```text
False
```

Two points with the same numbers are "not equal". Write `__eq__` to decide what equal means for your class:

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return self.x == other.x and self.y == other.y

    def __repr__(self):
        return f"Point({self.x}, {self.y})"

print(Point(1, 2) == Point(1, 2))
print(Point(1, 2) == Point(3, 4))
print(Point(1, 2) == "hello")
print(Point(1, 2) in [Point(0, 0), Point(1, 2)])
```

Output:

```text
True
False
False
True
```

`NotImplemented` is a special value that means "I do not know how to compare with that type". Python then tries other options and, for `==`, ends up with `False` instead of crashing. Notice that the `in` operator also uses `__eq__` behind the scenes.

## Sorting: __lt__ and friends

Each comparison operator has its own dunder method:

| Operator | Method | Meaning |
| --- | --- | --- |
| `==` | `__eq__` | equal |
| `!=` | `__ne__` | not equal (automatic if you write `__eq__`) |
| `<` | `__lt__` | less than |
| `<=` | `__le__` | less than or equal |
| `>` | `__gt__` | greater than |
| `>=` | `__ge__` | greater than or equal |

`sorted()`, `min()` and `max()` only need `<`, so `__lt__` alone makes your objects sortable:

```python
class Student:
    def __init__(self, name, grade):
        self.name = name
        self.grade = grade

    def __lt__(self, other):
        return self.grade < other.grade

    def __repr__(self):
        return f"{self.name}({self.grade})"

students = [Student("Ana", 88), Student("Ben", 72), Student("Cy", 95)]
print(sorted(students))
print(max(students))
print(Student("A", 50) < Student("B", 60))
```

Output:

```text
[Ben(72), Ana(88), Cy(95)]
Cy(95)
True
```

> **Note:** If you want all six comparisons, write `__eq__` and `__lt__`, then put `@functools.total_ordering` above the class. It fills in the rest for you. Also remember you can sort without any dunder method by passing `key=lambda s: s.grade`, as in [Lambda and Higher-Order Functions](/courses/python/lambda-and-higher-order-functions).

## Math operators: __add__, __mul__ and more

Operators like `+`, `-` and `*` map to `__add__`, `__sub__` and `__mul__`. Here is a 2D vector, like an arrow in a game that has an x and a y part:

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __mul__(self, number):
        return Vector(self.x * number, self.y * number)

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"

a = Vector(1, 2)
b = Vector(3, 4)
print(a + b)
print(a * 3)
```

Output:

```text
Vector(4, 6)
Vector(3, 6)
```

Each method returns a **new** object and leaves the originals unchanged, just like `3 + 4` does not change the `3`.

## Acting like a container: __len__, __getitem__, __contains__

You can make an object behave like a list:

| You write | Python calls |
| --- | --- |
| `len(obj)` | `obj.__len__()` |
| `obj[0]` | `obj.__getitem__(0)` |
| `x in obj` | `obj.__contains__(x)` |
| `bool(obj)`, `if obj:` | `obj.__bool__()`, or `__len__()` if there is no `__bool__` |

```python
class Playlist:
    def __init__(self, name, songs):
        self.name = name
        self.songs = list(songs)

    def __len__(self):
        return len(self.songs)

    def __getitem__(self, index):
        return self.songs[index]

    def __contains__(self, song):
        return song in self.songs

mix = Playlist("Road trip", ["Song A", "Song B", "Song C"])
print(len(mix))
print(mix[0])
print(mix[-1])
print(mix[0:2])
print("Song B" in mix)
for song in mix:
    print("Playing", song)
print(bool(Playlist("Empty", [])))
```

Output:

```text
3
Song A
Song C
['Song A', 'Song B']
True
Playing Song A
Playing Song B
Playing Song C
False
```

Because `__getitem__` passes the index straight to the inner list, negative indexes and [slices](/courses/python/list-methods-and-slicing) work for free. A `for` loop works too, because Python can fall back to asking for item 0, 1, 2 and so on. The modern way to make an object loopable is `__iter__`, which you will learn in [Iterators and Generators](/courses/python/iterators-and-generators). And since an empty playlist has length 0, it counts as `False`.

## Calling an object like a function: __call__

With `__call__`, an object can be used with brackets, like a function:

```python
class Multiplier:
    def __init__(self, factor):
        self.factor = factor

    def __call__(self, value):
        return value * self.factor

double = Multiplier(2)
print(double(21))
print(list(map(double, [1, 2, 3])))
```

Output:

```text
42
[2, 4, 6]
```

## A quick reference

| Method | Triggered by |
| --- | --- |
| `__init__` | `MyClass(...)` |
| `__str__` / `__repr__` | `print(obj)`, `str(obj)` / `repr(obj)`, the REPL |
| `__eq__`, `__lt__` | `==`, `<` (and sorting) |
| `__add__`, `__sub__`, `__mul__` | `+`, `-`, `*` |
| `__len__`, `__getitem__`, `__contains__` | `len()`, `obj[i]`, `in` |
| `__call__` | `obj(...)` |
| `__enter__` / `__exit__` | the [with statement](/courses/python/with-and-context-managers) |

The full list is in the [Python data model docs](https://docs.python.org/3/reference/datamodel.html#special-method-names).

## Common mistakes

**1. Printing instead of returning in `__str__`.**

```python
class Book:
    def __init__(self, title):
        self.title = title

    def __str__(self):
        print(self.title)

print(Book("Dune"))
```

```text
Dune
TypeError: __str__ returned non-string (type NoneType)
```

`__str__` and `__repr__` must **return** a string. Fix: `return self.title`.

**2. Not checking the other type in an operator.**

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

Vector(1, 2) + 5
```

```text
AttributeError: 'int' object has no attribute 'x'
```

The error is confusing. Add `if not isinstance(other, Vector): return NotImplemented` at the top of `__add__`, and Python gives a clear message instead:

```text
TypeError: unsupported operand type(s) for +: 'Vector' and 'int'
```

**3. Writing `__eq__` and then using objects in a set or as dict keys.**

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

print({Point(1, 2)})
```

```text
TypeError: cannot use 'Point' as a set element (unhashable type: 'Point')
```

When you define `__eq__`, Python removes the default `__hash__`, because equal objects must have equal hashes. [Sets](/courses/python/sets) and dict keys need a hash. Add one based on the same data:

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return isinstance(other, Point) and (self.x, self.y) == (other.x, other.y)

    def __hash__(self):
        return hash((self.x, self.y))

print(len({Point(1, 2), Point(1, 2)}))
```

```text
1
```

**4. Sorting objects with no `__lt__`.**

```text
TypeError: '<' not supported between instances of 'Student' and 'Student'
```

Add `__lt__`, or sort with `key=`.

## Quick recap

- Dunder methods like `__str__` and `__add__` let your objects work with Python's built-in syntax.
- `__repr__` is for developers, `__str__` is for users. Both must return a string.
- `__eq__` defines `==`. `__lt__` makes objects sortable.
- Return `NotImplemented` when the other object is a type you do not support.
- `__len__`, `__getitem__` and `__contains__` make an object act like a container.
- If you write `__eq__` and need sets or dict keys, also write `__hash__`.

Writing `__init__`, `__repr__` and `__eq__` by hand gets repetitive. [Data Classes](/courses/python/dataclasses) can write them for you, but first you will learn to protect your data in [Properties and Encapsulation](/courses/python/properties-and-encapsulation).

<code id="code-content" class="language-python">
# main.py: a Money class that feels like a built-in type
from functools import total_ordering
#
@total_ordering  # fills in &lt;=, &gt;, &gt;= from __eq__ and __lt__
class Money:
    def __init__(self, amount: float, currency: str = "EUR"):
        self.amount = round(amount, 2)
        self.currency = currency
#
    def __repr__(self) -&gt; str:
        return f"Money({self.amount}, {self.currency!r})"
#
    def __str__(self) -&gt; str:
        return f"{self.amount:.2f} {self.currency}"
#
    def _check(self, other) -&gt; bool:
        return isinstance(other, Money) and other.currency == self.currency
#
    def __eq__(self, other):
        if not self._check(other):
            return NotImplemented
        return self.amount == other.amount
#
    def __lt__(self, other):
        if not self._check(other):
            return NotImplemented
        return self.amount &lt; other.amount
#
    def __hash__(self):
        return hash((self.amount, self.currency))
#
    def __add__(self, other):
        if not self._check(other):
            return NotImplemented
        return Money(self.amount + other.amount, self.currency)
#
    def __mul__(self, factor: float):
        return Money(self.amount * factor, self.currency)
#
    def __bool__(self) -&gt; bool:
        return self.amount != 0
#
if __name__ == "__main__":
    coffee = Money(3.5)
    cake = Money(4.25)
    print("Coffee:", coffee)
    print("Total:", coffee + cake)
    print("Three coffees:", coffee * 3)
    print("Cheapest:", min([cake, coffee]))
    print("Cake costs more?", cake &gt; coffee)
    print("Free?", not Money(0))
    print(repr(cake))
    print("Unique prices:", len({Money(1), Money(1), Money(2)}))
</code></pre>

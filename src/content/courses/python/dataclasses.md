---
publishDate: 2026-10-27T08:55
title: 'Data Classes'
slug: dataclasses
metadescription: 'Learn how the @dataclass decorator writes __init__, __repr__ and __eq__ for you, plus defaults, field(), frozen and sortable data classes.'
updateDate: 2026-10-27T08:55
author: ['bishal-biswas']
level: 2
tags: ['python', 'oop', 'dataclasses']
course: python
---

## What is a data class?

Many classes you write exist mostly to **hold data**: a book with a title and a page count, a point with `x` and `y`, a task with a name and a due date. For these classes you keep typing the same boring code: an `__init__` that copies every argument onto `self`, a `__repr__` so the object prints nicely, and an `__eq__` so two objects with the same values count as equal.

A **data class** is a normal class where Python writes that boring code for you. You only list the fields (the pieces of data) and their types. Think of it like filling in a form template instead of drawing the whole form by hand.

Data classes come from the `dataclasses` module in the standard library and work in any modern Python 3 (they arrived in Python 3.7). In this lesson you will build on what you learned in [Classes and Objects](/courses/python/classes-and-objects) and [Special (Dunder) Methods](/courses/python/dunder-methods).

## The problem: a plain class

Here is a small `Book` class written the normal way:

```python
class Book:
    def __init__(self, title, author, pages):
        self.title = title
        self.author = author
        self.pages = pages


book = Book("Dune", "Frank Herbert", 412)
print(book)
print(book == Book("Dune", "Frank Herbert", 412))
```

Output:

```text
<__main__.Book object at 0x000001B78B7BC6E0>
False
```

Two problems. Printing the book shows a memory address, which tells you nothing. And two books with exactly the same values are **not** equal, because by default `==` checks whether they are the very same object. You could fix both by writing `__repr__` and `__eq__` yourself, but that is a lot of typing for every class.

## Your first data class

Now the same idea with `@dataclass`:

```python
from dataclasses import dataclass


@dataclass
class Book:
    title: str
    author: str
    pages: int


book = Book("Dune", "Frank Herbert", 412)
print(book)
print(book.title)
print(book == Book("Dune", "Frank Herbert", 412))
```

Output:

```text
Book(title='Dune', author='Frank Herbert', pages=412)
Dune
True
```

Here is what happened:

- `@dataclass` is a **decorator**: a line starting with `@` that changes the class (or function) right below it. You will learn how decorators work in [Decorators](/courses/python/decorators).
- Each line like `title: str` declares a **field**. The part after the colon is a [type hint](/courses/python/type-hints). The types are labels for you and your editor; Python does not check them at runtime.
- From those fields, Python generated `__init__`, `__repr__` and `__eq__` for you. The fields go into `__init__` in the order you wrote them.

| Generated method | What it gives you |
| --- | --- |
| `__init__` | `Book("Dune", "Frank Herbert", 412)` just works |
| `__repr__` | A readable printout with every field |
| `__eq__` | Two objects are equal when all their fields are equal |

> **Note:** A field **must** have a type hint. A line like `title = "x"` without a type is treated as a normal class attribute, not a field.

## Default values and field()

You can give a field a default value, just like a default argument in a [function](/courses/python/function-arguments). Fields with defaults must come **after** fields without them.

Lists and dictionaries need special care. If every book shared one default list, adding a tag to one book would add it to all of them (you saw this kind of surprise in [Mutable vs Immutable](/courses/python/mutability-and-copying)). So for mutable defaults you use `field(default_factory=list)`. A **factory** is a function that Python calls to make a brand new value each time.

```python
from dataclasses import dataclass, field


@dataclass
class Book:
    title: str
    author: str
    pages: int = 0
    tags: list[str] = field(default_factory=list)


a = Book("Dune", "Frank Herbert")
b = Book("Emma", "Jane Austen", 474, ["classic"])
a.tags.append("sci-fi")
print(a)
print(b)
```

Output:

```text
Book(title='Dune', author='Frank Herbert', pages=0, tags=['sci-fi'])
Book(title='Emma', author='Jane Austen', pages=474, tags=['classic'])
```

Each book got its own list, so adding `"sci-fi"` to `a` did not touch `b`.

## Methods and __post_init__

A data class is still a normal class. You can add your own methods. There is also a special hook called `__post_init__`. Python runs it right after the generated `__init__` finishes, which makes it a great place to check values.

```python
from dataclasses import dataclass


@dataclass
class Book:
    title: str
    pages: int

    def is_long(self):
        return self.pages > 400

    def __post_init__(self):
        if self.pages < 0:
            raise ValueError("pages cannot be negative")


print(Book("Dune", 412).is_long())
print(Book("Hamlet", 160).is_long())
Book("Oops", -5)
```

Output:

```text
True
False
Traceback (most recent call last):
  ...
ValueError: pages cannot be negative
```

Raising an error for bad data is covered in [Raising Errors and Custom Exceptions](/courses/python/raising-and-custom-exceptions).

## Frozen data classes

Sometimes an object should never change after it is made, like a point on a map. Pass `frozen=True` and the object becomes **read-only**. As a bonus, frozen objects can be used as dictionary keys or put in [sets](/courses/python/sets).

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Point:
    x: int
    y: int


p = Point(2, 3)
print(p)
print({p: "home"})
p.x = 10
```

Output:

```text
Point(x=2, y=3)
{Point(x=2, y=3): 'home'}
Traceback (most recent call last):
  ...
dataclasses.FrozenInstanceError: cannot assign to field 'x'
```

## Sorting, asdict() and replace()

Pass `order=True` and Python also writes `<`, `>`, `<=` and `>=`. Objects are compared field by field, in order, like comparing [tuples](/courses/python/tuples-and-unpacking). The module also has two handy helpers:

- `asdict(obj)` turns the object into a plain [dictionary](/courses/python/dictionaries), which is perfect for saving to [JSON](/courses/python/json-and-csv).
- `replace(obj, field=value)` makes a **copy** with some fields changed. It is especially useful with frozen classes.

```python
from dataclasses import dataclass, asdict, replace


@dataclass(order=True)
class Score:
    points: int
    name: str


scores = [Score(70, "Ana"), Score(95, "Ben"), Score(82, "Cy")]
print(sorted(scores))
print(max(scores).name)
print(asdict(scores[0]))
print(replace(scores[0], points=75))
```

Output:

```text
[Score(points=70, name='Ana'), Score(points=82, name='Cy'), Score(points=95, name='Ben')]
Ben
{'points': 70, 'name': 'Ana'}
Score(points=75, name='Ana')
```

Because `points` is the first field, it decides the order. Put the field you want to sort by first.

## When to use a data class

| Use a data class when... | Use a normal class when... |
| --- | --- |
| The class mainly stores values | The class mainly does work (has lots of behavior) |
| You want free printing and comparing | You need full control over `__init__` |
| You would otherwise use a dictionary with fixed keys | Fields are computed or hidden behind [properties](/courses/python/properties-and-encapsulation) |

> **Tip:** If you find yourself passing around dictionaries like `{"title": ..., "pages": ...}` with the same keys everywhere, a data class is usually cleaner. Your editor can then autocomplete `book.title` and catch typos.

## Common mistakes

**1. Using a list as a default.**

```python
from dataclasses import dataclass


@dataclass
class Bad:
    tags: list = []
```

```text
ValueError: mutable default <class 'list'> for field tags is not allowed: use default_factory
```

Fix: use `tags: list = field(default_factory=list)`.

**2. A field without a default after a field with one.**

```python
from dataclasses import dataclass


@dataclass
class Book:
    title: str = "Untitled"
    pages: int
```

```text
TypeError: non-default argument 'pages' follows default argument 'title'
```

Fix: move fields with defaults to the bottom.

**3. Naming your file `dataclasses.py`.** If your own script is called `dataclasses.py`, `from dataclasses import dataclass` imports **your** file instead of the standard library one:

```text
ImportError: cannot import name 'dataclass' from 'dataclasses' (consider renaming '...\dataclasses.py' since it has the same name as the standard library module named 'dataclasses' and prevents importing that standard library module)
```

Fix: rename your file, for example to `books.py`. The same goes for `json.py`, `random.py` and other module names.

## Quick recap

- `@dataclass` writes `__init__`, `__repr__` and `__eq__` from the fields you list.
- Every field needs a type hint, like `pages: int`.
- Put fields with defaults last, and use `field(default_factory=list)` for list or dict defaults.
- `__post_init__` runs after `__init__` and is great for validation.
- `frozen=True` makes objects read-only; `order=True` makes them sortable.
- `asdict()` converts to a dictionary; `replace()` makes a changed copy.

Next, you will put all your object-oriented skills to work in [Project: Bank Account System](/courses/python/project-bank-account).

<code id="code-content" class="language-python">
# main.py: a tiny reading list built with data classes
from dataclasses import dataclass, field, asdict, replace
#
#
@dataclass
class Book:
    """One book on the reading list."""
    title: str
    author: str
    pages: int = 0
    tags: list[str] = field(default_factory=list)  # a fresh list for every book
#
    def __post_init__(self):
        # Runs right after the generated __init__, a good place to check values
        if self.pages &lt; 0:
            raise ValueError("pages cannot be negative")
#
    def is_long(self) -&gt; bool:
        return self.pages &gt; 400
#
#
@dataclass(frozen=True, order=True)
class Rating:
    """A frozen (read-only) rating that can be sorted."""
    stars: int
    title: str
#
#
if __name__ == "__main__":
    books = [
        Book("Dune", "Frank Herbert", 412, ["sci-fi"]),
        Book("Emma", "Jane Austen", 474),
        Book("Hamlet", "William Shakespeare", 160),
    ]
    for book in books:
        print(book)
    # Free __eq__: compares field by field
    print(books[2] == Book("Hamlet", "William Shakespeare", 160))
    # Methods work just like in normal classes
    print([b.title for b in books if b.is_long()])
    # asdict() turns a data class into a plain dictionary
    print(asdict(books[0]))
    # replace() makes a changed copy
    print(replace(books[2], pages=200))
    # order=True lets you sort ratings by stars, then title
    ratings = [Rating(4, "Dune"), Rating(5, "Emma"), Rating(3, "Hamlet")]
    print(sorted(ratings, reverse=True)[0])
</code></pre>

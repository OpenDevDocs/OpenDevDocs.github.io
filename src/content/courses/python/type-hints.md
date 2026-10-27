---
publishDate: 2026-10-27T08:36
title: 'Type Hints: Labeling Your Data'
slug: type-hints
metadescription: 'Add type hints to Python variables and functions: basic types, lists and dicts, optional values with None, and checking your code with mypy.'
updateDate: 2026-10-27T08:36
author: ['bishal-biswas']
level: 2
tags: ['python', 'beginners', 'functions', 'type-hints']
course: python
---

## What are type hints?

Python does not make you say what kind of data a variable holds. You can write `age = 36` and Python figures out that it is an `int`. That is friendly for beginners, but in bigger programs it gets hard to remember: does this function want a number or a string? Does it return a list or a single item?

**Type hints** (also called **type annotations**) are small labels you add to your code that say which [data types](/courses/python/data-types) you expect. They look like this:

```python
def add(a: int, b: int) -> int:
    return a + b
```

Read it out loud as: "`add` takes `a`, which is an int, and `b`, which is an int, and returns an int."

Think of type hints like the labels on kitchen jars. The jar works the same with or without a label, but the label stops you from putting salt in your coffee.

In this lesson you will learn:

- How to label variables, parameters and return values
- How to describe lists, dictionaries and values that might be `None`
- That Python itself **does not enforce** hints
- How a tool called **mypy** uses hints to catch bugs before you run your code

## Hints do not change how Python runs

This is the most important thing to understand. Python reads type hints, stores them, and then **ignores them** when running your program:

```python
def add(a: int, b: int) -> int:
    return a + b


print(add(2, 3))
print(add("2", "3"))
```

Output:

```text
5
23
```

The second call passes strings, even though the hints say `int`. Python does not complain. It happily joins `"2"` and `"3"` into `"23"`.

So why bother? Because hints help **people and tools**:

- Your code editor ([VS Code](/courses/python/setting-up-vs-code), for example) uses them to show better autocomplete and to underline mistakes.
- A **type checker** like mypy reads them and warns you about bugs without running the code.
- Other people (and future you) can see what a function expects at a glance.

## Labeling variables

Put a colon and the type after the variable name:

```python
name: str = "Ada"
age: int = 36
height: float = 1.65
is_admin: bool = False

print(name, age, height, is_admin)
```

Output:

```text
Ada 36 1.65 False
```

In practice, you rarely need hints on simple variables like these, because the value already makes the type obvious. Hints are most useful on **functions**.

## Labeling functions

For [functions](/courses/python/functions), put a hint after each parameter, and use `->` before the colon to describe the return value:

```python
def log(message: str) -> None:
    print("[LOG]", message)


def greet(name: str, greeting: str = "Hello") -> str:
    return f"{greeting}, {name}!"


log("App started")
print(greet("Ada"))
print(greet("Linus", greeting="Hi"))
```

Output:

```text
[LOG] App started
Hello, Ada!
Hi, Linus!
```

- `-> None` means "this function does not return anything useful". It just does a job, like printing.
- With a [default value](/courses/python/function-arguments), the hint comes first, then `= default`: `greeting: str = "Hello"`.

## The basic types

| Hint | Meaning | Example value |
|---|---|---|
| `int` | Whole number | `42` |
| `float` | Decimal number | `3.14` |
| `str` | Text | `"hello"` |
| `bool` | True or False | `True` |
| `None` | Nothing | `None` |

> **Note:** A hint of `float` also accepts an `int`. So `def half(x: float)` is happy with `half(10)`.

## Lists, dictionaries and other collections

For collections, you also say what is **inside** them, using square brackets:

```python
def average(scores: list[float]) -> float:
    return sum(scores) / len(scores)


def count_words(text: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for word in text.lower().split():
        counts[word] = counts.get(word, 0) + 1
    return counts


point: tuple[int, int] = (3, 4)
tags: set[str] = {"python", "beginner"}

print(average([90, 85.5, 77]))
print(count_words("the cat saw the dog"))
print(point, sorted(tags))
```

Output:

```text
84.16666666666667
{'the': 2, 'cat': 1, 'saw': 1, 'dog': 1}
(3, 4) ['beginner', 'python']
```

| Hint | Read it as |
|---|---|
| `list[str]` | A list of strings |
| `dict[str, int]` | A dictionary with string keys and int values |
| `tuple[int, int]` | A tuple of exactly two ints |
| `set[str]` | A set of strings |

> **Tip:** You may see older code that writes `List[str]` or `Dict[str, int]` with capital letters, imported from the `typing` module. Since Python 3.9 the lowercase built-in names work directly, so you do not need those imports.

## Either this or that: the | symbol

Sometimes a value can be one of several types. Use `|` (read it as "or"). This needs Python 3.10 or newer:

```python
def find_user(user_id: int) -> str | None:
    users = {1: "Ada", 2: "Linus"}
    return users.get(user_id)


def to_text(value: int | float) -> str:
    return f"{value:.2f}"


print(find_user(1))
print(find_user(99))
print(to_text(3), to_text(2.5))
```

Output:

```text
Ada
None
3.00 2.50
```

`str | None` is very common. It says "this might give you a string, or it might give you nothing", which reminds whoever calls it to check for [None](/courses/python/booleans-and-none) before using the result. Older code writes the same idea as `Optional[str]`.

## A few more useful hints

### Functions as arguments

When a parameter is a function (like in [Lambda and Higher-Order Functions](/courses/python/lambda-and-higher-order-functions)), use `Callable`. Inside the brackets, list the argument types, then the return type:

```python
from collections.abc import Callable


def apply_twice(func: Callable[[int], int], value: int) -> int:
    return func(func(value))


print(apply_twice(lambda n: n * 3, 2))
```

Output:

```text
18
```

### Giving a type a name

If a hint is long or used many times, give it a short name with the `type` statement (Python 3.12 or newer):

```python
type Point = tuple[float, float]


def distance(a: Point, b: Point) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


print(distance((0, 0), (3, 4)))
```

Output:

```text
5.0
```

### Peeking at the hints

Python stores the hints on the function, so you can see them yourself:

```python
def add(a: int, b: int) -> int:
    return a + b


print(add.__annotations__)
```

Output:

```text
{'a': <class 'int'>, 'b': <class 'int'>, 'return': <class 'int'>}
```

## Catching bugs with mypy

**mypy** is a free tool that reads your hints and checks that your code follows them, without running it. It is not part of Python, so you install it with pip. You will learn about pip and keeping installs tidy in [Installing Packages with pip](/courses/python/pip-and-packages) and [Virtual Environments with venv](/courses/python/virtual-environments). Inside a virtual environment, it looks like this:

```bash
python3 -m pip install mypy
```

```powershell
python -m pip install mypy
```

Now save this file as `main.py`:

```python
def add(a: int, b: int) -> int:
    return a + b


total = add(2, 3)
label = add("2", "3")
```

Running it with Python prints nothing and raises no error. But mypy spots the problem:

```bash
python3 -m mypy main.py
```

Output:

```text
main.py:6: error: Argument 1 to "add" has incompatible type "str"; expected "int"  [arg-type]
main.py:6: error: Argument 2 to "add" has incompatible type "str"; expected "int"  [arg-type]
Found 2 errors in 1 file (checked 1 source file)
```

It tells you the file, the line number (`6`) and exactly what is wrong. When everything matches, you get a happy message:

```text
Success: no issues found in 1 source file
```

> **Tip:** The **Pylance** extension in VS Code does similar checks while you type. Set "Python > Analysis: Type Checking Mode" to `basic` to see type mistakes underlined in red.

## Common mistakes

### Expecting Python to stop wrong types

Hints are not rules that Python enforces. If you need to reject bad input while the program runs, you still need a real check, such as `isinstance()` and an error. You will learn how in [Raising Errors and Custom Exceptions](/courses/python/raising-and-custom-exceptions).

### A hint that does not match the value

```python
def shout(text: str) -> str:
    return text.upper()


result: int = shout("hi")
print(result)
```

Python prints `HI` without complaint, but the label `int` is wrong. mypy catches it:

```text
main.py:5: error: Incompatible types in assignment (expression has type "str", variable has type "int")  [assignment]
Found 1 error in 1 file (checked 1 source file)
```

**Fix:** change the hint to `result: str`, or remove it and let the tools work out the type themselves.

### Writing the return arrow in the wrong place

The `-> type` goes **after** the closing parenthesis and **before** the colon: `def area(w: float, h: float) -> float:`. Writing it anywhere else is a `SyntaxError`.

## Quick recap

- **Type hints** label what type a variable, parameter or return value should be.
- Syntax: `name: type` for variables and parameters, `-> type` for return values.
- Describe what is inside collections: `list[str]`, `dict[str, int]`.
- Use `|` for "either", like `str | None` (Python 3.10+).
- Python **ignores** hints when running. Tools like **mypy** and your editor use them to find bugs early.
- Hints are optional, so add them where they make your code clearer, especially on functions.

Next, you will learn how to describe what your functions do in [Docstrings and Writing Clean Functions](/courses/python/docstrings-and-clean-functions).

<code id="code-content" class="language-python">
# main.py: type hints on variables, functions and collections
from collections.abc import Callable
#
# A short name for a type we use more than once (Python 3.12+)
type Scores = dict[str, list[int]]
#
def average(numbers: list[int]) -&gt; float:
    # Takes a list of ints, returns a float
    return sum(numbers) / len(numbers)
#
def best_student(scores: Scores) -&gt; str | None:
    # Returns a name, or None if there are no students
    if not scores:
        return None
    return max(scores, key=lambda name: average(scores[name]))
#
def report(scores: Scores, fmt: Callable[[float], str]) -&gt; None:
    # Returns nothing useful, it only prints
    for name, marks in scores.items():
        print(f"{name}: {fmt(average(marks))}")
#
def one_decimal(value: float) -&gt; str:
    return f"{value:.1f}"
#
if __name__ == "__main__":
    class_scores: Scores = {
        "Asha": [88, 92, 79],
        "Ben": [95, 90, 98],
        "Chen": [72, 85, 80],
    }
    report(class_scores, one_decimal)
    print("Best:", best_student(class_scores))
    print("Empty class:", best_student({}))
    print(average.__annotations__)
</code></pre>

---
publishDate: 2026-10-27T08:29
title: 'Mutable vs Immutable: Copying Data Safely'
slug: mutability-and-copying
metadescription: 'Understand mutable and immutable types in Python, why two variables can share one list, and how to make shallow and deep copies to avoid surprise bugs.'
updateDate: 2026-10-27T08:29
author: ['bishal-biswas']
level: 2
tags: ['python', 'mutability', 'copying', 'data-structures']
course: python
---

## A surprising bug

Try to guess what this program prints:

```python
original = ["milk", "eggs"]
backup = original
original.append("bread")
print("original:", original)
print("backup:", backup)
```

Output:

```text
original: ['milk', 'eggs', 'bread']
backup: ['milk', 'eggs', 'bread']
```

Most beginners expect `backup` to still be `["milk", "eggs"]`. But both lists show `"bread"`. Why? Because there was only ever **one** list. `backup = original` did not copy anything.

This lesson explains what is really going on. Once you understand it, a whole family of confusing bugs simply goes away. You will learn:

- What variables really are in Python
- The difference between **mutable** and **immutable** types
- How to make **shallow** and **deep** copies
- Why default values like `[]` in functions can be dangerous

## Variables are name tags, not boxes

In earlier lessons you may have pictured a [variable](/courses/python/variables) as a box with a value inside. That picture is fine for numbers and strings, but it breaks down for lists.

A better picture: a value (an **object**) lives somewhere in memory, and a variable is a **name tag** stuck onto it. One object can have several name tags.

```text
original ──┐
           ├──>  ["milk", "eggs", "bread"]
backup   ──┘
```

`backup = original` just sticks a second tag onto the same list. When you change the list through one name, you see the change through the other, because it is the same list.

### Checking with `is` and `id()`

Python can tell you whether two names point at the same object:

- `a is b` is `True` when both names point at the **same object**.
- `a == b` is `True` when the two objects have **equal values**.
- `id(a)` gives a number that identifies the object. Same object, same id.

```python
a = [1, 2, 3]
b = a
c = [1, 2, 3]

print(a == b, a is b)
print(a == c, a is c)
print(id(a) == id(b))
```

Output:

```text
True True
True False
True
```

`a` and `c` look the same (`==` is `True`), but they are two separate lists (`is` is `False`).

## Mutable and immutable types

An object is **mutable** if it can be changed after it is created. It is **immutable** if it can never change.

| Immutable (cannot change) | Mutable (can change) |
|---|---|
| `int`, `float`, `bool` | `list` |
| `str` | `dict` |
| `tuple` | `set` |
| `None` | most objects you create with classes |

With immutable types, the sharing problem never shows up. "Changing" a number or a string actually makes a **new** object and moves the name tag to it:

```python
x = 10
y = x
x = x + 5
print(x, y)

name = "ada"
other = name
name = name.upper()
print(name, other)
```

Output:

```text
15 10
ADA ada
```

`x + 5` built a new number, and `x` now points at it. `y` still points at the old `10`. String methods like `upper()` also return a **new** string; they never change the original (see [Useful String Methods](/courses/python/string-methods)).

Lists are different. `append()`, `sort()`, `remove()` and item assignment change the **existing** list. Every name pointing at it sees the change.

> **Note:** There is a difference between **changing an object** (`my_list.append(4)`) and **pointing a name at a new object** (`my_list = [4]`). Only the first one affects other names.

```python
a = [1, 2]
b = a
a = [9, 9]
print(a, b)
```

Output:

```text
[9, 9] [1, 2]
```

Here `a` got a brand new list, so `b` is untouched.

## Functions share objects too

When you pass a list to a function, the function gets a name tag for the **same list**. If the function changes it, the caller sees the change:

```python
def add_bonus(scores):
    for i in range(len(scores)):
        scores[i] += 5

my_scores = [70, 80]
add_bonus(my_scores)
print(my_scores)
```

Output:

```text
[75, 85]
```

Sometimes that is what you want. Often it is a surprise. You will write lots of functions starting in [Defining and Calling Functions](/courses/python/functions), so keep this in mind.

## Making a shallow copy

To get a separate list, you must ask for a **copy**. For a list, any of these work:

```python
original = ["milk", "eggs"]

copy1 = original.copy()
copy2 = list(original)
copy3 = original[:]

original.append("bread")
print(original)
print(copy1, copy2, copy3)
```

Output:

```text
['milk', 'eggs', 'bread']
['milk', 'eggs'] ['milk', 'eggs'] ['milk', 'eggs']
```

Dictionaries and sets have `.copy()` too, plus `dict(d)` and `set(s)`.

These are called **shallow copies**. A shallow copy makes a new outer container, but the items inside are **shared** with the original. For numbers and strings that does not matter, since they cannot change. For nested lists it does.

## The nested list trap

```python
grid = [[1, 2], [3, 4]]
shallow = grid.copy()

shallow.append([5, 6])
shallow[0].append(99)

print("grid:   ", grid)
print("shallow:", shallow)
```

Output:

```text
grid:    [[1, 2, 99], [3, 4]]
shallow: [[1, 2, 99], [3, 4], [5, 6]]
```

Appending `[5, 6]` only changed the copy, because the outer lists are separate. But `shallow[0].append(99)` changed the inner list, and that inner list is **shared** by both, so `grid` changed too.

```text
grid    ──> [ ●  ,  ● ]
              │     │
              v     v
         [1, 2, 99] [3, 4]     (shared by both)
              ^     ^
              │     │
shallow ──> [ ●  ,  ●  , [5, 6] ]
```

## Making a deep copy

A **deep copy** copies the container **and** everything inside it, all the way down. Use `deepcopy()` from the `copy` module:

```python
import copy

grid = [[1, 2], [3, 4]]
deep = copy.deepcopy(grid)

deep[0].append(99)
print("grid:", grid)
print("deep:", deep)
```

Output:

```text
grid: [[1, 2], [3, 4]]
deep: [[1, 2, 99], [3, 4]]
```

Now the two are completely independent. (`import` loads a module, a file of extra tools. You will learn all about it in [Modules and import](/courses/python/modules-and-imports).)

| Way | New outer container? | New inner items? | Use when |
|---|---|---|---|
| `b = a` | No | No | You want two names for the same thing |
| `a.copy()`, `list(a)`, `a[:]` | Yes | No (shared) | Items are numbers, strings or tuples |
| `copy.deepcopy(a)` | Yes | Yes | Items are lists, dicts or other mutable things |

## The `[[]] * n` trap

Multiplying a list repeats its items. With a nested list, that repeats the **same** inner list:

```python
board = [[0] * 3] * 3
board[0][0] = "X"
print(board)
```

Output:

```text
[['X', 0, 0], ['X', 0, 0], ['X', 0, 0]]
```

One change appears in every row, because all three rows are one list. **Fix:** build each row separately with a [comprehension](/courses/python/comprehensions):

```python
board = [[0] * 3 for _ in range(3)]
board[0][0] = "X"
print(board)
```

Output:

```text
[['X', 0, 0], [0, 0, 0], [0, 0, 0]]
```

## The mutable default argument trap

This one catches experienced programmers too. A function's default value is created **once**, when the function is defined, not each time it is called:

```python
def add_item(item, basket=[]):
    basket.append(item)
    return basket

print(add_item("apple"))
print(add_item("pear"))
```

Output:

```text
['apple']
['apple', 'pear']
```

The second call remembered `"apple"`, because both calls shared the same default list. The usual fix is to use `None` as the default and create a fresh list inside:

```python
def add_item(item, basket=None):
    if basket is None:
        basket = []
    basket.append(item)
    return basket

print(add_item("apple"))
print(add_item("pear"))
```

Output:

```text
['apple']
['pear']
```

You will learn more about default values in [Function Arguments: Defaults, Keywords, *args and **kwargs](/courses/python/function-arguments).

## Common mistakes

- **Using `=` to "copy" a list.** It only adds a second name. Use `.copy()` or `copy.deepcopy()`.
- **Using `is` to compare values.** `is` checks identity, not equality. Use `==` for values. The one common exception is `x is None`, which is the correct way to check for `None`.
- **Shallow copying nested data.** If your list holds lists (or dicts), a shallow copy still shares the insides. Use `deepcopy()`.
- **Writing `[[]] * n`.** Use `[[] for _ in range(n)]` instead.

## Quick recap

- Variables are name tags on objects. `b = a` makes two tags for one object.
- Immutable types (`int`, `float`, `str`, `tuple`, `bool`, `None`) can never change, so sharing is safe.
- Mutable types (`list`, `dict`, `set`) can change, and every name sees the change.
- `==` compares values, `is` checks if two names point at the same object.
- `.copy()` makes a shallow copy. `copy.deepcopy()` copies nested data too.
- Never use a mutable value like `[]` as a default argument. Use `None`.

Now put lists, dictionaries and loops together in a real program: [Project: Contact Book](/courses/python/project-contact-book).

<code id="code-content" class="language-python">
# main.py: seeing (and avoiding) shared-data surprises
import copy
#
# 1. Assignment does NOT copy: two names, one list
team = ["Ana", "Ben"]
same_team = team
team.append("Cara")
print("same_team:", same_team, "| same object?", same_team is team)
#
# 2. A shallow copy gives a separate outer list
roster = team.copy()
team.append("Dev")
print("roster:", roster, "| team:", team)
#
# 3. Nested data: a shallow copy still shares the inner lists
schedule = {"mon": ["gym"], "tue": ["swim"]}
shallow = schedule.copy()
deep = copy.deepcopy(schedule)
schedule["mon"].append("yoga")
print("shallow mon:", shallow["mon"])  # changed too
print("deep mon:", deep["mon"])        # safe
#
# 4. Build a grid row by row, never with [[...]] * n
grid = [["." for _ in range(3)] for _ in range(3)]
grid[1][1] = "X"
for row in grid:
    print(" ".join(row))
#
# 5. Use None, not [], as a default value
def add_task(task, tasks=None):
    if tasks is None:
        tasks = []
    tasks.append(task)
    return tasks
#
print(add_task("write"))
print(add_task("read"))
</code></pre>

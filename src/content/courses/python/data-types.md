---
publishDate: 2026-10-27T08:07
title: 'Data Types: An Overview'
slug: data-types
metadescription: 'A beginner tour of Python data types: int, float, str, bool, None, list, tuple, dict and set, plus type(), isinstance() and why types matter.'
updateDate: 2026-10-27T08:07
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'data-types']
course: python
---

## Why types matter

In [Variables and Assignment](/courses/python/variables) you stored values like `"Ada"` and `36` in variables. These two values are different **kinds** of data. One is text and one is a number, and Python treats them differently. You can multiply numbers, but what would it mean to multiply two names?

The kind of a value is called its **data type** (or just **type**). The type decides:

- What the value looks like
- What you can do with it (add, join, sort, look up...)
- How Python stores it

Think of types like containers in a kitchen. A jar holds liquids, a basket holds fruit, an egg box holds eggs. Each container is built for one kind of thing, and you use each one differently.

This lesson is a quick tour. Each type gets its own lesson later, so do not worry about the details yet.

## Checking a type with type()

The built-in `type()` function tells you the type of any value:

```python
print(type(42))
print(type(3.14))
print(type("hello"))
print(type(True))
print(type(None))
```

Output:

```text
<class 'int'>
<class 'float'>
<class 'str'>
<class 'bool'>
<class 'NoneType'>
```

Ignore the word `class` for now (you will learn about classes in [Classes and Objects](/courses/python/classes-and-objects)). The part in quotes is the type name.

## The basic types

These five are the building blocks. Each holds a single value.

| Type | Name | Example values | Used for |
| --- | --- | --- | --- |
| `int` | Integer | `5`, `-3`, `1_000_000` | Whole numbers: counts, ages, years |
| `float` | Floating point number | `3.14`, `19.99`, `0.5` | Numbers with a decimal point: prices, measurements |
| `str` | String | `"Hello"`, `'Hi'`, `""` | Text of any length |
| `bool` | Boolean | `True`, `False` | Yes/no answers |
| `NoneType` | None | `None` | "No value here" |

### int: whole numbers

An **integer** is a whole number with no decimal point. It can be positive, negative or zero, and as big as you like.

```python
apples = 5
temperature = -3
big = 1_000_000
print(apples, temperature, big)
```

Output:

```text
5 -3 1000000
```

The underscores in `1_000_000` are just there to make big numbers easier to read. Python ignores them.

### float: decimal numbers

A **float** is a number with a decimal point. The name comes from "floating point", the way computers store these numbers.

```python
price = 19.99
pi = 3.14159
half = 0.5
print(price, pi, half)
print(10 / 2)
```

Output:

```text
19.99 3.14159 0.5
5.0
```

Notice that `10 / 2` gives `5.0`, a float, not `5`. Normal division in Python always produces a float. You will learn all the number details in [Numbers and Math Operators](/courses/python/numbers-and-math).

### str: text

A **string** is a piece of text: a sequence of characters (letters, digits, spaces, symbols). Strings go inside quotes, either double `"` or single `'`.

```python
greeting = "Hello"
reply = 'Hi there'
empty = ""
print(greeting, reply)
print(len(greeting))
print(len(empty))
```

Output:

```text
Hello Hi there
5
0
```

`len()` counts the characters. `""` is an **empty string**: a string with nothing in it. Strings get two full lessons: [Strings: Working with Text](/courses/python/strings) and [Useful String Methods](/courses/python/string-methods).

### bool: True or False

A **Boolean** has only two possible values: `True` or `False` (with capital letters). Booleans answer yes/no questions. Comparisons produce them:

```python
is_raining = False
has_ticket = True
print(5 > 3)
print(5 < 3)
print(type(5 > 3))
```

Output:

```text
True
False
<class 'bool'>
```

Booleans are what `if` statements use to make decisions. More in [Booleans, Comparisons and None](/courses/python/booleans-and-none).

### None: no value

`None` is a special value meaning "nothing" or "no value yet". It is like an empty box with a label on it.

```python
middle_name = None
print(middle_name)
print(middle_name is None)
```

Output:

```text
None
True
```

You will use `None` when a value is missing or not known yet.

## Collection types

Collections hold **many values** in one variable. Here is a first look:

```python
colors = ["red", "green", "blue"]
point = (3, 4)
ages = {"Ada": 36, "Grace": 45}
tags = {"python", "code", "python"}
print(colors, type(colors))
print(point, type(point))
print(ages, type(ages))
print(len(tags), type(tags))
```

Output:

```text
['red', 'green', 'blue'] <class 'list'>
(3, 4) <class 'tuple'>
{'Ada': 36, 'Grace': 45} <class 'dict'>
2 <class 'set'>
```

| Type | Written with | What it is | Lesson |
| --- | --- | --- | --- |
| `list` | `[ ]` | An ordered collection you can change | [Lists: Ordered Collections](/courses/python/lists) |
| `tuple` | `( )` | An ordered collection you cannot change | [Tuples and Unpacking](/courses/python/tuples-and-unpacking) |
| `dict` | `{key: value}` | Pairs of keys and values, like a phone book | [Dictionaries: Key-Value Pairs](/courses/python/dictionaries) |
| `set` | `{ }` | Unique values with no order | [Sets: Collections of Unique Values](/courses/python/sets) |

The set `tags` has only 2 items, even though we wrote `"python"` twice. Sets automatically remove duplicates.

You can pick items out of collections. Lists use a position number (starting at 0), and dictionaries use a key:

```python
colors = ["red", "green", "blue"]
ages = {"Ada": 36, "Grace": 45}
print(colors[0])
print(ages["Grace"])
```

Output:

```text
red
45
```

## Types change what operators do

The same symbol can do different things depending on the types. Look at `+`:

```python
print("5" + "5")
print(5 + 5)
```

Output:

```text
55
10
```

With two strings, `+` **joins** them. With two numbers, `+` **adds** them. The quotes make all the difference.

Python also mixes `int` and `float` for you, and the result is a float:

```python
print(3 + 2.0)
print(7 / 2)
print(4 / 2)
```

Output:

```text
5.0
3.5
2.0
```

## Checking a type with isinstance()

`type()` is great for exploring. In real programs, the usual way to ask "is this value an integer?" is `isinstance()`:

```python
age = 36
print(isinstance(age, int))
print(isinstance(age, str))
```

Output:

```text
True
False
```

## Mutable and immutable

One more important idea. Some types can be **changed in place** after they are created. They are called **mutable**. Others can never be changed, only replaced. They are called **immutable**.

```python
colors = ["red", "green"]
colors.append("blue")
print(colors)
word = "cat"
print(word.upper())
print(word)
```

Output:

```text
['red', 'green', 'blue']
CAT
cat
```

The list really changed: it now has three items. But `word.upper()` did **not** change `word`. It made a brand new string `"CAT"` and left the original alone. Strings are immutable.

| Immutable (cannot change) | Mutable (can change) |
| --- | --- |
| `int`, `float`, `str`, `bool`, `None`, `tuple` | `list`, `dict`, `set` |

You will dig into why this matters in [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying).

## Common mistakes

### Mixing text and numbers with +

```python
print("Age: " + 36)
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print("Age: " + 36)
          ~~~~~~~~^~~~
TypeError: can only concatenate str (not "int") to str
```

A **TypeError** means you used a value of the wrong type for that operation. "Concatenate" means "join together". Python will not guess whether you want to join text or add numbers.

**Fix:** convert one side so both match. `str()` turns a value into a string and `int()` turns text into a whole number:

```python
print("Age: " + str(36))
print(int("36") + 1)
```

Output:

```text
Age: 36
37
```

Or simply pass both values to `print()` with a comma: `print("Age:", 36)`. You will learn more in [Converting Between Types](/courses/python/type-conversion).

### Numbers in quotes are text

`"5"` is a string, not a number. `"5" + "5"` gives `"55"`, not `10`. If you read numbers from the user, they arrive as text and must be converted first (see [Getting Input and Printing Output](/courses/python/input-and-output)).

### Trying to change a string

```python
word = "cat"
word[0] = "b"
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    word[0] = "b"
    ~~~~^^^
TypeError: 'str' object does not support item assignment
```

**Fix:** strings are immutable, so build a new one instead: `word = "b" + word[1:]`.

### Lowercase true and false

Writing `true` or `false` gives a `NameError`. Python's Booleans are `True` and `False`, with a capital first letter. The same goes for `None`.

## Quick recap

- Every value has a type. `type()` shows it and `isinstance()` checks it.
- Basic types: `int` (whole numbers), `float` (decimals), `str` (text), `bool` (`True`/`False`) and `None` (no value).
- Collections: `list` `[ ]`, `tuple` `( )`, `dict` `{key: value}` and `set` `{ }`.
- The type decides what operators do: `+` adds numbers but joins strings.
- You cannot mix `str` and `int` with `+` without converting.
- Lists, dicts and sets are mutable; numbers, strings and tuples are immutable.

Let's look closer at the first two types: [Numbers and Math Operators](/courses/python/numbers-and-math).

<code id="code-content" class="language-python">
# main.py: a tour of Python data types
# type() tells you the type of any value.
#
# Basic types
age = 36                 # int: whole number
height = 1.68            # float: number with a decimal point
name = "Ada"             # str: text
is_student = False       # bool: True or False
nickname = None          # None: no value
#
print(name, "is", age, "years old and", height, "m tall")
for value in [age, height, name, is_student, nickname]:
    print(repr(value), "is of type", type(value).__name__)
#
# Collection types
colors = ["red", "green", "blue"]       # list: ordered, changeable
point = (3, 4)                          # tuple: ordered, fixed
ages = {"Ada": 36, "Grace": 45}         # dict: key-value pairs
tags = {"python", "code", "python"}     # set: unique values only
#
print("First color:", colors[0])
print("Grace is", ages["Grace"])
print("Point x:", point[0])
print("Unique tags:", len(tags))
#
# The type changes what + does
print("5" + "5")   # joins text
print(5 + 5)       # adds numbers
#
# Convert before mixing text and numbers
print("Next year " + name + " will be " + str(age + 1))
#
# isinstance() checks a type
print(isinstance(age, int))
print(isinstance(name, int))
</code></pre>

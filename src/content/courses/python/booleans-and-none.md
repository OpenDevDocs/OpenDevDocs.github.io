---
publishDate: 2026-10-27T08:12
title: 'Booleans, Comparisons and None'
slug: booleans-and-none
metadescription: 'Understand True and False in Python, compare values with ==, <, > and friends, learn which values count as truthy or falsy, and use None to mean nothing.'
updateDate: 2026-10-27T08:12
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'booleans', 'basics']
course: python
---

## Yes or no questions

A lot of programming is about asking simple yes or no questions. Is the user logged in? Is the password long enough? Is the player out of lives? The answer to each one is either yes or no.

Python has a special data type for exactly these answers. It is called a **boolean** (named after George Boole, a mathematician who studied logic). A boolean can only ever be one of two values:

- `True` (yes)
- `False` (no)

In this lesson you will learn how to create booleans, how to get them by comparing values, which values Python treats as "kind of true" or "kind of false", and how to use the special value `None` to say "there is nothing here yet".

These ideas are the foundation for making decisions with [if, elif and else](/courses/python/if-elif-else) and for repeating code with [while loops](/courses/python/while-loops).

## True and False

You can store a boolean in a variable just like a number or a string:

```python
is_raining = True
has_umbrella = False
print(is_raining)
print(type(is_raining))
```

Output:

```text
True
<class 'bool'>
```

The type is `bool`, short for boolean. You met it briefly in [Data Types: An Overview](/courses/python/data-types).

Two important rules:

- `True` and `False` start with a **capital letter**. `true` is not the same thing.
- They have **no quotes**. `"True"` with quotes is just a string of four letters, not a boolean.

> **Tip:** Name boolean variables like a yes or no question: `is_open`, `has_paid`, `can_vote`. When you read `if is_open:` later, it sounds like plain English.

## Comparison operators

Most of the time you do not type `True` or `False` yourself. You get them by **comparing** two values. A **comparison operator** is a symbol that asks a question about two values and answers with a boolean.

| Operator | Question it asks | Example | Result |
| --- | --- | --- | --- |
| `==` | are they equal? | `5 == 5` | `True` |
| `!=` | are they different? | `5 != 5` | `False` |
| `>` | is the left bigger? | `7 > 3` | `True` |
| `<` | is the left smaller? | `7 < 3` | `False` |
| `>=` | bigger or equal? | `3 >= 3` | `True` |
| `<=` | smaller or equal? | `4 <= 3` | `False` |

Let's try them:

```python
age = 15
print(age > 12)
print(age < 12)
print(age == 15)
print(age != 15)
print(age >= 15)
print(age <= 14)
```

Output:

```text
True
False
True
False
True
False
```

> **Warning:** One equals sign `=` **stores** a value in a variable. Two equals signs `==` **compare** two values. Mixing them up is the most common beginner mistake in this lesson.

### Saving the answer

A comparison is an expression, so you can store its result:

```python
temperature = 31
is_hot = temperature > 30
print(is_hot)
```

Output:

```text
True
```

### Chained comparisons

Want to check if a number is between two others? Python lets you chain comparisons, just like in math class:

```python
age = 15
print(13 <= age <= 19)
```

Output:

```text
True
```

This reads as "13 is less than or equal to age, and age is less than or equal to 19". So, is this person a teenager? Yes.

### Comparing strings

You can compare text too. `==` checks if two strings are exactly the same, including capital letters.

```python
print("apple" == "apple")
print("apple" == "Apple")
print("apple" < "banana")
print("Zebra" < "apple")
```

Output:

```text
True
False
True
True
```

`<` and `>` on strings compare in dictionary order, letter by letter. But there is a twist: all capital letters come before all lowercase letters, so `"Zebra"` counts as "smaller" than `"apple"`. If you want to ignore case, compare `.lower()` versions, a trick from [Useful String Methods](/courses/python/string-methods).

### Comparing decimals

Whole numbers and decimals compare fine: `1 == 1.0` is `True`. But decimals can surprise you:

```python
print(0.1 + 0.2 == 0.3)
print(0.1 + 0.2)
```

Output:

```text
False
0.30000000000000004
```

Computers store decimals in binary, so some tiny rounding errors appear (you saw this in [Numbers and Math Operators](/courses/python/numbers-and-math)). To check if two decimals are "close enough", use `math.isclose()`:

```python
import math
print(math.isclose(0.1 + 0.2, 0.3))
```

Output:

```text
True
```

## Truthy and falsy values

Here is something Python does that surprises many beginners. Every value, not only `True` and `False`, can be treated as true or false. You can see how Python judges a value with the `bool()` function.

```python
print(bool(0))
print(bool(42))
print(bool(""))
print(bool("hi"))
print(bool([]))
print(bool(None))
print(bool(0.0))
print(bool(" "))
```

Output:

```text
False
True
False
True
False
False
False
True
```

A value that acts like `False` is called **falsy**. A value that acts like `True` is called **truthy**. The rule is simple: **empty or zero things are falsy, everything else is truthy.**

| Falsy values | Truthy examples |
| --- | --- |
| `False` | `True` |
| `0`, `0.0` | `42`, `-1`, `3.5` |
| `""` (empty string) | `"hi"`, `" "` (a space is not empty!) |
| `[]` (empty list) | `[1, 2]` |
| `None` | almost everything else |

Why does this matter? Because later you will write things like `if name:` to mean "if the name is not empty". You will use this a lot in [Making Decisions with if, elif and else](/courses/python/if-elif-else). Lists like `[]` are covered in [Lists: Ordered Collections](/courses/python/lists).

> **Note:** Under the hood, `True` behaves like the number `1` and `False` like `0`. That is why `True + True` gives `2`. It is a fun fact, but do not rely on it in normal code.

## None: the value that means "nothing"

Sometimes you need a variable, but you do not have a value for it yet. Maybe the user has not picked a favorite color. Maybe a search found no result. For this, Python has a special value called `None`.

**`None`** means "no value here". Think of it as an empty box with a label on it. The box exists, it just has nothing inside.

```python
result = None
print(result)
print(type(result))
```

Output:

```text
None
<class 'NoneType'>
```

`None` is not the same as `0`, `""` or `False`. Zero is a number, an empty string is text with no letters, and `None` is the absence of any value at all.

You will also meet `None` without asking for it. A function that does not send back a value gives you `None`. You will write your own functions in [Defining and Calling Functions](/courses/python/functions), but here is a sneak peek:

```python
def say_hi():
    print("Hi!")

value = say_hi()
print(value)
```

Output:

```text
Hi!
None
```

`say_hi()` printed something, but it did not **return** anything, so `value` is `None`.

### Checking for None with `is`

To check if something is `None`, use `is` and `is not` instead of `==`:

```python
middle_name = None
print(middle_name is None)
print(middle_name is not None)
```

Output:

```text
True
False
```

The `is` operator asks "is this the very same object?" There is only one `None` in the whole program, so `is None` is the clearest and safest test. It is the style every Python developer uses.

## Common mistakes

### Using `=` instead of `==`

```text
age = 15
if age = 15:
    print("yes")
```

Output:

```text
  File "main.py", line 2
    if age = 15:
       ^^^^^^^^
SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?
```

Python even suggests the fix. Use `==` to compare: `if age == 15:`.

### Lowercase true or false

```python
print(true)
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(true)
          ^^^^
NameError: name 'true' is not defined. Did you mean: 'True'?
```

Python thinks `true` is a variable name you never created. Fix: write `True` with a capital T.

### Comparing text with a number

```python
print("5" == 5)
```

Output:

```text
False
```

No error, but the answer may surprise you. The string `"5"` and the number `5` are different types, so they are never equal. And if you try `<` or `>` between them, you get `TypeError: '<' not supported between instances of 'int' and 'str'`. This often happens with user input, which is always text. You will learn the fix in [Converting Between Types](/courses/python/type-conversion).

## Quick recap

- A **boolean** is either `True` or `False`, capitalized and with no quotes.
- Comparison operators (`==`, `!=`, `<`, `>`, `<=`, `>=`) produce booleans.
- `=` stores a value, `==` compares two values.
- You can chain comparisons: `13 <= age <= 19`.
- Use `math.isclose()` to compare decimals.
- Zero, empty and `None` values are **falsy**. Everything else is **truthy**.
- `None` means "no value". Check it with `is None` or `is not None`.

Next, you will learn how to turn text into numbers and back again in [Converting Between Types](/courses/python/type-conversion).

<code id="code-content" class="language-python">
# main.py: booleans, comparisons and None in one place
import math
#
age = 15
temperature = 31
nickname = ""
favorite_color = None
#
# Comparisons give back True or False
is_teen = 13 &lt;= age &lt;= 19
is_hot = temperature &gt; 30
print(f"Teenager? {is_teen}")
print(f"Hot day? {is_hot}")
print(f"Exactly 15? {age == 15}")
print(f"Not 15? {age != 15}")
#
# Strings compare letter by letter, and case matters
print("apple" == "Apple")
print("apple".lower() == "Apple".lower())
#
# Decimals: use math.isclose instead of ==
print(0.1 + 0.2 == 0.3)
print(math.isclose(0.1 + 0.2, 0.3))
#
# Truthy and falsy: empty and zero values act like False
print(bool(0), bool(42), bool(""), bool("hi"), bool(None))
print(f"Has a nickname? {bool(nickname)}")
#
# None means there is no value yet
print(f"Favorite color: {favorite_color}")
print(f"Color chosen? {favorite_color is not None}")
favorite_color = "green"
print(f"Color chosen now? {favorite_color is not None}")
</code></pre>

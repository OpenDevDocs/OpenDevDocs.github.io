---
publishDate: 2026-10-27T08:16
title: 'Logical Operators: and, or, not'
slug: logical-operators
metadescription: 'Combine conditions in Python with and, or and not. Learn truth tables, operator order, short-circuit evaluation and the classic or mistake beginners make.'
updateDate: 2026-10-27T08:16
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'control-flow', 'booleans']
course: python
---

## Combining questions

In [Making Decisions with if, elif and else](/courses/python/if-elif-else) each decision asked one question: "Is the temperature above 30?" Real rules often depend on several things at once:

- You can rent a car if you are **at least 18 and** you have a license.
- It is the weekend if the day is **Saturday or Sunday**.
- Go for a walk if it is **not** raining.

Python has three **logical operators** that join or flip conditions, and they use plain English words: `and`, `or` and `not`. Each one takes booleans (`True`/`False`, from [Booleans, Comparisons and None](/courses/python/booleans-and-none)) and gives back a boolean.

## `and`: both must be true

`and` gives `True` only when the conditions on **both** sides are true.

```python
age = 25
has_license = True
if age >= 18 and has_license:
    print("You can rent a car.")
```

Output:

```text
You can rent a car.
```

If either part were false (age 16, or no license), the message would not print. Think of a door with two locks: you need both keys to open it.

Here is every possible combination:

```python
print(True and True)
print(True and False)
print(False and True)
print(False and False)
```

Output:

```text
True
False
False
False
```

## `or`: at least one must be true

`or` gives `True` when **at least one** side is true. It is only `False` when both sides are false.

```python
day = "Sunday"
if day == "Saturday" or day == "Sunday":
    print("It is the weekend!")
```

Output:

```text
It is the weekend!
```

Think of a house with two doors. You can get in through either one.

## `not`: flip it

`not` works on a single condition and turns it around: `True` becomes `False` and `False` becomes `True`.

```python
is_raining = False
if not is_raining:
    print("Let's go for a walk.")
print(not True, not False)
```

Output:

```text
Let's go for a walk.
False True
```

`if not is_raining:` reads just like English: "if it is not raining".

## Truth table

A **truth table** lists every combination of inputs and the result. It is a handy cheat sheet:

| `a` | `b` | `a and b` | `a or b` | `not a` |
| --- | --- | --- | --- | --- |
| `True` | `True` | `True` | `True` | `False` |
| `True` | `False` | `False` | `True` | `False` |
| `False` | `True` | `False` | `True` | `True` |
| `False` | `False` | `False` | `False` | `True` |

A quick way to remember it: `and` is picky (everything must be true), `or` is relaxed (anything true is enough).

## Combining more than two conditions

You can chain as many conditions as you need:

```python
age = 70
is_student = False
if age < 12 or age >= 65 or is_student:
    print("You get a discount.")
```

Output:

```text
You get a discount.
```

Children, seniors and students all get the discount. One true condition is enough.

### Checking a range

To check that a number is between two values, you can use `and`, or the chained comparison from the booleans lesson. Both do the same thing:

```python
temp = 22
if 18 <= temp <= 25:
    print("Comfortable")
if temp >= 18 and temp <= 25:
    print("Comfortable too")
```

Output:

```text
Comfortable
Comfortable too
```

The chained form `18 <= temp <= 25` is shorter and is the usual Python style.

## Which goes first? Operator order

When you mix `and` and `or` in one line, Python does not simply read left to right. Just like `*` is done before `+` in math, the logical operators have a fixed order, called **precedence**:

1. `not` first
2. then `and`
3. then `or` last

All comparisons (`<`, `==` and so on) happen before any of them.

```python
print(True or False and False)
print((True or False) and False)
```

Output:

```text
True
False
```

In the first line, `False and False` is worked out first (giving `False`), then `True or False` gives `True`. In the second line the parentheses force the `or` to go first.

> **Tip:** When you mix `and` and `or`, add parentheses even if they are not strictly needed. `(is_vip) or (age >= 18 and has_ticket)` is much easier for a human to read than relying on the precedence rules.

## Short-circuit evaluation

Python is lazy in a clever way. It stops checking as soon as it knows the answer. This is called **short-circuit evaluation**.

- For `a and b`: if `a` is false, the whole thing must be false, so Python never even looks at `b`.
- For `a or b`: if `a` is true, the whole thing must be true, so Python skips `b`.

This is useful for protecting yourself from errors. Dividing by zero crashes a program, but with `and` you can check first:

```python
count = 0
if count != 0 and 10 / count > 2:
    print("big average")
else:
    print("no data")
```

Output:

```text
no data
```

Because `count != 0` is `False`, Python never runs `10 / count`. Swap the order, and the division runs first and crashes:

```python
count = 0
if 10 / count > 2 and count != 0:
    print("big average")
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    if 10 / count > 2 and count != 0:
       ~~~^~~~~~~
ZeroDivisionError: division by zero
```

So: put the safety check on the left.

## `or` for default values

Here is a detail that surprises people. `and` and `or` do not always return `True` or `False`. They return **one of the values you gave them**. `or` returns the first truthy value it finds (or the last value if none are truthy):

```python
print("" or "Guest")
print("Maya" or "Guest")
print(0 or 10)
```

Output:

```text
Guest
Maya
10
```

This gives you a neat trick for default values. If the user just presses Enter, `input()` returns an empty string, which is falsy:

```python
name = input("Your name: ").strip() or "Guest"
print(f"Welcome, {name}!")
```

Output (the user just pressed Enter):

```text
Your name: 
Welcome, Guest!
```

## A shortcut for "one of these": `in`

When you compare one variable against many values with `or`, the `in` operator is often cleaner. It asks "is this value in that group?"

```python
day = "Sunday"
if day in ("Saturday", "Sunday"):
    print("Weekend!")
print("a" in "cat", "z" not in "cat")
```

Output:

```text
Weekend!
True True
```

The group in parentheses is a **tuple**, which you will meet in [Tuples and Unpacking](/courses/python/tuples-and-unpacking). `in` also works on strings, as the last line shows.

## Common mistakes

### The classic `or` mistake

This looks right, but it is wrong:

```python
day = "Monday"
if day == "Saturday" or "Sunday":
    print("Weekend?!")
```

Output:

```text
Weekend?!
```

Monday is not the weekend! The problem is that Python does not read this as "day equals Saturday or day equals Sunday". It reads it as `(day == "Saturday") or ("Sunday")`. The first part is `False`, so `or` returns `"Sunday"`, a non-empty string, which is truthy. The `if` always passes.

Fix: repeat the comparison on both sides, `day == "Saturday" or day == "Sunday"`, or use `in`: `day in ("Saturday", "Sunday")`.

### Using `&&`, `||` or `!` from other languages

If you know JavaScript, Java or C, you may type `&&`, `||` or `!`. In Python they are a `SyntaxError` (or, in the case of `&` and `|`, something different that works on bits). Python uses the words `and`, `or` and `not`.

### Forgetting parentheses with `not`

`not` grabs only what follows it, after comparisons are done. `not x > 3` means `not (x > 3)`, which is fine. But `not a or b` means `(not a) or b`, not `not (a or b)`. When in doubt, add parentheses.

## Quick recap

- `and` is true only when **both** sides are true.
- `or` is true when **at least one** side is true.
- `not` flips `True` to `False` and back.
- Order of work: comparisons, then `not`, then `and`, then `or`. Use parentheses to be clear.
- Python **short-circuits**: it stops as soon as the answer is known. Put safety checks first.
- `value or default` picks a default when the value is empty.
- Write `day == "a" or day == "b"` (or `day in ("a", "b")`), never `day == "a" or "b"`.

Next, you will make code repeat itself with [Repeating Code with while Loops](/courses/python/while-loops).

<code id="code-content" class="language-python">
# main.py: a theme park ride checker using and, or, not
#
name = input("Rider name: ").strip() or "Guest"
age = int(input("Age: "))
height = int(input("Height in cm: "))
has_adult = input("Riding with an adult? (y/n) ").strip().lower() in ("y", "yes")
#
# and: every condition must be true
can_ride_alone = age &gt;= 12 and height &gt;= 140
#
# or: one true condition is enough
can_ride_with_help = height &gt;= 120 and (age &gt;= 12 or has_adult)
#
# not: flip a boolean
is_too_short = not (height &gt;= 120)
#
print(f"Hello, {name}!")
if can_ride_alone:
    print("You can ride on your own. Have fun!")
elif can_ride_with_help:
    print("You can ride with an adult next to you.")
elif is_too_short:
    print("Sorry, you need to be at least 120 cm tall.")
else:
    print("Sorry, you need an adult with you.")
#
# Short-circuit: the right side only runs if the left side is True
visits = 0
if visits != 0 and 100 / visits &gt; 10:
    print("Frequent visitor!")
else:
    print("Welcome, new visitor!")
</code></pre>

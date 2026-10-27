---
publishDate: 2026-10-27T08:06
title: 'Variables and Assignment'
slug: variables
metadescription: 'Learn what variables are in Python, how to create and update them with =, the rules for naming them, multiple assignment, constants and common errors.'
updateDate: 2026-10-27T08:06
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'variables']
course: python
---

## What is a variable?

Programs need to remember things: a user's name, a score in a game, the price of an item. A **variable** is a name that refers to a value stored in the computer's memory.

Think of a variable as a **label** or a sticky note. You write a name on the label and stick it on a value. Later, when you say the name, Python finds the value the label is stuck to.

In this lesson you will learn how to create variables, change them, name them well, and fix the errors beginners hit most often.

## Creating a variable

You create a variable with the `=` sign:

```python
name = "Ada"
age = 36
print(name)
print(age)
print(name, "is", age, "years old")
```

Output:

```text
Ada
36
Ada is 36 years old
```

This is called **assignment**. The line `name = "Ada"` means "make the name `name` refer to the value `"Ada"`". It does **not** mean "name equals Ada" in the math sense. Read `=` as "gets" or "is set to":

- `name = "Ada"`: name **gets** "Ada"
- `age = 36`: age **gets** 36

The variable name always goes on the left, and the value goes on the right.

> **Note:** In Python you do not need to "declare" a variable first or say what kind of value it holds. The variable is created the moment you assign to it.

## Using variables

Once a variable exists, you can use its name anywhere you would use the value:

```python
price = 4
quantity = 3
total = price * quantity
print(total)
```

Output:

```text
12
```

Python looks up `price` (4) and `quantity` (3), multiplies them, and stores the answer in a new variable called `total`.

### Variable vs text

Be careful with quotes. A name **without** quotes is a variable. Text **with** quotes is just text:

```python
name = "Ada"
print("name")
print(name)
```

Output:

```text
name
Ada
```

The first `print()` shows the literal word `name`. The second looks up the variable and shows its value.

## Changing a variable

Variables can change, which is why they are called *variables*. Assign a new value and the label moves to it:

```python
score = 10
print(score)
score = 25
print(score)
```

Output:

```text
10
25
```

### Updating based on the old value

Very often you want to change a value based on what it was before, like adding points to a score:

```python
score = 10
score = score + 5
print(score)
```

Output:

```text
15
```

This line confuses many beginners, because in math `score = score + 5` makes no sense. In Python it is fine, because Python works **right side first**:

1. Look up the current `score` (10).
2. Add 5 to get 15.
3. Make `score` refer to 15.

### Shortcut operators

Updating a variable is so common that Python has shortcuts for it, called **augmented assignment** operators:

```python
points = 10
points += 5
print(points)
points -= 3
print(points)
points *= 2
print(points)
```

Output:

```text
15
12
24
```

| Shortcut | Same as |
| --- | --- |
| `x += 5` | `x = x + 5` |
| `x -= 3` | `x = x - 3` |
| `x *= 2` | `x = x * 2` |
| `x /= 2` | `x = x / 2` |

You will see these all the time, especially in [loops](/courses/python/while-loops).

## Assigning several variables at once

You can assign several variables on one line by separating names and values with commas:

```python
x, y, z = 1, 2, 3
print(x, y, z)
a = b = 0
print(a, b)
```

Output:

```text
1 2 3
0 0
```

The first line gives each name its own value, in order. The `a = b = 0` line gives both names the same value.

### Swapping two values

The comma trick makes swapping two variables easy:

```python
left = "cat"
right = "dog"
left, right = right, left
print(left, right)
```

Output:

```text
dog cat
```

Python works out the right side first (`"dog"`, `"cat"`), then assigns them to the left side. You will learn how this works in [Tuples and Unpacking](/courses/python/tuples-and-unpacking).

## Variables can hold any type

A variable is just a label, so it can point to any kind of value, and the kind can even change:

```python
thing = 42
print(thing, type(thing))
thing = "forty-two"
print(thing, type(thing))
```

Output:

```text
42 <class 'int'>
forty-two <class 'str'>
```

`type()` tells you the kind of value: `int` is a whole number and `str` is text. Python is called **dynamically typed** because the type belongs to the value, not to the variable name. You will look at all the types in [Data Types: An Overview](/courses/python/data-types).

> **Tip:** Just because you *can* change a variable from a number to text does not mean you *should*. Keeping one kind of value per variable makes your code easier to follow. Later, [Type Hints: Labeling Your Data](/courses/python/type-hints) shows how to write down what each variable should hold.

## Two labels, one value

Remember the sticky note idea. What happens here?

```python
first = "Ada"
second = first
first = "Grace"
print(first)
print(second)
```

Output:

```text
Grace
Ada
```

`second = first` sticks the `second` label on the same value `"Ada"`. Then `first = "Grace"` moves only the `first` label to a new value. `second` still points at `"Ada"`. Assignment never "links" two variables together. This idea becomes important when you work with lists, and you will explore it in [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying).

## Naming rules

Python has a few strict rules for variable names:

- Use only letters, digits and underscores (`_`).
- A name **cannot start with a digit**.
- No spaces and no dashes.
- It cannot be a **keyword** like `if`, `for` or `class` (see [Python Syntax: Comments, Indentation and Statements](/courses/python/syntax-comments-indentation)).
- Names are case sensitive: `score` and `Score` are different.

| Name | Allowed? | Why |
| --- | --- | --- |
| `user_name` | Yes | Letters and an underscore |
| `player2` | Yes | Digits are fine after the first character |
| `_hidden` | Yes | Can start with an underscore |
| `2nd_place` | No | Starts with a digit |
| `first name` | No | Contains a space |
| `user-name` | No | Contains a dash (Python reads it as minus) |
| `class` | No | It is a keyword |

### Naming style

Beyond the rules, Python has a style. Use **snake_case**: all lowercase letters, with underscores between words.

```python
first_name = "Ada"
total_price = 19.99
is_logged_in = True
```

Choose names that say what the value means. `total_price` is much clearer than `tp` or `x`. Your future self will thank you.

### Constants

A **constant** is a value that should never change while the program runs, like a tax rate. Python has no way to lock a variable, so by convention constants are written in ALL_CAPS. This tells other programmers "please do not change this":

```python
MAX_PLAYERS = 4
TAX_RATE = 0.2
print(MAX_PLAYERS, TAX_RATE)
```

Output:

```text
4 0.2
```

## Common mistakes

### Using a variable before creating it

```python
print(user_name)
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(user_name)
          ^^^^^^^^^
NameError: name 'user_name' is not defined
```

**Fix:** assign a value first (`user_name = "Ada"`), and make sure the assignment comes **above** the line that uses it. Python runs from top to bottom.

### A typo in the name

```python
message = "Hello"
print(mesage)
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(mesage)
          ^^^^^^
NameError: name 'mesage' is not defined. Did you mean: 'message'?
```

**Fix:** spell it the same way every time. Python's "Did you mean" hint often points to the answer.

### Starting a name with a digit

```text
2nd_place = "Grace"
```

Error:

```text
  File "main.py", line 1
    2nd_place = "Grace"
    ^
SyntaxError: invalid decimal literal
```

**Fix:** move the digit, for example `second_place` or `place_2`.

### Using a dash in a name

```text
user-name = "Ada"
```

Error:

```text
  File "main.py", line 1
    user-name = "Ada"
    ^^^^^^^^^
SyntaxError: cannot assign to expression here. Maybe you meant '==' instead of '='?
```

Python reads `user-name` as "user minus name". **Fix:** use an underscore: `user_name`.

### Putting the value on the left

Writing `"Ada" = name` does not work. The name being assigned always goes on the **left** of `=`.

## Quick recap

- A variable is a name (a label) that refers to a value.
- `=` assigns: the right side is worked out first, then stored in the name on the left.
- Variables can be changed; `+=`, `-=`, `*=` and `/=` are handy shortcuts.
- `a, b = 1, 2` assigns several at once and makes swapping easy.
- Names use letters, digits and underscores, cannot start with a digit, and should be snake_case.
- ALL_CAPS names are constants by convention.

Variables can hold many kinds of values. Next, meet them all in [Data Types: An Overview](/courses/python/data-types).

<code id="code-content" class="language-python">
# main.py: variables and assignment
# A variable is a name (label) that refers to a value.
#
# Constants are written in ALL_CAPS by convention
TAX_RATE = 0.2
#
# Create variables with =
player_name = "Ada"
score = 0
item_price = 10
quantity = 3
#
print("Player:", player_name)
print("Starting score:", score)
#
# Update a variable based on its old value
score = score + 10
print("After first level:", score)
#
# The same thing with a shortcut operator
score += 15
print("After second level:", score)
#
# Use variables to calculate new values
subtotal = item_price * quantity
tax = subtotal * TAX_RATE
total = subtotal + tax
print("Subtotal:", subtotal)
print("Tax:", tax)
print("Total:", total)
#
# Assign several variables at once, then swap them
left, right = "cat", "dog"
print("Before swap:", left, right)
left, right = right, left
print("After swap:", left, right)
#
# type() shows what kind of value a variable holds
print(type(player_name))
print(type(score))
print(type(total))
</code></pre>

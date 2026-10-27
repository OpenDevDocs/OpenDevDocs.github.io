---
publishDate: 2026-10-27T08:08
title: 'Numbers and Math Operators'
slug: numbers-and-math
metadescription: 'Do math in Python with int and float: the seven arithmetic operators, operator order, rounding, the math module, float surprises and division by zero.'
updateDate: 2026-10-27T08:08
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'numbers', 'math']
course: python
---

## Python as a calculator

Almost every program works with numbers: prices, scores, distances, times. In [Data Types: An Overview](/courses/python/data-types) you met Python's two main number types:

- **int**: whole numbers like `7`, `-3` and `2026`
- **float**: numbers with a decimal point like `3.14` and `0.5`

In this lesson you will learn how to do math with them, in which order Python calculates, how to round results, and a couple of surprises that catch every beginner.

> **Tip:** Open the [REPL](/courses/python/python-repl) and try the examples as you read. It makes a great calculator.

## The arithmetic operators

An **operator** is a symbol that does something with values. The values it works on are called **operands**. Python has seven arithmetic operators:

```python
print(7 + 3)
print(7 - 3)
print(7 * 3)
print(7 / 3)
print(7 // 3)
print(7 % 3)
print(7 ** 3)
```

Output:

```text
10
4
21
2.3333333333333335
2
1
343
```

| Operator | Name | Example | Result |
| --- | --- | --- | --- |
| `+` | Addition | `7 + 3` | `10` |
| `-` | Subtraction | `7 - 3` | `4` |
| `*` | Multiplication | `7 * 3` | `21` |
| `/` | Division | `7 / 3` | `2.3333333333333335` |
| `//` | Floor division | `7 // 3` | `2` |
| `%` | Modulo (remainder) | `7 % 3` | `1` |
| `**` | Power (exponent) | `7 ** 3` | `343` |

The first four look like normal math (with `*` for times). The last three need a closer look.

## Division: / vs //

Python has two kinds of division.

**Normal division** `/` always gives a float, even when the answer is a whole number:

```python
print(10 / 2)
print(10 // 2)
print(9 // 2)
print(-9 // 2)
```

Output:

```text
5.0
5
4
-5
```

**Floor division** `//` divides and then rounds **down** to the nearest whole number. `9 // 2` is `4` (not 4.5). Think of it as "how many whole times does 2 fit into 9?"

Be careful with negative numbers: "down" means toward minus infinity, so `-9 // 2` is `-5`, not `-4`.

## Remainder with %

The **modulo** operator `%` gives the **remainder** after division. `7 % 3` is `1` because 3 fits into 7 twice, with 1 left over.

Together, `//` and `%` are great for splitting things up. For example, turning minutes into hours and minutes:

```python
minutes = 135
hours = minutes // 60
left_over = minutes % 60
print(hours, "hours and", left_over, "minutes")
print(10 % 2)
print(7 % 2)
print(divmod(135, 60))
```

Output:

```text
2 hours and 15 minutes
0
1
(2, 15)
```

A very common trick: `number % 2` is `0` for even numbers and `1` for odd numbers. The built-in `divmod()` gives you both the floor division and the remainder at once.

## Powers with **

`**` raises a number to a power. `2 ** 3` means 2 times 2 times 2, which is 8. It also works for roots: `9 ** 0.5` is the square root of 9, which is `3.0`.

> **Warning:** In Python, `^` is **not** power. `2 ^ 3` gives `1`, because `^` is a different operator (bitwise XOR). Always use `**` for powers.

## Order of operations

When an expression has several operators, Python follows the same order you learned in school math:

1. `( )` parentheses first
2. `**` power
3. `*`, `/`, `//`, `%` (left to right)
4. `+`, `-` (left to right)

```python
print(2 + 3 * 4)
print((2 + 3) * 4)
print(2 ** 3 ** 2)
print(-2 ** 2)
print((-2) ** 2)
```

Output:

```text
14
20
512
-4
4
```

- `2 + 3 * 4` is `14` because multiplication goes first.
- Parentheses change the order: `(2 + 3) * 4` is `20`.
- `**` is unusual: it goes right to left. `2 ** 3 ** 2` means `2 ** 9`, which is `512`.
- `-2 ** 2` is `-4`, because the power happens before the minus sign. Use parentheses if you mean `(-2) ** 2`.

> **Tip:** When in doubt, add parentheses. They make your intent clear to Python and to anyone reading your code.

## Mixing int and float

If an operation mixes an `int` and a `float`, the answer is a `float`:

```python
print(2 + 3.0)
print(type(2 + 3.0))
print(2 * 3)
print(type(10 / 5))
```

Output:

```text
5.0
<class 'float'>
6
<class 'float'>
```

Two ints give an int for `+`, `-`, `*`, `//`, `%` and `**`, but `/` always gives a float.

## Big and small numbers

Python integers can be as large as your memory allows. There is no overflow:

```python
print(2 ** 100)
print(1_000_000 * 3)
print(1.5e3)
print(2.5e-4)
```

Output:

```text
1267650600228229401496703205376
3000000
1500.0
0.00025
```

Underscores make big numbers readable (`1_000_000`). The `e` notation is **scientific notation**: `1.5e3` means 1.5 times 10 to the power of 3, which is `1500.0`.

## Shortcut operators

You met `+=` in [Variables and Assignment](/courses/python/variables). Every arithmetic operator has one:

```python
balance = 100
balance += 50
balance -= 30
balance *= 2
print(balance)
balance //= 7
print(balance)
```

Output:

```text
240
34
```

## Useful built-in functions

Python has some math helpers ready to use, no import needed:

```python
print(abs(-7))
print(round(3.14159, 2))
print(round(2.5))
print(round(3.5))
print(round(7.8))
print(min(4, 9, 1))
print(max(4, 9, 1))
print(sum([4, 9, 1]))
print(pow(2, 5))
```

Output:

```text
7
3.14
2
4
8
1
9
14
32
```

| Function | What it does |
| --- | --- |
| `abs(x)` | Distance from zero (removes the minus sign) |
| `round(x, n)` | Rounds to `n` decimal places (or to a whole number if `n` is left out) |
| `min(...)` / `max(...)` | Smallest / largest value |
| `sum(list)` | Adds up a list of numbers |
| `pow(x, y)` | Same as `x ** y` |

Look at `round(2.5)` and `round(3.5)`: they give `2` and `4`. When a number is exactly halfway, Python rounds to the nearest **even** number. This is called "banker's rounding" and it avoids a bias toward always rounding up.

### Converting between int and float

```python
print(int(7.9))
print(float(3))
print(int("42") + 1)
```

Output:

```text
7
3.0
43
```

`int()` **cuts off** the decimal part (it does not round). `float()` adds a decimal point. `int()` can also turn text like `"42"` into a number. More in [Converting Between Types](/courses/python/type-conversion).

## The math module

For more advanced math, Python has a **module** (a file of extra tools) called `math`. You load it with `import`, which you will study in [Modules and import](/courses/python/modules-and-imports):

```python
import math

print(math.sqrt(16))
print(math.pi)
print(math.floor(3.7))
print(math.ceil(3.2))
print(math.isclose(0.1 + 0.2, 0.3))
```

Output:

```text
4.0
3.141592653589793
3
4
True
```

`math.floor()` always rounds down and `math.ceil()` always rounds up. `math.isclose()` checks whether two floats are "close enough", which leads to the next topic. See the full list in the [math module docs](https://docs.python.org/3/library/math.html).

## The float surprise

Try this:

```python
print(0.1 + 0.2)
print(0.1 + 0.2 == 0.3)
print(round(0.1 + 0.2, 2))
```

Output:

```text
0.30000000000000004
False
0.3
```

This is not a Python bug. Computers store floats in binary (ones and zeros), and some decimals like `0.1` cannot be stored exactly, just like 1/3 cannot be written exactly as a decimal (0.3333...). The tiny error shows up in the last digit.

What to do about it:

- Round results when you display them: `round(x, 2)`.
- Compare floats with `math.isclose()` instead of `==`.
- For money, many programs count in whole cents with `int`, or use the `decimal` module from the standard library.

## Common mistakes

### Dividing by zero

```python
print(10 / 0)
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(10 / 0)
          ~~~^~~
ZeroDivisionError: division by zero
```

The same happens with `//` and `%`. **Fix:** check that the number you divide by is not zero first. You will learn how in [Making Decisions with if, elif and else](/courses/python/if-elif-else), and how to catch errors in [Handling Errors with try and except](/courses/python/exceptions).

### Numbers in quotes

```python
print("3" * 4)
```

Output:

```text
3333
```

No error, but not what you wanted. `"3"` is a string, and multiplying a string repeats it. **Fix:** convert first with `int("3") * 4`.

### Using ^ for power

`2 ^ 3` gives `1` instead of `8`. **Fix:** use `2 ** 3`.

### Expecting / to give a whole number

`10 / 2` is `5.0`, not `5`. **Fix:** use `//` when you want a whole number result, or wrap with `int()`.

## Quick recap

- `+ - * /` work as expected; `/` always returns a float.
- `//` divides and rounds down; `%` gives the remainder; `**` is power.
- Order: parentheses, then `**`, then `* / // %`, then `+ -`.
- Mixing `int` and `float` gives a `float`.
- `abs()`, `round()`, `min()`, `max()` and `sum()` are built in; the `math` module has more.
- Floats can be slightly off (`0.1 + 0.2`). Round for display and use `math.isclose()` to compare.
- Dividing by zero raises a `ZeroDivisionError`.

Numbers done. Next up is the other type you will use everywhere: [Strings: Working with Text](/courses/python/strings).

<code id="code-content" class="language-python">
# main.py: numbers and math in Python
import math
#
# The seven arithmetic operators
a = 17
b = 5
print("a + b  =", a + b)
print("a - b  =", a - b)
print("a * b  =", a * b)
print("a / b  =", a / b)     # always a float
print("a // b =", a // b)    # floor division (round down)
print("a % b  =", a % b)     # remainder
print("a ** 2 =", a ** 2)    # power
#
# Order of operations: parentheses first
print(2 + 3 * 4, "vs", (2 + 3) * 4)
#
# Split 135 minutes into hours and minutes
minutes = 135
print(minutes // 60, "h", minutes % 60, "min")
#
# Even or odd?
number = 42
print(number, "is even:", number % 2 == 0)
#
# A shopping bill
price = 19.99
quantity = 3
subtotal = price * quantity
tax = subtotal * 0.08
total = subtotal + tax
print("Total:", round(total, 2))
#
# Helpful built-ins
print(abs(-7), min(4, 9, 1), max(4, 9, 1), sum([4, 9, 1]))
#
# The math module
print("Square root of 16:", math.sqrt(16))
print("Circle area, radius 2:", round(math.pi * 2 ** 2, 2))
print("floor(3.7) =", math.floor(3.7), "and ceil(3.2) =", math.ceil(3.2))
#
# Floats can be slightly off, so compare with isclose()
print(0.1 + 0.2)
print(math.isclose(0.1 + 0.2, 0.3))
</code></pre>

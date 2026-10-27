---
publishDate: 2026-10-27T08:13
title: 'Converting Between Types'
slug: type-conversion
metadescription: 'Learn to turn text into numbers and numbers into text in Python with int(), float(), str() and bool(), and how to handle values that cannot be converted.'
updateDate: 2026-10-27T08:13
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'types', 'basics']
course: python
---

## Why types need converting

Every value in Python has a **type**: whole numbers are `int`, decimals are `float`, text is `str`, and `True`/`False` are `bool`. You met them in [Data Types: An Overview](/courses/python/data-types).

The type decides what you can do with a value. Here is a puzzle:

```python
a = "10"
b = "5"
print(a + b)
```

Output:

```text
105
```

You might expect `15`, but `a` and `b` are **strings** (they have quotes). For strings, `+` means "glue together", so `"10"` and `"5"` become `"105"`.

This happens all the time in real programs. Text typed by a user, text read from a file, text from a web page: it all arrives as strings, even when it looks like a number. Before you can do math with it, you must **convert** it. **Type conversion** (also called **casting**) means making a new value of a different type from an existing value.

Think of it like currency exchange. You hand over dollars and get euros back. The amount is the "same" idea, but in a form that works where you want to spend it.

## Text to whole numbers: `int()`

The `int()` function takes a value and gives back a whole number.

```python
a = int("10")
b = int("5")
print(a + b)
print(type(a))
```

Output:

```text
15
<class 'int'>
```

Now the math works. `int()` is forgiving about spaces around the number, and it understands underscores used as digit separators:

```python
print(int("  42  "))
print(int("1_000"))
```

Output:

```text
42
1000
```

## Text to decimals: `float()`

For numbers with a decimal point, use `float()`:

```python
print(float("3.75"))
print(float("10"))
print(float(7))
```

Output:

```text
3.75
10.0
7.0
```

Notice that `float()` happily turns whole numbers into decimals too. It just adds `.0`.

## Decimals to whole numbers: cut off or round?

When you give `int()` a float, it does not round. It simply **chops off** everything after the decimal point. This is called **truncating**.

```python
print(int(3.99))
print(int(-3.99))
print(round(3.99))
print(round(3.5), round(4.5))
```

Output:

```text
3
-3
4
4 4
```

`int(3.99)` is `3`, not `4`. If you want normal rounding, use `round()` instead.

> **Note:** Look closely at the last line: `round(3.5)` is `4`, but `round(4.5)` is also `4`. When a number is exactly halfway, Python rounds to the nearest **even** number. This is called "banker's rounding" and it avoids always pushing totals upward. It only matters for numbers ending in exactly `.5`.

## Anything to text: `str()`

Going the other way is easy. `str()` turns almost any value into a string.

```python
age = 30
text = str(age)
print(text, type(text))
print("I am " + str(age) + " years old")
print(str(3.5) + "!")
```

Output:

```text
30 <class 'str'>
I am 30 years old
3.5!
```

That said, when you just want to show a number inside a message, an f-string is usually nicer: `f"I am {age} years old"`. f-strings convert for you. See [f-strings and String Formatting](/courses/python/f-strings).

## To True or False: `bool()`

`bool()` uses the truthy and falsy rules from [Booleans, Comparisons and None](/courses/python/booleans-and-none): zero and empty values become `False`, everything else becomes `True`.

```python
print(bool("False"))
print(bool(""))
print(bool(1), bool(0))
print(int(True), int(False))
```

Output:

```text
True
False
True False
1 0
```

Watch out for the first line. The string `"False"` is not empty, so it is truthy. `bool()` does **not** read the word inside the string. If you need to turn the text `"yes"` or `"no"` into a boolean, compare it instead: `answer == "yes"`.

## Conversion cheat sheet

| You have | You want | Use | Example | Result |
| --- | --- | --- | --- | --- |
| `"42"` | whole number | `int()` | `int("42")` | `42` |
| `"3.7"` | decimal | `float()` | `float("3.7")` | `3.7` |
| `"3.7"` | whole number | `int(float())` | `int(float("3.7"))` | `3` |
| `3.7` | whole number | `int()` or `round()` | `round(3.7)` | `4` |
| `42` | text | `str()` | `str(42)` | `"42"` |
| `""` | boolean | `bool()` | `bool("")` | `False` |

## When Python converts for you

Sometimes Python converts on its own, without you asking. This is called **implicit conversion**. It only happens when it is safe and there is no doubt about the meaning:

```python
print(3 + 2.5)
print(10 / 2)
print(True + 1)
```

Output:

```text
5.5
5.0
2
```

Adding an `int` and a `float` gives a `float`, and `/` division always gives a `float`. But Python will **never** silently mix text and numbers. `"10" + 5` is an error, because Python cannot guess whether you meant `"105"` or `15`. You have to say which one you want.

## Checking a type before converting

You can ask Python what type a value has with `type()`, or ask "is it this type?" with `isinstance()`:

```python
print(type(42))
print(type("42"))
print(isinstance(42, int))
print("42".isdigit(), "4.2".isdigit(), "-42".isdigit())
```

Output:

```text
<class 'int'>
<class 'str'>
True
True False False
```

The string method `.isdigit()` checks whether text contains only digits. It is a quick check, but notice it says `False` for `"4.2"` and `"-42"`, which are fine numbers. A more reliable way is to just try the conversion and catch the error.

## What if the conversion fails?

Not every string can become a number. `int("ten")` makes no sense to Python, so it stops your program with an error. Here is how to deal with that gracefully using `try` and `except`:

```python
text = "ten"
try:
    number = int(text)
    print(f"Got {number}")
except ValueError:
    print(f"Sorry, {text!r} is not a whole number.")
```

Output:

```text
Sorry, 'ten' is not a whole number.
```

Python **tries** the code in the `try` block. If a `ValueError` happens, it jumps to the `except` block instead of crashing. (The `!r` inside the f-string shows the value with its quotes, so you can see exactly what was typed.) You will learn all about this in [Handling Errors with try and except](/courses/python/exceptions). For now, this small pattern is enough.

## Common mistakes

### Converting a decimal string with `int()`

```python
print(int("3.7"))
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(int("3.7"))
          ~~~^^^^^^^
ValueError: invalid literal for int() with base 10: '3.7'
```

`int()` only accepts text that looks like a whole number. A **literal** here just means "the text you gave it". Fix: go through `float()` first, `int(float("3.7"))`, or keep it as a float.

### Converting words or empty text

```python
print(int(""))
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(int(""))
          ~~~^^^^
ValueError: invalid literal for int() with base 10: ''
```

An empty string is a common surprise: it happens when a user just presses Enter. Fix: check that the text is not empty, or wrap the conversion in `try`/`except`.

### Converting `None`

```python
print(int(None))
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(int(None))
          ~~~^^^^^^
TypeError: int() argument must be a string, a bytes-like object or a real number, not 'NoneType'
```

This is a `TypeError`, not a `ValueError`: the problem is the kind of value, not its content. Fix: make sure the variable actually holds a value before converting it, for example with `if value is not None:`.

### Forgetting to store the result

`int(text)` does not change `text`. It gives back a **new** value. If you write `int(text)` on its own line and then use `text`, it is still a string. Always store the result: `number = int(text)`.

## Quick recap

- Text from users and files always arrives as `str`, even if it looks like a number.
- `int()` makes whole numbers, `float()` makes decimals, `str()` makes text, `bool()` makes `True`/`False`.
- `int()` on a float chops off the decimals. Use `round()` to round.
- `bool("False")` is `True`, because the string is not empty.
- Python never mixes text and numbers on its own. You must convert.
- A failed conversion raises `ValueError`. Catch it with `try`/`except`.

Next, you will put this to work by reading what the user types in [Getting Input and Printing Output](/courses/python/input-and-output).

<code id="code-content" class="language-python">
# main.py: converting between types
#
# Values that arrive as text, for example from a file or a form
raw_quantity = "3"
raw_price = "4.75"
raw_discount = "10"
#
# Convert text to numbers before doing math
quantity = int(raw_quantity)
price = float(raw_price)
discount = int(raw_discount) / 100
total = quantity * price * (1 - discount)
print(f"Total: {total:.2f}")
#
# int() chops off decimals, round() rounds them
print(int(total), round(total))
#
# Numbers back to text with str()
label = "Items: " + str(quantity)
print(label)
#
# bool() follows the truthy and falsy rules
print(bool("False"), bool(""), bool(0), bool(7))
#
# Safely converting text that might not be a number
def to_int(text):
    try:
        return int(text)
    except ValueError:
        return None
#
for sample in ["42", " 7 ", "3.5", "ten", ""]:
    result = to_int(sample)
    if result is None:
        print(f"{sample!r} is not a whole number")
    else:
        print(f"{sample!r} became {result}")
</code></pre>

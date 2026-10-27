---
publishDate: 2026-10-27T08:46
title: 'Handling Errors with try and except'
slug: exceptions
metadescription: 'Learn what exceptions are and how to handle them with try, except, else and finally so your Python programs recover from bad input instead of crashing.'
updateDate: 2026-10-27T08:46
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'errors', 'exceptions']
course: python
---

## When things go wrong

Every program meets problems. A user types `twelve` when you asked for a number. A file you want to open has been deleted. A web site is down. If you do nothing, Python stops your program and prints a scary red message.

Try this:

```python
age = int("twelve")
print("You are", age)
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    age = int("twelve")
ValueError: invalid literal for int() with base 10: 'twelve'
```

This message is called a **traceback**. It shows where the problem happened (the file and line number) and, on the last line, what went wrong. The problem itself is called an **exception**: an event that interrupts the normal flow of your program. Here the exception type is `ValueError`, and the text after the colon explains it.

The second line, `print("You are", age)`, never ran. The program **crashed**.

In this lesson you will learn to **handle** exceptions: to catch them, react sensibly, and keep going. Think of it like a safety net under a trapeze artist. The artist still tries the trick, but if they fall, the net catches them.

## The try and except blocks

You put the risky code inside a `try` block. Then you say what to do if a certain exception happens, in an `except` block:

```python
try:
    age = int("twelve")
    print("You are", age)
except ValueError:
    print("That is not a whole number.")

print("The program keeps going.")
```

Output:

```text
That is not a whole number.
The program keeps going.
```

Here is what happened step by step:

1. Python started running the `try` block.
2. `int("twelve")` raised a `ValueError`.
3. Python immediately jumped out of the `try` block (skipping the `print`) and looked for a matching `except`.
4. `except ValueError` matched, so its code ran.
5. After that, the program continued normally.

If no exception happens, the `except` block is skipped completely.

## Common exception types

Python has many built-in exception types. You do not need to memorize them, because the traceback always tells you the name. These are the ones you will see most:

| Exception | When it happens | Example |
| --- | --- | --- |
| `ValueError` | Right type, wrong value | `int("abc")` |
| `TypeError` | Wrong type for the operation | `10 + "5"` |
| `ZeroDivisionError` | Dividing by zero | `5 / 0` |
| `KeyError` | Dictionary key does not exist | `{"a": 1}["b"]` |
| `IndexError` | List position does not exist | `[1, 2][5]` |
| `NameError` | Variable name not defined | `print(nmae)` |
| `FileNotFoundError` | File does not exist | `open("missing.txt")` |

## Handling errors inside functions

A `try` block often lives inside a [function](/courses/python/functions), so the function can return a safe value instead of crashing:

```python
def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        print("Cannot divide by zero, returning None.")
        return None

print(safe_divide(10, 2))
print(safe_divide(10, 0))
```

Output:

```text
5.0
Cannot divide by zero, returning None.
None
```

## Catching more than one type

One `try` can have several `except` blocks, one for each kind of problem. Python checks them from top to bottom and runs the first one that matches:

```python
prices = {"apple": 0.5, "bread": 2.25}
order = [("apple", 4), ("milk", 1), ("bread", "two")]

for item, quantity in order:
    try:
        total = prices[item] * quantity
        print(item, "costs", total)
    except KeyError:
        print(f"Sorry, we do not sell {item}.")
    except TypeError:
        print(f"Quantity for {item} must be a number.")
```

Output:

```text
apple costs 2.0
Sorry, we do not sell milk.
Quantity for bread must be a number.
```

If you want the same reaction for several types, put them in a [tuple](/courses/python/tuples-and-unpacking):

```python
prices = {"apple": 0.5, "bread": 2.25}
order = [("apple", 4), ("milk", 1), ("bread", "two")]

for item, quantity in order:
    try:
        print(item, "costs", prices[item] * quantity)
    except (KeyError, TypeError) as error:
        print(f"Skipping {item}: {type(error).__name__}")
```

Output:

```text
apple costs 2.0
Skipping milk: KeyError
Skipping bread: TypeError
```

## Getting the error message with as

Writing `except ValueError as error:` stores the exception object in the variable `error`. Printing it gives you Python's explanation:

```python
try:
    number = int("abc")
except ValueError as error:
    print("Problem:", error)
    print("Type:", type(error).__name__)
```

Output:

```text
Problem: invalid literal for int() with base 10: 'abc'
Type: ValueError
```

You can name the variable anything, but `error`, `err` and `e` are the usual choices.

## else and finally

A `try` statement can have two more optional parts:

- `else` runs only if **no** exception happened.
- `finally` runs **always**, error or not. It is great for clean up work like closing a connection.

```python
def read_number(text):
    try:
        value = int(text)
    except ValueError:
        print(f"{text!r}: not a number")
    else:
        print(f"{text!r}: got {value}")
    finally:
        print("  (finished checking)")

read_number("42")
read_number("4x2")
```

Output:

```text
'42': got 42
  (finished checking)
'4x2': not a number
  (finished checking)
```

Why use `else` instead of putting the code at the end of `try`? It keeps the `try` block small, so you only catch errors from the line you expect to fail, not from other code by accident.

## Real world patterns

### A missing file

In [Reading and Writing Files](/courses/python/reading-and-writing-files) you saw that opening a missing file crashes. Now you can handle it:

```python
from pathlib import Path

def load_notes(filename):
    try:
        return Path(filename).read_text(encoding="utf-8")
    except FileNotFoundError:
        return "(no notes yet)"

print(load_notes("notes.txt"))
Path("notes.txt").write_text("Buy milk\n", encoding="utf-8")
print(load_notes("notes.txt"))
```

Output:

```text
(no notes yet)
Buy milk

```

### Broken JSON

Modules can define their own exception types. The [json module](/courses/python/json-and-csv) raises `json.JSONDecodeError` for bad text:

```python
import json

def load_settings(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        print("Bad settings file:", error.msg)
        return {}

print(load_settings('{"theme": "dark"}'))
print(load_settings('{"theme": dark}'))
```

Output:

```text
{'theme': 'dark'}
Bad settings file: Expecting value
{}
```

### Asking again until the input is valid

Combine `try` with a [loop](/courses/python/while-loops) to keep asking until the user types something valid. Here a list stands in for what the user types, so you can see the whole run:

```python
def ask_age(answers):
    for answer in answers:
        try:
            age = int(answer)
        except ValueError:
            print(f"{answer!r} is not a number, try again.")
            continue
        if age < 0:
            print("Age cannot be negative, try again.")
            continue
        return age

print("Age:", ask_age(["ten", "-3", "10"]))
```

Output:

```text
'ten' is not a number, try again.
Age cannot be negative, try again.
Age: 10
```

In a real program you would use `while True:` and [input()](/courses/python/input-and-output), as in the code panel at the end of this lesson.

## Common mistakes

**1. A bare `except:` that catches everything.**

```python
try:
    total = 10 + "5"
except:
    print("Something went wrong")
```

```text
Something went wrong
```

This hides the real problem (a `TypeError`), and you learn nothing. It even catches you pressing Ctrl+C to stop the program. Always name the exception you expect.

**2. Catching too broadly hides bugs.** Look at this typo:

```python
try:
    nmber = 5
    print(number)
except Exception:
    print("Could not print the number")
```

```text
Could not print the number
```

The real problem is a `NameError` caused by a spelling mistake, but the message makes you think something else failed. If you ever do catch a broad type, at least print the error:

```python
try:
    print(number)
except NameError as error:
    print("Bug in the code:", error)
```

```text
Bug in the code: name 'number' is not defined
```

**3. Using try to avoid fixing a bug.** If this crashes, the list really is too short:

```text
IndexError: list index out of range
```

Exceptions are for situations you cannot control, like user input, files and networks. For bugs in your own code, read the traceback and fix the code. The lesson on [Debugging Python Code](/courses/python/debugging-python) shows how.

**4. Putting too much inside try.** A huge `try` block makes it hard to know which line failed. Keep only the risky line inside, and move the rest to `else`.

## Quick recap

- An **exception** is an error that happens while the program runs. Unhandled, it crashes the program with a **traceback**.
- Put risky code in `try`, and the reaction in `except SomeError:`.
- Use several `except` blocks, or a tuple like `except (KeyError, TypeError):`.
- `except ValueError as error:` gives you the message.
- `else` runs when nothing failed. `finally` always runs.
- Catch specific exceptions. Avoid bare `except:`.

Now that you can catch errors, you will learn to create your own in [Raising Errors and Custom Exceptions](/courses/python/raising-and-custom-exceptions).

<code id="code-content" class="language-python">
# main.py: a safe calculator that never crashes on bad input
def ask_number(prompt: str) -&gt; float:
    """Keep asking until the user types a valid number."""
    while True:
        text = input(prompt)
        try:
            return float(text)
        except ValueError:
            print(f"  {text!r} is not a number, please try again.")
#
def divide(a: float, b: float) -&gt; float | None:
    """Return a / b, or None when b is zero."""
    try:
        result = a / b
    except ZeroDivisionError:
        print("  You cannot divide by zero.")
        return None
    else:
        return result
    finally:
        print("  (division attempted)")
#
def main() -&gt; None:
    print("Safe divider")
    a = ask_number("First number: ")
    b = ask_number("Second number: ")
    answer = divide(a, b)
    if answer is not None:
        print(f"{a} / {b} = {answer:.2f}")
    # A dictionary lookup that might fail
    names = {1: "one", 2: "two"}
    try:
        print("Name of a:", names[int(a)])
    except KeyError as error:
        print("No name stored for", error)
#
if __name__ == "__main__":
    main()
</code></pre>

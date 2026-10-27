---
publishDate: 2026-10-27T08:47
title: 'Raising Errors and Custom Exceptions'
slug: raising-and-custom-exceptions
metadescription: 'Learn to raise exceptions on purpose with raise, create your own exception classes, re-raise and chain errors, and use assert for quick sanity checks.'
updateDate: 2026-10-27T08:47
author: ['bishal-biswas']
level: 2
tags: ['python', 'errors', 'exceptions']
course: python
---

## Why would you cause an error on purpose?

In [Handling Errors with try and except](/courses/python/exceptions) you learned to catch errors that Python raises. Now you will learn to **raise** errors yourself.

That may sound strange. Why would you want your program to fail? Think of a cashier at a shop. If a customer hands over a fake banknote, the cashier does not quietly accept it and hope for the best. They stop and say "this note is not valid". Stopping early, loudly and with a clear reason is much better than carrying on with bad data and causing a mess later.

Your [functions](/courses/python/functions) should behave the same way. If someone passes an age of `-5`, the function should refuse clearly, instead of saving nonsense into your data.

## The raise statement

You raise an exception with the `raise` keyword, followed by an exception object. Usually you pick a built-in type and give it a helpful message:

```python
def set_age(age):
    if age < 0:
        raise ValueError("age cannot be negative")
    return age

print(set_age(30))
print(set_age(-5))
```

Output:

```text
30
Traceback (most recent call last):
  File "main.py", line 7, in <module>
    print(set_age(-5))
          ~~~~~~~^^^^
  File "main.py", line 3, in set_age
    raise ValueError("age cannot be negative")
ValueError: age cannot be negative
```

When Python reaches `raise`, the function stops right there. Nothing after it runs, and nothing is returned. The exception travels back up to whoever called the function.

The caller can catch it exactly like a built-in error:

```python
def set_age(age):
    if age < 0:
        raise ValueError("age cannot be negative")
    return age

for value in [30, -5]:
    try:
        print("Saved age", set_age(value))
    except ValueError as error:
        print("Rejected:", error)
```

Output:

```text
Saved age 30
Rejected: age cannot be negative
```

This is the big idea: the function **detects** the problem, and the caller **decides** what to do about it (show a message, ask again, skip the item, and so on).

## Picking the right built-in exception

Choose the type that best describes the problem. Two cover most cases:

| Raise this | When the problem is... | Example |
| --- | --- | --- |
| `TypeError` | The value is the wrong kind of thing | A number where text was expected |
| `ValueError` | The kind is right, but the value is not allowed | An empty name, a negative age |
| `KeyError` | A lookup key is missing | No user with that ID |
| `FileNotFoundError` | A needed file is missing | Config file not there |

```python
def make_username(name):
    if not isinstance(name, str):
        raise TypeError(f"name must be a string, not {type(name).__name__}")
    if not name.strip():
        raise ValueError("name cannot be empty")
    return name.strip().lower()

for value in ["  Ada ", "", 42]:
    try:
        print(make_username(value))
    except (TypeError, ValueError) as error:
        print(f"{type(error).__name__}: {error}")
```

Output:

```text
ada
ValueError: name cannot be empty
TypeError: name must be a string, not int
```

`isinstance(value, str)` checks whether a value is a string. It returns `True` or `False`.

> **Tip:** Write messages for the person reading the traceback later (often you). Say what was wrong and, if useful, what the value was: `f"price must be positive, got {price}"`.

## Creating your own exceptions

Built-in types are generic. In a bigger program you often want names that describe **your** problems, such as `InsufficientFundsError` for a banking app. Then callers can catch exactly that problem and nothing else.

A custom exception is a small **class** that inherits from `Exception`. You will learn classes properly in [Classes and Objects](/courses/python/classes-and-objects) and [Inheritance and super()](/courses/python/inheritance). For now, just copy this pattern:

```python
class InsufficientFundsError(Exception):
    """Raised when a withdrawal is bigger than the balance."""

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFundsError(f"cannot take {amount}, balance is only {balance}")
    return balance - amount

try:
    withdraw(50, 80)
except InsufficientFundsError as error:
    print("Payment failed:", error)

withdraw(50, 80)
```

Output:

```text
Payment failed: cannot take 80, balance is only 50
Traceback (most recent call last):
  File "main.py", line 14, in <module>
    withdraw(50, 80)
    ~~~~~~~~^^^^^^^^
  File "main.py", line 6, in withdraw
    raise InsufficientFundsError(f"cannot take {amount}, balance is only {balance}")
InsufficientFundsError: cannot take 80, balance is only 50
```

The class body only holds a [docstring](/courses/python/docstrings-and-clean-functions). That is enough: everything else comes from `Exception`. By convention, exception names end in `Error`.

### A family of exceptions

You can build a small family: one **base** exception for your whole program, and more specific ones that inherit from it. Callers can catch a specific error, or the base one to catch them all:

```python
class ShopError(Exception):
    """Base class for every error in our shop."""

class OutOfStockError(ShopError):
    pass

class UnknownProductError(ShopError):
    pass

stock = {"pen": 3, "book": 0}

def buy(product):
    if product not in stock:
        raise UnknownProductError(product)
    if stock[product] == 0:
        raise OutOfStockError(product)
    stock[product] -= 1
    return f"Bought a {product}"

for product in ["pen", "book", "lamp"]:
    try:
        print(buy(product))
    except OutOfStockError as error:
        print("Sold out:", error)
    except ShopError as error:
        print("Shop problem:", type(error).__name__, error)
```

Output:

```text
Bought a pen
Sold out: book
Shop problem: UnknownProductError lamp
```

`pass` means "nothing to add here" (see [break, continue and pass](/courses/python/break-continue-pass)). Because `UnknownProductError` is a kind of `ShopError`, the second `except` catches it.

> **Note:** Put the more specific `except` first. Python uses the first match, so if `except ShopError` came first, it would also catch every `OutOfStockError`.

### Exceptions that carry extra data

Sometimes the caller needs more than a message. You can store extra values on the exception by giving it an `__init__` method:

```python
class OutOfStockError(Exception):
    def __init__(self, product, wanted, available):
        self.product = product
        self.wanted = wanted
        self.available = available
        super().__init__(f"wanted {wanted} {product}, only {available} left")

try:
    raise OutOfStockError("pens", 5, 2)
except OutOfStockError as error:
    print(error)
    print("Short by", error.wanted - error.available)
```

Output:

```text
wanted 5 pens, only 2 left
Short by 3
```

`super().__init__(...)` passes the message on to `Exception`, so printing the error still works. Do not worry if this looks new. It will make full sense after the [inheritance](/courses/python/inheritance) lesson.

## Re-raising an exception

Sometimes you want to notice an error (for example, write a log line) but still let it continue to the caller. A bare `raise` inside an `except` block re-raises the same exception:

```python
def parse_price(text):
    try:
        return float(text)
    except ValueError:
        print("Logging: bad price", repr(text))
        raise

try:
    parse_price("ten")
except ValueError as error:
    print("Caller saw:", error)
```

Output:

```text
Logging: bad price 'ten'
Caller saw: could not convert string to float: 'ten'
```

## Turning one error into another with from

Low level errors like `JSONDecodeError` can be confusing for the caller. You can translate them into your own exception, and keep the original as the cause, with `raise ... from ...`:

```python
import json

class ConfigError(Exception):
    pass

def load_config(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise ConfigError("config file is not valid JSON") from error

load_config("{oops}")
```

Output (shortened):

```text
json.decoder.JSONDecodeError: Expecting property name enclosed in double quotes: line 1 column 2 (char 1)

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  ...
ConfigError: config file is not valid JSON
```

The traceback shows both errors, so nothing is lost when you debug.

## Quick checks with assert

`assert` checks that something is true. If it is false, Python raises an `AssertionError` with your message:

```python
def check_score(score):
    assert 0 <= score <= 100, f"score out of range: {score}"
    return score

print(check_score(88))
check_score(150)
```

Output (shortened):

```text
88
AssertionError: score out of range: 150
```

> **Warning:** Use `assert` only to catch **your own** bugs while developing, not to check user input. Python can be run with the `-O` option, which removes all `assert` lines. For real validation, use `if` and `raise`.

## Common mistakes

**1. Raising a string.** Only exception objects can be raised:

```python
raise "Something bad happened"
```

```text
TypeError: exceptions must derive from BaseException
```

Fix: `raise ValueError("Something bad happened")`.

**2. A custom exception that forgets to inherit from Exception.**

```python
class MyError:
    pass

raise MyError()
```

```text
TypeError: exceptions must derive from BaseException
```

Fix: `class MyError(Exception):`.

**3. Returning an "error value" instead of raising.**

```python
def find_user(users, name):
    if name not in users:
        return "not found"
    return users[name]

result = find_user({"ada": 36}, "bob")
print(result + 1)
```

```text
TypeError: can only concatenate str (not "int") to str
```

The real problem (no user called `bob`) shows up later as a confusing error in another place. Raising `KeyError(name)` in `find_user` would point straight at the cause.

**4. Raising with no message.** `raise ValueError` works, but `str(error)` is then an empty string, so the user sees a blank explanation. Always add a short message.

## Quick recap

- `raise SomeError("message")` stops the function and sends the error to the caller.
- Use `ValueError` for bad values and `TypeError` for wrong types.
- Make your own exception with `class MyError(Exception):`. End the name with `Error`.
- Build a family with a base exception, and catch specific types first.
- A bare `raise` inside `except` re-raises the same error.
- `raise NewError(...) from error` translates an error and keeps the original.
- `assert` is for catching your own bugs, not for checking user input.

Next, you will see how Python cleans up files and other resources automatically, even when errors happen, in [The with Statement and Context Managers](/courses/python/with-and-context-managers).

<code id="code-content" class="language-python">
# main.py: a tiny ticket booking system with custom exceptions
class BookingError(Exception):
    """Base class for all booking problems."""
#
class SoldOutError(BookingError):
    """Raised when not enough seats are left."""
    def __init__(self, wanted: int, left: int):
        self.wanted = wanted
        self.left = left
        super().__init__(f"wanted {wanted} seats, only {left} left")
#
class InvalidRequestError(BookingError):
    """Raised when the request itself makes no sense."""
#
seats_left = 5
#
def book(name: str, seats: int) -&gt; str:
    """Book seats or raise a clear error."""
    global seats_left
    if not isinstance(seats, int):
        raise TypeError("seats must be a whole number")
    if seats &lt;= 0:
        raise InvalidRequestError(f"{name}: seats must be positive, got {seats}")
    if seats &gt; seats_left:
        raise SoldOutError(seats, seats_left)
    seats_left -= seats
    return f"{name} booked {seats} seat(s). {seats_left} left."
#
requests = [("Ada", 2), ("Ben", 0), ("Cy", 4), ("Di", 3)]
#
if __name__ == "__main__":
    for person, count in requests:
        try:
            print(book(person, count))
        except SoldOutError as error:
            print(f"Sorry {person}: {error}. Try {error.left} instead?")
        except BookingError as error:
            print("Request rejected:", error)
</code></pre>

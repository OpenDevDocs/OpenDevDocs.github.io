---
publishDate: 2026-10-27T08:37
title: 'Docstrings and Writing Clean Functions'
slug: docstrings-and-clean-functions
metadescription: 'Write Python docstrings that help() can show, and learn simple habits for clean functions: good names, one job each, early returns and no magic numbers.'
updateDate: 2026-10-27T08:37
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'functions', 'clean-code']
course: python
---

## Code is read more than it is written

You write a function once, but you (and other people) will read it many times: when fixing a bug, when adding a feature, or when coming back to a project after a month away. Code that is easy to read saves a lot of time.

This lesson covers two things:

1. **Docstrings**: a built-in way to explain what a function does, right inside the function.
2. **Clean function habits**: small rules that make functions easier to understand, test and reuse.

You already know how to write [functions](/courses/python/functions) and add [type hints](/courses/python/type-hints). Now you will make them friendly to the next reader.

## What is a docstring?

A **docstring** (short for "documentation string") is a string you put on the **very first line** inside a function. It describes what the function does. By convention, it uses triple double quotes `"""`:

```python
def area(width, height):
    """Return the area of a rectangle."""
    return width * height


print(area(3, 4))
print(area.__doc__)
```

Output:

```text
12
Return the area of a rectangle.
```

A docstring is different from a `#` [comment](/courses/python/syntax-comments-indentation). Python throws comments away, but it **keeps** the docstring and attaches it to the function as `__doc__`. That means tools can show it to you.

### help() shows your docstring

The built-in `help()` function prints a function's signature and docstring:

```python
def area(width, height):
    """Return the area of a rectangle."""
    return width * height


help(area)
```

Output:

```text
Help on function area in module __main__:

area(width, height)
    Return the area of a rectangle.

```

This is exactly how you read the docs for built-in functions. Try `help(len)` or `help(str.split)` in the [REPL](/courses/python/python-repl). In VS Code, hovering over a function name also shows its docstring in a little popup.

## Writing a good docstring

For a small, obvious function, **one line** is enough. Write it as a command that says what the function does: "Return the area...", not "This function returns the area...".

For bigger functions, use a **multi-line docstring**:

- A one-line summary
- A blank line
- More detail: what the arguments are, and what comes back

A popular layout is the **Google style**:

```python
def convert_temperature(value: float, to: str = "F") -> float:
    """Convert a temperature between Celsius and Fahrenheit.

    Args:
        value: The temperature to convert.
        to: "F" to convert Celsius to Fahrenheit, "C" for the reverse.

    Returns:
        The converted temperature, rounded to 1 decimal place.
    """
    if to == "F":
        return round(value * 9 / 5 + 32, 1)
    return round((value - 32) * 5 / 9, 1)


print(convert_temperature(100))
print(convert_temperature(212, to="C"))
help(convert_temperature)
```

Output:

```text
212.0
100.0
Help on function convert_temperature in module __main__:

convert_temperature(value: float, to: str = 'F') -> float
    Convert a temperature between Celsius and Fahrenheit.

    Args:
        value: The temperature to convert.
        to: "F" to convert Celsius to Fahrenheit, "C" for the reverse.

    Returns:
        The converted temperature, rounded to 1 decimal place.

```

Notice how `help()` shows the type hints and the docstring together. The hints say **what type** each value is, and the docstring says **what it means**.

> **Tip:** Explain the **why** and the **what**, not the obvious **how**. "Rounded to 1 decimal place" is useful. "Uses an if statement" is not.

Docstrings also work at the top of a file (a **module docstring**) and inside classes. You will see those in [Modules and import](/courses/python/modules-and-imports) and [Classes and Objects](/courses/python/classes-and-objects).

### Bonus: examples that test themselves

You can put small REPL-style examples inside a docstring. The built-in `doctest` module can run them and check the answers. Save this as `prices.py`:

```python
def total_price(prices: list[float]) -> float:
    """Return the sum of all prices.

    >>> total_price([1.5, 2.5])
    4.0
    >>> total_price([])
    0
    """
    return sum(prices)
```

```bash
python3 -m doctest -v prices.py
```

```powershell
python -m doctest -v prices.py
```

The end of the output:

```text
   2 tests in prices.total_price
2 tests in 2 items.
2 passed.
Test passed.
```

Without `-v`, doctest prints nothing when all tests pass. For real test suites you will use pytest, covered in [Testing Your Code with pytest](/courses/python/testing-with-pytest).

## Habits for clean functions

Docstrings help, but the best documentation is code that is easy to read in the first place. Here is a messy function that works fine:

```python
def process(data):
    total = 0
    for x in data:
        if x["qty"] > 0:
            total += x["price"] * x["qty"]
    if total > 100:
        total = total * 0.9
    print("Order total: $" + str(round(total, 2)))


process([{"price": 40, "qty": 2}, {"price": 30, "qty": 1}, {"price": 5, "qty": 0}])
```

Output:

```text
Order total: $99.0
```

What is wrong with it?

- The name `process` says nothing. Process how?
- It does three jobs: adds up the cart, applies a discount, and prints.
- `100` and `0.9` are **magic numbers**: numbers with no explanation.
- It prints instead of returning, so you cannot reuse the total anywhere else.
- The money shows as `$99.0` instead of `$99.00`.

Here is a cleaner version:

```python
DISCOUNT_THRESHOLD = 100
DISCOUNT_RATE = 0.10


def subtotal(items: list[dict]) -> float:
    """Add up price times quantity for every item."""
    return sum(item["price"] * item["qty"] for item in items)


def apply_discount(amount: float) -> float:
    """Take 10% off orders over the threshold."""
    if amount > DISCOUNT_THRESHOLD:
        return amount * (1 - DISCOUNT_RATE)
    return amount


def format_money(amount: float) -> str:
    """Format a number as dollars, like $99.00."""
    return f"${amount:.2f}"


cart = [{"price": 40, "qty": 2}, {"price": 30, "qty": 1}, {"price": 5, "qty": 0}]
total = apply_discount(subtotal(cart))
print("Order total:", format_money(total))
```

Output:

```text
Order total: $99.00
```

It is a bit longer, but each piece is tiny and obvious. Let's go through the habits it uses.

### 1. Give functions clear names

A function **does** something, so start its name with a verb: `calculate_tax`, `send_email`, `is_valid_email`. Functions that answer yes or no often start with `is_`, `has_` or `can_`. Use `snake_case` (lowercase with underscores), as recommended by **PEP 8**, the official Python style guide.

| Unclear | Clear |
|---|---|
| `process(data)` | `subtotal(items)` |
| `do_it(x)` | `send_welcome_email(user)` |
| `check(s)` | `is_valid_password(text)` |

### 2. One function, one job

If you need the word "and" to describe a function, it might be doing too much. Small functions are easier to name, test and reuse. `format_money()` can now be used anywhere in your program.

### 3. Return values instead of printing

A function that **returns** a result is more useful than one that prints it. The caller can then print it, save it to a file, or use it in another calculation. Keep the `print()` calls near the top level of your program.

### 4. Replace magic numbers with named constants

`DISCOUNT_RATE = 0.10` explains itself. A lonely `0.9` does not. Constants also mean you only change a value in one place. Write them in `UPPER_CASE` at the top of the file.

### 5. Use early returns instead of deep nesting

Deeply nested `if` blocks are hard to follow. Handle the special cases first and `return` straight away:

```python
def describe_age(age: int) -> str:
    """Return a life stage for an age in years."""
    if age < 0:
        return "invalid"
    if age < 13:
        return "child"
    if age < 20:
        return "teenager"
    return "adult"


for a in (-1, 8, 16, 40):
    print(a, describe_age(a))
```

Output:

```text
-1 invalid
8 child
16 teenager
40 adult
```

Each check is on the left margin, and you can read it top to bottom like a list of rules. These are sometimes called **guard clauses**.

### 6. Keep the number of parameters small

If a function needs six or seven arguments, it is often doing too much, or the values belong together in one object (like a dictionary, or later a [data class](/courses/python/dataclasses)). Use [keyword arguments](/courses/python/function-arguments) so calls stay readable: `resize(image, width=800)`.

## Common mistakes

### Using a comment instead of a docstring

```python
def area(width, height):
    # Return the area of a rectangle.
    return width * height


print(area.__doc__)
```

Output:

```text
None
```

A `#` comment is not stored, so `help()` and your editor cannot show it. **Fix:** use a triple-quoted string as the first line of the function body.

### Using a list as a default value

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

The default list is created **once** and shared by every call, so items pile up. **Fix:** use `None` as the default and make a new list inside:

```python
def add_item(item, basket=None):
    """Add item to basket and return it. Makes a new basket if none given."""
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

### Docstrings that lie

If you change what a function does, update its docstring too. A wrong docstring is worse than none, because people trust it.

## Quick recap

- A **docstring** is a triple-quoted string on the first line of a function. Python keeps it in `__doc__`.
- `help(function)` and your editor show docstrings and type hints together.
- One line is fine for simple functions. Use a summary, a blank line and `Args:` / `Returns:` for bigger ones.
- Clean functions have **verb names**, do **one job**, **return** results, avoid **magic numbers** and use **early returns**.
- Never use a mutable value like `[]` as a default argument. Use `None` instead.

Next, you will split your code into several files in [Modules and import](/courses/python/modules-and-imports).

<code id="code-content" class="language-python">
"""main.py: a small shopping cart with clean, documented functions."""
#
DISCOUNT_THRESHOLD = 100  # orders above this get a discount
DISCOUNT_RATE = 0.10      # 10% off
#
def subtotal(items: list[dict]) -&gt; float:
    """Return the sum of price times quantity for every item."""
    return sum(item["price"] * item["qty"] for item in items)
#
def apply_discount(amount: float) -&gt; float:
    """Return the amount with the discount applied, if it qualifies.
    Args:
        amount: The order total before any discount.
    Returns:
        The new total. Orders at or below the threshold are unchanged.
    """
    if amount &lt;= DISCOUNT_THRESHOLD:
        return amount  # early return: nothing to do
    return amount * (1 - DISCOUNT_RATE)
#
def format_money(amount: float) -&gt; str:
    """Format a number as dollars with two decimals, like $99.00."""
    return f"${amount:.2f}"
#
def add_item(cart: list[dict], name: str, price: float, qty: int = 1) -&gt; None:
    """Append one item to the cart."""
    cart.append({"name": name, "price": price, "qty": qty})
#
if __name__ == "__main__":
    cart: list[dict] = []
    add_item(cart, "Book", 40, qty=2)
    add_item(cart, "Pen", 30)
    total = apply_discount(subtotal(cart))
    print("Order total:", format_money(total))
    help(format_money)
</code></pre>

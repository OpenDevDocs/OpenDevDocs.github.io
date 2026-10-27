---
publishDate: 2026-10-27T08:31
title: 'Defining and Calling Functions'
slug: functions
metadescription: 'Learn to write your own Python functions with def, pass in parameters, send results back with return, and split long programs into small reusable pieces.'
updateDate: 2026-10-27T08:31
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'functions']
course: python
---

## What is a function?

A **function** is a named block of code that does one job. You write it once, and then you can run it as many times as you like just by using its name.

Think of a recipe card. The card for "pancakes" lists the steps once. Whenever you want pancakes, you do not rewrite the steps; you just say "make pancakes" and follow the card. A function is a recipe card for your program.

You have already used lots of functions that Python gives you: `print()`, `len()`, `input()`, `sorted()`. In this lesson you will learn to make **your own**. You will learn how to:

- Define a function with `def`
- Call (run) it
- Give it input with **parameters**
- Get a result back with `return`
- Break a big program into small, readable pieces

## Why use functions?

In [Project: Contact Book](/courses/python/project-contact-book), the `match` block grew long, and some code was nearly repeated. Functions fix both problems:

| Without functions | With functions |
|---|---|
| The same lines copied in many places | Write the code once, call it anywhere |
| A fix must be made in every copy | Fix it in one place |
| One long script that is hard to follow | Small named pieces that explain themselves |
| Hard to test a single part | Each function can be tested on its own |

Programmers have a saying for this: **DRY**, "Don't Repeat Yourself".

## Defining and calling your first function

You **define** a function with the keyword `def`, a name, parentheses and a colon. The body is indented underneath, just like an [if statement](/courses/python/if-elif-else) or a loop:

```python
def say_hello():
    print("Hello!")
    print("Welcome to Python.")

say_hello()
say_hello()
```

Output:

```text
Hello!
Welcome to Python.
Hello!
Welcome to Python.
```

Two separate things happened here:

1. **Defining**: the `def` block teaches Python what `say_hello` means. Nothing is printed yet.
2. **Calling**: `say_hello()` actually runs the body. The parentheses are what make it run.

Function names follow the same rules as [variable](/courses/python/variables) names: lowercase words joined by underscores, and preferably a verb that says what the function does, like `send_email` or `calculate_total`.

> **Note:** A function must be defined **before** the line that calls it runs. Python reads your file from top to bottom, so put your `def` blocks near the top.

## Parameters: giving a function input

A function becomes much more useful when it can work with different values. You list **parameters** inside the parentheses. A parameter is a variable that gets its value when the function is called.

```python
def greet(name):
    print(f"Hello, {name}!")

greet("Ada")
greet("Grace")
```

Output:

```text
Hello, Ada!
Hello, Grace!
```

The value you pass in when calling (like `"Ada"`) is called an **argument**. People often mix up the two words, and that is fine, but here is the difference:

- **Parameter**: the name in the definition (`name`)
- **Argument**: the actual value in the call (`"Ada"`)

A function can take several parameters, separated by commas. Arguments are matched to parameters by position, first to first:

```python
def describe_pet(animal, name):
    print(f"I have a {animal} named {name}.")

describe_pet("cat", "Milo")
describe_pet("dog", "Rex")
```

Output:

```text
I have a cat named Milo.
I have a dog named Rex.
```

There are many more ways to pass arguments: default values, keyword arguments, and functions that accept any number of values. You will learn all of them in [Function Arguments: Defaults, Keywords, *args and **kwargs](/courses/python/function-arguments).

## return: getting a result back

So far our functions only printed things. Most useful functions **calculate** something and hand the result back to the code that called them. That is what `return` does:

```python
def add(a, b):
    return a + b

result = add(3, 4)
print(result)
print(add(10, 20) * 2)
```

Output:

```text
7
60
```

When Python reaches `return`, the function stops right away and the call `add(3, 4)` is replaced by the returned value, `7`. You can store it in a variable, print it, or use it in a bigger expression, just like the result of `len()`.

### return versus print

This is the most common confusion for beginners. `print()` **shows** a value on the screen. `return` **gives** a value back to your program so it can keep working with it.

```python
def square_print(n):
    print(n * n)

def square_return(n):
    return n * n

a = square_print(5)
b = square_return(5)
print("a is", a)
print("b is", b)
```

Output:

```text
25
a is None
b is 25
```

`square_print(5)` showed `25`, but it gave nothing back, so `a` is `None`. A function without a `return` statement always returns [None](/courses/python/booleans-and-none). `square_return(5)` printed nothing itself, but `b` holds `25`, ready to use.

> **Tip:** As a rule, let functions **return** results and let the main part of your program decide what to **print**. Functions that return values are easier to reuse and test.

### Returning early

`return` can appear more than once. The first one that runs ends the function. This is handy for checking special cases first:

```python
def grade(score):
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 50:
        return "C"
    return "F"

for s in [95, 80, 51, 12]:
    print(s, grade(s))
```

Output:

```text
95 A
80 B
51 C
12 F
```

No `elif` is needed, because once a `return` runs, the rest of the function is skipped.

### Returning more than one value

A function can return several values separated by commas. Python packs them into a [tuple](/courses/python/tuples-and-unpacking), and you can unpack them straight into variables:

```python
def stats(numbers):
    return min(numbers), max(numbers), sum(numbers) / len(numbers)

low, high, average = stats([4, 8, 15, 16, 23, 42])
print(low, high, average)
```

Output:

```text
4 42 18.0
```

## Functions calling functions

Functions can call other functions. This lets you build bigger tasks out of small, simple steps:

```python
def celsius_to_fahrenheit(c):
    return c * 9 / 5 + 32

def describe_temperature(c):
    f = celsius_to_fahrenheit(c)
    if c >= 30:
        feeling = "hot"
    elif c >= 15:
        feeling = "mild"
    else:
        feeling = "cold"
    return f"{c}°C is {f:.1f}°F, which feels {feeling}."

for temp in [35, 20, -5]:
    print(describe_temperature(temp))
```

Output:

```text
35°C is 95.0°F, which feels hot.
20°C is 68.0°F, which feels mild.
-5°C is 23.0°F, which feels cold.
```

Each function does **one** job and has a clear name. Reading `describe_temperature` almost feels like reading English.

## Variables inside functions stay inside

A variable created inside a function only exists while that function runs. It is **local** to the function:

```python
def make_total():
    total = 100
    return total

print(make_total())
print(total)
```

Output:

```text
100
Traceback (most recent call last):
  File "main.py", line 6, in <module>
    print(total)
          ^^^^^
NameError: name 'total' is not defined
```

The outside code cannot see `total`. This is a good thing: every function gets its own private workspace, so names in different functions never clash. The full rules are in [Variable Scope: Local, Global and nonlocal](/courses/python/variable-scope).

## A main() function

Many Python programs put their top-level steps into a function called `main()`, and call it at the bottom of the file:

```python
def get_total(prices):
    return sum(prices)

def main():
    prices = [3.5, 2.25, 4.0]
    print(f"Total: ${get_total(prices):.2f}")

if __name__ == "__main__":
    main()
```

Output:

```text
Total: $9.75
```

The line `if __name__ == "__main__":` means "only run `main()` when this file is run directly". It matters once you start importing your files into other files. You will learn exactly how it works in [Modules and import](/courses/python/modules-and-imports) and [Organizing Code into Packages and __main__](/courses/python/creating-packages). For now, treat it as a handy habit.

## Common mistakes

### Forgetting the parentheses

Without `()`, you do not call the function, you just refer to it:

```python
def say_hi():
    return "hi"

print(say_hi)
print(say_hi())
```

Output:

```text
<function say_hi at 0x000001B4A5DE7530>
hi
```

The first line shows the function object itself (the long number is a memory address and will differ on your computer). **Fix:** always add `()` to call a function.

### Calling a function before it is defined

```python
print(double(4))

def double(n):
    return n * 2
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(double(4))
          ^^^^^^
NameError: name 'double' is not defined
```

**Fix:** move the `def` above the code that calls it.

### Passing the wrong number of arguments

```python
def area(width, height):
    return width * height

print(area(5))
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    print(area(5))
          ~~~~^^^
TypeError: area() missing 1 required positional argument: 'height'
```

**Fix:** give one argument for each parameter: `area(5, 3)`. The error message even tells you which one is missing.

### Using print when you meant return

If you see `None` printed where you expected a value, check whether your function uses `print()` instead of `return`.

## Quick recap

- Define a function with `def name(parameters):` and an indented body.
- Call it with `name(arguments)`. The parentheses make it run.
- Parameters are the names in the definition, arguments are the values in the call.
- `return` sends a value back and ends the function. No `return` means it returns `None`.
- Prefer returning values over printing inside functions.
- Variables made inside a function are local to it.

Next, learn every way to pass values into your functions in [Function Arguments: Defaults, Keywords, *args and **kwargs](/courses/python/function-arguments).

<code id="code-content" class="language-python">
# main.py: a small shopping receipt built from small functions
def line_total(price, quantity):
    # return gives the result back to the caller
    return price * quantity
#
def apply_discount(amount, percent):
    if percent &lt;= 0:
        return amount  # returning early skips the rest
    return amount - amount * percent / 100
#
def format_money(amount):
    return f"${amount:,.2f}"
#
def print_receipt(items, discount_percent):
    # Functions can call other functions
    subtotal = 0
    for name, price, qty in items:
        total = line_total(price, qty)
        subtotal += total
        print(f"{name:&lt;10} {qty:&gt;2} x {format_money(price):&gt;7} = {format_money(total):&gt;8}")
    final = apply_discount(subtotal, discount_percent)
    print("-" * 36)
    print(f"Subtotal: {format_money(subtotal)}")
    print(f"Discount: {discount_percent}%")
    print(f"To pay:   {format_money(final)}")
    return final
#
def main():
    cart = [
        ("Notebook", 3.50, 4),
        ("Pen", 1.25, 10),
        ("Backpack", 39.99, 1),
    ]
    paid = print_receipt(cart, 10)
    print("Saved for later math:", round(paid, 2))
#
# Only run main() when this file is run directly
if __name__ == "__main__":
    main()
</code></pre>

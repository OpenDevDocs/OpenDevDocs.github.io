---
publishDate: 2026-10-27T08:58
title: 'Decorators'
slug: decorators
metadescription: 'Learn what Python decorators are, how the @ syntax works, how to write your own with functools.wraps, and decorators that take arguments.'
updateDate: 2026-10-27T08:58
author: ['bishal-biswas']
level: 3
tags: ['python', 'intermediate', 'functions']
course: python
---

## What is a decorator?

You have already used a few lines that start with `@`, like `@property` in [Properties and Encapsulation](/courses/python/properties-and-encapsulation) and `@dataclass` in [Data Classes](/courses/python/dataclasses). These are **decorators**.

A decorator is a function that **wraps** another function to add extra behavior, without changing the function's own code. Think of gift wrapping: the gift inside stays the same, but the wrapping adds something on the outside. With decorators you can add timing, logging, permission checks or caching to any function with a single line.

To understand decorators you need two ideas from [Lambda and Higher-Order Functions](/courses/python/lambda-and-higher-order-functions) and [Variable Scope](/courses/python/variable-scope). Let us review them quickly.

## Idea 1: functions are values

In Python a function is an object, just like a number or a string. You can store it in a variable and pass it to another function:

```python
def shout(text):
    return text.upper() + "!"


yell = shout
print(yell("hello"))


def apply_twice(func, value):
    return func(func(value))


print(apply_twice(shout, "hi"))
```

Output:

```text
HELLO!
HI!!
```

Notice `yell = shout` has no brackets. Without brackets you are talking **about** the function. With brackets you **call** it.

## Idea 2: functions can make functions

A function can define another function inside it and return it. The inner function remembers the variables around it, even after the outer function has finished. This is called a **closure**.

```python
def make_multiplier(n):
    def multiply(x):
        return x * n
    return multiply


double = make_multiplier(2)
triple = make_multiplier(3)
print(double(5), triple(5))
```

Output:

```text
10 15
```

`double` remembers that `n` was 2, and `triple` remembers that `n` was 3.

## Your first decorator

Put the two ideas together. A decorator takes a function, builds a new **wrapper** function around it, and returns the wrapper:

```python
def announce(func):
    def wrapper():
        print("About to run", func.__name__)
        func()
        print("Done")
    return wrapper


def say_hello():
    print("Hello!")


say_hello = announce(say_hello)
say_hello()
```

Output:

```text
About to run say_hello
Hello!
Done
```

The line `say_hello = announce(say_hello)` replaces the original function with the wrapped one. That is all a decorator does.

## The @ shortcut

Writing `say_hello = announce(say_hello)` is clumsy, so Python gives you a shortcut. Put `@announce` on the line above the `def`:

```python
def announce(func):
    def wrapper():
        print("About to run", func.__name__)
        func()
        print("Done")
    return wrapper


@announce
def say_hello():
    print("Hello!")


say_hello()
```

Output:

```text
About to run say_hello
Hello!
Done
```

Same result. `@announce` above a function means exactly "pass this function to `announce` and keep what it returns".

## A real decorator: timing any function

The `announce` decorator only works for functions with no arguments. A useful decorator should work with **any** function. Two tools make that possible:

- `*args, **kwargs` in the wrapper accepts any arguments and passes them on (from [Function Arguments](/courses/python/function-arguments)).
- `return result` sends the original function's answer back to the caller.

There is one more detail. After wrapping, the function's name and docstring would become those of `wrapper`. The `functools.wraps` decorator copies them over from the original, so help texts and error messages stay correct.

```python
import functools
import time


def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.2f}s")
        return result
    return wrapper


@timer
def slow_add(a, b):
    """Add two numbers slowly."""
    time.sleep(0.5)
    return a + b


print(slow_add(2, 3))
print(slow_add.__name__, "|", slow_add.__doc__)
```

Output (your time may be slightly different):

```text
slow_add took 0.50s
5
slow_add | Add two numbers slowly.
```

> **Tip:** Use this shape as your template for every decorator: `functools.wraps`, `*args, **kwargs`, and `return result`.

## Decorators with arguments

What if you want `@repeat(3)` to run a function three times? Now `repeat(3)` must **return** a decorator. That means one more layer of functions: a **decorator factory**.

```python
import functools


def repeat(times):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(times):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator


@repeat(3)
def cheer(name):
    print(f"Go {name}!")


cheer("Ada")
```

Output:

```text
Go Ada!
Go Ada!
Go Ada!
```

Read it from the outside in: `repeat(3)` returns `decorator`, then `decorator(cheer)` returns `wrapper`.

## Built-in decorators you will meet

| Decorator | What it does |
| --- | --- |
| `@property` | Turns a method into a read-only attribute |
| `@classmethod`, `@staticmethod` | Change how a method receives its first argument (see [Instance, Class and Static Methods](/courses/python/instance-class-static-methods)) |
| `@dataclass` | Writes `__init__`, `__repr__` and `__eq__` for a class |
| `@functools.cache` | Remembers results so repeated calls are instant |
| `@functools.wraps` | Copies name and docstring onto a wrapper |

`@functools.cache` is a superpower for slow [recursive](/courses/python/recursion) functions. Without it, this Fibonacci function would take ages for `n = 80`:

```python
import functools


@functools.cache
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)


print(fib(80))
print(fib.cache_info())
```

Output:

```text
23416728348467685
CacheInfo(hits=78, misses=81, maxsize=None, currsize=81)
```

Libraries use decorators everywhere too. In web frameworks like Flask, `@app.route("/")` connects a function to a web address, and in [pytest](/courses/python/testing-with-pytest) `@pytest.fixture` marks setup code.

## Stacking decorators

You can put more than one decorator on a function. The one **closest** to the `def` is applied first.

```python
import functools


def require_positive(func):
    @functools.wraps(func)
    def wrapper(amount):
        if amount <= 0:
            raise ValueError(f"{func.__name__} needs a positive amount, got {amount}")
        return func(amount)
    return wrapper


def log_call(func):
    @functools.wraps(func)
    def wrapper(*args):
        print(f"calling {func.__name__}{args}")
        return func(*args)
    return wrapper


@log_call
@require_positive
def deposit(amount):
    return f"Deposited {amount}"


print(deposit(50))
deposit(-5)
```

Output:

```text
calling deposit(50,)
Deposited 50
calling deposit(-5,)
Traceback (most recent call last):
  ...
ValueError: deposit needs a positive amount, got -5
```

## Common mistakes

**1. Forgetting to return the result.**

```python
def broken(func):
    def wrapper(*args, **kwargs):
        func(*args, **kwargs)
    return wrapper


@broken
def add(a, b):
    return a + b


print(add(2, 3))
print(add.__name__)
```

```text
None
wrapper
```

Two bugs at once: the answer is lost (no `return`), and the name became `wrapper` (no `functools.wraps`). Fix: `return func(*args, **kwargs)` and add `@functools.wraps(func)`.

**2. A wrapper that takes no arguments.** If `wrapper()` has no parameters, decorating a function that needs one fails:

```text
TypeError: announce.<locals>.wrapper() takes 0 positional arguments but 1 was given
```

Fix: write `def wrapper(*args, **kwargs):` and pass them on.

**3. Calling the function in the decorator line.** `@timer()` (with brackets) is different from `@timer`. Use brackets only for decorator factories like `@repeat(3)`.

## Quick recap

- Functions are values: you can pass them around and return them.
- A decorator is a function that takes a function and returns a wrapped version.
- `@name` above a `def` is a shortcut for `func = name(func)`.
- Use `*args, **kwargs`, `return result` and `@functools.wraps` in every wrapper.
- A decorator with arguments needs an extra outer function (a factory).
- Stacked decorators apply from the bottom up.

Next, you will learn to handle calendars and clocks in [Working with Dates and Times](/courses/python/dates-and-times).

<code id="code-content" class="language-python">
# main.py: three handy decorators
import functools
import time
#
#
def timer(func):
    """Print how long the wrapped function took."""
    @functools.wraps(func)  # keep the original name and docstring
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.perf_counter() - start:.2f}s")
        return result  # never forget to return the result!
    return wrapper
#
#
def repeat(times):
    """A decorator factory: @repeat(3) runs the function 3 times."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(times):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator
#
#
@timer
def slow_add(a, b):
    """Add two numbers slowly."""
    time.sleep(0.2)
    return a + b
#
#
@repeat(2)
def cheer(name):
    print(f"Go {name}!")
#
#
@functools.cache  # built-in decorator: remember earlier answers
def fib(n):
    return n if n &lt; 2 else fib(n - 1) + fib(n - 2)
#
#
if __name__ == "__main__":
    print(slow_add(2, 3))
    print(slow_add.__name__, "-", slow_add.__doc__)
    cheer("Ada")
    print(fib(80))
</code></pre>

---
publishDate: 2026-10-27T08:35
title: 'Recursion: Functions That Call Themselves'
slug: recursion
metadescription: 'Understand recursion in Python with simple examples: base cases, the call stack, nested data, RecursionError, and when a plain loop is the better choice.'
updateDate: 2026-10-27T08:35
author: ['bishal-biswas']
level: 2
tags: ['python', 'beginners', 'functions', 'recursion']
course: python
---

## What is recursion?

**Recursion** is when a function calls **itself** to solve a problem. That sounds like it would go on forever, and it would, unless you give it a way to stop.

Here is an everyday picture. You are standing in a long line and want to know your position. You cannot see the front, so you ask the person ahead of you: "What number are you?" They do not know either, so they ask the person ahead of them. This continues until the question reaches the first person, who simply says "I am number 1." Then the answers travel back: "I am 2", "I am 3", and so on, until your neighbor answers and you add one.

Every recursive function has the same two parts:

1. A **base case**: a simple situation where the answer is known right away ("I am number 1"). This is where the calling stops.
2. A **recursive case**: the function calls itself with a **smaller** version of the problem ("ask the person ahead, then add one").

In this lesson you will learn how to write recursive functions, how Python keeps track of them, and when you should use a normal [loop](/courses/python/for-loops-and-range) instead.

## Your first recursive function

Here is a countdown written with recursion instead of a [while loop](/courses/python/while-loops):

```python
def countdown(n):
    if n == 0:
        print("Liftoff!")
        return
    print(n)
    countdown(n - 1)


countdown(3)
```

Output:

```text
3
2
1
Liftoff!
```

- **Base case:** when `n` is `0`, print "Liftoff!" and stop with `return`.
- **Recursive case:** otherwise, print `n` and call `countdown()` again with `n - 1`.

Each call is a little closer to `0`, so the function is guaranteed to reach the base case.

## Returning values: factorial

Recursion gets more useful when each call **returns** something. The classic example is the **factorial** of a number, written `5!` in math. It means multiplying all whole numbers from 1 up to that number:

```text
5! = 5 * 4 * 3 * 2 * 1 = 120
```

Notice that `5!` is just `5 * 4!`, and `4!` is `4 * 3!`, and so on. A problem that contains a smaller copy of itself is a perfect fit for recursion:

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)


print(factorial(5))
print(factorial(1))
```

Output:

```text
120
1
```

## What actually happens: the call stack

When a function calls another function, Python pauses the first one and remembers where it was. It keeps these paused calls in a pile called the **call stack**. Think of a stack of plates: the newest call goes on top, and it must finish before the one below can continue.

Let's add some printing so you can watch the stack grow and shrink:

```python
def factorial(n, depth=0):
    indent = "  " * depth
    print(f"{indent}factorial({n}) called")
    if n <= 1:
        print(f"{indent}base case, returning 1")
        return 1
    result = n * factorial(n - 1, depth + 1)
    print(f"{indent}returning {result}")
    return result


factorial(4)
```

Output:

```text
factorial(4) called
  factorial(3) called
    factorial(2) called
      factorial(1) called
      base case, returning 1
    returning 2
  returning 6
returning 24
```

The calls go **down** until they hit the base case. Then the answers come back **up**, and each paused call finishes its multiplication. Every call has its own private `n`, because each call gets its own [local scope](/courses/python/variable-scope).

## Recursion with lists

You can also shrink a list instead of a number. This function adds up a list by taking the first item plus the total of "the rest":

```python
def total(numbers):
    if not numbers:
        return 0
    return numbers[0] + total(numbers[1:])


print(total([4, 8, 15, 16]))
```

Output:

```text
43
```

The base case is the **empty list**, whose total is `0`. The slice `numbers[1:]` (from [List Methods, Slicing and Sorting](/courses/python/list-methods-and-slicing)) is one item shorter each time.

> **Note:** In real code you would just use `sum(numbers)`. This example is here to show the pattern, not to replace `sum()`.

## Where recursion really shines: nested data

Recursion is the natural tool for data that has **layers inside layers**, where you do not know how deep it goes. For example, a list that contains lists that contain more lists:

```python
def flatten(items):
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


nested = [1, [2, 3], [4, [5, [6]]], 7]
print(flatten(nested))
```

Output:

```text
[1, 2, 3, 4, 5, 6, 7]
```

When `flatten()` finds a list inside the list, it hands that smaller list to another copy of itself. The base case here is quiet: when a list has no inner lists, the loop just finishes without calling itself.

Folders work the same way. A folder can contain files and more folders, which can contain more folders:

```python
folder = {
    "name": "projects",
    "children": [
        {"name": "notes.txt"},
        {"name": "python", "children": [
            {"name": "main.py"},
            {"name": "utils", "children": [{"name": "helpers.py"}]},
        ]},
    ],
}


def show(node, depth=0):
    print("    " * depth + node["name"])
    for child in node.get("children", []):
        show(child, depth + 1)


show(folder)
```

Output:

```text
projects
    notes.txt
    python
        main.py
        utils
            helpers.py
```

Writing this with plain loops would be much harder, because you would not know how many loops to nest.

## The recursion limit

Every paused call takes up memory. To protect your computer, Python stops you if the stack gets too deep. You can check the limit:

```python
import sys

print(sys.getrecursionlimit())
```

Output:

```text
1000
```

So recursion is fine for data that is a few hundred levels deep, but not for counting to a million. For that, use a loop.

## Recursion vs loops

Anything you can do with recursion, you can also do with a loop. Here is factorial again, with a `for` loop:

```python
def factorial(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result


print(factorial(5))
```

Output:

```text
120
```

| Use recursion when | Use a loop when |
|---|---|
| The data is nested (trees, folders, menus, JSON) | You are just repeating something N times |
| The problem naturally splits into smaller copies | The depth could be very large |
| The recursive version is clearly easier to read | Speed and memory matter a lot |

### A speed trap: Fibonacci

In the **Fibonacci** sequence, each number is the sum of the two before it: 0, 1, 1, 2, 3, 5, 8, and so on. The recursive version is short and pretty:

```python
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)


print([fib(i) for i in range(10)])
```

Output:

```text
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

But it repeats the same work again and again. `fib(5)` calls `fib(3)` twice, `fib(2)` three times, and it gets worse fast. The `functools.cache` tool fixes this by remembering answers it has already worked out:

```python
from functools import cache

calls = 0


def slow_fib(n):
    global calls
    calls += 1
    if n < 2:
        return n
    return slow_fib(n - 1) + slow_fib(n - 2)


@cache
def fast_fib(n):
    if n < 2:
        return n
    return fast_fib(n - 1) + fast_fib(n - 2)


print(slow_fib(25), "took", calls, "calls")
print(fast_fib(100))
```

Output:

```text
75025 took 242785 calls
354224848179261915075
```

Almost a quarter of a million calls for `fib(25)`! The cached version calculates `fib(100)` instantly. The `@cache` line is a **decorator**, which you will learn about in [Decorators](/courses/python/decorators). Remembering earlier results like this is called **memoization**.

## Common mistakes

### No base case (or one that is never reached)

```python
def countdown(n):
    print(n)
    countdown(n - 1)


countdown(3)
```

This prints `3`, `2`, `1`, `0`, `-1`, `-2` and keeps going for about a thousand lines, then crashes:

```text
  File "main.py", line 3, in countdown
    countdown(n - 1)
    ~~~~~~~~~^^^^^^^
  [Previous line repeated 995 more times]
  File "main.py", line 2, in countdown
    print(n)
    ~~~~~^^^
RecursionError: maximum recursion depth exceeded
```

**Fix:** make sure there is a base case, and that every recursive call moves **toward** it. A base case of `if n == 0` also breaks if you start with a negative number, so `if n <= 0` is safer.

### Forgetting to return the recursive result

```python
def factorial(n):
    if n <= 1:
        return 1
    n * factorial(n - 1)


print(factorial(3))
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 7, in <module>
    print(factorial(3))
          ~~~~~~~~~^^^
  File "main.py", line 4, in factorial
    n * factorial(n - 1)
    ~~^~~~~~~~~~~~~~~~~~
TypeError: unsupported operand type(s) for *: 'int' and 'NoneType'
```

The last line calculates a value but throws it away, so the function returns `None`. **Fix:** write `return n * factorial(n - 1)`.

## Quick recap

- A **recursive** function calls itself with a smaller version of the problem.
- Every recursive function needs a **base case** that stops the calls.
- Python tracks paused calls on the **call stack**. The default limit is about 1000 calls deep.
- Recursion is great for **nested data** like folders, trees and nested lists.
- For simple repetition, a loop is usually faster and safer.
- `functools.cache` can speed up recursive functions that repeat the same work.

Next, you will learn how to label what goes in and out of your functions in [Type Hints: Labeling Your Data](/courses/python/type-hints).

<code id="code-content" class="language-python">
# main.py: recursion with a base case and a recursive case
from functools import cache
#
def factorial(n):
    # Base case: 0! and 1! are both 1
    if n &lt;= 1:
        return 1
    # Recursive case: n! = n * (n - 1)!
    return n * factorial(n - 1)
#
def show_tree(node, depth=0):
    # Print this folder or file, then every child one level deeper
    print("    " * depth + node["name"])
    for child in node.get("children", []):
        show_tree(child, depth + 1)
#
@cache
def fib(n):
    # @cache remembers answers so each fib(n) is only worked out once
    if n &lt; 2:
        return n
    return fib(n - 1) + fib(n - 2)
#
if __name__ == "__main__":
    print("5! =", factorial(5))
    #
    project = {
        "name": "my_app",
        "children": [
            {"name": "main.py"},
            {"name": "data", "children": [{"name": "users.csv"}]},
        ],
    }
    show_tree(project)
    #
    print("First 10 Fibonacci numbers:", [fib(i) for i in range(10)])
</code></pre>

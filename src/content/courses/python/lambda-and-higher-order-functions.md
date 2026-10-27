---
publishDate: 2026-10-27T08:34
title: 'Lambda and Higher-Order Functions'
slug: lambda-and-higher-order-functions
metadescription: 'Treat Python functions as values: pass them to other functions, write short lambda functions, and use sorted(), map() and filter() with a key.'
updateDate: 2026-10-27T08:34
author: ['bishal-biswas']
level: 2
tags: ['python', 'beginners', 'functions', 'lambda']
course: python
---

## Functions are values too

So far you have used [functions](/courses/python/functions) by calling them: `greet("Ada")`. But in Python, a function is also a **value**, just like a number or a string. You can store it in a variable, put it in a list, or hand it to another function.

That idea unlocks a very handy style of code. Instead of writing a new loop every time, you write one general function and pass it the small piece of behavior that changes.

In this lesson you will learn:

- How to pass a function as an argument
- What a **higher-order function** is
- How to write tiny one-line functions with `lambda`
- How to use `sorted()`, `max()`, `map()` and `filter()` with your own functions

## Storing a function in a variable

Look at the difference between `shout` and `shout(...)`:

```python
def shout(text):
    return text.upper() + "!"


yell = shout
print(yell("hello"))
print(shout)
```

Output:

```text
HELLO!
<function shout at 0x00000290545178A0>
```

- `shout("hello")` with parentheses **calls** the function and gives you its result.
- `shout` without parentheses is the **function itself**, like a recipe card you have not cooked yet.

The line `yell = shout` gives the same function a second name. Calling `yell(...)` runs the exact same code. (The `0x...` number is a memory address. It will be different on your computer.)

## Higher-order functions

A **higher-order function** is a function that takes another function as an argument, or returns one. It sounds fancy, but it is simple in practice:

```python
def double(n):
    return n * 2


def square(n):
    return n * n


def apply_to_all(func, numbers):
    results = []
    for n in numbers:
        results.append(func(n))
    return results


print(apply_to_all(double, [1, 2, 3]))
print(apply_to_all(square, [1, 2, 3]))
```

Output:

```text
[2, 4, 6]
[1, 4, 9]
```

`apply_to_all()` does not know or care what `func` does. It just calls it on every number. You pass `double` (no parentheses!) and it doubles. You pass `square` and it squares. The loop is written only once.

Think of it like a food processor. The machine is the same, but you swap the blade depending on whether you want to slice or grate.

## lambda: tiny functions without a name

Writing a full `def` for something as small as `n * 2` can feel like a lot. Python gives you a shortcut called a **lambda**: a small, nameless function written on one line.

```python
lambda arguments: expression
```

The part after the colon is worked out and returned automatically. There is no `return` keyword.

```python
def double(n):
    return n * 2


double_lambda = lambda n: n * 2

print(double(5))
print(double_lambda(5))
print((lambda a, b: a + b)(3, 4))
```

Output:

```text
10
10
7
```

Both versions of `double` do the same job. The last line creates a lambda with two arguments and calls it straight away.

Lambdas have limits on purpose:

- Only **one expression**. No `if` blocks, no loops, no multiple lines.
- No statements such as `return`, `pass` or assignments (`x = 1`).

> **Tip:** If you find yourself writing `name = lambda ...`, use `def` instead. A `def` function has a real name, which shows up in error messages and is easier to read. Lambdas shine when you pass them straight into another function, as you will see next.

## Sorting with a key function

The most common place you will meet lambdas is the `key` argument of `sorted()`, `min()` and `max()`. The **key function** is called once for each item, and Python sorts by whatever it returns.

```python
words = ["banana", "Apple", "fig", "cherry"]

print(sorted(words))
print(sorted(words, key=len))
print(sorted(words, key=str.lower))
print(sorted(words, key=lambda w: w[-1]))
```

Output:

```text
['Apple', 'banana', 'cherry', 'fig']
['fig', 'Apple', 'banana', 'cherry']
['Apple', 'banana', 'cherry', 'fig']
['banana', 'Apple', 'fig', 'cherry']
```

| Key | Sorts by |
|---|---|
| none | Normal text order (capital letters come before lowercase) |
| `len` | Length of each word |
| `str.lower` | The lowercase version, so case does not matter |
| `lambda w: w[-1]` | The last letter of each word |

Notice you can pass **built-in** functions like `len` too. Any function that takes one item and returns something comparable works.

This is great for lists of [dictionaries](/courses/python/dictionaries):

```python
students = [
    {"name": "Asha", "score": 88},
    {"name": "Ben", "score": 95},
    {"name": "Chen", "score": 72},
]

by_score = sorted(students, key=lambda s: s["score"], reverse=True)
for s in by_score:
    print(s["name"], s["score"])

best = max(students, key=lambda s: s["score"])
print("Top student:", best["name"])
```

Output:

```text
Ben 95
Asha 88
Chen 72
Top student: Ben
```

## map(): change every item

`map(func, items)` calls `func` on every item and gives you the results:

```python
prices = [100, 250, 40]

with_tax = map(lambda p: p * 1.1, prices)
print(with_tax)
print(list(with_tax))

print(list(map(str, [1, 2, 3])))
```

Output:

```text
<map object at 0x00000223810B9E40>
[110.00000000000001, 275.0, 44.0]
['1', '2', '3']
```

Two things to notice:

1. `map()` returns a **map object**, not a list. It is **lazy**: it only does the work when you ask for the values. Wrap it in `list()` to see them all. (You will learn why lazy is useful in [Iterators and Generators](/courses/python/iterators-and-generators).)
2. `110.00000000000001` is not a bug in your code. Computers store decimals in binary, so tiny rounding errors appear. Use `round(p * 1.1, 2)` when you want to show money. See [Numbers and Math Operators](/courses/python/numbers-and-math) for more.

## filter(): keep only some items

`filter(func, items)` keeps the items where `func` returns something true:

```python
numbers = [5, 12, 7, 20, 3, 18]

big = filter(lambda n: n > 10, numbers)
print(list(big))

names = ["Ada", "", "Linus", ""]
print(list(filter(None, names)))
```

Output:

```text
[12, 20, 18]
['Ada', 'Linus']
```

Passing `None` as the function is a shortcut that keeps only **truthy** values, so the empty strings are dropped.

## map and filter vs comprehensions

You already know [comprehensions](/courses/python/comprehensions). They can do the same jobs, and many Python developers find them easier to read:

```python
numbers = [5, 12, 7, 20, 3, 18]

print([n * 2 for n in numbers])
print([n for n in numbers if n > 10])
```

Output:

```text
[10, 24, 14, 40, 6, 36]
[12, 20, 18]
```

A good rule of thumb: if you already have a named function (like `str` or `len`), `map()` is short and clear. If you would need a lambda, a comprehension is usually nicer.

### reduce() and sum()

`functools.reduce()` combines a list into one value by applying a function again and again. For adding numbers, the built-in `sum()` is simpler:

```python
from functools import reduce

numbers = [1, 2, 3, 4]
total = reduce(lambda a, b: a + b, numbers)
print(total)
print(sum(numbers))
```

Output:

```text
10
10
```

## Functions that return functions

A higher-order function can also **build and return** a new function:

```python
def make_multiplier(factor):
    def multiply(n):
        return n * factor
    return multiply


triple = make_multiplier(3)
print(triple(10))
print(make_multiplier(5)(2))
```

Output:

```text
30
10
```

The inner `multiply` remembers `factor` even after `make_multiplier()` has finished. That is a **closure**, which you met in [Variable Scope](/courses/python/variable-scope). This pattern is the foundation of [Decorators](/courses/python/decorators).

## Common mistakes

### Calling the function instead of passing it

```python
def double(n):
    return n * 2


print(list(map(double(), [1, 2])))
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 5, in <module>
    print(list(map(double(), [1, 2])))
                   ~~~~~~^^
TypeError: double() missing 1 required positional argument: 'n'
```

**Fix:** drop the parentheses. Write `map(double, [1, 2])`. You want to hand over the function, not its result.

### Writing return inside a lambda

```text
    print(sorted(nums, key=lambda n: return n))
                                     ^^^^^^
SyntaxError: invalid syntax
```

**Fix:** a lambda returns its expression automatically. Write `lambda n: n`.

### Forgetting that map() and filter() are lazy

If you print a map or filter object directly, you see `<map object at 0x...>` instead of your values. **Fix:** wrap it in `list()`. Also remember that you can only loop over it **once**. After that it is empty.

## Quick recap

- Functions are values. `func` is the function, `func()` calls it.
- A **higher-order function** takes or returns another function.
- `lambda args: expression` makes a small nameless function. It returns the expression automatically.
- Use `key=` with `sorted()`, `min()` and `max()` to choose what to compare.
- `map()` changes every item, `filter()` keeps some items. Both are lazy, so wrap them in `list()`.
- Comprehensions are often a clearer choice than `map()` or `filter()` with a lambda.

Next, you will see a function that calls itself in [Recursion: Functions That Call Themselves](/courses/python/recursion).

<code id="code-content" class="language-python">
# main.py: passing functions around, lambdas, sorted, map and filter
#
products = [
    {"name": "Laptop", "price": 900, "stock": 3},
    {"name": "Mouse", "price": 25, "stock": 0},
    {"name": "Keyboard", "price": 45, "stock": 12},
    {"name": "Monitor", "price": 180, "stock": 5},
]
#
def apply_to_all(func, items):
    # A higher-order function: 'func' is another function
    return [func(item) for item in items]
#
def make_discount(percent):
    # Returns a new function that remembers 'percent' (a closure)
    def discount(price):
        return round(price * (1 - percent / 100), 2)
    return discount
#
if __name__ == "__main__":
    # Sort by price, cheapest first, using a lambda as the key
    for p in sorted(products, key=lambda p: p["price"]):
        print(f"{p['name']:&lt;10} ${p['price']}")
    #
    # filter() keeps only products that are in stock
    in_stock = list(filter(lambda p: p["stock"] &gt; 0, products))
    print("In stock:", [p["name"] for p in in_stock])
    #
    # map() turns every name into upper case
    print(list(map(str.upper, [p["name"] for p in products])))
    #
    # A function built by another function
    sale = make_discount(20)
    prices = [p["price"] for p in products]
    print("Sale prices:", apply_to_all(sale, prices))
    #
    # max() with a key finds the most expensive item
    priciest = max(products, key=lambda p: p["price"])
    print("Most expensive:", priciest["name"])
</code></pre>

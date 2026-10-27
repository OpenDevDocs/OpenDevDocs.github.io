---
publishDate: 2026-10-27T08:27
title: 'List, Dict and Set Comprehensions'
slug: comprehensions
metadescription: 'Learn how Python comprehensions build lists, dictionaries and sets in one readable line, how to filter with if, and when a normal loop is clearer.'
updateDate: 2026-10-27T08:27
author: ['bishal-biswas']
level: 2
tags: ['python', 'comprehensions', 'lists', 'dictionaries']
course: python
---

## A shortcut for a very common loop

You have already written this kind of loop many times: start with an empty list, loop over something, and `append()` a new value each time.

```python
squares = []
for n in range(1, 6):
    squares.append(n * n)
print(squares)
```

Output:

```text
[1, 4, 9, 16, 25]
```

This pattern is so common that Python has a special short form for it, called a **comprehension**. Here is the same thing as a **list comprehension**:

```python
squares = [n * n for n in range(1, 6)]
print(squares)
```

Output:

```text
[1, 4, 9, 16, 25]
```

One line instead of three, and once you get used to it, it reads almost like English: "a list of `n * n` for each `n` in 1 to 5".

In this lesson you will learn list, dictionary and set comprehensions, how to filter with `if`, and, just as important, when **not** to use them.

## How to read a list comprehension

A list comprehension has three parts inside square brackets:

```text
[ expression   for item in collection ]
    what to       where the values
    keep          come from
```

- The **expression** is what goes into the new list (`n * n`).
- The **for part** is a normal [for loop](/courses/python/for-loops-and-range) header without the colon.
- The result is always a brand new list. The original collection is not changed.

A tip for reading them: start in the middle at `for`, then go back to the start. "For each `n` in the range, keep `n * n`."

More examples:

```python
names = ["ada", "grace", "linus"]
print([name.title() for name in names])
print([len(name) for name in names])

prices = [10, 25, 40]
print([p * 1.2 for p in prices])
```

Output:

```text
['Ada', 'Grace', 'Linus']
[3, 5, 5]
[12.0, 30.0, 48.0]
```

## Filtering with if

Add an `if` at the end to keep only some items. Items where the condition is `False` are skipped.

```python
numbers = [5, 12, 7, 20, 3, 18]
big = [n for n in numbers if n > 10]
print(big)

evens = [n for n in range(10) if n % 2 == 0]
print(evens)
```

Output:

```text
[12, 20, 18]
[0, 2, 4, 6, 8]
```

The long version of the first one would be:

```python
numbers = [5, 12, 7, 20, 3, 18]
big = []
for n in numbers:
    if n > 10:
        big.append(n)
print(big)
```

Output:

```text
[12, 20, 18]
```

You can transform and filter at the same time:

```python
words = ["apple", "", "Banana", "  ", "cherry"]
clean = [w.strip().lower() for w in words if w.strip()]
print(clean)
```

Output:

```text
['apple', 'banana', 'cherry']
```

Empty strings are "falsy" (they count as `False`), so `if w.strip()` keeps only words that have real text. You met truthy and falsy values in [Booleans, Comparisons and None](/courses/python/booleans-and-none).

### if/else in the expression

What if you want to **change** some items instead of dropping them? Then the condition goes at the **front**, as part of the expression, and it needs an `else`:

```python
scores = [45, 82, 67, 90, 30]
results = ["pass" if s >= 50 else "fail" for s in scores]
print(results)
```

Output:

```text
['fail', 'pass', 'pass', 'pass', 'fail']
```

`"pass" if s >= 50 else "fail"` is called a **conditional expression**. It picks one of two values in a single line.

| Where the `if` goes | What it does | Example |
|---|---|---|
| At the end | Filters (drops items) | `[x for x in xs if x > 0]` |
| At the front with `else` | Chooses a value for every item | `[x if x > 0 else 0 for x in xs]` |

## Dictionary comprehensions

Use curly braces and a `key: value` pair to build a [dictionary](/courses/python/dictionaries) in one line:

```python
names = ["ada", "grace", "linus"]
lengths = {name: len(name) for name in names}
print(lengths)

squares = {n: n * n for n in range(1, 5)}
print(squares)
```

Output:

```text
{'ada': 3, 'grace': 5, 'linus': 5}
{1: 1, 2: 4, 3: 9, 4: 16}
```

A common trick is to loop over `.items()` of an existing dictionary to make a changed copy:

```python
prices = {"coffee": 3.5, "tea": 2.0, "cake": 4.25}

on_sale = {item: round(price * 0.9, 2) for item, price in prices.items()}
print(on_sale)

cheap = {item: price for item, price in prices.items() if price < 4}
print(cheap)
```

Output:

```text
{'coffee': 3.15, 'tea': 1.8, 'cake': 3.83}
{'coffee': 3.5, 'tea': 2.0}
```

You can also swap keys and values (this works well when the values are unique):

```python
codes = {"red": "#f00", "green": "#0f0"}
by_code = {code: name for name, code in codes.items()}
print(by_code)
```

Output:

```text
{'#f00': 'red', '#0f0': 'green'}
```

## Set comprehensions

Curly braces **without** a colon build a [set](/courses/python/sets). Duplicates are dropped, as always:

```python
emails = ["Ana@Mail.com", "ben@mail.com", "ana@mail.com"]
unique = {e.lower() for e in emails}
print(sorted(unique))

first_letters = {word[0] for word in ["kiwi", "kale", "lime", "leek"]}
print(sorted(first_letters))
```

Output:

```text
['ana@mail.com', 'ben@mail.com']
['k', 'l']
```

## Quick reference

| You want | Brackets | Example |
|---|---|---|
| A list | `[ ]` | `[x * 2 for x in nums]` |
| A dictionary | `{ key: value }` | `{x: x * 2 for x in nums}` |
| A set | `{ }` without a colon | `{x % 3 for x in nums}` |

What about round brackets `( )`? Those make a **generator expression**, a lazy version that produces values one at a time without building a whole list. You can pass one straight into functions like `sum()`:

```python
total = sum(n * n for n in range(1, 6))
print(total)
```

Output:

```text
55
```

You will learn what generators really are in [Iterators and Generators](/courses/python/iterators-and-generators).

## Nested loops in a comprehension

A comprehension can have more than one `for`. They run in the same order as nested loops, left to right:

```python
pairs = [(color, size) for color in ["red", "blue"] for size in ["S", "M"]]
print(pairs)

grid = [[1, 2, 3], [4, 5, 6]]
flat = [n for row in grid for n in row]
print(flat)
```

Output:

```text
[('red', 'S'), ('red', 'M'), ('blue', 'S'), ('blue', 'M')]
[1, 2, 3, 4, 5, 6]
```

This is the point where comprehensions start to get hard to read. Use them carefully.

## When not to use a comprehension

Comprehensions are great when they are short and clear. They are a bad idea when:

- The line gets long and you have to read it three times.
- You need several steps, `print()` calls, or error handling inside the loop.
- You are not building a collection at all, just doing something for each item.

```python
# Bad: a comprehension used only for its side effect (it builds a useless list)
names = ["Ana", "Ben"]
[print(n) for n in names]

# Good: a plain loop says what you mean
for n in names:
    print(n)
```

Output:

```text
Ana
Ben
Ana
Ben
```

> **Tip:** A good rule: if a comprehension does not fit comfortably on one line, or needs more than one `if`, write a normal loop instead. Clear code beats clever code.

## Common mistakes

### Putting if/else at the end

A filter `if` at the end cannot have an `else`. This is a syntax error:

```text
[x if x > 0 else 0 for x in nums]   # correct: choose a value
[x for x in nums if x > 0 else 0]   # SyntaxError: invalid syntax
```

**Fix:** if you want an `else`, move the whole conditional to the front.

### Expecting a set or dict to keep duplicates

A set comprehension drops repeats, and a dict comprehension keeps only the **last** value for a repeated key:

```python
words = ["cat", "car", "dog"]
by_letter = {w[0]: w for w in words}
print(by_letter)
```

Output:

```text
{'c': 'car', 'd': 'dog'}
```

`"cat"` was replaced by `"car"` because both start with `"c"`.

## Quick recap

- `[expr for item in items]` builds a new list in one line.
- Add `if condition` at the end to filter items out.
- Put `a if condition else b` at the front to choose a value for every item.
- `{k: v for ...}` builds a dictionary, `{x for ...}` builds a set.
- `sum(x for x in items)` uses a generator expression, no list needed.
- If it stops being easy to read, use a normal loop.

Next, make your loops even neater with Python's built-in helpers in [enumerate, zip and Other Loop Helpers](/courses/python/enumerate-zip-and-loop-helpers).

<code id="code-content" class="language-python">
# main.py: a grade report built with comprehensions
students = {
    "Ana": [88, 92, 79],
    "Ben": [45, 60, 52],
    "Cara": [95, 98, 100],
    "Dev": [30, 41, 38],
}
#
# Dict comprehension: average score per student
averages = {name: round(sum(s) / len(s), 1) for name, s in students.items()}
print("Averages:", averages)
#
# List comprehension with a filter: who scored 80 or more on average?
honor_roll = [name for name, avg in averages.items() if avg &gt;= 80]
print("Honor roll:", honor_roll)
#
# if/else at the front: a result for every student
results = [f"{name}: {'pass' if avg &gt;= 50 else 'fail'}" for name, avg in averages.items()]
print("Results:", results)
#
# Set comprehension: which letter grades were given (no duplicates)
def letter(avg):
    if avg &gt;= 90:
        return "A"
    if avg &gt;= 70:
        return "B"
    if avg &gt;= 50:
        return "C"
    return "F"
#
grades_given = {letter(avg) for avg in averages.values()}
print("Grades given:", sorted(grades_given))
#
# Generator expression inside sum(): total points across everyone
total_points = sum(score for scores in students.values() for score in scores)
print("Total points:", total_points)
</code></pre>

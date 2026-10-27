---
publishDate: 2026-10-27T08:24
title: 'Tuples and Unpacking'
slug: tuples-and-unpacking
metadescription: 'Learn what Python tuples are, how they differ from lists, when to use them, and how unpacking lets you pull values out into variables in one line.'
updateDate: 2026-10-27T08:24
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'tuples', 'data-structures']
course: python
---

## What is a tuple?

A **tuple** (say "TUP-ul" or "TOO-pul", both are fine) is an ordered collection of values, a lot like a [list](/courses/python/lists). The big difference: once you create a tuple, you **cannot change it**. You cannot add, remove or replace items.

Think of a list as a whiteboard: you can wipe things off and write new ones. A tuple is more like a printed receipt: what is written there stays there.

Why would you want something you cannot change? Because some data should never change by accident. A date of birth, the latitude and longitude of a city, or the red, green and blue parts of a color are all good fits for a tuple.

In this lesson you will learn how to create tuples, read from them, and use **unpacking**, one of the most loved features in Python.

## Creating a tuple

You create a tuple with parentheses `()` and commas:

```python
point = (3, 5)
rgb = (255, 128, 0)
person = ("Ada", 36, "London")

print(point)
print(person)
print(type(person))
```

Output:

```text
(3, 5)
('Ada', 36, 'London')
<class 'tuple'>
```

Here is a surprise: it is really the **commas** that make a tuple, not the parentheses. The parentheses just make it easier to read.

```python
coords = 10, 20
print(coords)
print(type(coords))
```

Output:

```text
(10, 20)
<class 'tuple'>
```

### Tuples with one item

Because the comma makes the tuple, a one-item tuple needs a trailing comma. Without it, Python just sees a value in parentheses:

```python
not_a_tuple = ("hello")
a_tuple = ("hello",)

print(type(not_a_tuple))
print(type(a_tuple))
```

Output:

```text
<class 'str'>
<class 'tuple'>
```

An empty tuple is simply `()`.

## Reading from a tuple

Reading works exactly like a list. You can use indexes (starting at 0), negative indexes, slices, `len()`, `in` and `for` loops. Everything from [List Methods, Slicing and Sorting](/courses/python/list-methods-and-slicing) that does **not** change the data works here too.

```python
week = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

print(week[0])
print(week[-1])
print(week[5:])
print(len(week))
print("Fri" in week)

for day in week[:2]:
    print("Workday:", day)
```

Output:

```text
Mon
Sun
('Sat', 'Sun')
7
True
Workday: Mon
Workday: Tue
```

Tuples have only two methods, `count()` and `index()`, because those are the only ones that do not change anything:

```python
answers = ("yes", "no", "yes")
print(answers.count("yes"))
print(answers.index("no"))
```

Output:

```text
2
1
```

## Tuples cannot be changed

If you try to change an item, Python stops you with an error:

```python
point = (3, 5)
point[0] = 10
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    point[0] = 10
    ~~~~~^^^
TypeError: 'tuple' object does not support item assignment
```

A tuple also has no `append()` or `remove()`. If you really need a different tuple, you build a new one:

```python
point = (3, 5)
point = (10, point[1])
print(point)
```

Output:

```text
(10, 5)
```

This does not change the old tuple. It makes a new tuple and points the variable `point` at it. You will dig into this idea in [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying).

## Lists vs tuples

| | List | Tuple |
|---|---|---|
| Brackets | `[1, 2, 3]` | `(1, 2, 3)` |
| Can change? | Yes (mutable) | No (immutable) |
| Methods | Many (`append`, `sort`, ...) | Only `count` and `index` |
| Typical use | A group of similar items that grows or shrinks | A fixed group of related values |
| Can be a dictionary key? | No | Yes |

A simple rule of thumb: if you have "a bunch of the same kind of thing" (many scores, many names), use a list. If you have "one thing made of a few parts" (a point with x and y, a name with an age), use a tuple.

The last row will make sense in [Dictionaries: Key-Value Pairs](/courses/python/dictionaries). Dictionary keys must never change, so a tuple can be a key, but a list cannot.

You can convert between the two with `list()` and `tuple()`:

```python
frozen = tuple([1, 2, 3])
thawed = list((4, 5, 6))
print(frozen)
print(thawed)
```

Output:

```text
(1, 2, 3)
[4, 5, 6]
```

## Unpacking: one line, many variables

**Unpacking** means taking the values out of a tuple (or list) and putting each into its own variable, all in one line. Write the variable names on the left, separated by commas:

```python
person = ("Ada", 36, "London")
name, age, city = person

print(name)
print(age)
print(city)
```

Output:

```text
Ada
36
London
```

The number of variables on the left must match the number of items on the right. Python fills them in order: first to first, second to second.

### Swapping two variables

Unpacking gives you a famous Python trick. To swap two variables, you do not need a temporary helper variable:

```python
a = 1
b = 2
a, b = b, a
print(a, b)
```

Output:

```text
2 1
```

The right side `b, a` builds a tuple `(2, 1)` first, then Python unpacks it into `a` and `b`.

### Collecting the rest with *

Sometimes you only care about the first item or two. Put a star `*` before one variable name, and it collects "everything else" into a list:

```python
scores = (98, 91, 85, 72, 60)
best, second, *others = scores

print(best)
print(second)
print(others)

first, *middle, last = scores
print(first, middle, last)
```

Output:

```text
98
91
[85, 72, 60]
98 [91, 85, 72] 60
```

### Ignoring values with _

If you do not need a value, a common habit is to name it `_` (an underscore). It is a normal variable name, but it tells other people "I am ignoring this":

```python
record = ("Grace", "Hopper", 1906)
first_name, _, year = record
print(first_name, year)
```

Output:

```text
Grace 1906
```

### Unpacking in a for loop

Unpacking also works in a `for` loop. When each item is a pair, you can name both parts right in the loop line:

```python
cities = [("Paris", 2.1), ("Tokyo", 14.0), ("Lagos", 15.4)]

for name, millions in cities:
    print(f"{name} has about {millions} million people")
```

Output:

```text
Paris has about 2.1 million people
Tokyo has about 14.0 million people
Lagos has about 15.4 million people
```

This pattern shows up everywhere: with dictionaries, with `enumerate()` and with `zip()`. You will see it a lot in [enumerate, zip and Other Loop Helpers](/courses/python/enumerate-zip-and-loop-helpers).

## Returning many values from a function

Functions (coming up in [Defining and Calling Functions](/courses/python/functions)) can only return one thing. But that one thing can be a tuple, and the caller can unpack it. So in practice a function can hand back several values:

```python
def min_and_max(numbers):
    return min(numbers), max(numbers)

low, high = min_and_max([4, 9, 1, 7])
print("Lowest:", low)
print("Highest:", high)
```

Output:

```text
Lowest: 1
Highest: 9
```

Do not worry if `def` is new. Just notice that `return min(numbers), max(numbers)` sends back a tuple.

## Common mistakes

### Wrong number of variables

If the counts do not match, Python raises a `ValueError`:

```python
point = (3, 5, 7)
x, y = point
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    x, y = point
    ^^^^
ValueError: too many values to unpack (expected 2, got 3)
```

**Fix:** use the same number of variables as items, or use `*rest` to collect extras: `x, y, *rest = point`.

### Forgetting the comma in a one-item tuple

`("red")` is just the string `"red"`. Write `("red",)` when you really want a tuple with one item.

### Trying to change a tuple

If you find yourself wanting to `append()` to a tuple, you probably want a list. Convert it with `list(my_tuple)`, change the list, and convert back if needed.

## Quick recap

- A tuple is an ordered collection that cannot be changed: `point = (3, 5)`.
- Commas make the tuple. A one-item tuple needs a trailing comma: `("hi",)`.
- Read tuples with indexes, slices, `len()`, `in` and loops, just like lists.
- Use a list for many similar items, a tuple for one thing made of fixed parts.
- Unpacking puts items into variables: `name, age = ("Ada", 36)`.
- `a, b = b, a` swaps values. `first, *rest = items` collects extras into a list.

Next, learn how to look things up by name instead of by position in [Dictionaries: Key-Value Pairs](/courses/python/dictionaries).

<code id="code-content" class="language-python">
# main.py: tuples and unpacking in a small trip planner
# A tuple groups fixed, related values (it cannot be changed)
home = ("Berlin", 52.52, 13.40)
#
# Unpacking puts each item into its own variable
city, lat, lon = home
print(f"Home is {city} at latitude {lat}, longitude {lon}")
#
# A list of tuples: each stop is (city, nights)
stops = [("Prague", 2), ("Vienna", 3), ("Budapest", 2)]
#
# Unpack each pair right in the for loop
total_nights = 0
for name, nights in stops:
    print(f"- {name}: {nights} nights")
    total_nights += nights
print("Total nights away:", total_nights)
#
# Star unpacking: first stop, last stop, and everything between
first, *middle, last = stops
print("Start in", first[0], "and finish in", last[0])
print("Stops in between:", middle)
#
# A function can return a tuple, and you can unpack the result
def shortest_and_longest(trip):
    # lambda is a tiny one-line function (you will learn it later in the course)
    by_nights = sorted(trip, key=lambda stop: stop[1])
    return by_nights[0], by_nights[-1]
#
short, long = shortest_and_longest(stops)
print("Shortest stay:", short)
print("Longest stay:", long)
#
# Swap two values without a helper variable
a, b = "left", "right"
a, b = b, a
print(a, b)
</code></pre>

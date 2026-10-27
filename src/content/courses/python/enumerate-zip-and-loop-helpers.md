---
publishDate: 2026-10-27T08:28
title: 'enumerate, zip and Other Loop Helpers'
slug: enumerate-zip-and-loop-helpers
metadescription: 'Write cleaner Python loops with enumerate() for counters, zip() for walking lists side by side, plus reversed(), sorted(), any() and all().'
updateDate: 2026-10-27T08:28
author: ['bishal-biswas']
level: 2
tags: ['python', 'loops', 'enumerate', 'zip']
course: python
---

## Loops, but neater

Python's `for` loop is simple: it hands you one item at a time. But real tasks often need a little more. You might want:

- the item **and** its position number
- items from **two lists at once**, side by side
- the items **backwards**, or **sorted**
- a quick yes or no answer: "is **any** item too big?", "are **all** items filled in?"

Python has small built-in functions for each of these. They are called **loop helpers** in this lesson, and they make your loops shorter and easier to read. You will use them in almost every program you write from now on.

## enumerate(): items with a counter

Beginners often write a loop like this to get the position of each item:

```python
fruits = ["apple", "banana", "cherry"]
for i in range(len(fruits)):
    print(i, fruits[i])
```

Output:

```text
0 apple
1 banana
2 cherry
```

It works, but `range(len(fruits))` and `fruits[i]` are clumsy. `enumerate()` gives you the counter and the item together, as a pair you can [unpack](/courses/python/tuples-and-unpacking) right in the loop line:

```python
fruits = ["apple", "banana", "cherry"]
for i, fruit in enumerate(fruits):
    print(i, fruit)
```

Output:

```text
0 apple
1 banana
2 cherry
```

### Starting from 1

Counting from 0 is right for indexes, but people count from 1. Pass `start=1`:

```python
steps = ["Boil water", "Add pasta", "Wait 10 minutes", "Drain"]
for number, step in enumerate(steps, start=1):
    print(f"Step {number}: {step}")
```

Output:

```text
Step 1: Boil water
Step 2: Add pasta
Step 3: Wait 10 minutes
Step 4: Drain
```

### What enumerate() actually gives

`enumerate()` produces `(index, item)` [tuples](/courses/python/tuples-and-unpacking). You can see them by turning the result into a list:

```python
print(list(enumerate(["a", "b", "c"])))
```

Output:

```text
[(0, 'a'), (1, 'b'), (2, 'c')]
```

### Using the index to change a list

`enumerate()` is handy when you need to update items in place:

```python
prices = [10, 20, 30]
for i, price in enumerate(prices):
    prices[i] = price * 2
print(prices)
```

Output:

```text
[20, 40, 60]
```

## zip(): walking lists side by side

Say you have names in one list and scores in another, and the items line up. `zip()` pairs them together, like the teeth of a zipper:

```python
names = ["Ana", "Ben", "Cara"]
scores = [88, 72, 95]

for name, score in zip(names, scores):
    print(f"{name} scored {score}")
```

Output:

```text
Ana scored 88
Ben scored 72
Cara scored 95
```

`zip()` can take more than two collections:

```python
names = ["Ana", "Ben"]
ages = [31, 25]
cities = ["Lima", "Oslo"]

for name, age, city in zip(names, ages, cities):
    print(name, age, city)
```

Output:

```text
Ana 31 Lima
Ben 25 Oslo
```

### Building a dictionary with zip()

Feeding `zip()` into `dict()` turns two lists into a [dictionary](/courses/python/dictionaries) in one step:

```python
keys = ["name", "age", "city"]
values = ["Ada", 36, "London"]
person = dict(zip(keys, values))
print(person)
```

Output:

```text
{'name': 'Ada', 'age': 36, 'city': 'London'}
```

### When the lists have different lengths

`zip()` stops as soon as the **shortest** list runs out. Extra items are silently ignored:

```python
names = ["Ana", "Ben", "Cara"]
scores = [88, 72]
print(list(zip(names, scores)))
```

Output:

```text
[('Ana', 88), ('Ben', 72)]
```

That can hide a bug. Since Python 3.10, you can pass `strict=True` to get an error instead:

```python
names = ["Ana", "Ben", "Cara"]
scores = [88, 72]
for name, score in zip(names, scores, strict=True):
    print(name, score)
```

Output:

```text
Ana 88
Ben 72
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    for name, score in zip(names, scores, strict=True):
                       ~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^
ValueError: zip() argument 2 is shorter than argument 1
```

The first two pairs still print. The error comes the moment `zip()` notices that one list ran out before the other.

### enumerate() and zip() together

You can combine them. Wrap the `zip()` pair in parentheses when you unpack:

```python
names = ["Ana", "Ben", "Cara"]
scores = [88, 72, 95]
for rank, (name, score) in enumerate(zip(names, scores), start=1):
    print(rank, name, score)
```

Output:

```text
1 Ana 88
2 Ben 72
3 Cara 95
```

## reversed() and sorted()

`reversed()` walks through a sequence backwards. `sorted()` (from [List Methods, Slicing and Sorting](/courses/python/list-methods-and-slicing)) walks through it in order. Neither one changes the original list.

```python
countdown = [1, 2, 3]
for n in reversed(countdown):
    print(n)
print("Liftoff!")

words = ["pear", "fig", "apple"]
for w in sorted(words):
    print(w)
print(words)
```

Output:

```text
3
2
1
Liftoff!
apple
fig
pear
['pear', 'fig', 'apple']
```

## any() and all(): quick yes or no answers

- `any(items)` is `True` if **at least one** item is true.
- `all(items)` is `True` only if **every** item is true.

They become really useful with a [generator expression](/courses/python/comprehensions) inside, which checks a condition for each item:

```python
temps = [21, 24, 38, 19]
print(any(t > 35 for t in temps))
print(all(t > 15 for t in temps))

form = {"name": "Ada", "email": "", "city": "London"}
if not all(form.values()):
    print("Please fill in every field.")
```

Output:

```text
True
True
Please fill in every field.
```

The empty string `""` counts as false, so `all(form.values())` is `False`.

> **Note:** `any([])` is `False` and `all([])` is `True`. With nothing to check, nothing fails, so "all of them passed" is technically true.

## sum(), min() and max() with a key

You have used `sum()`, `min()` and `max()` on lists of numbers. `min()` and `max()` also accept `key=`, just like `sorted()`, to decide what to compare:

```python
words = ["kiwi", "banana", "fig"]
print(max(words, key=len))
print(min(words, key=len))

scores = {"Ana": 88, "Ben": 72, "Cara": 95}
best = max(scores, key=scores.get)
print("Top student:", best)
```

Output:

```text
banana
fig
Top student: Cara
```

`max(scores, key=scores.get)` loops over the keys, but compares them by their values.

## Looping over dictionaries, a reminder

Dictionaries have their own built-in "helpers": `.keys()`, `.values()` and `.items()`. The most useful is `.items()`, which works just like `zip()` for a dictionary:

```python
stock = {"apples": 3, "pears": 0, "plums": 7}
for fruit, count in stock.items():
    status = "in stock" if count else "sold out"
    print(f"{fruit}: {status}")
```

Output:

```text
apples: in stock
pears: sold out
plums: in stock
```

## Quick reference

| Helper | Gives you | Typical loop |
|---|---|---|
| `enumerate(xs, start=1)` | `(number, item)` pairs | `for i, x in enumerate(xs):` |
| `zip(a, b)` | `(a_item, b_item)` pairs | `for x, y in zip(a, b):` |
| `reversed(xs)` | items backwards | `for x in reversed(xs):` |
| `sorted(xs)` | items in order | `for x in sorted(xs):` |
| `any(...)` / `all(...)` | one `True` or `False` | `if any(x > 9 for x in xs):` |
| `d.items()` | `(key, value)` pairs | `for k, v in d.items():` |

## Common mistakes

### Unpacking in the wrong order

`enumerate()` gives the **index first**, then the item. Writing `for fruit, i in enumerate(fruits)` swaps them and leads to confusing bugs. Remember: number first.

### Trying to use a zip result twice

`zip()`, `enumerate()` and `reversed()` give you a one-time stream of values (an **iterator**). Once you have looped through it, it is empty:

```python
pairs = zip([1, 2], ["a", "b"])
print(list(pairs))
print(list(pairs))
```

Output:

```text
[(1, 'a'), (2, 'b')]
[]
```

**Fix:** turn it into a list once (`pairs = list(zip(...))`) if you need it more than once. You will learn why this happens in [Iterators and Generators](/courses/python/iterators-and-generators).

### Printing a zip object directly

`print(zip(a, b))` shows something like `<zip object at 0x...>` instead of the pairs. Wrap it in `list()` to see what is inside.

## Quick recap

- `enumerate(items, start=1)` gives you a counter with each item. No more `range(len(...))`.
- `zip(a, b)` walks two (or more) collections side by side. Add `strict=True` (Python 3.10+) to catch length mismatches.
- `dict(zip(keys, values))` builds a dictionary from two lists.
- `reversed()` and `sorted()` loop backwards or in order without changing the original.
- `any()` and `all()` answer yes or no questions about a whole collection.
- Helpers like `zip()` are one-time streams. Use `list()` to keep the values.

Next, find out why changing one list can unexpectedly change another in [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying).

<code id="code-content" class="language-python">
# main.py: a race results board using loop helpers
runners = ["Ana", "Ben", "Cara", "Dev"]
times = [312, 298, 305, 330]  # seconds
#
# zip() pairs each runner with their time
print("Raw results:")
for name, t in zip(runners, times, strict=True):
    print(f"  {name}: {t}s")
#
# sorted() with a key ranks by time; enumerate() numbers the places
# (lambda is a tiny one-line function, covered in a later lesson)
results = sorted(zip(runners, times), key=lambda pair: pair[1])
print("Final ranking:")
for place, (name, t) in enumerate(results, start=1):
    minutes, seconds = divmod(t, 60)
    print(f"  {place}. {name} ({minutes}:{seconds:02d})")
#
# dict(zip()) builds a lookup table
time_of = dict(zip(runners, times))
print("Ben's time:", time_of["Ben"])
print("Fastest:", min(time_of, key=time_of.get))
#
# any() and all() give quick yes or no answers
print("Anyone under 5 minutes?", any(t &lt; 300 for t in times))
print("Everyone under 6 minutes?", all(t &lt; 360 for t in times))
#
# reversed() walks backwards without changing the list
print("Last place first:")
for name, t in reversed(results):
    print(" ", name)
</code></pre>

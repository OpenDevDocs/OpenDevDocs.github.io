---
publishDate: 2026-10-27T08:57
title: 'Iterators and Generators'
slug: iterators-and-generators
metadescription: 'Understand how for loops really work in Python: iter(), next(), StopIteration, writing your own iterators and memory-friendly generators with yield.'
updateDate: 2026-10-27T08:57
author: ['bishal-biswas']
level: 3
tags: ['python', 'intermediate', 'generators']
course: python
---

## Why learn this?

You have used `for` loops since [for Loops and range()](/courses/python/for-loops-and-range). They work on lists, strings, dictionaries, files and more. But how does one `for` loop know how to walk through so many different things?

The answer is a simple agreement called the **iterator protocol**. Once you understand it, you can write your own objects that work in `for` loops, and you can write **generators**: functions that produce values one at a time instead of building a huge list in memory. Generators are how Python handles big files and endless streams of data without running out of memory.

## Iterables and iterators

Two words sound alike but mean different things:

- An **iterable** is anything you can loop over: a list, a string, a `range`, a file. Think of it as a **book**.
- An **iterator** is the thing that remembers your place while you loop. Think of it as a **bookmark**. It knows which item comes next.

You get an iterator from an iterable with `iter()`, and you move the bookmark forward with `next()`:

```python
colors = ["red", "green", "blue"]
it = iter(colors)
print(next(it))
print(next(it))
print(next(it))
print(next(it))
```

Output:

```text
red
green
blue
Traceback (most recent call last):
  ...
StopIteration
```

When there is nothing left, the iterator raises `StopIteration`. That is not really an error. It is the signal that means "the end".

## What a for loop really does

A `for` loop is just a friendly wrapper around `iter()` and `next()`. This loop:

```python
for color in colors:
    print(color)
```

does roughly the same as this:

```python
it = iter(colors)
while True:
    try:
        color = next(it)
    except StopIteration:
        break
    print(color)
```

The `for` loop calls `iter()` once, then `next()` again and again, and quietly stops when it sees `StopIteration`. (The `try` and `except` parts are covered in [Handling Errors with try and except](/courses/python/exceptions).)

## Writing your own iterator class

To make an object work in a `for` loop, give it two [dunder methods](/courses/python/dunder-methods):

- `__iter__` returns the iterator (here, the object itself).
- `__next__` returns the next value, or raises `StopIteration` when finished.

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value


for n in Countdown(3):
    print(n)
```

Output:

```text
3
2
1
```

It works, but that is a lot of code for counting down. Generators make this much easier.

## Generators: functions that pause

A **generator function** is a normal function that uses `yield` instead of `return`. Each `yield` hands out one value and then **pauses** the function, keeping all its variables. The next time you ask for a value, it continues right where it stopped.

```python
def countdown(start):
    while start > 0:
        yield start
        start -= 1


for n in countdown(3):
    print(n)

gen = countdown(2)
print(gen)
print(next(gen))
print(next(gen))
print(list(gen))
```

Output:

```text
3
2
1
<generator object countdown at 0x000001EF408D5B40>
2
1
[]
```

Calling `countdown(2)` does **not** run the body yet. It gives you a **generator object**, which is an iterator. The last `list(gen)` is empty because the generator was already used up.

You can see the pausing clearly with a few `print()` calls:

```python
def chatty():
    print("Starting")
    yield 1
    print("Back again")
    yield 2
    print("Finished")


g = chatty()
print("Created the generator")
print(next(g))
print(next(g))
for leftover in g:
    print("never printed")
```

Output:

```text
Created the generator
Starting
1
Back again
2
Finished
```

Notice "Starting" only appears when the first `next()` is called. That is called **lazy** evaluation: work happens only when a value is actually needed.

> **Tip:** `next()` accepts a default value to return instead of raising `StopIteration`. For example `next(gen, "done")` gives `'done'` when the generator is finished.

## Generator expressions

You already know [list comprehensions](/courses/python/comprehensions). Swap the square brackets for round ones and you get a **generator expression**. It produces the same values, but one at a time, without storing them all.

```python
import sys

squares_list = [n * n for n in range(1_000_000)]
squares_gen = (n * n for n in range(1_000_000))
print(sys.getsizeof(squares_list))
print(sys.getsizeof(squares_gen))
print(sum(n * n for n in range(1_000_000)))
```

Output:

```text
8448728
208
333332833333500000
```

The list takes about 8 MB. The generator takes about 200 bytes, no matter how many values it will produce. When a generator expression is the only argument, like in `sum(...)`, you can drop the extra brackets.

## Building pipelines

Because generators pass values along one at a time, you can chain them like stations on an assembly line. Each station does one small job.

```python
def read_lines(lines):
    for line in lines:
        yield line.strip()


def only_errors(lines):
    for line in lines:
        if line.startswith("ERROR"):
            yield line


log = ["INFO start\n", "ERROR disk full\n", "INFO retry\n", "ERROR no network\n"]
for line in only_errors(read_lines(log)):
    print(line)
```

Output:

```text
ERROR disk full
ERROR no network
```

Here `log` is a small list, but a file object is also an iterable of lines. Pass an open file instead (see [Reading and Writing Files](/courses/python/reading-and-writing-files)) and the same pipeline can scan a 10 GB log while holding only one line in memory.

## Endless generators and itertools

A generator does not have to end. This one counts forever, which is safe because it only makes the numbers you ask for:

```python
import itertools


def naturals():
    n = 1
    while True:
        yield n
        n += 1


print(list(itertools.islice(naturals(), 5)))
evens = (n for n in naturals() if n % 2 == 0)
print(next(evens), next(evens), next(evens))
print(list(itertools.chain([1, 2], (3, 4))))
```

Output:

```text
[1, 2, 3, 4, 5]
2 4 6
[1, 2, 3, 4]
```

The `itertools` module is full of tools for iterators. `islice()` takes the first few items, and `chain()` joins several iterables into one. See the [itertools docs](https://docs.python.org/3/library/itertools.html) for many more.

To hand out every value from another iterable inside a generator, use `yield from`:

```python
def numbers():
    yield from range(3)
    yield from "ab"


print(list(numbers()))
```

Output:

```text
[0, 1, 2, 'a', 'b']
```

## Common mistakes

**1. Using a generator twice.** A generator is a one-way trip:

```python
gen = (n * 2 for n in range(3))
print(list(gen))
print(list(gen))
```

```text
[0, 2, 4]
[]
```

Fix: if you need the values more than once, store them with `list(gen)` first, or create a new generator.

**2. Calling `next()` on a list.** A list is iterable, but it is not an iterator:

```text
TypeError: 'list' object is not an iterator
```

Fix: call `iter()` first: `next(iter(my_list))`.

**3. Asking a generator for its length.** Generators do not know how many items they will produce:

```text
TypeError: object of type 'generator' has no len()
```

Fix: use `len(list(gen))` if the data is small, or count as you loop.

## Quick recap

- An **iterable** can be looped over; an **iterator** remembers the position and gives the next item with `next()`.
- `StopIteration` signals the end; `for` loops handle it for you.
- Classes become iterable with `__iter__` and `__next__`.
- A function with `yield` is a **generator**: it pauses and resumes, producing values lazily.
- Generator expressions `( ... )` save memory compared to list comprehensions.
- Generators can be chained into pipelines or even run forever.

Next, you will learn how to wrap functions with extra behavior in [Decorators](/courses/python/decorators).

<code id="code-content" class="language-python">
# main.py: iterators and generators in one small log-reading pipeline
import itertools
#
#
class Countdown:
    """A hand-written iterator: __iter__ plus __next__."""
    def __init__(self, start):
        self.current = start
#
    def __iter__(self):
        return self
#
    def __next__(self):
        if self.current &lt;= 0:
            raise StopIteration  # tells the for loop to stop
        self.current -= 1
        return self.current + 1
#
#
def countdown(start):
    """The same thing as a generator: much shorter."""
    while start &gt; 0:
        yield start
        start -= 1
#
#
def clean(lines):
    for line in lines:
        yield line.strip()
#
#
def only_errors(lines):
    for line in lines:
        if line.startswith("ERROR"):
            yield line
#
#
def naturals():
    """An endless generator: 1, 2, 3, ..."""
    n = 1
    while True:
        yield n
        n += 1
#
#
if __name__ == "__main__":
    print(list(Countdown(3)), list(countdown(3)))
    # Manual stepping with next()
    gen = countdown(2)
    print(next(gen), next(gen), next(gen, "done"))
    # A lazy pipeline: each line flows through one step at a time
    log = ["INFO start\n", "ERROR disk full\n", "INFO retry\n", "ERROR no network\n"]
    for line in only_errors(clean(log)):
        print(line)
    # Take just the first 5 from an endless stream
    print(list(itertools.islice(naturals(), 5)))
    # A generator expression uses almost no memory
    print(sum(n * n for n in range(1_000_000)))
</code></pre>

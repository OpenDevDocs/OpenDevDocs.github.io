---
publishDate: 2026-10-27T08:39
title: 'A Tour of the Standard Library'
slug: standard-library-tour
metadescription: 'Meet the Python standard library: math, random, statistics, datetime, collections, os, sys, pathlib, time and json, each with a short runnable example.'
updateDate: 2026-10-27T08:39
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'modules', 'standard-library']
course: python
---

## Batteries included

Python is often described as having **"batteries included"**. That means it comes with a huge toolbox of ready-made [modules](/courses/python/modules-and-imports) called the **standard library**. It is installed together with Python, so you never need to download anything to use it. You just `import` it.

Think of it like moving into a furnished apartment. Before you go shopping for new furniture (installing packages from the internet), check what is already in the cupboards. Very often, the tool you need is already there.

This lesson is a quick tour. You will not learn every function, and you do not need to. The goal is to know **what exists**, so that when a problem comes up you think "oh, there is a module for that".

| Module | What it is for |
|---|---|
| `math` | Square roots, rounding up and down, pi |
| `random` | Random numbers, shuffling, picking items |
| `statistics` | Mean, median, mode |
| `datetime` | Dates, times and differences between them |
| `collections` | Handy extra data structures like `Counter` |
| `os` and `sys` | Talking to your computer and to Python itself |
| `pathlib` | Working with files and folders |
| `time` | Pausing and timing code |
| `json` | Saving and loading data as text |
| `itertools`, `string`, `secrets` | Combinations, character sets, safe random values |

## math: more than + and -

You already know the [math operators](/courses/python/numbers-and-math). The `math` module adds the rest of the calculator:

```python
import math

print(math.sqrt(25))
print(math.pi)
print(math.ceil(4.1), math.floor(4.9))
print(math.isclose(0.1 + 0.2, 0.3))
print(math.dist((0, 0), (3, 4)))
```

Output:

```text
5.0
3.141592653589793
5 4
True
5.0
```

- `ceil()` rounds **up** (think "ceiling"), `floor()` rounds **down** (think "floor").
- `isclose()` is the safe way to compare decimal numbers, because `0.1 + 0.2 == 0.3` is actually `False` in Python due to tiny rounding errors.
- `dist()` gives the straight-line distance between two points.

## random: dice, cards and surprises

```python
import random

random.seed(7)
print(random.randint(1, 6))
print(random.random())
print(random.choice(["rock", "paper", "scissors"]))

cards = ["A", "K", "Q", "J"]
random.shuffle(cards)
print(cards)
print(random.sample(range(1, 50), 6))
```

Output:

```text
3
0.9478653606090632
paper
['K', 'Q', 'J', 'A']
[24, 38, 4, 33, 14, 3]
```

| Function | Does |
|---|---|
| `randint(a, b)` | A whole number from `a` to `b`, including both ends |
| `random()` | A decimal from 0.0 up to (not including) 1.0 |
| `choice(items)` | One random item |
| `shuffle(items)` | Mixes a list in place |
| `sample(items, k)` | `k` different items, no repeats |

`random.seed(7)` makes the sequence repeat exactly, which is great for testing and for matching the output here. Remove it to get different results every run. You used `random` in the [Number Guessing Game](/courses/python/project-number-guessing-game).

> **Warning:** `random` is fine for games, but not for passwords or security codes. Use the `secrets` module for those (shown later in this lesson).

## statistics: quick number crunching

```python
import statistics

scores = [72, 88, 95, 61, 88, 79]
print(statistics.mean(scores))
print(statistics.median(scores))
print(statistics.mode(scores))
print(round(statistics.stdev(scores), 2))
```

Output:

```text
80.5
83.5
88
12.47
```

**Mean** is the average, **median** is the middle value when sorted, **mode** is the most common value, and **stdev** (standard deviation) tells you how spread out the numbers are.

## datetime: dates and times

```python
from datetime import date, datetime, timedelta

launch = date(2026, 12, 25)
print(launch)
print(launch.strftime("%A, %d %B %Y"))

deadline = launch + timedelta(days=30)
print(deadline)

start = datetime(2026, 10, 27, 9, 30)
print(start.strftime("%H:%M on %d/%m/%Y"))
print((date(2027, 1, 1) - date(2026, 10, 27)).days, "days until 2027")
```

Output:

```text
2026-12-25
Friday, 25 December 2026
2027-01-24
09:30 on 27/10/2026
66 days until 2027
```

- A `date` is a day, a `datetime` is a day plus a time.
- A `timedelta` is a length of time. Adding one to a date moves it forward, and it handles month and year changes for you.
- `strftime()` turns a date into text using codes like `%d` (day), `%B` (month name) and `%Y` (year).
- `datetime.now()` gives the current date and time (it will be different every time you run it).

There is a whole lesson on this in [Working with Dates and Times](/courses/python/dates-and-times).

## collections: smarter containers

`Counter` counts things for you, and `defaultdict` is a [dictionary](/courses/python/dictionaries) that creates missing values automatically:

```python
from collections import Counter, defaultdict

words = "the cat and the dog and the bird".split()
counts = Counter(words)
print(counts)
print(counts.most_common(2))

by_letter = defaultdict(list)
for w in ["apple", "avocado", "banana", "blueberry", "cherry"]:
    by_letter[w[0]].append(w)
print(dict(by_letter))
```

Output:

```text
Counter({'the': 3, 'and': 2, 'cat': 1, 'dog': 1, 'bird': 1})
[('the', 3), ('and', 2)]
{'a': ['apple', 'avocado'], 'b': ['banana', 'blueberry'], 'c': ['cherry']}
```

With a normal dictionary, `by_letter[w[0]].append(w)` would crash with a `KeyError` the first time it saw a new letter. `defaultdict(list)` quietly makes an empty list instead.

## os and sys: your computer and Python itself

```python
import os
import sys

print(sys.version_info >= (3, 10))
print(sys.platform in ("win32", "linux", "darwin"))
print(os.path.join("data", "reports", "june.csv"))
print(os.getenv("MY_APP_MODE", "development"))
```

Output on Windows:

```text
True
True
data\reports\june.csv
development
```

- `sys.version_info` tells you which Python version is running. `sys.platform` names the operating system.
- `os.path.join()` builds a file path with the right slashes for your system. On macOS and Linux the third line prints `data/reports/june.csv`.
- `os.getenv()` reads an **environment variable** (a setting stored outside your code), with a fallback value if it is not set.

Other `sys` tools you will meet: `sys.argv` (the words typed after your script name on the command line) and `sys.exit()` (stop the program).

## pathlib: files and folders the modern way

`pathlib` treats a file path as an object, and the `/` operator joins parts together:

```python
from pathlib import Path

folder = Path("demo_folder")
folder.mkdir(exist_ok=True)
note = folder / "hello.txt"
note.write_text("Hi from pathlib!")
print(note.read_text())
print(note.name, note.suffix, note.exists())
```

Output:

```text
Hi from pathlib!
hello.txt .txt True
```

This creates a real folder and file next to your script. You will learn more in [Reading and Writing Files](/courses/python/reading-and-writing-files) and [Working with File Paths using pathlib](/courses/python/pathlib).

## time: pausing and measuring

```python
import time

start = time.perf_counter()
time.sleep(0.5)
elapsed = time.perf_counter() - start
print(f"Took about {elapsed:.1f} seconds")
```

Output:

```text
Took about 0.5 seconds
```

`time.sleep()` pauses your program. `time.perf_counter()` is a precise stopwatch for measuring how long code takes.

## json: saving data as text

**JSON** is a text format for data that almost every language and website understands. The `json` module converts between Python objects and JSON text:

```python
import json

player = {"name": "Ada", "level": 7, "items": ["sword", "map"]}
text = json.dumps(player)
print(text)
print(type(text))

back = json.loads(text)
print(back["items"][0])
```

Output:

```text
{"name": "Ada", "level": 7, "items": ["sword", "map"]}
<class 'str'>
sword
```

`dumps()` means "dump to string" and `loads()` means "load from string". There is a full lesson in [Working with JSON and CSV Files](/courses/python/json-and-csv).

## A few more gems

```python
import itertools

print(list(itertools.permutations("ABC", 2)))
print(list(itertools.combinations([1, 2, 3, 4], 2)))
```

Output:

```text
[('A', 'B'), ('A', 'C'), ('B', 'A'), ('B', 'C'), ('C', 'A'), ('C', 'B')]
[(1, 2), (1, 3), (1, 4), (2, 3), (2, 4), (3, 4)]
```

**Permutations** are arrangements where order matters, **combinations** are groups where it does not.

```python
import string
import secrets

print(string.ascii_lowercase)
print(string.digits)
alphabet = string.ascii_letters + string.digits
password = "".join(secrets.choice(alphabet) for _ in range(12))
print(len(password))
```

Output:

```text
abcdefghijklmnopqrstuvwxyz
0123456789
12
```

`string` has ready-made sets of characters, and `secrets` makes random choices that are safe for passwords and tokens.

Other modules worth knowing by name: `re` for searching text ([Regular Expressions with re](/courses/python/regular-expressions)), `csv` for spreadsheets, `logging` for log messages ([Logging Instead of print()](/courses/python/logging)), `shutil` for copying and moving files, `urllib` for basic web requests, `sqlite3` for a small built-in database, and `unittest` for tests.

> **Tip:** The full list lives in the official docs at [docs.python.org/3/library](https://docs.python.org/3/library/index.html). Bookmark it. Each page has examples, and you can also type `help("modulename")` in the [REPL](/courses/python/python-repl).

## Common mistakes

### Mixing up the module and the class with the same name

The `datetime` module contains a class that is also called `datetime`:

```python
import datetime

print(datetime.now())
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    print(datetime.now())
          ^^^^^^^^^^^^
AttributeError: module 'datetime' has no attribute 'now'
```

**Fix:** either write `datetime.datetime.now()`, or import the class directly with `from datetime import datetime`.

### Naming your own file after a standard module

If you save your practice file as `random.py` or `math.py`, Python imports **your** file instead of the real module, and things break in confusing ways. Give your files different names. The details are in [Modules and import](/courses/python/modules-and-imports).

### Installing something that is already built in

`pip install json` or `pip install datetime` is never needed. If a module is in the standard library, just import it. You only use pip for third-party packages, which is the topic of the next lesson.

## Quick recap

- The **standard library** is a big set of modules that comes with Python. No installing needed.
- `math`, `random` and `statistics` cover most number work.
- `datetime` handles dates, times and time differences.
- `collections.Counter` counts things, `defaultdict` fills in missing keys.
- `os`, `sys`, `pathlib` and `time` talk to your computer, your Python and your files.
- `json` turns Python data into text and back.
- Use `secrets`, not `random`, for passwords.

Next, you will install code written by other people in [Installing Packages with pip](/courses/python/pip-and-packages).

<code id="code-content" class="language-python">
"""main.py: a mini daily report built only from the standard library."""
import json
import math
import random
import statistics
from collections import Counter
from datetime import date, timedelta
#
def make_steps(days: int) -&gt; list[int]:
    """Pretend step counts for a number of days."""
    return [random.randint(3000, 12000) for _ in range(days)]
#
def rating(steps: int) -&gt; str:
    """Turn a step count into a word."""
    if steps &gt;= 10000:
        return "great"
    if steps &gt;= 6000:
        return "good"
    return "low"
#
if __name__ == "__main__":
    random.seed(3)  # same numbers every run
    start = date(2026, 10, 20)
    steps = make_steps(7)
    #
    for i, count in enumerate(steps):
        day = start + timedelta(days=i)
        print(f"{day.strftime('%a %d %b')}: {count:&gt;6} steps ({rating(count)})")
    #
    print("Average:", round(statistics.mean(steps)))
    print("Median:", statistics.median(steps))
    print("Rounded up to thousands:", math.ceil(max(steps) / 1000) * 1000)
    print("Ratings:", Counter(rating(s) for s in steps).most_common())
    #
    summary = {"start": start.isoformat(), "total": sum(steps)}
    print(json.dumps(summary))
</code></pre>

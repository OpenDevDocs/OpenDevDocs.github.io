---
publishDate: 2026-10-27T08:48
title: 'The with Statement and Context Managers'
slug: with-and-context-managers
metadescription: 'Understand the with statement: how context managers close files and clean up automatically, and how to write your own with a class or @contextmanager.'
updateDate: 2026-10-27T08:48
author: ['bishal-biswas']
level: 2
tags: ['python', 'files', 'context-managers']
course: python
---

## The problem: forgetting to clean up

Some things in programming must be **opened** and later **closed**: files, database connections, network connections, locks. If you forget to close them, you can lose data that was never written to disk, run out of resources, or leave a file locked so other programs cannot use it.

Think of borrowing a library book. You take it out, read it, and must bring it back. The `with` statement is like a library that collects the book from you automatically the moment you finish, even if you trip on the way out.

## Closing a file by hand

Here is the old way, from before you met `with`:

```python
f = open("log.txt", "w", encoding="utf-8")
f.write("first line\n")
print(f.closed)
f.close()
print(f.closed)
```

Output:

```text
False
True
```

`f.closed` tells you whether the file is closed. This works, but it has two weak spots:

1. You might forget to write `f.close()`.
2. If an error happens between `open()` and `close()`, the `close()` line never runs.

You could fix the second problem with `try` and `finally` from [Handling Errors with try and except](/courses/python/exceptions), but that is a lot of typing for every single file.

## The with statement

The `with` statement does the closing for you:

```python
with open("log.txt", "w", encoding="utf-8") as f:
    f.write("first line\n")
    print("Inside:", f.closed)

print("After:", f.closed)
```

Output:

```text
Inside: False
After: True
```

How to read it:

- `with open(...)` opens the file.
- `as f` gives the open file a name you can use inside the block.
- The **indented block** is where you use the file.
- When the block ends, Python closes the file automatically.

### It closes even when an error happens

This is the real superpower:

```python
try:
    with open("log.txt", "w", encoding="utf-8") as f:
        f.write("start\n")
        result = 10 / 0
except ZeroDivisionError:
    print("Error caught")

print("File closed anyway?", f.closed)
```

Output:

```text
Error caught
File closed anyway? True
```

The division crashed in the middle of the block, yet the file was still closed properly before the error reached the `except`.

### Several resources at once

You can open more than one thing in a single `with`, separated by commas. Here we copy a file and turn it into capital letters:

```python
from pathlib import Path
Path("input.txt").write_text("hello\nworld\n", encoding="utf-8")

with open("input.txt", encoding="utf-8") as src, open("output.txt", "w", encoding="utf-8") as dst:
    for line in src:
        dst.write(line.upper())

print(Path("output.txt").read_text(encoding="utf-8"))
```

Output:

```text
HELLO
WORLD

```

Both files are closed when the block ends. If the line gets too long, you can wrap the managers in parentheses and put each on its own line (this needs Python 3.10 or newer).

## What is a context manager?

Any object that works with `with` is called a **context manager**. The "context" is the indented block: the manager sets things up when you enter the block and tidies up when you leave it.

Files are the most common example, but there are many more in the [standard library](/courses/python/standard-library-tour). For example, `tempfile.TemporaryDirectory()` creates a throwaway folder and deletes it, with everything inside, when you are done:

```python
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as folder:
    scratch = Path(folder) / "draft.txt"
    scratch.write_text("temporary", encoding="utf-8")
    print("Exists inside:", scratch.exists())

print("Exists after:", scratch.exists())
```

Output:

```text
Exists inside: True
Exists after: False
```

## How with works behind the scenes

A context manager is an object with two special methods (you will meet more of these in [Special (Dunder) Methods](/courses/python/dunder-methods)):

| Method | When Python calls it | Job |
| --- | --- | --- |
| `__enter__(self)` | At the start of the block | Set up. Its return value is what `as` receives |
| `__exit__(self, exc_type, exc_value, traceback)` | At the end, always | Clean up. Gets details of any error |

So `with` is roughly a short form of "call `__enter__`, run the block inside a `try`, and call `__exit__` in a `finally`".

### Writing your own with a class

Let's build a `Timer` that measures how long a block takes. If [classes](/courses/python/classes-and-objects) are new to you, focus on the shape: one method runs at the start, one at the end.

```python
class Timer:
    def __enter__(self):
        print("Timer started")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        print("Timer stopped")
        return False

with Timer() as t:
    print("Doing some work...")

print("Done")
```

Output:

```text
Timer started
Doing some work...
Timer stopped
Done
```

Now make it useful by actually measuring time:

```python
import time

class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.seconds = time.perf_counter() - self.start
        print(f"Took {self.seconds:.1f} seconds")
        return False

with Timer() as timer:
    time.sleep(0.5)

print(timer.seconds > 0.4)
```

Output:

```text
Took 0.5 seconds
True
```

`time.perf_counter()` is a precise stopwatch, and `time.sleep(0.5)` pauses for half a second.

### What does the return value of __exit__ mean?

If an error happened in the block, `__exit__` receives it. Returning `False` (or nothing) means "I cleaned up, now let the error continue". Returning `True` means "swallow the error", which you should almost never do.

```python
class Noisy:
    def __enter__(self):
        print("enter")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        print("exit, error was:", exc_type.__name__ if exc_type else None)
        return False

try:
    with Noisy():
        raise ValueError("boom")
except ValueError as error:
    print("caught outside:", error)
```

Output:

```text
enter
exit, error was: ValueError
caught outside: boom
```

## The easy way: @contextmanager

Writing a class is a bit long. The `contextlib` module offers a shortcut: write a function with a single `yield`, and add `@contextmanager` above it. Code before `yield` is the set up, code after it is the clean up.

```python
from contextlib import contextmanager

@contextmanager
def tag(name):
    print(f"<{name}>")
    yield
    print(f"</{name}>")

with tag("p"):
    print("Hello")
```

Output:

```text
<p>
Hello
</p>
```

The `@` line is a **decorator**, covered in [Decorators](/courses/python/decorators), and `yield` is explained fully in [Iterators and Generators](/courses/python/iterators-and-generators). For now, think of `yield` as "pause here and run the body of the `with` block".

To make sure clean up runs even if the block fails, wrap the `yield` in `try` and `finally`:

```python
from contextlib import contextmanager

@contextmanager
def tag(name):
    print(f"<{name}>")
    try:
        yield
    finally:
        print(f"</{name}>")

try:
    with tag("div"):
        print("Working")
        raise RuntimeError("oops")
except RuntimeError:
    print("handled")
```

Output:

```text
<div>
Working
</div>
handled
```

### Ignoring one specific error with suppress

`contextlib.suppress` is a ready made context manager that ignores the error types you name. It is a neat way to say "delete this file if it exists":

```python
from contextlib import suppress
from pathlib import Path

with suppress(FileNotFoundError):
    Path("old_cache.txt").unlink()

print("Still running")
```

Output:

```text
Still running
```

## Common mistakes

**1. Using a file after the block has ended.**

```python
with open("log.txt", "w", encoding="utf-8") as f:
    f.write("hello\n")

f.write("more\n")
```

```text
ValueError: I/O operation on closed file.
```

The variable `f` still exists, but the file behind it is closed. Do all the work inside the block (indented), or open the file again.

**2. Keeping a file object to loop over later.** `lines = f` inside the block, then `for line in lines:` outside it, gives the same `ValueError`. Read the data while the file is open, for example `lines = f.readlines()`.

**3. A class missing `__exit__`.**

```python
class Broken:
    def __enter__(self):
        print("enter")

with Broken():
    pass
```

```text
TypeError: 'Broken' object does not support the context manager protocol (missed __exit__ method)
```

A context manager needs both `__enter__` and `__exit__`.

**4. Forgetting to return from `__enter__`.** If `__enter__` returns nothing, the `as` variable is `None`:

```python
class Box:
    def __enter__(self):
        print("opening")

    def __exit__(self, exc_type, exc_value, traceback):
        print("closing")

with Box() as b:
    print(b)
```

```text
opening
None
closing
```

Add `return self` at the end of `__enter__`.

## Quick recap

- `with` sets something up, runs a block, then cleans up automatically, even when an error happens.
- Always open files with `with open(...) as f:`.
- You can manage several resources in one `with`, separated by commas.
- A context manager has `__enter__` (set up, value for `as`) and `__exit__` (clean up).
- `@contextmanager` lets you write one as a function: set up, `yield`, clean up (use `try`/`finally`).
- `contextlib.suppress(SomeError)` ignores one specific kind of error.

Errors that you cannot handle need to be found and fixed, so next you will learn [Debugging Python Code](/courses/python/debugging-python).

<code id="code-content" class="language-python">
# main.py: three kinds of context managers working together
import time
from contextlib import contextmanager, suppress
from pathlib import Path
#
class Timer:
    """Class based context manager that measures a block."""
    def __enter__(self):
        self.start = time.perf_counter()
        return self
    def __exit__(self, exc_type, exc_value, traceback):
        self.seconds = time.perf_counter() - self.start
        print(f"[timer] {self.seconds:.3f} s")
        return False  # never hide errors
#
@contextmanager
def section(title: str):
    """Function based context manager that prints a header and footer."""
    print(f"--- {title} ---")
    try:
        yield
    finally:
        print(f"--- end of {title} ---")
#
LOG = Path(__file__).parent / "app.log"
#
if __name__ == "__main__":
    # Remove an old log if there is one, ignore it if not
    with suppress(FileNotFoundError):
        LOG.unlink()
    with Timer(), section("writing"):
        with open(LOG, "w", encoding="utf-8") as f:
            for n in range(1, 4):
                f.write(f"line {n}\n")
        print("File closed?", f.closed)
    with section("reading"):
        with open(LOG, encoding="utf-8") as f:
            for line in f:
                print(" ", line.strip())
</code></pre>

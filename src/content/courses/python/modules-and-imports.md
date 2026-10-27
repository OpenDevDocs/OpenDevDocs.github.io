---
publishDate: 2026-10-27T08:38
title: 'Modules and import'
slug: modules-and-imports
metadescription: 'Split Python code across files with modules: import, from ... import, aliases with as, the __name__ == "__main__" check, and fixing common import errors.'
updateDate: 2026-10-27T08:38
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'modules', 'import']
course: python
---

## Why split code into files?

So far, every program you have written lives in one file. That is fine for small scripts. But as a program grows to hundreds of lines, one big file becomes hard to find your way around, like a book with no chapters.

Python lets you split code into several files and use code from one file in another. Each `.py` file is called a **module**. Bringing a module's code into your program is called **importing**, and you do it with the `import` keyword.

Modules give you three big wins:

- **Organization:** related functions live together in one file, like chapters in a book.
- **Reuse:** write a helper function once and import it in many programs.
- **Borrowing:** Python comes with hundreds of ready-made modules (the **standard library**), and you can install thousands more.

In this lesson you will learn how to import modules, the different styles of `import`, and how to fix the errors beginners hit most often.

## Your first module

Create a folder with two files in it:

```text
my_project/
    greetings.py
    main.py
```

Put some [functions](/courses/python/functions) and a variable in `greetings.py`:

```python
"""Small helpers for greeting people."""

DEFAULT_GREETING = "Hello"


def greet(name):
    return f"{DEFAULT_GREETING}, {name}!"


def farewell(name):
    return f"Goodbye, {name}."
```

Now use them from `main.py`:

```python
import greetings

print(greetings.greet("Ada"))
print(greetings.farewell("Ada"))
print(greetings.DEFAULT_GREETING)
```

Run `main.py` from inside the folder:

```bash
python3 main.py
```

```powershell
python main.py
```

Output:

```text
Hello, Ada!
Goodbye, Ada.
Hello
```

A few things to notice:

- You write `import greetings`, **without** the `.py` at the end.
- To use something from the module, you write the module name, a dot, then the name: `greetings.greet`. This is called **dot notation**.
- The module name comes from the file name. So file names must be valid Python names: `greetings.py` and `my_helpers.py` work, but `my-helpers.py` and `2tools.py` cannot be imported.

> **Note:** After the first import, you may see a `__pycache__` folder appear. It holds a compiled copy of your module so it loads faster next time. It is safe to ignore or delete.

## Importing from the standard library

Python ships with a big collection of modules called the **standard library**. You import them the same way, no installing needed:

```python
import math

print(math.sqrt(16))
print(math.floor(3.7), math.ceil(3.2))
```

Output:

```text
4.0
3 4
```

You will take a full tour of the most useful ones in [A Tour of the Standard Library](/courses/python/standard-library-tour).

## The different styles of import

There are a few ways to write an import. They all load the module, but they differ in **what name** you use afterward.

### from ... import ...

If you only need a couple of things, import them directly by name. Then you do not need the module prefix:

```python
from greetings import greet, farewell

print(greet("Linus"))
print(farewell("Linus"))
```

Output:

```text
Hello, Linus!
Goodbye, Linus.
```

### Renaming with as

Use `as` to give a module or function a shorter or clearer name. This is called an **alias**:

```python
import math
import random as rnd
from math import sqrt as square_root

print(math.pi)
print(square_root(81))
rnd.seed(1)
print(rnd.randint(1, 6))
```

Output:

```text
3.141592653589793
9.0
2
```

(`rnd.seed(1)` makes the "random" number the same every run, so you get the same output as here.)

Some aliases are so common that everyone uses them, like `import numpy as np` and `import pandas as pd` in data science.

### Which style should you use?

| Style | You write | Good for |
|---|---|---|
| `import math` | `math.sqrt(9)` | Most cases. It is always clear where a name came from. |
| `from math import sqrt` | `sqrt(9)` | When you use one or two names very often. |
| `import numpy as np` | `np.array(...)` | Long module names with a well-known short alias. |
| `from math import *` | `sqrt(9)` | Avoid it. It dumps every name into your file, and you cannot tell where anything came from. |

> **Tip:** Put all imports at the **top** of the file, one per line. PEP 8 (the Python style guide) suggests grouping them: standard library first, then installed packages, then your own modules.

## Looking inside a module

The built-in `dir()` function lists the names a module contains:

```python
import greetings

print(dir(greetings))
print(greetings.__doc__)
print(greetings.__name__)
```

Output:

```text
['DEFAULT_GREETING', '__builtins__', '__cached__', '__doc__', '__file__', '__loader__', '__name__', '__package__', '__spec__', 'farewell', 'greet']
Small helpers for greeting people.
greetings
```

Your own names are at the end. The ones with double underscores are filled in by Python. `__doc__` is the **module docstring**, the string at the top of the file (see [Docstrings and Writing Clean Functions](/courses/python/docstrings-and-clean-functions)). And you can call `help(greetings)` to see everything nicely formatted.

## Importing runs the whole file

Here is something that surprises everyone once. When you import a module, Python **runs every line in it** from top to bottom. Look at `shapes.py`:

```python
def square_area(side):
    return side * side


print("Testing shapes:", square_area(4))
```

And a program that imports it:

```python
import shapes

print("Main program:", shapes.square_area(10))
```

Output:

```text
Testing shapes: 16
Main program: 100
```

The test `print()` inside `shapes.py` ran too, even though you only wanted the function. That gets messy fast.

> **Note:** Python only runs a module the **first** time it is imported. If two files both `import shapes`, the code still runs once.

### The if __name__ == "__main__" check

Every module has a special variable called `__name__`:

- When you **run** a file directly (`python shapes.py`), its `__name__` is `"__main__"`.
- When a file is **imported**, its `__name__` is the module name, like `"shapes"`.

So you can wrap code that should only run when the file is the main program:

```python
def square_area(side):
    return side * side


print("__name__ is", __name__)

if __name__ == "__main__":
    print("Testing shapes:", square_area(4))
```

Running `shapes.py` directly:

```text
__name__ is __main__
Testing shapes: 16
```

Importing it from another file that calls `shapes.square_area(10)`:

```text
__name__ is shapes
Main program: 100
```

Now the test only runs when you want it. This is why the code panel at the end of each lesson uses `if __name__ == "__main__":`. It is the standard way to say "this is where the program starts".

## Where Python looks for modules

When you write `import something`, Python searches a list of folders, in order, and uses the first match. The list lives in `sys.path`, and the main places are:

1. The folder of the script you are running
2. The standard library folders
3. The `site-packages` folder, where installed packages go (you will see this in [Installing Packages with pip](/courses/python/pip-and-packages))

The first place matters most for beginners, as you will see in the mistakes below.

## Common mistakes

### Misspelling the module name

```python
import greeting
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    import greeting
ModuleNotFoundError: No module named 'greeting'
```

**Fix:** check the spelling (the file is `greetings.py`), check that the file is in the same folder as the script you run, and check that you ran Python **from that folder**. For packages from the internet, this error usually means you have not installed it yet, or you installed it into a different [virtual environment](/courses/python/virtual-environments).

### Importing a name that does not exist

```python
from greetings import hello
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    from greetings import hello
ImportError: cannot import name 'hello' from 'greetings' (.../my_project/greetings.py)
```

The module was found, but there is no `hello` inside it. **Fix:** use `dir(greetings)` to see the real names.

### Naming your file after a standard module

Say you are practising with random numbers and call your file `random.py`. Then in the same folder, `game.py` does this:

```python
import random

print(random.randint(1, 6))
```

Output:

```text
This is my random.py, not the real one!
Traceback (most recent call last):
  File "game.py", line 3, in <module>
    print(random.randint(1, 6))
          ^^^^^^^^^^^^^^
AttributeError: module 'random' has no attribute 'randint' (consider renaming '.../game/random.py' since it has the same name as the standard library module named 'random' and prevents importing that standard library module)
```

Because Python looks in the script's folder **first**, it found your `random.py` instead of the real one. Newer versions of Python even point this out in the error. **Fix:** rename your file (for example `dice_practice.py`) and delete any `__pycache__` folder next to it. Avoid names like `random.py`, `math.py`, `json.py`, `email.py` and `test.py`.

## Quick recap

- A **module** is any `.py` file. Use `import name` (no `.py`) to use its code.
- `import math` then `math.sqrt()`, or `from math import sqrt` then `sqrt()`.
- `as` gives an import a shorter **alias**.
- Avoid `from module import *`.
- Importing a file **runs** it. Put "only when run directly" code under `if __name__ == "__main__":`.
- Python searches the script's own folder first, so never name your files after standard modules.

Next, you will meet the most useful modules that come with Python in [A Tour of the Standard Library](/courses/python/standard-library-tour).

<code id="code-content" class="language-python">
"""main.py: using modules from the standard library with different import styles."""
import math                      # import the whole module
import random as rnd             # import with a short alias
from statistics import mean      # import one name directly
#
def circle_area(radius: float) -&gt; float:
    """Return the area of a circle (uses math.pi)."""
    return math.pi * radius ** 2
#
def roll_dice(count: int) -&gt; list[int]:
    """Roll some six-sided dice."""
    return [rnd.randint(1, 6) for _ in range(count)]
#
# This block only runs when you start this file directly.
# If another file does "import main", it is skipped.
if __name__ == "__main__":
    print("Module name:", __name__)
    print(f"Circle area: {circle_area(2):.2f}")
    #
    rnd.seed(42)  # same "random" numbers every run
    rolls = roll_dice(5)
    print("Rolls:", rolls)
    print("Average roll:", mean(rolls))
    #
    print("Square root of 144:", math.sqrt(144))
    print("Names in math starting with 'f':", [n for n in dir(math) if n.startswith("f")])
</code></pre>

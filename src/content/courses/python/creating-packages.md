---
publishDate: 2026-10-27T08:42
title: 'Organizing Code into Packages and __main__'
slug: creating-packages
metadescription: 'Group Python modules into a package folder with __init__.py, use relative imports, and make the package runnable with __main__.py and python -m.'
updateDate: 2026-10-27T08:42
author: ['bishal-biswas']
level: 2
tags: ['python', 'beginners', 'modules', 'packages']
course: python
---

## From files to folders

In [Modules and import](/courses/python/modules-and-imports) you learned that every `.py` file is a module. That works great for two or three files. But a real project might have twenty modules, and dumping them all in one folder gets messy fast.

The answer is a **package**: a **folder of modules** that you can import as one unit. You have already used packages: `requests` from [Installing Packages with pip](/courses/python/pip-and-packages) is one, and so is `json` in the standard library.

If a module is a chapter, a package is a whole book with a table of contents.

In this lesson you will build a small package called `budget` and learn:

- What `__init__.py` does
- How to import from inside a package (absolute and **relative** imports)
- How `__main__.py` lets you run a package with `python -m`
- The errors you will most likely meet, and how to fix them

## The project layout

Here is the project you will build:

```text
budget_app/
    main.py
    budget/
        __init__.py
        __main__.py
        money.py
        reports.py
```

`budget_app/` is just your project folder. `budget/` inside it is the **package**. The files inside the package are its modules.

## Step 1: the modules

`budget/money.py` holds the basic money helpers:

```python
"""Helpers for working with amounts of money."""


def format_money(amount: float) -> str:
    """Return an amount as dollars, like $1,234.50."""
    return f"${amount:,.2f}"


def total(amounts: list[float]) -> float:
    """Add up a list of amounts."""
    return round(sum(amounts), 2)
```

`budget/reports.py` builds a text report, and it **uses** functions from `money.py`:

```python
"""Build text reports from a list of expenses."""

from .money import format_money, total


def summary(expenses: dict[str, float]) -> str:
    """Return a short multi-line report."""
    lines = [f"{name:<10} {format_money(cost):>10}" for name, cost in expenses.items()]
    lines.append(f"{'TOTAL':<10} {format_money(total(list(expenses.values()))):>10}")
    return "\n".join(lines)
```

See the dot in `from .money import ...`? That is a **relative import**. The dot means "from the same package as me". You will learn more about it in a moment.

## Step 2: __init__.py

The file `__init__.py` (two underscores on each side, said "dunder init") marks a folder as a regular package. Python runs it **the first time** anything from the package is imported. It can be completely empty, but it is also the perfect place to choose what the package offers at the top level:

```python
"""budget: a tiny package for tracking spending."""

from .money import format_money
from .reports import summary

__version__ = "0.1.0"
__all__ = ["format_money", "summary"]
```

- The two imports pull the most useful functions up to the package level, so users can write `from budget import summary` instead of `from budget.reports import summary`.
- `__version__` is a common way to record the package version.
- `__all__` lists the names that `from budget import *` will give you. (Star imports are still best avoided, but `__all__` keeps them tidy.)

Think of `__init__.py` as the reception desk of a building: it greets visitors and points them to the right rooms.

> **Note:** Since Python 3.3, a folder without `__init__.py` can still be imported as a **namespace package**. That feature is meant for special cases. For your own projects, always add an `__init__.py`.

## Step 3: using the package

Now `main.py`, which sits **next to** the `budget` folder, can import it in several ways:

```python
import budget
from budget.money import total
from budget import format_money

print(budget.__version__)
print(format_money(1234.5))
print(total([9.99, 5.01, 20]))
```

Run it from the `budget_app` folder:

```bash
python3 main.py
```

```powershell
python main.py
```

Output:

```text
0.1.0
$1,234.50
35.0
```

You can reach any module with **dot notation**, like a path through folders:

```python
import budget.reports

print(budget.reports.summary({"Coffee": 4.5, "Books": 30}))
```

Output:

```text
Coffee          $4.50
Books          $30.00
TOTAL          $34.50
```

| Import style | Then you write |
|---|---|
| `import budget` | `budget.summary(...)` (works because `__init__.py` imported it) |
| `import budget.reports` | `budget.reports.summary(...)` |
| `from budget.money import total` | `total(...)` |
| `from budget import format_money` | `format_money(...)` |

## Absolute vs relative imports

Inside a package, there are two ways for one module to import another:

| Kind | Example | Meaning |
|---|---|---|
| **Absolute** | `from budget.money import total` | Start from the top package name |
| **Relative** | `from .money import total` | Start from **this** package (one dot) |
| **Relative** | `from ..utils import helper` | Go **up** one package level (two dots) |

Both work. Absolute imports are easier to read and are recommended by PEP 8 in most cases. Relative imports are handy inside a package because they keep working even if you rename the package folder. Pick one style and be consistent.

> **Warning:** Relative imports (with dots) only work in files that are part of a package. You cannot use them in a script you run directly, like `main.py`.

## Step 4: __main__.py and python -m

Sometimes you want to **run** a package like a program. Add a file called `__main__.py` inside it:

```python
"""Runs when you type: python -m budget"""

from budget import summary


def main() -> None:
    expenses = {"Rent": 950.0, "Food": 312.45, "Travel": 88.1}
    print(summary(expenses))


if __name__ == "__main__":
    main()
```

Now run the package by its name with `-m` (short for "module"):

```bash
python3 -m budget
```

```powershell
python -m budget
```

Output:

```text
Rent          $950.00
Food          $312.45
Travel         $88.10
TOTAL       $1,350.55
```

`python -m budget` means "find the package called `budget` and run its `__main__.py`". This is exactly how commands you already used work: `python -m pip` runs pip's `__main__.py`, and `python -m venv` runs venv's.

Putting the work inside a `main()` function, with the familiar `if __name__ == "__main__":` check at the bottom, keeps things tidy and makes `main()` easy to test.

### __main__.py vs if __name__ == "__main__"

These two are related, so let's be clear:

| | What it is | When it runs |
|---|---|---|
| `if __name__ == "__main__":` | A check inside **any** module | When that file is the program being run |
| `__main__.py` | A **file** inside a package | When you run the package with `python -m package_name` |

## Growing bigger: subpackages

A package can contain other packages, called **subpackages**. Each one is a folder with its own `__init__.py`:

```text
budget_app/
    main.py
    budget/
        __init__.py
        __main__.py
        money.py
        reports.py
        storage/
            __init__.py
            files.py
```

You would import from it with `from budget.storage.files import save`, or from inside `reports.py` with `from .storage.files import save`.

A good rule: start with one file. Split it into modules when it gets long. Group modules into a package when you have several that belong together. Do not create deep folder trees "just in case".

> **Tip:** When you want others to `pip install` your package, you add a `pyproject.toml` file that describes it (name, version, dependencies). That is a topic for later. For your own projects, the layout above is all you need. The official Python tutorial also has a short [section on packages](https://docs.python.org/3/tutorial/modules.html#packages).

## Common mistakes

### Running a package module directly

If you run a file that uses relative imports as a script:

```bash
python budget/reports.py
```

Output:

```text
Traceback (most recent call last):
  File "budget_app\budget\reports.py", line 3, in <module>
    from .money import format_money, total
ImportError: attempted relative import with no known parent package
```

When you run a file directly, Python treats it as a lonely script named `__main__`, not as part of the `budget` package, so the dot has nothing to point to. **Fix:** run code through the package instead: `python -m budget`, or `python main.py` from the project folder.

### Running from the wrong folder

If you are not in `budget_app` when you run the command:

```text
python.exe: No module named budget
```

Python only finds the package if it is in the **current folder** (for `-m`) or next to the script you run. **Fix:** `cd` into the project folder (the one that **contains** `budget/`) first.

### Circular imports

If `money.py` imports from `reports.py` **and** `reports.py` imports from `money.py`, Python can get stuck halfway through loading one of them and raise an `ImportError` that mentions a "partially initialized module". **Fix:** move the shared code into a third module that both can import, so the imports only go one way.

### Naming the package after something that already exists

A package called `json`, `email` or `requests` will hide the real one, just like naming a file `random.py` does. **Fix:** choose a unique name.

## Quick recap

- A **package** is a folder of modules with an `__init__.py` file.
- `__init__.py` runs on first import and decides what `import package` gives you.
- Import with dots: `import budget.reports` or `from budget.money import total`.
- **Relative imports** like `from .money import total` work only inside a package.
- `__main__.py` makes a package runnable with `python -m package_name`.
- Run commands from the folder that **contains** the package.

Next, you will learn how to save and load data from files in [Reading and Writing Files](/courses/python/reading-and-writing-files).

<code id="code-content" class="language-python">
"""main.py: builds a tiny 'budget' package on disk, then imports and runs it."""
import subprocess
import sys
import tempfile
from pathlib import Path
#
# The package files, as text (normally you would create these files yourself)
FILES = {
    "budget/__init__.py": "from .money import format_money\nfrom .reports import summary\n__version__ = '0.1.0'\n",
    "budget/money.py": "def format_money(amount):\n    return f'${amount:,.2f}'\n",
    "budget/reports.py": (
        "from .money import format_money\n"
        "def summary(expenses):\n"
        "    return '\\n'.join(f'{k:&lt;8}{format_money(v):&gt;10}' for k, v in expenses.items())\n"
    ),
    "budget/__main__.py": "from budget import summary\nprint(summary({'Rent': 950, 'Food': 312.45}))\n",
}
#
if __name__ == "__main__":
    project = Path(tempfile.mkdtemp())  # a throwaway project folder
    for name, code in FILES.items():
        path = project / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(code)
    #
    # Make the project folder importable, then import the package
    sys.path.insert(0, str(project))
    import budget
    print("Version:", budget.__version__)
    print(budget.format_money(1234.5))
    #
    # Same as typing "python -m budget" inside the project folder
    sys.stdout.flush()  # show our prints before the child process prints
    subprocess.run([sys.executable, "-m", "budget"], cwd=project)
</code></pre>

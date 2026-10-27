---
publishDate: 2026-10-27T08:44
title: 'Working with File Paths using pathlib'
slug: pathlib
metadescription: 'Learn to build, inspect and use file paths with pathlib: join folders with /, read and write files, create folders, and find files with glob.'
updateDate: 2026-10-27T08:44
author: ['bishal-biswas']
level: 2
tags: ['python', 'files', 'pathlib']
course: python
---

## What is a file path?

A **file path** is the address of a file on your computer. Just like a street address tells a delivery driver where to go, a path tells Python where a file lives. For example, `reports/2026/summary.txt` means "go into the `reports` folder, then into `2026`, then find `summary.txt`".

In [Reading and Writing Files](/courses/python/reading-and-writing-files) you opened files using plain strings like `"notes.txt"`. That works for simple cases, but paths get messy fast:

- Windows separates folders with a backslash (`\`), while macOS and Linux use a forward slash (`/`).
- Gluing strings together by hand (`"reports" + "/" + "summary.txt"`) is easy to get wrong.
- Getting just the file name or the extension from a string takes fiddly slicing.

Python's built-in **pathlib** module solves all of this. It gives you a `Path` object, a smart path that knows how to join folders, split names and talk to your file system on any operating system. It is part of the [standard library](/courses/python/standard-library-tour), so there is nothing to install.

## Creating paths and joining them with /

You make a path with `Path()`. To add a folder or file name to it, use the `/` operator. Here `/` does not mean division. It means "go inside".

```python
from pathlib import Path

report = Path("reports") / "2026" / "summary.txt"
print(report)
print(report.name)
print(report.stem)
print(report.suffix)
print(report.parent)
print(report.parts)
```

Output (on Windows):

```text
reports\2026\summary.txt
summary.txt
summary
.txt
reports\2026
('reports', '2026', 'summary.txt')
```

On macOS and Linux the first line prints `reports/2026/summary.txt` instead. You wrote the code once, and `Path` picked the right separator for the system. That is the main reason to use pathlib.

Each path has handy **attributes** (values stored on the object) that pull it apart for you:

| Attribute | Meaning | Value for `reports/2026/summary.txt` |
| --- | --- | --- |
| `.name` | Last part, the full file name | `summary.txt` |
| `.stem` | File name without the extension | `summary` |
| `.suffix` | The extension, including the dot | `.txt` |
| `.parent` | The folder that holds it | `reports/2026` |
| `.parts` | Every piece, as a [tuple](/courses/python/tuples-and-unpacking) | `('reports', '2026', 'summary.txt')` |

> **Note:** Creating a `Path` does not create a file or folder. It is only an address written on paper. Nothing touches the disk until you call a method such as `.mkdir()` or `.write_text()`.

## Relative and absolute paths

A **relative path** like `notes.txt` is relative to the **current working directory**, the folder your terminal was in when you started the program. An **absolute path** starts at the very top of the drive, like `C:\Users\you\notes.txt` or `/home/you/notes.txt`.

`Path.cwd()` gives you the current working directory, and `Path.home()` gives you your home folder. Both are absolute:

```python
from pathlib import Path

here = Path.cwd()
home = Path.home()
print(here.is_absolute())
print(home.is_absolute())
print(Path("notes.txt").is_absolute())
```

Output:

```text
True
True
False
```

If you `print(here)` you will see the full folder path of your own computer.

### Finding files next to your script

A common beginner surprise: your script reads `settings.txt`, it works in VS Code, then fails when you run it from another folder. That is because relative paths follow the working directory, not the script's location.

The fix is the special variable `__file__`, which holds the path of the current script. Its `.parent` is the folder the script lives in:

```python
from pathlib import Path

script_folder = Path(__file__).parent
data_file = script_folder / "settings.txt"
print(data_file.name)
print(data_file.parent == script_folder)
```

Output:

```text
settings.txt
True
```

Now `data_file` always points next to your script, no matter where you run it from.

## Checking, creating, reading and writing

`Path` objects can do real work on the disk. Here is a small journal program:

```python
from pathlib import Path

folder = Path("journal") / "2026"
folder.mkdir(parents=True, exist_ok=True)

entry = folder / "monday.txt"
entry.write_text("Learned about pathlib today.\n", encoding="utf-8")

print(entry.exists())
print(entry.is_file())
print(folder.is_dir())
print(entry.read_text(encoding="utf-8"))
```

Output:

```text
True
True
True
Learned about pathlib today.

```

What each method does:

- `.mkdir()` makes a folder. `parents=True` also creates any missing parent folders (here, `journal`). `exist_ok=True` means "do not complain if it already exists".
- `.write_text()` creates or overwrites a file with some text. It is a shortcut for `open(..., "w")` plus `write()`.
- `.read_text()` reads the whole file into one string.
- `.exists()`, `.is_file()` and `.is_dir()` answer yes or no questions with [booleans](/courses/python/booleans-and-none).

> **Tip:** Always pass `encoding="utf-8"` when reading or writing text. Otherwise Python may use a different default encoding on Windows, and characters like `é` or emoji can break.

For big files or line by line work, you can still use `open()`. A `Path` can be passed anywhere a string path is accepted, and it also has its own `.open()` method that works with the [with statement](/courses/python/with-and-context-managers).

## Listing and finding files

`.iterdir()` loops over everything inside a folder. `.glob()` finds names that match a **pattern**, where `*` means "any characters":

```python
from pathlib import Path

photos = Path("photos")
photos.mkdir(exist_ok=True)
for name in ["beach.jpg", "cat.png", "notes.txt", "sunset.jpg"]:
    (photos / name).write_text("x", encoding="utf-8")

for item in sorted(photos.iterdir()):
    print(item.name)

print("---")
for jpg in sorted(photos.glob("*.jpg")):
    print(jpg.name)
```

Output:

```text
beach.jpg
cat.png
notes.txt
sunset.jpg
---
beach.jpg
sunset.jpg
```

We wrap the results in `sorted()` because the operating system does not promise any particular order.

To search inside every subfolder too, use `.rglob()` (the "r" stands for **recursive**, meaning it keeps going down into folders inside folders):

```python
from pathlib import Path

base = Path("project")
(base / "src" / "utils").mkdir(parents=True, exist_ok=True)
(base / "main.py").write_text("print('hi')\n", encoding="utf-8")
(base / "src" / "app.py").write_text("", encoding="utf-8")
(base / "src" / "utils" / "helpers.py").write_text("", encoding="utf-8")

for file in sorted(base.rglob("*.py")):
    print(file.relative_to(base).as_posix())
```

Output:

```text
main.py
src/app.py
src/utils/helpers.py
```

`.relative_to(base)` removes the `project` part from the front, and `.as_posix()` turns the path into a string with forward slashes, which is nice for display on every system.

## Renaming, changing extensions and deleting

```python
from pathlib import Path

draft = Path("draft.txt")
draft.write_text("Hello pathlib", encoding="utf-8")
print(draft.stat().st_size, "bytes")

final = draft.with_suffix(".md")
print(final)
print(draft.with_name("final.txt"))

draft.rename(final)
print(draft.exists(), final.exists())

final.unlink()
print(final.exists())
final.unlink(missing_ok=True)
print("no error the second time")
```

Output:

```text
13 bytes
draft.md
final.txt
False True
False
no error the second time
```

- `.stat().st_size` is the file size in bytes.
- `.with_suffix()` and `.with_name()` build a **new** path with a different extension or name. They do not touch the disk.
- `.rename()` actually moves or renames the file.
- `.unlink()` deletes a file. `missing_ok=True` avoids an error if it is already gone.

> **Warning:** `.unlink()` deletes for real. The file does not go to the Recycle Bin or Trash. Double check the path before you call it.

## Common mistakes

**1. Adding a string and a Path with `+`.**

```python
from pathlib import Path

folder = Path("data")
print("my_" + folder)
```

```text
TypeError: can only concatenate str (not "WindowsPath") to str
```

(On macOS and Linux it says `PosixPath`.) Use `/` to join paths, or convert first: `"my_" + folder.name` or `f"my_{folder}"`.

**2. Creating nested folders without `parents=True`.**

```python
from pathlib import Path

Path("a/b/c").mkdir()
```

```text
FileNotFoundError: [WinError 3] The system cannot find the path specified: 'a\\b\\c'
```

Fix: `Path("a/b/c").mkdir(parents=True, exist_ok=True)`.

**3. Reading a file that is not there.**

```text
FileNotFoundError: [Errno 2] No such file or directory: 'missing.txt'
```

Check with `.exists()` first, build the path from `Path(__file__).parent`, or catch the error with [try and except](/courses/python/exceptions).

**4. Backslashes in normal strings.** In a string, `\n` means "new line" and `\t` means "tab", so Windows paths can turn into nonsense:

```python
print("C:\new\table")
print(r"C:\new\table")
```

```text
C:
ew	able
C:\new\table
```

Use a **raw string** (put `r` before the quotes) or, better, forward slashes: `Path("C:/new/table")` works on Windows too.

## Quick recap

- `from pathlib import Path` gives you smart path objects that work on every operating system.
- Join parts with `/`: `Path("data") / "file.txt"`.
- `.name`, `.stem`, `.suffix` and `.parent` split a path for you.
- `.exists()`, `.is_file()` and `.is_dir()` check the disk.
- `.mkdir(parents=True, exist_ok=True)`, `.write_text()` and `.read_text()` create folders and files.
- `.iterdir()`, `.glob()` and `.rglob()` list and search for files.
- Use `Path(__file__).parent` to find files next to your script.

Next, you will use these paths to save structured data in [Working with JSON and CSV Files](/courses/python/json-and-csv).

<code id="code-content" class="language-python">
# main.py: a tiny file organizer built with pathlib
from pathlib import Path
#
# Work inside a folder next to this script
BASE = Path(__file__).parent / "demo_files"
#
def make_sample_files(folder: Path) -&gt; None:
    """Create a few files so there is something to organize."""
    folder.mkdir(parents=True, exist_ok=True)
    for name in ["holiday.jpg", "cv.pdf", "todo.txt", "cat.png"]:
        (folder / name).write_text("sample", encoding="utf-8")
#
def organize(folder: Path) -&gt; None:
    """Move each file into a subfolder named after its extension."""
    for item in sorted(folder.iterdir()):
        if not item.is_file():
            continue  # skip folders
        ext = item.suffix.lstrip(".") or "no_extension"
        target_dir = folder / ext
        target_dir.mkdir(exist_ok=True)
        item.rename(target_dir / item.name)
        print(f"Moved {item.name} to {ext}/")
#
def show_tree(folder: Path) -&gt; None:
    """Print every file below the folder, using forward slashes."""
    for file in sorted(folder.rglob("*")):
        if file.is_file():
            print(" ", file.relative_to(folder).as_posix())
#
if __name__ == "__main__":
    make_sample_files(BASE)
    organize(BASE)
    print("Result:")
    show_tree(BASE)
</code></pre>

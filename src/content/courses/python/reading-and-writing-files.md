---
publishDate: 2026-10-27T08:43
title: 'Reading and Writing Files'
slug: reading-and-writing-files
metadescription: 'Save and load text files in Python with open() and the with statement: file modes, reading line by line, appending, encodings and common file errors.'
updateDate: 2026-10-27T08:43
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'files']
course: python
---

## Why files?

Every program you have written so far forgets everything the moment it stops. The [contact book](/courses/python/project-contact-book) loses its contacts, and a game loses its high score. That is because variables live in the computer's **memory** (RAM), which is wiped when the program ends.

To keep data between runs, you save it to a **file** on the disk. A file is like a notebook on a shelf: your program can write in it, close it, and come back tomorrow to read it again.

In this lesson you will learn how to:

- Open a file with `open()` and close it safely with `with`
- Write text to a file, and add to the end of one
- Read a whole file, or go through it line by line
- Choose the right **file mode** and **encoding**
- Fix the errors that beginners hit most often

This lesson focuses on plain **text files** (like `.txt`). Structured formats like JSON and CSV come in [Working with JSON and CSV Files](/courses/python/json-and-csv).

## Writing your first file

```python
with open("notes.txt", "w", encoding="utf-8") as file:
    file.write("Buy milk\n")
    file.write("Call Sam\n")
    file.write("Learn Python\n")

print("Saved!")
```

Output:

```text
Saved!
```

Run it, then look in the folder where you ran the script. There is a new file called `notes.txt` with three lines in it. Let's break the first line down:

| Part | Meaning |
|---|---|
| `open(...)` | Opens a file and gives you a **file object** to work with |
| `"notes.txt"` | The file name (or path) |
| `"w"` | The **mode**: `w` means write |
| `encoding="utf-8"` | How text is turned into bytes on disk (more on this below) |
| `with ... as file:` | Gives the file object the name `file` and **closes it automatically** at the end of the block |

A few important details:

- `write()` does **not** add a new line for you. You must add `"\n"` (the **newline character**) yourself.
- Mode `"w"` **creates** the file if it does not exist, and **erases** it if it does. Be careful with it.

### Why use with?

When you open a file, your operating system reserves it for your program. You should **close** it when you are done, so the data is fully saved and the file is released. The `with` statement does that for you, even if an error happens halfway through. It is like a door that closes itself behind you.

You can also open and close by hand:

```python
file = open("notes.txt", encoding="utf-8")
first = file.readline()
print(first.strip())
file.close()
print(file.closed)
```

Output:

```text
Buy milk
True
```

But it is easy to forget `close()`, or for an error to skip it. Always prefer `with`. You will learn how it works behind the scenes in [The with Statement and Context Managers](/courses/python/with-and-context-managers).

## Reading a whole file

Mode `"r"` means read. It is the default, so you can leave it out:

```python
with open("notes.txt", "r", encoding="utf-8") as file:
    content = file.read()

print(content)
print(type(content), len(content))
```

Output:

```text
Buy milk
Call Sam
Learn Python

<class 'str'> 31
```

`read()` gives you the entire file as one [string](/courses/python/strings). The empty line in the output appears because the file ends with `"\n"` and `print()` adds another one.

## Reading line by line

For most files, you want to handle one line at a time. A file object can be used directly in a [for loop](/courses/python/for-loops-and-range):

```python
with open("notes.txt", encoding="utf-8") as file:
    for line in file:
        print(repr(line))
```

Output:

```text
'Buy milk\n'
'Call Sam\n'
'Learn Python\n'
```

Using `repr()` shows the hidden `\n` at the end of every line. Usually you remove it with `.strip()` (from [Useful String Methods](/courses/python/string-methods)):

```python
with open("notes.txt", encoding="utf-8") as file:
    for number, line in enumerate(file, start=1):
        print(f"{number}. {line.strip()}")
```

Output:

```text
1. Buy milk
2. Call Sam
3. Learn Python
```

Looping over the file reads one line at a time, so it works even for huge files that would not fit in memory.

### Getting a list of lines

Two ways to get all lines as a [list](/courses/python/lists):

```python
with open("notes.txt", encoding="utf-8") as file:
    lines = file.readlines()
print(lines)

with open("notes.txt", encoding="utf-8") as file:
    tasks = file.read().splitlines()
print(tasks)
```

Output:

```text
['Buy milk\n', 'Call Sam\n', 'Learn Python\n']
['Buy milk', 'Call Sam', 'Learn Python']
```

`readlines()` keeps the `\n` characters. `read().splitlines()` removes them, which is usually what you want.

| Method | Returns |
|---|---|
| `file.read()` | The whole file as one string |
| `file.readline()` | The next single line (with its `\n`) |
| `file.readlines()` | A list of all lines (each with its `\n`) |
| `for line in file:` | One line per loop, memory friendly |

## Adding to a file: append mode

To add to the end without erasing what is there, use mode `"a"` (append):

```python
with open("notes.txt", "a", encoding="utf-8") as file:
    file.write("Water the plants\n")

with open("notes.txt", encoding="utf-8") as file:
    print(file.read())
```

Output:

```text
Buy milk
Call Sam
Learn Python
Water the plants

```

Append mode is perfect for things like log files and diaries, where new entries go at the bottom.

## File modes at a glance

| Mode | Name | If the file exists | If it does not exist |
|---|---|---|---|
| `"r"` | Read (default) | Reads it | `FileNotFoundError` |
| `"w"` | Write | **Erases** it, then writes | Creates it |
| `"a"` | Append | Adds to the end | Creates it |
| `"x"` | Exclusive create | `FileExistsError` | Creates it |

Mode `"x"` is a safe way to make sure you never overwrite something:

```python
with open("new_notes.txt", "x", encoding="utf-8") as file:
    file.write("Only created if it did not exist\n")
print("Created")
```

The first run prints `Created`. The second run fails on purpose:

```text
FileExistsError: [Errno 17] File exists: 'new_notes.txt'
```

> **Note:** Add `b` to a mode (like `"rb"` or `"wb"`) to work with **binary** files such as images, where you read raw bytes instead of text. You will not need that for text files.

## Writing many lines

To save a list, loop and write each item with a newline:

```python
fruits = ["apple", "banana", "cherry"]

with open("fruits.txt", "w", encoding="utf-8") as file:
    for fruit in fruits:
        file.write(fruit + "\n")

with open("fruits.txt", encoding="utf-8") as file:
    print(file.read())
```

Output:

```text
apple
banana
cherry

```

Or join them in one go. You can even use `print()` with `file=`, which adds the newline for you:

```python
fruits = ["apple", "banana", "cherry"]

with open("fruits.txt", "w", encoding="utf-8") as file:
    file.write("\n".join(fruits) + "\n")
    print("kiwi", file=file)

with open("fruits.txt", encoding="utf-8") as file:
    print(file.read())
```

Output:

```text
apple
banana
cherry
kiwi

```

### Saving numbers

Files hold **text**, so numbers must be [converted](/courses/python/type-conversion) to strings when writing, and back to numbers when reading:

```python
scores = [88, 95, 72]

with open("scores.txt", "w", encoding="utf-8") as file:
    for score in scores:
        file.write(f"{score}\n")

total = 0
with open("scores.txt", encoding="utf-8") as file:
    for line in file:
        total += int(line)
print("Total:", total)
```

Output:

```text
Total: 255
```

`int()` is fine with the trailing `\n`, because it ignores whitespace around the number.

## Encodings: why encoding="utf-8"?

Computers store text as numbers (bytes). An **encoding** is the rulebook for turning letters into bytes and back. **UTF-8** is the modern standard that handles every language and symbol.

If you leave out `encoding`, Python uses your system's default. On many Windows computers that is still an older encoding, so a file written on one computer can look broken on another. Watch what happens when text written as UTF-8 is read back with the wrong rulebook:

```python
with open("greeting.txt", "w", encoding="utf-8") as file:
    file.write("Héllo, wörld! café")

with open("greeting.txt", encoding="utf-8") as file:
    print(file.read())

with open("greeting.txt", encoding="cp1252") as file:
    print(file.read())
```

Output:

```text
Héllo, wörld! café
HÃ©llo, wÃ¶rld! cafÃ©
```

The second line is garbled. **Always pass `encoding="utf-8"`** when opening text files, and your files will work the same everywhere.

## Where is the file?

A plain name like `"notes.txt"` is a **relative path**: Python looks for it in the **current working directory**, which is the folder your terminal was in when you ran the script. That is not always the folder the script is saved in! If a file "disappears", check where you ran the command from.

You can check whether a file exists before opening it:

```python
import os

print(os.path.exists("notes.txt"))
print(os.path.exists("shopping.txt"))
```

Output:

```text
True
False
```

For a cleaner way to build paths and find folders, see [Working with File Paths using pathlib](/courses/python/pathlib).

## Common mistakes

### Opening a file that does not exist

```python
with open("shopping.txt", encoding="utf-8") as file:
    print(file.read())
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    with open("shopping.txt", encoding="utf-8") as file:
         ~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'shopping.txt'
```

**Fix:** check the spelling and the current folder. If the file is optional, check with `os.path.exists()` first, or catch the error with `try` and `except` ([Handling Errors with try and except](/courses/python/exceptions)).

### Writing something that is not a string

```python
scores = [88, 95, 72]

with open("scores.txt", "w", encoding="utf-8") as file:
    for score in scores:
        file.write(score)
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 5, in <module>
    file.write(score)
    ~~~~~~~~~~^^^^^^^
TypeError: write() argument must be str, not int
```

**Fix:** convert first: `file.write(str(score) + "\n")` or `file.write(f"{score}\n")`.

### Writing to a file opened for reading

```python
with open("notes.txt", encoding="utf-8") as file:
    file.write("oops")
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    file.write("oops")
    ~~~~~~~~~~^^^^^^^^
io.UnsupportedOperation: not writable
```

**Fix:** the default mode is `"r"`. Open with `"w"` or `"a"` to write.

### Using the file after the with block

```python
with open("notes.txt", encoding="utf-8") as file:
    data = file.read()
print(file.read())
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    print(file.read())
          ~~~~~~~~~^^
ValueError: I/O operation on closed file.
```

**Fix:** do all your reading inside the `with` block, or save what you need in a variable (here, `data`) and use that afterward.

### Reading twice and getting nothing

A file object remembers its position, like a bookmark. After `read()` reaches the end, there is nothing left:

```python
with open("notes.txt", encoding="utf-8") as file:
    first = file.read()
    second = file.read()
print(len(first), repr(second))
```

Output:

```text
48 ''
```

**Fix:** read once and keep the result in a variable, or open the file again.

### Accidentally erasing a file with "w"

Opening an existing file with `"w"` empties it immediately, even before you write anything. **Fix:** use `"a"` to add to it, or `"x"` if you want an error instead of an overwrite.

## Quick recap

- Use `with open(name, mode, encoding="utf-8") as file:` so the file is always closed.
- Modes: `"r"` read (default), `"w"` write (erases first), `"a"` append, `"x"` create only.
- `write()` needs a **string** and does not add `\n` for you.
- `read()` gets everything, `for line in file:` goes line by line. Use `.strip()` to remove `\n`.
- Always set `encoding="utf-8"` for text files.
- Relative file names are found from the folder you ran the program in.

Next, you will learn a cleaner way to build and inspect file paths in [Working with File Paths using pathlib](/courses/python/pathlib).

<code id="code-content" class="language-python">
"""main.py: a tiny to-do list that is saved to a text file between runs."""
import os
#
TODO_FILE = "todo.txt"
#
def load_tasks(filename: str) -&gt; list[str]:
    """Read tasks from the file, one per line. Missing file = no tasks."""
    if not os.path.exists(filename):
        return []
    with open(filename, encoding="utf-8") as file:
        return [line.strip() for line in file if line.strip()]
#
def save_tasks(filename: str, tasks: list[str]) -&gt; None:
    """Overwrite the file with the current tasks ("w" mode)."""
    with open(filename, "w", encoding="utf-8") as file:
        for task in tasks:
            file.write(task + "\n")
#
def add_task(filename: str, task: str) -&gt; None:
    """Add one task to the end of the file ("a" mode)."""
    with open(filename, "a", encoding="utf-8") as file:
        file.write(task + "\n")
#
if __name__ == "__main__":
    save_tasks(TODO_FILE, ["Buy milk", "Call Sam"])  # start fresh
    add_task(TODO_FILE, "Learn Python")
    #
    tasks = load_tasks(TODO_FILE)
    print(f"You have {len(tasks)} task(s):")
    for number, task in enumerate(tasks, start=1):
        print(f"  {number}. {task}")
    #
    # Mark the first task as done by removing it and saving again
    done = tasks.pop(0)
    save_tasks(TODO_FILE, tasks)
    print(f"Done: {done}. Left in file: {load_tasks(TODO_FILE)}")
</code></pre>

---
publishDate: 2026-10-27T09:05
title: 'Capstone: Command-Line Task Manager'
slug: capstone-task-manager-cli
metadescription: 'Build a real command-line to-do app in Python with argparse, data classes, pathlib, JSON storage, custom exceptions and pytest tests, step by step.'
updateDate: 2026-10-27T09:05
author: ['bishal-biswas']
level: 3
tags: ['python', 'project', 'cli', 'capstone']
course: python
---

## What you will build

This is the final project of the course. You will build **tasks**, a to-do list that lives in your terminal. When it is done, you will be able to type commands like these:

```powershell
python tasks.py add Finish Python course --due 2026-11-30
python tasks.py list
python tasks.py done 2
```

Your tasks are saved in a JSON file, so they are still there tomorrow. The program checks its input, shows friendly error messages instead of crashing, and comes with automated tests.

A program you control by typing commands is called a **CLI** (command-line interface). Tools like `pip`, `git` and `python` itself are CLIs. Building one uses almost everything you have learned:

| Skill | Where it is used | Lesson |
| --- | --- | --- |
| Data classes | The `Task` record | [Data Classes](/courses/python/dataclasses) |
| Classes | The `TaskStore` that loads and saves | [Classes and Objects](/courses/python/classes-and-objects) |
| pathlib | Finding and reading the data file | [Working with File Paths using pathlib](/courses/python/pathlib) |
| JSON | Saving tasks to disk | [Working with JSON and CSV Files](/courses/python/json-and-csv) |
| Custom exceptions | `TaskError` for user mistakes | [Raising Errors and Custom Exceptions](/courses/python/raising-and-custom-exceptions) |
| try and except | Friendly error messages | [Handling Errors with try and except](/courses/python/exceptions) |
| Dates | Due dates and overdue checks | [Working with Dates and Times](/courses/python/dates-and-times) |
| Lambdas and sorting | Ordering the list | [Lambda and Higher-Order Functions](/courses/python/lambda-and-higher-order-functions) |
| pytest | Tests for the whole thing | [Testing Your Code with pytest](/courses/python/testing-with-pytest) |

The one new tool is `argparse`, which reads the command-line arguments. You will learn it as you go. The full program is in the `main.py` panel at the end (save it as `tasks.py`).

## Step 1: plan the commands

Before coding, decide what the user can do:

| Command | Example | What it does |
| --- | --- | --- |
| `add` | `add Buy milk --due 2026-11-01` | Add a task, optionally with a due date |
| `list` | `list` or `list --all` | Show open tasks (or all tasks) |
| `done` | `done 3` | Mark task 3 as finished |
| `remove` | `remove 3` | Delete task 3 |

And the data file will look like this:

```json
[
  {
    "id": 1,
    "title": "Buy milk",
    "done": true,
    "due": null,
    "created": "2026-10-27"
  }
]
```

Each task becomes a [dictionary](/courses/python/dictionaries) in a JSON list. In Python, each one will be a `Task` object.

## Step 2: imports, the data file and an error class

Create a folder with a file named `tasks.py`. Start with the imports and two building blocks:

```python
import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path

DATA_FILE = Path.home() / ".tasks.json"


class TaskError(Exception):
    """Something the user did wrong, like an unknown task id."""
```

`Path.home()` is your home folder (like `C:\Users\you` or `/home/you`), so your tasks live in one place no matter which folder you run the program from. The dot at the start of `.tasks.json` is a common way to name settings files.

`TaskError` is a [custom exception](/courses/python/raising-and-custom-exceptions). Later, the program will catch it and print a friendly message. Real bugs (like a typo in your code) will not be caught, so you still see them clearly.

## Step 3: the Task data class

```python
@dataclass
class Task:
    id: int
    title: str
    done: bool = False
    due: str | None = None
    created: str = field(default_factory=lambda: date.today().isoformat())
```

A [data class](/courses/python/dataclasses) is perfect for a simple record. Some details:

- `str | None` means "a string or `None`". This [type hint](/courses/python/type-hints) style needs Python 3.10 or newer.
- Dates are stored as ISO text like `"2026-11-30"`, because JSON has no date type.
- `default_factory` runs a small [lambda](/courses/python/lambda-and-higher-order-functions) each time a task is created, so every task gets today's date.

## Step 4: loading and saving with TaskStore

The `TaskStore` class is the only part of the program that touches the file. Keeping file code in one place makes it easy to change and test.

```python
class TaskStore:
    """Loads tasks from a JSON file and saves them back."""

    def __init__(self, path):
        self.path = Path(path)
        self.tasks = self._load()

    def _load(self):
        if not self.path.exists():
            return []
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise TaskError(f"{self.path} is not valid JSON: {e}") from None
        return [Task(**item) for item in raw]

    def save(self):
        data = [asdict(task) for task in self.tasks]
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")
```

Here is how it works:

- If the file does not exist yet (first run), start with an empty [list](/courses/python/lists).
- `Task(**item)` unpacks each dictionary into keyword arguments, so `{"id": 1, "title": "Buy milk", ...}` becomes `Task(id=1, title="Buy milk", ...)`. You saw `**` in [Function Arguments](/courses/python/function-arguments).
- `asdict()` does the reverse when saving.
- A damaged file becomes a `TaskError` with a clear message, instead of a scary traceback.
- The list [comprehensions](/courses/python/comprehensions) convert all tasks in one line.

Now add the methods that change the list:

```python
class TaskStore:
    # ... __init__, _load and save from above ...

    def add(self, title, due=None):
        new_id = max((t.id for t in self.tasks), default=0) + 1
        task = Task(new_id, title, due=due)
        self.tasks.append(task)
        return task

    def get(self, task_id):
        for task in self.tasks:
            if task.id == task_id:
                return task
        raise TaskError(f"No task with id {task_id}")

    def remove(self, task_id):
        task = self.get(task_id)
        self.tasks.remove(task)
        return task
```

`max(..., default=0)` finds the biggest id so far (or 0 for an empty list) using a [generator expression](/courses/python/iterators-and-generators). Using the biggest id plus one, instead of `len(self.tasks) + 1`, means a removed task's number is not handed out again while newer tasks still exist.

## Step 5: helper functions

Two small helpers. The first checks due dates typed by the user. The second turns a task into one line of text.

```python
def parse_due(text):
    """argparse 'type' function: check that a date looks like 2026-12-31."""
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError:
        raise argparse.ArgumentTypeError(f"invalid date {text!r}, use YYYY-MM-DD") from None


def format_task(task, today):
    mark = "x" if task.done else " "
    line = f"[{mark}] {task.id:>3}  {task.title}"
    if task.due:
        late = not task.done and date.fromisoformat(task.due) < today
        line += f"  (due {task.due}{', OVERDUE' if late else ''})"
    return line
```

`{task.id:>3}` right aligns the id in 3 spaces, an [f-string](/courses/python/f-strings) trick that keeps the list tidy. Passing `today` in as a parameter (instead of calling `date.today()` inside) makes the function easy to test with any date.

## Step 6: one function per command

Each command gets its own small function. They all take the same two arguments: the store and the parsed command-line arguments.

```python
def cmd_add(store, args):
    task = store.add(" ".join(args.title), args.due)
    store.save()
    print(f"Added task {task.id}: {task.title}")


def cmd_list(store, args):
    tasks = store.tasks if args.all else [t for t in store.tasks if not t.done]
    if not tasks:
        print("Nothing to do!")
        return
    today = date.today()
    for task in sorted(tasks, key=lambda t: (t.done, t.due or "9999-12-31", t.id)):
        print(format_task(task, today))


def cmd_done(store, args):
    task = store.get(args.id)
    task.done = True
    store.save()
    print(f"Completed task {task.id}: {task.title}")


def cmd_remove(store, args):
    task = store.remove(args.id)
    store.save()
    print(f"Removed task {task.id}: {task.title}")
```

The sort key is a [tuple](/courses/python/tuples-and-unpacking): unfinished tasks first, then by due date (tasks without a date go last, thanks to the far future `"9999-12-31"`), then by id. ISO dates sort correctly as plain text.

## Step 7: reading the command line with argparse

When you run `python tasks.py add Buy milk`, Python puts the words after the file name into a list called `sys.argv`. You could read that list yourself, but `argparse` from the standard library does it properly: it checks the input, converts types, and writes `--help` pages for free.

```python
def build_parser():
    parser = argparse.ArgumentParser(prog="tasks", description="A tiny to-do list for your terminal.")
    parser.add_argument("--file", default=DATA_FILE, type=Path, help="JSON file to store tasks in")
    sub = parser.add_subparsers(dest="command")

    p_add = sub.add_parser("add", help="add a new task")
    p_add.add_argument("title", nargs="+", help="what you need to do")
    p_add.add_argument("--due", type=parse_due, help="due date as YYYY-MM-DD")
    p_add.set_defaults(func=cmd_add)

    p_list = sub.add_parser("list", help="show tasks")
    p_list.add_argument("-a", "--all", action="store_true", help="include finished tasks")
    p_list.set_defaults(func=cmd_list)

    p_done = sub.add_parser("done", help="mark a task as finished")
    p_done.add_argument("id", type=int)
    p_done.set_defaults(func=cmd_done)

    p_remove = sub.add_parser("remove", help="delete a task")
    p_remove.add_argument("id", type=int)
    p_remove.set_defaults(func=cmd_remove)
    return parser
```

The key ideas:

| Code | Meaning |
| --- | --- |
| `add_argument("id", type=int)` | A required **positional** argument, converted to `int` |
| `add_argument("--due", ...)` | An optional **flag** that starts with `--` |
| `nargs="+"` | Take one or more words, so titles do not need quotes |
| `action="store_true"` | A switch: `True` if present, `False` if not |
| `type=parse_due` | Call our function to check and convert the value |
| `add_subparsers()` | Commands like `add` and `list`, each with its own arguments |
| `set_defaults(func=...)` | Remember which function handles this command |

The last row is a neat trick. Functions are values (you saw this in [Decorators](/courses/python/decorators)), so each command stores its handler function, and the program can simply call `args.func(...)`.

## Step 8: main() ties it all together

```python
def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:  # no command given: show help
        parser.print_help()
        return 0
    try:
        store = TaskStore(args.file)
        args.func(store, args)
    except TaskError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"Error: could not use {args.file}: {e.strerror}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

A few details:

- `main(argv=None)` lets tests pass a list like `["done", "1"]`. When `argv` is `None`, argparse reads the real command line.
- `OSError` covers file problems like a missing folder or no permission.
- Errors go to `sys.stderr`, the same place [logging](/courses/python/logging) writes to.
- `sys.exit(main())` sends an **exit code** to the terminal: `0` means success, anything else means failure. Scripts and other tools can check it.
- The `if __name__ == "__main__":` guard (from [Organizing Code into Packages and __main__](/courses/python/creating-packages)) lets you import `tasks.py` in tests without running it.

## Step 9: try it out

Run the program from the folder that holds `tasks.py`. On Windows use `python` (or the `py` launcher); on macOS and Linux use `python3`. Here is a full session, with today being 2026-10-27:

```powershell
python tasks.py add Buy milk
python tasks.py add Finish Python course --due 2026-11-30
python tasks.py add Pay rent --due 2026-10-01
python tasks.py list
```

Output:

```text
Added task 1: Buy milk
Added task 2: Finish Python course
Added task 3: Pay rent
[ ]   3  Pay rent  (due 2026-10-01, OVERDUE)
[ ]   2  Finish Python course  (due 2026-11-30)
[ ]   1  Buy milk
```

Finish one, then look at everything:

```powershell
python tasks.py done 1
python tasks.py list --all
```

Output:

```text
Completed task 1: Buy milk
[ ]   3  Pay rent  (due 2026-10-01, OVERDUE)
[ ]   2  Finish Python course  (due 2026-11-30)
[x]   1  Buy milk
```

Now some mistakes. The program handles each one politely:

```powershell
python tasks.py remove 3
python tasks.py done 42
python tasks.py add Party --due tomorrow
```

Output:

```text
Removed task 3: Pay rent
Error: No task with id 42
usage: tasks add [-h] [--due DUE] title [title ...]
tasks add: error: argument --due: invalid date 'tomorrow', use YYYY-MM-DD
```

And `argparse` wrote this help page for you (run `python tasks.py --help`):

```text
usage: tasks [-h] [--file FILE] {add,list,done,remove} ...

A tiny to-do list for your terminal.

positional arguments:
  {add,list,done,remove}
    add                 add a new task
    list                show tasks
    done                mark a task as finished
    remove              delete a task

options:
  -h, --help            show this help message and exit
  --file FILE           JSON file to store tasks in
```

> **Tip:** Use `--file` to keep separate lists, for example `python tasks.py --file work.json add Email the team`. The `--file` option belongs to the main program, so it goes **before** the command name.

## Step 10: add tests

A real project has tests. Save this as `test_tasks.py` next to `tasks.py`. It uses the `tmp_path` fixture so your real task file is never touched, and the built-in `capsys` fixture, which captures what the program prints.

```python
import json

import pytest

from tasks import TaskError, TaskStore, main


def test_add_and_reload(tmp_path):
    file = tmp_path / "tasks.json"
    store = TaskStore(file)
    store.add("Write tests", due="2026-12-01")
    store.save()
    again = TaskStore(file)
    assert [t.title for t in again.tasks] == ["Write tests"]
    assert again.tasks[0].due == "2026-12-01"


def test_ids_keep_growing(tmp_path):
    store = TaskStore(tmp_path / "tasks.json")
    a = store.add("one")
    b = store.add("two")
    store.remove(a.id)
    c = store.add("three")
    assert (a.id, b.id, c.id) == (1, 2, 3)


def test_unknown_id_raises(tmp_path):
    store = TaskStore(tmp_path / "tasks.json")
    with pytest.raises(TaskError, match="No task with id 7"):
        store.get(7)


def test_cli_done(tmp_path, capsys):
    file = str(tmp_path / "tasks.json")
    assert main(["--file", file, "add", "Walk", "the", "dog"]) == 0
    assert main(["--file", file, "done", "1"]) == 0
    saved = json.loads((tmp_path / "tasks.json").read_text())
    assert saved[0]["done"] is True
    assert "Completed task 1: Walk the dog" in capsys.readouterr().out


def test_cli_bad_id_returns_1(tmp_path, capsys):
    assert main(["--file", str(tmp_path / "t.json"), "done", "9"]) == 1
    assert "No task with id 9" in capsys.readouterr().err
```

Run them with `python -m pytest -q`:

```text
.....                                                                    [100%]
5 passed in 0.07s
```

Because `main()` accepts a list of arguments, you can test the whole program, command line included, without opening a terminal.

## Common mistakes

**1. Putting `--file` after the command.**

```text
usage: tasks [-h] [--file FILE] {add,list,done,remove} ...
tasks: error: unrecognized arguments: --file x
```

Fix: write `python tasks.py --file x list`, with `--file` before the command.

**2. Editing the JSON file by hand and breaking it.** A missing quote or comma gives:

```text
Error: bad.json is not valid JSON: Expecting property name enclosed in double quotes: line 1 column 2 (char 1)
```

The program does not crash, thanks to the `try` block in `_load()`. Fix the file, or delete it to start over.

**3. Forgetting to call `save()`.** If a command changes a task but never saves, the change disappears when the program ends. Every command that changes data calls `store.save()`.

**4. Using `len()` for new ids.** With tasks 1, 2 and 3, removing task 1 and adding a new one would create a second task 3. Using `max(id) + 1` avoids that.

## Ideas to extend it

- Add an `edit` command that changes a task's title or due date.
- Add `--priority` with `choices=["low", "normal", "high"]` and sort by it.
- Add a `clear` command that removes all finished tasks.
- Use [logging](/courses/python/logging) with a `--verbose` flag to show debug details.
- Turn it into an installable package (see [Organizing Code into Packages and __main__](/courses/python/creating-packages)) so you can type `tasks` from anywhere.
- Ship it in a container, as shown in [Project: Dockerizing a Python App](/courses/docker/dockerizing-a-python-app).

The [argparse docs](https://docs.python.org/3/library/argparse.html) list many more options.

## Quick recap

- A CLI reads its instructions from the command line; `argparse` parses them, checks types and writes help pages.
- Subcommands with `set_defaults(func=...)` keep each command in its own small function.
- A data class holds each task; `asdict()` and `Task(**item)` convert to and from JSON.
- One class (`TaskStore`) owns all file access, which keeps the code easy to test.
- Custom exceptions plus `try` and `except` turn mistakes into friendly messages and exit codes.
- Pass arguments into `main()` so tests can drive the whole program.

Congratulations, you have built a complete, tested Python application! To finish the course, see [Where to Go Next with Python](/courses/python/next-steps).

<code id="code-content" class="language-python">
"""tasks.py: a small command-line task manager that saves to a JSON file."""
import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
#
DATA_FILE = Path.home() / ".tasks.json"
#
#
class TaskError(Exception):
    """Something the user did wrong, like an unknown task id."""
#
#
@dataclass
class Task:
    id: int
    title: str
    done: bool = False
    due: str | None = None
    created: str = field(default_factory=lambda: date.today().isoformat())
#
#
class TaskStore:
    """Loads tasks from a JSON file and saves them back."""
#
    def __init__(self, path):
        self.path = Path(path)
        self.tasks = self._load()
#
    def _load(self):
        if not self.path.exists():
            return []
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise TaskError(f"{self.path} is not valid JSON: {e}") from None
        return [Task(**item) for item in raw]
#
    def save(self):
        data = [asdict(task) for task in self.tasks]
        self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")
#
    def add(self, title, due=None):
        new_id = max((t.id for t in self.tasks), default=0) + 1
        task = Task(new_id, title, due=due)
        self.tasks.append(task)
        return task
#
    def get(self, task_id):
        for task in self.tasks:
            if task.id == task_id:
                return task
        raise TaskError(f"No task with id {task_id}")
#
    def remove(self, task_id):
        task = self.get(task_id)
        self.tasks.remove(task)
        return task
#
#
def parse_due(text):
    """argparse 'type' function: check that a date looks like 2026-12-31."""
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError:
        raise argparse.ArgumentTypeError(f"invalid date {text!r}, use YYYY-MM-DD") from None
#
#
def format_task(task, today):
    mark = "x" if task.done else " "
    line = f"[{mark}] {task.id:&gt;3}  {task.title}"
    if task.due:
        late = not task.done and date.fromisoformat(task.due) &lt; today
        line += f"  (due {task.due}{', OVERDUE' if late else ''})"
    return line
#
#
def cmd_add(store, args):
    task = store.add(" ".join(args.title), args.due)
    store.save()
    print(f"Added task {task.id}: {task.title}")
#
#
def cmd_list(store, args):
    tasks = store.tasks if args.all else [t for t in store.tasks if not t.done]
    if not tasks:
        print("Nothing to do!")
        return
    today = date.today()
    for task in sorted(tasks, key=lambda t: (t.done, t.due or "9999-12-31", t.id)):
        print(format_task(task, today))
#
#
def cmd_done(store, args):
    task = store.get(args.id)
    task.done = True
    store.save()
    print(f"Completed task {task.id}: {task.title}")
#
#
def cmd_remove(store, args):
    task = store.remove(args.id)
    store.save()
    print(f"Removed task {task.id}: {task.title}")
#
#
def build_parser():
    parser = argparse.ArgumentParser(prog="tasks", description="A tiny to-do list for your terminal.")
    parser.add_argument("--file", default=DATA_FILE, type=Path, help="JSON file to store tasks in")
    sub = parser.add_subparsers(dest="command")
#
    p_add = sub.add_parser("add", help="add a new task")
    p_add.add_argument("title", nargs="+", help="what you need to do")
    p_add.add_argument("--due", type=parse_due, help="due date as YYYY-MM-DD")
    p_add.set_defaults(func=cmd_add)
#
    p_list = sub.add_parser("list", help="show tasks")
    p_list.add_argument("-a", "--all", action="store_true", help="include finished tasks")
    p_list.set_defaults(func=cmd_list)
#
    p_done = sub.add_parser("done", help="mark a task as finished")
    p_done.add_argument("id", type=int)
    p_done.set_defaults(func=cmd_done)
#
    p_remove = sub.add_parser("remove", help="delete a task")
    p_remove.add_argument("id", type=int)
    p_remove.set_defaults(func=cmd_remove)
    return parser
#
#
def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:  # no command given: show help
        parser.print_help()
        return 0
    try:
        store = TaskStore(args.file)
        args.func(store, args)
    except TaskError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"Error: could not use {args.file}: {e.strerror}", file=sys.stderr)
        return 1
    return 0
#
#
if __name__ == "__main__":
    sys.exit(main())
</code></pre>

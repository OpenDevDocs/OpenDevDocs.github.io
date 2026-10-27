---
publishDate: 2026-10-27T09:02
title: 'Logging Instead of print()'
slug: logging
metadescription: 'Learn why and how to use the logging module instead of print(): log levels, basicConfig, formats, named loggers, logging exceptions and writing logs to files.'
updateDate: 2026-10-27T09:02
author: ['bishal-biswas']
level: 2
tags: ['python', 'logging', 'debugging']
course: python
---

## Why not just print()?

While learning, you have used `print()` to see what your program is doing. That works for small scripts. But in a bigger program, print debugging becomes a mess:

- You have to delete all the debug prints before sharing your program, then add them back when something breaks.
- You cannot tell if a message is a harmless note or a serious problem.
- You do not know **when** something happened or **which file** printed it.
- The messages vanish when the window closes, so you cannot look at them tomorrow.

The built-in `logging` module fixes all of this. Think of it as a ship's **logbook**: every entry has a time, an importance level and a source, and you can choose to keep it on screen, in a file, or both. You can turn the detail up while debugging and down when everything works, without changing your code. It pairs nicely with the tools from [Debugging Python Code](/courses/python/debugging-python).

## The five log levels

Every log message has a **level** that says how important it is:

| Level | Function | Use it for |
| --- | --- | --- |
| `DEBUG` | `logging.debug()` | Tiny details, only useful while hunting a bug |
| `INFO` | `logging.info()` | Normal events: "started", "saved 3 files" |
| `WARNING` | `logging.warning()` | Something odd, but the program carries on |
| `ERROR` | `logging.error()` | Something failed |
| `CRITICAL` | `logging.critical()` | The program cannot continue |

Try all five:

```python
import logging

logging.debug("Checking the settings")
logging.info("Program started")
logging.warning("Disk is 90% full")
logging.error("Could not save the file")
logging.critical("Database is gone!")
```

Output:

```text
WARNING:root:Disk is 90% full
ERROR:root:Could not save the file
CRITICAL:root:Database is gone!
```

Where did `debug` and `info` go? By default, logging only shows `WARNING` and above. Everything below the chosen level is quietly ignored. That is the magic: your debug messages can stay in the code and only appear when you ask for them.

The `root` part is the name of the **logger** that wrote the message. You will name your own loggers soon.

## Choosing the level with basicConfig()

`logging.basicConfig()` sets things up in one line. Pass `level=` to choose the lowest level you want to see:

```python
import logging

logging.basicConfig(level=logging.DEBUG)

logging.debug("Checking the settings")
logging.info("Program started")
logging.warning("Disk is 90% full")
```

Output:

```text
DEBUG:root:Checking the settings
INFO:root:Program started
WARNING:root:Disk is 90% full
```

Change `logging.DEBUG` to `logging.WARNING` later and the first two lines disappear, with no other edits.

## Making messages look nice

The `format=` argument controls what each line looks like. Pieces like `%(asctime)s` are filled in automatically:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

logging.info("Program started")
logging.warning("Low on memory")
```

Output (your times will differ):

```text
23:08:27 INFO     root: Program started
23:08:27 WARNING  root: Low on memory
```

| Placeholder | Shows |
| --- | --- |
| `%(asctime)s` | Date and time |
| `%(levelname)s` | `INFO`, `WARNING`, ... |
| `%(name)s` | The logger's name |
| `%(message)s` | Your message |
| `%(funcName)s` | The function that logged it |
| `%(lineno)d` | The line number |

`-8` in `%(levelname)-8s` pads the level to 8 characters so the messages line up. `datefmt` uses the same codes as `strftime()` from [Working with Dates and Times](/courses/python/dates-and-times).

## Named loggers

In real programs, do not call `logging.info()` directly. Create a **logger** for each file with `logging.getLogger(__name__)`. `__name__` is the module's name (you met it in [Modules and import](/courses/python/modules-and-imports)), so every message shows which part of the program wrote it.

```python
import logging

logger = logging.getLogger("shop.cart")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

def add_item(cart, item, qty):
    logger.info("Adding %s x%d", item, qty)
    if qty > 10:
        logger.warning("Large quantity for %s: %d", item, qty)
    cart[item] = cart.get(item, 0) + qty

cart = {}
add_item(cart, "apple", 3)
add_item(cart, "pear", 12)
print(cart)
```

Output:

```text
INFO shop.cart: Adding apple x3
INFO shop.cart: Adding pear x12
WARNING shop.cart: Large quantity for pear: 12
{'apple': 3, 'pear': 12}
```

Here the name is written by hand as `"shop.cart"` so you can see it. In a file called `cart.py` inside a `shop` package, `getLogger(__name__)` would give the same name automatically.

> **Tip:** Notice `logger.info("Adding %s x%d", item, qty)`. You pass the values as extra arguments instead of using an [f-string](/courses/python/f-strings). Logging only builds the final text if the message will actually be shown, which saves work for hidden debug messages.

## Logging errors with tracebacks

Inside an `except` block, use `logger.exception()`. It logs at `ERROR` level **and** adds the full traceback, so you can see exactly where things broke while the program keeps running.

```python
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        log.exception("Could not divide %s by %s", a, b)
        return None

print(divide(10, 0))
```

Output:

```text
ERROR: Could not divide 10 by 0
Traceback (most recent call last):
  File "...\l5.py", line 8, in divide
    return a / b
           ~~^~~
ZeroDivisionError: division by zero
None
```

This is much more useful than `print("something went wrong")`. Catching errors is covered in [Handling Errors with try and except](/courses/python/exceptions).

## Saving logs to a file

Pass `filename=` to `basicConfig()` and the messages go to a file instead of the screen:

```python
import logging
from pathlib import Path

logging.basicConfig(
    filename="app.log",
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(message)s",
    encoding="utf-8",
)
logging.info("Saved to a file instead of the screen")
logging.debug("Even debug messages go here")
print(Path("app.log").read_text(encoding="utf-8"))
```

Output:

```text
2026-10-27 23:08:28,424 INFO Saved to a file instead of the screen
2026-10-27 23:08:28,424 DEBUG Even debug messages go here
```

By default the file is **appended** to, so old runs stay in it. Add `filemode="w"` to start fresh each time.

## Screen and file at the same time

For more control, attach **handlers** to a logger. A handler decides where messages go, and each handler can have its own level and format. A common setup: only warnings on screen, every detail in a file.

```python
import logging

logger = logging.getLogger("app")
logger.setLevel(logging.DEBUG)

screen = logging.StreamHandler()
screen.setLevel(logging.WARNING)
screen.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

file = logging.FileHandler("details.log", mode="w", encoding="utf-8")
file.setLevel(logging.DEBUG)
file.setFormatter(logging.Formatter("%(levelname)-7s %(funcName)s: %(message)s"))

logger.addHandler(screen)
logger.addHandler(file)

def run():
    logger.debug("Loading config")
    logger.info("Starting work")
    logger.warning("Config file missing, using defaults")

run()
print("--- details.log ---")
print(open("details.log", encoding="utf-8").read())
```

Output:

```text
WARNING: Config file missing, using defaults
--- details.log ---
DEBUG   run: Loading config
INFO    run: Starting work
WARNING run: Config file missing, using defaults
```

> **Note:** Log messages are written to **standard error** (stderr), not standard output like `print()`. Terminals show both, but if you redirect output to a file with `>`, logs stay on screen. That keeps your program's real output clean.

## When to use print() and when to log

| Use `print()` for | Use logging for |
| --- | --- |
| The actual result the user asked for | Notes about what the program is doing |
| Menus and prompts in a small script | Warnings and errors |
| Quick throwaway experiments | Anything you might need to debug later |

## Common mistakes

**1. Logging before calling basicConfig().** The first logging call quietly sets up a default config (level `WARNING`). After that, `basicConfig()` does nothing:

```python
import logging
logging.info("Program started")
logging.basicConfig(level=logging.INFO)
logging.info("You will not see this either")
print("done")
```

```text
done
```

Fix: call `basicConfig()` once, at the very start of your program, before any logging.

**2. Passing values like print() does.** `logging.warning("Total is", 5)` does not work like `print()`. It prints a long `--- Logging error ---` report ending with:

```text
TypeError: not all arguments converted during string formatting
```

Fix: add a placeholder: `logging.warning("Total is %s", 5)`.

**3. Expecting debug messages to show by default.** They are hidden below `WARNING`. Set `level=logging.DEBUG` to see them.

## Quick recap

- Logging gives each message a time, a level and a source, and can send it to the screen or a file.
- Levels from low to high: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. The default shows `WARNING` and up.
- Call `logging.basicConfig()` once at the start to choose the level and format.
- Use `logger = logging.getLogger(__name__)` in each module.
- Use `logger.exception()` inside `except` to record the traceback.
- Handlers let you send different levels to different places.

Learn more in the official [Logging HOWTO](https://docs.python.org/3/howto/logging.html). Next, you will make sure your code really works in [Testing Your Code with pytest](/courses/python/testing-with-pytest).

<code id="code-content" class="language-python">
# main.py: logging set up the way real programs do it
import logging
#
# One logger per module, named after the module
logger = logging.getLogger(__name__)
#
#
def setup_logging(verbose=False):
    """Call this ONCE, at program start, before any logging happens."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # Also keep everything (DEBUG and up) in a file
    file_handler = logging.FileHandler("app.log", mode="w", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(funcName)s: %(message)s"))
    logging.getLogger().addHandler(file_handler)
#
#
def average(numbers):
    logger.debug("average() got %d numbers", len(numbers))
    try:
        result = sum(numbers) / len(numbers)
    except ZeroDivisionError:
        # exception() logs at ERROR level and adds the full traceback
        logger.exception("Cannot average an empty list")
        return None
    if result &gt; 100:
        logger.warning("Average %.1f is unusually high", result)
    return result
#
#
if __name__ == "__main__":
    setup_logging(verbose=True)
    logger.info("Program started")
    print(average([10, 20, 30]))
    print(average([150, 250]))
    print(average([]))
    logger.info("Program finished, details are in app.log")
</code></pre>

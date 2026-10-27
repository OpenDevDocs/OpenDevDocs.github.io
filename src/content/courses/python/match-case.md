---
publishDate: 2026-10-27T08:20
title: 'Pattern Matching with match and case'
slug: match-case
metadescription: 'Use Python 3.10+ match and case to replace long if/elif chains: match exact values, combine options with |, capture parts of lists, add guards and avoid traps.'
updateDate: 2026-10-27T08:20
author: ['bishal-biswas']
level: 2
tags: ['python', 'control-flow', 'match', 'pattern-matching']
course: python
---

## A cleaner way to handle many choices

In [Making Decisions with if, elif and else](/courses/python/if-elif-else) you wrote chains like this one:

```python
command = "stop"
if command == "start":
    print("Starting...")
elif command == "stop":
    print("Stopping.")
elif command == "pause":
    print("Paused.")
else:
    print("Unknown command.")
```

Output:

```text
Stopping.
```

It works, but `command ==` is repeated on every line. When you compare **one value** against **many possibilities**, Python offers a tidier tool: the `match` statement.

`match` arrived in **Python 3.10**, so you need 3.10 or newer to use it. (Check with `python --version` on Windows or `python3 --version` on macOS and Linux, as shown in [Installing Python on Windows, macOS and Linux](/courses/python/installing-python).)

Think of `match` as a mail sorting machine. A letter comes in, and the machine compares it against a row of slots, one by one. The letter drops into the first slot that fits. If no slot fits, it goes into the "everything else" bin.

## Your first match statement

Here is the same program written with `match`:

```python
command = "stop"
match command:
    case "start":
        print("Starting...")
    case "stop":
        print("Stopping.")
    case "pause":
        print("Paused.")
    case _:
        print("Unknown command.")
```

Output:

```text
Stopping.
```

How it works:

- `match command:` names the value you want to check. This value is called the **subject**.
- Each `case` gives a **pattern**: a shape the subject might have. Here the patterns are simple strings.
- Python tries the cases **from top to bottom**. The first pattern that fits wins, its block runs, and the rest are skipped. (Unlike `switch` in some other languages, there is no "fall through" into the next case, and you do not need `break`.)
- `case _:` is the **wildcard**. The underscore matches anything, so it acts like `else`.

Each `case` is indented under `match`, and each body is indented under its `case`.

### When nothing matches

The wildcard is optional. If there is no `case _` and nothing fits, Python simply skips the whole `match` without any error:

```python
command = "dance"
match command:
    case "start":
        print("Starting...")
print("After match")
```

Output:

```text
After match
```

## Matching several values with `|`

To let one case accept several values, separate them with `|`, which you read as "or":

```python
day = "Sun"
match day:
    case "Sat" | "Sun":
        print("Weekend")
    case "Mon" | "Tue" | "Wed" | "Thu" | "Fri":
        print("Weekday")
    case _:
        print("Not a day")
```

Output:

```text
Weekend
```

Patterns work with numbers too. Web servers answer every request with a **status code**, a number like 200 (OK) or 404 (page not found):

```python
status = 404
match status:
    case 200:
        print("OK")
    case 301 | 302:
        print("Moved")
    case 404:
        print("Not found")
    case 500:
        print("Server error")
    case _:
        print(f"Other status: {status}")
```

Output:

```text
Not found
```

## Capturing parts of the value

So far `match` is just a neater `if`/`elif`. Its real power is that a pattern can describe the **shape** of a value and pull pieces out of it into variables. This is called **capturing**.

Imagine a text adventure game where the player types commands like `go north` or `take lamp`. The string method `.split()` (from [Useful String Methods](/courses/python/string-methods)) breaks the text into a list of words, and `match` can look at that list:

```python
for command in ["look", "go north", "take lamp", "drop lamp", "go"]:
    match command.split():
        case ["look"]:
            print("You look around.")
        case ["go", direction]:
            print(f"You walk {direction}.")
        case ["take", item]:
            print(f"You pick up the {item}.")
        case _:
            print(f"I do not understand {command!r}.")
```

Output:

```text
You look around.
You walk north.
You pick up the lamp.
I do not understand 'drop lamp'.
I do not understand 'go'.
```

Look at `case ["go", direction]:`. It means "a list with exactly two words, where the first word is `"go"`". The second word, whatever it is, gets stored in a new variable called `direction`. The square brackets describe a list. You will learn lists properly in [Lists: Ordered Collections](/courses/python/lists).

Notice that `"go"` on its own did not match `["go", direction]`, because the list had only one word, not two. The pattern checks the length too.

To capture "everything else" in a list, put a `*` before a name:

```python
match "drop red lamp now".split():
    case ["drop", *things]:
        print(f"Dropping: {things}")
```

Output:

```text
Dropping: ['red', 'lamp', 'now']
```

### Matching pairs of values

Patterns can also take apart pairs like `(x, y)` points. A pair in parentheses is a **tuple** (see [Tuples and Unpacking](/courses/python/tuples-and-unpacking)).

```python
point = (0, 5)
match point:
    case (0, 0):
        print("At the origin")
    case (0, y):
        print(f"On the y axis at {y}")
    case (x, 0):
        print(f"On the x axis at {x}")
    case (x, y):
        print(f"At {x}, {y}")
```

Output:

```text
On the y axis at 5
```

Fixed values like `0` must match exactly. Names like `y` capture whatever is in that position.

### Matching dictionaries

You can even match on **dictionaries**, which store values under names (covered in [Dictionaries: Key-Value Pairs](/courses/python/dictionaries)). This is great for handling data from files or the web:

```python
event = {"type": "click", "x": 10, "y": 20}
match event:
    case {"type": "click", "x": x, "y": y}:
        print(f"Click at {x}, {y}")
    case {"type": "key", "key": k}:
        print(f"Key pressed: {k}")
    case _:
        print("Unknown event")
```

Output:

```text
Click at 10, 20
```

## Adding conditions with guards

Sometimes a shape is not enough and you need an extra test. Add `if` after a pattern to create a **guard**. The case only matches if the pattern fits **and** the guard is true.

```python
age = 15
match age:
    case n if n < 13:
        print("Child")
    case n if n < 20:
        print("Teenager")
    case _:
        print("Adult")
```

Output:

```text
Teenager
```

`n` captures the value, then the `if` checks it. To be honest, for simple number ranges a normal `if`/`elif` chain is just as clear. Guards shine when combined with the shape patterns above, like `case ["go", direction] if direction in ("north", "south"):`.

## Matching by type

A pattern like `int()` matches any value of that type. This lets you react differently to different kinds of data:

```python
for value in [42, 3.5, "hi", None, True]:
    match value:
        case bool():
            print(f"{value!r} is a boolean")
        case int():
            print(f"{value!r} is a whole number")
        case float():
            print(f"{value!r} is a decimal")
        case str():
            print(f"{value!r} is text")
        case None:
            print("Nothing here")
```

Output:

```text
42 is a whole number
3.5 is a decimal
'hi' is text
Nothing here
True is a boolean
```

The `bool()` case comes first on purpose. In Python, `True` also counts as an `int` (you saw this in [Booleans, Comparisons and None](/courses/python/booleans-and-none)), so with `int()` first, `True` would land in the wrong case.

## Naming a matched value with `as`

When a case accepts several options with `|`, you can use `as` to save which one matched:

```python
match "Sat":
    case ("Sat" | "Sun") as day:
        print(f"{day} is a weekend day")
```

Output:

```text
Sat is a weekend day
```

## match or if/elif?

| Use `match` when... | Use `if`/`elif` when... |
| --- | --- |
| you compare one value against many fixed options | each branch checks something different |
| you want to take apart lists, tuples or dicts | you compare ranges like `score >= 90` |
| you handle commands, events or messages | you need to support Python older than 3.10 |

## Common mistakes

### A plain name in a case captures, it does not compare

This is the biggest trap with `match`:

```python
RED = "red"
color = "blue"
match color:
    case RED:
        print("It matched?!")
```

Output:

```text
It matched?!
```

The color is blue, yet it "matched". A bare name in a pattern is always a **capture**: it means "match anything and store it in a variable called `RED`". It never compares against the existing variable. Fix: write the literal value (`case "red":`), or use a dotted name like `Color.RED`, which Python does treat as a value to compare against. You will learn about names with dots in [Classes and Objects](/courses/python/classes-and-objects).

### Putting the wildcard first

```text
cmd = "stop"
match cmd:
    case _:
        print("catch all")
    case "stop":
        print("stop")
```

Output:

```text
  File "main.py", line 3
    case _:
         ^
SyntaxError: wildcard makes remaining patterns unreachable
```

Since `_` matches everything, the cases below it could never run. Python catches this and refuses to run. Fix: always put `case _:` **last**. The same error appears (with "name capture" in the message) if a bare name like `case other:` comes before other cases.

### Running on an old Python

On Python 3.9 or older, `match` is a `SyntaxError`. If your code works on your computer but not on another one, check the version.

## Quick recap

- `match value:` followed by `case pattern:` blocks picks the **first** matching case. It needs Python 3.10+.
- `case _:` is the wildcard. It matches anything and must come last.
- `|` combines several options in one case.
- Patterns can describe shapes like `["go", direction]` and capture parts into variables.
- `case pattern if condition:` adds a **guard**.
- `int()`, `str()` and friends in a case match by type.
- A bare name in a case **captures**. It does not compare with an existing variable.

You now know all the control flow tools you need for a real program. Put them together in [Project: Number Guessing Game](/courses/python/project-number-guessing-game).

<code id="code-content" class="language-python">
# main.py: a tiny text adventure parser using match and case (Python 3.10+)
#
location = "hall"
inventory = []
#
commands = ["look", "go north", "take lamp", "take key", "inventory", "dance", "quit"]
#
for command in commands:
    print(f"&gt; {command}")
    match command.lower().split():
        case ["look"]:
            print(f"You are in the {location}.")
        case ["go", ("north" | "south" | "east" | "west") as direction]:
            location = f"{direction} room"
            print(f"You walk {direction}.")
        case ["go", other]:
            print(f"You cannot go {other}.")
        case ["take", item] if item in inventory:
            print(f"You already have the {item}.")
        case ["take", item]:
            inventory.append(item)
            print(f"You pick up the {item}.")
        case ["inventory" | "i"]:
            print(f"You carry: {inventory}")
        case ["quit"]:
            print("Goodbye!")
            break
        case _:
            print("I do not understand that.")
#
# Matching by status code
status = 404
match status:
    case 200:
        message = "OK"
    case 404:
        message = "Not found"
    case _:
        message = "Something else"
print(f"Status {status}: {message}")
</code></pre>

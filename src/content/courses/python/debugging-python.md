---
publishDate: 2026-10-27T08:49
title: 'Debugging Python Code'
slug: debugging-python
metadescription: 'Find and fix bugs step by step: read tracebacks from the bottom up, use print and f-string debugging, step through code with breakpoint(), pdb and VS Code.'
updateDate: 2026-10-27T08:49
author: ['bishal-biswas']
level: 2
tags: ['python', 'debugging', 'errors', 'vs-code']
course: python
---

## What is a bug?

A **bug** is a mistake in a program that makes it do the wrong thing. **Debugging** is the work of finding that mistake and fixing it. Every programmer, from beginners to experts, spends a lot of time debugging. It is not a sign that you are bad at coding. It is part of the job.

Bugs come in three main kinds:

| Kind | What happens | Example |
| --- | --- | --- |
| **Syntax error** | Python refuses to run the file at all | A missing `:` after `if` |
| **Runtime error** | The program starts, then crashes with a traceback | Dividing by zero |
| **Logic error** | No crash, but the answer is wrong | Total of `[5, 10, 20]` comes out as `20` |

Logic errors are the sneakiest, because Python does not warn you. In this lesson you will learn a calm, step by step way to deal with all three, plus the tools that make it easier.

## Step 1: read the traceback (from the bottom)

When a program crashes, Python prints a **traceback**. You met these in [Handling Errors with try and except](/courses/python/exceptions). Let's read a longer one:

```python
def average(numbers):
    return sum(numbers) / len(numbers)

def report(scores):
    avg = average(scores)
    return f"Average: {avg:.1f}"

print(report([80, 90, 70]))
print(report([]))
```

Output:

```text
Average: 80.0
Traceback (most recent call last):
  File "main.py", line 9, in <module>
    print(report([]))
          ~~~~~~^^^^
  File "main.py", line 5, in report
    avg = average(scores)
  File "main.py", line 2, in average
    return sum(numbers) / len(numbers)
           ~~~~~~~~~~~~~^~~~~~~~~~~~~~
ZeroDivisionError: division by zero
```

Read it like this:

1. **Start at the last line.** It names the error type and gives a message: `ZeroDivisionError: division by zero`.
2. **Look just above it** to find the exact line that failed: line 2, inside `average`. The `~~~^~~~` marks point at the part of the line that broke (the `/`).
3. **Read upward** to see how the program got there: line 9 called `report`, which on line 5 called `average`.

Now ask "why?". `len([])` is `0`, so we divided by zero. The bug is not really in `average`. It is that `report` was given an empty list. A fix could be to check `if not numbers:` first, or to [raise a clearer error](/courses/python/raising-and-custom-exceptions).

> **Tip:** Copy the last line of a traceback into a search engine. Someone has almost always had the same error, and the explanation is often the first result.

### Syntax errors look a bit different

```python
for i in range(3):
    print(i)
```

If you forget the colon in the first line, Python cannot even start, and points at the spot:

```text
  File "main.py", line 1
    for i in range(3)
                     ^
SyntaxError: expected ':'
```

The `^` arrow shows where Python got confused. The real mistake is usually on that line or the line just before it.

## Step 2: print debugging

The simplest debugging tool is `print()`. You add prints to see what your variables hold while the program runs. Here is a function with a logic error:

```python
def total_price(prices):
    total = 0
    for price in prices:
        total = price
    return total

print(total_price([5, 10, 20]))
```

Output:

```text
20
```

We expected `35`. Let's look inside the loop. A great trick is the `=` sign inside an [f-string](/courses/python/f-strings): `f"{price=}"` prints both the name and the value:

```python
def total_price(prices):
    total = 0
    for price in prices:
        total = price
        print(f"{price=} {total=}")
    return total

print(total_price([5, 10, 20]))
```

Output:

```text
price=5 total=5
price=10 total=10
price=20 total=20
20
```

Now it is obvious: `total` is replaced each time instead of added to. The fix is `total += price`. Once it works, **remove** your debug prints.

### Use repr() to see hidden details

Some values look the same when printed but are not. `repr()` (or `!r` in an f-string) shows the exact value, including quotes and spaces:

```python
answer = "5"
print(answer == 5)
print(f"{answer=}")
print(repr(answer), type(answer))
```

Output:

```text
False
answer='5'
'5' <class 'str'>
```

The quotes reveal that `answer` is the text `"5"`, not the number `5`. This is very common with [input()](/courses/python/input-and-output), which always returns a string. The fix is to [convert it](/courses/python/type-conversion) with `int()`.

```python
name = "Ada "
print("Name is", name, "!")
print(f"{name!r}")
```

Output:

```text
Name is Ada  !
'Ada '
```

The `repr` makes the extra space at the end easy to spot.

## Step 3: use a debugger

Print debugging is fine for small problems, but a **debugger** is more powerful. It lets you **pause** a program at any line, look at every variable, and then run it one line at a time. It is like watching a video in slow motion with the pause button.

### breakpoint() and pdb

Python has a built-in debugger called **pdb**. The easiest way to start it is to put `breakpoint()` on the line where you want to pause:

```python
def count_vowels(word):
    count = 0
    for letter in word:
        breakpoint()
        if letter in "aeiou":
            count += 1
    return count

print(count_vowels("Hi"))
```

When you run this in a terminal, the program stops and shows a `(Pdb)` prompt. You type short commands. Here is a real session (the commands typed are after each `(Pdb)`, and the long folder path is shortened):

```text
> main.py(4)count_vowels()
-> breakpoint()
(Pdb) p letter
'H'
(Pdb) p count
0
(Pdb) n
> main.py(5)count_vowels()
-> if letter in "aeiou":
(Pdb) n
> main.py(3)count_vowels()
-> for letter in word:
(Pdb) c
> main.py(4)count_vowels()
-> breakpoint()
(Pdb) p letter
'i'
(Pdb) n
> main.py(5)count_vowels()
-> if letter in "aeiou":
(Pdb) n
> main.py(6)count_vowels()
-> count += 1
(Pdb) p count
0
(Pdb) c
1
```

The `->` line is the **next** line that will run. Notice that for `'H'`, the program skipped `count += 1` and went back to the loop, while for `'i'` it went into it. Watching the path the code takes like this is how you find logic errors.

The pdb commands you need most:

| Command | Meaning |
| --- | --- |
| `p name` | Print the value of a variable or expression |
| `n` | Next: run the current line and stop at the next one |
| `s` | Step: like `n`, but go **inside** a function call |
| `c` | Continue running until the next breakpoint |
| `l` | List the code around the current line |
| `q` | Quit the debugger (and the program) |
| `h` | Help |

> **Note:** Remember to delete `breakpoint()` lines when you are done, or your program will keep pausing.

### The VS Code debugger

If you use VS Code (see [Setting Up VS Code for Python](/courses/python/setting-up-vs-code)), you get the same power with buttons instead of commands:

1. Open your `.py` file and click in the space just left of a line number. A red dot appears. That is a **breakpoint**.
2. Press **F5** (or open **Run and Debug** in the side bar) and choose **Python Debugger: Debug Python File**.
3. The program pauses at the red dot. The **Variables** panel on the left shows every variable's current value.
4. Use the toolbar at the top: **Step Over** (F10) is like `n`, **Step Into** (F11) is like `s`, and **Continue** (F5) is like `c`.

You can also hover your mouse over any variable in the editor to see its value. The [VS Code Python debugging docs](https://code.visualstudio.com/docs/python/debugging) cover more features, like conditional breakpoints that only pause when, say, `letter == "i"`.

## A debugging checklist

When you are stuck, go through these steps in order:

1. **Reproduce it.** Find the smallest input that causes the bug every time (for example, an empty list).
2. **Read the error.** Bottom line first, then the line number.
3. **Check your assumptions.** Print or inspect the values. Is that variable really a number? Is that list really not empty?
4. **Shrink the problem.** Comment out unrelated code, or copy the broken function into a tiny test file and try it in the [REPL](/courses/python/python-repl).
5. **Change one thing at a time** and run again.
6. **Explain it out loud.** Describing your code line by line to someone (or to a rubber duck on your desk) often reveals the mistake. Programmers really call this **rubber duck debugging**.
7. **Take a break.** Fresh eyes find bugs faster.

Later, you can turn each bug you fix into an automatic check, so it never comes back. That is what [Testing with pytest](/courses/python/testing-with-pytest) is about. And for larger programs, [Logging](/courses/python/logging) is a cleaner, permanent replacement for debug prints.

## Common mistakes (classic bugs to recognize)

**1. Off by one.** You wanted the last three items but got two:

```python
def last_three(items):
    return items[len(items) - 3 : len(items) - 1]

print(last_three([1, 2, 3, 4, 5]))
```

```text
[3, 4]
```

The end of a [slice](/courses/python/list-methods-and-slicing) is not included. Fix: `items[-3:]`.

**2. A mutable default argument.** The list is shared between calls:

```python
def add_item(item, basket=[]):
    basket.append(item)
    return basket

print(add_item("apple"))
print(add_item("pear"))
```

```text
['apple']
['apple', 'pear']
```

Fix: use `None` as the default and create the list inside (see [Mutability and Copying](/courses/python/mutability-and-copying)):

```python
def add_item(item, basket=None):
    if basket is None:
        basket = []
    basket.append(item)
    return basket

print(add_item("apple"))
print(add_item("pear"))
```

```text
['apple']
['pear']
```

**3. Forgetting that string methods return a new string.**

```python
def shout(text):
    text.upper()
    return text

print(shout("hello"))
```

```text
hello
```

[Strings](/courses/python/strings) never change in place. Fix: `return text.upper()`.

**4. Fixing the symptom, not the cause.** Wrapping a crash in `try`/`except` makes the traceback disappear, but the bug is still there. Find out why the bad value appeared in the first place.

## Quick recap

- Bugs are syntax errors, runtime errors or logic errors.
- Read tracebacks from the bottom up: error type, failing line, then the chain of calls.
- `print(f"{name=}")` shows a name and its value. `repr()` reveals hidden quotes and spaces.
- `breakpoint()` opens pdb. Use `p`, `n`, `s`, `c`, `l` and `q`.
- The VS Code debugger does the same with red dot breakpoints and F5, F10, F11.
- Reproduce, inspect, shrink, change one thing at a time.

That completes the Files and Errors section. Next you will start object-oriented programming with [Classes and Objects](/courses/python/classes-and-objects).

<code id="code-content" class="language-python">
# main.py: a small grade report with debugging helpers built in
DEBUG = True  # set to False to hide debug output
#
def debug(message: str) -&gt; None:
    """Print only while DEBUG is on, so we can switch prints off in one place."""
    if DEBUG:
        print("[debug]", message)
#
def average(numbers: list[float]) -&gt; float:
    # Guard against the empty list bug we found with the traceback
    if not numbers:
        raise ValueError("cannot average an empty list")
    total = 0
    for n in numbers:
        total += n  # bug fixed: was "total = n"
        debug(f"{n=} {total=}")
    return total / len(numbers)
#
def parse_scores(raw: str) -&gt; list[float]:
    """Turn '80, 90 ,x' into numbers, skipping bad entries."""
    scores = []
    for part in raw.split(","):
        debug(f"part={part!r}")  # !r shows stray spaces
        try:
            scores.append(float(part))
        except ValueError:
            print(f"Skipping {part.strip()!r}: not a number")
    return scores
#
if __name__ == "__main__":
    scores = parse_scores("80, 90 ,x, 70")
    print("Average:", average(scores))
    # Uncomment the next line to pause here and inspect variables with pdb
    # breakpoint()
    try:
        average([])
    except ValueError as error:
        print("Caught:", error)
</code></pre>

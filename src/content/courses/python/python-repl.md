---
publishDate: 2026-10-27T08:03
title: 'The Python Interactive Shell (REPL)'
slug: python-repl
metadescription: 'Use the Python interactive shell (REPL) to try code instantly, see results without print(), get help on functions, and know when to use a file instead.'
updateDate: 2026-10-27T08:03
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'repl']
course: python
---

## A playground for Python

In [Writing and Running Your First Python Program](/courses/python/first-python-program) you saved code in a file and ran the whole file. That is how real programs work. But sometimes you just want to try one line and see what happens, without creating a file.

For that, Python has an **interactive shell**, usually called the **REPL**. REPL stands for:

- **Read**: Python reads the line you type.
- **Eval**: Python evaluates (runs) it.
- **Print**: Python prints the result.
- **Loop**: Python waits for the next line, and the cycle repeats.

Think of the REPL as a calculator that understands all of Python. You type, press Enter, and see the answer right away.

## Starting the REPL

Open a terminal and type `python` (or `py`) on Windows, or `python3` on macOS/Linux, **without** a file name:

```powershell
python
```

```bash
python3
```

You will see something like this:

```text
Python 3.14.3 (tags/v3.14.3:323c59a, Feb  3 2026, 16:04:56) [MSC v.1944 64 bit (AMD64)] on win32
Type "help", "copyright", "credits" or "license" for more information.
>>>
```

The first line shows your Python version. The `>>>` is the **prompt**. It means "Python is ready, type something".

> **Note:** In this course, any code that starts with `>>>` is meant to be typed into the REPL. Type only the part after `>>> `. Lines without `>>>` are what Python prints back.

## Using the REPL as a calculator

Type a math expression and press Enter:

```python
>>> 2 + 3
5
>>> 7 * 6
42
>>> 10 / 3
3.3333333333333335
```

Notice there is no `print()`. The REPL automatically shows the value of whatever you type. An **expression** is any piece of code that produces a value, like `2 + 3`. The REPL evaluates each expression and shows its result.

The long `3.3333333333333335` is normal. Computers store decimal numbers in a way that is sometimes very slightly off. You will learn why in [Numbers and Math Operators](/courses/python/numbers-and-math).

## Trying things out

The REPL is perfect for quick experiments. For example, what happens when you multiply text by a number?

```python
>>> "ha" * 3
'hahaha'
```

Now you know: it repeats the text. You found that out in two seconds, without writing a file.

You can also store values in names (called **variables**, covered in [Variables and Assignment](/courses/python/variables)) and use them on later lines:

```python
>>> name = "Ada"
>>> name
'Ada'
>>> len(name)
3
```

Typing `name = "Ada"` shows nothing, because it is a **statement** (an action: store this value), not an expression. Typing `name` on its own shows the value. `len()` counts the characters in the text.

## Echo vs print()

There is a small but important difference between letting the REPL show a value and calling `print()`:

```python
>>> "Ada"
'Ada'
>>> print("Ada")
Ada
```

When the REPL shows a value, it uses the "developer view", which keeps the quotes so you can see it is a string. `print()` shows the "human view", without quotes.

> **Warning:** The automatic echo only happens in the REPL. In a `.py` file, a line like `2 + 3` on its own calculates the answer and then throws it away. Nothing is shown. In files, always use `print()` to see results.

## The underscore: last result

In the REPL, the special name `_` holds the last result that was shown. It is handy for calculator-style work:

```python
>>> 10 * 5
50
>>> _ + 1
51
```

This only works in the REPL, not in scripts.

## Multi-line code

Some Python code takes more than one line, like a loop. When you start such code, the prompt changes from `>>>` to `...`, which means "keep going, I am waiting for more":

```python
>>> for i in range(3):
...     print(i)
...
0
1
2
```

Type the first line and press Enter. Python shows `...`. Type four spaces, then `print(i)`, and press Enter. Then press Enter on an empty line to tell Python you are done. Python runs the loop. You will learn about loops in [for Loops and range()](/courses/python/for-loops-and-range) and about indentation in [Python Syntax: Comments, Indentation and Statements](/courses/python/syntax-comments-indentation).

## Errors in the REPL

If you make a mistake, the REPL shows the error and waits for the next line. Nothing crashes, and anything you stored before is still there.

```python
>>> price
Traceback (most recent call last):
  File "<python-input-0>", line 1, in <module>
    price
NameError: name 'price' is not defined. Did you mean: 'print'?
>>>
```

Instead of a file name, the error says `<python-input-0>`, which means "the first thing you typed in this session". That makes the REPL a safe place to make mistakes and learn from them.

## Getting help

Python has a built-in help system. Call `help()` with the name of a function:

```python
>>> help(len)
Help on built-in function len in module builtins:

len(obj, /)
    Return the number of items in a container.
```

If the help text is long, it may open in a viewer. Press `q` to close it and return to the `>>>` prompt.

You can also use `dir()` to list what is available on something, and `type()` to ask what kind of value you have:

```python
>>> type(42)
<class 'int'>
>>> type("Ada")
<class 'str'>
```

`int` means a whole number and `str` means a string (text). You will meet all the types in [Data Types: An Overview](/courses/python/data-types).

## Handy keyboard tricks

Recent Python versions (3.13 and newer) come with an improved REPL that has colors, easier multi-line editing and some extra shortcuts:

| Key | What it does |
| --- | --- |
| Up / Down arrows | Bring back lines you typed earlier, so you can run them again |
| Tab | Auto-complete names (type `pri` then Tab to get `print`) |
| Ctrl + C | Cancel the current line if you get stuck |
| Ctrl + L | Clear the screen (you can also type `clear` in Python 3.13+) |
| F1 | Open the help browser (Python 3.13+) |
| F3 | Paste mode, for pasting several lines of code at once (Python 3.13+) |

## Leaving the REPL

When you are done, type:

```python
>>> exit()
```

In Python 3.13 and newer, typing just `exit` or `quit` (without parentheses) also works. You can also use a keyboard shortcut:

- Windows: **Ctrl + Z**, then Enter
- macOS/Linux: **Ctrl + D**

You are now back at the normal terminal prompt.

## REPL or file: which should you use?

| Use the REPL when you want to... | Use a `.py` file when you want to... |
| --- | --- |
| Test one idea quickly | Keep your code and run it again later |
| Check what a function returns | Write anything longer than a few lines |
| Do quick math | Share your program with someone |
| Read `help()` on something | Build a real project |

Most developers keep both open: a file for the real work and a REPL on the side for quick tests.

> **Tip:** You can open a REPL that already knows everything in your file. Run `python -i hello.py` (or `python3 -i hello.py`). Python runs the file, then drops you into the REPL with all its variables ready to inspect.

## Common mistakes

### Typing terminal commands inside the REPL

```text
>>> python hello.py
  File "<python-input-0>", line 1
    python hello.py
           ^^^^^
SyntaxError: invalid syntax
```

**Fix:** `python hello.py` is a terminal command, not Python code. Leave the REPL with `exit()` first, then run the command.

### Typing the >>> yourself

When you copy code from this course into the REPL, do not type `>>>` too. Python adds it for you. If you paste `>>> 2 + 3`, Python sees extra symbols and reports a `SyntaxError`.

### Forgetting the empty line after a block

After a multi-line block like a `for` loop, Python waits at `...` for more. **Fix:** press Enter on an empty line to finish the block.

### Expecting REPL work to be saved

Everything you type in the REPL is lost when you exit. **Fix:** once an idea works, copy it into a `.py` file.

## Quick recap

- The REPL (Read, Eval, Print, Loop) runs Python one line at a time.
- Start it by typing `python`, `py` or `python3` with no file name. The prompt is `>>>`.
- The REPL shows the value of expressions automatically; files need `print()`.
- `_` holds the last result. `...` means Python wants more lines.
- Use `help()` and `type()` to explore. Leave with `exit()`, Ctrl + Z (Windows) or Ctrl + D (macOS/Linux).

Typing in a plain editor and a terminal works, but a good code editor makes life much easier. Next up: [Setting Up VS Code for Python](/courses/python/setting-up-vs-code).

<code id="code-content" class="language-python">
# main.py: things worth trying in the REPL
# Start the REPL with: python (Windows) or python3 (macOS/Linux)
# then type the lines below one by one, without the print() calls.
# In this file we need print() to see each result.
#
# The REPL as a calculator
print(2 + 3)
print(7 * 6)
print(10 / 3)
#
# Experimenting: multiplying text repeats it
print("ha" * 3)
#
# Store a value and use it later
name = "Ada"
print(len(name))
#
# The REPL shows repr() (with quotes); print() shows plain text
print(repr(name))
print(name)
#
# type() tells you what kind of value you have
print(type(42))
print(type("Ada"))
#
# A multi-line block: in the REPL you finish it with an empty line
for i in range(3):
    print(i)
#
# Tip: run "python -i main.py" to run this file
# and then keep exploring its variables in the REPL.
</code></pre>

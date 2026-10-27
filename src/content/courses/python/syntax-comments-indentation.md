---
publishDate: 2026-10-27T08:05
title: 'Python Syntax: Comments, Indentation and Statements'
slug: syntax-comments-indentation
metadescription: 'Learn the basic grammar of Python: statements, comments, indentation with four spaces, colons, long lines, keywords, and how to fix IndentationError.'
updateDate: 2026-10-27T08:05
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'syntax']
course: python
---

## The grammar of Python

Every language has rules. In English, a sentence starts with a capital letter and ends with a full stop. Programming languages have rules too, and they are called **syntax**. If you break a syntax rule, Python cannot understand your code and stops with a `SyntaxError`, as you saw in [Writing and Running Your First Python Program](/courses/python/first-python-program).

The good news: Python's syntax is small and clean. In this lesson you will learn the core rules that every Python file follows:

- Statements, one per line
- Comments, for notes to humans
- Indentation, to group lines together
- Colons, to start a block
- Splitting long lines
- Case sensitivity and reserved words

## Statements: one instruction per line

A **statement** is one complete instruction. In Python, each statement usually goes on its own line, and the end of the line marks the end of the statement. There is no semicolon at the end like in some other languages.

```python
name = "Ada"
print(name)
print("Done")
```

Python runs these from top to bottom: first it stores the name, then prints it, then prints `Done`.

You *can* put several statements on one line with semicolons:

```python
a = 1; b = 2; print(a + b)
```

Output:

```text
3
```

It works, but it is considered bad style because it is harder to read. Stick to one statement per line.

## Comments: notes for humans

A **comment** is a note in your code that Python completely ignores. It starts with a `#` (hash sign) and runs to the end of the line.

```python
# This program greets the user
print("Hello!")  # this part is ignored by Python
# print("This line will not run")
print("Goodbye!")
```

Output:

```text
Hello!
Goodbye!
```

There are three common uses here:

1. A **full-line comment** (line 1) explains what the code does.
2. An **inline comment** (line 2) sits after code on the same line. Put at least two spaces before the `#`.
3. A **commented-out** line (line 3) turns code off without deleting it. This is handy while testing.

> **Tip:** In VS Code, select some lines and press **Ctrl + /** (Cmd + / on macOS) to comment or uncomment them all at once.

### What makes a good comment?

Good comments explain **why**, not **what**. The code already says what it does.

```python
# Bad: says what the code already says
count = count + 1  # add 1 to count

# Good: explains why
count = count + 1  # the list starts at 0, but people count from 1
```

(This example will not run on its own because `count` does not exist yet. It only shows comment style.)

### Multi-line comments

Python has no special multi-line comment symbol. The normal way is to start each line with `#`:

```python
# This is a longer explanation
# that needs more than one line,
# so each line gets its own hash sign.
print("Hi")
```

You may also see text inside triple quotes used as a note:

```python
"""
This is a multi-line string.
When it is not stored anywhere,
Python simply ignores it.
"""
print("The string above did nothing.")
```

Output:

```text
The string above did nothing.
```

Technically this is a string, not a comment. Its real job is a **docstring**, a description at the top of a file or function. You will learn about those in [Docstrings and Writing Clean Functions](/courses/python/docstrings-and-clean-functions). For normal notes, use `#`.

## Indentation: how Python groups code

This is the rule that makes Python look different from most languages.

**Indentation** means the spaces at the start of a line. In Python, indentation is not just for looks. It tells Python which lines belong together in a **block** (a group of statements that run together).

```python
temperature = 30

if temperature > 25:
    print("It is hot today.")
    print("Drink some water.")
print("This line always runs.")
```

Output:

```text
It is hot today.
Drink some water.
This line always runs.
```

The two indented lines belong to the `if`. They run only when the temperature is above 25. The last line is not indented, so it is outside the block and always runs. Change `temperature` to `18` and run it again:

```python
temperature = 18

if temperature > 25:
    print("It is hot today.")
    print("Drink some water.")
print("This line always runs.")
```

Output:

```text
This line always runs.
```

Now the whole indented block is skipped. You will learn all about `if` in [Making Decisions with if, elif and else](/courses/python/if-elif-else).

Think of indentation like the layout of a to-do list with sub-tasks. The sub-tasks are pushed in to show they belong to the main task above them.

### The rules of indentation

- Use **4 spaces** per level. This is the official Python style.
- Every line in the same block must have **exactly the same** indentation.
- Do not mix tabs and spaces. (Code editors like [VS Code](/courses/python/setting-up-vs-code) insert 4 spaces when you press Tab, which avoids this problem.)

### Blocks inside blocks

A block can contain another block. Each level adds 4 more spaces:

```python
age = 20
has_ticket = True

if age >= 18:
    print("You are an adult.")
    if has_ticket:
        print("Enjoy the show!")
print("Done.")
```

Output:

```text
You are an adult.
Enjoy the show!
Done.
```

`True` here is a special yes/no value. You will meet it properly in [Booleans, Comparisons and None](/courses/python/booleans-and-none).

## The colon starts a block

Look at the `if` lines above. They end with a colon `:`. In Python, **a colon at the end of a line means "an indented block comes next"**. You will see this pattern with `if`, `else`, `for`, `while`, `def`, `class` and more.

| Line ends with | What comes next |
| --- | --- |
| `if temperature > 25:` | Lines to run when the test is true |
| `for item in shopping:` | Lines to repeat for each item |
| `def greet():` | The body of a function |

## Splitting long lines

Short lines are easier to read. Python style suggests keeping lines under about 79 characters. If a statement is too long, you can split it.

The best way is inside brackets. Python knows the statement is not finished until the bracket closes:

```python
total = (1 + 2 + 3
         + 4 + 5 + 6)
print(total)
shopping = [
    "apples",
    "bread",
    "milk",
]
print(shopping)
```

Output:

```text
21
['apples', 'bread', 'milk']
```

You can also end a line with a backslash `\` to say "this continues on the next line":

```python
total = 1 + 2 + 3 \
        + 4 + 5 + 6
print(total)
```

Output:

```text
21
```

Brackets are preferred, because a backslash is easy to miss and breaks if a space sneaks in after it.

## Case sensitivity

Python treats uppercase and lowercase letters as different. `name`, `Name` and `NAME` are three different names:

```python
name = "Ada"
Name = "Grace"
print(name)
print(Name)
```

Output:

```text
Ada
Grace
```

This is why `Print("hi")` fails while `print("hi")` works.

## Keywords: reserved words

Some words have a special meaning in Python and cannot be used as names. They are called **keywords**. You can list them:

```python
import keyword
print(len(keyword.kwlist))
print(keyword.kwlist)
```

Output:

```text
35
['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield']
```

You do not need to memorize them. Your editor colors them differently, and you will learn each one as the course goes on.

## Style: PEP 8

Python has an official style guide called **PEP 8**. It covers things like 4-space indentation, line length, and spacing around `=` and `+`. Following it makes your code look like everyone else's, which makes it easier to read and share. You can read it at [peps.python.org/pep-0008](https://peps.python.org/pep-0008/), but the examples in this course already follow it.

## Common mistakes

### Forgetting to indent after a colon

```text
if True:
print("Hello")
```

Error:

```text
  File "main.py", line 2
    print("Hello")
    ^^^^^
IndentationError: expected an indented block after 'if' statement on line 1
```

**Fix:** indent the line under the `if` by 4 spaces.

### Indenting for no reason

```text
print("One")
    print("Two")
```

Error:

```text
  File "main.py", line 2
    print("Two")
IndentationError: unexpected indent
```

**Fix:** only indent after a line that ends with a colon. Remove the extra spaces.

### Uneven indentation

```text
if True:
    print("One")
  print("Two")
```

Error:

```text
  File "main.py", line 3
    print("Two")
                ^
IndentationError: unindent does not match any outer indentation level
```

**Fix:** lines in the same block need exactly the same number of spaces. Use 4 everywhere.

### Forgetting the colon

```text
if True
    print("Hello")
```

Error:

```text
  File "main.py", line 1
    if True
           ^
SyntaxError: expected ':'
```

**Fix:** add `:` at the end of the `if` line.

### Using a keyword as a name

```text
class = "Python 101"
```

Error:

```text
  File "main.py", line 1
    class = "Python 101"
          ^
SyntaxError: invalid syntax
```

**Fix:** pick a different name, such as `course_name`.

## Quick recap

- One statement per line. No semicolons needed.
- `#` starts a comment that Python ignores. Comment the "why".
- Indentation (4 spaces) groups lines into blocks. It is a rule, not decoration.
- A colon `:` at the end of a line means an indented block follows.
- Split long lines inside brackets.
- Python is case sensitive, and keywords cannot be used as names.

Now that you know the grammar, you are ready to store information: [Variables and Assignment](/courses/python/variables).

<code id="code-content" class="language-python">
# main.py: Python syntax basics in one file
# Lines that start with # are comments. Python ignores them.
#
# One statement per line, no semicolons needed
name = "Ada"
temperature = 30
has_umbrella = False
#
print("Hello,", name)  # an inline comment: two spaces before the #
#
# A colon starts a block; the indented lines belong to it
if temperature &gt; 25:
    print("It is hot today.")
    print("Drink some water.")
#
# Blocks can be nested: each level adds 4 more spaces
if temperature &lt; 10:
    print("It is cold.")
    if not has_umbrella:
        print("And you have no umbrella!")
#
# This line is not indented, so it always runs
print("Weather check finished.")
#
# Long statements can be split inside brackets
total = (1 + 2 + 3
         + 4 + 5 + 6)
print("Total:", total)
#
# Python is case sensitive: these are two different names
Name = "Grace"
print(name, "and", Name)
#
# print("This line is commented out, so it does not run")
</code></pre>

---
publishDate: 2026-10-27T08:10
title: 'Useful String Methods'
slug: string-methods
metadescription: 'Learn the Python string methods you will use every day: changing case, strip, replace, find, startswith, split, join, the is checks and more.'
updateDate: 2026-10-27T08:10
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'strings']
course: python
---

## Tools built into every string

In [Strings: Working with Text](/courses/python/strings) you learned to create, join and slice strings. But what if you want to turn text into capital letters, remove extra spaces, or split a sentence into words? You could write that code yourself, but you do not have to. Every string comes with dozens of ready-made tools called **methods**.

A **method** is a function that belongs to a value. You call it with a dot after the value:

```python
name = "ada lovelace"
print(name.upper())
print(name)
```

Output:

```text
ADA LOVELACE
ada lovelace
```

Read `name.upper()` as "take `name` and run its `upper` method". Compare this to a normal function like `len(name)`, where the value goes inside the parentheses.

Notice the second line: `name` did **not** change. Strings are immutable (they can never be changed), so string methods never change the original. They always **return a new string**. If you want to keep the result, store it in a variable:

```python
name = "ada"
name.upper()
print(name)
name = name.upper()
print(name)
```

Output:

```text
ada
ADA
```

> **Tip:** Remember this rule and you will avoid the most common string bug: "string methods return a new string, so save the result."

## Changing case

```python
text = "hello WORLD from python"
print(text.upper())
print(text.lower())
print(text.title())
print(text.capitalize())
print(text.swapcase())
```

Output:

```text
HELLO WORLD FROM PYTHON
hello world from python
Hello World From Python
Hello world from python
HELLO world FROM PYTHON
```

| Method | What it does |
| --- | --- |
| `upper()` | All letters uppercase |
| `lower()` | All letters lowercase |
| `title()` | First letter of each word uppercase |
| `capitalize()` | First letter of the whole string uppercase, the rest lowercase |
| `swapcase()` | Flips upper to lower and lower to upper |

A very common use: comparing text without caring about case. Users might type `yes`, `Yes` or `YES`:

```python
answer = "YES"
print(answer.lower() == "yes")
```

Output:

```text
True
```

## Removing extra spaces with strip()

Text typed by users often has extra spaces at the start or end. `strip()` removes **whitespace** (spaces, tabs and new lines) from both ends:

```python
raw = "   Ada Lovelace   "
print("[" + raw + "]")
print("[" + raw.strip() + "]")
print("[" + raw.lstrip() + "]")
print("[" + raw.rstrip() + "]")
print("***hello***".strip("*"))
```

Output:

```text
[   Ada Lovelace   ]
[Ada Lovelace]
[Ada Lovelace   ]
[   Ada Lovelace]
hello
```

The square brackets are only there so you can see the spaces. `lstrip()` cleans only the left side, `rstrip()` only the right side. Spaces in the middle are kept. You can also tell `strip()` which characters to remove, like `"*"` in the last line.

## Replacing text

`replace(old, new)` swaps every match of `old` with `new`:

```python
sentence = "I like cats. cats are great."
print(sentence.replace("cats", "dogs"))
print(sentence.replace("cats", "dogs", 1))
print(sentence)
```

Output:

```text
I like dogs. dogs are great.
I like dogs. cats are great.
I like cats. cats are great.
```

An optional third argument limits how many replacements happen. And again, the original `sentence` is unchanged.

## Finding and counting

```python
email = "ada@example.com"
print(email.find("@"))
print(email.find("#"))
print(email.index("@"))
print(email.count("a"))
print("banana".count("an"))
```

Output:

```text
3
-1
3
3
2
```

- `find(text)` returns the index where `text` first appears, or `-1` if it is not there.
- `index(text)` does the same, but raises an error if it is not found (see Common mistakes).
- `count(text)` counts how many times `text` appears.

If you only need a yes/no answer, use `in` instead: `"@" in email`.

## Checking the start and end

```python
filename = "report.pdf"
print(filename.startswith("rep"))
print(filename.endswith(".pdf"))
print(filename.endswith((".jpg", ".png")))
```

Output:

```text
True
True
False
```

You can pass several options inside parentheses (a [tuple](/courses/python/tuples-and-unpacking)), and the method returns `True` if any of them match. This is great for checking file types.

### Removing a prefix or suffix

Python 3.9 and newer can cut a known piece off the start or end:

```python
filename = "report.pdf"
print(filename.removesuffix(".pdf"))
print("Mr. Smith".removeprefix("Mr. "))
print(filename.removesuffix(".txt"))
```

Output:

```text
report
Smith
report.pdf
```

If the prefix or suffix is not there, you get the string back unchanged.

## Splitting text into a list

`split()` breaks a string into a [list](/courses/python/lists) of smaller strings. With no argument, it splits on any whitespace:

```python
sentence = "Python is easy to learn"
words = sentence.split()
print(words)
print(len(words))
date = "2026-10-27"
print(date.split("-"))
csv_line = "Ada,36,London"
print(csv_line.split(","))
```

Output:

```text
['Python', 'is', 'easy', 'to', 'learn']
5
['2026', '10', '27']
['Ada', '36', 'London']
```

Give `split()` a **separator** to split on something else, like `"-"` or `","`. Counting words in a sentence is as easy as `len(sentence.split())`. For real CSV files, see [Working with JSON and CSV Files](/courses/python/json-and-csv).

## Joining a list into a string

`join()` is the opposite of `split()`. It glues a list of strings together. The odd part: you call it on the **separator**, and pass the list:

```python
words = ["Python", "is", "fun"]
print(" ".join(words))
print("-".join(words))
print("".join(words))
print(", ".join(["red", "green", "blue"]))
```

Output:

```text
Python is fun
Python-is-fun
Pythonisfun
red, green, blue
```

Read `", ".join(colors)` as "join the colors, with `", "` between each one".

## Asking questions with is... methods

Methods that start with `is` check what a string contains and return `True` or `False`:

```python
print("12345".isdigit())
print("12a45".isdigit())
print("Ada".isalpha())
print("Ada Lovelace".isalpha())
print("abc123".isalnum())
print("   ".isspace())
print("HELLO".isupper())
print("hello".islower())
```

Output:

```text
True
False
True
False
True
True
True
True
```

| Method | `True` when the string... |
| --- | --- |
| `isdigit()` | Has only digits |
| `isalpha()` | Has only letters (a space is not a letter) |
| `isalnum()` | Has only letters and digits |
| `isspace()` | Has only whitespace |
| `isupper()` / `islower()` | Has letters that are all upper / all lower case |

`isdigit()` is especially useful before turning user input into a number, as you will see in [Converting Between Types](/courses/python/type-conversion).

## Lining text up

These methods pad a string to a fixed width, which is handy for simple tables:

```python
print("Hi".center(10, "*"))
print("Name".ljust(10) + "|")
print("42".rjust(6) + "|")
print("7".zfill(3))
```

Output:

```text
****Hi****
Name      |
    42|
007
```

`zfill()` pads a number string with zeros on the left. For serious formatting, [f-strings](/courses/python/f-strings) are even more powerful.

## Chaining methods

Because each method returns a new string, you can call another method on the result straight away. This is called **chaining**:

```python
messy = "   HeLLo WoRLD   "
clean = messy.strip().lower().replace("world", "python")
print(clean)
```

Output:

```text
hello python
```

Python runs them left to right: strip the spaces, then lowercase, then replace. Here is a practical example that turns a title into a web address "slug":

```python
title = "  My First Blog Post  "
slug = "-".join(title.strip().lower().split())
print(slug)
```

Output:

```text
my-first-blog-post
```

> **Tip:** To see every string method, type `help(str)` in the [REPL](/courses/python/python-repl), or read the [string methods docs](https://docs.python.org/3/library/stdtypes.html#string-methods).

## Common mistakes

### Forgetting the parentheses

```python
name = "ada"
print(name.upper)
```

Output:

```text
<built-in method upper of str object at 0x000001B713891770>
```

There is no error, but you get a strange message instead of `ADA` (the number will be different on your computer). Without `()`, you are pointing at the method instead of calling it. **Fix:** `name.upper()`.

### Expecting the original string to change

Calling `name.upper()` on its own line does nothing useful, because the new string is thrown away. **Fix:** save it: `name = name.upper()`.

### Using index() when the text might be missing

```python
email = "ada.example.com"
print(email.index("@"))
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(email.index("@"))
          ~~~~~~~~~~~^^^^^
ValueError: substring not found
```

**Fix:** use `find()`, which returns `-1` instead of crashing, or check with `"@" in email` first.

### Joining numbers

```python
print(", ".join([1, 2, 3]))
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    print(", ".join([1, 2, 3]))
          ~~~~~~~~~^^^^^^^^^^^
TypeError: sequence item 0: expected str instance, int found
```

`join()` only works with strings. **Fix:** convert each item first. The short form below is a list comprehension, which you will learn in [List, Dict and Set Comprehensions](/courses/python/comprehensions):

```python
numbers = [1, 2, 3]
print(", ".join([str(n) for n in numbers]))
```

Output:

```text
1, 2, 3
```

### Calling join() on the list

`["a", "b"].join(", ")` does not work, because lists have no `join` method. **Fix:** the separator comes first: `", ".join(["a", "b"])`.

## Quick recap

- Methods are called with a dot: `text.upper()`. String methods return a **new** string.
- Case: `upper()`, `lower()`, `title()`, `capitalize()`.
- Cleaning: `strip()`, `replace()`, `removeprefix()`, `removesuffix()`.
- Searching: `find()`, `index()`, `count()`, `startswith()`, `endswith()`.
- `split()` turns a string into a list; `separator.join(list)` does the reverse.
- `isdigit()`, `isalpha()` and friends answer yes/no questions about the text.
- Chain methods to do several steps in one line.

Joining strings with `+` gets messy fast. There is a much cleaner way to build text with variables in it: [f-strings and String Formatting](/courses/python/f-strings).

<code id="code-content" class="language-python">
# main.py: cleaning up a user profile with string methods
# String methods return NEW strings, so we save each result.
#
raw_name = "   ada LOVELACE   "
raw_email = "  Ada@Example.COM "
raw_skills = "python, math,  poetry ,engines"
raw_phone = "555-0142"
#
# strip() removes spaces, title() fixes the capitals
name = raw_name.strip().title()
print("Name:", name)
#
# Emails are not case sensitive, so store them in lowercase
email = raw_email.strip().lower()
print("Email:", email)
print("Valid looking email:", "@" in email and email.endswith(".com"))
#
# find() gives the position of "@", or -1 if missing
at = email.find("@")
print("Username part:", email[:at])
print("Domain part:", email[at + 1:])
#
# split() makes a list; strip each part and join them back
parts = raw_skills.split(",")
skills = [part.strip().capitalize() for part in parts]
print("Skills:", ", ".join(skills))
print("Number of skills:", len(skills))
#
# replace() and isdigit() to check a phone number
digits = raw_phone.replace("-", "")
print("Phone digits:", digits, "| only digits:", digits.isdigit())
#
# A simple aligned summary with ljust()
print("-" * 30)
print("Name".ljust(8), name)
print("Email".ljust(8), email)
print("Initials".ljust(8), "".join(word[0] for word in name.split()))
#
# Make a web-friendly slug from the name
slug = "-".join(name.lower().split())
print("Profile URL: /users/" + slug)
</code></pre>

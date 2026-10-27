---
publishDate: 2026-10-27T08:09
title: 'Strings: Working with Text'
slug: strings
metadescription: 'Work with text in Python: create strings with quotes, use escape characters, join and repeat text, and pick out characters with indexing and slicing.'
updateDate: 2026-10-27T08:09
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'strings']
course: python
---

## What is a string?

Names, messages, emails, file names, web pages: a huge part of programming is working with text. In Python, a piece of text is called a **string**, and its type is `str`.

A string is a **sequence of characters**. A **character** is a single letter, digit, space, punctuation mark or symbol (even an emoji). Picture a string as a row of beads on a thread. Each bead is one character, and the order matters.

You already used strings in [Writing and Running Your First Python Program](/courses/python/first-python-program). In this lesson you will learn how to create them properly, combine them, and pull out the parts you need.

## Creating strings

Put text inside quotes. Single and double quotes do exactly the same thing:

```python
single = 'Hello'
double = "Hello"
print(single == double)
print("It's a sunny day")
print('She said "hi" to me')
```

Output:

```text
True
It's a sunny day
She said "hi" to me
```

Having both kinds is handy. If your text contains an apostrophe (`'`), wrap it in double quotes. If it contains double quotes, wrap it in single quotes. Just make sure the opening and closing quotes match.

> **Note:** Many Python programmers use double quotes by default. That is what this course does. Pick one style and be consistent.

## Escape characters

What if you need both kinds of quotes, or a new line, inside a string? Use a **backslash** `\`. A backslash followed by a character is called an **escape sequence**: it tells Python "the next character is special".

```python
print('It\'s easy')
print("She said \"hi\"")
print("Line one\nLine two")
print("Name:\tAda")
print("C:\\Users\\Ada")
```

Output:

```text
It's easy
She said "hi"
Line one
Line two
Name:   Ada
C:\Users\Ada
```

| Escape | Meaning |
| --- | --- |
| `\'` | A single quote |
| `\"` | A double quote |
| `\n` | New line |
| `\t` | Tab (a wide space) |
| `\\` | A real backslash |

### Raw strings

Backslashes cause trouble in Windows file paths. Look at this:

```python
print("C:\new\table")
print(r"C:\new\table")
```

Output:

```text
C:
ew      able
C:\new\table
```

In the first line Python saw `\n` (new line) and `\t` (tab), which is not what you wanted. Putting an `r` before the quotes makes a **raw string**, where backslashes are just normal characters. Raw strings are also very useful in [Regular Expressions with re](/courses/python/regular-expressions).

> **Tip:** For file paths, an even better tool is `pathlib`, covered in [Working with File Paths using pathlib](/courses/python/pathlib). Forward slashes `/` also work in paths on Windows.

## Multi-line strings

Triple quotes (`"""` or `'''`) let a string span several lines. The line breaks are kept:

```python
poem = """Roses are red,
Violets are blue,
Python is fun,
And so are you."""
print(poem)
```

Output:

```text
Roses are red,
Violets are blue,
Python is fun,
And so are you.
```

## Joining and repeating strings

Use `+` to join strings together. This is called **concatenation**. Use `*` with a number to repeat a string:

```python
first = "Ada"
last = "Lovelace"
full = first + " " + last
print(full)
print("-" * 20)
print("ha" * 3)
```

Output:

```text
Ada Lovelace
--------------------
hahaha
```

Notice the `" "` in the middle. `+` does not add spaces for you.

### Joining strings and numbers

`+` only joins strings to strings. To include a number, convert it with `str()` first:

```python
age = 36
message = "I am " + str(age) + " years old"
print(message)
```

Output:

```text
I am 36 years old
```

There is a much nicer way to do this, called an **f-string**:

```python
name = "Ada"
age = 36
print(f"{name} is {age} years old")
```

Output:

```text
Ada is 36 years old
```

The `f` before the quotes lets you put variables inside `{ }`. You will learn everything about them in [f-strings and String Formatting](/courses/python/f-strings).

## Length with len()

`len()` tells you how many characters a string has. Spaces and punctuation count too:

```python
word = "Python"
print(len(word))
print(len("Hi there!"))
print(len(""))
```

Output:

```text
6
9
0
```

## Indexing: getting one character

Every character in a string has a position number called an **index**. Python starts counting at **0**, not 1:

```text
 P   y   t   h   o   n
 0   1   2   3   4   5
-6  -5  -4  -3  -2  -1
```

Put the index in square brackets to get that character:

```python
word = "Python"
print(word[0])
print(word[1])
print(word[5])
print(word[-1])
print(word[-2])
```

Output:

```text
P
y
n
n
o
```

**Negative indexes** count from the end. `-1` is always the last character, `-2` the one before it, and so on. This is handy when you do not know how long the string is.

> **Note:** Starting at 0 feels strange at first. Think of the index as "how many steps from the start". The first character is 0 steps away.

## Slicing: getting a piece

A **slice** grabs several characters at once. Write `[start:stop]`. You get the characters from `start` up to, **but not including**, `stop`:

```python
word = "Python"
print(word[0:2])
print(word[2:5])
print(word[:3])
print(word[3:])
print(word[-3:])
print(word[:])
```

Output:

```text
Py
tho
Pyt
hon
hon
Python
```

- Leave out `start` to begin at the beginning: `word[:3]`.
- Leave out `stop` to go to the end: `word[3:]`.
- `word[:3] + word[3:]` always gives back the whole word.

You can add a third number, the **step**, to skip characters. A step of `-1` walks backwards, which reverses the string:

```python
word = "Python"
print(word[::2])
print(word[::-1])
```

Output:

```text
Pto
nohtyP
```

Slices are forgiving. If you go past the end, you just get what is there, with no error:

```python
word = "Python"
print(word[2:100])
print(len(word[10:]))
```

Output:

```text
thon
0
```

You will use the same indexing and slicing with lists in [List Methods, Slicing and Sorting](/courses/python/list-methods-and-slicing).

## Checking for text with in

The `in` operator checks whether one string appears inside another. It gives `True` or `False`:

```python
sentence = "Python is fun"
print("fun" in sentence)
print("boring" in sentence)
print("Fun" in sentence)
print("x" not in sentence)
```

Output:

```text
True
False
False
True
```

The check is **case sensitive**: `"Fun"` with a capital F is not found.

## Comparing strings

`==` checks whether two strings are exactly the same:

```python
print("apple" == "apple")
print("apple" == "Apple")
print("apple" < "banana")
```

Output:

```text
True
False
True
```

`<` and `>` compare in alphabetical (dictionary) order. Note that uppercase and lowercase letters count as different characters.

## Looping over a string

A string is a sequence, so a `for` loop can visit each character in turn:

```python
for letter in "Hi!":
    print(letter)
```

Output:

```text
H
i
!
```

Loops are explained properly in [for Loops and range()](/courses/python/for-loops-and-range).

## Strings cannot be changed

Strings are **immutable**: once created, their characters can never change (you met this idea in [Data Types: An Overview](/courses/python/data-types)). To "change" a string, you build a new one and assign it:

```python
word = "cat"
word = "b" + word[1:]
print(word)
```

Output:

```text
bat
```

## Common mistakes

### Index out of range

```python
word = "Python"
print(word[6])
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(word[6])
          ~~~~^^^
IndexError: string index out of range
```

`"Python"` has 6 characters, so the indexes go from 0 to 5. **Fix:** the last index is always `len(word) - 1`, or simply use `word[-1]`.

### Trying to change one character

```python
word = "cat"
word[0] = "b"
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    word[0] = "b"
    ~~~~^^^
TypeError: 'str' object does not support item assignment
```

**Fix:** build a new string: `word = "b" + word[1:]`, or use `replace()` from [Useful String Methods](/courses/python/string-methods).

### Joining a string and a number

```python
age = 36
print("I am " + age + " years old")
```

Error:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print("I am " + age + " years old")
          ~~~~~~~~^~~~~
TypeError: can only concatenate str (not "int") to str
```

**Fix:** use `str(age)`, or better, an f-string: `f"I am {age} years old"`.

### Mismatched quotes

```text
print("Hello')
```

Error:

```text
  File "main.py", line 1
    print("Hello')
          ^
SyntaxError: unterminated string literal (detected at line 1)
```

**Fix:** start and end the string with the same kind of quote.

## Quick recap

- A string (`str`) is text in single, double or triple quotes.
- Backslash escapes: `\n` new line, `\t` tab, `\\` backslash, `\'` and `\"` quotes. `r"..."` turns them off.
- `+` joins strings, `*` repeats them, `len()` counts characters.
- Indexes start at 0; negative indexes count from the end.
- Slices `[start:stop:step]` take a piece; `stop` is not included; `[::-1]` reverses.
- `in` checks if text is inside a string. Strings are immutable.

Strings also come with dozens of built-in tools for changing case, finding text, splitting and more. Learn them in [Useful String Methods](/courses/python/string-methods).

<code id="code-content" class="language-python">
# main.py: working with strings
#
first = "Ada"
last = "Lovelace"
#
# Join strings with + (remember to add the space yourself)
full_name = first + " " + last
print(full_name)
#
# Repeat a string with *
print("=" * len(full_name))
#
# Escape characters: \t is a tab, \n is a new line
print("First:\t" + first + "\nLast:\t" + last)
#
# len() counts characters, including the space
print("Characters in full name:", len(full_name))
#
# Indexing starts at 0; -1 is the last character
print("First letter:", full_name[0])
print("Last letter:", full_name[-1])
#
# Slicing: [start:stop] does not include stop
print("First three:", full_name[:3])
print("Surname from slice:", full_name[4:])
print("Reversed:", full_name[::-1])
#
# Initials from indexing
initials = first[0] + "." + last[0] + "."
print("Initials:", initials)
#
# in checks whether text appears inside a string
print("love" in full_name)
print("Love" in full_name)
#
# Strings are immutable, so build a new one to "change" it
word = "cat"
word = "b" + word[1:]
print(word)
#
# Numbers must be converted before joining with +
age = 36
print(first + " is " + str(age) + " years old")
</code></pre>

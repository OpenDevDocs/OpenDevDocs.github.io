---
publishDate: 2026-10-27T08:00
title: 'What is Python and Why Learn It?'
slug: what-is-python
metadescription: 'Learn what Python is, why so many beginners and companies use it, what you can build with it, and what this course will teach you step by step.'
updateDate: 2026-10-27T08:00
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'basics']
course: python
---

## Welcome to Python

Welcome! In this course you will learn to write programs in **Python**, one small step at a time. You do not need any coding experience. If you can use a computer and type, you can follow along.

In this first lesson you will not install anything yet. You will learn:

- What a programming language is
- What makes Python special
- What people build with Python
- How this course is organized

## What is a programming language?

A computer is very fast, but it is not smart. It only does exactly what it is told. A **program** is a list of instructions that tells the computer what to do, step by step.

Computers really understand only ones and zeros, which are very hard for people to read. A **programming language** is a middle ground: a set of words and rules that people can read and write, and that a computer can turn into actions.

Think of a recipe. A recipe is a list of steps written in a language the cook understands: "crack two eggs", "stir for one minute". A program is a recipe for a computer, and the programming language is the language the recipe is written in.

## So what is Python?

**Python** is a programming language that was created by Guido van Rossum and first released in 1991. It is named after the British comedy group Monty Python, not the snake (although the snake logo stuck).

Python was designed to be easy to read. Here is a complete Python program:

```python
print("Hello, world!")
```

Output:

```text
Hello, world!
```

That is it. One line. `print()` is a built-in instruction that shows text on the screen. In many other languages, the same program needs several lines of extra setup before you can show a single word.

Here is a slightly bigger program. Even without knowing Python, you can probably guess what it does:

```python
prices = [4.50, 2.25, 3.00]
total = sum(prices)
print("Items:", len(prices))
print("Total:", total)
```

Output:

```text
Items: 3
Total: 9.75
```

It stores three prices, adds them up with `sum()`, counts them with `len()`, and prints the results. Python code often reads almost like plain English. That is the main reason it is so popular with beginners.

## How Python runs your code

Python is an **interpreted language**. That means a program called the **Python interpreter** reads your code and runs it line by line, from top to bottom. You do not need a separate "build" step before you can see the result.

Compare it to a live translator at a meeting. You speak one sentence, the translator says it in the other language right away. The Python interpreter does the same thing with your code: it reads an instruction and carries it out.

This makes Python great for learning, because you can try an idea and see the result in seconds. In [The Python Interactive Shell (REPL)](/courses/python/python-repl) you will even type code one line at a time and get an answer instantly.

> **Note:** When people say "Python", they can mean the language (the rules for writing code) or the interpreter (the program that runs the code). You install the interpreter, then you write code in the language.

## Why learn Python?

There are hundreds of programming languages. Here is why Python is one of the best first choices.

### 1. It is easy to read and write

Python uses plain words like `if`, `for`, `in`, `and`, `not`. It uses **indentation** (spaces at the start of a line) to group code, so programs look tidy by default. You will learn about this in [Python Syntax: Comments, Indentation and Statements](/courses/python/syntax-comments-indentation).

```python
name = "Ada"
if len(name) > 2:
    print("That is a nice long name,", name)
```

Output:

```text
That is a nice long name, Ada
```

### 2. It is free and runs everywhere

Python is **open source**, which means it is free to download, use and share. It runs on Windows, macOS and Linux, and the same code usually works on all three without changes.

### 3. It comes with "batteries included"

Python ships with a large **standard library**: a big toolbox of ready-made code for working with files, dates, math, the internet, and much more. You get it the moment you install Python. You will explore it in [A Tour of the Standard Library](/courses/python/standard-library-tour).

On top of that, there are hundreds of thousands of free extra packages on [PyPI](https://pypi.org), the Python Package Index. You will learn to install them in [Installing Packages with pip](/courses/python/pip-and-packages).

### 4. It is used for real work

Python is not just a teaching language. Large companies, scientists, and solo developers use it every day.

### 5. It has a huge, friendly community

Millions of people use Python. That means lots of tutorials, answers to common questions, and free libraries. When you get stuck, someone has almost certainly had the same problem before.

## What can you build with Python?

Here are some of the most common uses:

| Area | What Python does there | Example tools |
| --- | --- | --- |
| Web development | Builds the "back end" of websites and APIs | Django, Flask, FastAPI |
| Data analysis | Cleans, explores and charts data | pandas, matplotlib |
| Machine learning | Trains models that learn from data | scikit-learn, PyTorch |
| Automation | Renames files, fills spreadsheets, sends reports | Standard library scripts |
| Scripting and DevOps | Glues tools together and manages servers | Standard library, Ansible |
| Games and education | Simple 2D games and learning projects | pygame, turtle |

You do not need to pick an area right now. The basics in this course are the same for all of them. Once you know the core language, moving into web, data, or automation is much easier.

> **Tip:** Automation is a great first goal. Think of a boring task you do on your computer every week. By the end of this course, you will probably be able to write a Python script that does it for you.

## Python 2 vs Python 3

You may see old tutorials that mention "Python 2". Python 2 reached its end of life in 2020 and no longer gets updates. Everything in this course uses **Python 3**, the current version of the language. This course was tested with Python 3.14.

If you see code like `print "hello"` (without parentheses) online, it is old Python 2 code and will not work in Python 3.

## The Zen of Python

Python even has its own short list of design ideas, called "The Zen of Python". You can read it by running this one line:

```python
import this
```

Output (first few lines):

```text
The Zen of Python, by Tim Peters

Beautiful is better than ugly.
Explicit is better than implicit.
Simple is better than complex.
```

The full list goes on with lines like "Readability counts". You will see this idea again and again: good Python code is code that other people can easily read.

## How this course is organized

The course moves from simple to more advanced topics. Each lesson builds on the ones before it.

| Section | What you will learn |
| --- | --- |
| Getting Started | Installing Python, running programs, the REPL, VS Code, basic syntax |
| Python Basics | [Variables](/courses/python/variables), [data types](/courses/python/data-types), numbers, strings, input and output |
| Control Flow | Decisions with `if`, loops, and your first project |
| Data Structures | Lists, tuples, dictionaries and sets |
| Functions | Writing your own reusable instructions |
| Modules and Packages | Organizing code and installing libraries |
| Files and Errors | Reading files and handling problems gracefully |
| Object-Oriented Programming | Classes and objects |
| Intermediate Python | Generators, decorators, testing, async, and a capstone project |

Every lesson has small examples with their real output, a "Common mistakes" section where it helps, and a complete `main.py` program in the code panel that sums up the lesson.

## How to get the most out of this course

- **Type the code yourself.** Do not just copy and paste. Typing builds muscle memory and helps you notice details.
- **Change things and break things.** Change a number, remove a bracket, and see what happens. Error messages are teachers, not enemies.
- **Go in order.** Later lessons assume you know the earlier ones.
- **Take breaks.** Learning to program is like learning a musical instrument. Short, regular practice beats one long session.

## Common mistakes

These are mistakes in mindset rather than code, but they stop many beginners.

- **Thinking you must memorize everything.** Professional developers look things up all the time. The official [Python documentation](https://docs.python.org/3/) is free and very good.
- **Skipping the basics to "build an app".** Strong basics make every later topic easier.
- **Being scared of error messages.** An error message tells you what went wrong and usually on which line. Reading it carefully is a skill you will build in every lesson.

## Quick recap

- A program is a list of instructions; a programming language is how you write those instructions.
- Python is a free, open source, easy-to-read language created by Guido van Rossum.
- The Python interpreter reads and runs your code line by line.
- Python is used for web development, data, machine learning, automation and more.
- Always use Python 3. Python 2 is no longer supported.
- `print()` shows text on the screen.

Ready to start? In the next lesson you will get Python onto your computer: [Installing Python on Windows, macOS and Linux](/courses/python/installing-python).

<code id="code-content" class="language-python">
# main.py: a tiny taste of Python
# You do not need to understand every line yet.
# Each idea here gets its own lesson later in the course.
#
# print() shows text on the screen
print("Hello, world!")
print("Welcome to the Python course.")
#
# A variable is a name that holds a value
language = "Python"
year_released = 1991
print(language, "was first released in", year_released)
#
# A list holds several values in order
prices = [4.50, 2.25, 3.00]
# sum() adds them up and len() counts them
total = sum(prices)
print("Items:", len(prices))
print("Total:", total)
#
# if makes a decision; the indented line runs only when the test is true
if total &gt; 5:
    print("That is more than 5.")
#
# A for loop repeats code for each item
for reason in ["easy to read", "free", "used everywhere"]:
    print("Python is", reason)
</code></pre>

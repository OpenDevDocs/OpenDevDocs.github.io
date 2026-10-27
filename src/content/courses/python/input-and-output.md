---
publishDate: 2026-10-27T08:14
title: 'Getting Input and Printing Output'
slug: input-and-output
metadescription: 'Make interactive Python programs: read what the user types with input(), convert it to numbers, and control print() output with sep, end and escape characters.'
updateDate: 2026-10-27T08:14
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'input', 'print']
course: python
---

## Talking with your program

So far your programs have been a one-way conversation. They print things, but they never listen. In this lesson you will make them interactive: the program asks a question, the user types an answer, and the program responds.

Two built-in functions do this work:

- **`print()`** sends text **out** to the screen. This is called **output**.
- **`input()`** takes text **in** from the keyboard. This is called **input**.

Think of a cashier at a shop. They ask "How many?" (output), you answer "Three" (input), and they tell you the price (output again). Almost every program follows this pattern: take something in, do some work, send something out.

You have used `print()` since [Writing and Running Your First Python Program](/courses/python/first-python-program). Now you will learn its extra powers, and then meet `input()`.

## More about `print()`

### Printing several values at once

You can give `print()` several values separated by commas. It prints them all on one line with a space between each one. They do not even need to be the same type.

```python
print("Hello", "world", 42, True)
print()
print("After an empty line")
```

Output:

```text
Hello world 42 True

After an empty line
```

An empty `print()` just prints a blank line, which is handy for spacing out your output.

### Changing the separator with `sep`

The space between values is called the **separator**. You can change it with the `sep` option. An option you pass by name like this is called a **keyword argument** (you will learn more in [Function Arguments](/courses/python/function-arguments)).

```python
print("2026", "10", "27", sep="-")
print("a", "b", "c", sep="")
print("apples", "pears", "plums", sep=", ")
```

Output:

```text
2026-10-27
abc
apples, pears, plums
```

### Changing the ending with `end`

Normally `print()` moves to a new line when it finishes. That is because it adds an invisible newline character at the end. You can replace it with something else using `end`:

```python
print("Loading", end="")
print("...", end="")
print(" done!")
print("one", end=" | ")
print("two")
```

Output:

```text
Loading... done!
one | two
```

The first three `print()` calls end up on the same line, because the first two did not move to a new line.

### Special characters inside strings

Some characters are hard to type inside a string, so Python uses **escape sequences**: a backslash `\` followed by a letter. You met a few in [Strings: Working with Text](/courses/python/strings).

```python
print("Line one\nLine two")
print("Name:\tMaya")
print("She said \"hi\"")
print("C:\\Users\\maya")
```

Output:

```text
Line one
Line two
Name:	Maya
She said "hi"
C:\Users\maya
```

| Escape | Meaning |
| --- | --- |
| `\n` | new line |
| `\t` | tab (a wide space, good for columns) |
| `\"` or `\'` | a quote that does not end the string |
| `\\` | one real backslash |

## Reading input with `input()`

`input()` pauses your program and waits for the user to type something and press **Enter**. Whatever they typed is given back to you as a string. You can pass a message, called a **prompt**, that is shown first.

```python
name = input("What is your name? ")
print(f"Nice to meet you, {name}!")
```

When you run it, the terminal looks like this (the user typed `Maya` and pressed Enter):

```text
What is your name? Maya
Nice to meet you, Maya!
```

> **Tip:** End your prompt with a space, like `"What is your name? "`. Otherwise the user's typing sticks right onto the question mark.

Here is what happens step by step:

1. Python prints the prompt `What is your name? `.
2. The program stops and waits.
3. The user types `Maya` and presses Enter.
4. `input()` gives back the string `"Maya"`, which is stored in `name`.
5. The program continues with the next line.

## Input is always text

This is the single most important fact about `input()`: **it always returns a string**, even when the user types a number.

```python
age = input("How old are you? ")
print(type(age))
```

Output (the user typed `12`):

```text
How old are you? 12
<class 'str'>
```

So if you try to do math with it, things go wrong:

```python
age = input("How old are you? ")
print(age + 1)
```

Output (the user typed `12`):

```text
How old are you? 12
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(age + 1)
          ~~~~^~~
TypeError: can only concatenate str (not "int") to str
```

The fix is to convert the text into a number, exactly as you learned in [Converting Between Types](/courses/python/type-conversion). You can wrap `input()` directly inside `int()`:

```python
age = int(input("How old are you? "))
print(f"Next year you will be {age + 1}.")
```

Output (the user typed `12`):

```text
How old are you? 12
Next year you will be 13.
```

Python works from the inside out: first `input()` gets the text `"12"`, then `int()` turns it into the number `12`.

## A tiny calculator

Let's put input, conversion and output together. This program asks for a price and a quantity, then prints the total.

```python
price = float(input("Price of one item: "))
qty = int(input("How many? "))
print(f"Total: {price * qty:.2f}")
```

Output (the user typed `4.5`, then `3`):

```text
Price of one item: 4.5
How many? 3
Total: 13.50
```

Notice the choice of types: a price can have decimals, so it uses `float()`. You cannot buy half an item, so the quantity uses `int()`. The `:.2f` formatting comes from [f-strings and String Formatting](/courses/python/f-strings).

## Cleaning up what the user types

Users are messy. They add spaces by accident, use capital letters randomly, or type two things on one line. String methods from [Useful String Methods](/courses/python/string-methods) help a lot here.

### Removing extra spaces

Chain `.strip()` onto `input()` to remove spaces from both ends:

```python
name = input("Name: ").strip()
print(f"[{name}]")
```

Output (the user typed `  Maya  ` with spaces around it):

```text
Name:   Maya  
[Maya]
```

The square brackets show that the spaces are gone. A similar trick is `.lower()`, so that `YES`, `Yes` and `yes` can all be treated the same.

### Two values on one line

`.split()` breaks text into pieces wherever there is a space. You can then store each piece in its own variable:

```python
a, b = input("Two numbers: ").split()
print(int(a) + int(b))
```

Output (the user typed `3 4`):

```text
Two numbers: 3 4
7
```

This "store several values at once" trick is called **unpacking**. You will learn it properly in [Tuples and Unpacking](/courses/python/tuples-and-unpacking).

## Common mistakes

### Doing math on the raw input

You saw this one above: `input()` gives a string, so `age + 1` raises a `TypeError`. Fix: convert first with `int()` or `float()`.

### The user types something that is not a number

```python
age = int(input("How old are you? "))
```

Output (the user typed `twelve`):

```text
How old are you? twelve
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    age = int(input("How old are you? "))
ValueError: invalid literal for int() with base 10: 'twelve'
```

Your code is correct, but the user's answer is not a number. You cannot control what people type, so real programs check the input and ask again. You will learn how to keep asking with [Repeating Code with while Loops](/courses/python/while-loops), and how to catch the error with [Handling Errors with try and except](/courses/python/exceptions).

### Forgetting to store the answer

```python
input("What is your name? ")
print(f"Hello, {name}")
```

This crashes with `NameError: name 'name' is not defined`. The user typed an answer, but you never saved it in a variable, so it was thrown away. Fix: `name = input("What is your name? ")`.

### The program seems frozen

If your program stops and nothing happens, it is probably waiting at an `input()` with no prompt. Type something and press Enter. Always give `input()` a clear prompt so users know they need to type.

## Quick recap

- `print()` shows values. Separate several values with commas.
- `sep` changes what goes between values, `end` changes what goes at the end.
- Escape sequences like `\n`, `\t` and `\\` add special characters.
- `input("prompt ")` waits for the user and returns what they typed.
- `input()` **always returns a string**. Convert with `int()` or `float()` for math.
- Clean answers with `.strip()`, `.lower()` and `.split()`.

Now that your programs can listen, it is time to make them choose what to do. Continue with [Making Decisions with if, elif and else](/courses/python/if-elif-else).

<code id="code-content" class="language-python">
# main.py: a friendly trip cost calculator
# Run it and answer the questions in the terminal.
#
print("=" * 30)
print("Trip Cost Calculator")
print("=" * 30)
#
# input() always returns text, so .strip() removes stray spaces
name = input("What is your name? ").strip()
#
# Convert the text answers into numbers before doing math
distance = float(input("Distance in km: "))
efficiency = float(input("Car uses how many liters per 100 km? "))
price = float(input("Fuel price per liter: "))
people = int(input("How many people share the cost? "))
#
liters = distance * efficiency / 100
cost = liters * price
per_person = cost / people
#
print()
print(f"Thanks, {name}! Here is your trip:")
# sep and end change how print() joins and finishes lines
print("Distance", f"{distance:.1f} km", sep=": ")
print("Fuel needed", f"{liters:.2f} L", sep=": ")
print("Total cost", end=": ")
print(f"{cost:.2f}")
print("Each person pays", f"{per_person:.2f}", sep=": ")
print("\nHave a safe trip!")
</code></pre>

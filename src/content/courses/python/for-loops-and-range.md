---
publishDate: 2026-10-27T08:18
title: 'for Loops and range()'
slug: for-loops-and-range
metadescription: 'Loop over strings, lists and number ranges with Python for loops. Learn range() with start, stop and step, add up totals, nest loops and avoid common errors.'
updateDate: 2026-10-27T08:18
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'loops', 'range']
course: python
---

## One at a time, for each item

In [Repeating Code with while Loops](/courses/python/while-loops) you learned to repeat code while a condition is true. That is perfect when you do not know how many repeats you need. But very often you **do** know: you want to do something once for each letter in a word, each name in a list, or each number from 1 to 10.

For this, Python has the **`for` loop**. It walks through a group of items and runs its body once for each one, handing you the current item every time.

Think of a teacher handing back exam papers. They pick up the stack and, **for each** paper, call out the name and hand it over. When the stack is empty, they stop. Nobody needs to count anything or check a condition. The stack itself decides how many times it happens.

## Your first for loop

```python
fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
    print(f"I like {fruit}")
print("That is all.")
```

Output:

```text
I like apple
I like banana
I like cherry
That is all.
```

`fruits` is a **list**, a group of values in square brackets. You will study lists in [Lists: Ordered Collections](/courses/python/lists), but you can already loop over them.

Here are the parts:

- `for` starts the loop.
- `fruit` is the **loop variable**. Each time around, Python puts the next item into it. You choose the name.
- `in fruits` says what to loop over.
- The colon and the indented **body**, just like `if` and `while`.

On the first iteration `fruit` is `"apple"`, then `"banana"`, then `"cherry"`. After the last item the loop ends by itself. There is no counter to update, so you cannot accidentally create an infinite loop.

> **Tip:** Name the loop variable as the singular of the group: `for fruit in fruits`, `for name in names`, `for price in prices`. It makes the code read like English.

## Looping over a string

Anything you can step through one piece at a time is called an **iterable**. Lists are iterables, and so are strings. Looping over a string gives you one character at a time:

```python
for letter in "Python":
    print(letter)
```

Output:

```text
P
y
t
h
o
n
```

## Counting with `range()`

What if you just want to repeat something a number of times, or loop over numbers? The built-in `range()` function creates a sequence of whole numbers for you.

```python
for i in range(5):
    print(i)
```

Output:

```text
0
1
2
3
4
```

Two surprises for beginners:

- It **starts at 0**, not 1.
- It **stops before** the number you give. `range(5)` gives five numbers, 0 to 4, but never 5.

Python counts from 0 in many places, as you saw with string indexes in [Strings: Working with Text](/courses/python/strings). The "stop before" rule means `range(5)` always gives exactly 5 numbers, which is handy.

### Choosing a start

Give `range()` two numbers to choose where it starts. The second number is still the "stop before" value:

```python
for n in range(1, 6):
    print(n, end=" ")
print()
```

Output:

```text
1 2 3 4 5 
```

(The `end=" "` trick from [Getting Input and Printing Output](/courses/python/input-and-output) keeps everything on one line.)

### Choosing a step

A third number sets the **step**: how much to jump each time. A negative step counts backwards.

```python
for n in range(0, 21, 5):
    print(n, end=" ")
print()
for n in range(10, 0, -2):
    print(n, end=" ")
print()
```

Output:

```text
0 5 10 15 20 
10 8 6 4 2 
```

### range() cheat sheet

| Call | Numbers you get | Meaning |
| --- | --- | --- |
| `range(5)` | 0, 1, 2, 3, 4 | from 0, stop before 5 |
| `range(1, 6)` | 1, 2, 3, 4, 5 | from 1, stop before 6 |
| `range(0, 21, 5)` | 0, 5, 10, 15, 20 | jump by 5 |
| `range(10, 0, -2)` | 10, 8, 6, 4, 2 | count down by 2 |
| `range(5, 1)` | (nothing) | start is already past stop |

### Seeing what is inside a range

If you print a range, you do not see the numbers. A range is lazy: it creates numbers only when asked, which saves memory. Wrap it in `list()` to see them all:

```python
print(range(5))
print(list(range(5)))
print(list(range(2, 9, 3)))
print(list(range(5, 1)))
```

Output:

```text
range(0, 5)
[0, 1, 2, 3, 4]
[2, 5, 8]
[]
```

## Repeating something a set number of times

Sometimes you do not care about the number, you just want to repeat. By convention, Python programmers name the loop variable `_` (an underscore) to say "I am not going to use this":

```python
for _ in range(3):
    print("Hip hip hooray!")
```

Output:

```text
Hip hip hooray!
Hip hip hooray!
Hip hip hooray!
```

## Useful loop patterns

### Adding things up

To build a total, start a variable at 0 before the loop and add to it inside. This variable is often called an **accumulator**.

```python
total = 0
for n in range(1, 101):
    total += n
print(total)
```

Output:

```text
5050
```

That is every number from 1 to 100 added together, in three lines. The same pattern works for a list of prices:

```python
prices = [4.5, 12.0, 3.25]
total = 0
for price in prices:
    total += price
print(f"Total: {total:.2f}")
print(sum(prices))
```

Output:

```text
Total: 19.75
19.75
```

The built-in `sum()` does the same job in one step, but it is good to know how it works inside.

### Counting matches

Combine a loop with an `if` from [Making Decisions with if, elif and else](/courses/python/if-elif-else) to count things:

```python
word = "banana"
count = 0
for letter in word:
    if letter == "a":
        count += 1
print(f"'a' appears {count} times")
```

Output:

```text
'a' appears 3 times
```

### Multiplication table

```python
number = 7
for i in range(1, 6):
    print(f"{number} x {i} = {number * i}")
```

Output:

```text
7 x 1 = 7
7 x 2 = 14
7 x 3 = 21
7 x 4 = 28
7 x 5 = 35
```

## Loops inside loops

A loop body can contain another loop. This is a **nested loop**. The inner loop runs completely for every single iteration of the outer loop, like the minute hand going all the way around for each tick of the hour hand.

```python
for row in range(1, 4):
    for col in range(1, 4):
        print(row * col, end="\t")
    print()
```

Output:

```text
1	2	3	
2	4	6	
3	6	9	
```

The outer loop picks a row. The inner loop prints three numbers across that row, separated by tabs. Then the empty `print()` moves to the next line.

## Getting the position as well

Sometimes you need both the item and its position. You may see code that loops over `range(len(...))`, where `len()` gives the number of items:

```python
names = ["Ana", "Ben", "Cai"]
for i in range(len(names)):
    print(i, names[i])
```

Output:

```text
0 Ana
1 Ben
2 Cai
```

It works, but Python has a nicer tool called `enumerate()` that hands you both at once:

```python
names = ["Ana", "Ben", "Cai"]
for position, name in enumerate(names, start=1):
    print(f"{position}. {name}")
```

Output:

```text
1. Ana
2. Ben
3. Cai
```

You will learn more helpers like this in [enumerate, zip and Other Loop Helpers](/courses/python/enumerate-zip-and-loop-helpers).

## for or while?

| Use `for` when... | Use `while` when... |
| --- | --- |
| you loop over items in a list, string or range | you repeat until something happens |
| you know how many times to repeat | you do not know how many times |
| example: print every name | example: ask until the password is right |

## Common mistakes

### Looping over a plain number

```python
for i in 5:
    print(i)
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    for i in 5:
             ^
TypeError: 'int' object is not iterable
```

A single number is not a group of items, so Python cannot step through it. "Not iterable" means "I cannot loop over this". Fix: `for i in range(5):`.

### Giving range() a decimal

```python
for i in range(2.5):
    print(i)
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    for i in range(2.5):
             ~~~~~^^^^^
TypeError: 'float' object cannot be interpreted as an integer
```

`range()` only works with whole numbers. This often happens after a `/` division, which always gives a float. Fix: use `//` or wrap the value in `int()`.

### Expecting range to include the end

`range(1, 10)` stops at 9. If you want 1 to 10, write `range(1, 11)`. This is the most common off-by-one error with `for` loops.

### Changing the loop variable to change the list

```python
numbers = [1, 2, 3]
for n in numbers:
    n = n * 10
print(numbers)
```

Output:

```text
[1, 2, 3]
```

`n` is just a copy of each value. Changing it does not change the list. You will learn the right ways to build or change lists in [List Methods, Slicing and Sorting](/courses/python/list-methods-and-slicing) and [List, Dict and Set Comprehensions](/courses/python/comprehensions).

## Quick recap

- `for item in group:` runs the body once for every item in the group.
- Strings, lists and ranges are all **iterables** you can loop over.
- `range(stop)`, `range(start, stop)` and `range(start, stop, step)` make sequences of whole numbers.
- `range()` starts at 0 by default and stops **before** the stop value.
- Use `_` as the loop variable when you do not need it.
- Accumulators (`total += ...`) and counters are the most common loop patterns.
- `enumerate()` gives you the position and the item together.

Next, you will learn to stop a loop early, skip items and more in [break, continue, pass and Loop else](/courses/python/break-continue-pass).

<code id="code-content" class="language-python">
# main.py: a class report built with for loops and range()
#
students = ["Ana", "Ben", "Cai", "Dev"]
scores = [88, 72, 95, 64]
#
# Loop over a list directly
print("Students:")
for student in students:
    print(f"- {student}")
#
# Loop with a position using range(len(...))
print("\nScores:")
total = 0
for i in range(len(students)):
    print(f"{students[i]:&lt;5}{scores[i]:&gt;4}")
    total += scores[i]
#
average = total / len(scores)
print(f"Class average: {average:.1f}")
#
# Count how many passed (score of 70 or more)
passed = 0
for score in scores:
    if score &gt;= 70:
        passed += 1
print(f"{passed} of {len(scores)} students passed")
#
# Loop over a string
initials = ""
for student in students:
    initials += student[0]
print(f"Initials: {initials}")
#
# range with a step: count down in fives
for seconds in range(15, 0, -5):
    print(f"{seconds} seconds left", end=" ... ")
print("time is up!")
#
# Nested loops: a small multiplication grid
for row in range(1, 4):
    for col in range(1, 4):
        print(f"{row * col:&gt;3}", end="")
    print()
</code></pre>

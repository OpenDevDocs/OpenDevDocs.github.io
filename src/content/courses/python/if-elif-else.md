---
publishDate: 2026-10-27T08:15
title: 'Making Decisions with if, elif and else'
slug: if-elif-else
metadescription: 'Teach your Python programs to make choices with if, elif and else: run code only when a condition is true, handle several cases and nest decisions cleanly.'
updateDate: 2026-10-27T08:15
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'control-flow', 'conditions']
course: python
---

## Programs that choose

Up to now, your programs ran every line from top to bottom, one after another, no matter what. Real programs need to make choices. If the password is wrong, show an error. If the cart is empty, hide the checkout button. If the player has no lives left, end the game.

You make choices like this every day. "**If** it is raining, take an umbrella. **Otherwise**, wear sunglasses." Python lets you write exactly that, using the keywords `if`, `elif` and `else`.

The order in which lines of code run is called **control flow**. Decisions are the first control flow tool you will learn. Loops come next, in [Repeating Code with while Loops](/courses/python/while-loops).

## The `if` statement

An `if` statement runs a block of code only when a **condition** is true. A condition is any expression that gives `True` or `False`, usually a comparison like the ones from [Booleans, Comparisons and None](/courses/python/booleans-and-none).

```python
temperature = 32
if temperature > 30:
    print("It is hot today.")
    print("Drink some water.")
print("Have a nice day!")
```

Output:

```text
It is hot today.
Drink some water.
Have a nice day!
```

Now change the temperature to `18` and run it again:

```python
temperature = 18
if temperature > 30:
    print("It is hot today.")
    print("Drink some water.")
print("Have a nice day!")
```

Output:

```text
Have a nice day!
```

The two indented lines were skipped, because `18 > 30` is `False`. The last line always runs because it is not part of the `if`.

### The shape of an `if`

Look carefully at the pieces:

1. The keyword `if`.
2. A condition: `temperature > 30`.
3. A **colon** `:` at the end of the line.
4. An **indented block**: one or more lines pushed in by 4 spaces.

The indented lines are the **body** of the `if`. Python knows which lines belong to it purely from the indentation, as you learned in [Python Syntax: Comments, Indentation and Statements](/courses/python/syntax-comments-indentation). When the indentation goes back to the left, the `if` is over.

> **Tip:** Use 4 spaces for each level of indentation. Editors like VS Code do this for you when you press Tab (see [Setting Up VS Code for Python](/courses/python/setting-up-vs-code)).

## Adding `else`

Often you want to do one thing if the condition is true, and something **else** if it is false. That is what `else` is for.

```python
age = 15
if age >= 18:
    print("You can vote.")
else:
    print("You cannot vote yet.")
    print(f"Wait {18 - age} more years.")
```

Output:

```text
You cannot vote yet.
Wait 3 more years.
```

Exactly one of the two blocks runs, never both and never neither. Like a fork in the road: you must take one path. Note that `else` has no condition of its own. It simply catches "everything else".

## Many choices with `elif`

What if there are more than two possibilities? A school grade can be A, B, C, D or F. For this, use `elif`, short for "else if".

```python
score = 72
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
elif score >= 60:
    grade = "D"
else:
    grade = "F"
print(f"Score {score} gets grade {grade}")
```

Output:

```text
Score 72 gets grade C
```

Python checks the conditions **from top to bottom** and stops at the **first** one that is true:

1. Is `72 >= 90`? No, move on.
2. Is `72 >= 80`? No, move on.
3. Is `72 >= 70`? Yes! Set the grade to `"C"` and skip everything else in the chain.

You can have as many `elif` parts as you like. The `else` at the end is optional. If there is no `else` and nothing matches, nothing runs.

### Order matters

Because Python stops at the first true condition, the order of your checks is important. Look what happens if you put the low grade first:

```python
score = 95
if score >= 60:
    grade = "D"
elif score >= 90:
    grade = "A"
print(grade)
```

Output:

```text
D
```

A score of 95 deserves an A, but `95 >= 60` was checked first and it is true, so the chain stopped there. Rule of thumb: when ranges overlap, check the strictest condition first.

### `elif` versus several `if` statements

An `if`/`elif` chain picks **at most one** branch. Separate `if` statements are all checked, one by one:

```python
score = 95
if score >= 90:
    print("A")
if score >= 80:
    print("B")
```

Output:

```text
A
B
```

Both conditions are true, so both lines print. Use `elif` when the choices are alternatives (only one should win). Use separate `if` statements when the checks are independent.

## Decisions inside decisions

You can put an `if` inside another `if`. This is called **nesting**.

```python
has_ticket = True
age = 10
if has_ticket:
    if age >= 12:
        print("Enjoy the movie!")
    else:
        print("You need an adult with you.")
else:
    print("Please buy a ticket first.")
```

Output:

```text
You need an adult with you.
```

Each level of nesting adds 4 more spaces. Nesting is fine for one or two levels, but deeper nesting gets hard to read. In [Logical Operators: and, or, not](/courses/python/logical-operators) you will learn to combine conditions so you need less nesting.

## Using truthy values as conditions

A condition does not have to be a comparison. Any value works, using the truthy and falsy rules. An empty string is falsy, so this is a neat way to check if the user typed anything:

```python
name = ""
if name:
    print(f"Hello, {name}!")
else:
    print("You did not enter a name.")
```

Output:

```text
You did not enter a name.
```

`if name:` reads as "if there is a name". It is shorter than `if name != "":` and it is the usual Python style.

## A one-line choice

When you just need to pick between two values, Python has a short form called a **conditional expression** (some people call it the ternary operator):

```python
age = 20
status = "adult" if age >= 18 else "minor"
print(status)
```

Output:

```text
adult
```

Read it as "status is `"adult"` if age is at least 18, else `"minor"`". Use it only for simple choices. For anything longer, a normal `if`/`else` is clearer.

## Putting it together with input

Here is a program that reacts to what the user types. It uses `input()` from [Getting Input and Printing Output](/courses/python/input-and-output) and the `%` (remainder) operator from [Numbers and Math Operators](/courses/python/numbers-and-math). A number is even when dividing by 2 leaves no remainder.

```python
number = int(input("Enter a whole number: "))
if number % 2 == 0:
    print(f"{number} is even.")
else:
    print(f"{number} is odd.")
```

Output (the user typed `7`):

```text
Enter a whole number: 7
7 is odd.
```

## Common mistakes

### Forgetting the colon

```text
x = 5
if x > 3
    print("big")
```

Output:

```text
  File "main.py", line 2
    if x > 3
            ^
SyntaxError: expected ':'
```

Every `if`, `elif` and `else` line must end with a colon. Fix: `if x > 3:`.

### Forgetting to indent

```text
x = 5
if x > 3:
print("big")
```

Output:

```text
  File "main.py", line 3
    print("big")
    ^^^^^
IndentationError: expected an indented block after 'if' statement on line 2
```

Python needs at least one indented line after the colon. Fix: indent `print("big")` by 4 spaces.

### An `else` that is cut off from its `if`

```text
x = 5
if x > 3:
    print("big")
print("between")
else:
    print("small")
```

Output:

```text
  File "main.py", line 5
    else:
    ^^^^
SyntaxError: invalid syntax
```

The unindented `print("between")` ended the `if`, so the `else` has nothing to belong to. Fix: keep `else` directly after the `if` block, at the same indentation as `if`.

### Using `=` instead of `==`

`if x = 5:` is a `SyntaxError`. One `=` stores a value, two `==` compare. Python's error message even suggests `==` for you.

## Quick recap

- `if condition:` runs its indented block only when the condition is true.
- `else:` runs when the `if` condition (and every `elif`) was false.
- `elif condition:` adds more choices. Python takes the **first** true branch and skips the rest.
- Order your `elif` checks from strictest to loosest.
- Every `if`, `elif` and `else` line ends with `:`, and its body is indented.
- `value_a if condition else value_b` picks a value in one line.

Next, you will combine several conditions into one with [Logical Operators: and, or, not](/courses/python/logical-operators).

<code id="code-content" class="language-python">
# main.py: a simple weather advisor using if, elif and else
#
temperature = int(input("Temperature in Celsius: "))
raining = input("Is it raining? (yes/no) ").strip().lower()
#
# An if/elif/else chain: only the first true branch runs
if temperature &gt;= 35:
    advice = "Stay indoors, it is very hot."
elif temperature &gt;= 25:
    advice = "Wear light clothes and drink water."
elif temperature &gt;= 15:
    advice = "A t-shirt and a light jacket are perfect."
elif temperature &gt;= 5:
    advice = "Wear a warm coat."
else:
    advice = "Bundle up, it is freezing!"
print(advice)
#
# A separate, independent decision
if raining == "yes":
    print("Take an umbrella.")
else:
    print("No umbrella needed.")
#
# A nested decision
if temperature &lt; 0:
    if raining == "yes":
        print("Careful, the rain may turn to ice.")
#
# A one-line conditional expression
feeling = "warm" if temperature &gt;= 20 else "cool"
print(f"Overall it feels {feeling} today.")
</code></pre>

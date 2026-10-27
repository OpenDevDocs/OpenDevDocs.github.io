---
publishDate: 2026-10-27T08:19
title: 'break, continue, pass and Loop else'
slug: break-continue-pass
metadescription: 'Control Python loops precisely: stop early with break, skip an item with continue, leave a placeholder with pass, and use the little-known else clause on loops.'
updateDate: 2026-10-27T08:19
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'loops', 'control-flow']
course: python
---

## Taking control of your loops

Normally a loop runs from start to finish: a [for loop](/courses/python/for-loops-and-range) visits every item, and a [while loop](/courses/python/while-loops) keeps going until its condition is false. But sometimes you want more control:

- You found what you were looking for, so **stop** the loop now.
- This item is not interesting, so **skip** it and move to the next one.
- You need a block here, but you have **nothing to put in it yet**.
- You want to do something special **only if the loop finished without stopping early**.

Python gives you four small tools for this: `break`, `continue`, `pass`, and an `else` clause on loops. Each one is just a single word, but together they make your loops much more flexible.

Think of reading a stack of letters. You might stop when you find the one from your bank (`break`), throw junk mail aside without reading it (`continue`), or, if you got through the whole stack and the bank letter was not there, phone the bank (`else`).

## `break`: stop the loop right now

`break` exits the loop immediately. Any remaining items are skipped, and Python continues with the first line after the loop.

```python
numbers = [4, 7, -2, 9, 3]
for n in numbers:
    if n < 0:
        print(f"Found a negative number: {n}")
        break
    print(f"Checking {n}")
print("Search finished.")
```

Output:

```text
Checking 4
Checking 7
Found a negative number: -2
Search finished.
```

The loop never checked `9` or `3`. Once the answer was found, there was no point in continuing. This saves time, especially with long lists.

`break` is almost always inside an `if`. A `break` with no condition would stop the loop on the very first iteration.

### `break` with `while True`

You saw this pattern in the while loops lesson. A `while True:` loop would run forever, so `break` is the only way out:

```python
total = 0
while True:
    n = int(input("Number (-1 to stop): "))
    if n == -1:
        break
    total += n
print(f"Total: {total}")
```

Output (the user typed `5`, `12`, then `-1`):

```text
Number (-1 to stop): 5
Number (-1 to stop): 12
Number (-1 to stop): -1
Total: 17
```

## `continue`: skip to the next item

`continue` stops the **current iteration** only. Python jumps straight back to the top of the loop and moves on to the next item. The loop itself keeps going.

```python
for n in range(1, 11):
    if n % 3 == 0:
        continue
    print(n, end=" ")
print()
```

Output:

```text
1 2 4 5 7 8 10 
```

Every multiple of 3 (where the remainder `n % 3` is 0) was skipped. The `print()` below the `continue` never ran for those numbers.

`continue` is handy for ignoring bad or empty data. Here empty and whitespace-only words are skipped (`.strip()` comes from [Useful String Methods](/courses/python/string-methods), and an empty string is falsy, as you learned in [Booleans, Comparisons and None](/courses/python/booleans-and-none)):

```python
words = ["apple", "", "banana", "  ", "cherry"]
for word in words:
    if not word.strip():
        continue
    print(word.upper())
```

Output:

```text
APPLE
BANANA
CHERRY
```

> **Tip:** Using `continue` early in the loop body to skip unwanted items is sometimes called a **guard clause**. It keeps the main work of the loop at a single indentation level instead of nesting it deep inside an `if`.

### `break` versus `continue`

| Keyword | What it does | Analogy |
| --- | --- | --- |
| `break` | leaves the whole loop | walking out of the cinema |
| `continue` | skips the rest of this iteration only | skipping one song on a playlist |

## `pass`: do nothing, on purpose

Python requires every `if`, `for`, `while` and `def` to have at least one indented line in its body. But sometimes you do not know what to write yet. `pass` is a statement that does absolutely nothing. It is a **placeholder** that keeps Python happy.

```python
temperature = 25
if temperature > 30:
    pass  # TODO: warn about heat
else:
    print("Temperature is fine.")
```

Output:

```text
Temperature is fine.
```

Without `pass`, the empty `if` body would be an `IndentationError`. With it, the program runs and you can fill in the real code later.

> **Note:** `pass` and `continue` are easy to confuse. `pass` does nothing and the code after it in the same block still runs. `continue` jumps to the next iteration and skips the rest of the body.

You will also see `pass` in empty functions and classes while code is being sketched out, for example in [Defining and Calling Functions](/courses/python/functions) and [Classes and Objects](/courses/python/classes-and-objects).

## Loop `else`: "finished without a break"

This feature surprises even experienced programmers. Both `for` and `while` loops can have an `else` block. It runs **only if the loop ended normally**, meaning it was not stopped by `break`.

The classic use is searching. If you find the item, you `break`. If the loop finishes and you never broke out, the item was not there, and the `else` handles that case.

```python
names = ["Ana", "Ben", "Cai"]
target = "Zoe"
for name in names:
    if name == target:
        print(f"Found {target}!")
        break
else:
    print(f"{target} is not here.")
```

Output:

```text
Zoe is not here.
```

Change `target` to `"Ben"` and the output becomes:

```text
Found Ben!
```

The `break` ran, so the `else` was skipped.

Look closely at the indentation: the `else` lines up with `for`, not with `if`. It belongs to the loop.

> **Tip:** A good way to read loop `else` is "**no break**". If no `break` happened, run this block.

### Checking for a prime number

A **prime number** can only be divided evenly by 1 and itself. To test a number, try every possible divider. If one works, it is not prime and you can stop. If none work, the `else` declares it prime.

```python
n = 29
for d in range(2, n):
    if n % d == 0:
        print(f"{n} is not prime, it divides by {d}")
        break
else:
    print(f"{n} is prime")
```

Output:

```text
29 is prime
```

### `else` on a while loop

It works the same way with `while`. Here a card is blocked after three wrong PINs, but only if the user never got it right:

```python
attempts = 3
while attempts > 0:
    pin = input("PIN: ")
    if pin == "4321":
        print("Unlocked!")
        break
    attempts -= 1
    print(f"Wrong. {attempts} tries left.")
else:
    print("Card blocked.")
```

Output (the user typed three wrong PINs):

```text
PIN: 1111
Wrong. 2 tries left.
PIN: 2222
Wrong. 1 tries left.
PIN: 3333
Wrong. 0 tries left.
Card blocked.
```

## break in nested loops

`break` only leaves the loop it is directly inside. In nested loops, the outer loop keeps going:

```python
for row in range(1, 4):
    for col in range(1, 4):
        if col == 2:
            break
        print(f"row {row}, col {col}")
```

Output:

```text
row 1, col 1
row 2, col 1
row 3, col 1
```

The inner loop stops at column 2 each time, but the outer loop still visits all three rows. To leave both loops, a common trick is a **flag**: a boolean variable that remembers what happened.

```python
grid = [[1, 2, 3], [4, 99, 6], [7, 8, 9]]
found = False
for row in grid:
    for value in row:
        if value == 99:
            found = True
            break
    if found:
        break
print(f"Found 99: {found}")
```

Output:

```text
Found 99: True
```

(Later, in [Defining and Calling Functions](/courses/python/functions), you will see that putting the loops in a function and using `return` is often cleaner.)

## Common mistakes

### `break` outside a loop

```text
x = 5
if x > 3:
    break
```

Output:

```text
  File "main.py", line 3
    break
    ^^^^^
SyntaxError: 'break' outside loop
```

`break` and `continue` only work inside a loop. An `if` on its own is not a loop. Fix: remove the `break`, or put the code inside a `for` or `while`.

### Leaving a block empty

```text
for i in range(3):
print("x")
```

Output:

```text
  File "main.py", line 2
    print("x")
    ^^^^^
IndentationError: expected an indented block after 'for' statement on line 1
```

Every block needs at least one indented line. Fix: indent the body, or write `pass` if the body really should be empty for now.

### Indenting `else` under the `if` by mistake

If you indent the loop `else` to line up with `if` instead of `for`, it becomes an ordinary `if`/`else` and runs on every iteration. Check that the `else` is at the same level as `for` or `while`.

### Forgetting to update before `continue` in a while loop

In a `while` loop, if the line that changes your counter comes **after** a `continue`, the `continue` can skip it and you get an infinite loop. Update the counter before any `continue`, or use a `for` loop instead.

## Quick recap

- `break` exits the whole loop immediately.
- `continue` skips the rest of this iteration and moves to the next one.
- `pass` does nothing. It is a placeholder for an empty block.
- A loop's `else` block runs only when the loop finished **without** a `break`. Read it as "no break".
- `break` only leaves the innermost loop. Use a flag (or a function with `return`) to exit several.

Next, you will learn a powerful new way to make decisions in [Pattern Matching with match and case](/courses/python/match-case).

<code id="code-content" class="language-python">
# main.py: break, continue, pass and loop else in a tiny inventory search
#
inventory = ["apple", "", "bread", "SKIP", "cheese", "dates"]
#
# continue: skip empty or unwanted entries
print("Items in stock:")
for item in inventory:
    if not item or item == "SKIP":
        continue
    print(f"- {item}")
#
# break and loop else: search for an item
wanted = input("What are you looking for? ").strip().lower()
for position, item in enumerate(inventory, start=1):
    if item == wanted:
        print(f"Found {wanted} at shelf {position}.")
        break
else:
    # Runs only when the loop ended without break
    print(f"Sorry, no {wanted} today.")
#
# pass: a placeholder for code you will write later
def restock():
    pass
#
restock()
#
# while True with break: keep asking until the user types done
basket = 0
while True:
    answer = input("Add an item to the basket (or done): ").strip().lower()
    if answer == "done":
        break
    if not answer or answer == "skip" or answer not in inventory:
        print("We do not sell that.")
        continue
    basket += 1
    print(f"Added {answer}. Basket has {basket} item(s).")
print(f"Checkout: {basket} item(s). Thank you!")
</code></pre>

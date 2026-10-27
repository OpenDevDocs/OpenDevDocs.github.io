---
publishDate: 2026-10-27T08:17
title: 'Repeating Code with while Loops'
slug: while-loops
metadescription: 'Learn Python while loops: repeat code as long as a condition is true, count up and down, keep asking for valid input, and avoid accidental infinite loops.'
updateDate: 2026-10-27T08:17
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'loops', 'control-flow']
course: python
---

## Doing things again and again

Computers are great at boring, repetitive work. Printing a number five times, asking for a password until it is right, adding up a list of prices: these all mean running the same code more than once.

You could copy and paste the same line five times, but that is tiring, and what if you need it a thousand times? Or you do not know in advance how many times? That is what **loops** are for. A **loop** is a piece of code that repeats.

Python has two kinds of loop:

- The **`while` loop** repeats **as long as a condition is true**. You use it when you do not know how many repeats you need. This lesson is about `while`.
- The **`for` loop** repeats **once for each item** in a group. You will learn it in [for Loops and range()](/courses/python/for-loops-and-range).

A `while` loop is like a kid in a car asking "Are we there yet?" They keep asking while the answer is no. As soon as the answer is yes, they stop.

## Your first while loop

```python
count = 1
while count <= 5:
    print(f"Count is {count}")
    count = count + 1
print("Done!")
```

Output:

```text
Count is 1
Count is 2
Count is 3
Count is 4
Count is 5
Done!
```

The shape looks a lot like the `if` statement from [Making Decisions with if, elif and else](/courses/python/if-elif-else): the keyword `while`, a condition, a colon, and an indented block. The block is called the **body** of the loop.

The difference is what happens after the body runs. An `if` runs its body once and moves on. A `while` jumps **back to the top** and checks the condition again.

## How the loop runs, step by step

Let's trace the loop above. Each pass through the body is called an **iteration**.

| Check | `count` | `count <= 5`? | What happens |
| --- | --- | --- | --- |
| 1 | 1 | `True` | print, then count becomes 2 |
| 2 | 2 | `True` | print, then count becomes 3 |
| 3 | 3 | `True` | print, then count becomes 4 |
| 4 | 4 | `True` | print, then count becomes 5 |
| 5 | 5 | `True` | print, then count becomes 6 |
| 6 | 6 | `False` | leave the loop, print `Done!` |

Every `while` loop needs three things:

1. **A starting value** before the loop (`count = 1`).
2. **A condition** that is checked before every iteration (`count <= 5`).
3. **A change** inside the body that eventually makes the condition false (`count = count + 1`).

Forget the third one, and the loop never ends. More on that below.

## Shorter ways to update a variable

Writing `count = count + 1` is so common that Python has a shortcut: `count += 1`. These are called **augmented assignment** operators.

| Long form | Short form |
| --- | --- |
| `x = x + 1` | `x += 1` |
| `x = x - 1` | `x -= 1` |
| `x = x * 2` | `x *= 2` |
| `x = x // 10` | `x //= 10` |

Here is a countdown using `-=`:

```python
seconds = 3
while seconds > 0:
    print(seconds)
    seconds -= 1
print("Liftoff!")
```

Output:

```text
3
2
1
Liftoff!
```

## When the loop never runs

The condition is checked **before** the first iteration. If it is false right away, the body is skipped completely:

```python
count = 10
while count < 5:
    print("This never prints")
print("Loop skipped")
```

Output:

```text
Loop skipped
```

## Loops where you do not know the count

Counting to 5 is easier with a `for` loop. Where `while` really shines is when you have no idea how many repeats you need. How many weeks of saving until you have 200?

```python
balance = 100
weeks = 0
while balance < 200:
    balance += 15
    weeks += 1
print(f"After {weeks} weeks you have {balance}.")
```

Output:

```text
After 7 weeks you have 205.
```

The loop keeps adding 15 until the goal is reached. You did not need to work out the answer yourself. Here is another one: how many days does it take to pass 1000 if an amount doubles every day?

```python
amount = 1
days = 1
while amount < 1000:
    amount *= 2
    days += 1
print(f"Day {days}: {amount}")
```

Output:

```text
Day 11: 1024
```

## Asking until the answer is right

A very common use of `while` is to keep asking the user a question until they give a good answer. You learned `input()` in [Getting Input and Printing Output](/courses/python/input-and-output).

```python
password = ""
while password != "open sesame":
    password = input("Password: ")
print("Access granted.")
```

Output (the user typed `abc`, then `open sesame`):

```text
Password: abc
Password: open sesame
Access granted.
```

`password` starts as an empty string, so the condition is true and the loop runs at least once.

### Checking that input is a number

Remember how `int()` crashes on text like `"abc"`? A loop can keep asking until the input is valid. The string method `.isdigit()` returns `True` only when the text is made of digits.

```python
age = -1
while age < 0:
    text = input("Enter your age: ")
    if text.isdigit():
        age = int(text)
    else:
        print("Please type a whole number.")
print(f"Thanks! You are {age}.")
```

Output (the user typed `-5`, `abc`, pressed Enter, then typed `42`):

```text
Enter your age: -5
Please type a whole number.
Enter your age: abc
Please type a whole number.
Enter your age: 
Please type a whole number.
Enter your age: 42
Thanks! You are 42.
```

The starting value `-1` is a trick to make sure the loop runs at least once.

### Stopping with a special value

Another pattern is to keep going until the user enters a special "stop" value, often called a **sentinel**. Here an empty line means "I am finished":

```python
total = 0
count = 0
entry = input("Enter a number (blank to stop): ")
while entry != "":
    total += float(entry)
    count += 1
    entry = input("Enter a number (blank to stop): ")
print(f"You entered {count} numbers. Total: {total}")
```

Output (the user typed `10`, `20`, `5.5`, then pressed Enter on an empty line):

```text
Enter a number (blank to stop): 10
Enter a number (blank to stop): 20
Enter a number (blank to stop): 5.5
Enter a number (blank to stop): 
You entered 3 numbers. Total: 35.5
```

## `while True` and `break`

Sometimes it is easiest to write a loop that would run forever, and then jump out from the middle when you are ready. `while True:` loops forever, and the `break` keyword exits the loop immediately.

```python
while True:
    command = input("> ")
    if command == "quit":
        break
    print(f"You typed: {command}")
print("Goodbye!")
```

Output (the user typed `hi`, then `quit`):

```text
> hi
You typed: hi
> quit
Goodbye!
```

This pattern is popular for menus and games, because the exit check can sit anywhere in the body. You will learn `break` and its friends in detail in [break, continue, pass and Loop else](/courses/python/break-continue-pass).

## Common mistakes

### The infinite loop

An **infinite loop** is a loop that never stops because its condition never becomes false. The usual cause is forgetting to update the variable:

```python
count = 1
while count <= 5:
    print(count)
    # oops: count never changes, so count <= 5 is always True
```

This prints `1` over and over, forever. Do not panic! Press **Ctrl+C** in the terminal to stop the program. Python stops with a `KeyboardInterrupt` message. Fix: make sure something inside the loop moves you toward the end, here `count += 1`.

> **Warning:** An infinite loop does not damage anything, but it can fill your screen quickly and make your computer fan spin. Ctrl+C is your emergency brake. In VS Code, click in the terminal first so it receives the key press.

### Updating the variable in the wrong place

If the `count += 1` line is not indented, it is outside the loop. The loop body never changes `count`, so you get an infinite loop again. Check that every line you want repeated is indented under `while`.

### Off-by-one errors

`while count < 5` and `while count <= 5` differ by one iteration. Getting the edge wrong by one is so common it has a name: the **off-by-one error**. When a loop runs one time too many or too few, check `<` versus `<=` and your starting value. Tracing it in a small table, like the one earlier, helps a lot.

### Comparing input to a number

`while answer != 42:` will never stop if `answer` came from `input()`, because the string `"42"` is never equal to the number `42`. Convert first, as you learned in [Converting Between Types](/courses/python/type-conversion).

## Quick recap

- A `while` loop repeats its body as long as its condition is true.
- The condition is checked before every iteration, including the first.
- Every loop needs a start value, a condition and a change that moves toward the end.
- `x += 1` is short for `x = x + 1`.
- `while` is ideal when you do not know how many repeats you need, like checking input.
- `while True:` with `break` gives you a loop you can exit from anywhere.
- Stuck in an infinite loop? Press Ctrl+C.

When you know exactly what you want to loop over, there is an easier tool. Continue with [for Loops and range()](/courses/python/for-loops-and-range).

<code id="code-content" class="language-python">
# main.py: a savings goal planner using while loops
#
# Keep asking until the user types a positive whole number
goal = 0
while goal &lt;= 0:
    text = input("Savings goal (whole number): ").strip()
    if text.isdigit() and int(text) &gt; 0:
        goal = int(text)
    else:
        print("Please type a positive whole number.")
#
weekly = 0
while weekly &lt;= 0:
    text = input("How much can you save per week? ").strip()
    if text.isdigit() and int(text) &gt; 0:
        weekly = int(text)
    else:
        print("Please type a positive whole number.")
#
# We do not know how many weeks it takes, so while is a good fit
balance = 0
week = 0
while balance &lt; goal:
    week += 1
    balance += weekly
    print(f"Week {week:&gt;3}: saved {balance}")
#
print(f"You reach your goal of {goal} after {week} weeks!")
#
# A countdown with -=
countdown = 3
while countdown &gt; 0:
    print(countdown)
    countdown -= 1
print("Time to celebrate!")
</code></pre>

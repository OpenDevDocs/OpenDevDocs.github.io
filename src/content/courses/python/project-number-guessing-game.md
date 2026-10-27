---
publishDate: 2026-10-27T08:21
title: 'Project: Number Guessing Game'
slug: project-number-guessing-game
metadescription: 'Build a complete number guessing game in Python step by step with random numbers, loops, input checks, difficulty levels, a try limit and a play again option.'
updateDate: 2026-10-27T08:21
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'project', 'loops']
course: python
---

## What you will build

It is time to put everything from the last few lessons together into a real, playable game. The computer secretly picks a number, and you try to guess it. After each guess it tells you "Too high!" or "Too low!" until you find it or run out of tries.

Here is a taste of the finished game:

```text
==================================
   Welcome to the Guessing Game!
==================================
Choose a level (easy, medium, hard): medium

I am thinking of a number from 1 to 100.
You have 7 tries. Good luck!
Guess 1 of 7: 50
Too high!
Guess 2 of 7: 25
Too low!
Guess 3 of 7: 37
Too low!
Guess 4 of 7: forty
Please type a whole number.
Guess 4 of 7: 40
Too low!
Guess 5 of 7: 42
Correct! You found 42 in 5 tries.
That is a new best score!

Play again? (y/n)
```

You will build it in small steps, running the program after each one. That is how real programmers work: get a tiny version running, then improve it bit by bit.

Here is what each step uses, so you can jump back to a lesson if something feels unfamiliar:

| Feature | Lesson |
| --- | --- |
| Reading the player's guess | [Getting Input and Printing Output](/courses/python/input-and-output) |
| Turning text into a number | [Converting Between Types](/courses/python/type-conversion) |
| "Too high" and "Too low" | [Making Decisions with if, elif and else](/courses/python/if-elif-else) |
| Range checks like `1 <= guess <= 100` | [Booleans, Comparisons and None](/courses/python/booleans-and-none) |
| Guessing until correct | [Repeating Code with while Loops](/courses/python/while-loops) |
| Counting tries | [for Loops and range()](/courses/python/for-loops-and-range) |
| Skipping bad input, losing the game | [break, continue, pass and Loop else](/courses/python/break-continue-pass) |
| Difficulty levels | [Pattern Matching with match and case](/courses/python/match-case) |

Create a new file called `guessing_game.py` in your project folder and let's start.

## Step 1: pick a secret number

The computer needs to choose a number you cannot predict. Python's built-in `random` **module** can do this. A module is a file of ready-made code that you can borrow with `import`. You will learn all about them in [Modules and import](/courses/python/modules-and-imports).

`random.randint(1, 100)` gives a random whole number from 1 to 100. Unlike `range()`, **both ends are included**, so 100 is possible.

```python
import random

secret = random.randint(1, 100)
guess = int(input("Guess a number between 1 and 100: "))
if guess == secret:
    print("Wow, first try!")
else:
    print(f"Nope, it was {secret}.")
```

Run it. On Windows type `python guessing_game.py`, on macOS or Linux type `python3 guessing_game.py`. A run might look like this (your secret number will almost certainly be different):

```text
Guess a number between 1 and 100: 50
Nope, it was 42.
```

One guess out of a hundred is not much of a game. Let's fix that.

## Step 2: keep guessing with hints

We do not know how many guesses the player will need, so a `while` loop is the right choice. It keeps going while the guess is wrong. We also count the attempts with `attempts += 1`.

```python
import random

secret = random.randint(1, 100)
attempts = 0
guess = 0

while guess != secret:
    guess = int(input("Your guess: "))
    attempts += 1
    if guess < secret:
        print("Too low!")
    elif guess > secret:
        print("Too high!")

print(f"You got it in {attempts} tries!")
```

A sample game:

```text
Your guess: 50
Too high!
Your guess: 25
Too low!
Your guess: 37
Too low!
Your guess: 43
Too high!
Your guess: 40
Too low!
Your guess: 42
You got it in 6 tries!
```

Notice that `guess` starts at `0`. The secret is never 0, so the condition `guess != secret` is true the first time and the loop always runs at least once.

> **Tip:** The smartest strategy is to always guess the middle of the range that is left: 50, then 25 or 75, and so on. Each guess cuts the possibilities in half. With this trick you can always find a number from 1 to 100 in 7 guesses or fewer. Computer scientists call this a **binary search**.

This is already a playable game. But try typing `hello` as a guess, and the program crashes with a `ValueError`. Players type all sorts of things, so let's protect the game.

## Step 3: handle bad input

We want to keep asking until the player types a whole number in the right range. This is a perfect job for `while True` with `continue` and `break`. Try this small piece on its own first:

```python
while True:
    text = input("Your guess: ").strip()
    if not text.isdigit():
        print("Please type a whole number.")
        continue
    guess = int(text)
    if not 1 <= guess <= 100:
        print("Please stay between 1 and 100.")
        continue
    break

print(f"You guessed {guess}.")
```

Output (the player typed `abc`, `150`, `-3`, then `64`):

```text
Your guess: abc
Please type a whole number.
Your guess: 150
Please stay between 1 and 100.
Your guess: -3
Please type a whole number.
Your guess: 64
You guessed 64.
```

How it works:

1. `.strip()` removes stray spaces around the answer.
2. `.isdigit()` is `True` only if the text is made of digits. If not, `continue` jumps back to the top and asks again. (A minus sign is not a digit, so `-3` is rejected too, which is fine for this game.)
3. Now the text is safe to convert with `int()`.
4. The chained comparison `1 <= guess <= 100` checks the range. If it fails, ask again.
5. Only a good guess reaches `break`, which leaves the loop.

## Step 4: limit the number of tries

A game with unlimited tries cannot be lost. Let's give the player 7 tries. Now we **do** know the maximum number of repeats, so a `for` loop over `range(1, max_attempts + 1)` fits nicely. The loop variable `attempt` counts 1, 2, 3 and so on for free.

We also use the loop `else` from [break, continue, pass and Loop else](/courses/python/break-continue-pass). If the player guesses correctly, we `break` out of the loop. If the loop runs out of tries without a `break`, the `else` block announces the loss.

```python
import random

secret = random.randint(1, 100)
max_attempts = 7

for attempt in range(1, max_attempts + 1):
    # Ask until the guess is a valid number
    while True:
        text = input(f"Guess {attempt} of {max_attempts}: ").strip()
        if not text.isdigit():
            print("Please type a whole number.")
            continue
        guess = int(text)
        if not 1 <= guess <= 100:
            print("Please stay between 1 and 100.")
            continue
        break

    if guess == secret:
        print(f"Correct! You found it in {attempt} tries.")
        break
    elif guess < secret:
        print("Too low!")
    else:
        print("Too high!")
else:
    print(f"Out of tries! The number was {secret}.")
```

A losing game looks like this:

```text
Guess 1 of 7: 80
Too high!
Guess 2 of 7: 10
Too low!
Guess 3 of 7: 60
Too high!
Guess 4 of 7: 20
Too low!
Guess 5 of 7: 45
Too high!
Guess 6 of 7: 35
Too high!
Guess 7 of 7: 28
Too low!
Out of tries! The number was 31.
```

Look carefully at the two loops. The inner `while True` loop only handles **one** guess and its `break` only leaves that inner loop. The second `break` (after "Correct!") leaves the outer `for` loop. Remember: `break` always exits the closest loop it is in.

## Step 5: choose a difficulty

Let's let the player pick how hard the game is. Each level changes two settings: the biggest possible number and the number of tries. A `match` statement (Python 3.10 or newer) makes this tidy, and `|` lets each level accept a short form like `e`.

```python
level = input("Choose a level (easy, medium, hard): ").strip().lower()

match level:
    case "easy" | "e":
        top = 50
        max_attempts = 10
    case "hard" | "h":
        top = 500
        max_attempts = 8
    case _:
        top = 100
        max_attempts = 7

print(f"Guess a number from 1 to {top}. You have {max_attempts} tries.")
```

Output (the player typed `Hard`):

```text
Choose a level (easy, medium, hard): Hard
Guess a number from 1 to 500. You have 8 tries.
```

`.lower()` makes `Hard`, `HARD` and `hard` all work. Any answer that is not easy or hard falls into `case _` and gets the medium settings, so the game never gets stuck on a typo.

In the full game you will replace every `100` with `top`, so the range check and the random number follow the chosen level.

## Step 6: play again and keep score

Finally, wrap the whole game in an outer `while True` loop and ask "Play again?" at the end of each round. A few extra variables keep track of how many games were played and won, and the best score so far. `best_score` starts as `None`, meaning "no score yet", as you learned in [Booleans, Comparisons and None](/courses/python/booleans-and-none).

## The complete game

Here is the finished program. Read through it slowly. Every piece is something you built above.

```python
import random

print("=" * 34)
print("   Welcome to the Guessing Game!")
print("=" * 34)

games_played = 0
games_won = 0
best_score = None

while True:
    # 1. Choose a difficulty
    level = input("Choose a level (easy, medium, hard): ").strip().lower()
    match level:
        case "easy" | "e":
            top = 50
            max_attempts = 10
        case "hard" | "h":
            top = 500
            max_attempts = 8
        case _:
            top = 100
            max_attempts = 7

    secret = random.randint(1, top)
    games_played += 1
    print(f"\nI am thinking of a number from 1 to {top}.")
    print(f"You have {max_attempts} tries. Good luck!")

    # 2. The guessing loop
    for attempt in range(1, max_attempts + 1):
        # Ask until the guess is a valid number in range
        while True:
            text = input(f"Guess {attempt} of {max_attempts}: ").strip()
            if not text.isdigit():
                print("Please type a whole number.")
                continue
            guess = int(text)
            if not 1 <= guess <= top:
                print(f"Please stay between 1 and {top}.")
                continue
            break

        if guess == secret:
            print(f"Correct! You found {secret} in {attempt} tries.")
            games_won += 1
            if best_score is None or attempt < best_score:
                best_score = attempt
                print("That is a new best score!")
            break
        elif guess < secret:
            print("Too low!")
        else:
            print("Too high!")

        # A friendly warning before the last try
        if attempt == max_attempts - 1:
            print("Careful, this is your last try!")
    else:
        print(f"Out of tries! The number was {secret}.")

    # 3. Play again?
    again = input("\nPlay again? (y/n) ").strip().lower()
    if again not in ("y", "yes"):
        break

# 4. Final stats
print(f"\nYou played {games_played} game(s) and won {games_won}.")
if best_score is not None:
    print(f"Your best score was {best_score} tries.")
print("Thanks for playing!")
```

Here is the end of a session where the player won the first game (shown at the top of this page), then lost a hard game:

```text
Play again? (y/n) y
Choose a level (easy, medium, hard): hard

I am thinking of a number from 1 to 500.
You have 8 tries. Good luck!
Guess 1 of 8: 250
Too low!
Guess 2 of 8: 400
Too low!
Guess 3 of 8: 450
Too low!
Guess 4 of 8: 480
Too low!
Guess 5 of 8: 495
Too high!
Guess 6 of 8: 490
Too high!
Guess 7 of 8: 485
Too low!
Careful, this is your last try!
Guess 8 of 8: 488
Too high!
Out of tries! The number was 486.

Play again? (y/n) n

You played 2 game(s) and won 1.
Your best score was 5 tries.
Thanks for playing!
```

So close!

## Testing a game with random numbers

Random numbers make testing tricky: every run is different, so how do you check a specific situation, like losing on the last try? Python lets you fix the starting point of its random number generator with `random.seed()`. With the same **seed**, `random` produces the same "random" numbers every time.

```python
import random

random.seed(7)
print(random.randint(1, 100))
```

Output:

```text
42
```

Run it as many times as you like: with seed `7` you get `42` every time on the same Python version. That is how the sample games on this page were made repeatable.

> **Warning:** Use `random.seed()` only while testing. If you leave a fixed seed in the real game, the secret number is the same every time and players will quickly learn it. Remove the line when you are done.

## Common mistakes

### Comparing the raw input to the number

If you forget `int()` and write `guess = input("Your guess: ")`, the loop never ends: the string `"42"` is never equal to the number `42`. And `guess < secret` crashes with `TypeError: '<' not supported between instances of 'str' and 'int'`. Always convert first.

### Calling `randint()` inside the loop

If `secret = random.randint(1, 100)` is inside the guessing loop, the computer picks a **new** number before every guess, and the hints become useless. Pick the secret once, before the loop.

### Off-by-one in the try counter

`range(1, max_attempts)` gives only 6 tries when `max_attempts` is 7, because `range()` stops before the end. That is why the game uses `range(1, max_attempts + 1)`.

### The loop `else` at the wrong level

The `else:` that prints "Out of tries!" must line up with `for`, not with `if`. If you indent it under the `if`/`elif`, it becomes part of that decision and runs on every wrong guess.

## Ideas to try on your own

Once the game works, make it yours. Here are some challenges, from easy to harder:

1. Tell the player how many tries they have left after each wrong guess.
2. Say "Very close!" when the guess is within 5 of the secret. (Hint: `abs(guess - secret) <= 5`, where `abs()` removes the minus sign.)
3. Add a "custom" level where the player types the biggest number themselves.
4. Turn it around: **you** think of a number, and the computer guesses it using the binary search trick, while you answer "high", "low" or "correct".

## Quick recap

- `import random` and `random.randint(a, b)` pick a random whole number, including both ends.
- A `while True` loop with `continue` and `break` keeps asking until the input is valid.
- `for attempt in range(1, max_attempts + 1)` counts tries, and the loop `else` handles running out.
- `match` with `|` turns a typed choice into game settings.
- An outer `while True` loop with a "Play again?" question lets the game repeat.
- `random.seed()` makes random numbers repeatable for testing only.

You have finished the control flow section. Next, you will learn to store many values together, like a whole history of guesses, in [Lists: Ordered Collections](/courses/python/lists).

<code id="code-content" class="language-python">
# guessing_game.py: the complete Number Guessing Game
# Run it with: python guessing_game.py (or python3 on macOS and Linux)
#
import random
#
print("=" * 34)
print("   Welcome to the Guessing Game!")
print("=" * 34)
#
games_played = 0
games_won = 0
best_score = None
#
while True:
    # 1. Choose a difficulty
    level = input("Choose a level (easy, medium, hard): ").strip().lower()
    match level:
        case "easy" | "e":
            top = 50
            max_attempts = 10
        case "hard" | "h":
            top = 500
            max_attempts = 8
        case _:
            top = 100
            max_attempts = 7
#
    secret = random.randint(1, top)
    games_played += 1
    print(f"\nI am thinking of a number from 1 to {top}.")
    print(f"You have {max_attempts} tries. Good luck!")
#
    # 2. The guessing loop
    for attempt in range(1, max_attempts + 1):
        # Ask until the guess is a valid number in range
        while True:
            text = input(f"Guess {attempt} of {max_attempts}: ").strip()
            if not text.isdigit():
                print("Please type a whole number.")
                continue
            guess = int(text)
            if not 1 &lt;= guess &lt;= top:
                print(f"Please stay between 1 and {top}.")
                continue
            break
#
        if guess == secret:
            print(f"Correct! You found {secret} in {attempt} tries.")
            games_won += 1
            if best_score is None or attempt &lt; best_score:
                best_score = attempt
                print("That is a new best score!")
            break
        elif guess &lt; secret:
            print("Too low!")
        else:
            print("Too high!")
#
        # A friendly warning before the last try
        if attempt == max_attempts - 1:
            print("Careful, this is your last try!")
    else:
        print(f"Out of tries! The number was {secret}.")
#
    # 3. Play again?
    again = input("\nPlay again? (y/n) ").strip().lower()
    if again not in ("y", "yes"):
        break
#
# 4. Final stats
print(f"\nYou played {games_played} game(s) and won {games_won}.")
if best_score is not None:
    print(f"Your best score was {best_score} tries.")
print("Thanks for playing!")
</code></pre>

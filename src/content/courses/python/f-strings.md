---
publishDate: 2026-10-27T08:11
title: 'f-strings and String Formatting'
slug: f-strings
metadescription: 'Learn how to put variables and values inside text with Python f-strings, control decimals, add commas, line up columns and avoid common formatting errors.'
updateDate: 2026-10-27T08:11
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'strings', 'formatting']
course: python
---

## Why you need string formatting

Almost every program needs to show a message that mixes fixed text with changing values. "Hi Maya, you have 3 new messages." "Your total is $13.50." The words stay the same, but the name and the numbers change.

In [Strings: Working with Text](/courses/python/strings) you joined pieces of text with `+`. That works, but it gets messy fast:

```python
name = "Maya"
age = 12
print("Hi " + name + ", you are " + str(age) + " years old.")
```

Output:

```text
Hi Maya, you are 12 years old.
```

You have to remember every space, every `+`, and you must turn the number into text with `str()` first. It is easy to make mistakes.

**String formatting** means building a piece of text by filling values into a template. Think of a birthday card with blank lines: "Happy birthday, ____! You are ____ today." You write the card once, and fill in the blanks for each person.

In modern Python, the best way to do this is the **f-string**.

## Your first f-string

An **f-string** (short for "formatted string") is a normal string with the letter `f` right before the opening quote. Inside it, anything you put between curly braces `{ }` is replaced by its value.

```python
name = "Maya"
age = 12
print(f"Hi {name}, you are {age} years old.")
```

Output:

```text
Hi Maya, you are 12 years old.
```

Compare it with the `+` version. It is shorter, easier to read, and you did not need `str(age)`. The f-string turns the number into text for you.

The parts in braces are called **placeholders** (or replacement fields). Each one is a blank on the birthday card.

> **Note:** The `f` can be lowercase `f` or uppercase `F`. Everyone uses lowercase, so you should too.

## Putting expressions inside the braces

You are not limited to plain variable names. Any small piece of Python that produces a value, called an **expression**, can go inside the braces.

```python
price = 4.5
quantity = 3
print(f"Total: {price * quantity}")
print(f"Name in capitals: {'maya'.upper()}")
print(f"Next year you will be {12 + 1}.")
```

Output:

```text
Total: 13.5
Name in capitals: MAYA
Next year you will be 13.
```

Python works out the math or calls the method first, then drops the result into the text. You saw `.upper()` in [Useful String Methods](/courses/python/string-methods), and the math operators in [Numbers and Math Operators](/courses/python/numbers-and-math).

> **Tip:** Keep the expressions short. If the code inside the braces gets long, calculate it on its own line first and put the variable in the f-string. Your future self will thank you.

## Controlling how values look

After the value, you can add a colon `:` and a **format specifier**. A format specifier is a tiny set of instructions that says how the value should look: how many decimal places, how wide, which side to line up on.

### Decimal places

Money and measurements usually need a fixed number of decimal places. Use `.2f` for "2 digits after the point" (the `f` here means **fixed-point number**).

```python
pi = 3.14159265
print(f"{pi:.2f}")
print(f"{pi:.0f}")
price = 7
print(f"Price: ${price:.2f}")
```

Output:

```text
3.14
3
Price: $7.00
```

Notice that `7` became `7.00`. The value is rounded only for display. The variable `pi` itself does not change.

### Thousands separators

Big numbers are hard to read. Add a comma to the specifier and Python groups the digits for you.

```python
population = 8123456789
print(f"{population:,}")
print(f"{1234567.891:,.2f}")
```

Output:

```text
8,123,456,789
1,234,567.89
```

### Percentages

The `%` specifier multiplies by 100 and adds a percent sign.

```python
score = 0.875
print(f"{score:.1%}")
```

Output:

```text
87.5%
```

### Width and alignment

You can give a value a fixed **width** (a number of characters). Then you choose where it sits inside that space:

| Symbol | Meaning | Example | Result |
| --- | --- | --- | --- |
| `<` | line up on the left | `f"{'hi':<6}"` | `hi    ` |
| `>` | line up on the right | `f"{'hi':>6}"` | `    hi` |
| `^` | center | `f"{'hi':^6}"` | `  hi  ` |

This is great for little tables. Here is a price list (you will meet `for` loops properly in [for Loops and range()](/courses/python/for-loops-and-range), for now just notice the f-string):

```python
for item, cost in [("Tea", 2.5), ("Sandwich", 6.75), ("Cake", 4)]:
    print(f"{item:<10}|{cost:>8.2f}")
```

Output:

```text
Tea       |    2.50
Sandwich  |    6.75
Cake      |    4.00
```

`{item:<10}` means "put the item on the left of a 10 character space". `{cost:>8.2f}` means "8 characters wide, lined up on the right, 2 decimals". The columns line up perfectly.

You can also choose a **fill character** to use instead of spaces, and pad numbers with zeros:

```python
print(f"[{'hi':^10}]")
print(f"[{'hi':*^10}]")
print(f"[{42:05}]")
```

Output:

```text
[    hi    ]
[****hi****]
[00042]
```

## The debugging trick: `=`

When you are hunting for a bug, you often want to print a variable together with its name. Add `=` after the expression and Python prints both.

```python
x = 10
y = 3
print(f"{x=}")
print(f"{x * y = }")
```

Output:

```text
x=10
x * y = 30
```

This is a quick way to peek inside your program while it runs.

## Showing real curly braces

Since braces mean "placeholder", how do you print an actual `{`? Write it twice: `{{` shows `{` and `}}` shows `}`.

```python
print(f"Use {{ and }} to show braces. Value: {5}")
```

Output:

```text
Use { and } to show braces. Value: 5
```

## Long messages over several lines

For a longer message, you can put several f-strings inside parentheses. Python glues strings that sit next to each other into one string.

```python
name = "Maya"
items = 3
total = 13.5
receipt = (
    f"Customer: {name}\n"
    f"Items:    {items}\n"
    f"Total:    ${total:.2f}"
)
print(receipt)
```

Output:

```text
Customer: Maya
Items:    3
Total:    $13.50
```

The `\n` is the newline character from the strings lesson. Triple quoted f-strings (`f"""..."""`) also work if you prefer to write the lines as they look.

## Older ways you will still see

f-strings arrived in Python 3.6. Older code (and some tutorials) use two other styles. You do not need to write them, but you should recognize them.

The `.format()` method uses empty braces and fills them in order, or by name:

```python
print("Hi {}, you are {} years old.".format("Maya", 12))
template = "Dear {name}, your order #{number} has shipped."
print(template.format(name="Sam", number=1042))
```

Output:

```text
Hi Maya, you are 12 years old.
Dear Sam, your order #1042 has shipped.
```

`.format()` is still handy when the template is created before you know the values, like the `template` above.

The very old `%` style looks like this:

```python
print("Hi %s, you are %d years old." % ("Maya", 12))
```

Output:

```text
Hi Maya, you are 12 years old.
```

The same format specifiers (`.2f`, `,`, `>10` and so on) work with `.format()` too. For new code, choose f-strings. They are the clearest and the most popular.

## Common mistakes

### Forgetting the `f`

```python
name = "Maya"
print("Hi {name}")
```

Output:

```text
Hi {name}
```

There is no error, but the braces were printed as plain text. Without the `f`, Python treats it as an ordinary string. Fix: `print(f"Hi {name}")`.

### Joining a number with `+`

```python
age = 12
print("Age: " + age)
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print("Age: " + age)
          ~~~~~~~~^~~~~
TypeError: can only concatenate str (not "int") to str
```

You cannot add text and a number. Fix: use an f-string, `print(f"Age: {age}")`. You will learn more about turning one type into another in [Converting Between Types](/courses/python/type-conversion).

### Using a number format on text

```python
price = "4.5"
print(f"{price:.2f}")
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(f"{price:.2f}")
            ^^^^^^^^^^^
ValueError: Unknown format code 'f' for object of type 'str'
```

`price` is the text `"4.5"`, not a number, so `.2f` makes no sense for it. Fix: store a real number (`price = 4.5`) or convert it with `float(price)` first.

### Quotes inside the braces

In Python 3.12 and newer you may reuse the same quote type inside the braces, so `f"{person["name"]}"` works. On older versions it is a `SyntaxError`. The safe habit that works everywhere is to use the other kind of quote inside: `f"{person['name']}"`.

## Quick recap

- Put `f` before a string and write values inside `{ }` to fill them in.
- Any expression can go in the braces: math, method calls, variables.
- Add `:` and a format specifier to control the look: `.2f` for decimals, `,` for thousands, `%` for percent.
- `<`, `>` and `^` with a width line values up in columns.
- `{x=}` prints the name and the value, great for debugging.
- Write `{{` and `}}` to show real braces.
- `.format()` and `%` are older styles. Prefer f-strings in new code.

Next, you will learn about `True`, `False` and the special value `None` in [Booleans, Comparisons and None](/courses/python/booleans-and-none).

<code id="code-content" class="language-python">
# main.py: a small receipt printer that shows off f-strings
#
# Each item is a name, a unit price and how many were bought
items = [
    ("Tea", 2.5, 2),
    ("Sandwich", 6.75, 1),
    ("Cake", 4, 3),
]
customer = "Maya"
tax_rate = 0.08
#
# A header line, centered in 32 characters and padded with = signs
print(f"{' RECEIPT ':=^32}")
print(f"Customer: {customer}")
print("-" * 32)
#
subtotal = 0
for name, price, qty in items:
    line_total = price * qty
    subtotal += line_total
    # name on the left, quantity on the right, money with 2 decimals
    print(f"{name:&lt;11}{qty:&gt;4} x {price:&gt;5.2f} = {line_total:&gt;6.2f}")
#
tax = subtotal * tax_rate
total = subtotal + tax
print("-" * 32)
print(f"{'Subtotal':&lt;24}{subtotal:&gt;8.2f}")
print(f"{'Tax (' + format(tax_rate, '.0%') + ')':&lt;24}{tax:&gt;8.2f}")
print(f"{'TOTAL':&lt;24}{total:&gt;8.2f}")
#
# The debugging trick: show a name and its value together
print(f"{len(items)=}")
# Real braces are written twice
print(f"Thanks for shopping, {customer}! {{see you soon}}")
</code></pre>

---
publishDate: 2026-10-27T08:22
title: 'Lists: Ordered Collections'
slug: lists
metadescription: 'Learn how Python lists store many values in order, how to read items by index, change them, add and remove items, and loop over a list.'
updateDate: 2026-10-27T08:22
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'lists', 'data-structures']
course: python
---

## What is a list?

So far, each variable you made held one value: one name, one number, one answer. But real programs often deal with many values at once. A shopping list has many items. A class has many students. A game has many high scores.

A **list** is a single variable that holds many values in order. Think of it like a row of numbered boxes on a shelf. Each box holds one value, and every box has a position number so you can find it again.

In this lesson you will learn how to:

- Create a list
- Read one item using its position
- Change, add and remove items
- Check if a value is in a list
- Loop over every item

This is the first lesson of the Data Structures section. A **data structure** is simply a way to organize several pieces of data together.

## Creating a list

You create a list with square brackets `[]`. Put the values inside, separated by commas.

```python
fruits = ["apple", "banana", "cherry"]
scores = [90, 72, 85, 100]
empty = []

print(fruits)
print(scores)
print(empty)
```

Output:

```text
['apple', 'banana', 'cherry']
[90, 72, 85, 100]
[]
```

A list can hold any [data type](/courses/python/data-types): strings, numbers, booleans, even other lists. It can also mix types, though most of the time you will keep one kind of value per list because that is easier to work with.

```python
mixed = ["Ada", 36, True, 1.75]
print(mixed)
print(type(mixed))
```

Output:

```text
['Ada', 36, True, 1.75]
<class 'list'>
```

## Counting items with len()

The built-in `len()` function tells you how many items a list has. You may remember it from [strings](/courses/python/strings), where it counts characters.

```python
fruits = ["apple", "banana", "cherry"]
print(len(fruits))
print(len([]))
```

Output:

```text
3
0
```

## Reading items by index

Every item in a list has a position number called an **index**. Python starts counting at **0**, not 1. So the first item is at index 0, the second at index 1, and so on.

| Item | `"apple"` | `"banana"` | `"cherry"` |
|---|---|---|---|
| Index | 0 | 1 | 2 |
| Negative index | -3 | -2 | -1 |

To get an item, write the list name followed by the index in square brackets:

```python
fruits = ["apple", "banana", "cherry"]
print(fruits[0])
print(fruits[1])
print(fruits[2])
```

Output:

```text
apple
banana
cherry
```

### Negative indexes

Python also lets you count from the end with **negative indexes**. Index `-1` is the last item, `-2` is the one before it, and so on. This is handy when you want the last item but do not know how long the list is.

```python
fruits = ["apple", "banana", "cherry"]
print(fruits[-1])
print(fruits[-2])
```

Output:

```text
cherry
banana
```

> **Tip:** Starting at 0 feels strange at first. A helpful way to think about it: the index is "how many steps from the start". The first item is zero steps away.

## Changing an item

Lists are **mutable**, which means you can change them after you create them. (Strings are not mutable, so this is new.) To replace an item, assign a new value to its index:

```python
fruits = ["apple", "banana", "cherry"]
fruits[1] = "blueberry"
print(fruits)
```

Output:

```text
['apple', 'blueberry', 'cherry']
```

You will learn exactly what "mutable" means, and why it matters, in [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying).

## Adding items

There are two common ways to add items:

- `append(value)` adds one item to the **end** of the list.
- `insert(index, value)` puts an item at a given position and shifts the rest to the right.

```python
todo = ["wash dishes"]
todo.append("buy milk")
todo.append("call mom")
print(todo)

todo.insert(0, "wake up")
print(todo)
```

Output:

```text
['wash dishes', 'buy milk', 'call mom']
['wake up', 'wash dishes', 'buy milk', 'call mom']
```

`append()` and `insert()` are **methods**. A method is a function that belongs to a value, and you call it with a dot: `todo.append(...)`. You already used string methods like `upper()` in [Useful String Methods](/courses/python/string-methods).

### Building a list in a loop

A very common pattern is to start with an empty list and `append()` inside a [for loop](/courses/python/for-loops-and-range):

```python
squares = []
for n in range(1, 6):
    squares.append(n * n)
print(squares)
```

Output:

```text
[1, 4, 9, 16, 25]
```

## Removing items

You have a few choices for removing items:

| Way | What it does |
|---|---|
| `my_list.remove(value)` | Removes the first item equal to `value` |
| `my_list.pop()` | Removes the last item and gives it back to you |
| `my_list.pop(index)` | Removes the item at `index` and gives it back |
| `del my_list[index]` | Deletes the item at `index` (gives nothing back) |

```python
colors = ["red", "green", "blue", "green"]

colors.remove("green")
print(colors)

last = colors.pop()
print("Popped:", last)
print(colors)

del colors[0]
print(colors)
```

Output:

```text
['red', 'blue', 'green']
Popped: green
['red', 'blue']
['blue']
```

Notice that `remove("green")` only removed the **first** `"green"`. The second one stayed until `pop()` took it.

## Checking if a value is in a list

Use the `in` operator to ask "is this value somewhere in the list?". It gives back `True` or `False`, just like the [comparisons](/courses/python/booleans-and-none) you have seen. Use `not in` for the opposite.

```python
guests = ["Ada", "Grace", "Linus"]

print("Grace" in guests)
print("Bob" in guests)

if "Bob" not in guests:
    print("Sorry Bob, you are not on the list.")
```

Output:

```text
True
False
Sorry Bob, you are not on the list.
```

## Looping over a list

A `for` loop can walk through a list one item at a time. On each pass, the loop variable holds the next item.

```python
prices = [4.50, 12.00, 3.25]
total = 0
for price in prices:
    print("Item costs", price)
    total += price
print("Total:", total)
```

Output:

```text
Item costs 4.5
Item costs 12.0
Item costs 3.25
Total: 19.75
```

Python also has built-in functions that work on lists of numbers:

```python
scores = [90, 72, 85, 100]
print(sum(scores))
print(min(scores))
print(max(scores))
print(sum(scores) / len(scores))
```

Output:

```text
347
72
100
86.75
```

If you also need the index while looping, Python has a neat helper called `enumerate()`. You will meet it in [enumerate, zip and Other Loop Helpers](/courses/python/enumerate-zip-and-loop-helpers).

## Lists inside lists

A list can contain other lists. This is called a **nested list**, and it is a simple way to store a grid or a table. Use two indexes: the first picks the row, the second picks the item in that row.

```python
grid = [
    [1, 2, 3],
    [4, 5, 6],
]
print(grid[0])
print(grid[1][2])
```

Output:

```text
[1, 2, 3]
6
```

## Common mistakes

### Using an index that does not exist

A list with 3 items has indexes 0, 1 and 2. Asking for index 3 is an error:

```python
fruits = ["apple", "banana", "cherry"]
print(fruits[3])
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(fruits[3])
          ~~~~~~^^^
IndexError: list index out of range
```

**Fix:** remember the last index is `len(fruits) - 1`, or simply use `fruits[-1]` to get the last item.

### Removing a value that is not there

`remove()` raises an error if the value is missing:

```python
fruits = ["apple", "banana"]
fruits.remove("mango")
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    fruits.remove("mango")
    ~~~~~~~~~~~~~^^^^^^^^^
ValueError: list.remove(x): x not in list
```

**Fix:** check first with `in`:

```python
fruits = ["apple", "banana"]
if "mango" in fruits:
    fruits.remove("mango")
print(fruits)
```

Output:

```text
['apple', 'banana']
```

### Forgetting that append() changes the list in place

`append()` changes the list directly and returns `None`. Writing `fruits = fruits.append("kiwi")` replaces your list with `None`. Just call `fruits.append("kiwi")` on its own line.

## Quick recap

- A list stores many values in order: `items = ["a", "b", "c"]`.
- Indexes start at 0. Negative indexes count from the end (`-1` is the last item).
- `len()` counts items. `sum()`, `min()` and `max()` work on lists of numbers.
- Lists are mutable: change an item with `items[0] = "new"`.
- Add with `append()` and `insert()`. Remove with `remove()`, `pop()` and `del`.
- Use `in` and `not in` to check membership, and a `for` loop to visit every item.

Next, you will learn powerful ways to cut, sort and search lists in [List Methods, Slicing and Sorting](/courses/python/list-methods-and-slicing).

<code id="code-content" class="language-python">
# main.py: a tiny shopping list manager that uses list basics
shopping = ["bread", "eggs", "milk"]
#
# Read items by index (indexes start at 0)
print("First item:", shopping[0])
print("Last item:", shopping[-1])
print("Number of items:", len(shopping))
#
# Change an item (lists are mutable)
shopping[1] = "free-range eggs"
#
# Add items to the end, or at a position
shopping.append("apples")
shopping.insert(0, "coffee")
#
# Remove items safely
if "milk" in shopping:
    shopping.remove("milk")
last = shopping.pop()
print("Removed from the end:", last)
#
# Loop over every item
print("Final shopping list:")
for item in shopping:
    print("-", item)
#
# Built-in helpers work on lists of numbers too
prices = [2.50, 4.00, 7.25]
print("Total cost:", sum(prices))
print("Most expensive:", max(prices))
</code></pre>

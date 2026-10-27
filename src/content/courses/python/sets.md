---
publishDate: 2026-10-27T08:26
title: 'Sets: Collections of Unique Values'
slug: sets
metadescription: 'Learn how Python sets keep only unique values, how to add and remove items, remove duplicates from a list, and compare groups with union and intersection.'
updateDate: 2026-10-27T08:26
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'sets', 'data-structures']
course: python
---

## What is a set?

Imagine a bag of stickers where you are only allowed one of each design. If someone hands you a sticker you already have, you just do not keep it. That bag is a **set**.

A Python **set** is a collection where:

- Every value is **unique**. Duplicates are dropped automatically.
- There is **no order**. Items have no position, so there is no index like `my_set[0]`.
- Checking "is this value in here?" is **very fast**, even for huge sets.

Sets are perfect for two jobs: removing duplicates, and comparing groups ("who is in both clubs?", "which tags are missing?"). In this lesson you will learn both.

## Creating a set

Write values inside curly braces `{}`, like a [dictionary](/courses/python/dictionaries) but without the `key:` part:

```python
colors = {"red", "green", "blue", "red", "green"}
print(colors)
print(len(colors))
```

Output:

```text
{'green', 'blue', 'red'}
3
```

The duplicates disappeared. The order you see may also differ from the order you typed, and it can change between runs for strings. Never rely on the order of a set.

> **Note:** Because sets have no order, the exact order of string items in set output can be different on your computer. The **contents** will be the same.

### Making a set from a list

The `set()` function turns any collection into a set. This is the quickest way to remove duplicates from a [list](/courses/python/lists):

```python
numbers = [3, 1, 3, 2, 1, 3]
unique = set(numbers)
print(unique)
print(sorted(unique))
```

Output:

```text
{1, 2, 3}
[1, 2, 3]
```

`sorted()` turns the set back into a nicely ordered list, which is often what you want for printing.

### The empty set trap

`{}` makes an empty **dictionary**, not an empty set. For an empty set you must write `set()`:

```python
a = {}
b = set()
print(type(a))
print(type(b))
```

Output:

```text
<class 'dict'>
<class 'set'>
```

## Adding and removing items

| Method | What it does |
|---|---|
| `add(value)` | Adds one value (does nothing if it is already there) |
| `update(values)` | Adds every value from another collection |
| `remove(value)` | Removes a value, **error** if it is missing |
| `discard(value)` | Removes a value, **no error** if it is missing |
| `pop()` | Removes and returns some item (you cannot choose which) |
| `clear()` | Removes everything |

```python
visited = {"Paris"}
visited.add("Rome")
visited.add("Paris")
visited.update(["Oslo", "Lima"])
print(sorted(visited))

visited.discard("Tokyo")
visited.remove("Rome")
print(sorted(visited))
```

Output:

```text
['Lima', 'Oslo', 'Paris', 'Rome']
['Lima', 'Oslo', 'Paris']
```

Adding `"Paris"` a second time did nothing, and discarding `"Tokyo"` (which was never there) did not cause an error.

## Checking membership

The `in` operator works just like with lists, but it is much faster on sets. When you need to check membership many times, a set is a smart choice.

```python
banned = {"spam", "scam", "free money"}
subject = "free money"

if subject in banned:
    print("Blocked!")
print("ok" not in banned)
```

Output:

```text
Blocked!
True
```

Here is a simple way to picture why it is fast. To search a list, Python checks items one by one, like reading every name in a phone book. A set works more like a coat check: your value is turned into a ticket number (called a **hash**), and Python jumps straight to the right hook.

## Comparing sets

This is where sets really shine. Python has operators for the classic set operations from math class. Imagine two after-school clubs:

```python
chess = {"Ana", "Ben", "Cara", "Dev"}
music = {"Cara", "Dev", "Eli"}
```

| Operation | Operator | Method | Meaning |
|---|---|---|---|
| Union | `a \| b` | `a.union(b)` | In either set (or both) |
| Intersection | `a & b` | `a.intersection(b)` | In both sets |
| Difference | `a - b` | `a.difference(b)` | In `a` but not in `b` |
| Symmetric difference | `a ^ b` | `a.symmetric_difference(b)` | In one set but not both |

```python
chess = {"Ana", "Ben", "Cara", "Dev"}
music = {"Cara", "Dev", "Eli"}

print("Everyone:", sorted(chess | music))
print("Both clubs:", sorted(chess & music))
print("Only chess:", sorted(chess - music))
print("Only music:", sorted(music - chess))
print("Just one club:", sorted(chess ^ music))
```

Output:

```text
Everyone: ['Ana', 'Ben', 'Cara', 'Dev', 'Eli']
Both clubs: ['Cara', 'Dev']
Only chess: ['Ana', 'Ben']
Only music: ['Eli']
Just one club: ['Ana', 'Ben', 'Eli']
```

Each result is wrapped in `sorted()` only so the output has a stable, readable order.

### Subsets and supersets

You can also ask if one set is completely inside another:

```python
required = {"name", "email"}
form = {"name", "email", "phone"}

print(required <= form)
print(required.issubset(form))
print(form >= required)
print({"name", "age"} <= form)
```

Output:

```text
True
True
True
False
```

`<=` means "is a **subset** of" (every item of the left is also in the right). This is a neat way to check that a form has all the fields it needs.

## A practical example: finding new items

Say you have yesterday's list of email subscribers and today's list. Which addresses are new, and which ones left?

```python
yesterday = ["a@x.com", "b@x.com", "c@x.com"]
today = ["b@x.com", "c@x.com", "d@x.com", "d@x.com"]

old = set(yesterday)
new = set(today)

print("Joined:", sorted(new - old))
print("Left:", sorted(old - new))
print("Total now:", len(new))
```

Output:

```text
Joined: ['d@x.com']
Left: ['a@x.com']
Total now: 3
```

Doing this with lists would need nested loops. With sets it is three short lines.

## What can go in a set?

Like dictionary keys, set items must be **immutable** (unchangeable). Numbers, strings and [tuples](/courses/python/tuples-and-unpacking) are fine. Lists and dictionaries are not:

```python
points = {(0, 0), (1, 2)}
print(points)

bad = {[1, 2], [3, 4]}
```

Output:

```text
{(1, 2), (0, 0)}
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    bad = {[1, 2], [3, 4]}
          ^^^^^^^^^^^^^^^^
TypeError: cannot use 'list' as a set element (unhashable type: 'list')
```

The first line worked. The second failed because lists are "unhashable", which means Python cannot make that coat check ticket for them.

> **Tip:** If you need a set that itself cannot change (for example, to put a set inside another set), use `frozenset()`. You will rarely need it as a beginner.

## Common mistakes

### Trying to index a set

Sets have no positions, so `my_set[0]` fails:

```python
tags = {"python", "code"}
print(tags[0])
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(tags[0])
          ~~~~^^^
TypeError: 'set' object is not subscriptable
```

**Fix:** loop over the set, or convert it first: `sorted(tags)[0]` or `list(tags)[0]`.

### Using remove() on a missing value

`remove()` raises a `KeyError` if the value is not there. Use `discard()` when it might be missing.

### Writing {} for an empty set

`{}` is an empty dictionary. Calling `.add()` on it fails with `AttributeError: 'dict' object has no attribute 'add'`. Use `set()`.

## Quick recap

- A set holds unique values with no order: `{"a", "b"}`.
- `set(my_list)` removes duplicates. Use `set()`, not `{}`, for an empty set.
- Add with `add()` and `update()`. Remove with `discard()` (safe) or `remove()` (strict).
- `in` is very fast on sets.
- `|` union, `&` intersection, `-` difference, `^` symmetric difference, `<=` subset.
- Set items must be immutable, so tuples are fine but lists are not.

Next, learn a short and elegant way to build lists, dictionaries and sets in a single line in [List, Dict and Set Comprehensions](/courses/python/comprehensions).

<code id="code-content" class="language-python">
# main.py: compare two classes' favorite fruits using sets
class_a = ["apple", "mango", "kiwi", "apple", "banana", "mango"]
class_b = ["kiwi", "grape", "banana", "kiwi", "pear"]
#
# set() removes duplicates
fruits_a = set(class_a)
fruits_b = set(class_b)
print("Class A likes:", sorted(fruits_a))
print("Class B likes:", sorted(fruits_b))
#
# Set operations (sorted() just gives a tidy, stable order)
print("Liked by both:", sorted(fruits_a &amp; fruits_b))
print("Liked by anyone:", sorted(fruits_a | fruits_b))
print("Only class A:", sorted(fruits_a - fruits_b))
print("Only one class:", sorted(fruits_a ^ fruits_b))
#
# Fast membership checks
for fruit in ["kiwi", "cherry"]:
    if fruit in fruits_a or fruit in fruits_b:
        print(fruit, "is popular")
    else:
        print(fruit, "is not on anyone's list")
#
# Add and remove items
fruits_b.add("cherry")
fruits_b.discard("durian")  # no error even though it is missing
print("Class B now:", sorted(fruits_b))
#
# Subset check: does class B like everything on the shopping list?
shopping = {"kiwi", "pear"}
print("Shopping list covered by B:", shopping &lt;= fruits_b)
</code></pre>

---
publishDate: 2026-10-27T08:23
title: 'List Methods, Slicing and Sorting'
slug: list-methods-and-slicing
metadescription: 'Learn to cut pieces out of Python lists with slicing, sort them with sort() and sorted(), and use handy list methods like extend, index and count.'
updateDate: 2026-10-27T08:23
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'lists', 'sorting']
course: python
---

## Doing more with lists

In [Lists: Ordered Collections](/courses/python/lists) you learned how to create a list, read items by index, and add or remove items. That covers the basics. Now you will learn the tools that make lists really useful:

- **Slicing**: taking a piece of a list, like cutting a few slices from a loaf of bread
- **Sorting**: putting items in order, from smallest to largest or A to Z
- **More methods**: joining lists, finding items, counting, reversing

Everything here is used all the time in real Python code, so it is worth practicing.

## Slicing: taking a piece of a list

A **slice** is a new list made from part of another list. You write it with a colon inside the square brackets:

```python
my_list[start:stop]
```

The slice starts **at** `start` and stops **before** `stop`. The item at `stop` is not included. This "up to but not including" rule is the same one `range()` uses, which you saw in [for Loops and range()](/courses/python/for-loops-and-range).

```python
letters = ["a", "b", "c", "d", "e", "f"]
print(letters[1:4])
print(letters[0:2])
```

Output:

```text
['b', 'c', 'd']
['a', 'b']
```

`letters[1:4]` gives the items at indexes 1, 2 and 3. A nice side effect of the rule: `stop - start` is always the number of items you get (4 - 1 = 3).

### Leaving out start or stop

You can leave out either number:

- Leave out `start` and the slice begins at the very beginning.
- Leave out `stop` and the slice runs to the very end.
- Leave out both (`[:]`) and you get a copy of the whole list.

```python
letters = ["a", "b", "c", "d", "e", "f"]
print(letters[:3])
print(letters[3:])
print(letters[:])
```

Output:

```text
['a', 'b', 'c']
['d', 'e', 'f']
['a', 'b', 'c', 'd', 'e', 'f']
```

### Slicing with negative numbers

Negative indexes count from the end, just like in normal indexing. They make it easy to grab the last few items:

```python
letters = ["a", "b", "c", "d", "e", "f"]
print(letters[-2:])
print(letters[:-2])
```

Output:

```text
['e', 'f']
['a', 'b', 'c', 'd']
```

### Adding a step

A slice can take a third number, the **step**: `[start:stop:step]`. The step says "take every Nth item". A step of `-1` walks backwards, which is a quick way to reverse a list.

```python
numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
print(numbers[::2])
print(numbers[1::2])
print(numbers[::-1])
```

Output:

```text
[0, 2, 4, 6, 8]
[1, 3, 5, 7, 9]
[9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
```

> **Tip:** Slicing works on strings too! `"Python"[0:3]` gives `"Pyt"`, and `"Python"[::-1]` gives `"nohtyP"`. You saw this briefly in [Strings: Working with Text](/courses/python/strings).

### Slices never crash

Unlike a single index, a slice that goes past the end does not raise an error. It just gives you what is there:

```python
letters = ["a", "b", "c"]
print(letters[1:100])
print(letters[5:10])
```

Output:

```text
['b', 'c']
[]
```

## Sorting a list

There are two ways to sort, and the difference matters.

| Tool | What it does | Returns |
|---|---|---|
| `my_list.sort()` | Sorts the list **in place** (changes the original) | `None` |
| `sorted(my_list)` | Makes a **new** sorted list, original stays the same | the new list |

```python
scores = [72, 100, 85, 90]

new_scores = sorted(scores)
print("sorted() result:", new_scores)
print("original after sorted():", scores)

scores.sort()
print("original after sort():", scores)
```

Output:

```text
sorted() result: [72, 85, 90, 100]
original after sorted(): [72, 100, 85, 90]
original after sort(): [72, 85, 90, 100]
```

Use `sorted()` when you want to keep the original order around. Use `.sort()` when you do not need the old order anymore.

### Sorting in reverse

Both tools accept `reverse=True` to sort from largest to smallest:

```python
scores = [72, 100, 85, 90]
print(sorted(scores, reverse=True))

names = ["Linus", "ada", "Grace", "bob"]
names.sort()
print(names)
```

Output:

```text
[100, 90, 85, 72]
['Grace', 'Linus', 'ada', 'bob']
```

Look closely at the names. Capital letters come **before** lowercase letters, so `"Grace"` and `"Linus"` come before `"ada"`. That is because Python compares letters by their character codes, and all uppercase codes are smaller.

### Sorting with a key

To fix that, give `sort()` or `sorted()` a **key**. A key is a function that Python runs on every item, and it sorts by the results instead of the items themselves. Pass `str.lower` to sort without caring about case, or `len` to sort by length:

```python
names = ["Linus", "ada", "Grace", "bob"]
print(sorted(names, key=str.lower))
print(sorted(names, key=len))
```

Output:

```text
['ada', 'bob', 'Grace', 'Linus']
['ada', 'bob', 'Linus', 'Grace']
```

Notice you write `key=str.lower` and `key=len` without parentheses. You are handing over the function itself, not calling it. You will learn much more about passing functions around in [Lambda and Higher-Order Functions](/courses/python/lambda-and-higher-order-functions).

## More useful list methods

Here are the list methods you will reach for most often:

| Method | What it does |
|---|---|
| `extend(other)` | Adds every item from `other` to the end |
| `index(value)` | Gives the index of the first matching item |
| `count(value)` | Counts how many times `value` appears |
| `reverse()` | Reverses the list in place |
| `clear()` | Removes every item |
| `copy()` | Makes a shallow copy (same as `[:]`) |

### extend() versus append()

`append()` adds **one** item. If you append a list, the whole list goes in as a single item. `extend()` adds each item separately.

```python
a = [1, 2]
a.append([3, 4])
print(a)

b = [1, 2]
b.extend([3, 4])
print(b)

c = [1, 2] + [3, 4]
print(c)
```

Output:

```text
[1, 2, [3, 4]]
[1, 2, 3, 4]
[1, 2, 3, 4]
```

The `+` operator also joins two lists, but it makes a new list instead of changing one.

### index() and count()

```python
votes = ["yes", "no", "yes", "yes", "maybe"]
print(votes.count("yes"))
print(votes.index("no"))
```

Output:

```text
3
1
```

### reverse() and clear()

```python
queue = ["first", "second", "third"]
queue.reverse()
print(queue)
queue.clear()
print(queue)
```

Output:

```text
['third', 'second', 'first']
[]
```

## Changing many items with a slice

You can also assign to a slice. Python swaps that whole piece for the new items, and the list grows or shrinks to fit.

```python
days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
days[1:3] = ["TUESDAY", "WEDNESDAY"]
print(days)

days[1:3] = []
print(days)
```

Output:

```text
['Mon', 'TUESDAY', 'WEDNESDAY', 'Thu', 'Fri']
['Mon', 'Thu', 'Fri']
```

This is powerful but can be hard to read. Most of the time, the simpler methods are clearer.

## Common mistakes

### Saving the result of sort()

`sort()` changes the list and returns `None`. If you save its result, you lose your data:

```python
scores = [3, 1, 2]
scores = scores.sort()
print(scores)
```

Output:

```text
None
```

**Fix:** either call `scores.sort()` on its own line, or use `scores = sorted(scores)`.

### Sorting mixed types

Python cannot compare a number with a string, so a mixed list cannot be sorted:

```python
items = [3, "two", 1]
items.sort()
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    items.sort()
    ~~~~~~~~~~^^
TypeError: '<' not supported between instances of 'str' and 'int'
```

**Fix:** keep one type of value per list, or convert values first (see [Converting Between Types](/courses/python/type-conversion)).

### index() on a missing value

`index()` raises a `ValueError` when the value is not in the list. Check with `in` first, the same way you did for `remove()` in the previous lesson.

## Quick recap

- `my_list[start:stop]` takes a slice from `start` up to, but not including, `stop`.
- Leave out `start` or `stop` to go from the beginning or to the end. `[::-1]` reverses.
- `.sort()` changes the list and returns `None`. `sorted()` returns a new list.
- Use `reverse=True` for descending order and `key=` to sort by something else, like `str.lower` or `len`.
- `extend()` adds many items, `index()` finds, `count()` counts, `reverse()` flips, `clear()` empties.

Next, meet the list's unchangeable cousin in [Tuples and Unpacking](/courses/python/tuples-and-unpacking).

<code id="code-content" class="language-python">
# main.py: a leaderboard that uses slicing, sorting and list methods
scores = [72, 100, 85, 90, 64, 98]
names = ["Linus", "ada", "Grace", "bob", "Margaret", "alan"]
#
# sorted() makes a new list, so the original order is kept
print("Original scores:", scores)
print("Sorted high to low:", sorted(scores, reverse=True))
#
# Slicing: the top 3 scores
top_three = sorted(scores, reverse=True)[:3]
print("Top three:", top_three)
#
# sort() changes the list in place (and returns None)
names.sort(key=str.lower)
print("Names A to Z:", names)
#
# Every second name, and the list backwards
print("Every second name:", names[::2])
print("Reversed:", names[::-1])
#
# extend() adds many items, count() and index() search
late_scores = [85, 77]
scores.extend(late_scores)
print("All scores:", scores)
print("How many 85s:", scores.count(85))
print("Position of 100:", scores.index(100))
</code></pre>

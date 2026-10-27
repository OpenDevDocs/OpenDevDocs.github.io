---
publishDate: 2026-10-27T08:25
title: 'Dictionaries: Key-Value Pairs'
slug: dictionaries
metadescription: 'Learn how Python dictionaries store data as key-value pairs, how to look up, add, change and remove entries, and how to loop over keys and values.'
updateDate: 2026-10-27T08:25
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'dictionaries', 'data-structures']
course: python
---

## What is a dictionary?

Think of a real paper dictionary. You do not find a word by its page number. You look up the **word**, and next to it you find its **meaning**.

A Python **dictionary** (often shortened to **dict**) works the same way. It stores pairs of data:

- a **key**: the thing you look up (like the word)
- a **value**: the data stored for that key (like the meaning)

Together they are called a **key-value pair**. With a [list](/courses/python/lists) you find items by position (`items[0]`). With a dictionary you find them by name (`person["name"]`), which is often much easier to read.

Dictionaries are everywhere in Python: settings, user profiles, word counts, data from the web (JSON). Learning them well pays off quickly.

## Creating a dictionary

Use curly braces `{}`. Inside, write each pair as `key: value`, with commas between pairs:

```python
person = {
    "name": "Ada",
    "age": 36,
    "city": "London",
}
print(person)
print(type(person))

empty = {}
print(empty)
```

Output:

```text
{'name': 'Ada', 'age': 36, 'city': 'London'}
<class 'dict'>
{}
```

A few rules about keys and values:

- **Keys** are usually strings, but numbers and [tuples](/courses/python/tuples-and-unpacking) work too. Keys must be unchangeable (immutable), so a list cannot be a key.
- Each key appears **only once**. If you repeat a key, the last value wins.
- **Values** can be anything: numbers, strings, lists, even other dictionaries.
- Dictionaries remember the order you added items in.

## Looking up a value

To get a value, put its key in square brackets:

```python
person = {"name": "Ada", "age": 36, "city": "London"}
print(person["name"])
print(person["age"])
```

Output:

```text
Ada
36
```

### What if the key is missing?

Asking for a key that does not exist causes a `KeyError`:

```python
person = {"name": "Ada", "age": 36}
print(person["email"])
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    print(person["email"])
          ~~~~~~^^^^^^^^^
KeyError: 'email'
```

There are two safe ways to handle this. First, check with `in`, which looks at the **keys**:

```python
person = {"name": "Ada", "age": 36}
if "email" in person:
    print(person["email"])
else:
    print("No email saved")
```

Output:

```text
No email saved
```

Second, use the `get()` method. It returns `None` if the key is missing, or a default value that you choose:

```python
person = {"name": "Ada", "age": 36}
print(person.get("name"))
print(person.get("email"))
print(person.get("email", "not set"))
```

Output:

```text
Ada
None
not set
```

> **Tip:** Use `my_dict[key]` when the key **must** be there (an error helps you spot a bug). Use `my_dict.get(key, default)` when a missing key is normal.

## Adding and changing items

The same square bracket syntax adds a new pair or changes an existing one. If the key exists, the value is replaced. If not, a new pair is added.

```python
person = {"name": "Ada", "age": 36}

person["age"] = 37
person["email"] = "ada@example.com"
print(person)
```

Output:

```text
{'name': 'Ada', 'age': 37, 'email': 'ada@example.com'}
```

To add or change many pairs at once, use `update()`:

```python
settings = {"theme": "light", "font_size": 14}
settings.update({"theme": "dark", "language": "en"})
print(settings)
```

Output:

```text
{'theme': 'dark', 'font_size': 14, 'language': 'en'}
```

## Removing items

| Way | What it does |
|---|---|
| `del my_dict[key]` | Deletes the pair (error if missing) |
| `my_dict.pop(key)` | Removes the pair and returns its value |
| `my_dict.pop(key, default)` | Same, but returns `default` instead of an error if missing |
| `my_dict.clear()` | Removes everything |

```python
stock = {"apples": 10, "pears": 4, "plums": 0}

del stock["plums"]
print(stock)

pears = stock.pop("pears")
print("Removed pears:", pears)
print(stock)

print(stock.pop("kiwis", 0))
```

Output:

```text
{'apples': 10, 'pears': 4}
Removed pears: 4
{'apples': 10}
0
```

## Looping over a dictionary

A dictionary gives you three "views" of its contents:

- `keys()`: all the keys
- `values()`: all the values
- `items()`: all the pairs, as `(key, value)` tuples

A plain `for` loop over a dictionary goes through its **keys**:

```python
prices = {"coffee": 3.5, "tea": 2.0, "cake": 4.25}

for item in prices:
    print(item)
```

Output:

```text
coffee
tea
cake
```

Most of the time you want both the key and the value. Use `items()` and [unpack](/courses/python/tuples-and-unpacking) each pair in the loop line:

```python
prices = {"coffee": 3.5, "tea": 2.0, "cake": 4.25}

for item, price in prices.items():
    print(f"{item}: ${price:.2f}")

print("Cheapest price:", min(prices.values()))
print("Number of items:", len(prices))
```

Output:

```text
coffee: $3.50
tea: $2.00
cake: $4.25
Cheapest price: 2.0
Number of items: 3
```

The `:.2f` inside the f-string shows two decimal places. You learned that in [f-strings and String Formatting](/courses/python/f-strings).

## Counting things with a dictionary

A classic use for a dictionary is counting. Each key is a thing you saw, and its value is how many times you saw it. The `get()` method with a default of 0 makes this tidy:

```python
words = ["cat", "dog", "cat", "bird", "cat", "dog"]
counts = {}

for word in words:
    counts[word] = counts.get(word, 0) + 1

print(counts)
```

Output:

```text
{'cat': 3, 'dog': 2, 'bird': 1}
```

Read the line inside the loop like this: "look up the current count (or 0 if this word is new), add 1, and save it back".

## Nested dictionaries

Values can be lists or other dictionaries. This lets you describe richer data, like a small database of users:

```python
users = {
    "ada": {"age": 36, "languages": ["Python", "C"]},
    "grace": {"age": 85, "languages": ["COBOL"]},
}

print(users["ada"]["age"])
print(users["grace"]["languages"][0])

users["ada"]["languages"].append("Rust")
print(users["ada"])
```

Output:

```text
36
COBOL
{'age': 36, 'languages': ['Python', 'C', 'Rust']}
```

Read `users["ada"]["age"]` from left to right: first get Ada's dictionary, then get `"age"` from it.

## Building a dictionary in other ways

You can also make a dictionary with the `dict()` function, or from a list of pairs:

```python
a = dict(name="Linus", year=1991)
b = dict([("x", 1), ("y", 2)])
print(a)
print(b)
```

Output:

```text
{'name': 'Linus', 'year': 1991}
{'x': 1, 'y': 2}
```

Later, you will learn a short way to build dictionaries in one line in [List, Dict and Set Comprehensions](/courses/python/comprehensions).

## Common mistakes

### Using a list as a key

Keys must be immutable. A list can change, so Python refuses it:

```python
places = {}
places[[52.5, 13.4]] = "Berlin"
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 2, in <module>
    places[[52.5, 13.4]] = "Berlin"
    ~~~~~~^^^^^^^^^^^^^^
TypeError: cannot use 'list' as a dict key (unhashable type: 'list')
```

**Fix:** use a tuple instead: `places[(52.5, 13.4)] = "Berlin"`.

### Expecting `in` to search values

`in` checks keys only. `"London" in person` is `False` even if `"London"` is one of the values. To search values, use `"London" in person.values()`.

### Changing a dictionary while looping over it

Adding or removing keys inside a loop over the same dictionary raises `RuntimeError: dictionary changed size during iteration`. Loop over a copy of the keys instead: `for key in list(my_dict):`.

## Quick recap

- A dictionary stores key-value pairs: `{"name": "Ada", "age": 36}`.
- Look up with `d[key]`. Use `d.get(key, default)` when the key might be missing.
- `d[key] = value` adds or changes a pair. `update()` changes many at once.
- Remove with `del`, `pop()` or `clear()`.
- `in` checks keys. Loop with `for key, value in d.items():`.
- Values can be lists or other dictionaries, so you can model rich data.

Next, learn about a collection that keeps only unique values in [Sets: Collections of Unique Values](/courses/python/sets).

<code id="code-content" class="language-python">
# main.py: a tiny cafe menu and order counter built with dictionaries
menu = {
    "coffee": 3.50,
    "tea": 2.00,
    "cake": 4.25,
}
#
# Add a new item and change a price
menu["juice"] = 3.00
menu["tea"] = 2.25
#
# Print the menu: items() gives (key, value) pairs
print("MENU")
for item, price in menu.items():
    print(f"  {item:&lt;8} ${price:.2f}")
#
# Count each order with get(key, 0) + 1
orders = ["coffee", "cake", "coffee", "tea", "coffee", "pizza"]
counts = {}
for item in orders:
    if item not in menu:
        print(f"Sorry, we do not sell {item}.")
        continue
    counts[item] = counts.get(item, 0) + 1
print("Order counts:", counts)
#
# Work out the bill using the counts and the menu prices
total = 0
for item, qty in counts.items():
    total += menu[item] * qty
print(f"Total bill: ${total:.2f}")
#
# get() with a default never raises KeyError
print("Muffin price:", menu.get("muffin", "not on the menu"))
</code></pre>

---
publishDate: 2026-10-27T08:32
title: 'Function Arguments: Defaults, Keywords, *args and **kwargs'
slug: function-arguments
metadescription: 'Learn every way to pass arguments to Python functions: positional and keyword arguments, default values, *args, **kwargs, and keyword-only parameters.'
updateDate: 2026-10-27T08:32
author: ['bishal-biswas']
level: 2
tags: ['python', 'functions', 'arguments', 'kwargs']
course: python
---

## More flexible functions

In [Defining and Calling Functions](/courses/python/functions) every function took a fixed number of arguments, passed in a fixed order. That works, but real functions often need more flexibility:

- Some settings should have a sensible **default**, so callers can skip them.
- Calls are easier to read when you can **name** the arguments.
- Some functions should accept **any number** of values, like `print()` does.

Python handles all of this. By the end of this lesson you will understand function signatures like `def connect(host, port=80, *args, timeout=5, **kwargs)`, which look scary at first but are built from a few simple ideas.

A quick reminder of two words from the last lesson: a **parameter** is the name in the function definition, and an **argument** is the value you pass in the call.

## Positional arguments

The simplest kind. Arguments are matched to parameters **by position**: first to first, second to second.

```python
def describe(name, age, city):
    print(f"{name} is {age} and lives in {city}.")

describe("Ada", 36, "London")
describe(36, "London", "Ada")
```

Output:

```text
Ada is 36 and lives in London.
36 is London and lives in Ada.
```

The second call runs without any error, but the sentence is nonsense. With positional arguments, order is everything.

## Keyword arguments

You can also pass an argument by **naming** the parameter: `name=value`. These are called **keyword arguments**. With keywords, the order no longer matters, and the call explains itself:

```python
def describe(name, age, city):
    print(f"{name} is {age} and lives in {city}.")

describe(city="Paris", name="Marie", age=66)
describe("Alan", city="Manchester", age=41)
```

Output:

```text
Marie is 66 and lives in Paris.
Alan is 41 and lives in Manchester.
```

You can mix both styles, as in the second call, but **positional arguments must come first**. After you use one keyword argument, every argument after it must be a keyword too.

> **Tip:** Keyword arguments are great for values whose meaning is not obvious. Compare `resize(800, 600, True)` with `resize(800, 600, keep_ratio=True)`. The second needs no guessing.

You have already used keyword arguments: `print(..., end="")`, `sorted(..., reverse=True)` and `enumerate(..., start=1)`.

## Default values

A parameter can have a **default value**, written with `=` in the definition. If the caller leaves that argument out, the default is used:

```python
def greet(name, greeting="Hello"):
    print(f"{greeting}, {name}!")

greet("Ada")
greet("Grace", "Good morning")
greet("Linus", greeting="Hi")
```

Output:

```text
Hello, Ada!
Good morning, Grace!
Hi, Linus!
```

Defaults let you write functions that are simple to call in the common case, but still flexible when needed. `print()` itself works this way: its `sep` parameter defaults to a space and `end` defaults to a new line.

```python
print("a", "b", "c")
print("a", "b", "c", sep="-", end="!\n")
```

Output:

```text
a b c
a-b-c!
```

### Defaults must come last

Parameters with defaults must come **after** parameters without defaults. Otherwise Python would not know which value goes where. Writing `def greet(greeting="Hello", name):` gives this error before your program even starts:

```text
  File "main.py", line 1
    def greet(greeting="Hello", name):
                                ^^^^
SyntaxError: parameter without a default follows parameter with a default
```

**Fix:** reorder to `def greet(name, greeting="Hello"):`.

### Never use a mutable default

As you saw in [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying), a default value is created only **once**, when the function is defined. A list or dictionary default is then shared between every call. Use `None` and create the real value inside:

```python
def add_tag(tag, tags=None):
    if tags is None:
        tags = []
    tags.append(tag)
    return tags

print(add_tag("python"))
print(add_tag("docs"))
```

Output:

```text
['python']
['docs']
```

## *args: any number of positional arguments

Sometimes you do not know how many values the caller will pass. Put a star `*` in front of a parameter name, and it collects **all the extra positional arguments** into a [tuple](/courses/python/tuples-and-unpacking). By convention it is named `args`, but any name works:

```python
def total(*numbers):
    print("numbers is", numbers)
    return sum(numbers)

print(total(1, 2))
print(total(5, 10, 15, 20))
print(total())
```

Output:

```text
numbers is (1, 2)
3
numbers is (5, 10, 15, 20)
50
numbers is ()
0
```

You can combine normal parameters with `*args`. The normal ones are filled first, and `*args` takes the rest:

```python
def make_sentence(subject, *words):
    return subject + " " + " ".join(words) + "."

print(make_sentence("Python", "is", "easy", "to", "read"))
```

Output:

```text
Python is easy to read.
```

This is the same star idea you used for unpacking with `first, *rest = items`.

## **kwargs: any number of keyword arguments

Two stars `**` collect **all the extra keyword arguments** into a [dictionary](/courses/python/dictionaries). The usual name is `kwargs`, short for "keyword arguments":

```python
def make_profile(name, **details):
    profile = {"name": name}
    profile.update(details)
    return profile

print(make_profile("Ada"))
print(make_profile("Grace", job="admiral", born=1906))
```

Output:

```text
{'name': 'Ada'}
{'name': 'Grace', 'job': 'admiral', 'born': 1906}
```

The keys of the dictionary are the argument names as strings. This is useful for options where you cannot list every possible name ahead of time.

```python
def show_settings(**options):
    for key, value in options.items():
        print(f"{key} = {value}")

show_settings(theme="dark", font_size=14, autosave=True)
```

Output:

```text
theme = dark
font_size = 14
autosave = True
```

## Unpacking arguments in a call

The stars also work the other way round, **in a call**. `*` spreads a list or tuple into separate positional arguments, and `**` spreads a dictionary into keyword arguments:

```python
def describe(name, age, city):
    print(f"{name} is {age} and lives in {city}.")

data = ["Ada", 36, "London"]
describe(*data)

info = {"name": "Linus", "age": 28, "city": "Helsinki"}
describe(**info)
```

Output:

```text
Ada is 36 and lives in London.
Linus is 28 and lives in Helsinki.
```

`describe(*data)` is the same as `describe("Ada", 36, "London")`. This is handy when your values are already stored in a collection.

## Keyword-only parameters

Any parameter placed **after** `*args` (or after a lone `*`) can only be passed by keyword. This is called a **keyword-only** parameter. It forces callers to write clear calls for important options:

```python
def save(filename, *, overwrite=False):
    if overwrite:
        print(f"Overwriting {filename}")
    else:
        print(f"Saving {filename} safely")

save("notes.txt")
save("notes.txt", overwrite=True)
save("notes.txt", True)
```

Output:

```text
Saving notes.txt safely
Overwriting notes.txt
Traceback (most recent call last):
  File "main.py", line 9, in <module>
    save("notes.txt", True)
    ~~~~^^^^^^^^^^^^^^^^^^^
TypeError: save() takes 1 positional argument but 2 were given
```

The bare `*` means "no more positional arguments after this point". The last call fails, which is good: `save("notes.txt", True)` would be hard to understand when reading the code later.

> **Note:** There is also a `/` marker for **positional-only** parameters, as in `def f(a, b, /, c):`. Parameters before `/` cannot be passed by keyword. You will mostly see it in Python's own documentation, for example in the signature of `len(obj, /)`. You rarely need it in your own beginner code.

## Putting it all in order

When a function uses several kinds of parameters, they must appear in this order:

| Order | Kind | Example |
|---|---|---|
| 1 | Normal parameters | `host` |
| 2 | Parameters with defaults | `port=80` |
| 3 | `*args` (or a bare `*`) | `*paths` |
| 4 | Keyword-only parameters | `timeout=5` |
| 5 | `**kwargs` | `**headers` |

```python
def request(host, port=80, *paths, timeout=5, **headers):
    print("host:", host)
    print("port:", port)
    print("paths:", paths)
    print("timeout:", timeout)
    print("headers:", headers)

request("example.com", 443, "api", "users", timeout=10, token="abc", lang="en")
```

Output:

```text
host: example.com
port: 443
paths: ('api', 'users')
timeout: 10
headers: {'token': 'abc', 'lang': 'en'}
```

Trace where each argument went: `"example.com"` and `443` filled the first two by position, the extra positional values landed in `paths`, `timeout` was set by keyword, and the unknown keywords `token` and `lang` ended up in `headers`.

## Common mistakes

### Giving the same argument twice

```python
def greet(name, greeting="Hello"):
    print(f"{greeting}, {name}!")

greet("Ada", name="Grace")
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    greet("Ada", name="Grace")
    ~~~~~^^^^^^^^^^^^^^^^^^^^^
TypeError: greet() got multiple values for argument 'name'
```

`"Ada"` already filled `name` by position, so `name="Grace"` is a second value for it. **Fix:** pass each argument only once.

### Misspelling a keyword

```python
def greet(name, greeting="Hello"):
    print(f"{greeting}, {name}!")

greet("Ada", greting="Hi")
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 4, in <module>
    greet("Ada", greting="Hi")
    ~~~~~^^^^^^^^^^^^^^^^^^^^^
TypeError: greet() got an unexpected keyword argument 'greting'. Did you mean 'greeting'?
```

Python even suggests the right name. **Fix:** use the exact parameter name.

### Positional argument after a keyword argument

Writing `greet(name="Ada", "Hi")` is a `SyntaxError: positional argument follows keyword argument`. **Fix:** put positional arguments first.

## Quick recap

- Positional arguments match by order. Keyword arguments (`name=value`) match by name.
- Default values (`greeting="Hello"`) make arguments optional. They go after required parameters.
- Use `None` instead of a mutable default like `[]`.
- `*args` collects extra positional arguments into a tuple. `**kwargs` collects extra keyword arguments into a dictionary.
- In a call, `*list` and `**dict` spread values out into arguments.
- Parameters after `*` are keyword-only, which keeps calls clear.

Next, find out where a variable can be seen and changed in [Variable Scope: Local, Global and nonlocal](/courses/python/variable-scope).

<code id="code-content" class="language-python">
# main.py: one flexible function that uses every kind of parameter
def make_order(customer, size="medium", *toppings, delivery=False, **notes):
    # customer: required, positional or keyword
    # size: optional, has a default
    # *toppings: any number of extra positional values (a tuple)
    # delivery: keyword-only, because it comes after *toppings
    # **notes: any extra keyword arguments (a dictionary)
    lines = [f"Order for {customer}: {size} pizza"]
    if toppings:
        lines.append("  Toppings: " + ", ".join(toppings))
    else:
        lines.append("  Toppings: just cheese")
    lines.append("  Delivery: " + ("yes" if delivery else "pickup"))
    for key, value in notes.items():
        lines.append(f"  Note ({key}): {value}")
    return "\n".join(lines)
#
# Only the required argument, everything else uses defaults
print(make_order("Ada"))
#
# Positional size and toppings, keyword-only delivery
print(make_order("Grace", "large", "mushroom", "olives", delivery=True))
#
# Extra keyword arguments land in **notes
print(make_order("Linus", "small", door="blue", bell="broken"))
#
# Unpacking a list with * and a dict with ** in the call
favorites = ["pepper", "onion", "basil"]
options = {"delivery": True, "time": "7 pm"}
print(make_order("Alan", "medium", *favorites, **options))
#
# A safe default: None instead of a shared list
def add_score(score, scores=None):
    if scores is None:
        scores = []
    scores.append(score)
    return scores
#
print(add_score(10), add_score(20))
</code></pre>

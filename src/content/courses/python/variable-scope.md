---
publishDate: 2026-10-27T08:33
title: 'Variable Scope: Local, Global and nonlocal'
slug: variable-scope
metadescription: 'Learn where Python variables live and who can see them: local and global scope, the LEGB rule, and when to use the global and nonlocal keywords.'
updateDate: 2026-10-27T08:33
author: ['bishal-biswas']
level: 2
tags: ['python', 'beginners', 'functions', 'scope']
course: python
---

## What is scope?

When you create a variable, Python has to remember two things: its value, and **where in your program that name can be used**. That second part is called **scope**.

Think of a house. Things in the living room are shared: everyone in the house can see the TV. Things in your bedroom are private: other people in the house cannot see what is on your desk. In Python, the "living room" is the whole file, and each function is like its own "bedroom".

Scope matters as soon as you start writing [functions](/courses/python/functions). It explains some error messages that look strange at first, and it helps you write functions that do not step on each other.

In this lesson you will learn:

- What **local** and **global** variables are
- The **LEGB rule** Python uses to look up a name
- How the `global` and `nonlocal` keywords work, and why you should use them rarely

## Local variables: private to a function

A variable you create **inside** a function is a **local variable**. It is born when the function starts running and it disappears when the function finishes. Code outside the function cannot see it.

```python
def make_greeting():
    message = "Hello from inside the function"
    print(message)


make_greeting()
print(message)
```

Output:

```text
Hello from inside the function
Traceback (most recent call last):
  File "main.py", line 7, in <module>
    print(message)
          ^^^^^^^
NameError: name 'message' is not defined
```

The first `print()` works because it runs inside the function. The second one fails with a `NameError`, because `message` only existed inside `make_greeting()`.

> **Note:** In real tracebacks you will see the full path to your file instead of just `main.py`. The rest of the message is the same.

This is a good thing. It means two different functions can both use a variable called `total` or `result` without mixing them up.

[Function parameters](/courses/python/function-arguments) are local variables too. When you call `add(2, 3)`, the names `a` and `b` inside `add()` only exist during that call.

## Global variables: shared by the whole file

A variable created at the top level of your file (not inside any function) is a **global variable**. Any function in that file can **read** it.

```python
app_name = "Notes"


def show_title():
    print("Welcome to", app_name)


show_title()
```

Output:

```text
Welcome to Notes
```

`show_title()` has no variable called `app_name`, so Python looks outside the function and finds the global one.

### Same name, different variables

What happens if a function creates a variable with the same name as a global one?

```python
color = "blue"


def paint():
    color = "red"
    print("Inside paint():", color)


paint()
print("Outside:", color)
```

Output:

```text
Inside paint(): red
Outside: blue
```

The assignment `color = "red"` inside the function creates a **new local variable** that just happens to share the name. The global `color` is untouched. This is called **shadowing**: the local name hides the global one while the function runs.

## The LEGB rule: how Python finds a name

When Python sees a name, it searches in four places, in this order, and stops at the first match:

| Letter | Scope | What it means |
|---|---|---|
| **L** | Local | Names created inside the current function |
| **E** | Enclosing | Names inside an outer function, if this function is nested |
| **G** | Global | Names created at the top level of the file |
| **B** | Built-in | Names Python always has, like `print`, `len` and `range` |

Here is all four in one example:

```python
x = "global"


def outer():
    x = "enclosing"

    def inner():
        x = "local"
        print("inner:", x)

    inner()
    print("outer:", x)


outer()
print("module:", x)
print(len("abc"))
```

Output:

```text
inner: local
outer: enclosing
module: global
3
```

Each `print()` finds the closest `x`. And `len` is found in the built-in scope, because nobody defined a variable called `len`.

## Changing a global variable: the trap

Reading a global variable inside a function is fine. **Changing** it is where beginners get surprised:

```python
count = 0


def add_one():
    count = count + 1


add_one()
```

Output:

```text
Traceback (most recent call last):
  File "main.py", line 8, in <module>
    add_one()
    ~~~~~~~^^
  File "main.py", line 5, in add_one
    count = count + 1
            ^^^^^
UnboundLocalError: cannot access local variable 'count' where it is not associated with a value
```

Why? Python decides the scope of a name **before** the function runs. Because `add_one()` assigns to `count` (the `count = ...` part), Python treats `count` as a local variable for the whole function. Then, when it tries to read `count` on the right side, the local `count` has no value yet. Hence an **UnboundLocalError**.

### The global keyword

You can tell Python "I mean the global one" with the `global` keyword:

```python
count = 0


def add_one():
    global count
    count = count + 1


add_one()
add_one()
print(count)
```

Output:

```text
2
```

### The better way: pass in, return out

`global` works, but it makes code harder to follow. Any function could change the value at any time, so when something goes wrong you have to check every function. A cleaner habit is to pass the value in as an argument and send the new value back with `return`:

```python
def add_one(count):
    return count + 1


count = 0
count = add_one(count)
count = add_one(count)
print(count)
```

Output:

```text
2
```

Now `add_one()` is a small, predictable machine: same input, same output. It does not secretly change anything else.

> **Tip:** Global **constants** (values that never change) are perfectly fine. By convention, write them in capital letters, like `MAX_PLAYERS = 4` or `TAX_RATE = 0.2`.

### Mutating is not the same as assigning

There is one more twist. If a global variable holds a **mutable** object, like a list, a function can change the contents without `global`:

```python
shopping = ["milk"]


def add_item(item):
    shopping.append(item)


add_item("bread")
print(shopping)
```

Output:

```text
['milk', 'bread']
```

This works because `shopping.append(...)` does not assign a new value to the name `shopping`. It changes the list the name already points to. You can read more about this in [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying).

## Nested functions and nonlocal

You can define a function inside another function. The inner function can read the outer function's variables (the **E**, enclosing, in LEGB):

```python
def outer():
    level = "outer"

    def inner():
        print("inner() can see:", level)

    inner()


outer()
```

Output:

```text
inner() can see: outer
```

If the inner function needs to **change** an enclosing variable, use `nonlocal`. It works like `global`, but for the outer function's variable instead of the file's.

A classic example is a counter that remembers its total between calls:

```python
def make_counter():
    total = 0

    def click():
        nonlocal total
        total += 1
        return total

    return click


counter = make_counter()
print(counter())
print(counter())
print(counter())
```

Output:

```text
1
2
3
```

`make_counter()` returns the `click` function. Even after `make_counter()` has finished, `click` still remembers `total`. A function that remembers variables from the place where it was created is called a **closure**. You will see more functions being passed around in [Lambda and Higher-Order Functions](/courses/python/lambda-and-higher-order-functions), and closures are the secret behind [Decorators](/courses/python/decorators).

## Common mistakes

### Using a local variable outside its function

```text
NameError: name 'message' is not defined
```

**Fix:** `return` the value from the function and store it in a variable where you need it:

```python
def make_greeting():
    return "Hello"


message = make_greeting()
print(message)
```

### Assigning to a global without declaring it

```text
UnboundLocalError: cannot access local variable 'count' where it is not associated with a value
```

**Fix:** pass the value in and return the result (best), or add `global count` at the top of the function.

### Shadowing a built-in name

Because built-ins are searched last, your own variable can hide one:

```python
list = [3, 1, 2]
print(list)
numbers = list((4, 5))
```

Output:

```text
[3, 1, 2]
Traceback (most recent call last):
  File "main.py", line 3, in <module>
    numbers = list((4, 5))
TypeError: 'list' object is not callable
```

**Fix:** never name variables `list`, `dict`, `str`, `input`, `sum` or `max`. Use names like `items`, `scores` or `total` instead.

## Quick recap

- **Scope** is the part of your program where a name can be used.
- Variables created inside a function are **local**. They vanish when the function ends.
- Variables created at the top of a file are **global**. Functions can read them.
- Python looks up names with the **LEGB** rule: Local, Enclosing, Global, Built-in.
- Assigning to a name inside a function makes it local, unless you use `global` or `nonlocal`.
- Prefer passing values in and returning results over `global`.
- A **closure** is an inner function that remembers variables from its outer function.

Next, you will learn how to treat functions like values in [Lambda and Higher-Order Functions](/courses/python/lambda-and-higher-order-functions).

<code id="code-content" class="language-python">
# main.py: a tour of local, global and nonlocal scope
#
# A global constant: fine to read anywhere, written in CAPITALS
GREETING = "Hi"
#
def greet(name):
    # 'message' is local: it only exists while greet() runs
    message = f"{GREETING}, {name}!"
    return message
#
def add_points(score, points):
    # Pass values in and return the result instead of using global
    return score + points
#
def make_counter():
    total = 0  # enclosing variable
    #
    def click():
        nonlocal total  # change the outer function's 'total'
        total += 1
        return total
    #
    return click
#
if __name__ == "__main__":
    print(greet("Ada"))
    #
    score = 0
    score = add_points(score, 10)
    score = add_points(score, 5)
    print("Score:", score)
    #
    counter = make_counter()
    counter()
    counter()
    print("Clicks:", counter())
</code></pre>

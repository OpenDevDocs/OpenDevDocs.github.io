---
publishDate: 2026-10-27T09:03
title: 'Testing Your Code with pytest'
slug: testing-with-pytest
metadescription: 'Write automated tests for your Python code with pytest: assert, reading failures, testing errors, parametrize, fixtures and the tmp_path folder.'
updateDate: 2026-10-27T09:03
author: ['bishal-biswas']
level: 3
tags: ['python', 'testing', 'pytest']
course: python
---

## Why write tests?

So far you have checked your code by running it and looking at the output. That works once. But every time you change something, you would need to check **everything** again by hand, and it is easy to miss a bug that sneaks into a part you did not look at.

An **automated test** is a small piece of code that checks another piece of code for you. You write it once and run it as often as you like, in a second. If you break something, a test tells you right away, and exactly where. Think of tests as a **safety net** under a trapeze artist: you can try bold changes because a mistake will be caught.

Python has a built-in testing tool called `unittest`, but most Python developers prefer **pytest**. It is simpler to write, prints very clear failure messages, and has handy extras. You will use it in this lesson.

## Installing pytest

pytest is a third-party package, so install it inside your [virtual environment](/courses/python/virtual-environments):

```powershell
python -m pip install pytest
```

On macOS or Linux:

```bash
python3 -m pip install pytest
```

## The code we will test

Create a folder called `shop_project` with a file `shop.py`:

```python
def add_tax(price, rate=0.2):
    """Return the price with tax added, rounded to 2 decimals."""
    if price < 0:
        raise ValueError("price cannot be negative")
    return round(price * (1 + rate), 2)


def apply_discount(price, percent):
    """Take percent off the price."""
    return round(price - price * percent / 100, 2)
```

## Your first tests

In the same folder, create `test_shop.py`:

```python
from shop import add_tax, apply_discount


def test_add_tax_default_rate():
    assert add_tax(100) == 120.0


def test_add_tax_custom_rate():
    assert add_tax(50, rate=0.1) == 55.0


def test_apply_discount():
    assert apply_discount(80, 25) == 60.0
```

That is the whole idea of pytest:

- Test files are named `test_*.py` (or `*_test.py`).
- Test functions start with `test_`.
- Inside, you use the `assert` keyword. `assert something` means "this must be true". If it is true, nothing happens. If it is false, the test **fails**.

There is no special class to inherit and no special methods to learn. Tests are just [functions](/courses/python/functions).

## Running the tests

Open a terminal in the `shop_project` folder and run `pytest`:

```powershell
python -m pytest
```

On macOS or Linux, `python3 -m pytest` (or simply `pytest` when your virtual environment is active).

Output (your paths will differ):

```text
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.1.1, pluggy-1.7.0
rootdir: C:\Users\you\shop_project
collected 3 items

test_shop.py ...                                                         [100%]

============================== 3 passed in 0.03s ==============================
```

pytest found the test file by its name, ran all three test functions, and printed one dot per passing test. Add `-v` (verbose) to see each test by name:

```text
test_shop.py::test_add_tax_default_rate PASSED                           [ 33%]
test_shop.py::test_add_tax_custom_rate PASSED                            [ 66%]
test_shop.py::test_apply_discount PASSED                                 [100%]
```

## Reading a failing test

Tests are most useful when they fail. Let us add a bug on purpose. Change `apply_discount` to forget the percentage math:

```python
def apply_discount(price, percent):
    """Take percent off the price."""
    return round(price - percent, 2)
```

Run pytest again:

```text
test_shop.py ..F                                                         [100%]

================================== FAILURES ===================================
_____________________________ test_apply_discount _____________________________

    def test_apply_discount():
>       assert apply_discount(80, 25) == 60.0
E       assert 55 == 60.0
E        +  where 55 = apply_discount(80, 25)

test_shop.py:13: AssertionError
=========================== short test summary info ===========================
FAILED test_shop.py::test_apply_discount - assert 55 == 60.0
========================= 1 failed, 2 passed in 0.06s =========================
```

Read it from the top:

- `..F`: two passed, one **F**ailed.
- The `>` arrow points at the line that failed.
- `E assert 55 == 60.0` shows the real values: the function returned `55`, but the test expected `60.0`.
- `test_shop.py:13` gives the file and line number.

That is the magic of pytest: a plain `assert` gives you a detailed report. Fix the bug, run again, and you are back to green.

## Testing that errors are raised

Good code raises errors for bad input, as you learned in [Raising Errors and Custom Exceptions](/courses/python/raising-and-custom-exceptions). To test that, use `pytest.raises` with a `with` block (see [The with Statement](/courses/python/with-and-context-managers)). The test passes only if the error happens.

```python
import pytest

from shop import add_tax, apply_discount


def test_negative_price_is_rejected():
    with pytest.raises(ValueError, match="cannot be negative"):
        add_tax(-5)
```

`match=` also checks the error message, using a [regular expression](/courses/python/regular-expressions).

## Many cases with parametrize

Copying a test five times with different numbers is boring. `@pytest.mark.parametrize` is a [decorator](/courses/python/decorators) that runs one test with many sets of inputs:

```python
import pytest

from shop import apply_discount


@pytest.mark.parametrize(
    "price, percent, expected",
    [
        (100, 10, 90.0),
        (80, 25, 60.0),
        (50, 0, 50.0),
        (19.99, 100, 0.0),
    ],
)
def test_apply_discount_many(price, percent, expected):
    assert apply_discount(price, percent) == expected
```

Each [tuple](/courses/python/tuples-and-unpacking) becomes its own test, and pytest shows them separately:

```text
test_more.py::test_apply_discount_many[100-10-90.0] PASSED               [ 41%]
test_more.py::test_apply_discount_many[80-25-60.0] PASSED                [ 50%]
test_more.py::test_apply_discount_many[50-0-50.0] PASSED                 [ 58%]
test_more.py::test_apply_discount_many[19.99-100-0.0] PASSED             [ 66%]
```

Test edge cases this way: zero, 100 percent, empty lists, very big numbers.

## Comparing floats with approx

Computers store decimals slightly imprecisely:

```python
>>> 0.1 + 0.2 == 0.3
False
```

So for floats, use `pytest.approx()`, which allows a tiny difference:

```python
import pytest


def test_floats_need_approx():
    assert 0.1 + 0.2 == pytest.approx(0.3)
```

## Fixtures: shared test data

Many tests need the same starting data. A **fixture** is a function marked with `@pytest.fixture` that prepares it. Any test that has a parameter with the fixture's name gets a **fresh** copy automatically.

```python
import json

import pytest


@pytest.fixture
def cart():
    """A fresh cart for every test that asks for it."""
    return [("apple", 0.5, 4), ("bread", 2.25, 1)]


def test_cart_has_two_lines(cart):
    assert len(cart) == 2


def test_cart_total(cart):
    total = sum(price * qty for _, price, qty in cart)
    assert total == pytest.approx(4.25)


def test_save_cart(cart, tmp_path):
    file = tmp_path / "cart.json"
    file.write_text(json.dumps(cart))
    loaded = json.loads(file.read_text())
    assert loaded[0] == ["apple", 0.5, 4]
```

The last test also uses `tmp_path`, a fixture built into pytest. It gives you a brand new empty folder as a [pathlib](/courses/python/pathlib) `Path`, so tests that write files never touch your real files. (Notice the tuple came back as a list: [JSON](/courses/python/json-and-csv) has no tuples.)

## Useful command options

| Command | What it does |
| --- | --- |
| `pytest` | Run all tests in this folder and below |
| `pytest -v` | Show every test name |
| `pytest test_shop.py` | Run one file |
| `pytest -k discount` | Run only tests whose names contain "discount" |
| `pytest -x` | Stop at the first failure |
| `pytest --lf` | Rerun only the tests that failed last time |

For example, `pytest -k discount` on our project ends with:

```text
======================= 5 passed, 7 deselected in 0.03s =======================
```

## What makes a good test?

- **One idea per test**, with a name that says what it checks: `test_negative_price_is_rejected`.
- **Arrange, act, assert**: set up the data, call the function, check the result.
- **Fast and independent**: tests should not depend on each other or on the order they run in.
- **Test the edges**: empty input, zero, negative numbers, very large values.

Small, [clean functions](/courses/python/docstrings-and-clean-functions) that take inputs and return outputs are the easiest to test. That is one more reason to write them.

## Common mistakes

**1. Wrong file or function names.** A file called `shop_tests.py` does not match `test_*.py`, so pytest skips it:

```text
collected 0 items

============================ no tests ran in 0.03s ============================
```

Fix: rename the file to `test_shop.py`, and start every test function with `test_`.

**2. pytest is not installed in the Python you are using.**

```text
D:\Programs\Python\Python314\python.exe: No module named pytest
```

Fix: activate your virtual environment and run `python -m pip install pytest`.

**3. Forgetting `assert`.** A line like `add_tax(100) == 120.0` without `assert` checks nothing, so the test always passes. Every test needs at least one `assert`.

**4. Comparing floats with `==`.** Use `pytest.approx()` or round the values.

## Quick recap

- A test is a function named `test_...` in a file named `test_*.py` that uses `assert`.
- Run `pytest` (or `python -m pytest`) and read failures from the `>` and `E` lines.
- `pytest.raises` checks that an error is raised.
- `@pytest.mark.parametrize` runs one test with many inputs.
- Fixtures provide fresh shared data; `tmp_path` gives you a safe temporary folder.
- Use `pytest.approx()` for floats.

The [pytest page on PyPI](https://pypi.org/project/pytest/) links to the full documentation. Next, you will learn to do many things at once in [Async Python with asyncio](/courses/python/async-basics).

<code id="code-content" class="language-python">
# main.py: code and its tests in one file (in real projects, put tests in test_*.py)
# Install pytest first:  pip install pytest
# Run the tests with:     pytest main.py -v    (or just: python main.py)
import json
#
import pytest
#
#
def add_tax(price, rate=0.2):
    if price &lt; 0:
        raise ValueError("price cannot be negative")
    return round(price * (1 + rate), 2)
#
#
def apply_discount(price, percent):
    return round(price - price * percent / 100, 2)
#
#
# ---- tests: plain functions whose names start with test_ ----
def test_add_tax_default_rate():
    assert add_tax(100) == 120.0
#
#
def test_negative_price_is_rejected():
    with pytest.raises(ValueError, match="negative"):
        add_tax(-5)
#
#
@pytest.mark.parametrize("price, percent, expected", [
    (100, 10, 90.0),
    (80, 25, 60.0),
    (50, 0, 50.0),
])
def test_apply_discount(price, percent, expected):
    assert apply_discount(price, percent) == expected
#
#
@pytest.fixture
def cart():
    """Fresh test data for every test that asks for 'cart'."""
    return [("apple", 0.5, 4), ("bread", 2.25, 1)]
#
#
def test_cart_total(cart):
    assert sum(p * q for _, p, q in cart) == pytest.approx(4.25)
#
#
def test_save_and_load_cart(cart, tmp_path):
    file = tmp_path / "cart.json"  # tmp_path: a throwaway folder from pytest
    file.write_text(json.dumps(cart))
    assert json.loads(file.read_text())[1] == ["bread", 2.25, 1]
#
#
if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
</code></pre>

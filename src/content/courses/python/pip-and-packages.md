---
publishDate: 2026-10-27T08:40
title: 'Installing Packages with pip'
slug: pip-and-packages
metadescription: 'Install, upgrade and remove third-party Python packages with pip, find them on PyPI, pin versions and share your project setup with requirements.txt.'
updateDate: 2026-10-27T08:40
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'pip', 'packages']
course: python
---

## Code written by other people

The [standard library](/courses/python/standard-library-tour) is big, but it cannot cover everything. What if you want to make web requests easily, build a website, draw charts, or read Excel files? Someone has almost certainly already written that code and shared it for free.

A **package** is a bundle of Python code that someone has published so others can install it. These packages live on the **Python Package Index**, or **PyPI** for short, at [pypi.org](https://pypi.org). It holds hundreds of thousands of packages.

The tool that downloads and installs packages from PyPI is called **pip**. It comes with Python, so you already have it.

Think of PyPI as an app store and pip as the "Install" button.

In this lesson you will learn how to:

- Check that pip works
- Install, upgrade and remove packages
- See what is installed
- Save your project's package list in a `requirements.txt` file

## Before you start: use a virtual environment

Packages you install go into a folder that belongs to one Python installation. If you install everything into your main Python, different projects start fighting over package versions, and on some Linux and macOS systems pip will even refuse with an "externally managed environment" error.

The fix is a **virtual environment**: a private, throwaway Python folder for each project. You will learn all about it in the very next lesson, [Virtual Environments with venv](/courses/python/virtual-environments). For now, here is the quick recipe. Run it inside your project folder.

macOS and Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Windows (PowerShell):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Once it is **activated**, your prompt shows `(.venv)` at the start, and the plain `python` command points to the project's private Python on every system. All the commands below assume you have done this.

> **Note:** If PowerShell says running scripts is disabled, see the fix in [Virtual Environments with venv](/courses/python/virtual-environments).

## Checking pip

```bash
python -m pip --version
```

Output (your path and versions will differ):

```text
pip 25.3 from C:\my_project\.venv\Lib\site-packages\pip (python 3.14)
```

This shows the pip version, **where** it installs packages, and which Python it belongs to.

### Why python -m pip and not just pip?

You will often see tutorials type just `pip install ...`. That usually works, but if you have more than one Python on your computer, `pip` might belong to a different Python than the one you run your code with. Then you install a package and still get "No module named ...".

Writing `python -m pip` means "run the pip that belongs to **this** `python`". It is the safest habit, and it is what the Python docs recommend.

## Installing a package

Let's install **requests**, a very popular package for talking to websites:

```bash
python -m pip install requests
```

Output:

```text
Collecting requests
  Downloading requests-2.34.2-py3-none-any.whl.metadata (4.8 kB)
Collecting charset_normalizer<4,>=2 (from requests)
  Downloading charset_normalizer-3.5.2-cp314-cp314-win_amd64.whl.metadata (47 kB)
Collecting idna<4,>=2.5 (from requests)
  Downloading idna-3.20-py3-none-any.whl.metadata (7.2 kB)
Collecting urllib3<3,>=1.26 (from requests)
  Downloading urllib3-2.8.0-py3-none-any.whl.metadata (7.4 kB)
Collecting certifi>=2023.5.7 (from requests)
  Downloading certifi-2026.10.23-py3-none-any.whl.metadata (2.5 kB)
...
Installing collected packages: urllib3, idna, charset_normalizer, certifi, requests

Successfully installed certifi-2026.10.23 charset_normalizer-3.5.2 idna-3.20 requests-2.34.2 urllib3-2.8.0
```

You asked for one package, but pip installed five. That is because `requests` itself uses four other packages. These are called **dependencies**, and pip finds and installs them for you automatically.

The files ending in `.whl` are **wheels**: ready-to-install package files. If you install something a second time, pip may say "Using cached" instead of "Downloading", because it keeps a copy.

Now you can [import](/courses/python/modules-and-imports) it like any other module:

```python
import requests

response = requests.get("https://pypi.org/pypi/requests/json", timeout=10)
print(response.status_code)
data = response.json()
print(data["info"]["summary"])
```

Output:

```text
200
Python HTTP for Humans.
```

This asks PyPI for information about the `requests` package itself. `200` means "OK". You will use `requests` properly in [Calling Web APIs with requests](/courses/python/calling-web-apis).

> **Tip:** The name you `pip install` is usually the same as the name you `import`, but not always. For example, you install `beautifulsoup4` but write `import bs4`, and you install `Pillow` but write `import PIL`. The package's PyPI page always shows how to import it.

## Another example: humanize

Here is a small package that turns numbers into friendly text:

```bash
python -m pip install humanize
```

```python
import humanize

print(humanize.intcomma(1234567))
print(humanize.naturalsize(3_500_000))
print(humanize.intword(2_300_000_000))
```

Output:

```text
1,234,567
3.5 MB
2.3 billion
```

## Seeing what is installed

`pip list` shows every package in the current environment:

```bash
python -m pip list
```

Output:

```text
Package            Version
------------------ ----------
certifi            2026.10.23
charset-normalizer 3.5.2
humanize           4.16.0
idna               3.20
pip                25.3
requests           2.34.2
urllib3            2.8.0
```

`pip show` gives details about one package, including what it needs (`Requires`) and what needs it (`Required-by`):

```bash
python -m pip show requests
```

Output:

```text
Name: requests
Version: 2.34.2
Summary: Python HTTP for Humans.
Home-page: 
Author: 
Author-email: Kenneth Reitz <me@kennethreitz.org>
License: Apache-2.0
Location: C:\my_project\.venv\Lib\site-packages
Requires: certifi, charset_normalizer, idna, urllib3
Required-by: 
```

To see which packages have newer versions available:

```bash
python -m pip list --outdated
```

## Choosing versions

Packages change over time. Sometimes a new version changes how things work and breaks your code. So you can ask pip for a specific version, using quotes so your terminal does not misread the symbols:

| Command | Installs |
|---|---|
| `python -m pip install "humanize==4.9.0"` | Exactly version 4.9.0 |
| `python -m pip install "humanize>=4.9"` | 4.9 or anything newer |
| `python -m pip install "humanize>=4.9,<5"` | At least 4.9, but not version 5 |
| `python -m pip install --upgrade humanize` | The newest version |

Here is upgrading from an old version to the latest:

```bash
python -m pip install --upgrade humanize
```

Output:

```text
Requirement already satisfied: humanize in c:\my_project\.venv\lib\site-packages (4.9.0)
Collecting humanize
  Downloading humanize-4.16.0-py3-none-any.whl.metadata (8.0 kB)
Downloading humanize-4.16.0-py3-none-any.whl (137 kB)
Installing collected packages: humanize
  Attempting uninstall: humanize
    Found existing installation: humanize 4.9.0
    Uninstalling humanize-4.9.0:
      Successfully uninstalled humanize-4.9.0
Successfully installed humanize-4.16.0
```

Version numbers usually follow the pattern **MAJOR.MINOR.PATCH**. A change in the first number (like 4 to 5) often means something may break.

## Removing a package

```bash
python -m pip uninstall humanize
```

pip asks you to confirm with `y`. Add `-y` to skip the question:

```text
Found existing installation: humanize 4.16.0
Uninstalling humanize-4.16.0:
  Successfully uninstalled humanize-4.16.0
```

Note that uninstalling a package does **not** remove its dependencies.

## Sharing your setup: requirements.txt

When you send your project to a friend, or put it on a server, they need the same packages. The tradition is a text file called `requirements.txt` that lists them. `pip freeze` prints the installed packages in exactly the right format:

```bash
python -m pip freeze > requirements.txt
```

The `>` sends the output into the file instead of the screen. Now `requirements.txt` contains:

```text
certifi==2026.10.23
charset-normalizer==3.5.2
humanize==4.16.0
idna==3.20
requests==2.34.2
urllib3==2.8.0
```

On another computer (inside a fresh virtual environment), one command installs everything:

```bash
python -m pip install -r requirements.txt
```

Output (the end):

```text
Installing collected packages: urllib3, idna, humanize, charset-normalizer, certifi, requests

Successfully installed certifi-2026.10.23 charset-normalizer-3.5.2 humanize-4.16.0 idna-3.20 requests-2.34.2 urllib3-2.8.0
```

You can also write `requirements.txt` by hand, listing just the packages you use directly, with version ranges like `requests>=2.31,<3`. This file is also how Docker images install Python packages, as you can see in [Project: Dockerizing a Python App](/courses/docker/dockerizing-a-python-app).

## Finding good packages

Search on [pypi.org](https://pypi.org) or the web. Before installing, quickly check:

- Is it **popular** and **recently updated**?
- Does it have **documentation** and a clear PyPI page?
- Is the name spelled **exactly** right? Attackers sometimes publish fake packages with names one letter off from popular ones (this is called **typosquatting**).

## Common mistakes

### ModuleNotFoundError after installing

```text
Traceback (most recent call last):
  File "main.py", line 1, in <module>
    import humanize
ModuleNotFoundError: No module named 'humanize'
```

This almost always means the package was installed into a **different Python** than the one running your code. **Fix:** activate your virtual environment, install with `python -m pip install humanize`, and run with that same `python`. In VS Code, check the Python interpreter shown in the bottom bar ([Setting Up VS Code for Python](/courses/python/setting-up-vs-code)).

### A misspelled package name

```bash
python -m pip install reqeusts-not-a-real-pkg-xyz
```

Output:

```text
ERROR: Could not find a version that satisfies the requirement reqeusts-not-a-real-pkg-xyz (from versions: none)
ERROR: No matching distribution found for reqeusts-not-a-real-pkg-xyz
```

**Fix:** check the exact name on pypi.org. Be careful: a misspelled name might also exist and be a fake package.

### Running pip inside the Python REPL

`pip install` is a **terminal** command, not Python code. If you type it after `>>>`, you get a `SyntaxError`. **Fix:** exit the REPL with `exit()` first, then run the command in your terminal.

### Using sudo pip on Linux or macOS

Running `sudo pip install` changes the system's own Python and can break operating system tools. **Fix:** never use `sudo` with pip. Use a virtual environment instead.

## Quick recap

- **PyPI** is the online store of Python packages, and **pip** installs them.
- Always use `python -m pip ...` so pip matches the Python you run.
- Work inside a **virtual environment** so each project has its own packages.
- `install`, `install --upgrade`, `uninstall`, `list`, `show` and `freeze` cover daily use.
- Pin versions with `==` or ranges like `>=4.9,<5`.
- Save your packages with `pip freeze > requirements.txt` and restore them with `pip install -r requirements.txt`.

Next, you will learn exactly how those private project folders work in [Virtual Environments with venv](/courses/python/virtual-environments).

<code id="code-content" class="language-python">
"""main.py: check which packages are installed, and use one if it is there."""
import sys
from importlib.metadata import PackageNotFoundError, version
#
WANTED = ["pip", "requests", "humanize"]
#
def installed_version(name: str) -&gt; str | None:
    """Return the installed version of a package, or None if missing."""
    try:
        return version(name)
    except PackageNotFoundError:
        return None
#
def friendly_number(n: int) -&gt; str:
    """Use humanize if it is installed, otherwise fall back to an f-string."""
    try:
        import humanize  # installed with: python -m pip install humanize
    except ImportError:
        return f"{n:,}"
    return humanize.intword(n)
#
if __name__ == "__main__":
    print("Python running from:", sys.executable)
    for name in WANTED:
        found = installed_version(name)
        if found:
            print(f"  {name:&lt;10} {found}")
        else:
            print(f"  {name:&lt;10} not installed (python -m pip install {name})")
    print("Big number:", friendly_number(2_300_000_000))
</code></pre>

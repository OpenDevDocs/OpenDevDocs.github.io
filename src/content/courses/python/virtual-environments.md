---
publishDate: 2026-10-27T08:41
title: 'Virtual Environments with venv'
slug: virtual-environments
metadescription: 'Create, activate and use Python virtual environments with venv on Windows, macOS and Linux, so every project keeps its own separate set of packages.'
updateDate: 2026-10-27T08:41
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'venv', 'packages']
course: python
---

## The problem: one shared toolbox

In [Installing Packages with pip](/courses/python/pip-and-packages) you installed packages from PyPI. By default, pip puts them into your main Python installation, and every project on your computer shares them.

That sounds handy, until this happens:

- Your old project needs version 1 of a package.
- Your new project needs version 2 of the same package.
- Only one version can be installed at a time. Upgrading for the new project breaks the old one.

It is like a family sharing one toolbox. Someone swaps the screwdriver for a different size, and now your project does not fit anymore.

The solution is a **virtual environment**: a private folder for each project, with its own copy of the Python command and its own packages. What you install inside one project's environment cannot affect any other project.

Python includes a module called `venv` that creates them. No extra installs needed.

## Creating a virtual environment

Open a terminal **in your project folder**. For example, a project called `weather_app`:

macOS and Linux:

```bash
cd weather_app
python3 -m venv .venv
```

Windows (PowerShell):

```powershell
cd weather_app
python -m venv .venv
```

(On Windows you can also use the launcher: `py -m venv .venv`.)

Read the command as: "Python, run the `venv` module and create an environment in a folder called `.venv`." It prints nothing when it works. It just takes a few seconds.

> **Tip:** You can name the folder anything, but `.venv` is the most common choice. VS Code and many other tools look for that name automatically. The dot at the start also hides it in some file browsers.

### What is inside?

On Windows the new folder looks like this:

```text
weather_app/
    .venv/
        Include/
        Lib/
            site-packages/
        Scripts/
            activate
            activate.bat
            Activate.ps1
            deactivate.bat
            pip.exe
            python.exe
        .gitignore
        pyvenv.cfg
```

On macOS and Linux, `Scripts` is called `bin` and `Lib` is `lib`, but the idea is the same:

- `Scripts/` (or `bin/`) holds the environment's own `python` and `pip` commands, plus the **activate** scripts.
- `Lib/site-packages/` is where packages you install will go.
- `pyvenv.cfg` is a small settings file that points back to the Python it was made from:

```text
home = D:\Programs\Python\Python314
include-system-site-packages = false
version = 3.14.3
executable = D:\Programs\Python\Python314\python.exe
```

The environment does not copy all of Python. It borrows the standard library from your main installation and only keeps the packages separate.

## Activating the environment

**Activating** an environment tells your current terminal window: "for now, when I type `python` or `pip`, use the ones in `.venv`".

macOS and Linux (bash or zsh):

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Windows Command Prompt (cmd):

```text
.venv\Scripts\activate.bat
```

When it works, your prompt changes to show the environment name in brackets:

```text
(.venv) PS C:\projects\weather_app>
```

That `(.venv)` is your reminder that the environment is active.

### Checking which Python you are using

You can ask your terminal where `python` now points:

```powershell
(Get-Command python).Source
```

```bash
which python
```

Output on Windows:

```text
C:\projects\weather_app\.venv\Scripts\python.exe
```

Or ask Python itself. Save this as `where.py`:

```python
import sys

print("Running:", sys.executable)
print("In a venv?", sys.prefix != sys.base_prefix)
```

Run it before and after activating:

```text
Running: D:\Programs\Python\Python314\python.exe
In a venv? False
```

```text
Running: C:\projects\weather_app\.venv\Scripts\python.exe
In a venv? True
```

`sys.prefix` is the environment's folder, and `sys.base_prefix` is the main Python. If they are different, you are inside a virtual environment.

## Installing packages inside it

With the environment active, install packages as usual. They land in `.venv` only:

```bash
python -m pip install requests
```

A brand new environment starts almost empty:

```bash
python -m pip list
```

Output:

```text
Package Version
------- -------
pip     25.3
```

This clean start is a feature. Your project only gets the packages you deliberately add, which makes your `requirements.txt` accurate.

> **Note:** When an environment is active, `python` and `pip` work the same on every system, even on macOS and Linux where you normally type `python3`.

## Deactivating

When you are done, go back to your normal Python with:

```bash
deactivate
```

The `(.venv)` disappears from the prompt. Closing the terminal window does the same thing. Nothing is deleted. Next time, just activate again.

## The everyday workflow

Here is the full routine for a new project:

```bash
mkdir weather_app
cd weather_app
python3 -m venv .venv
source .venv/bin/activate
python -m pip install requests
python -m pip freeze > requirements.txt
python main.py
```

The same on Windows:

```powershell
mkdir weather_app
cd weather_app
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install requests
python -m pip freeze > requirements.txt
python main.py
```

And for a project you downloaded from someone else (it has a `requirements.txt` but no `.venv`):

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

### Do not share the .venv folder

A virtual environment is tied to your computer and its exact paths. It cannot be copied to another machine, and it can be big. Share `requirements.txt` instead, and let others build their own environment from it.

Since Python 3.13, `venv` even adds a `.gitignore` file inside `.venv` that contains `*`, so Git skips the folder automatically. On older versions, add `.venv/` to your project's own `.gitignore`. Docker projects ignore it the same way, as shown in [Project: Dockerizing a Python App](/courses/docker/dockerizing-a-python-app).

If an environment gets messed up, you can simply delete the `.venv` folder and create it again in a minute.

### Running without activating

Activation is just a convenience. You can always call the environment's Python directly by its path:

```bash
.venv/bin/python main.py
```

```powershell
.venv\Scripts\python.exe main.py
```

This is handy in scripts and scheduled tasks.

## Using it in VS Code

VS Code usually spots a `.venv` folder in your project and offers to use it. To choose it yourself:

1. Press `Ctrl+Shift+P` (`Cmd+Shift+P` on a Mac).
2. Type **Python: Select Interpreter**.
3. Pick the one whose path contains `.venv`.

New terminals inside VS Code will then activate it for you. See [Setting Up VS Code for Python](/courses/python/setting-up-vs-code) for more editor setup.

## Common mistakes

### PowerShell refuses to run Activate.ps1

On a fresh Windows computer, activating may fail with a red error saying that running scripts is **disabled on this system**. Windows blocks PowerShell scripts by default. **Fix:** allow scripts for your own user account (you only need to do this once):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Or use Command Prompt and `activate.bat` instead.

### Installing before activating

If you forget to activate, `pip install` puts the package into your main Python, and your project's environment still does not have it. Running your code then gives `ModuleNotFoundError`. **Fix:** look for `(.venv)` in the prompt before installing. If it is missing, activate first and install again.

### Moving or renaming the project folder

Environments remember their full path. After moving the project, the activate scripts and `pip` may stop working. **Fix:** delete `.venv` and create a new one, then `pip install -r requirements.txt`.

### Creating the environment in the wrong place

If you run `python -m venv .venv` in your home folder instead of the project folder, the environment ends up in the wrong place. **Fix:** always `cd` into the project first. Each project gets its own `.venv` inside it.

## Quick recap

- A **virtual environment** is a private Python folder for one project, with its own packages.
- Create it with `python -m venv .venv` (or `python3` on macOS and Linux).
- Activate with `source .venv/bin/activate` (macOS/Linux) or `.venv\Scripts\Activate.ps1` (Windows). Look for `(.venv)` in the prompt.
- Install packages only after activating. Leave with `deactivate`.
- Share `requirements.txt`, never the `.venv` folder.
- If something breaks, delete `.venv` and recreate it.

Next, you will organize a bigger project into folders of modules in [Organizing Code into Packages and __main__](/courses/python/creating-packages).

<code id="code-content" class="language-python">
"""main.py: report whether this script runs inside a virtual environment."""
import sys
from importlib.metadata import distributions
from pathlib import Path
#
def in_virtual_env() -&gt; bool:
    """True when sys.prefix (current env) differs from the base Python."""
    return sys.prefix != sys.base_prefix
#
def installed_packages() -&gt; list[str]:
    """Return 'name==version' for every package in this environment."""
    found = {f"{d.metadata['Name']}=={d.version}" for d in distributions()}
    return sorted(found, key=str.lower)
#
if __name__ == "__main__":
    print("Python:", sys.version.split()[0])
    print("Running from:", sys.executable)
    #
    if in_virtual_env():
        print("Inside a virtual environment at", Path(sys.prefix).name)
    else:
        print("Not in a virtual environment.")
        print("Create one with: python -m venv .venv")
    #
    packages = installed_packages()
    print(f"{len(packages)} package(s) installed here:")
    for line in packages[:10]:
        print("  ", line)
</code></pre>

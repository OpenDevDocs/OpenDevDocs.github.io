---
publishDate: 2026-10-27T08:01
title: 'Installing Python on Windows, macOS and Linux'
slug: installing-python
metadescription: 'Install Python 3 on Windows, macOS or Linux, add it to your PATH, and check that python, py, python3 and pip all work from your terminal.'
updateDate: 2026-10-27T08:01
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'setup']
course: python
---

## Getting Python onto your computer

In [What is Python and Why Learn It?](/courses/python/what-is-python) you learned that the **Python interpreter** is the program that reads and runs your code. Before you can write any Python, you need to install that interpreter.

This lesson walks you through it on Windows, macOS and Linux. Jump to the section for your system, then read the "Check that it works" section at the end, which is the same for everyone.

## A few words you will need

Before you start, here are some terms that show up during installation:

- **Terminal**: a window where you type commands instead of clicking. On Windows it is called **PowerShell** or **Command Prompt** (or the Windows Terminal app). On macOS it is the **Terminal** app. On Linux it is usually also called Terminal.
- **Command**: a line of text you type into the terminal and run by pressing Enter.
- **PATH**: a list of folders where your computer looks for programs when you type a command. If Python's folder is on the PATH, you can type `python` from anywhere. If it is not, the terminal says it cannot find it.
- **pip**: Python's tool for installing extra packages. It comes with Python. You will use it in [Installing Packages with pip](/courses/python/pip-and-packages).

> **Note:** Think of PATH like the contacts list on your phone. If a name is in the list, you can call it by name. If it is not, the phone has no idea who you mean.

## Which version should you install?

Always install the latest stable **Python 3** release from the official site, [python.org/downloads](https://www.python.org/downloads/). This course was tested with Python 3.14. Any recent Python 3 version will work for almost every lesson, and a few lessons mention when a feature needs a minimum version (for example, `match` needs Python 3.10 or newer).

Do not install Python 2. It is no longer supported.

## Installing on Windows

### Step 1: Download

Go to [python.org/downloads](https://www.python.org/downloads/) and click the big download button for Windows. Recent releases offer the **Python Install Manager**, a small tool that installs and updates Python versions for you, and you may also see a classic installer (a `.exe` file). Either one is fine for this course. Follow the on-screen steps.

### Step 2: Run the installer

If you use the classic installer, the first screen has a very important checkbox at the bottom:

```text
[x] Add python.exe to PATH
```

**Tick this box.** It puts Python on your PATH so that the `python` command works in any terminal. Then click **Install Now**.

> **Warning:** Forgetting the "Add python.exe to PATH" box is the most common Windows installation problem. If you missed it, run the installer again, choose **Modify**, and turn on the PATH option.

### Step 3: Open a new terminal

Close any terminal windows you already had open (they do not see the new PATH). Then open **PowerShell** from the Start menu and type:

```powershell
python --version
```

Output:

```text
Python 3.14.3
```

Your version number may be a little different. That is fine, as long as it starts with `Python 3`.

### The py launcher

Windows also has a helper called the **py launcher**. It is a short command, `py`, that finds and runs the Python versions installed on your PC:

```powershell
py --version
```

Output:

```text
Python 3.14.3
```

You can list every installed version with `py -0`:

```powershell
py -0
```

Output:

```text
 -V:3.14 *        Python 3.14 (64-bit)
```

The `*` marks the default version. In this course you can use `python` or `py` on Windows. Both run the same interpreter.

### Watch out for the Microsoft Store alias

Some Windows PCs have a shortcut that opens the Microsoft Store when you type `python` and Python is not installed yet. If that happens, either install Python from python.org as shown above, or turn off the shortcut in **Settings > Apps > Advanced app settings > App execution aliases**.

## Installing on macOS

Many Macs do not come with a usable, up-to-date Python 3 for development. You have two good options.

### Option A: The official installer (easiest)

1. Go to [python.org/downloads](https://www.python.org/downloads/) and download the macOS installer (a `.pkg` file).
2. Open it and click through the steps.
3. When it finishes, open the **Terminal** app (press Cmd + Space, type "Terminal", press Enter).

### Option B: Homebrew

If you already use **Homebrew** (a popular tool for installing software on macOS), run:

```bash
brew install python
```

### Check it

On macOS, the command is `python3`, not `python`:

```bash
python3 --version
```

Output:

```text
Python 3.14.3
```

> **Tip:** On macOS and Linux, get into the habit of typing `python3` and `pip3`. The plain `python` command may not exist, or may point to something else.

## Installing on Linux

Most Linux systems already include Python 3, because the system itself uses it. First check what you have:

```bash
python3 --version
```

If you see `Python 3.something`, you are ready. If the command is missing, or you also want `pip` and the `venv` tool (you will need them later), install them with your package manager.

On Ubuntu, Debian and similar systems:

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

On Fedora:

```bash
sudo dnf install python3 python3-pip
```

`sudo` runs the command as an administrator, so it will ask for your password.

> **Warning:** On Linux, do not remove or replace the system Python. Parts of the operating system depend on it. If you need a newer version later, install it side by side, and keep each project in a [virtual environment](/courses/python/virtual-environments).

## Check that it works

Now let's make sure both Python and pip are ready. Use `python` (or `py`) on Windows and `python3` on macOS/Linux.

Windows:

```powershell
python --version
python -m pip --version
```

macOS/Linux:

```bash
python3 --version
python3 -m pip --version
```

Output (Windows example, your paths will differ):

```text
Python 3.14.3
pip 25.3 from D:\Programs\Python\Python314\Lib\site-packages\pip (python 3.14)
```

`python -m pip` means "run the pip module using this exact Python". It is the safest way to call pip, because it always matches the Python you just checked.

You can also ask Python about itself with a tiny program. Do not worry about how it works yet; `import` is covered in [Modules and import](/courses/python/modules-and-imports).

```python
import sys

print(sys.version_info)
print(sys.executable)
```

Output (on Windows):

```text
sys.version_info(major=3, minor=14, micro=3, releaselevel='final', serial=0)
D:\Programs\Python\Python314\python.exe
```

`sys.executable` shows exactly which `python.exe` file is running. This is very useful when you have more than one Python installed and want to know which one you are using.

## Common mistakes

### "python is not recognized"

On Windows you may see:

```text
python : The term 'python' is not recognized as the name of a cmdlet, function, script file, or operable program.
Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
```

**Fix:** Python is not on your PATH, or the terminal was open before you installed it. Close and reopen PowerShell first. If that does not help, rerun the installer, choose **Modify**, and enable "Add python.exe to PATH". You can also try `py --version`, which often works even when `python` does not.

### "command not found: python" on macOS or Linux

```text
zsh: command not found: python
```

**Fix:** Use `python3` instead of `python`.

### Typing Python commands into the wrong place

`python --version` is a **terminal** command. If you type it inside the Python interactive shell (where the prompt is `>>>`), you get an error. You will meet that shell in [The Python Interactive Shell (REPL)](/courses/python/python-repl). Type `exit()` to leave it and get back to the normal terminal.

### Installing packages with the wrong pip

If you have several Pythons, plain `pip` might belong to a different one. Use `python -m pip` (Windows) or `python3 -m pip` (macOS/Linux) so the two always match.

## Quick recap

- Download Python 3 from [python.org](https://www.python.org/downloads/). Never install Python 2.
- On Windows, tick **Add python.exe to PATH** and use `python` or `py`.
- On macOS and Linux, use `python3`.
- Check your install with `python --version` (or `python3 --version`).
- Run pip as `python -m pip` so it matches your Python.
- `sys.executable` tells you exactly which Python is running.

Python is installed. Time to write some code: [Writing and Running Your First Python Program](/courses/python/first-python-program).

<code id="code-content" class="language-python">
# main.py: check your Python installation
# Run it with:  python main.py   (Windows)
#          or:  python3 main.py  (macOS/Linux)
#
# sys and platform are part of the standard library,
# so they are already installed with Python.
import sys
import platform
#
print("Python is installed and working!")
print("Version:", platform.python_version())
print("Operating system:", platform.system())
print("Interpreter file:", sys.executable)
#
# version_info lets you compare versions as numbers
major = sys.version_info.major
minor = sys.version_info.minor
#
if major &lt; 3:
    print("This is Python 2. Please install Python 3.")
elif minor &lt; 10:
    print("This works, but a newer Python 3 is recommended.")
else:
    print("Great, you have a modern Python 3.")
#
# pip ships with Python; this just checks that it can be found
try:
    import pip
    print("pip version:", pip.__version__)
except ImportError:
    print("pip is missing. Try: python -m ensurepip --upgrade")
</code></pre>

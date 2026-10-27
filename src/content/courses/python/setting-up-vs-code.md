---
publishDate: 2026-10-27T08:04
title: 'Setting Up VS Code for Python'
slug: setting-up-vs-code
metadescription: 'Install Visual Studio Code and the Python extension, pick the right interpreter, run and debug .py files, and set up helpful settings for beginners.'
updateDate: 2026-10-27T08:04
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'vscode', 'setup']
course: python
---

## Why use a code editor?

So far you have written Python in a plain text editor and run it from the terminal (see [Writing and Running Your First Python Program](/courses/python/first-python-program)). That works, but it is like writing an essay in a notepad with no spell checker.

A **code editor** is a text editor built for programming. It colors your code so it is easier to read, warns you about mistakes before you run anything, suggests names as you type, and runs your program with one click.

In this course we use **Visual Studio Code** (usually called **VS Code**). It is free, runs on Windows, macOS and Linux, and is one of the most popular editors for Python.

> **Note:** VS Code is not the same as "Visual Studio", which is a different, much bigger program. Make sure you download VS Code.

## Step 1: Install VS Code

1. Go to [code.visualstudio.com](https://code.visualstudio.com/) and download the version for your system.
2. Run the installer.
   - On **Windows**, tick the options **"Add to PATH"** and **"Add 'Open with Code' action"**. They let you open folders from the terminal and from File Explorer.
   - On **macOS**, drag VS Code into your Applications folder.
   - On **Linux**, use the `.deb` or `.rpm` package, or your distribution's software center.
3. Open VS Code.

On macOS, to use the `code` command in the terminal, open the **Command Palette** (Cmd + Shift + P), type `shell command`, and choose **Shell Command: Install 'code' command in PATH**.

The **Command Palette** is a search box for every action in VS Code. Open it with **Ctrl + Shift + P** (Windows/Linux) or **Cmd + Shift + P** (macOS). You will use it a lot.

## Step 2: Install the Python extension

An **extension** is an add-on that teaches VS Code new skills. VS Code does not understand Python well until you add the official Python extension from Microsoft.

1. Click the **Extensions** icon on the left side bar (it looks like four small squares), or press **Ctrl + Shift + X** (Cmd + Shift + X on macOS).
2. Search for `Python`.
3. Install the one named **Python** published by **Microsoft**.

You can also install it from the terminal:

```bash
code --install-extension ms-python.python
```

The Python extension also installs **Pylance**, which powers the smart features: error underlines, auto-complete and "go to definition". It also adds the Python debugger.

## Step 3: Open your project folder

VS Code works best when you open a whole **folder**, not a single file. Open the `python-practice` folder you made in the last lessons:

- Use **File > Open Folder...** and pick the folder, or
- From a terminal inside that folder, run:

```bash
code .
```

The `.` means "the current folder". If VS Code asks whether you trust the authors of the files in this folder, choose **Yes** for your own practice folder.

## Step 4: Select the Python interpreter

If you have more than one Python installed, VS Code needs to know which one to use. This is called selecting the **interpreter**.

1. Open the Command Palette (Ctrl + Shift + P).
2. Type `Python: Select Interpreter` and press Enter.
3. Pick the Python 3 version you installed (for example, Python 3.14).

The selected version shows in the bottom right corner of the window (the **status bar**) whenever a `.py` file is open. Later, when you use [virtual environments](/courses/python/virtual-environments), you will select the environment's Python here instead.

## Step 5: Write and run a file

Create a new file called `greet.py` (click the "New File" icon in the Explorer panel, or use **File > New File**) and type:

```python
name = "Ada"
language = "Python"

print("Hello,", name)
print("Welcome to", language)
```

Save it with **Ctrl + S** (Cmd + S on macOS).

Now run it. Click the **Run Python File** button (a triangle "play" icon) in the top right corner of the editor. A **terminal panel** opens at the bottom of the window and shows:

```text
Hello, Ada
Welcome to Python
```

Behind the scenes, VS Code typed a command like `python greet.py` for you, using the interpreter you selected.

### The built-in terminal

VS Code has a terminal inside it, so you do not need a separate window. Open it with **Ctrl + `** (the backtick key, usually above Tab), or **View > Terminal**. You can run any command there:

```powershell
python greet.py
```

```bash
python3 greet.py
```

> **Tip:** The built-in terminal opens in your project folder automatically, so you do not need to `cd` around.

## What the editor does for you

Now that everything is set up, you get several helpers for free.

### Syntax highlighting

Different parts of your code get different colors: strings in one color, numbers in another, keywords like `if` and `for` in a third. This makes code much easier to scan, and a string that is missing its closing quote stands out immediately.

### Error squiggles

If you make a mistake, VS Code underlines it with a wavy red or yellow line, before you even run the code. Hover over the line to read the message. For example, if you type `Print("hi")` with a capital P, Pylance warns that `"Print" is not defined`.

The **Problems** panel (Ctrl + Shift + M) lists every warning in your files.

### Auto-complete

Start typing `pri` and VS Code suggests `print`. Press **Tab** or **Enter** to accept. It also shows a small help box with the function's arguments.

### Hover help

Hover your mouse over a function like `len` to see what it does. It is the same text as `help(len)` in the [REPL](/courses/python/python-repl), right inside your editor.

## Running code with the debugger

A **debugger** lets you pause your program in the middle and look inside. It is a superpower for finding mistakes.

Try it with this file, `total.py`:

```python
prices = [4.50, 2.25, 3.00]
total = 0

for price in prices:
    total = total + price

print("Total:", total)
```

Output:

```text
Total: 9.75
```

1. Click in the empty space just left of the line number for `total = total + price`. A red dot appears. This is a **breakpoint**: a "pause here" sign.
2. Press **F5** (or use the small arrow next to the Run button and choose **Python Debugger: Debug Python File**).
3. The program stops at the red dot. The **Variables** panel on the left shows the current values of `price` and `total`.
4. Press **F10** to run one line at a time, or **F5** to continue to the next pause.

Watch `total` grow from `0` to `4.5`, then `6.75`, then `9.75`. You will learn many more ways to find bugs in [Debugging Python Code](/courses/python/debugging-python).

## Helpful settings for beginners

Open the settings with **Ctrl + ,** (Cmd + , on macOS) and search for these:

| Setting | Suggested value | Why |
| --- | --- | --- |
| Files: Auto Save | `afterDelay` | Saves your file automatically, so you never run old code by accident |
| Editor: Font Size | Whatever is comfortable | Bigger text is easier on the eyes |
| Editor: Render Whitespace | `boundary` | Shows dots for spaces, which helps with Python's indentation |
| Editor: Tab Size | `4` | Python code uses 4 spaces per indentation level |

The Python extension already sets VS Code to insert 4 spaces when you press Tab in a `.py` file, which is exactly what Python style recommends.

## Common mistakes

### Running old code

You change the file, click Run, and see the old output. **Fix:** you forgot to save. A white dot on the file's tab means "unsaved changes". Press Ctrl + S, or turn on Auto Save.

### The wrong Python is used

The terminal shows an error like `No module named ...` even though you installed something, or the version is not what you expected. **Fix:** check the interpreter in the status bar and change it with **Python: Select Interpreter**.

### Opening a single file instead of the folder

If you open only one file, some features (like running files next to each other or finding your other code) do not work well. **Fix:** use **File > Open Folder...** or `code .`.

### Typing Python code into the terminal panel

The terminal panel is a normal terminal (PowerShell, bash or zsh), not Python. Typing `print("hi")` there gives a shell error. **Fix:** write code in the editor and run the file, or start the REPL first by typing `python` (or `python3`).

## Quick recap

- VS Code is a free code editor. Install it from [code.visualstudio.com](https://code.visualstudio.com/).
- Add the **Python** extension by Microsoft. It brings Pylance and the debugger.
- Open your project **folder**, then pick your interpreter with **Python: Select Interpreter**.
- Run a file with the play button or from the built-in terminal (Ctrl + `).
- Use breakpoints and F5 to pause and inspect your program.
- Save often, or turn on Auto Save.

Your tools are ready. Now let's look at the rules of Python code itself: [Python Syntax: Comments, Indentation and Statements](/courses/python/syntax-comments-indentation).

<code id="code-content" class="language-python">
# main.py: a small file to test your VS Code setup
# 1. Open this folder in VS Code (File &gt; Open Folder, or "code .")
# 2. Select your interpreter (Ctrl+Shift+P, "Python: Select Interpreter")
# 3. Click the Run button (top right) to run the file
# 4. Put a breakpoint on the "total = total + price" line and press F5
#
import sys
#
# Shows which Python VS Code is using
print("Running with Python", sys.version.split()[0])
print("Interpreter:", sys.executable)
print()
#
name = "Ada"
language = "Python"
print("Hello,", name)
print("Welcome to", language)
print()
#
# Step through this loop with F10 and watch "total" change
prices = [4.50, 2.25, 3.00]
total = 0
for price in prices:
    total = total + price
    print("Added", price, "so total is now", total)
#
print("Total:", total)
</code></pre>

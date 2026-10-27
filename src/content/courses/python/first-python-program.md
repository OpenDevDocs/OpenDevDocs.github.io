---
publishDate: 2026-10-27T08:02
title: 'Writing and Running Your First Python Program'
slug: first-python-program
metadescription: 'Write your first Python program in a .py file, run it from the terminal, use print() to show text, and read the first error messages you will meet.'
updateDate: 2026-10-27T08:02
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'basics']
course: python
---

## Your first real program

Python is installed (if not, go back to [Installing Python on Windows, macOS and Linux](/courses/python/installing-python)). Now you will write a program, save it in a file, and run it. This is the basic loop you will use for the rest of the course:

1. Write code in a file.
2. Save the file.
3. Run it with Python.
4. Read the output (or the error) and improve the code.

## What is a Python file?

A **Python file** (also called a **script**) is a plain text file whose name ends in `.py`, like `hello.py`. The `.py` ending is called the **file extension**. It tells you and your computer that the file contains Python code.

Because it is plain text, you can write it in any simple text editor: Notepad on Windows, TextEdit on macOS (in plain text mode), or any code editor. In [Setting Up VS Code for Python](/courses/python/setting-up-vs-code) you will set up a proper editor, but for now any plain text editor works.

> **Warning:** Do not use Microsoft Word or Google Docs to write code. They add hidden formatting and change straight quotes `"` into curly quotes, which Python does not understand.

## Step 1: Make a folder

Keep your practice files in one place. Create a folder called `python-practice`, for example in your Documents folder.

Windows (PowerShell):

```powershell
mkdir $HOME\Documents\python-practice
cd $HOME\Documents\python-practice
```

macOS/Linux:

```bash
mkdir -p ~/Documents/python-practice
cd ~/Documents/python-practice
```

`mkdir` means "make directory" (a **directory** is another word for a folder). `cd` means "change directory", which moves your terminal into that folder.

## Step 2: Write the code

Open your text editor, create a new file, and type this:

```python
print("Hello, world!")
print("My name is Ada.")
print("I am learning Python.")
```

Save it as `hello.py` inside your `python-practice` folder.

Each line is one **statement**, which is a single instruction. Python runs them from top to bottom, in order.

## Step 3: Run it

Go back to the terminal (make sure you are still in the `python-practice` folder) and run the file.

Windows:

```powershell
python hello.py
```

macOS/Linux:

```bash
python3 hello.py
```

Output:

```text
Hello, world!
My name is Ada.
I am learning Python.
```

Congratulations, you just wrote and ran a Python program!

What happened? You told the Python interpreter, "please run the file `hello.py`". It read the file, ran each line, and printed the text to your terminal.

> **Tip:** On Windows you can also run `py hello.py`. It does the same thing.

## Understanding print()

`print()` is a **function**: a named, reusable instruction. To use (or **call**) a function, you write its name followed by parentheses. Anything inside the parentheses is called an **argument**, the information you hand to the function.

```python
print("Hello, world!")
```

Here `print` is the function and `"Hello, world!"` is the argument. You will learn to write your own functions later in [Defining and Calling Functions](/courses/python/functions).

### Text needs quotes

The text inside the quotes is called a **string**. Quotes tell Python "this is text, do not try to understand it as code". You can use double quotes `"..."` or single quotes `'...'`. You will learn much more in [Strings: Working with Text](/courses/python/strings).

### Numbers do not need quotes

Python can print numbers and even do math:

```python
print("I am", 25, "years old")
print(2 + 3)
print("2 + 3")
```

Output:

```text
I am 25 years old
5
2 + 3
```

Notice the difference between the last two lines. `2 + 3` without quotes is math, so Python calculates `5`. `"2 + 3"` with quotes is text, so Python prints it exactly as written.

Also notice the first line: when you give `print()` several arguments separated by commas, it prints them all on one line with a space between each.

### Printing an empty line

Call `print()` with nothing inside to print a blank line:

```python
print("Line one")
print()
print("Line three")
```

Output:

```text
Line one

Line three
```

### Two handy extras: sep and end

`print()` has optional settings. `sep` changes what goes **between** the values (a space by default). `end` changes what goes at the **end** (a new line by default).

```python
print("2026", "10", "27", sep="-")
print("Loading", end="...")
print("done!")
```

Output:

```text
2026-10-27
Loading...done!
```

Because the second line ended with `...` instead of a new line, the third `print()` continued on the same line. You will use `print()` a lot more in [Getting Input and Printing Output](/courses/python/input-and-output).

## Reading your first error messages

Everyone makes mistakes when typing code, even experts. When Python cannot run your code, it stops and shows an **error message**. Learning to read these is one of the most useful skills you can build.

An error message usually tells you three things:

1. **Which file and line** the problem is on.
2. **A pointer** (`^`) under the part that looks wrong.
3. **The type of error** and a short description, on the last line.

> **Tip:** Always read the **last line** of an error message first. It tells you what went wrong. Then look at the line number to find where.

## Common mistakes

In the examples below, the path to your file will look different on your computer. Focus on the line number and the last line.

### Forgetting a closing parenthesis

```text
print("Hello, world!"
```

Error:

```text
  File "C:\Users\you\Documents\python-practice\hello.py", line 1
    print("Hello, world!"
         ^
SyntaxError: '(' was never closed
```

A **SyntaxError** means the code breaks Python's grammar rules, so Python cannot even start running it. **Fix:** add the missing `)` at the end.

### Forgetting a closing quote

```text
print("Hello)
```

Error:

```text
  File "C:\Users\you\Documents\python-practice\hello.py", line 1
    print("Hello)
          ^
SyntaxError: unterminated string literal (detected at line 1)
```

"Unterminated string literal" means a string was started but never ended. **Fix:** add the closing quote: `print("Hello")`.

### Using a capital letter

Python is **case sensitive**: `print` and `Print` are two different names.

```python
Print("Hello")
```

Error:

```text
Traceback (most recent call last):
  File "C:\Users\you\Documents\python-practice\hello.py", line 1, in <module>
    Print("Hello")
    ^^^^^
NameError: name 'Print' is not defined. Did you mean: 'print'?
```

A **NameError** means Python does not know a name you used. Python even suggests the fix. **Fix:** use lowercase `print`.

The word **Traceback** at the top means the error happened while the program was running. It traces back to the line that caused it.

### Forgetting the quotes around text

```python
print(Hello)
```

Error:

```text
Traceback (most recent call last):
  File "C:\Users\you\Documents\python-practice\hello.py", line 1, in <module>
    print(Hello)
          ^^^^^
NameError: name 'Hello' is not defined
```

Without quotes, Python thinks `Hello` is the name of something (a [variable](/courses/python/variables)), and there is nothing with that name. **Fix:** `print("Hello")`.

### Running a file that is not there

```text
python.exe: can't open file 'C:\\Users\\you\\Documents\\helo.py': [Errno 2] No such file or directory
```

**Fix:** check the spelling of the file name, and make sure your terminal is in the same folder as the file. `cd` into the right folder, then try again.

## Quick recap

- A Python program is a plain text file ending in `.py`.
- Run it with `python hello.py` (Windows) or `python3 hello.py` (macOS/Linux).
- Python runs statements from top to bottom.
- `print()` shows values; text needs quotes, numbers do not.
- `sep` and `end` change what `print()` puts between and after values.
- Read errors from the bottom up: the last line says what went wrong, the line number says where.

Running a whole file is great for finished programs. For quick experiments there is an even faster way: [The Python Interactive Shell (REPL)](/courses/python/python-repl).

<code id="code-content" class="language-python">
# main.py: your first Python program
# Save this file, then run it from the same folder with:
#   python main.py    (Windows)
#   python3 main.py   (macOS/Linux)
#
# Each print() call shows one line of output
print("Hello, world!")
print("My name is Ada.")
print("I am learning Python.")
#
# print() with no arguments prints an empty line
print()
#
# Several values separated by commas get a space between them
print("I am", 25, "years old")
#
# Without quotes it is math, with quotes it is text
print(2 + 3)
print("2 + 3")
print()
#
# sep changes the separator between values
print("2026", "10", "27", sep="-")
#
# end changes what is printed at the end of the line
print("Loading", end="...")
print("done!")
#
# Python is case sensitive: print works, Print would cause a NameError
print("All done. Try changing the text and running it again!")
</code></pre>

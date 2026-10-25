---
publishDate: 2026-10-25T09:02
title: Node.js and npm Prerequisites
slug: nodejs-and-npm-prerequisites
metadescription: Install Node.js and npm, learn the handful of terminal commands you need, run your first JavaScript file with node, and understand package.json and node_modules.
updateDate: 2026-10-25T09:02
author: ['bishal-biswas']
level: 1
tags: ['express', 'nodejs', 'npm', 'terminal']
course: expressjs
---

## What you will learn

- How to install **Node.js** and **npm**, and check that they work
- The few **terminal** commands you need for this course
- How to run a JavaScript file with the `node` command
- What **npm**, **packages**, `package.json` and `node_modules` are
- How **npm scripts** and **npx** save you typing

Express runs on Node.js, and you install Express with npm. This lesson gets both tools working on your computer, step by step. If you already use Node.js every day, skim the headings and jump to the practice section.

## What are Node.js and npm?

**Node.js** is a program that runs JavaScript outside the browser. Your browser has a JavaScript engine built in. Node.js takes that same kind of engine (Google's **V8**) and lets you use it on your computer or on a server.

**npm** stands for **Node Package Manager**. It does two jobs:

1. It is a huge online library (the **npm registry**) of free code that other people have shared. Express lives there.
2. It is a command-line tool that downloads that code into your project.

A **package** is a bundle of reusable code with a name, like `express`. When you "install a package", npm downloads it so your code can use it. Installing Node.js also installs npm, so you get both in one go.

## Step 1: Open a terminal

A **terminal** is a window where you control your computer by typing **commands** instead of clicking. A command is a short instruction such as "show me the files in this folder". You type it, press Enter, and the terminal prints the result.

| Operating system | How to open a terminal |
| --- | --- |
| Windows | Press the Start key, type **PowerShell** or **Terminal**, press Enter |
| macOS | Press `Cmd + Space`, type **Terminal**, press Enter |
| Linux | Press `Ctrl + Alt + T` on most distributions |

> **Tip:** If you use **VS Code**, it has a terminal built in. Open it with **View > Terminal** or the `` Ctrl + ` `` shortcut. It opens in your project folder automatically, which is very handy.

### The handful of commands you need

The terminal is always "standing" in one folder, called the **current directory** (or working directory). Commands run inside that folder.

| What you want | macOS / Linux / Git Bash | Windows PowerShell |
| --- | --- | --- |
| Show which folder you are in | `pwd` | `pwd` |
| List the files here | `ls` | `ls` (or `dir`) |
| Make a new folder | `mkdir my-folder` | `mkdir my-folder` |
| Move into a folder | `cd my-folder` | `cd my-folder` |
| Go up one folder | `cd ..` | `cd ..` |
| Clear the screen | `clear` | `cls` (or `clear`) |
| Stop a running program | `Ctrl + C` | `Ctrl + C` |

Try it now. Make a folder for this course and move into it:

```bash
mkdir express-course
cd express-course
pwd
```

The last command prints the full path of your new folder, for example `/Users/asha/express-course` on macOS or `C:\Users\asha\express-course` on Windows.

> **Note:** In this course, terminal commands are shown in blocks like the one above. Type them one line at a time and press Enter after each. Do not type any `$` or `>` symbol you might see at the start of a line in other tutorials; that is just the terminal's **prompt**.

## Step 2: Install Node.js

Express 5 needs **Node.js 18 or newer**. Some lessons in this course use handy features from Node.js 20 and 22, so install the current **LTS** version.

**LTS** means **Long-Term Support**. It is the stable version that gets bug fixes and security updates for a long time. Always choose LTS for learning and for real projects.

### The simple way: the official installer

1. Go to [nodejs.org](https://nodejs.org).
2. Download the **LTS** installer for your operating system.
3. Run it and accept the default options.
4. **Close your terminal and open a new one**, so it picks up the new program.

### The flexible way: a version manager

A **version manager** lets you install several Node.js versions side by side and switch between them with one command. This is useful once you work on more than one project.

- macOS and Linux: **nvm** (Node Version Manager) or **fnm**.
- Windows: **nvm-windows** or **fnm**.

For example, with nvm on macOS or Linux:

```bash
nvm install --lts
nvm use --lts
```

If you are a complete beginner, the official installer is perfectly fine. You can switch to a version manager later.

## Step 3: Check that it worked

Run these two commands:

```bash
node --version
npm --version
```

You should see two version numbers, something like this (yours will probably be different):

```text
v22.11.0
10.9.0
```

The `--version` part is called a **flag** (or option). Flags change what a command does. Here it says "don't run anything, just tell me your version".

If the first number after the `v` is **18 or higher**, you are ready for Express 5. If it is 22 or higher, every example in this course will work for you.

> **Common mistake:** Seeing `node: command not found` or `'node' is not recognized`. This almost always means the terminal was open *before* you installed Node.js. Close every terminal window, open a fresh one, and try again. If it still fails, restart your computer.

## Step 4: Run JavaScript with node

### The REPL: a JavaScript playground

Type `node` on its own and press Enter. You are now in the **REPL** (Read-Eval-Print Loop). It reads a line of JavaScript, runs it, prints the result, and waits for the next line.

```text
> 2 + 3
5
> 'express'.toUpperCase()
'EXPRESS'
> .exit
```

Type `.exit` (or press `Ctrl + C` twice) to leave the REPL and get your normal terminal back.

### Running a file

The REPL is fun for quick tests, but real programs live in files. Inside your `express-course` folder, create a file called `hello.js` with your code editor:

```js
// hello.js
const name = 'Express learner';
console.log(`Hello, ${name}!`);
console.log('Node.js version:', process.version);
```

Now run it:

```bash
node hello.js
```

```text
Hello, Express learner!
Node.js version: v22.11.0
```

That is all a Node.js program is: a JavaScript file that you run with `node <file name>`. `console.log` prints to the terminal instead of the browser console.

> **Note:** Node.js does **not** have `window`, `document` or other browser-only objects, because there is no web page. Instead it has server-friendly tools, such as reading files and creating web servers. The `process` object you used above holds information about the running program.

## Step 5: Understand npm and package.json

### package.json: your project's ID card

Every Node.js project has a file called **package.json** in its main folder. It records the project's name, the packages it depends on, and handy commands. You create one with:

```bash
npm init -y
```

`npm init` normally asks you questions; `-y` means "yes to all the defaults". You get a file similar to this (the exact fields vary a little between npm versions):

```json
{
  "name": "express-course",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs"
}
```

It is plain **JSON**: a text format of `"key": value` pairs inside curly braces. You can open and edit it in your code editor like any other file.

### Installing a package

Let's install a tiny package called `picocolors`, which adds colour to terminal text:

```bash
npm install picocolors
```

Three things happen:

1. npm downloads the package into a new folder called **node_modules**.
2. npm adds it to the `dependencies` section of `package.json`.
3. npm creates or updates **package-lock.json**.

Your `package.json` now contains something like:

```json
{
  "dependencies": {
    "picocolors": "^1.1.1"
  }
}
```

The `^` (caret) means "this version or any newer version that is still `1.x`". That lets you get bug fixes without accidentally jumping to a big new version that might break your code.

| File or folder | What it is | Commit to Git? |
| --- | --- | --- |
| `package.json` | The list of what your project needs | Yes |
| `package-lock.json` | The **exact** versions that were installed, so everyone gets the same | Yes |
| `node_modules/` | The downloaded code itself, often thousands of files | **No** |

Because `package.json` and `package-lock.json` describe everything, anyone can recreate `node_modules` by running `npm install` with no package name. That is why you never share or commit `node_modules`.

### Using the package

Create `colors.js`:

```js
// colors.js
import pc from 'picocolors';

console.log(pc.green('Success!'), pc.red('Error!'), pc.bold('Bold text'));
```

Before running it, make sure `package.json` has this `"type"` line, so Node.js understands the `import` keyword. If your file says `"type": "commonjs"`, change `"commonjs"` to `"module"`. If it has no `"type"` line at all, add one. The relevant parts look like this (other fields left out):

```json
{
  "name": "express-course",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "picocolors": "^1.1.1"
  }
}
```

> **Note:** A file must never have two `"type"` lines. Edit the existing one rather than adding a second.

Now run it:

```bash
node colors.js
```

You should see coloured words in your terminal. The `"type": "module"` line tells Node.js to treat your files as modern **ES modules**. The whole course uses this style. You will learn exactly what it means in [ES Modules vs CommonJS in Express Apps](/courses/expressjs/esm-vs-commonjs).

### Dependencies and devDependencies

Some packages are needed to **run** your app (like Express). Others are only needed while you **develop** it (like a testing tool). npm keeps them in two lists:

```bash
npm install express        # goes into "dependencies"
npm install -D nodemon     # -D: goes into "devDependencies"
```

Don't run these yet; you will install Express properly in the next lesson.

## Step 6: npm scripts and npx

### npm scripts: shortcuts for long commands

The `"scripts"` section of `package.json` lets you name commands. For example:

```json
{
  "scripts": {
    "start": "node hello.js",
    "colors": "node colors.js"
  }
}
```

Now you can run them like this:

```bash
npm start
npm run colors
```

`start` and `test` are special names that work with just `npm start` or `npm test`. Every other name needs `npm run <name>`. Real projects use scripts for starting, testing and building, so teammates don't have to remember the exact commands.

### npx: run a package without installing it globally

**npx** comes with npm. It runs a command from a package, downloading it temporarily if needed. For example, this runs the `cowsay` package once without adding it to your project:

```bash
npx cowsay "Hello Express"
```

npx asks for confirmation the first time it needs to download something. You will use npx occasionally for one-off tools.

## Common mistakes

> **Common mistake:** Running `npm install` in the wrong folder. npm looks for `package.json` in the **current directory**. Always `cd` into your project folder first, and check with `pwd` or `ls` that you see `package.json`.

> **Common mistake:** Installing project packages globally with `npm install -g express`. Global installs are for command-line tools only. Packages your code imports must be installed **inside** the project, without `-g`.

> **Common mistake:** Deleting `package-lock.json` to "fix" problems. It records exact versions for a good reason. If something seems broken, delete only `node_modules` and run `npm install` again.

## Key takeaways

- **Node.js** runs JavaScript outside the browser. **npm** installs packages and comes with Node.js.
- Install the **LTS** version of Node.js. Express 5 needs Node.js 18+, and this course recommends 22 or newer.
- Check your setup with `node --version` and `npm --version`. Run a file with `node file.js`.
- `package.json` lists what your project needs; `node_modules` holds the downloaded code and is never committed.
- `npm install <name>` adds a dependency, `-D` makes it a dev dependency, and **npm scripts** give long commands short names.

## Practice

1. Open a terminal, create a folder called `playground`, move into it, and print its full path.
2. Create `math.js` that logs the result of `7 * 6` and the current date with `new Date()`. Run it with `node`.
3. Run `npm init -y` in `playground`, then add a `"start"` script that runs `math.js`. Run it with `npm start`.
4. Install `picocolors`, delete the `node_modules` folder, then run `npm install` with no package name. Check that `node_modules` came back.

## What's next

Your tools are ready. Now let's create a real Express 5 project. Continue with [Installing Express 5 and Project Setup](/courses/expressjs/installing-express-5).

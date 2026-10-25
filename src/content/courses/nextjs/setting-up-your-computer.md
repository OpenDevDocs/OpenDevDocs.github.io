---
publishDate: 2026-10-25T13:01
title: Setting Up Your Computer for Next.js
slug: setting-up-your-computer
metadescription: "Install Node.js 20.9 or newer, npm and VS Code, check your versions in the terminal, and get your computer ready to build Next.js apps."
updateDate: 2026-10-25T13:01
author: ['bishal-biswas']
level: 1
tags: ['nextjs', 'nodejs', 'npm', 'vscode']
course: nextjs
---

## What you need

Before you can build a Next.js app, your computer needs a few tools. You only set them up once:

- **Node.js** (version 20.9 or newer): runs JavaScript outside the browser. Next.js itself is a Node.js program.
- **npm**: installs packages (ready-made code) like Next.js and React. It comes with Node.js.
- **A code editor**: this course uses **VS Code**, which is free.
- **A terminal**: the text window where you type commands.
- **A modern web browser**: Chrome, Edge, Firefox or Safari.

Next.js works on Windows (including WSL), macOS and Linux. The steps are almost the same on all three, and this lesson points out the few differences.

If you are not sure what Next.js is yet, read [What is Next.js? React for Real Websites](/courses/nextjs/what-is-nextjs) first.

## Step 1: open a terminal

You will type commands in a terminal all through this course. Here is how to open one:

- **Windows:** press the Start button, type `PowerShell` or `Terminal`, and open it.
- **macOS:** press **Cmd + Space**, type `Terminal`, and press Enter.
- **Linux:** press **Ctrl + Alt + T** on most systems, or find "Terminal" in your apps.

A terminal shows a **prompt**, a short line that waits for you to type. It might end with `>` on Windows or `$` on macOS and Linux. In this course, commands are shown without the prompt, so you type only the command itself.

## Step 2: check if Node.js is already installed

Type this and press Enter:

```bash
node --version
```

If Node.js is installed, you see a version number:

```text
v24.12.0
```

Your number may be different. What matters is that it is **20.9.0 or higher**. Next.js 16 refuses to start on older versions.

If instead you see an error like one of these, Node.js is not installed yet (or the terminal cannot find it):

```text
node : The term 'node' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

```text
command not found: node
```

Go to Step 3 to install it.

## Step 3: install Node.js

Go to [nodejs.org](https://nodejs.org/) and download the **LTS** version. **LTS** means "Long Term Support": a version that gets bug fixes and security updates for a long time. It is the safe choice for learning and for real projects.

- **Windows:** run the `.msi` installer and click through with the default options. Make sure "Add to PATH" stays ticked. **PATH** is the list of folders your terminal searches for programs, so this lets you type `node` from anywhere.
- **macOS:** run the `.pkg` installer and follow the steps.
- **Linux:** the nodejs.org download page shows commands for your distribution. Use those, because the Node.js that some Linux package managers install by default can be very old.

When the installer finishes, **close your terminal and open a new one**. A terminal only reads the PATH when it starts, so an old window will not know about Node.js yet.

Now check again:

```bash
node --version
```

```text
v24.12.0
```

> **Tip:** If you work on many projects that need different Node.js versions, a **version manager** lets you switch between them. Popular ones are `nvm` (macOS and Linux) and `nvm-windows` or `fnm` (Windows). You do not need one for this course.

## Step 4: check npm and npx

npm was installed together with Node.js. Check it:

```bash
npm --version
```

```text
11.19.1
```

Any recent version is fine. npm gives you two commands you will use a lot:

- `npm install <package>` downloads a package into your project's `node_modules` folder and writes it into `package.json`.
- `npm run <script>` runs a script from `package.json`, like `npm run dev` to start your app.

npm also installs a helper called **npx**. It downloads a tool and runs it once, without installing it permanently. You will use it in the next lesson to create your app:

```bash
npx create-next-app@latest
```

The `@latest` part means "use the newest version". Do not run it yet. [Creating Your First Next.js App](/courses/nextjs/create-your-first-app) walks you through it step by step.

> **Windows tip:** If PowerShell says that running scripts is disabled when you type `npm` or `npx`, open **Command Prompt** instead, or use the terminal inside VS Code with "Command Prompt" selected. Both work the same for this course.

## Step 5: install VS Code

Download **Visual Studio Code** from code.visualstudio.com and install it. It is free and works on all three systems.

VS Code has a terminal built in, so you can type commands right next to your code. Open it with **View > Terminal**, or press:

- **Ctrl + `** on Windows and Linux (the key under Esc)
- **Ctrl + `** on macOS too (yes, Ctrl, not Cmd)

On macOS, you can also add a handy shortcut: open the Command Palette with **Cmd + Shift + P**, type `shell command`, and choose **Install 'code' command in PATH**. Then you can open any folder in VS Code from the terminal by typing `code .` (Windows and Linux get this command automatically).

```bash
# Open the current folder in VS Code
code .
```

## Step 6: add two helpful extensions

**Extensions** add features to VS Code. Click the Extensions icon on the left side (four small squares) and search for these two:

1. **ESLint** (by Microsoft). It underlines mistakes in your JavaScript as you type. Your Next.js project comes with ESLint rules already set up, and this extension shows them in the editor.
2. **Tailwind CSS IntelliSense** (by Tailwind Labs). The course project uses Tailwind CSS for styling, and this extension suggests class names like `text-3xl` and `font-bold` while you type.

Neither one is required, but both save you time.

## Step 7: make same-named files easy to tell apart (optional)

In Next.js, many files have the same name. You will soon have `app/page.js`, `app/books/page.js`, `app/about/page.js`, and so on. In VS Code, every tab just says `page.js`, which gets confusing fast.

The Next.js docs suggest a small VS Code setting that adds the folder name to each tab. Once you have a project (next lesson), create a file called `.vscode/settings.json` inside it with this content:

```json
{
  "workbench.editor.customLabels.patterns": {
    "**/app/**/page.js": "${dirname(1)}/${dirname} - page.js",
    "**/app/**/layout.js": "${dirname(1)}/${dirname} - layout.js",
    "**/app/**/loading.js": "${dirname(1)}/${dirname} - loading.js",
    "**/app/**/error.js": "${dirname(1)}/${dirname} - error.js",
    "**/app/**/not-found.js": "${dirname(1)}/${dirname} - not-found.js",
    "**/app/**/route.js": "${dirname(1)}/${dirname} - route.js"
  }
}
```

Now a tab shows something like `books/[id] - page.js` instead of only `page.js`. You need VS Code 1.88 or newer for this.

## Step 8: pick a browser

Next.js supports these browsers out of the box:

```text
Chrome 111+    Edge 111+    Firefox 111+    Safari 16.4+
```

Any up-to-date browser is fine. Chrome and Edge have excellent developer tools (press **F12** to open them), which you will use in [Debugging Next.js Apps](/courses/nextjs/debugging).

## Step 9: a final check

Run these three commands one after another:

```bash
node --version
npm --version
node -e "console.log('Ready for Next.js!')"
```

The last command runs one line of JavaScript with Node.js (`-e` means "evaluate this code"). You should see:

```text
v24.12.0
11.19.1
Ready for Next.js!
```

If all three work, your computer is ready.

## Optional: Git

**Git** saves snapshots of your code so you can undo mistakes and share your work. It is optional for this course, but useful. If Git is installed, `create-next-app` sets up a Git repository for your new project automatically. Check with:

```bash
git --version
```

If you see a version number, you are all set. If not, you can skip it for now, or install it from git-scm.com.

## Common mistakes

### Node.js is too old

If your Node.js is older than 20.9, Next.js stops with a message like this when you start your app:

```text
You are using Node.js 18.20.4. For Next.js, Node.js version ">=20.9.0" is required.
```

Download the current LTS version from [nodejs.org](https://nodejs.org/), install it, then open a new terminal and check `node --version` again.

### "node is not recognized" right after installing

You installed Node.js but the terminal still cannot find it. Close **every** terminal window (including the one inside VS Code, or restart VS Code) and open a fresh one. Terminals read the PATH only when they start. On Windows, a restart of the computer fixes stubborn cases.

### Typing the prompt symbol

If you copy `$ node --version` with the `$` in front, you get an error like `$: command not found`. Type only the command itself: `node --version`.

### Working inside a cloud-synced folder

Folders synced by OneDrive, iCloud or Dropbox can slow down or confuse the dev server, because the sync tool keeps touching thousands of files in `node_modules`. Keep your projects in a plain folder, such as `C:\projects` on Windows or `~/projects` on macOS and Linux:

```bash
# macOS and Linux
mkdir -p ~/projects

# Windows (PowerShell)
mkdir C:\projects
```

## Quick recap

- Next.js 16 needs **Node.js 20.9 or newer**. Check with `node --version`, and install the LTS version from nodejs.org if needed.
- npm comes with Node.js. `npm install` adds packages, `npm run` runs scripts, and `npx` runs a tool once.
- After installing, always open a **new** terminal so it can find `node`.
- VS Code is the course editor. Open its terminal with Ctrl + `. The ESLint and Tailwind CSS IntelliSense extensions help a lot.
- A small `.vscode/settings.json` setting makes the many `page.js` tabs easy to tell apart.
- Keep projects outside cloud-synced folders.
- Next up: [Creating Your First Next.js App](/courses/nextjs/create-your-first-app).

<code id="code-content" class="language-bash">
# Setting up for Next.js: run these in a terminal, one at a time
# 1. Node.js must be 20.9.0 or newer (install the LTS version from nodejs.org)
node --version
# 2. npm comes with Node.js
npm --version
# 3. Run one line of JavaScript to prove Node.js works
node -e "console.log('Ready for Next.js!')"
# 4. Optional: Git, so create-next-app can start a repository for you
git --version
# 5. Make a plain (not cloud-synced) folder for your projects
mkdir -p ~/projects
cd ~/projects
# 6. Open the folder in VS Code
code .
# Next lesson: npx create-next-app@latest book-nook ...
</code></pre>

---
publishDate: 2026-10-25T12:02
title: Setting Up Your Computer for Electron
slug: setting-up-your-computer
metadescription: Install Node.js LTS and VS Code on Windows, macOS or Linux, check your versions with node and npm, and do a quick Electron test before your first app.
updateDate: 2026-10-25T12:02
author: ['bishal-biswas']
level: 1
tags: ['setup', 'nodejs', 'vs-code']
course: electronjs
---

## What you need

Before you build your first Electron app, you need three things on your computer:

1. **Node.js**, which also installs **npm**, the tool that downloads JavaScript packages (including Electron itself).
2. **A code editor.** This course uses **Visual Studio Code** (VS Code).
3. **A terminal**, the text window where you type commands. Every operating system already has one.

Setting up is like stocking a new kitchen. You need the oven (Node.js), a good knife and chopping board (VS Code), and a counter to work on (the terminal). Once they are in place, every recipe in this course will just work.

## A quick word about two copies of Node.js

This confuses many beginners, so let us clear it up first.

- The **Node.js you install** runs on your computer. You use it to run `npm`, `npx` and tools like Electron Forge.
- **Electron has its own Node.js built in.** When your app runs, its main process uses Electron's copy, not yours.

So the two version numbers can be different, and that is fine. Your installed Node just needs to be new enough for the tools. Later you will print Electron's own Node version from inside your app with `process.versions.node`.

## Which Node.js version?

Install the current **LTS** version. LTS stands for **Long-Term Support**: a version that gets bug and security fixes for a long time. It is the safe choice for nearly everyone.

> **Note:** Electron Forge 8, the tool you will use from [Starting a Project with Electron Forge](/courses/electronjs/starting-with-electron-forge) onwards, needs **Node.js 22.17 or newer**. Any current LTS release meets that.

If you already have Node installed, skip ahead to [Checking your versions](#checking-your-versions) and make sure yours is new enough.

## Installing Node.js

### Windows

1. Go to **nodejs.org** and download the **LTS** installer (a `.msi` file).
2. Run it and keep the default options. Make sure **"Add to PATH"** stays selected, so your terminal can find `node`.
3. Close any terminal windows that were already open, then open a new one. Old terminals do not see newly installed programs.

If you prefer the command line, Windows' built-in package manager can install it too:

```powershell
winget install OpenJS.NodeJS.LTS
```

### macOS

1. Go to **nodejs.org** and download the **LTS** installer (a `.pkg` file).
2. Open it and follow the steps.
3. Open a new **Terminal** window (press **Cmd + Space**, type `Terminal`, press Return).

### Linux

The Node.js package in your distribution's default software repository is often old. The most reliable way is a **version manager**, a small tool that installs Node for your user account and lets you switch versions later.

**nvm** (Node Version Manager) is the most popular one. Install it by following the instructions on its GitHub page (search for "nvm-sh"), open a new terminal, then run:

```bash
nvm install --lts
nvm use --lts
```

`--lts` means "the latest LTS release". nvm also works on macOS. Windows users can look at **nvm-windows** or **fnm**, which do the same job.

## Checking your versions

Open a **new** terminal and type these two commands:

```bash
node --version
npm --version
```

You should see two version numbers, something like this (yours will likely be different):

```text
v24.22.0
11.x.x
```

- The first line is Node.js. Check that the number after `v` is **22.17 or higher**. Bigger first numbers (like 24 or 26) are newer.
- The second line is npm. Any version that came with your Node install is fine.

If you see an error like `node is not recognized` (Windows) or `command not found: node` (macOS and Linux), see [Common mistakes](#common-mistakes) below.

### What is npx?

npm also installs a helper called **`npx`**. It runs a command from a package without you installing it globally first. You will use it a lot, for example `npx electron .` to start an app. Check it is there too:

```bash
npx --version
```

It prints the same version as npm.

## Installing VS Code

**Visual Studio Code** is a free code editor from Microsoft. It understands JavaScript, has a built-in terminal and debugger, and is itself an Electron app.

1. Go to **code.visualstudio.com** and download the version for your system.
2. **Windows:** run the installer. On the "Select Additional Tasks" page, tick **"Add to PATH"**, so you can open folders with `code .` from a terminal.
3. **macOS:** open the downloaded file and drag **Visual Studio Code** into your **Applications** folder. To get the `code` command, open VS Code, press **Cmd + Shift + P**, type `shell command`, and choose **Shell Command: Install 'code' command in PATH**.
4. **Linux:** download the `.deb` (Ubuntu, Debian) or `.rpm` (Fedora) package and install it, or use your software centre.

### Using the built-in terminal

You can type every command in this course straight into VS Code:

- Open a folder with **File > Open Folder**.
- Open the terminal with **View > Terminal**, or press **Ctrl + Backtick** (the `` ` `` key, usually below Esc). This shortcut is the same on Windows, macOS and Linux.

The terminal opens already inside your project folder, which saves you a lot of `cd` typing.

> **Tip:** You do not need any extensions to follow this course. VS Code's JavaScript support and debugger are built in. You will use the debugger in [Debugging with DevTools and VS Code](/courses/electronjs/debugging-electron-apps).

## Optional: Git

**Git** tracks changes to your code so you can undo mistakes and share projects. It is not needed to start, but you will want it before you publish an app. Download it from **git-scm.com** (Windows), run `xcode-select --install` (macOS), or install the `git` package with your Linux package manager. Check it with:

```bash
git --version
```

## Which systems can run Electron apps?

The latest Electron runs on:

- **Windows 10 or newer**, 64-bit (x64 or Arm). 32-bit Windows is no longer supported.
- **macOS 13 (Ventura) or newer**.
- **64-bit Linux** on x64 or Arm64. Older 32-bit Arm boards are no longer supported.

You can develop on any of these and, later, build your app for the others.

> **Note:** A few npm packages contain **native modules**: code written in C or C++ that must be compiled. They need extra build tools (Visual Studio Build Tools on Windows, the Xcode Command Line Tools on macOS, `build-essential` or similar on Linux). You do not need them for this course until [Native Node Modules](/courses/electronjs/native-node-modules).

## A quick Electron test drive

Let us make sure Electron itself can download and run. Create an empty practice folder and install Electron into it:

```bash
mkdir electron-test
cd electron-test
npm init -y
npm install --save-dev electron
```

- `npm init -y` creates a `package.json` file with default answers. The `-y` means "yes to everything".
- `npm install --save-dev electron` downloads the Electron package and records it as a **dev dependency**, a tool you need while building.

Now ask Electron for its version:

```bash
npx electron --version
```

The first time, Electron downloads its main program (the part that contains Chromium), so you may see a download message and wait a little. Then it prints its version:

```text
Downloading Electron binary...
v45.0.0
```

Your number may be newer. Run the command again and it answers instantly, because the download is saved.

> **Note:** Newer versions of the `electron` package download that big program the first time you **run** Electron, not while `npm install` runs. So a slow first start is normal.

That is it. You can delete the `electron-test` folder. In the next lessons you will build a real app from scratch.

## Common mistakes

### "node is not recognized" or "command not found"

The terminal cannot find Node. Usually the terminal was opened **before** you installed Node. Close every terminal (including VS Code's) and open a fresh one. On Windows, if it still fails, sign out and back in, or reinstall Node and make sure "Add to PATH" is selected.

### "running scripts is disabled on this system" (Windows PowerShell)

PowerShell may refuse to run `npm` with a message like this:

```text
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

PowerShell blocks script files by default on some computers. You can either use **Command Prompt** instead of PowerShell, or allow local scripts for your user account only:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Answer `Y` if it asks you to confirm, then open a new terminal.

### An old Node.js version

```text
v20.x.x
```

If `node --version` shows a number lower than 22.17, newer tools like Electron Forge will refuse to run or fail with strange errors. Install the current LTS from nodejs.org, or with nvm run `nvm install --lts`.

### Installing Electron globally

Some old tutorials say `npm install -g electron`. Do not. Each project should have its own Electron in its `devDependencies`, so every project uses the exact version it was built for.

## Quick recap

- Install **Node.js LTS** (22.17 or newer) from nodejs.org, winget or nvm. It brings `npm` and `npx`.
- Your installed Node runs the tools. Electron has its own Node inside for your app.
- Check your setup with `node --version`, `npm --version` and `npx --version` in a fresh terminal.
- Install **VS Code** and open its terminal with **Ctrl + Backtick**.
- Git is optional for now. Native build tools are only needed for native modules.
- Install Electron per project with `npm install --save-dev electron`. Its main program downloads on first run.

<code id="code-content" class="language-javascript">
// check-setup.js: run it with "node check-setup.js" to test your computer
const { execSync } = require('child_process');
const os = require('os');
// --- 1. Which Node.js is installed? (process.versions.node looks like "24.22.0")
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = major &gt; 22 || (major === 22 &amp;&amp; minor &gt;= 17);
console.log(`Node.js: v${process.versions.node}`, nodeOk ? 'OK' : 'TOO OLD: install the LTS (22.17+)');
// --- 2. Is npm available? We ask the terminal for it.
try {
  const npmVersion = execSync('npm --version').toString().trim();
  console.log(`npm:     ${npmVersion} OK`);
} catch {
  console.log('npm:     NOT FOUND: reinstall Node.js and open a new terminal');
}
// --- 3. Which operating system and processor?
const names = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
console.log(`System:  ${names[os.platform()] ?? os.platform()} (${os.arch()})`);
if (os.arch() === 'ia32') {
  console.log('Warning: 32-bit Windows cannot run the latest Electron.');
}
// --- 4. What next?
console.log(nodeOk ? '\nAll set! Build your first Electron app next.' : '\nFix the items above, then run this again.');
</code></pre>

---
publishDate: 2026-10-25T08:10
title: Installing Node.js LTS and Version Managers
slug: installing-nodejs-and-version-managers
metadescription: Install Node.js LTS on Windows, macOS or Linux with the official installer or a version manager like fnm or nvm, and pin versions with .nvmrc and engines.
updateDate: 2026-10-25T08:10
author: ['bishal-biswas']
level: 1
tags: ['installation', 'nvm', 'fnm', 'lts']
course: nodejs
---

## Which version should you install?

Install the **LTS** version. LTS stands for **Long Term Support**: a version that gets bug fixes and security patches for years. As of October 2026 that means **Node.js 24** (Node 26 also becomes LTS in late October 2026).

Think of it like choosing a car model that the garage still services. The newest model might be shinier, but the LTS one is the one everyone knows how to fix. [Release Lines: Current, LTS and Maintenance](/courses/nodejs/nodejs-release-lines) explains the schedule in detail.

There are two ways to install Node:

1. **The official installer.** Quick and simple. Installs one version.
2. **A version manager.** A small tool that installs Node for you and lets you switch between versions. Recommended once you work on more than one project.

Read option 1 if you just want to get going. Read option 2 if you want the setup most professional developers use.

## First, open a terminal

A **terminal** is a window where you type commands instead of clicking buttons.

- **Windows:** press the Start key, type `Terminal` (or `PowerShell`) and open it.
- **macOS:** press Cmd + Space, type `Terminal` and press Return.
- **Linux:** open your Terminal app. On Ubuntu, Ctrl + Alt + T works.

You will type each command shown in a `bash` box below, then press Enter.

## Option 1: the official installer

Go to **nodejs.org/en/download**, pick the LTS version and your operating system.

### Windows

1. Download the **Windows Installer (.msi)**.
2. Run it and accept the defaults. Leave "Automatically install the necessary tools" unticked for now. It installs extra build tools you will not need for a while.
3. Close any terminals that were already open, then open a new one so it notices the new `node` command.

Prefer the command line? Windows includes a package manager called **winget**:

```powershell
winget install OpenJS.NodeJS.LTS
```

### macOS

1. Download the **macOS Installer (.pkg)**.
2. Double-click it and follow the steps.
3. Open a new Terminal window.

> **Note:** If you use Homebrew, be aware that `brew install node` gives you the newest release, which is not always the LTS one. A version manager (option 2) is a better fit if you live in the terminal.

### Linux

Your distribution's own package (for example `sudo apt install nodejs`) is often several versions behind. The easiest way to get a current LTS on Linux is a version manager, so skip to option 2. The download page also offers prebuilt files for Linux if you prefer to install by hand.

## Check that it worked

Run these two commands:

```bash
node --version
npm --version
```

You should see two version numbers. Yours may be newer:

```text
v24.12.0
11.19.1
```

The first is Node. The second is **npm**, the package manager that comes bundled with Node. If both print a number, you are ready.

## Option 2: version managers

A **version manager** keeps several Node versions on your computer and lets you switch with one command.

Why bother? Real projects pin their Node version. An older work project might need Node 22, while your new side project uses Node 24. Without a version manager you would uninstall and reinstall Node every time you switch projects.

Version managers also install Node inside your user folder, so you never need `sudo` or an administrator prompt to install global tools.

> **Tip:** If you already installed Node with the official installer, uninstall it first. Otherwise two copies of `node` will fight over which one runs.

### fnm (Windows, macOS and Linux)

**fnm** (Fast Node Manager) works on every operating system and is quick. It is a good default choice.

Install it:

```bash
# macOS (with Homebrew)
brew install fnm

# Linux or macOS (without Homebrew)
curl -fsSL https://fnm.vercel.app/install | bash
```

```powershell
# Windows
winget install Schniz.fnm
```

Then tell your shell to load fnm every time it starts. Add **one** line to your shell's startup file:

```bash
# Bash: add to ~/.bashrc
eval "$(fnm env --use-on-cd --shell bash)"

# Zsh (the macOS default): add to ~/.zshrc
eval "$(fnm env --use-on-cd --shell zsh)"
```

```powershell
# PowerShell: open your profile with `notepad $PROFILE` and add this line
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

The `--use-on-cd` part makes fnm switch Node versions automatically when you `cd` into a project folder. Open a new terminal, then install and use Node:

```bash
fnm install --lts     # install the latest LTS
fnm install 22        # install another major version
fnm use 24            # switch this terminal to Node 24
fnm default 24        # use Node 24 in every new terminal
fnm list              # show installed versions
```

### nvm (macOS and Linux)

**nvm** (Node Version Manager) is the oldest and most widely known option. It works on macOS and Linux only.

Install it with the script from the nvm README. At the time of writing it looks like this (check the README for the newest version number):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

Open a new terminal, then:

```bash
nvm install --lts      # install the latest LTS
nvm install 22         # install Node 22 as well
nvm use 24             # switch this terminal to Node 24
nvm alias default 24   # use Node 24 in every new terminal
nvm ls                 # show installed versions
```

### nvm-windows

**nvm-windows** is a separate project with a similar name, built for Windows. Download the setup program from its GitHub releases page and run it. Its commands are close to nvm, but not identical:

```powershell
nvm install lts
nvm use 24
nvm list
```

### What about Volta?

**Volta** is another cross-platform manager you will see mentioned in older tutorials. Its maintainers have marked it as unmaintained, so pick fnm or nvm for new setups.

## Pinning a version for each project

Once you have a version manager, you can record which Node version a project expects. Then anyone who opens the project gets the right one.

### .nvmrc

Create a file called `.nvmrc` in the project's top folder. It contains just the version:

```text
24
```

Both fnm and nvm read it:

```bash
fnm use        # fnm reads .nvmrc (it also reads a .node-version file)
nvm use        # nvm reads .nvmrc
nvm install    # with no version, nvm installs what .nvmrc says
```

With fnm's `--use-on-cd` setting, you do not even need to type `fnm use`. Changing into the folder is enough.

### The engines field

Projects also describe the Node versions they support inside `package.json`, using the **`engines`** field. You will learn about `package.json` in [package.json Explained](/courses/nodejs/package-json-explained).

```json
{
  "name": "notes-app",
  "engines": {
    "node": ">=24"
  }
}
```

`>=24` means "version 24 or newer". If someone installs packages with a Node version outside that range, npm prints a warning. Here is what you see on Node 24 in a project that asks for `>=26`:

```text
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'notes-app@1.0.0',
npm warn EBADENGINE   required: { node: '>=26' },
npm warn EBADENGINE   current: { node: 'v24.12.0', npm: '11.19.1' }
npm warn EBADENGINE }
```

It is only a warning by default. To make npm refuse to install instead, add a file called `.npmrc` next to `package.json` containing `engine-strict=true`.

> **Note:** `.nvmrc` tells **your version manager** which Node to switch to. `engines` tells **npm and other people** which versions are supported. Many projects use both.

## Troubleshooting

### "node is not recognized" or "command not found"

The terminal was opened before Node was installed. Close it and open a new one. If it still fails, restart your computer so the updated **PATH** (the list of folders your system searches for commands) takes effect.

### Which node am I running?

If you are unsure which copy of Node runs, ask the system:

```bash
# macOS and Linux
which node
```

```powershell
# Windows
where.exe node
```

### "running scripts is disabled" in PowerShell

Some Windows machines block PowerShell scripts, which stops `npm` from running in PowerShell. Use the Command Prompt instead, or run `npm.cmd` in place of `npm`. You can also allow locally created scripts for your user account only:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Permission errors when installing global packages

On macOS and Linux, an `EACCES` error during `npm install -g` usually means Node was installed system-wide. Switching to fnm or nvm fixes this, because everything then lives in your user folder.

## Quick recap

- Install the **LTS** version, Node 24 as of October 2026.
- The official installer from nodejs.org is the quickest start on Windows and macOS.
- A **version manager** lets you keep several versions and switch per project: fnm everywhere, nvm on macOS and Linux, nvm-windows on Windows.
- Check your setup with `node --version` and `npm --version`.
- `.nvmrc` pins the version for your version manager, and `engines` in `package.json` declares supported versions to npm.
- After installing anything, open a fresh terminal.

<code id="code-content" class="language-javascript">
// check-node.mjs: is this Node version right for the project?
import { readFile } from 'node:fs/promises';
const REQUIRED_MAJOR = 24; // what our project's "engines" field asks for
// process.versions.node looks like "24.12.0"
const [major, minor, patch] = process.versions.node.split('.').map(Number);
console.log(`You are running Node ${major}.${minor}.${patch}`);
// process.release.lts holds the LTS codename, or undefined on non-LTS releases
const lts = process.release.lts;
console.log(lts ? `This is an LTS release (codename: ${lts})` : 'This is not an LTS release');
if (major &gt;= REQUIRED_MAJOR) {
  console.log(`OK: Node ${REQUIRED_MAJOR} or newer is installed.`);
} else {
  console.log(`Please install Node ${REQUIRED_MAJOR}, e.g. "fnm install ${REQUIRED_MAJOR}".`);
}
// --- If there is an .nvmrc in this folder, compare against it too
try {
  const wanted = (await readFile('.nvmrc', 'utf8')).trim();
  console.log(`.nvmrc asks for "${wanted}"`);
  console.log(String(major) === wanted.replace(/^v/, '').split('.')[0]
    ? 'Your Node major version matches .nvmrc.'
    : 'Run "fnm use" or "nvm use" to switch versions.');
} catch {
  console.log('No .nvmrc here. Create one containing "24" to pin the version.');
}
// --- Where is this node binary?
console.log('Node binary:', process.execPath);
</code></pre>

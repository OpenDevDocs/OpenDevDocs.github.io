---
publishDate: 2026-10-25T08:45
title: npm, npx and node --run
slug: npm-npx-and-node-run
metadescription: Install and remove packages with npm, run package tools once with npx, and run package.json scripts with npm run or the faster built-in node --run.
updateDate: 2026-10-25T08:45
author: ['bishal-biswas']
level: 1
tags: ['npm', 'npx', 'scripts', 'tooling']
course: nodejs
---

## Three tools, three jobs

These three commands come up in every Node project, and beginners often mix them up:

- **npm** installs and manages packages, and runs your scripts.
- **npx** runs a command from a package, downloading it first if needed.
- **`node --run`** runs your `package.json` scripts, faster than npm, built straight into Node.

Think of a workshop. npm is the person who stocks the tool shelves. npx is borrowing a tool from the hire shop for one job. `node --run` is the list of jobs pinned to the wall, ready to start with one word.

All of them work with the `package.json` you met in [package.json Explained](/courses/nodejs/package-json-explained).

## npm: installing packages

npm comes with Node, so there is nothing extra to install. It downloads packages from the **npm registry**, the big public library of shared JavaScript code.

### Adding a package

```bash
npm install slugify
```

This does three things:

1. Downloads `slugify` (and anything it depends on) into a folder called **`node_modules`**.
2. Adds `"slugify": "^1.6.9"` to `dependencies` in `package.json`.
3. Records the exact versions installed in **`package-lock.json`**.

Now you can import it by name:

```javascript
// slug.js
import slugify from 'slugify';

console.log(slugify('Hello Node World', { lower: true })); // prints: hello-node-world
```

Node finds `slugify` by looking in `node_modules`. You never write the path yourself.

### The commands you will use most

```bash
npm install                    # install everything listed in package.json
npm install express            # add a dependency (short form: npm i express)
npm install --save-dev prettier # add a dev-only dependency (short form: -D)
npm uninstall express          # remove a package
npm ls                         # list what is installed
npm outdated                   # show packages with newer versions available
npm update                     # update packages within their allowed ranges
```

`npm ls` prints a tree:

```text
notes-app@1.0.0 /Users/asha/notes-app
├── cowsay@1.6.0
└── slugify@1.6.9
```

### node_modules and package-lock.json

- **`node_modules`** holds the downloaded code. It can be huge and is always rebuildable, so **never commit it** to Git. Add it to `.gitignore`.
- **`package-lock.json`** records the exact version of every package. **Always commit it**, so everyone installs the same versions.

When you clone a project, run `npm install` and npm rebuilds `node_modules` from those two files. In automated builds, `npm ci` does a clean, exact install from the lockfile. [Semantic Versioning and Lockfiles](/courses/nodejs/semver-and-lockfiles) explains both in depth.

### Global installs

```bash
npm install -g some-tool
```

`-g` installs a package **globally**, as a command available everywhere on your computer. It is tempting, but it has downsides: every project shares one version, and teammates may not have it. Prefer installing tools into the project with `-D` and running them through scripts or npx.

## Scripts with npm run

Scripts are named commands in `package.json`:

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "greet": "node greet.js",
    "hello": "cowsay Hello from a script"
  }
}
```

Run any of them with `npm run <name>`:

```bash
npm run dev
```

`start` and `test` are special. They have shortcuts without `run`:

```bash
npm start
npm test
```

Type `npm run` on its own to list every script in the project.

### Scripts can use project tools

Notice the `hello` script calls `cowsay`, even though it is not installed globally. When npm runs a script, it adds **`node_modules/.bin`** to the command search path. That folder holds the commands of every installed package. So once `cowsay` is in your devDependencies, your scripts can call it by name.

### Passing arguments

Put `--` after the script name. Everything after it goes to your script:

```javascript
// greet.js
console.log('Hello', process.argv.slice(2).join(' ') || 'world');
```

```bash
npm run greet -- Asha
```

```text
> notes-app@1.0.0 greet
> node greet.js Asha

Hello Asha
```

Without `--`, npm may treat options like `--verbose` as its own and never pass them on.

### pre and post scripts

If a script called `pregreet` exists, `npm run greet` runs it first. Likewise `postgreet` runs afterwards. This is handy for steps like "build before deploy", but it can also surprise you, so use it sparingly.

## npx: run a package's command

**npx** runs a command that comes from an npm package.

```bash
npx cowsay "Hello, Asha"
```

```text
 _____________
< Hello, Asha >
 -------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

npx looks in two places:

1. **Your project's `node_modules/.bin`.** If the package is installed locally, npx runs that version.
2. **The registry.** If not, npx downloads the package to a cache and runs it, without adding it to your project. The first time, it asks first:

```text
Need to install the following packages:
cowsay@1.6.0
Ok to proceed? (y)
```

This is perfect for tools you use once, such as project generators:

```bash
npx create-vite@latest my-app
```

Add `--yes` to skip the question in automated scripts. `npm exec` is the longer name for the same command.

> **Tip:** npx downloads and runs code from the internet. Check the package name carefully before pressing `y`. Attackers sometimes publish packages with names one letter away from popular ones.

## node --run: the built-in script runner

Since Node 22, Node can run `package.json` scripts by itself:

```bash
node --run dev
node --run greet -- Asha
```

It reads the same `scripts` section as `npm run`, and it also adds `node_modules/.bin` to the search path, so the `hello` script that calls `cowsay` works too.

### Why use it?

`node --run` starts noticeably faster, because it does not load all of npm first. For a script you run dozens of times a day, the saved time adds up.

### How it differs from npm run

`node --run` is deliberately simple:

- It does **not** run `pre` and `post` scripts.
- It does not set npm's `npm_*` environment variables. It sets `NODE_RUN_SCRIPT_NAME` and `NODE_RUN_PACKAGE_JSON_PATH` instead.
- Arguments must come after `--`. `node --run greet Asha` ignores `Asha`.
- It only runs scripts. Installing packages is still npm's job.

If a script name is wrong, it lists the scripts that do exist:

```bash
node --run nope
```

```text
Missing script: "nope" for /Users/asha/notes-app/package.json

Available scripts are:
  start: node src/index.js
  dev: node --watch src/index.js
  greet: node greet.js
  hello: cowsay Hello from a script
```

## Which one when?

| You want to... | Use |
| --- | --- |
| Install, update or remove packages | `npm install`, `npm update`, `npm uninstall` |
| Run one of your own scripts quickly | `node --run dev` |
| Run a script that relies on `pre`/`post` hooks | `npm run build` |
| Run a tool once without adding it to the project | `npx create-vite@latest` |
| Run a tool installed in the project, from the terminal | `npx prettier --check .` |

## Common mistakes

### Running npm in the wrong folder

npm works on the `package.json` of the folder you are in. If `npm run dev` says the script is missing, check with `pwd` (macOS, Linux) or `Get-Location` (PowerShell) that you are in the project folder.

### Using sudo with npm

On macOS and Linux, `sudo npm install -g` causes permission problems later. Install Node with a version manager instead, as shown in [Installing Node.js LTS and Version Managers](/courses/nodejs/installing-nodejs-and-version-managers), and you will never need `sudo`.

### Committing node_modules

```text
# .gitignore
node_modules/
```

Add this file to your project before your first commit. Commit `package-lock.json` instead.

## Quick recap

- **npm** installs packages into `node_modules`, records them in `package.json` and pins exact versions in `package-lock.json`.
- Commit the lockfile, never `node_modules`.
- `npm run <name>` runs a script; `npm start` and `npm test` are shortcuts. It also runs `pre`/`post` scripts.
- Scripts can call tools from `node_modules/.bin` by name.
- **npx** runs a package's command, using the local copy or downloading it to a cache.
- **`node --run <name>`** runs scripts faster, without `pre`/`post` hooks. Put arguments after `--`.

<code id="code-content" class="language-javascript">
// scripts-demo.mjs: npm run vs node --run in a throwaway project
import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
// --- 1. Make a tiny project with three scripts
const dir = path.join(os.tmpdir(), 'scripts-demo');
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'greet.js'), [
  "const who = process.argv.slice(2).join(' ') || 'world';",
  "console.log('Hello, ' + who + '! (script: ' + (process.env.NODE_RUN_SCRIPT_NAME ?? process.env.npm_lifecycle_event) + ')');",
].join('\n'));
await writeFile(path.join(dir, 'package.json'), JSON.stringify({
  name: 'scripts-demo',
  private: true,
  type: 'module',
  scripts: {
    pregreet: 'node -e "console.log(\'pregreet ran first\')"',
    greet: 'node greet.js',
  },
}, null, 2));
// --- 2. node --run: fast, no pre/post scripts, arguments after --
console.log('--- node --run greet -- Asha');
console.log(execFileSync(process.execPath, ['--run', 'greet', '--', 'Asha'], { cwd: dir, encoding: 'utf8' }));
// --- 3. npm run: also runs pregreet (execSync uses a shell, so "npm" works on every OS)
console.log('--- npm run greet -- Ravi');
try {
  console.log(execSync('npm run greet --silent -- Ravi', { cwd: dir, encoding: 'utf8' }));
} catch {
  console.log('npm was not found on this machine');
}
// --- 4. A missing script lists the ones that exist
try {
  execFileSync(process.execPath, ['--run', 'nope'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
} catch (error) {
  console.log('--- node --run nope');
  console.log(error.stderr.trim());
}
</code></pre>

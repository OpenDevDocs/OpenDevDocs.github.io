---
publishDate: 2026-10-25T12:00
title: Single Executable Applications
slug: single-executable-applications
metadescription: Ship a Node.js app as one executable file. Build it with node --build-sea in Node 26, or with the blob and postject flow in Node 24, and embed assets.
updateDate: 2026-10-25T12:00
author: ['bishal-biswas']
level: 3
tags: ['sea', 'distribution', 'cli', 'packaging']
course: nodejs
---

## What is a single executable application?

Normally, to run your Node program, a user needs Node installed, your code, and probably a `node_modules` folder. For a developer that is fine. For a colleague in accounts who just wants your report tool, it is a lot to ask.

A **single executable application** (**SEA** for short) is your app and the Node runtime packed into **one file**. The user downloads `report-tool.exe` (or `report-tool` on macOS and Linux), double-clicks or runs it, and it works. No Node install, no `npm install`.

Think of a ready meal. Instead of handing someone a recipe, a shopping list and a pan, you give them one box that already contains everything. They just heat it up.

> **Note:** SEA is still marked as under **active development** in the Node documentation, so details change between versions. This lesson shows the flow for Node 24 and for Node 26.

## How it works

A SEA is a copy of the `node` program with your script **injected** (written) into a special spot inside it. When that copy starts, it notices the embedded script and runs it instead of waiting for a filename.

Because the whole Node runtime is inside, the file is big: roughly the size of the `node` binary itself, so tens of megabytes even for "Hello world".

The executable only runs on the platform it was built for. A Windows `.exe` will not run on macOS. Build once per platform you want to support.

## Step 1: prepare one script

A SEA embeds **one** JavaScript file. Two rules for that file:

1. **Use CommonJS** (`require`). In Node 24 this is the only supported format. Node 26 adds an option for ES modules, covered below.
2. **Only built-in modules can be required.** Inside a SEA, `require()` can load `node:fs`, `node:path` and other built-ins, but not files from disk or `node_modules`.

So if your app has several files or npm packages, first **bundle** it: use a bundler such as esbuild or Rollup to combine everything into one `.js` file. For this lesson, a single file is enough:

```javascript
// hello.js
const { isSea } = require('node:sea');

console.log(`Hello, ${process.argv[2] ?? 'world'}!`);
console.log('Running as a single executable:', isSea());
```

Test it the normal way first:

```bash
node hello.js Asha
```

```text
Hello, Asha!
Running as a single executable: false
```

The built-in `node:sea` module tells your code whether it is running inside an executable. `isSea()` returns `false` here because we ran it with plain `node`.

## Building with Node 26: node --build-sea

Since Node 25.5, and so in every Node 26 release, Node can build the executable by itself with one command.

Create `sea-config.json`. Here `output` is the name of the **finished executable**:

```json
{
  "main": "hello.js",
  "output": "hello"
}
```

On Windows, use `"output": "hello.exe"`. The `.exe` extension is required there.

Then build:

```bash
node --build-sea sea-config.json
```

Node copies its own binary, injects `hello.js` into it, and writes `hello` (or `hello.exe`). Run it:

```bash
./hello world      # macOS and Linux
.\hello.exe world  # Windows
```

It prints the greeting just like before, but this time `isSea()` returns `true`, and no `node` command or `hello.js` file was needed.

### Signing on macOS and Windows

macOS refuses to run binaries whose code signature does not match their contents, and injecting changes the contents. Re-sign it with an **ad-hoc signature** (a local signature that needs no certificate):

```bash
codesign --sign - hello
```

On Windows, signing is optional. An unsigned `.exe` runs, though Windows SmartScreen may warn users. If you have a code-signing certificate:

```powershell
signtool sign /fd SHA256 hello.exe
```

Linux needs no signing step.

## Building with Node 24: the blob and postject flow

Node 24 does not have `--build-sea`. If you try it, Node stops with `bad option: --build-sea`.

Instead, you build the executable in several steps. Node produces a **preparation blob** (a file holding your script in the format Node expects) and a separate tool, **postject**, injects it into a copy of `node`.

### 1. Make the blob

Here `output` is the **blob** file, not the executable:

```json
{
  "main": "hello.js",
  "output": "sea-prep.blob"
}
```

```bash
node --experimental-sea-config sea-config.json
```

```text
Wrote single executable preparation blob to sea-prep.blob
```

### 2. Copy the node binary

```bash
cp $(command -v node) hello                                           # macOS and Linux
node -e "require('fs').copyFileSync(process.execPath, 'hello.exe')"   # Windows
```

### 3. Remove the existing signature (macOS, optional on Windows)

```bash
codesign --remove-signature hello   # macOS
signtool remove /s hello.exe        # Windows, optional
```

### 4. Inject the blob with postject

`postject` is an npm package, so `npx` downloads and runs it. The long `--sentinel-fuse` value is a fixed marker string that Node looks for, copy it exactly:

```bash
# Linux
npx postject hello NODE_SEA_BLOB sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# macOS: one extra option
npx postject hello NODE_SEA_BLOB sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
    --macho-segment-name NODE_SEA
```

On Windows, in PowerShell, put it on one line:

```powershell
npx postject hello.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
```

### 5. Sign again and run

Sign on macOS (`codesign --sign - hello`), optionally on Windows (`signtool sign /fd SHA256 hello.exe`), then run `./hello world` or `.\hello.exe world`.

That is the same result as `--build-sea`, with more manual steps. When your project moves to Node 26, you can replace steps 1 to 4 with the single command.

## More config options

Both flows read the same kind of config file. Useful fields:

```json
{
  "main": "hello.js",
  "output": "hello",
  "disableExperimentalSEAWarning": true,
  "useCodeCache": true,
  "assets": {
    "config.json": "./config.json"
  }
}
```

- `disableExperimentalSEAWarning`: hide the "experimental feature" warning that the executable otherwise prints when it starts.
- `useCodeCache`: embed V8's compiled code cache so the app starts a little faster.
- `assets`: extra files to pack inside the executable. The key is the name you use in code, the value is the file on disk.

Node 26 adds `"mainFormat": "module"` to embed an ES module instead of CommonJS, and an `executable` field to choose which Node binary to build from (by default, the one running the command).

## Reading embedded assets

Packed assets are read with `node:sea`, not `node:fs`, because they live inside the executable rather than on disk:

```javascript
const sea = require('node:sea');

if (sea.isSea()) {
  const config = JSON.parse(sea.getAsset('config.json', 'utf8'));
  console.log(config.greeting);
}
```

- `getAsset(key, 'utf8')` returns the file as a string. Without an encoding it returns an `ArrayBuffer`.
- `getAssetAsBlob(key)` returns a `Blob`.

Calling `getAsset` outside an executable throws `ERR_NOT_IN_SINGLE_EXECUTABLE_APPLICATION`, so check `isSea()` first, as the playground below does.

## Common mistakes

### Requiring your own files

```javascript
const helpers = require('./helpers.js'); // fails inside a SEA
```

The embedded script cannot load files from disk. Bundle everything into one file first, or embed data files as assets.

### Expecting one build to run everywhere

A SEA built on Windows produces a Windows executable. Build on each platform (a CI matrix with Windows, macOS and Linux runners is the usual way), or check the Node docs for cross-platform options.

### Forgetting to sign on macOS

macOS, especially on Apple Silicon, refuses to run a modified binary whose signature no longer matches. Always run `codesign --sign -` after injecting.

### Mixing up what output means

With `--experimental-sea-config` (Node 24), `output` is the blob. With `--build-sea` (Node 26), `output` is the finished executable. Keep a separate config file per flow if you need both.

## Quick recap

- A **SEA** packs your script and the Node runtime into one executable file.
- The script must be one file. Use CommonJS in Node 24, and only `require` built-ins. Bundle bigger apps first.
- **Node 26**: `node --build-sea sea-config.json` builds the executable directly. `output` is the executable's name.
- **Node 24**: `node --experimental-sea-config` makes a blob, then copy `node`, inject with `npx postject`, and sign.
- Re-sign with `codesign --sign -` on macOS. Signing is optional on Windows.
- Embed extra files with `assets` and read them with `require('node:sea').getAsset()`.

<code id="code-content" class="language-javascript">
// greet.js: a CommonJS script ready to become a single executable app.
// Try it normally first:   node greet.js Asha
// Then build it (Node 26):  node --build-sea sea-config.json
// sea-config.json: { "main": "greet.js", "output": "greet", "assets": { "config.json": "config.json" } }
// (on Windows, write "greet.exe" as the output)
const sea = require('node:sea'); // built-ins are the only things require() can load inside a SEA
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// Load settings: from the embedded asset inside the executable, or from disk otherwise
function loadConfig() {
  if (sea.isSea()) {
    return JSON.parse(sea.getAsset('config.json', 'utf8'));
  }
  const file = path.join(__dirname, 'config.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return { greeting: 'Hello' }; // sensible default so the script always runs
}
const config = loadConfig();
const name = process.argv[2] ?? os.userInfo().username;
// When running as an executable there is no separate script file:
// process.execPath is the executable itself.
console.log(`${config.greeting}, ${name}!`);
console.log('Running as a single executable:', sea.isSea());
console.log('Program file:', path.basename(sea.isSea() ? process.execPath : __filename));
console.log('Node version baked in:', process.version);
console.log('Platform:', `${process.platform}-${process.arch}`);
// A tiny bit of real work: count words in a file passed as the second argument
const target = process.argv[3];
if (target) {
  const text = fs.readFileSync(target, 'utf8');
  const words = text.split(/\s+/).filter(Boolean).length;
  console.log(`${path.basename(target)} has ${words} words`);
} else {
  console.log('Tip: pass a file as the second argument to count its words');
}
</code></pre>

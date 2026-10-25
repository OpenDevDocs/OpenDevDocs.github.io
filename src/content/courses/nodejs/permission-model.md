---
publishDate: 2026-10-25T11:55
title: The Permission Model
slug: permission-model
metadescription: Restrict what a Node.js program can touch with --permission. Allow file reads and writes, child processes and workers, and check access with process.permission.
updateDate: 2026-10-25T11:55
author: ['bishal-biswas']
level: 3
tags: ['security', 'permissions', 'sandbox']
course: nodejs
---

## Why limit your own program?

By default, a Node program can do anything **you** can do. It can read your SSH keys, delete your documents, start other programs and talk to any server.

Usually that is fine. But your app pulls in hundreds of npm packages written by strangers. If one of them is hijacked, it gets all of those powers too.

Think of a hotel key card. A guest's card opens their own room and the gym, not every door in the building. If they lose it, the damage is limited. The **permission model** gives your Node program a key card: it can only open the doors you list.

## Turning it on

Start Node with the `--permission` flag. Everything risky is then **denied** unless you explicitly allow it.

Here is a small script that reads a file and writes another:

```javascript
// app.mjs
import { readFile, writeFile } from 'node:fs/promises';

const names = await readFile('data/names.txt', 'utf8');
console.log('names:', names.trim());

await writeFile('data/out.txt', names.toUpperCase());
console.log('wrote out.txt');
```

Without the flag it works as normal. With it:

```bash
node --permission app.mjs
```

```text
Error: Access to this API has been restricted. Use --allow-fs-read to manage permissions.
  code: 'ERR_ACCESS_DENIED',
  permission: 'FileSystemRead',
  resource: '/home/asha/project/data/names.txt'
}
```

The error tells you which permission was missing (`FileSystemRead`) and which file was involved. Node can still read the script you asked it to run, but nothing else.

> **Note:** Older Node versions called this flag `--experimental-permission`. In Node 24 it is `--permission`.

## What gets restricted

With `--permission` on, these are blocked until you allow them:

| Allow flag | What it unlocks |
| --- | --- |
| `--allow-fs-read=path` | Reading files and folders at that path |
| `--allow-fs-write=path` | Creating, changing and deleting files at that path |
| `--allow-child-process` | Starting other programs (`node:child_process`) |
| `--allow-worker` | Creating worker threads (`node:worker_threads`) |
| `--allow-addons` | Loading native C++ addons |
| `--allow-wasi` | Using WebAssembly System Interface |
| `--allow-inspector` | Using the debugger inspector |

Network access is **not** restricted in Node 24: `fetch` and `http` keep working under `--permission`. Newer release lines add a separate `--allow-net` flag for that.

## Allowing file access

Give a path to `--allow-fs-read` and `--allow-fs-write`. Allowing a folder includes everything inside it:

```bash
node --permission --allow-fs-read=./data app.mjs
```

```text
names: Asha,Ravi,Maya
Error: Access to this API has been restricted. Use --allow-fs-write to manage permissions.
```

Reading now works, but writing is still blocked. Allow both:

```bash
node --permission --allow-fs-read=./data --allow-fs-write=./data app.mjs
```

```text
names: Asha,Ravi,Maya
wrote out.txt
```

The program can now touch `./data` and nothing else on your disk.

### Several paths

Repeat the flag once per path:

```bash
node --permission --allow-fs-read=./data --allow-fs-read=./config.json app.mjs
```

Older docs show comma-separated lists (`--allow-fs-read=./data,./config.json`). That form is no longer valid. Node 24 prints a warning and the paths are not allowed.

### Allowing everything

`*` means "any path". Quote it so your shell does not try to expand it:

```bash
node --permission --allow-fs-read="*" app.mjs
```

A common, practical setup is "read anything, write only to one folder", so the app can load its code and packages but can only change files in, say, `./uploads`.

> **Tip:** Your own imports count as file reads. If `app.mjs` imports `./lib.mjs` or a package from `node_modules`, Node must be allowed to read those files too, or the import fails with `ERR_ACCESS_DENIED`. Allowing your project folder (`--allow-fs-read=.`) covers that.

## Child processes and workers

These are simple on/off switches:

```javascript
// spawn-test.mjs
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';

try {
  execFileSync(process.execPath, ['--version']);
} catch (err) {
  console.log(err.message);
}

try {
  new Worker('1 + 1', { eval: true });
} catch (err) {
  console.log(err.message);
}
```

```bash
node --permission spawn-test.mjs
```

```text
Access to this API has been restricted. Use --allow-child-process to manage permissions.
Access to this API has been restricted. Use --allow-worker to manage permissions.
```

Add `--allow-child-process` or `--allow-worker` to unlock them. When you allow child processes, Node warns you:

```text
SecurityWarning: The flag --allow-child-process must be used with extreme caution. It could invalidate the permission model.
```

The warning is fair. A child process is a whole new program, and it can do what the restrictions were stopping. Only allow it when you truly need it.

## Checking permissions in code

`process.permission` exists only when Node started with `--permission`. Its `has()` method asks "am I allowed to do this?" without trying and failing:

```javascript
// check.mjs
if (!process.permission) {
  console.log('Permission model is off');
} else {
  console.log(process.permission.has('fs.read'));                    // any read allowed everywhere?
  console.log(process.permission.has('fs.read', './data/names.txt')); // this file?
  console.log(process.permission.has('fs.write', './data'));
  console.log(process.permission.has('child'));
  console.log(process.permission.has('worker'));
}
```

```bash
node --permission --allow-fs-read=./data check.mjs
```

```text
false
true
false
false
false
```

The first `false` is because reads are only allowed for `./data`, not *everywhere*. The second asks about one file inside `./data`, so it is `true`.

The scope names you pass to `has()` are `'fs.read'`, `'fs.write'`, `'child'` and `'worker'`. Use this to give a friendly message or turn a feature off, instead of crashing:

```javascript
if (process.permission && !process.permission.has('fs.write', './uploads')) {
  console.log('Uploads are disabled: start with --allow-fs-write=./uploads');
}
```

## Handling a denial

A blocked call throws (or rejects) with `err.code === 'ERR_ACCESS_DENIED'`, and `err.permission` names what was missing:

```javascript
try {
  await readFile('/etc/passwd', 'utf8');
} catch (err) {
  if (err.code === 'ERR_ACCESS_DENIED') {
    console.log(`Blocked: needs ${err.permission}`); // prints: Blocked: needs FileSystemRead
  } else {
    throw err;
  }
}
```

## What it is and is not

The permission model is a **seat belt**, not a bulletproof cage. It protects you against mistakes and limits the damage if a dependency misbehaves. The Node documentation is clear that it is not meant to safely run code you know is malicious.

For real isolation of untrusted code, use operating system tools: containers, separate users, or virtual machines. The permission model works well *together* with those. You will see more of this in [the Security and Supply Chain lesson](/courses/nodejs/security-and-supply-chain).

## Common mistakes

### Allowing a folder that does not exist yet

```bash
node --permission --allow-fs-write=./notes app.mjs # ./notes does not exist yet
```

Node works out the allowed paths when it starts. If `./notes` does not exist at that moment, Node treats it as a single file, not a folder, so writing `./notes/todo.txt` is denied. Create the folder first (`mkdir notes`), then start Node.

### Comma-separated paths

```bash
node --permission --allow-fs-read=./data,./config.json app.mjs # wrong
```

Repeat the flag instead: `--allow-fs-read=./data --allow-fs-read=./config.json`.

### Forgetting about imports and packages

If your app suddenly cannot start under `--permission`, check whether it is failing to read its own modules or `node_modules`. Allow read access to the project folder.

### Treating it as a full sandbox

Allowing `--allow-child-process` or `--allow-addons` can undo the restrictions, because those can run code outside Node's control. Keep the allow list as short as possible.

## Quick recap

- `node --permission app.mjs` denies file access, child processes, workers, addons, WASI and the inspector by default.
- Unlock them with `--allow-fs-read=path`, `--allow-fs-write=path`, `--allow-child-process`, `--allow-worker` and friends.
- Allowing a folder includes its contents. Repeat the flag for several paths. `*` allows everything.
- Network access is not restricted in Node 24.
- `process.permission.has('fs.write', path)` checks access in code. Denials throw `ERR_ACCESS_DENIED`.
- It is a seat belt against mistakes and bad dependencies, not a sandbox for hostile code.

<code id="code-content" class="language-javascript">
// permissions-demo.mjs
// Try it three ways and compare the output:
//   node permissions-demo.mjs
//   node --permission permissions-demo.mjs
//   mkdir notes   (allowed folders must exist when Node starts)
//   node --permission --allow-fs-read=./notes --allow-fs-write=./notes permissions-demo.mjs
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { homedir } from 'node:os';
const notesDir = './notes';
const notePath = `${notesDir}/todo.txt`;
// process.permission only exists when Node was started with --permission
if (!process.permission) {
  console.log('Permission model is OFF: this script can do anything you can.');
} else {
  console.log('Permission model is ON. Checking what is allowed:');
  const checks = {
    'read ./notes': process.permission.has('fs.read', notesDir),
    'write ./notes': process.permission.has('fs.write', notesDir),
    'list home folder': process.permission.has('fs.read', homedir()),
    'child processes': process.permission.has('child'),
    'worker threads': process.permission.has('worker'),
  };
  console.table(checks);
}
// Each attempt is wrapped so a denial prints a message instead of crashing
async function attempt(label, action) {
  try {
    const result = await action();
    console.log(`OK      ${label}${result ? ': ' + result : ''}`);
  } catch (err) {
    if (err.code !== 'ERR_ACCESS_DENIED') throw err;
    console.log(`DENIED  ${label} (needs ${err.permission})`);
  }
}
await attempt('write a note', async () =&gt; {
  await mkdir(notesDir, { recursive: true });
  await writeFile(notePath, 'Buy milk\nCall Ravi\n');
});
await attempt('read the note', async () =&gt; (await readFile(notePath, 'utf8')).split('\n')[0]);
await attempt('list the home folder', async () =&gt; `${(await readdir(homedir())).length} entries`);
await attempt('start a child process', () =&gt; execFileSync(process.execPath, ['--version']).toString().trim());
await attempt('start a worker thread', () =&gt; {
  new Worker('1 + 1', { eval: true }).terminate();
});
</code></pre>

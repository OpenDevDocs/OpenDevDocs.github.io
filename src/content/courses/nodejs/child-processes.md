---
publishDate: 2026-10-25T11:35
title: "Child Processes: spawn, exec and fork"
slug: child-processes
metadescription: Run other programs from Node.js with spawn, exec, execFile and fork. Stream output, handle exit codes and timeouts, and avoid shell injection.
updateDate: 2026-10-25T11:35
author: ['bishal-biswas']
level: 3
tags: ['child-process', 'spawn', 'fork', 'ipc']
course: nodejs
---

## What is a child process?

A **process** is a running program. When you type `node app.js`, the operating system starts one process for it. Each process has its own memory and its own ID number, called a **PID**.

A **child process** is a program that your Node program starts. Your program is the **parent**.

Think of a head chef who hands jobs to other cooks. The head chef does not chop every onion. They say "you, peel these", carry on with their own work, and check back when the cook shouts "done".

You would use child processes to:

- Run another tool, like `git`, `ffmpeg` or a Python script.
- Run a slow, CPU-heavy job without freezing your main program.
- Start a helper Node script that talks back to you.

Everything lives in the built-in `node:child_process` module. It has four main functions:

| Function | Best for | Output arrives |
| --- | --- | --- |
| `execFile` | Running a program and collecting its output | All at once, at the end |
| `exec` | Running a **shell command** string | All at once, at the end |
| `spawn` | Long-running programs or lots of output | As a stream, while it runs |
| `fork` | Running another Node script that sends messages back | As messages |

> **Note:** The examples spawn `process.execPath`, which is the full path to the Node program running your script. Every reader has Node, so these examples work the same on Windows, macOS and Linux.

## execFile: run a program, get the output

`execFile` runs a program with a list of arguments and hands you everything it printed once it finishes. It uses a callback, so wrap it with `promisify` to get a promise you can `await`:

```javascript
// version.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const { stdout, stderr } = await execFileAsync(process.execPath, ['--version']);
console.log('Node version:', stdout.trim());
```

```text
Node version: v24.12.0
```

- `stdout` is **standard output**, what the program printed normally.
- `stderr` is **standard error**, where programs print warnings and errors.

Each argument is a separate string in the array. Node passes them straight to the program, so spaces and quotes inside an argument are safe.

### When the child fails

A program reports success or failure with an **exit code**: `0` means success, anything else means failure. A non-zero exit code makes the promise reject:

```javascript
try {
  await execFileAsync(process.execPath, ['-e', 'process.exit(3)']);
} catch (err) {
  console.log('failed with code', err.code); // prints: failed with code 3
}
```

If the program does not exist at all, `err.code` is the string `'ENOENT'` ("error, no entry") instead of a number.

### Timeouts

Pass `timeout` in milliseconds and Node kills a child that runs too long:

```javascript
try {
  await execFileAsync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { timeout: 500 });
} catch (err) {
  console.log('timed out:', err.killed, err.signal); // prints: timed out: true SIGTERM
}
```

`SIGTERM` is the polite "please stop" **signal**, a message the operating system sends to a process.

## exec: run a shell command

`exec` takes one string and runs it through a **shell**: `cmd.exe` on Windows, `/bin/sh` elsewhere. The shell is what lets you use things like pipes (`|`) and wildcards (`*`).

```javascript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const { stdout } = await execAsync('node -p "1 + 2"');
console.log(stdout.trim()); // prints: 3
```

It is convenient for one-off commands you write yourself. Shell syntax differs between Windows and Unix, though, so prefer `execFile` when you can.

> **Note:** Never build an `exec` string from user input. The Common mistakes section below shows why.

## spawn: stream the output as it happens

`execFile` and `exec` keep all output in memory until the child ends. That is a problem for a program that runs for an hour, or prints gigabytes.

`spawn` starts the child and gives you its output as **streams** (you met these in [the Streams Fundamentals lesson](/courses/nodejs/streams-fundamentals)):

```javascript
// spawn.mjs
import { spawn } from 'node:child_process';

const child = spawn(process.execPath, [
  '-e',
  'console.log("Hello from the child"); console.error("a warning")',
]);

child.stdout.on('data', (chunk) => process.stdout.write(`[out] ${chunk}`));
child.stderr.on('data', (chunk) => process.stdout.write(`[err] ${chunk}`));

child.on('close', (code) => console.log('child exited with code', code));
console.log('child started with pid', child.pid);
```

```text
child started with pid 9544
[out] Hello from the child
[err] a warning
child exited with code 0
```

Notice "child started" prints first. `spawn` returns immediately and the parent keeps working while the child runs.

Useful events on the child:

- `'close'`: the child exited and its output streams are finished. Use this one when you read output.
- `'exit'`: the child process ended.
- `'error'`: the child could not be started (for example, the program was not found).

### Waiting with await

`once` from `node:events` turns an event into a promise:

```javascript
import { once } from 'node:events';

const [code] = await once(child, 'close');
console.log('finished with', code);
```

### Sending input

The child's `stdin` (**standard input**) is a writable stream. Whatever you write, the child reads:

```javascript
const upper = spawn(process.execPath, [
  '-e',
  'process.stdin.on("data", (d) => process.stdout.write(String(d).toUpperCase()))',
]);

upper.stdout.on('data', (d) => console.log(String(d).trim())); // prints: HELLO ASHA
upper.stdin.write('hello asha\n');
upper.stdin.end(); // tell the child there is no more input
```

### Sharing your terminal

If you just want the child to print straight to your terminal, use `stdio: 'inherit'`:

```javascript
spawn(process.execPath, ['-e', 'console.log("straight to your terminal")'], { stdio: 'inherit' });
```

### Stopping a child

Call `child.kill()` to send `SIGTERM`, or pass an `AbortSignal` (see [the Promise Combinators and AbortSignal lesson](/courses/nodejs/promise-combinators-and-abortsignal)):

```javascript
const controller = new AbortController();
const looper = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
  signal: controller.signal,
});
looper.on('error', (err) => console.log(err.name)); // prints: AbortError
setTimeout(() => controller.abort(), 200);
```

## fork: Node talking to Node

`fork` is a special `spawn` for Node scripts. It sets up an **IPC channel** (inter-process communication), a private line the parent and child use to send each other JavaScript objects.

The child:

```javascript
// worker.mjs
process.on('message', (msg) => {
  const total = msg.numbers.reduce((a, b) => a + b, 0);
  process.send({ total });
  process.disconnect(); // close the channel so the child can exit
});
```

The parent:

```javascript
// main.mjs
import { fork } from 'node:child_process';

const child = fork(new URL('./worker.mjs', import.meta.url));

child.on('message', (msg) => console.log('parent got:', msg));
child.on('exit', (code) => console.log('child exited with code', code));

child.send({ numbers: [4, 8, 15] });
```

```text
parent got: { total: 27 }
child exited with code 0
```

- `child.send()` and `process.send()` send a message. Objects are copied, not shared.
- `'message'` events receive them on the other side.
- `process.send` only exists in a child started with `fork`, so `if (process.send)` tells a script whether it was forked.

The child is a whole separate Node process, so heavy work there never blocks the parent. The cost is start-up time and memory: each one is a full copy of Node. For CPU work inside one process, [the Worker Threads lesson](/courses/nodejs/worker-threads) shows a lighter option.

## Sync versions

Each function has a blocking twin: `execFileSync`, `execSync` and `spawnSync`. They freeze your program until the child finishes, which is fine in a build script or CLI tool but bad in a server:

```javascript
import { execFileSync } from 'node:child_process';

const platform = execFileSync(process.execPath, ['-p', 'process.platform'], { encoding: 'utf8' });
console.log(platform.trim()); // prints: win32 (or linux, or darwin)
```

`encoding: 'utf8'` gives you a string instead of a `Buffer`.

## Common mistakes

### Shell injection

```javascript
// DANGER: the user controls part of a shell command
const file = req.query.file; // imagine: "notes.txt & del /q *"
await execAsync(`type ${file}`);
```

The shell treats `&`, `;` and `|` as "run another command". A malicious value runs whatever it likes on your machine. This is called **shell injection**. Use `execFile` or `spawn` with an argument array, which never goes through a shell:

```javascript
await execFileAsync(process.execPath, ['print-file.mjs', file]); // file is just one argument
```

### Running npm and other .cmd files on Windows

```javascript
spawn('npm', ['--version']); // works on macOS/Linux, error ENOENT on Windows
```

On Windows, `npm` is really `npm.cmd`, a batch file. Node will not run `.cmd` or `.bat` files without a shell (calling `spawn('npm.cmd', ...)` throws `EINVAL`). Use the shell, and pass the whole command as **one string**:

```javascript
spawn('npm --version', { shell: true, stdio: 'inherit' });
```

Passing an argument array together with `shell: true` prints a `DEP0190` deprecation warning in Node 24, because the arguments are glued together without escaping. Only do this with fixed strings you wrote, never user input.

### Forgetting to read the output

If a spawned child prints a lot and nobody reads `stdout`, the pipe fills up and the child can stall. Either listen for `'data'`, pipe it somewhere, or use `stdio: 'inherit'` or `'ignore'`.

### Not handling 'error'

```javascript
spawn('no-such-program'); // crashes the parent with an unhandled 'error' event
```

Always add `child.on('error', ...)` when the program might not exist.

## Quick recap

- `node:child_process` lets your program start other programs.
- `execFile` runs a program with an argument array and returns all output at the end. Promisify it for `await`.
- `exec` runs a shell command string. Never put user input in it.
- `spawn` streams `stdout` and `stderr` while the child runs. Use it for long jobs and big output.
- `fork` starts a Node script with an IPC channel for `send()` and `'message'`.
- A non-zero exit code means failure. `timeout` and `AbortSignal` stop runaway children.
- Spawning `process.execPath` is a handy cross-platform way to run Node itself.

<code id="code-content" class="language-javascript">
// processes.mjs: run with  node processes.mjs  (works on Windows, macOS and Linux)
import { spawn, execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
// fork() runs THIS file again as a child. process.send only exists in a forked child.
if (process.send) {
  process.on('message', ({ numbers }) =&gt; {
    const total = numbers.reduce((a, b) =&gt; a + b, 0);
    process.send({ total, pid: process.pid });
    process.disconnect(); // close the channel so the child can exit
  });
} else {
  // --- 1. execFile: run a program, get all output at the end ---
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync(process.execPath, ['--version']);
  console.log('1. Node version from a child:', stdout.trim());
  // --- 2. spawn: stream output while the child runs ---
  const counter = spawn(process.execPath, [
    '-e',
    'for (let i = 1; i &lt;= 3; i++) console.log("tick " + i); console.error("done counting")',
  ]);
  // A chunk can hold several lines, so split it before printing
  const show = (label) =&gt; (chunk) =&gt;
    String(chunk).trim().split('\n').forEach((line) =&gt; console.log(`2. [${label}] ${line.trim()}`));
  counter.stdout.on('data', show('out'));
  counter.stderr.on('data', show('err'));
  const [code] = await once(counter, 'close');
  console.log('2. spawn finished with exit code', code);
  // --- 3. Failures: a non-zero exit code rejects the promise ---
  try {
    await execFileAsync(process.execPath, ['-e', 'process.exit(3)']);
  } catch (err) {
    console.log('3. child failed with code', err.code);
  }
  // --- 4. Timeouts: kill a child that takes too long ---
  try {
    await execFileAsync(process.execPath, ['-e', 'setTimeout(() =&gt; {}, 10000)'], { timeout: 300 });
  } catch (err) {
    console.log('4. killed after timeout:', err.killed, err.signal);
  }
  // --- 5. fork: a Node child with a message channel ---
  const child = fork(fileURLToPath(import.meta.url));
  child.send({ numbers: [4, 8, 15, 16, 23, 42] });
  const [reply] = await once(child, 'message');
  console.log(`5. child ${reply.pid} says the total is ${reply.total}`);
  await once(child, 'exit');
  console.log('All children finished. Parent pid:', process.pid);
}
</code></pre>

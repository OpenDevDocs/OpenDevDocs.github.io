---
publishDate: 2026-10-25T12:20
title: Reports, Heap Snapshots and Profiling
slug: diagnostics-and-profiling
metadescription: Find out why a Node app crashed, leaks memory or burns CPU. Learn diagnostic reports, heap snapshots, CPU and heap profiles, and how to read them in DevTools.
updateDate: 2026-10-25T12:20
author: ['bishal-biswas']
level: 3
tags: ['diagnostics', 'profiling', 'heap-snapshot', 'performance']
course: nodejs
---

## Why you need diagnostics

Sooner or later a Node app misbehaves in a way `console.log` cannot explain. It crashes at 3 a.m. Its memory creeps up for a week. One endpoint suddenly takes two seconds.

Doctors have a toolkit for this. A **check-up form** records the basics. An **X-ray** shows what is inside. A **heart monitor** shows activity over time. Node has the same three tools:

| Tool | Doctor's version | Answers |
| --- | --- | --- |
| **Diagnostic report** | Check-up form | What state was the process in? Why did it die? |
| **Heap snapshot** | X-ray | What objects are using memory, and who holds them? |
| **CPU profile** | Heart monitor | Which functions are using the CPU time? |

All three are built into Node. No packages needed.

## Diagnostic reports

A **diagnostic report** is a JSON file describing the process at one moment: Node version, operating system, the JavaScript and native stack, heap numbers, open handles (sockets, timers, files), resource usage and environment variables.

### Writing one from code

```javascript
// report.mjs
const file = process.report.writeReport();
console.log('Saved to', file);
```

```text
Writing Node.js report to file: report.20261025.163943.17600.0.001.json
Node.js report completed
Saved to report.20261025.163943.17600.0.001.json
```

The file name holds the date, time, process ID, thread ID and a sequence number. Pass your own name with `process.report.writeReport('my-report.json')`.

If you want the data without a file, `getReport()` returns it as an object:

```javascript
const report = process.report.getReport();
console.log(Object.keys(report));
console.log(report.header.nodejsVersion);
```

```text
[
  'header',
  'javascriptStack',
  'javascriptHeap',
  'nativeStack',
  'resourceUsage',
  'uvthreadResourceUsage',
  'libuv',
  'workers',
  'environmentVariables',
  'sharedObjects'
]
v24.12.0
```

The most useful sections when you are starting out:

- `header`: Node version, OS, CPU, the command line, and what triggered the report.
- `javascriptStack`: where the JavaScript code was when the report was taken.
- `javascriptHeap`: memory used and the heap limit.
- `libuv`: every open handle. Thousands of open sockets or timers is a big clue.

### Reports on crashes, automatically

The real power is letting Node write a report when something goes wrong. Turn it on with command-line flags:

```bash
# A report when an exception is never caught
node --report-uncaught-exception app.js

# A report when Node dies from a fatal error, such as running out of memory
node --report-on-fatalerror --report-dir=./reports app.js
```

Here is a script that deliberately runs out of memory, run with a tiny 32 MB heap so it fails fast:

```javascript
// oom.mjs
const hoard = [];
while (true) hoard.push(new Array(10000).fill('leak'));
```

```bash
node --report-on-fatalerror --report-dir=./reports --max-old-space-size=32 oom.mjs
```

```text
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory

Writing Node.js report to file: report.20261025.163956.18492.0.001.json
Node.js report completed
```

The report's `header.event` says `Allocation failed - JavaScript heap out of memory` and `header.trigger` says `OOMError`. Now you know why it died, even if nobody was watching.

> **Note:** The report directory must already exist. Node will not create it for you.

On Linux and macOS you can also ask a running process for a report with a signal (`--report-on-signal`, which uses `SIGUSR2` by default). Windows does not have that signal, so use `writeReport()` from code there.

> **Tip:** Reports include environment variables, which often hold secrets. Add `--report-exclude-env` before you share a report or store it somewhere public.

## Heap snapshots

A **heap snapshot** is a complete picture of every JavaScript object in memory and the references between them. It is the tool for memory leaks, which you will hunt properly in [the Memory Management lesson](/courses/nodejs/memory-management-and-leaks).

### Taking one

```javascript
import v8 from 'node:v8';

const file = v8.writeHeapSnapshot();
console.log(file); // Heap.20261025.163943.17600.0.002.heapsnapshot
```

For more control, `v8.getHeapSnapshot()` returns a readable stream you can pipe anywhere:

```javascript
import v8 from 'node:v8';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

await pipeline(v8.getHeapSnapshot(), createWriteStream('app.heapsnapshot'));
```

There are also flags for taking snapshots without changing code:

```bash
# Write a snapshot when the heap is about to run out (here: at most 1 snapshot)
node --heapsnapshot-near-heap-limit=1 app.js

# Linux and macOS: write a snapshot whenever the process receives SIGUSR2
node --heapsnapshot-signal=SIGUSR2 app.js
kill -USR2 <pid>
```

The second one does not work on Windows. Node refuses to start with `ERR_UNKNOWN_SIGNAL` because Windows has no `SIGUSR2`.

> **Warning:** Taking a snapshot pauses your app until it finishes, and Node's docs say it needs about twice the memory of the heap at that moment. On a big production heap that can mean seconds of freeze or even a crash. Take snapshots on a test copy or a single instance taken out of rotation.

### Reading a snapshot in DevTools

1. Open Chrome and go to `chrome://inspect`.
2. Click **Open dedicated DevTools for Node**.
3. Go to the **Memory** tab and click **Load**, then choose your `.heapsnapshot` file.

Two columns matter most:

- **Shallow size**: memory used by the object itself.
- **Retained size**: memory that would be freed if this object were deleted, including everything only it keeps alive.

Sort by retained size to find the biggest culprits. Load two snapshots taken a few minutes apart and use the **Comparison** view to see what grew.

## CPU profiles

A **CPU profile** records which function was running, sampled many times per second. Functions that appear in lots of samples are where your time goes. These hot spots are what you optimise.

### Profiling a whole run

```javascript
// busy.mjs
function slowFib(n) {
  return n < 2 ? n : slowFib(n - 1) + slowFib(n - 2);
}
function fastSum(n) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += i;
  return sum;
}
console.log(slowFib(30), fastSum(1e6));
```

```bash
node --cpu-prof --cpu-prof-dir=./profiles busy.mjs
```

```text
832040 499999500000
```

When the process exits, Node writes `profiles/CPU.20261025.164005.15804.0.001.cpuprofile`. Use `--cpu-prof-name` to pick the file name.

To read it, open DevTools (any Chrome DevTools window works), go to the **Performance** panel and drag the file in. You get a **flame chart**: time runs left to right, and each bar's width is how long that function ran. Wide bars are your targets. Here `slowFib` will dominate.

### Profiling just one part

Profiling a whole run includes startup noise. With the built-in inspector you can profile only the code you care about:

```javascript
// profile-part.mjs
import { Session } from 'node:inspector/promises';
import { writeFile } from 'node:fs/promises';

function slowFib(n) {
  return n < 2 ? n : slowFib(n - 1) + slowFib(n - 2);
}

const session = new Session();
session.connect();
await session.post('Profiler.enable');
await session.post('Profiler.start');

slowFib(28); // only this part is recorded

const { profile } = await session.post('Profiler.stop');
await writeFile('fib.cpuprofile', JSON.stringify(profile));
session.disconnect();
console.log('Saved fib.cpuprofile');
```

The saved file opens in DevTools exactly like one from `--cpu-prof`.

### Heap profiles

A CPU profile shows where *time* goes. A **heap profile** shows where *memory is allocated*, sampled over the run:

```bash
node --heap-prof --heap-prof-dir=./profiles busy.mjs
```

This writes a `.heapprofile` file. Load it in the DevTools **Memory** tab to see which functions allocated the most.

### Live profiling

For a server that is already running, start it with `--inspect`, connect DevTools, and press record in the Performance panel while you send it traffic. The [Debugging with the Inspector lesson](/courses/nodejs/debugging-with-the-inspector) shows how to connect.

## Which tool when?

| Symptom | Start with |
| --- | --- |
| Process crashed, nobody saw why | `--report-on-fatalerror` and `--report-uncaught-exception` |
| Memory grows over hours | Two heap snapshots, then the Comparison view |
| Out-of-memory crash | `--heapsnapshot-near-heap-limit=1` |
| High CPU, slow responses | `--cpu-prof` or a live DevTools recording |
| Lots of short-lived garbage | `--heap-prof` |
| Too many open connections or timers | The `libuv` section of a report |

## Common mistakes

**Profiling with no load.** A server sitting idle tells you nothing. Profile while sending realistic traffic, which you will learn to generate in [the Load Testing lesson](/courses/nodejs/load-testing-and-capacity-planning).

**Optimising before measuring.** Run the profile first, then look. Guessing which function is slow and rewriting it is how hours disappear.

**Sharing reports with secrets in them.** Use `--report-exclude-env`, or remove `environmentVariables` before sending a report to anyone.

**Forgetting where files go.** By default everything lands in the current working directory. Use `--report-dir`, `--cpu-prof-dir` and `--heap-prof-dir` to keep them in their own folders.

## Quick recap

- A diagnostic report is a JSON snapshot of process state; write it with `process.report.writeReport()`.
- `--report-on-fatalerror` and `--report-uncaught-exception` explain crashes after the fact.
- A heap snapshot shows every object and who keeps it alive; take one with `v8.writeHeapSnapshot()`.
- Snapshots pause the app and need extra memory, so be careful in production.
- `--cpu-prof` records a CPU profile; read the flame chart in the DevTools Performance panel.
- `node:inspector/promises` lets you profile just one part of your code.
- Signal-based triggers (`SIGUSR2`) do not exist on Windows.

<code id="code-content" class="language-javascript">
// diagnostics.mjs: a report, a focused CPU profile and a heap snapshot
import { Session } from 'node:inspector/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import v8 from 'node:v8';
await mkdir('diagnostics', { recursive: true });
// 1. A diagnostic report, read in memory (no file needed)
const report = process.report.getReport();
const heap = report.javascriptHeap;
console.log('Node:', report.header.nodejsVersion, 'on', report.header.osName);
console.log('Heap used:', (heap.usedMemory / 1024 / 1024).toFixed(1), 'MB');
console.log('Heap limit:', (heap.memoryLimit / 1024 / 1024).toFixed(0), 'MB');
console.log('Open libuv handles:', report.libuv.length);
// ...and one saved to disk for later
process.report.writeReport('diagnostics/report.json');
// 2. Profile only the code we care about
function slowFib(n) {
  return n &lt; 2 ? n : slowFib(n - 1) + slowFib(n - 2);
}
function buildOrders(count) {
  return Array.from({ length: count }, (_, id) =&gt; ({ id, total: id * 2.5 }));
}
const session = new Session();
session.connect();
await session.post('Profiler.enable');
await session.post('Profiler.start');
slowFib(32);
buildOrders(200_000);
const { profile } = await session.post('Profiler.stop');
session.disconnect();
await writeFile('diagnostics/work.cpuprofile', JSON.stringify(profile));
// 3. Find the hottest functions by sample count
const samples = new Map();
for (const node of profile.nodes) {
  const name = node.callFrame.functionName || '(anonymous)';
  samples.set(name, (samples.get(name) ?? 0) + (node.hitCount ?? 0));
}
const top = [...samples].sort((a, b) =&gt; b[1] - a[1]).slice(0, 3);
console.log('Hottest functions:', top);
// 4. A heap snapshot (pauses the app briefly, fine for a demo)
const snapshot = v8.writeHeapSnapshot('diagnostics/app.heapsnapshot');
console.log('Saved:', snapshot);
console.log('Open the .cpuprofile and .heapsnapshot files in Chrome DevTools');
</code></pre>

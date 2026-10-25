---
publishDate: 2026-10-25T12:25
title: Performance Hooks and Benchmarking
slug: performance-hooks-and-benchmarking
metadescription: Measure Node code accurately with performance.now, marks, measures, observers, timerify and event loop monitoring, then write fair benchmarks that you can trust.
updateDate: 2026-10-25T12:25
author: ['bishal-biswas']
level: 3
tags: ['performance', 'perf-hooks', 'benchmarking']
course: nodejs
---

## Measure, do not guess

A running coach does not say "that felt fast". They use a stopwatch. Code is the same: your gut feeling about what is slow is often wrong, and an "optimisation" you never measured may make things worse.

Node's `node:perf_hooks` module is your stopwatch kit. It gives you precise timers, named checkpoints, automatic timing of functions, and a health monitor for the event loop. All of it follows the same **Performance API** you find in browsers.

```javascript
import { performance, PerformanceObserver, monitorEventLoopDelay } from 'node:perf_hooks';
```

`performance` is also available as a global, so for simple timing you do not even need the import.

## Three clocks

```javascript
// clocks.mjs
const a = Date.now();               // milliseconds since 1970, a whole number
const b = performance.now();        // milliseconds since the process started, with decimals
const c = process.hrtime.bigint();  // nanoseconds, as a BigInt

console.log(typeof a, typeof b, typeof c); // number number bigint
```

- **`Date.now()`** is wall-clock time. It can jump if the system clock is adjusted, so it is poor for measuring short durations.
- **`performance.now()`** is **monotonic**, which means it only ever moves forward at a steady pace. It has sub-millisecond precision. Use this by default.
- **`process.hrtime.bigint()`** gives nanoseconds. Handy for very short operations.

The simplest measurement:

```javascript
const start = performance.now();

let sum = 0;
for (let i = 0; i < 1_000_000; i++) sum += i;

const took = performance.now() - start;
console.log(`Loop took ${took.toFixed(2)} ms`);
```

```text
Loop took 5.98 ms
```

Your number will differ. That is normal, and it is why the benchmarking section below runs code many times.

## Marks and measures

For timing several steps of a real task, sprinkling `performance.now()` everywhere gets messy. Use **marks** (named points in time) and **measures** (the gap between two marks):

```javascript
// steps.mjs
import { setTimeout as sleep } from 'node:timers/promises';

performance.mark('load-start');
await sleep(50); // pretend to read a file
performance.mark('load-end');

const measure = performance.measure('load-orders', 'load-start', 'load-end');
console.log(measure.name, measure.duration.toFixed(1), 'ms');
```

```text
load-orders 50.9 ms
```

You can look entries up later with `performance.getEntriesByName('load-orders')`.

> **Tip:** Marks and measures stay in memory until you remove them. In a long-running server, call `performance.clearMarks()` and `performance.clearMeasures()` regularly, or you have built a small memory leak.

## PerformanceObserver: get told about entries

A **PerformanceObserver** is a callback that Node calls whenever new performance entries appear. It keeps timing code separate from business code: you create measures in one place and report them in another.

```javascript
import { PerformanceObserver } from 'node:perf_hooks';

const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`[${entry.entryType}] ${entry.name}: ${entry.duration.toFixed(1)} ms`);
  }
});
observer.observe({ entryTypes: ['measure'] });
```

Node also produces entries of its own. Two useful ones:

- **`'gc'`**: one entry for each garbage collection pause, with `detail.kind` telling you whether it was a quick minor collection or a big major one.
- **`'http'`**: one entry for each HTTP request your server handles (`HttpRequest`) or your `http` client makes (`HttpClient`).

```javascript
observer.observe({ entryTypes: ['gc', 'http'] });
```

Call `observer.disconnect()` when you are done, or the observer keeps your process alive.

## timerify: time a function automatically

`performance.timerify()` wraps a function so every call creates a `'function'` entry:

```javascript
import { performance, PerformanceObserver } from 'node:perf_hooks';

function buildReport(rows) {
  return Array.from({ length: rows }, (_, id) => ({ id, total: id * 2 }));
}

const timedBuildReport = performance.timerify(buildReport);

const observer = new PerformanceObserver((list) => {
  const [entry] = list.getEntries();
  console.log(entry.name, entry.duration.toFixed(2), 'ms');
  observer.disconnect();
});
observer.observe({ entryTypes: ['function'] });

timedBuildReport(10_000);
```

```text
buildReport 0.80 ms
```

## Is the event loop healthy?

As you saw in [the Event Loop lesson](/courses/nodejs/the-event-loop), one slow synchronous task delays everything else. Two tools tell you how badly.

### Event loop delay

`monitorEventLoopDelay()` keeps a **histogram** (a record of how often each value happened) of how late the event loop runs compared with when it should:

```javascript
// loop-delay.mjs
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

const histogram = monitorEventLoopDelay({ resolution: 10 });
histogram.enable();
await sleep(50);

const before = performance.eventLoopUtilization();
const end = Date.now() + 200;
while (Date.now() < end) {} // block the loop for 200 ms on purpose
await sleep(50);
const usage = performance.eventLoopUtilization(before);

histogram.disable();
const ms = (ns) => (ns / 1e6).toFixed(0);
console.log(`max ${ms(histogram.max)} ms, p50 ${ms(histogram.percentile(50))} ms`);
console.log(`busy ${(usage.utilization * 100).toFixed(0)}% of the time`);
```

```text
max 200 ms, p50 16 ms
busy 76% of the time
```

Values are in nanoseconds, so divide by a million for milliseconds. The **p50** (50th percentile, the median) is the typical delay; the **max** shows the worst freeze. Timer precision varies by operating system, so a small baseline delay like 16 ms on Windows is normal.

### Event loop utilisation

`performance.eventLoopUtilization()` returns `{ idle, active, utilization }`. **Utilisation** is the fraction of time the loop was busy running code rather than waiting for work. Pass an earlier result to get the value for just that window, as above. A server sitting near 1 (100%) has no headroom left.

## Writing fair benchmarks

A **benchmark** compares how fast different pieces of code are. Done carelessly, benchmarks lie. Follow these rules:

1. **Warm up first.** V8 starts by interpreting your code and only compiles hot functions to fast machine code later (the **JIT**, just-in-time compiler). The first runs are slow and not representative.
2. **Run many iterations.** One call is too quick and too noisy to time.
3. **Repeat and take the median.** The **median** ignores the odd slow run caused by garbage collection or another program on your machine.
4. **Use the result.** If you never use what a function returns, V8 may skip the work completely and you measure nothing.
5. **Compare on the same machine, in the same run.** Absolute numbers mean little. "A is 3 times faster than B" is the useful part.

Here is a tiny helper that follows those rules:

```javascript
// bench.mjs
function bench(name, fn, { iterations = 10_000, runs = 7 } = {}) {
  let sink;
  for (let i = 0; i < iterations; i++) sink = fn(); // warm-up

  const times = [];
  for (let r = 0; r < runs; r++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) sink = fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const perOp = (median / iterations) * 1e6; // nanoseconds per call
  console.log(`${name.padEnd(12)} ${perOp.toFixed(0)} ns/op`);
  return sink; // using the result stops V8 skipping the work
}

const words = Array.from({ length: 100 }, (_, i) => `word${i}`);
bench('join', () => words.join(' '));
bench('concat +=', () => {
  let text = '';
  for (const word of words) text += word + ' ';
  return text;
});
```

For anything serious, use a library that also handles statistics and outliers, such as **tinybench** or **mitata**. To measure a whole HTTP server under load, use a load-testing tool instead, covered in [the Load Testing lesson](/courses/nodejs/load-testing-and-capacity-planning).

## Common mistakes

**Measuring once.** A single run swings wildly. Run it many times and look at the median.

**Logging inside the timed code.** `console.log` is slow and writes to the terminal. Keep it outside the start and end marks.

**Trusting micro-benchmarks too much.** Saving 50 nanoseconds in a function that runs once per request does not matter if the database call takes 20 milliseconds. Profile the whole request first (see [the Reports, Heap Snapshots and Profiling lesson](/courses/nodejs/diagnostics-and-profiling)), then benchmark the part that actually matters.

**Forgetting to clean up.** Leftover marks, measures and connected observers grow memory and can stop your process from exiting.

## Quick recap

- Use `performance.now()` for durations; it is precise and only moves forward.
- `mark()` and `measure()` name the steps of a task; clear them in long-running apps.
- `PerformanceObserver` reports entries, including Node's own `gc` and `http` entries.
- `performance.timerify()` times every call of a function.
- `monitorEventLoopDelay()` and `eventLoopUtilization()` show whether the event loop is blocked or busy.
- Fair benchmarks warm up, repeat, take the median and use the result.

<code id="code-content" class="language-javascript">
// perf-demo.mjs: marks, an observer, a fair benchmark and event loop health
import { PerformanceObserver, monitorEventLoopDelay } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
// 1. Report every measure through one observer
const observer = new PerformanceObserver((list) =&gt; {
  for (const entry of list.getEntries()) {
    console.log(`[measure] ${entry.name}: ${entry.duration.toFixed(1)} ms`);
  }
});
observer.observe({ entryTypes: ['measure'] });
// 2. Time the steps of a task with marks
performance.mark('fetch-start');
await sleep(40); // pretend to fetch orders
performance.mark('fetch-end');
const orders = Array.from({ length: 50_000 }, (_, id) =&gt; ({ id, total: (id % 100) + 0.5 }));
performance.mark('sum-end');
performance.measure('fetch orders', 'fetch-start', 'fetch-end');
performance.measure('build orders', 'fetch-end', 'sum-end');
// 3. A fair micro-benchmark: warm up, repeat, take the median, use the result
function bench(name, fn, { iterations = 200, runs = 7 } = {}) {
  let sink;
  for (let i = 0; i &lt; iterations; i++) sink = fn();
  const times = [];
  for (let r = 0; r &lt; runs; r++) {
    const start = performance.now();
    for (let i = 0; i &lt; iterations; i++) sink = fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) =&gt; a - b);
  const median = times[Math.floor(runs / 2)];
  console.log(`${name.padEnd(10)} ${((median / iterations) * 1000).toFixed(1)} us/op`);
  return sink;
}
bench('for loop', () =&gt; { let s = 0; for (const o of orders) s += o.total; return s; });
bench('reduce', () =&gt; orders.reduce((s, o) =&gt; s + o.total, 0));
// 4. Watch the event loop while we block it on purpose
const delay = monitorEventLoopDelay({ resolution: 10 });
delay.enable();
await sleep(30);
const before = performance.eventLoopUtilization();
const until = Date.now() + 150;
while (Date.now() &lt; until) {} // a synchronous freeze
await sleep(30);
const usage = performance.eventLoopUtilization(before);
delay.disable();
console.log(`Worst event loop delay: ${(delay.max / 1e6).toFixed(0)} ms`);
console.log(`Loop busy: ${(usage.utilization * 100).toFixed(0)}%`);
// 5. Clean up so the process can exit and memory stays flat
performance.clearMarks();
performance.clearMeasures();
observer.disconnect();
</code></pre>

---
course: javascript
slug: v8-garbage-collection
experienceLevel: senior
difficulty: hard
tags:
  - v8
  - memory
  - garbage-collection
question: How does garbage collection work in V8?
answer: |
  V8 uses a **generational**, tracing collector built on the observation that most objects die young.

  - **Young generation**: new objects are bump-allocated in a small nursery. When it fills, a **scavenge** copies live objects to another semi-space and promotes objects that have survived twice to the old generation. Cost is proportional to the **live** objects, not the garbage, so short-lived allocations are cheap. The scavenger runs in parallel on helper threads.
  - **Old generation**: collected by **mark-sweep-compact**. Marking starts from roots (the stack, globals, handles) and traces every reachable object. Sweeping frees the rest, and compaction moves objects to reduce fragmentation.

  The **Orinoco** project made most of this incremental, concurrent and parallel. Marking runs on background threads while JavaScript executes, kept correct by **write barriers** that record pointer changes, leaving only short main-thread pauses for finalisation. In Chrome, V8 also schedules GC work during idle time.

  What this means in practice:

  - Allocation is cheap, but a high allocation rate means frequent scavenges. Objects that survive just long enough to be promoted, like medium-lived caches and buffered batches, are the expensive ones.
  - GC is about **reachability**. Unreachable cycles are collected; reachable data you forgot about is a leak.
  - Node's old-space limit is derived from available memory. Set it explicitly in containers with `--max-old-space-size`, and tune the nursery with `--max-semi-space-size` for allocation-heavy servers.

  To diagnose GC pressure, use `--trace-gc`, a `PerformanceObserver` for the `'gc'` entry type in Node, or the Performance panel in DevTools. Look at pause times and at how much memory is promoted.
codeExample: |
  const v8 = require('node:v8');
  const vm = require('node:vm');
  v8.setFlagsFromString('--expose-gc');       // demo only: exposes gc()
  const gc = vm.runInNewContext('gc');

  const heapMB = () => process.memoryUsage().heapUsed / 1024 / 1024;

  let data = Array.from({ length: 300_000 }, (_, i) => ({ i, s: 'x' + i }));
  const withData = heapMB();

  data = null;                                 // drop the only reference
  gc();
  console.log('freed more than 10 MB:', withData - heapMB() > 10);
  // Output: freed more than 10 MB: true

  const spaces = v8.getHeapSpaceStatistics().map((s) => s.space_name);
  console.log(spaces.includes('new_space'), spaces.includes('old_space'));
  // Output: true true

  // Run with node --trace-gc app.js to see each Scavenge and Mark-Compact
popularity: 8.0
isPublished: true
---

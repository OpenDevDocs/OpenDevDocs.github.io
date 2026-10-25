---
course: javascript
slug: profiling-javascript-performance
experienceLevel: senior
difficulty: hard
tags:
  - performance
  - profiling
  - debugging
question: How do you profile a slow JavaScript application, in the browser and in Node.js?
answer: |
  Profile before optimising. Intuition about where time goes is wrong surprisingly often, and the goal is to find the few functions or phases that dominate.

  **In the browser**, use the DevTools **Performance** panel with CPU throttling (4x to 6x) to approximate a mid-range phone:

  - The main-thread flame chart shows long tasks (red corners), and the work inside them split into scripting, style, layout and paint.
  - "Bottom-up" view sorts functions by **self time**, which is usually where to start.
  - Look for **forced reflows** (layout triggered by reading `offsetHeight` right after a DOM write), long event handlers, and heavy hydration or render work.
  - Use `performance.mark()` and `performance.measure()` to label your own phases. They appear in the timeline and can be sent as RUM.

  **In Node.js**:

  - `node --cpu-prof app.js` writes a `.cpuprofile` file you can open in DevTools, or use `node --inspect` and record live from `chrome://inspect`.
  - Flame graph tools (`0x`, or Clinic.js Flame) are handy for servers under load. Generate realistic load with `autocannon` or k6 while profiling.
  - Check the **event loop delay** (`perf_hooks.monitorEventLoopDelay`) and GC activity (`--trace-gc`). High latency with low CPU usually means waiting on I/O or locks, not slow JavaScript.
  - `--heap-prof` and heap snapshots help when allocation, not computation, is the cost.

  Reading profiles well:

  - Distinguish **self** time from **total** time.
  - Watch for "(garbage collector)" and "(program)" buckets.
  - Remember that minified code needs source maps to be readable.

  For micro-optimisations, use a benchmark harness (mitata, tinybench) that warms up, runs many iterations and reports variance. Then confirm the win in the real profile, since JIT behaviour in isolation often differs from production.
codeExample: |
  const { performance, PerformanceObserver } = require('node:perf_hooks');

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`${entry.entryType}: ${entry.name} took ${entry.duration > 0 ? '>0' : '0'} ms`);
    }
  });
  observer.observe({ entryTypes: ['measure', 'function'] });

  // 1. Label phases with marks and measures
  const payload = JSON.stringify(Array.from({ length: 50_000 }, (_, i) => ({ id: i })));
  performance.mark('parse:start');
  const rows = JSON.parse(payload);
  performance.mark('parse:end');
  performance.measure('parse', 'parse:start', 'parse:end');

  // 2. Wrap a suspect function to time every call
  function sortRows(data) { return data.toSorted((a, b) => b.id - a.id); }
  const timedSort = performance.timerify(sortRows);
  timedSort(rows);

  setImmediate(() => observer.disconnect());
  // Output:
  // measure: parse took >0 ms
  // function: sortRows took >0 ms

  // For a full CPU profile: node --cpu-prof app.js, then open the
  // generated .cpuprofile file in Chrome DevTools > Performance.
popularity: 7.7
isPublished: true
---

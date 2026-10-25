---
course: javascript
slug: long-tasks-and-yielding-to-the-main-thread
experienceLevel: senior
difficulty: hard
tags:
  - performance
  - browser
  - event-loop
question: What are long tasks, and how do you yield to the main thread to keep a page responsive?
answer: |
  The browser's main thread runs JavaScript, style, layout, paint and input handling, one **task** at a time. A **long task** is any task over **50 ms**. While it runs, the browser can't respond to clicks or key presses or paint new frames, which shows up as poor **INP** and visible jank.

  Splitting work so that pending input gets a chance to run is called **yielding**. Options, from best to most basic:

  - **`scheduler.yield()`**: returns a promise that resumes your work in a new task, and the continuation is **prioritised ahead of other queued tasks**, so a long job doesn't lose its place to third-party scripts. It's available in Chromium-based browsers. Check current support elsewhere and feature-detect it.
  - **`scheduler.postTask(fn, { priority })`**: schedules work as `user-blocking`, `user-visible` or `background`, also Chromium-first.
  - **`setTimeout(resolve, 0)`** inside a promise: the universal fallback. The continuation goes to the back of the task queue, and nested timeouts may be clamped to 4 ms.
  - `requestIdleCallback` for truly deferrable work, and `requestAnimationFrame` only for work that must happen before the next paint.

  Microtasks (`await Promise.resolve()`, `queueMicrotask`) do **not** yield. The microtask queue is drained before the browser can render or handle input.

  Practical patterns:

  - In event handlers, do the **visual update first**, then yield, then run analytics, persistence and other non-urgent work.
  - Process large arrays in batches, yielding every ~5 to 10 ms based on elapsed time rather than a fixed item count.
  - Move pure computation (parsing, diffing, image processing) to a **Web Worker** instead of slicing it.
  - Debounce or cancel work superseded by newer input.

  Find long tasks with the DevTools Performance panel, the `longtask` entry type, or the newer **Long Animation Frames** API (`long-animation-frame` entries), which attributes slow frames to specific scripts.
codeExample: |
  // In the browser: process a big list without blocking input
  function yieldToMain() {
    if (globalThis.scheduler?.yield) return scheduler.yield();   // prioritised continuation
    return new Promise((resolve) => setTimeout(resolve, 0));     // fallback
  }

  async function processInChunks(items, handleItem, budgetMs = 8) {
    let deadline = performance.now() + budgetMs;
    for (const item of items) {
      handleItem(item);
      if (performance.now() >= deadline) {
        await yieldToMain();                       // let clicks and paints happen
        deadline = performance.now() + budgetMs;
      }
    }
  }

  document.querySelector('#export').addEventListener('click', async (event) => {
    event.target.textContent = 'Exporting…';      // 1. visual feedback first
    await yieldToMain();                           // 2. let it paint
    const rows = [];
    await processInChunks(window.bigDataset, (r) => rows.push(toCsvRow(r))); // 3. heavy work
    download(rows.join('\n'));
    event.target.textContent = 'Export';
  });

  // Spot long tasks in the field
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) console.log('long task', Math.round(entry.duration), 'ms');
  }).observe({ type: 'longtask', buffered: true });
popularity: 7.9
isPublished: true
---

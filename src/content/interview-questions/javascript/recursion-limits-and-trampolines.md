---
course: javascript
slug: recursion-limits-and-trampolines
experienceLevel: senior
difficulty: hard
tags:
  - functions
  - recursion
  - performance
question: Why does deep recursion crash in JavaScript even with tail calls, and how do you work around it?
answer: |
  Every call pushes a stack frame, and engines cap the stack. When it overflows you get `RangeError: Maximum call stack size exceeded` in V8 (Firefox and Safari report "too much recursion" and similar). The maximum depth isn't a fixed number. It depends on frame size (more locals and arguments mean fewer frames), the engine, the platform, and in Node the `--stack-size` flag. Typical limits are in the thousands to tens of thousands of frames, so recursion that is fine in tests can crash on production-sized input such as a deeply nested JSON document, a long linked list or a degenerate tree.

  ES2015 specified **proper tail calls (PTC)**: in strict mode, a call in tail position should reuse the current frame. In practice only **JavaScriptCore (Safari)** implements it. V8 implemented it and then removed it, and SpiderMonkey never shipped it, over concerns about lost stack traces and performance. So in Chrome, Node, Deno and Firefox, writing a function tail-recursively **does not** make it safe.

  Portable workarounds:

  - **Convert to a loop.** Tail recursion maps directly to a `while` loop, which is usually the clearest fix.
  - **Explicit stack.** For tree or graph traversal, keep your own array of pending nodes. It lives on the heap and can grow to millions of items.
  - **Trampoline.** The function returns a thunk instead of making the recursive call, and a driver loop keeps calling thunks until it gets a value. The stack stays flat, at the cost of a closure allocation per step.
  - **Async chunking.** For very long work, process in batches and yield (`await` between chunks). This also keeps the event loop responsive.

  Raising `--stack-size` in Node can crash the process with a segmentation fault if it exceeds the real OS thread stack, so it's not a fix. In code review, flag recursion whose depth is driven by user input.
codeExample: |
  'use strict';
  const sumTo = (n, acc = 0) => (n === 0 ? acc : sumTo(n - 1, acc + n)); // tail call

  try {
    sumTo(1_000_000);
  } catch (err) {
    console.log(err.name, '-', err.message);
  }
  // Output: RangeError - Maximum call stack size exceeded   (no TCO in V8)

  // Trampoline: return a thunk instead of recursing
  const trampoline = (fn) => (...args) => {
    let result = fn(...args);
    while (typeof result === 'function') result = result();
    return result;
  };
  const sumToSafe = trampoline(function step(n, acc = 0) {
    return n === 0 ? acc : () => step(n - 1, acc + n);
  });
  console.log(sumToSafe(1_000_000));               // Output: 500000500000

  // Explicit stack for deep trees
  let deep = null;
  for (let i = 0; i < 200_000; i++) deep = { value: 1, child: deep };
  function countNodes(root) {
    let count = 0;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      count++;
      stack.push(node.child);
    }
    return count;
  }
  console.log(countNodes(deep));                   // Output: 200000
popularity: 6.9
isPublished: true
---

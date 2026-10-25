---
course: javascript
slug: jit-optimisation-and-deoptimisation
experienceLevel: senior
difficulty: hard
tags:
  - v8
  - performance
  - jit
question: How does V8's JIT optimise JavaScript, and what causes deoptimisation?
answer: |
  V8 runs code through **tiers**. **Ignition** interprets bytecode and collects **type feedback** (which shapes and types each operation saw). Warm functions move to **Sparkplug**, a fast non-optimising baseline compiler, then to **Maglev**, a mid-tier optimiser. The hottest code reaches **TurboFan**, which produces heavily optimised machine code.

  The optimising tiers are **speculative**. If `add(a, b)` has only ever seen small integers, TurboFan emits integer addition guarded by cheap checks, and property loads are compiled against the hidden classes seen so far. When a guard fails at runtime, for example a string arrives or a new object shape appears, V8 **deoptimises**: it rebuilds an interpreter frame from the optimised frame and continues in bytecode. The function may be re-optimised later with broader feedback, and functions that deopt repeatedly may stop being optimised.

  Common deopt triggers:

  - New argument types or object shapes at a hot call site.
  - Arrays that change element kind, or out-of-bounds reads that hit holes.
  - Arithmetic that overflows the small-integer range.
  - Rarely taken branches that later run with new types.

  How to approach it in a real codebase:

  - Profile first. Deopts only matter on hot paths that show up in a CPU profile.
  - Use `node --trace-opt --trace-deopt` (noisy) or a visualiser such as `deoptigate` to see deopt reasons.
  - Fix the data, not the syntax: keep types and shapes stable at hot sites, and split a generic function into specialised ones if it serves very different inputs.

  Be wary of micro-benchmarks that call one function with one type. They measure an idealised monomorphic case your production code may never hit.
codeExample: |
  const v8 = require('node:v8');
  v8.setFlagsFromString('--allow-natives-syntax');   // demo only
  const prepare = new Function('f', '%PrepareFunctionForOptimization(f)');
  const optimizeNext = new Function('f', '%OptimizeFunctionOnNextCall(f)');
  const isTurbofan = new Function('f', 'return %ActiveTierIsTurbofan(f)');

  function add(a, b) { return a + b; }

  prepare(add);
  add(1, 2);
  add(3, 4);            // feedback: small integers only
  optimizeNext(add);
  add(5, 6);            // compiled by TurboFan for integers
  console.log('optimised:', isTurbofan(add));
  // Output: optimised: true

  add('a', 'b');        // speculation fails: deoptimise
  console.log('optimised:', isTurbofan(add));
  // Output: optimised: false

  // Real code: node --trace-opt --trace-deopt server.js
popularity: 7.6
isPublished: true
---

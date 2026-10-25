---
publishDate: 2026-10-25T13:35
title: V8 Internals and Optimisation
slug: v8-internals-and-optimisation
metadescription: Learn how V8 runs your JavaScript through Ignition, Sparkplug, Maglev and TurboFan, what hidden classes and inline caches are, and why deopts happen.
updateDate: 2026-10-25T13:35
author: ['bishal-biswas']
level: 4
tags: ['internals', 'v8', 'performance']
course: nodejs
---

## The engine under the bonnet

In [the first lesson](/courses/nodejs/what-is-nodejs) you learned that Node runs JavaScript with **V8**, the same engine as Chrome. Node 24 ships V8 13.6, and Node 26 ships V8 14.6.

You can drive a car without knowing how the engine works. But a little knowledge helps you avoid driving in a way that wastes fuel. This lesson is that little knowledge for V8: how it turns your code into something fast, and which coding habits help or hurt.

A warning first: **write clear code, and measure before you optimise.** V8 is very good at making normal code fast. Everything here is for understanding, and for the rare hot spot a profiler points at.

## From source code to machine code

Your CPU cannot run JavaScript directly. It runs **machine code**: very simple instructions for the processor. V8's job is to translate your JavaScript into machine code.

There is a trade-off:

- Translating **quickly** gets code running sooner, but the result is slower.
- Translating **carefully** produces very fast code, but takes time and memory.

V8 does not pick one. It starts fast and gets more careful for code that runs a lot. Think of a kitchen: for a dish ordered once, the cook just makes it. For the dish ordered a hundred times a night, the kitchen preps ingredients in advance and sets up a dedicated station.

## The four tiers

V8 has four **tiers** (levels) of execution. Code moves up a tier when it becomes **hot**, meaning it runs often.

### 1. Ignition: the interpreter

V8 first **parses** your code (reads it and checks the grammar) and turns each function into **bytecode**: a compact list of simple steps. **Ignition** is the **interpreter** that runs that bytecode step by step.

Starting here is fast and uses little memory. Most code that runs only a few times never leaves Ignition, and that is fine.

While it runs, Ignition also collects **type feedback**: notes about what it saw. "In this function, `a` and `b` were always small integers." "This object always had the properties `name` and `age`." The higher tiers use these notes.

### 2. Sparkplug: the quick compiler

When a function gets warm, **Sparkplug** compiles its bytecode straight into machine code, very quickly and without clever tricks. This removes the interpreter's overhead, but makes no guesses about types.

### 3. Maglev: the mid-tier optimiser

For hotter code, **Maglev** builds optimised machine code using the type feedback. It compiles quickly and produces code that is much faster than Sparkplug's.

### 4. TurboFan: the top-tier optimiser

For the hottest code, **TurboFan** does the full, careful job: inlining small functions into their callers, removing unnecessary checks, and more. It takes the longest to compile and produces the fastest code.

```text
 your code
    |
 parse -> bytecode
    |
 Ignition (interpreter)   collects type feedback
    |  warm
 Sparkplug (quick compile)
    |  hot
 Maglev (optimising)
    |  very hot
 TurboFan (fully optimising)
```

You can watch this happen with the `--trace-opt` flag. Lines like this appear as a function moves up:

```text
[marking ... <JSFunction add ...> for optimization to MAGLEV, ConcurrencyMode::kConcurrent, reason: hot and stable]
[marking ... <JSFunction add ...> for optimization to TURBOFAN_JS, ConcurrencyMode::kConcurrent, reason: hot and stable]
```

"Concurrent" means the compiling happens on a background thread, so your program keeps running meanwhile.

## Optimised code makes guesses

The optimising tiers (Maglev and TurboFan) make the code fast by **speculating**: they assume the future will look like the past.

If `add(a, b)` has only ever seen small integers, the optimised code does an integer addition and nothing else. It does not check for strings, objects or `undefined`, apart from one quick guard: "is this still a small integer?"

When that guard fails, V8 must throw the fast code away and go back to the interpreter. That is a **deoptimisation**, or **deopt**.

## Watching a deopt

```javascript
// deopt.mjs
function add(a, b) {
  return a + b;
}

// Make add() hot with small integers only
for (let i = 0; i < 100_000; i++) add(i % 100, 1);

// Now surprise it with strings
add('Hello, ', 'Asha');
```

```bash
node --trace-deopt deopt.mjs
```

Among the output you will find a line like this (trimmed):

```text
[bailout (kind: deopt-eager, reason: not a Smi): begin. deoptimizing ... <JSFunction add ...>, ... <Code MAGLEV> ...]
```

- **bailout** is V8's word for leaving optimised code.
- **reason: not a Smi** says which guess failed. A **Smi** ("small integer") is V8's fast format for whole numbers that fit in about 31 bits.
- **Code MAGLEV** tells you which tier's code was thrown away.

One deopt is no problem. V8 learns from the new feedback and may optimise again with broader assumptions. The problem is code that **keeps** deopting and re-optimising in a hot loop.

> **Note:** A function can even deopt on numbers alone. If a running total grows past the Smi range, the guard "is this a Smi?" fails and V8 switches to a slower number format.

## Hidden classes

JavaScript objects look like flexible dictionaries: add any property, any time. Looking up a property by name in a dictionary is slow, though. So V8 secretly gives each object a **hidden class** (V8 calls it a **map**, and you will also hear **shape**). It records which properties the object has, in which order, and where each one is stored.

Objects created the same way share the same hidden class:

```javascript
// shapes.mjs  (run with: node --allow-natives-syntax shapes.mjs)
const asha = { name: 'Asha', age: 30 };
const ravi = { name: 'Ravi', age: 25 };
const maya = { age: 41, name: 'Maya' }; // same keys, different order

console.log(%HaveSameMap(asha, ravi)); // true
console.log(%HaveSameMap(asha, maya)); // false
```

`%HaveSameMap` is a V8 **natives syntax** function. It only works with the `--allow-natives-syntax` flag. Without it, the `%` is a syntax error.

> **Note:** Natives syntax and flags like `--trace-deopt` are **learning and debugging tools only**. They are V8 internals: they can change or disappear in any V8 update, and they have no place in production code.

### Habits that keep shapes stable

**Create every property up front, in the same order.** A class constructor is the natural place:

```javascript
class Note {
  constructor(title, author) {
    this.title = title;
    this.author = author;
    this.done = false; // even if it starts empty, create it here
  }
}
```

Every `Note` now shares one hidden class. Adding a property later (`note.priority = 'high'`) gives that one object a different hidden class.

**Avoid `delete` on hot objects.** Deleting a property can switch the object into **dictionary mode**, a slower storage format. Set the property to `undefined` or `null` instead, or build a new object without it.

```javascript
// Slower: can push the object into dictionary mode
delete user.age;

// Faster: the shape stays the same
user.age = undefined;
```

## Inline caches

Each place in your code that reads a property, like `p.x`, has a tiny memory called an **inline cache** (IC). The first time it runs, V8 works out where `x` lives for that hidden class and remembers it. Next time, if the object has the same hidden class, the lookup is almost free.

An inline cache has states, named by how many hidden classes it has seen:

- **Monomorphic** ("one shape"): the fastest case.
- **Polymorphic** ("a few shapes", up to four): still quite fast; V8 checks a short list.
- **Megamorphic** ("many shapes"): V8 gives up on remembering and does a slower general lookup.

The playground below times the same function reading `p.x` from objects with one shape and with eight shapes. When you run it, the megamorphic version is clearly slower, often several times slower, even though the code is identical. The exact ratio depends on your machine.

That is why consistent object shapes matter most in hot paths, such as a function called for every row of a large dataset.

## Arrays have kinds too

V8 also tracks what is inside an array, called its **elements kind**:

- An array of only small integers is stored very compactly.
- Add a decimal number and it switches to a "doubles" kind.
- Add a string or object and it switches to the most general kind.
- Leave gaps (for example `new Array(1000)` or `arr[500] = 1` on an empty array) and it becomes **holey**, which needs extra checks on every read.

Arrays only move towards more general kinds, never back. So, where it is easy:

- Keep arrays to one type of value.
- Build arrays by pushing, rather than creating empty slots.

## Optimisation, the right way round

1. **Measure first.** Use `--cpu-prof` and the tools from [the Diagnostics and Profiling lesson](/courses/nodejs/diagnostics-and-profiling) to find where the time really goes.
2. **Fix algorithms before engines.** Turning an O(n x n) loop into a `Map` lookup beats any V8 trick.
3. **Then check shapes and types** in the few functions that are actually hot.
4. **Benchmark the change** with realistic data, as in [the Performance Hooks lesson](/courses/nodejs/performance-hooks-and-benchmarking).

Micro-benchmarks lie easily: V8 may optimise away a loop whose result you never use. Always use the result (print a sum, for example).

## Common mistakes

**Shapes that depend on the data.** Building objects with different properties in different branches gives many hidden classes.

```javascript
// Many shapes: properties depend on input
function makeUser(row) {
  const user = { name: row.name };
  if (row.email) user.email = row.email;
  if (row.age) user.age = row.age;
  return user;
}
```

```javascript
// One shape: every property always exists
function makeUser(row) {
  return { name: row.name, email: row.email ?? null, age: row.age ?? null };
}
```

**Mixing types in one hot function.** A function that sometimes gets numbers and sometimes strings cannot be optimised as well as two separate functions.

**Leaving `--allow-natives-syntax` code in a project.** Anyone running it without the flag gets a syntax error.

**Optimising code that is not hot.** If a function runs ten times per request, its hidden classes do not matter. Profile first.

## Quick recap

- V8 runs code through four tiers: Ignition (interpreter), Sparkplug (quick compiler), Maglev (mid-tier optimiser) and TurboFan (top-tier optimiser).
- The optimisers use type feedback to make guesses; a failed guess causes a deopt back to the interpreter.
- Hidden classes (maps) describe an object's properties and order; objects built the same way share one.
- Inline caches make property access fast when a call site sees one shape (monomorphic) and slow with many (megamorphic).
- Create properties up front in a consistent order, avoid `delete` on hot objects, keep arrays to one type.
- `--trace-opt`, `--trace-deopt` and `--allow-natives-syntax` are for learning only; measure with a profiler before optimising.

<code id="code-content" class="language-javascript">
// v8-shapes.mjs: hidden classes, inline caches and deopts you can see.
// Plain Node runs it; it starts child processes with V8 learning flags.
import { execFileSync } from 'node:child_process';
const run = (flags, code) =&gt;
  execFileSync(process.execPath, [...flags, '-e', code], { encoding: 'utf8', stdio: 'pipe' });
// 1. Hidden classes: same properties in the same order share one shape
console.log('--- Hidden classes (--allow-natives-syntax, learning only) ---');
console.log(run(['--allow-natives-syntax'], `
  const asha = { name: 'Asha', age: 30 };
  const ravi = { name: 'Ravi', age: 25 };
  const maya = { age: 41, name: 'Maya' };   // same keys, different order
  console.log('asha and ravi share a shape:', %HaveSameMap(asha, ravi));
  console.log('asha and maya share a shape:', %HaveSameMap(asha, maya));
`).trim());
// 2. Inline caches: one shape at a call site is fast, many shapes are slower
console.log('--- Inline caches ---');
const getXSame = (p) =&gt; p.x; // will only ever see one shape
const getXMixed = (p) =&gt; p.x; // will see eight different shapes
const sameShape = Array.from({ length: 8 }, (_, i) =&gt; ({ x: i, y: i }));
const manyShapes = Array.from({ length: 8 }, (_, i) =&gt; ({ x: i, ['extra' + i]: i }));
function time(label, getX, objects) {
  let sum = 0;
  const start = performance.now();
  for (let i = 0; i &lt; 20_000_000; i++) sum += getX(objects[i % 8]);
  console.log(`${label}: ${Math.round(performance.now() - start)} ms (sum ${sum})`);
}
time('1 shape  (monomorphic) ', getXSame, sameShape);
time('8 shapes (megamorphic) ', getXMixed, manyShapes);
// 3. Deopts: optimised for small integers, then handed strings
console.log('--- Deoptimisation (--trace-deopt) ---');
const trace = run(['--trace-deopt'], `
  function add(a, b) { return a + b; }
  for (let i = 0; i &lt; 100000; i++) add(i % 100, 1);
  add('Hello, ', 'Asha');
`);
const reasons = trace.split('\n').filter((line) =&gt; line.includes('bailout') &amp;&amp; line.includes('add'));
for (const line of reasons) console.log('add() deoptimised, reason:', line.match(/reason: ([^)]*)/)?.[1]);
console.log(reasons.length ? 'V8 threw away the fast code and went back to the interpreter.' : 'No deopt this time (V8 versions differ).');
</code></pre>

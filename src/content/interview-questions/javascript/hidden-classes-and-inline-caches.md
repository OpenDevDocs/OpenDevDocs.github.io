---
course: javascript
slug: hidden-classes-and-inline-caches
experienceLevel: senior
difficulty: hard
tags:
  - v8
  - performance
question: What are hidden classes and inline caches in V8, and how do they affect the code you write?
answer: |
  JavaScript objects look like dictionaries, but V8 gives each object a **hidden class** (called a **Map** internally, or a "shape" in other engines). The hidden class records which properties exist, in what order, and at which offset. Objects created the same way share a hidden class. Adding a property moves the object along a **transition chain** to a new hidden class.

  An **inline cache (IC)** sits at each property access site. The first time `p.x` runs, V8 records "for objects with hidden class M, `x` is at offset 0". Later accesses check the class and load directly from that offset. An IC can be:

  - **monomorphic**: one shape seen, the fastest case.
  - **polymorphic**: a few shapes (up to four in V8), checked in turn.
  - **megamorphic**: too many shapes. V8 falls back to a slower generic lookup, and the optimising compiler can do much less with that site.

  Practical guidance for hot code (not for all code):

  - Initialise all fields in the constructor, in the same order, even if some start as `null`.
  - Avoid adding properties later and avoid `delete`, which can push the object into slow **dictionary mode**. Set the field to `undefined`, or use a `Map` for truly dynamic keys.
  - Keep hot functions monomorphic. A helper that receives five unrelated object shapes becomes megamorphic.
  - Don't mix element kinds (small integers, doubles, objects) in a hot array.

  Verify, don't guess: `--allow-natives-syntax` exposes `%HaveSameMap` for experiments, and CPU profiles or `--trace-ic` logs show where a hot path is megamorphic.
codeExample: |
  const v8 = require('node:v8');
  v8.setFlagsFromString('--allow-natives-syntax');   // demo only
  const sameShape = new Function('a', 'b', 'return %HaveSameMap(a, b)');

  class Point {
    constructor(x, y) { this.x = x; this.y = y; }     // fixed order
  }
  const p1 = new Point(1, 2);
  const p2 = new Point(3, 4);
  console.log(sameShape(p1, p2));        // Output: true

  const a = { x: 1, y: 2 };
  const b = { y: 2, x: 1 };              // same keys, different order
  console.log(sameShape(a, b));          // Output: false

  const c = { x: 1, y: 2 };
  c.z = 3;                               // later addition: new transition
  console.log(sameShape(a, c));          // Output: false

  const d = { x: 1, y: 2 };
  delete d.y;                            // may switch d to dictionary mode
  console.log(sameShape(a, d));          // Output: false
popularity: 7.8
isPublished: true
---

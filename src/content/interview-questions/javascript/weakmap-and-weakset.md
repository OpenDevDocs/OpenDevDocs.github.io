---
course: javascript
slug: weakmap-and-weakset
experienceLevel: mid
difficulty: hard
tags:
  - collections
  - memory
  - garbage-collection
question: "What are `WeakMap` and `WeakSet`, and when would you use them?"
answer: |
  `WeakMap` and `WeakSet` are collections whose keys (or members) are held **weakly**: if nothing else references a key object, it can be garbage-collected and its entry disappears automatically, so they let you attach data to objects without causing memory leaks.

  Differences from `Map` and `Set`:

  - Keys must be objects or non-registered symbols. Primitives like strings or numbers throw a `TypeError`, because a primitive could always be recreated and would never become unreachable.
  - They are **not iterable** and have no `size`, `keys()`, `forEach` or `clear()`. Garbage collection timing is unpredictable, so their contents cannot be listed.
  - Available methods: `WeakMap` has `get`, `set`, `has`, `delete`; `WeakSet` has `add`, `has`, `delete`.
  - A `WeakMap` holds the **value** strongly only as long as the key is alive. If the value references its own key, that does not keep the key alive.

  Typical uses:

  1. **Metadata or caches keyed by objects** you do not own: computed layout info per DOM node, a memoization cache per request object, extra data per third-party instance. When the object goes away, so does the cached data.
  2. **Private data** associated with instances. This was the pre-`#field` way to hide state, and is still useful for data shared across several classes or modules.
  3. **Tracking objects** with a `WeakSet`: "has this node already been processed?" or detecting cycles during a deep traversal, without preventing cleanup.

  Pitfalls:

  - You cannot use a `WeakMap` when you need to enumerate entries or count them; use a `Map` and remove entries yourself.
  - Weakness only helps if your code drops all other references. A key still held in an array or a closure stays alive.
  - Do not write logic that depends on when entries vanish. For callbacks after collection, `FinalizationRegistry` exists, but its timing is not guaranteed either.

  `WeakRef` is the related primitive for holding a single object weakly, rarely needed in application code.
codeExample: |
  // Cache derived data per object without leaking memory
  const statsCache = new WeakMap();

  function getStats(order) {
    if (!statsCache.has(order)) {
      console.log('computing...');
      const total = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
      statsCache.set(order, { total, count: order.items.length });
    }
    return statsCache.get(order);
  }

  let order = { items: [{ price: 10, qty: 2 }, { price: 5, qty: 1 }] };
  console.log(getStats(order)); // Output: computing... then { total: 25, count: 2 }
  console.log(getStats(order)); // Output: { total: 25, count: 2 } (cached)
  order = null; // the cache entry can now be garbage-collected with the object

  // Track visited objects to handle cycles
  function countNodes(node, seen = new WeakSet()) {
    if (!node || seen.has(node)) return 0;
    seen.add(node);
    return 1 + countNodes(node.next, seen);
  }
  const a = { name: 'a' }, b = { name: 'b', next: a };
  a.next = b; // cycle
  console.log(countNodes(a)); // Output: 2

  try { new WeakMap().set('key', 1); } catch (e) { console.log(e.constructor.name); } // Output: TypeError
  console.log(typeof new WeakMap()[Symbol.iterator], new WeakSet().size); // Output: undefined undefined
popularity: 7.4
isPublished: true
---

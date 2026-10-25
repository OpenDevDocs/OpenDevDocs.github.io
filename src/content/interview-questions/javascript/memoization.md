---
course: javascript
slug: memoization
experienceLevel: mid
difficulty: medium
tags:
  - performance
  - closures
  - functions
question: What is memoization and how would you implement it?
answer: |
  Memoization is caching a function's results by its arguments, so repeated calls with the same inputs return the stored result instead of recomputing it.

  How it works: a wrapper keeps a cache, usually a `Map`, in a closure. On each call it builds a key from the arguments; if the key is in the cache it returns the cached value, otherwise it calls the real function, stores the result and returns it.

  Requirements and trade-offs:

  - The function must be **pure**: same inputs, same output, no side effects. Memoizing something that reads the clock, random numbers or mutable global state returns stale results.
  - **Cache keys** are the hard part. A single primitive argument can be the key directly. For several primitives, `JSON.stringify(args)` or `args.join('|')` works. Object arguments are compared by reference in a `Map`, so two equal-looking objects are different keys, and `JSON.stringify` is slow and order-sensitive for large objects.
  - **Memory**: an unbounded cache grows forever. Use a size limit (LRU), a time-to-live, or a `WeakMap` when the key is an object so entries can be garbage-collected.
  - Memoizing a cheap function can be slower than just calling it, because key building and lookup have a cost. Measure first.
  - For async functions, cache the **promise**, so concurrent callers share one request, and delete the entry if it rejects so failures are not cached forever.

  Where it shows up:

  - Recursive algorithms with overlapping subproblems (Fibonacci, path counting): exponential time becomes linear.
  - Expensive derived data in UIs: React's `useMemo`, `React.memo` and selector libraries such as Reselect are forms of memoization, usually keeping only the last result.
  - Deduplicating identical network requests.
codeExample: |
  function memoize(fn) {
    const cache = new Map();
    return function (...args) {
      const key = args.length === 1 ? args[0] : JSON.stringify(args);
      if (cache.has(key)) return cache.get(key);
      const result = fn.apply(this, args);
      cache.set(key, result);
      return result;
    };
  }

  let calls = 0;
  const slowSquare = (n) => { calls += 1; return n * n; };
  const fastSquare = memoize(slowSquare);
  console.log(fastSquare(9), fastSquare(9), calls); // Output: 81 81 1

  // Recursive memoization: the recursive call must go through the cache
  let fibCalls = 0;
  const fib = memoize((n) => {
    fibCalls += 1;
    return n < 2 ? n : fib(n - 1) + fib(n - 2);
  });
  console.log(fib(50), fibCalls); // Output: 12586269025 51

  function memoizeAsync(fn) { // async: cache the promise, evict it on failure
    const cache = new Map();
    return (key) => {
      if (!cache.has(key)) {
        cache.set(key, fn(key).catch((err) => { cache.delete(key); throw err; }));
      }
      return cache.get(key);
    };
  }
  const getUser = memoizeAsync(async (id) => ({ id }));
  console.log(getUser(1) === getUser(1)); // Output: true (one shared promise)
popularity: 8.0
isPublished: true
---

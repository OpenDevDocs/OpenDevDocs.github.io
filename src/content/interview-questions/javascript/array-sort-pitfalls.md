---
course: javascript
slug: array-sort-pitfalls
experienceLevel: mid
difficulty: medium
tags:
  - arrays
  - sorting
question: "What are the common pitfalls of `Array.prototype.sort`?"
answer: |
  The biggest pitfall is that `sort()` without a comparator converts elements to **strings** and compares them by UTF-16 code units, so `[10, 9, 1].sort()` gives `[1, 10, 9]`; the other major surprise is that `sort` **mutates** the array in place.

  The comparator contract: `compare(a, b)` returns a negative number if `a` should come first, a positive number if `b` should come first, and `0` if they are equal.

  - Numbers ascending: `(a, b) => a - b`; descending: `(a, b) => b - a`.
  - Strings for humans: `(a, b) => a.localeCompare(b)`, or a reusable `new Intl.Collator('en', { numeric: true }).compare` for case-aware, accent-aware and natural ("file2" before "file10") ordering.
  - Multiple keys: compare the first key and fall back to the next when it is equal, e.g. `a.last.localeCompare(b.last) || a.age - b.age`.
  - Dates: `a.date - b.date` works because `Date` objects convert to numbers.

  Pitfalls:

  1. **Mutation**: `sort` reorders the original and returns the same array. Sorting props or state in place causes bugs in React and similar frameworks. Use ES2023 `toSorted()`, which returns a new array, or copy first with `[...arr].sort()`.
  2. **Boolean comparators**: `(a, b) => a > b` returns `true`/`false`, which become `1`/`0`. It never says "less than", so results are inconsistent across engines. Always return a negative, zero or positive number.
  3. **Inconsistent comparators**, such as random ones for shuffling, give biased results. Use a Fisher-Yates shuffle instead.
  4. `a - b` on strings that look like numbers works by coercion, but on mixed data it returns `NaN`, which breaks the ordering.
  5. `undefined` values always go to the end and holes are removed from the order, without calling the comparator.

  Stability: since ES2019, `sort` is guaranteed **stable**, so elements that compare equal keep their original relative order. That makes multi-pass sorting (first by name, then by department) reliable.
codeExample: |
  const nums = [10, 9, 1, 100, 25];
  console.log([...nums].sort());                  // Output: [ 1, 10, 100, 25, 9 ]
  console.log(nums.toSorted((a, b) => a - b));    // Output: [ 1, 9, 10, 25, 100 ]
  console.log(nums);                              // Output: [ 10, 9, 1, 100, 25 ] (unchanged)

  const original = [3, 1, 2];
  const result = original.sort();
  console.log(result === original, original);     // Output: true [ 1, 2, 3 ] (mutated)

  const files = ['file10.txt', 'File2.txt', 'file1.txt'];
  console.log(files.toSorted());                  // Output: [ 'File2.txt', 'file1.txt', 'file10.txt' ]
  const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  console.log(files.toSorted(natural.compare));   // Output: [ 'file1.txt', 'File2.txt', 'file10.txt' ]

  const people = [
    { name: 'Ann', dept: 'IT' }, { name: 'Bob', dept: 'HR' },
    { name: 'Cid', dept: 'IT' }, { name: 'Dee', dept: 'HR' },
  ];
  // Stable sort: names stay in their original order within each department
  console.log(people.toSorted((a, b) => a.dept.localeCompare(b.dept)).map((p) => p.name).join(','));
  // Output: Bob,Dee,Ann,Cid

  console.log([3, undefined, 1].sort((a, b) => a - b)); // Output: [ 1, 3, undefined ]
popularity: 8.0
isPublished: true
---

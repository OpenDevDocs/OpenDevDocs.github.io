---
course: javascript
slug: string-immutability-and-methods
experienceLevel: fresher
difficulty: easy
tags:
  - strings
question: Are strings mutable in JavaScript, and what are the most common string methods?
answer: |
  No. Strings are immutable primitives: no operation can change an existing string, so every string method returns a **new** string and leaves the original as it was.

  That is why `name.toUpperCase()` on its own does nothing useful; you must use or store the result: `name = name.toUpperCase();`. Assigning to an index, as in `str[0] = "J"`, is silently ignored in sloppy mode and throws a `TypeError` in strict mode.

  Commonly used methods:

  - **Case and whitespace:** `toUpperCase`, `toLowerCase`, `trim`, `trimStart`, `trimEnd`.
  - **Searching:** `includes`, `startsWith`, `endsWith`, `indexOf` (returns `-1` if not found).
  - **Extracting:** `slice(start, end)` (supports negative indexes), `substring`, `at(-1)` for the last character.
  - **Splitting and joining:** `split(",")` returns an array; `array.join("-")` goes back.
  - **Replacing:** `replace` changes only the **first** match when given a string; use `replaceAll` or a regex with the `g` flag for every match.
  - **Padding and repeating:** `padStart(3, "0")`, `padEnd`, `repeat`.

  Practical notes:

  - Building a string in a loop with `+=` is fine in modern engines, but `array.join("")` is a clean alternative when you already have parts.
  - `length` counts UTF-16 code units, so some emoji count as 2. Use `[...str].length` to count visible characters more accurately.
  - For case-insensitive comparison, normalise both sides with `toLowerCase()`, or use `localeCompare` with options for language-aware sorting.
  - `substr` is a legacy method; prefer `slice`.
codeExample: |
  "use strict";

  let name = "  ada lovelace  ";
  name.trim(); // result ignored: the original is unchanged
  console.log(`[${name}]`); // Output: [  ada lovelace  ]

  name = name.trim();
  console.log(name.toUpperCase(), name.length); // Output: ADA LOVELACE 12

  try {
    name[0] = "A";
  } catch (err) {
    console.log(err.name); // Output: TypeError
  }

  console.log(name.includes("love"), name.indexOf("x")); // Output: true -1
  console.log(name.slice(-8), name.at(0)); // Output: lovelace a
  console.log("a-b-c".replace("-", "+"), "a-b-c".replaceAll("-", "+")); // Output: a+b-c a+b+c
  console.log("7".padStart(3, "0")); // Output: 007
  console.log("red,green".split(",")); // Output: [ 'red', 'green' ]
  console.log("😀".length, [..."😀"].length); // Output: 2 1
popularity: 7.8
isPublished: true
---

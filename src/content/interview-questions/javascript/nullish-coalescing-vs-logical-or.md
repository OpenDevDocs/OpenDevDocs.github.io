---
course: javascript
slug: nullish-coalescing-vs-logical-or
experienceLevel: fresher
difficulty: easy
tags:
  - operators
question: "What is the difference between `??` and `||`?"
answer: |
  Both return a fallback value, but `||` falls back when the left side is **any falsy value**, while `??` (nullish coalescing) falls back **only when the left side is `null` or `undefined`**.

  `a || b` returns `a` if it is truthy, otherwise `b`. That means legitimate values like `0`, `""`, `false` and `NaN` are replaced by the default.

  `a ?? b` returns `a` unless it is `null` or `undefined`. So `0`, `""` and `false` are kept.

  This matters for real data:

  - A volume setting of `0`: `settings.volume || 50` wrongly gives `50`; `settings.volume ?? 50` gives `0`.
  - An empty string the user deliberately entered, or a `false` flag from an API.
  - Pagination with `page = 0`.

  Use `||` when you really want to replace every falsy value, for example turning an empty string into a placeholder label. Use `??` for "default if missing".

  Related operators:

  - Logical assignment: `a ??= b` assigns only if `a` is nullish; `a ||= b` assigns if `a` is falsy; `a &&= b` assigns if `a` is truthy.
  - Default parameters behave like `??` but only for `undefined`, not `null`.

  Both operators **short-circuit**: the right side is not evaluated if it is not needed, so `value ?? expensiveDefault()` only calls the function when necessary.

  One syntax rule: you cannot mix `??` with `&&` or `||` without parentheses. `a || b ?? c` is a `SyntaxError`; write `(a || b) ?? c`.
codeExample: |
  const settings = { volume: 0, nickname: "", darkMode: false, language: null };

  console.log(settings.volume || 50); // Output: 50
  console.log(settings.volume ?? 50); // Output: 0

  console.log(settings.nickname || "Anonymous"); // Output: Anonymous
  console.log(`[${settings.nickname ?? "Anonymous"}]`); // Output: []

  console.log(settings.darkMode ?? true); // Output: false
  console.log(settings.language ?? "en"); // Output: en
  console.log(settings.missing ?? "default"); // Output: default

  settings.language ??= "fr"; // assigns: it was null
  settings.volume ??= 80; // keeps 0
  console.log(settings.language, settings.volume); // Output: fr 0

  let calls = 0;
  const fallback = () => ++calls;
  const result = "set" ?? fallback(); // right side never runs
  console.log(result, calls); // Output: set 0
popularity: 8.7
isPublished: true
---

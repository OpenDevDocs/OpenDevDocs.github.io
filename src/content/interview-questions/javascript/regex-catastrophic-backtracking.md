---
course: javascript
slug: regex-catastrophic-backtracking
experienceLevel: senior
difficulty: hard
tags:
  - regex
  - performance
  - security
question: What is catastrophic backtracking in regular expressions, and how do you prevent ReDoS?
answer: |
  JavaScript engines use **backtracking** regex engines (V8's Irregexp, for example). When part of a pattern fails, the engine goes back and tries every other way the earlier parts could have matched. For most patterns that's cheap. But when a pattern lets the **same characters be matched in many different ways**, and the overall match then **fails**, the number of paths can grow exponentially with input length.

  The classic shapes:

  - **Nested quantifiers**: `(a+)+`, `(\w+\s?)*`, `(.*)*`.
  - **Overlapping alternation under a quantifier**: `(a|aa)+`, `(\d|\d\d)+`.
  - **Adjacent overlapping quantifiers**: `\s*\w*\s*` or `.*.*=` followed by something that can fail.

  Against `'aaaa…a!'`, `^(a+)+$` must try every way to partition the `a`s before concluding there's no match. Each extra character roughly doubles the time. Because JavaScript is single-threaded, one malicious request can block a Node.js server's event loop for seconds or minutes. That is **ReDoS** (regular expression denial of service), and it has hit email validators, user-agent parsers and markdown libraries.

  Prevention:

  - **Rewrite** so each character can be consumed in only one way: `^a+$` instead of `^(a+)+$`, and make alternatives mutually exclusive. Prefer negated classes (`"[^"]*"`) over `.*?` between delimiters.
  - **Limit input length** before matching. That is cheap and very effective.
  - **Lint** patterns with tools such as `eslint-plugin-regexp`, `safe-regex` or `recheck` in CI.
  - For untrusted patterns, use a linear-time engine such as RE2 (the `re2` npm package). V8 also has an experimental linear-time engine (`--enable-experimental-regexp-engine` and the `l` flag), which is not on by default and not portable.
  - Don't run user-supplied regexes on the main thread without a timeout. Use a worker you can terminate.

  To diagnose a stall in production, a CPU profile shows time stuck in a `RegExp` exec frame, and event loop delay metrics spike.
codeExample: |
  const timeIt = (re, input) => {
    const start = performance.now();
    const matched = re.test(input);
    return { matched, ms: performance.now() - start };
  };

  const evil = 'a'.repeat(27) + '!';        // almost matches, then fails

  const slow = timeIt(/^(a+)+$/, evil);     // nested quantifier: exponential paths
  console.log(slow.matched, 'slow:', slow.ms > 100);
  // Output: false slow: true   (hundreds of ms; each extra "a" roughly doubles it)

  const fast = timeIt(/^a+$/, evil);        // same language, one way to match
  console.log(fast.matched, 'slow:', fast.ms > 100);
  // Output: false slow: false

  // Cheap guard: bound the input before running any complex pattern
  function isValidSlug(input) {
    if (input.length > 64) return false;
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input); // segments can't overlap
  }
  console.log(isValidSlug('tree-shaking-101'), isValidSlug('a'.repeat(5000)));
  // Output: true false
popularity: 7.4
isPublished: true
---

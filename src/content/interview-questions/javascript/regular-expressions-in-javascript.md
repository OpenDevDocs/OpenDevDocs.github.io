---
course: javascript
slug: regular-expressions-in-javascript
experienceLevel: mid
difficulty: medium
tags:
  - regex
  - strings
question: "How do regular expressions work in JavaScript, including flags, capture groups and `matchAll`?"
answer: |
  A regular expression is a `RegExp` object, written as a literal `/pattern/flags` or built with `new RegExp(string, flags)`, that you use with string methods such as `test`, `match`, `matchAll`, `replace` and `split` to search and transform text.

  Flags you should know:

  - `g` global: find all matches. `i` case-insensitive. `m` multiline: `^` and `$` match at line breaks.
  - `s` dotAll: `.` also matches newlines. `y` sticky: match only at `lastIndex`.
  - `u` Unicode: treat code points correctly (emoji, `\p{L}` property escapes). `v` is its stricter, more capable successor with set operations.
  - `d` adds start and end `indices` for each group.

  Groups:

  - `( )` captures a group, available as `match[1]`, `match[2]` and so on. `(?: )` groups without capturing.
  - Named groups `(?<year>\d{4})` appear on `match.groups.year` and can be referenced in replacements as `$<year>`.
  - Backreferences: `\1` or `\k<name>` match the same text again.
  - Lookarounds: `(?=...)`, `(?!...)`, `(?<=...)`, `(?<!...)` assert without consuming characters.

  Which method to use:

  - `regex.test(str)` for a yes/no check.
  - `str.match(regex)` without `g` returns the first match with groups; with `g` it returns only the matched strings, without groups.
  - `str.matchAll(regex)` returns an iterator of full match objects with groups. It **requires** the `g` flag and throws a `TypeError` otherwise.
  - `str.replace` / `replaceAll` accept a replacement string or a callback.

  Pitfalls:

  1. A `g` or `y` regex is **stateful**: `test` and `exec` advance `lastIndex`, so reusing the same regex in a loop or across calls gives alternating `true`/`false` results.
  2. When building a regex from user input, escape special characters (`RegExp.escape` from ES2025, or a manual escape), or you open yourself to bugs and ReDoS.
  3. Nested quantifiers like `(a+)+` can cause catastrophic backtracking on long inputs.
  4. Remember to double backslashes in `new RegExp('\\d+')` strings.
codeExample: |
  const log = 'ERROR 2025-03-14 disk full\nINFO 2025-03-15 ok\nERROR 2025-04-01 timeout';

  const re = /^(?<level>ERROR|INFO) (?<date>(?<year>\d{4})-\d{2}-\d{2}) (?<msg>.+)$/gm;

  for (const m of log.matchAll(re)) {
    if (m.groups.level === 'ERROR') console.log(m.groups.date, '->', m.groups.msg);
  }
  // Output:
  // 2025-03-14 -> disk full
  // 2025-04-01 -> timeout

  console.log(log.match(/\d{4}-\d{2}-\d{2}/g)); // Output: [ '2025-03-14', '2025-03-15', '2025-04-01' ]

  const swapped = '2025-03-14'.replace(/(?<y>\d+)-(?<m>\d+)-(?<d>\d+)/, '$<d>/$<m>/$<y>');
  console.log(swapped); // Output: 14/03/2025

  // The lastIndex trap with the g flag
  const hasDigit = /\d/g;
  console.log(hasDigit.test('a1'), hasDigit.test('a1'), hasDigit.test('a1')); // Output: true false true

  try { 'abc'.matchAll(/b/); } catch (e) { console.log(e.constructor.name); } // Output: TypeError

  const price = /(?<=\$)\d+(\.\d+)?/;            // lookbehind: digits after a $
  console.log('Total: $42.50'.match(price)[0]);  // Output: 42.50
  console.log(/^\p{Lu}/u.test('Élan'));          // Output: true
popularity: 7.7
isPublished: true
---

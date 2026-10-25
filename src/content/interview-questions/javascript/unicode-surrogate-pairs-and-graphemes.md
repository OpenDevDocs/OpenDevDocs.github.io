---
course: javascript
slug: unicode-surrogate-pairs-and-graphemes
experienceLevel: senior
difficulty: hard
tags:
  - strings
  - unicode
  - intl
question: "Why can `str.length` be wrong for user-visible text, and how do you handle Unicode correctly in JavaScript?"
answer: |
  JavaScript strings are sequences of **UTF-16 code units**, and `length`, indexing, `slice` and `split('')` all work on those units. That matches what users see only for the Basic Multilingual Plane. There are three different levels of "character":

  - **Code units**: 16-bit values. Code points above U+FFFF, such as most emoji, are stored as a **surrogate pair** of two units, so `'😀'.length` is 2.
  - **Code points**: Unicode scalar values. `for...of`, `[...str]`, `codePointAt` and regexes with the `u` or `v` flag iterate by code point.
  - **Grapheme clusters**: what a user perceives as one character. A family emoji is several code points joined by zero-width joiners. A flag is two regional indicators. "é" can be one code point or "e" plus a combining accent.

  Bugs this causes in real systems:

  - Truncating with `slice(0, n)` can cut a surrogate pair in half and produce a lone surrogate. That renders as a replacement character, and it can fail `encodeURIComponent` or strict UTF-8 encoders.
  - Character limits counted with `length` disagree with what users see, and with database limits measured in bytes or code points.
  - String comparison and deduplication fail when the same text arrives in different normalisation forms.

  Tools:

  - `Intl.Segmenter` with `granularity: 'grapheme'` splits text into user-perceived characters. It is supported in current browsers and Node, and it also does word and sentence segmentation for languages without spaces.
  - `str.normalize('NFC')` before comparing or storing identifiers.
  - `isWellFormed()` and `toWellFormed()` (ES2024) detect and repair lone surrogates.
  - `TextEncoder` gives the UTF-8 byte length when a backend limit is in bytes.

  Decide per use case which unit a limit means (bytes, code points or graphemes), and enforce the same rule on client and server.
codeExample: |
  const text = 'Hi 👋🏽 café 👨‍👩‍👧';
  const graphemes = (s) =>
    [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].map((g) => g.segment);

  console.log(text.length);                               // Output: 21 (UTF-16 code units)
  console.log([...text].length);                          // Output: 16 (code points)
  console.log(graphemes(text).length);                    // Output: 11 (what users see)
  console.log(new TextEncoder().encode(text).length);     // Output: 36 (UTF-8 bytes)

  // Naive truncation splits a surrogate pair
  const cut = '👋🏽 hello'.slice(0, 1);
  console.log(cut.isWellFormed());                        // Output: false
  console.log(graphemes('👋🏽 hello').slice(0, 1).join('')); // Output: 👋🏽

  // Same visible text, different code points
  const composed = 'caf\u00e9';
  const decomposed = 'cafe\u0301';
  console.log(composed === decomposed);                   // Output: false
  console.log(composed === decomposed.normalize('NFC'));  // Output: true
popularity: 7.3
isPublished: true
---

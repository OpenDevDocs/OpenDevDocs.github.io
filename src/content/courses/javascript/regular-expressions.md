---
publishDate: 2026-03-22T09:36
title: Regular Expressions
slug: regular-expressions
metadescription: Search and validate text with patterns. Learn the syntax piece by piece, with practical examples for real form validation.
updateDate: 2026-09-05T09:36
author: ['bishal-biswas']
level: 2
tags: ['strings', 'regex']
course: javascript
---

## What is a regular expression?

A regular expression, or regex, is a pattern for matching text. Instead of asking "does this string equal X", you ask "does this string look like X".

```javascript
const pattern = /cat/;
console.log(pattern.test('the cat sat'));
console.log(pattern.test('a dog'));
```

Regex looks intimidating because it is dense. Take it one symbol at a time and it becomes readable.

## Creating one

```javascript
const literal = /hello/i;
const constructed = new RegExp('hello', 'i');
const word = 'hello';
const dynamic = new RegExp(word, 'i');
```

Use the `/pattern/` form normally. Use `new RegExp` only when the pattern comes from a variable.

## Flags

```javascript
console.log(/cat/i.test('CAT'));
console.log('cat cat'.match(/cat/g));
```

- `i` ignores case.
- `g` finds all matches, not just the first.
- `m` makes `^` and `$` work per line.
- `s` makes `.` match newlines too.

## Character classes

```javascript
console.log(/[abc]/.test('banana'));
console.log(/[a-z]/.test('Hello'));
console.log(/[0-9]/.test('abc123'));
console.log(/[^0-9]/.test('123a'));
```

Square brackets mean "any one of these". A `^` inside them means "none of these".

## Shorthand

These come up constantly:

```javascript
console.log(/\d/.test('abc1'));
console.log(/\w/.test('hello_1'));
console.log(/\s/.test('a b'));
```

- `\d` is any digit, `\D` is any non digit.
- `\w` is a letter, digit or underscore, `\W` is the opposite.
- `\s` is any whitespace, `\S` is the opposite.
- `.` is any character except a newline.

## Quantifiers

How many times the thing before it may appear.

```javascript
console.log(/\d+/.test('abc123'));
console.log(/colou?r/.test('color'));
console.log(/colou?r/.test('colour'));
console.log(/\d{3}/.test('12'));
console.log(/\d{3}/.test('123'));
console.log(/\d{2,4}/.test('12345'));
```

- `*` means zero or more.
- `+` means one or more.
- `?` means zero or one.
- `{n}` means exactly n.
- `{n,}` means n or more.
- `{n,m}` means between n and m.

## Anchors

```javascript
console.log(/^hello/.test('hello world'));
console.log(/^hello/.test('say hello'));
console.log(/world$/.test('hello world'));
console.log(/^\d+$/.test('12345'));
console.log(/^\d+$/.test('123a'));
```

`^` means start, `$` means end. Without them your pattern can match anywhere inside the string, which is a very common validation bug.

## Groups

Round brackets group parts together and capture what they matched.

```javascript
console.log(/(ab)+/.test('ababab'));
console.log(/^(cat|dog)$/.test('dog'));
const match = '2026-09-05'.match(/(\d{4})-(\d{2})-(\d{2})/);
console.log(match[0]);
console.log(match[1], match[2], match[3]);
```

Named groups are much easier to read:

```javascript
const pattern = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const { groups } = '2026-09-05'.match(pattern);
console.log(groups.year, groups.month, groups.day);
```

## The methods

### `test` for yes or no

```javascript
console.log(/\d/.test('abc1'));
```

### `match` to get the matches

```javascript
console.log('a1b2c3'.match(/\d/));
console.log('a1b2c3'.match(/\d/g));
console.log('abc'.match(/\d/));
```

Without `g` you get details about the first match. With `g` you get a plain array of every match. No match gives `null`, so always check before using the result.

### `matchAll` for details of every match

```javascript
const text = 'Asha: 28, Ben: 35';
for (const m of text.matchAll(/(\w+): (\d+)/g)) {
  console.log(m[1], 'is', m[2]);
}
```

### `replace` and `replaceAll`

```javascript
console.log('hello world'.replace(/o/g, '0'));
console.log('2026-09-05'.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1'));
console.log('a1b2'.replace(/\d/g, (digit) => digit * 2));
```

`$1`, `$2` refer to the captured groups. A function gives you full control.

### `split`

```javascript
console.log('a1b22c333d'.split(/\d+/));
console.log('a, b;c  d'.split(/[,;\s]+/));
```

## Practical patterns

```javascript
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  indianPhone: /^[6-9]\d{9}$/,
  pincode: /^[1-9][0-9]{5}$/,
  username: /^[a-zA-Z0-9_]{3,16}$/,
  hexColour: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
  onlyDigits: /^\d+$/
};
console.log(patterns.email.test('asha@example.com'));
console.log(patterns.indianPhone.test('9876543210'));
console.log(patterns.username.test('asha_01'));
```

> **On email validation:** the pattern above is deliberately loose. The full official email grammar is enormous and matching it exactly is not worth the trouble. Check that it roughly looks like an address, then confirm by sending a verification mail.

## Escaping

Characters like `.` and `?` mean something special, so escape them with a backslash when you want them literally.

```javascript
console.log(/3.14/.test('3814'));
console.log(/3\.14/.test('3814'));
console.log(/3\.14/.test('3.14'));
```

For a pattern built from user input, escape everything:

```javascript
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const term = 'price (usd)';
const safe = new RegExp(escapeRegex(term), 'i');
console.log(safe.test('The price (usd) is 10'));
```

## Greedy versus lazy

```javascript
const html = '<b>bold</b> and <i>italic</i>';
console.log(html.match(/<.+>/)[0]);
console.log(html.match(/<.+?>/)[0]);
```

`+` is greedy and grabs as much as it can. Adding `?` makes it lazy and stops at the first opportunity.

> **Do not parse HTML with regex.** For anything structured, use a real parser. Regex is for flat text.

## Watch out for `lastIndex`

```javascript
const pattern = /\d/g;
console.log(pattern.test('a1'));
console.log(pattern.test('a1'));
```

The second call gives `false`. A `g` flagged regex remembers where it stopped. Do not reuse one across `test` calls, or reset `pattern.lastIndex = 0`.

## Quick recap

- Regex matches patterns rather than exact text.
- `\d`, `\w` and `\s` cover most character needs.
- `*`, `+`, `?` and `{n,m}` control how many times.
- Anchor with `^` and `$` for validation, or you will match partial strings.
- `test` gives a boolean, `match` gives the matches, `matchAll` gives details of all.
- Escape special characters, and escape any pattern built from user input.
- A `g` flagged regex remembers `lastIndex` between `test` calls.

<code id="code-content" class="language-javascript">
// test gives a simple yes or no
console.log(/cat/.test('the cat sat'));      // true
console.log(/cat/i.test('The CAT sat'));     // true, i ignores case
// Character shorthands and quantifiers
console.log(/^\d+$/.test('12345'));          // true, digits only
console.log(/^\d+$/.test('123a'));           // false, anchors matter
console.log(/colou?r/.test('color'));        // true, ? means optional
// Groups capture the parts you want
const match = '2026-09-05'.match(/(\d{4})-(\d{2})-(\d{2})/);
console.log(match[1], match[2], match[3]);   // 2026 09 05
// Named groups are far easier to read
const datePattern = /(?&lt;year&gt;\d{4})-(?&lt;month&gt;\d{2})-(?&lt;day&gt;\d{2})/;
const { groups } = '2026-09-05'.match(datePattern);
console.log(groups.day + '/' + groups.month + '/' + groups.year);
// Finding every match
console.log('a1b2c3'.match(/\d/g));          // ['1','2','3']
for (const m of 'Asha: 28, Ben: 35'.matchAll(/(\w+): (\d+)/g)) {
  console.log(m[1], 'is', m[2]);
}
// Replacing, with $1 style references or a function
console.log('2026-09-05'.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1'));
console.log('a1b2'.replace(/\d/g, d =&gt; d * 2));   // a2b4
// Practical validation patterns
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  indianPhone: /^[6-9]\d{9}$/,
  pincode: /^[1-9][0-9]{5}$/,
  username: /^[a-zA-Z0-9_]{3,16}$/
};
console.log(patterns.email.test('asha@example.com'));  // true
console.log(patterns.indianPhone.test('9876543210'));  // true
console.log(patterns.pincode.test('411001'));          // true
// Always escape a pattern built from user input
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&amp;');
}
const safe = new RegExp(escapeRegex('price (usd)'), 'i');
console.log(safe.test('The price (usd) is 10'));       // true
// Greedy grabs everything, lazy stops early
const html = '&lt;b&gt;bold&lt;/b&gt; and &lt;i&gt;italic&lt;/i&gt;';
console.log(html.match(/&lt;.+&gt;/)[0]);    // the whole thing, greedy
console.log(html.match(/&lt;.+?&gt;/)[0]);   // just &lt;b&gt;, lazy
</code></pre>

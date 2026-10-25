---
publishDate: 2026-03-06T09:10
title: Strings and String Methods
slug: strings-and-string-methods
metadescription: Work with text in JavaScript. Learn how to search, slice, trim, replace and reshape strings using the built in methods.
updateDate: 2026-09-05T09:10
author: ['bishal-biswas']
level: 1
tags: ['basics', 'strings']
course: javascript
---

## Creating strings

Three kinds of quotes, all producing a string.

```javascript
const single = 'Hello';
const double = "Hello";
const backticks = `Hello`;
```

Single and double quotes are identical in behaviour. Pick one and stay consistent. Backticks are special, and they get their own topic on template literals.

Quotes inside quotes need care:

```javascript
const a = "It's a nice day";
const b = 'She said "hello"';
const c = 'It\'s escaped with a backslash';
console.log(a, b, c);
```

## Length and characters

```javascript
const text = 'JavaScript';
console.log(text.length);
console.log(text[0]);
console.log(text[text.length - 1]);
console.log(text.at(-1));
console.log(text.charAt(4));
```

## Strings cannot be changed

This surprises people. String methods never modify the original, they return a **new** string.

```javascript
const name = 'ravi';
name.toUpperCase();
console.log(name);
const upper = name.toUpperCase();
console.log(upper);
```

The first `toUpperCase()` did nothing useful because the result was thrown away. Always store or use the return value.

## Changing case

```javascript
const text = 'Hello World';
console.log(text.toUpperCase());
console.log(text.toLowerCase());
```

A common use is case insensitive comparison:

```javascript
const input = 'ADMIN';
console.log(input.toLowerCase() === 'admin');
```

## Trimming whitespace

Form inputs are full of stray spaces.

```javascript
const messy = '   hello   ';
console.log(messy.trim().length);
console.log(messy.trimStart());
console.log(messy.trimEnd());
```

Always `trim()` user input before you check or store it.

## Searching

```javascript
const sentence = 'Learning JavaScript is fun';
console.log(sentence.includes('JavaScript'));
console.log(sentence.startsWith('Learning'));
console.log(sentence.endsWith('fun'));
console.log(sentence.indexOf('JavaScript'));
console.log(sentence.indexOf('Python'));
```

`includes` is the readable choice when you only need a yes or no. `indexOf` returns the position, or `-1` when nothing matches.

## Taking part of a string

### `slice`

```javascript
const text = 'JavaScript';
console.log(text.slice(0, 4));
console.log(text.slice(4));
console.log(text.slice(-6));
```

The end index is not included, and negative numbers count from the right.

### `substring`

Almost the same, but it does not understand negative numbers. `slice` is the one to remember.

## Replacing

```javascript
const text = 'I like cats. Cats are great.';
console.log(text.replace('cats', 'dogs'));
console.log(text.replaceAll('cats', 'dogs'));
```

`replace` changes only the first match. `replaceAll` changes every one. Note that both are case sensitive, so `Cats` with a capital C is left alone.

## Splitting and joining

```javascript
const csv = 'apple,banana,mango';
const list = csv.split(',');
console.log(list);
console.log(list.join(' and '));
const letters = 'code'.split('');
console.log(letters);
```

Splitting on an empty string gives you every character.

## Repeating and padding

```javascript
console.log('-'.repeat(20));
console.log('5'.padStart(3, '0'));
console.log('7'.padEnd(3, '*'));
```

`padStart` is how you format times and invoice numbers:

```javascript
const minutes = 7;
console.log('09:' + String(minutes).padStart(2, '0'));
```

## Joining strings together

```javascript
const first = 'Ravi';
const last = 'Kumar';
console.log(first + ' ' + last);
console.log(first.concat(' ', last));
console.log(`${first} ${last}`);
```

The last form uses backticks and is the clearest once the text gets longer.

## A practical example

```javascript
function formatUsername(input) {
  const cleaned = input.trim().toLowerCase();
  if (cleaned.length === 0) {
    return 'anonymous';
  }
  return cleaned.replaceAll(' ', '_');
}
console.log(formatUsername('  Ravi Kumar  '));
console.log(formatUsername('   '));
```

## Quick recap

- Strings are immutable, so every method returns a new string.
- `trim()` user input before checking or saving it.
- `includes`, `startsWith` and `endsWith` answer yes or no questions.
- `slice` takes a section and understands negative positions.
- `replace` changes the first match, `replaceAll` changes all of them.
- `split` turns text into an array, `join` turns an array back into text.
- `padStart` is the neat way to format numbers with leading zeros.

<code id="code-content" class="language-javascript">
const text = '  Learning JavaScript is fun  ';
// Strings never change in place, methods return new strings
console.log(text.length);
console.log(text.trim().length);
// Case
console.log('Hello'.toUpperCase());
console.log('HELLO'.toLowerCase());
// Searching
const clean = text.trim();
console.log(clean.includes('JavaScript'));   // true
console.log(clean.startsWith('Learning'));   // true
console.log(clean.indexOf('JavaScript'));    // 9
console.log(clean.indexOf('Python'));        // -1
// Taking a section
console.log('JavaScript'.slice(0, 4));   // Java
console.log('JavaScript'.slice(4));      // Script
console.log('JavaScript'.slice(-6));     // Script
// Replacing
const line = 'I like cats. Cats are great.';
console.log(line.replace('cats', 'dogs'));     // first match only
console.log(line.replaceAll('cats', 'dogs'));  // every match
// Splitting and joining
const list = 'apple,banana,mango'.split(',');
console.log(list);
console.log(list.join(' and '));
// Padding is how you format times and IDs
console.log(String(7).padStart(2, '0'));   // 07
console.log('-'.repeat(20));
// Putting it together: clean up a username
function formatUsername(input) {
  const cleaned = input.trim().toLowerCase();
  if (cleaned.length === 0) return 'anonymous';
  return cleaned.replaceAll(' ', '_');
}
console.log(formatUsername('  Ravi Kumar  ')); // ravi_kumar
</code></pre>

---
publishDate: 2026-03-08T09:13
title: Date and Time
slug: date-and-time
metadescription: Create, read, compare and format dates in JavaScript, and learn the traps that catch every beginner.
updateDate: 2026-09-05T09:13
author: ['bishal-biswas']
level: 1
tags: ['basics', 'date']
course: javascript
---

## Creating a date

```javascript
const now = new Date();
console.log(now);
```

You can also build a specific one:

```javascript
const fromString = new Date('2026-09-05');
const fromParts = new Date(2026, 8, 5, 14, 30);
const fromTimestamp = new Date(0);
console.log(fromString, fromParts, fromTimestamp);
```

> **The biggest trap:** months are counted from **zero**. January is `0` and December is `11`. So `new Date(2026, 8, 5)` is the fifth of **September**, not August. Days of the month are normal, starting at 1.

## Reading parts of a date

```javascript
const d = new Date(2026, 8, 5, 14, 30, 45);
console.log(d.getFullYear());
console.log(d.getMonth());
console.log(d.getDate());
console.log(d.getDay());
console.log(d.getHours());
console.log(d.getMinutes());
console.log(d.getSeconds());
```

Two more traps hide in there:

- `getMonth()` returns 0 to 11, so add 1 when you display it.
- `getDate()` is the day of the **month**, while `getDay()` is the day of the **week** where Sunday is 0.

```javascript
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const d = new Date();
console.log(days[d.getDay()]);
```

## Timestamps

A timestamp is the number of milliseconds since 1 January 1970.

```javascript
const now = new Date();
console.log(now.getTime());
console.log(Date.now());
```

Timestamps are plain numbers, which makes them perfect for comparing and sorting.

## Comparing dates

```javascript
const a = new Date('2026-01-01');
const b = new Date('2026-06-01');
console.log(a < b);
console.log(a.getTime() === b.getTime());
```

Comparison operators work directly, but equality does not, because two `Date` objects are never the same object. Compare `getTime()` values instead.

## Doing date maths

Subtracting two dates gives milliseconds.

```javascript
const start = new Date('2026-01-01');
const end = new Date('2026-01-31');
const diffMs = end - start;
const diffDays = diffMs / (1000 * 60 * 60 * 24);
console.log(diffDays);
```

To add days, use `setDate`. It handles month and year rollover for you.

```javascript
const date = new Date('2026-01-30');
date.setDate(date.getDate() + 5);
console.log(date.toDateString());
```

Adding 5 to 30 January correctly gives 4 February.

> **Careful:** `setDate` **changes** the original date object. Copy it first if you need to keep the old value:

```javascript
const original = new Date('2026-01-30');
const copy = new Date(original);
copy.setDate(copy.getDate() + 5);
console.log(original.toDateString(), copy.toDateString());
```

## Formatting

The built in `toString` output is not something you want to show users.

```javascript
const d = new Date(2026, 8, 5);
console.log(d.toString());
console.log(d.toDateString());
console.log(d.toISOString());
console.log(d.toLocaleDateString('en-IN'));
console.log(d.toLocaleDateString('en-US'));
```

`toLocaleDateString` accepts options for full control:

```javascript
const d = new Date(2026, 8, 5);
console.log(d.toLocaleDateString('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}));
```

For times:

```javascript
const d = new Date();
console.log(d.toLocaleTimeString('en-IN'));
console.log(d.toLocaleString('en-IN'));
```

### Building a format by hand

Sometimes you need an exact shape, like `2026-09-05` for an input field.

```javascript
function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
console.log(toInputDate(new Date(2026, 8, 5)));
```

This is where `padStart` from the strings topic earns its keep.

## Parsing strings carefully

```javascript
console.log(new Date('2026-09-05'));
console.log(new Date('05/09/2026'));
console.log(new Date('not a date'));
```

Only the ISO format `YYYY-MM-DD` is reliable across browsers. Slash formats are ambiguous, since `05/09` could be 5 September or 9 May depending on the region. An unparseable string gives `Invalid Date`.

Check before you trust it:

```javascript
const d = new Date('not a date');
if (Number.isNaN(d.getTime())) {
  console.log('That date is not valid');
}
```

## A note on the future

The `Date` API is old and awkward. A modern replacement called **Temporal** is arriving in browsers and is already available in recent Node.js versions. Learn `Date` first, since it is everywhere, and reach for Temporal or a small library when you need heavy date work.

## Quick recap

- Months are zero based, so add 1 before displaying.
- `getDate()` is the day of the month, `getDay()` is the day of the week.
- `Date.now()` gives a millisecond timestamp, ideal for comparing.
- Subtracting dates gives milliseconds, so divide to get days.
- `setDate` mutates the original, so copy first.
- Use `toLocaleDateString` for display and ISO `YYYY-MM-DD` for parsing.
- Check `Number.isNaN(date.getTime())` to detect an invalid date.

<code id="code-content" class="language-javascript">
// Creating dates. Remember: months count from 0
const now = new Date();
const independence = new Date(1947, 7, 15); // 15 August 1947
console.log(independence.toDateString());
// Reading the parts
console.log('Year :', now.getFullYear());
console.log('Month:', now.getMonth() + 1);  // add 1 for humans
console.log('Day  :', now.getDate());       // day of the month
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
console.log('Weekday:', days[now.getDay()]); // day of the week
// Timestamps are plain numbers, easy to compare
console.log(Date.now());
// Difference between two dates, in days
const start = new Date('2026-01-01');
const end = new Date('2026-01-31');
const diffDays = (end - start) / (1000 * 60 * 60 * 24);
console.log('Days between:', diffDays); // 30
// Adding days: copy first, because setDate mutates
const original = new Date('2026-01-30');
const later = new Date(original);
later.setDate(later.getDate() + 5);
console.log(original.toDateString(), '->', later.toDateString());
// Formatting for people
console.log(now.toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
}));
// Formatting for an input field: YYYY-MM-DD
function toInputDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
console.log(toInputDate(now));
// Always check a parsed date is real
const parsed = new Date('not a date');
console.log(Number.isNaN(parsed.getTime()) ? 'Invalid date' : 'Valid');
</code></pre>

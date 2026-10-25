---
publishDate: 2026-10-25T12:15
title: The Temporal API
slug: temporal-api
metadescription: Work with dates, times, time zones and durations the modern way. Learn Temporal's types, maths, comparisons and how to use it on Node 24 and Node 26.
updateDate: 2026-10-25T12:15
author: ['bishal-biswas']
level: 3
tags: ['temporal', 'dates', 'time-zones']
course: nodejs
---

## Why a new date API?

JavaScript's `Date` object has been with us since 1995, and it shows. Months start at 0, so December is 11. A `Date` can be changed in place by any function you pass it to. It only knows two time zones: your computer's and UTC. And it has no idea what "two hours and thirty minutes" means.

**Temporal** is the modern replacement, designed by TC39 (the committee that evolves JavaScript). Think of `Date` as a single pocket knife with a blunt blade. Temporal is a toolbox with one tool per job: one for a birthday, one for a meeting in Tokyo, one for "this exact moment", one for "90 minutes".

Every Temporal object is **immutable**: once created it never changes. Methods like `add()` return a new object instead.

## Can I use it in Node?

It depends on your Node version:

- **Node 26** ships V8 14.6 and turns Temporal on by default. No flag, no install.
- **Node 24** (the current LTS) does not have Temporal by default.

Check for yourself:

```bash
node -p "typeof Temporal"
```

```text
undefined
```

That is Node 24. On Node 26 it prints `object`.

### Using it on Node 24 with a polyfill

A **polyfill** is a package that adds a missing feature in plain JavaScript. Two well-known ones follow the official specification:

```bash
npm install temporal-polyfill
# or
npm install @js-temporal/polyfill
```

Import `Temporal` from the package:

```javascript
import { Temporal } from 'temporal-polyfill';
// or: import { Temporal } from '@js-temporal/polyfill';

console.log(Temporal.Now.plainDateISO().toString()); // e.g. 2026-10-25
```

A nice pattern is to use the built-in when it exists and the polyfill otherwise. Then upgrading to Node 26 removes the polyfill with no code changes:

```javascript
// temporal.js
const { Temporal } = globalThis.Temporal
  ? globalThis
  : await import('temporal-polyfill');

export { Temporal };
```

The examples below were checked with the polyfill on Node 24. They behave the same with the native Temporal in Node 26.

## The types at a glance

The word **Plain** means "wall-clock value with no time zone attached", like the date printed on a calendar or the time on a kitchen clock.

| Type | What it holds | Example |
| --- | --- | --- |
| `Temporal.PlainDate` | A calendar date | A birthday: `2026-03-14` |
| `Temporal.PlainTime` | A clock time | Shop opens: `09:30` |
| `Temporal.PlainDateTime` | Date plus time, no zone | `2026-10-25T09:30` |
| `Temporal.ZonedDateTime` | Date, time and time zone | A meeting in London |
| `Temporal.Instant` | An exact moment on the global timeline | When an order was placed |
| `Temporal.Duration` | A length of time | `2 hours 30 minutes` |
| `Temporal.PlainYearMonth` | A year and month | A credit card expiry |
| `Temporal.PlainMonthDay` | A month and day | An anniversary: `12-25` |

Pick the smallest type that answers your question. If the time zone does not matter, do not carry one around.

## Temporal.Now: what time is it?

`Temporal.Now` gives you the current moment in whichever shape you need:

```javascript
Temporal.Now.instant();          // exact moment, e.g. 2026-10-25T08:30:12.345Z
Temporal.Now.plainDateISO();     // today's date in your system time zone
Temporal.Now.plainTimeISO();     // the clock time right now
Temporal.Now.zonedDateTimeISO(); // date, time and your system time zone
Temporal.Now.zonedDateTimeISO('Asia/Kolkata'); // now, in India
Temporal.Now.timeZoneId();       // e.g. 'Europe/London'
```

The `ISO` suffix means "use the standard ISO 8601 calendar", the everyday Gregorian calendar.

## PlainDate: calendar dates

Create a date from a string or an object. Months are 1 to 12, as humans expect.

```javascript
const launch = Temporal.PlainDate.from('2026-10-25');
const same = Temporal.PlainDate.from({ year: 2026, month: 10, day: 25 });

console.log(launch.year, launch.month, launch.day); // 2026 10 25
console.log(launch.dayOfWeek);   // 7 (Monday is 1, Sunday is 7)
console.log(launch.daysInMonth); // 31
console.log(launch.inLeapYear);  // false
console.log(launch.equals(same)); // true
```

### add() and subtract()

```javascript
const due = Temporal.PlainDate.from('2026-10-25');

console.log(due.add({ months: 1 }).toString());       // 2026-11-25
console.log(due.subtract({ days: 30 }).toString());   // 2026-09-25
console.log(due.toString());                          // 2026-10-25 (unchanged)
```

What about 31 January plus one month? There is no 31 February. By default Temporal **constrains** the result to the last valid day. Ask it to **reject** instead if you would rather get an error:

```javascript
const endOfJan = Temporal.PlainDate.from('2026-01-31');

console.log(endOfJan.add({ months: 1 }).toString()); // 2026-02-28
endOfJan.add({ months: 1 }, { overflow: 'reject' }); // throws RangeError
```

### with(): change one part

`with()` returns a copy with some fields replaced:

```javascript
const today = Temporal.PlainDate.from('2026-10-25');
console.log(today.with({ day: 1 }).toString()); // 2026-10-01 (first of the month)
```

## PlainTime and PlainDateTime

```javascript
const opens = Temporal.PlainTime.from('09:30');
console.log(opens.add({ hours: 15 }).toString()); // 00:30:00 (wraps past midnight)

const start = Temporal.PlainDateTime.from('2026-10-25T09:30');
console.log(start.add({ hours: 16 }).toString()); // 2026-10-26T01:30:00
```

## ZonedDateTime: time zones done right

A **time zone** is a region that follows the same clock rules, named like `Europe/London` or `Asia/Tokyo`. Its **offset** from UTC can change during the year because of **daylight saving time** (DST).

```javascript
const call = Temporal.ZonedDateTime.from('2026-10-25T09:30[Europe/London]');

console.log(call.toString());
// 2026-10-25T09:30:00+00:00[Europe/London]
console.log(call.withTimeZone('Asia/Kolkata').toString());
// 2026-10-25T15:00:00+05:30[Asia/Kolkata]
console.log(call.withTimeZone('America/New_York').toPlainTime().toString());
// 05:30:00
```

`withTimeZone()` keeps the same moment and shows it on another region's clock.

### The DST trap that Temporal avoids

UK clocks went back one hour at 02:00 on 25 October 2026, so that day had 25 hours. Watch the difference between "one day later" and "24 hours later":

```javascript
const noon = Temporal.ZonedDateTime.from('2026-10-24T12:00[Europe/London]');

console.log(noon.add({ days: 1 }).toString());
// 2026-10-25T12:00:00+00:00[Europe/London]  (same wall-clock time)
console.log(noon.add({ hours: 24 }).toString());
// 2026-10-25T11:00:00+00:00[Europe/London]  (exactly 24 real hours)

const sunday = Temporal.ZonedDateTime.from('2026-10-25T00:00[Europe/London]');
console.log(sunday.hoursInDay); // 25
```

With `Date`, getting this right takes careful manual work. Temporal does it because it knows the time zone rules.

## Instant: an exact moment

An **Instant** is a single point on the global timeline, with no calendar or time zone. Use it for timestamps: when a log line was written or an order was placed.

```javascript
const placed = Temporal.Instant.from('2026-10-25T08:30:00Z'); // Z means UTC

console.log(placed.epochMilliseconds); // 1792917000000
console.log(placed.toZonedDateTimeISO('Asia/Tokyo').toString());
// 2026-10-25T17:30:00+09:00[Asia/Tokyo]
```

## Duration: lengths of time

A **Duration** is an amount of time, written in ISO 8601 form such as `PT2H30M` ("period, time part: 2 hours 30 minutes").

```javascript
const film = Temporal.Duration.from({ hours: 1, minutes: 90 });

console.log(film.toString());          // PT1H90M
console.log(film.total('minutes'));    // 150
console.log(film.round({ largestUnit: 'hours' }).toString()); // PT2H30M
```

### until() and since()

These measure the gap between two values and return a Duration:

```javascript
const today = Temporal.PlainDate.from('2026-10-25');
const holiday = Temporal.PlainDate.from('2026-12-25');

console.log(today.until(holiday).toString());                         // P61D
console.log(today.until(holiday, { largestUnit: 'months' }).toString()); // P2M
console.log(holiday.since(today).days);                               // 61
```

For Instants the default unit is seconds, so ask for bigger units:

```javascript
const start = Temporal.Instant.from('2026-10-25T08:00:00Z');
const end = Temporal.Instant.from('2026-10-25T09:45:30Z');

console.log(start.until(end).toString()); // PT6330S
console.log(start.until(end, { largestUnit: 'hours' }).toString()); // PT1H45M30S
```

## Comparing and sorting

Every type has a static `compare(a, b)` that returns `-1`, `0` or `1`, which is exactly what `Array.prototype.sort` wants:

```javascript
const dates = ['2026-12-25', '2026-01-01', '2026-06-15']
  .map((text) => Temporal.PlainDate.from(text));

dates.sort(Temporal.PlainDate.compare);
console.log(dates.map(String)); // [ '2026-01-01', '2026-06-15', '2026-12-25' ]
```

Use `a.equals(b)` to check if two values are the same.

## Talking to Date, JSON and databases

`toString()` always gives an ISO 8601 string, so Temporal values travel well in JSON:

```javascript
const order = { due: Temporal.PlainDate.from('2026-10-25') };
console.log(JSON.stringify(order)); // {"due":"2026-10-25"}
const back = Temporal.PlainDate.from(JSON.parse('{"due":"2026-10-25"}').due);
```

Converting to and from the old `Date`:

```javascript
const legacy = new Date('2026-10-25T08:30:00Z');

const instant = Temporal.Instant.fromEpochMilliseconds(legacy.getTime());
console.log(instant.toString()); // 2026-10-25T08:30:00Z

const asDate = new Date(instant.epochMilliseconds);
console.log(asDate.toISOString()); // 2026-10-25T08:30:00.000Z
```

Where Temporal is built in, `legacy.toTemporalInstant()` does the first conversion for you.

For display, use `toLocaleString()`, which uses the same `Intl` options as `Date`:

```javascript
const day = Temporal.PlainDate.from('2026-10-25');
console.log(day.toLocaleString('en-GB', { dateStyle: 'full' })); // Sunday, 25 October 2026
```

## Common mistakes

**Comparing with `<` or `>`.** Temporal objects refuse to turn into numbers, so this throws a `TypeError`:

```javascript
if (today < holiday) { /* TypeError */ }
```

Use `compare` instead:

```javascript
if (Temporal.PlainDate.compare(today, holiday) < 0) {
  console.log('Holiday is still ahead');
}
```

**Using a Plain type for a real moment.** `PlainDateTime` has no time zone, so it cannot say *when* something happened. Store timestamps as `Instant` (or a `ZonedDateTime` if the zone matters), and keep Plain types for things like birthdays and opening hours.

**Expecting the original to change.** `date.add({ days: 1 })` returns a new object. Keep the result:

```javascript
let due = Temporal.PlainDate.from('2026-10-25');
due = due.add({ days: 7 }); // reassign, or use a new variable
```

**Parsing loose formats.** `Temporal.PlainDate.from('25/10/2026')` throws a `RangeError`. Temporal only parses ISO 8601 strings, which is a feature: no guessing between day-first and month-first.

## Quick recap

- Temporal replaces `Date` with immutable, purpose-built types and 1-based months.
- It is on by default in Node 26. On Node 24, check `typeof Temporal` and use `temporal-polyfill` or `@js-temporal/polyfill`.
- Plain types have no time zone; `ZonedDateTime` and `Instant` represent real moments.
- `add`, `subtract` and `with` return new objects; `until` and `since` return a `Duration`.
- `ZonedDateTime` handles daylight saving time correctly.
- Compare with `Temporal.X.compare()` or `equals()`, never with `<` or `>`.
- `toString()` gives ISO strings that round-trip through JSON with `from()`.

<code id="code-content" class="language-javascript">
// temporal-demo.mjs: runs as-is on Node 26 (Temporal is built in)
// On Node 24: npm install temporal-polyfill, and this falls back to it
const { Temporal } = globalThis.Temporal
  ? globalThis
  : await import('temporal-polyfill');
// Now, in a few shapes
console.log('Today:', Temporal.Now.plainDateISO().toString());
console.log('Your time zone:', Temporal.Now.timeZoneId());
// PlainDate: 1-based months, immutable maths
const launch = Temporal.PlainDate.from('2026-10-25');
console.log('Launch +1 month:', launch.add({ months: 1 }).toString());
console.log('First of month:', launch.with({ day: 1 }).toString());
console.log('31 Jan + 1 month:', Temporal.PlainDate.from('2026-01-31').add({ months: 1 }).toString());
// Durations between dates
const holiday = Temporal.PlainDate.from('2026-12-25');
const gap = launch.until(holiday, { largestUnit: 'months' });
console.log(`Until the holiday: ${gap.months} months, ${gap.days} days`);
// Time zones: one meeting, three clocks
const meeting = Temporal.ZonedDateTime.from('2026-11-02T15:00[America/New_York]');
for (const zone of ['Europe/London', 'Asia/Kolkata', 'Asia/Tokyo']) {
  console.log(zone.padEnd(16), meeting.withTimeZone(zone).toPlainDateTime().toString());
}
// Daylight saving time: one day is not always 24 hours
const noon = Temporal.ZonedDateTime.from('2026-10-24T12:00[Europe/London]');
console.log('+1 day:  ', noon.add({ days: 1 }).toPlainTime().toString());
console.log('+24 hours:', noon.add({ hours: 24 }).toPlainTime().toString());
// Instants and durations for timestamps
const start = Temporal.Instant.from('2026-10-25T08:00:00Z');
const end = Temporal.Instant.from('2026-10-25T09:45:30Z');
console.log('Job took:', start.until(end, { largestUnit: 'hours' }).toString());
console.log('In minutes:', start.until(end).total('minutes'));
// Sorting with compare (never use &lt; or &gt; on Temporal objects)
const deadlines = ['2026-12-01', '2026-11-05', '2027-01-10'].map((d) =&gt; Temporal.PlainDate.from(d));
deadlines.sort(Temporal.PlainDate.compare);
console.log('Sorted:', deadlines.map(String).join(', '));
// JSON round-trip and Date interop
const json = JSON.stringify({ due: launch, placed: start });
console.log('JSON:', json);
const placed = Temporal.Instant.from(JSON.parse(json).placed);
console.log('As Date:', new Date(placed.epochMilliseconds).toISOString());
</code></pre>

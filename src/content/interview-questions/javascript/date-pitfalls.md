---
course: javascript
slug: date-pitfalls
experienceLevel: mid
difficulty: medium
tags:
  - dates
  - time-zones
question: "What are the common pitfalls of the JavaScript `Date` object?"
answer: |
  The `Date` object is a thin wrapper around a single number, milliseconds since 1970-01-01 UTC, and most bugs come from its inconsistent API: 0-based months, mutability, surprising parsing rules and silent conversions to the local time zone.

  The classic pitfalls:

  1. **Months are 0-based, days are not.** `new Date(2025, 0, 31)` is 31 January. `getMonth()` returns 0-11, `getDate()` returns 1-31, and `getDay()` is the weekday (0 = Sunday).
  2. **Overflow rolls over silently.** `new Date(2025, 1, 30)` becomes 2 March, and `setMonth(month + 1)` on 31 January skips to March. Nothing throws.
  3. **Parsing rules differ by format.** A date-only ISO string such as `'2025-03-14'` is parsed as **UTC midnight**, but a date-time string without an offset such as `'2025-03-14T10:00'` is parsed as **local time**. Non-ISO strings like `'03/14/2025'` are implementation-defined. Only rely on full ISO 8601 strings, ideally with `Z` or an offset.
  4. **Local vs UTC getters.** `getHours()` uses the machine's time zone and `getUTCHours()` uses UTC. A user near the date line can see a different calendar day than your server.
  5. **Mutability.** `setDate`, `setHours` and friends change the object in place, so a date shared between pieces of code can change unexpectedly. Copy with `new Date(d)` first.
  6. **Invalid dates do not throw.** `new Date('nonsense')` is an object whose time is `NaN`; check `Number.isNaN(d.getTime())`.
  7. **Daylight saving time.** Adding `24 * 60 * 60 * 1000` ms is not always "one day later" in local time.

  Practical guidance:

  - Store and transmit timestamps as UTC ISO strings (`toISOString()`) or epoch milliseconds; convert to local time only for display.
  - Display with `Intl.DateTimeFormat` or `toLocaleString` and an explicit `timeZone` option.
  - For non-trivial calendar math, use a library such as date-fns, Luxon or Day.js, or the new `Temporal` API, which has immutable types and explicit time zones and is rolling out across browsers (check support before relying on it).
codeExample: |
  process.env.TZ = 'America/New_York'; // fix the time zone so the output is deterministic

  const jan31 = new Date(2025, 0, 31);
  console.log(jan31.getMonth(), jan31.getDate(), jan31.getDay()); // Output: 0 31 5

  console.log(new Date(2025, 1, 30).toDateString()); // Output: Sun Mar 02 2025

  const d = new Date(2025, 0, 31);
  d.setMonth(d.getMonth() + 1);                       // "one month later", mutates d
  console.log(d.toDateString());                      // Output: Mon Mar 03 2025

  const dateOnly = new Date('2025-03-14');            // parsed as UTC midnight
  const dateTime = new Date('2025-03-14T00:00');      // parsed as local time
  console.log(dateOnly.getDate(), dateTime.getDate()); // Output: 13 14
  console.log(dateOnly.toISOString());                // Output: 2025-03-14T00:00:00.000Z

  const invalid = new Date('31/12/2025');
  console.log(invalid.getTime(), Number.isNaN(invalid.getTime())); // Output: NaN true

  // DST: adding 24 hours across the spring-forward change
  const beforeDst = new Date(2025, 2, 8, 12, 0);      // 8 March 2025, 12:00
  const plus24h = new Date(beforeDst.getTime() + 24 * 60 * 60 * 1000);
  console.log(plus24h.getHours());                    // Output: 13 (not 12)

  console.log(dateOnly.toLocaleDateString('en-GB', { timeZone: 'UTC' })); // Output: 14/03/2025
popularity: 7.9
isPublished: true
---

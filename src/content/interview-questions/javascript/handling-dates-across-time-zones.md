---
course: javascript
slug: handling-dates-across-time-zones
experienceLevel: senior
difficulty: hard
tags:
  - dates
  - intl
  - time-zones
question: How do you handle dates and time zones correctly in JavaScript?
answer: |
  A JavaScript `Date` is just a **timestamp**: milliseconds since the Unix epoch in UTC. It has no time zone of its own. Methods like `getHours()` and `toString()` interpret it in the **host's local zone**, while `getUTCHours()` and `toISOString()` use UTC. Most bugs come from mixing the two, or from treating a calendar date as a timestamp.

  Classic pitfalls:

  - **Parsing**: `new Date('2025-03-09')` (date-only ISO) is parsed as **UTC midnight**, while `new Date('2025-03-09T00:00')` is **local** midnight. Non-ISO strings are implementation-defined. Parse only ISO 8601 with an explicit offset.
  - **DST**: adding `24 * 60 * 60 * 1000` isn't "one day" across a daylight-saving change. Some local times don't exist (spring forward) and some happen twice (fall back).
  - **Server zone dependence**: code that calls `getDate()` behaves differently on a laptop and in a UTC container.
  - **Months are 0-based**, and `Date` is mutable, so shared instances can be changed by accident.

  Rules that hold up in production:

  - Store and transmit **instants** in UTC (ISO strings with `Z`, or epoch milliseconds).
  - Store the user's **IANA zone** (`Europe/Berlin`, not `+01:00`) when you need local meaning, such as "9 am every Monday in the user's time".
  - Store pure calendar dates (birthdays, due dates) as `YYYY-MM-DD` strings, not as timestamps.
  - Format at the edge with `Intl.DateTimeFormat` and an explicit `timeZone`. Run servers and CI in UTC, and test with several `TZ` values.

  **Temporal** is the replacement API, with `Instant`, `ZonedDateTime`, `PlainDate`, durations and DST-aware arithmetic. It is a Stage 3 TC39 proposal that has begun shipping in some browsers (Firefox first). Node 24 doesn't expose it by default. Check current support, and use the official polyfill or a library such as `date-fns-tz` or Luxon until your runtimes have it.
codeExample: |
  process.env.TZ = 'America/New_York';      // simulate the server's local zone

  console.log(new Date('2025-03-09').toISOString());       // date-only: UTC
  // Output: 2025-03-09T00:00:00.000Z
  console.log(new Date('2025-03-09T00:00').toISOString()); // date-time: local
  // Output: 2025-03-09T05:00:00.000Z

  const show = (date, timeZone) => new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(date);

  const meeting = new Date('2025-03-09T06:30:00Z');        // stored as an instant
  console.log(show(meeting, 'America/New_York'));
  // Output: Mar 9, 2025, 1:30 AM EST
  console.log(show(meeting, 'Asia/Kolkata'));
  // Output: Mar 9, 2025, 12:00 PM GMT+5:30

  // "Same time tomorrow" by adding 24 h crosses the DST change
  const tomorrow = new Date(meeting.getTime() + 24 * 60 * 60 * 1000);
  console.log(show(tomorrow, 'America/New_York'));
  // Output: Mar 10, 2025, 2:30 AM EDT   <- wall-clock time moved by an hour

  console.log(typeof globalThis.Temporal);  // Output: undefined (Node 24 without flags)
popularity: 8.1
isPublished: true
---

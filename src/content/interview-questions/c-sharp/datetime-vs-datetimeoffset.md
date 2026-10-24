---
course: c-sharp
slug: datetime-vs-datetimeoffset
experienceLevel: mid
difficulty: easy
tags:
  - types
question: "What is the difference between `DateTime` and `DateTimeOffset` in C#?"
answer: |
  A `DateTime` stores a date and time plus a `Kind`: `Utc`, `Local`, or `Unspecified`. `Local` depends on the machine running the code, and `Unspecified` (common with database values) says nothing at all, so one `DateTime` can mean different moments on different servers. That ambiguity causes classic time zone bugs.

  A `DateTimeOffset` stores the date and time **plus its offset from UTC**, such as `+05:30`. It identifies an exact **instant** unambiguously, and two values representing the same instant compare as equal even when their offsets differ.

  Guidelines:

  - Use `DateTimeOffset` (or UTC `DateTime` values) for timestamps such as order times, token expiry, and audit logs. Store UTC in the database and convert to local time only for display.
  - An offset isn't a time zone: `+01:00` says nothing about daylight saving rules, so use `TimeZoneInfo` for time zone conversions.
  - Use `DateOnly` and `TimeOnly` (.NET 6) for values without the other part, such as birthdays or opening hours.
  - Inject `TimeProvider` (.NET 8) instead of calling `DateTime.Now` directly, so tests can control time.
codeExample: |
  DateTime parsed = DateTime.Parse("2026-03-01 09:00");  // which time zone?
  Console.WriteLine(parsed.Kind);                        // Output: Unspecified

  var india = new DateTimeOffset(2026, 3, 1, 14, 30, 0, TimeSpan.FromHours(5.5));
  var london = new DateTimeOffset(2026, 3, 1, 9, 0, 0, TimeSpan.Zero);
  Console.WriteLine(india == london);                    // Output: True (same instant)
  Console.WriteLine(india.ToUniversalTime().ToString("u")); // Output: 2026-03-01 09:00:00Z

  // Time zone rules (daylight saving) need TimeZoneInfo, not just an offset
  var tokyo = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");
  var inTokyo = TimeZoneInfo.ConvertTime(london, tokyo);
  Console.WriteLine(inTokyo.ToString("yyyy-MM-dd HH:mm zzz"));
  // Output: 2026-03-01 18:00 +09:00

  DateOnly birthday = new(1990, 12, 10);                 // date without time (.NET 6)
  TimeOnly opens = new(9, 30);                           // time without date

  // Testable time (.NET 8): depend on TimeProvider, not DateTime.Now
  Console.WriteLine(IsExpired(DateTimeOffset.MaxValue, TimeProvider.System)); // False

  static bool IsExpired(DateTimeOffset expiry, TimeProvider clock) =>
      clock.GetUtcNow() > expiry;
popularity: 7.1
isPublished: true
---

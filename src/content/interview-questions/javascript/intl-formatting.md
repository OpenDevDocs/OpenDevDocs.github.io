---
course: javascript
slug: intl-formatting
experienceLevel: mid
difficulty: easy
tags:
  - intl
  - formatting
  - i18n
question: "How do you format numbers, dates and relative times with the `Intl` API?"
answer: |
  The built-in `Intl` namespace provides locale-aware formatters, mainly `Intl.NumberFormat`, `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`; you create a formatter with a locale and options, then call `format()` on it, and you get correct separators, currency symbols, date order and language without any library.

  The main formatters:

  - **`Intl.NumberFormat`**: decimals, percentages, currencies (`style: 'currency', currency: 'EUR'`), units (`style: 'unit', unit: 'kilometer-per-hour'`) and compact notation (`notation: 'compact'` gives `1.2M`). Control rounding with `maximumFractionDigits`.
  - **`Intl.DateTimeFormat`**: dates and times using `dateStyle`/`timeStyle` presets or individual fields (`weekday`, `month: 'long'`). The `timeZone` option is the reliable way to show a time in a specific zone, such as `'Asia/Kolkata'` or `'UTC'`. `formatRange` formats spans like "Mar 3 – 7, 2025".
  - **`Intl.RelativeTimeFormat`**: phrases like "3 days ago" or "in 2 hours". You compute the difference and unit yourself; `numeric: 'auto'` gives natural words such as "yesterday" and "tomorrow".
  - Also useful: `Intl.ListFormat` ("a, b, and c"), `Intl.PluralRules` (choosing "1 item" vs "2 items", or "1st/2nd/3rd") and `Intl.Collator` for locale-aware sorting.

  Practical guidance:

  - **Reuse formatter instances.** Creating one is relatively expensive; `toLocaleString()` creates a new formatter on every call, so in a loop or a large table create the formatter once.
  - Pass the user's locale explicitly (for example from `navigator.language` or your app settings) instead of relying on defaults, which differ between servers and browsers.
  - Store raw values (numbers, ISO timestamps) and format only at display time.
  - Do not compare formatted output with hard-coded strings in tests or parsing logic: some locales use non-breaking spaces (`U+00A0`, `U+202F`), and output can change between ICU versions.
  - Use `formatToParts()` when you need to style pieces separately, such as a smaller currency symbol.
codeExample: |
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  console.log(money.format(1234.5));                    // Output: $1,234.50

  const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
  console.log(inr.format(1234567.8));                   // Output: ₹12,34,567.80

  console.log(new Intl.NumberFormat('de-DE').format(1234567.891)); // Output: 1.234.567,891
  console.log(new Intl.NumberFormat('en', { notation: 'compact' }).format(1_250_000)); // Output: 1.3M
  console.log(new Intl.NumberFormat('en', { style: 'percent' }).format(0.256)); // Output: 26%
  console.log(new Intl.NumberFormat('en', { style: 'unit', unit: 'kilometer-per-hour' }).format(50));
  // Output: 50 km/h

  const date = new Date('2025-03-14T15:30:00Z');
  const long = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
  console.log(long.format(date));                       // Output: Friday, March 14, 2025
  const gbTime = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  console.log(gbTime.format(date));                     // Output: 21:00

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  console.log(rtf.format(-1, 'day'), '|', rtf.format(3, 'week'), '|', rtf.format(-5, 'minute'));
  // Output: yesterday | in 3 weeks | 5 minutes ago

  console.log(new Intl.ListFormat('en', { type: 'conjunction' }).format(['red', 'green', 'blue']));
  // Output: red, green, and blue
popularity: 7.0
isPublished: true
---

---
publishDate: 2026-10-27T08:59
title: 'Working with Dates and Times'
slug: dates-and-times
metadescription: 'Use the datetime module to create, format, parse and compare dates and times, do date math with timedelta, and handle time zones with zoneinfo.'
updateDate: 2026-10-27T08:59
author: ['bishal-biswas']
level: 2
tags: ['python', 'datetime', 'standard-library']
course: python
---

## Why dates need special tools

Dates look simple, but they are full of traps. Months have different lengths, leap years add a day, countries write dates in different orders, and clocks jump forward and back for daylight saving time. If you store dates as plain strings like `"27/10/2026"`, you cannot easily ask "how many days until Christmas?" or "is this date before that one?".

Python's built-in `datetime` module solves this. It gives you real date and time **objects** that know how to compare, add, subtract and print themselves. You met it briefly in [A Tour of the Standard Library](/courses/python/standard-library-tour). Now you will learn it properly.

## The main types

The `datetime` module has a few classes. Here are the ones you will use most:

| Class | Holds | Example |
| --- | --- | --- |
| `date` | A calendar day | `2026-10-27` |
| `time` | A time of day | `07:30:00` |
| `datetime` | A day **and** a time | `2026-10-27 14:05:00` |
| `timedelta` | A length of time (a gap) | `7 days` |
| `timezone` | A fixed offset from UTC | `UTC` |

> **Note:** The module and one of its classes are both called `datetime`. That is why you usually write `from datetime import datetime`. After that line, `datetime` means the class, not the module.

## Getting today and now

```python
from datetime import date, datetime

print(date.today())
print(datetime.now())
```

Output (yours will show your own date and time):

```text
2026-10-27
2026-10-27 23:04:43.756607
```

`datetime.now()` includes microseconds (millionths of a second) at the end.

## Creating specific dates and times

You can build any date or time by passing numbers, biggest first: year, month, day, then hour, minute, second.

```python
from datetime import date, time, datetime

birthday = date(2000, 5, 17)
print(birthday)
print(birthday.year, birthday.month, birthday.day)
print(birthday.weekday())
print(birthday.strftime("%A"))

alarm = time(7, 30)
print(alarm)

launch = datetime(2026, 10, 27, 14, 5, 0)
print(launch)
print(launch.date(), launch.time())
```

Output:

```text
2000-05-17
2000 5 17
2
Wednesday
07:30:00
2026-10-27 14:05:00
2026-10-27 14:05:00
```

`weekday()` counts from Monday as `0`, so `2` means Wednesday. Python checks that the date is real. Asking for `date(2026, 2, 30)` raises an error, which you will see in Common mistakes.

## Formatting dates as text with strftime()

`strftime()` means "string format time". You give it a pattern made of **format codes**, each starting with `%`, and it fills them in.

```python
from datetime import datetime

moment = datetime(2026, 10, 27, 14, 5, 9)
print(moment.strftime("%d/%m/%Y"))
print(moment.strftime("%B %d, %Y at %I:%M %p"))
print(moment.strftime("%a %H:%M"))
print(f"{moment:%Y-%m-%d}")
print(moment.isoformat())
```

Output:

```text
27/10/2026
October 27, 2026 at 02:05 PM
Tue 14:05
2026-10-27
2026-10-27T14:05:09
```

The most useful codes:

| Code | Meaning | Example |
| --- | --- | --- |
| `%Y` | Year, 4 digits | `2026` |
| `%m` | Month, 2 digits | `10` |
| `%d` | Day, 2 digits | `27` |
| `%H` / `%I` | Hour (24 hour / 12 hour) | `14` / `02` |
| `%M` / `%S` | Minute / second | `05` / `09` |
| `%p` | AM or PM | `PM` |
| `%A` / `%a` | Weekday name, full / short | `Tuesday` / `Tue` |
| `%B` / `%b` | Month name, full / short | `October` / `Oct` |

As the fourth line shows, the same codes work inside [f-strings](/courses/python/f-strings) after a colon. The full list is in the [datetime docs](https://docs.python.org/3/library/datetime.html#format-codes).

> **Tip:** `isoformat()` gives the international standard format (`YYYY-MM-DD`). It sorts correctly as text and every system understands it, so use it when saving dates to files or [JSON](/courses/python/json-and-csv).

## Reading dates from text with strptime()

`strptime()` ("string parse time") does the opposite. It reads text and gives you a `datetime`. The pattern must match the text exactly.

```python
from datetime import datetime, date

text = "27/10/2026 14:05"
moment = datetime.strptime(text, "%d/%m/%Y %H:%M")
print(moment)
print(date.fromisoformat("2026-12-25"))
print(datetime.fromisoformat("2026-10-27T14:05:00"))
```

Output:

```text
2026-10-27 14:05:00
2026-12-25
2026-10-27 14:05:00
```

An easy way to remember: str**f**time **f**ormats, str**p**time **p**arses. For ISO text, `fromisoformat()` is simpler because you do not need a pattern.

## Date math with timedelta

A `timedelta` is a length of time. Add one to a date to move forward, subtract to move back. Subtracting two dates gives you a `timedelta`.

```python
from datetime import date, datetime, timedelta

today = date(2026, 10, 27)
print(today + timedelta(days=7))
print(today - timedelta(weeks=2))

christmas = date(2026, 12, 25)
gap = christmas - today
print(gap)
print(gap.days, "days to go")

start = datetime(2026, 10, 27, 9, 0)
end = datetime(2026, 10, 27, 17, 45)
worked = end - start
print(worked, worked.total_seconds() / 3600, "hours")
print(christmas > today)
```

Output:

```text
2026-11-03
2026-10-13
59 days, 0:00:00
59 days to go
8:45:00 8.75 hours
True
```

Python handles month lengths and leap years for you. Dates also compare with `<` and `>` just like numbers, so you can [sort](/courses/python/list-methods-and-slicing) a list of them.

`timedelta` has no `months` or `years` option, because months are not all the same length. For birthdays, compare the parts yourself:

```python
from datetime import date

def age(born, today):
    years = today.year - born.year
    if (today.month, today.day) < (born.month, born.day):
        years -= 1
    return years

print(age(date(2000, 5, 17), date(2026, 10, 27)))
print(age(date(2000, 12, 1), date(2026, 10, 27)))
```

Output:

```text
26
25
```

The comparison `(today.month, today.day) < (born.month, born.day)` uses [tuples](/courses/python/tuples-and-unpacking), which compare item by item.

## Time zones

The dates you made so far are **naive**: they have no time zone, so Python does not know if 15:00 is in London or Tokyo. A date with a time zone attached is **aware**.

**UTC** (Coordinated Universal Time) is the world's reference clock. The `zoneinfo` module (Python 3.9 and newer) knows real time zones by name, including daylight saving rules:

```python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

meeting = datetime(2026, 10, 27, 15, 0, tzinfo=ZoneInfo("Europe/London"))
print(meeting)
print(meeting.astimezone(ZoneInfo("Asia/Kolkata")))
print(meeting.astimezone(ZoneInfo("America/New_York")))
print(meeting.astimezone(timezone.utc))
```

Output:

```text
2026-10-27 15:00:00+00:00
2026-10-27 20:30:00+05:30
2026-10-27 11:00:00-04:00
2026-10-27 15:00:00+00:00
```

`astimezone()` shows the same moment on a different clock. The `+05:30` at the end is the offset from UTC.

> **Warning:** On Windows, Python does not ship the time zone database. Without it you get `ZoneInfoNotFoundError: 'No time zone found with key Europe/London'`. Fix it by installing the official `tzdata` package inside your [virtual environment](/courses/python/virtual-environments): `pip install tzdata` (see [Installing Packages with pip](/courses/python/pip-and-packages)).

A good habit for real apps: **store** times in UTC with `datetime.now(timezone.utc)`, and only convert to a local zone when you **show** them to a person.

## Measuring how long code takes

For timing code, use `time.perf_counter()` from the separate `time` module. It is a precise stopwatch:

```python
import time

start = time.perf_counter()
total = sum(range(10_000_000))
print(f"took {time.perf_counter() - start:.3f}s")
```

Output (depends on your computer):

```text
took 0.070s
```

## Common mistakes

**1. Pattern does not match the text.**

```text
ValueError: time data '2026-10-27' does not match format '%d/%m/%Y'
```

Fix: make the pattern match exactly (`"%Y-%m-%d"` here), or use `date.fromisoformat()`.

**2. Impossible dates.** `date(2026, 2, 30)` fails:

```text
ValueError: day 30 must be in range 1..28 for month 2 in year 2026
```

Fix: check user input with [try and except](/courses/python/exceptions).

**3. Adding a plain number to a date.** `date(2026, 10, 27) + 1` fails:

```text
TypeError: unsupported operand type(s) for +: 'datetime.date' and 'int'
```

Fix: add a `timedelta(days=1)`.

**4. Mixing naive and aware datetimes.** `datetime.now() - datetime.now(timezone.utc)` fails:

```text
TypeError: can't subtract offset-naive and offset-aware datetimes
```

Fix: make both aware (give both a time zone) or both naive.

## Quick recap

- Use `date` for days, `datetime` for days with times, and `timedelta` for gaps.
- `strftime()` turns dates into text; `strptime()` turns text into dates.
- Use `isoformat()` and `fromisoformat()` for saving and loading.
- Subtract dates to get a `timedelta`; add a `timedelta` to move a date.
- Use `zoneinfo.ZoneInfo` for real time zones; on Windows, `pip install tzdata`.
- Store in UTC, display in local time.

Next, you will learn to search and match text patterns in [Regular Expressions with re](/courses/python/regular-expressions).

<code id="code-content" class="language-python">
# main.py: a small "days until" helper using datetime
from datetime import date, datetime, timedelta, timezone
#
#
def parse_day(text: str) -&gt; date:
    """Turn '25/12/2026' into a date object."""
    return datetime.strptime(text, "%d/%m/%Y").date()
#
#
def days_until(target: date, today: date) -&gt; int:
    return (target - today).days
#
#
def age(born: date, today: date) -&gt; int:
    years = today.year - born.year
    # Not had a birthday yet this year? Take one off.
    if (today.month, today.day) &lt; (born.month, born.day):
        years -= 1
    return years
#
#
if __name__ == "__main__":
    today = date.today()
    print("Today is", today.strftime("%A %d %B %Y"))
    #
    christmas = date(today.year, 12, 25)
    if christmas &lt; today:  # already passed? use next year
        christmas = christmas.replace(year=today.year + 1)
    print("Days until Christmas:", days_until(christmas, today))
    #
    print("Age of someone born 17/05/2000:", age(parse_day("17/05/2000"), today))
    #
    deadline = today + timedelta(weeks=2)
    print("Two weeks from today:", deadline.isoformat())
    #
    # Store moments in UTC, show them in local time
    now_utc = datetime.now(timezone.utc)
    print("UTC now:", now_utc.strftime("%Y-%m-%d %H:%M %Z"))
    print("Local now:", now_utc.astimezone().strftime("%H:%M"))
</code></pre>

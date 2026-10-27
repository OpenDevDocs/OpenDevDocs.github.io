---
publishDate: 2026-10-27T08:45
title: 'Working with JSON and CSV Files'
slug: json-and-csv
metadescription: 'Save and load Python data with the json and csv modules: dumps and loads, pretty printing, csv.reader, DictReader, DictWriter and common pitfalls.'
updateDate: 2026-10-27T08:45
author: ['bishal-biswas']
level: 2
tags: ['python', 'files', 'json', 'csv']
course: python
---

## Why JSON and CSV?

In [Reading and Writing Files](/courses/python/reading-and-writing-files) you saved plain text. That is fine for notes, but what about a game save with a player name, a level, a list of items and a true or false flag? If you write it as plain text, you have to invent your own format and then write code to read it back. That is a lot of work and easy to break.

Two file formats solve this for you:

- **JSON** (JavaScript Object Notation) stores nested data: dictionaries inside lists inside dictionaries. It is the language that web APIs, config files and many apps speak.
- **CSV** (Comma Separated Values) stores a **table**: rows and columns, like a spreadsheet. Excel, Google Sheets and databases can all open and export it.

Python has a built-in module for each one, `json` and `csv`, so you do not need to install anything.

## JSON in one picture

JSON looks almost exactly like Python [dictionaries](/courses/python/dictionaries) and [lists](/courses/python/lists). Here is how the types line up:

| Python | JSON |
| --- | --- |
| `dict` | object `{ }` |
| `list`, `tuple` | array `[ ]` |
| `str` | string (always in double quotes) |
| `int`, `float` | number |
| `True` / `False` | `true` / `false` |
| `None` | `null` |

Turning Python data into JSON text is called **serializing** (or "dumping"). Turning JSON text back into Python data is called **deserializing** (or "loading").

## dumps and loads: JSON as a string

`json.dumps()` (dump to **s**tring) turns Python data into a JSON string. `json.loads()` (load from **s**tring) does the opposite:

```python
import json

player = {"name": "Mia", "level": 7, "alive": True, "items": ["sword", "map"], "pet": None}

text = json.dumps(player)
print(text)
print(type(text))

back = json.loads(text)
print(back["items"][0])
print(type(back))
```

Output:

```text
{"name": "Mia", "level": 7, "alive": true, "items": ["sword", "map"], "pet": null}
<class 'str'>
sword
<class 'dict'>
```

Notice how `True` became `true` and `None` became `null`. After loading, you have a normal Python dictionary again.

### Pretty printing

Add `indent=2` to make the JSON easy for humans to read:

```python
import json

player = {"name": "Mia", "level": 7, "items": ["sword", "map"]}
print(json.dumps(player, indent=2))
```

Output:

```text
{
  "name": "Mia",
  "level": 7,
  "items": [
    "sword",
    "map"
  ]
}
```

## dump and load: JSON files

Without the `s`, `json.dump()` writes straight into an open file, and `json.load()` reads straight from one. Here we save and reload app settings, using [pathlib](/courses/python/pathlib) and the [with statement](/courses/python/with-and-context-managers):

```python
import json
from pathlib import Path

settings = {"theme": "dark", "volume": 80, "language": "en"}
path = Path("settings.json")

with path.open("w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2)

with path.open(encoding="utf-8") as f:
    loaded = json.load(f)

print(loaded)
print(loaded["volume"] + 5)
print(path.read_text(encoding="utf-8"))
```

Output:

```text
{'theme': 'dark', 'volume': 80, 'language': 'en'}
85
{
  "theme": "dark",
  "volume": 80,
  "language": "en"
}
```

The number `80` comes back as a real `int`, so math works right away.

> **Tip:** An easy way to remember: the functions ending in `s` work with **s**trings. The ones without `s` work with files.

### Things that change on the way

JSON is simpler than Python, so a few things do not survive the round trip exactly:

```python
import json

data = {"point": (3, 4), "count": 2}
text = json.dumps(data)
print(text)
print(json.loads(text))

print(json.dumps({1: "one"}))
print(json.dumps({"city": "Kraków"}))
print(json.dumps({"city": "Kraków"}, ensure_ascii=False))
```

Output:

```text
{"point": [3, 4], "count": 2}
{'point': [3, 4], 'count': 2}
{"1": "one"}
{"city": "Kraków"}
{"city": "Kraków"}
```

- [Tuples](/courses/python/tuples-and-unpacking) come back as lists.
- Dictionary keys always become strings (`1` became `"1"`).
- Non English letters are escaped by default. `ensure_ascii=False` keeps them readable. Both versions load back to the same text.

## Reading CSV files

A CSV file is plain text. Each line is a row, and commas split the columns. The first row is usually a **header** with the column names:

```text
name,age,city
Ana,31,Lisbon
Ben,25,Leeds
Chen,40,"Taipei, Taiwan"
```

Look at the last row: the city contains a comma, so it is wrapped in quotes. This is why you should not just use `line.split(",")`. The `csv` module handles quotes for you.

`csv.reader` gives you each row as a list of strings:

```python
import csv
from pathlib import Path

Path("people.csv").write_text(
    'name,age,city\nAna,31,Lisbon\nBen,25,Leeds\nChen,40,"Taipei, Taiwan"\n',
    encoding="utf-8",
)

with open("people.csv", newline="", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)
    print(header)
    for row in reader:
        print(row)
```

Output:

```text
['name', 'age', 'city']
['Ana', '31', 'Lisbon']
['Ben', '25', 'Leeds']
['Chen', '40', 'Taipei, Taiwan']
```

`next(reader)` grabs the first row (the header) so the loop only sees the data rows.

> **Note:** Always open CSV files with `newline=""`. The `csv` module handles line endings itself, and without this option you can get blank rows between your data on Windows.

### DictReader: rows as dictionaries

Remembering that the city is `row[2]` is annoying. `csv.DictReader` uses the header row as keys, so each row becomes a dictionary:

```python
import csv
from pathlib import Path

Path("people.csv").write_text(
    'name,age,city\nAna,31,Lisbon\nBen,25,Leeds\nChen,40,"Taipei, Taiwan"\n',
    encoding="utf-8",
)

with open("people.csv", newline="", encoding="utf-8") as f:
    people = list(csv.DictReader(f))

print(people[0])
total_age = sum(int(p["age"]) for p in people)
print("Average age:", total_age / len(people))
```

Output:

```text
{'name': 'Ana', 'age': '31', 'city': 'Lisbon'}
Average age: 32.0
```

Notice `'31'` is a string. CSV has no types, so **every value is text**. We used `int()` to [convert](/courses/python/type-conversion) it before doing math.

## Writing CSV files

`csv.writer` takes lists. It adds quotes where needed, like around `Taipei, Taiwan`:

```python
import csv
from pathlib import Path

rows = [
    ["name", "age", "city"],
    ["Ana", 31, "Lisbon"],
    ["Ben", 25, "Leeds"],
    ["Chen", 40, "Taipei, Taiwan"],
]

path = Path("people.csv")
with path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerows(rows)

print(path.read_text(encoding="utf-8"))
```

Output:

```text
name,age,city
Ana,31,Lisbon
Ben,25,Leeds
Chen,40,"Taipei, Taiwan"

```

If your data is already a list of dictionaries, `csv.DictWriter` is the matching tool. You tell it the column order with `fieldnames`:

```python
import csv
from pathlib import Path

scores = [
    {"player": "Mia", "score": 120},
    {"player": "Leo", "score": 95},
]

with open("scores.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["player", "score"])
    writer.writeheader()
    writer.writerows(scores)

print(Path("scores.csv").read_text(encoding="utf-8"))
```

Output:

```text
player,score
Mia,120
Leo,95

```

## JSON or CSV?

| Use JSON when... | Use CSV when... |
| --- | --- |
| Data is nested (lists inside dicts) | Data is a flat table |
| You need types like numbers and booleans | People will open it in a spreadsheet |
| You talk to a web API | You export or import rows of records |

## Common mistakes

**1. Single quotes in JSON.** JSON only allows double quotes. Text that looks like a Python dict is not valid JSON:

```python
import json

json.loads("{'name': 'Mia'}")
```

```text
json.decoder.JSONDecodeError: Expecting property name enclosed in double quotes: line 1 column 2 (char 1)
```

Fix: use `'{"name": "Mia"}'`, or create the text with `json.dumps()` instead of by hand.

**2. Saving something JSON does not understand.** [Sets](/courses/python/sets), dates and your own objects cannot be dumped directly:

```python
import json

json.dumps({"tags": {"a", "b"}})
```

```text
TypeError: Object of type set is not JSON serializable
when serializing dict item 'tags'
```

Fix: convert first, for example `sorted(tags)` to turn the set into a list.

**3. Forgetting that CSV values are strings.**

```python
row = {"name": "Ana", "age": "31"}
print(row["age"] + 1)
```

```text
TypeError: can only concatenate str (not "int") to str
```

Fix: `int(row["age"]) + 1`.

**4. Blank lines between CSV rows on Windows.** You forgot `newline=""` in `open()`. Add it every time you use the `csv` module.

## Quick recap

- `json.dumps()` / `json.loads()` work with strings. `json.dump()` / `json.load()` work with files.
- `indent=2` makes JSON readable. `ensure_ascii=False` keeps accented letters as they are.
- JSON turns tuples into lists and dict keys into strings.
- `csv.reader` / `csv.writer` use lists. `csv.DictReader` / `csv.DictWriter` use dictionaries.
- Open CSV files with `newline=""` and `encoding="utf-8"`.
- Every CSV value is a string. Convert numbers yourself.

Files can be missing and JSON can be broken, so next you will learn to handle problems gracefully in [Handling Errors with try and except](/courses/python/exceptions).

<code id="code-content" class="language-python">
# main.py: save a high score table as JSON and export it as CSV
import csv
import json
from pathlib import Path
#
FOLDER = Path(__file__).parent
JSON_FILE = FOLDER / "scores.json"
CSV_FILE = FOLDER / "scores.csv"
#
def load_scores() -&gt; list:
    """Load scores from JSON, or start with an empty list."""
    if JSON_FILE.exists():
        with JSON_FILE.open(encoding="utf-8") as f:
            return json.load(f)
    return []
#
def save_scores(scores: list) -&gt; None:
    """Write the scores back to JSON with nice indentation."""
    with JSON_FILE.open("w", encoding="utf-8") as f:
        json.dump(scores, f, indent=2)
#
def export_csv(scores: list) -&gt; None:
    """Write the same data as a table that spreadsheets can open."""
    with CSV_FILE.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["player", "score"])
        writer.writeheader()
        writer.writerows(scores)
#
if __name__ == "__main__":
    scores = load_scores()
    scores.append({"player": "Mia", "score": 120})
    scores.append({"player": "Leo", "score": 95})
    # Highest score first
    scores.sort(key=lambda s: s["score"], reverse=True)
    save_scores(scores)
    export_csv(scores)
    print("Top player:", scores[0]["player"])
    # Read the CSV back: every value is a string
    with CSV_FILE.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            print(f"{row['player']:&lt;5} {int(row['score']):&gt;4}")
</code></pre>

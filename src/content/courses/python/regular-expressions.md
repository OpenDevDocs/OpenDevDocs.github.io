---
publishDate: 2026-10-27T09:00
title: 'Regular Expressions with re'
slug: regular-expressions
metadescription: 'A beginner friendly guide to regular expressions in Python: patterns, search, findall, groups, sub and split with the re module, plus common traps.'
updateDate: 2026-10-27T09:00
author: ['bishal-biswas']
level: 2
tags: ['python', 'regex', 'strings']
course: python
---

## What is a regular expression?

[String methods](/courses/python/string-methods) like `find()`, `replace()` and `split()` are great when you know the **exact** text you are looking for. But what if you want "any phone number", "every email address" or "all dates that look like 2026-10-27"? You do not know the exact text, only its **shape**.

A **regular expression** (often shortened to **regex**) is a small pattern that describes the shape of text. It is like a search with wildcards, but much more powerful. Python's built-in `re` module lets you use them.

Here is a taste. This pattern means "three digits, a dash, four digits":

```python
import re

text = "Call me at 555-1234 or 555-9876."
print(re.findall(r"\d{3}-\d{4}", text))
```

Output:

```text
['555-1234', '555-9876']
```

Do not worry if `\d{3}` looks strange. By the end of this lesson you will read it easily.

> **Tip:** Always write patterns as **raw strings** with an `r` in front, like `r"\d+"`. In a raw string, a backslash is just a backslash, which is exactly what the `re` module expects. You will see what goes wrong without it in Common mistakes.

## Searching: search, match and fullmatch

`re.search()` looks for the first place the pattern matches anywhere in the text. It returns a **match object**, or `None` if nothing matched.

```python
import re

match = re.search(r"\d+", "Order 66 shipped")
print(match)
print(match.group())
print(re.search(r"\d+", "No numbers here"))
print(re.match(r"\d+", "Order 66"))
print(re.fullmatch(r"\d{4}", "2026"))
```

Output:

```text
<re.Match object; span=(6, 8), match='66'>
66
None
None
<re.Match object; span=(0, 4), match='2026'>
```

| Function | Matches where? | Good for |
| --- | --- | --- |
| `re.search()` | Anywhere in the text | Finding something inside text |
| `re.match()` | Only at the very start | Checking how text begins |
| `re.fullmatch()` | The whole text, start to end | Validating input |
| `re.findall()` | Everywhere, returns a list of strings | Collecting all matches |
| `re.finditer()` | Everywhere, returns match objects one by one | Looping with details |

`span=(6, 8)` means the match starts at index 6 and ends before index 8, just like [slicing](/courses/python/list-methods-and-slicing).

## The building blocks of a pattern

Most letters and digits match themselves. Some characters have special meanings:

| Pattern | Matches | Example |
| --- | --- | --- |
| `.` | Any one character (except newline) | `c.t` matches `cat`, `c9t` |
| `\d` | Any digit 0 to 9 | `\d\d` matches `42` |
| `\w` | A "word" character: letter, digit or `_` | `\w+` matches `hello_1` |
| `\s` | Whitespace: space, tab, newline | `a\sb` matches `a b` |
| `[abc]` | One character from the set | `c[ao]t` matches `cat`, `cot` |
| `[^abc]` | One character **not** in the set | `[^0-9]` matches a non-digit |
| `[a-z]` | One character in a range | `[A-Z]` matches a capital letter |
| `^` and `$` | Start and end of the text | `^Hi` only matches at the start |
| `\b` | A word boundary (edge of a word) | `\bcat\b` will not match `concat` |

Capital versions mean the opposite: `\D` is a non-digit, `\W` a non-word character, `\S` a non-space.

### Quantifiers: how many?

A **quantifier** goes after a piece of the pattern and says how many times it may repeat:

| Quantifier | Meaning |
| --- | --- |
| `*` | 0 or more times |
| `+` | 1 or more times |
| `?` | 0 or 1 time (optional) |
| `{3}` | Exactly 3 times |
| `{2,4}` | Between 2 and 4 times |

Let us test a few patterns against some words:

```python
import re

samples = ["cat", "cot", "c9t", "ct", "coat"]
for s in samples:
    print(s, bool(re.fullmatch(r"c.t", s)), bool(re.fullmatch(r"c[ao]t", s)), bool(re.fullmatch(r"co*t", s)))
```

Output:

```text
cat True True False
cot True True True
c9t True False False
ct False False True
coat False False False
```

Read each column: `c.t` allows any middle character, `c[ao]t` only `a` or `o`, and `co*t` allows zero or more `o` letters (so even `ct` matches).

## Finding all matches

`re.findall()` returns a [list](/courses/python/lists) of every match:

```python
import re

text = "Ana: 31, Ben: 4, Cy: 120"
print(re.findall(r"\d+", text))
print(re.findall(r"\b\w+(?=:)", text))
print(re.findall(r"[A-Z]\w*", text))
print(re.findall(r"\d{2,3}", text))
```

Output:

```text
['31', '4', '120']
['Ana', 'Ben', 'Cy']
['Ana', 'Ben', 'Cy']
['31', '120']
```

The second pattern uses `(?=:)`, which means "followed by a colon, but do not include the colon". You will not need tricks like this often, but it is nice to know they exist.

## Groups: capturing parts of a match

Round brackets `( )` create a **group**. A group captures part of the match so you can pull it out on its own. You can also give groups names with `(?P<name>...)`.

```python
import re

pattern = r"(\d{4})-(\d{2})-(\d{2})"
m = re.search(pattern, "Released on 2026-10-27, patched later.")
print(m.group(0))
print(m.group(1), m.group(2), m.group(3))
print(m.groups())

m = re.search(r"(?P<user>[\w.]+)@(?P<domain>[\w.]+)", "Mail ada.l@example.com today")
print(m["user"], m["domain"])
print(m.groupdict())
print(re.findall(r"(\w+)=(\d+)", "x=1, y=22, z=333"))
```

Output:

```text
2026-10-27
2026 10 27
('2026', '10', '27')
ada.l example.com
{'user': 'ada.l', 'domain': 'example.com'}
[('x', '1'), ('y', '22'), ('z', '333')]
```

`group(0)` is the whole match; `group(1)` is the first bracket, and so on. When a pattern has groups, `findall()` returns [tuples](/courses/python/tuples-and-unpacking) of the groups instead of whole matches.

## Replacing and splitting

`re.sub()` replaces every match. In the replacement, `\1`, `\2` and so on refer to the groups. `re.split()` splits text wherever the pattern matches.

```python
import re

print(re.sub(r"\s+", " ", "too    many     spaces"))
print(re.sub(r"\d", "#", "Card 4111-1111"))
print(re.sub(r"(\d{4})-(\d{2})-(\d{2})", r"\3/\2/\1", "Due 2026-10-27"))
print(re.split(r"[,;]\s*", "apples, pears;plums ,  figs"))
print(re.split(r"\s*[,;]\s*", "apples, pears;plums ,  figs"))
```

Output:

```text
too many spaces
Card ####-####
Due 27/10/2026
['apples', 'pears', 'plums ', 'figs']
['apples', 'pears', 'plums', 'figs']
```

Plain `str.split()` can only split on one fixed separator. `re.split()` can split on "a comma or semicolon, with any spaces around it".

## Compiling patterns and flags

If you use the same pattern many times, **compile** it once with `re.compile()`. You get a pattern object with the same methods. Flags change how matching works; `re.IGNORECASE` ignores upper and lower case.

```python
import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

for address in ["ada@example.com", "bob@site", "eve.smith+news@mail.co.uk"]:
    print(address, bool(EMAIL.fullmatch(address)))

print(re.findall(r"python", "Python python PYTHON", flags=re.IGNORECASE))
```

Output:

```text
ada@example.com True
bob@site False
eve.smith+news@mail.co.uk True
['Python', 'python', 'PYTHON']
```

> **Note:** This email pattern is good enough for a quick check, but no short regex catches every valid email. For important input, send a confirmation email instead.

## Greedy vs lazy

Quantifiers are **greedy**: they grab as much text as they can. Add `?` after them to make them **lazy** (as little as possible).

```python
import re

html = "<b>bold</b> and <i>italic</i>"
print(re.findall(r"<.+>", html))
print(re.findall(r"<.+?>", html))
```

Output:

```text
['<b>bold</b> and <i>italic</i>']
['<b>', '</b>', '<i>', '</i>']
```

## Matching special characters

To match a character that has a special meaning, like `$`, `.`, `+` or `?`, put a backslash before it. `re.escape()` does that for you.

```python
import re
print(re.findall(r"\$\d+\.\d\d", "Total: $19.99, tax $1.50"))
print(re.findall(r"$\d+", "Total: $19.99"))
print(re.escape("1+1=2?"))
```

Output:

```text
['$19.99', '$1.50']
[]
1\+1=2\?
```

The second pattern found nothing because an unescaped `$` means "end of text".

## Common mistakes

**1. Forgetting the `r` prefix.** Without it, Python tries to read `\d` as a string escape first and warns you:

```text
SyntaxWarning: "\d" is an invalid escape sequence. Such sequences will not work in the future. Did you mean "\\d"? A raw string is also an option.
```

Fix: write `r"\d"`.

**2. Using a match without checking for None.**

```text
AttributeError: 'NoneType' object has no attribute 'group'
```

Fix: `if match:` before calling `match.group()`. You learned about `None` in [Booleans, Comparisons and None](/courses/python/booleans-and-none).

**3. Unbalanced brackets.** `re.search("(abc", text)` raises:

```text
re.PatternError: missing ), unterminated subpattern at position 0
```

Fix: close every `(` and `[`, or escape them as `\(` and `\[` if you mean the literal character.

**4. Using regex when a string method is enough.** `"@" in email` or `text.startswith("Hi")` is clearer and faster. Reach for regex when the shape varies.

## Quick recap

- A regex describes the **shape** of text; use the `re` module and raw strings `r"..."`.
- `search()` finds the first match, `fullmatch()` checks the whole string, `findall()` collects all.
- `\d`, `\w`, `\s`, `.` and `[...]` match characters; `*`, `+`, `?` and `{n}` say how many.
- Brackets create groups you can read with `group()` or by name.
- `sub()` replaces and `split()` splits by pattern.
- Always check that a match is not `None` before using it.

To go deeper, the [re module docs](https://docs.python.org/3/library/re.html) and the [Regular Expression HOWTO](https://docs.python.org/3/howto/regex.html) are excellent. Next, you will fetch live data from the internet in [Calling Web APIs with requests](/courses/python/calling-web-apis).

<code id="code-content" class="language-python">
# main.py: pull useful facts out of messy text with the re module
import re
#
NOTES = """
Meeting with ada.l@example.com on 2026-10-27, call 555-1234.
Ben (ben+work@mail.co.uk) moved it to 2026-11-03.   Backup: 555-9876
"""
#
# Compile patterns once, reuse them many times
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"\b\d{3}-\d{4}\b")
DATE = re.compile(r"(?P&lt;year&gt;\d{4})-(?P&lt;month&gt;\d{2})-(?P&lt;day&gt;\d{2})")
#
#
def is_valid_email(text: str) -&gt; bool:
    # fullmatch: the WHOLE string must match, not just part of it
    return EMAIL.fullmatch(text) is not None
#
#
def to_day_first(text: str) -&gt; str:
    # \3/\2/\1 puts the captured groups back in a new order
    return DATE.sub(r"\3/\2/\1", text)
#
#
if __name__ == "__main__":
    print("Emails:", EMAIL.findall(NOTES))
    print("Phones:", PHONE.findall(NOTES))
    for m in DATE.finditer(NOTES):
        print("Date found:", m["day"], m["month"], m["year"])
    #
    print(is_valid_email("ada@example.com"), is_valid_email("bob@site"))
    print(to_day_first("Due 2026-10-27"))
    # Squash runs of spaces into one, then split on commas or semicolons
    tidy = re.sub(r"\s+", " ", "apples,   pears ;plums").strip()
    print(re.split(r"\s*[,;]\s*", tidy))
    # Search without caring about upper or lower case
    match = re.search(r"meeting", NOTES, flags=re.IGNORECASE)
    if match:  # always check for None before using a match
        print("Found", repr(match.group()), "at", match.start())
</code></pre>

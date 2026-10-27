---
publishDate: 2026-10-27T08:30
title: 'Project: Contact Book'
slug: project-contact-book
metadescription: 'Build a menu-driven contact book in Python using a dictionary of dictionaries, a while loop and match, with add, list, search, edit and delete features.'
updateDate: 2026-10-27T08:30
author: ['bishal-biswas']
level: 1
tags: ['python', 'beginners', 'project', 'dictionaries']
course: python
---

## What you will build

In this project you will build a **contact book** that runs in the terminal. It shows a menu, and the user can:

1. Add a contact (name, phone and email)
2. List all contacts in alphabetical order
3. Search contacts by part of a name
4. Edit a contact's phone or email
5. Delete a contact
6. Quit

Here is a short sample of what it will look like when it runs:

```text
=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 1
Name: Ada Lovelace
Phone: 555-0101
Email: ada@example.com
Saved Ada Lovelace.
```

This project brings together most of what you have learned so far: [dictionaries](/courses/python/dictionaries), [lists](/courses/python/lists), [while loops](/courses/python/while-loops), [match and case](/courses/python/match-case), [string methods](/courses/python/string-methods) and [f-strings](/courses/python/f-strings). It is the perfect warm-up before you learn to split programs into functions.

## Step 1: choose how to store the data

Every program starts with a question: what shape should the data have?

Each contact has a name, a phone number and an email. We need to look contacts up **by name** quickly, so a dictionary is a natural fit. The key is the name, and the value is another small dictionary holding the details. This is called a **dictionary of dictionaries**:

```python
contacts = {
    "Ada Lovelace": {"phone": "555-0101", "email": "ada@example.com"},
    "Alan Turing": {"phone": "555-0199", "email": "alan@example.com"},
}

print(contacts["Ada Lovelace"]["phone"])
print(len(contacts), "contacts")
```

Output:

```text
555-0101
2 contacts
```

Why not a list of contacts? A list would work too, but to find "Alan Turing" you would have to loop through every item. With a dictionary, `contacts["Alan Turing"]` jumps straight to it, and the keys also stop you from saving the same name twice.

> **Tip:** Picking the right data structure first makes the rest of the code much simpler. It is worth a few minutes of thought before you type anything.

## Step 2: the menu loop

Most terminal programs have the same skeleton: a `while True` loop that shows a menu, reads a choice, does something, and repeats until the user quits with `break`. Using `match` (Python 3.10+) to handle the choice keeps it tidy:

```python
contacts = {}

while True:
    print("\n=== Contact Book ===")
    print("1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit")
    choice = input("Choose an option: ").strip()

    match choice:
        case "6":
            print("Goodbye!")
            break
        case _:
            print("Please type a number from 1 to 6.")
```

Output:

```text

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 7
Please type a number from 1 to 6.

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 6
Goodbye!
```

`case _:` catches anything that did not match, so a typo never crashes the program. The `"\n"` at the start of the title prints an empty line first, to space out the menu.

## Step 3: adding a contact

To add a contact, ask for the three details. Clean up the name with `strip()` (removes extra spaces) and `title()` (capitalizes each word), so `"  ada lovelace "` and `"Ada Lovelace"` end up as the same key.

Inside the loop, this becomes the `case "1":` branch:

```python
name = input("Name: ").strip().title()
if not name:
    print("A name is required.")
elif name in contacts:
    print(f"{name} already exists. Use Edit to change it.")
else:
    phone = input("Phone: ").strip()
    email = input("Email: ").strip().lower()
    contacts[name] = {"phone": phone, "email": email}
    print(f"Saved {name}.")
```

Notice the checks before saving:

- `if not name:` catches an empty name (an empty string counts as false).
- `name in contacts` checks the **keys**, so we never overwrite someone by accident.

## Step 4: listing contacts

Listing is a loop over the dictionary. Use `sorted()` on the keys to show names in alphabetical order, and [`enumerate()`](/courses/python/enumerate-zip-and-loop-helpers) to number them:

```python
if not contacts:
    print("Your contact book is empty.")
else:
    for number, name in enumerate(sorted(contacts), start=1):
        info = contacts[name]
        print(f"{number}. {name:<16} {info['phone']:<10} {info['email']}")
```

`{name:<16}` pads the name to 16 characters, so the columns line up neatly. You saw this alignment trick in [f-strings and String Formatting](/courses/python/f-strings).

## Step 5: searching

Users rarely remember a full name. A friendly search finds every contact whose name **contains** the text, ignoring upper and lower case. A [list comprehension](/courses/python/comprehensions) does this in one line:

```python
contacts = {
    "Ada Lovelace": {"phone": "555-0101", "email": "ada@example.com"},
    "Alan Turing": {"phone": "555-0199", "email": "alan@example.com"},
    "Grace Hopper": {"phone": "555-0142", "email": "grace@example.com"},
}

term = "a"
matches = [name for name in sorted(contacts) if term.lower() in name.lower()]
print(matches)

term = "TUR"
matches = [name for name in sorted(contacts) if term.lower() in name.lower()]
print(matches)
```

Output:

```text
['Ada Lovelace', 'Alan Turing', 'Grace Hopper']
['Alan Turing']
```

Lowering **both** sides is the key trick: it makes `"TUR"` match `"Turing"`.

## Step 6: editing a contact

Editing should let the user keep an old value by just pressing Enter. The `or` operator from [Logical Operators](/courses/python/logical-operators) makes this short: an empty string is false, so `new_phone or info["phone"]` falls back to the old value.

```python
name = input("Name to edit: ").strip().title()
if name not in contacts:
    print(f"No contact named {name}.")
else:
    info = contacts[name]
    new_phone = input(f"Phone [{info['phone']}]: ").strip()
    new_email = input(f"Email [{info['email']}]: ").strip().lower()
    info["phone"] = new_phone or info["phone"]
    info["email"] = new_email or info["email"]
    print(f"Updated {name}.")
```

Here `info` and `contacts[name]` are two names for the **same** inner dictionary, so changing `info` changes the contact book directly. That is the sharing behavior from [Mutable vs Immutable: Copying Data Safely](/courses/python/mutability-and-copying), and here it is exactly what we want.

## Step 7: deleting a contact

Deleting is risky, so ask for confirmation first. `pop()` removes the entry:

```python
name = input("Name to delete: ").strip().title()
if name not in contacts:
    print(f"No contact named {name}.")
elif input(f"Really delete {name}? (y/n): ").strip().lower() == "y":
    contacts.pop(name)
    print(f"Deleted {name}.")
else:
    print("Nothing deleted.")
```

## The complete program

Here is everything put together. Each step above became one `case` in the `match` block. Save it as `contact_book.py` and run it with `python contact_book.py` (Windows) or `python3 contact_book.py` (macOS and Linux).

```python
contacts = {}

while True:
    print("\n=== Contact Book ===")
    print("1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit")
    choice = input("Choose an option: ").strip()

    match choice:
        case "1":
            name = input("Name: ").strip().title()
            if not name:
                print("A name is required.")
            elif name in contacts:
                print(f"{name} already exists. Use Edit to change it.")
            else:
                phone = input("Phone: ").strip()
                email = input("Email: ").strip().lower()
                contacts[name] = {"phone": phone, "email": email}
                print(f"Saved {name}.")
        case "2":
            if not contacts:
                print("Your contact book is empty.")
            for number, name in enumerate(sorted(contacts), start=1):
                info = contacts[name]
                print(f"{number}. {name:<16} {info['phone']:<10} {info['email']}")
        case "3":
            term = input("Search for: ").strip().lower()
            matches = [n for n in sorted(contacts) if term in n.lower()]
            if matches:
                for n in matches:
                    print(f"- {n}: {contacts[n]['phone']}")
            else:
                print("No matches.")
        case "4":
            name = input("Name to edit: ").strip().title()
            if name not in contacts:
                print(f"No contact named {name}.")
            else:
                info = contacts[name]
                new_phone = input(f"Phone [{info['phone']}]: ").strip()
                new_email = input(f"Email [{info['email']}]: ").strip().lower()
                info["phone"] = new_phone or info["phone"]
                info["email"] = new_email or info["email"]
                print(f"Updated {name}.")
        case "5":
            name = input("Name to delete: ").strip().title()
            if name not in contacts:
                print(f"No contact named {name}.")
            elif input(f"Really delete {name}? (y/n): ").strip().lower() == "y":
                contacts.pop(name)
                print(f"Deleted {name}.")
            else:
                print("Nothing deleted.")
        case "6":
            print(f"Goodbye! You have {len(contacts)} contact(s).")
            break
        case _:
            print("Please type a number from 1 to 6.")
```

Output:

```text

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 1
Name:   ada lovelace 
Phone: 555-0101
Email: ADA@Example.com
Saved Ada Lovelace.

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 1
Name: Alan Turing
Phone: 555-0199
Email: alan@example.com
Saved Alan Turing.

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 1
Name: ADA LOVELACE
Ada Lovelace already exists. Use Edit to change it.

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 2
1. Ada Lovelace     555-0101   ada@example.com
2. Alan Turing      555-0199   alan@example.com

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 3
Search for: lace
- Ada Lovelace: 555-0101

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 4
Name to edit: Alan Turing
Phone [555-0199]: 
Email [alan@example.com]: turing@example.com
Updated Alan Turing.

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 5
Name to delete: Ada Lovelace
Really delete Ada Lovelace? (y/n): y
Deleted Ada Lovelace.

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 2
1. Alan Turing      555-0199   turing@example.com

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: x
Please type a number from 1 to 6.

=== Contact Book ===
1) Add  2) List  3) Search  4) Edit  5) Delete  6) Quit
Choose an option: 6
Goodbye! You have 1 contact(s).
```

That was a full test run. The text after each prompt is what the user typed. Notice how `"  ada lovelace "` was saved as `Ada Lovelace`, and how adding `ADA LOVELACE` again was caught as a duplicate.

## Testing your program

Try these on purpose to make sure your program does not crash:

| Test | Expected result |
|---|---|
| Press Enter at "Name:" | "A name is required." |
| Add the same name twice (any capitalization) | "already exists" message |
| Search for a single letter | Every name containing that letter |
| Edit and press Enter for both fields | Old values are kept |
| Type `9` or `hello` at the menu | "Please type a number from 1 to 6." |
| Answer `n` when deleting | "Nothing deleted." |

> **Note:** The contacts are lost when the program ends, because they only live in memory. In [Working with JSON and CSV Files](/courses/python/json-and-csv) you will learn to save them to a file.

## Ideas to extend it

- Add a "birthday" field and a menu option that lists contacts with birthdays this month.
- Warn when an email does not contain `"@"`.
- Let the search also look inside phone numbers and emails.
- Count contacts per email domain (like `example.com`) using a dictionary, as in the counting pattern from the [dictionaries lesson](/courses/python/dictionaries).

## Quick recap

- A dictionary of dictionaries is a simple, fast way to store records by name.
- `while True` plus `break` makes a menu that repeats until the user quits.
- `match` and `case` (Python 3.10+) keep the menu choices readable, and `case _` catches bad input.
- Clean input with `strip()`, `title()` and `lower()` so keys stay consistent.
- `new_value or old_value` keeps the old value when the user presses Enter.
- Changing a shared inner dictionary updates the contact book directly.

The program works, but the `match` block is getting long. In [Defining and Calling Functions](/courses/python/functions) you will learn how to break code like this into small, named pieces.

<code id="code-content" class="language-python">
# main.py: a compact contact book (dictionary of dictionaries)
contacts = {}
#
while True:
    print("\n1) Add  2) List  3) Search  4) Delete  5) Quit")
    choice = input("Choose: ").strip()
    match choice:
        case "1":
            # Clean the name so " ada " and "Ada" are the same key
            name = input("Name: ").strip().title()
            if not name or name in contacts:
                print("Name is empty or already saved.")
                continue
            phone = input("Phone: ").strip()
            contacts[name] = {"phone": phone}
            print(f"Saved {name}.")
        case "2":
            # sorted() gives alphabetical order, enumerate() numbers the rows
            for number, name in enumerate(sorted(contacts), start=1):
                print(f"{number}. {name:&lt;14} {contacts[name]['phone']}")
            if not contacts:
                print("No contacts yet.")
        case "3":
            # Case-insensitive "contains" search with a list comprehension
            term = input("Search: ").strip().lower()
            found = [n for n in sorted(contacts) if term in n.lower()]
            print(", ".join(found) if found else "No matches.")
        case "4":
            name = input("Delete who? ").strip().title()
            # pop() with a default never raises KeyError
            removed = contacts.pop(name, None)
            print(f"Deleted {name}." if removed else "Not found.")
        case "5":
            print(f"Goodbye! {len(contacts)} contact(s) saved in memory.")
            break
        case _:
            print("Please choose 1 to 5.")
</code></pre>

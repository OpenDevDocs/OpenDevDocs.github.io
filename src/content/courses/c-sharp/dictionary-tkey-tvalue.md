---
publishDate: 2026-04-12T11:21
title: Dictionary<TKey, TValue>
slug: dictionary-tkey-tvalue
metadescription: Store and look up values by key with Dictionary, handle missing keys safely with TryGetValue, iterate pairs, count occurrences and understand hashing.
updateDate: 2026-09-05T11:21
author: ['bishal-biswas']
level: 2
tags: ['collections', 'dictionary', 'generics']
course: c-sharp
---

## Lookups by key

A list is great when you want items in order. It is slow when you want to find "the phone number for Asha", because you have to scan every entry. A **dictionary** stores pairs of **key** and **value** and finds a value by its key almost instantly.

```csharp
var phones = new Dictionary<string, string>();
phones["Asha"] = "555-1234";
phones["Ravi"] = "555-9876";

Console.WriteLine(phones["Asha"]);   // 555-1234
```

`Dictionary<string, string>` means keys are strings and values are strings. Keys can be any type, and so can values.

### Shorter creation

```csharp
var ages = new Dictionary<string, int>
{
    ["Asha"] = 30,
    ["Ravi"] = 25
};

var codes = new Dictionary<int, string>
{
    { 200, "OK" },
    { 404, "Not Found" }
};
```

## Adding and updating

```csharp
var stock = new Dictionary<string, int>();

stock.Add("apple", 5);   // throws if "apple" already exists
stock["apple"] = 7;      // adds or overwrites, never throws
stock["pear"] = 2;

Console.WriteLine(stock.Count);   // 2
```

Use the indexer form unless you specifically want an exception on duplicates.

## Reading safely

Reading a key that does not exist throws `KeyNotFoundException`. Check first, or use `TryGetValue`:

```csharp
if (stock.ContainsKey("mango"))
{
    Console.WriteLine(stock["mango"]);
}

if (stock.TryGetValue("apple", out int count))
{
    Console.WriteLine($"apples: {count}");   // apples: 7
}
else
{
    Console.WriteLine("no apples");
}

int pears = stock.GetValueOrDefault("pear");     // 2
int mangos = stock.GetValueOrDefault("mango");   // 0, the default for int
```

`TryGetValue` does one lookup instead of two, so it is both safer and faster than `ContainsKey` followed by the indexer.

## Removing

```csharp
stock.Remove("pear");            // returns true if it was there
bool gone = stock.Remove("x");   // false, no exception
stock.Clear();
```

## Iterating

Each entry is a `KeyValuePair<TKey, TValue>`. Deconstruct it in the loop:

```csharp
var ages = new Dictionary<string, int> { ["Asha"] = 30, ["Ravi"] = 25 };

foreach (var (name, age) in ages)
{
    Console.WriteLine($"{name} is {age}");
}

foreach (string key in ages.Keys) Console.WriteLine(key);
foreach (int value in ages.Values) Console.WriteLine(value);
```

A dictionary keeps insertion order in practice on modern .NET, but that is not guaranteed by the contract. If order matters, sort the keys or use `SortedDictionary`.

## Counting occurrences

The classic dictionary task:

```csharp
string text = "the cat and the hat and the bat";
var counts = new Dictionary<string, int>();

foreach (string word in text.Split(' '))
{
    counts[word] = counts.GetValueOrDefault(word) + 1;
}

foreach (var (word, n) in counts)
{
    Console.WriteLine($"{word}: {n}");
}
// the: 3, cat: 1, and: 2, hat: 1, bat: 1
```

## Grouping into lists

Values can be collections:

```csharp
var byFirstLetter = new Dictionary<char, List<string>>();

foreach (string name in new[] { "Asha", "Arjun", "Ravi", "Meera" })
{
    char key = name[0];
    if (!byFirstLetter.ContainsKey(key))
    {
        byFirstLetter[key] = new List<string>();
    }
    byFirstLetter[key].Add(name);
}

Console.WriteLine(string.Join(", ", byFirstLetter['A']));   // Asha, Arjun
```

## Objects as values

```csharp
class Product
{
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}

var catalogue = new Dictionary<string, Product>
{
    ["A1"] = new() { Name = "Keyboard", Price = 49.99m },
    ["B2"] = new() { Name = "Mouse", Price = 19.99m }
};

Console.WriteLine(catalogue["A1"].Name);   // Keyboard
```

## How it works: hashing

A dictionary calls `GetHashCode()` on the key to decide which bucket to look in, then `Equals()` to confirm the match. That is why lookups are fast regardless of size. Two rules follow:

- Keys must not change while they are in the dictionary. A mutated key hashes to the wrong bucket.
- If you use your own class as a key, override `Equals` and `GetHashCode`, or use a `record`, which does it for you.

Strings, numbers, enums and records all make good keys.

## Case insensitive keys

```csharp
var settings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
settings["Theme"] = "dark";
Console.WriteLine(settings["theme"]);   // dark
```

## Quick recap

- A dictionary maps unique keys to values and looks them up quickly.
- `dict[key] = value` adds or overwrites, `Add` throws on duplicates.
- Use `TryGetValue` or `GetValueOrDefault` instead of reading a key that might be missing.
- `foreach (var (key, value) in dict)` iterates pairs.
- Counting and grouping are the two classic dictionary jobs.
- Keys are hashed, so they must be stable and implement equality properly.

<code id="code-content" class="language-csharp">
// Dictionary&lt;TKey, TValue&gt; in C#
// Create, add, update
var stock = new Dictionary&lt;string, int&gt;
{
    ["apple"] = 5,
    ["pear"] = 2
};
stock["apple"] = 7;                 // overwrite
stock["mango"] = 1;                 // add
Console.WriteLine(stock.Count);     // 3
// Safe reads
if (stock.TryGetValue("apple", out int apples))
    Console.WriteLine($"apples: {apples}");          // apples: 7
Console.WriteLine(stock.GetValueOrDefault("kiwi"));  // 0
Console.WriteLine(stock.ContainsKey("pear"));        // True
// Remove
stock.Remove("mango");
// Iterate pairs
foreach (var (fruit, qty) in stock)
{
    Console.WriteLine($"{fruit} x{qty}");
}
// Count words
string text = "the cat and the hat and the bat";
var counts = new Dictionary&lt;string, int&gt;();
foreach (string word in text.Split(' '))
{
    counts[word] = counts.GetValueOrDefault(word) + 1;
}
Console.WriteLine($"the: {counts["the"]}, and: {counts["and"]}");   // the: 3, and: 2
// Group names by first letter
var groups = new Dictionary&lt;char, List&lt;string&gt;&gt;();
foreach (string name in new[] { "Asha", "Arjun", "Ravi", "Meera" })
{
    if (!groups.TryGetValue(name[0], out var list))
    {
        list = new List&lt;string&gt;();
        groups[name[0]] = list;
    }
    list.Add(name);
}
Console.WriteLine(string.Join(", ", groups['A']));   // Asha, Arjun
// Case insensitive keys
var settings = new Dictionary&lt;string, string&gt;(StringComparer.OrdinalIgnoreCase);
settings["Theme"] = "dark";
Console.WriteLine(settings["THEME"]);                // dark
</code></pre>

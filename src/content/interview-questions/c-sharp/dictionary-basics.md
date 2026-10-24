---
course: c-sharp
slug: dictionary-basics
experienceLevel: fresher
difficulty: easy
tags:
  - collections
question: "What is a `Dictionary<TKey, TValue>`, and when should you use it?"
answer: |
  A `Dictionary<TKey, TValue>` stores **key-value pairs** with unique keys and finds a value by its key very quickly, in O(1) time on average. Use it whenever you look things up by an identifier: products by SKU, users by ID, or counts per word.

  Behaviors worth knowing:

  - `Add` throws `ArgumentException` if the key already exists, while the indexer `dict[key] = value` adds or overwrites silently.
  - Reading `dict[key]` for a missing key throws `KeyNotFoundException`. Use `TryGetValue` to check and read in one step.
  - Keys can't be `null`, and a key object must not change in a way that affects its equality while it's in the dictionary.
  - Don't rely on iteration order; it isn't guaranteed.

  For case-insensitive string keys, pass a comparer: `new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)`.
codeExample: |
  var stock = new Dictionary<string, int>
  {
      ["apple"] = 10,
      ["banana"] = 5
  };

  stock["cherry"] = 7;             // adds a new key
  stock["apple"] = 12;             // overwrites the existing value
  // stock.Add("apple", 1);        // throws ArgumentException: duplicate key

  if (stock.TryGetValue("banana", out int count))
      Console.WriteLine(count);    // Output: 5

  // int x = stock["mango"];       // throws KeyNotFoundException

  foreach (var (fruit, qty) in stock)
      Console.WriteLine($"{fruit}: {qty}");

  Console.WriteLine(stock.ContainsKey("cherry")); // Output: True
popularity: 7.8
isPublished: true
---

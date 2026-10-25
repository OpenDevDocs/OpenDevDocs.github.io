---
course: c-sharp
slug: dictionary-internals
experienceLevel: mid
difficulty: hard
tags:
  - collections
  - performance
question: "How does `Dictionary<TKey, TValue>` work internally, and why are lookups O(1) on average?"
answer: |
  `Dictionary<TKey, TValue>` is a **hash table** built on two arrays: `buckets` and `entries`. Each entry stores the key, the value, the key's cached hash code, and the index of the next entry in the same chain.

  A lookup works like this:

  1. The comparer computes `GetHashCode(key)`, and the hash is mapped to a bucket, essentially the hash modulo the table size, which is a prime number.
  2. The bucket points to the first entry of a chain. The dictionary walks that chain, calling `Equals` on entries whose stored hash matches.

  With a good hash function, chains stay very short, so a lookup costs one hash plus one or two comparisons regardless of size: O(1) on average. If many keys collide, chains grow and lookups degrade toward O(n).

  When the entries array is full, the dictionary **resizes** to a prime roughly twice as large and rehashes everything. That O(n) step keeps `Add` amortized O(1). Pass an initial capacity when you know the size.

  Never mutate a key in a way that changes its hash after inserting it.
codeExample: |
  var prices = new Dictionary<string, decimal>(capacity: 1_000,
      StringComparer.OrdinalIgnoreCase);     // presize + custom equality

  prices["Apple"] = 1.20m;
  Console.WriteLine(prices["APPLE"]);        // Output: 1.20 (case-insensitive)

  // A mutable key breaks lookups once its hash changes
  var key = new MutableKey { Id = 1 };
  var map = new Dictionary<MutableKey, string> { [key] = "stored" };
  key.Id = 2;                                // hash changes: the entry is now "lost"
  Console.WriteLine(map.ContainsKey(key));   // Output: False
  Console.WriteLine(map.Count);              // Output: 1 (it's still in there!)

  class MutableKey
  {
      public int Id { get; set; }
      public override bool Equals(object? o) => o is MutableKey k && k.Id == Id;
      public override int GetHashCode() => Id;   // based on a mutable field: bad idea
  }
popularity: 8.2
isPublished: true
---

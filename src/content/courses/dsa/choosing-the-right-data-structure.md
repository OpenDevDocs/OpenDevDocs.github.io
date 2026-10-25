---
publishDate: 2026-07-31T19:30
title: Choosing the Right Data Structure
slug: choosing-the-right-data-structure
metadescription: A decision guide for picking the structure that fits your access pattern, with the refactors that fix most slow code.
updateDate: 2026-09-07T19:30
author: ['bishal-biswas']
level: 2
tags: ['data structures', 'decision guide', 'practical']
course: dsa
---

## The question that decides it

Not "what am I storing" but **"what will I do with it most often?"**

Every structure makes some operations cheap by making others expensive. Match the cheap ones to what you actually do.

## The decision guide

**Do you look things up by a key?**
Use a `Dictionary<TKey, TValue>`. `O(1)`, and it is the answer far more often than people expect.

**Do you only need to know whether you have seen something?**
Use a `HashSet<T>`. `O(1)`, and `Add` tells you whether it was new.

**Do you need items in the order you added them, with access by position?**
Use a `List<T>`.

**Do you need the most recently added item first?**
Use a `Stack<T>`.

**Do you need the earliest added item first?**
Use a `Queue<T>`.

**Do you need the smallest or largest item next, repeatedly?**
Use a `PriorityQueue<TElement, TPriority>`.

**Do you need everything kept in sorted order, or range queries?**
Use a `SortedDictionary<TKey, TValue>` or `SortedSet<T>`. `O(log n)`, and worth it for the ordering.

**Do you insert and remove in the middle constantly, holding the node?**
Use a `LinkedList<T>`.

**Are you working with prefixes of strings?**
Use a trie.

**Is the size fixed and known, and does memory matter?**
Use an array.

## The cost table

```text
                    Lookup     Insert      Delete      Ordered   Memory
Array               O(1) index O(n)        O(n)        no        lowest
List<T>             O(1) index O(1) end    O(n) middle insertion  low
                    O(n) value
LinkedList<T>       O(n)       O(1) node   O(1) node   insertion  high
Dictionary          O(1)       O(1)        O(1)        no        medium
HashSet             O(1)       O(1)        O(1)        no        medium
SortedDictionary    O(log n)   O(log n)    O(log n)    by key    medium
SortedSet           O(log n)   O(log n)    O(log n)    sorted    medium
Stack               O(1) top   O(1)        O(1)        LIFO      low
Queue               O(1) front O(1)        O(1)        FIFO      low
PriorityQueue       O(1) peek  O(log n)    O(log n)    by priority medium
Trie                O(m)       O(m)        O(m)        sorted    high
```

## The refactors that matter

Four changes fix the majority of slow code.

### Searching inside a loop

The single most valuable refactor there is.

```csharp
// Slow: O(n * m)
foreach (var order in orders)
{
    var customer = customers.First(c => c.Id == order.CustomerId);
}

// Fast: O(n + m)
var byId = customers.ToDictionary(c => c.Id);

foreach (var order in orders)
{
    if (byId.TryGetValue(order.CustomerId, out var customer))
    {
        // ...
    }
}
```

With 10,000 of each, 100 million comparisons become 20,000 operations.

### Contains on a list

```csharp
// Slow: every Contains scans the whole list
var banned = new List<int> { 4, 8, 15, 16, 23, 42 };

foreach (var user in users)
{
    if (banned.Contains(user.Id)) continue;
}

// Fast: one line changed
var banned = new HashSet<int> { 4, 8, 15, 16, 23, 42 };
```

One word, and a nested loop disappears.

### Removing from the front of a list

```csharp
// Slow: RemoveAt(0) shifts everything, so this is O(n^2)
while (items.Count > 0)
{
    var next = items[0];
    items.RemoveAt(0);
}

// Fast: a queue never shifts anything
var queue = new Queue<Item>(items);

while (queue.TryDequeue(out var next))
{
    // ...
}
```

### Sorting for the top few

```csharp
// Slow: O(n log n) to get 10 items
var top10 = allRecords.OrderByDescending(r => r.Score).Take(10).ToList();

// Fast: O(n log 10), and only 10 items in memory
var heap = new PriorityQueue<Record, int>();

foreach (var record in allRecords)
{
    heap.Enqueue(record, record.Score);
    if (heap.Count > 10) heap.Dequeue();
}
```

The memory difference matters more than the speed. The heap version works on a stream.

## Combining structures

Often no single structure fits, and two together do.

**Dictionary plus doubly linked list** gives an LRU cache with `O(1)` everything. The dictionary finds the node, the list reorders it.

**Dictionary plus heap** gives Dijkstra's algorithm.

**Dictionary plus list** gives insert, delete and random selection all in `O(1)`.

```csharp
public class RandomAccessSet<T> where T : notnull
{
    private readonly List<T> items = new();
    private readonly Dictionary<T, int> positions = new();
    private readonly Random random = new();

    public bool Add(T item)
    {
        if (positions.ContainsKey(item)) return false;

        positions[item] = items.Count;
        items.Add(item);
        return true;
    }

    public bool Remove(T item)
    {
        if (!positions.TryGetValue(item, out int index)) return false;

        T last = items[^1];

        items[index] = last;             // move the last item into the gap
        positions[last] = index;

        items.RemoveAt(items.Count - 1); // now removing from the end is O(1)
        positions.Remove(item);

        return true;
    }

    public T GetRandom() => items[random.Next(items.Count)];
}
```

Moving the last item into the gap is the trick. It avoids the `O(n)` shift that `RemoveAt` in the middle would cause, at the cost of not preserving order.

**Two heaps facing opposite directions** gives a running median.

**Trie plus heap** gives autocomplete ranked by popularity.

The lesson: when nothing fits, combine two things that each solve half the problem.

## Small collections change everything

For fewer than about 20 items, all of this is theory. A linear scan over a small array beats a dictionary, because there is no hashing and everything sits in cache.

```csharp
// For 5 items, this is faster than a Dictionary
var settings = new (string Key, string Value)[]
{
    ("theme", "dark"),
    ("language", "en")
};

string Find(string key)
{
    foreach (var (k, v) in settings)
    {
        if (k == key) return v;
    }

    return "";
}
```

Do not over engineer small collections. Big O describes behaviour as `n` grows, and at `n = 5` the constants decide.

## What to actually measure

Before optimising, check what you are doing.

**Read heavy and rarely changed?** Sort once, then binary search. Or build a dictionary once.

**Constantly changing?** Hash based structures. Avoid anything needing a rebuild.

**Order matters?** Sorted collections, or sort at the point of use.

**Memory constrained?** Arrays and bitmasks. Avoid linked structures, since a node has real overhead.

**Streaming, larger than memory?** Heaps for top K, and single pass algorithms.

## The most common mistakes

**Using a `List` where a `HashSet` belongs.** If you call `Contains` on it, you probably want a set.

**Using a `Dictionary` where a `List` belongs.** If the keys are `0, 1, 2, 3`, use an array.

**Using a `SortedDictionary` when order does not matter.** You are paying `O(log n)` for nothing.

**Building a lookup inside a loop.** Build it once, outside.

```csharp
// Wrong: rebuilds the dictionary every iteration
foreach (var order in orders)
{
    var byId = customers.ToDictionary(c => c.Id);   // move this out
}
```

**Not preallocating when the size is known.**

```csharp
var list = new List<int>(expectedCount);
var dictionary = new Dictionary<string, int>(expectedCount);
```

**Reaching for a linked list.** It is almost never the right answer. `List<T>` wins in practice because of cache behaviour, even where the Big O suggests otherwise.

## The quick version

Start with these three, and you will be right most of the time.

- **`List<T>`** for a sequence.
- **`Dictionary<TKey, TValue>`** for lookup by key.
- **`HashSet<T>`** for membership.

Then reach for something else when a specific need appears: order, priority, prefixes, both ends, or a strict memory budget.

## Quick recap

- Pick based on what you do most, not on what you store.
- A search inside a loop is the most valuable thing to refactor.
- `List.Contains` becomes `HashSet.Contains` by changing one word.
- Use a `Queue` rather than removing from the front of a list.
- Use a heap rather than sorting when you only need the top few.
- Combine two structures when neither alone fits.
- Below about 20 items, use whatever is clearest.

<code id="code-content" class="language-csharp">
// The question is not what you store, it is what you DO most often.
//   lookup by key      -&gt; Dictionary        O(1)
//   have I seen this   -&gt; HashSet           O(1)
//   ordered sequence   -&gt; List              O(1) by index
//   most recent first  -&gt; Stack             O(1)
//   earliest first     -&gt; Queue             O(1)
//   smallest next      -&gt; PriorityQueue     O(log n)
//   always sorted      -&gt; SortedSet/Dict    O(log n)
//   prefixes           -&gt; Trie              O(m)
// Refactor 1: a search inside a loop. The most valuable one there is.
var customers = new[] { new { Id = 1, Name = "Asha" }, new { Id = 2, Name = "Ravi" } };
var orders = new[] { new { CustomerId = 2 }, new { CustomerId = 1 } };
var byId = customers.ToDictionary(c =&gt; c.Id);          // build ONCE, outside the loop
foreach (var order in orders)
    if (byId.TryGetValue(order.CustomerId, out var c)) Console.WriteLine(c.Name);
// Refactor 2: List.Contains becomes HashSet.Contains. One word.
var banned = new HashSet&lt;int&gt; { 4, 8, 15, 16, 23, 42 };
// Refactor 3: never RemoveAt(0) in a loop, that is O(n^2). Use a Queue.
var queue = new Queue&lt;int&gt;(new[] { 1, 2, 3 });
while (queue.TryDequeue(out int next)) Console.Write(next + " ");
Console.WriteLine();
// Refactor 4: a heap beats sorting when you only need the top few
var heap = new PriorityQueue&lt;int, int&gt;();
foreach (int score in new[] { 5, 1, 9, 3, 7 })
{
    heap.Enqueue(score, score);
    if (heap.Count &gt; 3) heap.Dequeue();                // only 3 items ever in memory
}
// Combine structures when neither alone fits: O(1) add, remove AND random pick
var items = new List&lt;string&gt;();
var positions = new Dictionary&lt;string, int&gt;();
void Add(string item)
{
    if (positions.ContainsKey(item)) return;
    positions[item] = items.Count;
    items.Add(item);
}
void Remove(string item)
{
    if (!positions.TryGetValue(item, out int index)) return;
    string last = items[^1];
    items[index] = last;                               // move the last into the gap
    positions[last] = index;
    items.RemoveAt(items.Count - 1);                   // removing the end is O(1)
    positions.Remove(item);
}
Add("a"); Add("b"); Add("c"); Remove("a");
Console.WriteLine(string.Join(",", items));            // c,b
// Below about 20 items none of this matters. Use whatever is clearest.
// Know the size? Preallocate: new List&lt;int&gt;(count), new Dictionary&lt;string,int&gt;(count)
</code></pre>

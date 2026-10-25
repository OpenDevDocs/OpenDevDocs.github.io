---
course: c-sharp
slug: choosing-the-right-collection
experienceLevel: mid
difficulty: medium
tags:
  - collections
question: "How do you choose between `List<T>`, `Dictionary<TKey, TValue>`, `HashSet<T>`, `Queue<T>`, `Stack<T>`, and `LinkedList<T>`?"
answer: |
  Pick the collection that matches how you access the data: by index, by key, by membership, or by arrival order.

  - `List<T>`: the default. Ordered and indexed, with O(1) index access and amortized O(1) `Add`, but O(n) `Contains` and O(n) inserts or removals in the middle, because elements shift.
  - `Dictionary<TKey, TValue>`: O(1) average lookup, insert, and remove by key.
  - `HashSet<T>`: unique items, O(1) average `Contains`, and set operations such as `UnionWith` and `IntersectWith`.
  - `Queue<T>` (first in, first out) and `Stack<T>` (last in, first out): amortized O(1) add and O(1) remove.
  - `LinkedList<T>`: O(1) insert or remove when you already hold a `LinkedListNode<T>`, but O(n) search and poor cache locality, so it rarely beats `List<T>` in practice.
  - `SortedDictionary<TKey, TValue>` and `SortedSet<T>`: keep items sorted, with O(log n) operations.
  - `PriorityQueue<TElement, TPriority>` (.NET 6): always dequeues the item with the lowest priority value, in O(log n).

  Pitfall: calling `list.Contains` inside a loop makes the algorithm quadratic. Building a `HashSet<T>` first brings it back to O(n).
codeExample: |
  var ids = new HashSet<int> { 1, 2, 3 };
  Console.WriteLine(ids.Add(2));        // Output: False (already present)

  var inbox = new Queue<string>();
  inbox.Enqueue("first");
  inbox.Enqueue("second");
  Console.WriteLine(inbox.Dequeue());   // Output: first

  var undo = new Stack<string>();
  undo.Push("typed A");
  undo.Push("typed B");
  Console.WriteLine(undo.Pop());        // Output: typed B

  var jobs = new PriorityQueue<string, int>();
  jobs.Enqueue("cleanup", 5);
  jobs.Enqueue("outage", 1);
  Console.WriteLine(jobs.Dequeue());    // Output: outage

  var prices = new Dictionary<string, decimal> { ["apple"] = 1.25m };
  if (prices.TryGetValue("apple", out var price))
      Console.WriteLine(price);         // Output: 1.25
popularity: 8.0
isPublished: true
---

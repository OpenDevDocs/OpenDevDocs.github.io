---
publishDate: 2026-07-02T08:30
title: Common Time Complexities with Examples
slug: common-time-complexities-with-examples
metadescription: A practical reference for the cost of everyday C# collection operations, with the numbers that decide which one to reach for.
updateDate: 2026-09-07T08:30
author: ['bishal-biswas']
level: 1
tags: ['complexity', 'collections', 'reference']
course: dsa
---

## Knowing the costs by heart

Big O is only useful if you know what the everyday operations cost. This page is the reference you will come back to.

The rule underneath all of it: **an operation that has to look at every item is `O(n)`, and an operation that jumps straight to a location is `O(1)`.**

## Arrays

```csharp
int[] numbers = { 4, 8, 15, 16, 23, 42 };

int value = numbers[3];        // O(1)  jumps straight there
numbers[3] = 99;               // O(1)
int length = numbers.Length;   // O(1)  stored, not counted

bool found = numbers.Contains(15);         // O(n)  checks each item
int index = Array.IndexOf(numbers, 15);    // O(n)
Array.Sort(numbers);                       // O(n log n)
```

An array knows the address of item zero and the size of each item, so item `i` is one multiplication away. That is why indexing is instant.

An array cannot grow. Adding means making a bigger array and copying, which is `O(n)`.

## List of T

`List<T>` is an array that grows for you.

```csharp
var items = new List<string> { "a", "b", "c" };

string first = items[0];        // O(1)
items.Add("d");                 // O(1) most of the time
items.Insert(0, "z");           // O(n)  everything shifts right
items.RemoveAt(0);              // O(n)  everything shifts left
items.Remove("b");              // O(n)  search, then shift
bool has = items.Contains("b"); // O(n)
int count = items.Count;        // O(1)
```

`Add` is `O(1)` most of the time. Occasionally the internal array is full, so it doubles in size and copies everything, which is `O(n)`. Spread over many `Add` calls that averages out to `O(1)`, which is called **amortised** constant time.

The important lines here are `Insert(0, ...)` and `RemoveAt(0)`. Adding at the front of a list moves every other item. In a loop, that is `O(n^2)`.

## Dictionary and HashSet

```csharp
var ages = new Dictionary<string, int>();

ages["Asha"] = 30;                          // O(1)
int age = ages["Asha"];                     // O(1)
bool known = ages.ContainsKey("Asha");      // O(1)
bool removed = ages.Remove("Asha");         // O(1)

bool byValue = ages.ContainsValue(30);      // O(n)  values are not indexed
```

```csharp
var seen = new HashSet<int>();

seen.Add(42);         // O(1)
seen.Contains(42);    // O(1)
seen.Remove(42);      // O(1)
```

These are the workhorses. When code is slow because of repeated searching, a dictionary or set is usually the fix.

Note `ContainsValue` is `O(n)`. Only keys are indexed.

## Stack and Queue

```csharp
var stack = new Stack<int>();
stack.Push(1);       // O(1)
int top = stack.Pop();   // O(1)
int peek = stack.Peek(); // O(1)

var queue = new Queue<int>();
queue.Enqueue(1);        // O(1)
int next = queue.Dequeue();  // O(1)
```

Every operation on both is constant time. That is the point of them.

## LinkedList of T

```csharp
var list = new LinkedList<int>();

var node = list.AddLast(10);    // O(1)
list.AddFirst(5);               // O(1)
list.AddAfter(node, 15);        // O(1)  you already hold the node
list.Remove(node);              // O(1)  you already hold the node

bool has = list.Contains(10);   // O(n)
```

A linked list wins on inserting and removing when you already have the node. It loses on everything involving position, because there is no way to jump to item 500 without walking there.

## SortedDictionary and SortedSet

```csharp
var sorted = new SortedDictionary<string, int>();

sorted["banana"] = 2;             // O(log n)
int v = sorted["banana"];         // O(log n)
bool has = sorted.ContainsKey("banana");   // O(log n)

foreach (var pair in sorted) Console.WriteLine(pair.Key);   // in key order
```

Slower than a `Dictionary` for single lookups, but it keeps the keys in order. If you need sorted iteration or range queries, that is worth the extra cost. If you do not, use a `Dictionary`.

## PriorityQueue

```csharp
var queue = new PriorityQueue<string, int>();

queue.Enqueue("low", 5);        // O(log n)
queue.Enqueue("urgent", 1);     // O(log n)

string next = queue.Dequeue();  // O(log n), returns "urgent"
string peek = queue.Peek();     // O(1)
```

Always hands back the lowest priority value first. Built on a heap, covered later in this course.

## Strings

```csharp
string s = "hello world";

char c = s[0];                    // O(1)
int len = s.Length;               // O(1)
bool has = s.Contains("world");   // O(n)
string up = s.ToUpper();          // O(n)  builds a new string
string sub = s.Substring(0, 5);   // O(n)  copies the characters
```

Strings are immutable, so anything that "changes" one builds a new one. This makes concatenation in a loop quietly quadratic:

```csharp
// O(n^2): each += copies the whole string so far
string result = "";
foreach (string word in words) result += word;

// O(n): StringBuilder appends into a growing buffer
var builder = new System.Text.StringBuilder();
foreach (string word in words) builder.Append(word);
string fast = builder.ToString();
```

## LINQ

LINQ hides its loops, but they are still loops.

```csharp
var evens = numbers.Where(n => n % 2 == 0);   // O(n) when enumerated
var first = numbers.First(n => n > 100);      // O(n)
bool any = numbers.Any(n => n > 100);         // O(n), stops early
int count = numbers.Count();                  // O(1) for List, O(n) for a query
var ordered = numbers.OrderBy(n => n);        // O(n log n)
var grouped = numbers.GroupBy(n => n % 3);    // O(n)
var lookup = people.ToDictionary(p => p.Id);  // O(n) once, O(1) per lookup after
```

The dangerous one is a LINQ query used inside a loop. Each pass runs the whole query again.

## The summary table

```text
Operation                     Array   List<T>   LinkedList   Dictionary   SortedDict
Access by index               O(1)    O(1)      O(n)         n/a          n/a
Search by value               O(n)    O(n)      O(n)         O(1) by key  O(log n)
Insert at end                 n/a     O(1)*     O(1)         O(1)         O(log n)
Insert at start               n/a     O(n)      O(1)         O(1)         O(log n)
Remove from middle            n/a     O(n)      O(1) w/node  O(1)         O(log n)
Keeps sorted order            no      no        no           no           yes
```

The star on `List<T>.Add` is the amortised cost.

## Choosing quickly

- Need lookup by key: `Dictionary`.
- Need "have I seen this": `HashSet`.
- Need order preserved and index access: `List`.
- Need first in first out: `Queue`.
- Need last in first out: `Stack`.
- Need always sorted: `SortedDictionary` or `SortedSet`.
- Need the smallest or largest next: `PriorityQueue`.

## Quick recap

- Indexing an array or list is `O(1)`, searching it is `O(n)`.
- `Insert(0, ...)` and `RemoveAt(0)` on a list shift everything, so they are `O(n)`.
- Dictionary and HashSet give `O(1)` lookups and fix most slow code.
- `ContainsValue` on a dictionary is `O(n)`, only keys are indexed.
- Linked lists are `O(1)` to insert and remove when you hold the node, `O(n)` otherwise.
- Sorted collections cost `O(log n)` and buy you ordering.
- String `+=` in a loop is `O(n^2)`, use `StringBuilder`.

<code id="code-content" class="language-csharp">
// O(1): jump straight to a location
int[] numbers = { 4, 8, 15, 16, 23, 42 };
int value = numbers[3];                    // instant, any array size
// O(n): has to look at every item
bool found = numbers.Contains(15);
int index = Array.IndexOf(numbers, 15);
// List: fast at the end, slow at the front
var items = new List&lt;string&gt; { "a", "b", "c" };
items.Add("d");            // O(1) amortised
items.Insert(0, "z");      // O(n), every item shifts right
items.RemoveAt(0);         // O(n), every item shifts left
// Dictionary and HashSet: the O(1) workhorses
var ages = new Dictionary&lt;string, int&gt; { ["Asha"] = 30 };
Console.WriteLine(ages.ContainsKey("Asha"));    // O(1), keys are indexed
Console.WriteLine(ages.ContainsValue(30));      // O(n), values are not
var seen = new HashSet&lt;int&gt;();
seen.Add(42); seen.Contains(42);                // O(1) both
// Stack and Queue: every operation is O(1)
var stack = new Stack&lt;int&gt;(); stack.Push(1); stack.Pop();
var queue = new Queue&lt;int&gt;(); queue.Enqueue(1); queue.Dequeue();
// SortedDictionary: O(log n) but iterates in key order
var sorted = new SortedDictionary&lt;string, int&gt; { ["banana"] = 2, ["apple"] = 1 };
foreach (var pair in sorted) Console.WriteLine(pair.Key);   // apple, banana
// PriorityQueue: smallest priority comes out first
var pq = new PriorityQueue&lt;string, int&gt;();
pq.Enqueue("low", 5); pq.Enqueue("urgent", 1);
Console.WriteLine(pq.Dequeue());                // urgent
// String += in a loop is O(n^2). StringBuilder is O(n).
var builder = new System.Text.StringBuilder();
foreach (string w in new[] { "a", "b", "c" }) builder.Append(w);
Console.WriteLine(builder.ToString());          // abc
</code></pre>

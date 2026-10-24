---
publishDate: 2026-07-01T08:00
title: What Are Data Structures and Algorithms
slug: what-are-data-structures-and-algorithms
metadescription: Understand what data structures and algorithms actually are, why the same task can be fast or slow, and how the two ideas fit together.
updateDate: 2026-09-07T08:00
author: ['bishal-biswas']
level: 1
tags: ['fundamentals', 'introduction', 'problem solving']
course: dsa
---

## The two halves of every program

Every program does two things. It **holds information somewhere**, and it **does something with that information**.

The way you hold it is a **data structure**. The steps you follow to work with it are an **algorithm**.

That is the whole subject. Everything else is detail.

## A shelf and a pile

Imagine two hundred books.

If you throw them in a pile, adding a book is instant. Finding one takes forever, because you check book after book.

If you line them up alphabetically on a shelf, adding a book means shuffling others along. But finding one is quick, because you jump straight to the right letter.

Same books, two different structures, two very different speeds. The pile and the shelf are data structures. "Check every book" and "jump to the right letter" are the algorithms.

There is no perfect choice here. There is only the choice that fits what you do most often.

## The same task, two speeds

Say you have one hundred thousand user IDs and you need to check whether a given ID exists.

```csharp
var ids = new List<int>();
for (int i = 0; i < 100_000; i++) ids.Add(i);

bool exists = ids.Contains(99_999);
```

`List<T>.Contains` walks the list from the start. To find the last item, it looks at all one hundred thousand.

Now the same job with a different structure:

```csharp
var ids = new HashSet<int>();
for (int i = 0; i < 100_000; i++) ids.Add(i);

bool exists = ids.Contains(99_999);
```

`HashSet<T>.Contains` jumps almost straight to the answer. It does not care whether you stored a hundred items or a million.

The code you wrote barely changed. The work the computer does changed enormously.

## Seeing the difference

You do not have to take this on trust. Measure it:

```csharp
using System.Diagnostics;

var list = new List<int>();
var set = new HashSet<int>();
for (int i = 0; i < 200_000; i++) { list.Add(i); set.Add(i); }

var watch = Stopwatch.StartNew();
for (int i = 0; i < 1_000; i++) list.Contains(199_999);
Console.WriteLine($"List: {watch.ElapsedMilliseconds} ms");

watch.Restart();
for (int i = 0; i < 1_000; i++) set.Contains(199_999);
Console.WriteLine($"HashSet: {watch.ElapsedMilliseconds} ms");
```

The list takes hundreds of milliseconds. The set finishes so fast the timer often reports zero.

## What a data structure gives you

Each structure is a trade. It makes some operations cheap by making others expensive.

- An **array** gives instant access by position, but a fixed size.
- A **list** grows on demand, but searching means checking every item.
- A **hash table** finds items almost instantly, but stores no order.
- A **linked list** inserts anywhere cheaply, but cannot jump to item number 500.
- A **tree** keeps everything sorted while still allowing fast lookup.

Learning DSA is mostly learning these trades well enough to pick correctly without thinking hard about it.

## What an algorithm is

An algorithm is a finite list of unambiguous steps that turns an input into an output.

Finding the largest number in an array is an algorithm:

```csharp
static int FindLargest(int[] numbers)
{
    int largest = numbers[0];

    foreach (int number in numbers)
    {
        if (number > largest) largest = number;
    }

    return largest;
}

Console.WriteLine(FindLargest(new[] { 3, 91, 12, 45 }));   // 91
```

Three properties matter. It **finishes**. It gives the **correct** answer for every valid input. And it is **clear** enough that there is no guessing about what to do next.

## Why this matters at work

Most bugs are not performance bugs. But the ones that hurt most usually are, and they hide well.

A page that loads in 40 milliseconds with 100 rows of test data can take 40 seconds with 100,000 rows in production. Nothing in the code looks wrong. The structure was simply the wrong one.

Here is that mistake in its most common form:

```csharp
// Slow: for every order, walk the entire customer list
foreach (var order in orders)
{
    var customer = customers.First(c => c.Id == order.CustomerId);
    Console.WriteLine(customer.Name);
}
```

With 1,000 orders and 1,000 customers that is up to a million comparisons. One dictionary fixes it:

```csharp
// Fast: build a lookup once, then every match is instant
var byId = customers.ToDictionary(c => c.Id);

foreach (var order in orders)
{
    Console.WriteLine(byId[order.CustomerId].Name);
}
```

Same output, a tiny fraction of the work. Spotting that difference is the skill this course teaches.

## The pattern you will keep seeing

Almost every improvement in this course is one of three moves.

1. **Store the data differently** so lookups get cheaper, like the dictionary above.
2. **Stop repeating work** by remembering answers you already calculated.
3. **Throw away half the possibilities each step** instead of checking them one by one.

Once you recognise these three, most problems stop feeling like puzzles.

## Do you need this if libraries exist?

`List<T>`, `Dictionary<TKey, TValue>` and `Array.Sort` are already written and already fast. You will rarely write a sorting algorithm at work.

You still need to know how they behave, because the library cannot choose for you. It cannot know that you are about to call `Contains` inside a loop over 50,000 items. That decision is yours, and making it well is the entire point.

## Quick recap

- A data structure is how data is stored, an algorithm is what you do with it.
- Every structure trades cheap operations for expensive ones.
- The same task can be fast or painfully slow depending on the structure you chose.
- `List.Contains` checks every item, `HashSet.Contains` jumps almost straight there.
- Slow code usually looks fine and only breaks once the data grows.
- You will not write these from scratch often, but you will choose between them daily.

<code id="code-content" class="language-csharp">
using System.Diagnostics;
// Same question, two data structures, very different speeds
var list = new List&lt;int&gt;();
var set  = new HashSet&lt;int&gt;();
for (int i = 0; i &lt; 200_000; i++) { list.Add(i); set.Add(i); }
var watch = Stopwatch.StartNew();
for (int i = 0; i &lt; 1_000; i++) list.Contains(199_999);   // checks every item
Console.WriteLine($"List:    {watch.ElapsedMilliseconds} ms");
watch.Restart();
for (int i = 0; i &lt; 1_000; i++) set.Contains(199_999);    // jumps straight there
Console.WriteLine($"HashSet: {watch.ElapsedMilliseconds} ms");
// An algorithm: clear steps, always finishes, always correct
static int FindLargest(int[] numbers)
{
    int largest = numbers[0];
    foreach (int number in numbers)
        if (number &gt; largest) largest = number;
    return largest;
}
Console.WriteLine(FindLargest(new[] { 3, 91, 12, 45 }));   // 91
// The classic mistake: a search inside a loop
var customers = new[] { new { Id = 1, Name = "Asha" }, new { Id = 2, Name = "Ravi" } };
var orders    = new[] { new { CustomerId = 2 }, new { CustomerId = 1 } };
foreach (var order in orders)                              // slow with real data
    Console.WriteLine(customers.First(c =&gt; c.Id == order.CustomerId).Name);
// The fix: build a lookup once, then every match is instant
var byId = customers.ToDictionary(c =&gt; c.Id);
foreach (var order in orders)
    Console.WriteLine(byId[order.CustomerId].Name);
</code></pre>

---
publishDate: 2026-07-17T14:10
title: Counting Sort and Radix Sort
slug: counting-sort-and-radix-sort
metadescription: Sort without comparing anything by counting occurrences or processing digits, and beat the O(n log n) barrier when the data allows.
updateDate: 2026-09-07T14:10
author: ['bishal-biswas']
level: 3
tags: ['sorting', 'linear time', 'algorithms']
course: dsa
---

## Breaking the barrier

Every comparison based sort has a proven lower bound of `O(n log n)`. You cannot do better while your only tool is asking "is a smaller than b".

But you can stop comparing. If you know something about the values themselves, counting or bucketing them sorts in `O(n)`.

## Counting sort

Count how many times each value appears, then write them back out in order.

```csharp
static void CountingSort(int[] a, int maxValue)
{
    var counts = new int[maxValue + 1];

    foreach (int n in a) counts[n]++;          // count each value

    int index = 0;

    for (int value = 0; value <= maxValue; value++)
    {
        for (int i = 0; i < counts[value]; i++) a[index++] = value;
    }
}

int[] ages = { 25, 30, 25, 40, 30, 25 };
CountingSort(ages, 40);
Console.WriteLine(string.Join(", ", ages));   // 25, 25, 25, 30, 30, 40
```

No comparison anywhere. The value **is** the index.

Time is `O(n + k)` where `k` is the range of values. Space is `O(k)`.

## When it wins and when it loses

Counting ages 0 to 120 across a million people: `k` is 121, so it is essentially `O(n)`. Enormously faster than any comparison sort.

Counting arbitrary `int` values: `k` is over 4 billion, so you would allocate 17 GB to sort three numbers. Completely unusable.

**The rule: use counting sort when the range of values is small compared with the number of items.**

Handle negatives and arbitrary ranges with an offset:

```csharp
static void CountingSortRange(int[] a)
{
    if (a.Length == 0) return;

    int min = a.Min(), max = a.Max();
    var counts = new int[max - min + 1];

    foreach (int n in a) counts[n - min]++;

    int index = 0;

    for (int i = 0; i < counts.Length; i++)
    {
        for (int j = 0; j < counts[i]; j++) a[index++] = i + min;
    }
}

int[] temperatures = { 5, -3, 0, -3, 7, 5 };
CountingSortRange(temperatures);
Console.WriteLine(string.Join(", ", temperatures));   // -3, -3, 0, 5, 5, 7
```

## The stable version

The version above rebuilds values from their counts, which works for plain numbers but loses any attached data. To sort objects by a key, you need the stable form.

```csharp
static T[] CountingSortStable<T>(T[] items, Func<T, int> keyOf, int maxKey)
{
    var counts = new int[maxKey + 1];

    foreach (T item in items) counts[keyOf(item)]++;

    // turn counts into starting positions
    for (int i = 1; i <= maxKey; i++) counts[i] += counts[i - 1];

    var result = new T[items.Length];

    for (int i = items.Length - 1; i >= 0; i--)      // backwards keeps it stable
    {
        int key = keyOf(items[i]);
        counts[key]--;
        result[counts[key]] = items[i];
    }

    return result;
}

record Student(string Name, int Score);

var students = new[]
{
    new Student("Asha", 90),
    new Student("Ravi", 85),
    new Student("Meera", 90),
    new Student("Anil", 85)
};

foreach (var s in CountingSortStable(students, s => s.Score, 100))
{
    Console.WriteLine($"{s.Name} {s.Score}");
}
// Ravi 85, Anil 85, Asha 90, Meera 90
```

Two details do all the work.

**The prefix sum** turns counts into positions. After it, `counts[k]` holds the index just past where the last item with key `k` goes.

**Walking backwards** is what preserves stability. Going forwards would place later items before earlier ones with the same key.

Ravi appears before Anil, and Asha before Meera, matching the input order. That stability is what makes radix sort possible.

## Radix sort

Counting sort fails on large ranges. Radix sort fixes that by sorting one digit at a time, starting with the least significant.

```csharp
static void RadixSort(int[] a)
{
    if (a.Length == 0) return;

    int max = a.Max();

    for (int exponent = 1; max / exponent > 0; exponent *= 10)
    {
        CountingSortByDigit(a, exponent);
    }
}

static void CountingSortByDigit(int[] a, int exponent)
{
    var output = new int[a.Length];
    var counts = new int[10];                  // one slot per digit

    foreach (int n in a) counts[n / exponent % 10]++;

    for (int i = 1; i < 10; i++) counts[i] += counts[i - 1];

    for (int i = a.Length - 1; i >= 0; i--)    // backwards for stability
    {
        int digit = a[i] / exponent % 10;
        counts[digit]--;
        output[counts[digit]] = a[i];
    }

    Array.Copy(output, a, a.Length);
}

int[] numbers = { 170, 45, 75, 90, 802, 24, 2, 66 };
RadixSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 2, 24, 45, 66, 75, 90, 170, 802
```

`n / exponent % 10` extracts one digit. With `exponent` at 1 it gives the units, at 10 the tens, and so on.

## Why it works

Sorting by the units digit first looks backwards, and it is exactly right.

```text
start:      170, 45, 75, 90, 802, 24, 2, 66
by units:   170, 90, 802, 2, 24, 45, 75, 66
by tens:    802, 2, 24, 45, 66, 170, 75, 90
by 100s:    2, 24, 45, 66, 75, 90, 170, 802
```

Each pass must be **stable**. When two numbers have the same tens digit, the stable sort keeps the order established by the units pass. So each pass refines the previous one instead of destroying it.

Use an unstable sort for the digit passes and radix sort produces nonsense.

Time is `O(d * (n + 10))` where `d` is the number of digits. Since `d` is a small constant for realistic numbers, this is effectively `O(n)`.

## Bucket sort

The third linear time sort. Spread values into buckets by range, sort each bucket, concatenate.

```csharp
static void BucketSort(double[] a)          // values in [0, 1)
{
    int n = a.Length;
    if (n == 0) return;

    var buckets = new List<double>[n];
    for (int i = 0; i < n; i++) buckets[i] = new List<double>();

    foreach (double value in a) buckets[(int)(value * n)].Add(value);

    int index = 0;

    foreach (var bucket in buckets)
    {
        bucket.Sort();                       // usually tiny
        foreach (double value in bucket) a[index++] = value;
    }
}

double[] values = { 0.42, 0.32, 0.75, 0.12, 0.68 };
BucketSort(values);
Console.WriteLine(string.Join(", ", values));   // 0.12, 0.32, 0.42, 0.68, 0.75
```

`O(n)` when the values are spread evenly. If they all land in one bucket, it degrades to whatever the inner sort is.

## Choosing between them

```text
Algorithm        Time          Space     Needs
Counting sort    O(n + k)      O(k)      small integer range
Radix sort       O(d * n)      O(n + b)  fixed length integers or strings
Bucket sort      O(n) average  O(n)      evenly distributed values
Comparison sort  O(n log n)    varies    only a comparison
```

In practice:

- **Ages, scores, ratings, days of the year:** counting sort.
- **Fixed width IDs, postcodes, phone numbers:** radix sort.
- **Evenly spread floating point values:** bucket sort.
- **Anything else, or objects with a custom comparison:** `Array.Sort`.

These are not general purpose. They trade flexibility for speed, and you can only make that trade when you know what the data looks like.

## Quick recap

- Comparison sorts cannot beat `O(n log n)`, so linear sorts avoid comparing.
- Counting sort uses the value as an index, and needs a small range.
- The prefix sum turns counts into output positions.
- Walk backwards when placing items to keep the sort stable.
- Radix sort applies a stable counting sort to each digit, least significant first.
- Stability is not optional in radix sort, it is what makes it correct.
- These sorts are fast only when you know something specific about the data.

<code id="code-content" class="language-csharp">
// Counting sort: the value IS the index. No comparisons at all.
static void CountingSort(int[] a, int maxValue)
{
    var counts = new int[maxValue + 1];
    foreach (int n in a) counts[n]++;
    int index = 0;
    for (int value = 0; value &lt;= maxValue; value++)
        for (int i = 0; i &lt; counts[value]; i++) a[index++] = value;
}
int[] ages = { 25, 30, 25, 40, 30, 25 };
CountingSort(ages, 40);
Console.WriteLine(string.Join(", ", ages));      // 25,25,25,30,30,40
// O(n + k). Great for ages 0-120. Useless for arbitrary ints (k = 4 billion).
// The stable version: prefix sums give positions, backwards keeps order
static T[] CountingSortStable&lt;T&gt;(T[] items, Func&lt;T, int&gt; keyOf, int maxKey)
{
    var counts = new int[maxKey + 1];
    foreach (T item in items) counts[keyOf(item)]++;
    for (int i = 1; i &lt;= maxKey; i++) counts[i] += counts[i - 1];   // to positions
    var result = new T[items.Length];
    for (int i = items.Length - 1; i &gt;= 0; i--)                     // backwards
    {
        int key = keyOf(items[i]);
        result[--counts[key]] = items[i];
    }
    return result;
}
record Student(string Name, int Score);
var students = new[] { new Student("Asha", 90), new Student("Ravi", 85),
                       new Student("Meera", 90), new Student("Anil", 85) };
foreach (var s in CountingSortStable(students, s =&gt; s.Score, 100))
    Console.WriteLine($"{s.Name} {s.Score}");    // Ravi 85, Anil 85, Asha 90, Meera 90
// Radix sort: a stable counting sort per digit, least significant first
static void RadixSort(int[] a)
{
    if (a.Length == 0) return;
    int max = a.Max();
    for (int exp = 1; max / exp &gt; 0; exp *= 10)
    {
        var output = new int[a.Length];
        var counts = new int[10];
        foreach (int n in a) counts[n / exp % 10]++;
        for (int i = 1; i &lt; 10; i++) counts[i] += counts[i - 1];
        for (int i = a.Length - 1; i &gt;= 0; i--)  // stability is REQUIRED here
            output[--counts[a[i] / exp % 10]] = a[i];
        Array.Copy(output, a, a.Length);
    }
}
int[] numbers = { 170, 45, 75, 90, 802, 24, 2, 66 };
RadixSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 2,24,45,66,75,90,170,802
</code></pre>

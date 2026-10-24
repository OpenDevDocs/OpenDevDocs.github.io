---
publishDate: 2026-07-17T14:20
title: Choosing a Sorting Algorithm
slug: choosing-a-sorting-algorithm
metadescription: A practical guide to picking the right sort, what stability actually costs you, and how to sort by several fields correctly in C#.
updateDate: 2026-09-07T14:20
author: ['bishal-biswas']
level: 2
tags: ['sorting', 'comparison', 'practical']
course: dsa
---

## The honest answer first

In production C#, use the library.

```csharp
int[] numbers = { 5, 2, 9, 1, 7 };
Array.Sort(numbers);

var list = new List<int> { 5, 2, 9 };
list.Sort();

var sorted = people.OrderBy(p => p.Age).ToList();
```

`Array.Sort` and `List.Sort` use introsort, which is quick sort with a heap sort fallback and insertion sort for small pieces. It is faster than anything you will write and it has no worst case.

The reason to know the algorithms is to answer the questions the library cannot: which method to call, whether stability matters, and what to do when the data does not fit the general case.

## The comparison table

```text
Algorithm        Best        Average     Worst       Space      Stable
Bubble           O(n)        O(n^2)      O(n^2)      O(1)       yes
Selection        O(n^2)      O(n^2)      O(n^2)      O(1)       no
Insertion        O(n)        O(n^2)      O(n^2)      O(1)       yes
Merge            O(n log n)  O(n log n)  O(n log n)  O(n)       yes
Quick            O(n log n)  O(n log n)  O(n^2)      O(log n)   no
Heap             O(n log n)  O(n log n)  O(n log n)  O(1)       no
Counting         O(n + k)    O(n + k)    O(n + k)    O(k)       yes
Radix            O(d * n)    O(d * n)    O(d * n)    O(n + b)   yes
```

Three rows are worth memorising. Merge sort has no bad case but costs memory. Quick sort is fastest in practice but has an `O(n^2)` risk. Heap sort has no bad case and no memory cost, but is slower in practice because of poor cache behaviour.

## Choosing by situation

**General purpose sorting.** `Array.Sort` or `OrderBy`. Do not think about it.

**Stability required.** `OrderBy`, or merge sort if you are writing it. `Array.Sort` is not stable.

**Memory constrained.** Heap sort or quick sort. Merge sort needs a full extra array.

**Guaranteed worst case, for a real time system.** Merge sort or heap sort. Never plain quick sort.

**Nearly sorted data.** Insertion sort, genuinely. It is `O(n)` when items are close to their final positions.

**Small arrays, under about 20 items.** Insertion sort. Big O is irrelevant at that size and its overhead is nearly zero.

**Small integer range, like ages or scores.** Counting sort. Linear time.

**Fixed width keys, like IDs or postcodes.** Radix sort.

**Linked list.** Merge sort. Quick sort needs random access that a list cannot give.

**Data larger than memory.** External merge sort.

**Only the top K items needed.** Do not sort at all. Use a heap, which is `O(n log k)`.

**The Kth element only.** Quickselect, `O(n)` on average.

## Stability, concretely

A stable sort keeps equal items in their original relative order. This is not academic.

```csharp
record Employee(string Name, string Department, int Salary);

var employees = new List<Employee>
{
    new("Asha", "Engineering", 90),
    new("Ravi", "Sales", 85),
    new("Meera", "Engineering", 95),
    new("Anil", "Sales", 85)
};

// Sort by name first, then by department with a STABLE sort
var byName = employees.OrderBy(e => e.Name).ToList();
var result = byName.OrderBy(e => e.Department).ToList();

foreach (var e in result) Console.WriteLine($"{e.Department} {e.Name}");
// Engineering Asha, Engineering Meera, Sales Anil, Sales Ravi
```

Within each department the names are still in order, because `OrderBy` is stable and did not disturb the earlier sort.

Do the same with `List.Sort` and the name order inside each department is arbitrary.

## Sorting by several fields

For a fixed set of fields, use `ThenBy` rather than sorting repeatedly. It is clearer and only sorts once.

```csharp
var sorted = employees
    .OrderBy(e => e.Department)
    .ThenByDescending(e => e.Salary)
    .ThenBy(e => e.Name)
    .ToList();
```

The same thing with a comparison method:

```csharp
employees.Sort((a, b) =>
{
    int byDepartment = string.CompareOrdinal(a.Department, b.Department);
    if (byDepartment != 0) return byDepartment;

    int bySalary = b.Salary.CompareTo(a.Salary);   // descending
    if (bySalary != 0) return bySalary;

    return string.CompareOrdinal(a.Name, b.Name);
});
```

A comparison returns a negative number if `a` comes first, zero if they tie, and a positive number if `b` comes first. Return the first non zero result and only fall through on ties.

Do not write `a.Salary - b.Salary`. It overflows on large values and produces a wrong ordering. Use `CompareTo`.

## Comparer classes

For a comparison used in several places, put it in a class.

```csharp
public class SalaryDescending : IComparer<Employee>
{
    public int Compare(Employee? a, Employee? b)
    {
        if (a is null) return b is null ? 0 : -1;
        if (b is null) return 1;

        return b.Salary.CompareTo(a.Salary);
    }
}

employees.Sort(new SalaryDescending());
```

Or make the type know its own natural order with `IComparable<T>`:

```csharp
public record Version(int Major, int Minor) : IComparable<Version>
{
    public int CompareTo(Version? other)
    {
        if (other is null) return 1;

        int byMajor = Major.CompareTo(other.Major);
        return byMajor != 0 ? byMajor : Minor.CompareTo(other.Minor);
    }
}

var versions = new List<Version> { new(2, 1), new(1, 5), new(2, 0) };
versions.Sort();
foreach (var v in versions) Console.WriteLine($"{v.Major}.{v.Minor}");   // 1.5, 2.0, 2.1
```

## Sorting strings

The trap: the default string comparison is culture aware, and culture rules are surprising.

```csharp
var names = new[] { "apple", "Banana", "cherry" };

Array.Sort(names);                                    // culture aware
Array.Sort(names, StringComparer.Ordinal);            // by character code
Array.Sort(names, StringComparer.OrdinalIgnoreCase);  // by code, ignoring case
```

`Ordinal` puts all uppercase before all lowercase, because that is the character order. Culture aware sorting groups them the way a reader expects.

Use culture aware for anything a person reads. Use `Ordinal` for identifiers, file names, keys and anything that must sort identically on every machine.

Sorting numbers stored as strings needs care:

```csharp
var files = new[] { "file10.txt", "file2.txt", "file1.txt" };

Array.Sort(files);
Console.WriteLine(string.Join(", ", files));   // file1, file10, file2

var natural = files.OrderBy(f => int.Parse(new string(f.Where(char.IsDigit).ToArray())));
Console.WriteLine(string.Join(", ", natural));  // file1, file2, file10
```

## Do not sort when you do not need to

The most valuable optimisation is skipping the sort.

```csharp
// Sorting to find the largest: O(n log n)
int largest = numbers.OrderByDescending(n => n).First();

// Just scanning: O(n)
int largest = numbers.Max();
```

```csharp
// Sorting for the top 3: O(n log n)
var top3 = numbers.OrderByDescending(n => n).Take(3);

// A heap of size 3: O(n log 3)
var heap = new PriorityQueue<int, int>();
foreach (int n in numbers)
{
    heap.Enqueue(n, n);
    if (heap.Count > 3) heap.Dequeue();
}
```

Also worth checking: is it already sorted?

```csharp
static bool IsSorted(int[] a)
{
    for (int i = 1; i < a.Length; i++)
    {
        if (a[i] < a[i - 1]) return false;
    }
    return true;
}

if (!IsSorted(numbers)) Array.Sort(numbers);
```

One `O(n)` pass can save an `O(n log n)` sort on data that is already in order, which happens more often than people expect.

## Sorting is a means, not an end

Sorting often exists only to enable something else. Ask whether that something else has a direct solution.

- Finding duplicates: a `HashSet` is `O(n)`, sorting is `O(n log n)`.
- Finding the maximum: `Max()` is `O(n)`.
- Checking membership repeatedly: a `HashSet` beats sort plus binary search.
- Keeping data ordered as it arrives: a `SortedSet` or `SortedDictionary`, not a repeated sort.

Sorting is right when you need the whole thing in order, or when you will do many range queries or binary searches afterwards.

## Quick recap

- Use `Array.Sort` and `OrderBy`, and know the difference: only `OrderBy` is stable.
- Merge sort has no bad case but needs memory, quick sort is fastest but risks `O(n^2)`.
- Insertion sort is the right choice for small or nearly sorted arrays.
- Use `ThenBy` for multiple fields, and never subtract in a comparison.
- Use `StringComparer.Ordinal` for identifiers and culture aware for display.
- A heap beats sorting when you only need the top K.
- Check whether you need to sort at all before you do.

<code id="code-content" class="language-csharp">
// In production, use the library. Know which one is stable.
int[] numbers = { 5, 2, 9, 1, 7 };
Array.Sort(numbers);                                  // introsort, NOT stable
record Employee(string Name, string Department, int Salary);
var employees = new List&lt;Employee&gt;
{
    new("Asha", "Engineering", 90), new("Ravi", "Sales", 85),
    new("Meera", "Engineering", 95), new("Anil", "Sales", 85)
};
// Stability lets you layer sorts: names stay in order within each department
var byName = employees.OrderBy(e =&gt; e.Name).ToList();
foreach (var e in byName.OrderBy(e =&gt; e.Department))
    Console.WriteLine($"{e.Department} {e.Name}");
// Several fields at once: ThenBy sorts once, not repeatedly
var sorted = employees
    .OrderBy(e =&gt; e.Department)
    .ThenByDescending(e =&gt; e.Salary)
    .ThenBy(e =&gt; e.Name)
    .ToList();
// A comparison returns negative, zero or positive. Never subtract, it overflows.
employees.Sort((a, b) =&gt;
{
    int byDept = string.CompareOrdinal(a.Department, b.Department);
    if (byDept != 0) return byDept;
    return b.Salary.CompareTo(a.Salary);              // CompareTo, not b.Salary - a.Salary
});
// Strings: Ordinal for identifiers, culture aware for anything a person reads
var names = new[] { "apple", "Banana", "cherry" };
Array.Sort(names, StringComparer.OrdinalIgnoreCase);
// The best optimisation is not sorting at all
Console.WriteLine(numbers.Max());                     // O(n), not O(n log n)
var heap = new PriorityQueue&lt;int, int&gt;();             // top 3 in O(n log 3)
foreach (int n in numbers)
{
    heap.Enqueue(n, n);
    if (heap.Count &gt; 3) heap.Dequeue();
}
// Or check whether it is already sorted: one O(n) pass can save the whole sort
static bool IsSorted(int[] a)
{
    for (int i = 1; i &lt; a.Length; i++) if (a[i] &lt; a[i - 1]) return false;
    return true;
}
if (!IsSorted(numbers)) Array.Sort(numbers);
</code></pre>

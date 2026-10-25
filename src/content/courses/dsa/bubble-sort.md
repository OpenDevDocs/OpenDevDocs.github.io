---
publishDate: 2026-07-15T13:20
title: Bubble Sort
slug: bubble-sort
metadescription: Understand the simplest sorting algorithm, why repeated swapping works, and why it is a teaching tool rather than a production one.
updateDate: 2026-09-07T13:20
author: ['bishal-biswas']
level: 1
tags: ['sorting', 'algorithms', 'beginner']
course: dsa
---

## Swapping neighbours

Bubble sort compares each pair of neighbours and swaps them if they are the wrong way round. Repeat until nothing swaps.

The largest value "bubbles" to the end on the first pass, the second largest on the second pass, and so on.

```csharp
static void BubbleSort(int[] a)
{
    for (int pass = 0; pass < a.Length - 1; pass++)
    {
        for (int i = 0; i < a.Length - 1 - pass; i++)
        {
            if (a[i] > a[i + 1])
            {
                (a[i], a[i + 1]) = (a[i + 1], a[i]);
            }
        }
    }
}

int[] numbers = { 5, 2, 9, 1, 7 };
BubbleSort(numbers);
Console.WriteLine(string.Join(", ", numbers));   // 1, 2, 5, 7, 9
```

The `- pass` in the inner loop is worth understanding. After the first pass the last item is definitely correct, after the second the last two are, and so on. Without it the algorithm still works, it just wastes time re-checking a sorted tail.

## Watching it work

```csharp
static void BubbleSortVerbose(int[] a)
{
    for (int pass = 0; pass < a.Length - 1; pass++)
    {
        for (int i = 0; i < a.Length - 1 - pass; i++)
        {
            if (a[i] > a[i + 1]) (a[i], a[i + 1]) = (a[i + 1], a[i]);
        }

        Console.WriteLine($"After pass {pass + 1}: {string.Join(", ", a)}");
    }
}

BubbleSortVerbose(new[] { 5, 2, 9, 1, 7 });
```

Output:

```text
After pass 1: 2, 5, 1, 7, 9
After pass 2: 2, 1, 5, 7, 9
After pass 3: 1, 2, 5, 7, 9
After pass 4: 1, 2, 5, 7, 9
```

The sorted region grows from the right. Notice pass 4 changes nothing, which points straight at the first improvement.

## The early exit

If a pass makes no swaps, the array is sorted and there is no point continuing.

```csharp
static void BubbleSortOptimised(int[] a)
{
    for (int pass = 0; pass < a.Length - 1; pass++)
    {
        bool swapped = false;

        for (int i = 0; i < a.Length - 1 - pass; i++)
        {
            if (a[i] > a[i + 1])
            {
                (a[i], a[i + 1]) = (a[i + 1], a[i]);
                swapped = true;
            }
        }

        if (!swapped) return;
    }
}
```

This is the one thing bubble sort does well. On an already sorted array it makes a single pass, finds nothing to swap, and stops. That is `O(n)`, the best case of any comparison sort.

Nearly sorted data benefits too. If only a couple of items are out of place, it finishes in a few passes.

## The complexity

```text
Best case     O(n)      already sorted, with the early exit
Average case  O(n^2)
Worst case    O(n^2)    sorted backwards
Space         O(1)      sorts in place
Stable        yes       equal items keep their relative order
```

The `O(n^2)` comes from two nested loops each running about `n` times. Roughly `n^2 / 2` comparisons.

For 1,000 items that is 500,000 comparisons. For 100,000 items it is 5 billion, which is minutes rather than milliseconds.

## Stability

Bubble sort is **stable**, meaning two equal items keep their original relative order.

That matters when sorting by one field after another. Sort employees by name, then by department with a stable sort, and within each department the names are still in order.

Stability comes from the strict `>` in the comparison. Using `>=` would swap equal items and break it.

```csharp
if (a[i] > a[i + 1])   // stable
if (a[i] >= a[i + 1])  // not stable, and does pointless work
```

## Sorting objects

```csharp
record Person(string Name, int Age);

static void SortByAge(Person[] people)
{
    for (int pass = 0; pass < people.Length - 1; pass++)
    {
        bool swapped = false;

        for (int i = 0; i < people.Length - 1 - pass; i++)
        {
            if (people[i].Age > people[i + 1].Age)
            {
                (people[i], people[i + 1]) = (people[i + 1], people[i]);
                swapped = true;
            }
        }

        if (!swapped) return;
    }
}

var people = new[]
{
    new Person("Asha", 30),
    new Person("Ravi", 25),
    new Person("Meera", 35)
};

SortByAge(people);
foreach (var p in people) Console.WriteLine($"{p.Name} {p.Age}");
```

## The cocktail variation

Bubble sort has a known weakness. A small value near the end, sometimes called a turtle, moves left only one position per pass.

Cocktail sort alternates direction, so turtles move quickly too.

```csharp
static void CocktailSort(int[] a)
{
    int low = 0, high = a.Length - 1;
    bool swapped = true;

    while (swapped)
    {
        swapped = false;

        for (int i = low; i < high; i++)          // left to right
        {
            if (a[i] > a[i + 1])
            {
                (a[i], a[i + 1]) = (a[i + 1], a[i]);
                swapped = true;
            }
        }

        high--;
        if (!swapped) break;

        swapped = false;

        for (int i = high; i > low; i--)          // right to left
        {
            if (a[i] < a[i - 1])
            {
                (a[i], a[i - 1]) = (a[i - 1], a[i]);
                swapped = true;
            }
        }

        low++;
    }
}
```

Faster in practice on some inputs. Still `O(n^2)`.

## Should you ever use it?

Honestly, no. Even among the simple `O(n^2)` sorts it loses. Insertion sort does the same amount of theoretical work with far fewer writes, and it beats bubble sort on essentially every real input.

Learn bubble sort because:

- It is the easiest sorting algorithm to understand, so it introduces the vocabulary.
- It shows what an in place, stable, comparison based sort means.
- The early exit is a genuinely nice illustration of best case analysis.

Then use `Array.Sort` in real code.

```csharp
int[] numbers = { 5, 2, 9, 1, 7 };
Array.Sort(numbers);                                   // O(n log n)

var people = new List<Person>();
people.Sort((x, y) => x.Age.CompareTo(y.Age));         // custom comparison

var sorted = people.OrderBy(p => p.Age).ToList();      // LINQ, stable, new list
```

`Array.Sort` and `List.Sort` are not stable. `OrderBy` is. That is often the deciding factor.

## Quick recap

- Bubble sort repeatedly swaps out of order neighbours until nothing swaps.
- The largest value reaches its place after one pass, so shrink the inner loop each time.
- The early exit gives `O(n)` on already sorted input.
- It is `O(n^2)` on average and in the worst case, `O(1)` space, and stable.
- Use `>` rather than `>=` to keep it stable.
- Cocktail sort alternates direction to move small values back faster.
- Use `Array.Sort` or `OrderBy` in real code, and remember only `OrderBy` is stable.

<code id="code-content" class="language-csharp">
// Compare neighbours, swap if out of order, repeat
static void BubbleSort(int[] a)
{
    for (int pass = 0; pass &lt; a.Length - 1; pass++)
    {
        bool swapped = false;
        // -pass: the tail is already sorted, do not re-check it
        for (int i = 0; i &lt; a.Length - 1 - pass; i++)
        {
            if (a[i] &gt; a[i + 1])              // &gt; not &gt;=, so it stays stable
            {
                (a[i], a[i + 1]) = (a[i + 1], a[i]);
                swapped = true;
            }
        }
        if (!swapped) return;                 // early exit: O(n) on sorted input
    }
}
int[] numbers = { 5, 2, 9, 1, 7 };
BubbleSort(numbers);
Console.WriteLine(string.Join(", ", numbers));    // 1, 2, 5, 7, 9
// Watch the sorted region grow from the right
static void Verbose(int[] a)
{
    for (int pass = 0; pass &lt; a.Length - 1; pass++)
    {
        for (int i = 0; i &lt; a.Length - 1 - pass; i++)
            if (a[i] &gt; a[i + 1]) (a[i], a[i + 1]) = (a[i + 1], a[i]);
        Console.WriteLine($"pass {pass + 1}: {string.Join(",", a)}");
    }
}
Verbose(new[] { 5, 2, 9, 1, 7 });
// pass 1: 2,5,1,7,9   pass 2: 2,1,5,7,9   pass 3: 1,2,5,7,9
// Sorting objects works the same way
record Person(string Name, int Age);
var people = new[] { new Person("Asha", 30), new Person("Ravi", 25) };
for (int i = 0; i &lt; people.Length - 1; i++)
    if (people[i].Age &gt; people[i + 1].Age)
        (people[i], people[i + 1]) = (people[i + 1], people[i]);
Console.WriteLine(people[0].Name);                // Ravi
// In real code use the library. Note which ones are stable.
Array.Sort(numbers);                              // O(n log n), NOT stable
var byAge = people.OrderBy(p =&gt; p.Age).ToList();  // stable, returns a new list
</code></pre>

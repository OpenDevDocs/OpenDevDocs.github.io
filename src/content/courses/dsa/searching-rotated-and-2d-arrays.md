---
publishDate: 2026-07-19T15:00
title: Searching Rotated and 2D Arrays
slug: searching-rotated-and-2d-arrays
metadescription: Apply binary search to data that is only partly ordered, including rotated arrays, sorted grids and staircase searching in a matrix.
updateDate: 2026-09-07T15:00
author: ['bishal-biswas']
level: 3
tags: ['searching', 'binary search', 'matrix']
course: dsa
---

## Order you can still exploit

Binary search needs order. But it does not need **perfect** order. It needs enough structure to rule out half the data at each step.

Two common shapes qualify: a sorted array that has been rotated, and a grid sorted along its rows and columns.

## Finding the rotation point

A rotated sorted array like `[4, 5, 6, 7, 0, 1, 2]` has exactly one place where a value is followed by a smaller one. That is the minimum, and its index is the rotation amount.

```csharp
static int FindMinimum(int[] rotated)
{
    int low = 0, high = rotated.Length - 1;

    while (low < high)
    {
        int mid = low + (high - low) / 2;

        if (rotated[mid] > rotated[high]) low = mid + 1;   // minimum is to the right
        else high = mid;                                   // minimum is at mid or left
    }

    return rotated[low];
}

Console.WriteLine(FindMinimum(new[] { 4, 5, 6, 7, 0, 1, 2 }));   // 0
Console.WriteLine(FindMinimum(new[] { 1, 2, 3, 4, 5 }));         // 1, not rotated
```

Compare against `high`, not `low`. Comparing against `low` cannot distinguish a rotated array from an unrotated one, because `rotated[mid] > rotated[low]` is true in both cases.

`high = mid` rather than `mid - 1` is also deliberate. `mid` might be the minimum, so it must stay in the range.

## Two pass search

Once you know where the rotation is, the array is two sorted runs. Find the boundary, then binary search the correct one.

```csharp
static int SearchTwoPass(int[] a, int target)
{
    int pivot = FindMinimumIndex(a);

    if (pivot == 0) return BinarySearch(a, target, 0, a.Length - 1);

    if (target >= a[0]) return BinarySearch(a, target, 0, pivot - 1);

    return BinarySearch(a, target, pivot, a.Length - 1);
}

static int FindMinimumIndex(int[] a)
{
    int low = 0, high = a.Length - 1;

    while (low < high)
    {
        int mid = low + (high - low) / 2;
        if (a[mid] > a[high]) low = mid + 1;
        else high = mid;
    }

    return low;
}

static int BinarySearch(int[] a, int target, int low, int high)
{
    while (low <= high)
    {
        int mid = low + (high - low) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) low = mid + 1;
        else high = mid - 1;
    }

    return -1;
}
```

Two passes, both `O(log n)`. Easier to reason about than the single pass version, and just as fast in practice.

## Duplicates break it

If the array can contain duplicates, the guarantee disappears.

```text
[3, 3, 3, 1, 3]     low=0, mid=2, high=4
a[low] == a[mid] == a[high] == 3
```

Nothing tells you which side the rotation is on. The only safe move is to shrink the range by one and continue.

```csharp
static bool SearchWithDuplicates(int[] a, int target)
{
    int low = 0, high = a.Length - 1;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;

        if (a[mid] == target) return true;

        if (a[low] == a[mid] && a[mid] == a[high])
        {
            low++;                  // cannot tell which half is sorted
            high--;
            continue;
        }

        if (a[low] <= a[mid])
        {
            if (a[low] <= target && target < a[mid]) high = mid - 1;
            else low = mid + 1;
        }
        else
        {
            if (a[mid] < target && target <= a[high]) low = mid + 1;
            else high = mid - 1;
        }
    }

    return false;
}
```

That fallback makes the worst case `O(n)`, for an array of all identical values. Unavoidable, and worth stating out loud in an interview.

## A fully sorted matrix

Some grids are sorted so that reading row by row gives one sorted sequence.

```text
 1   3   5   7
10  11  16  20
23  30  34  60
```

Treat it as a flat array of length `rows * columns` and convert the index back.

```csharp
static bool SearchSortedMatrix(int[,] matrix, int target)
{
    int rows = matrix.GetLength(0), cols = matrix.GetLength(1);
    int low = 0, high = rows * cols - 1;

    while (low <= high)
    {
        int mid = low + (high - low) / 2;
        int value = matrix[mid / cols, mid % cols];      // flat index to row and column

        if (value == target) return true;

        if (value < target) low = mid + 1;
        else high = mid - 1;
    }

    return false;
}

int[,] matrix =
{
    { 1, 3, 5, 7 },
    { 10, 11, 16, 20 },
    { 23, 30, 34, 60 }
};

Console.WriteLine(SearchSortedMatrix(matrix, 16));   // True
Console.WriteLine(SearchSortedMatrix(matrix, 15));   // False
```

`mid / cols` gives the row and `mid % cols` gives the column. `O(log(rows * cols))`, with no extra memory.

## A row and column sorted matrix

A weaker guarantee: each row increases left to right and each column increases top to bottom, but the last item of a row can be larger than the first item of the next.

```text
 1   4   7  11
 2   5   8  12
 3   6   9  16
10  13  14  17
```

The flat trick fails here, because reading row by row does not give a sorted sequence.

The **staircase search** does work. Start at the top right corner.

```csharp
static bool SearchStaircase(int[,] matrix, int target)
{
    int row = 0;
    int col = matrix.GetLength(1) - 1;      // top right corner

    while (row < matrix.GetLength(0) && col >= 0)
    {
        int value = matrix[row, col];

        if (value == target) return true;

        if (value > target) col--;          // too big, everything below is bigger too
        else row++;                         // too small, everything left is smaller too
    }

    return false;
}

Console.WriteLine(SearchStaircase(matrix, 5));    // True
Console.WriteLine(SearchStaircase(matrix, 15));   // False
```

The top right corner is special because it is the largest in its row and the smallest in its column. So every comparison eliminates an entire row or an entire column.

That gives `O(rows + cols)`, not `O(log)`, but for a square grid of `n` cells that is `O(sqrt(n))`, which is excellent.

Starting at the bottom left works equally well. Starting at the top left or bottom right does not, because neither comparison eliminates anything.

## Counting smaller values in a matrix

The staircase idea also counts. How many values are less than or equal to a target?

```csharp
static int CountLessOrEqual(int[,] matrix, int target)
{
    int rows = matrix.GetLength(0), cols = matrix.GetLength(1);
    int row = rows - 1, col = 0;            // bottom left
    int count = 0;

    while (row >= 0 && col < cols)
    {
        if (matrix[row, col] <= target)
        {
            count += row + 1;               // this whole column above is smaller
            col++;
        }
        else
        {
            row--;
        }
    }

    return count;
}
```

Combine this with binary search on the answer and you can find the Kth smallest value in a sorted matrix in `O(n log(range))`.

## Peak finding

Binary search also works on data with no global order at all, as long as a local rule points the way.

A peak is any element greater than both its neighbours. In any array where neighbours differ, a peak must exist.

```csharp
static int FindPeak(int[] a)
{
    int low = 0, high = a.Length - 1;

    while (low < high)
    {
        int mid = low + (high - low) / 2;

        if (a[mid] < a[mid + 1]) low = mid + 1;   // uphill, a peak lies to the right
        else high = mid;                          // downhill or flat, peak at mid or left
    }

    return low;
}

Console.WriteLine(FindPeak(new[] { 1, 2, 3, 1 }));          // 2
Console.WriteLine(FindPeak(new[] { 1, 2, 1, 3, 5, 6, 4 })); // 1 or 5
```

`O(log n)` on completely unsorted data. The array is not sorted, but "the slope goes up" is enough of a rule to discard half of it.

## Quick recap

- Binary search needs enough structure to discard half, not full sorted order.
- Compare against `high` when hunting a rotation point, never against `low`.
- Duplicates in a rotated array force an `O(n)` worst case.
- A fully sorted matrix can be treated as a flat array with `mid / cols` and `mid % cols`.
- A row and column sorted matrix needs a staircase search from the top right.
- Staircase search is `O(rows + cols)` because each step removes a whole row or column.
- A local uphill rule is enough to find a peak in `O(log n)` with no sorting at all.

<code id="code-content" class="language-csharp">
// Rotation point: compare against HIGH, not low
static int FindMinimumIndex(int[] a)
{
    int low = 0, high = a.Length - 1;
    while (low &lt; high)
    {
        int mid = low + (high - low) / 2;
        if (a[mid] &gt; a[high]) low = mid + 1;    // minimum is to the right
        else high = mid;                        // mid might BE the minimum
    }
    return low;
}
var rotated = new[] { 4, 5, 6, 7, 0, 1, 2 };
Console.WriteLine(rotated[FindMinimumIndex(rotated)]);   // 0
// Duplicates break the guarantee: [3,3,3,1,3] tells you nothing at the midpoint.
// Shrink both ends by one and continue. Worst case becomes O(n).
// A FULLY sorted matrix is just a flat array
static bool SearchSortedMatrix(int[,] m, int target)
{
    int cols = m.GetLength(1);
    int low = 0, high = m.GetLength(0) * cols - 1;
    while (low &lt;= high)
    {
        int mid = low + (high - low) / 2;
        int value = m[mid / cols, mid % cols];  // flat index back to row, column
        if (value == target) return true;
        if (value &lt; target) low = mid + 1; else high = mid - 1;
    }
    return false;
}
int[,] sorted = { { 1, 3, 5, 7 }, { 10, 11, 16, 20 }, { 23, 30, 34, 60 } };
Console.WriteLine(SearchSortedMatrix(sorted, 16));       // True
// Rows and columns sorted separately? Staircase from the TOP RIGHT.
// That corner is the largest in its row and smallest in its column,
// so every comparison eliminates a whole row or a whole column.
static bool SearchStaircase(int[,] m, int target)
{
    int row = 0, col = m.GetLength(1) - 1;
    while (row &lt; m.GetLength(0) &amp;&amp; col &gt;= 0)
    {
        int value = m[row, col];
        if (value == target) return true;
        if (value &gt; target) col--;              // everything below is bigger too
        else row++;                             // everything left is smaller too
    }
    return false;
}
int[,] grid = { { 1, 4, 7, 11 }, { 2, 5, 8, 12 }, { 3, 6, 9, 16 }, { 10, 13, 14, 17 } };
Console.WriteLine(SearchStaircase(grid, 5));             // True, in O(rows + cols)
// No order at all? A local rule is still enough. Find a peak in O(log n).
static int FindPeak(int[] a)
{
    int low = 0, high = a.Length - 1;
    while (low &lt; high)
    {
        int mid = low + (high - low) / 2;
        if (a[mid] &lt; a[mid + 1]) low = mid + 1; // uphill, a peak is to the right
        else high = mid;
    }
    return low;
}
Console.WriteLine(FindPeak(new[] { 1, 2, 3, 1 }));        // 2
</code></pre>

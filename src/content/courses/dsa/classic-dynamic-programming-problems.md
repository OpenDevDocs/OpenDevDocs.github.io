---
publishDate: 2026-07-29T18:50
title: Classic Dynamic Programming Problems
slug: classic-dynamic-programming-problems
metadescription: Work through knapsack, edit distance, subsequences and partition problems, and see the patterns that connect them.
updateDate: 2026-09-07T18:50
author: ['bishal-biswas']
level: 3
tags: ['dynamic programming', 'problems', 'algorithms']
course: dsa
---

## The families

Most dynamic programming problems belong to one of a handful of families. Learn one member of each and the rest become recognisable.

- **Knapsack:** choose items under a limit.
- **Sequence alignment:** compare two sequences.
- **Subsequence:** find the best subsequence of one sequence.
- **Partition:** split into groups.
- **Grid:** move through a two dimensional space.

## The knapsack family

### 0/1 knapsack

Items with weights and values, one bag with a capacity. Each item is taken or not.

```csharp
static int Knapsack(int[] weights, int[] values, int capacity)
{
    var best = new int[capacity + 1];

    for (int i = 0; i < weights.Length; i++)
    {
        for (int c = capacity; c >= weights[i]; c--)    // backwards, one use each
        {
            best[c] = Math.Max(best[c], values[i] + best[c - weights[i]]);
        }
    }

    return best[capacity];
}

Console.WriteLine(Knapsack(new[] { 1, 3, 4, 5 }, new[] { 1, 4, 5, 7 }, 7));   // 9
```

### Unbounded knapsack

Unlimited copies of each item. One character changes: the inner loop runs forwards.

```csharp
static int UnboundedKnapsack(int[] weights, int[] values, int capacity)
{
    var best = new int[capacity + 1];

    for (int i = 0; i < weights.Length; i++)
    {
        for (int c = weights[i]; c <= capacity; c++)    // forwards, reuse allowed
        {
            best[c] = Math.Max(best[c], values[i] + best[c - weights[i]]);
        }
    }

    return best[capacity];
}
```

Going forwards means `best[c - weight]` may already include this item, which is exactly what allows reuse. That one loop direction separates two different problems.

### Subset sum

Can any subset add up exactly to a target? The knapsack shape with booleans.

```csharp
static bool CanMakeSum(int[] numbers, int target)
{
    var possible = new bool[target + 1];
    possible[0] = true;                        // the empty subset makes zero

    foreach (int n in numbers)
    {
        for (int sum = target; sum >= n; sum--)
        {
            possible[sum] = possible[sum] || possible[sum - n];
        }
    }

    return possible[target];
}

Console.WriteLine(CanMakeSum(new[] { 3, 34, 4, 12, 5, 2 }, 9));   // True
```

### Equal partition

Can the numbers be split into two halves with equal sums? This is subset sum for half the total.

```csharp
static bool CanPartitionEqually(int[] numbers)
{
    int total = numbers.Sum();

    if (total % 2 != 0) return false;          // an odd total cannot split evenly

    return CanMakeSum(numbers, total / 2);
}

Console.WriteLine(CanPartitionEqually(new[] { 1, 5, 11, 5 }));   // True
Console.WriteLine(CanPartitionEqually(new[] { 1, 2, 3, 5 }));    // False
```

Recognising that a new problem is an old one in disguise is most of the skill here.

## The sequence alignment family

### Edit distance

The fewest single character edits turning one string into another. Used in spell checkers, diff tools and fuzzy search.

```csharp
static int EditDistance(string a, string b)
{
    var distance = new int[a.Length + 1, b.Length + 1];

    for (int i = 0; i <= a.Length; i++) distance[i, 0] = i;    // delete everything
    for (int j = 0; j <= b.Length; j++) distance[0, j] = j;    // insert everything

    for (int i = 1; i <= a.Length; i++)
    {
        for (int j = 1; j <= b.Length; j++)
        {
            if (a[i - 1] == b[j - 1])
            {
                distance[i, j] = distance[i - 1, j - 1];       // free, they match
            }
            else
            {
                distance[i, j] = 1 + Math.Min(
                    distance[i - 1, j - 1],      // replace
                    Math.Min(
                        distance[i - 1, j],      // delete from a
                        distance[i, j - 1]));    // insert into a
            }
        }
    }

    return distance[a.Length, b.Length];
}

Console.WriteLine(EditDistance("kitten", "sitting"));   // 3
```

The three options map exactly to the three edits. Once you see that, the recurrence is obvious rather than memorised.

The base row and column are the cost of turning a string into an empty one, which is its length.

### Longest common subsequence

The longest sequence appearing in both, not necessarily contiguously. This is what `git diff` is built on.

```csharp
static int Lcs(string a, string b)
{
    var length = new int[a.Length + 1, b.Length + 1];

    for (int i = 1; i <= a.Length; i++)
    {
        for (int j = 1; j <= b.Length; j++)
        {
            length[i, j] = a[i - 1] == b[j - 1]
                ? length[i - 1, j - 1] + 1                          // extend the match
                : Math.Max(length[i - 1, j], length[i, j - 1]);     // skip one side
        }
    }

    return length[a.Length, b.Length];
}

Console.WriteLine(Lcs("ABCBDAB", "BDCABA"));   // 4, "BCBA"
```

### Longest common substring

Contiguous this time, and the change is small but important.

```csharp
static int LongestCommonSubstring(string a, string b)
{
    var length = new int[a.Length + 1, b.Length + 1];
    int best = 0;

    for (int i = 1; i <= a.Length; i++)
    {
        for (int j = 1; j <= b.Length; j++)
        {
            if (a[i - 1] != b[j - 1]) continue;      // a mismatch resets to zero

            length[i, j] = length[i - 1, j - 1] + 1;
            best = Math.Max(best, length[i, j]);
        }
    }

    return best;
}

Console.WriteLine(LongestCommonSubstring("ABCBDAB", "BDCABA"));   // 2, "AB"
```

Two differences from the subsequence version. A mismatch leaves the cell at zero rather than carrying a value forward, and the answer is the maximum anywhere in the table rather than the final cell.

## The subsequence family

### Longest increasing subsequence in O(n log n)

The `O(n^2)` version was in the previous topic. This one is faster and worth knowing.

```csharp
static int LongestIncreasing(int[] numbers)
{
    var tails = new List<int>();      // tails[k] = smallest tail of a subsequence of length k+1

    foreach (int n in numbers)
    {
        int position = tails.BinarySearch(n);

        if (position < 0) position = ~position;

        if (position == tails.Count) tails.Add(n);
        else tails[position] = n;                     // a smaller tail is always better
    }

    return tails.Count;
}

Console.WriteLine(LongestIncreasing(new[] { 10, 9, 2, 5, 3, 7, 101, 18 }));   // 4
```

`tails` is **not** the actual subsequence. It holds, for each possible length, the smallest value that could end a subsequence of that length. Its length is the answer.

Replacing a tail with a smaller value never shortens what can follow, which is why the greedy replacement is safe.

### Maximum subarray sum

Kadane's algorithm, and the simplest useful dynamic programming there is.

```csharp
static int MaxSubarraySum(int[] numbers)
{
    int best = numbers[0], current = numbers[0];

    for (int i = 1; i < numbers.Length; i++)
    {
        current = Math.Max(numbers[i], current + numbers[i]);
        best = Math.Max(best, current);
    }

    return best;
}

Console.WriteLine(MaxSubarraySum(new[] { -2, 1, -3, 4, -1, 2, 1, -5, 4 }));   // 6
```

`current` is the best sum ending at `i`. Either extend the previous run, or start fresh here. Starting fresh is better exactly when the previous run was negative.

`O(n)` time, `O(1)` space, and it is dynamic programming with the table reduced to a single variable.

## The grid family

### Unique paths

How many ways from the top left to the bottom right, moving only right or down?

```csharp
static long UniquePaths(int rows, int cols)
{
    var ways = new long[cols];
    Array.Fill(ways, 1);                    // the top row has one way to each cell

    for (int r = 1; r < rows; r++)
    {
        for (int c = 1; c < cols; c++)
        {
            ways[c] += ways[c - 1];         // from above, plus from the left
        }
    }

    return ways[cols - 1];
}

Console.WriteLine(UniquePaths(3, 7));   // 28
```

`ways[c]` holds the row above until it is updated, so `ways[c] += ways[c - 1]` reads above and left with one array.

### Minimum path sum

```csharp
static int MinPathSum(int[,] grid)
{
    int rows = grid.GetLength(0), cols = grid.GetLength(1);
    var best = new int[cols];

    best[0] = grid[0, 0];
    for (int c = 1; c < cols; c++) best[c] = best[c - 1] + grid[0, c];

    for (int r = 1; r < rows; r++)
    {
        best[0] += grid[r, 0];

        for (int c = 1; c < cols; c++)
        {
            best[c] = Math.Min(best[c], best[c - 1]) + grid[r, c];
        }
    }

    return best[cols - 1];
}

int[,] costs =
{
    { 1, 3, 1 },
    { 1, 5, 1 },
    { 4, 2, 1 }
};

Console.WriteLine(MinPathSum(costs));   // 7
```

## Palindromic substrings

```csharp
static string LongestPalindrome(string text)
{
    if (text.Length < 2) return text;

    int start = 0, best = 1;

    void Expand(int left, int right)
    {
        while (left >= 0 && right < text.Length && text[left] == text[right])
        {
            left--;
            right++;
        }

        int length = right - left - 1;

        if (length > best)
        {
            best = length;
            start = left + 1;
        }
    }

    for (int i = 0; i < text.Length; i++)
    {
        Expand(i, i);       // odd length, centred on a character
        Expand(i, i + 1);   // even length, centred between two
    }

    return text.Substring(start, best);
}

Console.WriteLine(LongestPalindrome("babad"));   // bab
```

Expanding around centres is `O(n^2)` time and `O(1)` space, better than the `O(n^2)` space table version. Both centre types must be tried, or every even length palindrome is missed.

## The patterns to carry away

**Take it or skip it.** Knapsack, house robber, subset sum.

**Compare two sequences.** A two dimensional table indexed by both positions. Edit distance, LCS.

**Best ending here.** Kadane, longest increasing subsequence. One value per position, then take the maximum.

**Reach this state.** Coin change, climbing stairs. Build up from smaller targets.

**Move through a grid.** Two dimensional, usually reducible to one row.

When you meet a new problem, ask which of these it resembles. It almost always resembles one.

## Quick recap

- 0/1 knapsack iterates capacity backwards, unbounded iterates forwards.
- Subset sum and equal partition are knapsack with booleans.
- Edit distance's three options are exactly replace, delete and insert.
- Common substring resets on a mismatch, common subsequence carries the best forward.
- Kadane's algorithm is dynamic programming with a single variable.
- Longest increasing subsequence in `O(n log n)` tracks smallest tails, not the sequence.
- Expanding around centres finds the longest palindrome in `O(1)` space.

<code id="code-content" class="language-csharp">
// 0/1 knapsack: capacity BACKWARDS means each item is used at most once
static int Knapsack(int[] weights, int[] values, int capacity)
{
    var best = new int[capacity + 1];
    for (int i = 0; i &lt; weights.Length; i++)
        for (int c = capacity; c &gt;= weights[i]; c--)
            best[c] = Math.Max(best[c], values[i] + best[c - weights[i]]);
    return best[capacity];
}
Console.WriteLine(Knapsack(new[] { 1, 3, 4, 5 }, new[] { 1, 4, 5, 7 }, 7));   // 9
// Forwards instead, and it becomes UNBOUNDED knapsack. One loop direction.
// Subset sum: the same shape with booleans
static bool CanMakeSum(int[] numbers, int target)
{
    var possible = new bool[target + 1];
    possible[0] = true;                        // the empty subset makes zero
    foreach (int n in numbers)
        for (int sum = target; sum &gt;= n; sum--)
            possible[sum] = possible[sum] || possible[sum - n];
    return possible[target];
}
Console.WriteLine(CanMakeSum(new[] { 1, 5, 11, 5 }, 11));   // True
// Edit distance: the three options ARE replace, delete and insert
static int EditDistance(string a, string b)
{
    var d = new int[a.Length + 1, b.Length + 1];
    for (int i = 0; i &lt;= a.Length; i++) d[i, 0] = i;
    for (int j = 0; j &lt;= b.Length; j++) d[0, j] = j;
    for (int i = 1; i &lt;= a.Length; i++)
        for (int j = 1; j &lt;= b.Length; j++)
            d[i, j] = a[i - 1] == b[j - 1]
                ? d[i - 1, j - 1]
                : 1 + Math.Min(d[i - 1, j - 1], Math.Min(d[i - 1, j], d[i, j - 1]));
    return d[a.Length, b.Length];
}
Console.WriteLine(EditDistance("kitten", "sitting"));       // 3
// Kadane: dynamic programming with the table reduced to one variable
static int MaxSubarraySum(int[] n)
{
    int best = n[0], current = n[0];
    for (int i = 1; i &lt; n.Length; i++)
    {
        current = Math.Max(n[i], current + n[i]);   // extend, or start fresh here
        best = Math.Max(best, current);
    }
    return best;
}
Console.WriteLine(MaxSubarraySum(new[] { -2, 1, -3, 4, -1, 2, 1, -5, 4 }));   // 6
// Longest increasing subsequence in O(n log n): tails holds the SMALLEST
// value that could end a subsequence of each length, not the sequence itself
static int LongestIncreasing(int[] numbers)
{
    var tails = new List&lt;int&gt;();
    foreach (int n in numbers)
    {
        int pos = tails.BinarySearch(n);
        if (pos &lt; 0) pos = ~pos;
        if (pos == tails.Count) tails.Add(n); else tails[pos] = n;
    }
    return tails.Count;
}
Console.WriteLine(LongestIncreasing(new[] { 10, 9, 2, 5, 3, 7, 101, 18 }));   // 4
</code></pre>

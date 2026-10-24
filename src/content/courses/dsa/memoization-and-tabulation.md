---
publishDate: 2026-07-29T18:40
title: Memoization and Tabulation
slug: memoization-and-tabulation
metadescription: Compare top down caching with bottom up tables, convert between them, and cut memory by keeping only the rows you still need.
updateDate: 2026-09-07T18:40
author: ['bishal-biswas']
level: 3
tags: ['dynamic programming', 'memoisation', 'optimisation']
course: dsa
---

## Two ways to remember

Dynamic programming has two styles, and they compute the same answers in opposite directions.

**Memoisation is top down.** Write the natural recursion, and cache each result. Subproblems are solved lazily, when something asks for them.

**Tabulation is bottom up.** Fill a table starting from the base cases, working forward until you reach the answer. Everything is computed, in a fixed order.

## The same problem, both ways

```csharp
// Top down: recursion plus a cache
static long FibMemo(int n, long[]? memo = null)
{
    memo ??= new long[n + 1];

    if (n <= 1) return n;
    if (memo[n] != 0) return memo[n];

    return memo[n] = FibMemo(n - 1, memo) + FibMemo(n - 2, memo);
}

// Bottom up: fill a table forwards
static long FibTable(int n)
{
    if (n <= 1) return n;

    var table = new long[n + 1];
    table[0] = 0;
    table[1] = 1;

    for (int i = 2; i <= n; i++) table[i] = table[i - 1] + table[i - 2];

    return table[n];
}
```

Both are `O(n)` time and `O(n)` space.

Note the memoised version uses `memo[n] != 0` as the "not computed" test, which happens to work here only because `Fibonacci(0)` is 0 and is handled by the base case. In general, use a sentinel like `-1` or a nullable array, because 0 is often a legitimate answer.

```csharp
var memo = new int[n + 1];
Array.Fill(memo, -1);          // -1 means not yet computed
```

## Which to use

```text
                          Memoisation             Tabulation
Direction                 top down                bottom up
Written as                recursion plus a cache  loops over a table
Computes                  only what is needed     every state
Stack overflow risk       yes, on deep recursion  no
Easier to write first     usually                 sometimes
Easier to optimise memory harder                  easy, drop old rows
Speed                     slightly slower         slightly faster
```

**Start with memoisation.** Write the plain recursion, confirm it is correct, then add a cache. The logic stays readable, and only the states you actually need get computed.

**Switch to tabulation** when recursion depth is a risk, when you need every state anyway, or when you want to cut the memory down.

## When memoisation genuinely wins

If a large part of the state space is unreachable, tabulation wastes time filling it.

```csharp
// Only a few amounts are reachable with these coins
static int FewestCoins(int target, int[] coins, Dictionary<int, int>? memo = null)
{
    if (target == 0) return 0;
    if (target < 0) return -1;

    memo ??= new Dictionary<int, int>();

    if (memo.TryGetValue(target, out int cached)) return cached;

    int best = int.MaxValue;

    foreach (int coin in coins)
    {
        int rest = FewestCoins(target - coin, coins, memo);

        if (rest >= 0 && rest + 1 < best) best = rest + 1;
    }

    return memo[target] = best == int.MaxValue ? -1 : best;
}

Console.WriteLine(FewestCoins(6, new[] { 1, 3, 4 }));   // 2
```

With coins of 100 and 500 and a target of 10,000, tabulation fills 10,000 entries. Memoisation touches only the multiples that matter.

## Converting between them

Turning memoisation into tabulation is mechanical.

1. Look at what the recursion depends on.
2. Fill the table in an order that computes dependencies first.
3. Replace recursive calls with table lookups.

```csharp
// Top down
static int Rob(int[] money, int i, int[] memo)
{
    if (i < 0) return 0;
    if (memo[i] != -1) return memo[i];

    return memo[i] = Math.Max(Rob(money, i - 1, memo),
                              money[i] + Rob(money, i - 2, memo));
}

// Bottom up: the same recurrence, filled forwards
static int RobTable(int[] money)
{
    if (money.Length == 0) return 0;

    var best = new int[money.Length + 2];      // two extra slots remove the i < 0 case

    for (int i = 0; i < money.Length; i++)
    {
        best[i + 2] = Math.Max(best[i + 1], money[i] + best[i]);
    }

    return best[^1];
}
```

Padding the table by two removes every negative index check, which is a trick worth reusing. The alternative is scattering `i >= 0 ?` conditions through the loop.

## Cutting the memory

The big advantage of tabulation. If a row only depends on the last one or two, you do not need the whole table.

```csharp
// O(n) memory
static long FibTable(int n)
{
    var table = new long[n + 1];
    table[0] = 0;
    table[1] = 1;
    for (int i = 2; i <= n; i++) table[i] = table[i - 1] + table[i - 2];
    return table[n];
}

// O(1) memory
static long FibRolling(int n)
{
    if (n <= 1) return n;

    long previous = 0, current = 1;

    for (int i = 2; i <= n; i++)
    {
        (previous, current) = (current, previous + current);
    }

    return current;
}
```

From an array of a million longs to two variables.

The same trick on a two dimensional table keeps two rows instead of the whole grid.

```csharp
// The full grid: O(n * m) memory
static int LongestCommonSubsequence(string a, string b)
{
    var table = new int[a.Length + 1, b.Length + 1];

    for (int i = 1; i <= a.Length; i++)
    {
        for (int j = 1; j <= b.Length; j++)
        {
            table[i, j] = a[i - 1] == b[j - 1]
                ? table[i - 1, j - 1] + 1
                : Math.Max(table[i - 1, j], table[i, j - 1]);
        }
    }

    return table[a.Length, b.Length];
}

// Two rows: O(m) memory
static int LcsTwoRows(string a, string b)
{
    var previous = new int[b.Length + 1];
    var current = new int[b.Length + 1];

    for (int i = 1; i <= a.Length; i++)
    {
        for (int j = 1; j <= b.Length; j++)
        {
            current[j] = a[i - 1] == b[j - 1]
                ? previous[j - 1] + 1
                : Math.Max(previous[j], current[j - 1]);
        }

        (previous, current) = (current, previous);      // swap, do not copy
    }

    return previous[b.Length];
}

Console.WriteLine(LcsTwoRows("ABCBDAB", "BDCABA"));   // 4
```

Swapping the array references rather than copying keeps it `O(1)` per row.

For 10,000 character strings this is the difference between 400 MB and 40 KB.

## The catch with memory optimisation

Dropping old rows means you can no longer **reconstruct the answer**, only its size.

```csharp
static string ReconstructLcs(string a, string b)
{
    var table = new int[a.Length + 1, b.Length + 1];

    for (int i = 1; i <= a.Length; i++)
    {
        for (int j = 1; j <= b.Length; j++)
        {
            table[i, j] = a[i - 1] == b[j - 1]
                ? table[i - 1, j - 1] + 1
                : Math.Max(table[i - 1, j], table[i, j - 1]);
        }
    }

    // walk backwards through the full table
    var result = new System.Text.StringBuilder();
    int x = a.Length, y = b.Length;

    while (x > 0 && y > 0)
    {
        if (a[x - 1] == b[y - 1])
        {
            result.Insert(0, a[x - 1]);
            x--;
            y--;
        }
        else if (table[x - 1, y] >= table[x, y - 1])
        {
            x--;
        }
        else
        {
            y--;
        }
    }

    return result.ToString();
}

Console.WriteLine(ReconstructLcs("ABCBDAB", "BDCABA"));   // BCBA
```

So keep the full table when you need the actual answer, and use rolling rows when the number is enough.

## Multi dimensional state

Some problems need two or more values to describe a state.

```csharp
// Knapsack: state is (item index, remaining capacity)
static int Knapsack(int[] weights, int[] values, int capacity)
{
    int n = weights.Length;
    var best = new int[n + 1, capacity + 1];

    for (int i = 1; i <= n; i++)
    {
        for (int c = 0; c <= capacity; c++)
        {
            best[i, c] = best[i - 1, c];                        // skip this item

            if (weights[i - 1] <= c)
            {
                int take = values[i - 1] + best[i - 1, c - weights[i - 1]];
                best[i, c] = Math.Max(best[i, c], take);        // or take it
            }
        }
    }

    return best[n, capacity];
}

Console.WriteLine(Knapsack(new[] { 1, 3, 4, 5 }, new[] { 1, 4, 5, 7 }, 7));   // 9
```

Since each row only reads the row above, this compresses to one dimension. The catch: iterate capacity **backwards**, or you would use an item twice.

```csharp
static int KnapsackOneRow(int[] weights, int[] values, int capacity)
{
    var best = new int[capacity + 1];

    for (int i = 0; i < weights.Length; i++)
    {
        for (int c = capacity; c >= weights[i]; c--)     // backwards, deliberately
        {
            best[c] = Math.Max(best[c], values[i] + best[c - weights[i]]);
        }
    }

    return best[capacity];
}
```

Going forwards would read a value already updated by this same item, letting you take it more than once. That is actually the correct loop for the **unbounded** knapsack, where reuse is allowed. The direction of one loop switches between two different problems.

## Quick recap

- Memoisation is top down recursion plus a cache, tabulation is a bottom up table.
- Start with memoisation, since it is closer to the natural recursion.
- Use a sentinel like `-1` for "not computed", because 0 is often a real answer.
- Memoisation wins when much of the state space is unreachable.
- Tabulation avoids stack overflows and makes memory optimisation easy.
- Keep only the rows you still need to cut memory from `O(n * m)` to `O(m)`.
- You need the full table to reconstruct the answer, not just its size.

<code id="code-content" class="language-csharp">
// Top down: the natural recursion, plus a cache
static long FibMemo(int n, Dictionary&lt;int, long&gt;? memo = null)
{
    if (n &lt;= 1) return n;
    memo ??= new Dictionary&lt;int, long&gt;();
    if (memo.TryGetValue(n, out long cached)) return cached;
    return memo[n] = FibMemo(n - 1, memo) + FibMemo(n - 2, memo);
}
// Bottom up: fill a table forwards from the base cases
static long FibTable(int n)
{
    if (n &lt;= 1) return n;
    var table = new long[n + 1];
    table[1] = 1;
    for (int i = 2; i &lt;= n; i++) table[i] = table[i - 1] + table[i - 2];
    return table[n];
}
// Use -1 as "not computed". Zero is usually a legitimate answer.
var memo = new int[10];
Array.Fill(memo, -1);
// Tabulation makes memory optimisation easy: keep only what you still need
static long FibRolling(int n)                  // O(1) memory instead of O(n)
{
    if (n &lt;= 1) return n;
    long previous = 0, current = 1;
    for (int i = 2; i &lt;= n; i++) (previous, current) = (current, previous + current);
    return current;
}
Console.WriteLine(FibRolling(90));
// Two rows instead of a full grid: O(n*m) becomes O(m)
static int Lcs(string a, string b)
{
    var previous = new int[b.Length + 1];
    var current = new int[b.Length + 1];
    for (int i = 1; i &lt;= a.Length; i++)
    {
        for (int j = 1; j &lt;= b.Length; j++)
            current[j] = a[i - 1] == b[j - 1]
                ? previous[j - 1] + 1
                : Math.Max(previous[j], current[j - 1]);
        (previous, current) = (current, previous);   // swap references, do not copy
    }
    return previous[b.Length];
}
Console.WriteLine(Lcs("ABCBDAB", "BDCABA"));   // 4
// The catch: dropping rows means you can no longer RECONSTRUCT the answer,
// only its size. Keep the full table when you need the actual sequence.
// Knapsack in one row: iterate capacity BACKWARDS or you reuse an item
static int Knapsack(int[] weights, int[] values, int capacity)
{
    var best = new int[capacity + 1];
    for (int i = 0; i &lt; weights.Length; i++)
        for (int c = capacity; c &gt;= weights[i]; c--)      // forwards = unbounded
            best[c] = Math.Max(best[c], values[i] + best[c - weights[i]]);
    return best[capacity];
}
Console.WriteLine(Knapsack(new[] { 1, 3, 4, 5 }, new[] { 1, 4, 5, 7 }, 7));   // 9
</code></pre>

---
publishDate: 2026-07-28T18:30
title: Introduction to Dynamic Programming
slug: introduction-to-dynamic-programming
metadescription: Recognise overlapping subproblems, turn exponential recursion into linear work, and learn the four steps that solve any DP problem.
updateDate: 2026-09-07T18:30
author: ['bishal-biswas']
level: 3
tags: ['dynamic programming', 'recursion', 'optimisation']
course: dsa
---

## The problem it solves

Some recursive solutions are correct and catastrophically slow, because they solve the same subproblem over and over.

```csharp
static long Fibonacci(int n)
{
    if (n <= 1) return n;
    return Fibonacci(n - 1) + Fibonacci(n - 2);
}
```

`Fibonacci(40)` makes over 300 million calls. `Fibonacci(50)` will not finish today.

Look at what happens:

```text
                    F(5)
              /             \
          F(4)               F(3)
        /      \            /     \
     F(3)      F(2)      F(2)     F(1)
    /    \    /    \    /    \
  F(2)  F(1) F(1) F(0) F(1) F(0)
```

`F(3)` is computed twice. `F(2)` three times. For `F(50)`, some values are computed billions of times.

**Dynamic programming** is the observation that you only need to compute each one **once** and remember the answer.

```csharp
static long Fibonacci(int n, Dictionary<int, long>? memo = null)
{
    if (n <= 1) return n;

    memo ??= new Dictionary<int, long>();

    if (memo.TryGetValue(n, out long cached)) return cached;

    return memo[n] = Fibonacci(n - 1, memo) + Fibonacci(n - 2, memo);
}

Console.WriteLine(Fibonacci(90));   // instant
```

From `O(2^n)` to `O(n)` by adding a dictionary. Same recursion, same logic, one cache.

## The two conditions

Dynamic programming applies when a problem has both of these.

**Overlapping subproblems.** The same smaller problems come up repeatedly. Fibonacci has this. Merge sort does not, because each half is different every time, which is why merge sort is divide and conquer rather than dynamic programming.

**Optimal substructure.** The best answer is built from the best answers to smaller pieces. The shortest route from A to C via B contains the shortest route from A to B.

Both must hold. Missing the first means caching buys nothing. Missing the second means combining smaller answers gives the wrong result.

## The four steps

Every dynamic programming problem is solved the same way.

**1. Define the state.** What does the answer depend on? This is usually the hardest part and gets its own name: `dp[i]` means "the answer for the first `i` items", or "the answer if I am at position `i`".

**2. Write the recurrence.** How does the answer for one state depend on smaller states?

**3. Find the base cases.** The smallest states you can answer directly.

**4. Decide the order.** Top down with memoisation, or bottom up with a table.

## Worked example: climbing stairs

You can climb 1 or 2 steps at a time. How many ways to reach step `n`?

**State:** `ways[i]` is the number of ways to reach step `i`.

**Recurrence:** you arrive at step `i` either from `i - 1` or from `i - 2`, so `ways[i] = ways[i - 1] + ways[i - 2]`.

**Base cases:** `ways[0] = 1`, one way to stand still. `ways[1] = 1`.

**Order:** bottom up, since every state depends only on smaller ones.

```csharp
static long ClimbStairs(int n)
{
    if (n <= 1) return 1;

    var ways = new long[n + 1];
    ways[0] = 1;
    ways[1] = 1;

    for (int i = 2; i <= n; i++) ways[i] = ways[i - 1] + ways[i - 2];

    return ways[n];
}

Console.WriteLine(ClimbStairs(10));   // 89
```

Recognising this as Fibonacci is the moment dynamic programming clicks for most people. Many problems are the same recurrence in different clothing.

## House robber

Houses in a row with money in each. You cannot rob two adjacent houses. Maximise the total.

**State:** `best[i]` is the most you can take from the first `i` houses.

**Recurrence:** at house `i` you either skip it, keeping `best[i - 1]`, or rob it, getting `money[i] + best[i - 2]`. Take the larger.

```csharp
static int Rob(int[] money)
{
    if (money.Length == 0) return 0;
    if (money.Length == 1) return money[0];

    var best = new int[money.Length];
    best[0] = money[0];
    best[1] = Math.Max(money[0], money[1]);

    for (int i = 2; i < money.Length; i++)
    {
        best[i] = Math.Max(best[i - 1], money[i] + best[i - 2]);
    }

    return best[^1];
}

Console.WriteLine(Rob(new[] { 2, 7, 9, 3, 1 }));   // 12, houses 0, 2 and 4
```

"Take it or leave it, then take the better outcome" is the single most common dynamic programming recurrence. You will see it constantly.

## Coin change, done properly

The greedy version fails on arbitrary denominations. This does not.

**State:** `fewest[amount]` is the smallest number of coins making that amount.

**Recurrence:** for each coin, `fewest[amount] = 1 + fewest[amount - coin]`, taking the best coin.

```csharp
static int FewestCoins(int target, int[] coins)
{
    var fewest = new int[target + 1];
    Array.Fill(fewest, int.MaxValue);
    fewest[0] = 0;                                 // zero coins make zero

    for (int amount = 1; amount <= target; amount++)
    {
        foreach (int coin in coins)
        {
            if (coin > amount) continue;
            if (fewest[amount - coin] == int.MaxValue) continue;   // unreachable

            fewest[amount] = Math.Min(fewest[amount], fewest[amount - coin] + 1);
        }
    }

    return fewest[target] == int.MaxValue ? -1 : fewest[target];
}

Console.WriteLine(FewestCoins(6, new[] { 1, 3, 4 }));    // 2, the greedy answer was 3
Console.WriteLine(FewestCoins(11, new[] { 1, 2, 5 }));   // 3
Console.WriteLine(FewestCoins(3, new[] { 2 }));          // -1, impossible
```

The unreachable check matters. Adding 1 to `int.MaxValue` overflows to a negative number, which then looks like the best answer.

Every amount is tried against every coin, so this is `O(target * coins)`.

## Longest increasing subsequence

**State:** `longest[i]` is the length of the longest increasing subsequence **ending at** index `i`.

That "ending at" wording is important. Defining it as "within the first `i` items" makes the recurrence much harder, because you lose track of the last value.

```csharp
static int LongestIncreasing(int[] numbers)
{
    if (numbers.Length == 0) return 0;

    var longest = new int[numbers.Length];
    Array.Fill(longest, 1);                    // each item alone is a subsequence

    for (int i = 1; i < numbers.Length; i++)
    {
        for (int j = 0; j < i; j++)
        {
            if (numbers[j] < numbers[i])
            {
                longest[i] = Math.Max(longest[i], longest[j] + 1);
            }
        }
    }

    return longest.Max();
}

Console.WriteLine(LongestIncreasing(new[] { 10, 9, 2, 5, 3, 7, 101, 18 }));   // 4
```

The answer is `longest.Max()`, not `longest[^1]`. The best subsequence does not have to end at the last element, which is an easy thing to get wrong.

`O(n^2)` here. A cleverer version using binary search reaches `O(n log n)`.

## Spotting a DP problem

The signals:

- "How many ways to..."
- "Maximum or minimum cost, value or length of..."
- "Is it possible to reach or make..."
- "Longest or shortest ... subsequence or path"
- A recursive solution that recomputes the same inputs.

And the shape of the choice:

- At each step you decide **take it or skip it**.
- The decision depends on earlier decisions but not on how you arrived.
- Small inputs are easy and larger ones build on them.

If a greedy choice provably works, use greedy. It is faster. Dynamic programming is what you reach for when greedy has a counterexample.

## Quick recap

- Dynamic programming means computing each subproblem once and remembering it.
- It needs overlapping subproblems and optimal substructure.
- Define the state, write the recurrence, find the base cases, choose the order.
- "Take it or skip it, keep the better" is the most common recurrence.
- Define the state as "ending at `i`" when the last element matters.
- Guard sentinel values like `int.MaxValue` before adding to them.
- Reach for dynamic programming when a greedy choice has a counterexample.

<code id="code-content" class="language-csharp">
// The problem: the same subproblem solved again and again
static long FibSlow(int n) =&gt; n &lt;= 1 ? n : FibSlow(n - 1) + FibSlow(n - 2);
// O(2^n). F(50) will not finish today.
// The fix: compute each one ONCE and remember it. O(n).
static long Fib(int n, Dictionary&lt;int, long&gt;? memo = null)
{
    if (n &lt;= 1) return n;
    memo ??= new Dictionary&lt;int, long&gt;();
    if (memo.TryGetValue(n, out long cached)) return cached;
    return memo[n] = Fib(n - 1, memo) + Fib(n - 2, memo);
}
Console.WriteLine(Fib(90));                    // instant
// The four steps: state, recurrence, base cases, order.
// Climbing stairs: ways[i] = ways[i-1] + ways[i-2]. It is Fibonacci in disguise.
static long ClimbStairs(int n)
{
    if (n &lt;= 1) return 1;
    var ways = new long[n + 1];
    ways[0] = ways[1] = 1;
    for (int i = 2; i &lt;= n; i++) ways[i] = ways[i - 1] + ways[i - 2];
    return ways[n];
}
Console.WriteLine(ClimbStairs(10));            // 89
// "Take it or skip it, keep the better" is the most common recurrence
static int Rob(int[] money)
{
    if (money.Length == 0) return 0;
    if (money.Length == 1) return money[0];
    var best = new int[money.Length];
    best[0] = money[0];
    best[1] = Math.Max(money[0], money[1]);
    for (int i = 2; i &lt; money.Length; i++)
        best[i] = Math.Max(best[i - 1],            // skip this house
                           money[i] + best[i - 2]); // rob it, plus two back
    return best[^1];
}
Console.WriteLine(Rob(new[] { 2, 7, 9, 3, 1 })); // 12
// Coin change: correct where greedy failed
static int FewestCoins(int target, int[] coins)
{
    var fewest = new int[target + 1];
    Array.Fill(fewest, int.MaxValue);
    fewest[0] = 0;
    for (int amount = 1; amount &lt;= target; amount++)
        foreach (int coin in coins)
        {
            if (coin &gt; amount) continue;
            if (fewest[amount - coin] == int.MaxValue) continue;   // guard the sentinel
            fewest[amount] = Math.Min(fewest[amount], fewest[amount - coin] + 1);
        }
    return fewest[target] == int.MaxValue ? -1 : fewest[target];
}
Console.WriteLine(FewestCoins(6, new[] { 1, 3, 4 }));   // 2, greedy said 3
// Define the state as "ending at i" when the last element matters
static int LongestIncreasing(int[] n)
{
    if (n.Length == 0) return 0;
    var longest = new int[n.Length];
    Array.Fill(longest, 1);
    for (int i = 1; i &lt; n.Length; i++)
        for (int j = 0; j &lt; i; j++)
            if (n[j] &lt; n[i]) longest[i] = Math.Max(longest[i], longest[j] + 1);
    return longest.Max();                      // Max, not longest[^1]
}
Console.WriteLine(LongestIncreasing(new[] { 10, 9, 2, 5, 3, 7, 101, 18 }));   // 4
</code></pre>

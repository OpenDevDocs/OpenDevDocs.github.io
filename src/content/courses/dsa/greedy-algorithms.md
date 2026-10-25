---
publishDate: 2026-07-28T18:20
title: Greedy Algorithms
slug: greedy-algorithms
metadescription: Take the best looking option at each step, learn the problems where that is provably optimal, and see the ones where it quietly fails.
updateDate: 2026-09-07T18:20
author: ['bishal-biswas']
level: 3
tags: ['greedy', 'algorithms', 'problem solving']
course: dsa
---

## Take the best option now

A greedy algorithm makes the choice that looks best right now and never reconsiders it.

That sounds naive, and often it is. But for a specific family of problems, the locally best choice is provably the globally best one, and then greedy gives you an `O(n log n)` solution to something that would otherwise need exponential search.

The skill is telling the two cases apart.

## A case where it works: activity selection

You have events with start and end times, and one room. Fit in as many as possible.

The greedy rule: **always take the event that finishes earliest** among those that still fit.

```csharp
record Activity(string Name, int Start, int End);

static List<Activity> SelectActivities(List<Activity> activities)
{
    activities.Sort((a, b) => a.End.CompareTo(b.End));      // earliest finish first

    var chosen = new List<Activity>();
    int lastEnd = int.MinValue;

    foreach (var activity in activities)
    {
        if (activity.Start < lastEnd) continue;             // overlaps, skip it

        chosen.Add(activity);
        lastEnd = activity.End;
    }

    return chosen;
}

var meetings = new List<Activity>
{
    new("standup", 1, 4),
    new("review", 3, 5),
    new("planning", 0, 6),
    new("retro", 5, 7),
    new("demo", 8, 9)
};

foreach (var m in SelectActivities(meetings)) Console.WriteLine(m.Name);
// standup, retro, demo
```

Why does finishing earliest win? Because it leaves the maximum time available for everything after it. No other choice can do better, and swapping any chosen event for one that finishes later never helps.

Sorting by **start** time or by **duration** both give wrong answers. A short event in the middle of the day can block two others.

## Another that works: coin change with real coins

Give change using the fewest coins, with British or Indian style denominations.

```csharp
static Dictionary<int, int> MakeChange(int amount, int[] coins)
{
    Array.Sort(coins);
    Array.Reverse(coins);      // largest first

    var used = new Dictionary<int, int>();

    foreach (int coin in coins)
    {
        if (amount < coin) continue;

        used[coin] = amount / coin;
        amount %= coin;
    }

    return amount == 0 ? used : new Dictionary<int, int>();   // could not make it
}

foreach (var (coin, count) in MakeChange(87, new[] { 1, 2, 5, 10, 20, 50 }))
{
    Console.WriteLine($"{count} x {coin}");
}
// 1 x 50, 1 x 20, 1 x 10, 1 x 5, 1 x 2
```

This works for real currencies because they are **canonical**, meaning every larger coin is at least double the next one down. Under that condition, taking the biggest coin is always safe.

## And a case where it fails

Change the denominations and greedy breaks.

```csharp
foreach (var (coin, count) in MakeChange(6, new[] { 1, 3, 4 }))
{
    Console.WriteLine($"{count} x {coin}");
}
// 1 x 4, 2 x 1   =>  three coins
// The best answer is 2 x 3  =>  two coins
```

Taking the 4 looks best, and it locks you out of the better answer. There is no way to recover, because greedy never reconsiders.

This is the failure mode: an early choice that looks locally good closes off a globally better path. Dynamic programming handles it, by considering every option and remembering the results.

## The interval problems

Once you see the pattern, a whole family falls out.

**Minimum rooms for all meetings:**

```csharp
static int MinimumRooms(List<Activity> meetings)
{
    var starts = meetings.Select(m => m.Start).OrderBy(x => x).ToArray();
    var ends = meetings.Select(m => m.End).OrderBy(x => x).ToArray();

    int rooms = 0, most = 0, endIndex = 0;

    foreach (int start in starts)
    {
        while (endIndex < ends.Length && ends[endIndex] <= start)
        {
            rooms--;             // a meeting finished, a room freed up
            endIndex++;
        }

        rooms++;
        most = Math.Max(most, rooms);
    }

    return most;
}

Console.WriteLine(MinimumRooms(meetings));   // 2
```

Sorting starts and ends separately, then sweeping through them, is a technique worth remembering. It answers "how many things overlap at the busiest moment" in `O(n log n)`.

**Merging overlapping intervals:**

```csharp
static List<(int Start, int End)> Merge(List<(int Start, int End)> intervals)
{
    intervals.Sort((a, b) => a.Start.CompareTo(b.Start));      // by START this time

    var merged = new List<(int Start, int End)>();

    foreach (var interval in intervals)
    {
        if (merged.Count > 0 && interval.Start <= merged[^1].End)
        {
            merged[^1] = (merged[^1].Start, Math.Max(merged[^1].End, interval.End));
        }
        else
        {
            merged.Add(interval);
        }
    }

    return merged;
}

var ranges = new List<(int, int)> { (1, 3), (2, 6), (8, 10), (15, 18) };
Console.WriteLine(string.Join(", ", Merge(ranges)));
// (1, 6), (8, 10), (15, 18)
```

Note this sorts by **start**, while activity selection sorts by **end**. Getting that backwards is the usual bug, and the right choice comes from what the problem is asking for.

## The jump game

Can you reach the end, where each value is how far you may jump from that position?

```csharp
static bool CanReachEnd(int[] jumps)
{
    int furthest = 0;

    for (int i = 0; i < jumps.Length; i++)
    {
        if (i > furthest) return false;                 // cannot even get here

        furthest = Math.Max(furthest, i + jumps[i]);

        if (furthest >= jumps.Length - 1) return true;
    }

    return true;
}

Console.WriteLine(CanReachEnd(new[] { 2, 3, 1, 1, 4 }));   // True
Console.WriteLine(CanReachEnd(new[] { 3, 2, 1, 0, 4 }));   // False
```

Tracking only "the furthest position reachable so far" is enough. You never need to know which route got you there, and that is what keeps it `O(n)` instead of exponential.

## Petrol stations

A circular route with fuel at each stop and a cost to reach the next. Where can you start and complete the loop?

```csharp
static int StartingStation(int[] fuel, int[] cost)
{
    int total = 0, tank = 0, start = 0;

    for (int i = 0; i < fuel.Length; i++)
    {
        int gain = fuel[i] - cost[i];

        total += gain;
        tank += gain;

        if (tank < 0)
        {
            start = i + 1;      // cannot start anywhere up to here
            tank = 0;
        }
    }

    return total >= 0 ? start : -1;
}

Console.WriteLine(StartingStation(new[] { 1, 2, 3, 4, 5 }, new[] { 3, 4, 5, 1, 2 }));   // 3
```

The insight: if you run out of fuel between `start` and `i`, then no station in that stretch works either, because every one of them starts with less fuel than you had. So skip the whole range at once.

`total >= 0` confirms a solution exists at all.

## How to know if greedy works

There is no shortcut, but three checks catch most cases.

**Try to find a counterexample.** Five minutes of trying small inputs finds most broken greedy strategies. The coin change failure appears with `amount = 6` and coins `{1, 3, 4}`.

**Check the exchange argument.** Can you show that swapping any optimal solution's choice for the greedy one never makes it worse? If yes, greedy is optimal.

**Compare with brute force on small inputs.**

```csharp
static void CheckAgainstBruteForce()
{
    var random = new Random(42);

    for (int test = 0; test < 1000; test++)
    {
        var input = Enumerable.Range(0, 8).Select(_ => random.Next(1, 20)).ToArray();

        if (Greedy(input) != BruteForce(input))
        {
            Console.WriteLine($"Mismatch on {string.Join(",", input)}");
            return;
        }
    }

    Console.WriteLine("No counterexample found in 1000 tries");
}
```

This does not prove correctness, but it finds bugs fast and is worth doing before trusting a greedy solution.

## Greedy or dynamic programming?

```text
                    Greedy                    Dynamic programming
Choices             one, never revisited      all, results remembered
Time                usually O(n log n)        usually O(n * something)
Memory              O(1)                      O(n) or more
Correct when        local optimum is global   overlapping subproblems
Fails when          an early choice blocks     never, but it costs more
                    a better later one
```

If greedy is provably correct, use it. It is faster and simpler.

If you cannot prove it, and a counterexample exists or you cannot rule one out, use dynamic programming.

## Greedy algorithms you already know

**Dijkstra's algorithm.** Always expand the cheapest known vertex.

**Prim's and Kruskal's.** Always take the cheapest safe edge.

**Huffman coding.** Always merge the two least frequent symbols.

All three are provably optimal, and that is not a coincidence. Each has a structural property, like the cut property for spanning trees, that guarantees the greedy choice is safe.

## Quick recap

- A greedy algorithm takes the locally best option and never reconsiders.
- It is optimal only when a structural property guarantees the local choice is safe.
- Activity selection sorts by earliest finish, interval merging sorts by earliest start.
- Coin change is greedy safe for real currencies and wrong for arbitrary ones.
- Look for a counterexample before trusting a greedy solution.
- Test against brute force on small inputs to catch mistakes quickly.
- Dijkstra, Prim, Kruskal and Huffman are all provably correct greedy algorithms.

<code id="code-content" class="language-csharp">
record Activity(string Name, int Start, int End);
// WORKS: activity selection. Sort by EARLIEST FINISH, take everything that fits.
static List&lt;Activity&gt; SelectActivities(List&lt;Activity&gt; activities)
{
    activities.Sort((a, b) =&gt; a.End.CompareTo(b.End));   // finishing early leaves
    var chosen = new List&lt;Activity&gt;();                   // the most room after it
    int lastEnd = int.MinValue;
    foreach (var a in activities)
    {
        if (a.Start &lt; lastEnd) continue;
        chosen.Add(a);
        lastEnd = a.End;
    }
    return chosen;
}
var meetings = new List&lt;Activity&gt;
{
    new("standup", 1, 4), new("review", 3, 5), new("planning", 0, 6),
    new("retro", 5, 7), new("demo", 8, 9)
};
foreach (var m in SelectActivities(meetings)) Console.Write(m.Name + " ");
Console.WriteLine();                                     // standup retro demo
// FAILS: coin change with arbitrary denominations
static int GreedyCoins(int amount, int[] coins)
{
    Array.Sort(coins); Array.Reverse(coins);
    int used = 0;
    foreach (int c in coins) { used += amount / c; amount %= c; }
    return used;
}
Console.WriteLine(GreedyCoins(6, new[] { 1, 3, 4 }));    // 3 coins (4+1+1)
// The real answer is 2 coins (3+3). Taking the 4 blocks the better path.
// Merging intervals sorts by START, not end. Getting this backwards is the usual bug.
static List&lt;(int Start, int End)&gt; Merge(List&lt;(int Start, int End)&gt; intervals)
{
    intervals.Sort((a, b) =&gt; a.Start.CompareTo(b.Start));
    var merged = new List&lt;(int Start, int End)&gt;();
    foreach (var i in intervals)
    {
        if (merged.Count &gt; 0 &amp;&amp; i.Start &lt;= merged[^1].End)
            merged[^1] = (merged[^1].Start, Math.Max(merged[^1].End, i.End));
        else merged.Add(i);
    }
    return merged;
}
Console.WriteLine(string.Join(", ", Merge(new List&lt;(int, int)&gt;
    { (1, 3), (2, 6), (8, 10), (15, 18) })));            // (1,6) (8,10) (15,18)
// Jump game: tracking only the FURTHEST reachable position is enough
static bool CanReachEnd(int[] jumps)
{
    int furthest = 0;
    for (int i = 0; i &lt; jumps.Length; i++)
    {
        if (i &gt; furthest) return false;
        furthest = Math.Max(furthest, i + jumps[i]);
        if (furthest &gt;= jumps.Length - 1) return true;
    }
    return true;
}
Console.WriteLine(CanReachEnd(new[] { 3, 2, 1, 0, 4 })); // False
// Before trusting greedy: hunt for a counterexample, or test against brute force.
// Dijkstra, Prim, Kruskal and Huffman are all provably correct greedy algorithms.
</code></pre>

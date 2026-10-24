---
publishDate: 2026-07-14T13:10
title: Backtracking Basics
slug: backtracking-basics
metadescription: Explore every possibility by trying a choice, recursing, then undoing it, and prune the search early so it finishes in reasonable time.
updateDate: 2026-09-07T13:10
author: ['bishal-biswas']
level: 3
tags: ['recursion', 'backtracking', 'algorithms']
course: dsa
---

## Try, recurse, undo

Backtracking explores every possible combination by building a partial answer one choice at a time. When a choice leads nowhere, it is undone and the next one is tried.

The shape is always the same three lines:

```csharp
foreach (var option in options)
{
    Choose(option);      // make the choice
    Explore();           // recurse with it made
    Unchoose(option);    // undo it before trying the next
}
```

That `Unchoose` step is what gives the technique its name. Everything else is bookkeeping.

## Generating subsets

Every element is either in a subset or not. Two choices per element.

```csharp
static List<List<int>> Subsets(int[] numbers)
{
    var results = new List<List<int>>();
    var current = new List<int>();

    void Explore(int index)
    {
        if (index == numbers.Length)
        {
            results.Add(new List<int>(current));   // copy, current keeps changing
            return;
        }

        // choice 1: skip this number
        Explore(index + 1);

        // choice 2: include this number
        current.Add(numbers[index]);
        Explore(index + 1);
        current.RemoveAt(current.Count - 1);       // undo
    }

    Explore(0);
    return results;
}

foreach (var subset in Subsets(new[] { 1, 2, 3 }))
{
    Console.WriteLine($"[{string.Join(", ", subset)}]");
}
// [], [3], [2], [2, 3], [1], [1, 3], [1, 2], [1, 2, 3]
```

Two details matter enormously.

**`new List<int>(current)` copies the list.** `current` is reused throughout, so adding it directly would store the same object eight times, and it would be empty at the end.

**`RemoveAt` undoes the choice.** Skip it and every later branch inherits leftover state.

With `n` items there are `2^n` subsets, so this is `O(2^n)`. That is unavoidable, the output really is that big.

## Generating permutations

Every ordering of a set. Swapping is the cleanest way.

```csharp
static List<int[]> Permutations(int[] numbers)
{
    var results = new List<int[]>();

    void Explore(int start)
    {
        if (start == numbers.Length)
        {
            results.Add((int[])numbers.Clone());
            return;
        }

        for (int i = start; i < numbers.Length; i++)
        {
            (numbers[start], numbers[i]) = (numbers[i], numbers[start]);   // choose
            Explore(start + 1);
            (numbers[start], numbers[i]) = (numbers[i], numbers[start]);   // undo
        }
    }

    Explore(0);
    return results;
}

foreach (var p in Permutations(new[] { 1, 2, 3 }))
{
    Console.WriteLine(string.Join(", ", p));
}
// 1,2,3  1,3,2  2,1,3  2,3,1  3,2,1  3,1,2
```

There are `n!` permutations, so this is `O(n!)`. With 10 items that is 3.6 million. With 15 it is over a trillion. Backtracking is genuinely for small inputs.

## Pruning is the real skill

Exploring every branch is only viable when you abandon hopeless ones early. Cutting a branch near the top removes everything beneath it.

Combination sum, where numbers can be reused:

```csharp
static List<List<int>> CombinationSum(int[] candidates, int target)
{
    Array.Sort(candidates);                 // sorting enables the break below

    var results = new List<List<int>>();
    var current = new List<int>();

    void Explore(int start, int remaining)
    {
        if (remaining == 0)
        {
            results.Add(new List<int>(current));
            return;
        }

        for (int i = start; i < candidates.Length; i++)
        {
            if (candidates[i] > remaining) break;    // prune, all later ones are bigger

            current.Add(candidates[i]);
            Explore(i, remaining - candidates[i]);   // i, not i + 1, allows reuse
            current.RemoveAt(current.Count - 1);
        }
    }

    Explore(0, target);
    return results;
}

foreach (var combo in CombinationSum(new[] { 2, 3, 6, 7 }, 7))
{
    Console.WriteLine($"[{string.Join(", ", combo)}]");
}
// [2, 2, 3], [7]
```

The `break` is the pruning. Because the array is sorted, once a candidate exceeds what remains, every later candidate does too, so the whole rest of the loop is skipped.

Passing `i` rather than `i + 1` allows a number to be used again. Passing `start` from 0 each time would generate the same combination in different orders.

## N queens

The classic. Place `n` queens on an `n` by `n` board so none attack each other.

```csharp
static int SolveQueens(int n)
{
    var columns = new bool[n];
    var diagonal = new bool[2 * n];         // row + column
    var antiDiagonal = new bool[2 * n];     // row - column + n
    int solutions = 0;

    void PlaceRow(int row)
    {
        if (row == n)
        {
            solutions++;
            return;
        }

        for (int column = 0; column < n; column++)
        {
            int d = row + column;
            int a = row - column + n;

            if (columns[column] || diagonal[d] || antiDiagonal[a]) continue;   // prune

            columns[column] = diagonal[d] = antiDiagonal[a] = true;   // choose
            PlaceRow(row + 1);                                        // explore
            columns[column] = diagonal[d] = antiDiagonal[a] = false;  // undo
        }
    }

    PlaceRow(0);
    return solutions;
}

Console.WriteLine(SolveQueens(8));   // 92
```

Placing one queen per row removes row conflicts by construction. Three boolean arrays make each conflict check `O(1)` rather than scanning the board.

Without pruning this would be `8^8`, nearly 17 million placements. With it, the search finishes instantly.

## Sudoku

Same pattern, applied to a grid.

```csharp
static bool Solve(int[,] board)
{
    for (int row = 0; row < 9; row++)
    {
        for (int column = 0; column < 9; column++)
        {
            if (board[row, column] != 0) continue;      // already filled

            for (int value = 1; value <= 9; value++)
            {
                if (!IsValid(board, row, column, value)) continue;

                board[row, column] = value;             // choose

                if (Solve(board)) return true;          // explore

                board[row, column] = 0;                 // undo
            }

            return false;      // no value works here, this branch is dead
        }
    }

    return true;               // no empty cells left, solved
}

static bool IsValid(int[,] board, int row, int column, int value)
{
    for (int i = 0; i < 9; i++)
    {
        if (board[row, i] == value) return false;
        if (board[i, column] == value) return false;

        int boxRow = row / 3 * 3 + i / 3;
        int boxColumn = column / 3 * 3 + i % 3;
        if (board[boxRow, boxColumn] == value) return false;
    }

    return true;
}
```

The `return false` after the inner loop is the crucial line. If no value fits an empty cell, this whole branch is impossible, so it stops rather than moving to the next cell.

## The template

Almost every backtracking problem fits this:

```csharp
void Explore(state)
{
    if (IsComplete(state))
    {
        Record(state);
        return;
    }

    foreach (var option in OptionsFor(state))
    {
        if (!IsValid(option, state)) continue;   // prune

        Apply(option, state);
        Explore(state);
        Undo(option, state);
    }
}
```

When you meet a new problem, fill in the five blanks: what is complete, what are the options, what is valid, how to apply, how to undo.

## Mistakes to watch for

**Forgetting to undo.** State leaks into sibling branches and the answers are quietly wrong.

**Storing a reference instead of a copy.** Every recorded answer ends up pointing at the same mutating object.

**No pruning.** Correct but too slow to finish.

**Wrong start index.** Passing `0` instead of `i` produces duplicate combinations in different orders.

## Quick recap

- Backtracking is choose, explore, undo, repeated over every option.
- Copy the current state when recording an answer, never store the live object.
- Undoing is what keeps branches independent.
- Pruning invalid branches early is what makes it finish at all.
- Sorting the options often enables a `break` that cuts a whole subtree.
- Pass `i` to allow reuse and `i + 1` to prevent it.
- Subsets are `O(2^n)` and permutations are `O(n!)`, so keep the input small.

<code id="code-content" class="language-csharp">
// The pattern: choose, explore, undo
static List&lt;List&lt;int&gt;&gt; Subsets(int[] numbers)
{
    var results = new List&lt;List&lt;int&gt;&gt;();
    var current = new List&lt;int&gt;();
    void Explore(int index)
    {
        if (index == numbers.Length)
        {
            results.Add(new List&lt;int&gt;(current));   // COPY, current keeps changing
            return;
        }
        Explore(index + 1);                        // skip this number
        current.Add(numbers[index]);               // choose
        Explore(index + 1);                        // explore
        current.RemoveAt(current.Count - 1);       // undo
    }
    Explore(0);
    return results;
}
foreach (var s in Subsets(new[] { 1, 2, 3 })) Console.WriteLine($"[{string.Join(",", s)}]");
// Permutations by swapping: swap, recurse, swap back
static void Permute(int[] a, int start, List&lt;int[]&gt; results)
{
    if (start == a.Length) { results.Add((int[])a.Clone()); return; }
    for (int i = start; i &lt; a.Length; i++)
    {
        (a[start], a[i]) = (a[i], a[start]);
        Permute(a, start + 1, results);
        (a[start], a[i]) = (a[i], a[start]);       // undo
    }
}
// Pruning is what makes backtracking finish. Sorting enables the break.
static List&lt;List&lt;int&gt;&gt; CombinationSum(int[] candidates, int target)
{
    Array.Sort(candidates);
    var results = new List&lt;List&lt;int&gt;&gt;();
    var current = new List&lt;int&gt;();
    void Explore(int start, int remaining)
    {
        if (remaining == 0) { results.Add(new List&lt;int&gt;(current)); return; }
        for (int i = start; i &lt; candidates.Length; i++)
        {
            if (candidates[i] &gt; remaining) break;  // all later ones are bigger too
            current.Add(candidates[i]);
            Explore(i, remaining - candidates[i]); // i allows reuse, i+1 would not
            current.RemoveAt(current.Count - 1);
        }
    }
    Explore(0, target);
    return results;
}
foreach (var c in CombinationSum(new[] { 2, 3, 6, 7 }, 7))
    Console.WriteLine($"[{string.Join(",", c)}]");     // [2,2,3] and [7]
// N queens: three boolean arrays make every conflict check O(1)
static int SolveQueens(int n)
{
    var cols = new bool[n];
    var diag = new bool[2 * n];
    var anti = new bool[2 * n];
    int solutions = 0;
    void PlaceRow(int row)
    {
        if (row == n) { solutions++; return; }
        for (int c = 0; c &lt; n; c++)
        {
            int d = row + c, a = row - c + n;
            if (cols[c] || diag[d] || anti[a]) continue;      // prune
            cols[c] = diag[d] = anti[a] = true;
            PlaceRow(row + 1);
            cols[c] = diag[d] = anti[a] = false;              // undo
        }
    }
    PlaceRow(0);
    return solutions;
}
Console.WriteLine(SolveQueens(8));   // 92
</code></pre>

---
publishDate: 2026-07-05T09:40
title: Two Pointer Technique
slug: two-pointer-technique
metadescription: Replace nested loops with two indexes moving through an array, and solve pair sums, palindromes, duplicates and merging in a single pass.
updateDate: 2026-09-07T09:40
author: ['bishal-biswas']
level: 2
tags: ['arrays', 'two pointers', 'patterns']
course: dsa
---

## The idea

Keep two indexes into the same array and move them under a rule. Because each index only ever moves forward (or inward), the whole array is covered in one pass.

This turns a lot of `O(n^2)` nested loops into `O(n)`.

There are two common arrangements:

- **Opposite ends**, one at the start and one at the end, moving towards each other.
- **Same direction**, both starting at the front, one moving faster than the other.

## Opposite ends: checking a palindrome

```csharp
static bool IsPalindrome(string text)
{
    int left = 0, right = text.Length - 1;

    while (left < right)
    {
        if (text[left] != text[right]) return false;
        left++;
        right--;
    }

    return true;
}

Console.WriteLine(IsPalindrome("racecar"));   // True
Console.WriteLine(IsPalindrome("hello"));     // False
```

The loop condition is `left < right`, not `left <= right`. When they meet on the same character in an odd length string, there is nothing left to compare.

A version that ignores punctuation and case:

```csharp
static bool IsPalindromeLoose(string text)
{
    int left = 0, right = text.Length - 1;

    while (left < right)
    {
        while (left < right && !char.IsLetterOrDigit(text[left])) left++;
        while (left < right && !char.IsLetterOrDigit(text[right])) right--;

        if (char.ToLower(text[left]) != char.ToLower(text[right])) return false;

        left++;
        right--;
    }

    return true;
}

Console.WriteLine(IsPalindromeLoose("A man, a plan, a canal: Panama"));   // True
```

The inner `while` loops need their own `left < right` guard, otherwise they can run off the end of a string of only punctuation.

## Opposite ends: pair sum in a sorted array

This is where the technique really shines.

```csharp
static (int, int)? FindPair(int[] sorted, int target)
{
    int left = 0, right = sorted.Length - 1;

    while (left < right)
    {
        int sum = sorted[left] + sorted[right];

        if (sum == target) return (sorted[left], sorted[right]);

        if (sum < target) left++;    // need a bigger sum
        else right--;                // need a smaller sum
    }

    return null;
}

int[] numbers = { 1, 3, 4, 6, 8, 11 };
Console.WriteLine(FindPair(numbers, 10));   // (4, 6)
```

Why does this work? Because the array is sorted, `sorted[left] + sorted[right]` is the largest sum available with the current `left`. If it is still too small, no partner for `left` exists, so `left` can safely move on. The same logic applies from the other side.

Nested loops would be `O(n^2)`. This is `O(n)`, plus `O(n log n)` if you have to sort first.

## Reversing in place

```csharp
static void Reverse(int[] numbers)
{
    int left = 0, right = numbers.Length - 1;

    while (left < right)
    {
        (numbers[left], numbers[right]) = (numbers[right], numbers[left]);
        left++;
        right--;
    }
}
```

No extra array, `O(1)` space.

## Same direction: removing duplicates in place

Two indexes moving forward at different speeds. One reads every item, one writes only the ones to keep.

```csharp
static int RemoveDuplicates(int[] sorted)
{
    if (sorted.Length == 0) return 0;

    int write = 1;

    for (int read = 1; read < sorted.Length; read++)
    {
        if (sorted[read] != sorted[write - 1])
        {
            sorted[write] = sorted[read];
            write++;
        }
    }

    return write;   // the new length
}

int[] data = { 1, 1, 2, 2, 2, 3, 4, 4 };
int length = RemoveDuplicates(data);
Console.WriteLine(string.Join(", ", data[..length]));   // 1, 2, 3, 4
```

The write index never overtakes the read index, so nothing is destroyed before it is read.

## Same direction: partitioning

Move every even number to the front:

```csharp
static void EvensFirst(int[] numbers)
{
    int write = 0;

    for (int read = 0; read < numbers.Length; read++)
    {
        if (numbers[read] % 2 == 0)
        {
            (numbers[write], numbers[read]) = (numbers[read], numbers[write]);
            write++;
        }
    }
}

int[] values = { 3, 1, 2, 4, 7, 6 };
EvensFirst(values);
Console.WriteLine(string.Join(", ", values));   // 2, 4, 6, 1, 7, 3
```

This is exactly the partition step inside quick sort. `write` marks the boundary between "already sorted into the front group" and "not yet decided".

## Three pointers: the Dutch national flag

Sorting an array of only 0s, 1s and 2s in a single pass.

```csharp
static void SortColours(int[] numbers)
{
    int low = 0, mid = 0, high = numbers.Length - 1;

    while (mid <= high)
    {
        switch (numbers[mid])
        {
            case 0:
                (numbers[low], numbers[mid]) = (numbers[mid], numbers[low]);
                low++;
                mid++;
                break;
            case 1:
                mid++;
                break;
            default:
                (numbers[mid], numbers[high]) = (numbers[high], numbers[mid]);
                high--;      // do not advance mid, the swapped in value is unchecked
                break;
        }
    }
}

int[] colours = { 2, 0, 2, 1, 1, 0 };
SortColours(colours);
Console.WriteLine(string.Join(", ", colours));   // 0, 0, 1, 1, 2, 2
```

The subtle part is the `default` case not advancing `mid`. The value swapped in from the far end has not been looked at yet.

## Two arrays: merging

Two pointers do not have to be in the same array.

```csharp
static int[] Merge(int[] a, int[] b)
{
    var result = new int[a.Length + b.Length];
    int i = 0, j = 0, k = 0;

    while (i < a.Length && j < b.Length)
    {
        result[k++] = a[i] <= b[j] ? a[i++] : b[j++];
    }

    while (i < a.Length) result[k++] = a[i++];
    while (j < b.Length) result[k++] = b[j++];

    return result;
}

Console.WriteLine(string.Join(", ", Merge(new[] { 1, 4, 7 }, new[] { 2, 3, 9 })));
// 1, 2, 3, 4, 7, 9
```

The two tail loops matter. When one array runs out, the rest of the other still has to be copied. This merge is the heart of merge sort.

## When to reach for it

Look for two pointers when you see:

- A **sorted** array and a question about pairs or sums.
- A palindrome or any "compare the ends" question.
- Rearranging an array in place with no extra memory.
- Merging two sorted sequences.
- A nested loop where the inner loop never needs to go backwards.

If the array is not sorted and the question is about pairs, a `HashSet` is usually the better tool. Two pointers need order to work.

## Quick recap

- Two indexes moving under a rule replace many nested loops with a single pass.
- Opposite ends suits palindromes, reversal and pair sums in sorted arrays.
- Same direction suits in place filtering, deduplicating and partitioning.
- The write index trailing the read index is what makes in place safe.
- Three pointers sort three distinct values in one pass.
- Merging two sorted arrays needs the tail loops or you lose items.
- Two pointers usually need sorted data, otherwise reach for a hash set.

<code id="code-content" class="language-csharp">
// Opposite ends: palindrome check, O(n) time and O(1) space
static bool IsPalindrome(string text)
{
    int left = 0, right = text.Length - 1;
    while (left &lt; right)
    {
        if (text[left] != text[right]) return false;
        left++; right--;
    }
    return true;
}
Console.WriteLine(IsPalindrome("racecar"));    // True
// Opposite ends on SORTED data: pair sum in O(n) instead of O(n^2)
static (int, int)? FindPair(int[] sorted, int target)
{
    int left = 0, right = sorted.Length - 1;
    while (left &lt; right)
    {
        int sum = sorted[left] + sorted[right];
        if (sum == target) return (sorted[left], sorted[right]);
        if (sum &lt; target) left++;      // need a bigger sum
        else right--;                  // need a smaller sum
    }
    return null;
}
Console.WriteLine(FindPair(new[] { 1, 3, 4, 6, 8, 11 }, 10));   // (4, 6)
// Same direction: read runs ahead, write keeps only what survives
static int RemoveDuplicates(int[] sorted)
{
    if (sorted.Length == 0) return 0;
    int write = 1;
    for (int read = 1; read &lt; sorted.Length; read++)
        if (sorted[read] != sorted[write - 1]) sorted[write++] = sorted[read];
    return write;
}
int[] data = { 1, 1, 2, 2, 3 };
Console.WriteLine(string.Join(",", data[..RemoveDuplicates(data)]));   // 1,2,3
// Two arrays, one pointer each: the merge behind merge sort
static int[] Merge(int[] a, int[] b)
{
    var result = new int[a.Length + b.Length];
    int i = 0, j = 0, k = 0;
    while (i &lt; a.Length &amp;&amp; j &lt; b.Length)
        result[k++] = a[i] &lt;= b[j] ? a[i++] : b[j++];
    while (i &lt; a.Length) result[k++] = a[i++];    // tails matter
    while (j &lt; b.Length) result[k++] = b[j++];
    return result;
}
Console.WriteLine(string.Join(",", Merge(new[] { 1, 4, 7 }, new[] { 2, 3, 9 })));
</code></pre>

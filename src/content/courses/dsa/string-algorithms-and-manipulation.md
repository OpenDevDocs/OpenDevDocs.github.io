---
publishDate: 2026-07-06T10:10
title: String Algorithms and Manipulation
slug: string-algorithms-and-manipulation
metadescription: Work with strings as data structures, avoid the quadratic concatenation trap, and solve anagram, palindrome and pattern search problems.
updateDate: 2026-09-07T10:10
author: ['bishal-biswas']
level: 2
tags: ['strings', 'patterns', 'algorithms']
course: dsa
---

## A string is an array of characters

Everything you know about arrays applies. Indexing is `O(1)`, searching is `O(n)`, and the length is stored rather than counted.

```csharp
string text = "algorithms";

Console.WriteLine(text[0]);          // a
Console.WriteLine(text[^1]);         // s
Console.WriteLine(text.Length);      // 10

foreach (char c in text) Console.Write(c + " ");
```

The one big difference: strings in C# are **immutable**. Nothing can change one in place.

## Why immutability matters

Every method that looks like it edits a string actually builds a new one.

```csharp
string name = "asha";
name.ToUpper();                       // does nothing useful, result discarded
Console.WriteLine(name);              // asha

name = name.ToUpper();                // now it works
Console.WriteLine(name);              // ASHA
```

This leads to the single most common performance bug involving strings:

```csharp
// O(n^2): every += copies the entire string built so far
string result = "";
for (int i = 0; i < 50_000; i++) result += i;
```

Building a 50,000 character string this way copies roughly 1.25 billion characters.

```csharp
// O(n): appends into a growing buffer, copies only when it resizes
var builder = new System.Text.StringBuilder();
for (int i = 0; i < 50_000; i++) builder.Append(i);
string result = builder.ToString();
```

The rule is simple: joining a known handful of strings with `+` is fine, building a string in a loop needs `StringBuilder`.

`string.Join` is also fine, and clearer when you have a collection:

```csharp
Console.WriteLine(string.Join(", ", new[] { "a", "b", "c" }));   // a, b, c
```

## Counting characters

The workhorse of string problems. Two ways, and the choice depends on the alphabet.

```csharp
// General purpose: any characters
static Dictionary<char, int> CountChars(string text)
{
    var counts = new Dictionary<char, int>();

    foreach (char c in text)
    {
        counts[c] = counts.GetValueOrDefault(c) + 1;
    }

    return counts;
}
```

```csharp
// Faster when you know it is only lowercase a to z
static int[] CountLowercase(string text)
{
    var counts = new int[26];

    foreach (char c in text) counts[c - 'a']++;

    return counts;
}
```

`c - 'a'` works because characters are numbers. `'a'` is 97, `'b'` is 98, so `'c' - 'a'` is 2. A fixed array of 26 is faster than a dictionary and uses less memory.

## Anagrams

Two strings are anagrams if they use the same letters the same number of times.

```csharp
static bool AreAnagrams(string a, string b)
{
    if (a.Length != b.Length) return false;

    var counts = new int[26];

    foreach (char c in a) counts[c - 'a']++;

    foreach (char c in b)
    {
        counts[c - 'a']--;
        if (counts[c - 'a'] < 0) return false;
    }

    return true;
}

Console.WriteLine(AreAnagrams("listen", "silent"));   // True
Console.WriteLine(AreAnagrams("hello", "world"));     // False
```

`O(n)` time and `O(1)` space, since the array is always 26 slots.

The sorting approach also works and is shorter, at `O(n log n)`:

```csharp
static bool AreAnagramsSorted(string a, string b)
{
    var x = a.ToCharArray();
    var y = b.ToCharArray();
    Array.Sort(x);
    Array.Sort(y);
    return x.SequenceEqual(y);
}
```

Grouping anagrams uses the sorted form as a key:

```csharp
static List<List<string>> GroupAnagrams(string[] words)
{
    var groups = new Dictionary<string, List<string>>();

    foreach (string word in words)
    {
        var letters = word.ToCharArray();
        Array.Sort(letters);
        string key = new string(letters);

        if (!groups.TryGetValue(key, out var group))
        {
            group = new List<string>();
            groups[key] = group;
        }

        group.Add(word);
    }

    return groups.Values.ToList();
}
```

## Reversing

```csharp
static string Reverse(string text)
{
    var chars = text.ToCharArray();
    Array.Reverse(chars);
    return new string(chars);
}

Console.WriteLine(Reverse("hello"));   // olleh
```

Reversing the words rather than the characters:

```csharp
static string ReverseWords(string sentence)
{
    var words = sentence.Split(' ', StringSplitOptions.RemoveEmptyEntries);
    Array.Reverse(words);
    return string.Join(" ", words);
}

Console.WriteLine(ReverseWords("  the sky  is blue "));   // blue is sky the
```

`RemoveEmptyEntries` handles the repeated and trailing spaces for you.

## Searching for a pattern

The straightforward search compares the pattern at every position.

```csharp
static int IndexOfPattern(string text, string pattern)
{
    if (pattern.Length == 0) return 0;

    for (int start = 0; start <= text.Length - pattern.Length; start++)
    {
        int i = 0;
        while (i < pattern.Length && text[start + i] == pattern[i]) i++;

        if (i == pattern.Length) return start;
    }

    return -1;
}

Console.WriteLine(IndexOfPattern("hello world", "world"));   // 6
```

Worst case `O(n * m)`. In practice it is close to `O(n)` on normal text, because mismatches usually happen on the first character.

`string.IndexOf` does this for you and is optimised, so use it in real code. Writing it out is worth doing once to see the shape.

Smarter algorithms like Knuth Morris Pratt guarantee `O(n + m)` by remembering what already matched, but they rarely earn their complexity outside specialised work.

## Longest common prefix

```csharp
static string LongestCommonPrefix(string[] words)
{
    if (words.Length == 0) return "";

    string prefix = words[0];

    foreach (string word in words)
    {
        while (!word.StartsWith(prefix))
        {
            prefix = prefix[..^1];               // drop the last character
            if (prefix.Length == 0) return "";
        }
    }

    return prefix;
}

Console.WriteLine(LongestCommonPrefix(new[] { "flower", "flow", "flight" }));   // fl
```

## Comparing safely

```csharp
string a = "Straße";
string b = "STRASSE";

Console.WriteLine(a.Equals(b, StringComparison.OrdinalIgnoreCase));      // False
Console.WriteLine(string.Equals("File", "file", StringComparison.Ordinal));  // False
Console.WriteLine(string.Equals("File", "file", StringComparison.OrdinalIgnoreCase));  // True
```

Use `Ordinal` and `OrdinalIgnoreCase` for identifiers, keys, file names and anything the user does not read as language. They compare raw values, so they are fast and predictable.

Use the culture aware comparisons only for text you are sorting for a human to read.

## Useful string methods

```csharp
string text = "  Hello, World  ";

text.Trim();                          // "Hello, World"
text.Replace("World", "there");       // new string
text.Split(',');                      // array of parts
text.Contains("World");               // O(n)
text.StartsWith("  He");              // O(m)
text.Substring(2, 5);                 // O(m), allocates
text.AsSpan(2, 5);                    // O(1), no allocation
string.IsNullOrWhiteSpace(text);      // the safe emptiness check
```

`AsSpan` is worth knowing. It gives you a view over part of a string with no copying, which matters when parsing large inputs.

## Quick recap

- A string is an array of characters, with `O(1)` indexing and `O(n)` searching.
- Strings are immutable, so every "change" allocates a new string.
- Building a string in a loop with `+=` is `O(n^2)`, use `StringBuilder`.
- Character counting with `int[26]` beats a dictionary for plain lowercase text.
- Anagrams are a counting problem, and sorted letters make a good group key.
- Use `StringComparison.Ordinal` for keys and identifiers.
- `AsSpan` slices without allocating, `Substring` copies.

<code id="code-content" class="language-csharp">
using System.Text;
// Strings are immutable: += in a loop is O(n^2)
var builder = new StringBuilder();
for (int i = 0; i &lt; 5; i++) builder.Append(i);
Console.WriteLine(builder.ToString());          // 01234
// Character counting: int[26] when the alphabet is known, dictionary otherwise
static int[] CountLowercase(string text)
{
    var counts = new int[26];
    foreach (char c in text) counts[c - 'a']++;   // 'c' - 'a' == 2
    return counts;
}
// Anagrams: count up with one string, count down with the other
static bool AreAnagrams(string a, string b)
{
    if (a.Length != b.Length) return false;
    var counts = new int[26];
    foreach (char c in a) counts[c - 'a']++;
    foreach (char c in b)
        if (--counts[c - 'a'] &lt; 0) return false;
    return true;
}
Console.WriteLine(AreAnagrams("listen", "silent"));   // True
// Group anagrams: the sorted letters make a perfect key
static List&lt;List&lt;string&gt;&gt; GroupAnagrams(string[] words)
{
    var groups = new Dictionary&lt;string, List&lt;string&gt;&gt;();
    foreach (string word in words)
    {
        var letters = word.ToCharArray();
        Array.Sort(letters);
        string key = new string(letters);
        if (!groups.TryGetValue(key, out var group)) groups[key] = group = new();
        group.Add(word);
    }
    return groups.Values.ToList();
}
// Reverse words, not characters
static string ReverseWords(string sentence)
{
    var words = sentence.Split(' ', StringSplitOptions.RemoveEmptyEntries);
    Array.Reverse(words);
    return string.Join(" ", words);
}
Console.WriteLine(ReverseWords("  the sky  is blue "));   // blue is sky the
// Compare identifiers with Ordinal, not culture aware comparisons
Console.WriteLine(string.Equals("File", "file", StringComparison.OrdinalIgnoreCase));
// AsSpan slices with no allocation, Substring copies
ReadOnlySpan&lt;char&gt; view = "Hello, World".AsSpan(7, 5);
Console.WriteLine(view.ToString());             // World
</code></pre>

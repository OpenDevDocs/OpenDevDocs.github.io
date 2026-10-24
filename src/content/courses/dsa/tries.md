---
publishDate: 2026-07-22T16:00
title: Tries
slug: tries
metadescription: Store strings in a tree of characters so prefix search, autocomplete and word lookup all cost only the length of the word.
updateDate: 2026-09-07T16:00
author: ['bishal-biswas']
level: 3
tags: ['trees', 'trie', 'strings']
course: dsa
---

## A tree of characters

A **trie**, also called a prefix tree, stores strings by breaking them into characters. Words sharing a prefix share the same path from the root.

```text
        root
        /  \
       c    d
       |    |
       a    o
      / \   |
     t   r  g
     *   *  *
```

That stores "cat", "car" and "dog". The star marks the end of a word.

Notice "cat" and "car" share the `c -> a` path. Prefix sharing is what a trie is for.

## The node

```csharp
public class TrieNode
{
    public Dictionary<char, TrieNode> Children = new();
    public bool IsEndOfWord;
}
```

No character is stored in the node. The character is the **key in the parent's dictionary**, which is what makes the structure work.

For a fixed alphabet, an array is faster and smaller:

```csharp
public class ArrayTrieNode
{
    public ArrayTrieNode?[] Children = new ArrayTrieNode[26];
    public bool IsEndOfWord;
}
```

26 slots per node is wasteful when most are null, but there is no hashing and no dictionary object. Use the array for lowercase words and the dictionary for arbitrary text.

## Insert, search, starts with

```csharp
public class Trie
{
    private readonly TrieNode root = new();

    public void Insert(string word)
    {
        var node = root;

        foreach (char c in word)
        {
            if (!node.Children.TryGetValue(c, out var next))
            {
                next = new TrieNode();
                node.Children[c] = next;
            }

            node = next;
        }

        node.IsEndOfWord = true;
    }

    public bool Contains(string word)
    {
        var node = FindNode(word);
        return node != null && node.IsEndOfWord;
    }

    public bool StartsWith(string prefix) => FindNode(prefix) != null;

    private TrieNode? FindNode(string text)
    {
        var node = root;

        foreach (char c in text)
        {
            if (!node.Children.TryGetValue(c, out var next)) return null;
            node = next;
        }

        return node;
    }
}

var trie = new Trie();
trie.Insert("cat");
trie.Insert("car");
trie.Insert("dog");

Console.WriteLine(trie.Contains("cat"));      // True
Console.WriteLine(trie.Contains("ca"));       // False, it is a prefix not a word
Console.WriteLine(trie.StartsWith("ca"));     // True
```

`Contains` and `StartsWith` differ only in the `IsEndOfWord` check. That flag is what distinguishes a stored word from a passing prefix, and forgetting it is the classic trie bug.

Every operation is `O(m)` where `m` is the length of the string. **It does not depend on how many words are stored.** A trie with ten words and one with ten million answer a five letter query in the same five steps.

## Autocomplete

The reason tries exist. Walk to the prefix, then collect everything beneath it.

```csharp
public List<string> WordsWithPrefix(string prefix, int limit = 10)
{
    var results = new List<string>();
    var node = FindNode(prefix);

    if (node == null) return results;

    Collect(node, prefix, results, limit);
    return results;
}

private void Collect(TrieNode node, string current, List<string> results, int limit)
{
    if (results.Count >= limit) return;

    if (node.IsEndOfWord) results.Add(current);

    foreach (var (c, child) in node.Children)
    {
        Collect(child, current + c, results, limit);

        if (results.Count >= limit) return;
    }
}

var words = new Trie();
foreach (string word in new[] { "car", "card", "care", "careful", "cat", "dog" })
{
    words.Insert(word);
}

Console.WriteLine(string.Join(", ", words.WordsWithPrefix("car")));
// car, card, care, careful
```

The `limit` check appears twice deliberately, so it stops immediately rather than after finishing a subtree.

Ordering the children in a `SortedDictionary` makes results come out alphabetically.

## Deleting

Harder than it looks, because you must not remove nodes that other words are using.

```csharp
public bool Delete(string word) => Delete(root, word, 0);

private bool Delete(TrieNode node, string word, int index)
{
    if (index == word.Length)
    {
        if (!node.IsEndOfWord) return false;    // the word was not there

        node.IsEndOfWord = false;
        return node.Children.Count == 0;        // safe to remove if it has no children
    }

    char c = word[index];

    if (!node.Children.TryGetValue(c, out var child)) return false;

    bool shouldRemoveChild = Delete(child, word, index + 1);

    if (shouldRemoveChild)
    {
        node.Children.Remove(c);
        return node.Children.Count == 0 && !node.IsEndOfWord;
    }

    return false;
}
```

The return value means "the caller may remove me". A node can only be removed if it has no children **and** is not the end of a shorter word.

Delete "careful" from a trie holding "car" and "careful" and only the tail nodes go. The `car` path survives.

## Word counts

Store more than a boolean and a trie becomes a prefix aware dictionary.

```csharp
public class CountingTrieNode
{
    public Dictionary<char, CountingTrieNode> Children = new();
    public int WordCount;         // how many times this exact word was inserted
    public int PrefixCount;       // how many words pass through here
}

public void Insert(string word)
{
    var node = root;
    node.PrefixCount++;

    foreach (char c in word)
    {
        if (!node.Children.TryGetValue(c, out var next))
        {
            next = new CountingTrieNode();
            node.Children[c] = next;
        }

        node = next;
        node.PrefixCount++;
    }

    node.WordCount++;
}
```

`PrefixCount` answers "how many stored words start with this prefix" in `O(m)`, with no counting at query time. That is how a search box shows a result count instantly.

## Trie or hash set?

```text
                          HashSet<string>     Trie
Exact lookup              O(1) average        O(m)
Prefix search             O(n * m)            O(m + results)
Memory                    lower               higher, a node per character
Sorted iteration          no                  yes
Longest common prefix     O(n * m)            O(m)
```

For exact lookups a `HashSet` wins. It hashes once and jumps straight there.

For anything involving prefixes, a trie is in a different class. A `HashSet` has to check every entry.

The cost is memory. Every character can become a node object with a dictionary inside it, which is far heavier than the characters themselves. A **compressed trie**, or radix tree, merges chains of single child nodes into one node holding a whole substring, cutting memory dramatically.

## Where tries are used

**Autocomplete and search suggestions.** The original use.

**Spell checkers.** Walk the trie allowing a limited number of mismatches to find near matches.

**IP routing.** Routers store network prefixes in a trie and match the longest one. This is exactly the prefix problem.

**Word games.** Solving a Boggle board means walking the grid and the trie together, abandoning a path the moment it stops being a valid prefix.

```csharp
static void Solve(char[,] board, int row, int col, TrieNode node, string current)
{
    if (row < 0 || row >= board.GetLength(0)) return;
    if (col < 0 || col >= board.GetLength(1)) return;

    char c = board[row, col];

    if (!node.Children.TryGetValue(c, out var next)) return;   // prune immediately

    // ... recurse into the neighbours with `next`
}
```

That single `TryGetValue` prunes enormous parts of the search. Without a trie you would have to generate every path and check each against a dictionary.

**T9 and predictive text.** Map digits to letters and walk all matching branches at once.

## Quick recap

- A trie stores strings as paths of characters, sharing common prefixes.
- The character is the key in the parent's map, not a field on the node.
- Operations cost `O(m)` in the word length, regardless of how many words are stored.
- `IsEndOfWord` is what separates a stored word from a passing prefix.
- Autocomplete is: walk to the prefix, then collect the subtree.
- Deletion must only remove nodes no other word needs.
- Use a hash set for exact lookups and a trie for anything prefix based.

<code id="code-content" class="language-csharp">
// The character is the KEY in the parent's map, not a field on the node
public class TrieNode
{
    public Dictionary&lt;char, TrieNode&gt; Children = new();
    public bool IsEndOfWord;
}
var root = new TrieNode();
void Insert(string word)
{
    var node = root;
    foreach (char c in word)
    {
        if (!node.Children.TryGetValue(c, out var next))
            node.Children[c] = next = new TrieNode();
        node = next;
    }
    node.IsEndOfWord = true;      // marks a real word, not just a prefix
}
TrieNode? FindNode(string text)
{
    var node = root;
    foreach (char c in text)
    {
        if (!node.Children.TryGetValue(c, out var next)) return null;
        node = next;
    }
    return node;
}
bool Contains(string word) =&gt; FindNode(word) is { IsEndOfWord: true };
bool StartsWith(string prefix) =&gt; FindNode(prefix) != null;
foreach (string w in new[] { "car", "card", "care", "careful", "cat", "dog" }) Insert(w);
Console.WriteLine(Contains("car"));       // True
Console.WriteLine(Contains("ca"));        // False, prefix only
Console.WriteLine(StartsWith("ca"));      // True
// O(m) in the WORD LENGTH. Ten words or ten million, same cost.
// Autocomplete: walk to the prefix, then collect everything beneath it
void Collect(TrieNode node, string current, List&lt;string&gt; results, int limit)
{
    if (results.Count &gt;= limit) return;
    if (node.IsEndOfWord) results.Add(current);
    foreach (var (c, child) in node.Children)
    {
        Collect(child, current + c, results, limit);
        if (results.Count &gt;= limit) return;
    }
}
var suggestions = new List&lt;string&gt;();
var start = FindNode("car");
if (start != null) Collect(start, "car", suggestions, 10);
Console.WriteLine(string.Join(", ", suggestions));   // car, card, care, careful
// A HashSet would have to check every stored word to do that.
// Counting variant: PrefixCount answers "how many words start with this" instantly
public class CountingNode
{
    public Dictionary&lt;char, CountingNode&gt; Children = new();
    public int WordCount, PrefixCount;
}
// Deleting must not remove nodes another word still needs.
// The recursion returns "the caller may remove me", true only when a node
// has no children AND is not the end of a shorter word.
</code></pre>

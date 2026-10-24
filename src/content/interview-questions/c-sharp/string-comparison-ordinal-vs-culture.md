---
course: c-sharp
slug: string-comparison-ordinal-vs-culture
experienceLevel: mid
difficulty: medium
tags:
  - strings
question: "How should you compare strings correctly in C# (ordinal vs culture-aware comparison)?"
answer: |
  Choosing the wrong kind of comparison causes subtle bugs.

  **Ordinal** comparison (`StringComparison.Ordinal` and `OrdinalIgnoreCase`) compares the raw UTF-16 code units. It's fast, predictable, and identical on every machine. Use it for anything machine-oriented: identifiers, dictionary keys, file paths, URLs, HTTP headers, and protocol values.

  **Culture-aware** comparison (`CurrentCulture`, `InvariantCulture`, and their `IgnoreCase` variants) applies linguistic rules: accents, sort orders, and language-specific equivalences. Use it for text shown to users, such as sorted lists of names.

  Common pitfalls:

  - `a.ToLower() == b.ToLower()` allocates two new strings and is culture-sensitive. In Turkish, `"I".ToLower()` isn't `"i"`, so such code breaks on Turkish machines. Use `string.Equals(a, b, StringComparison.OrdinalIgnoreCase)`.
  - Methods like `StartsWith(string)`, `IndexOf(string)`, and `CompareTo` default to the **current culture**, while `==` and `Equals` are ordinal. Pass a `StringComparison` explicitly; analyzers CA1307, CA1309, and CA1310 flag the omissions.
  - For dictionaries and sets, pass a `StringComparer`, such as `StringComparer.OrdinalIgnoreCase`.
codeExample: |
  using System.Globalization;

  string header = "Content-Type";
  Console.WriteLine(header.Equals("content-type", StringComparison.OrdinalIgnoreCase));
  // Output: True (machine identifier: ordinal)

  CultureInfo.CurrentCulture = new CultureInfo("tr-TR");
  Console.WriteLine("FILE".ToLower() == "file");            // Output: False (Turkish I!)
  Console.WriteLine(string.Equals("FILE", "file",
      StringComparison.OrdinalIgnoreCase));                  // Output: True

  // StartsWith(string) is culture-sensitive by default: be explicit
  bool safe = "Straße".StartsWith("Stra", StringComparison.Ordinal);

  // Dictionaries: choose the comparer explicitly
  var settings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
  {
      ["Timeout"] = "30"
  };
  Console.WriteLine(settings["TIMEOUT"]);                     // Output: 30

  // UI sorting: culture-aware on purpose
  string[] names = ["Émile", "Zoe", "Adam"];
  Array.Sort(names, StringComparer.CurrentCulture);
popularity: 7.2
isPublished: true
---

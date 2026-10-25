---
course: c-sharp
slug: icomparable-vs-icomparer
experienceLevel: mid
difficulty: easy
tags:
  - collections
question: "What is the difference between `IComparable<T>` and `IComparer<T>`?"
answer: |
  Both define ordering, but they live in different places.

  - `IComparable<T>` is implemented **by the type itself** and defines its **natural, default order** through `CompareTo(T other)`. `int`, `string`, and `DateTime` implement it, which is why `list.Sort()` works on them with no arguments.
  - `IComparer<T>` is a **separate object** that compares two instances through `Compare(T x, T y)`. It defines **alternative orders** without touching the type, which helps when you don't own the type or need several sort orders.

  Both return a negative number when the first item comes first, zero when the two are equal in order, and a positive number when the first item comes after the second.

  You pass an `IComparer<T>` to `List<T>.Sort`, `Array.Sort`, `OrderBy`, or the constructors of `SortedSet<T>` and `SortedDictionary<TKey, TValue>`. `Comparer<T>.Create` builds one from a lambda, and `StringComparer.OrdinalIgnoreCase` is a ready-made comparer.
codeExample: |
  var people = new List<Person> { new("Zoe", 31), new("Adam", 45), new("Mia", 28) };

  people.Sort();                            // natural order: IComparable<T>
  Console.WriteLine(string.Join(", ", people.Select(p => p.Name)));
  // Output: Adam, Mia, Zoe

  people.Sort(new ByAge());                 // custom order: IComparer<T>
  Console.WriteLine(people[0].Name);        // Output: Mia

  var oldestFirst = Comparer<Person>.Create((a, b) => b.Age.CompareTo(a.Age));
  Console.WriteLine(people.Order(oldestFirst).First().Name); // Output: Adam

  public record Person(string Name, int Age) : IComparable<Person>
  {
      public int CompareTo(Person? other) =>
          string.Compare(Name, other?.Name, StringComparison.Ordinal);
  }

  public class ByAge : IComparer<Person>
  {
      public int Compare(Person? x, Person? y) => (x?.Age ?? 0).CompareTo(y?.Age ?? 0);
  }
popularity: 7.2
isPublished: true
---

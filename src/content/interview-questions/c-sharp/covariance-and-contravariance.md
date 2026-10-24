---
course: c-sharp
slug: covariance-and-contravariance
experienceLevel: mid
difficulty: hard
tags:
  - generics
question: "What are covariance and contravariance in C# generics?"
answer: |
  They define when a generic type can be converted to the same generic type with a **related** type argument.

  **Covariance (`out T`)** lets you use a more-derived type argument where a less-derived one is expected. An `IEnumerable<string>` can be assigned to an `IEnumerable<object>`, because the interface only ever **returns** `T` values, and every string is an object. `Func<string>` converts to `Func<object>` the same way.

  **Contravariance (`in T`)** goes the other direction: an `IComparer<object>` can be used as an `IComparer<string>`, and an `Action<object>` as an `Action<string>`, because they only **accept** `T` values.

  Rules and limits:

  - Variance applies only to generic **interfaces and delegates**, never to classes, so a `List<string>` is not a `List<object>`. If it were, you could add an `int` to a list of strings.
  - It works only for **reference-type** arguments, because the conversion must be a reference conversion: `IEnumerable<int>` isn't an `IEnumerable<object>`.
  - Arrays have legacy, unsafe covariance: `object[] arr = new string[1]` compiles, and then `arr[0] = 1` throws `ArrayTypeMismatchException` at runtime.
codeExample: |
  // Covariance: out T, output positions only
  IEnumerable<string> names = ["Ada", "Grace"];
  IEnumerable<object> objects = names;          // OK: IEnumerable<out T>
  Func<string> getName = () => "Ada";
  Func<object> getObject = getName;             // OK: Func<out TResult>

  // Contravariance: in T, input positions only
  Action<object> printAny = o => Console.WriteLine(o);
  Action<string> printString = printAny;        // OK: Action<in T>
  printString("Hello");                         // Output: Hello

  IComparer<object> byHash = Comparer<object>.Create((a, b) =>
      a.GetHashCode().CompareTo(b.GetHashCode()));
  IComparer<string> forStrings = byHash;        // OK: IComparer<in T>

  // List<object> list = new List<string>();    // compile error: classes are invariant
  // IEnumerable<object> ints = new List<int>(); // compile error: value types excluded

  object[] arr = new string[1];                 // legacy array covariance
  try { arr[0] = 42; }
  catch (ArrayTypeMismatchException) { Console.WriteLine("Array covariance bit us"); }

  // Declaring your own variant interface
  public interface IProducer<out T> { T Produce(); }
popularity: 8.2
isPublished: true
---

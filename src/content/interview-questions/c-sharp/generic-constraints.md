---
course: c-sharp
slug: generic-constraints
experienceLevel: mid
difficulty: medium
tags:
  - generics
question: "What are generic constraints in C#, and which ones are available?"
answer: |
  A **constraint**, written with `where`, restricts which types can be used as a type argument. In return, generic code can use what the constraint guarantees, and misuse becomes a compile error.

  The main constraints:

  - `where T : class` (reference type), or `class?` to also allow nullable reference types.
  - `where T : struct`: a non-nullable value type.
  - `where T : notnull`: any non-nullable type.
  - `where T : unmanaged`: a value type with no references inside, needed for pointers and `stackalloc`.
  - `where T : new()`: has a public parameterless constructor, so you can write `new T()`.
  - `where T : SomeBaseClass` or `where T : ISomeInterface`: lets you call that type's members on `T`.
  - `where T : U`: `T` must be or derive from another type parameter.
  - `allows ref struct` (C# 13): an anti-constraint that permits ref struct type arguments such as `Span<T>`.

  Order matters: the primary constraint (`class`, `struct`, `unmanaged`, `notnull`, or a base class) comes first, then interfaces, then `new()`. Each type parameter gets its own `where` clause.
codeExample: |
  var repo = new Repository<Customer>();
  repo.Add(new Customer { Name = "Ada" });
  Console.WriteLine(repo.CreateDefault().Name); // Output: (new)

  Console.WriteLine(Max(3, 9));                 // Output: 9
  Console.WriteLine(Max("apple", "pear"));      // Output: pear
  // var bad = new Repository<int>();           // compile error: int isn't a class

  // Interface constraint: lets the method call CompareTo on T
  static T Max<T>(T a, T b) where T : IComparable<T> => a.CompareTo(b) >= 0 ? a : b;

  // Primary constraint, then interfaces, then new()
  public class Repository<TEntity> where TEntity : class, IEntity, new()
  {
      private readonly List<TEntity> _items = [];
      public void Add(TEntity entity) => _items.Add(entity);
      public TEntity CreateDefault() => new TEntity { Name = "(new)" }; // needs new()
  }

  public interface IEntity { string Name { get; set; } }
  public class Customer : IEntity { public string Name { get; set; } = ""; }
popularity: 8.4
isPublished: true
---

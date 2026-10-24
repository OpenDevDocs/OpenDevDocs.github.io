---
course: c-sharp
slug: ienumerable-vs-iqueryable
experienceLevel: mid
difficulty: medium
tags:
  - linq
  - collections
question: "What is the difference between `IEnumerable<T>` and `IQueryable<T>`?"
answer: |
  Both represent sequences you can query with LINQ, but they execute in different places.

  - `IEnumerable<T>` is **LINQ to Objects**. Operators such as `Where` take compiled delegates (`Func<T, bool>`) and run them in memory, in your process.
  - `IQueryable<T>` holds an **expression tree** plus a **query provider**. Operators take `Expression<Func<T, bool>>`, so the provider can inspect the query and translate it, for example into SQL with Entity Framework Core. Filtering, sorting, and paging then happen in the **database**, and only matching rows come back.

  The big pitfall is switching to `IEnumerable<T>` too early. Calling `AsEnumerable()` or `ToList()` before `Where`, or passing a `DbSet` to a method that takes `IEnumerable<T>`, loads the whole table into memory and filters it there.

  Two more points. Only expressions the provider understands can be translated, so calling your own C# method inside an EF Core query can fail at runtime. And exposing `IQueryable<T>` from a repository leaks query-building responsibility to callers, so many teams return materialized results instead.
codeExample: |
  // EF Core example: db.Products is a DbSet<Product>, which is IQueryable<Product>

  // IQueryable: Where/OrderBy/Take become SQL, so only 10 rows come back
  List<Product> cheap = await db.Products
      .Where(p => p.Price < 20)
      .OrderBy(p => p.Price)
      .Take(10)
      .ToListAsync();
  // SQL: SELECT TOP(10) ... FROM Products WHERE Price < 20 ORDER BY Price

  // IEnumerable too early: every row is loaded, then filtered in memory
  List<Product> slow = db.Products
      .AsEnumerable()                 // switches to LINQ to Objects
      .Where(p => p.Price < 20)
      .ToList();

  // The hidden version of the same mistake:
  static List<Product> Filter(IEnumerable<Product> items) =>
      items.Where(p => p.Price < 20).ToList(); // Filter(db.Products) loads everything

  // Not translatable: a custom C# method inside an IQueryable query
  // db.Products.Where(p => IsOnSale(p)).ToList(); // throws at runtime in EF Core
popularity: 9.3
isPublished: true
---

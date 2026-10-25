---
course: c-sharp
slug: expression-trees
experienceLevel: senior
difficulty: hard
tags:
  - linq
  - reflection
question: "What are expression trees in C#, and how do LINQ providers like EF Core use them?"
answer: |
  When a lambda is assigned to `Expression<TDelegate>` instead of a delegate type, the compiler doesn't compile it to IL. It emits code that builds a **data structure** describing the lambda: a tree of `Expression` nodes such as `ParameterExpression`, `MemberExpression`, and `ConstantExpression`.

  Because the code becomes data, it can be:

  - **Inspected and translated:** this is how `IQueryable<T>` works. `Queryable.Where` takes an `Expression<Func<T, bool>>`, and EF Core's provider walks the tree and generates SQL. `Enumerable.Where` takes a plain `Func<T, bool>` and just runs it in memory.
  - **Built dynamically at runtime:** you can compose filters from user input with `Expression.Parameter`, `Expression.Property`, `Expression.Equal`, and `Expression.Lambda`.
  - **Compiled:** `expression.Compile()` produces a delegate. Cached compiled expressions are a classic way to build fast property accessors and object mappers without per-call reflection.

  Limitations: only expression-bodied lambdas convert, not statement bodies, and some newer syntax isn't supported inside expression trees. Providers can also translate only what they understand, so an arbitrary C# method call inside an EF Core query fails at runtime. And `Compile()` is expensive, so cache its result.
codeExample: |
  using System.Linq.Expressions;

  Func<Product, bool> compiled = p => p.Price > 100;             // IL: it just runs
  Expression<Func<Product, bool>> tree = p => p.Price > 100;     // data: inspectable
  Console.WriteLine(tree.Body);             // Output: (p.Price > 100)

  // Build a filter dynamically: p => p.<property> == value
  static Expression<Func<T, bool>> PropertyEquals<T>(string property, object value)
  {
      var p = Expression.Parameter(typeof(T), "p");
      var member = Expression.Property(p, property);
      var body = Expression.Equal(member, Expression.Constant(value));
      return Expression.Lambda<Func<T, bool>>(body, p);
  }

  var byCategory = PropertyEquals<Product>("Category", "Books");
  Console.WriteLine(byCategory);            // Output: p => (p.Category == "Books")

  // With EF Core, db.Products.Where(byCategory) becomes SQL: WHERE Category = 'Books'
  // In memory, compile once and reuse the delegate:
  var isBook = byCategory.Compile();
  Console.WriteLine(isBook(new Product("Dune", 20m, "Books")));  // Output: True

  record Product(string Name, decimal Price, string Category);
popularity: 7.8
isPublished: true
---

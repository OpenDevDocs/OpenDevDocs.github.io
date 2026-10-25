---
course: c-sharp
slug: what-is-linq
experienceLevel: fresher
difficulty: easy
tags:
  - linq
question: "What is LINQ, and why is it useful?"
answer: |
  **LINQ (Language Integrated Query)** lets you query data directly in C# with one consistent set of operators, whether the data lives in an in-memory collection, in a database through Entity Framework Core, or in an XML document.

  Instead of writing loops with temporary lists and counters, you describe **what** you want: filter with `Where`, transform with `Select`, sort with `OrderBy`, group with `GroupBy`, and aggregate with `Count`, `Sum`, or `Any`. The compiler type-checks queries, and you get full IntelliSense.

  LINQ has two syntaxes:

  - **Method syntax:** chained extension methods with lambdas, such as `numbers.Where(n => n > 5)`. This is the most common style.
  - **Query syntax:** SQL-like keywords (`from`, `where`, `select`), which the compiler translates into the same method calls.

  Most LINQ operators use **deferred execution**: the query runs when you enumerate it, for example with `foreach` or `ToList()`, not when you define it.
codeExample: |
  var products = new[]
  {
      new { Name = "Laptop", Price = 1200m, Category = "Tech" },
      new { Name = "Pen", Price = 2m, Category = "Office" },
      new { Name = "Mouse", Price = 25m, Category = "Tech" },
  };

  // Method syntax
  var techNames = products
      .Where(p => p.Category == "Tech")
      .OrderBy(p => p.Price)
      .Select(p => p.Name);

  // Query syntax: compiles to the same method calls
  var techNames2 = from p in products
                   where p.Category == "Tech"
                   orderby p.Price
                   select p.Name;

  Console.WriteLine(string.Join(", ", techNames));        // Output: Mouse, Laptop
  Console.WriteLine(techNames.SequenceEqual(techNames2)); // Output: True
  Console.WriteLine(products.Sum(p => p.Price));          // Output: 1227
  Console.WriteLine(products.Any(p => p.Price > 1000));   // Output: True
popularity: 8.9
isPublished: true
---

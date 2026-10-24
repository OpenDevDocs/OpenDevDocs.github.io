---
publishDate: 2026-04-19T11:33
title: LINQ Query Syntax
slug: linq-query-syntax
metadescription: Write LINQ using the SQL like from, where, orderby, select syntax, use let, group by and join clauses, and know when query syntax reads better than method chains.
updateDate: 2026-09-05T11:33
author: ['bishal-biswas']
level: 3
tags: ['linq', 'query-syntax']
course: c-sharp
---

## Two ways to write the same query

LINQ comes in two flavours. **Method syntax** chains calls like `Where` and `Select`. **Query syntax** uses keywords built into the language that look a lot like SQL:

```csharp
var numbers = new[] { 5, 12, 8, 21, 3, 16 };

// Method syntax
var big1 = numbers.Where(n => n > 10).OrderBy(n => n).Select(n => n * 2);

// Query syntax
var big2 = from n in numbers
           where n > 10
           orderby n
           select n * 2;
```

They produce identical results, and the compiler turns query syntax into the method calls behind the scenes. Everything you learned about deferred execution applies to both.

## The shape of a query expression

Every query expression starts with `from` and ends with `select` or `group`:

```csharp
var query = from item in source     // the range variable and the source
            where condition         // optional filters
            orderby key             // optional ordering
            select projection;      // what each result looks like
```

`item` is the **range variable**. It stands for one element at a time, just like the `n` in `n => n > 10`.

## from and select

The simplest query just passes items through:

```csharp
var names = new List<string> { "Asha", "Ravi", "Meera" };

var all = from name in names
          select name;

var lengths = from name in names
              select name.Length;      // 4 4 5

var shouted = from name in names
              select name.ToUpper();
```

## where

Add one or more conditions. Several `where` clauses are combined with and:

```csharp
record Product(string Name, string Category, decimal Price, int Stock);

var products = new List<Product>
{
    new("Keyboard", "Hardware", 49.99m, 12),
    new("Mouse", "Hardware", 19.99m, 0),
    new("C# Book", "Books", 39.99m, 5),
    new("Monitor", "Hardware", 199.99m, 3)
};

var available = from p in products
                where p.Stock > 0
                where p.Price < 100
                select p.Name;           // Keyboard, C# Book
```

## orderby

```csharp
var byPrice = from p in products
              orderby p.Price
              select p;

var byCategoryThenPrice = from p in products
                          orderby p.Category, p.Price descending
                          select $"{p.Category}: {p.Name}";
```

Separate keys with commas and add `descending` after any key that should be reversed.

## let: naming an intermediate value

`let` introduces a variable you can use in the rest of the query. It avoids repeating a calculation:

```csharp
var report = from p in products
             let value = p.Price * p.Stock
             where value > 100
             orderby value descending
             select $"{p.Name}: {value:C}";
```

Method syntax has no direct equivalent. You would need a `Select` into a temporary object. This is one place where query syntax is genuinely cleaner.

## Projecting into new shapes

`select` can build anonymous objects, tuples or records:

```csharp
var summaries = from p in products
                select new { p.Name, Total = p.Price * p.Stock };

foreach (var s in summaries)
{
    Console.WriteLine($"{s.Name} = {s.Total}");
}

var pairs = from p in products
            select (p.Name, InStock: p.Stock > 0);
```

## group by

Grouping is where query syntax really shines. `group ... by ...` collects items into groups keyed by a value:

```csharp
var byCategory = from p in products
                 group p by p.Category;

foreach (var group in byCategory)
{
    Console.WriteLine(group.Key);              // Hardware, then Books
    foreach (var p in group)
    {
        Console.WriteLine($"  {p.Name}");
    }
}
```

Each group has a `Key` and is itself a sequence of the items. To keep querying after grouping, use `into`:

```csharp
var categoryTotals = from p in products
                     group p by p.Category into g
                     orderby g.Key
                     select new
                     {
                         Category = g.Key,
                         Count = g.Count(),
                         Value = g.Sum(p => p.Price * p.Stock)
                     };
```

## join

Combine two sequences on a matching key, just like a SQL inner join:

```csharp
record Order(int Id, string ProductName, int Quantity);

var orders = new List<Order>
{
    new(1, "Keyboard", 2),
    new(2, "Monitor", 1),
    new(3, "Webcam", 1)       // no matching product
};

var lines = from o in orders
            join p in products on o.ProductName equals p.Name
            select new { o.Id, p.Name, Total = p.Price * o.Quantity };

foreach (var line in lines)
{
    Console.WriteLine($"Order {line.Id}: {line.Name} {line.Total}");
}
// Order 1: Keyboard 99.98
// Order 2: Monitor 199.99
```

Note the keyword is `equals`, not `==`. The webcam order is dropped because nothing matches. For a left join, use `join ... into` followed by `DefaultIfEmpty()`.

## Multiple from clauses

A second `from` flattens nested collections, the same as `SelectMany`:

```csharp
record Student(string Name, List<string> Courses);

var students = new List<Student>
{
    new("Asha", new() { "C#", "SQL" }),
    new("Ravi", new() { "C#" })
};

var enrolments = from s in students
                 from c in s.Courses
                 select $"{s.Name} takes {c}";
// Asha takes C#, Asha takes SQL, Ravi takes C#
```

## Mixing the two syntaxes

Query syntax has no keywords for `Count`, `First`, `Take`, `Distinct` and many others. Wrap the query in brackets and chain methods onto it:

```csharp
int count = (from p in products where p.Stock == 0 select p).Count();

var top2 = (from p in products
            orderby p.Price descending
            select p.Name).Take(2);
```

## When to use query syntax

- Use it for `join`, `group by` and `let`, where it reads more naturally.
- Use it when a query has many clauses and the SQL like layout is easier to scan.
- Use method syntax for short filters and anything needing operators that have no keyword.

Both are fine. Most teams pick one style for simple queries and stay consistent.

## Quick recap

- Query syntax uses `from`, `where`, `orderby`, `select` and compiles to the same methods.
- `let` names an intermediate value, which method syntax cannot do as cleanly.
- `group by` produces groups with a `Key`, and `into` lets you keep querying.
- `join ... on ... equals ...` combines two sequences on a key.
- A second `from` flattens nested collections.
- Wrap a query in brackets to chain methods that have no keyword.

<code id="code-content" class="language-csharp">
// LINQ query syntax
record Product(string Name, string Category, decimal Price, int Stock);
record Order(int Id, string ProductName, int Quantity);
var products = new List&lt;Product&gt;
{
    new("Keyboard", "Hardware", 49.99m, 12),
    new("Mouse", "Hardware", 19.99m, 0),
    new("C# Book", "Books", 39.99m, 5),
    new("Monitor", "Hardware", 199.99m, 3)
};
var orders = new List&lt;Order&gt; { new(1, "Keyboard", 2), new(2, "Monitor", 1), new(3, "Webcam", 1) };
// from, let, where, orderby, select
var report = from p in products
             let value = p.Price * p.Stock          // name an intermediate value
             where value &gt; 100
             orderby value descending
             select $"{p.Name}: {value:F2}";
foreach (var line in report) Console.WriteLine(line);
// group by with into, then aggregate each group
var totals = from p in products
             group p by p.Category into g
             orderby g.Key
             select new { Category = g.Key, Count = g.Count(), Stock = g.Sum(p =&gt; p.Stock) };
foreach (var t in totals)
    Console.WriteLine($"{t.Category}: {t.Count} products, {t.Stock} in stock");
// join two sequences on a key
var lines = from o in orders
            join p in products on o.ProductName equals p.Name
            select new { o.Id, p.Name, Total = p.Price * o.Quantity };
foreach (var l in lines)
    Console.WriteLine($"Order {l.Id}: {l.Name} {l.Total}");   // Webcam order is dropped
// Second from flattens nested collections
record Student(string Name, List&lt;string&gt; Courses);
var students = new List&lt;Student&gt; { new("Asha", new() { "C#", "SQL" }), new("Ravi", new() { "C#" }) };
var enrolments = from s in students
                 from c in s.Courses
                 select $"{s.Name} takes {c}";
Console.WriteLine(string.Join(", ", enrolments));
// Mix in method syntax for operators without keywords
var cheapest2 = (from p in products orderby p.Price select p.Name).Take(2);
Console.WriteLine(string.Join(", ", cheapest2));     // Mouse, C# Book
</code></pre>

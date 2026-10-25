---
course: c-sharp
slug: select-vs-selectmany
experienceLevel: mid
difficulty: medium
tags:
  - linq
question: "What is the difference between `Select` and `SelectMany` in LINQ?"
answer: |
  `Select` is a **one-to-one projection**: every input element produces exactly one output element. If your selector returns a collection, you get a sequence of collections, such as `IEnumerable<List<OrderLine>>`.

  `SelectMany` is a **one-to-many projection that flattens**: the selector returns a sequence for each element, and `SelectMany` concatenates all those sequences into one flat `IEnumerable<T>`.

  Typical uses of `SelectMany`:

  - Getting all order lines across many orders.
  - Splitting sentences into words, or flattening a list of lists.
  - Building cross joins or combinations.

  An overload takes a second **result selector** that receives both the parent and the child, so you can keep context, such as the order ID next to each line. In query syntax, two `from` clauses compile to `SelectMany`.

  With EF Core, `SelectMany` over a navigation collection translates to a SQL join, so the flattening happens in the database.
codeExample: |
  var orders = new List<Order>
  {
      new(1, ["Book", "Pen"]),
      new(2, ["Lamp"]),
  };

  IEnumerable<List<string>> nested = orders.Select(o => o.Items);  // 2 lists
  IEnumerable<string> flat = orders.SelectMany(o => o.Items);      // 3 items

  Console.WriteLine(nested.Count());           // Output: 2
  Console.WriteLine(string.Join(", ", flat));  // Output: Book, Pen, Lamp

  // A result selector keeps the parent alongside each child
  var lines = orders.SelectMany(o => o.Items, (o, item) => $"#{o.Id}: {item}");
  Console.WriteLine(string.Join(" | ", lines)); // Output: #1: Book | #1: Pen | #2: Lamp

  // Query syntax: a second 'from' compiles to SelectMany
  var same = from o in orders
             from item in o.Items
             select item;

  record Order(int Id, List<string> Items);
popularity: 8.3
isPublished: true
---
